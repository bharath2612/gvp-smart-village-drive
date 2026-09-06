// Copies data/layout.json from the sibling plan repo (single source of truth; never edit by hand).
import fs from 'node:fs';
import path from 'node:path';
const src = path.resolve(process.argv[2] || '../gvp/data/layout.json');
const dst = path.resolve('public/data/layout.json');
const json = JSON.parse(fs.readFileSync(src, 'utf8'));
const counts = { farms: json.farms.length, villas: json.villas.length, townhouses: json.townhouses.length, commercial: json.commercial.length, parks: json.parks.length };
console.log('copying', src, counts, 'generated', json.meta.generated);
fs.writeFileSync(dst, JSON.stringify(json));
