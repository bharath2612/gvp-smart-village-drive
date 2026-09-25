# University redesign validation

Tested 25 September 2026 with desktop Chrome, 1440 × 900, Medium quality. These observations describe this machine; they are not a cross-device performance guarantee.

## Repeatable checks

- `npm run bake-campus`: compile road union/difference, with overlap assertions.
- `npm run test:campus`: 94 independent buildings (20 north / 27 south / 23 east / 24 west), deterministic layout, actual rotated footprint separation, closed loop, runway reservation, outside spawn, road resets and unchanged village lookups.
- 4,442 centreline coverage checks on baked pavement; all pass. Pairwise asphalt/pavers/kerb/sidewalk overlap remains below 0.002 m² per tile (rounding tolerance); largest measured residual: 0.000208 m².
- `python tools/test-campus-browser.py` against `npm run dev`. Requires the Python Playwright package and Chrome or an installed Playwright Chromium. Optional `CHROME_BIN`, `CAMPUS_QA_URL`, `CAMPUS_QA_OUT`. Defaults write results/screenshots under `/tmp/gvp-campus-qa`.

## Browser results

- No uncaught browser errors; existing measured village counts intact.
- 15,290 car-envelope samples on road centres and both loop lanes: **zero obstructions**.
- Actual car simulation into **all 94 forecourts**: zero impact/stuck events, no offroad-grip sections on the paved approaches.
- Complete approximately 15.1 km campus lap with actual steering: **zero collisions or stuck resets**.
- Village gate both directions and airstrip gate remain drivable.
- Flight-to-car return places the car on a nearby campus road. Original runway takeoff reaches 60 m, clears the runway end and does not collide.
- Boat enter/exit, minimap open, map travel to the north campus, outside road reset and settings open/close pass.
- Visual inspection: hall arrival, library day/night, asphalt-to-paver junctions, west woodland, aerial campus shape, preserved runway and full map.
- Additional trees and kerb side faces were inspected after the first visual pass. The final collision pass includes the tighter rotated building footprints.

## Rendering observations

120 rendered frames per view, first 30 discarded. This measures rendering intervals in controlled views, not a full gameplay benchmark on every supported browser.

| View | Median (ms) | p95 (ms) | Draw calls |
|---|---:|---:|---:|
| library | 16.6 | 18.1 | 738 |
| library-night | 16.6 | 18.2 | 328 |
| junction | 16.7 | 18.0 | 189 |
| west-grove | 16.7 | 18.2 | 613 |
| overhead | 24.4 | 27.2 | 3969 |
| airstrip | 16.7 | 17.8 | 1162 |
| village | 16.7 | 18.2 | 713 |

Ground views remain near 60 fps on the tested machine. The all-campus overview at 1,800 m (above the playable 900 m ceiling) costs about 24 ms per frame. No new real-time point lights, model downloads or texture packs were added. Geometry clipping runs during build, and distant detail is culled. Safari/Firefox, sustained gameplay and other hardware have not been re-benchmarked in this revision.
