import re, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
p = open('page2.html').read()
def R(a, b, cnt=1):
    global p
    assert a in p, 'MISSING: ' + a[:100]
    p = p.replace(a, b, cnt)
def RX(pat, rep):
    global p
    n = len(re.findall(pat, p)); assert n, 'MISSING RX ' + pat
    p = re.sub(pat, rep, p)
# ---------------- HTML ----------------
R('<p>Six AI drivers learning real circuits, from a Rookie who has never braked for a corner to a Pro who plans every arc. Coach them on the radio, then check their pace against real qualifying and race data.</p>',
  '<p>You run the pit wall. Build a grid from Rookies to Pros, set the cars up, call the stops, manage tyres, fuel and energy, and hear from the drivers after every session, on measured models of the real 2026 circuits.</p>')
R('<a class="btn" href="#reference">Reference</a>', '<a class="btn" href="#grid-panel">Grid</a><a class="btn" href="#champ">Championship</a><a class="btn" href="#reference">Reference</a>')
R('<section class="panel rc" aria-label="Race control">', '<section class="panel rc" id="rc-anchor" aria-label="Race control">')
R('<select id="sess"><option value="practice">Practice</option><option value="quali">Qualifying</option><option value="race">Race</option></select>', '<select id="sess"></select>')
R('aria-label="Top-down view of the circuit with six cars"', 'aria-label="Top-down view of the circuit and every car"')
R('<div class="tower-head"><h2>Timing</h2><span>best · gap · kept/tried</span></div>', '<div class="tower-head"><h2>Timing</h2><span>best · gap · tyres</span></div>')
R('<div class="tower-foot">Click a driver or a car to select it. The desk, the radio and the telemetry follow your selection.</div>', '<div class="tower-foot">Click a car to select it. The desk, the pit wall, the setup sheet and the telemetry follow your selection.</div>')
a = p.index('  <section class="panel radio" aria-label="Team radio">'); b = p.index('  <section class="panel chart-card" id="results-panel"')
p = p[:a] + open('page4_sections.html').read() + p[b:]
# ---------------- CSS ----------------
R('</style>', open('page4.css').read() + '\n</style>')
# ---------------- JS: state ----------------
R('let selected = 5,', 'let selected = 0,')
R('const cmp = { drivers: new Set([5]), lap: "best", zoom: "all" };', 'const cmp = { drivers: new Set([0]), lap: "best", zoom: "all" };')
R('''function newSession() {
  world = new World(trackId, classId);''', '''function worldConfig() {
  const opt = classOpt(), grid = {}, personas = {};
  for (const cid of opt.classIds) { grid[cid] = gridUI.grid[cid]; personas[cid] = personasFor(cid); }
  return Object.assign({ trackId, classIds: opt.classIds, grid, personas, raceScale: gridUI.raceScale, alloc: (typeof ALLOC_DATA !== 'undefined' && ALLOC_DATA[trackId]) || null }, roundCfg);
}
function newSession() {
  world = new World(worldConfig());''')
R('  world.startSession(ui.mode, ui.mode === "ghost" ? "practice" : ui.session);\n  skids.length = 0; simTime = 0;',
  '  ui.session = world.format[0].key; buildSessMenu();\n  world.startSession(ui.mode, ui.session);\n  skids.length = 0; simTime = 0;')
R('  if (world.session === "practice") advance(world.mode === "ghost" ? 170 : 60, 1e9);\n  buildRows(); refreshAll();',
  '  if (world.session === "practice") advance(world.mode === "ghost" ? 120 : 30, 1e9);\n  if (selected >= cars.length) selected = 0;\n  cmp.drivers = new Set([...cmp.drivers].filter(k => k < cars.length)); if (!cmp.drivers.size) cmp.drivers.add(0);\n  buildRows(); buildChans(); buildCmpControls(); refreshAll();')
