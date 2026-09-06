// Downloads the Kenney CC0 kits and copies only the models the game uses into public/models.
// Re-run after changing the lists below. Zips are cached in build/ (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const KITS = {
  'nature-kit': { url: 'https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip', dir: 'Models/GLTF format', out: 'nature',
    files: ['tree_default', 'tree_oak', 'tree_detailed', 'tree_fat', 'tree_tall', 'tree_palmDetailedTall', 'tree_palmBend', 'tree_palm', 'plant_bushLarge', 'plant_bushDetailed', 'flower_redA', 'flower_yellowA', 'flower_purpleA', 'pot_large', 'fence_simple', 'sign', 'rock_largeA', 'rock_largeC', 'statue_column', 'log_stack'] },
  'car-kit': { url: 'https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip', dir: 'Models/GLB format', out: 'cars',
    files: ['suv', 'suv-luxury', 'sedan', 'sedan-sports', 'van', 'hatchback-sports', 'taxi', 'delivery'], extra: ['Textures/colormap.png'] }, // the GLBs reference this palette by relative uri
};
const build = path.resolve('build'); fs.mkdirSync(build, { recursive: true });
const credits = [];
for (const [name, kit] of Object.entries(KITS)) {
  const zip = path.join(build, `${name}.zip`);
  if (!fs.existsSync(zip)) { console.log('downloading', kit.url); execFileSync('curl', ['-sL', '-o', zip, kit.url], { stdio: 'inherit' }); }
  const tmp = path.join(build, `${name}-x`); fs.mkdirSync(tmp, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zip, 'License.txt', ...kit.files.map((f) => `${kit.dir}/${f}.glb`), ...(kit.extra || []).map((f) => `${kit.dir}/${f}`), '-d', tmp]);
  const outDir = path.resolve('public/models', kit.out); fs.mkdirSync(outDir, { recursive: true });
  let bytes = 0;
  for (const f of kit.files) { const src = path.join(tmp, kit.dir, `${f}.glb`); fs.copyFileSync(src, path.join(outDir, `${f}.glb`)); bytes += fs.statSync(src).size; }
  for (const f of kit.extra || []) { const src = path.join(tmp, kit.dir, f); fs.mkdirSync(path.dirname(path.join(outDir, f)), { recursive: true }); fs.copyFileSync(src, path.join(outDir, f)); bytes += fs.statSync(src).size; }
  const lic = fs.readFileSync(path.join(tmp, 'License.txt'), 'utf8').split('\n').find((l) => /CC0|Creative Commons/i.test(l)) || 'CC0';
  credits.push(`- **Kenney ${name.replace('-', ' ')}** (${kit.url}) - ${lic.trim()} - files: ${kit.files.join(', ')} (${(bytes / 1024).toFixed(0)} KB)`);
  console.log(name, kit.files.length, 'files,', (bytes / 1024).toFixed(0), 'KB ->', outDir);
}
const cred = path.resolve('CREDITS.md');
let text = fs.readFileSync(cred, 'utf8').split('\n## Downloaded CC0 models')[0].trimEnd();
text += `\n\n## Downloaded CC0 models\n\nFetched by \`node tools/fetch-assets.mjs\` from kenney.nl (Creative Commons Zero, no attribution required, credited anyway):\n\n${credits.join('\n')}\n`;
fs.writeFileSync(cred, text);
console.log('CREDITS.md updated');
