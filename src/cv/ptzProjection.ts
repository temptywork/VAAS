import type { CameraPtzPose, OnvifMediaProfile, PtzCalibration } from '../types';
import { invertHomography, type Homography } from './homography';

export const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function multiply(a: number[], b: number[]): number[] {
  return Array.from({ length: 9 }, (_, i) => a[Math.floor(i / 3) * 3] * b[i % 3] +
    a[Math.floor(i / 3) * 3 + 1] * b[3 + i % 3] + a[Math.floor(i / 3) * 3 + 2] * b[6 + i % 3]);
}
const transpose = (m: number[]) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const vector = (m: number[], v: number[]) => [0, 1, 2].map(i => m[3*i]*v[0] + m[3*i+1]*v[1] + m[3*i+2]*v[2]);

export const PTZ_MODEL_DEFAULTS = {
  panSpanDegrees: 360, tiltSpanDegrees: 105, wideFovDegrees: 62.8,
  opticalZoomMax: 25, tiltOffsetDegrees: 37.5,
};
export interface PtzModelOptions {
  panSpanDegrees?: number; tiltSpanDegrees?: number; wideFovDegrees?: number;
  opticalZoomMax?: number; tiltOffsetDegrees?: number; wrapPan?: boolean;
}

/** Nominal geometry uses reported coordinate ranges immediately; visual registration corrects its estimates. */
export function createPtzModel(cameraKey:string, profile:OnvifMediaProfile, aspect?:number, options:PtzModelOptions={}):PtzCalibration {
  const range=(value:[number,number]|undefined,fallback:[number,number]):[number,number]=>
    value&&value.every(Number.isFinite)&&value[1]>value[0]?value:fallback;
  const pan=range(profile.ptz?.panRange,[-1,1]),tilt=range(profile.ptz?.tiltRange,[-1,1]),zoom=range(profile.ptz?.zoomRange,[0,1]);
  const degrees=!!profile.ptz?.panTiltSpace?.includes('SphericalPositionSpace');
  const value=(n:number|undefined,fallback:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(n)?n!:fallback));
  const panSpan=value(options.panSpanDegrees,PTZ_MODEL_DEFAULTS.panSpanDegrees,1,360);
  const tiltSpan=value(options.tiltSpanDegrees,PTZ_MODEL_DEFAULTS.tiltSpanDegrees,1,360);
  const tiltOffset=value(options.tiltOffsetDegrees,PTZ_MODEL_DEFAULTS.tiltOffsetDegrees,-180,180);
  const opticalZoom=value(options.opticalZoomMax,PTZ_MODEL_DEFAULTS.opticalZoomMax,1,100);
  const fov=value(options.wideFovDegrees,PTZ_MODEL_DEFAULTS.wideFovDegrees,5,170);
  const focal=1/(2*Math.tan(fov*Math.PI/360));
  const imageAspect=aspect&&Number.isFinite(aspect)&&aspect>0?aspect:profile.width>0&&profile.height>0?profile.width/profile.height:16/9;
  return {version:1,modelSource:'estimated',cameraKey,
    panRadiansPerUnit:degrees?Math.PI/180:panSpan*Math.PI/180/(pan[1]-pan[0]),
    tiltRadiansPerUnit:degrees?Math.PI/180:tiltSpan*Math.PI/180/(tilt[1]-tilt[0]),
    tiltOffsetRadians:degrees?0:tiltOffset*Math.PI/180,
    panPeriod:options.wrapPan===false?0:degrees?360:pan[1]-pan[0],
    principalX:.5,principalY:.5,radialK1:0,
    zoomPoints:[{zoom:zoom[0],focal},{zoom:zoom[1],focal:focal*opticalZoom}],
    aspect:imageAspect,validated:false,rmsErrorPx:0,videoDelayMs:150,useCaptureTime:false,
    videoDelayByTransport:{webrtc:150,hls:2000},updatedAt:new Date().toISOString()};
}

