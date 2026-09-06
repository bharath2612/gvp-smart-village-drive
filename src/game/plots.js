// Nearest-plot readout, plot cards with indicative prices, availability and the express-interest mailto.
import { CONFIG } from '../config.js';
import { fmtINR } from '../util/math.js';

let prices = null, availability = {};
export async function loadPlotData() {
  try { prices = await (await fetch('/data/prices.json')).json(); } catch (_) { prices = null; }
  try { availability = await (await fetch('/data/plots.json')).json(); } catch (_) { availability = {}; }
}
export function availabilityOf(id) { return availability[id] || 'available'; }

export function describe(p, world) {
  const d = { title: '', lines: [], price: '', note: '', id: p.id };
  const area = (w, h) => { const a = w * h; return a >= 10000 ? `${(a / 10000).toFixed(2)} ha` : `${Math.round(a).toLocaleString('en-IN')} sq.m`; };
  if (p.type === 'villa') {
    const vt = p.corner ? 'D' : p.farmAdjacent ? 'C' : 'B';
    const pr = prices && prices.villa[vt];
    d.title = `Premium villa ${p.n}`;
    d.lines.push(`Plot ${p.w.toFixed(0)} × ${p.h.toFixed(0)} m · ${area(p.w, p.h)}`, `House footprint ${p.house.w.toFixed(1)} × ${p.house.h.toFixed(1)} m · faces ${faceName(p.facing)}`, `Linked farm plot ${p.n}`, `Zone: ${world.zoneOf(p.cx, p.cy)}`);
    if (pr) { d.price = `${fmtINR(pr.priceCr)} · ${pr.name}`; d.note = `${pr.builtUp} · ${pr.config} · indicative`; }
  } else if (p.type === 'townhouse') {
    const pr = prices && prices.townhouse[p.corner ? 'premium' : 'standard'];
    d.title = `Town house ${p.n}`;
    d.lines.push(`Plot ${p.w.toFixed(0)} × ${p.h.toFixed(0)} m · ${area(p.w, p.h)}`, `House footprint ${p.house.w.toFixed(1)} × ${p.house.h.toFixed(1)} m · faces ${faceName(p.facing)}`, `Zone: ${world.zoneOf(p.cx, p.cy)}`);
    if (pr) { d.price = `${fmtINR(pr.priceCr)} · ${pr.name}`; d.note = `${pr.builtUp} · ${pr.config} · indicative`; }
  } else if (p.type === 'farm') {
    d.title = `Smart farm plot ${p.n}`;
    d.lines.push(`Cell ${p.w.toFixed(1)} × ${p.h.toFixed(1)} m · ${area(p.w, p.h)}`, `Farmhouse ${p.house ? `${p.house.w.toFixed(1)} × ${p.house.h.toFixed(1)} m` : 'n/a'} · faces ${faceName(p.facing)}`, `Pool ${p.pool ? `${p.pool.w.toFixed(0)} × ${p.pool.h.toFixed(0)} m` : 'n/a'} · crop grid ${p.crop ? `${p.crop.w.toFixed(0)} × ${p.crop.h.toFixed(0)} m` : 'n/a'}`, p.linkedVilla ? `Linked premium villa ${p.n}` : 'No linked villa', `Zone: ${world.zoneOf(p.cx, p.cy)}`);
    if (prices) { d.price = prices.farm.income; d.note = 'projected annual income · indicative'; }
  } else if (p.type === 'commercial') {
    d.title = `Commercial plot ${p.n}`;
    d.lines.push(`Plot ${p.w.toFixed(0)} × ${p.h.toFixed(0)} m · ${area(p.w, p.h)}`, `${p.side === 'W' ? 'West' : 'East'} side of the central spine · faces ${faceName(p.facing)}`, 'Three-storey arcaded block, shop fronts on the service road');
    d.price = 'Price on request'; d.note = 'commercial leasing · contact sales';
  } else if (p.type === 'park') {
    d.title = `${p.id.replace('-', ' ').replace(/^p/, 'P')}`;
    d.lines.push(`${p.w.toFixed(0)} × ${p.h.toFixed(0)} m · ${p.areaHa} ha`, 'Lawn, four pavilions, pathways, dense tree cover');
  } else {
    d.title = p.name || p.kind;
    d.lines.push(`${p.w.toFixed(0)} × ${p.h.toFixed(0)} m${p.areaHa ? ` · ${p.areaHa} ha` : ''}${p.approx ? ' (approx.)' : ''}`);
    const blurb = { temple: 'Stepped tower on a plinth with lawn quadrants.', school: 'Walled campus: three-storey academic block with colonnaded corridors, two wings round an assembly plaza, multipurpose hall, basketball court and football field. Drive in through the west gate.', stadium: 'GVP Cricket Ground: oval outfield with pitch, two seating tiers, roof canopy, pavilion, sightscreens, scoreboard and six floodlight towers. Drive in through the east gate and the main tunnel.', agro: 'Processing sheds, silos and loading yard.', parking: 'Surface parking for the lake district.', 'fire-station': 'Three-bay station with a drill tower.', wtp: 'Four treatment tanks and a water tower.', lake: 'GVP Lake with the marina, three islands, the fountain and the lighthouse. Drive to the marina gate by the parking lot and press B to take a motor boat out.' };
    if (blurb[p.id]) d.lines.push(blurb[p.id]);
  }
  return d;
}
function faceName(f) { return { N: 'north (map top)', S: 'south (map bottom)', E: 'east (map right)', W: 'west (map left)' }[f] || f; }

export function mailtoFor(d, p) {
  const subject = encodeURIComponent(`Interest in ${d.title} - GVP Smart Village`);
  const body = encodeURIComponent(`Hello,\n\nI am interested in ${d.title} (${p.id}).\n${d.lines.join('\n')}\n${d.price ? `Indicative: ${d.price}\n` : ''}\nPlease contact me with details.\n\n(Sent from Smart Village Drive)`);
  return `mailto:${CONFIG.salesEmail}?subject=${subject}&body=${body}`;
}
