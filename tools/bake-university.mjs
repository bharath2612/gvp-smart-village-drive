import fs from 'node:fs';
import { createCampusPlan } from '../src/world/university-plan.js';
import { compileSurfaces, surfaceArea, join, bufferRoad } from './campus-surfaces.mjs';
const plan=createCampusPlan(),t=performance.now(),surfaces=compileSurfaces(plan);
// Enclose the whole estate AND every campus road, including its footpath
// and a landscaped setback. A boundary centreline is not a wall alignment.
const estate=join([
  [plan.boundary],
  bufferRoad({points:plan.perimeter.points,width:50,loop:true}),
  ...plan.roads.filter(r=>!r.highway&&!r.highwayRamp).map(r=>bufferRoad(r,10)),
]);
if(estate.length!==1)throw new Error('Campus wall must enclose one connected estate');
const wallBoundary=estate[0][0];
const output={key:surfaces.key,tiles:surfaces.tiles,wallBoundary};
fs.mkdirSync('src/world/generated',{recursive:true});
fs.writeFileSync('src/world/generated/university-surfaces.json',JSON.stringify(output, (key, value) => typeof value === "number" ? Math.round(value * 1e5) / 1e5 : value));
console.log(`Campus: ${plan.precincts.length} independent buildings; ${plan.roads.length} roads; ${surfaces.tiles.length} pavement tiles; ${Math.round(surfaceArea(surfaces.asphalt))} m² asphalt; baked in ${((performance.now()-t)/1000).toFixed(1)}s.`);
