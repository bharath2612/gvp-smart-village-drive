# Smart Village Drive

Browser driving game over the full 3 km × 3 km GVP Smart Village master plan at real scale. Built from the measurement-verified `layout.json` produced by the [2D plan pipeline](https://github.com/bharath2612/gvp-smart-village-plan).

**Play:** https://gvp-smart-village-drive.vercel.app

- Vite + Three.js, no framework. Fixed 120 Hz arcade car simulation, 2D collision grid, instanced procedural buildings.
- Three vehicles: the SUV, a motor boat on the lake (press B at the marina gate) and a Cessna 172 style charter plane at GVP Airstrip outside the main gate (press F at the hangar, or Settings → Vehicle → Charter plane). The plane has an arcade-real flight model (lift, drag, thrust, stall, flaps, assists), four cameras including a live cockpit panel, a Sky tour mission, a soft boundary 2 km beyond the wall and a 900 m ceiling.
- Textures and sounds are generated in the browser (canvas noise textures, Web Audio synthesis). Trees, the SUV, parked cars and small props are CC0 low-poly GLBs from the Kenney Nature Kit and Car Kit (`node tools/fetch-assets.mjs`, ~1.7 MB), baked into vertex-coloured geometry and instanced. Total download stays under 3 MB.
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
