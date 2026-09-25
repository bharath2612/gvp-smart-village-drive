import fs from 'node:fs';
import { createCampusPlan } from '../src/world/university-plan.js';
import { compileSurfaces, surfaceArea } from './campus-surfaces.mjs';
const plan=createCampusPlan(),t=performance.now(),surfaces=compileSurfaces(plan);
const output={key:surfaces.key,tiles:surfaces.tiles};
fs.mkdirSync('src/world/generated',{recursive:true});
fs.writeFileSync('src/world/generated/university-surfaces.json',JSON.stringify(output, (key, value) => typeof value === "number" ? Math.round(value * 1e5) / 1e5 : value));
console.log(`Campus: ${plan.precincts.length} independent buildings; ${plan.roads.length} roads; ${surfaces.tiles.length} pavement tiles; ${Math.round(surfaceArea(surfaces.asphalt))} m² asphalt; baked in ${((performance.now()-t)/1000).toFixed(1)}s.`);
