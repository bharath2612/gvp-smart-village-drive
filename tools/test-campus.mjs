import assert from 'node:assert/strict';
import { createCampusPlan, campusPoint, nearestCampusRoad, pathSamples, projectPath, registerCampus, inAirfield } from '../src/world/university-plan.js';
import { roadPlacement } from '../src/world/layout.js';
const p=createCampusPlan();const loop=p.roads[0];
assert.equal(p.precincts.length,18);
assert.deepEqual(loop.points[0],loop.points.at(-1));
assert.equal(nearestCampusRoad(p,p.spawn.x,p.spawn.z).dist,0);
for(const c of p.precincts){
  assert.ok(projectPath(loop,c.entry.x,c.entry.z).dist<.01,`${c.name}: connected to loop`);
  for(const x of [-82,82])for(const z of [-65,45]){const q=campusPoint(c,x,z);assert.ok(!inAirfield(p,q.x,q.z,15),`${c.name}: outside runway approach`);assert.ok(q.x<0||q.x>3000||q.z<0||q.z>3000,`${c.name}: outside measured village`);}
}
// The navigation seam works with negative coordinates, preserves heading and leaves plot filtering alone.
const fallback={road:{x:0,y:0,w:3000,h:25,horizontal:true},dist:1e6};
const world={nearestRoad:()=>fallback,onRoad:()=>null,zoneOf:()=> 'village'};registerCampus(world,p);
for(const q of pathSamples(loop,31)){
  assert.equal(world.onRoad(q.x,q.z),loop);
  const r=roadPlacement(world,q.x,q.z);assert.ok(Math.hypot(q.x-r.x,q.z-r.y)<1e-6);
  const reverse=roadPlacement(world,q.x,q.z,r.yaw+Math.PI);assert.ok(Math.cos(reverse.yaw-r.yaw)<-.99);
}
assert.equal(world.nearestRoad(-400,500,()=>true),fallback);
assert.equal(world.zoneOf(1500,1500),'village');
assert.match(world.zoneOf(-400,1500),/University/);
// No newly generated road enters the fenced airfield; the gate-link stops exactly at its opening.
for(const r of p.roads)for(const q of pathSamples(r,3))assert.ok(!(q.x>770&&q.x<1545&&q.z>3090&&q.z<3265),`${r.id}: fenced airfield protected`);
console.log('Campus plan checks passed: 18 quadrangles, closed loop, runway separation, outside spawns and reset/heading continuity.');
