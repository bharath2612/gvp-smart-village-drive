# University expansion validation

Validated locally on 25 September 2026 with desktop headless Chrome, 1440 × 900, Medium quality. These are machine-specific observations, not a guarantee on other hardware.

## Repeatable layout checks

Run `node tools/test-campus.mjs`:
- 18 quadrangle entrances connect to the closed campus loop.
- Buildings remain outside the measured village and runway approach reservation.
- New roads do not enter the fenced airfield.
- Spawn, negative-coordinate road queries, reset positions and headings work around the loop.
- Existing village zone lookup and plot-road filtering are preserved.

## Browser checks performed

- Clean startup; no uncaught browser errors. Measured plot counts unchanged.
- Upward-facing campus road mesh normals.
- 12,524 vehicle-envelope samples across roads (centre and both loop lanes): zero static collider obstructions.
- Complete ~15.2 km lap using actual car simulation and steering: zero collisions or stuck resets.
- Actual 157 m drives into all 18 quadrangles: zero collisions.
- Drive through the village gate in both directions and through the airstrip gate.
- Flight-to-car return over the west campus returns to the road below rather than the airstrip.
- Existing runway takeoff: plane reached 60 m altitude, passed the east runway end, no collision.
- Boat board/return, settings open/close, minimap click and full-map fast travel to the north campus.
- Reset hotkey stays on the exterior road. Full map renders negative coordinates and the preserved airstrip.
- Visual checks: arrival, library forecourt, loop corner, day/sunset/night lighting and southern airstrip overview.

## Rendering observations

In a controlled render-view check (120 frames per view; first 30 discarded), ground views had a median frame interval of ~16.7 ms and 95th-percentile interval of ~18.1–18.3 ms. A broad aerial view was ~21 ms median / 22.8 ms p95. This is a render check, not a full cross-device gameplay benchmark.

Reducing submissions beyond the fog cut the library-facing day view from 2,391 to 712 draw calls, and the night view from 2,626 to 270. Long visibility is retained at altitude. The campus uses no new asset downloads and adds no real-time point lights.
