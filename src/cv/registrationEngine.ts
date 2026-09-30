import type { CameraPtzPose, PtzCalibration, RegistrationMetrics, RegistrationSettings } from '../types';
import { detectMultiscale, grayPyramid, rgbaToGrayscale, type GrayLevel, type Keypoint } from './featureDetection';
import { matchFeatures, type FeatureMatch } from './matcher';
import { estimateHomographyRANSAC, invertHomography, projectPoint, solveHomography4Points, type Homography } from './homography';
import { IDENTITY, focalAt, imageRay, rayProjector, multiply, projectPtz, ptzHomography } from './ptzProjection';
import { trackMatches } from './opticalFlow';
import { fitSimilarity } from './similarity';
import { REGISTRATION_DEFAULTS, registrationSettings } from './registrationDefaults';
import { wrappedDelta } from '../video/poseTimeline';

export interface Keyframe {
  id: string; independent: boolean; keypoints: Keypoint[]; width: number; height: number;
  anchorToKeyframe: Homography | null; ptzPose?: CameraPtzPose; cameraKey?: string;
}
export interface ViewTransform {
  h: Homography; time: number; mode: 'visual'|'ptz'|'ptz+visual'|'simulator';
  residual?: Homography; correction?: Homography; residualAt?: number; residualPose?: CameraPtzPose; geometryTag?: string;
}
export interface RegistrationState {
  origin: number; keyframes?: Keyframe[]; transforms: Array<[string,ViewTransform]>;
  width: number; height: number;
  currentId: string | null; keypoints: Keypoint[]; matches: FeatureMatch[]; inliers: FeatureMatch[];
}


/** One engine for all decoded feeds. All public anchor coordinates are normalized source-image coordinates. */
export class VisualRegistrationEngine {
  public settings: RegistrationSettings = { ...REGISTRATION_DEFAULTS };
  private keyframes: Keyframe[] = [];
  private transforms = new Map<string, ViewTransform>();
  private external = new Map<string, Homography>();
  private referenceImage: string | null = null;
  private currentId: string | null = null;
  private width = 640;
  private height = 360;
  private currentKeypoints: Keypoint[] = [];
  private currentMatches: FeatureMatch[] = [];
  private inliers: FeatureMatch[] = [];
  private previousPyramid: GrayLevel[] | null = null;
  private tracks = new Map<string, FeatureMatch[]>();
  private previousPose: CameraPtzPose | null = null;
  private pose: CameraPtzPose | null = null;
  private poseAge = Infinity;
  private cameraKey = '';
  private calibration: PtzCalibration | null = null;
  private frameNumber = 0;
  private searchCursor = 0;
  private lastGoodAt = 0;
  private ptzSignature = '';
  private autoSequence = 0;
  private referenceVersion=0;
  private rayCache=new Map<string,Array<number[]|null>>();
  private fpsAt = performance.now();
  private fpsFrames = 0;
  private fps = 0;

