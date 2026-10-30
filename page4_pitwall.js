// ---------- the pit wall: radio, engineer's orders, setup sheet, driver card ----------
const ACTIONS = {
  brake_later: "carry more speed into the named corners by braking later / trusting more grip",
  brake_earlier: "brake earlier / trust less grip in the named corners (fewer mistakes)",
  late_apex: "turn in later from the outside for a later apex in the named corners",
  early_apex: "turn in earlier for an earlier apex",
  wider_entry: "use more track width on the way in",
  tighter_apex: "clip the inside of the apex more tightly",
  wider_exit: "let the car run out to the edge of the track on exit",
  learn_braking_zones: "learn to plan braking zones backward from each apex (big skill upgrade)",
  learn_trail_braking: "learn trail braking: keep easing off the brake while turning in",
  learn_racing_line: "learn outside-inside-outside racing lines that use the full width",
  learn_exit_throttle: "learn progressive throttle on exit as the steering unwinds",
  learn_corner_phases: "learn to work through entry, mid-entry, apex, mid-exit and exit as separate phases",
  smoother: "smoother, calmer steering inputs",
  explore_more: "experiment with bigger changes",
  explore_less: "experiment with smaller, safer changes",
};
const COMMANDS = {
  box: "pit this lap. Optional fields: tyres (compound id), fuel (kg to add), wing (front-wing clicks to change, or true for a new nose), repair (true), driverChange (true)",
  stayout: "cancel a planned stop and stay out (laps: how many)",
  pace: "value push | normal | manage (tyre management)",
  fuel: "value rich | std | lean (fuel mixture)",
  lico: "value 0-3 (lift and coast before braking zones)",
  ers: "value harvest | balanced | attack (F1 battery deployment)",
  position: "value attack | free | defend | hold",
};
const CORNER_TYPES = new Set(["brake_later", "brake_earlier", "late_apex", "early_apex", "wider_entry", "tighter_apex", "wider_exit"]);
const ACTION_LABEL = { brake_later: "brake later", brake_earlier: "brake earlier", late_apex: "later apex", early_apex: "earlier apex", wider_entry: "wider entry", tighter_apex: "tighter apex", wider_exit: "use the exit kerb" };
const SETUP_LABEL = { wingF: ["Front wing", "clicks"], wingR: ["Rear wing", "clicks"], ride: ["Ride height", "steps"], arbF: ["Front anti-roll bar", "1 soft – 9 stiff"], arbR: ["Rear anti-roll bar", "1 soft – 9 stiff"],
  bias: ["Brake balance", "% front"], diffEn: ["Diff entry", "1 open – 9 locked"], diffEx: ["Diff on power", "1 open – 9 locked"], press: ["Tyre pressure", "psi vs minimum"], camber: ["Negative camber", "steps"] };
let transcripts = [], unread = [];
let sample = null, radioMode = "pending", busy = false;
const nm = c => `#${c.number} ${c.driver.last}`;
const fullName = c => `${c.driver.first} ${c.driver.last}`;

function buildChans() {
  transcripts = cars.map((c, k) => transcripts[k] && transcripts[k].car === c ? transcripts[k] : Object.assign([], { car: c }));
  unread = cars.map(() => false);
  $("chans").innerHTML = cars.map((c, k) => `<button type="button" class="chan" data-k="${k}" style="--c:${c.D.color}"><div class="swatch" style="background:${c.sp.colour}"></div><div style="min-width:0"><b>${esc(nm(c))}</b><small></small></div><span class="unread"></span></button>`).join("");
}
$("chans").addEventListener("click", e => { const b = e.target.closest(".chan"); if (b) select(+b.dataset.k); });
function chanStatus(k) { const c = cars[k]; return `${c.D.short} · ${c.orders.owner === "user" ? "your strategy" : "team strategy"} · ${c.pitRequest ? "BOX" : c.pit ? "in pits" : fmt(c.lastLap ?? Infinity)}`; }
function renderChans() {
  for (const b of $("chans").children) { const k = +b.dataset.k; if (!cars[k]) continue; b.setAttribute("aria-pressed", String(k === selected)); b.querySelector("small").textContent = chanStatus(k); b.querySelector(".unread").classList.toggle("on", unread[k] && k !== selected); }
}
function say(k, from, text) { transcripts[k].push({ from, text, t: world.time }); if (k !== selected && from !== "coach") unread[k] = true; if (k === selected) renderMsgs(); renderChans(); }
function renderMsgs() {
  const c = cars[selected], el = $("msgs"), t = transcripts[selected] || [];
  $("convo-title").textContent = `Channel · ${nm(c)} (${c.D.name})`;
  $("radio-input").placeholder = `Talk to ${c.driver.first}: "box this lap, softs", "push", "brake later at T5"…`;
  el.innerHTML = (t.length ? t : [{ from: "sys", text: `Radio check. ${fullName(c)} is listening. Give orders with the controls or in plain words; ask how the car feels.` }]).map(m =>
    m.from === "coach" ? `<div class="msg coach"><span class="from">You</span>${esc(m.text)}</div>`
    : m.from === "driver" ? `<div class="msg driver" style="--c:${c.D.color}"><span class="from">${esc(c.driver.first)}</span>${esc(m.text)}</div>`
    : m.from === "data" ? `<div class="msg sys data">${esc(m.text)}</div>`
    : m.from === "typing" ? `<div class="msg driver typing" style="--c:${c.D.color}"><span class="from">${esc(c.driver.first)}</span>${esc(m.text)}</div>`
    : `<div class="msg sys">${esc(m.text)}</div>`).join("");
  el.scrollTop = el.scrollHeight;
}
function renderSuggest() {
  const c = cars[selected], out = [];
  if (world.session === "race") { out.push("Box this lap"); out.push("How are the tyres?"); out.push(c.orders.pace === "manage" ? "Push now, gap is closing" : "Manage the tyres"); }
  else { out.push("How's the balance?"); out.push("Where are you losing time?"); }
  if (!c.D.trail && c.D.speedMode === "plan") out.push("Try trail braking");
  const L = losses(selected).find(x => x.d > 0.05); if (L) out.push(`Brake later into ${cname(L.n)}`);
  $("suggest").innerHTML = out.slice(0, 4).map(s => `<button type="button">${esc(s)}</button>`).join("");
}
$("suggest").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("radio-input").value = b.textContent; $("radio-form").requestSubmit(); });
function renderJobs() {
  const c = cars[selected], jobs = c.coach.filter(j => j.lapsLeft > 0);
  $("jobs").innerHTML = jobs.length ? jobs.map(j => { const total = j.tries + j.lapsLeft; return `<div class="job"><b>${ACTION_LABEL[j.type] || j.type}</b> · ${j.corners.map(cname).map(esc).join(", ")}<br>${j.tries}/${total} tries · kept ${j.kept}${j.gain > 0 ? ` · −${j.gain.toFixed(2)}s` : ""}<div class="pbar"><div style="width:${(j.tries / total) * 100}%"></div></div></div>`; }).join("") : `<div class="empty">No driver coaching running.</div>`;
}
function renderRadio() { renderChans(); renderMsgs(); renderSuggest(); renderJobs(); renderPitwall(); renderSetup(); renderDriverCard(); }