R('  if (session === "race") { cmp.lap = "last"; setPressed("cmp-lap", "v", "last"); }', '  if (world.session === "race") { cmp.lap = "last"; setPressed("cmp-lap", "v", "last"); }\n  debriefSel = null;')
# reference car: the best car of the same class (the class Pro, if any)
R('function losses(k) {\n  const c = cars[k], pro = cars[5];', '''function refCar(k) {
  const c = cars[k], same = cars.filter(x => x.sp.cls === c.sp.cls);
  return same.filter(x => x.bestTele).sort((a, b) => a.best - b.best)[0] || same[0];
}
function losses(k) {
  const c = cars[k], pro = refCar(k);''')
R('mine = cornerTimes(c.lastTele, c.cornerPts), ref = cornerTimes(cars[5].bestTele, c.cornerPts);\n  let html', 'mine = cornerTimes(c.lastTele, c.cornerPts), rc = refCar(selected), ref = rc && rc !== c ? cornerTimes(rc.bestTele, c.cornerPts) : null;\n  let html')
R('<th>vs Pro</th>', '<th>vs class best</th>')
R('${d == null || selected === 5 ? "–"', '${d == null ? "–"')
R('''$("tbl-sub").textContent = `${c.D.name}'s last lap${selected === 5 ? "" : ", compared with the Pro's best"}.''', '''$("tbl-sub").textContent = `${nm(c)}'s last lap${rc && rc !== c ? `, compared with ${nm(rc)}'s best` : ""}.''')
# names on screen
R('''$("geo-title").innerHTML = `${esc(cname(cp.n))}<small>${cp.dir === "L" ? "left" : "right"} · ${c.D.name}'s line</small>`;''', '''$("geo-title").innerHTML = `${esc(cname(cp.n))}<small>${cp.dir === "L" ? "left" : "right"} · ${esc(nm(c))}'s line</small>`;''')
R('''style="--c:${c.D.color}" aria-pressed="${cmp.drivers.has(k)}"><i></i>${c.D.name}</button>''', '''style="--c:${c.D.color}" aria-pressed="${cmp.drivers.has(k)}"><i></i>#${c.number} ${c.D.short}</button>''')
R('map(k => cars[k].D.name);', 'map(k => nm(cars[k]));')
R('measured against the ${series[0].c.D.name}.', 'measured against ${nm(series[0].c)}.')
R('${esc(s.c.D.name)}</td><td>${v.toFixed(0)}', '${esc(nm(s.c))}</td><td>${v.toFixed(0)}')
R('''$("lc-legend").innerHTML = cars.map(c => `<span><i style="background:${c.D.color}"></i>${c.D.name}</span>`).join("");''', '''$("lc-legend").innerHTML = [...new Set(cars.map(c => c.D.skill))].map(s => `<span><i style="background:${SKILL_BY[s].color}"></i>${SKILL_BY[s].name}</span>`).join("");''')
R('${fmt(r.l.t)}${r.l.crash ? " ×" : ""} <span class="t">${r.c.D.name}</span>', '${fmt(r.l.t)}${r.l.crash ? " ×" : ""} <span class="t">${esc(nm(r.c))}</span>')
# track: body in team colour, ring in skill colour, number tag
R('ctx.fillStyle = c.D.color; ctx.fillRect(-L / 2, -Wd / 2, L, Wd);', 'ctx.fillStyle = c.sp.colour || c.D.color; ctx.fillRect(-L / 2, -Wd / 2, L, Wd);')
R('const txt = sel ? `${c.D.short} ${Math.round(kph(c.v))}` : c.D.short, tw', 'const txt = sel ? `#${c.number} ${c.D.short} ${Math.round(kph(c.v))}` : `${c.number}`, tw')
R('''    ctx.fillText("T" + (k + 1), T.x[i]''', '''    ctx.fillText("T" + (c.n || k + 1), T.x[i]''')
# timing tower
R('''      <div class="who"><b>${c.D.name}</b><small></small></div>''', '''      <div class="who"><b>${esc(nm(c))} <span class="sk" style="color:${c.D.color}">${c.D.short}</span></b><small></small></div>''')
R('b.innerHTML = `<div class="pos">–</div><div class="swatch" style="background:${c.D.color}"></div>', 'b.innerHTML = `<div class="pos">–</div><div class="swatch" style="background:${c.sp.colour}"></div>')
R('''    const part = world.rules.quali[Math.min(world.qPart, world.rules.quali.length - 1)].name;''', '''    const qp = world.qualiParts(), part = qp[Math.min(world.qPart, qp.length - 1)].name;''')
R('''  const partName = ses === "quali" ? world.rules.quali[Math.min(world.qPart, world.rules.quali.length - 1)].name : null;''', '''  const qp = ses === "quali" ? world.qualiParts() : null, partName = qp ? qp[Math.min(world.qPart, qp.length - 1)].name : null;''')
R('''    const state = c.pit ? (c.pit.phase === "garage" ? "garage" : "PIT") : c.dnf ? "DNF" : c.finished ? "finished" : "";''', '''    const state = c.dnf ? (c.dnf.startsWith("DSQ") ? "DSQ" : "DNF") : c.pit ? (c.pit.phase === "garage" ? "garage" : "PIT") : c.pitRequest ? "BOX" : c.finished ? "finished" : "";''')
R('''sm.innerHTML = `${tyreBadge(c)} · ${esc(c.sp.make)}''', '''sm.innerHTML = `${tyreBadge(c)} · ${esc(c.sp.make)}${world.classIds.length > 1 ? ` · ${c.sp.cls === "hyper" ? "HYP" : "GT3"}` : ""}''')
R('''gap = (p === 0 ? "fastest" : isFinite(best) && isFinite(lb) ? "+" + (best - lb).toFixed(2) : "–") + ` · ${c.improvements}/${c.attempts}`; }''', '''gap = (p === 0 ? "fastest" : isFinite(best) && isFinite(lb) ? "+" + (best - lb).toFixed(2) : "–") + ` · ${c.laps.length} laps`; }''')
R('''    el.setAttribute("aria-pressed", k === selected ? "true" : "false");''', '''    el.setAttribute("aria-pressed", k === selected ? "true" : "false"); el.classList.toggle("mine", c.orders.owner === "user");''')
# desk
R('''  $("d-swatch").style.background = D.color;
  $("d-name").textContent = D.name;''', '''  $("d-swatch").style.background = c.sp.colour;
  $("d-name").textContent = `${nm(c)} · ${D.name}`;''')
