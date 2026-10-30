const S = require('./sim4.js');
const [trk, cls, scale] = [process.argv[2] || 'spa', process.argv[3] || 'f1', +(process.argv[4] || 0.25)];
const cfg = { trackId: trk, classIds: cls.split(','), grid: {}, raceScale: scale };
for (const c of cfg.classIds) cfg.grid[c] = { pro: 3, semi: 3, club: 3, amateur: 3, novice: 3, rookie: 3 };
const W = new S.World(cfg);
const run = key => { W.startSession('weekend', key); const t0 = Date.now(); while (!W.ended && W.time < 30000) W.step(S.DT); return Date.now() - t0; };
W.startSession('weekend', W.format[0].key); while (W.time < 25 * 60) W.step(S.DT); W.ended = true; W.results = W.practiceResults(); W.finishSession();
const d = W.debriefs[0]; console.log('DEBRIEF', d.driver, d.skill, '\n  ' + d.lines.join('\n  '), '\n  requests', JSON.stringify(d.requests));
const d2 = W.debriefs.find(x => x.skill === 'rookie'); console.log('ROOKIE', d2.lines.join(' | '));
// engineer applies the pro's requests
const c0 = W.cars[0]; const ch = {}; for (const r of d.requests) ch[r.key] = r.to; console.log('setup cmd:', W.command(c0, { type: 'setup', changes: ch }));
const qk = W.format.find(s => s.type === 'quali').key;
console.log('quali ms', run(qk)); console.log(W.msgs.slice(-4).map(m => m.text).join('\n'));
W.command(W.cars[W.grid[0]], { type: 'owner', value: 'user' });
const rk = W.format.filter(s => s.type === 'race').slice(-1)[0].key;
console.log('race ms', run(rk));
for (const r of W.results.slice(0, 12)) { const c = W.cars[r.car]; console.log(r.pos, r.classPos, c.label().padEnd(18), c.sp.name.padEnd(26), c.D.skill.padEnd(7), r.laps, r.dnf || '', S.fmtT(r.best), 'stops', r.stops, r.comps.join('')); }
console.log(W.msgs.filter(m => /pitting|yellow|Strategist|wins/.test(m.text)).slice(0, 12).map(m => m.text).join('\n'));
console.log('radio of user car:', (W.cars[W.grid[0]].radio || []).map(r => r.text).slice(-4).join(' | '));
