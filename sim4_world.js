// ===== the world: a session on one circuit with a full grid =====
// Series rules: weekend formats, service times, qualifying, points (2026 where published; see the notes in the page)
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], F1_SPRINT = [8, 7, 6, 5, 4, 3, 2, 1];
const SERIES = {
  f1: { name: 'Formula 1', pitLimit: 80, service: { tyres: 2.4, fuel: 0, wing: 8, repair: 30, setup: 0 }, refuel: false, start: 'standing', twoCompounds: true,
    formats: {
      standard: [{ key: 'fp1', type: 'practice', name: 'Practice 1', dur: 3600 }, { key: 'fp2', type: 'practice', name: 'Practice 2', dur: 3600 }, { key: 'fp3', type: 'practice', name: 'Practice 3', dur: 3600 },
        { key: 'q', type: 'quali', name: 'Qualifying', parts: [{ name: 'Q1', dur: 18 * 60, keep: 16 / 22 }, { name: 'Q2', dur: 15 * 60, keep: 10 / 22 }, { name: 'Q3', dur: 13 * 60 }] },
        { key: 'race', type: 'race', name: 'Grand Prix', laps: 'gp', points: F1_POINTS, grid: 'q' }],
      sprint: [{ key: 'fp1', type: 'practice', name: 'Practice 1', dur: 3600 },
        { key: 'sq', type: 'quali', name: 'Sprint Qualifying', parts: [{ name: 'SQ1', dur: 12 * 60, keep: 16 / 22, tyre: 'M' }, { name: 'SQ2', dur: 10 * 60, keep: 10 / 22, tyre: 'M' }, { name: 'SQ3', dur: 8 * 60, tyre: 'S' }] },
        { key: 'sprint', type: 'race', name: 'Sprint', laps: 'sprint', points: F1_SPRINT, grid: 'sq', freeTyres: true },
        { key: 'q', type: 'quali', name: 'Qualifying', parts: [{ name: 'Q1', dur: 18 * 60, keep: 16 / 22 }, { name: 'Q2', dur: 15 * 60, keep: 10 / 22 }, { name: 'Q3', dur: 13 * 60 }] },
        { key: 'race', type: 'race', name: 'Grand Prix', laps: 'gp', points: F1_POINTS, grid: 'q' }] } },
  wec: { name: 'FIA WEC', pitLimit: 60, service: { tyres: 12, fuel: 30, wing: 25, repair: 90, setup: 0, driver: 0 }, refuel: true, start: 'rolling',
    formats: {
      standard: [{ key: 'fp1', type: 'practice', name: 'Free Practice 1', dur: 90 * 60 }, { key: 'fp2', type: 'practice', name: 'Free Practice 2', dur: 90 * 60 }, { key: 'fp3', type: 'practice', name: 'Free Practice 3', dur: 60 * 60 },
        { key: 'q', type: 'quali', name: 'Qualifying + Hyperpole', perClass: true, points: [1], parts: [{ name: 'Qualifying', dur: 12 * 60, keep: 10 / 18 }, { name: 'Hyperpole', dur: 10 * 60 }] },
        { key: 'race', type: 'race', name: 'Race', hours: 6, grid: 'q', points: 'wec' }] } },
  gt4: { name: 'GT4 European Series', pitLimit: 50, service: { tyres: 0, fuel: 0, wing: 30, repair: 60, setup: 0 }, minPit: 80, refuel: false, start: 'rolling',
    formats: {
      standard: [{ key: 'fp1', type: 'practice', name: 'Free Practice 1', dur: 60 * 60 }, { key: 'fp2', type: 'practice', name: 'Free Practice 2', dur: 60 * 60 },
        { key: 'q1', type: 'quali', name: 'Qualifying 1 (driver 1)', crew: 0, points: [1], parts: [{ name: 'Q1', dur: 20 * 60 }] }, { key: 'q2', type: 'quali', name: 'Qualifying 2 (driver 2)', crew: 1, points: [1], parts: [{ name: 'Q2', dur: 20 * 60 }] },
        { key: 'r1', type: 'race', name: 'Race 1', minutes: 60, window: [25 * 60, 35 * 60], grid: 'q1', points: F1_POINTS, crew: 0 },
        { key: 'r2', type: 'race', name: 'Race 2', minutes: 60, window: [25 * 60, 35 * 60], grid: 'q2', points: F1_POINTS, crew: 1 }] } },
  tcr: { name: 'TCR Europe', pitLimit: 60, service: { tyres: 30, fuel: 0, wing: 30, repair: 60, setup: 0 }, refuel: false, start: 'standing',
    formats: {
      standard: [{ key: 'fp1', type: 'practice', name: 'Free Practice 1', dur: 30 * 60 }, { key: 'fp2', type: 'practice', name: 'Free Practice 2', dur: 30 * 60 },
        { key: 'q', type: 'quali', name: 'Qualifying', points: [10, 8, 6, 4, 2, 1], parts: [{ name: 'Q1', dur: 20 * 60, keep: 12 / 24 }, { name: 'Q2', dur: 10 * 60 }] },
        { key: 'r1', type: 'race', name: 'Race 1', minutes: 25, plusLap: true, grid: 'q', points: [30, 25, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1] },
        { key: 'r2', type: 'race', name: 'Race 2', minutes: 25, plusLap: true, grid: 'q', reverse: 10, points: [30, 25, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1] }] } },
  road: { name: 'Track day', pitLimit: 60, service: { tyres: 40, fuel: 60, wing: 60, repair: 120, setup: 0 }, refuel: true, start: 'rolling',
    formats: {
      standard: [{ key: 'fp', type: 'practice', name: 'Open pit lane', dur: 60 * 60 }, { key: 'ta', type: 'quali', name: 'Time attack', parts: [{ name: 'Time attack', dur: 20 * 60 }] },
        { key: 'race', type: 'race', name: 'Sprint race', laps: 10, grid: 'ta', points: F1_POINTS }] } },
};
// WEC points scale with the race length (Le Mans counts double); plus 1 point for pole in each class
const WEC_POINTS = { 6: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], 8: [38, 27, 23, 18, 15, 12, 9, 6, 3, 2], 10: [38, 27, 23, 18, 15, 12, 9, 6, 3, 2], 24: [50, 36, 30, 24, 20, 16, 12, 8, 4, 2] };
const CLASS_RANK = { f1: 0, hyper: 1, gt3: 2, gt4: 3, tcr: 4, road: 2 };
const INTERACT_OPTS = { off: [], race: ['race'], qr: ['quali', 'race'], all: ['practice', 'quali', 'race'] };
const SKILL_KEYS = ['pro', 'semi', 'club', 'amateur', 'novice', 'rookie'];
const PERSONA_IDS = Object.keys(PERSONAS);