R('''  unread[k] = false;''', '''  unread[k] = false; setupDraft = null;''')
R('''$("d-meta").textContent = `Car ${selected + 1} · ${c.laps.length} laps · ${c.crashes} incidents${c.stops ? ` · ${c.stops} stops` : ""}`;''', '''$("d-meta").textContent = `${fullName(c)} · ${c.driver.weight} kg · ${PERSONAS[c.driver.persona].label} · ${c.laps.length} laps · ${c.crashes} incidents${c.stops ? ` · ${c.stops} stops` : ""}`;''')
R('''    ["Tyre temp", `${Math.round(ty.temp)}<small>°C · ${tState} (${lo}–${hi})</small>`, null],''', '''    ["Tyre temp", `${Math.round(ty.tempF)}<small>° front</small> ${Math.round(ty.tempR)}<small>° rear · ${tState} (${lo}–${hi})</small>`, null],''')
R('''    ["Tyre wear", `${Math.round(ty.wear * 100)}<small>% · grip ${Math.round((c.tyreWF || 1) * 100)}%</small>`, Math.min(1, ty.wear)],''', '''    ["Tyre wear", `${Math.round(ty.wearF * 100)}<small>% F</small> ${Math.round(ty.wearR * 100)}<small>% R · grip ${Math.round((c.tyreWF || 1) * 100)}%</small>`, Math.min(1, ty.wear)],''')
# radio + season code
a = p.index('// ---------- team radio ----------'); b = p.index('// ---------- real-world reference ----------')
p = p[:a] + open('page4_pitwall.js').read() + '\n' + open('page4_season.js').read() + '\n' + open('page4_layout.js').read() + '\n' + p[b:]
R('    const pro = cars[5], best = isFinite(pro.best) ? pro.best : null;', '    const pro = cars.filter(c => c.sp.cls === series).sort((a, b) => a.best - b.best)[0] || cars[0], best = isFinite(pro.best) ? pro.best : null;')
R('the Pro drives a ${esc(simCls.cars[5].make + " " + simCls.cars[5].model)}. Grip is calibrated so it laps Spa about 1.5% off ${CALIB[series] || "the real pole"}.', 'cars are calibrated so a Pro on new soft tyres and low fuel matches the real 2026 pole, per circuit where timing exists.')
# race control
R('''    else if (w.session === "quali") { const part = w.rules.quali[Math.min(w.qPart, w.rules.quali.length - 1)]; clock''', '''    else if (w.session === "quali") { const qp = w.qualiParts(), part = qp[Math.min(w.qPart, qp.length - 1)]; clock''')
R('''pills.push(`<span class="pill">${SESS_NAMES[w.session]} · <b>${clock}</b></span>`);''', '''pills.push(`<span class="pill">${esc(w.sessionDef.name)} · <b>${clock}</b></span>`);''')
R('''  $("rc-msgs").innerHTML = w.msgs.slice(-3)''', '''  awardPoints();
  $("rc-msgs").innerHTML = w.msgs.slice(-3)''')
