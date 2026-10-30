# Apex School circuit data spec (v7)

Project root: `B` = the repository root.
Always `cd $B` and run Python with `venv/bin/python` (numpy, scipy, tifffile, imagecodecs, pillow, pyproj are installed there).
Helpers: `tools/trackkit.py` (read its docstring first). Validator: `venv/bin/python tools/validate_track.py <id>`.
Examples of the earlier, hand-built pipeline for Spa/Monza: `tools/chain.py`, `tools/geom_build2.py`, `tools/compile_track.py`,
`tools/ortho_width.py`, `tools/track_edges.py`, `tools/lidar_wal2.py`, `tools/dtm5.py`. Finished examples: `osm/spa_track.json`, `osm/monza_track.json`.

**Do not edit** anything outside your own outputs: never touch `sim*.js`, `page2.html`, `ref.json`, `tools/*` (copy a tool into your work dir if you need to change it).
Work dir per track: `tracks/<id>/` (raw downloads, scripts, logs). Final output: `tracks/<id>.json` + `tracks/<id>_preview.png` (made by the validator).

## Output: `tracks/<id>.json`
Written with `trackkit.write_track(tid, meta, X, Y, W, z, cs, names, pit)`. Fields:

| field | meaning |
|---|---|
| id | snake_case id, exactly as assigned |
| name, short | e.g. "Circuit of the Americas", "COTA" |
| country | e.g. "United States" |
| layout | which configuration, e.g. "Grand Prix circuit (2026)"; must be the layout the series actually use(s) in 2026 |
| official | official lap length in metres for that layout (FIA / series figure) |
| frame | [lat0, lon0] of the local projection (trackkit.frame of the centreline) |
| startLL | [lat, lon] of the start/finish timing line used for station 0 |
| N, L, ds, x, y, w, z, cs, names | stations ~3 m apart in race direction, station 0 on the start/finish line. w = full tarmac width of the racing surface between the edge lines (not run-off), z = elevation (m, orthometric), cs = crossfall rise/metre toward +n where n = (-ty, tx), names = section/corner name per station or null |
| pit | `trackkit.pit_polyline(...)`: {pts, entry, exit, len}: the pit lane from where it leaves the circuit to where it rejoins, in race direction |
| corners | list of official numbered turns in race order: `{"n": 1, "name": "Turn 1" or the real name e.g. "La Source", "i": station index of the apex}` (use the official FIA/circuit turn numbering) |
| trim | {"cla": x, "cda": y}: typical downforce/drag level teams run here relative to Spa = 1.0 (Monza 0.80/0.85, Monaco/Hungary/Singapore ~1.15/1.10, Las Vegas/Baku/Jeddah ~0.85-0.9). Give a one-line reason in sources.trim |
| pitLimit | pit-lane speed limits km/h per series that races here: {"f1": 80, "wec": 60, "gt4": 50, "tcr": 60}; only series that race here; cite in sources.pitLimit |
| pitLoss | real total pit-stop time loss in seconds vs staying on track, per series that race here, where known (F1 from public analyses or computed from 2025/2026 timing: pit lane time ~ entry->exit), e.g. {"f1": 21.5}. Omit unknown |
| raceLaps | {"f1": n} scheduled F1 race laps (and "f1Sprint": n on sprint weekends) if F1 races here in 2026 |
| crossover | true only for real figure-8 layouts (Suzuka) |
| sources | {"geometry": "...", "width": "...", "elevation": "...", "camber": "...", "pit": "...", "trim": "...", "pitLimit": "..."} human-readable, with dataset names and URLs |
| quality | {"geometry": "osm"|"osm+aerial", "width": "aerial"|"published"|"osm-tag", "elevation": "lidar"|"dtm"|"global", "camber": "lidar"|"none"} |
| notes | optional free text: anything a reader should know (layout changes, chicanes not in OSM, etc.) |

## How to build one circuit
1. **Centreline from OpenStreetMap.** Overpass via `trackkit.overpass(query, cache)` (it rotates mirrors and backs off; several agents share these servers, so cache everything and never hammer). Typical query:
   `[out:json][timeout:120];way["highway"="raceway"](around:2500,LAT,LON);out geom;` then pick the ways that form the 2026 layout (exclude pit lane, alternative loops, karting, test tracks). Order them in race direction (`trackkit.chain_ways`). Check direction against a known fact (e.g. which way Turn 1 turns) and which way the cars run.
2. **Smooth & resample**: project with `to_xy` (frame = mean of points), `densify_closed`, light `taubin` (8-20 iterations; do NOT over-smooth: tight hairpins must survive), `resample(..., ds=3, start=startXY)`. Station 0 = start/finish line (find the timing line position: OSM sometimes has it; otherwise the circuit map / aerial photo).
   Length must come within **±0.8%** of the official length (validator fails beyond 1.5%). If OSM is off, investigate (missing chicane, wrong layout, centreline on one side), do not just scale.
