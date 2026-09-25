// A designed, irregular campus outside the measured village. All coordinates are metres.
import { rng, hashStr, pointInPolygon } from '../util/math.js';
export const CAMPUS_BOUNDS = { minX: -1100, minZ: -1100, maxX: 4100, maxZ: 4100 };
export const BUILDING_TYPES = {
  faculty: { floors: 3, height: 15.5, blocks: [[0, 0, 64, 28]] },
  institute: { floors: 3, height: 15.5, blocks: [[0, 0, 76, 26], [27, -27, 22, 64]] },
  residence: { floors: 4, height: 19.5, blocks: [[0, 0, 82, 24], [-29, -12, 24, 45]] },
  library: { floors: 3, height: 16.5, blocks: [[0, 0, 88, 40]] },
  hall: { floors: 2, height: 12, blocks: [[0, 0, 62, 38]] },
  pavilion: { floors: 1, height: 6.5, blocks: [[0, 0, 34, 24]] },
};
export function campusPoint(p, x, z) {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return { x: p.x + x * c + z * s, z: p.z - x * s + z * c };
}
export function localRect(p, x, z, w, d) {
  return [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]].map(([a,b])=>{const q=campusPoint(p,a,b);return [q.x,q.z];});
}
export function boundsOf(points, margin=0) {
  return { x0:Math.min(...points.map(q=>q[0]))-margin, x1:Math.max(...points.map(q=>q[0]))+margin, z0:Math.min(...points.map(q=>q[1]))-margin, z1:Math.max(...points.map(q=>q[1]))+margin };
}
export const inBox = (r,x,z,m=0) => x>=r.x0-m&&x<=r.x1+m&&z>=r.z0-m&&z<=r.z1+m;
export function projectPath(path, x, z) {
  let best = { dist: Infinity };
  for (let i = 1; i < path.points.length; i++) {
    const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;
    if(d2<1e-8)continue;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/d2));
    const px=a.x+dx*t,pz=a.z+dz*t,dist=Math.hypot(x-px,z-pz);
    if(dist<best.dist)best={x:px,z:pz,yaw:Math.atan2(dx,-dz),dist,segment:i-1,t};
  }
  return best;
}
export function pathSamples(path,spacing) {
  const out=[];let walked=0,next=0;
  for(let i=1;i<path.points.length;i++){
    const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<1e-8)continue;
    while(next<walked+len-.001){const t=(next-walked)/len;out.push({x:a.x+dx*t,z:a.z+dz*t,nx:-dz/len,nz:dx/len,dx:dx/len,dz:dz/len,at:next});next+=spacing;}
    walked+=len;
  }
  return out;
}
// Smooth through uneven control stations rather than offsetting a square.
function windingLoop(anchors) {
  const points=[];const n=anchors.length;
  for(let i=0;i<n;i++){
    const a=anchors[(i+n-1)%n],b=anchors[i],c=anchors[(i+1)%n],d=anchors[(i+2)%n];
    const steps=Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/35);
    for(let j=0;j<steps;j++){
      const t=j/steps,t2=t*t,t3=t2*t;
      const at=k=>(2*t3-3*t2+1)*b[k]+(t3-2*t2+t)*.32*(c[k]-a[k])+(-2*t3+3*t2)*c[k]+(t3-t2)*.32*(d[k]-b[k]);
      points.push([at(0),at(1)]);
    }
  }
  points.push(points[0]);return points;
}
export function createCampusPlan() {
  const random=rng(251926),roads=[],precincts=[];
  const road=(id,points,width=10,extra={})=>{const p={id,points:points.map(([x,z])=>({x,z})),width,kind:'university',...extra};roads.push(p);return p;};
  const loop=road('university-loop',windingLoop([[-270,0],[-510,450],[-350,950],[-620,1570],[-500,2190],[-300,2830],[-170,3370],[470,3480],[1130,3430],[1700,3480],[2260,3390],[2940,3580],[3530,3380],[3480,2710],[3300,2110],[3570,1500],[3370,780],[3440,140],[3050,-400],[2340,-280],[1710,-620],[950,-430],[360,-560]]),18,{loop:true,name:'Campus Drive'});
  road('university-entrance',[[2160,3690],[2160,3060]],16);
  road('village-link',[[1500,3060],[2160,3060]],12);
  road('gate-link',[[1500,3000],[1500,3090]],12,{flatEnds:true});
  const plan={bounds:CAMPUS_BOUNDS,roads,precincts,boundary:loop.points.map(q=>[q.x,q.z]),gate:{x:2160,z:3340},sports:{x:3090,z:2450,w:100,h:160},airfield:{x0:700,x1:1580,z0:3075,z1:3285},arrival:{x0:2138,x1:2210,z0:3320,z1:3355},approach:{x0:-1100,x1:4100,z0:3100,z1:3260}};
  const sportsEntry=projectPath(loop,plan.sports.x+plan.sports.w+20,plan.sports.z+80);road('sports-drive',[[sportsEntry.x,sportsEntry.z],[plan.sports.x+plan.sports.w+20,plan.sports.z+80]],10);
  const inVillage=(r,m=20)=>r.x1>-m&&r.x0<3000+m&&r.z1>-m&&r.z0<3000+m;
  const intersects=(a,b,m=0)=>a.x0<b.x1+m&&a.x1>b.x0-m&&a.z0<b.z1+m&&a.z1>b.z0-m;
  const add=(name,x,z,kind,twist=0)=>{
    const target=projectPath(loop,x,z),rot=Math.atan2(target.x-x,target.z-z)+twist;
    const p={id:`university-${precincts.length+1}`,name,x,z,rot,kind};
    const type=BUILDING_TYPES[kind];p.footprints=type.blocks.map(([bx,bz,w,d])=>localRect(p,bx,bz,w,d));p.boxes=p.footprints.map(q=>boundsOf(q,3));
    const front=Math.max(...type.blocks.map(([bx,bz,w,d])=>bz+d/2));
    p.front=front;p.plaza={x:0,z:front+19,w:kind==='pavilion'?46:70,d:28};p.court=localRect(p,0,p.plaza.z,p.plaza.w,p.plaza.d);p.courtBox=boundsOf(p.court);
    const body=boundsOf(p.footprints.flat(),16);
    if(z<1580||!insideCampus(plan,x,z,70)||!([...p.footprints.flat(),...p.court].every(([a,b])=>insideCampus(plan,a,b,20))))return null;
    if(inVillage(body)||inAirfield(plan,x,z,Math.max(body.x1-body.x0,body.z1-body.z0)/2+10))return null;
    if(body.x0<-1020||body.z0<-1020||body.x1>4020||body.z1>4020)return null;
    if(intersects(body,{x0:plan.sports.x-10,x1:plan.sports.x+plan.sports.w+10,z0:plan.sports.z-10,z1:plan.sports.z+plan.sports.h+10}))return null;
    if(intersects(body,plan.arrival,10))return null;
    if(precincts.some(o=>intersects(body,o.landBox,14)))return null;
    const mouth=campusPoint(p,0,p.plaza.z);
    const drive={points:[mouth,{x:target.x,z:target.z}],width:9};
    if(target.dist<front+58||target.dist>330)return null;
    // Do not let a new footprint swallow any existing route, nor send its drive through another building.
    if(roads.some(r=>pathSamples(r,8).some(q=>inBox(body,q.x,q.z,r.width/2+6))))return null;
    if(pathSamples(drive,4).some(q=>inVillage({x0:q.x-6,x1:q.x+6,z0:q.z-6,z1:q.z+6},4)||precincts.some(o=>o.boxes.some(b=>inBox(b,q.x,q.z,9)))||inAirfield(plan,q.x,q.z,8)||inBox(plan.arrival,q.x,q.z,8)))return null;
    p.landBox=boundsOf([...p.footprints.flat(),...p.court],12);p.entry={x:target.x,z:target.z};
    p.road=road(`${p.id}-drive`,[[mouth.x,mouth.z],[target.x,target.z]],9,{drive:true});precincts.push(p);return p;
  };
  const hall=add('Convocation Hall',1900,3340,'hall',-.08);
  add('Great Library',2850,3370,'library',.12);
  add('Founders House',-210,2180,'hall',-.16);
  add('School of Architecture',3180,1900,'institute',.19);
  add('Aviation Academy',450,3340,'faculty',-.12);
  add('Student Union',2600,3350,'hall',.10);
  const names=['Engineering','Humanities','Life Sciences','Mathematics','Economics','Agriculture','Materials','Fine Arts','Law','Medicine','Business','Earth Sciences','Languages','Computing'];
  const kinds=['faculty','institute','residence','pavilion','faculty','residence','hall'];
  // Irregular gaps, depth and orientation; seeded so buildings stay put across visits.
  const stations=pathSamples(loop,44).filter(q=>q.z>1620);let serial=0;
  // The loop is the estate edge: sample only its inward side, in the entrance half.
  for(let pass=0;pass<7&&precincts.length<64;pass++)for(let i=0;i<stations.length&&precincts.length<64;i++){
    if(random()<.15)continue;const q=stations[i];
    const side=pointInPolygon(q.x+q.nx*35,q.z+q.nz*35,plan.boundary)?1:-1;
    const offset=90+random()*230,x=q.x+q.nx*side*offset+(random()-.5)*24,z=q.z+q.nz*side*offset+(random()-.5)*24;
    const kind=kinds[Math.floor(random()*kinds.length)],label=kind==='residence'?`Residence ${1+serial%19}`:kind==='pavilion'?`Garden Pavilion ${1+serial%12}`:`${names[serial%names.length]} ${kind==='institute'?'Institute':kind==='hall'?'Hall':'Building'}`;
    if(add(label,x,z,kind,(random()-.5)*.32))serial++;
  }
  if(!hall||precincts.length<35)throw new Error(`Campus planning failed: ${precincts.length} buildings`);
  // Start outside, on the hall approach. Preserve the aircraft and original village entry.
  const a=hall.road.points[0],b=hall.road.points[1];plan.spawn={x:a.x+(b.x-a.x)*.66,z:a.z+(b.z-a.z)*.66,yaw:Math.atan2(a.x-b.x,-(a.z-b.z))};
  return plan;
}
// A positive margin keeps canopies, roofs and courts clear of the perimeter carriageway.
export function insideCampus(plan,x,z,margin=0){return pointInPolygon(x,z,plan.boundary)&&(margin<=0||projectPath(plan.roads[0],x,z).dist>margin);}
export function inAirfield(plan,x,z,margin=0){return [plan.airfield,plan.approach].some(r=>inBox(r,x,z,margin));}
export function nearestCampusRoad(plan,x,z){let best=null;for(const road of plan.roads){const q=projectPath(road,x,z),dist=Math.max(0,q.dist-road.width/2);if(!best||dist<best.dist)best={road,dist,projection:q};}return best;}
export function campusPlanKey(plan){return hashStr(JSON.stringify({roads:plan.roads,buildings:plan.precincts.map(p=>({footprints:p.footprints,court:p.court}))},(k,v)=>typeof v==='number'?Math.round(v*1000)/1000:v));}
export function registerCampus(world,plan){
  world.campus=plan;const oldNearest=world.nearestRoad,oldOnRoad=world.onRoad,oldZone=world.zoneOf;
  world.nearestRoad=(x,z,filter)=>{const village=oldNearest(x,z,filter);if(filter)return village;const campus=nearestCampusRoad(plan,x,z);return campus.dist<village.dist?campus:village;};
  world.onRoad=(x,z)=>{const v=oldOnRoad(x,z);if(v||(x>=0&&x<=3000&&z>=0&&z<=3000))return v;const c=nearestCampusRoad(plan,x,z);return c.dist<.01?c.road:null;};
  world.zoneOf=(x,z)=>{if(x>=0&&z>=0&&x<=3000&&z<=3000)return oldZone(x,z);if(x>=770&&x<=1545&&z>=3090&&z<=3265)return 'GVP Airstrip';const p=plan.precincts.find(p=>Math.hypot(x-p.x,z-p.z)<80);if(p)return p.name;if(!insideCampus(plan,x,z)&&nearestCampusRoad(plan,x,z).dist>3)return 'Open countryside';return z<0?'University · North Woodland':x<0?(z<1500?'University · West Woodland':'University · West Campus'):x>3000?(z<1500?'University · East Woodland':'University · East Campus'):'University · South Campus';};
}
