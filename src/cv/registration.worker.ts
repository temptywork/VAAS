import { VisualRegistrationEngine } from './registrationEngine';
import type { FrameJob, FrameResult } from './registrationRuntime';

const engine=new VisualRegistrationEngine();
let lastReferences=-1;
const scope=globalThis as unknown as {onmessage:((event:MessageEvent<FrameJob>)=>void)|null;postMessage:(result:FrameResult)=>void};
scope.onmessage=({data})=>{
  try {
    engine.settings=data.settings;
    engine.configurePtz(data.calibration,data.cameraKey);
    if(data.state)engine.restoreReferences(data.state);
    engine.setFramePose(data.pose,data.poseAge);
    const time=data.time+data.origin-performance.timeOrigin;
    const metrics=engine.processFrame(data.image,time);
    const version=engine.getReferenceVersion();
    scope.postMessage({id:data.id,metrics,state:engine.exportState(version!==lastReferences)});
    lastReferences=version;
  }catch(error){scope.postMessage({id:data.id,error:error instanceof Error?error.message:'Registration failed.'});}
};
