import test from 'node:test';
import assert from 'node:assert/strict';
import { containRect, displayToNormalized, normalizedToDisplay, processingSize } from '../src/cv/frameGeometry';
import { PoseTimeline } from '../src/video/poseTimeline';
import { focalAt, imageRay, projectRay, projectPtz, ptzHomography, fitCalibration, type CalibrationObservation } from '../src/cv/ptzProjection';
import { projectPoint } from '../src/cv/homography';
import { fitSimilarity } from '../src/cv/similarity';
import { VisualRegistrationEngine } from '../src/cv/registrationEngine';
import { grayPyramid } from '../src/cv/featureDetection';
import { trackMatches } from '../src/cv/opticalFlow';
import { extractPtzPose, summarizeProfile } from '../server/onvifBridge';
import type { PtzCalibration, CameraPtzPose } from '../src/types';

const calibration:PtzCalibration={version:1,cameraKey:'camera',panRadiansPerUnit:Math.PI,tiltRadiansPerUnit:0.9,tiltOffsetRadians:0,
  panPeriod:2,principalX:0.5,principalY:0.5,radialK1:0,zoomPoints:[{zoom:0,focal:0.8},{zoom:1,focal:4}],aspect:16/9,
  rmsErrorPx:0,validated:true,videoDelayMs:150,useCaptureTime:false,updatedAt:''};
const origin={pan:0,tilt:0,zoom:0};
function near(a:number,b:number,tolerance=1e-5){assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);}
function blank(width:number,height:number):ImageData{return {width,height,data:new Uint8ClampedArray(width*height*4),colorSpace:'srgb'} as ImageData;}
function texture(width:number,height:number,dx=0,dy=0):ImageData{
  const frame=blank(width,height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const xx=x-dx,yy=y-dy;
    const seed=((Math.floor(xx/7)*73856093)^(Math.floor(yy/7)*19349663))>>>0;
    const value=40+(seed%180),i=(y*width+x)*4;
    frame.data[i]=frame.data[i+1]=frame.data[i+2]=value;frame.data[i+3]=255;
  }
  return frame;
}

