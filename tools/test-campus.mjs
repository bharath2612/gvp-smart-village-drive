import assert from 'node:assert/strict';
import fs from 'node:fs';
import clipping from 'polygon-clipping';
import {BUILDING_TYPES,createCampusPlan,campusPlanKey,campusPoint,nearestCampusRoad,pathSamples,projectPath,registerCampus,inAirfield,inBox} from '../src/world/university-plan.js';
import {roadPlacement} from '../src/world/layout.js';
import {pointInPolygon} from '../src/util/math.js';
import {surfaceArea} from './campus-surfaces.mjs';
const p=createCampusPlan(),loop=p.roads[0],data=JSON.parse(fs.readFileSync('src/world/generated/university-surfaces.json'));
assert.equal(p.precincts.length,94);
assert.equal(data.key,campusPlanKey(p));
assert.deepEqual(loop.points[0],loop.points.at(-1));
assert.equal(nearestCampusRoad(p,p.spawn.x,p.spawn.z).dist,0);
assert.deepEqual(createCampusPlan(),p,'stable seeded generation');
const sides={north:0,south:0,east:0,west:0};
for(const c of p.precincts){
  sides[c.z<0?'north':c.z>3000?'south':c.x<0?'west':'east']++;
  assert.ok(projectPath(loop,c.entry.x,c.entry.z).dist<.01,`${c.name}: connected`);
  for(const box of c.boxes){for(const [x,z]of [[box.x0,box.z0],[box.x1,box.z1],[box.x0,box.z1],[box.x1,box.z0]]){assert.ok(!inAirfield(p,x,z,10),`${c.name}: runway clearance`);assert.ok(x<0||x>3000||z<0||z>3000,`${c.name}: village protected`);}}
  for(const r of p.roads)for(const q of pathSamples(r,8))assert.ok(!BUILDING_TYPES[c.kind].blocks.some(([bx,bz,w,d])=>{const dx=q.x-c.x,dz=q.z-c.z,lx=Math.cos(c.rot)*dx-Math.sin(c.rot)*dz,lz=Math.sin(c.rot)*dx+Math.cos(c.rot)*dz;return Math.abs(lx-bx)<w/2+r.width/2+2&&Math.abs(lz-bz)<d/2+r.width/2+2;}),`${c.name}: road ${r.id} enters footprint`);
}
assert.ok(Object.values(sides).every(n=>n>=10),`four populated sides ${JSON.stringify(sides)}`);
const north=loop.points.filter(q=>q.z<0).map(q=>q.z);assert.ok(Math.max(...north)-Math.min(...north)>200,'irregular northern perimeter');
const fallback={road:{x:0,y:0,w:3000,h:25,horizontal:true},dist:1e6},world={nearestRoad:()=>fallback,onRoad:()=>null,zoneOf:()=> 'village'};registerCampus(world,p);
const has=(polys,x,z)=>polys?.some(poly=>pointInPolygon(x,z,poly[0])&&!poly.slice(1).some(h=>pointInPolygon(x,z,h)));
const tiles=new Map(data.tiles.map(t=>[`${Math.floor(t.x/400)},${Math.floor(t.z/400)}`,t]));
let roadSamples=0;
for(const r of p.roads)for(const q of pathSamples(r,7)){
  const tile=tiles.get(`${Math.floor(q.x/400)},${Math.floor(q.z/400)}`);
  assert.ok(tile&&(has(tile.asphalt,q.x,q.z)||has(tile.paving,q.x,q.z)),`${r.id}: missing pavement at ${q.x},${q.z}`);roadSamples++;
  if(r.loop){assert.equal(world.onRoad(q.x,q.z),loop);const a=roadPlacement(world,q.x,q.z);assert.ok(Math.hypot(q.x-a.x,q.z-a.y)<1e-6);const b=roadPlacement(world,q.x,q.z,a.yaw+Math.PI);assert.ok(Math.cos(b.yaw-a.yaw)<-.99);}
}
assert.equal(world.nearestRoad(-400,500,()=>true),fallback);assert.equal(world.zoneOf(1500,1500),'village');
for(const r of p.roads)for(const q of pathSamples(r,3))assert.ok(!(q.x>770&&q.x<1545&&q.z>3090&&q.z<3265),`${r.id}: airfield fence`);
let maxOverlap=0;
for(const tile of data.tiles)for(const [a,b]of [['asphalt','paving'],['asphalt','sidewalk'],['paving','sidewalk'],['curb','asphalt'],['curb','paving'],['curb','sidewalk']]){
  if(!tile[a]||!tile[b])continue;const area=surfaceArea(clipping.intersection(tile[a],tile[b]));maxOverlap=Math.max(maxOverlap,area);assert.ok(area<.002,`${a}/${b}: stacked pavement ${area}m²`);
}
console.log(JSON.stringify({buildings:p.precincts.length,sides,roads:p.roads.length,roadSamples,pavementTiles:data.tiles.length,maxOverlap},null,2));