// ---- engineer's controls ----
const segBtns = (id, opts, val) => `<div class="seg" id="${id}" role="group">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(val)}">${l}</button>`).join("")}</div>`;
function pitLossEst(c) { const lt = world.laneTime(c); let tSec = 0; const T2 = T, v = c.plan || c.vlim; for (let i = T2.pit.entry; i !== T2.pit.exit; i = (i + 1) % T2.N) tSec += T2.ds / Math.max(v ? v[i] : 40, 5); return lt - tSec + (world.rules.service.tyres || 0); }
function renderPitwall() {
  const c = cars[selected], O = c.orders, set = world.tyreSet(c), f1 = c.sp.energy === "f1", refuel = world.rules.refuel || world.session !== "race";
  const mates = cars.filter(x => x !== c && x.team === c.team && x.sp.cls === c.sp.cls);
  const ty = c.tyre, perLap = c.db.wearLaps.length ? c.db.wearLaps.slice(-4).reduce((a, b) => a + Math.max(b.F, b.R), 0) / Math.min(4, c.db.wearLaps.length) : null;
  const cliff = perLap ? Math.max(0, (1 - ty.wear) / perLap) : null;
  const fuelLaps = c.sp.energy === "ev" ? null : c.fuel / world.fuelPerLap(c);
  const ga = c.gapAhead ? `${c.gapAhead.s.toFixed(1)} s to #${c.gapAhead.car.number}` : "clear air";
  const behind = cars.filter(x => x.gapAhead && x.gapAhead.car === c)[0];
  $("pw-body").innerHTML = `
    <div class="pw-row"><span class="ctl-label">Strategy</span>${segBtns("pw-owner", [["ai", "Team strategist"], ["user", "You"]], O.owner)}</div>
    <div class="pw-data">
      <div><span>Tyres</span><b>${esc(ty.comp.name)}</b> ${ty.age} laps · F ${Math.round(ty.tempF)}° / R ${Math.round(ty.tempR)}°C · wear F ${Math.round(ty.wearF * 100)}% R ${Math.round(ty.wearR * 100)}%${cliff != null ? ` · ~${Math.round(cliff)} laps to the cliff` : ""}</div>
      <div><span>Fuel</span><b>${c.sp.energy === "ev" ? "electric" : c.fuel.toFixed(1) + " kg"}</b>${fuelLaps != null ? ` · ${fuelLaps.toFixed(1)} laps` : ""}${c.sp.energy === "f1" ? ` · battery ${c.soc.toFixed(2)} MJ, ${c.lapDeploy.toFixed(1)}/8.5 deployed${c.overtakeLap ? " · OVERTAKE MODE" : ""}` : ""}${c.sp.energy === "vet" ? ` · stint energy ${Math.round(c.stintE)}/${c.sp.stintMJ} MJ` : ""}</div>
      <div><span>Gaps</span>${ga}${behind ? ` · #${behind.number} ${behind.gapAhead.s.toFixed(1)} s behind` : ""} · pit loss ≈ ${pitLossEst(c).toFixed(1)} s</div>
      <div><span>Car</span>${c.damage.wing > 0.05 || c.damage.floor > 0.05 ? `<b style="color:var(--kerb)">damage: wing ${Math.round(c.damage.wing * 100)}%, floor ${Math.round(c.damage.floor * 100)}%</b>` : "no damage"}${c.pendingSetup ? ` · setup change waiting for the next stop` : ""}${c.crew.length > 1 ? ` · driving: ${esc(fullName(c))} (${fmtClock(c.driveTime[c.crewIdx])})` : ""}</div>
    </div>
    <div class="pw-box">
      <div class="ctl"><label class="ctl-label" for="pw-tyre">Tyres</label><select id="pw-tyre"><option value="">no change</option>${set.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div>
      ${refuel && c.sp.energy !== "ev" ? `<div class="ctl"><label class="ctl-label" for="pw-fuel">Fuel +kg</label><input id="pw-fuel" type="number" min="0" max="110" step="1" value="${world.session === "race" ? Math.round(Math.min(60, world.fuelPerLap(c) * 20)) : 0}"></div>` : ""}
      <div class="ctl"><label class="ctl-label" for="pw-wing">Front wing</label><select id="pw-wing"><option value="">no change</option><option value="-2">−2</option><option value="-1">−1</option><option value="1">+1</option><option value="2">+2</option><option value="new">new nose</option></select></div>
      <label class="chk"><input type="checkbox" id="pw-repair"> repair</label>
      ${c.crew.length > 1 ? `<label class="chk"><input type="checkbox" id="pw-driver"> driver change</label>` : ""}
      <button class="btn primary" id="pw-boxgo" type="button">${c.pitRequest ? "Boxing ✓ (update)" : "Box this lap"}</button>
      <button class="btn" id="pw-stay" type="button">Stay out</button>
    </div>
    <div class="pw-row"><span class="ctl-label">Pace</span>${segBtns("pw-pace", [["push", "Push"], ["normal", "Normal"], ["manage", "Manage tyres"]], O.pace)}</div>
    <div class="pw-row"><span class="ctl-label">Fuel mix</span>${segBtns("pw-mix", [["rich", "Rich"], ["std", "Standard"], ["lean", "Lean"]], O.fuel)}<span class="ctl-label">Lift &amp; coast</span>${segBtns("pw-lico", [[0, "Off"], [1, "1"], [2, "2"], [3, "3"]], O.lico)}</div>
    ${f1 ? `<div class="pw-row"><span class="ctl-label">Battery</span>${segBtns("pw-ers", [["harvest", "Harvest"], ["balanced", "Balanced"], ["attack", "Attack"]], O.ers)}</div>` : ""}
    <div class="pw-row"><span class="ctl-label">Racing</span>${segBtns("pw-pos", [["attack", "Attack"], ["free", "Free"], ["defend", "Defend"], ["hold", "Hold"]], O.position)}
      ${mates.length ? `<div class="ctl"><label class="ctl-label" for="pw-letby">Team order</label><select id="pw-letby"><option value="">race freely</option>${mates.map(m => `<option value="${m.slot}" ${O.letBy === m.slot ? "selected" : ""}>let #${m.number} by</option>`).join("")}</select></div>` : ""}</div>`;
}
function order(cmd, quiet) {
  const k = selected, c = cars[k];
  const reply = world.command(c, cmd);
  if (!quiet) { const r = (c.radio || []).pop(); say(k, "driver", r ? r.text : reply); }
  renderPitwall(); renderChans();
}
$("pw-body").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const grp = b.parentElement && b.parentElement.id, v = b.dataset.v;
  if (grp === "pw-owner") { world.command(cars[selected], { type: "owner", value: v }); say(selected, "sys", v === "user" ? "You have the car: it only stops when you call it. The strategist still advises on the radio." : "The team strategist has the car again."); renderPitwall(); return; }
  if (grp === "pw-pace") return order({ type: "pace", value: v });
  if (grp === "pw-mix") return order({ type: "fuel", value: v });
  if (grp === "pw-lico") return order({ type: "lico", value: +v });
  if (grp === "pw-ers") return order({ type: "ers", value: v });
  if (grp === "pw-pos") return order({ type: "position", value: v });
  if (b.id === "pw-stay") { say(selected, "coach", "Stay out, stay out."); return order({ type: "stayout", laps: 2 }); }
  if (b.id === "pw-boxgo") {
    const cmd = { type: "box", forced: true }, tyre = $("pw-tyre").value, fuel = $("pw-fuel") ? +$("pw-fuel").value : 0, wing = $("pw-wing").value;
    if (tyre) cmd.tyres = tyre; if (fuel > 0) cmd.fuel = fuel; if (wing) cmd.wing = wing === "new" ? true : +wing;
    if ($("pw-repair").checked) cmd.repair = true; if ($("pw-driver") && $("pw-driver").checked) cmd.driverChange = true;
    const tn = tyre ? world.tyreSet(cars[selected]).find(t => t.id === tyre).name : null;
    say(selected, "coach", `Box, box${tn ? ", " + tn.toLowerCase() : ""}${fuel > 0 ? `, ${fuel} kg fuel` : ""}${cmd.wing ? ", front wing" : ""}${cmd.driverChange ? ", driver change" : ""}.`);
    return order(cmd);
  }
});
$("pw-body").addEventListener("change", e => { if (e.target.id === "pw-letby") { const v = e.target.value; order({ type: "letBy", target: v === "" ? null : +v }); } });