test('aspect-preserving processing and normalized placement survive viewport resizing',()=>{
  assert.deepEqual(processingSize(1920,1080),[960,540]);assert.deepEqual(processingSize(640,480),[640,480]);
  for(const [w,h] of [[1000,700],[500,900],[1920,1080]]){
    const rect=containRect(640,480,w,h),p=normalizedToDisplay(0.2,0.8,rect),q=displayToNormalized(...p,rect)!;
    near(q[0],0.2);near(q[1],0.8);near(rect.width/rect.height,4/3);
  }
  assert.equal(displayToNormalized(10,10,containRect(640,480,1000,1000)),null);
});
test('pose interpolation crosses the circular pan seam without reversing',()=>{
  const timeline=new PoseTimeline();timeline.push({pose:{...origin,pan:0.99},time:100,uncertaintyMs:5});
  timeline.push({pose:{...origin,pan:-0.99},time:200,uncertaintyMs:5});
  near(timeline.sample(150)!.pose.pan,1);assert.equal(timeline.sample(1000),null);
  timeline.clear();assert.equal(timeline.sample(150),null);
});
test('PTZ projects rotation and zoom, rejects behind-camera points, and returns after 360 degrees',()=>{
  const p=projectPtz(0.5,0.5,origin,{...origin,pan:0.02},calibration,16/9,16/9)!;assert.ok(p[0]<0.5);
  const q=projectPtz(0.6,0.5,origin,{...origin,zoom:1},calibration,16/9,16/9)!;near(q[0],1);
  assert.equal(projectPtz(0.5,0.5,origin,{...origin,pan:1},calibration,16/9,16/9),null);
  const returned=projectPtz(0.3,0.6,origin,{...origin,pan:2},calibration,16/9,16/9)!;near(returned[0],0.3);near(returned[1],0.6);
  assert.equal(focalAt(1.5,calibration),null);
});
test('homography and calibrated rays agree at different image resolutions',()=>{
  const pose={pan:0.04,tilt:0.06,zoom:0.2};
  for(const [w,h] of [[640,360],[1280,720],[1920,1080]]){
    const H=ptzHomography(origin,pose,calibration,640,360,w,h)!;
    const p=projectPoint(H,0.3*640,0.7*360),q=projectPtz(0.3,0.7,origin,pose,calibration,16/9,16/9)!;
    near(p[0]/w,q[0]);near(p[1]/h,q[1]);
  }
});
test('radial distortion round trips through a camera ray',()=>{
  const c={...calibration,radialK1:0.08};const ray=imageRay(0.1,0.8,origin,c,16/9)!;
  const p=projectRay(ray,origin,c,16/9)!;near(p[0],0.1);near(p[1],0.8);
});
test('bounded visual correction accepts a small offset and rejects an anchor jump',()=>{
  const matches=Array.from({length:20},(_,i)=>({refIdx:i,curIdx:i,distance:0,refX:80+(i%5)*120,refY:60+Math.floor(i/5)*90,curX:83+(i%5)*120,curY:58+Math.floor(i/5)*90}));
  const fit=fitSimilarity(matches,2,24,640,360)!;assert.ok(fit);near(fit.homography[2],3);near(fit.homography[5],-2);
  assert.equal(fitSimilarity(matches.map(m=>({...m,curX:m.curX+100})),2,24,640,360),null);
});
test('ONVIF normalized coordinates and optional status metadata survive parsing',()=>{
  const pose=extractPtzPose({data:{GetStatusResponse:{PTZStatus:{Position:{PanTilt:{$:{x:'-0.6241666667',y:'-0.1948571429',space:'generic'}},Zoom:{$:{x:'0.034375'}}},MoveStatus:{PanTilt:'MOVING'},UtcTime:'2026-09-30T12:00:00Z'}}}})!;
  near(pose.pan,-0.6241666667);near(pose.zoom,0.034375);assert.equal(pose.moving,true);assert.equal(pose.panTiltSpace,'generic');
  assert.equal(extractPtzPose({}),null);assert.equal(summarizeProfile({token:'main'}).width,0);
});
test('PTZ primary anchors move even with no visual texture; all saved views project independently',()=>{
  const e=new VisualRegistrationEngine();e.configurePtz(calibration,'camera');
  e.addSetupKeyframe(blank(640,360),'front',undefined,origin,'camera');
  e.addSetupKeyframe(blank(640,360),'back',undefined,{...origin,pan:1},'camera');
  e.setFramePose({...origin,pan:0.03},10);const m=e.processFrame(blank(960,540));
  assert.equal(m.mode,'ptz');const p=e.projectAnchor('front',0.5,0.5)!;assert.ok(p[0]<0.5);
  assert.equal(e.projectAnchor('back',0.5,0.5),null);
  e.setFramePose({...origin,pan:1},10);e.processFrame(blank(960,540));near(e.projectAnchor('back',0.5,0.5)![0],0.5);
  assert.equal(e.projectAnchor('front',0.5,0.5),null);
});
test('invalid calibration or wrong camera does not claim PTZ positioning',()=>{
  for(const c of [{...calibration,validated:false},{...calibration,cameraKey:'different'}]){
    const e=new VisualRegistrationEngine();e.configurePtz(c,'camera');e.addSetupKeyframe(blank(640,360),'a',undefined,origin,'camera');
    e.setFramePose({...origin,pan:0.03},10);const m=e.processFrame(blank(640,360));assert.notEqual(m.mode,'ptz');
  }
});
test('replacing the first view preserves its identity and independent views',()=>{
  const e=new VisualRegistrationEngine();e.addSetupKeyframe(blank(320,180),'a');e.addSetupKeyframe(blank(320,180),'b');
  e.addSetupKeyframe(blank(640,360),'a');assert.equal(e.getAnchorViewId(),'a');assert.equal(e.isIndependentView('a'),false);assert.equal(e.isIndependentView('b'),true);
});
test('pyramidal optical flow tracks a small image translation',()=>{
  const a=texture(320,240),b=texture(320,240,3,-2);
  const gray=(image:ImageData)=>Uint8Array.from({length:image.width*image.height},(_,i)=>image.data[i*4]);
  const points=Array.from({length:30},(_,i)=>({refIdx:i,curIdx:i,distance:0,refX:63+i%6*35,refY:63+Math.floor(i/6)*28,curX:63+i%6*35,curY:63+Math.floor(i/6)*28}));
  const tracked=trackMatches(grayPyramid(gray(a),320,240),grayPyramid(gray(b),320,240),points);
  assert.ok(tracked.length>10,`only ${tracked.length} tracked`);
  for(const m of tracked){near(m.curX-m.refX,3,0.4);near(m.curY-m.refY,-2,0.4);}
});
test('visual-only image registration reacquires after translation',()=>{
  const e=new VisualRegistrationEngine();e.setReferenceFrame(texture(320,240));
  e.processFrame(texture(320,240,5,3));const p=e.projectAnchor(undefined,0.5,0.5);
  assert.ok(p);near(p[0]*320,165,2);near(p[1]*240,123,2);
});
test('landmark calibration fits measured zoom levels and rejects insufficient samples',()=>{
  assert.throws(()=>fitCalibration([],calibration),/12 samples/);
  const observations:CalibrationObservation[]=[];
  const trueCalibration={...calibration,zoomPoints:[{zoom:0,focal:0.8},{zoom:0.3,focal:1.4}],tiltOffsetRadians:0.2};
  for(const [landmark,x,y] of [['A',0.35,0.4],['B',0.65,0.65]] as const){
    const ray=imageRay(x,y,origin,trueCalibration,16/9)!;
    for(const zoom of [0,0.3])for(const pan of [-0.04,0,0.04])for(const tilt of [-0.12,0.12]){
      const pose={pan,tilt,zoom},p=projectRay(ray,pose,trueCalibration,16/9)!;
      observations.push({landmark,x:p[0],y:p[1],pose,width:960,height:540});
    }
  }
  const fitted=fitCalibration(observations,{...trueCalibration,zoomPoints:[{zoom:0,focal:0.85},{zoom:0.3,focal:1.5}]});
  assert.ok(fitted.rmsErrorPx<2,`RMS ${fitted.rmsErrorPx}`);near(fitted.zoomPoints[0].focal,0.8,0.08);
});
