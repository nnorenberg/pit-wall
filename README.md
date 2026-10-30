# Pit Wall

A top-down racing strategy game played from the pit wall. You are the race engineer, strategist and race director: you build the grid, set up the cars, call the pit stops and compounds, manage fuel, tyres and battery, and hear each driver's debrief after every session. The drivers, from Rookie to Pro, learn their own way round each circuit.

- **33 measured circuits.** Geometry comes from OpenStreetMap and official track maps. Elevation and camber come from survey LiDAR or terrain models wherever they exist.
- **Real 2026 calendars, formats and rules** for F1, FIA WEC (Hypercar + LMGT3), GT4 European Series and TCR Europe, plus 19 road cars on factory tyres.
- **Calibrated pace.** A fully learned Pro in each class's reference car matches the real 2026 pole at every circuit that has 2026 timing. Rounds not yet raced use labelled estimates.
- **Real-world reference panel** with qualifying, race and practice results back to the start of each series' current regulations.

## Play

Nothing to install. The whole game is one file, `dist/pit-wall.html`.

1. On this repository's GitHub page, click **Code → Download ZIP**, then unzip it. Or clone it: `git clone https://github.com/nnorenberg/pit-wall.git`.
2. Open the `dist` folder and double-click `pit-wall.html`. It opens in your browser (Chrome, Edge, Firefox or Safari) and works offline.

Any changes you want to keep across sessions (your grid, championship standings) are saved in that browser.

The driver radio and debriefs use built-in rules. When the page is hosted as a claude.ai artifact, drivers can also reply in their own words through Claude ("Hear it in their own words").

## Build

You need Python 3 (standard library only) and Node.js 18+.

```bash
./build.sh            # writes dist/pit-wall.html
```

`build.sh` runs these steps in order:

| Step | What it does |
|---|---|
| `asm4.py` | assembles `sim4.js` from `sim4_*.js`, `sim3_part1.js` and the circuit, calibration and pole data |
| `mkdata.py` | writes `caldata.js` (season calendars, F1 tyre allocations) from `calendar/` and `ref/f1/_season.json` |
| `mk_page4.py` | turns the `page2.html` template into `page4.html`, adding the pit-wall UI (`page4_*.js`, `page4_sections.html`, `page4.css`) |
| inline Python | injects the sim, calendars and the reference timing from `ref.json` and `ref/*/*.json` |

The intermediate files (`sim4.js`, `page4.html`, `caldata.js`, `apex-school.html`) are generated and git-ignored.

## Where things live

| Path | Contents |
|---|---|
| `sim4_head.js` | constants, RNG, track building |
| `sim4_cars.js` | classes, cars, tyres, weather, drivers and personas, setup ranges, per-car spec and grip |
| `sim4_car.js` | the car: physics (grip, aero, ERS, fuel, tyres per axle, damage, mistakes), steering and pedals |
| `sim4_learn.js` | lap timing and how drivers learn the line |
| `sim4_world.js` | series formats and rules, sessions, qualifying, interactions (slipstream, dirty air, blue flags, contacts), pit stops, strategy, team orders |
| `sim4_debrief.js` | driver debriefs: what the driver felt vs. what the data shows, setup requests |
| `page4_pitwall.js` | pit-wall UI: radio, commands, setup sheet, driver card, debrief panel |
| `page4_season.js` | grid composer and championship mode |
| `tracks/<id>.json` | measured circuits, stations every ~3 m. See `tracks/SPEC.md` for the format. `<id>_preview.png` is a validation render |
| `ref/<series>/<id>.json` | real results per circuit. `<id>_calib.json` holds poles and per-car gaps. `_season.json` is the calendar. See `ref/SPEC.md` |
| `calendar/` | rules, tyres, grids, schedules |
| `trackcal.json`, `poles.json`, `gaps.json` | calibration outputs |
| `tools/` | circuit-building pipeline (OSM fetch, smoothing, elevation, camber, validation) |
| `osm/`, `ortho/` | intermediate circuit files used by the older Spa and Monza tools (`chain.py`, `geom_build*.py`, `lidar_wal*.py`). The aerial images themselves are not stored; `tools/ortho_width.py` downloads them again |
| `calib/` | lap-by-lap and pit-stop timing from 2026 Spa and Monza, used to check pit loss and race pace |

## Common changes

**Physics, AI or UI:** edit the source above, then run `./build.sh`.

**Re-check every weekend after a sim change.** This runs every 2026 calendar round through all its sessions at reduced distance. It flags script errors (`ERR`), broken car state (`NAN`), laps more than 3% under the real pole (`FAST`) and sessions with no debrief (`NODEBRIEF`):

```bash
./sweep.sh            # results in sweep.log; takes ~5 min on 8 cores
```

**Recalibrate a circuit** after changing its geometry, or the physics for a class:

```bash
python3 mkcal.py                  # poles.json / gaps.json from ref/*/*_calib.json
CLS=f1 ./recal.sh spa monza       # fits trackcal.json, then rebuilds
```

**Add or rebuild a circuit:** follow `tracks/SPEC.md` using `tools/trackkit.py`. The tools need the packages in `requirements.txt`:

```bash
python3 -m venv venv && venv/bin/pip install -r requirements.txt
export PITWALL_CONTACT=you@example.com     # OpenStreetMap/Overpass ask for a contact
venv/bin/python tools/validate_track.py <id>
```

**Headless smoke test of one setup:** `node t4w.js monaco f1 0.1` (circuit, class, race distance).

## Data and accuracy notes

- Each circuit's elevation and camber source is labelled in the in-game reference panel and in `tracks/<id>.json` (`quality`).
- Circuits on global 30 m elevation have no camber data: the Middle East, China, Brazil and Mexico.
- The Las Vegas elevation is smoothed over 200 m, because the raw LiDAR picked up structures. The layout is 1.2% short around the Sphere.
- Upcoming 2026 F1 rounds (Mexico, Brazil, Las Vegas, Qatar, Abu Dhabi) are calibrated to estimated poles: the 2025 pole × the median 2026/2025 ratio, or 2024 for Las Vegas because 2025 qualifying was wet. Las Vegas, Qatar and Abu Dhabi use provisional (2025) tyre allocations.
- WEC Balance of Performance and F1 race fuel loads are estimates.

## Credits

- Circuit geometry: © OpenStreetMap contributors, available under the [Open Database License](https://www.openstreetmap.org/copyright).
- Elevation: USGS 3DEP, NRCan HRDEM, AHN4, Environment Agency, IGN, ICGC, BEV, LVermGeo RLP, Regione Emilia-Romagna, GSI, IGN MDT05, TINITALY, and Copernicus GLO-30.
- Timing data from the official results of each series, with sources listed per circuit in `ref/`.
