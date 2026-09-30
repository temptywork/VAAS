import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';

async function freePort(): Promise<number> {
  const allocate = (port: number): Promise<number> => new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate the gateway API port.'));
        return;
      }
      const allocatedPort = address.port;
      server.close(error => error ? reject(error) : resolve(allocatedPort));
    });
  });
  try {
    return await allocate(58080);
  } catch {
    return allocate(0);
  }
}

/** Camera credentials are stored in a private, per-session configuration under .tools. */
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
    try {
      const port=await freePort();this.url=`http://127.0.0.1:${port}`;
      const toolsDirectory = path.resolve('.tools');
      await mkdir(toolsDirectory, { recursive: true });
      this.directory = path.join(toolsDirectory, `go2rtc-${randomUUID()}`);
      await mkdir(this.directory, { mode: 0o700 });
      const configuration = {
        api: { listen: `127.0.0.1:${port}` },
        rtsp: { listen: '' },
        webrtc: { listen: ':8555' },
        streams: { camera: [rtspUrl] },
        log: { level: 'warn' },
      };
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