// grid: { classId: { pro: n, semi: n, ... } }, personas: { classId: { skill: personaId } }
function buildEntries(config) {
  const out = []; let seedBase = hash32(JSON.stringify(config.grid) + (config.seed || ''));
  for (const cid of config.classIds) {
    const cls = CLASSES.find(c => c.id === cid), g = config.grid[cid] || {}, pers = (config.personas || {})[cid] || {};
    const skills = []; for (const s of SKILL_KEYS) for (let n = 0; n < (g[s] || 0); n++) skills.push(s);
    // spread the skill levels across the manufacturers so every make gets a fair mix
    const rows = cls.cars, perTeam = cls.id === 'f1' ? 2 : 1;
    skills.forEach((s, n) => {
      const row = rows[Math.floor(n / perTeam) % rows.length];
      const crew = [];
      for (let k = 0; k < cls.crew; k++) crew.push(makeDriver(s, pers[s] || PERSONA_IDS[hash32(`${cid}:${n}:${k}:p`) % PERSONA_IDS.length], hash32(`${seedBase}:${cid}:${n}:${k}`)));
      const number = (config.numbers && config.numbers[cid] && config.numbers[cid][n]) || (cid === 'f1' ? n + 1 : (CLASS_RANK[cid] * 100 + n + 1));
      out.push({ cls, row, number, team: row[0], crew, skill: s });
    });
  }
  // no two drivers on the grid share a surname
  const used = new Set();
  for (const e of out) for (const d of e.crew) { let i = LAST.indexOf(d.last), g = 0; while (used.has(d.last) && g++ < LAST.length) d.last = LAST[(++i) % LAST.length]; used.add(d.last); }
  return out;
}

