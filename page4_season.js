// ---------- grid composer ----------
const CLASS_OPTS = [
  { id: "f1", name: "Formula 1", classIds: ["f1"] },
  { id: "wec", name: "WEC: Hypercar + LMGT3", classIds: ["hyper", "gt3"] },
  { id: "hyper", name: "Hypercar only", classIds: ["hyper"] },
  { id: "gt3", name: "LMGT3 only", classIds: ["gt3"] },
  { id: "gt4", name: "GT4", classIds: ["gt4"] },
  { id: "tcr", name: "TCR", classIds: ["tcr"] },
  { id: "road", name: "Road cars", classIds: ["road"] },
];
const SKILL_NAMES = { pro: "Pros", semi: "Semi-pros", club: "Club racers", amateur: "Amateurs", novice: "Novices", rookie: "Rookies" };
const DEFAULT_GRID = {
  f1: { pro: 4, semi: 4, club: 4, amateur: 4, novice: 3, rookie: 3 }, hyper: { pro: 3, semi: 3, club: 3, amateur: 3, novice: 3, rookie: 3 },
  gt3: { pro: 3, semi: 3, club: 3, amateur: 3, novice: 3, rookie: 3 }, gt4: { pro: 4, semi: 4, club: 4, amateur: 4, novice: 4, rookie: 4 },
  tcr: { pro: 4, semi: 4, club: 4, amateur: 4, novice: 4, rookie: 4 }, road: { pro: 2, semi: 2, club: 2, amateur: 2, novice: 2, rookie: 2 },
};
const gridUI = { grid: JSON.parse(JSON.stringify(DEFAULT_GRID)), personas: {}, raceScale: 0.25, wecHours: null };
try { const s = JSON.parse(localStorage.getItem("apex-grid-v1") || "null"); if (s && s.grid) Object.assign(gridUI, s); } catch { }
const saveGrid = () => { try { localStorage.setItem("apex-grid-v1", JSON.stringify(gridUI)); } catch { } };
function classOpt() { return CLASS_OPTS.find(o => o.id === classId) || CLASS_OPTS[0]; }
function renderGridPanel() {
  const opt = classOpt();
  $("grid-body").innerHTML = opt.classIds.map(cid => {
    const cls = CLASSES.find(c => c.id === cid), g = gridUI.grid[cid], P = gridUI.personas[cid] || {};
    const total = SKILL_KEYS.reduce((s, k) => s + (g[k] || 0), 0);
    return `<div class="gp-class"><div class="gp-head"><b>${esc(cls.name)}</b><span>${total} cars · real grid ${cls.grid} · ${cls.cars.length} manufacturers</span>
      <button type="button" class="btn" data-fill="${cid}">Fill to real grid</button></div>
      <table class="gp-tab"><thead><tr><th>Skill</th><th>Cars</th><th>Personality</th></tr></thead><tbody>
      ${SKILL_KEYS.map(s => `<tr><td><span class="ro-sw" style="background:${SKILL_BY[s].color}"></span>${SKILL_NAMES[s]}</td>
        <td><input type="number" min="0" max="20" value="${g[s] || 0}" data-cid="${cid}" data-s="${s}" aria-label="${SKILL_NAMES[s]} in ${esc(cls.name)}"></td>
        <td><select data-cid="${cid}" data-p="${s}"><option value="mixed">Mixed</option>${Object.entries(PERSONAS).map(([k, p]) => `<option value="${k}" ${P[s] === k ? "selected" : ""}>${p.label}</option>`).join("")}</select></td></tr>`).join("")}
      </tbody></table></div>`;
  }).join("") + `<div class="gp-foot"><label>Race distance <select id="gp-scale">${[[1, "Full distance"], [0.5, "50%"], [0.25, "25%"], [0.1, "10%"]].map(([v, l]) => `<option value="${v}" ${gridUI.raceScale === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <span class="note">Bigger grids and full distances take longer to simulate. A 24-hour Le Mans with 36 cars runs about 10 minutes at Max.</span>
    <button type="button" class="btn primary" id="gp-apply">Build this grid</button></div>`;
}
$("grid-body").addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.s) gridUI.grid[t.dataset.cid][t.dataset.s] = clamp(Math.round(+t.value || 0), 0, 20);
  if (t.dataset.p) { gridUI.personas[t.dataset.cid] = gridUI.personas[t.dataset.cid] || {}; gridUI.personas[t.dataset.cid][t.dataset.p] = t.value === "mixed" ? undefined : t.value; }
  if (t.id === "gp-scale") gridUI.raceScale = +t.value;
  saveGrid(); renderGridPanel();
});
$("grid-body").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.fill) { const cid = b.dataset.fill, cls = CLASSES.find(c => c.id === cid), g = gridUI.grid[cid]; let tot = SKILL_KEYS.reduce((s, k) => s + (g[k] || 0), 0), i = 0; while (tot < cls.grid) { g[SKILL_KEYS[i++ % 6]]++; tot++; } while (tot > cls.grid) { const k = SKILL_KEYS[5 - (i++ % 6)]; if (g[k] > 0) { g[k]--; tot--; } } saveGrid(); renderGridPanel(); }
  if (b.id === "gp-apply") { saveGrid(); newSession(); transcriptsReset(`New grid: ${cars.length} cars.`); }
});
function transcriptsReset(msg) { buildChans(); transcripts.forEach(t => t.push({ from: "sys", text: msg })); select(Math.min(selected, cars.length - 1)); }
// persona "mixed": each driver keeps a personality drawn from its own seed
function personasFor(cid) {
  const P = gridUI.personas[cid] || {}, out = {};
  for (const s of SKILL_KEYS) out[s] = P[s] || null;
  return out;
}

// ---------- championships: each series' real 2026 calendar ----------
const SEASON_DEFAULT = {
  f1: [["Australia", "albert_park"], ["China", "shanghai", 1], ["Japan", "suzuka"], ["Bahrain", "bahrain"], ["Saudi Arabia", "jeddah"], ["Miami", "miami", 1], ["Canada", "montreal", 1], ["Monaco", "monaco"],
       ["Barcelona-Catalunya", "barcelona"], ["Austria", "red_bull_ring"], ["Great Britain", "silverstone", 1], ["Belgium", "spa"], ["Hungary", "hungaroring"], ["Netherlands", "zandvoort", 1], ["Italy", "monza"],
       ["Spain (Madrid)", "madring"], ["Azerbaijan", "baku"], ["Singapore", "marina_bay", 1], ["United States", "cota"], ["Mexico", "mexico"], ["Brazil", "interlagos"], ["Las Vegas", "las_vegas"], ["Qatar", "lusail"], ["Abu Dhabi", "yas_marina"]]
       .map(([name, track, sprint], i) => ({ round: i + 1, name, track, sprint: !!sprint })),
  wec: [["Qatar 1812 km", "lusail", 10], ["6 Hours of Imola", "imola", 6], ["6 Hours of Spa", "spa", 6], ["24 Hours of Le Mans", "le_mans", 24], ["6 Hours of São Paulo", "interlagos", 6],
        ["Lone Star Le Mans", "cota", 6], ["6 Hours of Fuji", "fuji", 6], ["8 Hours of Bahrain", "bahrain", 8]].map(([name, track, hours], i) => ({ round: i + 1, name, track, hours })),
};
function seasonFor(sid) {
  const cal = (typeof CAL_DATA !== "undefined" && CAL_DATA[sid]) || SEASON_DEFAULT[sid];
  if (cal && cal.length) return cal;
  // road cars have no series: a track-day tour of every circuit built
  return TRACKS.map((t, i) => ({ round: i + 1, name: `${t.short} track day`, track: t.id }));
}
const CHAMP_SERIES = [{ id: "f1", name: "Formula 1", cls: "f1" }, { id: "wec", name: "FIA WEC", cls: "wec" }, { id: "gt4", name: "GT4 European Series", cls: "gt4" }, { id: "tcr", name: "TCR Europe", cls: "tcr" }, { id: "road", name: "Road-car track-day tour", cls: "road" }];
let champ = null;
try { champ = JSON.parse(localStorage.getItem("apex-champ-v1") || "null"); } catch { champ = null; }
const saveChamp = () => { try { localStorage.setItem("apex-champ-v1", JSON.stringify(champ)); } catch { } };
function champKey(c) { return `${c.sp.cls}#${c.number}`; }
function renderChamp() {
  const sid = $("ch-series").value || (champ && champ.series) || "f1", cal = seasonFor(sid), live = champ && champ.series === sid;
  $("ch-cal").innerHTML = cal.map(r => {
    const have = !!TRACKDATA[r.track], done = live && champ.done.includes(r.round), cur = live && champ.round === r.round;
    return `<li class="${done ? "done" : ""}${cur ? " cur" : ""}"><span class="rd">R${r.round}</span><span class="nm">${esc(r.name)}${r.sprint ? ' <span class="cat">sprint</span>' : ""}${r.hours ? ` <span class="cat">${r.hours} h</span>` : ""}${r.status === "cancelled" ? ' <span class="cat">cancelled in 2026</span>' : ""}</span>
      <span class="tk">${have ? esc(TRACKS.find(t => t.id === r.track).short) : `<i>${esc(r.track)}: circuit being built</i>`}</span>
      ${have ? `<button type="button" class="btn" data-round="${r.round}">${done ? "Rerun" : cur ? "Continue" : "Go"}</button>` : ""}</li>`;
  }).join("");
  if (!live) { $("ch-stand").innerHTML = `<div class="empty">Start a championship to keep points across rounds. It uses the grid you built.</div>`; return; }
  const dr = Object.entries(champ.drivers).sort((a, b) => b[1].pts - a[1].pts), tm = Object.entries(champ.teams).sort((a, b) => b[1] - a[1]);
  $("ch-stand").innerHTML = `<div class="ch-tables"><table class="res-table"><thead><tr><th>P</th><th class="name">Driver</th><th class="name">Car</th><th>Pts</th><th>Wins</th></tr></thead><tbody>
    ${dr.slice(0, 40).map(([k, d], i) => `<tr><td>${i + 1}</td><td class="name"><span class="ro-sw" style="background:${d.color}"></span>${esc(d.name)}</td><td class="name">${esc(d.car)}</td><td>${d.pts}</td><td>${d.wins || 0}</td></tr>`).join("")}</tbody></table>
    <table class="res-table"><thead><tr><th>P</th><th class="name">Team / manufacturer</th><th>Pts</th></tr></thead><tbody>${tm.map(([t, p], i) => `<tr><td>${i + 1}</td><td class="name">${esc(t)}</td><td>${p}</td></tr>`).join("")}</tbody></table></div>`;
}
$("ch-series").innerHTML = CHAMP_SERIES.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
if (champ) $("ch-series").value = champ.series;
$("ch-series").addEventListener("change", renderChamp);
$("ch-new").addEventListener("click", () => {
  const sid = $("ch-series").value;
  champ = { series: sid, round: null, done: [], drivers: {}, teams: {}, awarded: {} }; saveChamp(); renderChamp();
});
$("ch-cal").addEventListener("click", e => {
  const b = e.target.closest("button[data-round]"); if (!b) return;
  const sid = $("ch-series").value; if (!champ || champ.series !== sid) { champ = { series: sid, round: null, done: [], drivers: {}, teams: {}, awarded: {} }; }
  const r = seasonFor(sid).find(x => x.round === +b.dataset.round);
  champ.round = r.round; saveChamp();
  classId = CHAMP_SERIES.find(s => s.id === sid).cls; $("cls").value = classId;
  ui.mode = "weekend"; setPressed("mode", "m", "weekend");
  roundCfg = { sprint: !!r.sprint, wecHours: r.hours || null, alloc: (typeof ALLOC_DATA !== "undefined" && ALLOC_DATA[r.track]) || null };
  trackId = r.track; $("trk").value = trackId; setTrack(trackId);
  newSession(); buildCmpControls(); cmp.zoom = "all"; resize(); renderRef(); renderGridPanel();
  transcriptsReset(`Round ${r.round}: ${r.name}. ${world.format.map(s => s.name).join(", ")}.`);
  document.getElementById("rc-anchor").scrollIntoView({ behavior: "smooth" });
});
let roundCfg = {};
// points when a points-paying session ends during a championship round
function awardPoints() {
  if (!champ || champ.round == null || world.mode !== "weekend" || !world.ended) return;
  const def = world.sessionDef, key = `${champ.round}:${def.key}`;
  if (champ.awarded[key]) return;
  let table = def.points;
  if (table === "wec") table = WEC_POINTS[world.config.wecHours >= 24 ? 24 : world.config.wecHours >= 8 ? 8 : 6] || WEC_POINTS[6];
  const add = (c, pts, win) => {
    const k = champKey(c), d = champ.drivers[k] || (champ.drivers[k] = { name: `#${c.number} ${c.crew.map(x => x.last).join(" / ")}`, car: c.sp.name, color: c.D.color, pts: 0, wins: 0 });
    d.pts += pts; if (win) d.wins++; champ.teams[c.team + (world.classIds.length > 1 ? ` (${c.sp.className})` : "")] = (champ.teams[c.team + (world.classIds.length > 1 ? ` (${c.sp.className})` : "")] || 0) + pts;
  };
  if (def.type === "race" && Array.isArray(table)) {
    for (const cid of world.classIds) world.classOrder(cid).forEach((k, i) => { const c = cars[k]; if (!c.dnf) add(c, table[i] || 0, i === 0); else add(c, 0, false); });
  } else if (def.type === "quali" && Array.isArray(table)) {
    // qualifying points: WEC +1 for each class's Hyperpole, GT4 +1 for the fastest in Q1 and in Q2, TCR 10-8-6-4-2-1
    for (const cid of world.classIds) world.grid.filter(k => cars[k].sp.cls === cid).slice(0, table.length).forEach((k, i) => add(cars[k], table[i], false));
  } else return;
  champ.awarded[key] = true;
  if (def === world.format[world.format.length - 1] && !champ.done.includes(champ.round)) champ.done.push(champ.round);
  saveChamp(); renderChamp();
  world.say(`Championship points awarded for ${def.name}.`);
}