R('''      rows.push([n + 1, `<span class="ro-sw" style="background:${c.D.color}"></span>${esc(c.D.name)}`, esc(c.sp.name), c.finishLaps ?? c.raceLaps, c.dnf ? "DNF" : raceGap(c, lead)''', '''      rows.push([n + 1 + (w.classIds.length > 1 ? ` <small>${c.sp.cls === "hyper" ? "HYP" : "GT3"} ${w.classOrder(c.sp.cls).indexOf(k) + 1}</small>` : ""), `<span class="ro-sw" style="background:${c.D.color}"></span>${esc(nm(c))} <small>${c.D.short}</small>`, esc(c.sp.name), c.finishLaps ?? c.raceLaps, c.dnf ? esc(c.dnf) : raceGap(c, lead)''')
R('''Math.round(w.raceTime / 60) + " minutes" + (w.rules.race.plusLap ? " + 1 lap" : "")} · grid from ${w.grid ? "qualifying" : "practice times"} · ${w.rules.start} start`;''', '''Math.round(w.raceTime / 60) + " minutes" + (w.plusLap ? " + 1 lap" : "")}${w.raceScale < 1 ? ` (${Math.round(w.raceScale * 100)}% distance)` : ""} · grid from ${w.gridOrder && (w.sessionDef.grid && w.grids[w.sessionDef.grid]) ? "qualifying" : "practice times"}${w.sessionDef.reverse ? `, top ${w.sessionDef.reverse} reversed` : ""} · ${w.rules.start} start`;''')
R('''    const parts = w.rules.quali.map(q => q.name);''', '''    const parts = w.qualiParts().map(q => q.name);''')
R('''`<span class="ro-sw" style="background:${c.D.color}"></span>${esc(c.D.name)}${out ? ' <span class="cat">out</span>' : ""}`''', '''`<span class="ro-sw" style="background:${c.D.color}"></span>${esc(nm(c))} <small>${c.D.short}</small>${out ? ' <span class="cat">out</span>' : ""}`''')
R('''    $("res-sub").textContent = `${w.rules.quali.map(q => `${q.name} ${Math.round(q.dur / 60)} min${q.cut ? `, slowest ${q.cut} out` : ""}`).join(" · ")}. Laps count only with a clean push lap after an out-lap.`;''', '''    $("res-sub").textContent = `${w.qualiParts().map(q => `${q.name} ${Math.round(q.dur / 60)} min${q.keep ? `, top ${Math.round(q.keep * 100)}% go through` : ""}`).join(" · ")}${w.sessionDef.perClass ? ", per class" : ""}. Laps count only with a clean push lap after an out-lap.`;''')
R('''    standings().forEach((k, n) => { const c = cars[k]; rows.push([n + 1, `<span class="ro-sw" style="background:${c.D.color}"></span>${esc(c.D.name)}`''', '''    standings().forEach((k, n) => { const c = cars[k]; rows.push([n + 1, `<span class="ro-sw" style="background:${c.D.color}"></span>${esc(nm(c))} <small>${c.D.short}</small>`''')
R('''    $("res-sub").textContent = `${Math.round(w.rules.practice / 60)} minutes. Drivers learn, change tyres and refuel as they need to.`;''', '''    $("res-sub").textContent = `${Math.round(w.sessionDef.dur / 60)} minutes. Drivers learn; the engineer works on the setup between runs.`;''')
# session menu, class menu, track menu
R('''$("mode").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; ui.mode = b.dataset.m; setPressed("mode", "m", ui.mode);
  startWorldSession(ui.mode, ui.mode === "ghost" ? "practice" : ui.session);
});''', '''function buildSessMenu() { $("sess").innerHTML = world.format.map(s => `<option value="${s.key}">${esc(s.name)}</option>`).join(""); $("sess").value = ui.session; }
$("mode").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; ui.mode = b.dataset.m; setPressed("mode", "m", ui.mode);
  startWorldSession(ui.mode, ui.session);
});''')
R('''setPressed("mode", "m", ui.mode); $("sess").value = ui.session; $("wx").value = ui.weather;''', '''setPressed("mode", "m", ui.mode); $("wx").value = ui.weather;''')
R('''$("trk").innerHTML = TRACKS.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("");''', '''$("trk").innerHTML = TRACKS.map(t => `<option value="${t.id}">${esc(t.name)}${t.country ? " · " + esc(t.country) : ""}</option>`).join("");''')
R('''  setTrack(e.target.value);
  newSession(); buildCmpControls(); cmp.zoom = "all";
  transcripts.forEach((t, k) => t.push({ from: "sys", text: `New session at ${TRACK.name}. Every driver starts learning this circuit from scratch.` }));
  buildChans(); select(selected); resize(); renderRef();''', '''  roundCfg = {}; setTrack(e.target.value);
  newSession(); buildCmpControls(); cmp.zoom = "all";
  transcriptsReset(`New session at ${TRACK.name}. Every driver starts learning this circuit from scratch.`); resize(); renderRef();''')