// ---- setup sheet ----
let setupDraft = null;
function renderSetup() {
  const c = cars[selected], R = setupRange(c.sp), cur = Object.assign({}, c.setup, c.pendingSetup || {});
  if (!setupDraft || setupDraft.car !== c) setupDraft = { car: c, v: Object.assign({}, cur) };
  const garage = setupAllowed(world.seriesKey, world.session, "garage"), cockpit = setupAllowed(world.seriesKey, world.session, "cockpit");
  $("setup-sub").textContent = `${c.sp.name}. ${world.session === "practice" ? "Practice: everything can change; the car comes in to the garage for it." : `${SESS_NAMES[world.session]}: parc fermé rules apply.`} Brake balance and diff are cockpit switches and change immediately.`;
  $("setup-rows").innerHTML = SETUP_KEYS.map(k => {
    const [lo, hi] = R[k], v = setupDraft.v[k], ok = garage.includes(k) || cockpit.includes(k), step = k === "bias" ? 0.5 : 1;
    const tag = cockpit.includes(k) ? "cockpit" : garage.includes(k) ? (world.session === "practice" ? "garage" : "at a stop") : "locked";
    return `<div class="su-row${ok ? "" : " locked"}"><label for="su-${k}">${SETUP_LABEL[k][0]}<small>${SETUP_LABEL[k][1]}</small></label>
      <input type="range" id="su-${k}" data-k="${k}" min="${lo}" max="${hi}" step="${step}" value="${v}" ${ok ? "" : "disabled"}>
      <b>${k === "bias" ? v.toFixed(1) : (v > 0 && (k === "wingF" || k === "wingR" || k === "ride" || k === "press" || k === "camber") ? "+" : "") + v}</b><span class="su-tag ${tag}">${tag}</span></div>`;
  }).join("");
  const b = c.bal, fmtB = x => `<span class="${x < -0.07 ? "us" : x > 0.07 ? "os" : ""}">${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}</span>`;
  $("setup-bal").innerHTML = `<table class="baltab"><thead><tr><th>Balance (engineer's model)</th><th>Entry</th><th>Mid</th><th>Exit</th></tr></thead><tbody>
    <tr><td>Slow corners</td><td>${fmtB(b.entryL)}</td><td>${fmtB(b.midL)}</td><td>${fmtB(b.exitL)}</td></tr>
    <tr><td>Fast corners</td><td>${fmtB(b.entryH)}</td><td>${fmtB(b.midH)}</td><td>${fmtB(b.exitH)}</td></tr></tbody></table>
    <p class="note">− understeer, + oversteer. ${esc(c.driver.first)} likes ${c.driver.pref > 0.08 ? "a pointy car (a little oversteer)" : c.driver.pref < -0.08 ? "a stable car (a little understeer)" : "a neutral car"}. Downforce ${Math.round(c.clM / c.sp.clM * 100)}% · drag ${Math.round(c.cdM / c.sp.cdM * 100)}% of baseline · best brake balance is hidden: find it from lock-ups.</p>`;
}
$("setup-rows").addEventListener("input", e => { const k = e.target.dataset.k; if (!k) return; setupDraft.v[k] = +e.target.value; e.target.nextElementSibling.textContent = k === "bias" ? (+e.target.value).toFixed(1) : e.target.value; });
$("setup-apply").addEventListener("click", () => {
  const c = cars[selected], ch = {};
  for (const k of SETUP_KEYS) if (setupDraft.v[k] !== c.setup[k]) ch[k] = setupDraft.v[k];
  if (!Object.keys(ch).length) return;
  say(selected, "coach", `Setup: ${Object.entries(ch).map(([k, v]) => `${SETUP_LABEL[k][0].toLowerCase()} ${v}`).join(", ")}.`);
  order({ type: "setup", changes: ch });
  if (world.session === "practice" && c.pendingSetup && !c.pit) { world.command(c, { type: "box", forced: true, toGarage: true }); c.pitRequest.toGarage = true; c.pitRequest.reason = "Setup change"; say(selected, "sys", "Coming in to the garage for the setup change."); }
  setupDraft = null; renderSetup();
});
$("setup-reset").addEventListener("click", () => { setupDraft = null; renderSetup(); });

