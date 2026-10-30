// ----- the car -----
const FUEL_MJ_PER_KG = 43;
const PHASES = ['entry', 'mid', 'exit'];
// orders an engineer can give; the driver follows them as well as its compliance allows
const DEFAULT_ORDERS = { pace: 'normal', fuel: 'std', lico: 0, ers: 'balanced', position: 'free', letBy: null, owner: 'ai' };
class Car {
  // entry: { cls, row, number, team, crew: [driver...], setup? }
  constructor(world, entry, slot) {
    this.W = world; this.T = world.T; this.slot = slot; this.entry = entry;
    this.cls = entry.cls; this.number = entry.number; this.team = entry.team;
    this.sp = deriveSpec(entry.cls, entry.row, world.track);
    this.crew = entry.crew; this.crewIdx = 0; this.D0 = this.crew[0]; this.driveTime = this.crew.map(() => 0);
    this.setup = Object.assign(defaultSetup(this.sp), entry.setup || {});
    this.pendingSetup = null;
    this.orders = Object.assign({}, DEFAULT_ORDERS, entry.orders || {});
    this.damage = { wing: 0, floor: 0, susp: 0 };
    // the car's own character at this circuit: some cars understeer in slow corners, some are nervous at speed
    const r = rng(hash32(this.sp.make + this.sp.model + world.track.id));
    this.bal0 = {}; for (const p of PHASES) for (const band of ['L', 'H']) this.bal0[p + band] = 0.16 * ((r() + r() + r()) / 1.5 - 1);
    this.fuel = this.sp.fuelQ || 10; this.muNow = this.sp.mu;
    this.tyre = this.newTyre(world.tyreSet(this)[0]);
    this.applySetup();
    this.resetKnowledge();
    this.resetRun({ grid: slot, fuel: this.sp.fuelQ, compId: null });
  }
  get D() { return this._D; }
  set D(v) { this._D = v; }
  get driver() { return this.crew[this.crewIdx]; }
  label() { return `#${this.number} ${this.driver.first[0]}. ${this.driver.last}`; }
  mass() {
    const sp = this.sp, dw = this.driver.weight;
    // F1 2026: the driver is ballasted up to 82 kg inside the minimum mass, so only a heavier driver adds weight; elsewhere the driver (and seat) is carried
    const body = sp.cls === 'f1' ? sp.mass + Math.max(0, dw - 82) : sp.mass + dw + 7;
    return body + Math.max(0, this.fuel);
  }
  newTyre(comp) { const t0 = this.W.weather.track + 12; return { comp, wearF: 0, wearR: 0, wear: 0, tempF: t0, tempR: t0, temp: t0, age: 0, flat: 0, grain: 0, press: this.setup ? this.setup.press : 0 }; }
  // ---- setup -> aero, mechanical balance, brakes, traction ----
  applySetup() {
    const s = this.setup, sp = this.sp, W = this.W, dm = this.damage;
    const aeroScale = sp.cls === 'tcr' || sp.cls === 'road' ? 0.5 : 1;
    const claMul = (1 + aeroScale * (0.015 * s.wingF + 0.025 * s.wingR)) * (1 - 0.03 * s.ride) * (1 - 0.18 * dm.wing - 0.12 * dm.floor);
    const cdaMul = (1 + aeroScale * (0.006 * s.wingF + 0.022 * s.wingR)) * (1 - 0.004 * s.ride) * (1 + 0.03 * dm.wing + 0.02 * dm.floor);
    this.clM = sp.clM * claMul; this.cdM = sp.cdM * cdaMul;
    const ref = (W.bottomRef && W.bottomRef[sp.cls]) || 20;
    this.bottomLim = ref * (1 + 0.12 * s.ride) * (1 - 0.3 * dm.floor);
    this.biasOpt = sp.bias + (W.biasShift || 0);
    this.brakeMul = 1 - 0.006 * (s.bias - this.biasOpt) ** 2;
    const dOpt = (sp.drive || 'R') === 'F' ? 7 : (sp.drive === 'A' ? 5 : 6);
    this.tractMul = 1 - 0.004 * (s.diffEx - dOpt) ** 2;
    this.camberGrip = 1 + 0.004 * s.camber; this.camberLong = 1 - 0.003 * s.camber; this.camberWear = 1 + 0.05 * Math.max(0, s.camber);
    // balance per corner phase and speed band: < 0 understeer, > 0 oversteer
    const B = {}, aeroBal = 0.035 * s.wingF - 0.035 * s.wingR - 0.25 * dm.wing;
    for (const band of ['L', 'H']) {
      const ab = aeroBal * (band === 'H' ? 1 : 0.3);
      B['entry' + band] = this.bal0['entry' + band] - 0.04 * (s.bias - this.biasOpt) - 0.03 * (s.diffEn - 5) + ab;
      B['mid' + band] = this.bal0['mid' + band] - 0.035 * (s.arbF - 5) + 0.035 * (s.arbR - 5) + ab - 0.1 * dm.susp;
      B['exit' + band] = this.bal0['exit' + band] - 0.035 * (s.diffEx - 5) + 0.02 * (s.arbR - 5) + ab
        + (band === 'L' ? (sp.drive === 'F' ? -0.12 : sp.drive === 'R' ? 0.06 + 0.04 * Math.min(1, sp.ice / 500) : 0) : 0);
    }
    this.bal = B;
    if (this.line) this.computeBalMul();
  }
  // grip the driver can use at each point given the balance there and the balance it likes
  balFactor(key) {
    const b = this.bal[key], D = this.driver;
    const phaseGrip = key.startsWith('mid') ? this.camberGrip : this.camberLong;
    return clamp((1 - 0.10 * b * b - 0.05 * (b - D.pref) ** 2 * (1 - D.adapt)) * phaseGrip, 0.85, 1.02);
  }
  computeBalMul() {
    const T = this.T, N = T.N, m = this.balMul || (this.balMul = new Float32Array(N)), ph = this.phaseMap || (this.phaseMap = new Uint8Array(N));
    m.fill(1); ph.fill(0);
    const v = this.plan || this.vlim, cps = this.cornerPts || [];
    for (const cp of cps) {
      const band = v && v[cp.apex] < 45 ? 'L' : 'H', bandCode = band === 'L' ? 0 : 3;
      const fE = this.balFactor('entry' + band), fM = this.balFactor('mid' + band), fX = this.balFactor('exit' + band);
      for (let i = cp.bs; i !== cp.apex; i = (i + 1) % N) { const mid = ahead(i, cp.apex, N) <= 3; m[i] = mid ? fM : fE; ph[i] = (mid ? 2 : 1) + bandCode; }
      const exitEnd = (cp.to + 10) % N;
      for (let i = cp.apex; i !== exitEnd; i = (i + 1) % N) { const mid = ahead(cp.apex, i, N) <= 3; m[i] = mid ? fM : fX; ph[i] = (mid ? 2 : 3) + bandCode; }
    }
  }
  // ---- propulsion, drag ----
  ersAvail(v) {
    const sp = this.sp; if (!sp.ers) return 0; const kph = v * 3.6, top = this.overtakeLap ? 355 : 345, knee = this.overtakeLap ? 337 : 290;
    return sp.ers * 1000 * (kph <= knee ? 1 : Math.max(0, (top - kph) / (top - knee)));
  }
  powerAcc(v, i, plan) {
    const sp = this.sp, m = this.mass();
    let P = sp.ice * 1000 * (this.orders.fuel === 'rich' ? 1.03 : this.orders.fuel === 'lean' ? 0.96 : 1);
    if (sp.ers) P += plan ? this.ersAvail(v) * (0.55 + 0.45 * this.D.ersSkill) : (this.deployNow || 0);
    if (this.limiter && !plan) P = Math.min(P, 60e3);   // the plan is for racing laps, not the pit lane
    const aCap = sp.aMax * (v < 40 ? this.tractMul : 1);
    return v >= sp.vmax ? 0 : Math.min(aCap, P / (m * Math.max(v, 2)));
  }
  aeroMode(i) { return this.sp.xDrag && this.T.straight[i] && this.thr > 0.9 && this.W.flag !== 'fcy'; }
  dragAcc(v, i) {
    const x = this.sp.xDrag && this.T.straight[i] ? this.sp.xDrag : 1;
    return this.cdM * x * (this.dragMul || 1) * v * v / this.mass();
  }
  resetKnowledge() {
    const T = this.T;
    const D = this.D = Object.assign({}, this.driver, { knows: this.driver.knows.slice() });
    this.coach = []; this.coachSeq = 0; this.radio = [];
    this.base = initialOffsets(T, D.lineMode);
    this.conf = new Float64Array(NS).fill(D.conf0);
    this.caps = new Float64Array(T.N).fill(this.sp.vmax); this.wasOff = false;
    this.laps = []; this.best = Infinity; this.lastLap = null; this.improvements = 0; this.attempts = 0; this.crashes = 0;
    this.B = null; this.trial = null; this.log = []; this.events = [];
    this.lastTele = null; this.bestTele = null; this.firstTele = null;
    this.thr = 0; this.brk = 0;
    this.setLine(this.base);
  }
  // swap the driver at a stop (WEC crews, GT4 pairs): knowledge of the circuit stays with the car's notebook
  changeDriver() {
    if (this.crew.length < 2) return false;
    this.crewIdx = (this.crewIdx + 1) % this.crew.length;
    const keep = { knows: this.D.knows, speedMode: this.D.speedMode, lineMode: this.D.lineMode, trail: this.D.trail, exitThrottle: this.D.exitThrottle, targeted: this.D.targeted };
    this.D = Object.assign({}, this.driver, keep);
    this.computeBalMul();
    return true;
  }
  // put the car on track (or in the pit lane) for a new run or session
  resetRun(o) {
    const T = this.T, W = this.W;
    this.fuel = o.fuel ?? this.fuel; this.soc = this.sp.ers ? 4 : 0; this.stintE = 0; this.lapDeploy = 0; this.lapHarvest = 0;
    const comp = (o.compId && W.tyreSet(this).find(c => c.id === o.compId)) || W.defaultTyre(this);
    this.tyre = this.newTyre(comp);
    let i0;
    if (o.pos === 'grid') { i0 = ((T.N - 5 - Math.round((o.grid * 8) / T.ds)) % T.N + T.N) % T.N; this.v = o.rolling ? 42 : 0; }
    else if (o.pos === 'pit') { i0 = T.pit.exit; this.v = 20; }
    else { i0 = ((T.N - 30 - this.slot * 9) % T.N + T.N) % T.N; this.v = 28; }
    this.idx = i0;
    const side = o.pos === 'grid' ? (o.grid % 2 ? 1 : -1) * 2.4 : (this.slot % 2 ? 1 : -1) * 2.2;
    this.x = T.x[i0] + T.nx[i0] * side; this.y = T.y[i0] + T.ny[i0] * side;
    this.h = Math.atan2(T.ty[i0], T.tx[i0]); this.k = 0; this.lat = side;
    this.thr = 0; this.brk = 0; this.slip = 0; this.off = false; this.frozen = 0; this.noiseS = 0;
    this.lap = -1; this.lapT = 0; this.secT = 0; this.sec = Math.floor(i0 / T.secLen);
    this.secTimes = new Float64Array(NS); this.secInc = new Uint8Array(NS); this.incidentNow = false;
    this.tele = { t: new Float32Array(T.N), v: new Float32Array(T.N), brk: new Float32Array(T.N), thr: new Float32Array(T.N), slip: new Float32Array(T.N), st: new Float32Array(T.N), lat: new Float32Array(T.N),
                  soc: new Float32Array(T.N), fuel: new Float32Array(T.N), tw: new Float32Array(T.N), tt: new Float32Array(T.N), ttF: new Float32Array(T.N), ttR: new Float32Array(T.N) };
    this.pit = null; this.pitRequest = null; this.stops = 0; this.pitHistory = []; this.powerCap = 1; this.dnf = null; this.finishLaps = null; this.mandatoryDone = false; this.coolDown = false;
    this.passOff = 0; this.passTarget = 0; this.followCap = Infinity; this.dragMul = 1; this.aeroMul = 1; this.limiter = false; this.overtakeLap = false; this.mistakeT = 0;
    this.distance = 0; this.raceLaps = 0; this.finished = false; this.status = o.pos === 'pit' ? 'out' : 'run';
    this.tainted = false; this.trafficT = 0; this.contactT = 0; this.lapStartWear = 0; this.nextCorner = 0;
    this.compsUsed = new Set([comp.id]);
    this.trial = null; this.B = null;
    this.resetDebrief();
  }
  // everything the driver felt and the data showed this session: feeds the debrief
  resetDebrief() {
    const b = {}; for (const p of PHASES) for (const band of ['L', 'H']) b[p + band] = [0, 0];
    this.db = { b, lockF: 0, lockR: 0, wide: 0, spin: 0, wheelspin: 0, bottom: 0, bottomAt: {}, tF: [0, 0], tR: [0, 0], vmax: 0, traffic: 0, contacts: 0, laps: 0,
                wearLaps: [], flat: 0, grain: 0, mistakes: [], fuelLaps: [], cornerSlip: {} };
  }
  setLine(o) {
    this.line = makeLine(this.T, o);
    // the driver plans for the conditions it knows about: compound, rain, rubber. Wear and temperature are handled live
    const c = this.tyre ? this.tyre.comp : null;
    this.muNow = this.sp.mu * (c ? c.grip * surfaceGrip(c, this.W.weather.wet) : 1) * this.W.trackGrip * this.pressGrip(); this.planMu = this.muNow;
    if (!this.balMul) { this.balMul = new Float32Array(this.T.N).fill(1); }
    if (this.D.speedMode === 'scan' || this.D.speedMode === 'reactive' || this.D.speedMode === 'flat') {
      const N = this.T.N, lim = new Float64Array(N);
      for (let i = 0; i < N; i++) lim[i] = vLimit(this, this.line.K[i], i, this.conf[Math.floor(i / this.T.secLen)]);
      this.vlim = lim;
    }
    this.plan = this.D.speedMode === 'plan' ? planSpeed(this, this.line, this.conf, this.D) : null;
    this.ftTime = 0; if (this.plan) { const N = this.T.N; for (let i = 0; i < N; i++) if (this.plan[(i + 1) % N] > this.plan[i] + 0.01) this.ftTime += this.T.ds / Math.max(5, this.plan[i]); }
    if (this.T.corners) this.cornerPts = cornerPoints(this.T, this.T.corners, this.line, this.plan || this.vlim || (this.lastTele && this.lastTele.v));
    // balance depends on where the corners are on this line; re-plan once with it
    this.computeBalMul();
    if (this.D.speedMode === 'plan') this.plan = planSpeed(this, this.line, this.conf, this.D);
    else { const N = this.T.N; for (let i = 0; i < N; i++) this.vlim[i] = vLimit(this, this.line.K[i], i, this.conf[Math.floor(i / this.T.secLen)]); }
  }
  // tyre pressure: each compound has a best pressure for the track temperature; lower runs hotter and wears faster
  pressGrip() { const p = this.tyre ? this.tyre.press : 0, opt = -1 + (this.W.weather.track - 25) / 20; return 1 - 0.004 * (p - opt) ** 2; }
  // grip the driver is working with right now: compound, temperature window, wear, rain, rubber, pressure, flat spots
  updateGrip() {
    const ty = this.tyre, c = ty.comp, W = this.W;
    const [lo, hi] = c.win;
    const tfOf = t => t < lo ? Math.max(0.80, 1 - 0.0045 * (lo - t)) : t > hi ? Math.max(0.85, 1 - 0.006 * (t - hi)) : 1;
    const tf = 0.5 * (tfOf(ty.tempF) + tfOf(ty.tempR));
    const w = Math.max(ty.wearF, ty.wearR);
    const wf = Math.max(0.55, 1 - 0.022 * Math.min(w, 1) - (w > 1 ? 0.3 * (w - 1) : 0));
    this.tyreTF = tf; this.tyreWF = wf;
    this.muNow = this.sp.mu * c.grip * tf * wf * surfaceGrip(c, W.weather.wet) * W.trackGrip * this.pressGrip() * (1 - 0.006 * ty.flat) * (1 - 0.02 * ty.grain);
  }
  targetSpeed() {
    const T = this.T, D = this.D, N = T.N, i = this.idx, O = this.orders;
    let vt;
    if (D.speedMode === 'flat') {
      if (this.off) return this.v - 4;
      if (this.slip > 0.3) return this.v;
      vt = Math.min(this.sp.vmax * this.conf[this.sec], this.caps[(i + 2) % N]);
    } else if (D.speedMode === 'reactive') {
      const j = (i + Math.round(this.v * 0.45 / T.ds)) % N;
      vt = Math.min(this.vlim[j], this.vlim[(i + 2) % N], this.caps[(i + 2) % N]);
    } else if (D.speedMode === 'scan') {
      const look = Math.round((18 + this.v * 1.05) / T.ds); vt = this.sp.vmax;
      for (let d = 0; d <= look; d += 2) vt = Math.min(vt, this.vlim[(i + d) % N]);
    } else vt = this.plan[(i + Math.max(1, Math.round(this.v * D.lead / T.ds))) % N];
    // conditions the plan didn't know about: worn or cold tyres, rain
    vt *= Math.sqrt(Math.min(1.02, this.muNow / this.planMu));
    // following in dirty air: less downforce, so carry less speed through the corner
    if (this.aeroMul < 0.999) { const gA = gripAt(this, this.v, i, 1, this.aeroMul), g1 = gripAt(this, this.v, i, 1, 1); vt *= Math.sqrt(gA / Math.max(1e-3, g1)); }
    // the engineer's pace instruction, as far as the driver complies
    const inCorner = this.phaseMap && this.phaseMap[i] > 0;
    if (O.pace === 'push') vt *= 1 + 0.006 * D.compliance;
    else if (O.pace === 'manage' && inCorner) vt *= 1 - 0.009 * D.compliance;
    if (O.position === 'defend') vt *= 0.9985;
    if (this.mistakeT > 0) vt *= this.mistakeKind === 'wide' ? 0.9 : 0.94;
    if (this.yieldT > 0) vt *= 0.9;
    if (this.W.flag === 'fcy') vt = Math.min(vt, 80 / 3.6);
    if (this.limiter) vt = Math.min(vt, this.W.pitLimit(this));
    if (this.coolDown) vt *= 0.55;
    // lift and coast: release the throttle before each braking zone (level 1-3, or forced when fuel is short)
    const lico = Math.max(O.lico * D.compliance, this.fuelSave ? 2 : 0);
    if (lico > 0.3 && this.T.straight[this.idx] && this.T.straight[(this.idx + Math.round(this.v * (0.4 + 0.45 * lico) / this.T.ds)) % this.T.N] === 0) vt = Math.min(vt, this.v);
    return Math.min(vt, this.followCap);
  }
  // a mistake: locking a wheel, running wide, or a spin. More likely for risk takers, when pushing, in a nervous car, in the wet
  maybeMistake(cp) {
    const D = this.D, W = this.W, band = this.plan && this.plan[cp.apex] < 45 || (this.vlim && this.vlim[cp.apex] < 45) ? 'L' : 'H';
    const bE = this.bal['entry' + band], biasOff = this.setup.bias - this.biasOpt;
    let p = (D.mistakeRate || 0.05) * 0.06 * (this.orders.pace === 'push' ? 1.6 : this.orders.pace === 'manage' ? 0.6 : 1) * (W.weather.wet ? 2 : 1)
      * (1 + 3 * Math.max(0, bE - 0.1) + 2 * Math.max(0, -bE - 0.15) + 0.6 * Math.abs(biasOff)) * (this.W.session === 'quali' ? 1.3 : 1);
    if (Math.random() > p) return;
    const r = Math.random();
    let kind = Math.abs(biasOff) > 1.2 && r < 0.6 ? 'lock' : bE > 0.12 && r < 0.75 ? 'spin' : 'wide';
    if (kind === 'spin' && D.adapt > 0.7 && Math.random() < 0.7) kind = 'wide';   // a pro catches most of them
    const db = this.db, name = cp.name || `T${cp.n}`;
    this.mistakeKind = kind; this.mistakeT = kind === 'spin' ? 0 : 1.4;
    if (kind === 'lock') { const front = biasOff >= 0; front ? db.lockF++ : db.lockR++; this.tyre.flat += 0.25 + Math.random() * 0.5; this.tainted = this.tainted || 'mistake'; }
    else if (kind === 'wide') { db.wide++; this.tainted = this.tainted || 'mistake'; }
    else { db.spin++; this.frozen = 2.2; this.v = Math.min(this.v, 8); this.crashes++; this.secInc[this.sec] = 2; this.W.onIncident(this, 'spin'); }
    db.mistakes.push({ kind, corner: name, lap: this.lap + 1, t: this.W.time });
    if (db.mistakes.length > 40) db.mistakes.shift();
  }
  step(dt) {
    const T = this.T, D = this.D, N = T.N, W = this.W, sp = this.sp, O = this.orders;
    if (this.pit || this.finished && this.v < 1) return;
    this.driveTime[this.crewIdx] += dt;
    // locate along the track
    let i = this.idx;
    for (let g = 0; g < 8; g++) {
      const s = (this.x - T.x[i]) * T.tx[i] + (this.y - T.y[i]) * T.ty[i];
      if (s > T.ds * 0.5) i = (i + 1) % N; else if (s < -T.ds * 0.5) i = (i - 1 + N) % N; else break;
    }
    const prev = this.idx; this.idx = i;
    const lat = (this.x - T.x[i]) * T.nx[i] + (this.y - T.y[i]) * T.ny[i];
    this.lat = lat;
    this.updateGrip();
    if (this.mistakeT > 0) this.mistakeT -= dt;
    if (this.yieldT > 0) this.yieldT -= dt;
    if (this.frozen > 0) { this.frozen -= dt; this.lapT += dt; this.secT += dt; this.v = Math.min(this.v + 6 * dt, 12); this.advanceTiming(prev, i); return; }
    // corner entries: chance of a mistake
    const cps = this.cornerPts;
    if (cps && cps.length && !this.limiter && W.flag !== 'fcy') {
      const cp = cps[this.nextCorner % cps.length];
      if (cp && ahead(prev, cp.bs, N) < ahead(prev, i, N) + 1 && ahead(prev, i, N) < N / 2) { this.maybeMistake(cp); this.nextCorner = (this.nextCorner + 1) % cps.length; }
      else if (cp && ahead(i, cp.bs, N) > N / 2) {
        // lost track of the index (pit exit, reset): find the next corner ahead
        let best = 0, bd = 1e9; for (let c = 0; c < cps.length; c++) { const d = ahead(i, cps[c].bs, N); if (d < bd) { bd = d; best = c; } } this.nextCorner = best;
      }
    }

    // steering: pure pursuit on the driver's own line, shifted sideways when passing or defending
    this.passOff += clamp(this.passTarget - this.passOff, -2.2 * dt, 2.2 * dt);
    const L = D.la0 + D.la1 * this.v;
    const fj = i + L / T.ds, j0 = Math.floor(fj), f = fj - j0, ja = j0 % N, jb = (j0 + 1) % N;
    const lim = j => Math.max(0, T.hw[j] - CAR_HALF - 0.2);
    const wideOff = this.mistakeKind === 'wide' && this.mistakeT > 0 ? -Math.sign(this.line.K[i] || 1) * 1.5 : 0;
    const oa = clamp(this.line.o[ja] + this.passOff + wideOff, -lim(ja), lim(ja)), ob = clamp(this.line.o[jb] + this.passOff + wideOff, -lim(jb), lim(jb));
    const gx = (T.x[ja] + T.nx[ja] * oa) * (1 - f) + (T.x[jb] + T.nx[jb] * ob) * f;
    const gy = (T.y[ja] + T.ny[ja] * oa) * (1 - f) + (T.y[jb] + T.ny[jb] * ob) * f;
    const dx = gx - this.x, dy = gy - this.y, ch = Math.cos(this.h), sh = Math.sin(this.h);
    const fwd = dx * ch + dy * sh, side = -dx * sh + dy * ch, dist = Math.hypot(dx, dy);
    this.noiseS += (randn() * D.noise - this.noiseS) * Math.min(1, dt * 3);
    let kc = 2 * side / Math.max(dist * dist, 1) + this.noiseS * 0.6;
    if (fwd < 0) kc = Math.sign(side) * KMAX;
    kc = clamp(kc, -KMAX, KMAX);
    this.k += (kc - this.k) * Math.min(1, dt / D.tau);

    // pedals
    const vt = this.targetSpeed(), e = vt - this.v, m = this.mass();
    const gm = this.off ? 0.55 : 1;
    const mgEst = gripAt(this, this.v, i, this.conf[this.sec] * gm, this.aeroMul), alatNow = Math.abs(this.v * this.v * this.k + G * T.cs[i]);
    let thrCmd = 0, brkCmd = 0;
    if (D.speedMode === 'plan' && !this.limiter && this.followCap === Infinity && !(this.mistakeT > 0)) {
      const Lf = Math.max(6, this.v * 0.25), jf = (i + Math.round(Lf / T.ds)) % N, vf = this.plan[jf] * Math.sqrt(Math.min(1.02, this.muNow / this.planMu)) * (O.pace === 'push' ? 1 + 0.006 * D.compliance : 1);
      const aNeed = (vf * vf - this.v * this.v) / (2 * Lf) + this.dragAcc(this.v, i) + G * T.slope[i] + e * 0.4;
      if (aNeed >= 0) thrCmd = D.exitThrottle ? clamp(aNeed / Math.max(0.5, this.powerAcc(this.v, i, true)), 0, 1) : (e > 0 ? 1 : 0);
      else brkCmd = clamp(-aNeed / Math.max(1, gripAt(this, this.v, i, 1, this.aeroMul)), 0, 1);
      if (vt < this.v - 0.5 && brkCmd < 0.05 && e < -1) brkCmd = clamp(-e * 0.5, 0, 1);
    } else if (e > 0) thrCmd = D.exitThrottle || this.limiter ? clamp(e * Math.max(D.kp, 0.6), 0, 1) : 1;
    else brkCmd = D.trail || this.followCap < Infinity || this.limiter ? clamp(-e * Math.max(D.kp, 0.5), 0, 1) : (-e > 1.0 ? 1 : 0);
    const pTau = 0.02 + D.tau * 0.5, pa = Math.min(1, dt / pTau);
    this.thr += (thrCmd - this.thr) * pa; this.brk += (brkCmd - this.brk) * pa;
    if (this.thr < 0.002) this.thr = 0; if (this.brk < 0.002) this.brk = 0;

    // power: engine plus (F1) the battery, which empties on straights and refills under braking
    const fuelMode = O.fuel === 'rich' ? 1.03 : O.fuel === 'lean' ? 0.96 : 1;
    let Pice = sp.ice * 1000 * this.thr * fuelMode, Pk = 0, Pharv = 0;
    if (this.powerCap && W.session === 'race') Pice = Math.min(Pice, sp.ice * 1000 * this.powerCap);   // saving stint energy
    if (W.vetOut(this)) Pice *= 0.15;                          // stint energy used up: limp to the pits
    if (this.fuel <= 0 && sp.energy !== 'ev') { Pice = 0; if (!this.dnf && W.session === 'race') { this.dnf = 'Out of fuel'; W.say(`${this.label()} has run out of fuel.`); } }
    if (sp.ers) {
      const want = this.thr > 0.9 ? this.ersAvail(this.v) : 0;
      // a better driver keeps a reserve for the next straight instead of emptying the battery on the first one
      const mode = O.ers, reserve = mode === 'attack' ? 0 : mode === 'harvest' ? 2.0 : D.ersSkill * 0.4;
      const cap = (mode === 'harvest' ? 6 : 8.5) + (this.overtakeLap ? 0.5 : 0);
      // a skilled driver spreads the lap's energy over every full-throttle second instead of emptying the battery on the first straight
      const spread = D.ersSkill > 0.5 && this.ftTime > 5 && mode !== 'attack';
      const Pavg = spread ? Math.min(cap, (this.prevHarvest || 7) + Math.max(0, this.soc - 2) * 0.5) * 1e6 / this.ftTime : Infinity;
      if (want > 0 && this.soc > reserve * 0.5 && this.lapDeploy < cap) Pk = this.soc > 3.7 ? want : Math.min(want, Pavg);
      else if (this.thr > 0.95 && this.v > 60 && this.soc < (mode === 'harvest' ? 2.8 : 1.2) && (D.ersSkill > 0.5 || mode === 'harvest') && mode !== 'attack') Pharv = mode === 'harvest' ? 200e3 : 120e3;   // "super-clipping"
    }
    if (this.limiter) { Pice = Math.min(Pice, 60e3); Pk = 0; }
    this.deployNow = Pk;
    const Pwheel = Math.max(0, Pice + Pk - Pharv);
    let axT = this.v >= sp.vmax ? 0 : Math.min(sp.aMax * (this.v < 40 ? this.tractMul : 1), Pwheel / (m * Math.max(this.v, 2)));
    let axB = this.brk * gripAt(this, this.v, i, gm, this.aeroMul) * this.brakeMul * (this.mistakeKind === 'lock' && this.mistakeT > 0 ? 0.8 : 1);
    const room = Math.sqrt(Math.max(0, mgEst * mgEst - alatNow * alatNow));
    if (D.exitThrottle) axT = Math.min(axT, room);
    if (D.trail) axB = Math.min(axB, room);
    let ax = axT - axB;

    // tyres: friction circle on the real surface (slope, crest/compression, camber, downforce, slipstream/dirty air)
    const off = Math.abs(lat) > T.hw[i] + 0.4;
    this.off = off;
    const grip = gripAt(this, this.v, i, off ? 0.55 : 1, this.aeroMul);
    let ayNeed = this.v * this.v * this.k + G * T.cs[i];       // camber: gravity pulls the car down the cross-slope
    let ay = ayNeed;
    const tot = Math.hypot(ax, ay);
    this.slip = 0;
    if (tot > grip) { const s = grip / tot; ax *= s; ay *= s; this.slip = Math.min(5, (tot - grip) / grip); }
    this.ax = ax; this.ay = ay;
    const kAct = this.v > 0.5 ? (ay - G * T.cs[i]) / (this.v * this.v) : this.k;
    const scrub = this.slip * 3.5 + (off ? 4 + this.v * 0.06 : 0);
    const vOld = this.v;
    this.v = Math.max(0, this.v + (ax - this.dragAcc(this.v, i) - G * T.slope[i] - scrub) * dt);
    this.h += this.v * kAct * dt;
    this.x += this.v * Math.cos(this.h) * dt; this.y += this.v * Math.sin(this.h) * dt;
    this.lapT += dt; this.secT += dt; this.distance += this.v * dt;

    // energy book-keeping
    const Pprop = Math.max(0, axT * m * vOld) * (tot > grip ? grip / tot : 1);
    const iceShare = Math.max(0, Pprop - Pk);
    const fuelMul = O.fuel === 'rich' ? 1.07 : O.fuel === 'lean' ? 0.93 : 1;
    if (sp.energy !== 'ev') this.fuel = Math.max(0, this.fuel - (iceShare + 4e3) / (sp.eta * FUEL_MJ_PER_KG * 1e6) * fuelMul * dt);
    this.stintE += Pprop * dt / 1e6;
    if (sp.ers) {
      const brakeP = axB * m * vOld;
      const harv = Math.min(sp.ers * 1000, brakeP * 0.9) + Pharv;
      const dH = Math.min(harv * dt / 1e6, Math.max(0, 9 - this.lapHarvest), 4 - this.soc);
      this.soc += dH; this.lapHarvest += dH;
      const dD = Pk * dt / 1e6; this.soc = Math.max(0, this.soc - dD); this.lapDeploy += dD;
    }
    // tyres, per axle: braking loads the fronts, traction the driven wheels, and the end that slides works hardest
    const ph = this.phaseMap ? this.phaseMap[i] : 0, phase = ph % 3 === 1 ? 'entry' : ph % 3 === 2 ? 'mid' : ph ? 'exit' : null, band = ph > 3 ? 'H' : 'L';
    const bNow = phase ? this.bal[phase + band] : 0;
    const drive = sp.drive || 'R';
    let shareF = 0.5 - 0.25 * bNow;
    if (ax < -1) shareF += 0.12; else if (ax > 1) shareF += drive === 'F' ? 0.15 : drive === 'R' ? -0.1 : 0;
    shareF = clamp(shareF, 0.25, 0.75);
    const load = Math.hypot(ax, ay) / G, ty = this.tyre;
    const paceWear = O.pace === 'push' ? 1.25 : O.pace === 'manage' ? 0.72 : 1;
    const work = Math.pow(load, 1.6) * vOld / 50 * (1 + 3 * this.slip) * (off ? 1.5 : 1);
    // carcass temperature heads for a level set by how hard the tyre works; lower pressure runs hotter; heat soaks in over ~20 s
    const heat = (30 + 50 * Math.min(1, load * vOld / 45 / 2.2)) * (W.weather.wet && !ty.comp.wet ? 0.55 : 1) + (O.pace === 'push' ? 4 : O.pace === 'manage' ? -5 : 0) - 2.5 * ty.press;
    const tTF = W.weather.track + heat * (1 + 1.2 * (shareF - 0.5)), tTR = W.weather.track + heat * (1 - 1.2 * (shareF - 0.5));
    const kT = Math.min(1, dt / 20);
    ty.tempF += (tTF - ty.tempF) * kT; ty.tempR += (tTR - ty.tempR) * kT; ty.temp = 0.5 * (ty.tempF + ty.tempR);
    const hotF = ty.tempF > ty.comp.win[1] ? 1 + (ty.tempF - ty.comp.win[1]) * 0.05 : 1, hotR = ty.tempR > ty.comp.win[1] ? 1 + (ty.tempR - ty.comp.win[1]) * 0.05 : 1;
    const wbase = work * W.wearK(ty.comp, this) * (2 - D.tyreCare) * paceWear * this.camberWear * (1 + 0.04 * Math.max(0, -ty.press)) * dt * 2;
    ty.wearF += wbase * shareF * hotF; ty.wearR += wbase * (1 - shareF) * hotR; ty.wear = Math.max(ty.wearF, ty.wearR);
    // graining: a cold tyre that slides tears its surface; it cleans up as the tyre comes into its window
    if (ty.temp < ty.comp.win[0] - 10 && this.slip > 0.05) ty.grain = Math.min(1, ty.grain + this.slip * dt * 0.2);
    else if (ty.grain > 0) ty.grain = Math.max(0, ty.grain - dt * 0.004);
    // traction: wheelspin out of slow corners in a car that oversteers on power
    if (phase === 'exit' && band === 'L' && this.thr > 0.9 && bNow > 0.12 && drive !== 'F' && Math.random() < dt * 2 * (bNow - 0.12) * (sp.ice / 400)) { this.db.wheelspin++; ty.wearR += 0.002; }
    // debrief data: balance felt in each phase, temperatures, bottoming
    const db = this.db;
    if (phase && vOld > 15) { const e2 = db.b[phase + band]; e2[0] += bNow * dt; e2[1] += dt; }
    db.tF[0] += ty.tempF * dt; db.tF[1] += dt; db.tR[0] += ty.tempR * dt; db.tR[1] += dt;
    if (vOld > db.vmax) db.vmax = vOld;
    if (vOld * vOld * T.kv[i] > this.bottomLim && !this.wasBottom) { db.bottom++; const nm = W.cornerAt(i); db.bottomAt[nm] = (db.bottomAt[nm] || 0) + 1; }
    this.wasBottom = vOld * vOld * T.kv[i] > this.bottomLim;

    if (off) this.incidentNow = true;
    if (off && !this.wasOff && D.usesCaps) {
      let back = Math.round((20 + this.v * 0.9) / T.ds), rs = 0;
      while (rs < 200 && this.caps[((i - rs - 1) % N + N) % N] < sp.vmax) rs++;
      back = Math.max(back, rs + Math.round(30 / T.ds));
      const vNew = Math.max(10, this.v * 0.82);
      for (let d = -back; d <= 4; d++) { const j = ((i + d) % N + N) % N; this.caps[j] = Math.min(this.caps[j], vNew); }
    }
    this.wasOff = off;

    const ti = this.tele; ti.t[i] = this.lapT; ti.v[i] = this.v; ti.brk[i] = this.brk; ti.thr[i] = this.thr; ti.slip[i] = this.slip;
    ti.st[i] = Math.atan(this.k * (sp.wb || 3)) * 180 / Math.PI; ti.lat[i] = lat;
    ti.soc[i] = this.soc; ti.fuel[i] = this.fuel; ti.tw[i] = ty.wear; ti.tt[i] = ty.temp; ti.ttF[i] = ty.tempF; ti.ttR[i] = ty.tempR;

    if (Math.abs(lat) > T.hw[i] + 16 || (off && this.v < 3)) {
      // a real off: recover to the track; a hard one breaks the front wing
      if (vOld > 40 && Math.random() < 0.25) { this.damage.wing = Math.min(1, this.damage.wing + 0.3 + Math.random() * 0.5); this.applySetup(); }
      this.x = T.x[i]; this.y = T.y[i]; this.h = Math.atan2(T.ty[i], T.tx[i]); this.v = 4; this.k = 0;
      this.frozen = 1.5; this.crashes++; this.secInc[this.sec] = 2;
      this.events.push({ t: 'crash', i }); W.onIncident(this, 'crash');
    }
    this.advanceTiming(prev, i);
  }
