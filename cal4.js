// per-circuit grip calibration: a Pro in the reference car, new softs, low fuel, rubbered track, matches the real pole
const S = require('./sim4.js'), fs = require('fs');
const POLE = JSON.parse(fs.readFileSync('poles.json')), out = fs.existsSync('trackcal.json') ? JSON.parse(fs.readFileSync('trackcal.json')) : {};
const only = process.argv.slice(2);
function qlap(trk, cls, f) {
  out[trk] = out[trk] || {}; out[trk][cls] = f; S.TRACKCAL_SET(out);
  const W = new S.World({ trackId: trk, classIds: [cls], grid: { [cls]: { pro: 1 } } }); W.rubber = 2000;
  const c = W.cars[0]; W.session = 'quali'; W.qPart = 0; const comp = W.dryTyres(c)[0].id; W.session = 'practice'; c.resetRun({ fuel: c.sp.fuelQ, compId: comp }); c.conf.fill(c.D.confMax); c.setLine(c.base);
  let n = 0; while (c.laps.length < 3 && n < 3 * 400 * 120) { W.step(S.DT); n++; }
  return { t: Math.min(...c.laps.slice(1).map(l => l.t)), gap: c.sp.gap };
}
for (const cls in POLE) for (const trk in POLE[cls]) {
  if (process.env.CLS && cls !== process.env.CLS) continue;
  if (!S.TRACKDATA[trk] || (only.length && !only.includes(trk))) continue;
  const target0 = POLE[cls][trk];
  let lo = 0.75, hi = 1.3, r;
  for (let it = 0; it < 9; it++) { const m = (lo + hi) / 2; r = qlap(trk, cls, m); if (r.t > target0 + r.gap) lo = m; else hi = m; }
  const f = +((lo + hi) / 2).toFixed(4); r = qlap(trk, cls, f);
  console.log(cls.padEnd(6), trk.padEnd(14), 'factor', f, S.fmtT(r.t), 'target', S.fmtT(target0 + r.gap), '(pole ' + S.fmtT(target0) + ')');
  fs.writeFileSync('trackcal.json', JSON.stringify(out));
}
