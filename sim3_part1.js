// ===== SIM CORE v3 (world units: metres, seconds, kilograms, joules) =====
// Track geometry is measured: OpenStreetMap centreline corrected with aerial-photo edge lines (width),
// elevation and camber from LiDAR (Spa: Wallonia 2021-22, 50 cm) or a 5 m terrain model (Monza, no camber data).
const G = 9.81, KMAX = 0.19, WB = 3.4, CAR_HALF = 1.0;
const NS = 20;               // timing sectors
const DT = 1 / 120;
const RHO = 1.2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function ahead(a, b, N) { return ((b - a) % N + N) % N; } // steps from a forward to b
function menger(ax, ay, bx, by, cx, cy) {
  const ux = bx - ax, uy = by - ay, vx = cx - bx, vy = cy - by, wx = cx - ax, wy = cy - ay;
  const den = Math.hypot(ux, uy) * Math.hypot(vx, vy) * Math.hypot(wx, wy);
  return den > 1e-9 ? 2 * (ux * vy - uy * vx) / den : 0;
}

// ----- circuits -----
// pitLane: time spent driving the speed-limited lane (entry line to exit line) with no service, from real 2026 pit-lane times
const TRACKS = [
  { id: 'spa', name: 'Spa-Francorchamps', short: 'Spa', official: 7004, trim: { cla: 1, cda: 1 }, laneTime: { f1: 22.3, wec: 31, gt: 33, tcr: 33 },
    raceLaps: { f1: 44 }, camber: 'LiDAR (Wallonia 2021-22, 50 cm)', elevation: 'LiDAR (Wallonia 2021-22, 50 cm)', width: 'aerial photos (Wallonia, spring 2026)' },
  { id: 'monza', name: 'Monza', short: 'Monza', official: 5793, trim: { cla: 0.8, cda: 0.85 }, laneTime: { f1: 24.0, wec: 32, gt: 34, tcr: 34 },
    raceLaps: { f1: 53 }, camber: 'not measured (no public survey data)', elevation: 'Lombardy 5 m terrain model', width: 'aerial photos (Lombardy AGEA 2018-19)' },
];
const NAME_MAP = { 'Double Gauche': 'Pouhon', 'Chicane': 'Bus Stop', 'Courbe Paul Frère': 'Paul Frère', "Speaker's Corner": "Speakers' Corner",
  'Variante del Rettifilo': 'Rettifilo', 'Curva Biassono': 'Curva Grande', 'Variante della Roggia': 'Roggia', 'Curva del Serraglio': 'Serraglio',
  'Curva Vialone': 'Ascari', 'Variante Ascari': 'Ascari', 'Curva Alboreto': 'Alboreto (Parabolica)', 'Rettifilo di partenza': 'Rettifilo' };