R('''$("cls").innerHTML = CLASSES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");''', '''$("cls").innerHTML = CLASS_OPTS.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");''')
R('''  classId = e.target.value; const cls = CLASSES.find(c => c.id === classId);
  newSession();
  transcripts.forEach((t, k) => t.push({ from: "sys", text: `New session in ${cls.name}: the ${DRIVERS[k].name} is now in a ${cars[k].sp.name} and starts learning from scratch.` }));
  $("mu").textContent = cls.name; buildChans(); select(selected);
  if (REF_SERIES.some(s => s.id === classId)) { refState.series = classId; refState.year = null; }''', '''  classId = e.target.value; const cls = classOpt(); roundCfg = {};
  newSession(); renderGridPanel();
  transcriptsReset(`New session in ${cls.name}: ${cars.length} cars, everyone learning from scratch.`);
  $("mu").textContent = cls.name;
  const rs = cls.classIds[0]; if (REF_SERIES.some(s => s.id === rs)) { refState.series = rs; refState.year = null; }''')
R('''$("mu").textContent = CLASSES.find(c => c.id === classId).name;''', '''$("mu").textContent = classOpt().name;''')
R('''$("reset").addEventListener("click", () => { newSession(); transcripts.forEach((t, k) => t.push({ from: "sys", text: "Session restarted. Every driver is back to what it knew at the start." })); buildChans(); select(selected); });''', '''$("reset").addEventListener("click", () => { newSession(); transcriptsReset("Session restarted. Every driver is back to what it knew at the start."); });''')
R('''function refreshAll() { drainRadio(); renderRefSim(); renderRC(); renderResults(); renderSpecs(); updateRows(); updateDesk(); renderLog(); renderGeo(); renderGeoTable(); renderJobs(); renderSuggest(); renderChans(); drawCompare(); drawLearn(); }''',
  '''function refreshAll() { drainRadio(); renderRefSim(); renderRC(); renderResults(); renderSpecs(); updateRows(); updateDesk(); renderLog(); renderGeo(); renderGeoTable(); renderJobs(); renderSuggest(); renderChans(); renderPitwall(); drawCompare(); drawLearn(); if (world.ended && world.debriefs && !world.debriefShown) { world.debriefShown = true; debriefSel = selected; renderDebrief(); } }''')