3. **Width**: preferred = measured from aerial photos where a government orthophoto WMS/WMTS is easily usable (US: USGS NAIP / ImageServer; NL: PDOK Luchtfoto; FR: IGN Géoplateforme ORTHO; ES: PNOA; JP: GSI seamlessphoto tiles; AT: basemap.at orthofoto; UK: none free -> published; DE/IT: regional WMS where available). See `tools/ortho_width.py`/`tools/track_edges.py` for the stripe-pair approach used at Spa. If that is not practical within reasonable effort, use **published** widths (FIA/circuit facts: e.g. "12-15 m", wider main straight) mapped onto the sections, or OSM `width=` tags. Label `quality.width` honestly. Width must be realistic per section (start straight wider, chicanes narrower).
   **Claims**: before starting any circuit that is not in your fixed list, claim it with `mkdir tracks/<id>` (atomic; if it already exists, another agent has it, skip it).
4. **Elevation and camber**: get `trackkit.sample_points(X, Y, W, frame)` and sample each point, then `trackkit.profile_from_samples(Z, W, quality)`.
   Best available source per country (cite exactly which):
   - USA: USGS 3DEP 1 m via EPQS `https://epqs.nationalmap.gov/v1/json?x=LON&y=LAT&units=Meters&wkid=4326` (1 point per call; use a thread pool of ~8 with retries) -> quality lidar.
   - Canada (Montréal): NRCan HRDEM / CanElevation (WCS or STAC COGs on `https://canelevation-dem.s3.ca-central-1.amazonaws.com/`) -> lidar.
   - Netherlands: AHN4 0.5 m DTM WCS (PDOK `https://service.pdok.nl/rws/ahn/wcs/v1_0`) -> lidar.
   - UK (England): Environment Agency LiDAR composite DTM 1 m (WCS / ImageServer) -> lidar.
   - France: IGN Géoplateforme altimetry `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=..&lat=..&resource=ign_rge_alti_wld` (batch up to ~5000 points per call, pipe-separated) -> lidar (RGE ALTI 1 m).
   - Spain: CNIG/IGN MDT02 / MDT05 WCS (`https://servicios.idee.es/wcs-inspire/mdt`) -> lidar/dtm.
   - Japan: GSI elevation API `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=..&lat=..&outtype=JSON` (5 m DEM) -> dtm.
   - Austria: data.gv.at DGM 1 m (ALS) / Steiermark GIS WCS -> lidar; Italy: regional DTM (Emilia-Romagna, Lazio, Lombardy 5 m) -> dtm/lidar; Hungary: global.
   - Belgium: Wallonia (see tools/lidar_wal2.py), Flanders DHMV II WCS -> lidar. Germany: state DGM1 open data (RLP, BW, NRW) -> lidar.
   - Everywhere else (Bahrain, Saudi, Qatar, UAE, Azerbaijan, China, Singapore, Brazil, Mexico, Monaco, Australia unless an open LiDAR service works): **Copernicus GLO-30** COG tiles from `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N50_00_E005_00_DEM/Copernicus_DSM_COG_10_N50_00_E005_00_DEM.tif` (tile name = SW corner; read with tifffile; bilinear sample) -> quality global, camber none. Note it is a surface model (buildings/trees) so the robust median in profile_from_samples matters; sanity-check the profile against known facts (e.g. COTA Turn 1 climb ~40 m, Interlagos ~40 m range, Baku old town climb).
   - Do not use api.opentopodata.org (shared daily quota). Open-Meteo elevation (90 m) only as last resort.
   With LiDAR, camber comes from the edge samples (quality camber lidar). With anything coarser than ~1-2 m, camber = none (zeros).
5. **Pit lane**: OSM ways tagged `highway=raceway` + `service=pit_lane`/name "Pit Lane"/`raceway=pit_lane` (or similar) from the point it leaves the track to where it rejoins. Use `trackkit.pit_polyline`.
6. **Names**: `trackkit.names_from_ways` with named raceway ways; plus the `corners` list from official turn numbering (circuit/FIA map), apex station found by curvature peak near the right place.
7. **Validate**: `venv/bin/python tools/validate_track.py <id>` must print no FAIL. Look at `tracks/<id>_preview.png` (Read tool) and compare against your knowledge of the circuit map: shape, direction, start line, pit lane side, turn numbers. Fix until right.

## Report back
For each circuit: id, final length vs official, sources/quality, anything uncertain. Keep the report short; the data lives in the files.