function buildTrack(td) {
  const N = td.N, x = Float64Array.from(td.x), y = Float64Array.from(td.y);
  let L = 0; for (let i = 0; i < N; i++) L += Math.hypot(x[(i + 1) % N] - x[i], y[(i + 1) % N] - y[i]);
  const ds = L / N;
  const tx = new Float64Array(N), ty = new Float64Array(N), nx = new Float64Array(N), ny = new Float64Array(N), k0 = new Float64Array(N), k = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N, dx = x[b] - x[a], dy = y[b] - y[a], l = Math.hypot(dx, dy);
    tx[i] = dx / l; ty[i] = dy / l; nx[i] = -ty[i]; ny[i] = tx[i];
    const a2 = (i - 2 + N) % N, b2 = (i + 2) % N;
    k0[i] = menger(x[a2], y[a2], x[i], y[i], x[b2], y[b2]);
  }
  for (let i = 0; i < N; i++) { let s = 0; for (let d = -2; d <= 2; d++) s += k0[(i + d + N) % N]; k[i] = s / 5; }
  // vertical profile: gradient (rise per metre) and vertical curvature (positive = compression, negative = crest)
  const z = Float64Array.from(td.z), slope = new Float64Array(N), kv = new Float64Array(N), cs = Float64Array.from(td.cs), hw = new Float64Array(N);
  for (let i = 0; i < N; i++) slope[i] = (z[(i + 1) % N] - z[(i - 1 + N) % N]) / (2 * ds);
  const sl2 = new Float64Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let d = -3; d <= 3; d++) s += slope[(i + d + N) % N]; sl2[i] = s / 7; }
  for (let i = 0; i < N; i++) kv[i] = (sl2[(i + 2) % N] - sl2[(i - 2 + N) % N]) / (4 * ds);
  for (let i = 0; i < N; i++) hw[i] = td.w[i] / 2;
  const names = td.names.slice();
  const pit = td.pit;
  let plen = 0; for (let j = 1; j < pit.pts.length; j++) plen += Math.hypot(pit.pts[j][0] - pit.pts[j - 1][0], pit.pts[j][1] - pit.pts[j - 1][1]);
  const T = { N, ds, L, x, y, tx, ty, nx, ny, k, z, slope, kv, cs, hw, names, secLen: N / NS, pit: { pts: pit.pts, entry: pit.entry, exit: pit.exit, len: plen } };
  // active-aero straight-mode zones (F1 2026): long, nearly straight stretches
  const straight = new Uint8Array(N);
  for (let i = 0; i < N; i++) { let ok = true; for (let d = -20; d <= 50 && ok; d += 2) if (Math.abs(k[(i + d + N) % N]) > 1 / 900) ok = false; straight[i] = ok ? 1 : 0; }
  T.straight = straight;
  return T;
}

// ----- tyres: per series, from each series' supplier (grip relative to the series' reference compound) -----
// life = laps to the end of the useful window at race pace on a reference circuit; the model scales with the energy put through the tyre
const TYRES = {
  f1: [{ id: 'S', name: 'Soft', col: '#e5484d', grip: 1.000, life: 17, win: [90, 115] }, { id: 'M', name: 'Medium', col: '#f1d36b', grip: 0.993, life: 27, win: [95, 120] },
       { id: 'H', name: 'Hard', col: '#e9edf2', grip: 0.986, life: 40, win: [100, 125] }, { id: 'I', name: 'Intermediate', col: '#43b97a', grip: 0.90, life: 30, win: [60, 90], wet: true }],
  wec: [{ id: 'S', name: 'Soft', col: '#e5484d', grip: 1.000, life: 22, win: [75, 105] }, { id: 'M', name: 'Medium', col: '#f1d36b', grip: 0.995, life: 30, win: [80, 110] },
        { id: 'H', name: 'Hard', col: '#e9edf2', grip: 0.990, life: 40, win: [85, 115] }, { id: 'W', name: 'Wet', col: '#3987e5', grip: 0.90, life: 35, win: [45, 80], wet: true }],
  gt3: [{ id: 'D', name: 'Dry', col: '#e9edf2', grip: 1.000, life: 34, win: [75, 105] }, { id: 'W', name: 'Wet', col: '#3987e5', grip: 0.90, life: 35, win: [45, 80], wet: true }],
  gt4: [{ id: 'D', name: 'Dry', col: '#e9edf2', grip: 1.000, life: 40, win: [70, 100] }, { id: 'W', name: 'Wet', col: '#3987e5', grip: 0.90, life: 40, win: [40, 75], wet: true }],
  tcr: [{ id: 'D', name: 'Dry', col: '#e9edf2', grip: 1.000, life: 30, win: [70, 100] }, { id: 'W', name: 'Wet', col: '#3987e5', grip: 0.90, life: 35, win: [40, 75], wet: true }],
  road: [{ id: 'D', name: 'Cup 2 R', col: '#e9edf2', grip: 1.000, life: 25, win: [60, 95] }],
};
const WEATHER = {
  sunny: { name: 'Sunny', air: 24, track: 42, wet: 0 },
  overcast: { name: 'Overcast', air: 17, track: 25, wet: 0 },
  rain: { name: 'Rain', air: 13, track: 16, wet: 1 },
};
// grip of a compound on a given surface: slicks lose about 45% in the wet, wets lose grip and overheat in the dry
function surfaceGrip(comp, wet) { return comp.wet ? (wet ? 1.0 : 0.86) : (wet ? 0.55 : 1.0); }

