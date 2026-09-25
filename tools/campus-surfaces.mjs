// Build-time only: true polygon unions/differences. The browser loads only the baked result.
import clipping from 'polygon-clipping';
import { campusPoint, campusPlanKey } from '../src/world/university-plan.js';
const round=v=>Math.round(v*1000)/1000;
const polygon=pts=>[pts.map(([x,z])=>[round(x),round(z)])];
export function join(polys){let q=polys.filter(p=>p?.length);while(q.length>1){const n=[];for(let i=0;i<q.length;i+=2)n.push(q[i+1]?clipping.union(q[i],q[i+1]):q[i]);q=n;}return q[0]||[];}
export function bufferRoad(r,grow=0){
  const h=r.width/2+grow,pieces=[];
  for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<1e-5)continue;const nx=-dz/len*h,nz=dx/len*h;pieces.push(polygon([[a.x+nx,a.z+nz],[b.x+nx,b.z+nz],[b.x-nx,b.z-nz],[a.x-nx,a.z-nz]]));}
  const last=r.loop?r.points.length-1:r.points.length;
  for(let i=0;i<last;i++){if(r.flatEnds&&(i===0||i===last-1))continue;const p=r.points[i];pieces.push(polygon(Array.from({length:20},(_,j)=>{const a=j*Math.PI/10;return[p.x+Math.cos(a)*h,p.z+Math.sin(a)*h];})));}
  return join(pieces);
}
const courtPolygon=(p,grow)=>polygon([[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz])=>{const q=campusPoint(p,p.plaza.x+sx*(p.plaza.w/2+grow),p.plaza.z+sz*(p.plaza.d/2+grow));return[q.x,q.z];}));
export function surfaceArea(multi){return multi.reduce((sum,poly)=>sum+poly.reduce((s,ring,i)=>{let a=0;for(let j=0;j<ring.length;j++){const b=ring[(j+1)%ring.length];a+=ring[j][0]*b[1]-b[0]*ring[j][1];}return s+(i?-1:1)*Math.abs(a/2);},0),0);}
export function compileSurfaces(plan){
  const a=join(plan.roads.filter(r=>!r.drive).map(r=>bufferRoad(r)));
  const paversRaw=join([...plan.roads.filter(r=>r.drive).map(r=>bufferRoad(r)),...plan.precincts.map(p=>courtPolygon(p,0))]);
  const paving=clipping.difference(paversRaw,a),road=join([a,paving]);
  const outside=join([...plan.roads.map(r=>bufferRoad(r,3.2)),...plan.precincts.map(p=>courtPolygon(p,3.2))]);
  const thin=join([...plan.roads.map(r=>bufferRoad(r,.22)),...plan.precincts.map(p=>courtPolygon(p,.22))]);
  // Match the existing village and airstrip approach with open, flush end faces.
  const seams=[polygon([[1493,2999],[1507,2999],[1507,3000.3],[1493,3000.3]]),polygon([[1493,3089.7],[1507,3089.7],[1507,3094],[1493,3094]])];
  const curb=clipping.difference(thin,road,...seams);
  const sidewalk=clipping.difference(outside,thin,...seams);
  const result={key:campusPlanKey(plan),asphalt:a,paving,curb,sidewalk};
  // Non-overlap is the invariant: no hidden stacked strips at any junction.
  for(const [k1,k2]of [['asphalt','paving'],['asphalt','sidewalk'],['paving','sidewalk'],['curb','asphalt'],['curb','paving']]){
    const overlap=surfaceArea(clipping.intersection(result[k1],result[k2]));if(overlap>.002)throw new Error(`${k1}/${k2} overlap: ${overlap}`);
  }
  // Spatial tiles avoid submitting all campus pavement when only one corner is visible.
  result.tiles=[];const step=400;
  for(let x=-1200;x<4400;x+=step)for(let z=-1200;z<4400;z+=step){const rect=polygon([[x,z],[x+step,z],[x+step,z+step],[x,z+step]]);const tile={x,z};for(const key of ['asphalt','paving','curb','sidewalk']){const polys=clipping.intersection(result[key],rect);if(polys.length)tile[key]=polys;}if(Object.keys(tile).length>2)result.tiles.push(tile);}
  return result;
}
