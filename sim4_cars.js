// ----- tyres: per series, from each series' supplier -----
// grip is relative to the series' reference compound; life = laps to the end of the useful window at race pace on a
// reference circuit (the model scales it with the energy put through the tyre); win = working window (°C)
// F1: Pirelli's 2026 range C1 (hardest) to C5 (softest; the C6 was dropped for 2026). Each round nominates three as hard / medium / soft.
const PIRELLI = {
  C1: { grip: 0.972, life: 46, win: [105, 135] }, C2: { grip: 0.979, life: 38, win: [100, 130] }, C3: { grip: 0.986, life: 30, win: [95, 125] },
  C4: { grip: 0.993, life: 23, win: [90, 120] }, C5: { grip: 1.000, life: 16, win: [85, 115] },
};
const TYRE_COL = { S: '#e5484d', M: '#f1d36b', H: '#e9edf2', I: '#43b97a', W: '#3987e5' };
function f1Tyres(alloc) {
  const a = alloc || ['C2', 'C3', 'C4'];
  return [
    Object.assign({ id: 'S', name: `Soft (${a[2]})`, col: TYRE_COL.S, cNo: a[2] }, PIRELLI[a[2]]),
    Object.assign({ id: 'M', name: `Medium (${a[1]})`, col: TYRE_COL.M, cNo: a[1] }, PIRELLI[a[1]]),
    Object.assign({ id: 'H', name: `Hard (${a[0]})`, col: TYRE_COL.H, cNo: a[0] }, PIRELLI[a[0]]),
    { id: 'I', name: 'Intermediate', col: TYRE_COL.I, grip: 0.90, life: 30, win: [60, 90], wet: 'inter' },
    { id: 'W', name: 'Full wet', col: TYRE_COL.W, grip: 0.86, life: 35, win: [50, 80], wet: 'full' },
  ];
}
const TYRES = {
  wec: [{ id: 'S', name: 'Michelin Soft', col: TYRE_COL.S, grip: 1.000, life: 22, win: [75, 105] }, { id: 'M', name: 'Michelin Medium', col: TYRE_COL.M, grip: 0.995, life: 30, win: [80, 110] },
        { id: 'H', name: 'Michelin Hard', col: TYRE_COL.H, grip: 0.990, life: 40, win: [85, 115] }, { id: 'W', name: 'Wet', col: TYRE_COL.W, grip: 0.90, life: 35, win: [45, 80], wet: 'full' }],
  gt3: [{ id: 'M', name: 'Medium', col: TYRE_COL.M, grip: 1.000, life: 34, win: [75, 105] }, { id: 'H', name: 'Hard', col: TYRE_COL.H, grip: 0.994, life: 44, win: [80, 110] },
        { id: 'W', name: 'Wet', col: TYRE_COL.W, grip: 0.90, life: 35, win: [45, 80], wet: 'full' }],
  gt4: [{ id: 'D', name: 'Pirelli P Zero DHG', col: TYRE_COL.H, grip: 1.000, life: 40, win: [70, 100] }, { id: 'W', name: 'Pirelli Cinturato WHB wet', col: TYRE_COL.W, grip: 0.90, life: 40, win: [40, 75], wet: 'full' }],
  tcr: [{ id: 'D', name: 'Kumho Ecsta S700', col: TYRE_COL.H, grip: 1.000, life: 30, win: [70, 100] }, { id: 'W', name: 'Kumho Ecsta W701 wet', col: TYRE_COL.W, grip: 0.90, life: 35, win: [40, 75], wet: 'full' }],
  // road tyres: grip relative to an R-compound semi-slick (Cup 2 R / Trofeo R). Treaded tyres keep far more grip in the rain
  road: [{ id: 'R', name: 'R-compound (Cup 2 R / Trofeo R)', col: '#e5484d', grip: 1.000, life: 14, win: [55, 95], road: 'R' },
         { id: 'T', name: 'Track (Cup 2)', col: TYRE_COL.M, grip: 0.955, life: 22, win: [45, 90], road: 'T' },
         { id: 'U', name: 'Ultra-high-performance summer (PS4S)', col: TYRE_COL.H, grip: 0.880, life: 30, win: [35, 85], road: 'U' },
         { id: 'A', name: 'All-season', col: '#8b95a1', grip: 0.800, life: 40, win: [10, 70], road: 'A', wet: 'road' }],
};
const WEATHER = {
  sunny: { name: 'Sunny', air: 24, track: 42, wet: 0 },
  overcast: { name: 'Overcast', air: 17, track: 25, wet: 0 },
  rain: { name: 'Rain', air: 13, track: 16, wet: 1 },
};
// grip of a compound on a given surface: slicks lose about 45% in the wet; wet tyres lose grip and overheat in the dry;
// treaded road tyres sit in between
function surfaceGrip(comp, wet) {
  if (comp.wet === 'inter') return wet ? 1.0 : 0.86;
  if (comp.wet === 'full') return wet ? 0.97 : 0.80;
  if (comp.road) return wet ? ({ R: 0.58, T: 0.68, U: 0.80, A: 0.84 }[comp.road]) : 1.0;
  return wet ? 0.55 : 1.0;
}