// ----- car classes: 2026 regulations -----
// Calibrated so the Pro in the fastest car laps near the real 2026 pole; per-car offsets come from real 2026 qualifying gaps (seconds)
// mass = minimum mass with driver (kg); fuel handled separately. ice/ers in kW. cda, cla in m². energy: 'f1' (battery and fuel),
// 'vet' (WEC virtual energy tank per stint, MJ at the wheels), 'fuel' (tank only)
const CLASSES = [
  { id: 'f1', name: 'Formula 1', note: '2026 rules: 768 kg, ~400 kW engine + 350 kW electric, active aero', tyres: 'f1', series: 'f1',
    base: { mass: 768, wb: 3.4, ice: 400, ers: 350, cda: 1.10, cla: 3.9, mu: 1.85, aMax: 13, vmax: 96, eta: 0.50, energy: 'f1', fuelQ: 10, xDrag: 0.62, xLift: 0.45 },
    cars: [['Audi', 'R26', { spa: 1.267, monza: 0.9 }], ['Racing Bulls', 'VCARB 03', { spa: 0.782, monza: 0.5 }], ['Ferrari', 'SF-26', { spa: 0.532, monza: 0.218 }],
           ['McLaren', 'MCL40', { spa: 0.440, monza: 0.18 }], ['Red Bull', 'RB22', { spa: 0.317, monza: 0.284 }], ['Mercedes', 'W17', { spa: 0, monza: 0.06 }]] },
  { id: 'hyper', name: 'Hypercar', note: '2026 WEC: ~1,030 kg minimum, ~500 kW under BoP, stint energy limit', tyres: 'wec', series: 'wec',
    base: { mass: 1060, wb: 3.15, ice: 500, ers: 0, cda: 1.05, cla: 3.4, mu: 1.80, aMax: 11, vmax: 88, eta: 0.40, energy: 'vet', stintMJ: 900, fuelQ: 20 },
    cars: [['BMW', 'M Hybrid V8', { spa: 0.664 }], ['Ferrari', '499P', { spa: 0.464 }], ['Aston Martin', 'Valkyrie', { spa: 0.36 }],
           ['Alpine', 'A424', { spa: 0.078 }], ['Cadillac', 'V-Series.R', { spa: 0.043 }], ['Peugeot', '9X8', { spa: 0 }]] },
  { id: 'gt3', name: 'LMGT3', note: '2026 WEC LMGT3: GT3 cars under BoP, stint energy limit', tyres: 'gt3', series: 'wec',
    base: { mass: 1360, wb: 2.7, ice: 390, ers: 0, cda: 1.25, cla: 2.3, mu: 1.70, aMax: 9, vmax: 76, eta: 0.33, energy: 'vet', stintMJ: 760, fuelQ: 25 },
    cars: [['Mercedes-AMG', 'LMGT3', { spa: 0.92 }], ['BMW', 'M4 LMGT3 Evo', { spa: 0.744 }], ['Ferrari', '296 LMGT3 Evo', { spa: 0.651 }],
           ['Ford', 'Mustang LMGT3', { spa: 0.212 }], ['Aston Martin', 'Vantage AMR LMGT3', { spa: 0.194 }], ['Lexus', 'RC F LMGT3', { spa: 0 }]] },
  { id: 'gt4', name: 'GT4', note: 'GT4 European Series 2026: production-based, BoP, 60-minute races with a driver-change stop', tyres: 'gt4', series: 'gt',
    base: { mass: 1450, wb: 2.65, ice: 320, ers: 0, cda: 1.20, cla: 0.8, mu: 1.58, aMax: 8, vmax: 70, eta: 0.30, energy: 'fuel', tank: 72, fuelQ: 20 },
    cars: [['Ford', 'Mustang GT4', { spa: 1.424, monza: 0.895 }], ['Toyota', 'GR Supra GT4 EVO2', { spa: 1.094, monza: 0.7 }], ['BMW', 'M4 GT4 EVO', { spa: 1.077, monza: 0.7 }],
           ['Lotus', 'Emira GT4', { spa: 0.972, monza: 0.6 }], ['Audi', 'R8 LMS GT4', { spa: 0.961, monza: 0 }], ['McLaren', 'Artura GT4', { spa: 0, monza: 0.507 }]] },
  { id: 'tcr', name: 'TCR', note: 'TCR Europe 2026: front-drive, up to 2.5 L turbo under the 2026 rules, 25-minute races', tyres: 'tcr', series: 'tcr',
    base: { mass: 1340, wb: 2.65, ice: 257, ers: 0, cda: 1.05, cla: 0.45, mu: 1.72, aMax: 7.5, vmax: 70, eta: 0.30, energy: 'fuel', tank: 60, fuelQ: 15 },
    cars: [['Hyundai', 'Elantra N TCR', { spa: 0.917, monza: 0.242 }], ['Honda', 'Civic Type R FL5 TCR', { spa: 0.1, monza: 0.142 }], ['Hyundai', 'Elantra N TCR', { spa: 0.917, monza: 0.0 }],
           ['Audi', 'RS 3 LMS TCR', { spa: 0.693, monza: 0.06 }], ['Cupra', 'Leon VZ TCR', { spa: 0.028, monza: 0.516 }], ['Honda', 'Civic Type R FL5 TCR', { spa: 0, monza: 0.142 }]] },
  { id: 'road', name: 'Road hypercars', note: 'street-legal cars on road-legal tyres, no racing series', tyres: 'road', series: 'road',
    base: null,
    cars: [['Rimac', 'Nevera', { mass: 2380, ice: 1400, cda: 0.75, cla: 0.35, mu: 1.20, aMax: 11, vmax: 92, tank: 0, eta: 0.9 }],
           ['Lamborghini', 'Revuelto', { mass: 1850, ice: 747, cda: 0.85, cla: 0.90, mu: 1.22, aMax: 9.5, vmax: 95, tank: 60, eta: 0.33 }],
           ['Porsche', '911 GT3 RS', { mass: 1530, ice: 386, cda: 1.05, cla: 2.25, mu: 1.32, aMax: 8.5, vmax: 81, tank: 50, eta: 0.32 }],
           ['Ferrari', 'SF90 XX Stradale', { mass: 1660, ice: 755, cda: 0.95, cla: 1.40, mu: 1.28, aMax: 10, vmax: 89, tank: 50, eta: 0.33 }],
           ['McLaren', 'Senna', { mass: 1380, ice: 588, cda: 1.05, cla: 2.70, mu: 1.32, aMax: 9, vmax: 92, tank: 55, eta: 0.32 }],
           ['Aston Martin', 'Valkyrie', { mass: 1440, ice: 865, cda: 1.00, cla: 3.00, mu: 1.36, aMax: 10.5, vmax: 97, tank: 60, eta: 0.33 }]] },
];
// grip/downforce scale found by matching the Pro's qualifying lap (soft tyres, low fuel, rubbered track) to the real 2026 Spa pole
const CALIB = { f1: { gripScale: 1.300, aeroScale: 1.300 }, hyper: { gripScale: 1.072, aeroScale: 1.072 }, gt3: { gripScale: 1.089, aeroScale: 1.089 },
  gt4: { gripScale: 1.123, aeroScale: 1.123 }, tcr: { gripScale: 1.151, aeroScale: 1.151 }, road: { gripScale: 1, aeroScale: 1 } };
