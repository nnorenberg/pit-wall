// ===== layout: every section is a tile you can collapse, resize (half / full width) and tileDrag into any order =====
// The tile is the section's own panel: a bar is added as its first row. Collapsed, a tile shows only the bar:
// its name and a one-line summary of the key numbers. The order, widths and collapsed state are kept per browser.
const LAYOUT_KEY = "pitwall-layout-v1";
// [key, title, how to find the section, default width]
const TILES = [
  ["reference", "Real-world reference", "#reference", "full"],
  ["champ", "Championship", "#champ", "full"],
  ["grid", "Grid", "#grid-panel", "full"],
  ["pitwall", "Pit wall: radio, chat and engineer's orders", "#pitwall", "full"],
  ["cbc", "Corner by corner", 'section[aria-label="Corner by corner"]', "full"],
  ["telemetry", "Telemetry", 'section[aria-label="Telemetry"]', "full"],
  ["learning", "Learning curves", 'section[aria-label="Learning curves"]', "half"],
  ["explog", "Experiment log", 'section[aria-label="Experiment log"]', "half"],
  ["car", "Car data", 'section[aria-label="Selected driver"]', "half"],
  ["corner", "Corner mathematics", 'section[aria-label="Corner geometry"]', "half"],
  ["setup", "Car setup", 'section[aria-label="Setup sheet"]', "half"],
  ["driver", "Driver mentality and debrief", 'section[aria-label="Driver"]', "half"],
  ["results", "Session results", "#results-panel", "full"],
];
// fixed at the top: collapsible, not movable
const PINNED = [
  ["rc", "Race control", "#rc-anchor"],
  ["track", "Track", ".track-panel"],
  ["timing", "Timing", ".tower"],
];
// headings inside a section that the bar now replaces
const DUP_TITLES = {
  reference: ".eyebrow", champ: ".chart-head h3", grid: ".chart-head h3", cbc: ".chart-head .sec-title", telemetry: ".chart-head .sec-title",
  learning: ".chart-head .sec-title", explog: ".chart-head .sec-title", setup: ".geo-head h3", driver: ".geo-head:first-of-type", timing: ".tower-head h2",
};
let layout = null;
const tileEls = {};
function loadLayout() {
  const def = { order: TILES.map(t => t[0]), w: Object.fromEntries(TILES.map(t => [t[0], t[3]])), c: {} };
  try {
    const s = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null");
    if (s && Array.isArray(s.order)) {
      // keep the saved order, drop unknown keys, append tiles added since
      const known = new Set(def.order), order = s.order.filter(k => known.has(k));
      for (const k of def.order) if (!order.includes(k)) order.push(k);
      return { order, w: Object.assign(def.w, s.w || {}), c: Object.assign({}, s.c || {}) };
    }
  } catch { }
  return def;
}
function saveLayout() {
  layout.order = [...$("board").children].filter(el => el.dataset.tile).map(el => el.dataset.tile);
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { }
}

// ---------- the bar ----------
function makeBar(key, title, movable) {
  const bar = document.createElement("div");
  bar.className = "tile-bar";
  bar.innerHTML = `${movable ? `<button type="button" class="tile-grip" aria-label="Move ${esc(title)}. Drag, or use the arrow keys" title="Drag to move (or focus and use the arrow keys)">⠿</button>` : ""}
    <button type="button" class="tile-name" aria-expanded="true"><span class="tile-chev" aria-hidden="true"></span><span class="tile-title">${esc(title)}</span></button>
    <span class="tile-sum" aria-live="off"></span>
    ${movable ? `<div class="seg tile-w" role="group" aria-label="Width of ${esc(title)}"><button type="button" data-w="half">Half</button><button type="button" data-w="full">Full</button></div>` : ""}`;
  return bar;
}
function setCollapsed(el, on) {
  el.classList.toggle("collapsed", on);
  el.querySelector(".tile-name").setAttribute("aria-expanded", String(!on));
  layout.c[el.dataset.tile] = on || undefined;
  if (on) updateSummary(el);
}
function setWidth(el, w) {
  el.dataset.w = w; layout.w[el.dataset.tile] = w;
  for (const b of el.querySelectorAll(".tile-w button")) b.setAttribute("aria-pressed", String(b.dataset.w === w));
}
function relayout() { saveLayout(); requestAnimationFrame(() => { resize(); updateSummaries(); }); }

