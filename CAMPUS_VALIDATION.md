# Road-bounded forest campus validation

Tested 25 September 2026 with desktop Chrome, 1440 × 900, Medium quality. Results are specific to this test environment.

## Layout and terrain

`npm run test:campus` verifies:
- 46 independent buildings: 19 front/south, 14 lower west, 13 lower east; none in the upper half.
- Entire rotated building footprints and forecourts lie inside the existing perimeter loop with clearance from the road.
- Arrival gate, lodge and sports lawn are inside the loop. Existing village geometry and aircraft reservations remain protected.
- Closed loop, deterministic generation, connected drives, exterior spawn, resets and reverse headings.
- 3,274 road coverage checks against the baked pavement; no missing sections. Pairwise surface overlap stays below 0.002 m² rounding tolerance per tile; largest measured residual: 0.000287 m².

Visual checks cover the actual forest/soil boundary, upper-half woodland, front-campus arrangement, library and hall, day/night lighting, junctions, aerial views and full map. The grass plane is limited to the village; the surrounding forest-floor polygon ends at the campus road. Soil continues to the distant hills.

## Browser regression checks

Run `python tools/test-campus-browser.py` with a Vite dev server running. Requires Python Playwright and Chrome or installed Playwright Chromium. Optional variables: `CHROME_BIN`, `CAMPUS_QA_URL`, `CAMPUS_QA_OUT`. Screenshots/results default to `/tmp/gvp-campus-qa`.

- 21,402 visible campus trees on Medium, including 13,823 in the rear half. Zero tree centres outside the loop; planting checks include canopy/road and immediate building clearances.
- 13,279 car-envelope samples across all roads and both loop lanes: **zero obstructions**.
- Actual simulated drives to all **46 building forecourts**: zero collision/stuck events and no offroad-grip sections on pavement.
- Full ~15.1 km loop using the actual car steering/simulation: zero impacts or stuck resets.
- Village gate both directions, airstrip access, runway takeoff to 60 m, flight-to-car return, boat enter/exit, map travel, road reset and settings open/close pass.
- Terrain/foliage shader programs compile; no uncaught JS, boot or WebGLProgram errors. Tests now fail immediately on startup failures and detect shader compilation failures, which do not raise pageerror events.

## Rendering checks

120 rendered frames per controlled view; first 30 discarded. The browser's **empty requestAnimationFrame loop also measured 33.3 ms** in this run. Render intervals therefore reflect an approximately 30 Hz scheduling ceiling in this environment, not a demonstrated 60 fps limit of the game. CPU submission timings are not GPU timings.

| View | Frame median (ms) | p95 (ms) | CPU submission median (ms) | Draw calls | Triangles |
|---|---:|---:|---:|---:|---:|
| library | 33.3 | 34.9 | 4.7 | 763 | 2,186,990 |
| library-night | 33.3 | 34.8 | 4.0 | 226 | 557,924 |
| junction | 33.3 | 35.1 | 3.4 | 113 | 359,109 |
| west-grove | 33.3 | 35.0 | 3.9 | 461 | 1,999,459 |
| overhead | 33.4 | 34.9 | 8.9 | 3334 | 5,920,042 |
| rear-forest | 33.4 | 35.1 | 4.1 | 498 | 1,490,201 |
| flight-900 | 33.3 | 35.0 | 8.7 | 3038 | 5,764,490 |
| airstrip | 33.3 | 34.9 | 5.4 | 1118 | 2,776,402 |
| village | 33.3 | 34.7 | 4.4 | 636 | 2,564,394 |

The 1,800 m overview is above the playable 900 m ceiling; the flight-900 view covers the maximum playable altitude. Trees reuse existing models and materials, with simpler species-sized stand-ins at distance. Polygon clipping remains build-time only. Safari/Firefox, sustained gameplay and other hardware have not been re-benchmarked in this revision.