// ----- car classes: 2026 regulations -----
// rows: [make, model, team/entrant colour, Spa gap to pole (s) used when a circuit has no 2026 timing for that model]
// drive: R rear, F front, A all-wheel. bias = typical front brake balance (%). wb = wheelbase (m)
const CLASSES = [
  { id: 'f1', name: 'Formula 1', short: 'F1', note: '2026 rules: 768 kg incl. driver, ~400 kW engine + 350 kW electric, active aero', tyres: 'f1', series: 'f1', drive: 'R', crew: 1, grid: 22,
    base: { mass: 768, wb: 3.4, ice: 400, ers: 350, cda: 1.10, cla: 3.9, mu: 1.85, aMax: 13, vmax: 96, eta: 0.50, energy: 'f1', fuelQ: 10, xDrag: 0.62, xLift: 0.45, bias: 57, wingSteps: 5 },
    cars: [['Mercedes', 'W17', '#27f4d2', 0], ['Red Bull', 'RB22', '#3671c6', 0.317], ['McLaren', 'MCL40', '#ff8000', 0.44], ['Ferrari', 'SF-26', '#e8002d', 0.532],
           ['Racing Bulls', 'VCARB 03', '#6692ff', 0.782], ['Williams', 'FW48', '#64c4ff', 0.95], ['Alpine', 'A526', '#ff87bc', 1.05], ['Haas', 'VF-26', '#b6babd', 1.05],
           ['Audi', 'R26', '#bb0a1e', 1.267], ['Aston Martin', 'AMR26', '#229971', 1.35], ['Cadillac', 'MAC-26', '#c9a227', 1.9]] },
  { id: 'hyper', name: 'Hypercar', short: 'HYP', note: '2026 WEC: ~1,030 kg minimum, ~500 kW under BoP, stint energy limit', tyres: 'wec', series: 'wec', drive: 'A', crew: 3, grid: 18,
    base: { mass: 1060, wb: 3.15, ice: 500, ers: 0, cda: 1.05, cla: 3.4, mu: 1.80, aMax: 11, vmax: 88, eta: 0.40, energy: 'vet', stintMJ: 900, fuelQ: 20, bias: 55, wingSteps: 4 },
    cars: [['Toyota', 'TR010 Hybrid', '#eb0a1e', 0.3], ['Ferrari', '499P', '#e8002d', 0.464], ['Cadillac', 'V-Series.R', '#c9a227', 0.043],
           ['BMW', 'M Hybrid V8', '#1c69d4', 0.664], ['Alpine', 'A424', '#0090ff', 0.078], ['Peugeot', '9X8', '#b4b4b4', 0], ['Aston Martin', 'Valkyrie', '#00665e', 0.36], ['Genesis', 'GMR-001', '#7a5c3e', 0.9]] },
  { id: 'gt3', name: 'LMGT3', short: 'GT3', note: '2026 WEC LMGT3: GT3 cars under BoP, stint energy limit', tyres: 'gt3', series: 'wec', drive: 'R', crew: 3, grid: 18,
    base: { mass: 1360, wb: 2.7, ice: 390, ers: 0, cda: 1.25, cla: 2.3, mu: 1.70, aMax: 9, vmax: 76, eta: 0.33, energy: 'vet', stintMJ: 760, fuelQ: 25, bias: 55, wingSteps: 4 },
    cars: [['Lexus', 'RC F LMGT3', '#c0c0c0', 0], ['Aston Martin', 'Vantage AMR LMGT3', '#00665e', 0.194], ['Ford', 'Mustang LMGT3', '#003478', 0.212], ['Porsche', '911 GT3 R LMGT3', '#d5001c', 0.3],
           ['Corvette', 'Z06 LMGT3.R', '#f2c300', 0.35], ['McLaren', '720S LMGT3 Evo', '#ff8000', 0.4], ['Ferrari', '296 LMGT3 Evo', '#e8002d', 0.651], ['BMW', 'M4 LMGT3 Evo', '#1c69d4', 0.744],
           ['Mercedes-AMG', 'LMGT3', '#00a19c', 0.92]] },
  { id: 'gt4', name: 'GT4', short: 'GT4', note: 'GT4 European Series 2026: production-based, BoP, 60-minute races with a driver-change stop', tyres: 'gt4', series: 'gt4', drive: 'R', crew: 2, grid: 36,
    base: { mass: 1450, wb: 2.65, ice: 320, ers: 0, cda: 1.20, cla: 0.8, mu: 1.58, aMax: 8, vmax: 70, eta: 0.30, energy: 'fuel', tank: 72, fuelQ: 20, bias: 58, wingSteps: 3 },
    cars: [['McLaren', 'Artura GT4', '#ff8000', 0], ['Porsche', '718 Cayman GT4 RS CS', '#d5001c', 0.5], ['Aston Martin', 'Vantage AMR GT4 Evo', '#00665e', 0.6], ['Ginetta', 'G56 GT4 Evo', '#333333', 0.8],
           ['Mercedes-AMG', 'GT4', '#00a19c', 0.9], ['Audi', 'R8 LMS GT4', '#bb0a1e', 0.961], ['Lotus', 'Emira GT4', '#f2c300', 0.972], ['Alpine', 'A110 GT4 Evo', '#0090ff', 1.0],
           ['BMW', 'M4 GT4 EVO', '#1c69d4', 1.077], ['Toyota', 'GR Supra GT4 EVO2', '#eb0a1e', 1.094], ['Ford', 'Mustang GT4', '#003478', 1.424]] },
  { id: 'tcr', name: 'TCR', short: 'TCR', note: 'TCR Europe 2026: front-drive, up to 2.5 L turbo under the 2026 rules, 25-minute races', tyres: 'tcr', series: 'tcr', drive: 'F', crew: 1, grid: 24,
    base: { mass: 1340, wb: 2.65, ice: 257, ers: 0, cda: 1.05, cla: 0.45, mu: 1.72, aMax: 7.5, vmax: 70, eta: 0.30, energy: 'fuel', tank: 60, fuelQ: 15, bias: 62, wingSteps: 2 },
    cars: [['Cupra', 'Leon VZ TCR', '#c9a227', 0.028], ['Honda', 'Civic Type R FL5 TCR', '#e60012', 0.1], ['Lynk & Co', '03 FL TCR', '#2b2b2b', 0.3], ['Audi', 'RS 3 LMS TCR', '#bb0a1e', 0.693],
           ['Hyundai', 'Elantra N TCR', '#002c5f', 0.917], ['Peugeot', '308 P5 TCR', '#b4b4b4', 1.0]] },
  { id: 'road', name: 'Road cars', short: 'ROAD', note: 'street-legal cars on their factory-fitted tyres; no racing series', tyres: 'road', series: 'road', crew: 1, grid: 20,
    base: null,
    // [make, model, colour, spec]: mass with fluids (kg), power (kW), drag/lift areas (m², estimated from published figures), tyre fitted at the factory
    cars: [['Rimac', 'Nevera', '#3a7bd5', { mass: 2300, ice: 1427, cda: 0.75, cla: 0.35, aMax: 12, vmax: 115, tank: 0, eta: 0.9, drive: 'A', tyre: 'U', tyreName: 'Michelin Pilot Sport 4S', energy: 'ev' }],
           ['Lamborghini', 'Revuelto', '#c9a227', { mass: 1850, ice: 747, cda: 0.85, cla: 0.90, aMax: 9.5, vmax: 97, tank: 75, eta: 0.33, drive: 'A', tyre: 'U', tyreName: 'Bridgestone Potenza Sport' }],
           ['Porsche', '911 GT3 RS (992)', '#d5001c', { mass: 1530, ice: 386, cda: 1.05, cla: 2.25, aMax: 8.5, vmax: 82, tank: 64, eta: 0.32, drive: 'R', tyre: 'R', tyreName: 'Michelin Pilot Sport Cup 2 R' }],
           ['Ferrari', 'SF90 XX Stradale', '#e8002d', { mass: 1660, ice: 765, cda: 0.95, cla: 1.80, aMax: 10, vmax: 89, tank: 68, eta: 0.33, drive: 'A', tyre: 'R', tyreName: 'Bridgestone Potenza Race' }],
           ['McLaren', 'Senna', '#ff8000', { mass: 1380, ice: 588, cda: 1.05, cla: 2.70, aMax: 9, vmax: 93, tank: 72, eta: 0.32, drive: 'R', tyre: 'R', tyreName: 'Pirelli P Zero Trofeo R' }],
           ['Aston Martin', 'Valkyrie', '#00665e', { mass: 1440, ice: 865, cda: 1.00, cla: 3.00, aMax: 10.5, vmax: 98, tank: 60, eta: 0.33, drive: 'R', tyre: 'T', tyreName: 'Michelin Pilot Sport Cup 2' }],
           ['Mercedes-AMG', 'ONE', '#00a19c', { mass: 1695, ice: 782, cda: 1.00, cla: 2.80, aMax: 10, vmax: 97, tank: 55, eta: 0.36, drive: 'R', tyre: 'R', tyreName: 'Michelin Pilot Sport Cup 2 R MO' }],
           ['McLaren', 'W1', '#ff8000', { mass: 1470, ice: 928, cda: 1.00, cla: 3.00, aMax: 11, vmax: 97, tank: 72, eta: 0.34, drive: 'R', tyre: 'R', tyreName: 'Pirelli P Zero Trofeo RS' }],
           ['Ferrari', 'F80', '#e8002d', { mass: 1600, ice: 882, cda: 1.00, cla: 3.50, aMax: 11, vmax: 97, tank: 68, eta: 0.34, drive: 'A', tyre: 'R', tyreName: 'Michelin Pilot Sport Cup 2 R' }],
           ['Chevrolet', 'Corvette ZR1 (C8)', '#f2c300', { mass: 1720, ice: 793, cda: 0.95, cla: 1.10, aMax: 9.5, vmax: 104, tank: 70, eta: 0.32, drive: 'R', tyre: 'R', tyreName: 'Michelin Pilot Sport Cup 2 R' }],
           ['Ford', 'Mustang GTD', '#003478', { mass: 1950, ice: 607, cda: 1.05, cla: 2.20, aMax: 8.5, vmax: 90, tank: 72, eta: 0.32, drive: 'R', tyre: 'R', tyreName: 'Michelin Pilot Sport Cup 2 R' }],
           ['Porsche', '918 Spyder', '#d5001c', { mass: 1700, ice: 652, cda: 0.90, cla: 1.00, aMax: 10.5, vmax: 96, tank: 70, eta: 0.34, drive: 'A', tyre: 'T', tyreName: 'Michelin Pilot Sport Cup 2' }],
           ['Koenigsegg', 'Jesko Attack', '#ff6a00', { mass: 1500, ice: 1195, cda: 1.00, cla: 2.30, aMax: 10.5, vmax: 100, tank: 72, eta: 0.32, drive: 'R', tyre: 'R', tyreName: 'Michelin Pilot Sport Cup 2 R' }],
           ['Bugatti', 'Chiron Super Sport', '#1e3a8a', { mass: 2070, ice: 1177, cda: 0.80, cla: 0.50, aMax: 11, vmax: 122, tank: 100, eta: 0.30, drive: 'A', tyre: 'T', tyreName: 'Michelin Pilot Sport Cup 2' }],
           ['Lamborghini', 'Huracán STO', '#7cb342', { mass: 1450, ice: 470, cda: 0.95, cla: 1.00, aMax: 8.5, vmax: 86, tank: 83, eta: 0.32, drive: 'R', tyre: 'U', tyreName: 'Bridgestone Potenza Sport' }],
           ['BMW', 'M4 CSL', '#1c69d4', { mass: 1700, ice: 405, cda: 0.80, cla: 0.30, aMax: 7.5, vmax: 85, tank: 59, eta: 0.32, drive: 'R', tyre: 'T', tyreName: 'Michelin Pilot Sport Cup 2' }],
           ['Nissan', 'GT-R Nismo', '#b4b4b4', { mass: 1800, ice: 441, cda: 0.75, cla: 0.40, aMax: 9, vmax: 87, tank: 74, eta: 0.30, drive: 'A', tyre: 'U', tyreName: 'Dunlop SP Sport Maxx GT600' }],
           ['Honda', 'Civic Type R (FL5)', '#e60012', { mass: 1500, ice: 235, cda: 0.75, cla: 0.15, aMax: 6, vmax: 76, tank: 47, eta: 0.30, drive: 'F', tyre: 'U', tyreName: 'Michelin Pilot Sport 4S' }],
           ['Toyota', 'GR Yaris', '#eb0a1e', { mass: 1350, ice: 206, cda: 0.70, cla: 0.05, aMax: 6.5, vmax: 64, tank: 50, eta: 0.30, drive: 'A', tyre: 'U', tyreName: 'Michelin Pilot Sport 4S' }]] },
];
// road tyre grip (μ before calibration) for each category
const ROAD_MU = { R: 1.22, T: 1.165, U: 1.075, A: 0.976 };
// grip/downforce scale found by matching the Pro's qualifying lap (soft tyres, low fuel, rubbered track) to real 2026 poles;
// TRACKCAL refines it per circuit (surface grip differs: abrasive, smooth, dusty street)
const CALIB = { f1: { gripScale: 1.2417, aeroScale: 1.300 }, hyper: { gripScale: 1.072, aeroScale: 1.072 }, gt3: { gripScale: 1.089, aeroScale: 1.089 },
  gt4: { gripScale: 1.123, aeroScale: 1.123 }, tcr: { gripScale: 1.151, aeroScale: 1.151 }, road: { gripScale: 1, aeroScale: 1 } };
