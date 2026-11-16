# Release notes

Each version below is also a GitHub release, with the playable `dist/pit-wall.html` attached. The live page is at https://claude.ai/artifact/Fjqh1zJyLRDGWWKkc8B96N.

## v9.3 — 2026-11-16: fixed-size Car data and Corner mathematics

**Fixed**
- **Car data** and **Corner mathematics** now have a fixed height that never changes as the car drives. These two were the main cause of the snap-back at the bottom of the page, because their contents change at every corner.
  - The height is set just above their tallest measured content: 840 px on wide screens, 1010 px on medium screens, 1170 px on phones. Both tiles share it, so the pair lines up.
  - If a corner ever needs more room, the contents scroll inside the tile with its bar pinned at the top. The tile itself doesn't resize.
- On phones, the pit wall reserves room for two rows of suggestion chips, so a second row appearing mid-race doesn't push the page down.
- A half-width section next to a taller one (e.g. Experiment log beside Learning curves) no longer spreads its contents out with large gaps.

Checked in a real-time browser: during a 64× race with the view parked at the bottom of the page, the page height stayed constant and the view didn't move at 1440, 1100 or 390 px wide.

## v9.2 — 2026-11-16: page no longer bounces while scrolling

**Fixed**
- Scrolling to the bottom of the page no longer gets stuck or bounces back while a session runs. Live panels were changing height as their numbers changed, so the page kept growing and shrinking under you:
  - Race control grew and shrank by 70 px every time a full-course yellow started or ended (on narrow screens). It now keeps one height.
  - A car heading to the pits got an oversized second line ("BOX"/"PIT") in the timing tower. It now stays on the row's normal status line, and every timing row has one fixed height.
  - Corner mathematics, the car data header, the pit-wall numbers, the suggestion chips and the race-control messages changed height as their text changed. Now each grows to fit once and then holds still for the rest of the session.
- While you're near the bottom of the page, it can't shrink from live updates. Any space it gives back is held for you, so the view doesn't move. Folding or moving a section still resizes the page normally.

**For developers**
- `tools/live_check.mjs` runs a test in a real-time browser (frames actually render) through the DevTools protocol, for checks like scroll stability that a simulated clock can't reproduce.

## v9.1 — 2026-11-16: steady telemetry map

**Fixed**
- The small track map beside the telemetry traces no longer jumps or stretches as you move the cursor. The readout table under it used to resize its columns when throttle or brake went between 0 and 100, which widened the panel and the map with it.
- The readout keeps fixed columns with same-width digits, the corner label stays on one line, and the headers are shorter (Thr, Brk, Str°, Gap). Hover a header for its full meaning.

## v9 — 2026-11-16: customisable layout

**New**
- Every section below the track and timing column is now a tile you can **fold**, **resize** (Half or Full width) and **drag into any order**, with a mouse, a finger, or the arrow keys on its ⠿ handle.
- A folded section still shows a one-line summary of its key numbers, such as the selected car's tyres, fuel and who calls the strategy.
- New default order:
  1. Real-world reference
  2. Championship
  3. Grid
  4. Pit wall (radio, chat, engineer's orders)
  5. Corner by corner
  6. Telemetry
  7. Learning curves and Experiment log
  8. Car data and Corner mathematics
  9. Car setup and Driver mentality
  10. Session results
- Race control, the track and the timing column stay at the top and fold too.
- **Collapse all**, **Expand all** and **Reset layout** buttons. Your layout is remembered in your browser.
- On phones everything stacks in one column.

## v8 — 2026-11-11: design review fixes

**Fixed**
- The pit-stop panel no longer wipes a half-made call (compound, fuel, repair) every 2 seconds.
- An empty grid no longer crashes the page: "Build this grid" is disabled until there's at least one car.
- Editing a driver count no longer rebuilds the grid table, so Tab works.
- Phones:
  - The page no longer scrolls sideways, and wide tables scroll inside their own box.
  - Tapping an input box no longer zooms the page.
  - Hover highlights no longer stick after a tap.
  - The telemetry chart lets the page scroll.

**Improved**
- Grey label text is easier to read (at least 4.8:1 contrast) and no label is smaller than 10.5 px.
- At 64× and Max the animation keeps 60 fps, and a note shows the real speed when the simulation can't keep up.
- Grids are capped at 60 cars per class.
- Small touches:
  - Buttons press down when clicked.
  - Timing-tower rows slide when positions change.
  - The debrief fades in when a session ends.
  - Points flash after a round.
  - All of these respect the "reduce motion" setting.
- "1 lap" instead of "1 laps", and the header reads PIT WALL.

## v7.9 — 2026-10-30: first GitHub release

- Race-engineer strategy game on 33 measured circuits, with the real 2026 calendars, rules, tyres and timing for F1, WEC, GT4 European Series and TCR Europe, plus road cars on the Nordschleife.
- Fixes found in the full-calendar audit:
  - Out-laps no longer count as timed laps.
  - The Las Vegas elevation artefact that froze cars is gone.
  - The last five F1 rounds are calibrated to labelled estimated poles.
  - Real tyre allocations apply outside Championship mode.
  - Qualifying points are awarded in every series.
- Regression check (`sweep.sh`) covering every calendar weekend.
