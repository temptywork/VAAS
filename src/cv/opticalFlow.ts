import type { GrayLevel } from './featureDetection';
import type { FeatureMatch } from './matcher';

function pixel(l:GrayLevel,x:number,y:number):number {
  const ix=Math.floor(x),iy=Math.floor(y),dx=x-ix,dy=y-iy,p=iy*l.width+ix;
  return l.gray[p]*(1-dx)*(1-dy)+l.gray[p+1]*dx*(1-dy)+l.gray[p+l.width]*(1-dx)*dy+l.gray[p+l.width+1]*dx*dy;
}
function track(a:GrayLevel[],b:GrayLevel[],x:number,y:number,guess:[number,number]):[number,number]|null {
  let qx=guess[0],qy=guess[1];
  for(let level=Math.min(a.length,b.length)-1;level>=0;level--) {
    const s=2**level, p=a[level],q=b[level],px=x/s,py=y/s;
    let u=qx/s,v=qy/s;
    if(px<6||py<6||px>=p.width-7||py>=p.height-7) return null;
    for(let iteration=0;iteration<10;iteration++) {
      if(u<6||v<6||u>=q.width-7||v>=q.height-7) return null;
      let xx=0,xy=0,yy=0,bx=0,by=0,error=0;
      for(let j=-4;j<=4;j++) for(let i=-4;i<=4;i++) {
        const gx=(pixel(q,u+i+1,v+j)-pixel(q,u+i-1,v+j))/2;
        const gy=(pixel(q,u+i,v+j+1)-pixel(q,u+i,v+j-1))/2;
        const e=pixel(p,px+i,py+j)-pixel(q,u+i,v+j);
        xx+=gx*gx;xy+=gx*gy;yy+=gy*gy;bx+=gx*e;by+=gy*e;error+=Math.abs(e);
      }
      const determinant=xx*yy-xy*xy;
      if(determinant<1e-5 || (iteration===9 && error/81>25)) return null;
      const dx=(yy*bx-xy*by)/determinant,dy=(xx*by-xy*bx)/determinant;
      if(Math.hypot(dx,dy)>8) return null;
      u+=dx;v+=dy;
      if(Math.hypot(dx,dy)<0.03) break;
    }
    qx=u*s;qy=v*s;
  }
  return [qx,qy];
}

/** Forward/backward checked pyramidal Lucas-Kanade. Original reference coordinates survive each frame. */
export function trackMatches(previous:GrayLevel[],current:GrayLevel[],matches:FeatureMatch[],predict?:(x:number,y:number)=>[number,number]|null):FeatureMatch[] {
  if(previous[0].width!==current[0].width||previous[0].height!==current[0].height) return [];
  const out:FeatureMatch[]=[];
  const tolerance=Math.max(.5,1.2*Math.max(current[0].width,current[0].height)/960);
  for(const m of matches.slice(0,180)) {
    const guess=predict?.(m.curX,m.curY) || [m.curX,m.curY] as [number,number];
    const q=track(previous,current,m.curX,m.curY,guess);
    if(!q) continue;
    const back=track(current,previous,q[0],q[1],[m.curX,m.curY]);
    if(back && Math.hypot(back[0]-m.curX,back[1]-m.curY)<tolerance) out.push({...m,curX:q[0],curY:q[1]});
  }
  return out;
}
