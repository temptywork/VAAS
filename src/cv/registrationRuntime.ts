import type { CameraPtzPose, PtzCalibration, RegistrationMetrics } from '../types';
import { VisualRegistrationEngine, type RegistrationState } from './registrationEngine';

export interface FrameJob {
  id:number; image:ImageData; state?:RegistrationState;
  settings:VisualRegistrationEngine['settings']; calibration:PtzCalibration|null;
  cameraKey:string; pose:CameraPtzPose|null; poseAge:number; time:number; origin:number;
}
export interface FrameResult { id:number; state?:RegistrationState; metrics?:RegistrationMetrics; error?:string }

/** One in-flight CV frame, no growing queue. Pose projection remains on the presentation thread. */
export class RegistrationRuntime extends VisualRegistrationEngine {
  private worker:Worker|null=null;
  private workerFailed=false;
  private referenceDirty=true;
  private sequence=0;
  private pending:{id:number;resolve:(m:RegistrationMetrics|null)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}|null=null;
  private framePose:CameraPtzPose|null=null;
  private frameAge=Infinity;
  private ptzCalibration:PtzCalibration|null=null;
  private ptzCameraKey='';
  private frameSize='';

  override configurePtz(c:PtzCalibration|null,key:string) {
    if(JSON.stringify([this.ptzCalibration,this.ptzCameraKey])!==JSON.stringify([c,key])){this.dispose();this.referenceDirty=true;}
    super.configurePtz(c,key);this.ptzCalibration=c;this.ptzCameraKey=key;
  }
  override setFramePose(p:CameraPtzPose|null,age=Infinity) {super.setFramePose(p,age);this.framePose=p;this.frameAge=age;}
  override addSetupKeyframe(...args:Parameters<VisualRegistrationEngine['addSetupKeyframe']>) {
    this.dispose();this.referenceDirty=true;return super.addSetupKeyframe(...args);
  }
  override reset() {this.dispose();this.workerFailed=false;this.referenceDirty=true;super.reset();}
  dispose() {
    this.worker?.terminate();this.worker=null;
    if(this.pending){clearTimeout(this.pending.timer);this.pending.resolve(null);this.pending=null;}
  }
  private createWorker() {
    const worker=new Worker(new URL('./registration.worker.ts',import.meta.url),{type:'module'});
    this.worker=worker;this.referenceDirty=true;
    worker.onmessage=({data}:MessageEvent<FrameResult>)=>{
      const pending=this.pending;if(!pending||pending.id!==data.id)return;
      clearTimeout(pending.timer);this.pending=null;
      if(data.error){pending.reject(new Error(data.error));return;}
      if(data.state&&data.metrics){
        this.acceptProcessedState(data.state);
        const mode=this.getProjectionMode();
        const quality=mode==='uncertain'?'LOST':mode==='ptz'?'DEGRADED':data.metrics.quality;
        const sameView=data.metrics.activeViewId===this.getCurrentMatchedView().id;
        pending.resolve({...data.metrics,...this.getProjectionMetrics(),mode,quality,
          inliers:sameView?this.getInliers().length:0,totalMatches:sameView?this.getMatches().length:0,
          reprojectionError:sameView?data.metrics.reprojectionError:0,
          candidateKeypointsRef:this.getReferenceKeypoints().length});
      }else pending.resolve(null);
    };
    worker.onerror=()=>{
      const pending=this.pending;this.pending=null;
      if(pending){clearTimeout(pending.timer);pending.reject(new Error('Background registration stopped. Processing will resume on the next frame.'));}
      worker.terminate();this.worker=null;this.workerFailed=true;
    };
  }
  async processFrameAsync(image:ImageData,time=performance.now()):Promise<RegistrationMetrics|null> {
    if(this.hasExternalGeometry())return super.processFrame(image,time);
    this.updatePtzProjection(image.width,image.height,time);
    const size=`${image.width}x${image.height}`;
    if(this.frameSize&&size!==this.frameSize){this.dispose();this.referenceDirty=true;}
    this.frameSize=size;
    if(this.pending)return null;
    if(this.workerFailed||typeof Worker==='undefined')return super.processFrame(image,time);
    if(!this.worker){try{this.createWorker();}catch{this.workerFailed=true;return super.processFrame(image,time);}}
    const id=++this.sequence;
    const job:FrameJob={id,image,settings:this.settings,calibration:this.ptzCalibration,cameraKey:this.ptzCameraKey,
      pose:this.framePose,poseAge:this.frameAge,time,origin:performance.timeOrigin,
      ...(this.referenceDirty?{state:this.exportState()}:{})};
    this.referenceDirty=false;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        this.pending=null;this.worker?.terminate();this.worker=null;this.workerFailed=true;
        reject(new Error('Background registration timed out. Processing will resume on the next frame.'));
      },3000);
      this.pending={id,resolve,reject,timer};
      try{this.worker!.postMessage(job,[image.data.buffer as ArrayBuffer]);}
      catch(error){clearTimeout(timer);this.pending=null;this.dispose();this.workerFailed=true;this.referenceDirty=true;reject(error);}
    });
  }
}