R('''{ renderRC(); renderResults(); } }''', '''{ renderRC(); renderResults(); drainRadio(); if (rcTimer % 20 === 0) renderPitwall(); } }''')
R('''setTrack("spa");
newSession();
buildChans(); buildCmpControls(); renderRef();''', '''setTrack("spa");
renderGridPanel();
newSession();
renderRef(); renderChamp(); renderDebrief();''')
R('select(5);\nsetRadioMode();', 'select(0);\nsetRadioMode();')
R('  updateRows(); updateDesk(); renderLog(); renderRadio(); renderGeoTable(); drawCompare(); drawLearn();\n}', '  updateRows(); updateDesk(); renderLog(); renderRadio(); renderGeoTable(); drawCompare(); drawLearn(); renderDebrief();\n}')

# reference panel: odd year keys, sessions without kind/source/fastest, multi-class, circuit data sources
R('const years = data ? Object.keys(data).sort((a, b) => b - a) : [];', 'const years = data ? Object.keys(data).filter(y => !y.startsWith("_")).sort((a, b) => parseFloat(b) - parseFloat(a) || a.localeCompare(b)) : [];')
R('const S = yd.sessions[refState.sess], race = S.kind === "race", rows = S.rows || [];', """const S = yd.sessions[refState.sess], race = S.kind === "race" || /^(race|r\\d|sprint)$/.test(refState.sess), rows = S.rows || [];
  if (race && !S.fastest) { const fl = rows.filter(r => tsec(r.fl)).sort((a, b) => tsec(a.fl) - tsec(b.fl))[0]; if (fl) S.fastest = { t: fl.fl, drv: fl.drv }; }""")
R("if (classId === series && refT) {", "if (classOpt().classIds.includes(series) && refT) {")
R("Source: ${S.source}.", "Source: ${S.source || (data._src || []).slice(0, 2).join(', ') || 'official timing'}.")
R("""    <div class="src-list"><dt style="font:600 10px/1 var(--f-display);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Sources</dt>""", """    <div class="src-list"><dt style="font:600 10px/1 var(--f-display);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Circuit model</dt>${trackDataHtml()}</div>
    <div class="src-list"><dt style="font:600 10px/1 var(--f-display);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Sources</dt>""")
R("function renderRefSim() { if (refState.series === classId) renderRef(); }", """function renderRefSim() { if (classOpt().classIds.includes(refState.series)) renderRef(); }
const QLAB = { lidar: "survey LiDAR", dtm: "terrain model", global: "30 m global model (broad hills only)", aerial: "measured from aerial photos", published: "published widths", "osm-tag": "map tags", none: "not measured", osm: "map centreline", "osm+aerial": "map centreline, checked against aerial photos" };
function trackDataHtml() {
  const q = TRACK.quality || {}, s = TRACK.sources || {};
  return [["Layout", q.geometry, s.geometry], ["Width", q.width, s.width], ["Elevation", q.elevation, s.elevation], ["Camber", q.camber, s.camber], ["Pit lane", null, s.pit]].filter(r => r[1] || r[2])
    .map(([k, ql, src]) => `<div style="font-size:12px;color:var(--ink-2);margin:4px 0"><b style="color:var(--ink)">${k}</b>: ${esc(QLAB[ql] || ql || "")}${src ? ` <span style="color:var(--muted)">(${esc(String(src).slice(0, 160))})</span>` : ""}</div>`).join("") + (TRACK.notes ? `<div style="font-size:12px;color:var(--muted)">${esc(TRACK.notes)}</div>` : "");
}""")
R('const SESS_LABEL = { prac: "Practice", quali: "Qualifying", q1: "Q1", q2: "Q2", race: "Race", r1: "Race 1", r2: "Race 2" };', 'const SESS_LABEL = { prac: "Practice", quali: "Qualifying", q1: "Q1", q2: "Q2", race: "Race", r1: "Race 1", r2: "Race 2", sq: "Sprint qualifying", sprint: "Sprint" };')

R('<title>Apex School</title>', '<title>Pit Wall</title>')

