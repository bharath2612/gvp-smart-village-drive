# Smart Village Drive

Browser driving game over the full 3 km × 3 km GVP Smart Village master plan at real scale. Built from the measurement-verified `layout.json` produced by the [2D plan pipeline](https://github.com/bharath2612/gvp-smart-village-plan).

**Play:** https://gvp-smart-village-drive.vercel.app

- Vite + Three.js, no framework. Fixed 120 Hz arcade car simulation, 2D collision grid, instanced procedural buildings.
- Every texture, model and sound is generated in the browser (canvas noise textures, box-built SUV, Web Audio synthesis), so the initial download is under 1 MB plus the layout data.
- `public/data/layout.json` is copied from the plan repo with `npm run copy-layout` (never edit by hand). Counts are checked at load and the game refuses to start on a mismatch.
- `public/data/plots.json` holds availability, `public/data/prices.json` the indicative price rules.

```
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

Controls: W/S throttle & brake, A/D steer, Space handbrake, Shift boost, C camera, R reset, N time of day, T teleport, M map, Tab missions, X mute, Esc pause, backtick debug + handling tuner. URL params: `?at=villa-12`, `?tod=night`, `?quality=low`.

See `DRIVE_GAME_SPEC.md` for the full specification, engineering review and test plan.
