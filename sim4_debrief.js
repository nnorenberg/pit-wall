// ===== driver debriefs: what the driver felt, what the data says, what the driver asks for =====
// A Pro reports the balance in each phase and speed band almost exactly and names the setup change;
// a Rookie's impressions are noisy, sometimes inverted, and rarely say where.
const PHASE_WORD = { entry: 'on entry', mid: 'mid-corner', exit: 'on exit' }, BAND_WORD = { L: 'slow corners', H: 'fast corners' };
function bWord(b) { return b < -0.2 ? 'heavy understeer' : b < -0.07 ? 'understeer' : b > 0.2 ? 'big oversteer' : b > 0.07 ? 'oversteer' : 'neutral'; }
function makeDebrief(car, W) {
  const D = car.driver, db = car.db, fb = D.feedback, r = rng(hash32(car.slot + ':' + W.sessionKey + ':' + Math.round(W.time)));
  const n01 = () => (r() + r() + r() - 1.5) / 1.5;
  const data = { balance: {}, felt: {}, temps: {}, wear: {}, events: {} };
  // what the data shows: time-weighted balance per phase/band, axle temperatures, wear per lap
  for (const k in db.b) { const [s, t] = db.b[k]; data.balance[k] = t > 2 ? s / t : null; }
  const win = car.tyre.comp.win;
  data.temps = { F: db.tF[1] ? db.tF[0] / db.tF[1] : null, R: db.tR[1] ? db.tR[0] / db.tR[1] : null, win };
  const wl = db.wearLaps.slice(-8);
  data.wear = { F: wl.length ? wl.reduce((a, b) => a + b.F, 0) / wl.length : null, R: wl.length ? wl.reduce((a, b) => a + b.R, 0) / wl.length : null, laps: wl.length };
  data.events = { lockF: db.lockF, lockR: db.lockR, wide: db.wide, spin: db.spin, wheelspin: db.wheelspin, bottom: db.bottom, bottomAt: db.bottomAt, contacts: db.contacts, traffic: db.traffic };
  const rivals = W.cars.filter(c => c.sp.cls === car.sp.cls && c !== car);
  data.vmax = db.vmax * 3.6; data.vmaxRivals = rivals.length ? Math.max(...rivals.map(c => c.db.vmax)) * 3.6 : null;
  data.fuelLap = db.fuelLaps.length ? db.fuelLaps.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, db.fuelLaps.length) : null;
  data.best = car.best; data.laps = db.laps; data.damage = Object.assign({}, car.damage);
  // what the driver felt: noise and, for the least experienced, the occasional inversion
  for (const k in data.balance) {
    const b = data.balance[k]; if (b == null) { data.felt[k] = null; continue; }
    let f = b + n01() * (1 - fb) * 0.22;
    if (r() < (1 - fb) * 0.25) f = -f;
    data.felt[k] = f;
  }
  const lines = [], requests = [], R = setupRange(car.sp), s = car.setup;
  const req = (key, delta, why) => {
    if (requests.some(q => q.key === key)) return;
    const v = clamp(s[key] + delta, R[key][0], R[key][1]); if (v === s[key]) return;
    requests.push({ key, delta, to: v, why });
  };
  const pro = fb > 0.85, good = fb > 0.65, ok = fb > 0.45;
  const P = D.persona;
  // balance: report the biggest problems, in the order they cost time
  const issues = Object.entries(data.felt).filter(([k, f]) => f != null && Math.abs(f) > (pro ? 0.07 : 0.1) && Math.abs(f - D.pref * 0.5) > 0.05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, pro ? 4 : good ? 2 : 1);
  for (const [k, f] of issues) {
    const phase = k.slice(0, -1), band = k.slice(-1), u = f < 0;
    if (pro) lines.push(`${cap(BAND_WORD[band])} ${PHASE_WORD[phase]}: ${bWord(f)}, I'd say ${Math.abs(f).toFixed(2)} on our scale${D.pref > 0.12 && u ? ' and I like the front sharper than this' : D.pref < -0.12 && !u ? ', and you know I want a stable rear' : ''}.`);
    else if (good) lines.push(`I'm getting ${bWord(f)} ${PHASE_WORD[phase]}, mostly in the ${BAND_WORD[band]}.`);
    else if (ok) lines.push(u ? `The car doesn't want to turn.` : `The rear feels loose.`);
    else lines.push(r() < 0.5 ? `The car feels weird, I can't trust it.` : `It's just slow, I don't know why.`);
    if (!ok) continue;
    // the change a driver asks for (the Pro gets it right; others guess)
    if (phase === 'entry') { if (band === 'H') req('wingF', u ? 1 : -1, `${bWord(f)} on entry at speed`); else if (r() < 0.6 || pro) req('bias', u ? -1 : 1, `${bWord(f)} on the brakes`); else req('diffEn', u ? -1 : 1, `${bWord(f)} on entry`); }
    if (phase === 'mid') { if (band === 'H') req(u ? 'wingF' : 'wingR', 1, `${bWord(f)} mid-corner at speed`); else req(u ? 'arbF' : 'arbR', -1, `${bWord(f)} in the slow corners`); }
    if (phase === 'exit') req('diffEx', u ? -1 : 1, `${bWord(f)} on power`);
  }
  if (!issues.length && ok) lines.push(pro ? `Balance is where I want it. Don't touch it.` : `The balance is OK.`);
  // brakes
  const lk = data.events.lockF + data.events.lockR;
  if (lk) {
    const front = data.events.lockF >= data.events.lockR;
    if (good) { lines.push(`${lk} lock-up${lk > 1 ? 's' : ''}, ${front ? 'fronts' : 'rears'}.${pro ? ` Bias is ${s.bias.toFixed(1)}%, move it ${front ? 'back' : 'forward'} half a percent.` : ''}`); req('bias', front ? -0.5 : 0.5, `${front ? 'front' : 'rear'} lock-ups`); }
    else lines.push(`I locked up a couple of times.`);
  }
  if (car.tyre.flat > 0.5 && ok) lines.push(`There's a vibration from a flat spot.`);
  // tyres: temperatures against the window, front-rear split, wear per lap
  const [lo, hi] = win, tF = data.temps.F, tR = data.temps.R;
  if (tF && tR && ok) {
    const hot = Math.max(tF, tR) > hi, cold = Math.min(tF, tR) < lo;
    if (pro) lines.push(`Tyres: fronts ${Math.round(tF)}°C, rears ${Math.round(tR)}°C against a ${lo}–${hi} window.${hot ? ` ${tF > tR ? 'Fronts' : 'Rears'} overheating late in the run.` : cold ? ` Struggling to switch them on.` : ''}`);
    else if (hot) lines.push(`The tyres went off, they were overheating.`);
    else if (cold) lines.push(`Couldn't get heat in the tyres.`);
    if (hot) req('press', 1, 'tyres overheating'); else if (cold) req('press', -1, 'tyres too cold');
  }
  if (data.wear.F != null && pro) {
    const lapsLeft = Math.min((1 - car.tyre.wearF) / Math.max(1e-4, data.wear.F), (1 - car.tyre.wearR) / Math.max(1e-4, data.wear.R));
    lines.push(`Degradation: ${(data.wear.F * 100).toFixed(1)}% front, ${(data.wear.R * 100).toFixed(1)}% rear per lap; about ${Math.max(0, Math.round(lapsLeft))} laps left before they fall off.`);
  }
  // traction, bottoming, straight-line speed
  if (data.events.wheelspin > 2 && ok) { lines.push(pro ? `Wheelspin out of the slow stuff, ${data.events.wheelspin} times. More diff lock on power.` : `Lots of wheelspin.`); req('diffEx', 1, 'wheelspin'); }
  if (data.events.bottom > 2) {
    const where = Object.entries(data.events.bottomAt).sort((a, b) => b[1] - a[1])[0];
    if (good) { lines.push(`It's bottoming${where && pro ? ` at ${where[0]}` : ''}${pro ? `, ${data.events.bottom} hits. One step up on ride height.` : '.'}`); req('ride', 1, 'bottoming'); }
    else if (ok) lines.push(`The car hits the ground somewhere.`);
  }
  if (data.vmaxRivals && data.vmax < data.vmaxRivals - 4 && good) { lines.push(pro ? `We're ${Math.round(data.vmaxRivals - data.vmax)} km/h down at the speed trap. If the balance allows, take a click of rear wing off.` : `We're slow on the straights.`); if (pro) req('wingR', -1, 'top speed'); }
  if (car.damage.wing > 0.2 || car.damage.floor > 0.2) lines.push(good ? `There's damage: ${car.damage.wing > 0.2 ? 'front wing ' + Math.round(car.damage.wing * 100) + '%' : ''}${car.damage.floor > 0.2 ? ' floor ' + Math.round(car.damage.floor * 100) + '%' : ''}. I lost downforce.` : `I think I broke something.`);
  // mistakes and traffic
  if (data.events.spin && ok) lines.push(`Sorry about the spin${data.events.spin > 1 ? 's' : ''}.${P === 'risktaker' ? ` I was trying something.` : ''}`);
  if (data.events.traffic > 20 && good) lines.push(`Lost a lot of time in traffic, ${Math.round(data.events.traffic)} s stuck in dirty air.`);
  if (data.fuelLap && pro && car.sp.energy !== 'ev') lines.push(`Fuel: ${data.fuelLap.toFixed(2)} kg per lap${car.sp.energy === 'f1' ? `, and the battery's ${car.soc < 1 ? 'running flat on the straights' : 'fine'}` : ''}.`);
  if (!lines.length) lines.push(`Nothing much to say.`);
  return { slot: car.slot, driver: `${D.first} ${D.last}`, skill: D.skill, persona: D.persona, lines, requests, data, session: W.sessionKey, accuracy: fb };
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
