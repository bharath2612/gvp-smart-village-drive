// Build real meshes and colliders without a GPU. Canvas text is stubbed only;
// all road, airport, wall, tree and building geometry runs unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as THREE from 'three';
import {createServer} from 'vite';
import {ColliderGrid} from '../src/world/spatial.js';
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
 const {default:clipping}=await import('polygon-clipping');
 const {bufferRoad,surfaceArea}=await import('./campus-surfaces.mjs');
 const p=ctx.university,enclosure=[[p.wallBoundary]];
 let checked=0;
 for(const r of p.roads.filter(r=>!r.highway&&!r.highwayRamp)){
  const spill=surfaceArea(clipping.difference(bufferRoad(r,3.2),enclosure));
  assert(spill<.01,`${r.id}: road/footpath outside wall: ${spill}`);checked++;
 }
 const paved=p.surfaceData.tiles.flatMap(t=>[...(t.asphalt||[]),...(t.sidewalk||[]),...(t.curb||[]),...(t.paving||[])]);
 let hits=0;
 for(const s of p.wallSegments){
  const strip=bufferRoad({points:[{x:s.ax,z:s.az},{x:s.bx,z:s.bz}],width:1.2,flatEnds:true});
  for(const poly of paved){if(surfaceArea(clipping.intersection(strip,[poly]))>.001)hits++;}
 }
 assert.equal(hits,0,'wall/posts overlap pavement');
 for(const side of [-1,1])assert(p.wallSegments.some(s=>Math.abs(s.bx-(p.gate.x+side*(p.gate.width/2+6.5)))<.01&&Math.abs(s.bz-p.gate.z)<.01),'wall connects to gate pillar');
 console.log(`PASS: ${checked} campus roads with complete footpaths inside wall; ${p.wallSegments.length} wall segments clear of pavement; both gate connections`);
}finally{await server.close();fs.rmSync(cacheDir,{recursive:true,force:true});}