class World {
  // config: { trackId, classIds, grid, personas, raceScale, alloc, wecHours, sprint }
  constructor(config) {
    this.config = config;
    this.track = TRACKS.find(t => t.id === config.trackId); this.T = World.geom(config.trackId);
    this.classIds = config.classIds; this.cls = CLASSES.find(c => c.id === config.classIds[0]);
    this.seriesKey = SERIES_KEYS[this.cls.id]; this.rules = SERIES[this.seriesKey];
    this.format = this.rules.formats[config.sprint && this.rules.formats.sprint ? 'sprint' : 'standard'];
    this.raceScale = config.raceScale || 1;
    this.mode = 'ghost'; this.session = 'practice'; this.sessionKey = this.format[0].key; this.weatherId = 'sunny'; this.weather = WEATHER.sunny;
    this.interact = { racing: 'all', slipstream: 'all', dirtyAir: 'all' };
    this.rubber = 40; this.flag = 'green'; this.fcyT = 0; this.time = 0; this.msgs = []; this.grids = {}; this.sessionResults = {};
    this.f1Tyres = f1Tyres(config.alloc);
    this.prepareTrack();
    this.cars = buildEntries(config).map((e, i) => new Car(this, e, i));
    this.calibrateWear();
    for (const c of this.cars) { c.applySetup(); c.resetRun({ fuel: this.practiceFuel(c) }); c.setLine(c.base); }
    this.duration = Infinity;
  }
  static geom(id) {
    World._g = World._g || {};
    if (!World._g[id]) { const T = buildTrack(TRACKDATA[id]); T.corners = findCorners(T, TRACKDATA[id].corners); World._g[id] = T; }
    return World._g[id];
  }
  // per circuit and class: how hard braking is at speed (sets the best brake balance), how big the compressions are
  // (sets the ride height where the floor starts touching), and how long a stop costs
  prepareTrack() {
    const T = this.T, N = T.N; this.bottomRef = {}; this.laneTimes = {}; this.lapWork = {};
    const mincO = initialOffsets(T, 'minc'), line = makeLine(T, mincO);
    for (const cid of this.config.classIds) {
      const cls = CLASSES.find(c => c.id === cid), row = cls.cars[0];
      const dummy = { T, W: this, sp: deriveSpec(cls, row, this.track), D: SKILL_BY.pro, fuel: 20, soc: 4, orders: DEFAULT_ORDERS, tractMul: 1, brakeMul: 1, overtakeLap: false, crew: [SKILL_BY.pro], crewIdx: 0,
        driver: Object.assign({ weight: 72 }, SKILL_BY.pro), bottomLim: 1e9, balMul: null };
      dummy.clM = dummy.sp.clM; dummy.cdM = dummy.sp.cdM; dummy.muNow = dummy.sp.mu;
      Object.setPrototypeOf(dummy, Car.prototype);
      const plan = planSpeed(dummy, line, new Float64Array(NS).fill(1), SKILL_BY.pro);
      const vk = []; let hiBrake = 0, allBrake = 0, w = 0;
      for (let i = 0; i < N; i++) {
        const v = plan[i], vn = plan[(i + 1) % N];
        if (T.kv[i] > 0) vk.push(v * v * T.kv[i]);
        if (vn < v - 0.05) { const e = v * v - vn * vn; allBrake += e; if (v > 60) hiBrake += e; }
        const dtI = T.ds / Math.max(v, 5), alat = v * v * Math.abs(line.K[i]), along = Math.abs(vn * vn - v * v) / (2 * T.ds);
        w += Math.pow(Math.hypot(alat, along) / G, 1.6) * v / 50 * dtI;
      }
      vk.sort((a, b) => a - b);
      this.bottomRef[cid] = Math.max(6, (vk[Math.floor(vk.length * 0.995)] || 10) * 1.03);
      this.biasShift = 2 * ((allBrake ? hiBrake / allBrake : 0.4) - 0.4);
      this.lapWork[cid] = w;
      // pit lane: the real time loss where it's known; otherwise the lane length at the speed limit
      const sk = SERIES_KEYS[cid], tr = this.track, S = SERIES[sk];
      let tSec = 0; for (let i = T.pit.entry; i !== T.pit.exit; i = (i + 1) % N) tSec += T.ds / Math.max(plan[i], 5);
      const lim = (tr.pitLimit[sk] || tr.pitLimit[cid] || S.pitLimit) / 3.6;
      const loss = tr.pitLoss[sk] ?? tr.pitLoss[cid];
      const stat = sk === 'f1' ? S.service.tyres : 0;
      const lt = tr.laneTime[sk] ?? tr.laneTime[cid] ?? (loss ? loss - stat + tSec : T.pit.len / lim + 4);
      this.laneTimes[cid] = clamp(lt, T.pit.len / lim * 0.6, T.pit.len / lim + 12);
    }
  }
  get trackGrip() { return this.weather.wet ? 0.985 : 0.985 + 0.015 * (1 - Math.exp(-this.rubber / 120)); }
  tyreSet(car) { const t = car ? car.sp.tyreSet : this.cls.tyres; return t === 'f1' ? this.f1Tyres : TYRES[t]; }
  dryTyres(car) { return this.tyreSet(car).filter(c => !c.wet); }
  defaultTyre(car) {
    const set = this.tyreSet(car), def = this.sessionDef;
    if (this.weather.wet) return set.find(c => c.wet === 'inter') || set.find(c => c.wet) || set[0];
    if (car.sp.cls === 'road') return set.find(c => c.id === car.sp.tyre) || set[0];
    const dry = this.dryTyres(car);
    if (this.session === 'quali') { const part = def && def.parts && def.parts[this.qPart || 0]; return (part && part.tyre && dry.find(c => c.id === part.tyre)) || dry[0]; }
    if (this.session === 'race' && dry.length > 1) return dry[1];        // start on the medium
    return dry[Math.min(1, dry.length - 1)];
  }
  calibrateWear() { /* lap work per class comes from prepareTrack */ }
  wearK(comp, car) { return 1 / (comp.life * (this.lapWork[car.sp.cls] || 1)); }
  laneTime(car) { return this.laneTimes[car ? car.sp.cls : this.cls.id]; }
  pitLimit(car) { return this.T.pit.len / this.laneTime(car); }
  vetOut(car) { return car.sp.energy === 'vet' && car.stintE >= car.sp.stintMJ; }
  learning() { return this.session === 'practice'; }
  interacting(kind) { return this.mode === 'weekend' && INTERACT_OPTS[this.interact[kind]].includes(this.session); }
  practiceFuel(car) { const sp = car.sp; return sp.energy === 'f1' ? 30 : sp.energy === 'vet' ? 40 : sp.energy === 'ev' ? 0 : Math.min(sp.tank || 50, 40); }
  say(text, car) { this.msgs.push({ t: this.time, text, car: car ? car.slot : null }); if (this.msgs.length > 120) this.msgs.shift(); }
  radio(car, text, from) { (car.radio = car.radio || []).push({ kind: 'msg', from: from || 'driver', text, t: this.time }); }
  setWeather(id) {
    this.weatherId = id; this.weather = WEATHER[id];
    if (id === 'rain') { this.rubber = 0; if (this.session === 'race') this.wetRace = true; }
    for (const c of this.cars) { c.setLine(c.base); c.tyre.tempF = Math.min(c.tyre.tempF, this.weather.track + 40); c.tyre.tempR = Math.min(c.tyre.tempR, this.weather.track + 40); }
    this.say(`Weather: ${this.weather.name.toLowerCase()}. Track ${this.weather.track}°C.`);
  }
  get sessionDef() { return this.format.find(s => s.key === this.sessionKey) || this.format[0]; }
  // ---------- sessions ----------
  startSession(mode, key) {
    const def = mode === 'ghost' ? this.format[0] : (this.format.find(s => s.key === key) || this.format[0]);
    this.mode = mode; this.sessionKey = def.key; this.session = mode === 'ghost' ? 'practice' : def.type;
    this.time = 0; this.flag = 'green'; this.fcyT = 0; this.results = null; this.ended = false; this.raceStartT = null; this.debriefs = null;
    this.say(mode === 'ghost' ? 'Ghost running: every car on its own, learning.' : `${def.name} started.`);
    const cars = this.cars;
    for (const c of cars) if (def.crew != null && c.crew.length > def.crew && c.crewIdx !== def.crew) { c.crewIdx = def.crew - 1; c.changeDriver(); }
    if (this.session === 'practice') {
      for (const c of cars) { this.applyPendingSetup(c); c.resetRun({ fuel: this.practiceFuel(c) }); c.setLine(c.base); }
      this.duration = mode === 'ghost' ? Infinity : def.dur;
    } else if (this.session === 'quali') {
      this.qPart = 0; this.qAlive = cars.map((c, k) => k); this.qBest = cars.map(() => ({})); this.duration = Infinity; this.qOut = [];
      for (const c of cars) { this.applyPendingSetup(c); c.resetRun({ fuel: c.sp.fuelQ, pos: 'pit' }); c.setLine(c.base); c.pit = { phase: 'garage', s: this.T.pit.len * 0.5, release: 0 }; }
      this.startQualiPart();
    } else {
      // grid: the qualifying session this race uses, else best practice laps; TCR race 2 reverses the top ten
      let order = (def.grid && this.grids[def.grid]) || this.grid || cars.map((c, k) => k).sort((a, b) => (cars[a].best || 1e9) - (cars[b].best || 1e9));
      if (def.reverse) { const n = Math.min(def.reverse, order.length); order = order.slice(0, n).reverse().concat(order.slice(n)); }
      this.gridOrder = order; this.duration = Infinity;
      const rolling = this.rules.start === 'rolling';
      order.forEach((k, pos) => { const c = cars[k]; c.resetRun({ fuel: this.raceFuel(c), pos: 'grid', grid: pos, rolling, compId: c.startTyre }); c.setLine(c.base); c.gridPos = pos + 1; c.startHold = rolling ? 0 : 3 + (1 - c.D.ersSkill) * 0.3 + Math.random() * 0.25; });
      const tr = this.track, gpLaps = tr.raceLaps.f1 || Math.ceil(305000 / this.T.L), spLaps = tr.raceLaps.f1Sprint || Math.ceil(100000 / this.T.L);
      const laps = def.laps === 'gp' ? gpLaps : def.laps === 'sprint' ? spLaps : def.laps;
      this.raceLaps = laps ? Math.max(2, Math.round(laps * this.raceScale)) : null;
      const secs = def.hours ? (this.config.wecHours || def.hours) * 3600 : def.minutes ? def.minutes * 60 : null;
      this.raceTime = secs ? Math.max(300, secs * this.raceScale) : null; this.plusLap = !!def.plusLap;
      this.window = def.window ? def.window.map(x => x * this.raceScale) : null;
      this.leaderDone = false; this.finishOrder = []; this.plusLapStarted = false; this.wetRace = !!this.weather.wet;
      this.say(this.raceLaps ? `${this.raceLaps} laps.` : `${Math.round(this.raceTime / 60)} minutes${this.plusLap ? ' plus one lap' : ''}.`);
    }
  }
  raceFuel(c) {
    const sp = c.sp;
    if (sp.energy === 'f1') { const laps = this.raceLaps || this.track.raceLaps.f1 || 50; return Math.min(110, (laps + 1.5) * this.fuelPerLap(c) * 1.06); }
    if (sp.energy === 'vet') return 60;
    if (sp.energy === 'ev') return 0;
    return sp.tank || 50;
  }
  fuelPerLap(c) { return c.fuelLap && c.fuelLap > 0.6 ? c.fuelLap : ({ f1: 1.55, vet: 2.6, fuel: 2.2 }[c.sp.energy] || 2) * this.T.L / 7000; }
  qualiParts() { return this.sessionDef.parts; }
  startQualiPart() {
    const part = this.qualiParts()[this.qPart];
    this.qTime = 0; this.qDur = part.dur;
    this.say(`${part.name}: ${Math.round(part.dur / 60)} minutes, ${this.qAlive.length} cars.`);
    // each car plans two runs: out-lap, two push laps, in-lap; release times spread so they don't all leave together
    this.qAlive.forEach((k, n) => { const c = this.cars[k]; c.qRuns = 0; c.qPush = 0; c.pit = { phase: 'garage', s: this.T.pit.len * 0.5, release: 20 + (n % 12) * 22 + Math.random() * 15 }; c.status = 'garage'; c.resetQualiTyres = true; });
  }
  // ---------- per-step ----------
  step(dt) {
    this.time += dt;
    const cars = this.cars, T = this.T;
    if (this.fcyT > 0 && (this.fcyT -= dt) <= 0) { this.flag = 'green'; this.say('Green flag.'); }
    this.applyInteractions(dt);
    for (const c of cars) {
      if (c.startHold > 0) { c.startHold -= dt; c.lapT = 0; c.v = 0; c.thr = 0.3; c.brk = 0; if (c.startHold <= 0 && c === cars[this.gridOrder[0]]) this.say('Lights out.'); continue; }
      if (c.dnf && this.session === 'race') { if (!c.retired) { c.retired = true; c.pit = { phase: 'garage', s: this.T.pit.len * 0.5, release: 0 }; c.status = 'out of the race'; c.v = 0; } continue; }
      if (c.pit) this.stepPit(c, dt); else c.step(dt);
      if (!c.pit) this.strategy(c);
      if (!c.pit && c.pitRequest && ahead(c.idx, T.pit.entry, T.N) < 3) this.enterPit(c);
    }
    if (this.interacting('racing')) this.contacts();
    this.rubber += dt * cars.filter(c => !c.pit).length / (T.L / 50) * 0.02 * 6 / Math.max(6, cars.length);
    if (this.session === 'quali') this.stepQuali(dt);
    if (this.session === 'practice' && this.time >= this.duration && !this.ended) { this.ended = true; this.say('Chequered flag: practice over.'); this.results = this.practiceResults(); this.finishSession(); }
    if (this.session === 'race') this.stepRace();
  }
  // tow, dirty air, following, passing, defending, blue flags, team orders
  applyInteractions(dt) {
    const cars = this.cars, T = this.T, N = T.N;
    const slip = this.interacting('slipstream'), dirty = this.interacting('dirtyAir'), racing = this.interacting('racing');
    for (const a of cars) { a.dragMul = 1; a.aeroMul = 1; a.followCap = Infinity; if (!racing) a.passTarget = 0; a.gapAhead = null; }
    if (!slip && !dirty && !racing) return;
    // sort by track position once: neighbour search is then linear
    const live = cars.filter(c => !c.pit && !c.coolDown).sort((p, q) => p.idx - q.idx);
    const M = live.length;
    for (let n = 0; n < M; n++) {
      const a = live[n];
      if (a.frozen > 0 || a.startHold > 0) continue;
      let best = null, bg = 1e9;
      for (let d = 1; d < Math.min(M, 8); d++) {
        const b = live[(n + d) % M]; const g = ahead(a.idx, b.idx, N) * T.ds;
        if (g > 0.5 && g < 150 && g < bg) { bg = g; best = b; }
      }
      if (!best) { a.passTarget *= 0.98; continue; }
      const b = best, dl = b.lat - a.lat, inLine = Math.abs(dl) < 2.6;
      a.gapAhead = { car: b, m: bg, s: bg / Math.max(a.v, 10) };
      if (inLine && bg < 90) {
        if (slip && bg < 60) a.dragMul = 1 - 0.18 * (1 - bg / 60) ** 1.5;                    // tow: less drag in the hole the car ahead punches
        if (dirty) a.aeroMul = 1 - Math.min(0.35, b.sp.cla / 12) * (1 - Math.min(1, bg / 50));   // dirty air: turbulent wake robs downforce
        if (bg < 50) { a.trafficT += dt; a.db.traffic += dt; }
      }
      if (!racing) continue;
      const classBlue = CLASS_RANK[a.sp.cls] < CLASS_RANK[b.sp.cls];
      const lapped = (this.session === 'race' && a.raceLaps > b.raceLaps) || classBlue;
      const myLat = a.line.o[a.idx] + a.passOff;
      const overlap = Math.abs(b.lat - myLat) < 2.3;
      // never close faster than the brakes allow: speed from which a can still stop behind b with a car length to spare
      if (overlap && bg < 70) {
        const aB = 0.7 * gripAt(a, a.v, a.idx, 1, a.aeroMul);
        a.followCap = Math.sqrt(Math.max(0, b.v * b.v + 2 * aB * Math.max(0, bg - 7)));
      }
      // team orders: let a team-mate through
      if (b.orders.letBy === a.slot && bg < 60) { b.yieldT = 2; b.passTarget = clamp((b.lat > 0 ? 1 : -1) * 2.5 - b.line.o[b.idx], -4, 4); }
      if (this.flag === 'fcy') { a.passTarget *= 0.97; continue; }
      if (a.orders.position === 'hold' && !lapped) { a.passing = 0; a.passTarget *= 0.97; continue; }
      const faster = a.v > b.v + 0.3 || (a.plan && b.plan && a.plan[(a.idx + 20) % N] > b.plan[(b.idx + 20) % N] * 1.01) || lapped;
      if (faster && bg < 45 && bg > 5 && (this.session !== 'quali' || b.qPhase !== 'push' || lapped)) {
        // go round the side with more room, a car's width plus a margin clear of the car ahead
        const roomR = (T.hw[b.idx] - CAR_HALF) - b.lat, roomL = b.lat + (T.hw[b.idx] - CAR_HALF);
        const sideSign = roomR > roomL ? 1 : -1, room = Math.max(roomR, roomL);
        const aggr = a.D.aggression + (a.orders.position === 'attack' ? 0.3 : 0);
        if (room > 2.6 && Math.random() < aggr * dt * 4 + (a.passing ? 1 : 0)) {
          a.passing = sideSign;
          const target = b.lat + sideSign * 2.8;
          a.passTarget = clamp(target - a.line.o[a.idx], -6, 6);
          if (lapped) b.passTarget = clamp(-sideSign * 2.5 - b.line.o[b.idx], -4, 4);
          else if ((b.D.aggression > 0.65 || b.orders.position === 'defend') && bg < 25 && !b.defended) { b.passTarget = clamp(sideSign * 1.2, -2.5, 2.5); b.defended = 6; }
        }
      } else if (bg > 45 || !faster) { a.passing = 0; a.passTarget *= 0.97; }
      if (b.defended) { b.defended -= dt; if (b.defended <= 0) { b.defended = 0; b.passTarget *= 0.5; } }
    }
  }
  contacts() {
    const cars = this.cars, T = this.T, N = T.N;
    const live = cars.filter(c => !c.pit && !(c.frozen > 0) && !c.coolDown).sort((p, q) => p.idx - q.idx), M = live.length;
    for (let n = 0; n < M; n++) for (let d = 1; d < Math.min(M, 4); d++) {
      const a = live[n], b = live[(n + d) % M];
      const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy);
      if (dd > 5) continue;
      const along = Math.abs(dx * Math.cos(a.h) + dy * Math.sin(a.h)), side = Math.abs(-dx * Math.sin(a.h) + dy * Math.cos(a.h));
      if (along < 4.6 && side < 1.95) {
        const rel = Math.abs(a.v - b.v);
        const nxh = -Math.sin(a.h), nyh = Math.cos(a.h), sgn = Math.sign(-dx * Math.sin(a.h) + dy * Math.cos(a.h)) || 1, push = (1.95 - side) / 2 + 0.05;
        a.x -= nxh * push * sgn; a.y -= nyh * push * sgn; b.x += nxh * push * sgn; b.y += nyh * push * sgn;
        a.v *= 0.99; b.v *= 0.99; a.contactT = b.contactT = 1; a.tainted = b.tainted = a.tainted || 'contact';
        const fresh = !(a.contactNow > 0) && !(b.contactNow > 0);
        if (fresh) { a.db.contacts++; b.db.contacts++; }
        a.contactNow = b.contactNow = 0.5;
        if (!fresh) continue;
        // only a real rear-end spins a car and breaks a front wing: nose into gearbox, big closing speed, cars in line
        const behind = ahead(a.idx, b.idx, N) < N / 2 ? a : b, front = behind === a ? b : a;
        if (rel > 9 && side < 1.2 && behind.v > front.v) {
          behind.frozen = 2; behind.v = 5; behind.crashes++; behind.damage.wing = Math.min(1, behind.damage.wing + rel / 25); behind.applySetup();
          front.damage.floor = Math.min(1, front.damage.floor + rel / 60); front.applySetup();
          this.onIncident(behind, 'contact'); front.v *= 0.9;
        } else if (rel > 5 && Math.random() < 0.1) { const v2 = Math.random() < 0.5 ? a : b; v2.damage.wing = Math.min(1, v2.damage.wing + 0.15); v2.applySetup(); }
      }
    }
    for (const c of cars) if (c.contactNow > 0) c.contactNow -= DT;
  }
  onIncident(car, kind) {
    const serious = kind === 'contact' || Math.random() < 0.3;
    if (this.mode === 'weekend' && this.session === 'race' && this.interacting('racing') && this.flag === 'green' && serious) {
      this.flag = 'fcy'; this.fcyT = 25 + Math.min(40, this.cars.length); this.say(`Full course yellow: ${car.label()} ${kind === 'crash' ? 'off at ' : kind === 'spin' ? 'spun at ' : 'in contact at '}${this.cornerAt(car.idx)}.`);
    } else if (kind !== 'crash') this.say(`${car.label()} ${kind === 'spin' ? 'spun' : 'spun after contact'} at ${this.cornerAt(car.idx)}.`, car);
    if (car.damage.wing > 0.25) this.radio(car, car.D.skill === 'pro' || car.D.skill === 'semi' ? `Front wing's damaged, I've lost front grip in the fast corners. Box for a new nose?` : `Something's broken on the front!`);
  }
  cornerAt(i) {
    const n = this.T.names[i]; if (n) return NAME_MAP[n] || n;
    const c = (this.T.corners || []).find(c => ahead(c.s, i, this.T.N) <= ahead(c.s, c.e, this.T.N) + 10);
    return c ? (c.name || `Turn ${c.n}`) : `${Math.round(i * this.T.ds)} m`;
  }
  // ---------- the pit wall: orders from the engineer ----------
  // cmd: { type: 'box', tyres, fuel, wing, repair, driverChange, setup } | 'stayout' | 'pace' | 'fuel' | 'lico' | 'ers' | 'position' | 'letBy' | 'owner' | 'setup'
  command(car, cmd) {
    const D = car.D, O = car.orders, T = this.T, pro = D.feedback > 0.7;
    const ok = (t) => { this.radio(car, t); return t; };
    switch (cmd.type) {
      case 'box': {
        if (car.pit) return ok('Already in the pit lane.');
        const req = { reason: 'Engineer call', engineer: true };
        if (cmd.tyres) req.tyres = cmd.tyres;
        if (cmd.fuel) req.fuel = cmd.fuel;
        if (cmd.wing) req.wing = cmd.wing;
        if (cmd.repair) req.repair = true;
        if (cmd.driverChange) req.driverChange = true;
        if (cmd.setup) req.setup = cmd.setup;
        if (this.session === 'quali') req.toGarage = true;
        if (cmd.mandatory) req.mandatory = true;
        car.pitRequest = req;
        const past = ahead(T.pit.entry, car.idx, T.N) * T.ds < 120 && ahead(T.pit.entry, car.idx, T.N) < T.N / 2;
        const tyreName = cmd.tyres ? (this.tyreSet(car).find(t => t.id === cmd.tyres) || {}).name : null;
        if (Math.random() > D.compliance && !cmd.forced && this.session === 'race') { car.pitRequest = null; return ok(pro ? 'Negative, the tyres are still fine, I can do two more laps. Call it again if you mean it.' : `What? Can I stay out?`); }
        return ok(past ? `Copy, too late for this lap, boxing next time by.` : `Copy, box this lap${tyreName ? ', ' + tyreName.toLowerCase() : ''}.`);
      }
      case 'stayout': car.pitRequest = null; car.stayOutUntil = car.raceLaps + (cmd.laps || 2); return ok(pro ? 'Copy, staying out. Tyres are holding on.' : 'OK, staying out.');
      case 'pace': O.pace = cmd.value; return ok({ push: pro ? 'Understood, pushing. Watch the rears for me.' : 'Going flat out!', normal: 'Copy, normal pace.', manage: pro ? 'Copy, managing. Lifting a bit into the high-load corners.' : 'OK, taking it easy.' }[cmd.value]);
      case 'fuel': O.fuel = cmd.value; return ok({ rich: 'Rich mix, copy.', std: 'Standard mix.', lean: 'Lean mix, copy, saving fuel.' }[cmd.value]);
      case 'lico': O.lico = cmd.value; return ok(cmd.value ? `Lift and coast, level ${cmd.value}. Copy.` : 'Back to full attack on the straights.');
      case 'ers': O.ers = cmd.value; return ok({ harvest: 'Harvest mode. Battery first.', balanced: 'Balanced deployment.', attack: 'Attack mode, full deployment.' }[cmd.value]);
      case 'position': O.position = cmd.value; return ok({ attack: 'Copy, going for it.', defend: 'Copy, defending. Covering the inside.', hold: 'Holding position.', free: 'Free to race, copy.' }[cmd.value]);
      case 'letBy': O.letBy = cmd.target; return ok(cmd.target == null ? 'Copy, racing again.' : pro ? `Understood. I'll let #${this.cars[cmd.target].number} by into the next straight.` : `Fine...`);
      case 'owner': O.owner = cmd.value; return cmd.value === 'user' ? 'Strategy is yours: the car stops only when you call it.' : 'Strategy handed back to the team.';
      case 'setup': {
        // the setup sheet: cockpit switches (bias, diff) take effect now; anything else at the next stop or in the garage
        const now = {}, later = {}, allowed = setupAllowed(this.seriesKey, this.session, 'garage'), cockpit = setupAllowed(this.seriesKey, this.session, 'cockpit');
        const R = setupRange(car.sp); let refused = [];
        for (const k in cmd.changes) {
          const v = clamp(cmd.changes[k], R[k][0], R[k][1]);
          if (cockpit.includes(k)) now[k] = v; else if (allowed.includes(k)) later[k] = v; else refused.push(k);
        }
        Object.assign(car.setup, now); car.applySetup();
        if (Object.keys(later).length) car.pendingSetup = Object.assign(car.pendingSetup || {}, later);
        const parts = [];
        if (Object.keys(now).length) parts.push('switches changed');
        if (Object.keys(later).length) parts.push(car.pit && car.pit.phase === 'garage' ? 'the mechanics are on it' : 'changes ready for the next stop');
        if (refused.length) parts.push(`not allowed now under the rules: ${refused.join(', ')}`);
        if (car.pit && car.pit.phase === 'garage') this.applyPendingSetup(car);
        return ok(parts.join('; ') || 'No change.');
      }
    }
    return '';
  }
  applyPendingSetup(c) { if (c.pendingSetup) { Object.assign(c.setup, c.pendingSetup); c.pendingSetup = null; c.applySetup(); if (c.line) c.setLine(c.base); } }
  // ---------- pit lane ----------
  enterPit(c) {
    const T = this.T, req = c.pitRequest; c.pitRequest = null;
    c.pit = { phase: 'lane', s: 0, req, stopAt: T.pit.len * 0.55, t: 0, toGarage: !!req.toGarage };
    c.status = 'pit'; c.tainted = 'pit'; c.limiter = true;
  }
  serviceTime(c, req) {
    const S = this.rules.service; let t = 0;
    if (req.tyres) t += S.tyres;
    if (req.fuel && (this.rules.refuel || this.session !== 'race')) t = Math.max(t, S.fuel * Math.min(1, req.fuel / 60 + 0.3)) + (this.seriesKey === 'wec' && req.tyres ? S.tyres : 0) * 0;
    if (req.wing) t = Math.max(t, S.wing);
    if (req.repair) t += S.repair * Math.max(c.damage.wing, c.damage.floor, c.damage.susp);
    if (req.setup || c.pendingSetup) t += this.session === 'race' ? 3 : 25 + 8 * Object.keys(c.pendingSetup || req.setup || {}).length;
    if (req.driverChange && c.crew.length > 1) t = Math.max(t, 6);
    if (this.rules.minPit && req.mandatory) t = Math.max(t, this.rules.minPit * this.raceScale ** 0 - this.laneTime(c));
    return Math.max(t, 1.5);
  }
  stepPit(c, dt) {
    const T = this.T, p = c.pit, vLane = T.pit.len / this.laneTime(c);
    c.lapT += dt; c.secT += dt;
    if (p.phase === 'garage') {
      c.v = 0;
      if (this.session === 'quali' && this.qAlive.includes(c.slot) && p.release > 0 && this.qTime >= p.release && this.qTime < this.qDur - 70) { p.phase = 'stop'; p.t = 0; p.stop = 0.5; p.toGarage = false; c.status = 'out'; c.tainted = 'pit'; c.qRuns++; }
      if (this.session === 'practice' && this.mode === 'weekend' && p.release > 0 && this.time >= p.release && !this.ended) { p.phase = 'stop'; p.t = 0; p.stop = 0.5; p.toGarage = false; c.status = 'out'; c.tainted = 'pit'; }
      return;
    }
    if (p.phase === 'lane' || p.phase === 'exit') {
      c.v = vLane; p.s += vLane * dt;
      if (p.phase === 'lane' && p.s >= p.stopAt) { p.phase = 'stop'; p.t = 0; p.stop = this.serviceTime(c, p.req || {}); c.v = 0; this.service(c, p.req || {}); c.lastStop = { t: p.stop, lap: c.raceLaps, req: p.req }; }
      if (p.phase === 'exit' && p.s >= T.pit.len) this.exitPit(c);
    } else if (p.phase === 'stop') {
      c.v = 0; p.t += dt;
      if (p.t >= p.stop) {
        if (p.toGarage && this.session !== 'race') { p.phase = 'garage'; p.release = this.session === 'practice' && this.mode === 'weekend' ? this.time + 40 + Math.random() * 60 : 0; c.status = 'garage'; this.applyPendingSetup(c); return; }
        p.phase = 'exit';
      }
    }
    // place the car on the pit lane polyline for drawing
    const pts = T.pit.pts; let acc = 0;
    for (let j = 1; j < pts.length; j++) {
      const seg = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
      if (acc + seg >= p.s || j === pts.length - 1) { const f = clamp((p.s - acc) / seg, 0, 1); c.x = pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f; c.y = pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f; c.h = Math.atan2(pts[j][1] - pts[j - 1][1], pts[j][0] - pts[j - 1][0]); break; }
      acc += seg;
    }
  }
  service(c, req) {
    if (req.tyres) { const comp = this.tyreSet(c).find(t => t.id === req.tyres) || this.defaultTyre(c); c.tyre = c.newTyre(comp); c.compsUsed.add(comp.id); }
    c.servicedThisLap = true;
    if (req.fuel && (this.rules.refuel || this.mode === 'ghost' || this.session !== 'race')) { const cap = c.sp.energy === 'f1' ? 110 : c.sp.energy === 'vet' ? 75 : (c.sp.tank || 50); c.fuel = Math.min(cap, c.fuel + req.fuel); }
    if (c.sp.energy === 'vet' && (req.fuel || req.energy)) { c.stintE = 0; c.lapStartE = 0; }
    if (req.wing) { c.damage.wing = 0; if (typeof req.wing === 'number') c.setup.wingF = clamp(c.setup.wingF + req.wing, ...setupRange(c.sp).wingF); }
    if (req.repair) { c.damage.wing = 0; c.damage.floor *= this.seriesKey === 'f1' ? 1 : 0; c.damage.susp = 0; }
    if (req.setup) c.pendingSetup = Object.assign(c.pendingSetup || {}, req.setup);
    this.applyPendingSetup(c); c.applySetup();
    if (req.driverChange && c.changeDriver()) this.say(`#${c.number}: driver change, ${c.driver.first} ${c.driver.last} in.`, c);
    c.stops++; c.pitHistory.push({ lap: c.raceLaps, comp: c.tyre.comp.id, t: this.time, reason: req.reason });
    c.B = null; if (c.trial) { for (const q of c.trial.items) c.undo(q); c.trial = null; }
    c.setLine(c.base);
  }
  exitPit(c) {
    const T = this.T, to = T.pit.exit;
    // laps and sectors crossed while in the pit lane still count
    // where the lane crosses the start line, the lane time after the line belongs to the out-lap, which is never a timed lap
    let s = c.sec, target = Math.floor(to / T.secLen), guard = 0;
    const before = (T.N - T.pit.entry) % T.N, after = to, tAfter = after + before > 0 ? this.laneTime(c) * after / (after + before) : 0;
    while (s !== target && guard++ < NS + 1) {
      s = (s + 1) % NS; c.secTimes[(s - 1 + NS) % NS] = c.secT; c.secT = 0;
      if (s === 0) { c.lapT = Math.max(0, c.lapT - tAfter); c.finishLap(); c.lapT = tAfter; c.tainted = 'pit'; }
      c.sec = s;
    }
    c.idx = to; c.x = T.x[to] + T.nx[to] * (T.hw[to] - 1.5); c.y = T.y[to] + T.ny[to] * (T.hw[to] - 1.5); c.h = Math.atan2(T.ty[to], T.tx[to]);
    c.lat = T.hw[to] - 1.5; c.v = T.pit.len / this.laneTime(c); c.pit = null; c.limiter = false; c.status = this.session === 'quali' ? 'out' : 'run'; c.k = 0; c.nextCorner = 0;
  }
  // ---------- strategy: the team's strategist, unless the engineer has taken the car over ----------
  strategy(c) {
    if (c.pitRequest || c.finished) return;
    const sp = c.sp, rules = this.rules, race = this.session === 'race', wet = this.weather.wet, manual = c.orders.owner === 'user' && this.mode === 'weekend';
    if (this.session === 'quali') return;
    if (c.stayOutUntil != null && c.raceLaps < c.stayOutUntil) return;
    const lapsLeft = race ? this.lapsRemaining(c) : Infinity;
    const wrongTyre = !!c.tyre.comp.wet !== !!wet && !c.tyre.comp.road;
    const perLapWear = c.tyre.age > 0 ? c.tyre.wear / c.tyre.age : 1 / c.tyre.comp.life;
    let reason = null, req = {};
    const warn = (key, text) => { c.warned = c.warned || {}; if (!c.warned[key]) { c.warned[key] = true; this.radio(c, text, 'data'); } };
    if (wrongTyre && lapsLeft > 1.5) { reason = wet ? 'Rain: wet tyres' : 'Track dry: slicks'; req.tyres = this.defaultTyre(c).id; }
    const fuelLap = c.fuelLap || this.fuelPerLap(c);
    if (sp.energy === 'vet') { const eLap = c.lapE || sp.stintMJ / 25; if (c.stintE + eLap * 1.05 > sp.stintMJ && lapsLeft > 1) { reason = reason || 'Stint energy'; req.fuel = 60; req.energy = true; req.tyres = req.tyres || (c.tyre.age >= Math.min(c.tyre.comp.life * 0.8, 50) ? this.defaultTyre(c).id : null); if (!req.tyres) delete req.tyres; } }
    else if (sp.energy !== 'ev' && c.fuel < fuelLap * 1.3 && lapsLeft > 1 && (this.rules.refuel || !race)) { reason = reason || 'Fuel'; req.fuel = (race ? Math.min(lapsLeft, 30) : 12) * fuelLap; }
    else if (race && !this.rules.refuel && sp.energy !== 'ev' && c.fuel < fuelLap * 1.05 * Math.min(lapsLeft, 3)) c.fuelSave = true;   // no refuelling: lift and coast to make the flag
    const cliffIn = (1 - c.tyre.wear) / Math.max(1e-4, perLapWear);
    if (!race && c.tyre.wear > 0.92) { reason = reason || 'Tyres'; req.tyres = this.defaultTyre(c).id; req.fuel = req.fuel || Math.max(0, this.practiceFuel(c) - c.fuel); }
    if (!race && (c.damage.wing > 0.25 || c.damage.floor > 0.4)) { reason = reason || 'Damage'; req.repair = true; }
    if (race && !wet) {
      if (c.damage.wing > 0.35 && lapsLeft > 3) { reason = reason || 'Front wing damage'; req.wing = true; }
      if (sp.energy === 'f1' || this.seriesKey === 'tcr' || this.seriesKey === 'road') {
        const needTwo = rules.twoCompounds && !wet && c.compsUsed.size < 2 && !this.sessionDef.freeTyres;
        if ((cliffIn < 1.2 && lapsLeft > cliffIn) || (needTwo && lapsLeft < Math.max(3, (1 - c.tyre.wear) / perLapWear * 0.3) && lapsLeft > 1.5)) {
          reason = reason || 'Tyres'; const dry = this.dryTyres(c);
          const fits = dry.filter(t => t.life * 0.95 >= lapsLeft);
          const fresh = fits.filter(t => !needTwo || t.id !== c.tyre.comp.id);
          let pick = fresh.length ? fresh[0] : fits.length ? fits[0] : dry[dry.length - 1];
          if (needTwo && pick.id === c.tyre.comp.id) pick = dry.find(t => t.id !== c.tyre.comp.id) || pick;
          req.tyres = pick.id;
        }
      }
      if (this.seriesKey === 'gt4' && !c.mandatoryDone && this.window) {
        const [w0, w1] = this.window; const t = this.time - (this.raceStartT || 0);
        if (t > w0 + (c.gridPos % 10) * 20 * this.raceScale) { reason = 'Mandatory driver change'; req.mandatory = true; req.driverChange = true; }
      }
      if (this.seriesKey === 'wec' && c.crew.length > 1 && c.driveTime[c.crewIdx] > 3600 * 2.5 * this.raceScale && reason) req.driverChange = true;
    }
    if (!reason) return;
    if (manual) {
      // the engineer has the car: the strategist only advises (the driver still limps in when the tank or stint energy is empty)
      const urgent = (sp.energy === 'vet' && this.vetOut(c)) || (sp.energy !== 'ev' && c.fuel < fuelLap * 0.5 && (rules.refuel || !race));
      if (!urgent) {
        const key = reason + ':' + c.stops;
        warn(key, `Strategist: ${reason.toLowerCase()} — recommend boxing${req.tyres ? ' for ' + (this.tyreSet(c).find(t => t.id === req.tyres) || {}).name : ''}${req.mandatory ? ' (the window is open)' : ''}.`);
        return;
      }
      reason = 'Emergency: ' + reason.toLowerCase();
    }
    c.pitRequest = Object.assign(req, { reason });
    if (req.mandatory) c.mandatoryDone = true;
    if (race || this.mode === 'weekend') this.say(`${c.label()} pitting: ${reason.toLowerCase()}.`, c);
  }
  lapsRemaining(c) {
    if (this.raceLaps) return this.raceLaps - c.raceLaps;
    const left = this.raceTime - (this.time - (this.raceStartT || 0));
    return Math.max(0, left / Math.max(60, c.lastLap || 120)) + (this.plusLap ? 1 : 0) + 1;
  }
  // laps per stint the real teams achieved at Spa 2026 (Hypercar 25, LMGT3 24), scaled by lap length elsewhere
  stintTarget(c) { return Math.round(({ hyper: 25, gt3: 24 }[c.sp.cls] || 25) * 7004 / this.T.L); }
  onLap(c, rec) {
    if (c.sp.energy === 'vet' && this.session === 'race' && c.lapE > 1 && !rec.pit) {
      const target = c.sp.stintMJ / this.stintTarget(c) * 0.99;
      c.powerCap = clamp((c.powerCap || 1) * Math.pow(target / c.lapE, 0.8), 0.6, 1);
    }
    // learn the fuel this car really burns
    if (c.prevFuel != null && rec.valid && !c.servicedThisLap && this.flag === 'green') { const used = c.prevFuel - c.fuel; if (used > 0.2) c.fuelLap = c.fuelLap ? c.fuelLap * 0.7 + used * 0.3 : used; }
    c.prevFuel = c.fuel; c.servicedThisLap = false;
    // F1 2026 overtake mode: within one second of the car ahead at the line, extra deployment for the next lap
    c.overtakeLap = c.sp.cls === 'f1' && this.session === 'race' && c.gapAhead && c.gapAhead.s < 1 && this.interacting('racing');
    if (this.session === 'race') this.raceLap(c, rec);
    if (this.session === 'quali') this.qualiLap(c, rec);
  }
  // ---------- qualifying ----------
  classGroups() { const def = this.sessionDef; if (!def.perClass) return [this.cars.map(c => c.slot)]; return this.classIds.map(cid => this.cars.filter(c => c.sp.cls === cid).map(c => c.slot)); }
  stepQuali(dt) {
    if (this.ended) return;
    this.qTime += dt;
    for (const k of this.qAlive) {
      const c = this.cars[k];
      if (c.pit && c.pit.phase === 'garage' && c.qRuns >= 1 && c.pit.release === 0 && c.qRuns < 2 && this.qTime < this.qDur - 240) c.pit.release = this.qTime + 30 + Math.random() * 40;
      if (c.pit && c.pit.phase === 'garage' && c.resetQualiTyres && c.pit.release && this.qTime >= c.pit.release - 1) {
        c.tyre = c.newTyre(this.defaultTyre(c)); c.fuel = c.sp.fuelQ; c.soc = c.sp.ers ? 4 : 0; c.stintE = 0;
        c.qPhase = 'out'; c.qPush = 0; c.lapT = 0; c.setLine(c.base); c.resetQualiTyres = false;
      }
    }
    if (this.qTime >= this.qDur) {
      const onTrack = this.qAlive.some(k => { const c = this.cars[k]; return !c.pit && c.qPhase === 'push'; });
      if (!onTrack || this.qTime > this.qDur + 180) this.endQualiPart();
      else for (const k of this.qAlive) { const c = this.cars[k]; if (!c.pit && c.qPhase !== 'push' && !c.pitRequest) c.pitRequest = { reason: 'Chequered flag', toGarage: true }; }
    }
  }
  qualiLap(c, rec) {
    if (!this.qAlive.includes(c.slot)) return;
    const part = this.qualiParts()[this.qPart];
    if (c.qPhase === 'push' && rec.valid && !rec.pit && this.qTime <= this.qDur + 200) {
      const b = this.qBest[c.slot]; if (!b[part.name] || rec.t < b[part.name]) b[part.name] = rec.t;
    }
    if (c.qPhase === 'out') { c.qPhase = 'push'; c.qPush = 0; return; }
    if (c.qPhase === 'push') { c.qPush++; if (c.qPush >= 2 || this.qTime >= this.qDur) { c.qPhase = 'in'; c.pitRequest = { reason: 'In-lap', toGarage: true }; } return; }
  }
  endQualiPart() {
    const parts = this.qualiParts(), part = parts[this.qPart];
    const t = k => this.qBest[k][part.name] || 1e9;
    let survivors = [];
    for (const grp of this.classGroups()) {
      const alive = grp.filter(k => this.qAlive.includes(k)).sort((a, b) => t(a) - t(b));
      const keep = part.keep ? Math.max(1, Math.min(alive.length, Math.round(grp.length * part.keep))) : alive.length;
      const out = alive.slice(keep);
      this.qOut = this.qOut.concat(out.slice().reverse());
      survivors = survivors.concat(alive.slice(0, keep));
      if (alive.length) this.say(`${part.name}${this.sessionDef.perClass ? ' (' + this.cars[alive[0]].sp.className + ')' : ''} over. ${alive.slice(0, 3).map((k, n) => `${n + 1}. ${this.cars[k].label()} ${t(k) < 1e9 ? fmtT(t(k)) : 'no time'}`).join(', ')}${out.length ? `. Out: ${out.map(k => '#' + this.cars[k].number).join(', ')}` : ''}.`);
    }
    this.qAlive = survivors;
    for (const c of this.cars) if (!c.pit) { c.pit = { phase: 'garage', s: this.T.pit.len * 0.5, release: 0 }; c.status = 'garage'; c.v = 0; }
    this.qPart++;
    if (this.qPart < parts.length) this.startQualiPart();
    else {
      // final order: last part's ranking, then each knocked-out group, best of them first; class groups stay in class order
      const lastT = k => { for (let p = parts.length - 1; p >= 0; p--) if (this.qBest[k][parts[p].name]) return [parts.length - p, this.qBest[k][parts[p].name]]; return [99, 1e9]; };
      const order = this.cars.map(c => c.slot).sort((a, b) => { const A = lastT(a), B = lastT(b); return (CLASS_RANK[this.cars[a].sp.cls] - CLASS_RANK[this.cars[b].sp.cls]) * (this.sessionDef.perClass ? 1 : 0) || A[0] - B[0] || A[1] - B[1]; });
      this.grid = order; this.grids[this.sessionKey] = order;
      this.results = order.map((k, n) => ({ pos: n + 1, car: k, times: this.qBest[k] }));
      this.ended = true; this.say('Qualifying over. The grid is set.'); this.finishSession();
    }
  }
  // ---------- race ----------
  stepRace() {
    if (this.raceStartT == null && this.cars.every(c => !(c.startHold > 0))) this.raceStartT = this.time;
    if (this.cars.every(c => c.finished || c.dnf) && !this.ended) { this.ended = true; this.results = this.raceResults(); this.say('Race over.'); this.finishSession(); }
  }
  raceLap(c, rec) {
    const elapsed = this.time - (this.raceStartT || 0);
    if (!this.leaderDone) {
      const first = this.raceOrder()[0] === c.slot;
      if (this.raceLaps) { if (c.raceLaps >= this.raceLaps) this.leaderDone = true; }
      else if (first && elapsed >= this.raceTime) {
        if (this.plusLap && !this.plusLapStarted) { this.plusLapStarted = true; this.say('Time is up: one more lap.'); return; }
        this.leaderDone = true;
      }
      if (this.leaderDone) this.say(`Chequered flag. ${c.label()} wins.`);
    }
    if (this.leaderDone && !c.finished) { c.finished = true; c.coolDown = true; c.finishT = this.time; c.finishLaps = c.raceLaps; this.finishOrder.push(c.slot); }
    // F1: a dry race must use two different dry compounds, or the car is disqualified
    if (c.finished && !c.dsqChecked) { c.dsqChecked = true; if (this.rules.twoCompounds && !this.sessionDef.freeTyres && !this.wetRace && c.compsUsed.size < 2 && !c.dnf) { c.dnf = 'DSQ: one compound'; this.say(`${c.label()} disqualified: only one dry compound used.`, c); } }
  }
  raceOrder() {
    const N = this.T.N;
    return this.cars.map((c, k) => k).sort((a, b) => {
      const A = this.cars[a], B = this.cars[b];
      if (!!A.dnf !== !!B.dnf) return A.dnf ? 1 : -1;
      if (A.finished && B.finished) return (B.finishLaps - A.finishLaps) || (A.finishT - B.finishT);
      if (A.finished !== B.finished) return A.finished ? -1 : 1;
      return (B.raceLaps + B.idx / N) - (A.raceLaps + A.idx / N);
    });
  }
  classOrder(cid) { return this.raceOrder().filter(k => this.cars[k].sp.cls === cid); }
  raceResults() {
    return this.raceOrder().map((k, n) => { const c = this.cars[k]; return { pos: n + 1, classPos: this.classOrder(c.sp.cls).indexOf(k) + 1, car: k, laps: c.finishLaps ?? c.raceLaps, dnf: c.dnf || null, time: c.finishT - (this.raceStartT || 0), best: Math.min(...c.laps.filter(l => l.session === 'race' && l.valid).map(l => l.t), Infinity), stops: c.stops, comps: c.pitHistory.map(p => p.comp) }; });
  }
  practiceResults() {
    return this.cars.map((c, k) => k).sort((a, b) => (this.cars[a].best || 1e9) - (this.cars[b].best || 1e9)).map((k, n) => ({ pos: n + 1, car: k, best: this.cars[k].best }));
  }
  // the session is over: points for races, and every driver gives a debrief
  finishSession() {
    this.sessionResults[this.sessionKey] = { results: this.results, def: this.sessionDef, track: this.track.id, time: this.time };
    if (this.mode === 'weekend') this.debriefs = this.cars.map(c => makeDebrief(c, this));
  }
}
function fmtT(t) { if (!isFinite(t)) return '–'; const m = Math.floor(t / 60), s = t - m * 60; return (m ? m + ':' + (s < 10 ? '0' : '') : '') + s.toFixed(3); }
