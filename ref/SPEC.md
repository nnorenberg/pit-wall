# Apex School reference + calibration data spec (v7)

Project root `B` = the repository root. Today is 2026-10-26: only sessions that have actually happened exist; never invent a result.
Existing data for Spa and Monza lives in `ref.json` (read it to copy its exact shape; do not edit it). Raw calibration examples: `calib/`.
Write only inside your own output folder `ref/<series>/` (plus a work folder `ref/<series>/raw/` for downloads and scripts). Python: `venv/bin/python` (requests available via urllib; numpy too).

## Circuit ids (use exactly these)
albert_park, shanghai, suzuka, bahrain, jeddah, miami, montreal, monaco, barcelona, red_bull_ring, silverstone, spa, hungaroring, zandvoort, monza,
madring, baku, marina_bay, cota, mexico, interlagos, las_vegas, lusail, yas_marina, imola, le_mans, fuji,
paul_ricard, misano, hockenheim, nurburgring (GP circuit), nordschleife, zolder, vallelunga, salzburgring, valencia (Ricardo Tormo), portimao, mugello, brno, slovakia_ring, most, jarama, navarra, estoril, magny_cours, assen, oschersleben, sachsenring, lausitzring, motorland (Aragón), kymiring, anderstorp, cremona, pergusa.
Anything else: snake_case of the common short name, and list it in your report.

## 1. Results: `ref/<series>/<circuit>.json`
```
{ "<classId>": { "<year>": { "classLabel": "Hypercar" (WEC only; the class name used that year, e.g. "LMP1", "LMGTE Am"),
                              "sessions": { "<key>": { "label": "FP3", "date": "2026-07-18", "weather": {"air": 21.0, "track": 35.2, "wet": false} | null,
                                                      "rows": [ { "p": 1, "no": "12", "drv": "Kimi Antonelli", "team": "Mercedes", "car": "", "cat": "", "t": "1:45.990", "gap": "", "laps": "13", "note": "", "pen": false }, ... top 10 ... ] } } } } }
```
- classId: f1 | hyper | gt3 | gt4 | tcr. Session keys: F1 `prac` (last practice before qualifying), `quali`, `race`, and on sprint weekends also `sq` (sprint qualifying) and `sprint`. WEC (hyper and gt3, per class): `prac` (last practice before qualifying), `quali` (best of qualifying/Hyperpole as the official grid order), `race`. GT4: `prac`, `q1`, `q2`, `r1`, `r2`. TCR: `prac`, `q1` (and `q2` if a separate one), `r1`, `r2` (and `r3` if any).
- Race rows: `t` = total race time for P1 and gap ("+12.345" / "+1 lap") for others, `laps`, `fl` (fastest lap of that driver), `status` ("Classified"/"DNF"/...), `pen` true if a penalty changed the result (`note` explains).
- Top 10 per class per session. Driver names "First Last" (crews joined with " / "). Weather from official timing when available.
- Years: F1 2025-2026; WEC Hypercar 2020 (as the year before; class label LMP1) through 2026; WEC GT 2023 (LMGTE Am, year before) through 2026 (LMGT3); GT4 European 2024-2026; TCR Europe 2025-2026. Only events that ran at that circuit.

## 2. Calibration: `ref/<series>/<circuit>_calib.json`
One object per classId per year (current regulations only: F1 2026, Hypercar 2026 (and 2025 if 2026 not run there yet), LMGT3 2026 (2025), GT4 2026 (2025), TCR 2026 (2025)):
```
{ "<classId>": { "year": 2026, "layout": "...", "pole": 104.361, "poleDrv": "...", "poleCar": "...",
   "qualiGaps": { "<make model>": 0.317, ... }   // best gap (s) to pole for each manufacturer/car model in that class at this event
   "raceFastest": 107.8, "raceMedianTop5": 109.9,   // median clean green-flag race lap of the top 5 finishers if lap charts are available
   "raceLaps": 44, "raceDuration": 4770.2, "winnerTime": "1:19:30.2",
   "pitLoss": 21.7, "pitLaneTime": 24.7, "stationary": 2.4,   // from lap/pit data where available
   "stintLaps": 25, "topSpeed": 345.2, "weather": {...}, "notes": "SC laps 12-15; wet start ..." } }
```
Use official timing sources: F1 Jolpica/Ergast API `https://api.jolpi.ca/ergast/f1/2026/...` (results, qualifying, laps, pitstops) + formula1.com for practice; FIA WEC Al Kamel `https://fiawec.alkamelsystems.com/` (CSV analysis files per session); GT4 European Series results PDFs `https://www.gt4europeanseries.com/results` / SRO timing; TCR Europe `https://europe.tcr-series.com/` results PDFs / `touringcars.net`.
Cite the source URLs per file in a top-level `"_sources": [...]` array.