// ---- driver card: who is in the car ----
function renderDriverCard() {
  const c = cars[selected], D = c.driver;
  $("drv-card").innerHTML = `<div class="dc-head"><b>${esc(fullName(c))}</b> <span class="cat">${D.name}</span> <span class="cat">${PERSONAS[D.persona].label}</span>${c.crew.length > 1 ? ` <small>crew: ${c.crew.map((d, i) => `${i === c.crewIdx ? "<b>" : ""}${esc(d.first + " " + d.last)}${i === c.crewIdx ? "</b>" : ""}`).join(", ")}</small>` : ""}</div>
    <div class="dc-grid">
      <label>Weight <input type="number" id="dc-weight" min="50" max="110" value="${D.weight}"> kg</label>
      <label>Height <span>${D.height} cm</span></label>
      <label>Personality <select id="dc-persona">${Object.entries(PERSONAS).map(([k, p]) => `<option value="${k}" ${k === D.persona ? "selected" : ""}>${p.label}</option>`).join("")}</select></label>
      <label>Aggression <input type="range" id="dc-aggr" min="0" max="1" step="0.05" value="${D.aggression}"> <span>${Math.round(D.aggression * 100)}</span></label>
      <label>Risk <input type="range" id="dc-risk" min="0" max="1" step="0.05" value="${D.risk}"> <span>${Math.round(D.risk * 100)}</span></label>
      <label>Tyre care <span>${Math.round(D.tyreCare * 100)}</span></label>
    </div>
    <p class="note">${c.sp.cls === "f1" ? `F1 ballasts the driver to 82 kg; a heavier driver adds the extra (${Math.max(0, D.weight - 82)} kg now).` : `Every kilo is carried: car ${c.sp.mass} kg + driver and seat ${D.weight + 7} kg + fuel.`} Risk sets how big the driver's experiments are and how often it overdrives; feedback accuracy ${Math.round(D.feedback * 100)}%.</p>`;
}
$("drv-card").addEventListener("change", e => {
  const c = cars[selected], D = c.driver, id = e.target.id;
  if (id === "dc-weight") D.weight = clamp(+e.target.value, 50, 110);
  if (id === "dc-persona") { const P = PERSONAS[e.target.value], S = SKILL_BY[D.skill]; D.persona = e.target.value; D.aggression = clamp(S.aggression + P.aggression, 0.05, 1); D.risk = clamp(0.5 + P.risk, 0, 1); D.tyreCare = clamp(S.tyreCare + P.tyreCare, 0.4, 1.05); D.pref = P.pref; }
  if (id === "dc-aggr") D.aggression = +e.target.value;
  if (id === "dc-risk") D.risk = +e.target.value;
  applyRisk(D); Object.assign(c.D, { aggression: D.aggression, risk: D.risk, tyreCare: D.tyreCare, pref: D.pref, sConf: D.sConf, sLine: D.sLine, mistakeRate: D.mistakeRate });
  c.computeBalMul(); renderDriverCard(); renderSetup();
});