  configurePtz(calibration: PtzCalibration | null, cameraKey: string) {
    const signature=JSON.stringify([cameraKey,calibration]);
    if (this.ptzSignature !== signature) {
      this.ptzSignature=signature;this.rayCache.clear();
      this.transforms.clear(); this.tracks.clear(); this.previousPose = null;
    }
    this.calibration = calibration; this.cameraKey = cameraKey;
  }
  setCameraPoseHint(pose: CameraPtzPose | null) { this.pose = pose; }
  setFramePose(pose: CameraPtzPose | null, ageMs = Infinity) { this.pose = pose; this.poseAge = ageMs; }
  getFrameSize(): [number,number] { return [this.width,this.height]; }
  getViewSize(id?: string): [number,number] {
    const k=this.keyframes.find(k=>k.id===(id||this.getAnchorViewId())); return k?[k.width,k.height]:[this.width,this.height];
  }
  getAnchorViewId() { return this.keyframes[0]?.id || 'anchor-view-1'; }
  isIndependentView(id: string) { return this.keyframes.some(k=>k.id===id&&k.independent); }
  getReferenceImage() { return this.referenceImage; }
  getReferenceKeypoints() { return (this.keyframes.find(k=>k.id===this.currentId)||this.keyframes[0])?.keypoints || []; }
  getCurrentKeypoints() { return this.currentKeypoints; }
  getInliers() { return this.inliers; }
  getMatches() { return this.currentMatches; }
  getCurrentMatchedView() {
    const id=this.currentId || this.getAnchorViewId();
    return { id, homography: this.getViewHomography(id), independent: this.isIndependentView(id) };
  }
  getHomography() { return this.getCurrentMatchedView().homography; }
  getProjectionMode():RegistrationMetrics['mode'] {
    if(this.external.size)return 'simulator';
    const id=this.currentId||this.getAnchorViewId(),k=this.keyframes.find(k=>k.id===id),t=this.transforms.get(id);
    if(!t||!this.getViewHomography(id))return 'uncertain';
    if(t.mode.startsWith('ptz')&&(!k||!this.canPredict(k)))return 'uncertain';
    return t.mode;
  }
  getViewHomography(id: string): Homography | null {
    if (!this.settings.enabled) {
      const k=this.keyframes.find(k=>k.id===id);
      return k?[this.width/k.width,0,0,0,this.height/k.height,0,0,0,1]:null;
    }
    if (this.external.has(id)) return this.external.get(id)!;
    const t=this.transforms.get(id);
    return t && performance.now()-t.time<(this.settings.transformMaxAgeMs??500) ? t.h : null;
  }
  setExternalHomography(h: Homography | null) {
    if(h) this.external.set(this.getAnchorViewId(),h); else this.external.clear();
  }
  setExternalViews(views: Map<string,Homography>) { this.external=views; }
  hasExternalGeometry(){return this.external.size>0;}
  getPtzModel():RegistrationMetrics['ptzModel'] {
    return this.calibration ? this.calibration.modelSource || (this.calibration.validated?'fitted':'estimated') : undefined;
  }
  getTrackingHint():string|undefined {
    if(!this.cameraKey)return undefined;
    if(!this.pose||this.poseAge>(this.settings.poseMaxAgeMs??400))return 'No fresh PTZ sample for the displayed video frame; using visual registration. Check video delay if camera status is available.';
    if(!this.calibration)return 'Waiting for camera profile geometry; using visual registration';
    if(Math.abs(this.width/this.height-this.calibration.aspect)>.02)return 'Image geometry changed; update PTZ calibration';
    if(!focalAt(this.pose.zoom,this.calibration))return 'Zoom is outside the camera model range; using visual registration';
    if(this.keyframes.length&&!this.keyframes.some(k=>this.canPredict(k)))return 'Saved views have no compatible camera pose. Recapture them for PTZ anchoring.';
    if(this.getPtzModel()==='estimated')return 'PTZ projection uses estimated camera geometry. Optional camera values or calibration improve accuracy across views.';
    const range=this.calibration.measuredZoomRange;
    if(range&&(this.pose.zoom<range[0]-.001||this.pose.zoom>range[1]+.001))return 'PTZ and visual registration are active; zoom geometry outside measured positions is estimated.';
    if(this.calibration.refinement==='basic')return 'PTZ projection uses a quick fit; lens geometry and unmeasured zoom remain estimated.';
    return undefined;
  }
  private canPredict(k:Keyframe): boolean {
    const c=this.calibration;
    return !!(c && c.cameraKey===this.cameraKey && k.cameraKey===this.cameraKey && k.ptzPose && this.pose &&
      [c.panRadiansPerUnit,c.tiltRadiansPerUnit,c.tiltOffsetRadians,c.principalX,c.principalY,c.radialK1].every(Number.isFinite) &&
      [k.ptzPose.pan,k.ptzPose.tilt,k.ptzPose.zoom,this.pose.pan,this.pose.tilt,this.pose.zoom].every(Number.isFinite) &&
      focalAt(k.ptzPose.zoom,c) && focalAt(this.pose.zoom,c) &&
      this.poseAge <= (this.settings.poseMaxAgeMs ?? 400) &&
      (!k.ptzPose.panTiltSpace || !this.pose.panTiltSpace || k.ptzPose.panTiltSpace===this.pose.panTiltSpace) &&
      (!k.ptzPose.zoomSpace || !this.pose.zoomSpace || k.ptzPose.zoomSpace===this.pose.zoomSpace) && Math.abs(this.width/this.height-c.aspect)<0.02 && Math.abs(k.width/k.height-c.aspect)<0.02);
  }
  /** Fit confidence changes the correction bound, never the primary projection algorithm. */
  private precisePrediction(k:Keyframe):boolean {
    const c=this.calibration;
    if(!c?.validated||c.modelSource==='estimated'||!this.canPredict(k))return false;
    if(c.refinement==='basic'||c.rmsErrorPx>6)return false;
    const range=c.measuredZoomRange;
    return !range||[this.pose!.zoom,k.ptzPose!.zoom].every(z=>z>=range[0]-.001&&z<=range[1]+.001);
  }
  projectAnchor(id: string | undefined, x:number,y:number):[number,number]|null {
    const viewId=id||this.getAnchorViewId(), k=this.keyframes.find(k=>k.id===viewId);
    if(!k) return null;
    const h=this.getViewHomography(viewId); if(!h) return null;
    const t=this.transforms.get(viewId);
    if(this.settings.enabled && !this.external.has(viewId) && t?.mode.startsWith('ptz') && this.canPredict(k)) {
      const p=projectPtz(x,y,k.ptzPose!,this.pose!,this.calibration!,k.width/k.height,this.width/this.height);
      if(!p) return null;
      const q=projectPoint(t.residual||IDENTITY,p[0]*this.width,p[1]*this.height);
      return [q[0]/this.width,q[1]/this.height];
    }
    const px=x*k.width,py=y*k.height;
    if(h[6]*px+h[7]*py+h[8]<=0.001) return null;
    const p=projectPoint(h,px,py);
    return p.every(Number.isFinite)?[p[0]/this.width,p[1]/this.height]:null;
  }
  unprojectAnchor(id:string,x:number,y:number):[number,number]|null {
    const k=this.keyframes.find(k=>k.id===id),t=this.transforms.get(id),h=this.getViewHomography(id);
    if(!k||!h) return null;
    if(this.settings.enabled&&!this.external.has(id)&&t?.mode.startsWith('ptz')&&this.canPredict(k)){
      const inv=invertHomography(t.residual||IDENTITY);if(!inv)return null;
      const p=projectPoint(inv,x*this.width,y*this.height);
      return projectPtz(p[0]/this.width,p[1]/this.height,this.pose!,k.ptzPose!,this.calibration!,this.width/this.height,k.width/k.height);
    }
    const inv=invertHomography(h);if(!inv)return null;
    const p=projectPoint(inv,x*this.width,y*this.height);return [p[0]/k.width,p[1]/k.height];
  }
  setReferenceFrame(image: ImageData,dataUrl?:string,id='anchor-view-1',pose?:CameraPtzPose,cameraKey?:string) {
    this.reset(); this.width=image.width; this.height=image.height;
    const count=this.addSetupKeyframe(image,id,dataUrl,pose,cameraKey);
    return {keypointCount:count};
  }
  addSetupKeyframe(image:ImageData,id:string,dataUrl?:string,pose?:CameraPtzPose,cameraKey?:string) {
    const gray=new Uint8Array(image.width*image.height);
    rgbaToGrayscale(image.data,image.width,image.height,gray);
    const keypoints=detectMultiscale(grayPyramid(gray,image.width,image.height),this.settings.maxFeatures,this.settings.fastThreshold);
    const index=this.keyframes.findIndex(k=>k.id===id);
    const independent=index>=0?this.keyframes[index].independent:this.keyframes.length>0;
    const frame={id,independent,keypoints,width:image.width,height:image.height,ptzPose:pose,cameraKey,
      anchorToKeyframe:independent?null:[...IDENTITY]};
    if(index>=0)this.keyframes[index]=frame;else this.keyframes.push(frame);
    this.referenceVersion++;this.rayCache.clear();
    // Automatically captured views depend on the root geometry and cannot survive rebasing it.
    if(index===0)this.keyframes=this.keyframes.filter(k=>!k.id.startsWith('auto-'));
    this.transforms.clear();this.external.clear();this.tracks.clear();this.previousPyramid=null;this.previousPose=null;
    if(!independent){this.referenceImage=dataUrl||null;this.width=image.width;this.height=image.height;}
    this.currentId=id;
    this.transforms.set(id,{h:[...IDENTITY],time:performance.now(),mode:'visual'});
    return keypoints.length;
  }
  reset() {
    this.referenceVersion++;this.rayCache.clear();
    this.keyframes=[];this.transforms.clear();this.external.clear();this.referenceImage=null;this.currentId=null;
    this.tracks.clear();this.previousPyramid=null;this.previousPose=null;this.inliers=[];this.currentMatches=[];this.currentKeypoints=[];
    this.lastGoodAt=0;this.frameNumber=0;
  }