const POLE = { f1: { spa: 104.361, monza: 81.786 }, hyper: { spa: 120.653 }, gt3: { spa: 136.612 }, gt4: { spa: 147.749, monza: 113.459 }, tcr: { spa: 146.586, monza: 113.580 } };

function deriveSpec(cls, slot, track) {
  const row = cls.cars[slot], make = row[0], model = row[1];
  const b = cls.base ? Object.assign({}, cls.base) : Object.assign({ ers: 0, energy: 'fuel', fuelQ: 10, tank: 50, wb: 2.7 }, row[2]);
  const cal = CALIB[cls.id] || { gripScale: 1, aeroScale: 1 };
  // a slower real car gets a little less grip and downforce; about 1% of grip is worth ~0.6% of lap time
  const gap = cls.base ? (row[2][track.id] ?? row[2].spa ?? 0) : 0, pole = (POLE[cls.id] || {})[track.id] || (POLE[cls.id] || {}).spa || 120;
  const pace = 1 - (gap / pole) / 0.6;
  const t = track.trim, cla = b.cla * t.cla * cal.aeroScale * pace, cda = b.cda * t.cda;
  return Object.assign({ cls: cls.id, className: cls.name, series: cls.series, tyreSet: cls.tyres, make, model, name: make + ' ' + model, gap }, b, {
    mu: b.mu * cal.gripScale * pace, cla, cda, baseCla: b.cla, baseCda: b.cda,
    cdM: 0.5 * RHO * cda, clM: 0.5 * RHO * cla,     // drag and lift per (m/s)² in newtons per kg of... divided by mass at run time
  });
}

