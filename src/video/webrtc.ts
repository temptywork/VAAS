/** Same-origin non-trickle SDP. Camera RTSP credentials stay on the server. */
export async function connectWebRtc(video:HTMLVideoElement,sessionId:string,signal:AbortSignal,onError:(message:string)=>void):Promise<RTCPeerConnection> {
  if(!globalThis.RTCPeerConnection)throw new Error('WebRTC needs a supported browser and an HTTPS or localhost page.');
  signal.throwIfAborted();
  const pc=new RTCPeerConnection({iceServers:[],bundlePolicy:'max-bundle'});
  let disconnected:ReturnType<typeof setTimeout>|undefined,firstFrame:ReturnType<typeof setTimeout>|undefined;
  const loaded=()=>clearTimeout(firstFrame);
  const abort=()=>{clearTimeout(disconnected);clearTimeout(firstFrame);video.removeEventListener('loadeddata',loaded);pc.close();video.srcObject=null;};
  signal.addEventListener('abort',abort,{once:true});
  const fail=(message:string)=>{if(!signal.aborted)onError(message);};
  const transceiver=pc.addTransceiver('video',{direction:'recvonly'});
  const codecs=RTCRtpReceiver.getCapabilities?.('video')?.codecs;
  if(codecs&&transceiver.setCodecPreferences){
    const h264=codecs.filter(c=>c.mimeType.toLowerCase()==='video/h264');
    if(!h264.length){abort();throw new Error('This browser cannot decode H.264 through WebRTC. Select HLS playback.');}
    transceiver.setCodecPreferences([...h264,...codecs.filter(c=>!h264.includes(c))]);
  }
  try{(transceiver.receiver as RTCRtpReceiver&{playoutDelayHint?:number}).playoutDelayHint=0;}catch{}
  pc.ontrack=event=>{
    if(signal.aborted)return;
    video.srcObject=event.streams[0]||new MediaStream([event.track]);
    event.track.addEventListener('ended',()=>fail('The camera video track ended. Reconnecting…'),{once:true});
    void video.play().catch(error=>fail(`Could not play camera video: ${error instanceof Error?error.message:'playback failed'}`));
  };
  pc.onconnectionstatechange=()=>{
    clearTimeout(disconnected);
    if(pc.connectionState==='failed')fail('WebRTC connection failed. Check the configured gateway media port and reconnect.');
    if(pc.connectionState==='disconnected')disconnected=setTimeout(()=>fail('Camera video disconnected. Reconnecting…'),5000);
  };
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise<void>((resolve,reject)=>{
      let timer:ReturnType<typeof setTimeout>;
      const done=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',changed);signal.removeEventListener('abort',cancel);resolve();};
      const changed=()=>{if(pc.iceGatheringState==='complete')done();};
      const cancel=()=>{done();reject(new DOMException('Aborted','AbortError'));};
      timer=setTimeout(done,5000);pc.addEventListener('icegatheringstatechange',changed);signal.addEventListener('abort',cancel,{once:true});changed();
    });
    signal.throwIfAborted();
    const response=await fetch('/api/onvif/webrtc',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sessionId,sdp:pc.localDescription?.sdp}),signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'WebRTC negotiation failed.');
    signal.throwIfAborted();await pc.setRemoteDescription({type:'answer',sdp:data.sdp});
    firstFrame=setTimeout(()=>{if(video.readyState<2)fail('No video frames arrived. Check the H.264 camera profile, RTSP access, and gateway media port.');},20000);
    video.addEventListener('loadeddata',loaded,{once:true});if(video.readyState>=2)loaded();
    return pc;
  }catch(error){abort();signal.removeEventListener('abort',abort);throw error;}
}