let TRACKCAL = (typeof TRACKCAL_DATA !== 'undefined') ? TRACKCAL_DATA : {};
function TRACKCAL_SET(v) { TRACKCAL = v; }     // { trackId: { classId: factor } }
const GAPS = (typeof GAPS_DATA !== 'undefined') ? GAPS_DATA : {};                 // { classId: { trackId: { 'Make Model': gap s } } }
const POLE = (typeof POLE_DATA !== 'undefined') ? POLE_DATA : { f1: { spa: 104.361, monza: 81.786 }, hyper: { spa: 120.653 }, gt3: { spa: 136.612 }, gt4: { spa: 147.749, monza: 113.459 }, tcr: { spa: 146.586, monza: 113.580 } };

// ----- the people: skill levels and personalities -----
const KNOWLEDGE = ['Racing line', 'Braking zones', 'Trail braking', 'Apex choice', 'Exit throttle', 'Smooth hands', 'Corner phases'];
// adapt = how far a driver can drive around a balance it doesn't like; feedback = how accurately it reports what the car does
const SKILLS = [
  { id: 'pro', name: 'Pro', confMax: 1.03, kp: 3.0, lead: 0.22, short: 'PRO', color: '#3987e5', speedMode: 'plan', lineMode: 'minc', conf0: 0.94,
    la0: 6, la1: 0.29, tau: 0.04, noise: 0.0002, sConf: 0.02, sLine: 0.7, pLine: 0.5, trail: true, exitThrottle: true, brakeEff: 1, targeted: true, ersSkill: 1, aggression: 0.7, tyreCare: 1,
    adapt: 0.8, feedback: 0.92, compliance: 0.97, mistake: 0.02, knows: KNOWLEDGE.slice(), blurb: 'Plans each corner as entry, mid-entry, apex, mid-exit and exit. Feels the balance to a click and tells you exactly what to change.' },
  { id: 'semi', name: 'Semi-Pro', confMax: 1.03, kp: 1.2, lead: 0.2, short: 'SEM', color: '#d95926', speedMode: 'plan', lineMode: 'minc', conf0: 0.88,
    la0: 6, la1: 0.26, tau: 0.055, noise: 0.0006, sConf: 0.03, sLine: 0.9, pLine: 0.4, trail: true, exitThrottle: true, brakeEff: 0.95, targeted: false, ersSkill: 0.85, aggression: 0.6, tyreCare: 0.9,
    adapt: 0.6, feedback: 0.75, compliance: 0.93, mistake: 0.05, knows: ['Racing line', 'Braking zones', 'Trail braking', 'Exit throttle', 'Smooth hands'], blurb: 'Uses the full width on a minimum-curvature arc and trail-brakes into the turn. Good feedback, sometimes mixes up cause and effect.' },
  { id: 'club', name: 'Club Racer', confMax: 1.0, kp: 0.6, lead: 0.2, short: 'CLB', color: '#199e70', speedMode: 'plan', lineMode: 'minc60', conf0: 0.92,
    la0: 6, la1: 0.22, tau: 0.075, noise: 0.0012, sConf: 0.04, sLine: 1.0, pLine: 0.35, trail: false, exitThrottle: true, brakeEff: 0.9, targeted: false, ersSkill: 0.7, aggression: 0.5, tyreCare: 0.85,
    adapt: 0.45, feedback: 0.55, compliance: 0.9, mistake: 0.08, knows: ['Racing line', 'Braking zones', 'Exit throttle'], blurb: 'Brakes in a straight line before every corner, then turns in. Knows when the car is wrong, not always why.' },
  { id: 'amateur', name: 'Amateur', confMax: 1.05, kp: 0.6, lead: 0.12, short: 'AMA', color: '#c98500', speedMode: 'scan', lineMode: 'string', conf0: 1.0,
    la0: 6, la1: 0.18, tau: 0.11, noise: 0.0025, sConf: 0.05, sLine: 0.9, pLine: 0.3, trail: false, exitThrottle: false, brakeEff: 1, targeted: false, ersSkill: 0.5, aggression: 0.7, tyreCare: 0.75,
    adapt: 0.3, feedback: 0.38, compliance: 0.85, mistake: 0.12, knows: ['Racing line'], blurb: 'Looks ahead for corners and cuts to the inside early. Its feedback is mostly about how the car feels, rarely where.' },
  { id: 'novice', name: 'Novice', confMax: 1.05, kp: 0.6, lead: 0.12, short: 'NOV', color: '#d55181', speedMode: 'reactive', usesCaps: true, lineMode: 'centre', conf0: 1.15,
    la0: 5, la1: 0.16, tau: 0.13, noise: 0.002, sConf: 0.06, sLine: 0.7, pLine: 0.25, trail: false, exitThrottle: false, brakeEff: 1, targeted: false, ersSkill: 0.35, aggression: 0.6, tyreCare: 0.7,
    adapt: 0.2, feedback: 0.22, compliance: 0.8, mistake: 0.18, knows: [], blurb: 'Brakes when a corner is right in front of it. Can tell you the car is "loose" but often means the opposite.' },
  { id: 'rookie', name: 'Rookie', confMax: 1.0, kp: 0.6, lead: 0.12, short: 'ROK', color: '#9085e9', speedMode: 'flat', usesCaps: true, lineMode: 'centre', conf0: 1.0,
    la0: 4.5, la1: 0.13, tau: 0.17, noise: 0.0025, sConf: 0.08, sLine: 0.5, pLine: 0.2, trail: false, exitThrottle: false, brakeEff: 1, targeted: false, ersSkill: 0.2, aggression: 0.8, tyreCare: 0.6,
    adapt: 0.1, feedback: 0.1, compliance: 0.7, mistake: 0.25, knows: [], blurb: 'Floors it everywhere and only lifts once the car is already sliding. Learns each corner by crashing in it.' },
];
const SKILL_BY = Object.fromEntries(SKILLS.map(s => [s.id, s]));
// personalities shift aggression (attacking and defending), risk (how big the experiments are and how often it overdrives),
// tyre care and the balance the driver likes (pref < 0 likes a stable, understeering car; > 0 likes a pointy one)
const PERSONAS = {
  balanced: { label: 'Balanced', aggression: 0, risk: 0, tyreCare: 0, pref: 0 },
  aggressive: { label: 'Aggressive', aggression: 0.25, risk: 0.12, tyreCare: -0.08, pref: 0.15 },
  conservative: { label: 'Conservative', aggression: -0.25, risk: -0.12, tyreCare: 0.08, pref: -0.15 },
  risktaker: { label: 'Risk taker', aggression: 0.12, risk: 0.3, tyreCare: -0.05, pref: 0.2 },
  cautious: { label: 'Cautious learner', aggression: -0.12, risk: -0.3, tyreCare: 0.05, pref: -0.1 },
};
const FIRST = ['Alex', 'Sam', 'Jordan', 'Luca', 'Mika', 'Noah', 'Yuki', 'Mateo', 'Ellis', 'Oscar', 'Kai', 'Theo', 'Rafa', 'Nico', 'Ines', 'Lena', 'Maya', 'Zoe', 'Aiko', 'Sofia', 'Clara', 'Emma', 'Lars', 'Pierre', 'Diego', 'Arjun', 'Tomás', 'Felix', 'Jonas', 'Hugo', 'Ivy', 'Rosa', 'Nina', 'Ava', 'Leo', 'Max'];
const LAST = ['Varga', 'Moreau', 'Kowalski', 'Lindqvist', 'Okafor', 'Tanaka', 'Rossi', 'Hughes', 'Novak', 'Silva', 'Becker', 'Jensen', 'Costa', 'Duarte', 'Hayes', 'Brandt', 'Ferreira', 'Kimura', 'Laurent', 'Petrov', 'Reyes', 'Sato', 'Weber', 'Walsh', 'Moretti', 'Haas', 'Nyberg', 'Castillo', 'Ito', 'Fischer', 'Okoye', 'Lund', 'Marchetti', 'Vidal', 'Kaur', 'Nakamura', 'Dubois', 'Hale', 'Quinn', 'Sorensen', 'Aguilar', 'Bianchi', 'Pereira', 'Novotny', 'Mensah', 'Takeda', 'Ruiz', 'Keller', 'Byrne', 'Larsen', 'Ward', 'Ferrand', 'Ozturk', 'Mazur', 'Holm', 'Santos', 'Ueda', 'Grant', 'Leclair', 'Wolff'];
// a driver: skill template + personality + body. Weight matters: F1 ballasts the driver up to the 82 kg minimum,
// elsewhere every kilo is carried
function makeDriver(skillId, personaId, seed, overrides) {
  const S = SKILL_BY[skillId], P = PERSONAS[personaId] || PERSONAS.balanced, r = rng(seed);
  const g = () => (r() + r() + r() - 1.5) / 1.5;
  const D = Object.assign({}, S, { knows: S.knows.slice() });
  D.skill = skillId; D.persona = personaId in PERSONAS ? personaId : 'balanced';
  D.first = FIRST[Math.floor(r() * FIRST.length)]; D.last = LAST[Math.floor(r() * LAST.length)];
  D.weight = Math.round(70 + 7 * g() + (r() < 0.25 ? 6 : 0)); D.height = Math.round(176 + 7 * g());
  D.aggression = clamp(S.aggression + P.aggression + 0.08 * g(), 0.05, 1);
  D.risk = clamp(0.5 + P.risk + 0.1 * g(), 0, 1);
  D.tyreCare = clamp(S.tyreCare + P.tyreCare + 0.03 * g(), 0.4, 1.05);
  D.pref = clamp(P.pref + 0.08 * g(), -0.35, 0.35);
  if (overrides) Object.assign(D, overrides);
  applyRisk(D);
  return D;
}
// risk sets the size of the experiments and how often the driver overdrives
function applyRisk(D) {
  const S = SKILL_BY[D.skill], f = 0.6 + 0.8 * D.risk;
  D.sConf = S.sConf * f; D.sLine = S.sLine * f; D.mistakeRate = S.mistake * (0.5 + D.risk);
}