// ----- vehicle dynamics helpers (per car, per instant) -----
// grip available (m/s²) at speed v, with load from gravity on slopes, crests/compressions and downforce
function gripAt(car, v, i, gm, aeroMul) {
  const T = car.T, sp = car.sp, m = car.mass();
  const down = sp.clM * (aeroMul ?? 1) * v * v / m;
  const normal = G * Math.cos(Math.atan(T.slope[i])) + v * v * T.kv[i] + down;
  return Math.max(0, car.muNow * gm * normal);
}
// ----- racing lines -----
function makeLine(T, o) {
  const N = T.N, px = new Float64Array(N), py = new Float64Array(N), K = new Float64Array(N), dl = new Float64Array(N);
  for (let i = 0; i < N; i++) { px[i] = T.x[i] + o[i] * T.nx[i]; py[i] = T.y[i] + o[i] * T.ny[i]; }
  for (let i = 0; i < N; i++) {
    const a = (i - 2 + N) % N, b = (i + 2) % N, c = (i + 1) % N;
    K[i] = menger(px[a], py[a], px[i], py[i], px[b], py[b]);
    dl[i] = Math.hypot(px[c] - px[i], py[c] - py[i]);
  }
  const Ks = new Float64Array(N), W = 4;
  for (let i = 0; i < N; i++) { let s = 0; for (let d = -W; d <= W; d++) s += K[(i + d + N) % N]; Ks[i] = s / (2 * W + 1); }
  return { o, px, py, K: Ks, dl };
}
// order 2 = shortest path (string pulled tight), order 4 = minimum curvature. bound(i) = how far from the centre the car may go
function optimiseLine(T, frac, iters, order, o0) {
  const N = T.N, o = o0 ? Float64Array.from(o0) : new Float64Array(N);
  const px = new Float64Array(N), py = new Float64Array(N), bd = new Float64Array(N);
  for (let i = 0; i < N; i++) { bd[i] = Math.max(0, (T.hw[i] - CAR_HALF - 0.25) * frac); px[i] = T.x[i] + o[i] * T.nx[i]; py[i] = T.y[i] + o[i] * T.ny[i]; }
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      let gx, gy;
      if (order === 2) { gx = (px[a] + px[b]) / 2; gy = (py[a] + py[b]) / 2; }
      else { const a2 = (i - 2 + N) % N, b2 = (i + 2) % N; gx = (-px[a2] + 4 * px[a] + 4 * px[b] - px[b2]) / 6; gy = (-py[a2] + 4 * py[a] + 4 * py[b] - py[b2]) / 6; }
      o[i] = clamp(o[i] + (gx - px[i]) * T.nx[i] + (gy - py[i]) * T.ny[i], -bd[i], bd[i]);
      px[i] = T.x[i] + o[i] * T.nx[i]; py[i] = T.y[i] + o[i] * T.ny[i];
    }
  }
  return o;
}
// the most a car can carry through a point of its line: tyres hold v²κ + g·camber against μ(g + v²·κv + downforce)
function vLimit(car, K, i, conf) {
  const T = car.T, sp = car.sp, m = car.mass(), mu = car.muNow * conf, k = Math.abs(K), sg = Math.sign(K) || 1;
  const lift = sp.clM / m + T.kv[i];
  const num = mu * G - G * T.cs[i] * sg, den = k - mu * lift;
  if (num <= 0) return 5;
  return den <= 1e-9 ? sp.vmax : Math.min(sp.vmax, Math.sqrt(num / den));
}
// ----- quasi-steady-state speed plan along a line -----
function planSpeed(car, line, conf, D) {
  const T = car.T, sp = car.sp, N = T.N, v = new Float64Array(N), K = line.K, m = car.mass();
  for (let i = 0; i < N; i++) v[i] = vLimit(car, K[i], i, conf[Math.floor(i / T.secLen)]);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = N - 1; i >= 0; i--) {   // braking zones, backwards from each apex; uphill helps, downhill hurts
      const j = (i + 1) % N, vn = v[j], mg = gripAt(car, vn, i, conf[Math.floor(i / T.secLen)]);
      const alat = Math.abs(vn * vn * K[i] + G * T.cs[i]);
      let along = D.trail ? Math.sqrt(Math.max(0, mg * mg - alat * alat)) : (alat < 0.25 * mg ? mg : 0.1 * mg);
      along = along * D.brakeEff + sp.cdM * vn * vn / m + G * T.slope[i];
      v[i] = Math.min(v[i], Math.sqrt(vn * vn + 2 * Math.max(0.5, along) * line.dl[i]));
    }
    for (let i = 0; i < N; i++) {        // acceleration out of corners
      const j = (i + 1) % N, vc = v[i], mg = gripAt(car, vc, i, 1);
      const alat = Math.abs(vc * vc * K[i] + G * T.cs[i]);
      const a = Math.min(car.powerAcc(vc, i, true), Math.sqrt(Math.max(0, mg * mg - alat * alat))) - car.dragAcc(vc, i) - G * T.slope[i];
      v[j] = Math.min(v[j], Math.sqrt(Math.max(0, vc * vc + 2 * a * line.dl[i])));
    }
  }
  return v;
}

