import { fitCalibration, type CalibrationObservation } from './ptzProjection';
import type { PtzCalibration } from '../types';

const scope=globalThis as unknown as {
  onmessage:((event:MessageEvent<{samples:CalibrationObservation[];initial:PtzCalibration}>)=>void)|null;
  postMessage:(value:{calibration?:PtzCalibration;error?:string})=>void;
};
scope.onmessage=({data})=>{
  try{scope.postMessage({calibration:fitCalibration(data.samples,data.initial)});}
  catch(error){scope.postMessage({error:error instanceof Error?error.message:'Could not fit camera geometry.'});}
};