/** Camera-to-world rotation. Image y points down; positive pitch points the camera up. */
export function cameraRotation(p: CameraPtzPose, c: PtzCalibration): number[] {
  const yaw = p.pan * c.panRadiansPerUnit, pitch = p.tilt * c.tiltRadiansPerUnit + c.tiltOffsetRadians;
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const base = [cy, sy*sp, sy*cp, 0, cp, -sp, -sy, cy*sp, cy*cp];
  const flipped = c.autoFlip && ((p.tilt >= c.autoFlip.tiltThreshold) === c.autoFlip.above);
  const roll = (p.roll || 0) + (c.imageRotationDegrees || 0)*Math.PI/180 + (flipped ? Math.PI : 0);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  return multiply(base, [cr,-sr,0,sr,cr,0,0,0,1]);
}

export function focalAt(zoom: number, c: PtzCalibration): number | null {
  const points = [...c.zoomPoints].sort((a,b) => a.zoom - b.zoom);
  if (!points.length || zoom < points[0].zoom - 0.001 || zoom > points[points.length-1].zoom + 0.001) return null;
  const hi = points.findIndex(p => p.zoom >= zoom);
  if (hi <= 0) return points[hi < 0 ? points.length-1 : 0].focal;
  const a = points[hi-1], b = points[hi], t = (zoom-a.zoom)/(b.zoom-a.zoom);
  return Math.exp(Math.log(a.focal)*(1-t) + Math.log(b.focal)*t);
}

export function imageRay(x: number, y: number, pose: CameraPtzPose, c: PtzCalibration, aspect: number): number[] | null {
  const f = focalAt(pose.zoom, c);
  if (!f || !(aspect > 0)) return null;
  const xd = (x-c.principalX)/f, yd = (y-c.principalY)/(f*aspect);
  let xu = xd, yu = yd;
  for (let i=0;i<8;i++) {
    const d = 1 + c.radialK1*(xu*xu+yu*yu);
    if (d < 0.2) return null;
    xu = xd/d; yu = yd/d;
  }
  const ray = vector(cameraRotation(pose,c), [xu,yu,1]);
  const length = Math.hypot(...ray);
  return ray.map(v=>v/length);
}

/** Precompute camera geometry once when projecting a bank of landmark rays. */
export function rayProjector(pose:CameraPtzPose,c:PtzCalibration,aspect:number):(ray:number[])=>[number,number]|null {
  const f = focalAt(pose.zoom,c);
  if (!f || !(aspect>0)) return ()=>null;
  const r=transpose(cameraRotation(pose,c));
  return ray=>{
    const x=r[0]*ray[0]+r[1]*ray[1]+r[2]*ray[2],y=r[3]*ray[0]+r[4]*ray[1]+r[5]*ray[2],z=r[6]*ray[0]+r[7]*ray[1]+r[8]*ray[2];
    if(z<=.01)return null;
    const xu=x/z,yu=y/z,d=1+c.radialK1*(xu*xu+yu*yu);
    if(d<.2)return null;
    const p:[number,number]=[c.principalX+f*xu*d,c.principalY+f*aspect*yu*d];
    return p.every(Number.isFinite)?p:null;
  };
}

export function projectRay(ray:number[],pose:CameraPtzPose,c:PtzCalibration,aspect:number):[number,number]|null {
  return rayProjector(pose,c,aspect)(ray);
}

export function projectPtz(x: number,y: number,reference: CameraPtzPose,current: CameraPtzPose,c: PtzCalibration,refAspect:number,curAspect:number) {
  const ray=imageRay(x,y,reference,c,refAspect);
  return ray ? projectRay(ray,current,c,curAspect) : null;
}