  private correctionLimit(k:Keyframe):number {
    return (this.precisePrediction(k)?this.settings.ptzResidualLimitPx??24:this.settings.ptzEstimatedResidualLimitPx??48)*Math.max(this.width,this.height)/960;
  }
  private correctionDifference(a:Homography,b:Homography):number {
    return Math.max(...[[0,0],[this.width,0],[0,this.height],[this.width,this.height]].map(([x,y])=>{
      const p=projectPoint(a,x,y),q=projectPoint(b,x,y);return Math.hypot(p[0]-q[0],p[1]-q[1]);
    }));
  }
  private correctionGain(old:ViewTransform|undefined):number {
    const c=this.calibration,p=this.pose,r=old?.residualPose;
    if(!old?.correction||!r||!c||!p||old.geometryTag!==this.geometryTag())return 0;
    if(old.correction.length!==9||!old.correction.every(Number.isFinite)||
      Math.abs(old.correction[6])+Math.abs(old.correction[7])>1e-8||Math.abs(old.correction[8]-1)>1e-8)return 0;
    // A correction belongs to a camera pose, not a wall-clock deadline. A stationary
    // view keeps its correction; a different view cannot inherit an unrelated image warp.
    const center=projectPtz(.5,.5,r,p,c,this.width/this.height,this.width/this.height);
    const rf=focalAt(r.zoom,c),cf=focalAt(p.zoom,c);
    if(!center||!rf||!cf)return 0;
    const movement=Math.hypot((center[0]-.5)*this.width,(center[1]-.5)*this.height)+
      Math.abs(cf/rf-1)*Math.hypot(this.width,this.height)/2;
    const radius=(this.settings.ptzCorrectionPoseRadiusPx??96)*Math.max(this.width,this.height)/960;
    return Math.max(0,Math.min(1,(radius-movement)/(radius*.75)));
  }
  private retainedResidual(old:ViewTransform|undefined,k:Keyframe):Homography {
    let gain=this.correctionGain(old);
    if(!gain||!old?.correction)return [...IDENTITY];
    const distance=this.correctionDifference(old.correction,IDENTITY),limit=this.correctionLimit(k);
    if(distance*gain>limit)gain=limit/distance;
    return old.correction.map((v,i)=>IDENTITY[i]+(v-IDENTITY[i])*gain);
  }
  private geometryTag():string {
    const c=this.calibration,p=this.pose;
    return JSON.stringify([c?.imageRotationDegrees||0,p?.roll||0,!!(c?.autoFlip&&p&&((p.tilt>=c.autoFlip.tiltThreshold)===c.autoFlip.above))]);
  }
  private predictedTransform(k:Keyframe,h:Homography,old:ViewTransform|undefined,now:number):ViewTransform {
    const residual=this.retainedResidual(old,k);
    const corrected=this.correctionGain(old)>0;
    return {h:multiply(residual,h),time:now,mode:corrected?'ptz+visual':'ptz',residual,
      correction:old?.correction,residualAt:old?.residualAt,residualPose:old?.residualPose,geometryTag:old?.geometryTag};
  }
  private poseDistance(k:Keyframe):number {
    if(!this.canPredict(k))return Infinity;
    const c=this.calibration!,p=this.pose!,r=k.ptzPose!;
    return Math.hypot(wrappedDelta(r.pan,p.pan,c.panPeriod)*c.panRadiansPerUnit,
      (r.tilt-p.tilt)*c.tiltRadiansPerUnit,Math.log(focalAt(r.zoom,c)!/focalAt(p.zoom,c)!));
  }
  private selectPtzView():Keyframe|undefined {
    const candidates=this.keyframes.filter(k=>this.canPredict(k)).sort((a,b)=>this.poseDistance(a)-this.poseDistance(b));
    const best=candidates[0],current=candidates.find(k=>k.id===this.currentId);
    // Hysteresis prevents noisy match counts or tiny telemetry changes from switching views.
    const selected=current&&best&&this.poseDistance(current)<=this.poseDistance(best)+.035?current:best;
    if(selected&&selected.id!==this.currentId){this.currentMatches=[];this.inliers=[];this.currentId=selected.id;}
    return selected;
  }
  private projectFeatures(k:Keyframe):Array<[number,number]|null> {
    if(!this.canPredict(k))return [];
    let rays=this.rayCache.get(k.id);
    if(!rays){rays=k.keypoints.map(p=>imageRay(p.x/k.width,p.y/k.height,k.ptzPose!,this.calibration!,k.width/k.height));this.rayCache.set(k.id,rays);}
    const project=rayProjector(this.pose!,this.calibration!,this.width/this.height);
    return rays.map(ray=>{
      const p=ray?project(ray):null;
      return p?[p[0]*this.width,p[1]*this.height] as [number,number]:null;
    });
  }
  /** Refresh pose projection on the presentation thread even while CV is busy. */
  updatePtzProjection(width:number,height:number,now=performance.now()) {
    if(width!==this.width||height!==this.height){this.transforms.clear();this.tracks.clear();this.previousPyramid=null;}
    this.width=width;this.height=height;
    if(!this.settings.enabled)return;
    for(const k of this.keyframes){
      const h=this.canPredict(k)?ptzHomography(k.ptzPose!,this.pose!,this.calibration!,k.width,k.height,width,height):null;
      if(h)this.transforms.set(k.id,this.predictedTransform(k,h,this.transforms.get(k.id),now));
    }
    this.selectPtzView();
  }
  getReferenceVersion(){return this.referenceVersion;}
  exportState(includeReferences=true):RegistrationState {
    return {origin:performance.timeOrigin,width:this.width,height:this.height,...(includeReferences?{keyframes:this.keyframes}:{}),transforms:[...this.transforms],
      currentId:this.currentId,keypoints:this.currentKeypoints,matches:this.currentMatches,inliers:this.inliers};
  }
  restoreReferences(state:RegistrationState) {
    this.reset();this.keyframes=state.keyframes||[];this.currentId=state.currentId;
    this.width=state.width;this.height=state.height;
    const offset=state.origin-performance.timeOrigin;
    this.transforms=new Map(state.transforms.map(([id,t])=>[id,{...t,time:t.time+offset,
      residualAt:t.residualAt===undefined?undefined:t.residualAt+offset}]));
    this.autoSequence=Math.max(0,...this.keyframes.filter(k=>k.id.startsWith('auto-')).map(k=>Number(k.id.slice(5))||0));
  }
  acceptProcessedState(state:RegistrationState) {
    if(state.keyframes){this.keyframes=state.keyframes;this.rayCache.clear();this.autoSequence=Math.max(0,...this.keyframes.filter(k=>k.id.startsWith('auto-')).map(k=>Number(k.id.slice(5))||0));}
    const selected=this.selectPtzView();
    if(!selected)this.currentId=state.currentId;
    this.currentKeypoints=state.keypoints;this.currentMatches=state.matches;this.inliers=state.inliers;
    if(selected&&selected.id!==state.currentId){this.currentMatches=[];this.inliers=[];}
    const offset=state.origin-performance.timeOrigin;
    for(const [id,value] of state.transforms){
      const t={...value,time:value.time+offset,residualAt:value.residualAt===undefined?undefined:value.residualAt+offset};
      const k=this.keyframes.find(k=>k.id===id);
      const h=k&&this.canPredict(k)?ptzHomography(k.ptzPose!,this.pose!,this.calibration!,k.width,k.height,this.width,this.height):null;
      // Late visual output supplies only its correction to the newest displayed PTZ pose.
      const previous=this.transforms.get(id);
      const correctionState=previous&&(previous.residualAt??-Infinity)>(t.residualAt??-Infinity)?previous:t;
      this.transforms.set(id,h&&k?this.predictedTransform(k,h,correctionState,performance.now()):t);
    }
  }