// ---------- summaries: the key numbers a collapsed tile still shows ----------
const SUMMARY = {
  rc: () => [...$("rc-status").children].map(e => e.textContent.trim()).filter(Boolean).join(" · "),
  track: () => `${TRACK.name} · ${pl(cars.length, "car")} · ${camMode === "follow" ? "following #" + cars[selected].number : "whole circuit"}`,
  timing: () => { const o = standings(), c = cars[o[0]]; return c ? `P1 #${c.number} ${c.driver.last} · selected #${cars[selected].number} in P${o.indexOf(selected) + 1}` : ""; },
  reference: () => `${$("ref-track").textContent} · ${(s => s ? s.label || s.name || s.id : "")(REF_SERIES.find(s => s.id === refState.series))}${refState.year ? " " + refState.year : ""}`,
  champ: () => {
    if (!champ) return "No championship running";
    const s = CHAMP_SERIES.find(x => x.id === champ.series), lead = Object.values(champ.drivers).sort((a, b) => b.pts - a.pts)[0];
    return `${s ? s.name : champ.series} · ${champ.done.length}/${seasonFor(champ.series).length} rounds done${lead ? ` · leader ${lead.name} ${lead.pts} pts` : ""}`;
  },
  grid: () => classOpt().classIds.map(cid => { const g = gridUI.grid[cid]; return `${CLASSES.find(c => c.id === cid).name}: ${classTotal(cid)} cars (${SKILL_KEYS.map(k => `${g[k] || 0} ${SKILL_BY[k].name}`).join(", ")})`; }).join(" · "),
  pitwall: () => { const c = cars[selected], t = c.tyre; return `#${c.number} ${fullName(c)} · ${t.comp.name} ${pl(t.age, "lap")} · ${c.sp.energy === "ev" ? "electric" : c.fuel.toFixed(1) + " kg fuel"} · ${c.orders.owner === "user" ? "you call the strategy" : "strategist in charge"}${c.pitRequest ? " · BOXING THIS LAP" : ""}`; },
  cbc: () => { const c = cars[selected]; return `#${c.number} ${c.driver.last} · last lap ${fmt(c.lastLap ?? Infinity)} · best ${fmt(c.best)}`; },
  telemetry: () => $("cmp-sub").textContent,
  learning: () => { const b = cars.filter(c => isFinite(c.best)).sort((a, b) => a.best - b.best)[0]; return b ? `Fastest so far ${fmt(b.best)}, #${b.number} ${b.driver.last} · ${pl(Math.max(...cars.map(c => c.laps.length)), "lap")} run` : "No laps yet"; },
  explog: () => { const c = cars[selected]; return `#${c.number} ${c.driver.last}: ${c.improvements} of ${pl(c.attempts, "experiment")} kept`; },
  car: () => { const c = cars[selected]; return `#${c.number} ${c.driver.last} · ${c.sp.name} · ${Math.round(c.v * 3.6)} km/h · ${c.tyre.comp.name}`; },
  corner: () => { const t = $("geo-title"), sm = t.querySelector("small"); return sm ? `${t.firstChild.textContent} · ${sm.textContent}` : t.textContent; },
  setup: () => { const c = cars[selected]; return `${c.sp.name} · ${setupDraft && setupDraft.car === c && SETUP_KEYS.some(k => setupDraft.v[k] !== c.setup[k]) ? "changes not applied yet" : c.pendingSetup ? "change waiting for the next stop" : "no pending changes"}`; },
  driver: () => { const c = cars[selected], d = c.driver; return `${fullName(c)} · ${SKILL_BY[d.skill].name} · ${PERSONAS[d.persona].label} · ${d.weight} kg${world.debriefs ? " · debrief ready" : ""}`; },
  results: () => $("res-sub").textContent ? `${$("res-title").textContent} · ${$("res-sub").textContent}` : "No results yet: they appear when a session ends",
};
function updateSummary(el) {
  let t = "";
  try { t = SUMMARY[el.dataset.tile] ? SUMMARY[el.dataset.tile]() : ""; } catch { t = ""; }
  const s = el.querySelector(".tile-sum");
  if (s.textContent !== t) { s.textContent = t; s.title = t; }
}
function updateSummaries() { for (const el of Object.values(tileEls)) if (el.classList.contains("collapsed")) updateSummary(el); }

// ---------- moving tiles ----------
const boardTiles = () => [...$("board").children].filter(el => el.dataset.tile);
// slide every tile from where it was to where it is now
function flipFrom(before) {
  if (reduceMotion()) return;
  for (const [el, a] of before) {
    const b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 180, easing: EASE_OUT });
  }
}
const rects = () => new Map([...$("board").children].map(el => [el, el.getBoundingClientRect()]));
function announce(msg) { $("layout-live").textContent = msg; }