// ---- radio: plain words or Claude ----
function cornerIndex(text) {
  const found = new Set(), t = text.toLowerCase();
  for (const m of t.matchAll(/\b(?:t|turn)\s*(\d{1,2})\b/g)) { const n = +m[1]; if (T.corners.some(c => (c.n || 0) === n)) found.add(n); else if (n >= 1 && n <= T.corners.length) found.add(n); }
  T.corners.forEach((c, i) => { const n = (c.name || "").toLowerCase().replace("'", ""); if (n && n.length > 3 && t.includes(n)) found.add(c.n || i + 1); });
  return [...found];
}
// engineer commands in plain words: "box this lap for softs", "push", "save fuel", "defend", "let 12 by"
function parseCommands(text, c) {
  const t = text.toLowerCase(), out = [], set = world.tyreSet(c);
  if (/\bbox\b|\bpit (this|now|in)\b|come in/.test(t)) {
    const cmd = { type: "box" };
    for (const ty of set) { const w = ty.name.toLowerCase().split(" ")[0]; if (t.includes(w) || t.includes(w + "s") || new RegExp(`\\b${ty.id.toLowerCase()}\\b`).test(t) && t.includes("tyre")) cmd.tyres = ty.id; }
    if (/\bsofts?\b/.test(t)) cmd.tyres = (set.find(x => x.id === "S") || {}).id || cmd.tyres;
    if (/\bmediums?\b/.test(t)) cmd.tyres = (set.find(x => x.id === "M") || {}).id || cmd.tyres;
    if (/\bhards?\b/.test(t)) cmd.tyres = (set.find(x => x.id === "H") || {}).id || cmd.tyres;
    if (/\binters?\b|intermediate/.test(t)) cmd.tyres = (set.find(x => x.wet === "inter") || set.find(x => x.wet) || {}).id;
    if (/\bwets?\b/.test(t)) cmd.tyres = (set.find(x => x.wet === "full") || set.find(x => x.wet) || {}).id;
    const f = t.match(/(\d+)\s*(?:kg|kilos?)/); if (f) cmd.fuel = +f[1]; else if (/fuel|refuel/.test(t) && world.rules.refuel) cmd.fuel = Math.round(world.fuelPerLap(c) * 20);
    if (/nose|front wing/.test(t)) cmd.wing = true;
    if (/repair|fix/.test(t)) cmd.repair = true;
    if (/driver change|swap driver/.test(t)) cmd.driverChange = true;
    out.push(cmd);
  }
  if (/stay out/.test(t)) out.push({ type: "stayout", laps: 2 });
  if (/\bpush\b|flat out|qualifying mode|go go/.test(t)) out.push({ type: "pace", value: "push" });
  else if (/manage|look after|save (the )?tyres|tyre saving/.test(t)) out.push({ type: "pace", value: "manage" });
  else if (/normal pace|standard pace/.test(t)) out.push({ type: "pace", value: "normal" });
  if (/save fuel|lift and coast|lift & coast/.test(t)) out.push({ type: "lico", value: /hard|lots|3/.test(t) ? 3 : 2 });
  if (/rich mix|engine mode rich|full power/.test(t)) out.push({ type: "fuel", value: "rich" });
  if (/lean mix/.test(t)) out.push({ type: "fuel", value: "lean" });
  if (/harvest/.test(t)) out.push({ type: "ers", value: "harvest" });
  if (/deploy|attack mode|overtake/.test(t) && c.sp.energy === "f1") out.push({ type: "ers", value: "attack" });
  if (/\bdefend\b|cover the inside/.test(t)) out.push({ type: "position", value: "defend" });
  else if (/hold position|no fighting/.test(t)) out.push({ type: "position", value: "hold" });
  else if (/\battack\b|go for it|send it/.test(t)) out.push({ type: "position", value: "attack" });
  const lb = t.match(/let (?:#|car )?(\d+) (?:by|through|past)/); if (lb) { const m = cars.find(x => x.number === +lb[1]); if (m) out.push({ type: "letBy", target: m.slot }); }
  return out;
}
function parseCoaching(text, k) {
  const parts = text.split(/\s*(?:[.;!]|,\s*(?:and|then)?|\band\b|\bthen\b|\balso\b)\s*/i).filter(x => x && x.trim().length > 2);
  const out = [], seen = new Set(); let carry = []; let question = /\?|\bwhere\b|\bwhat\b|\bhow\b|\bwhy\b/i.test(text);
  for (const part of parts) {
    const r = parseClause(part, k);
    if (r.corners.length) carry = r.corners;
    for (const type of r.acts) { const corners = r.corners.length ? r.corners : carry; const key = type + corners.join(); if (!seen.has(key)) { seen.add(key); out.push({ type, corners, laps: 6 }); } }
  }
  return { actions: out.slice(0, 3), question };
}
function parseClause(text, k) {
  const t = text.toLowerCase(), acts = [], corners = cornerIndex(text);
  const has = re => re.test(t);
  if (has(/trail/)) acts.push("learn_trail_braking");
  if (has(/braking (zone|point)s?|brake (in a straight|before (the|each|every) corner)|plan.*brak/)) acts.push("learn_braking_zones");
  if (has(/(whole|full|all( of)? the) (track|width)|outside.*inside.*outside|racing line/) && !corners.length) acts.push("learn_racing_line");
  if (has(/throttle|power on|on the gas|squeeze/) && !corners.length) acts.push("learn_exit_throttle");
  if (has(/phase|mid-entry|mid-exit/)) acts.push("learn_corner_phases");
  if (has(/smooth|calm(er)? hands|gentle|steering/)) acts.push("smoother");
  if (has(/later apex|late apex|turn in later|delay/)) acts.push("late_apex");
  else if (has(/early apex|earlier apex|turn in earlier/)) acts.push("early_apex");
  if (has(/brake later|later brak|brake deeper|carry more|more speed|commit|more grip/) && !has(/too fast/)) acts.push("brake_later");
  if (has(/brake earlier|earlier brak|too fast|less speed|back it off/)) acts.push("brake_earlier");
  if (has(/wid(e|er) (entry|in)|use more (track|road)|from the outside/)) acts.push("wider_entry");
  if (has(/track out|run out wide|exit kerb/)) acts.push("wider_exit");
  if (has(/clip|tight(er)? (to the )?apex|hug/)) acts.push("tighter_apex");
  if (has(/experiment more|be braver|bigger changes/)) acts.push("explore_more");
  if (has(/consistent|smaller changes|steady/)) acts.push("explore_less");
  return { acts: [...new Set(acts)], corners };
}
function applyActions(k, actions) {
  const c = cars[k], applied = [];
  for (const a of actions || []) {
    if (!a || !ACTIONS[a.type]) continue;
    const toIdx = n => { const i = T.corners.findIndex(x => (x.n || 0) === n); return i >= 0 ? T.corners[i].n || i + 1 : n; };
    let corners = (a.corners || []).map(Number).map(toIdx).filter(n => c.cornerPts && c.cornerPts.some(cp => cp.n === n));
    if (CORNER_TYPES.has(a.type) && !corners.length) corners = losses(k).filter(x => x.d > 0).slice(0, 2).map(x => x.n);
    if (CORNER_TYPES.has(a.type) && !corners.length && c.cornerPts && c.cornerPts.length) corners = [c.cornerPts[0].n];
    const res = c.addCoaching({ type: a.type, corners, laps: Math.max(2, Math.min(12, +a.laps || 6)) });
    applied.push({ type: a.type, corners, res, note: CORNER_TYPES.has(a.type) ? `I'll try ${ACTION_LABEL[a.type]} at ${corners.map(cname).join(" and ")}.` : `${res.charAt(0).toUpperCase() + res.slice(1)}.` });
  }
  return applied;
}
function quickReply(c, question) {
  const d = makeDebrief(c, world);
  if (question) return d.lines.slice(0, c.D.feedback > 0.8 ? 3 : 1).join(" ");
  return "Copy.";
}
function driverBrief(k) {
  const c = cars[k], D = c.D, dv = c.driver, L = losses(k).filter(x => x.d > 0.02).slice(0, 5), dbf = makeDebrief(c, world);
  const pos = world.session === "race" ? world.raceOrder().indexOf(c.slot) + 1 : null;
  return [
    `Circuit: ${TRACK.name} (${TRACK.country || ""}), ${(T.L / 1000).toFixed(2)} km. Corners: ${T.corners.map((x, i) => `T${x.n || i + 1} ${x.name}`).join(", ")}.`,
    `You are ${dv.first} ${dv.last}, a ${D.name}-level driver (${PERSONAS[dv.persona].label.toLowerCase()} personality; aggression ${Math.round(dv.aggression * 100)}%, risk appetite ${Math.round(dv.risk * 100)}%), ${dv.weight} kg, driving car #${c.number}, a ${c.sp.name} (${c.sp.className}, 2026 rules).`,
    `How well you can describe the car: ${Math.round(dv.feedback * 100)}% (a Pro is precise and technical; a Rookie is vague, emotional and sometimes wrong).`,
    `Session: ${world.mode === "ghost" ? "ghost running" : world.sessionDef.name}, ${world.weather.name.toLowerCase()}, track ${world.weather.track}°C.${pos ? ` Position ${pos}, ${world.raceLaps ? `lap ${c.raceLaps + 1}/${world.raceLaps}` : ""}, ${c.stops} stops.` : ""} Gap ahead: ${c.gapAhead ? c.gapAhead.s.toFixed(1) + " s" : "clear"}.`,
    `Car now: ${c.tyre.comp.name} tyres, ${c.tyre.age} laps, wear F ${Math.round(c.tyre.wearF * 100)}% R ${Math.round(c.tyre.wearR * 100)}%, temps F ${Math.round(c.tyre.tempF)} R ${Math.round(c.tyre.tempR)}°C (window ${c.tyre.comp.win.join("-")}). Fuel ${c.fuel.toFixed(1)} kg.${c.sp.energy === "f1" ? ` Battery ${c.soc.toFixed(1)} MJ.` : ""} Damage: wing ${Math.round(c.damage.wing * 100)}%, floor ${Math.round(c.damage.floor * 100)}%.`,
    `Orders in force: pace ${c.orders.pace}, fuel ${c.orders.fuel}, lift-and-coast ${c.orders.lico}, ERS ${c.orders.ers}, position ${c.orders.position}, strategy owner ${c.orders.owner}.`,
    `What you feel (already filtered by your feedback skill; use it, don't invent other problems): ${dbf.lines.join(" ")}`,
    `Laps: ${c.laps.length}, best ${fmt(c.best)}, last ${fmt(c.lastLap ?? Infinity)}, incidents ${c.crashes}. Time lost to the class reference by corner: ${L.length ? L.map(x => `${cname(x.n)} +${x.d.toFixed(2)}s`).join(", ") : "not known yet"}.`,
  ].join("\n");
}
async function askClaude(k, text) {
  const hist = transcripts[k].filter(m => m.from === "coach" || m.from === "driver").slice(-8).map(m => `${m.from === "coach" ? "Engineer" : "You"}: ${m.text}`).join("\n");
  const set = world.tyreSet(cars[k]).map(t => `${t.id} = ${t.name}`).join(", ");
  const prompt = `You are role-playing a racing driver on team radio with your race engineer in a racing simulation. Stay in character.

${driverBrief(k)}

Radio so far:
${hist || "(nothing yet)"}

The engineer just said: "${text}"

Respond as the driver, and turn any instruction into commands and/or driving actions.
Commands (the car and strategy): ${Object.entries(COMMANDS).map(([t, d]) => `${t}: ${d}`).join("; ")}. Tyre ids: ${set}.
Driving actions (how you drive): ${Object.entries(ACTIONS).map(([t, d]) => `${t}: ${d}`).join("; ")}. Corner actions need "corners": turn numbers.
Rules: only issue commands the engineer asked for. If asked how the car feels, answer from "What you feel" in your own voice and skill level. At most 3 commands and 2 actions. Reply 1-3 short sentences of radio, no stage directions.
Return only JSON: {"reply": string, "commands": [{"type": string, "value"?: any, "tyres"?: string, "fuel"?: number, "wing"?: any, "repair"?: boolean, "driverChange"?: boolean, "laps"?: number}], "actions": [{"type": string, "corners": number[], "laps": number}]}`;
  return sample.json(prompt, { modelTier: "quick", cache: false });
}
$("radio-form").addEventListener("submit", async e => {
  e.preventDefault();
  const input = $("radio-input"), text = input.value.trim();
  if (!text || busy) return;
  const k = selected, c = cars[k]; input.value = ""; busy = true;
  say(k, "coach", text);
  transcripts[k].push({ from: "typing", text: "on the radio…" }); if (k === selected) renderMsgs();
  let reply, applied = [], cmds = [];
  try {
    if (radioMode !== "claude") throw { code: "offline" };
    const out = await askClaude(k, text);
    cmds = Array.isArray(out && out.commands) ? out.commands.filter(x => x && COMMANDS[x.type]).slice(0, 3) : [];
    applied = applyActions(k, Array.isArray(out && out.actions) ? out.actions.slice(0, 2) : []);
    reply = (out && typeof out.reply === "string" && out.reply.trim()) || "Copy.";
  } catch (err) {
    if (err && (err.code === "not_granted" || err.code === "unavailable")) { radioMode = "rules"; setRadioMode(); }
    cmds = parseCommands(text, c);
    const p = cmds.length ? { actions: [], question: false } : parseCoaching(text, k);
    applied = applyActions(k, p.actions);
    reply = cmds.length ? null : applied.length ? `Copy. ${applied.map(a => a.note).join(" ")}` : quickReply(c, p.question || /feel|balance|car|tyres?|how/i.test(text));
  }
  transcripts[k] = transcripts[k].filter(m => m.from !== "typing");
  for (const cmd of cmds) { const r = world.command(c, Object.assign({ forced: true }, cmd)); const last = (c.radio || []).pop(); if (!reply) say(k, "driver", last ? last.text : r); else say(k, "sys", r); }
  if (reply) say(k, "driver", reply);
  for (const a of applied) say(k, "sys", CORNER_TYPES.has(a.type) ? `Coaching: ${ACTION_LABEL[a.type]} at ${a.corners.map(cname).join(", ")}. ${a.res}.` : `${nm(c)}: ${a.res}.`);
  busy = false;
  if (applied.some(a => a.type.startsWith("learn_") || a.type === "smoother")) renderChips();
  renderJobs(); renderSuggest(); renderChans(); renderPitwall();
});
function setRadioMode() {
  $("radio-mode").textContent = radioMode === "claude" ? "Drivers answer through Claude (your Claude account), in character and at their own feedback level. Orders run in the sim." : radioMode === "rules" ? "Offline radio: drivers understand orders like \"box this lap, softs\", \"push\", \"save fuel\", \"defend\", and coaching like \"brake later at T5\"." : "Connecting the radio…";
}
function drainRadio() {
  cars.forEach((c, k) => {
    while (c.radio && c.radio.length) {
      const r = c.radio.shift();
      if (r.kind === "msg") { say(k, r.from === "data" ? "data" : "driver", r.text); continue; }
      const j = r.job;
      say(k, "driver", j.kept ? `Finished ${ACTION_LABEL[j.type]} at ${j.corners.map(cname).join(", ")}: kept ${j.kept} of ${j.tries}, found ${j.gain.toFixed(2)}s.` : `Tried ${ACTION_LABEL[j.type]} at ${j.corners.map(cname).join(", ")} ${j.tries} times. Nothing faster, back to what I had.`);
    }
  });
}

// ---------- debriefs ----------
let debriefSel = null;
function renderDebrief() {
  const list = world.debriefs, el = $("debrief-body");
  if (!list) { el.innerHTML = `<div class="empty">Debriefs come in when a weekend session ends. You can also call one now.</div>`; return; }
  const order = list.slice().sort((a, b) => (b.accuracy - a.accuracy) || a.slot - b.slot);
  if (debriefSel == null || !list[debriefSel]) debriefSel = selected;
  const d = list.find(x => x.slot === debriefSel) || order[0], c = cars[d.slot];
  const tabs = order.map(x => `<button type="button" data-k="${x.slot}" aria-pressed="${x.slot === d.slot}" style="--c:${cars[x.slot].D.color}"><i></i>#${cars[x.slot].number} ${esc(x.driver.split(" ").slice(-1)[0])} <small>${cars[x.slot].D.short}</small></button>`).join("");
  const B = d.data.balance, F = d.data.felt, cell = k => B[k] == null ? "–" : `<span class="${F[k] < -0.07 ? "us" : F[k] > 0.07 ? "os" : ""}">${F[k] >= 0 ? "+" : "−"}${Math.abs(F[k]).toFixed(2)}</span> <small>data ${B[k] >= 0 ? "+" : "−"}${Math.abs(B[k]).toFixed(2)}</small>`;
  el.innerHTML = `<div class="db-tabs">${tabs}</div>
    <div class="db-main">
      <div class="db-voice"><div class="db-who"><b>${esc(d.driver)}</b> · ${esc(c.sp.name)} · ${c.D.name} · ${PERSONAS[d.persona].label} · feedback ${Math.round(d.accuracy * 100)}%</div>
        ${d.lines.map(l => `<p>“${esc(l)}”</p>`).join("")}
        ${d.voice ? `<p class="db-claude">${esc(d.voice)}</p>` : `<button type="button" class="btn" id="db-voice">Hear it in their own words</button>`}
      </div>
      <div class="db-data">
        <table class="baltab"><thead><tr><th>Felt vs data</th><th>Entry</th><th>Mid</th><th>Exit</th></tr></thead><tbody>
          <tr><td>Slow corners</td><td>${cell("entryL")}</td><td>${cell("midL")}</td><td>${cell("exitL")}</td></tr>
          <tr><td>Fast corners</td><td>${cell("entryH")}</td><td>${cell("midH")}</td><td>${cell("exitH")}</td></tr></tbody></table>
        <div class="db-facts">
          <span>Tyre temps F/R <b>${d.data.temps.F ? Math.round(d.data.temps.F) : "–"} / ${d.data.temps.R ? Math.round(d.data.temps.R) : "–"}°C</b> (window ${d.data.temps.win.join("–")})</span>
          <span>Wear/lap F/R <b>${d.data.wear.F != null ? (d.data.wear.F * 100).toFixed(1) + " / " + (d.data.wear.R * 100).toFixed(1) + "%" : "–"}</b></span>
          <span>Lock-ups F/R <b>${d.data.events.lockF} / ${d.data.events.lockR}</b></span><span>Wheelspin <b>${d.data.events.wheelspin}</b></span>
          <span>Bottoming <b>${d.data.events.bottom}</b></span><span>Off / wide / spins <b>${d.data.events.wide} / ${d.data.events.spin}</b></span>
          <span>Top speed <b>${Math.round(d.data.vmax)}</b> km/h${d.data.vmaxRivals ? ` (class best ${Math.round(d.data.vmaxRivals)})` : ""}</span>
          <span>Traffic <b>${Math.round(d.data.events.traffic)} s</b></span>
        </div>
        <div class="db-req"><div class="sec-title">Asks for</div>${d.requests.length ? d.requests.map((r, i) => `<div class="req"><span>${SETUP_LABEL[r.key][0]} ${r.delta > 0 ? "+" : ""}${r.delta} → <b>${r.key === "bias" ? r.to.toFixed(1) : r.to}</b> <small>${esc(r.why)}</small></span><button type="button" class="btn" data-req="${i}">Apply</button></div>`).join("") + `<button type="button" class="btn primary" data-req="all">Apply all</button>` : `<div class="empty">No setup requests.</div>`}</div>
      </div>
    </div>`;
}
$("debrief-body").addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.k) { debriefSel = +t.dataset.k; renderDebrief(); return; }
  const d = world.debriefs.find(x => x.slot === debriefSel), c = cars[d.slot];
  if (t.dataset.req) {
    const reqs = t.dataset.req === "all" ? d.requests : [d.requests[+t.dataset.req]], ch = {};
    for (const r of reqs) ch[r.key] = r.to;
    const prevSel = selected; selected = d.slot;
    say(d.slot, "coach", `Debrief changes: ${reqs.map(r => `${SETUP_LABEL[r.key][0].toLowerCase()} ${r.to}`).join(", ")}.`);
    order({ type: "setup", changes: ch }); selected = prevSel;
    d.requests = d.requests.filter(r => !reqs.includes(r)); setupDraft = null; renderDebrief(); renderSetup(); return;
  }
  if (t.id === "db-voice") {
    if (radioMode !== "claude") { d.voice = "(Claude isn't connected, so this is the driver's own summary above.)"; renderDebrief(); return; }
    t.disabled = true; t.textContent = "Listening…";
    try {
      const out = await sample.json(`You are ${d.driver}, a ${SKILL_BY[d.skill].name}-level racing driver (${PERSONAS[d.persona].label.toLowerCase()}), giving your engineer the post-session debrief for car #${c.number} (${c.sp.name}) after ${world.sessionDef.name} at ${TRACK.name}. Speak naturally in first person, 4-7 sentences, in your own voice and at your level: a Pro is precise and technical, a Rookie vague. Use ONLY these points, don't add facts: ${d.lines.join(" ")} ${d.requests.length ? "You'd like: " + d.requests.map(r => `${SETUP_LABEL[r.key][0]} ${r.delta > 0 ? "+" : ""}${r.delta} (${r.why})`).join("; ") + "." : ""} Return only JSON: {"text": string}`, { modelTier: "quick", cache: false });
      d.voice = String((out && out.text) || "").trim();
    } catch { d.voice = "(The radio dropped out.)"; }
    renderDebrief();
  }
});
$("debrief-now").addEventListener("click", () => { world.debriefs = cars.map(c => makeDebrief(c, world)); debriefSel = selected; renderDebrief(); });