  /** Diagnostics use the active saved view and the latest displayed pose, in one snapshot. */
  getProjectionMetrics():Pick<RegistrationMetrics,'homography'|'activeViewId'|'cameraPose'|'referencePose'|'poseDelta'|'angularDeltaDeg'|'movementAvailable'|'movementSource'|'visualCorrection'|'scaleEstimate'|'rotationEstimateDeg'|'translationEstimate'|'frameWidth'|'frameHeight'|'poseAgeMs'|'ptzModel'|'trackingHint'> {
    const id=this.currentId||this.getAnchorViewId(),k=this.keyframes.find(k=>k.id===id),t=this.transforms.get(id);
    const h=this.getViewHomography(id),ptz=!!(this.settings.enabled&&!this.external.has(id)&&k&&t?.mode.startsWith('ptz')&&this.canPredict(k));
    let translation:[number,number]=[NaN,NaN],scale=NaN,rotation=NaN;
    let poseDelta:RegistrationMetrics['poseDelta'],angularDeltaDeg:RegistrationMetrics['angularDeltaDeg'];
    if(ptz){
      const c=this.calibration!,p=this.pose!,r=k!.ptzPose!;
      poseDelta={pan:wrappedDelta(p.pan,r.pan,c.panPeriod),tilt:p.tilt-r.tilt,zoom:p.zoom-r.zoom};
      angularDeltaDeg={pan:poseDelta.pan*c.panRadiansPerUnit*180/Math.PI,tilt:poseDelta.tilt*c.tiltRadiansPerUnit*180/Math.PI};
      const center=projectPtz(.5,.5,r,p,c,k!.width/k!.height,this.width/this.height);
      if(center)translation=[(center[0]-.5)*this.width,(center[1]-.5)*this.height];
      scale=focalAt(p.zoom,c)!/focalAt(r.zoom,c)!;
      const flip=(pose:CameraPtzPose)=>c.autoFlip&&((pose.tilt>=c.autoFlip.tiltThreshold)===c.autoFlip.above)?Math.PI:0;
      rotation=wrappedDelta((p.roll||0)+flip(p),(r.roll||0)+flip(r),2*Math.PI)*180/Math.PI;
    }else if(h&&k){
      const x=k.width/2,y=k.height/2,z=h[6]*x+h[7]*y+h[8];
      if(z>.001){
        const center=projectPoint(h,x,y),right=projectPoint(h,x+1,y);
        translation=[center[0]-this.width/2,center[1]-this.height/2];
        scale=Math.hypot(right[0]-center[0],right[1]-center[1])*k.width/this.width;
        rotation=Math.atan2(right[1]-center[1],right[0]-center[0])*180/Math.PI;
      }
    }
    const residual=ptz&&t?.mode==='ptz+visual'?t.residual:undefined;
    const corrected=residual?projectPoint(residual,this.width/2,this.height/2):null;
    return {homography:h,activeViewId:k?.id,cameraPose:this.pose,referencePose:k?.ptzPose,poseDelta,angularDeltaDeg,
      movementAvailable:translation.every(Number.isFinite),movementSource:ptz?'ptz':this.external.has(id)?'simulator':'visual',
      visualCorrection:corrected?{translation:[corrected[0]-this.width/2,corrected[1]-this.height/2],scale:Math.hypot(residual![0],residual![3]),rotationDeg:Math.atan2(residual![3],residual![0])*180/Math.PI,ageMs:Math.max(0,performance.now()-(t?.residualAt??performance.now()))}:undefined,
      scaleEstimate:scale,rotationEstimateDeg:rotation,translationEstimate:translation,
      frameWidth:this.width,frameHeight:this.height,poseAgeMs:Number.isFinite(this.poseAge)?this.poseAge:undefined,
      ptzModel:this.getPtzModel(),trackingHint:this.getTrackingHint()};
  }

