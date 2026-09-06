# Smart Village Drive - Specification

**Project:** GVP Smart Village (SV-1)
**Deliverable:** browser driving game over the full 3 km x 3 km master plan
**Date:** 6 September 2026
**Status:** interview-validated, ready to build
**Repo / URL:** `gvp-smart-village-drive` -> https://gvp-smart-village-drive.vercel.app (standalone repo and Vercel project)
**Data source:** `data/layout.json` from the measurement-verified 2D pipeline (confirmed by the client on 5 Sep 2026)

---

## 1. One-paragraph summary

A free-roam driving game. The whole core village (3000 x 3000 m, real scale) is enclosed by a 20 ft (6.1 m) concrete wall. The player starts in an SUV at the east entry gate facing into the village and can drive anywhere: roads, farmland, parks. Houses, amenities and the wall are solid; the lake swallows the car and respawns it. Arcade handling at ~120 km/h with handbrake drifts and boost. Chase, hood, drone and stopped-orbit cameras. A Netflix-dark HUD with speedometer, north-up minimap from the 2D plan, compass with zone name and a nearest-plot readout. Stopping next to a plot opens a card with real dimensions, indicative pricing, availability and an express-interest button. Three missions (gate-to-lake tour, all four parks, timed boundary lap) sit on top of free roam. Realistic textured world built from CC0 textures with procedurally generated colonial-inspired contemporary buildings. Targets 60 fps on a modern laptop in a desktop browser.

---

## 2. Decisions (from the interview)

