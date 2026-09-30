import type { CameraPtzPose } from '../types';

export function wrappedDelta(a: number, b: number, period: number): number {
  const d = a - b;
  return period > 0 ? d - Math.round(d / period) * period : d;
}

export interface PoseSample { pose: CameraPtzPose; time: number; uncertaintyMs: number }

/** All times are in the browser's performance.now clock, including video callbacks. */
export class PoseTimeline {
  private samples: PoseSample[] = [];
  private deviceOffset:number|null=null;
  private lastDeviceTime=0;
  clear() { this.samples = []; this.deviceOffset=null;this.lastDeviceTime=0; }
  /** Camera UTC is optional. Coarse, repeated or discontinuous clocks use request midpoints. */
  pushStatus(pose:CameraPtzPose,start:number,end:number,cameraDurationMs:number) {
    const midpoint=(start+end)/2,uncertainty=Math.max(0,end-start,cameraDurationMs)/2;
    const device=pose.deviceTime?Date.parse(pose.deviceTime):NaN;
    let time=midpoint;
    if(Number.isFinite(device)&&/\.\d{2,}/.test(pose.deviceTime!)&&device>this.lastDeviceTime){
      const offset=midpoint-device;
      if(this.deviceOffset===null||Math.abs(offset-this.deviceOffset)>2000)this.deviceOffset=offset;
      else this.deviceOffset=this.deviceOffset*.95+offset*.05;
      const estimated=device+this.deviceOffset;
      if(estimated>=start-uncertainty&&estimated<=end+uncertainty)time=estimated;
      this.lastDeviceTime=device;
    }
    this.push({pose,time,uncertaintyMs:uncertainty+Math.abs(midpoint-time)});
  }
  push(sample: PoseSample) {
    if (!Number.isFinite(sample.time) || ![sample.pose.pan, sample.pose.tilt, sample.pose.zoom].every(Number.isFinite)) return;
    this.samples.push(sample);
    this.samples.sort((a, b) => a.time - b.time);
    this.samples = this.samples.filter(s => s.time >= sample.time - 10_000).slice(-160);
  }
  isSettled(time:number,period=2,durationMs=500):boolean {
    const recent=this.samples.filter(s=>s.time>=time-durationMs-400&&s.time<=time);
    if(recent.length<2||recent[0].time>time-durationMs||time-recent.at(-1)!.time>400)return false;
    const latest=recent.at(-1)!.pose;
    return recent.every(s=>s.pose.moving!==true&&Math.abs(wrappedDelta(s.pose.pan,latest.pan,period))<.0002&&
      Math.abs(s.pose.tilt-latest.tilt)<.0002&&Math.abs(s.pose.zoom-latest.zoom)<.0002);
  }
  sample(time: number, period = 2, maxAgeMs = 400): (PoseSample & { ageMs: number }) | null {
    if (!this.samples.length) return null;
    const after = this.samples.findIndex(s => s.time >= time);
    const a = this.samples[after <= 0 ? (after === 0 ? 0 : this.samples.length - 1) : after - 1];
    const b = after >= 0 ? this.samples[after] : a;
    if(a.pose.panTiltSpace&&b.pose.panTiltSpace&&a.pose.panTiltSpace!==b.pose.panTiltSpace ||
      a.pose.zoomSpace&&b.pose.zoomSpace&&a.pose.zoomSpace!==b.pose.zoomSpace)return null;
    const ageMs = Math.min(Math.abs(time - a.time), Math.abs(time - b.time)) + Math.max(a.uncertaintyMs,b.uncertaintyMs);
    if (ageMs > maxAgeMs || (b.time - a.time > maxAgeMs * 2)) return null;
    const t = a === b ? 0 : Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
    return { time, uncertaintyMs: Math.max(a.uncertaintyMs, b.uncertaintyMs), ageMs,
      pose: { ...a.pose, pan: a.pose.pan + wrappedDelta(b.pose.pan, a.pose.pan, period) * t,
        tilt: a.pose.tilt + (b.pose.tilt - a.pose.tilt) * t, zoom: a.pose.zoom + (b.pose.zoom - a.pose.zoom) * t } };
  }
}
