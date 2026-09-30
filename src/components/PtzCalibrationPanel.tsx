import React, { useEffect, useRef, useState } from 'react';
import type { CameraPtzPose, OnvifMediaProfile, PtzCalibration } from '../types';
import { createPtzModel, fitCalibration, PTZ_MODEL_DEFAULTS, type CalibrationObservation } from '../cv/ptzProjection';

interface Snapshot { image:string; width:number; height:number; pose:CameraPtzPose }
interface Props { cameraKey:string;profile:OnvifMediaProfile;calibration:PtzCalibration|null;transport:'webrtc'|'hls';capture:()=>Snapshot|null;onSave:(c:PtzCalibration)=>void;onClose:()=>void }

export function PtzCalibrationPanel({cameraKey,profile,calibration,transport,capture,onSave,onClose}:Props) {
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [landmark,setLandmark]=useState('A');
  const [samples,setSamples]=useState<CalibrationObservation[]>([]);
  const [fit,setFit]=useState<PtzCalibration|null>(calibration?.modelSource==='estimated'?null:calibration);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [panSpan,setPanSpan]=useState(calibration?Math.abs(calibration.panRadiansPerUnit)*(profile.ptz?.panRange?profile.ptz.panRange[1]-profile.ptz.panRange[0]:2)*180/Math.PI:PTZ_MODEL_DEFAULTS.panSpanDegrees);
  const [tiltSpan,setTiltSpan]=useState(calibration?Math.abs(calibration.tiltRadiansPerUnit)*(profile.ptz?.tiltRange?profile.ptz.tiltRange[1]-profile.ptz.tiltRange[0]:2)*180/Math.PI:PTZ_MODEL_DEFAULTS.tiltSpanDegrees);
  const [wideFov,setWideFov]=useState(calibration?.zoomPoints[0]?.focal?2*Math.atan(1/(2*calibration.zoomPoints[0].focal))*180/Math.PI:PTZ_MODEL_DEFAULTS.wideFovDegrees);
  const [maxZoom,setMaxZoom]=useState(calibration?.zoomPoints.length?calibration.zoomPoints.at(-1)!.focal/calibration.zoomPoints[0].focal:PTZ_MODEL_DEFAULTS.opticalZoomMax);
  const [delay,setDelay]=useState(calibration?.videoDelayByTransport?.[transport]??(transport==='webrtc'?calibration?.videoDelayMs??150:2000));
  const [captureTime,setCaptureTime]=useState(calibration?.useCaptureTime??false);
  const [rotation,setRotation]=useState<PtzCalibration['imageRotationDegrees']>(calibration?.imageRotationDegrees||0);
  const [flipEnabled,setFlipEnabled]=useState(Boolean(calibration?.autoFlip));
  const [flipThreshold,setFlipThreshold]=useState(calibration?.autoFlip?.tiltThreshold??0);
  const [flipAbove,setFlipAbove]=useState(calibration?.autoFlip?.above??true);
  const [wrapPan,setWrapPan]=useState(calibration?calibration.panPeriod>0:true);
  const invalidateGeometry=()=>setFit(null);
  const fitWorker=useRef<Worker|null>(null);
  useEffect(()=>()=>fitWorker.current?.terminate(),[]);
  const seed=():PtzCalibration=>{
    const initial=createPtzModel(cameraKey,profile,snapshot?snapshot.width/snapshot.height:calibration?.aspect,
      {panSpanDegrees:panSpan,tiltSpanDegrees:tiltSpan,wideFovDegrees:wideFov,opticalZoomMax:maxZoom,wrapPan});
    return {...initial,
      panRadiansPerUnit:initial.panRadiansPerUnit*(Math.sign(calibration?.panRadiansPerUnit||1)),
      tiltRadiansPerUnit:initial.tiltRadiansPerUnit*(Math.sign(calibration?.tiltRadiansPerUnit||1)),
      tiltOffsetRadians:calibration?.tiltOffsetRadians??initial.tiltOffsetRadians,
      principalX:calibration?.principalX??.5,principalY:calibration?.principalY??.5,radialK1:calibration?.radialK1??0,
      videoDelayMs:transport==='webrtc'?delay:calibration?.videoDelayMs??150,useCaptureTime:captureTime,imageRotationDegrees:rotation,
      autoFlip:flipEnabled?{tiltThreshold:flipThreshold,above:flipAbove}:undefined,
      videoDelayByTransport:{...calibration?.videoDelayByTransport,[transport]:delay},updatedAt:new Date().toISOString()};
  };
  const add=(event:React.MouseEvent<HTMLImageElement>)=>{
    if(!snapshot||busy)return;
    const rect=event.currentTarget.getBoundingClientRect();
    const sample:CalibrationObservation={landmark,x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height,
      pose:snapshot.pose,width:snapshot.width,height:snapshot.height};
    setFit(null);setSamples(old=>[...old,sample]);setError('');
    setSnapshot(null);
  };
  const calculate=()=>{
    setBusy(true);setError('');
    const finish=(value?:PtzCalibration,message?:string)=>{
      fitWorker.current?.terminate();fitWorker.current=null;setBusy(false);
      if(value)setFit(value);else setError(message||'Calibration failed.');
    };
    if(typeof Worker==='undefined'){
      setTimeout(()=>{try{finish(fitCalibration(samples,seed()));}catch(e){finish(undefined,e instanceof Error?e.message:'Calibration failed.');}},30);
      return;
    }
    try{
      const worker=new Worker(new URL('../cv/calibration.worker.ts',import.meta.url),{type:'module'});fitWorker.current=worker;
      worker.onmessage=({data}:MessageEvent<{calibration?:PtzCalibration;error?:string}>)=>finish(data.calibration,data.error);
      worker.onerror=()=>finish(undefined,'Could not fit camera geometry in the background.');
      worker.postMessage({samples,initial:seed()});
    }catch(e){finish(undefined,e instanceof Error?e.message:'Calibration failed.');}
  };
  const save=(value:PtzCalibration)=>onSave({...value,
    videoDelayMs:transport==='webrtc'?delay:value.videoDelayMs,
    videoDelayByTransport:{...value.videoDelayByTransport,[transport]:delay},useCaptureTime:captureTime});
  return <section className="absolute right-3 top-3 z-50 max-h-[85%] w-[min(420px,94%)] overflow-y-auto rounded-xl border border-sky-500/50 bg-slate-950/95 p-4 text-xs text-slate-200 shadow-xl">
    <div className="flex items-center justify-between"><h2 className="font-bold text-sky-300">Improve PTZ accuracy</h2><button onClick={onClose} aria-label="Close calibration">✕</button></div>
    <p className="my-3 leading-relaxed">PTZ telemetry and visual tracking already work without calibration. To improve accuracy, capture four stopped views of one fixed, distant landmark and click the same point each time. Move slightly between views; one zoom position is enough. A second landmark and extra views are optional.</p>
    <p className="mb-3 text-slate-400">For better accuracy, keep image stabilization and digital zoom disabled. Configure any fixed rotation or known automatic flip below.</p>
    <details className="my-2"><summary>Camera values</summary><fieldset disabled={busy}><p className="my-2 text-slate-400">Nominal starting values are already used for PTZ prediction. Adjust them for your camera, or refine them from landmark samples.</p>
      <div className="grid grid-cols-3 gap-2">{[['Pan span °',panSpan,setPanSpan],['Tilt span °',tiltSpan,setTiltSpan],['Wide FOV °',wideFov,setWideFov]].map(([label,value,set])=><label key={String(label)}>{String(label)}<input type="number" min="1" max="360" value={Number(value)} onChange={e=>{invalidateGeometry();(set as (n:number)=>void)(Number(e.target.value));}} className="w-full rounded bg-slate-800 p-1"/></label>)}</div>
      <label className="block my-2">Maximum optical zoom ×<input type="number" min="1" max="100" step="0.1" value={maxZoom} onChange={e=>{invalidateGeometry();setMaxZoom(Math.max(1,Math.min(100,Number(e.target.value))));}} className="ml-2 w-20 rounded bg-slate-800 p-1"/></label>
      <label className="my-2 flex gap-2"><input type="checkbox" checked={wrapPan} onChange={e=>{invalidateGeometry();setWrapPan(e.target.checked);}}/>Pan covers a full circle and wraps at the reported range endpoints</label>
      <label className="block my-2">Fixed image rotation <select value={rotation} onChange={e=>{invalidateGeometry();setRotation(Number(e.target.value) as PtzCalibration['imageRotationDegrees']);}} className="ml-2 rounded bg-slate-800 p-1">{[0,90,180,270].map(v=><option key={v} value={v}>{v}°</option>)}</select></label>
      <label className="my-2 flex gap-2"><input type="checkbox" checked={flipEnabled} onChange={e=>{invalidateGeometry();setFlipEnabled(e.target.checked);}}/>Camera applies a 180° image flip at a known tilt position</label>
      {flipEnabled&&<div className="my-2 flex gap-2"><input aria-label="Image flip tilt threshold" type="number" step="0.001" value={flipThreshold} onChange={e=>{invalidateGeometry();setFlipThreshold(Number(e.target.value));}} className="w-24 rounded bg-slate-800 p-1"/><select value={flipAbove?'above':'below'} onChange={e=>{invalidateGeometry();setFlipAbove(e.target.value==='above');}} className="rounded bg-slate-800 p-1"><option value="above">Flipped at or above this tilt</option><option value="below">Flipped below this tilt</option></select></div>}
      <p className="text-slate-400">The flip rule uses the camera’s reported tilt units. Extra samples across the image also refine lens distortion and image center.</p>
    </fieldset></details>
    <div className="my-3 flex gap-2"><label>Landmark <select value={landmark} onChange={e=>setLandmark(e.target.value)} className="rounded bg-slate-800 p-1"><option>A</option><option>B</option></select></label>
      <button disabled={busy} onClick={()=>{const s=capture();if(!s){setError('Wait for a fresh frame and camera position.');return;}if(s.pose.moving){setError('Stop PTZ movement and let the image settle before capturing.');return;}setSnapshot(s);setError('');}} className="rounded bg-sky-800 px-2 py-1">Capture stopped view</button>
    </div>
    {snapshot&&<><p>Click landmark {landmark} in this frozen image.</p><img src={snapshot.image} onClick={add} className="my-2 w-full cursor-crosshair" alt={`Frozen calibration view for landmark ${landmark}`}/><button onClick={()=>setSnapshot(null)} className="underline">Discard image</button></>}
    <p className="my-2">Samples: A {samples.filter(s=>s.landmark==='A').length} · B {samples.filter(s=>s.landmark==='B').length}</p>
    <div className="flex gap-3"><button disabled={busy||samples.length<4} onClick={calculate} className="rounded bg-sky-800 px-3 py-1 disabled:opacity-40">{busy?'Fitting…':'Fit calibration'}</button><button onClick={()=>{fitWorker.current?.terminate();fitWorker.current=null;setBusy(false);setSamples([]);setFit(null);setSnapshot(null);}} className="text-slate-400 underline">Start again</button></div>
    {fit&&<p className="my-3 text-emerald-300">Fit error: {fit.rmsErrorPx.toFixed(1)} px at 960px width. Ready to save; no extra verification captures are required. {fit.refinement==='basic'?'Quick fit improves movement and zoom estimates. More samples can refine lens geometry.':''}</p>}
    <label className="mt-3 block">Video delay relative to camera status (ms)<input type="number" min="0" max="5000" step="10" value={delay} onChange={e=>setDelay(Math.max(0,Math.min(5000,Number(e.target.value))))} className="ml-2 w-20 rounded bg-slate-800 p-1"/></label>
    <p className="my-2 text-slate-400">Adjust during a slow pan until overlays follow the displayed image. 150 ms is an initial estimate for WebRTC, not a measured delay. Recheck after changing transport.</p>
    <label className="my-2 flex gap-2"><input type="checkbox" checked={captureTime} onChange={e=>setCaptureTime(e.target.checked)}/>Use browser capture timestamps (only after checking gateway timestamp alignment).</label>
    {error&&<p role="status" className="my-3 text-amber-300">{error}</p>}
    <button disabled={!fit||busy} onClick={()=>fit&&save(fit)} className="mt-2 w-full rounded bg-emerald-800 py-2 font-bold disabled:opacity-40">Save calibration</button>
    <button disabled={busy} onClick={()=>save(seed())} className="mt-2 w-full rounded border border-slate-600 py-2 disabled:opacity-40">Apply camera values and timing without samples</button>
  </section>;
}
