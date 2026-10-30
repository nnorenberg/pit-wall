// ===== SIM CORE v4 (world units: metres, seconds, kilograms, joules) =====
// Every circuit is measured: OpenStreetMap centreline, width from aerial photos or published figures,
// elevation and camber from the best open survey data per country (see each track's sources and quality labels).
const G = 9.81, KMAX = 0.19, CAR_HALF = 1.0;
const NS = 20;               // timing sectors
const DT = 1 / 120;
const RHO = 1.2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
// small deterministic generator: a car keeps the same character at a given circuit
function hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function ahead(a, b, N) { return ((b - a) % N + N) % N; } // steps from a forward to b
function menger(ax, ay, bx, by, cx, cy) {
  const ux = bx - ax, uy = by - ay, vx = cx - bx, vy = cy - by, wx = cx - ax, wy = cy - ay;
  const den = Math.hypot(ux, uy) * Math.hypot(vx, vy) * Math.hypot(wx, wy);
  return den > 1e-9 ? 2 * (ux * vy - uy * vx) / den : 0;
}

// ----- circuits: everything comes from the measured track files (TRACKDATA) -----
const SERIES_KEYS = { f1: 'f1', hyper: 'wec', gt3: 'wec', gt4: 'gt4', tcr: 'tcr', road: 'road' };
const TRACKS = Object.keys(TRACKDATA).map(id => {
  const d = TRACKDATA[id];
  return { id, name: d.name, short: d.short || d.name, country: d.country, layout: d.layout, official: d.official, trim: d.trim || { cla: 1, cda: 1 },
    pitLimit: d.pitLimit || {}, pitLoss: d.pitLoss || {}, laneTime: d.laneTime || {}, raceLaps: d.raceLaps || {}, sources: d.sources || {}, quality: d.quality || {}, notes: d.notes || '',
    corners: d.corners || [], series: d.series || [] };
}).sort((a, b) => a.name.localeCompare(b.name));
const NAME_MAP = { 'Double Gauche': 'Pouhon', 'Chicane': 'Bus Stop', 'Courbe Paul Frère': 'Paul Frère', "Speaker's Corner": "Speakers' Corner",
  'Variante del Rettifilo': 'Rettifilo', 'Curva Biassono': 'Curva Grande', 'Variante della Roggia': 'Roggia', 'Curva del Serraglio': 'Serraglio',
  'Curva Vialone': 'Ascari', 'Variante Ascari': 'Ascari', 'Curva Alboreto': 'Alboreto (Parabolica)', 'Rettifilo di partenza': 'Rettifilo' };