// ----- setup: what the engineer can change -----
// wingF/wingR: flap clicks from the circuit's baseline; ride: ride height steps (lower = more downforce, more bottoming);
// arbF/arbR: anti-roll bars 1 soft - 9 stiff; bias: front brake balance %; diffEn/diffEx: differential locking on entry / on power 1-9;
// press: tyre pressure offset (psi) from the supplier's minimum start pressure; camber: steps of negative camber from baseline
const SETUP_KEYS = ['wingF', 'wingR', 'ride', 'arbF', 'arbR', 'bias', 'diffEn', 'diffEx', 'press', 'camber'];
function setupRange(sp) {
  const w = sp.wingSteps ?? 3, road = sp.cls === 'road';
  return { wingF: [-w, w], wingR: [-w, w], ride: road ? [-1, 1] : [-3, 3], arbF: [1, 9], arbR: [1, 9], bias: [sp.bias - 6, sp.bias + 6],
           diffEn: [1, 9], diffEx: [1, 9], press: [-3, 3], camber: road ? [-1, 2] : [-3, 3] };
}
function defaultSetup(sp) { return { wingF: 0, wingR: 0, ride: 0, arbF: 5, arbR: 5, bias: sp.bias, diffEn: 5, diffEx: 5, press: 0, camber: 0 }; }
// which setup changes the rules allow right now (parc fermé etc.)
function setupAllowed(series, sessionType, where) {
  // cockpit: brake balance and differential are switches on the steering wheel in every series that allows them
  if (where === 'cockpit') return ['bias', 'diffEn', 'diffEx'];
  if (sessionType === 'practice') return SETUP_KEYS.slice();
  if (series === 'f1') return ['wingF', 'press'];                         // parc fermé from qualifying: front-wing flap and pressures at stops
  if (series === 'wec' || series === 'gt4') return ['wingF', 'wingR', 'press', 'arbF', 'arbR'];  // set-up changes allowed in the garage/at stops
  return ['press'];
}

