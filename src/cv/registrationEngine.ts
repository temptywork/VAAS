import type { CameraPtzPose, PtzCalibration, RegistrationMetrics, RegistrationSettings } from '../types';
import { detectMultiscale, grayPyramid, rgbaToGrayscale, type GrayLevel, type Keypoint } from './featureDetection';
import { matchFeatures, type FeatureMatch } from './matcher';
import { estimateHomographyRANSAC, invertHomography, projectPoint, solveHomography4Points, type Homography } from './homography';
import { IDENTITY, focalAt, imageRay, rayProjector, multiply, projectPtz, ptzHomography } from './ptzProjection';
import { trackMatches } from './opticalFlow';
import { fitSimilarity } from './similarity';
import { REGISTRATION_DEFAULTS, registrationSettings } from './registrationDefaults';

export interface Keyframe {
  id: string; independent: boolean; keypoints: Keypoint[]; width: number; height: number;
  anchorToKeyframe: Homography | null; ptzPose?: CameraPtzPose; cameraKey?: string;
}
export interface ViewTransform {
  h: Homography; time: number; mode: 'visual'|'ptz'|'ptz+visual'|'simulator';
  residual?: Homography; correction?: Homography; residualAt?: number; residualZoom?: number; geometryTag?: string;
}
export interface RegistrationState {
  origin: number; keyframes?: Keyframe[]; transforms: Array<[string,ViewTransform]>;
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
  getReferenceKeypoints() { return this.keyframes[0]?.keypoints || []; }
  getCurrentKeypoints() { return this.currentKeypoints; }
  getInliers() { return this.inliers; }
  getMatches() { return this.currentMatches; }
  getCurrentMatchedView() {
    const id=this.currentId || this.getAnchorViewId();
    return { id, homography: this.getViewHomography(id), independent: this.isIndependentView(id) };
  }
  getHomography() { return this.getViewHomography(this.getAnchorViewId()); }
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
  getTrackingHint():string|undefined {
    if(!this.cameraKey)return undefined;
    if(!this.calibration?.validated)return 'Calibrate PTZ to enable positioning from camera telemetry';
    if(!this.pose||this.poseAge>(this.settings.poseMaxAgeMs??400))return 'Camera position data is stale; using visual registration';
    if(Math.abs(this.width/this.height-this.calibration.aspect)>.02)return 'Image geometry changed; update PTZ calibration';
    if(!focalAt(this.pose.zoom,this.calibration))return 'Zoom is outside the calibrated range; using visual registration';
    return undefined;
  }
  private canPredict(k:Keyframe): boolean {
    const c=this.calibration;
    return !!(c?.validated && c.cameraKey===this.cameraKey && k.cameraKey===this.cameraKey && k.ptzPose && this.pose &&
      this.poseAge <= (this.settings.poseMaxAgeMs ?? 400) &&
      (!k.ptzPose.panTiltSpace || !this.pose.panTiltSpace || k.ptzPose.panTiltSpace===this.pose.panTiltSpace) &&
      (!k.ptzPose.zoomSpace || !this.pose.zoomSpace || k.ptzPose.zoomSpace===this.pose.zoomSpace) && Math.abs(this.width/this.height-c.aspect)<0.02 && Math.abs(k.width/k.height-c.aspect)<0.02);
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
    if(!this.external.has(id)&&t?.mode.startsWith('ptz')&&this.canPredict(k)){
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


  private retainedResidual(old:ViewTransform|undefined,now:number):Homography {
    if(!old?.correction||old.residualAt===undefined||old.geometryTag!==this.geometryTag())return [...IDENTITY];
    if(this.pose&&old.residualZoom!==undefined&&Math.abs(this.pose.zoom-old.residualZoom)>.08)return [...IDENTITY];
    const age=Math.max(0,now-old.residualAt),hold=this.settings.residualHoldMs??250,decay=this.settings.residualDecayMs??750;
    const gain=Math.max(0,1-Math.max(0,age-hold)/decay);
    return old.correction.map((v,i)=>IDENTITY[i]+(v-IDENTITY[i])*gain);
  }
  private geometryTag():string {
    const c=this.calibration,p=this.pose;
    return JSON.stringify([c?.imageRotationDegrees||0,p?.roll||0,!!(c?.autoFlip&&p&&((p.tilt>=c.autoFlip.tiltThreshold)===c.autoFlip.above))]);
  }
  private predictedTransform(h:Homography,old:ViewTransform|undefined,now:number):ViewTransform {
    const residual=this.retainedResidual(old,now);
    return {h:multiply(residual,h),time:now,mode:'ptz',residual,
      correction:old?.correction,residualAt:old?.residualAt,residualZoom:old?.residualZoom,geometryTag:this.geometryTag()};
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
      if(h)this.transforms.set(k.id,this.predictedTransform(h,this.transforms.get(k.id),now));
    }
  }
  getReferenceVersion(){return this.referenceVersion;}
  exportState(includeReferences=true):RegistrationState {
    return {origin:performance.timeOrigin,...(includeReferences?{keyframes:this.keyframes}:{}),transforms:[...this.transforms],
      currentId:this.currentId,keypoints:this.currentKeypoints,matches:this.currentMatches,inliers:this.inliers};
  }
  restoreReferences(state:RegistrationState) {
    this.reset();this.keyframes=state.keyframes||[];this.currentId=state.currentId;
    this.autoSequence=Math.max(0,...this.keyframes.filter(k=>k.id.startsWith('auto-')).map(k=>Number(k.id.slice(5))||0));
  }
  acceptProcessedState(state:RegistrationState) {
    if(state.keyframes){this.keyframes=state.keyframes;this.rayCache.clear();this.autoSequence=Math.max(0,...this.keyframes.filter(k=>k.id.startsWith('auto-')).map(k=>Number(k.id.slice(5))||0));}this.currentId=state.currentId;
    this.currentKeypoints=state.keypoints;this.currentMatches=state.matches;this.inliers=state.inliers;
    const offset=state.origin-performance.timeOrigin;
    for(const [id,value] of state.transforms){
      const t={...value,time:value.time+offset,residualAt:value.residualAt===undefined?undefined:value.residualAt+offset};
      const k=this.keyframes.find(k=>k.id===id);
      const h=k&&this.canPredict(k)?ptzHomography(k.ptzPose!,this.pose!,this.calibration!,k.width,k.height,this.width,this.height):null;
      // Late visual output supplies only its correction to the newest displayed PTZ pose.
      this.transforms.set(id,h?{...this.predictedTransform(h,t,performance.now()),mode:t.mode.startsWith('ptz')?t.mode:'ptz'}:t);
    }
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
    // Prefer last visible view; rotate other searches to avoid starving any manually captured view.
    const candidates=[...this.keyframes];
    const cursor=this.searchCursor++%Math.max(1,candidates.length);
    candidates.push(...candidates.splice(0,cursor));
    const projectedFeatures=new Map(candidates.map(k=>[k.id,this.projectFeatures(k)]));
    const visibility=new Map(candidates.map(k=>[k.id,projectedFeatures.get(k.id)!.filter(p=>p&&p[0]>=0&&p[0]<=this.width&&p[1]>=0&&p[1]<=this.height).length]));
    candidates.sort((a,b)=>(visibility.get(b.id)!-visibility.get(a.id)!) || Number(b.id===this.currentId)-Number(a.id===this.currentId));
    let visualSearches=0;
    const nextTracks=new Map<string,FeatureMatch[]>();
    for(const k of candidates) {
      let predicted:Homography|null=null;
      if(this.canPredict(k)) predicted=ptzHomography(k.ptzPose!,this.pose!,this.calibration!,k.width,k.height,this.width,this.height);
      const old=this.transforms.get(k.id);
      // Pose is applied every frame, independently of how many views receive a visual search.
      if(predicted)this.transforms.set(k.id,this.predictedTransform(predicted,old,now));
      if(predicted&&visibility.get(k.id)!<6)continue;
      if(visualSearches++>=(this.settings.visualSearchViews??3))continue;
      let matches:FeatureMatch[]=[];
      if(this.previousPyramid&&this.tracks.has(k.id)) {
        const motion=predicted&&this.previousPose&&this.calibration?
          ptzHomography(this.previousPose,this.pose!,this.calibration,this.width,this.height,this.width,this.height):null;
        matches=trackMatches(this.previousPyramid,pyramid,this.tracks.get(k.id)!,motion?(x,y)=>projectPoint(motion,x,y):undefined);
      }
      if(matches.length<this.settings.minInliers || this.frameNumber%(this.settings.descriptorIntervalFrames??5)===0) {
        const geometry=predicted?{predict:(_x:number,_y:number,index:number)=>projectedFeatures.get(k.id)![index],radiusPx:(this.settings.ptzResidualLimitPx??24)*scale*1.5}:undefined;
        const descriptors=matchFeatures(k.keypoints,this.currentKeypoints,this.settings.matchRatioThreshold,52,geometry);
        const combined=new Map(matches.map(m=>[m.refIdx,m]));
        for(const m of descriptors)combined.set(m.refIdx,m);
        matches=[...combined.values()];
      }
      totalMatches+=matches.length;
      let h:Homography|null=null,accepted:FeatureMatch[]=[],error=0,residual:Homography|undefined;
      if(predicted) {
        const expected=matches.flatMap(m=>{
          const p=projectedFeatures.get(k.id)![m.refIdx];
          if(!p)return [];
          const [x,y]=p;
          if(Math.hypot(x-m.curX,y-m.curY)>(this.settings.ptzResidualLimitPx??24)*scale*1.5)return [];
          return [{...m,refX:x,refY:y}];
        });
        const result=fitSimilarity(expected,threshold,(this.settings.ptzResidualLimitPx??24)*scale,this.width,this.height);
        if(result&&result.inliers.length>=this.settings.minInliers&&result.error<threshold){
          residual=result.homography;
          // Smooth only the small similarity correction. The primary pose never lags behind a matrix filter.
          if(old?.residual&&old.mode==='ptz+visual'&&now-old.time<200){
            const alpha=this.settings.smoothingFactor??0.65;
            residual=residual.map((v,i)=>alpha*v+(1-alpha)*old.residual![i]);
          }
          h=multiply(residual,predicted);error=result.error;
          const ids=new Set(result.inliers.map(m=>m.refIdx));accepted=matches.filter(m=>ids.has(m.refIdx));
        } else {residual=this.retainedResidual(old,now);h=multiply(residual,predicted);}
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
      const localMode=predicted?(accepted.length?'ptz+visual':'ptz'):'visual';
      this.transforms.set(k.id,{h,time:now,mode:localMode,residual,
        correction:predicted?(accepted.length?residual:old?.correction):undefined,
        residualAt:predicted?(accepted.length?now:old?.residualAt):undefined,
        residualZoom:predicted?(accepted.length?this.pose!.zoom:old?.residualZoom):undefined,geometryTag:this.geometryTag()});
      if(!k.independent&&k.anchorToKeyframe&&k.id!==this.getAnchorViewId()) {
        // anchor->keyframe followed by keyframe->current (never the inverse).
        this.transforms.set(this.getAnchorViewId(),{h:multiply(h,k.anchorToKeyframe),time:now,mode:'visual'});
      }
      if(accepted.length)nextTracks.set(k.id,accepted);
      if(accepted.length>bestCount||mode==='uncertain'){
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
    else if(mode==='uncertain'&&[...this.transforms.values()].some(t=>t.time===now&&t.mode==='ptz'))mode='ptz';
    if(mode!=='uncertain')this.lastGoodAt=now;
    this.tracks=nextTracks;this.previousPyramid=pyramid;this.previousPose=this.pose;
    const h=this.getHomography();
    return {quality:!this.keyframes.length?'UNINITIALIZED':mode==='ptz'?'DEGRADED':mode!=='uncertain'?'GOOD':now-this.lastGoodAt<Math.min(this.settings.transformMaxAgeMs??500,(this.settings.lostFrameToleranceFrames??8)*this.settings.updateIntervalMs)?'DEGRADED':'LOST',
      mode,trackingHint:this.getTrackingHint(),poseAgeMs:Number.isFinite(this.poseAge)?this.poseAge:undefined,frameWidth:this.width,frameHeight:this.height,
      inliers:bestCount,totalMatches,candidateKeypointsRef:this.getReferenceKeypoints().length,candidateKeypointsCur:this.currentKeypoints.length,
      reprojectionError:bestError,homography:h,fps:Math.round(this.fps),processingTimeMs:performance.now()-start,
      scaleEstimate:h?Math.hypot(h[0],h[3]):1,rotationEstimateDeg:h?Math.atan2(h[3],h[0])*180/Math.PI:0,translationEstimate:h?[h[2],h[5]]:[0,0]};
  }
}
