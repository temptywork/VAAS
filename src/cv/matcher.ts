import { hammingDistance, type Keypoint } from './featureDetection';

export interface FeatureMatch {
  refIdx: number; curIdx: number; distance: number;
  refX: number; refY: number; curX: number; curY: number;
}
export interface MatchGeometry {
  predict: (x:number,y:number,index:number) => [number,number] | null;
  radiusPx: number;
}

/** Ratio filtering and mutual nearest neighbors; pose gates precede descriptor comparison. */
export function matchFeatures(ref:Keypoint[],cur:Keypoint[],ratio=.78,maxDistance=52,geometry?:MatchGeometry):FeatureMatch[] {
  if(ref.length<4||cur.length<4)return [];
  const bestRef=new Int32Array(cur.length).fill(-1),bestCur=new Int32Array(ref.length).fill(-1);
  const curDist=new Float64Array(cur.length).fill(Infinity),refDist=new Float64Array(ref.length).fill(Infinity);
  const second=new Float64Array(cur.length).fill(Infinity),count=new Uint16Array(cur.length);
  const predictions=geometry?ref.map((p,i)=>geometry.predict(p.x,p.y,i)):null;
  const radius2=geometry?geometry.radiusPx**2:Infinity;
  for(let r=0;r<ref.length;r++) {
    const p=predictions?.[r];if(geometry&&!p)continue;
    for(let c=0;c<cur.length;c++) {
      if(p&&(p[0]-cur[c].x)**2+(p[1]-cur[c].y)**2>radius2)continue;
      const d=hammingDistance(ref[r].descriptor,cur[c].descriptor);count[c]++;
      if(d<refDist[r]){refDist[r]=d;bestCur[r]=c;}
      if(d<curDist[c]){second[c]=curDist[c];curDist[c]=d;bestRef[c]=r;}
      else if(d<second[c])second[c]=d;
    }
  }
  const matches:FeatureMatch[]=[];
  for(let c=0;c<cur.length;c++) {
    const r=bestRef[c];
    const distinct=count[c]>1?curDist[c]<second[c]*ratio:!!geometry&&curDist[c]<=maxDistance*.65;
    if(r>=0&&bestCur[r]===c&&curDist[c]<=maxDistance&&distinct)matches.push({refIdx:r,curIdx:c,distance:curDist[c],
      refX:ref[r].x,refY:ref[r].y,curX:cur[c].x,curY:cur[c].y});
  }
  return matches;
}