| Topic | Decision |
|---|---|
| Stack | Vite + Three.js ES modules, plain TypeScript/JS, no React. Static build deployed to Vercel |
| Physics | Custom arcade kinematic car; box/segment collisions, no physics engine |
| Driveable area | Everywhere. Buildings, pool walls, amenities and the wall are solid; hedges passable; crops flatten; lake = splash + respawn |
| Cameras | Chase (primary), hood/cockpit, drone top-down (north-up), free orbit when stopped |
| World look | Realistic textured: CC0 PBR textures (Poly Haven / ambientCG) on procedurally generated geometry; car from a CC0 GLTF |
| Buildings | Colonial-inspired facades (columns, arched verandas, symmetrical fronts, cornices) with modern contemporary massing: 2 storeys, terraces, flat roofs with parapets, large glazing. Contemporary Indian, not traditional |
| Start | East entry gate on the south boundary (drawing label "EAST ENTRY TO VILLAGE"), facing into the village |
| Wall | Solid concrete wall on the outer edge of the 25 m boundary road, exactly on the 3000 m square, closed gate at the entry. Hard stop with a bump |
| Lighting | Three presets: day / sunset / night, hotkey N and in settings. Night has headlights and street lights |
| Target hardware | Modern laptop (Apple Silicon, recent Intel/AMD iGPU), desktop Chrome first; 60 fps at 1440x900 on Medium |
| Car | One SUV, brand colour (config, default GVP blue #1E4FA3), spinning/steering wheels, brake lights, headlights |
| Lake | Animated normal-mapped water; entering it triggers splash, fade, respawn on the joggers' track |
| Input | Keyboard WASD + arrows only for v1 (gamepad/touch later) |
| Handling | Fast arcade: ~120 km/h top, boost to ~160 km/h, tight grip, handbrake drift |
| Collisions | Bump and slide with camera shake and thud; no damage; small props knock over |
| Audio | Engine, tyres, collisions, ambience, splash; on by default after Start; mute in HUD |
| HUD | Speedometer + boost meter, north-up minimap from plan-2d.svg, nearest-plot readout, compass + zone name |
| Fun layer | Plot discovery cards, 3 tour missions with checkpoints and timer, teleport to plot (T) |
| Vegetation | Moderate: instanced trees along roads, spine median, parks and lake; orchard rows in farm plots; crops as textured patches |
| Roads | Asphalt texture base, lane markings, kerbs, lamp posts on 20 m+ roads, junction signs, speed bumps and zebra crossings near school, temple, parks |
| Farm interiors | Hedges passable (rustle, slight slow-down), farmhouse and pool solid, crop rows bend |
| Onboarding | Loading bar -> title screen with slow drone orbit behind it -> Start -> swoop to the car -> controls card for 5 s |
| Plot cards | Geometry from layout.json + indicative prices from Phase 3 spec + availability from plots.json + express-interest mailto |
| Leads | `mailto:rkreddyzoomin@gmail.com` with plot number in the subject; address in config |
| Missions | 3: "Gate to lake" tour, "All four parks", "Boundary lap" time trial (best time in localStorage) |
| Settings | Quality Low/Medium/High (auto on first run), time of day, audio sliders, chase distance, invert steering, minimap mode |
| Load budget | < 15 MB before Start; 1K textures, 2K only for car and road; trees/far textures stream after Start |
| Priorities | Driving feel and world > HUD, minimap, plot cards > time of day, audio > missions > settings extras > lead capture |
| UI theme | Netflix-dark: base #0A0F1C, gold #C9A227, Playfair Display + Inter, translucent dark panels |
| Naming | Repo `gvp-smart-village-drive`, title "Smart Village Drive", this spec |

---

## 3. World model

### 3.1 Coordinates and scale
- 1 world unit = 1 metre. Layout `x` -> Three.js `X`, layout `y` (south-positive) -> Three.js `Z`. `Y` is up. Origin = NW corner of the core square.
- Sheet orientation is kept as drawn (the sheet compass shows north to the left; the game's compass labels follow the sheet so the minimap matches the 2D viewer). The HUD compass shows "map north" = top of the sheet.
- Ground is flat (the drawing has no contours). Ground plane 3000 x 3000 m plus 300 m of outside terrain beyond the wall for the horizon.

### 3.2 Elements from layout.json (all counts verified)

| Element | Count | Source fields | 3D treatment | Collision |
|---|---|---|---|---|
| Roads 25 / 20 / 15 / 10 m | 6 / 26+ / 8 / 34+ | `roads[]` (x,y,w,h,kind) | Asphalt mesh slightly above ground, markings as decal texture, kerbs 0.15 m | Kerb = small bump only |
| Central spine 30 m | 1 | `roads[kind=spine]` | Two carriageways, 8 m planted median with trees and lamp posts, service roads at edges | Median kerb + trees solid |
| Farm plots | 564 | `farms[]` cell, `pad`, `crop`, `pool`, `house`, `facing` | Soil/grass ground, hedge along cell edges, house on pad, pool, crop patch with orchard rows | House, pool wall solid; hedge passable; crops flatten |
| Premium villa plots | 560 | `villas[]` (30 x 30), `house` (20 x 15) | 2-storey villa on footprint, lawn strips, driveway, low compound wall with gate | Villa + compound wall solid; gate opening passable |
| Town houses | 504 | `townhouses[]` (20 x 15), `house` (15 x 10) | 2-storey row houses sharing side walls, small front yard | House solid |
| Commercial plots | 70 | `commercial[]` (40 x 25) | 3-storey blocks with shop fronts, signage, parking bays facing the service road | Solid |
| Parks | 4 | `parks[]` (500 x 100) | Lawn, 4 pavilions, pathways, dense trees, benches | Pavilions and trees solid |
| Lake water | 1 | `lake.points` polygon | Water shader, shoreline rim, joggers' track ring (`amenities.track`) | Trigger volume -> splash + respawn |
| Temple | 1 | `amenities.temple` (200 x 200) | Stepped tower on a plinth, lawn quadrants, cross paths | Solid |
| School | 1 | `amenities.school` | 2-storey courtyard block, playfield, boundary wall | Solid |
| Sports stadium | 1 | `amenities.stadium` | Open bowl with track, stands, floodlights | Solid stands; track driveable |
| Agro processing plant | 1 | `amenities.agro` (900 x 100) | Industrial sheds, silos, loading yard, fence | Sheds solid; yard driveable |
| Parking, fire station, water treatment | 3 | `amenities.*` | Parking bays; red-and-white fire station with roller doors; treatment tanks | Buildings solid, parking driveable |
| Boundary wall | 1 | core square | 6.1 m high, 0.4 m thick concrete panels with pilasters every 10 m, gate house at the east entry (closed) | Solid, hard stop |

### 3.3 Buildings: generation rules
- Style: colonial-inspired contemporary. Symmetrical front facade with a verandah on ground floor (round or square columns, shallow arches), terrace with parapet above, cornice band between floors, tall windows with louvred shutters, flat roof with a small stair-head box. Materials: off-white render, warm stone base, dark teak-tone doors and shutters, glass railings on terraces (modern touch).
- Villa (20 x 15 m footprint, 2 storeys, 7.2 m): verandah across the front, terrace above, pool side deck. Faces its road (use `facing` where present, otherwise the nearest road).
- Farmhouse (from `farms[].house`, ~22 x 11 m): same language, single storey plus roof terrace, pergola over the pool.
- Town house (15 x 10 m, 2 storeys): shared walls, alternating two facade variants and three colour tints so rows do not look copy-pasted.
- Commercial (40 x 25 m, 3 storeys): arcaded ground floor with shop signage, offices above.
- Variation: 3 facade templates per type, 4 tint palettes, seeded from the plot number so it is stable between loads.
- Geometry budget: each house type is one merged mesh with a shared texture atlas; all instances of a type use `InstancedMesh` with per-instance tint. Total instanced buildings ~1,700; draw calls under ~150 for the whole world.

### 3.4 Roads and street furniture
- Texture: CC0 asphalt (1K albedo/normal/roughness), tiled at 4 m; lighter concrete for the 25 m boundary roads.
- Markings: dashed centre line on 15 m+, edge lines on all, stop lines at junctions, zebra crossings within 60 m of school, temple, parks.
- Kerbs on all roads (0.15 m, drive-over bump). Speed bumps (0.1 m, 3 m long) near school, temple and parks: jolt + audio.
- Lamp posts every 40 m on 20 m, 25 m and spine roads, both sides; emissive at night.
- Junction signs: road width label as drawn ("20m WIDE ROAD") plus plot number range of the adjacent block.

### 3.5 Vegetation
- Instanced trees: 3 species (broadleaf, palm, flowering), 2 LODs + billboard beyond 400 m. Placement: road verges (every 12 m on 20 m+ roads), spine median, parks (dense), lake ring, temple lawns, 6 to 10 per farm plot along hedges.
- Farm crop grid (`farms[].crop`): textured soil with orchard rows as instanced low shrubs; bending on drive-over via a per-instance "flatten" attribute that recovers over 10 s.
- Hedges: instanced hedge segments along farm cell edges; passable with a rustle sound, 15 % speed loss while inside.
- Target: 20k to 30k instances, frustum-culled by block (the grid of blocks from the road network is the culling unit).

### 3.6 Lighting presets
| Preset | Sun | Sky | Fog | Extras |
|---|---|---|---|---|
| Day | High, warm white, shadows | Clear blue, sun disc | Light, 1.5 km | Default |
| Sunset | Low, orange, long shadows | Gradient | Warm haze, 1 km | Lamp posts start glowing |
| Night | Moon, dim blue | Stars | Dark, 600 m | Headlights, lamp posts, lit windows (emissive atlas), brake lights |
- Shadows: cascaded shadow map (2 cascades) on Medium/High, 60 m radius on Low.

---

## 4. Car and handling

### 4.1 Model
- CC0 SUV GLTF (Draco-compressed, < 2 MB), recoloured via material override to the brand colour from `config.ts`. Separate wheel nodes for spin and steering. Brake light and headlight emissive materials. Approx 4.6 x 1.9 x 1.8 m.

### 4.2 Arcade model (fixed 120 Hz sub-steps, rendered at display rate)
| Parameter | Value |
|---|---|
| Top speed | 120 km/h (33 m/s), boost 160 km/h for 2 s, 8 s recharge |
| 0 to 100 km/h | ~5 s |
| Braking | 12 m/s^2; reverse max 30 km/h |
| Steering | Max 32 deg at standstill, scaling to 8 deg at top speed; steer rate 200 deg/s with return-to-centre |
| Grip | Lateral velocity damped 92 %/step; handbrake drops to 35 % and locks rear for drift |
| Off-road | Grass/soil 85 % of top speed, camera micro-shake, dust particles; hedges 15 % slow |
| Slopes | None (flat); speed bumps apply a vertical impulse to the visual chassis only |
- Chassis visual: pitch on accel/brake (±2 deg), roll on lateral g (±3 deg), suspension bounce on bumps.

### 4.3 Collisions
- Broad phase: uniform grid (50 m cells) of static AABBs built from layout.json at load. Narrow phase: car OBB (approximated by 4 corner points + centre) against AABBs; wall as 4 segments; lake polygon as a point-in-polygon trigger.
- Response: project the car out along the smallest penetration axis, kill the velocity component into the surface, keep 70 % of the tangential component (slide). Camera shake and thud scaled by impact speed. Never stuck: if penetration persists for 0.5 s, nudge the car backward along its heading.
- Knock-over props: signs, bins, cones and fences are kinematic props that topple with a short animation when hit above 15 km/h.

### 4.4 Respawn and reset
- R: reset to the nearest road centreline, facing along the road. Lake entry: splash particles, 0.8 s fade, respawn on the joggers' track at the closest point. Falling off the world is impossible (walled).

---

## 5. Cameras
| Mode | Key | Behaviour |
|---|---|---|
| Chase (default) | C cycles | 6 m behind, 2.4 m up at rest; pulls back to 9 m and up to 3.2 m at top speed; look-ahead 4 m; spring-damped position, faster yaw follow; FOV 60 -> 70 with speed; roll ±2 deg on turns |
| Hood | C | Fixed to bonnet, FOV 75, slight shake with speed |
| Drone | C | 180 m above the car, north-up, car centred, smooth follow; shows the plan layout while driving |
| Orbit (stopped) | Mouse drag when speed < 2 km/h | Orbit around the car, 4 to 60 m, above ground only; snaps back to chase on throttle |

---

## 6. Controls (keyboard, v1)
| Action | Keys |
|---|---|
| Throttle / brake-reverse | W / S, Up / Down |
| Steer | A / D, Left / Right |
| Handbrake | Space |
| Boost | Shift |
| Camera | C |
| Reset car | R |
| Time of day | N |
| Teleport to plot | T (opens plot search) |
| Map (full-screen minimap) | M |
| Missions | Tab |
| Mute | X |
| Pause / settings | Esc |
- Gamepad and touch are out of scope for v1 but the input layer is an abstraction (`Input.throttle`, `Input.steer` in -1..1) so they can be added without touching the car model.

---

## 7. HUD and UI (Netflix-dark)
- Fonts: Playfair Display (titles), Inter (UI). Base #0A0F1C at 70 % opacity for panels, gold #C9A227 accents, off-white #F5F5F5 text, cyan #4ECDC4 for town houses, gold for villas, green #2D5A3D for farms, purple #8B5CF6 for commercial (from the website spec palette).
- Bottom right: speedometer arc (km/h), boost bar, gear indicator (D/R), handbrake icon.
- Bottom left: north-up minimap (256 px, expandable to full screen with M) rendered from `plan-2d.svg` simplified (roads, blocks, lake, amenities), car as a rotating gold arrow, mission checkpoints as pulsing dots, availability colours when the availability layer is on.
- Top centre: compass strip with heading and current zone name. Zones: West farms, Centre-west villas, Town houses west/east, Commercial spine, Centre-east villas, East farms, North farms, South farms, Lake district, Parks.
- Top left: nearest-plot readout, e.g. "Premium villa 12 · 30 x 30 m · linked farm 12" or "Farm plot 245 · 1 ha · house faces north". Updated every 0.25 s from the spatial grid within 25 m of the car.
- Top right: time-of-day icon, mute, mission timer when active.
- Controls card: shown for 5 s after Start and on Esc.

### 7.1 Plot cards
- Trigger: speed < 3 km/h for 1 s within 20 m of a plot (villa, town house, farm, commercial) or amenity. Slides in from the right (380 px), closes on throttle or Esc.
- Content: title and number; type; size (m and sq.m or ha); house footprint; orientation; linked farm (villas) or linked villa (farms); zone; indicative price and configuration from the Phase 3 spec tables (villa Type A-E by location rule: lake perimeter -> Lakeside ₹12 Cr, corner plots -> Corner ₹11 Cr, next to farms -> Farm-adjacent ₹10.5 Cr, otherwise Garden ₹10 Cr; town house ₹2.3 Cr standard / ₹2.7 Cr premium; farm income ₹25-30 L/yr), marked "indicative"; availability (Available / Reserved / Sold) from `public/data/plots.json` (all Available at launch); "Express interest" button -> `mailto:rkreddyzoomin@gmail.com?subject=Interest in <type> <number>&body=...` with the plot facts prefilled.
- Amenity cards: name, measured area, one-line description.

### 7.2 Screens
- Loading: progress bar with asset count, GVP title. Under 15 MB before Start.
- Title: slow drone orbit of the village behind the title "Smart Village Drive", Start button, "Missions" and "Settings" links, credits line for CC0 assets.
- Start transition: 2.5 s camera swoop from the orbit to the chase position behind the car at the gate; audio starts here.
- Pause (Esc): resume, missions, settings, controls, restart at gate.
- Mission complete: time, best time, "Drive on" / "Next mission".

---

## 8. Missions
| Mission | Route | Checkpoints | Win |
|---|---|---|---|
| Gate to lake tour | Gate -> spine north -> school and stadium -> temple -> lake ring | 6 glowing rings (12 m) | Pass all rings in order; narration cards at each |
| All four parks | Free order | 4 rings in the parks | All 4; timer shown |
| Boundary lap | Start line at the gate, clockwise around the 25 m boundary road | 8 split rings | Cross the finish; best time saved in localStorage; wrong-way warning |
- Rings render as translucent gold cylinders with a light beam, the next one shown on the minimap and with an on-screen distance arrow. Free roam is always available; Tab opens the mission list; abandoning a mission clears rings.

---

## 9. Audio
- Web Audio via Howler or a thin custom mixer. Engine: 3 loop samples cross-faded by RPM (derived from speed and throttle), pitch shift ±30 %. Tyre screech during drift, gravel loop off-road, hedge rustle, kerb/bump thud, collision thud scaled by impact, lake splash, boost whoosh, ring chime, UI clicks. Ambience: birds (day), crickets (night), wind. All CC0 (freesound CC0 / kenney.nl). Master, engine and ambience sliders; mute key X; default on after Start.

---

## 10. Settings
| Setting | Options | Default |
|---|---|---|
| Quality | Low / Medium / High | Auto: measure fps for 3 s after start; drop a level if < 45 fps |
| Time of day | Day / Sunset / Night | Day |
| Audio | Master, engine, ambience 0-100 | 80 / 70 / 60 |
| Chase distance | Near / Normal / Far | Normal |
| Invert steering | On / Off | Off |
| Minimap | North-up / Rotating | North-up |
- Quality levels: shadows (High: 2 cascades 300 m; Medium: 2 cascades 150 m; Low: 60 m single), texture size (1K/1K/512), tree density (100 / 70 / 40 %), water (normal-mapped animated / animated / flat), post-processing (High only: bloom + SMAA).
- Persisted in localStorage.

---

## 11. Assets (all CC0, listed in `CREDITS.md`)
| Asset | Source | Notes |
|---|---|---|
| Asphalt, concrete, grass, soil, dry grass, roof gravel, plaster, stone base, wood, water normals | Poly Haven / ambientCG | 1K JPG albedo + normal + roughness; 2K for asphalt only |
| SUV | Poly Haven or Kenney/Quaternius CC0 vehicle | Draco GLTF, recoloured |
| Trees (3 species, 2 LODs) | Quaternius / Kenney nature packs (CC0) | Merged into instanced meshes |
| Props: lamp post, sign, bench, cone, bin, fence | Kenney city kits (CC0) | |
| Sounds | freesound CC0, Kenney audio | |
| Fonts | Google Fonts (Playfair Display, Inter) | Self-hosted |
- Repo stays under ~60 MB total; textures resized with a script in `tools/`.

---

## 12. Architecture

```
gvp-smart-village-drive/
├── index.html
├── vite.config.ts
├── package.json            three, @types/three, vite, typescript, draco decoder copy
├── public/
│   ├── data/layout.json    copied from the plan repo (do not edit by hand)
│   ├── data/plots.json     availability: { "villa-12": "available", ... }
│   ├── data/prices.json    indicative price rules from the Phase 3 spec
│   ├── textures/ models/ audio/ fonts/
│   └── minimap.svg         simplified plan-2d.svg (roads, blocks, lake, amenities)
├── src/
│   ├── main.ts             boot, loading, screens
│   ├── config.ts           brand colour, sales email, handling numbers, quality presets
│   ├── core/               renderer, loop (fixed-step sim + render), input, audio mixer, settings store
│   ├── world/              ground, roads, wall, lake, vegetation, lighting presets
│   ├── world/buildings/    facade generator, villa / farmhouse / townhouse / commercial / amenity builders, instancing
│   ├── world/spatial.ts    uniform grid of colliders + plot lookup
│   ├── car/                arcade model, visuals (wheels, lights, particles), cameras
│   ├── game/               missions, plot cards, teleport, respawn, zones
│   ├── ui/                 HUD, minimap, screens, settings (plain DOM + CSS, no framework)
│   └── util/
├── tools/                  texture resize script, layout copy script
├── CREDITS.md
└── DRIVE_GAME_SPEC.md      this file
```
- Simulation runs at a fixed 120 Hz with an accumulator; rendering at display rate with interpolation, so handling is identical on 60 and 120 Hz screens.
- World generation is deterministic from layout.json plus a seed, done in a Web Worker for geometry, then uploaded to the GPU on the main thread with a progress callback.
- No framework in the UI: DOM overlays with CSS; state in a tiny observable store.

---

## 13. Performance budget (Medium preset, MacBook Air M-series, 1440x900)
| Metric | Target |
|---|---|
| Frame rate | 60 fps steady, no drops below 45 |
| Draw calls | < 300 |
| Triangles on screen | < 1.5 M |
| GPU memory | < 600 MB |
| Initial download | < 15 MB before Start; < 45 MB total after streaming |
| Time to title screen | < 6 s on 50 Mbps |
- Techniques: instancing for every repeated object, per-block frustum culling, 2 LODs + billboards, texture atlases per building type, fog to bound draw distance, shadow cascades limited to the car surroundings.

---

## 14. Deployment
- New public GitHub repo `gvp-smart-village-drive`, Vercel project of the same name, `vite build` output `dist/` deployed on push to `main`.
- `public/data/layout.json` is copied from `gvp-smart-village-plan` by `tools/copy-layout.mjs`; the 2D viewer stays a separate site. Cross-links: the game's Map screen links to the 2D viewer; the 2D viewer gets a "Drive it" button.

---

## 15. Build order (matches the agreed priority)
1. Project skeleton, loop, input, ground, roads with markings, wall, arcade car, chase cam, collisions. Playable.
2. Buildings (all types, instanced, colonial-contemporary facades), farm interiors, lake with splash/respawn, parks, amenities, trees.
3. HUD: speedometer, minimap, compass and zone, nearest plot; plot cards with prices, availability, mailto.
4. Time-of-day presets, street lights, headlights; audio.
5. Missions (3) and teleport.
6. Settings, quality auto-detect, hood/drone/orbit cameras, onboarding polish (title orbit, swoop, controls card).
7. Performance pass against section 13, Safari/Firefox smoke test, CREDITS.md, deploy.

---

## 16. Acceptance checklist
- [ ] Car starts at the east gate facing north, audio starts after clicking Start.
- [ ] Full boundary lap possible without leaving the road; wall stops the car with a bump everywhere on the 3000 m square.
- [ ] All 564 farms, 560 villas, 504 town houses, 70 commercial plots, 4 parks and every amenity are present at the positions in layout.json (spot-check farm 245, villa 12, town house 83, commercial 7 with teleport).
- [ ] Houses, pools, amenities block; hedges rustle; crops flatten; lake splashes and respawns on the track.
- [ ] Top speed ~120 km/h, boost to ~160, handbrake drift works, R resets, never stuck.
- [ ] Four camera modes cycle with C; orbit works when stopped.
- [ ] HUD shows speed, minimap with car arrow, compass with zone, nearest plot text.
- [ ] Stopping by a plot shows its card with correct dimensions, indicative price, availability and a working mailto.
- [ ] Day / sunset / night switch with N; lamp posts and headlights at night.
- [ ] Three missions completable; boundary lap best time persists.
- [ ] 60 fps on Medium on a MacBook Air; < 15 MB before Start.
- [ ] Deployed at gvp-smart-village-drive.vercel.app; repo public with CREDITS.md.

---

## 17. Out of scope for v1 (noted for later)
Gamepad and touch input, phone support, selectable cars, damage model, day/night animation, traffic and pedestrians, multiplayer, analytics, CRM lead storage, interior views of villas, terrain elevation.

---

## 18. Open items
- Brand colour for the car: defaulting to GVP blue #1E4FA3 from the logo; change in `config.ts`.
- Exact villa Type A-E assignment rules are inferred from the Phase 3 spec locations; confirm with sales before publishing prices.
- Availability data: `plots.json` starts all Available; who updates it and how (manual edit in repo for now).

---

# Appendix A - Engineering execution review (principal engineer / game architect view)

The spec is sound. Below is how a studio would actually execute it so the driving feels good on day one and the world scales to 3 km without a rewrite, plus the traps this kind of project falls into.

## A.1 Order of operations: vertical slice before content
1. **Week 1 target is a grey-box that is already fun.** Flat ground, roads as untextured planes, wall as boxes, capsule car. Tune the handling on this. If the car is not fun to drive on grey boxes, no texture will save it. Do not start buildings until three people have said the car feels good.
2. **Second milestone: the full map as blocks.** All 1,700 footprints as flat-shaded boxes from layout.json, collisions live, minimap live. This validates scale, draw distance, frame budget and the spatial grid before any art cost.
3. **Only then art:** facades, textures, trees, water, lighting presets, audio. Each art feature lands behind a quality flag so it can be dropped to Low without code changes.
4. Missions, cards and settings last; they are UI over a working world.

## A.2 Simulation architecture
- **Fixed-step sim, variable render.** 120 Hz accumulator with a hard cap of 8 sub-steps per frame (a background tab or a 200 ms hitch must not fire 24 steps and launch the car). Render interpolates between the last two sim states. Store sim state as plain numbers in one struct; never read camera or DOM inside the sim step.
- **Deterministic car model.** Same inputs, same result, regardless of frame rate. Log input + state to a ring buffer so a "the car did something weird" report can be replayed.
- **Input sampling.** Read keys into an intent struct once per render frame; the sim consumes the same intent for all sub-steps. Steering input is smoothed over ~80 ms so keyboard tapping does not look like a twitch.
- **Units.** Metres, seconds, radians everywhere internally. km/h only in the HUD formatter. Put the conversions in one file.

## A.3 Handling: the numbers that actually matter
- **Speed-sensitive steering** is the single biggest feel factor. Steering angle = lerp(32 deg, 8 deg, clamp(speed / topSpeed)). Plus a steering *rate* limit so at speed you cannot flick.
- **Lateral grip as a damping factor** (spec: 92 %/step). Tune it against a slip-angle curve: below 8 deg slip, full grip; above 25 deg, 40 % grip. Handbrake forces the rear into the slip regime. This gives believable drift entry and exit rather than an on/off skid.
- **Brake vs reverse.** S while moving forward brakes; S once stopped (< 1 km/h for 150 ms) reverses. Never let a single tap flip the car into reverse at 60 km/h.
- **Camera does half the handling.** Chase cam yaw follows velocity direction, not car heading, during drifts; the car then visibly slides across the frame. Camera lag is a spring (k ≈ 8, damping ≈ 0.9), not a lerp, or it feels like it swims.
- **Boost is a force, not a speed override.** Add acceleration and raise the cap; do not teleport speed.
- **Tuning harness.** A hidden panel (backtick key) with sliders for every handling number and an on-screen slip angle / g readout. Handling is tuned by driving, not by editing code.

## A.4 World generation and rendering
- **Everything is instanced, keyed by archetype.** Villa, farmhouse, town house, commercial, lamp post, tree LOD0/LOD1/billboard, hedge segment, crop shrub: one `InstancedMesh` each (per facade variant), transforms baked once. Tints go in a per-instance colour attribute; window emissive (night) in a second attribute. Expect ~40 instanced meshes for buildings and props, ~10 for vegetation.
- **Merge the static, unique world into a few large meshes.** Roads, kerbs, markings, wall, water rim, amenity buildings: merge by material into single geometries with a texture atlas. A 3 km road network as separate rect meshes is 100+ draw calls; merged it is 3.
- **Spatial partition = the block grid.** The road network already divides the site into ~60 blocks. Use it for culling, for the collider grid and for streaming decisions. Visibility test per block against the frustum, then per instance range for LOD.
- **Distance rules (Medium):** full geometry to 250 m, LOD1 to 600 m, billboards/impostors to fog end at 1.5 km. Buildings beyond 600 m are flat colour boxes without facade detail; nobody can tell.
- **Textures.** KTX2/Basis if the toolchain allows (halves GPU memory, faster upload); otherwise JPG albedo + PNG normal at 1K. Generate mipmaps, anisotropy 8 on the road. Use a single roughness/AO packed texture per material.
- **Shadows.** Two cascades (0-40 m, 40-150 m). Only the car, buildings and trees cast; roads, ground and crops only receive. Shadow map 2048 on Medium. Shadows are the first thing the Low preset turns down.
- **Water.** One plane with two scrolling normal maps, screen-space reflection is not worth it; use a sky-coloured fresnel. Shore foam is a texture ring, not particles.
- **Skybox and fog** hide the horizon. Fog must be tinted per time-of-day preset or night looks like grey soup.
- **Generation in a Worker.** Build geometry buffers off-thread; post transferable ArrayBuffers. The main thread only creates GPU objects while the loading bar advances. First frame after Start must not stall for 2 s.

## A.5 Collision system
- **Colliders are 2D.** The world is flat: every static collider is an axis-aligned rectangle (or oriented rectangle for the few rotated shapes) in the XZ plane. Do 2D collision; it is 10x simpler and faster than 3D.
- **Car = 5 sample points** (four corners at bumper/track width + centre). Resolve corner-by-corner against the grid cell rectangles with minimum-translation vector. Slide by removing only the normal component of velocity.
- **Corner jamming.** Two adjacent colliders (a house and its pool wall) can trap a corner. Fix by merging touching rectangles at build time and by the "nudge backward after 0.5 s of penetration" rule in the spec. Test the concave L-shapes explicitly (villa + compound wall).
- **Fast-moving car vs thin wall.** At 44 m/s and 120 Hz the car moves 0.37 m per step; the wall is 0.4 m thick. That is one step from tunnelling. Give wall colliders a 2 m depth outward and clamp per-step motion to 0.3 m (extra sub-step if exceeded).
- **Lake trigger.** Point-in-polygon on the car centre every step is cheap (9-vertex polygon). Debounce: splash only if the centre is inside for 3 consecutive steps.

## A.6 Data pipeline
- **layout.json is the single source of truth**, copied by script with its generation date. The game must fail loudly (console + on-screen) if counts differ from the expected 564/560/504/70/4 so a stale copy is caught immediately.
- **Derived data is built at load, not committed:** collider grid, block list, zone polygons, road centreline graph (for R reset and teleport placement), plot spatial index. Keep the build under 150 ms; measure it.
- **Road graph.** Build once from the road rectangles: nodes at intersections, edges along centrelines. Reset, teleport, mission routes and "nearest road" all use it. Without it those features become ad-hoc distance hacks.
- **Seeded randomness.** One PRNG seeded from plot number for facade variant, tint, tree placement. Never `Math.random()` in world generation, or screenshots and bug reports will not reproduce.

## A.7 Logical fallacies to avoid
1. **"Realistic textures make it look good."** Look comes from lighting, silhouette variety and scale cues (kerbs, lamp posts, cars parked, people-scale doors). A 1K asphalt texture on a flat 3 km plane with no fog looks worse than a flat colour with good fog and shadows. Budget time for lighting first.
2. **"The map is big so it needs streaming."** 3 km of instanced boxes fits in memory trivially. Streaming adds complexity and bugs; culling and LOD are enough here. Do not build a streaming system.
3. **"Physics engine equals better feel."** The spec chose arcade correctly. The trap is sneaking half a physics engine in later (suspension raycasts, wheel friction models). Resist: add visual-only chassis motion.
4. **"More props equals more fun."** The fun is the car. Every prop is a collider, a draw call and a potential jam. Add props only where the player slows down (gate, school, temple, lake).
5. **"It runs on my Mac."** Apple Silicon hides GPU cost. Test on a Windows laptop with Intel Iris and on Safari before calling performance done.
6. **"Real scale is fine because it is a driving game."** Real scale means 1.5 km of identical villa rows. Break monotony with landmarks visible from far (temple tower, stadium floodlights, water tower at the treatment plant, gate house) so the player can navigate without the minimap.
7. **"We will tune handling at the end."** Handling defines every camera, collision and mission decision. Tune it first and freeze it.
8. **"The 2D data is verified, so the 3D is right."** Facing, entrances and driveway positions are inferred (only 564 farms have a measured `facing`). Villas facing the wrong way is the most likely visual bug; write the facing rule explicitly and validate it with an overhead debug view.

## A.8 Edge cases to handle deliberately
- Tab hidden: pause the sim (`visibilitychange`), stop audio, resume with a 3-2-1.
- Window resize and devicePixelRatio changes (external monitor): resize renderer, cap DPR at 2 (1.5 on Low).
- WebGL context loss: show a "Reload" overlay; do not attempt to rebuild live.
- Keys stuck after alt-tab: clear the intent struct on `blur`.
- Sim step cap when returning from a long hitch (see A.2).
- Car exactly on a block boundary of the collider grid: query the 3x3 neighbourhood, not one cell.
- Reset (R) while inside a building footprint or the lake: place on the road graph, never at "last safe position" (which might be mid-collision).
- Teleport to a plot whose nearest road is on the other side of a wall or lake: route via the road graph and face the plot; verify the placement cell is free.
- Mission ring reached while reversing or while airborne on a bump: count it; do not require forward heading (except the boundary lap direction check, which uses the road graph edge direction).
- Boundary lap wrong-way: detect by travel along edge direction over 100 m, not by heading alone (drift exits trigger false positives).
- Plot card triggers with two plots within 20 m: pick the one the car is facing, tie-break by distance; never flicker between two.
- Very low frame rate (< 20 fps): auto-drop quality once, then stop; never ping-pong presets.
- localStorage disabled (private mode): settings and best times fall back to memory without errors.
- Audio autoplay blocked even after Start (some Safari builds): retry unlock on next keypress.
- Speed bumps at 160 km/h boost: clamp the vertical impulse so the camera never clips into the car.
- Night preset + Low quality: emissive windows must still render (they are cheap); do not tie them to the shadow flag.
- Draco decoder path on Vercel: copy the decoder into `public/` and reference it with an absolute path; a wrong path fails only in production.

## A.9 Tooling and observability
- Debug overlay (backtick): fps, frame time graph, draw calls, triangles, instances visible, sim steps this frame, car state (speed, slip, grounded), current block id, nearest plot id.
- Overhead debug camera with plot ids drawn, to check facings and collisions against the 2D viewer.
- `?seed=`, `?tod=night`, `?quality=low`, `?at=villa-12` URL parameters for repro and screenshots.
- Sim replay from the input ring buffer (export as JSON from the debug overlay).
- CI: `vite build` + a headless smoke test that loads the page, waits for the title screen and asserts the counts in the console. Deploy only on green.

---

# Appendix B - Experience test plan (chief experience officer view)

Purpose: catch the ways this stops being fun or trustworthy before a client sees it. Tests are written as steps with an expected result; "feel" tests have a pass bar so they are not opinions. Run the full plan on Chrome (macOS), Chrome (Windows, integrated GPU), Safari and Firefox before each release.

## B.1 First impression (the first 60 seconds)
| # | Test | Expected |
|---|---|---|
| B1.1 | Open the URL on a fresh browser, 50 Mbps | Title screen with the village orbiting behind it within 6 s; loading bar visibly progresses, never stalls > 2 s |
| B1.2 | Click Start | Camera swoops to the car in ≤ 3 s, engine idle audible, controls card visible, no frame hitch > 100 ms during the swoop |
| B1.3 | Do nothing for 10 s | Controls card fades after 5 s; the world is calm, birds audible; nothing pops or flickers |
| B1.4 | Press W for 3 s | Car moves immediately (< 50 ms input latency perceived), sound pitch rises, speedometer moves, chase cam pulls back smoothly |
| B1.5 | Read the HUD without a manual | A first-time tester can say what the four HUD elements are within 10 s |
| B1.6 | Open on a 13-inch laptop at 100 % scale | All HUD text ≥ 12 px; nothing cut off; minimap readable |

## B.2 Driving feel (pass bars, 3 testers, majority must pass)
| # | Test | Pass bar |
|---|---|---|
| B2.1 | Drive the boundary road one lap | Tester never has to slow below 60 km/h on straights to stay in control; corners taken with a single steering input |
| B2.2 | Slalom between lamp posts on the spine at 80 km/h | No oscillation; car settles within one correction |
| B2.3 | Handbrake at 80 km/h, steer | Visible rear slide, controllable exit, tyre sound, smoke; car does not spin > 180 deg without input |
| B2.4 | Boost on a straight | Perceptible push, camera FOV widens, ends predictably, meter recharges in ~8 s |
| B2.5 | Brake from 120 km/h | Stops in a believable distance (~60 m), nose dips, brake lights on; no reverse until fully stopped and S held again |
| B2.6 | Off-road across a farm | Slows noticeably, dust, gentle shake; hedge rustle on crossing; crops bend and recover |
| B2.7 | Frame rate 30 vs 120 Hz monitor | Identical top speed, braking distance and turning circle (measure with the debug overlay) |
| B2.8 | Reverse and three-point turn in a townhouse street | Reverse is controllable and steers intuitively (screen-relative expectation is not violated) |

## B.3 Collisions and boundaries
| # | Test | Expected |
|---|---|---|
| B3.1 | Hit the wall at 160 km/h boost, head-on, on all four sides and at all four corners | Hard stop, shake, thud; never through, never stuck; R not needed |
| B3.2 | Scrape along the wall at a shallow angle | Slides along without snagging; speed decays gradually |
| B3.3 | Drive into a villa, its pool wall, a temple corner, the stadium stands, a lamp post, a tree | Solid stop or slide; no clipping into geometry; camera does not enter walls |
| B3.4 | Wedge the car into the concave corner between a villa and its compound wall | Car frees itself within 0.5 s (auto nudge) or R works |
| B3.5 | Drive into the lake from each of the four shores and the notch | Splash, fade, respawn on the track facing along it; audio cross-fade; car dry and controllable |
| B3.6 | Hit a sign, cone, bin | Topples with sound; no speed loss beyond a tap; props do not re-collide after toppling |
| B3.7 | Drive over a speed bump at 30 and 120 km/h | Jolt scales with speed; camera never clips; landing has a sound |
| B3.8 | Try the gate | Closed, solid, obviously a gate (not a wall texture), sign readable |

## B.4 Navigation and orientation
| # | Test | Expected |
|---|---|---|
| B4.1 | From the gate, find the lake without the minimap | Temple tower / stadium floodlights / water are visible landmarks; reachable in < 90 s |
| B4.2 | Find villa 245 using T | Teleport places the car on a road facing the plot, card shows villa 245, minimap marker matches the 2D viewer position |
| B4.3 | Drive the spine end to end | Compass zone changes at the right places; minimap arrow rotates with heading; north-up orientation matches plan-2d.html |
| B4.4 | Press M | Full-screen map with car position, plot numbers readable at zoom, closes with M/Esc |
| B4.5 | Cycle cameras with C while moving at 100 km/h | Each transition is smooth (< 0.5 s blend); hood cam is stable; drone cam keeps the car centred |
| B4.6 | Stop and orbit with the mouse | Orbit never goes below ground or inside buildings; snaps back to chase on throttle |

## B.5 Plot discovery and sales flow
| # | Test | Expected |
|---|---|---|
| B5.1 | Stop beside villa 12, farm 12, town house 83, commercial 7, the school, the stadium | Card appears within 1 s, correct type and number, dimensions match VERIFICATION_REPORT.md, linked farm/villa correct |
| B5.2 | Stop between two plots | One card, the plot the car faces; no flicker when idling |
| B5.3 | Prices | Shown as indicative with the villa type rule visible; town house and farm income shown; formatting in ₹ Cr / L consistent |
| B5.4 | Availability | Mark villa 12 as Reserved in plots.json; card and minimap show it after reload |
| B5.5 | Express interest | Mail client opens to rkreddyzoomin@gmail.com with the plot number in the subject and facts in the body |
| B5.6 | Card while moving | Card closes on throttle; never blocks the road view; HUD stays readable behind it |

## B.6 Missions
| # | Test | Expected |
|---|---|---|
| B6.1 | Start "Gate to lake" | First ring visible from the gate, distance arrow points correctly, narration cards appear at each ring and do not obstruct driving |
| B6.2 | Skip a ring | Mission does not complete; HUD guides back to the missed ring |
| B6.3 | "All four parks" | Rings in all 4 parks, any order, timer runs, completion screen with time |
| B6.4 | "Boundary lap" | Start line at the gate; wrong-way warning when driving anticlockwise; best time saved and shown on the title screen after reload |
| B6.5 | Abandon a mission from Tab | Rings and timer removed; free roam continues without residue |
| B6.6 | Complete the lap with a boost into the lake near the finish | Respawn does not count as a lap; timer continues; mission remains completable |

## B.7 Time of day, audio, settings
| # | Test | Expected |
|---|---|---|
| B7.1 | Press N three times | Day → sunset → night → day; each transition < 1 s; night has headlights, lamp posts and lit windows; fog colour matches the sky |
| B7.2 | Night on Low quality | Lit windows and lamps still visible; frame rate ≥ 45 fps |
| B7.3 | Mute with X, then change volume sliders | Immediate effect; state survives reload |
| B7.4 | Switch quality Low → High while driving | No crash, textures swap within 3 s, no stuck black objects |
| B7.5 | Auto quality | On a 5-year-old Intel laptop the game lands on Low within 5 s of Start and stays there |
| B7.6 | Invert steering, chase distance Far, minimap rotating | Each takes effect immediately and persists |

## B.8 Robustness
| # | Test | Expected |
|---|---|---|
| B8.1 | Alt-tab for 30 s at full speed, return | Sim paused; 3-2-1 resume; car exactly where it was; no key stuck |
| B8.2 | Resize window, move to a 4K external monitor | Renderer resizes; DPR capped; fps stays within budget |
| B8.3 | Private browsing | Loads and plays; settings/best time simply not persisted; no console errors |
| B8.4 | Slow network (throttled 3G) | Title within 40 s; Start enabled only when the < 15 MB set is loaded; far textures arrive later without pops in view |
| B8.5 | Safari 17, Firefox latest | Plays; audio unlocks after Start (or first key); water and shadows render; no WebGL errors |
| B8.6 | 30 minutes continuous driving | Memory stable (± 10 %), no fps decay, no audio drift |
| B8.7 | Refresh mid-mission | Game restarts at the title; no half-state |
| B8.8 | Stale layout.json (edit a count) | On-screen error naming the mismatch; game does not start silently wrong |

## B.9 Content correctness (against the verified 2D layout)
| # | Test | Expected |
|---|---|---|
| B9.1 | Overhead debug view vs plan-2d.html at 5 spots (gate, centre, NW corner, lake, agro strip) | Every footprint overlays its 2D counterpart within 1 m |
| B9.2 | Counts in the debug overlay | 564 / 560 / 504 / 70 / 4 / 1 lake / amenities present |
| B9.3 | Facing | Farmhouses face their road as `facing` says; villas face the road adjacent to their plot; no front door onto a hedge |
| B9.4 | Road widths | Drive two cars' width on a 10 m road, kerb-to-kerb ≈ 10 m on the debug ruler; spine 30 m; boundary 25 m |
| B9.5 | Wall placement | Wall sits on the 3000 m square, outside the 25 m road, not on it |

## B.10 Release gate
Ship only when: B1 all pass; B2 majority pass on all three testers; B3, B5, B8.5 and B9 have zero failures; B2.7 and B7.5 measured; a 3-minute screen recording of a full boundary lap at 60 fps is attached to the release notes.