# ---------------- design review fixes (Pit Wall v8) ----------------
# standalone file: charset, phone viewport, browser chrome colour
R('<title>Pit Wall</title>', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#0f141a">\n<title>Pit Wall</title>')
R('<h1>Apex <span>School</span></h1>', '<h1>Pit <span>Wall</span></h1>')
R('<canvas id="learn"></canvas>', '<canvas id="learn" aria-label="Learning curve: lap time per lap for every driver"></canvas>')
# grammar: "1 lap", "1 incident"
RX(r'\$\{([^{}`]+?)\} (lap|incident)s\b', r'${pl(\1, "\2")}')
# the sim gets at most ~9 ms a frame so 60 fps survives; the bar shows the real speed when that cap bites
R('advance(25, 22) : advance(dt * simSpeed, 22)', 'advance(25, 9) : advance(dt * simSpeed, 9)')
R('function frameLoop(now) {\n  const dt = Math.min(0.1, (now - last) / 1000); last = now;',
  'function frameLoop(now) {\n  const dt = Math.min(0.1, (now - last) / 1000); last = now; const simBefore = simTime;')
R('drawTrack(); drawFC(); stepPlayback(dt);', 'drawTrack(); drawFC(); stepPlayback(dt); trackRealSpeed(dt, simTime - simBefore);')
R('<button type="button" data-s="64">64×</button><button type="button" data-s="max">Max</button>\n        </div>',
  '<button type="button" data-s="64">64×</button><button type="button" data-s="max">Max</button>\n        </div>\n        <span class="speed-real" id="speed-real" aria-live="polite"></span>')
# progress bars: scaleX instead of width (composite-only)
R('el.querySelector(".progress div").style.width = (c.pit ? 0 : (c.idx / T.N) * 100) + "%";', 'el.querySelector(".progress div").style.transform = `scaleX(${c.pit ? 0 : c.idx / T.N})`;')
# timing tower: rows slide to their new place when positions change, and the list shows when more cars are below
R("  order.forEach((k, p) => {\n    const c = cars[k], el = $(\"row-\" + k);\n    if (rows.children[p] !== el) rows.insertBefore(el, rows.children[p]);",
  "  const flip = towerFlipStart(rows);\n  order.forEach((k, p) => {\n    const c = cars[k], el = $(\"row-\" + k);\n    if (rows.children[p] !== el) rows.insertBefore(el, rows.children[p]);")
RX(r'(function updateRows\(\) \{[\s\S]*?\n  \}\);\n)\}', r'\1  towerFlipEnd(flip); towerMore(rows);\n}')
# hover only where there is a real pointer (touch screens keep tapped rows lit otherwise)
for rule in ['.row:hover { background: var(--panel-2); }', '.chan:hover { background: var(--panel-2); }', '.suggest button:hover { color: var(--ink); border-color: var(--ink-2); }', 'tbody tr:hover td { background: var(--panel-2); }']:
    R(rule, '@media (hover: hover) and (pointer: fine) { ' + rule + ' }')
# legibility: grey text passes 4.5:1 on every panel; no label below 10.5 px
R('--muted: #6c7886;', '--muted: #838f9e;')
RX(r'\b9\.5px', '10.5px')
# phones: telemetry drags zoom sideways but must let the page scroll
R('#tele { height: 720px; cursor: crosshair; touch-action: none; }', '#tele { height: 720px; cursor: crosshair; touch-action: pan-y; }')
# debrief arrives with a short fade when a session ends (not when switching drivers)
R('debriefSel = selected; renderDebrief(); } }', 'debriefSel = selected; renderDebrief(); enterIn($("debrief-body")); } }')
R('setRadioMode();\nrequestAnimationFrame(frameLoop);', 'setRadioMode();\ninitLayout();\nrequestAnimationFrame(frameLoop);')
R('<th>Driver</th><th>km/h</th><th>Thr %</th><th>Brk %</th><th>Steer °</th><th>Gap s</th>', '<th>Driver</th><th title="Speed, km/h">km/h</th><th title="Throttle, %">Thr</th><th title="Brake pressure, %">Brk</th><th title="Steering angle, degrees (R right, L left)">Str°</th><th title="Time gap to the reference car, seconds">Gap</th>')
open('page4.html', 'w').write(p)
print('page4 ok', len(p))
