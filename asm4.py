# Assemble sim4.js: measured tracks + calibration data + sim modules
import json, glob, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
src = open('sim3_part1.js').read()
cut = lambda a, b: src[src.index(a):src.index(b)]
build = cut('function buildTrack(td) {', '// ----- tyres:')
lines = cut('// ----- racing lines -----', '// ----- drivers -----')
lines = lines.replace('const lift = sp.clM / m + T.kv[i];', 'const lift = car.clM / m + T.kv[i];') \
             .replace('const T = car.T, sp = car.sp, m = car.mass(), mu = car.muNow * conf,', 'const T = car.T, sp = car.sp, m = car.mass(), mu = car.muNow * conf * (car.balMul ? car.balMul[i] : 1),') \
             .replace('along = along * D.brakeEff + sp.cdM * vn * vn / m + G * T.slope[i];', 'along = along * D.brakeEff * (car.brakeMul || 1) + car.cdM * vn * vn / m + G * T.slope[i];')
assert 'car.clM / m' in lines and 'car.cdM * vn' in lines and 'car.balMul ?' in lines
rest = src[src.index('function initialOffsets'):]
# official corner numbering when the track file has it
rest = rest.replace('function findCorners(T) {', '''function findCorners(T, official) {
  if (official && official.length) return officialCorners(T, official);''')
rest = rest.replace("return { n: ci + 1, name: c.name,", "return { n: c.n || ci + 1, name: c.name,")
assert 'officialCorners(T, official)' in rest and 'c.n || ci + 1' in rest
official = '''
// corners from the circuit's own turn numbering: extent found from the curvature around each official apex
function officialCorners(T, list) {
  const N = T.N, sk = new Float64Array(N), W = 4;
  for (let i = 0; i < N; i++) { let s = 0; for (let d = -W; d <= W; d++) s += T.k[(i + d + N) % N]; sk[i] = s / (2 * W + 1); }
  const L = list.slice().sort((a, b) => a.i - b.i);
  return L.map((c, n) => {
    let peak = c.i, pk = 0;
    for (let d = -12; d <= 12; d++) { const i = (c.i + d + N) % N; if (Math.abs(sk[i]) > pk) { pk = Math.abs(sk[i]); peak = i; } }
    const prev = L[(n - 1 + L.length) % L.length], next = L[(n + 1) % L.length];
    const lim0 = L.length > 1 ? Math.floor(ahead(prev.i, peak, N) / 2) : 60, lim1 = L.length > 1 ? Math.floor(ahead(peak, next.i, N) / 2) : 60;
    let s = peak, e = peak;
    for (let d = 1; d < Math.min(60, lim0); d++) { const i = (peak - d + N) % N; if (Math.abs(sk[i]) < pk * 0.35) break; s = i; }
    for (let d = 1; d < Math.min(60, lim1); d++) { const i = (peak + d) % N; if (Math.abs(sk[i]) < pk * 0.35) break; e = i; }
    return { s, e, len: ahead(s, e, N), peak, dir: sk[peak] > 0 ? 'R' : 'L', minR: 1 / Math.max(pk, 1e-6), name: c.name || `Turn ${c.n}`, n: c.n };
  });
}
'''
# tracks: only files the validator accepts
td = {}
for f in sorted(glob.glob('tracks/*.json')):
    d = json.load(open(f)); tid = d.get('id') or os.path.basename(f)[:-5]
    for k in ('frame', 'startLL'): d.pop(k, None)
    td[tid] = d
cal = {}
for f in ('trackcal.json', 'gaps.json', 'poles.json'):
    cal[f] = open(f).read() if os.path.exists(f) else None
head = '// Measured circuit data (see each track\'s sources)\nconst TRACKDATA = ' + json.dumps(td, separators=(',', ':')) + ';\n'
if cal['trackcal.json']: head += 'const TRACKCAL_DATA = ' + cal['trackcal.json'] + ';\n'
if cal['gaps.json']: head += 'const GAPS_DATA = ' + cal['gaps.json'] + ';\n'
if cal['poles.json']: head += 'const POLE_DATA = ' + cal['poles.json'] + ';\n'
body = open('sim4_head.js').read() + build + open('sim4_cars.js').read() + lines + rest + official + open('sim4_car.js').read() + open('sim4_learn.js').read() \
     + open('sim4_world.js').read() + open('sim4_debrief.js').read()
body += "\nif (typeof module !== 'undefined') module.exports = { TRACKCAL_SET, TRACKS, CLASSES, CALIB, POLE, TYRES, WEATHER, SERIES, SKILLS, SKILL_BY, PERSONAS, KNOWLEDGE, Car, World, deriveSpec, buildTrack, findCorners, cornerPoints, phaseAt, makeLine, optimiseLine, planSpeed, vLimit, gripAt, ahead, DT, NS, G, KMAX, fmtT, NAME_MAP, makeDriver, setupRange, defaultSetup, setupAllowed, makeDebrief, buildEntries, SERIES_KEYS, f1Tyres, TRACKDATA };\n// ===== END SIM CORE =====\n"
open('sim4.js', 'w').write(head + body)
print('tracks', list(td), 'bytes', len(head + body))