let tileDrag = null;
function onGripDown(e) {
  if (e.button !== 0 || tileDrag) return;
  const grip = e.currentTarget, el = grip.closest("[data-tile]");
  try { grip.setPointerCapture(e.pointerId); } catch { }
  window.addEventListener("pointermove", onGripMove);
  window.addEventListener("pointerup", onWinUp);
  window.addEventListener("pointercancel", onWinCancel);
  tileDrag = { el, grip, pid: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, live: false, home: el.nextElementSibling };
}
function beginDrag() {
  const d = tileDrag, el = d.el, before = rects();
  d.wasCollapsed = el.classList.contains("collapsed");
  el.classList.add("collapsed");                  // lift it as its bar: easy to carry past long sections
  const r = el.getBoundingClientRect();
  const ph = d.ph = document.createElement("div");
  ph.className = "tile-ph"; ph.dataset.w = el.dataset.w; ph.style.height = r.height + "px";
  el.before(ph);
  d.offX = d.x - r.left; d.offY = Math.min(d.y - r.top, r.height - 4);
  Object.assign(el.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", zIndex: 50 });
  d.left0 = r.left; d.top0 = r.top;
  el.classList.add("dragging");
  before.delete(el); flipFrom(before);
  d.live = true;
  d.raf = requestAnimationFrame(dragTick);
}
function placePointer() {
  const d = tileDrag;
  d.el.style.transform = `translate(${d.x - d.offX - d.left0}px, ${d.y - d.offY - d.top0}px)`;
  // find where the placeholder should go: the first tile whose slot the pointer is in
  const tiles = boardTiles().filter(t => t !== d.el);
  let target = null, after = false;
  for (const t of tiles) {
    const r = t.getBoundingClientRect();
    if (d.y < r.top - 7 || d.y > r.bottom + 7) continue;
    if (t.dataset.w === "half" && (d.x < r.left - 7 || d.x > r.right + 7)) continue;
    target = t; after = t.dataset.w === "half" ? d.x > r.left + r.width / 2 : d.y > r.top + r.height / 2; break;
  }
  if (!target) {
    const first = tiles[0], last = tiles[tiles.length - 1];
    if (last && d.y > last.getBoundingClientRect().bottom) { target = last; after = true; }
    else if (first && d.y < first.getBoundingClientRect().top) { target = first; after = false; }
  }
  if (!target) return;
  const ref = after ? target.nextElementSibling : target;
  if (ref === d.ph || (after && target.nextElementSibling === d.ph) || (!after && target.previousElementSibling === d.ph)) return;
  const before = rects();
  $("board").insertBefore(d.ph, after ? target.nextElementSibling : target);
  before.delete(d.el); flipFrom(before);
}
function dragTick() {
  const d = tileDrag; if (!d || !d.live) return;
  // scroll the page when the pointer is near the top or bottom edge
  const edge = 70, h = window.innerHeight;
  const v = d.y < edge ? -(edge - d.y) / edge * 22 : d.y > h - edge ? (d.y - (h - edge)) / edge * 22 : 0;
  if (v) { window.scrollBy(0, v); placePointer(); }
  d.raf = requestAnimationFrame(dragTick);
}
function onGripMove(e) {
  const d = tileDrag; if (!d || e.pointerId !== d.pid) return;
  d.x = e.clientX; d.y = e.clientY;
  if (!d.live) { if (Math.hypot(d.x - d.x0, d.y - d.y0) < 6) return; beginDrag(); }
  placePointer();
}
function onWinUp(e) { if (tileDrag && e.pointerId === tileDrag.pid) endDrag(false); }
function onWinCancel(e) { if (tileDrag && e.pointerId === tileDrag.pid) endDrag(true); }
function endDrag(cancel) {
  const d = tileDrag; if (!d) return;
  window.removeEventListener("pointermove", onGripMove);
  window.removeEventListener("pointerup", onWinUp);
  window.removeEventListener("pointercancel", onWinCancel);
  tileDrag = null;
  if (!d.live) return;
  cancelAnimationFrame(d.raf);
  if (cancel) $("board").insertBefore(d.ph, d.home && d.home.parentNode ? d.home : null);
  const el = d.el, to = d.ph.getBoundingClientRect();
  const done = () => {
    el.classList.remove("dragging");
    Object.assign(el.style, { position: "", left: "", top: "", width: "", zIndex: "", transform: "", transition: "" });
    d.ph.replaceWith(el);
    if (!d.wasCollapsed) el.classList.remove("collapsed");
    const i = boardTiles().indexOf(el);
    announce(`${el.dataset.title} moved to position ${i + 1} of ${boardTiles().length}.`);
    relayout(); d.grip.focus({ preventScroll: true });
  };
  if (reduceMotion()) return done();
  // settle into the slot from wherever it was let go
  const a = el.animate([{ transform: el.style.transform }, { transform: `translate(${to.left - d.left0}px, ${to.top - d.top0}px)` }], { duration: 160, easing: EASE_OUT });
  // finish on the animation's end, or after its duration if animations are paused (background tab)
  let over = false; const fin = () => { if (over) return; over = true; a.cancel(); done(); };
  a.onfinish = fin; setTimeout(fin, 220);
}
function onGripKey(e) {
  const el = e.currentTarget.closest("[data-tile]"), tiles = boardTiles(), i = tiles.indexOf(el);
  let j = null;
  if (e.key === "ArrowUp" || e.key === "ArrowLeft") j = i - 1;
  else if (e.key === "ArrowDown" || e.key === "ArrowRight") j = i + 1;
  else if (e.key === "Home") j = 0;
  else if (e.key === "End") j = tiles.length - 1;
  if (e.key === "Escape" && tileDrag) { endDrag(true); return; }
  if (j == null) return;
  e.preventDefault();
  if (j < 0 || j >= tiles.length || j === i) return;
  const before = rects();
  $("board").insertBefore(el, j > i ? tiles[j].nextElementSibling : tiles[j]);
  flipFrom(before);
  announce(`${el.dataset.title} moved to position ${j + 1} of ${tiles.length}.`);
  e.currentTarget.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest" });
  relayout();
}

// ---------- build ----------
function tileize(el, key, title, movable) {
  el.dataset.tile = key; el.dataset.title = title;
  el.classList.add("tile");
  const dup = DUP_TITLES[key] && el.querySelector(DUP_TITLES[key]);
  if (dup) dup.classList.add("dup-title");
  const bar = makeBar(key, title, movable);
  el.prepend(bar);
  bar.querySelector(".tile-name").addEventListener("click", () => { setCollapsed(el, !el.classList.contains("collapsed")); relayout(); });
  if (movable) {
    const g = bar.querySelector(".tile-grip");
    g.addEventListener("pointerdown", onGripDown);
    g.addEventListener("keydown", onGripKey);
    bar.querySelector(".tile-w").addEventListener("click", e => { const b = e.target.closest("button[data-w]"); if (b && b.dataset.w !== el.dataset.w) { setWidth(el, b.dataset.w); relayout(); } });
  }
  tileEls[key] = el;
  return el;
}
function initLayout() {
  layout = loadLayout();
  const board = document.createElement("div");
  board.id = "board"; board.className = "board";
  const tools = document.createElement("div");
  tools.className = "board-tools";
  tools.innerHTML = `<span class="ctl-label">Layout</span><button type="button" class="btn" id="lay-collapse">Collapse all</button><button type="button" class="btn" id="lay-expand">Expand all</button><button type="button" class="btn" id="lay-reset">Reset layout</button>
    <span class="note">Drag a section by ⠿ to move it, or focus ⠿ and use the arrow keys. Click a section's name to fold it.</span><span class="sr-only" id="layout-live" aria-live="polite"></span>`;
  const main = document.querySelector(".main");
  main.after(tools); tools.after(board);
  for (const [key, title, sel] of PINNED) { const el = document.querySelector(sel); if (el) { tileize(el, key, title, false); if (layout.c[key]) setCollapsed(el, true); } }
  const byKey = Object.fromEntries(TILES.map(t => [t[0], t]));
  for (const key of layout.order) {
    const [, title, sel] = byKey[key], el = document.querySelector(sel); if (!el) continue;
    board.append(tileize(el, key, title, true));
    setWidth(el, layout.w[key] || byKey[key][3]);
    if (layout.c[key]) setCollapsed(el, true);
  }
  // the old two-column wrappers are empty now
  for (const w of document.querySelectorAll(".wrap > .desk, .wrap > .lower")) if (!w.children.length) w.remove();
  $("lay-collapse").addEventListener("click", () => { for (const el of Object.values(tileEls)) if (el.dataset.tile !== "track" && el.dataset.tile !== "timing") setCollapsed(el, true); relayout(); });
  $("lay-expand").addEventListener("click", () => { for (const el of Object.values(tileEls)) setCollapsed(el, false); relayout(); });
  $("lay-reset").addEventListener("click", () => {
    const before = rects();
    for (const [key, , , w] of TILES) { const el = tileEls[key]; if (!el) continue; board.append(el); setWidth(el, w); setCollapsed(el, false); }
    for (const [key] of PINNED) if (tileEls[key]) setCollapsed(tileEls[key], false);
    layout.c = {}; flipFrom(before); announce("Layout reset."); relayout();
  });
  // the header links open the section they jump to
  for (const a of document.querySelectorAll('header a[href^="#"]')) a.addEventListener("click", () => { const el = document.querySelector(a.getAttribute("href")); if (el && el.classList.contains("collapsed")) { setCollapsed(el, false); relayout(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && tileDrag) endDrag(true); });
  setInterval(updateSummaries, 500);
  relayout();
}
