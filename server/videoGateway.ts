import { spawn, type ChildProcess } from 'node:child_process';
import { access, chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function freePort(): Promise<number> {
  return new Promise(r => {
    const s = createServer().listen(58080, '127.0.0.1', () => s.close(() => r(58080)));
    s.on('error', () => createServer().listen(0, '127.0.0.1', function () {
      const p = (s.address() as any).port;
      s.close(() => r(p));
    }));
  });
}

/** Camera credentials are stored only in a private, per-session temporary configuration. */
export class VideoGateway {
  private child:ChildProcess|null=null;
  private directory='';
  private url='';
  private failure='';
  async start(rtspUrl:string) {
    await this.stop();this.failure='';
    const binary=path.resolve(process.env.GO2RTC_PATH||path.join('.tools',process.platform==='win32'?'go2rtc.exe':'go2rtc'));
    try{await access(binary,process.platform==='win32'?constants.F_OK:constants.X_OK);}
    catch{throw new Error('Video gateway is not installed or executable. Run npm run setup:video, or set GO2RTC_PATH to its executable.');}
    const mediaPort=Number(process.env.GO2RTC_WEBRTC_PORT||8555);
    if(!Number.isInteger(mediaPort)||mediaPort<1||mediaPort>65535)throw new Error('GO2RTC_WEBRTC_PORT must be a valid port.');
    const mediaHost=process.env.GO2RTC_WEBRTC_HOST||'127.0.0.1';
    const listenHost=mediaHost.includes(':')?`[${mediaHost}]`:mediaHost;
    const candidates=process.env.GO2RTC_CANDIDATE?.split(',').map(s=>s.trim()).filter(Boolean);
    try {
      const port=await freePort();this.url=`http://127.0.0.1:${port}`;
      this.directory=await mkdtemp(path.join(tmpdir(),'vaas-go2rtc-'));
      if(process.platform!=='win32')await chmod(this.directory,0o700);
      const configuration={api:{listen:`127.0.0.1:${port}`},rtsp:{listen:''},
        webrtc:{listen:`${listenHost}:${mediaPort}`,ice_servers:[],
          candidates:candidates?.length?candidates:mediaHost==='127.0.0.1'?[`127.0.0.1:${mediaPort}`]:[]},
        streams:{camera:[rtspUrl]},log:{level:'warn'}};
      const file=path.join(this.directory,'go2rtc.yaml');
      await writeFile(file,JSON.stringify(configuration),{mode:0o600});
      const child=spawn(binary,['-config',file],{stdio:['ignore','ignore','pipe'],windowsHide:true});this.child=child;
      child.on('error',error=>{this.failure=error.message;});
      child.stderr?.on('data',chunk=>{this.failure=(this.failure+String(chunk)).slice(-2000);});
      for(let i=0;i<50;i++) {
        if(child.exitCode!==null||child.signalCode||this.failure.includes('ENOENT'))throw new Error('Video gateway could not start. Check its executable and WebRTC port.');
        try{const response=await fetch(`${this.url}/api/streams`,{signal:AbortSignal.timeout(300)});if(response.ok)return;}catch{}
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      throw new Error('Video gateway did not become ready. Check its executable and firewall settings.');
    }catch(error){await this.stop();throw error;}
  }
  async offer(sdp:string):Promise<string> {
    if(!this.child||this.child.exitCode!==null||this.child.signalCode)throw new Error('Video gateway has stopped. Reconnect the camera.');
    const response=await fetch(`${this.url}/api/webrtc?src=camera&video=H264`,{method:'POST',headers:{'Content-Type':'application/sdp'},body:sdp,signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Could not open the camera in WebRTC. Select standard H.264 without B-frames and check RTSP credentials and port.');
    return response.text();
  }
  async stop() {
    const child=this.child;this.child=null;
    if(child&&child.exitCode===null&&!child.signalCode)await new Promise<void>(resolve=>{
      const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},1500);
      child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill('SIGTERM');
    });
    const directory=this.directory;this.directory='';this.url='';
    if(directory)await rm(directory,{recursive:true,force:true});
  }
}
