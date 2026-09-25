# Road-boundary collision validation — 26 September 2026

## Behaviour

Settings → Vehicle → Road-boundary collisions; off by default and persisted.
On restricts cars to paved carriageways/access surfaces. Off preserves free roam
and existing solid-object collisions. Off-road activation and every car reset
(including swap, map travel and vehicle return) recover to a fitting, clear pose.
Boat and plane models do not use the constraint.

## Completed checks

- `npm run test:road-boundary`: complete body coverage, a 10 cm island inside the
  footprint, crossing unions, 64 m tile seams, high-speed gap crossing, rotation,
  angled paving and recovery around an occupied road position.
- `tools/test-road-boundary-browser.py`: click, Enter, Space, arrow-key control,
  reload persistence, restore defaults, on/off driving comparison, off-road
  activation/reset, actual car swap and return from both boat and plane.
- 3,112 village road centre poses across every road, including both spine lanes:
  zero false barriers. Every one of 1,843 surface tiles compiled without errors.
- Paved school entrance, stadium entrance/concourse and marina parking checked.
  Stadium turf, pedestrian routes and lake water intentionally remain forbidden.
- `ROAD_BOUNDARY_QA=1 tools/test-campus-browser.py`: all 46 university building
  approaches completed; entire 15 km campus loop completed (1,890 route advances),
  zero impact events; village gate/airstrip access in both directions, runway
  takeoff, boating, map travel and settings regression passed.
- Browser page errors: zero. Production build passed.

## Performance observation

Headless Chrome on the local Mac, Medium quality, warmed straight-road simulation:
10,000 fixed steps averaged 0.00329 ms with the option off and 0.00648 ms with it on.
Off-road activation recovered in 2.8 ms. Compiling the remaining uncached tiles
in the broad coverage test took 54.8 ms total. These are local CPU observations,
not a frame-rate guarantee. No new rendering passes, draw calls or assets.

## Defects caught before release

- Float32 render coordinates produced hairline asphalt/paver gaps at eight campus
  drive junctions. Collision geometry now uses the original double-precision data;
  all 46 approaches pass.
- Clipping individual triangles before polygon unions caused a precision error on
  a north boundary-road tile. Preserve source edges, union first, clip last;
  all tiles now compile.
- Enter could both invoke the custom keyboard handler and activate a button.
  Switch activation now occurs once; native buttons retain their own actions.