  processFrame(image:ImageData,now=performance.now()):RegistrationMetrics {
    this.settings=registrationSettings(this.settings);
    const start=performance.now();
    const automatic=this.keyframes.filter(k=>k.id.startsWith('auto-'));
    const excess=automatic.length-(this.settings.maxAutoKeyframes??8);
    if(excess>0){
      const removed=new Set(automatic.slice(0,excess).map(k=>k.id));
      this.keyframes=this.keyframes.filter(k=>!removed.has(k.id));this.referenceVersion++;
      for(const id of removed){this.transforms.delete(id);this.tracks.delete(id);this.rayCache.delete(id);}
    }
    if(this.width!==image.width||this.height!==image.height){this.previousPyramid=null;this.tracks.clear();this.transforms.clear();}
    this.width=image.width;this.height=image.height;this.frameNumber++;this.fpsFrames++;
    if(now-this.fpsAt>1000){this.fps=1000*this.fpsFrames/(now-this.fpsAt);this.fpsAt=now;this.fpsFrames=0;}
    const gray=new Uint8Array(this.width*this.height);rgbaToGrayscale(image.data,this.width,this.height,gray);
    const pyramid=grayPyramid(gray,this.width,this.height);
    this.currentKeypoints=detectMultiscale(pyramid,this.settings.maxFeatures,this.settings.fastThreshold);
    const scale=Math.max(this.width,this.height)/960, threshold=this.settings.ransacThresholdPx*scale;
    let bestCount=0,bestError=0,totalMatches=0,mode:RegistrationMetrics['mode']='uncertain';
    this.inliers=[];this.currentMatches=[];
    const selectedPtzView=this.selectPtzView();
    // Prefer last visible view; rotate other searches to avoid starving any manually captured view.
    const candidates=[...this.keyframes];
    const cursor=this.searchCursor++%Math.max(1,candidates.length);
    candidates.push(...candidates.splice(0,cursor));
    const projectedFeatures=new Map(candidates.map(k=>[k.id,this.projectFeatures(k)]));
    const visibility=new Map(candidates.map(k=>[k.id,projectedFeatures.get(k.id)!.filter(p=>p&&p[0]>=0&&p[0]<=this.width&&p[1]>=0&&p[1]<=this.height).length]));
    // Search the active view first. Other views keep their rotating order so a
    // view with many features cannot monopolize the bounded CV work budget.
    candidates.sort((a,b)=>Number(b.id===this.currentId)-Number(a.id===this.currentId));
    let visualSearches=0;
    const nextTracks=new Map<string,FeatureMatch[]>();
    for(const k of candidates) {
      let predicted:Homography|null=null;
      if(this.canPredict(k)) predicted=ptzHomography(k.ptzPose!,this.pose!,this.calibration!,k.width,k.height,this.width,this.height);
      if(selectedPtzView&&!predicted)continue;
      const old=this.transforms.get(k.id);
      // Pose is applied every frame, independently of how many views receive a visual search.
      if(predicted)this.transforms.set(k.id,this.predictedTransform(k,predicted,old,now));
      if(predicted&&visibility.get(k.id)!<6)continue;
      if(visualSearches++>=(this.settings.visualSearchViews??3))continue;
      let matches:FeatureMatch[]=[];
      if(this.previousPyramid&&this.tracks.has(k.id)) {
        const motion=predicted&&this.previousPose&&this.calibration?
          ptzHomography(this.previousPose,this.pose!,this.calibration,this.width,this.height,this.width,this.height):null;
        matches=trackMatches(this.previousPyramid,pyramid,this.tracks.get(k.id)!,motion?(x,y)=>projectPoint(motion,x,y):undefined);
      }
      if(matches.length<this.settings.minInliers || this.frameNumber%(this.settings.descriptorIntervalFrames??5)===0) {
        const retained=this.retainedResidual(old,k);
        const geometry=predicted?{predict:(_x:number,_y:number,index:number)=>{
          const p=projectedFeatures.get(k.id)![index];return p?projectPoint(retained,p[0],p[1]):null;
        },radiusPx:this.correctionLimit(k)*1.5}:undefined;
        const descriptors=matchFeatures(k.keypoints,this.currentKeypoints,this.settings.matchRatioThreshold,52,geometry);
        const combined=new Map(matches.map(m=>[m.refIdx,m]));
        for(const m of descriptors)combined.set(m.refIdx,m);
        matches=[...combined.values()];
      }
      totalMatches+=matches.length;
      let h:Homography|null=null,accepted:FeatureMatch[]=[],error=0,residual:Homography|undefined;
      if(predicted) {
        const limit=this.correctionLimit(k),retained=this.retainedResidual(old,k);
        const expected=matches.flatMap(m=>{
          const p=projectedFeatures.get(k.id)![m.refIdx];
          if(!p)return [];
          const [x,y]=p;
          const corrected=projectPoint(retained,x,y);
          if(Math.hypot(corrected[0]-m.curX,corrected[1]-m.curY)>limit*1.5)return [];
          return [{...m,refX:x,refY:y}];
        });
        const result=fitSimilarity(expected,threshold,limit,this.width,this.height);
        if(result&&result.inliers.length>=this.settings.minInliers&&result.error<threshold){
          residual=result.homography;
          // Smooth only the small similarity correction. The primary pose never lags behind a matrix filter.
          if(this.correctionGain(old)>0){
            const difference=this.correctionDifference(residual,retained);
            const alpha=difference<=(this.settings.ptzCorrectionDeadbandPx??.75)*scale?0:this.settings.ptzCorrectionAlpha??.2;
            residual=residual.map((v,i)=>alpha*v+(1-alpha)*retained[i]);
          }
          h=multiply(residual,predicted);error=result.error;
          const ids=new Set(result.inliers.map(m=>m.refIdx));accepted=matches.filter(m=>ids.has(m.refIdx));
        } else {residual=retained;h=multiply(residual,predicted);}
      } else {
        const result=estimateHomographyRANSAC(matches,this.settings.ransacIterations,threshold,this.settings.minInliers,this.settings.leastSquaresRefine);
        const xs=result.inliers.map(m=>m.refX),ys=result.inliers.map(m=>m.refY);
        if(result.homography&&result.inlierCount>=this.settings.minInliers&&result.avgReprojectionError<=threshold&&
          Math.max(...xs)-Math.min(...xs)>k.width*0.15&&Math.max(...ys)-Math.min(...ys)>k.height*0.12){
          h=result.homography;accepted=result.inliers;error=result.avgReprojectionError;
          if(old?.mode==='visual'&&now-old.time<(this.settings.updateIntervalMs*2)){
            const corners:[number,number][]=[[0,0],[k.width,0],[k.width,k.height],[0,k.height]];
            const alpha=this.settings.smoothingFactor??.65;
            const smooth=corners.map(p=>{const a=projectPoint(old.h,...p),b=projectPoint(h!,...p);
              return [a[0]*(1-alpha)+b[0]*alpha,a[1]*(1-alpha)+b[1]*alpha] as [number,number];});
            h=solveHomography4Points(corners,smooth)||h;
          }
        }
      }
      if(!h)continue;
      const hasCorrection=this.correctionGain(old)>0;
      const localMode=predicted?(accepted.length||hasCorrection?'ptz+visual':'ptz'):'visual';
      this.transforms.set(k.id,{h,time:now,mode:localMode,residual,
        correction:predicted?(accepted.length?residual:old?.correction):undefined,
        residualAt:predicted?(accepted.length?now:old?.residualAt):undefined,
        residualPose:predicted?(accepted.length?{...this.pose!}:old?.residualPose):undefined,
        geometryTag:predicted?(accepted.length?this.geometryTag():old?.geometryTag):undefined});
      if(!k.independent&&k.anchorToKeyframe&&k.id!==this.getAnchorViewId()) {
        // anchor->keyframe followed by keyframe->current (never the inverse).
        this.transforms.set(this.getAnchorViewId(),{h:multiply(h,k.anchorToKeyframe),time:now,mode:'visual'});
      }
      if(accepted.length)nextTracks.set(k.id,accepted);
      if(selectedPtzView?k.id===selectedPtzView.id:accepted.length>bestCount||mode==='uncertain'){
        bestCount=accepted.length;bestError=error;this.currentMatches=matches;this.inliers=accepted;
        this.currentId=k.independent?k.id:this.getAnchorViewId();mode=localMode;
      }
      if(accepted.length>=this.settings.minInliers&&!predicted&&!k.independent&&this.settings.adaptiveReference&&this.frameNumber%30===0&&(this.settings.maxAutoKeyframes??8)>0){
        const anchorH=k.anchorToKeyframe?multiply(h,k.anchorToKeyframe):h;
        const root=this.keyframes[0];
        const center=projectPoint(anchorH,root.width/2,root.height/2);
        if(Math.hypot(center[0]-this.width/2,center[1]-this.height/2)>this.width*0.12){
          this.referenceVersion++;
          this.keyframes.push({id:`auto-${++this.autoSequence}`,independent:false,keypoints:this.currentKeypoints,width:this.width,height:this.height,anchorToKeyframe:anchorH});
          const auto=this.keyframes.filter(v=>v.id.startsWith('auto-'));if(auto.length>(this.settings.maxAutoKeyframes??8)){this.rayCache.delete(auto[0].id);this.keyframes=this.keyframes.filter(v=>v!==auto[0]);}
        }
      }
    }
    if(this.external.size)mode='simulator';
    else if(selectedPtzView)mode=this.getProjectionMode();
    if(mode!=='uncertain')this.lastGoodAt=now;
    this.tracks=nextTracks;this.previousPyramid=pyramid;this.previousPose=this.pose;
    return {quality:!this.keyframes.length?'UNINITIALIZED':mode==='ptz'?'DEGRADED':mode!=='uncertain'?'GOOD':now-this.lastGoodAt<Math.min(this.settings.transformMaxAgeMs??500,(this.settings.lostFrameToleranceFrames??8)*this.settings.updateIntervalMs)?'DEGRADED':'LOST',
      mode,inliers:bestCount,totalMatches:selectedPtzView?this.currentMatches.length:totalMatches,
      candidateKeypointsRef:this.getReferenceKeypoints().length,candidateKeypointsCur:this.currentKeypoints.length,
      reprojectionError:bestError,fps:Math.round(this.fps),processingTimeMs:performance.now()-start,...this.getProjectionMetrics()};
  }
}
