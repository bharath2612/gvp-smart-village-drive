# Smart Village Drive

Browser driving game over the full 3 km × 3 km GVP Smart Village master plan at real scale. Built from the measurement-verified `layout.json` produced by the [2D plan pipeline](https://github.com/bharath2612/gvp-smart-village-plan).

**Play:** https://gvp-smart-village-drive.vercel.app

- Vite + Three.js, no framework. Fixed 120 Hz arcade car simulation, 2D collision grid, instanced procedural buildings.
- The car starts on a straight 50 m two-way approach to the village gate. Matching 25 m west/east campus roads branch from it, each ending at a landscaped roundabout (60 m centreline radius) for the return trip. The irregular woodland boundary is independent of the roads. The 31 classical campus buildings face the shorter routes; the rear half remains dense woodland. The airstrip, its aircraft, fences and gameplay locations move together 120 m west to clear the main approach, with a dedicated access road. The measured village layout is unchanged.
- Three vehicles: the SUV, a motor boat on the lake (press B at the marina gate) and a Cessna 172 style charter plane at GVP Airstrip outside the main gate (press F at the hangar, or Settings → Vehicle → Charter plane). The plane has an arcade-real flight model (lift, drag, thrust, stall, flaps, assists), four cameras including a live cockpit panel, a Sky tour mission, a soft boundary 2 km beyond the wall and a 900 m ceiling.
- Textures and sounds are generated in the browser (canvas noise textures, Web Audio synthesis). Trees, the SUV, parked cars and small props are CC0 low-poly GLBs from the Kenney Nature Kit and Car Kit (`node tools/fetch-assets.mjs`, ~1.7 MB), baked into vertex-coloured geometry and instanced. No additional model or texture packs are needed for the campus.
- Want your own SUV? Drop a GLB at `public/models/suv.glb` (wheels as nodes named `wheel-front-*` / `wheel-back-*`); the paint is recoloured to the brand colour automatically.
- `public/data/layout.json` is copied from the plan repo with `npm run copy-layout` (never edit by hand). Counts are checked at load and the game refuses to start on a mismatch.
- `public/data/plots.json` holds availability, `public/data/prices.json` the indicative price rules.

```
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

Controls: W/S throttle & brake, A/D steer, Space handbrake, Shift boost, E swap into a nearby parked car, B boat, F plane, C camera, R reset, N time of day, T teleport, M map, Tab missions, X mute, Esc pause, backtick debug + handling tuner. In the plane: W/S throttle lever, Shift full power, ↓/↑ pull up / push down (setting to flip), ←/→ bank, A/D rudder and nosewheel, Space brakes, V flaps, M waypoint. URL params: `?at=villa-12`, `?tod=night`, `?quality=low`, `?vehicle=plane`.

See `DRIVE_GAME_SPEC.md` for the full specification, engineering review and test plan.

Campus layout and pavement regression checks: `npm run test:campus`. `npm run test:campus-routes` builds the actual road, gate, airstrip, building and tree colliders, checks both lanes and both gate connections, and simulates the complete trip along each branch and around its roundabout with road-boundary collisions enabled. Roads are unioned and clipped at build time (`npm run bake-campus`, also run automatically before dev/build), so intersecting streets share one pavement boundary. Browser route, map, flight and lighting checks are documented in `CAMPUS_VALIDATION.md`.


### Road-boundary collisions

Settings → Vehicle → **Road-boundary collisions** keeps the complete car body on
carriageways and paved access areas, including campus drives/courts, the airstrip,
school/stadium access and parking. Footpaths, verges, medians, lawns, cricket turf,
water and countryside are excluded. The default is off (existing free roam), and
the preference persists. Buildings and other solid objects collide in either mode.
Turning it on off-road moves the car to clear paving. Resets, map travel and car
swaps also find a safe fit for the active car. Boat and flight physics are unchanged.

The collision map uses cached 64 m polygon unions, exact oriented footprint-area
coverage and swept movement at ≤20 cm intervals. Campus input uses the original
double-precision paving coordinates to avoid false barriers at material seams.
It adds no meshes, textures, lights or render passes. Roads/footpaths must retain
their semantic mesh names, and campus paving must remain in the baked surface data.

Validation:

```sh
npm run test:road-boundary
# With the dev server running and Python Playwright installed:
python tools/test-road-boundary-browser.py
ROAD_BOUNDARY_QA=1 python tools/test-campus-browser.py
```

The browser checks exercise mouse/keyboard switches, persistence/defaults, both
on/off driving, every village road, occupied recovery, swaps, vehicle transitions,
parking access, all cached surface tiles and CPU timings. The campus suite adds
all building drives, both campus return routes, takeoff, boating and map travel.