export function ptzHomography(reference: CameraPtzPose,current: CameraPtzPose,c: PtzCalibration,rw:number,rh:number,cw:number,ch:number): Homography | null {
  const rf=focalAt(reference.zoom,c), cf=focalAt(current.zoom,c);
  if (!rf || !cf) return null;
  const kr=[rf*rw,0,c.principalX*rw,0,rf*rw,c.principalY*rh,0,0,1];
  const kc=[cf*cw,0,c.principalX*cw,0,cf*cw,c.principalY*ch,0,0,1];
  const inv=invertHomography(kr);
  return inv ? multiply(multiply(kc, multiply(transpose(cameraRotation(current,c)),cameraRotation(reference,c))), inv) : null;
}

export interface CalibrationObservation { landmark: string; x: number; y: number; pose: CameraPtzPose; width: number; height: number }

/** Fit measured focal knots and mechanics using repeated observations of fixed landmarks. */
export function fitCalibration(observations: CalibrationObservation[], initial: PtzCalibration): PtzCalibration {
  const groups = new Map<string, CalibrationObservation[]>();
  for (const o of observations) groups.set(o.landmark,[...(groups.get(o.landmark)||[]),o]);
  for(const [id,group] of groups)if(group.length<2)groups.delete(id);
  const usable=[...groups.values()].flat();
  if (usable.length < 4) {
    throw new Error('Capture four samples of a fixed landmark, or two samples each of two landmarks.');
  }
  if(usable.some(o=>![o.x,o.y,o.width,o.height,o.pose.pan,o.pose.tilt,o.pose.zoom].every(Number.isFinite)||o.width<=0||o.height<=0)) {
    throw new Error('Capture a fresh image with finite camera position values.');
  }
  const span=(values:number[])=>Math.max(...values)-Math.min(...values);
  const moved=[...groups.values()].some(g=>
    (span(g.map(o=>o.x))>.03||span(g.map(o=>o.y))>.03)&&
    [span(g.map(o=>o.pose.pan)),span(g.map(o=>o.pose.tilt)),span(g.map(o=>o.pose.zoom))].some(v=>v>.0001));
  if(!moved)throw new Error('Move the camera slightly between captures so a fixed landmark changes image position.');
  const zooms = [...new Set(usable.map(o=>Math.round(o.pose.zoom*10000)/10000))].sort((a,b)=>a-b);
  if (zooms.length > 8) throw new Error('Use at most eight zoom positions in one fit. A single zoom position is enough to start.');
  const aspect=usable[0].width/usable[0].height;
  if (usable.some(o=>Math.abs(o.width/o.height-aspect)>0.01)) throw new Error('Keep the same stream profile during calibration.');
  const full=usable.length>=12&&groups.size>=2&&span(usable.map(o=>o.x))>.25&&span(usable.map(o=>o.y))>.2;
  const panVaries=span(usable.map(o=>o.pose.pan))>.0001,tiltVaries=span(usable.map(o=>o.pose.tilt))>.0001;
  const p=[initial.panRadiansPerUnit,initial.tiltRadiansPerUnit,initial.tiltOffsetRadians,
    ...zooms.map(z=>Math.log(focalAt(z, initial) || initial.zoomPoints[0]?.focal || 0.82)), initial.radialK1 || 0, initial.principalX, initial.principalY];
  if(initial.panPeriod>0)p[0]=Math.sign(p[0])*2*Math.PI/initial.panPeriod;
  const basePan=Math.abs(p[0]), baseTilt=Math.abs(p[1]);
  const decode=(v:number[]):PtzCalibration=>{
    const fitted=zooms.map((z,i)=>({zoom:z,focal:Math.exp(v[3+i])}));
    // Unmeasured zoom retains the nominal curve, adjusted to join the measured focal values continuously.
    const outside=initial.zoomPoints.filter(p=>p.zoom<zooms[0]||p.zoom>zooms.at(-1)!).map(p=>{
      const nearest=p.zoom<zooms[0]?fitted[0]:fitted.at(-1)!;
      return {zoom:p.zoom,focal:p.focal*nearest.focal/(focalAt(nearest.zoom,initial)||nearest.focal)};
    });
    return {...initial,panRadiansPerUnit:v[0],tiltRadiansPerUnit:v[1],tiltOffsetRadians:v[2],
      radialK1:v[v.length-3],principalX:v[v.length-2],principalY:v[v.length-1],aspect,
      zoomPoints:[...outside,...fitted].sort((a,b)=>a.zoom-b.zoom)};
  };
  const loss=(v:number[])=>{
    if (Math.abs(v[0])<basePan*0.7 || Math.abs(v[0])>basePan*1.3 || Math.abs(v[1])<baseTilt*0.7 || Math.abs(v[1])>baseTilt*1.3 || Math.abs(v[2])>Math.PI || Math.abs(v[v.length-3])>0.4 || v.slice(-2).some(n=>n<.35||n>.65)) return 1e12;
    if (v.slice(3,-3).some(f=>f<Math.log(0.3)||f>Math.log(50))) return 1e12;
    const c=decode(v); let sum=0,count=0;
    for (const group of groups.values()) {
      const rays=group.map(o=>imageRay(o.x,o.y,o.pose,c,aspect));
      if (rays.some(r=>!r)) return 1e12;
      const mean=[0,1,2].map(i=>rays.reduce((s,r)=>s+r![i],0)/rays.length);
      for (const o of group) {
        const q=projectRay(mean,o.pose,c,aspect);
        if (!q) return 1e12;
        const error=Math.hypot((q[0]-o.x)*960,(q[1]-o.y)*960/aspect);
        sum+=error*error; count++;
      }
    }
    return sum/count + 4*((c.principalX-.5)**2+(c.principalY-.5)**2);
  };
  let best=p, bestLoss=Infinity;
  // Direction conventions vary between cameras. Fit both signs against actual image observations.
  for (const panSign of (panVaries?[1,-1]:[1])) for (const tiltSign of (tiltVaries?[1,-1]:[1])) {
    const v=[...p]; v[0]*=panSign; v[1]*=tiltSign;
    // A quick fit adjusts observable movement and focal length; richer samples also fit lens geometry.
    const steps=[initial.panPeriod>0||!panVaries?0:basePan*0.08,tiltVaries?baseTilt*0.08:0,full?0.1:0,
      ...zooms.map(()=>0.2),full?0.03:0,full?0.02:0,full?0.02:0];
    let score=loss(v);
    for (let iteration=0;iteration<180;iteration++) {
      let improved=false;
      for (let i=0;i<v.length;i++) {
        if(steps[i]===0)continue;
        const old=v[i]; let selected=old;
        for (const sign of [-1,1]) {v[i]=old+steps[i]*sign; const next=loss(v); if(next<score){score=next;selected=v[i];improved=true;}}
        v[i]=selected;
      }
      if(!improved) for(let i=0;i<steps.length;i++) steps[i]*=0.7;
      if(Math.max(...steps)<1e-6) break;
    }
    if(score<bestLoss){best=v;bestLoss=score;}
  }
  const c=decode(best), rms=Math.sqrt(bestLoss);
  if(!Number.isFinite(rms)||rms>15) throw new Error(`Fit error is ${rms.toFixed(1)} px at 960px width. Repeat the same landmark at a few stopped camera positions.`);
  // Generic zoom must increase focal length, including the nominal extension outside measured positions.
  if(c.zoomPoints.some((p,i)=>i>0&&p.focal<c.zoomPoints[i-1].focal*0.95)) throw new Error('Zoom samples are inconsistent. Repeat at stable, increasing optical zoom positions.');
  return {...c,modelSource:'fitted',refinement:full?'full':'basic',sampleCount:usable.length,
    measuredZoomRange:[zooms[0],zooms.at(-1)!],validated:true,rmsErrorPx:rms,panPeriod:initial.panPeriod,updatedAt:new Date().toISOString()};
}