// ----- drivers -----
const KNOWLEDGE = ['Racing line', 'Braking zones', 'Trail braking', 'Apex choice', 'Exit throttle', 'Smooth hands', 'Corner phases'];
const DRIVERS = [
  { name: 'Rookie', confMax: 1.0, kp: 0.6, lead: 0.12, short: 'ROK', color: '#9085e9', speedMode: 'flat', usesCaps: true, lineMode: 'centre', conf0: 1.0,
    la0: 4.5, la1: 0.13, tau: 0.17, noise: 0.0025, sConf: 0.08, sLine: 0.5, pLine: 0.2, trail: false, exitThrottle: false, brakeEff: 1, targeted: false, ersSkill: 0.2, aggression: 0.8, tyreCare: 0.6,
    knows: [], blurb: 'Floors it everywhere and only lifts once the car is already sliding. Learns each corner by crashing in it.' },
  { name: 'Novice', confMax: 1.05, kp: 0.6, lead: 0.12, short: 'NOV', color: '#d55181', speedMode: 'reactive', usesCaps: true, lineMode: 'centre', conf0: 1.15,
    la0: 5, la1: 0.16, tau: 0.13, noise: 0.002, sConf: 0.06, sLine: 0.7, pLine: 0.25, trail: false, exitThrottle: false, brakeEff: 1, targeted: false, ersSkill: 0.35, aggression: 0.6, tyreCare: 0.7,
    knows: [], blurb: 'Brakes when a corner is right in front of it, so it brakes late and hard while turning. Sticks to the middle of the road.' },
  { name: 'Amateur', confMax: 1.05, kp: 0.6, lead: 0.12, short: 'AMA', color: '#c98500', speedMode: 'scan', lineMode: 'string', conf0: 1.0,
    la0: 6, la1: 0.18, tau: 0.11, noise: 0.0025, sConf: 0.05, sLine: 0.9, pLine: 0.3, trail: false, exitThrottle: false, brakeEff: 1, targeted: false, ersSkill: 0.5, aggression: 0.7, tyreCare: 0.75,
    knows: ['Racing line'], blurb: 'Looks ahead for corners and cuts to the inside early. Its apexes come too soon, which pushes it wide on exit.' },
  { name: 'Club Racer', confMax: 1.0, kp: 0.6, lead: 0.2, short: 'CLB', color: '#199e70', speedMode: 'plan', lineMode: 'minc60', conf0: 0.92,
    la0: 6, la1: 0.22, tau: 0.075, noise: 0.0012, sConf: 0.04, sLine: 1.0, pLine: 0.35, trail: false, exitThrottle: true, brakeEff: 0.9, targeted: false, ersSkill: 0.7, aggression: 0.5, tyreCare: 0.85,
    knows: ['Racing line', 'Braking zones', 'Exit throttle'], blurb: 'Brakes in a straight line before every corner, then turns in. Uses about 60% of the track width.' },
  { name: 'Semi-Pro', confMax: 1.03, kp: 1.2, lead: 0.2, short: 'SEM', color: '#d95926', speedMode: 'plan', lineMode: 'minc', conf0: 0.88,
    la0: 6, la1: 0.26, tau: 0.055, noise: 0.0006, sConf: 0.03, sLine: 0.9, pLine: 0.4, trail: true, exitThrottle: true, brakeEff: 0.95, targeted: false, ersSkill: 0.85, aggression: 0.6, tyreCare: 0.9,
    knows: ['Racing line', 'Braking zones', 'Trail braking', 'Exit throttle', 'Smooth hands'], blurb: 'Uses the full width on a minimum-curvature arc and trail-brakes into the turn. Still a little cautious with grip.' },
  { name: 'Pro', confMax: 1.03, kp: 3.0, lead: 0.22, short: 'PRO', color: '#3987e5', speedMode: 'plan', lineMode: 'minc', conf0: 0.94,
    la0: 6, la1: 0.29, tau: 0.04, noise: 0.0002, sConf: 0.02, sLine: 0.7, pLine: 0.5, trail: true, exitThrottle: true, brakeEff: 1, targeted: true, ersSkill: 1, aggression: 0.7, tyreCare: 1,
    knows: KNOWLEDGE.slice(), blurb: 'Plans each corner as entry, mid-entry, apex, mid-exit and exit. Tests later apexes and later braking points one corner at a time.' },
];
function initialOffsets(T, mode) {
  if (mode === 'centre') return new Float64Array(T.N);
  T._lines = T._lines || {};
  if (!T._lines[mode]) {
    const frac = mode === 'string' ? 0.8 : mode === 'minc60' ? 0.6 : 1;
    const o = optimiseLine(T, frac, mode === 'string' ? 400 : 300, 2);
    T._lines[mode] = mode === 'string' ? o : optimiseLine(T, frac, 3000, 4, o);
  }
  return Float64Array.from(T._lines[mode]);
}
// ----- corners (from track geometry) -----
function findCorners(T) {
  const N = T.N, sk = new Float64Array(N), W = 14;   // ±42 m: measured geometry has small kinks that aren't corners
  for (let i = 0; i < N; i++) { let s = 0; for (let d = -W; d <= W; d++) s += T.k[(i + d + N) % N]; sk[i] = s / (2 * W + 1); }
  const th = 1 / 300, on = new Uint8Array(N);
  for (let i = 0; i < N; i++) on[i] = Math.abs(sk[i]) > th ? 1 : 0;
  let start = 0; while (on[start]) start = (start + 1) % N;
  const regions = []; let cur = null;
  for (let c = 0; c < N; c++) {
    const i = (start + c) % N;
    if (on[i]) { const sgn = Math.sign(sk[i]); if (cur && cur.sgn === sgn && c - cur.endC <= 16) cur.endC = c; else { cur = { s: i, startC: c, endC: c, sgn }; regions.push(cur); } }
  }
  return regions.filter(r => r.endC - r.startC >= 7).map(r => {
    const s = (start + r.startC) % N, e = (start + r.endC) % N;
    let peak = s, pk = 0;
    for (let c = r.startC; c <= r.endC; c++) { const i = (start + c) % N; if (Math.abs(sk[i]) > pk) { pk = Math.abs(sk[i]); peak = i; } }
    let name = null;
    for (let d = 0; d < 90 && !name; d++) name = T.names[(peak + d) % N] || T.names[(peak - d + N) % N];
    name = NAME_MAP[name] || name || '';
    return { s, e, len: r.endC - r.startC, peak, dir: r.sgn > 0 ? 'R' : 'L', minR: 1 / pk, name };
  }).sort((a, b) => a.s - b.s);
}
function cornerPoints(T, corners, line, speed) {
  const N = T.N, wrap = i => (i % N + N) % N;
  return corners.map((c, ci) => {
    let apex = c.peak, best = 0, span = c.len + 3;
    for (let d = -4; d <= span; d++) { const i = wrap(c.s + d); const a = Math.abs(line.K[i]); if (a > best) { best = a; apex = i; } }
    let ti = apex; for (let d = 1; d < 80; d++) { const i = wrap(apex - d); if (Math.abs(line.K[i]) < best * 0.3) { ti = i; break; } }
    let to = apex; for (let d = 1; d < 80; d++) { const i = wrap(apex + d); if (Math.abs(line.K[i]) < best * 0.3) { to = i; break; } }
    let bs = ti;
    if (speed) { for (let d = 1; d < 120; d++) { const i = wrap(ti - d), j = wrap(i + 1); if (speed[i] > speed[j] + 0.02) bs = i; else if (d > 3) break; } }
    return { n: ci + 1, name: c.name, bs, ti, apex, to, R: 1 / Math.max(best, 1e-6), dir: c.dir };
  });
}
function phaseAt(cp, idx, N) {
  for (const c of cp) {
    const toApex = ahead(idx, c.apex, N), fromApex = ahead(c.apex, idx, N);
    const entryLen = ahead(c.bs, c.apex, N), exitLen = ahead(c.apex, c.to, N);
    if (toApex <= 3 || fromApex <= 3) return { c, phase: 'Apex' };
    if (toApex < entryLen && toApex > 3) { const tiToApex = ahead(c.ti, c.apex, N); return { c, phase: toApex > tiToApex ? 'Entry' : 'Mid-entry' }; }
    if (fromApex <= exitLen * 0.6) return { c, phase: 'Mid-exit' };
    if (fromApex <= exitLen + 12) return { c, phase: 'Exit' };
  }
  return null;
}
