// Build real meshes and colliders without a GPU. Canvas text is stubbed only;
// all road, airport, wall, tree and building geometry runs unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as THREE from 'three';
import {createServer} from 'vite';
import {ColliderGrid} from '../src/world/spatial.js';
import {pathSamples,projectPath} from '../src/world/university-plan.js';
import {AIRSTRIP_OFFSET_X,AIRSTRIP_FENCE} from '../src/world/airstrip-plan.js';
import {CarModel} from '../src/car/model.js';
const paint={fillRect(){},clearRect(){},fillText(){},measureText:t=>({width:t.length*8}),createRadialGradient:()=>({addColorStop(){}})};
globalThis.document={createElement:()=>({getContext:()=>paint})};
const cacheDir=fs.mkdtempSync(join(tmpdir(),'gvp-campus-qa-'));
const server=await createServer({configFile:false,cacheDir,server:{middlewareMode:true,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
try{
 const [{buildUniversity},{buildAirstrip},{buildWall},{buildRoadBoundary},{buildRoads},{loadLayout}]=await Promise.all([
  'university','airstrip','wall','road-boundary','roads','layout'
 ].map(n=>server.ssrLoadModule(`/src/world/${n}.js`)));
 const layout=JSON.parse(fs.readFileSync('public/data/layout.json'));
 globalThis.fetch=async()=>({ok:true,json:async()=>layout});
 const ctx={scene:new THREE.Scene(),T:{},colliders:new ColliderGrid(),world:await loadLayout(),lampHeadMat:new THREE.MeshBasicMaterial(),qualityPreset:{treeDensity:1},models:{},lod:[],lightPoints:[]};
 buildRoads(ctx);buildWall(ctx);buildAirstrip(ctx);buildUniversity(ctx);
 const boundary=buildRoadBoundary(ctx),p=ctx.university;
 const main=p.roads.find(r=>r.id==='university-entrance');
 assert.equal(main.width,50);assert(main.points.every(q=>q.x===1500));assert.equal(main.points.at(-1).z,3000);
 assert.equal(p.avenues.length,2);assert.equal(p.roundabouts.length,2);
 assert(boundary.clear(p.spawn.x,p.spawn.z,p.spawn.yaw,2.3,.95),'spawn is fully drivable');
 const failures=[];let samples=0;
 const check=(x,z,yaw,name)=>{samples++;if(!boundary.clear(x,z,yaw,2.3,.95))failures.push({name,x,z});};
 for(const r of p.roads){
  for(const q of pathSamples(r,5)){
   if(r.flatEnds&&(q.at<4||Math.hypot(q.x-r.points.at(-1).x,q.z-r.points.at(-1).z)<4))continue;
   for(const side of r.width>=25?[-1,1]:[0]){
    const offset=side*r.width*.23;
    check(q.x+q.nx*offset,q.z+q.nz*offset,Math.atan2(q.dx,-q.dz)+(side>0?Math.PI:0),r.id);
   }
  }
 }
 // The full body crosses both gates in both directions, then the airport seam.
 for(const x of [1492.5,1507.5])for(let z=2970;z<=3460;z+=1)check(x,z,x<1500?0:Math.PI,'straight approach / village gate');
 for(let z=3070;z<=3155;z++)check(1500+AIRSTRIP_OFFSET_X,z,0,'airport entrance');
 for(let i=0;i<p.avenues.length;i++){
  const r=p.avenues[i],q=p.roundabouts[i],ring=p.roads.find(r=>r.id===q.id);
  assert.equal(r.width,25);assert.equal(projectPath(main,r.points[0].x,r.points[0].z).dist,0);
  assert(projectPath(ring,r.points.at(-1).x,r.points.at(-1).z).dist<1e-6,'branch joins its roundabout');
  assert(!boundary.fits(q.x,q.z,0,2.3,.95),'roundabout island is not drivable');
  for(let a=0;a<Math.PI*2;a+=.025)check(q.x+q.radius*Math.sin(a),q.z+q.radius*Math.cos(a),Math.PI/2+a,'roundabout full circle');
 }
 assert.equal(ctx.airstrip.runway.x0,800+AIRSTRIP_OFFSET_X);
 const fence=new THREE.Box3().setFromObject(ctx.scene.getObjectByName('airstrip-fence'));
 assert(Math.abs(fence.max.x-AIRSTRIP_FENCE.x1)<.1,'airport fence follows its world placement');
 assert(boundary.clear(ctx.airstrip.park.x,ctx.airstrip.park.z,ctx.airstrip.park.yaw,2.3,.95),'airport vehicle switch remains clear');
 const car=new CarModel(ctx.world,ctx.colliders,ctx);car.setRoadBoundary(true);
 const drives=[];
 for(let index=0;index<p.avenues.length;index++){
  const avenue=p.avenues[index],ring=p.roads.find(r=>r.id===p.roundabouts[index].id),stations=pathSamples(avenue,8);
  const route=[...stations.map(q=>({x:q.x-q.nx*6.25,z:q.z-q.nz*6.25})),...pathSamples({points:[...ring.points].reverse()},6),...stations.map(q=>({x:q.x+q.nx*6.25,z:q.z+q.nz*6.25})).reverse()];
  car.reset(route[0].x,route[0].z,Math.atan2(route[1].x-route[0].x,-(route[1].z-route[0].z)));car.takeEvents();
  let progress=1,impacts=0,offroad=0;
  for(let step=0;step<200000&&progress<route.length-1;step++){
   while(progress<route.length-1&&Math.hypot(car.x-route[progress].x,car.z-route[progress].z)<15)progress++;
   const target=route[progress],desired=Math.atan2(target.x-car.x,-(target.z-car.z));
   const delta=Math.atan2(Math.sin(desired-car.yaw),Math.cos(desired-car.yaw));
   car.step(1/120,{throttle:car.speed<11?1:0,brake:0,steer:Math.max(-1,Math.min(1,delta*2.7)),handbrake:false,boost:false});
   impacts+=car.takeEvents().filter(e=>e.type==='impact'||e.type==='stuckReset').length;if(car.offroad)offroad++;
  }
  drives.push({road:avenue.id,progress,total:route.length,impacts,offroad});
  assert.equal(progress,route.length-1,`${avenue.id}: completes outbound, circle and return drive`);
  assert.equal(impacts,0,`${avenue.id}: collision-free drive`);assert.equal(offroad,0,`${avenue.id}: paved grip throughout`);
 }
 console.log(JSON.stringify({samples,drives,colliders:ctx.colliders.list.length,trees:p.treeCount,failures:failures.slice(0,20)},null,2));
 assert.equal(failures.length,0,`${failures.length} obstructed driving samples`);
}finally{await server.close();fs.rmSync(cacheDir,{recursive:true,force:true});}