function deriveSpec(cls, row, track) {
  const make = row[0], model = row[1];
  const b = cls.base ? Object.assign({}, cls.base, { drive: cls.drive }) : Object.assign({ ers: 0, energy: 'fuel', fuelQ: 10, tank: 50, wb: 2.6, bias: 60, wingSteps: 1 }, row[3]);
  if (!cls.base) b.mu = ROAD_MU[b.tyre] || 1.1;
  const cal = CALIB[cls.id] || { gripScale: 1, aeroScale: 1 }, tc = (TRACKCAL[track.id] || {})[cls.id] ?? (TRACKCAL[track.id] || {})._ ?? 1;
  // a slower real car gets a little less grip and downforce; about 1% of grip is worth ~0.6% of lap time
  const key = make + ' ' + model, gm = GAPS[cls.id] || {};
  let gap = 0, pole = (POLE[cls.id] || {})[track.id];
  if (cls.base) {
    if (gm[track.id] && gm[track.id][key] != null && pole) gap = gm[track.id][key];
    else {   // no timing here for this car: use its average relative gap elsewhere
      let s = 0, n = 0;
      for (const t in gm) if (gm[t][key] != null && POLE[cls.id] && POLE[cls.id][t]) { s += gm[t][key] / POLE[cls.id][t]; n++; }
      const rel = n ? s / n : row[3] / ((POLE[cls.id] || {}).spa || 120);
      pole = pole || track.official / 55; gap = rel * pole;
    }
  }
  const pace = 1 - (gap / (pole || 100)) / 0.6;
  const t = track.trim, cla = b.cla * t.cla * cal.aeroScale * pace, cda = b.cda * t.cda;
  return Object.assign({ cls: cls.id, className: cls.name, series: cls.series, tyreSet: cls.tyres, make, model, name: make + ' ' + model, gap, colour: row[2] }, b, {
    mu: b.mu * cal.gripScale * pace * tc, cla, cda, baseCla: b.cla, baseCda: b.cda,
    cdM: 0.5 * RHO * cda, clM: 0.5 * RHO * cla,
  });
}

// ----- vehicle dynamics helpers (per car, per instant) -----
// grip available (m/s²) at speed v, with load from gravity on slopes, crests/compressions and downforce;
// balMul = what the car's balance and setup let the driver use at this point; bottoming over compressions costs grip
function gripAt(car, v, i, gm, aeroMul) {
  const T = car.T, sp = car.sp, m = car.mass();
  const down = car.clM * (aeroMul ?? 1) * v * v / m;
  const vert = v * v * T.kv[i];
  let normal = G * Math.cos(Math.atan(T.slope[i])) + vert + down;
  if (vert > car.bottomLim) normal *= 0.95;
  return Math.max(0.05, car.muNow * (car.balMul ? car.balMul[i] : 1) * gm * normal) || 0.05;   // a car over a crest goes light, never weightless
}
