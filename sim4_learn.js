  advanceTiming(prev, i) {
    const T = this.T, sec = Math.floor(i / T.secLen);
    if (this.incidentNow) { if (!this.secInc[this.sec]) this.secInc[this.sec] = 1; this.incidentNow = false; }
    if (sec === (this.sec + 1) % NS && ahead(prev, i, T.N) < T.N / 2) {
      this.secTimes[this.sec] = this.secT; this.secT = 0;
      if (sec === 0) this.finishLap();
      this.sec = sec;
      if (this.lap >= 0 || sec === 0) this.secInc[sec] = 0;
    }
  }
  finishLap() {
    if (this.lap >= 0) {
      const t = this.lapT;
      const inc = Array.from(this.secInc).some(x => x === 2);
      this.lastLap = t;
      const W = this.W;
      const ty = this.tyre;
      const rec = { lap: this.lap + 1, t, crash: inc, trial: !!this.trial, comp: ty.comp.id, wear: +ty.wear.toFixed(3), wearF: +ty.wearF.toFixed(3), wearR: +ty.wearR.toFixed(3), fuel: +this.fuel.toFixed(1),
                    pit: this.tainted === 'pit', session: W.session, sessionKey: W.sessionKey, mode: W.mode, valid: !inc && !this.tainted, driver: this.crewIdx, age: ty.age + 1,
                    sec: Array.from(this.secTimes) };
      const db = this.db; db.laps++;
      if (rec.valid && this.lapWearRef) db.wearLaps.push({ F: ty.wearF - this.lapWearRef.F, R: ty.wearR - this.lapWearRef.R, t, age: ty.age + 1 });
      if (this.lapFuelRef != null && rec.valid) db.fuelLaps.push(this.lapFuelRef - this.fuel);
      this.laps.push(rec);
      this.tyre.age++; this.raceLaps++; this.prevHarvest = this.lapHarvest > 1 ? this.lapHarvest : this.prevHarvest; this.lapDeploy = 0; this.lapHarvest = 0; this.lapE = this.stintE - (this.lapStartE || 0); this.lapStartE = this.stintE;
      W.onLap(this, rec);
      const snap = () => { const o = { lap: rec.lap, lapTime: t }; for (const k in this.tele) o[k] = Float32Array.from(this.tele[k]); return o; };
      if (!inc && !this.firstTele) this.firstTele = snap();
      if (t < this.best && rec.valid) { this.best = t; this.bestTele = snap(); }
      this.lastTele = snap();
      if (W.learning() && !this.tainted && this.trafficT < 0.15 * t) this.learn();
      else if (this.trial) { for (const p of this.trial.items) this.undo(p); this.trial = null; this.setLine(this.base); }
      this.tainted = false; this.trafficT = 0;
    }
    this.lap++; this.lapT = 0; this.lapWearRef = { F: this.tyre.wearF, R: this.tyre.wearR }; this.lapFuelRef = this.fuel;
  }
  confTrial(i, step) {
    const old = this.conf[i];
    this.conf[i] = clamp(old * Math.exp(step), 0.12, this.D.confMax);
    return { sec: i, kind: 'conf', old, val: this.conf[i] };
  }
  lineTrial(i, c, amp, w, at, corner) {
    const T = this.T, span = Math.ceil(w * 3), from = ((c - span) % T.N + T.N) % T.N, oldSlice = [];
    for (let d = 0; d <= 2 * span; d++) {
      const j = (from + d) % T.N; oldSlice.push(this.base[j]);
      const z = (d - span) / w;
      const bj = Math.max(0, T.hw[j] - CAR_HALF - 0.25); this.base[j] = clamp(this.base[j] + amp * Math.exp(-0.5 * z * z), -bj, bj);
    }
    return { sec: i, kind: 'line', from, oldSlice, amp, at, corner };
  }
  undo(p) {
    if (p.kind === 'conf') this.conf[p.sec] = p.old;
    else for (let d = 0; d < p.oldSlice.length; d++) this.base[(p.from + d) % this.T.N] = p.oldSlice[d];
  }
  // a coached experiment: the coach picks the corner and the direction, the stopwatch still decides
  coachTrial(cj, i) {
    const T = this.T, D = this.D;
    const cps = (this.cornerPts || []).filter(cp => cj.corners.includes(cp.n) && Math.floor(cp.apex / T.secLen) === i);
    const cp = cps[Math.floor(Math.random() * cps.length)];
    const push = D.sConf * 1.5 + 0.02;
    let p;
    if (cj.type === 'brake_later' || cj.type === 'more_speed') p = this.confTrial(i, push * (0.6 + Math.random() * 0.8));
    else if (cj.type === 'brake_earlier' || cj.type === 'less_speed') p = this.confTrial(i, -push * (0.6 + Math.random() * 0.8));
    else if (cp) {
      const inside = Math.sign(this.line.K[cp.apex]) || 1, amp = (0.7 + Math.random() * 1.1);
      const plan = {
        late_apex: [cp.ti, -inside, 'turn-in'], early_apex: [cp.ti, inside, 'turn-in'], wider_entry: [(cp.ti - 6 + T.N) % T.N, -inside, 'entry'],
        tighter_apex: [cp.apex, inside, 'apex'], wider_exit: [cp.to, -inside, 'exit'],
      }[cj.type] || [cp.apex, inside, 'apex'];
      p = this.lineTrial(i, plan[0], plan[1] * amp, (14 + Math.random() * 16) / T.ds, plan[2], cp.n);
    } else p = this.confTrial(i, D.sConf * randn());
    p.coach = cj.id;
    return p;
  }
  addCoaching(cmd) {
    // cmd: { type, corners: [turn numbers], laps }
    const T = this.T, D = this.D, out = [];
    const learnt = n => { if (!D.knows.includes(n)) D.knows.push(n); };
    const rebase = () => { if (this.trial) for (const p of this.trial.items) this.undo(p); this.trial = null; this.B = null; this.setLine(this.base); };
    switch (cmd.type) {
      case 'learn_braking_zones':
        if (D.speedMode === 'plan') { out.push('already plans braking zones'); break; }
        D.speedMode = 'plan'; D.brakeEff = 0.8; D.kp = Math.max(D.kp, 0.9); D.lead = 0.18; D.trail = false;
        for (let i = 0; i < NS; i++) this.conf[i] = clamp(this.conf[i], 0.8, 0.95);
        learnt('Braking zones'); rebase(); out.push('now plans a braking zone back from every apex'); break;
      case 'learn_trail_braking':
        if (D.trail) { out.push('already trail-brakes'); break; }
        if (D.speedMode !== 'plan') { D.speedMode = 'plan'; D.brakeEff = 0.8; D.kp = Math.max(D.kp, 0.9); D.lead = 0.18; for (let i = 0; i < NS; i++) this.conf[i] = clamp(this.conf[i], 0.8, 0.95); learnt('Braking zones'); }
        D.trail = true; learnt('Trail braking'); rebase(); out.push('now keeps some brake on while turning in'); break;
      case 'learn_racing_line': {
        if (!T._minc) T._minc = initialOffsets(T, 'minc');
        const mix = D.lineMode === 'minc' ? 0 : D.lineMode === 'minc60' ? 0.7 : 0.5;
        if (!mix) { out.push('already uses the full width'); break; }
        for (let i = 0; i < T.N; i++) this.base[i] = this.base[i] * (1 - mix) + T._minc[i] * mix;
        D.lineMode = mix >= 0.7 ? 'minc' : 'minc60'; learnt('Racing line'); rebase(); out.push('moved its line toward outside-inside-outside arcs'); break;
      }
      case 'learn_exit_throttle':
        if (D.exitThrottle) { out.push('already feeds the throttle in'); break; }
        D.exitThrottle = true; D.kp = Math.max(D.kp, 0.8); learnt('Exit throttle'); rebase(); out.push('now squeezes the throttle as the wheel unwinds'); break;
      case 'learn_corner_phases':
        if (D.targeted) { out.push('already works corner by corner'); break; }
        D.targeted = true; learnt('Corner phases'); learnt('Apex choice'); out.push('now aims experiments at turn-in, apex and exit'); break;
      case 'smoother':
        D.tau = Math.max(0.04, D.tau * 0.8); D.noise = Math.max(0.0002, D.noise * 0.65); D.la1 = Math.min(0.29, D.la1 + 0.02);
        if (D.tau <= 0.07) learnt('Smooth hands');
        rebase(); out.push(`steering response now ${Math.round(D.tau * 1000)} ms`); break;
      case 'explore_more': D.sConf *= 1.3; D.sLine *= 1.3; out.push('will try bigger changes'); break;
      case 'explore_less': D.sConf *= 0.75; D.sLine *= 0.75; out.push('will try smaller changes'); break;
      default: {
        const corners = (cmd.corners || []).filter(n => this.cornerPts && this.cornerPts.some(cp => cp.n === n));
        if (!corners.length) { out.push('no corner to work on'); break; }
        const secs = [...new Set(corners.map(n => Math.floor(this.cornerPts.find(cp => cp.n === n).apex / T.secLen)))];
        this.coach = this.coach.filter(c => c.lapsLeft > 0 && !(c.type === cmd.type && c.corners.some(n => corners.includes(n))));
        this.coach.push({ id: ++this.coachSeq, type: cmd.type, corners, secs, lapsLeft: Math.max(2, Math.min(12, cmd.laps || 6)), tries: 0, kept: 0, gain: 0 });
        out.push(`queued ${Math.max(2, Math.min(12, cmd.laps || 6))} laps of experiments`);
      }
    }
    return out.join('; ');
  }
  learn() {
    const D = this.D, T = this.T, t = this.secTimes, inc = this.secInc;
    const pair = i => t[i] + t[(i + 1) % NS];
    const bad = i => inc[i] || inc[(i + 1) % NS];
    const tr = this.trial;
    const pert = new Uint8Array(NS); if (tr) for (const p of tr.items) pert[p.sec] = 1;
    if (!this.B) { this.B = new Float64Array(NS); for (let i = 0; i < NS; i++) this.B[i] = bad(i) ? 1e9 : pair(i); }
    else {
      if (tr) for (const p of tr.items) {
        const i = p.sec;
        this.attempts++;
        const oldB = this.B[i];
        p.delta = oldB > 1e8 ? null : pair(i) - oldB; p.offTrack = !!bad(i);
        if (!bad(i) && pair(i) < this.B[i] - 0.003) { this.B[i] = pair(i); this.improvements++; p.kept = true; }
        else { this.undo(p); p.kept = false; }
        if (p.coach) {
          const cj = this.coach.find(c => c.id === p.coach);
          if (cj) { cj.tries++; if (p.kept) { cj.kept++; cj.gain += p.delta == null ? 0 : -p.delta; } cj.lapsLeft--; if (cj.lapsLeft <= 0) this.radio.push({ kind: 'report', job: cj }); }
        }
        this.log.push({ lap: this.lap + 1, sec: i, kind: p.kind, kept: p.kept, delta: p.delta, off: p.offTrack, amp: p.amp, old: p.old, val: p.val, at: p.at, corner: p.corner, coach: !!p.coach });
      }
      if (this.log.length > 60) this.log.splice(0, this.log.length - 60);
      for (let i = 0; i < NS; i++) {
        if (pert[i] || pert[(i + 1) % NS] || pert[(i - 1 + NS) % NS]) continue;
        if (inc[i] === 2 || (inc[i] && D.speedMode === 'flat')) { this.conf[i] = Math.max(0.12, this.conf[i] * (inc[i] === 2 ? 0.85 : D.speedMode === 'flat' ? 0.93 : 0.97)); this.B[i] = 1e9; }
        else if (!bad(i)) this.B[i] = pair(i);
      }
    }
    if (D.usesCaps) for (let j = 0; j < T.N; j++) { if (!inc[Math.floor(j / T.secLen)] && this.caps[j] < this.sp.vmax) this.caps[j] = Math.min(this.sp.vmax, this.caps[j] * 1.015); }
    this.lastTrial = tr;
    // new trial: perturb every 4th sector; a coaching job picks which set of four
    const active = this.coach.filter(c => c.lapsLeft > 0), cj = active.length ? active[this.lap % active.length] : null;
    let phase = this.lap % 4, coachSec = -1;
    if (cj) { coachSec = cj.secs[(cj.tries + this.lap) % cj.secs.length]; phase = coachSec % 4; }
    const items = [];
    for (let i = phase; i < NS; i += 4) {
      if (i === coachSec) { items.push(this.coachTrial(cj, i)); continue; }
      if (Math.random() >= D.pLine) { items.push(this.confTrial(i, D.sConf * randn() + (D.speedMode === 'flat' ? 0 : D.sConf * 0.3))); continue; }
      let c = Math.floor((i + Math.random()) * T.secLen), at = null, corner = null;
      if (D.targeted && this.cornerPts) {
        const inSec = this.cornerPts.filter(cp => Math.floor(cp.apex / T.secLen) === i);
        if (inSec.length) { const cp = inSec[Math.floor(Math.random() * inSec.length)], k = Math.floor(Math.random() * 3); c = [cp.ti, cp.apex, cp.to][k] + Math.round(randn() * 3); at = ['turn-in', 'apex', 'exit'][k]; corner = cp.n; }
      }
      items.push(this.lineTrial(i, c, randn() * D.sLine, (12 + Math.random() * 30) / T.ds, at, corner));
    }
    this.coach = this.coach.filter(c => c.lapsLeft > 0);
    this.trial = { items };
    this.setLine(this.base);
  }
}

