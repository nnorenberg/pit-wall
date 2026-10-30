// every calendar round, every session of its real format, at reduced distance: exceptions, NaN, stalls
const S = require('./sim4.js'); const fs = require('fs');
eval(fs.readFileSync('caldata.js', 'utf8').replace(/^const /mg, 'global.'));
const [series, idx] = [process.argv[2], +process.argv[3]];
const CLS = { f1: ['f1'], wec: ['hyper', 'gt3'], gt4: ['gt4'], tcr: ['tcr'] }[series];
const r = CAL_DATA[series][idx]; const out = [];
try {
  const cfg = { trackId: r.track, classIds: CLS, grid: {}, raceScale: 0.08, sprint: !!r.sprint, wecHours: r.hours || null, alloc: (series === 'f1' && ALLOC_DATA[r.track]) || null };
  for (const c of CLS) cfg.grid[c] = series === 'f1' ? { pro: 6, semi: 4, club: 4, amateur: 3, novice: 3, rookie: 2 } : { pro: 3, semi: 2, club: 2, amateur: 2, novice: 2, rookie: 1 };
  const W = new S.World(cfg);
  for (const f of W.format) {
    W.startSession('weekend', f.key); const t0 = Date.now(); const cap = f.type === 'race' ? 4 * 3600 : 20 * 60;
    while (!W.ended && W.time < cap && Date.now() - t0 < 60000) W.step(S.DT);
    if (!W.ended) { W.ended = true; if (f.type !== 'race' && W.practiceResults) W.results = W.practiceResults(); if (W.finishSession) W.finishSession(); out.push(f.key + ':capped'); }
    const bests = W.cars.map(c => c.best).filter(b => b && isFinite(b));
    const P = JSON.parse(require('fs').readFileSync('poles.json'));
    const fast = W.cars.filter(c => isFinite(c.best) && P[c.sp.cls] && P[c.sp.cls][r.track] && c.best < 0.97 * P[c.sp.cls][r.track]).length;
    const nan = 0;
    const bad = W.cars.filter(c => !isFinite(c.x) || !isFinite(c.v)).length;
    out.push(`${f.key}:${bests.length ? S.fmtT(Math.min(...bests)) : 'nolap'}${bad ? ' NAN' + bad : ''}${fast ? ' FAST' + fast : ''} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (!W.debriefs || !W.debriefs.length) out.push('NODEBRIEF');
  }
  console.log('OK', series, r.round, r.track, out.join(' | '));
} catch (e) { console.log('ERR', series, r.round, r.track, out.join(' | '), e.message, (e.stack || '').split('\n')[1]); }
