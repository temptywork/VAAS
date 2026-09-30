import type { FeatureMatch } from './matcher';
import { projectPoint } from './homography';

/** Four-parameter residual avoids unstable projective extrapolation over sparse features. */
export function fitSimilarity(matches:FeatureMatch[],threshold:number,limit:number,width:number,height:number) {
  let best:FeatureMatch[]=[];
  const separation=Math.max(4,10*Math.max(width,height)/960)**2;
  for(let i=0;i<100&&matches.length>=3;i++) {
    const a=matches[i%matches.length],b=matches[(i*17+3)%matches.length];
    const dx=b.refX-a.refX,dy=b.refY-a.refY,den=dx*dx+dy*dy;
    if(den<separation) continue;
    const u=b.curX-a.curX,v=b.curY-a.curY,cs=(u*dx+v*dy)/den,sn=(v*dx-u*dy)/den;
    const h=[cs,-sn,a.curX-cs*a.refX+sn*a.refY,sn,cs,a.curY-sn*a.refX-cs*a.refY,0,0,1];
    const inliers=matches.filter(m=>{const p=projectPoint(h,m.refX,m.refY);return Math.hypot(p[0]-m.curX,p[1]-m.curY)<threshold;});
    if(inliers.length>best.length) best=inliers;
  }
  if(best.length<6) return null;
  const mean=(key:keyof FeatureMatch)=>best.reduce((s,m)=>s+Number(m[key]),0)/best.length;
  const x=mean('refX'),y=mean('refY'),u=mean('curX'),v=mean('curY');
  let cs=0,sn=0,den=0;
  for(const m of best){const dx=m.refX-x,dy=m.refY-y,du=m.curX-u,dv=m.curY-v;cs+=dx*du+dy*dv;sn+=dx*dv-dy*du;den+=dx*dx+dy*dy;}
  if(den<separation) return null;
  cs/=den;sn/=den;
  const h=[cs,-sn,u-cs*x+sn*y,sn,cs,v-sn*x-cs*y,0,0,1];
  if(Math.hypot(cs-1,sn)>0.08) return null;
  for(const p of [[0,0],[width,0],[0,height],[width,height]]){
    const q=projectPoint(h,p[0],p[1]);if(Math.hypot(q[0]-p[0],q[1]-p[1])>limit) return null;
  }
  const xs=best.map(m=>m.refX),ys=best.map(m=>m.refY);
  if(Math.max(...xs)-Math.min(...xs)<width*0.12 || Math.max(...ys)-Math.min(...ys)<height*0.1) return null;
  const error=best.reduce((s,m)=>{const q=projectPoint(h,m.refX,m.refY);return s+Math.hypot(q[0]-m.curX,q[1]-m.curY);},0)/best.length;
  return {homography:h,inliers:best,error};
}
