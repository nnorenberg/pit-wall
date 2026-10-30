"""Validate tracks/<id>.json against tracks/SPEC.md and render tracks/<id>_preview.png.
Usage: venv/bin/python tools/validate_track.py <id>      exit code 1 on any FAIL."""
import json, math, sys
from PIL import Image, ImageDraw

tid = sys.argv[1]
d = json.load(open(f'tracks/{tid}.json'))
fails, warns = [], []
REQ = ['id', 'name', 'short', 'country', 'layout', 'official', 'N', 'L', 'x', 'y', 'w', 'z', 'cs', 'names', 'pit', 'sources', 'quality',
       'trim', 'pitLimit', 'pitLoss', 'corners', 'startLL', 'frame']
for k in REQ:
    if k not in d: fails.append(f'missing field {k}')
N = d['N']; X, Y, W, Z, CS = d['x'], d['y'], d['w'], d['z'], d['cs']
for nm, arr in (('x', X), ('y', Y), ('w', W), ('z', Z), ('cs', CS), ('names', d['names'])):
    if len(arr) != N: fails.append(f'{nm} has {len(arr)} entries, expected {N}')
if any(v is None or (isinstance(v, float) and math.isnan(v)) for arr in (X, Y, W, Z, CS) for v in arr): fails.append('None/NaN in arrays')
steps = [math.hypot(X[(i + 1) % N] - X[i], Y[(i + 1) % N] - Y[i]) for i in range(N)]
L = sum(steps)
if max(steps) > 3.6 or min(steps) < 2.4: fails.append(f'station spacing {min(steps):.2f}-{max(steps):.2f} m (want ~3)')
off = (L / d['official'] - 1) * 100
(fails if abs(off) > 1.5 else warns if abs(off) > 0.8 else []).append(f'length {L:.1f} vs official {d["official"]} ({off:+.2f}%)')
# curvature
def menger(i):
    a, b, c = (i - 2) % N, i, (i + 2) % N
    ax, ay, bx, by, cx, cy = X[a], Y[a], X[b], Y[b], X[c], Y[c]
    cr = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); la, lb, lc = math.dist((ax, ay), (bx, by)), math.dist((bx, by), (cx, cy)), math.dist((ax, ay), (cx, cy))
    return 2 * cr / (la * lb * lc or 1e-9)
K = [menger(i) for i in range(N)]
Ks = [sum(K[(i + d2) % N] for d2 in range(-2, 3)) / 5 for i in range(N)]
kmax = max(abs(k) for k in Ks)
if kmax > 1 / 7: fails.append(f'tightest radius {1 / kmax:.1f} m (kinks? hairpins are rarely < 9 m on the centreline)')
# heading jumps
for i in range(N):
    a, b = (i - 1) % N, (i + 1) % N
    h1 = math.atan2(Y[i] - Y[a], X[i] - X[a]); h2 = math.atan2(Y[b] - Y[i], X[b] - X[i])
    dh = abs((h2 - h1 + math.pi) % (2 * math.pi) - math.pi)
    if dh > 0.35: fails.append(f'heading jump {math.degrees(dh):.0f} deg at station {i}'); break
# self intersection (coarse)
segs = list(range(0, N, 3))
def inter(p1, p2, p3, p4):
    d1 = (p4[0] - p3[0]) * (p1[1] - p3[1]) - (p4[1] - p3[1]) * (p1[0] - p3[0]); d2 = (p4[0] - p3[0]) * (p2[1] - p3[1]) - (p4[1] - p3[1]) * (p2[0] - p3[0])
    d3 = (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]); d4 = (p2[0] - p1[0]) * (p4[1] - p1[1]) - (p2[1] - p1[1]) * (p4[0] - p1[0])
    return d1 * d2 < 0 and d3 * d4 < 0
P = [(X[i], Y[i]) for i in segs]; crosses = 0
for a in range(len(P)):
    for b in range(a + 2, len(P)):
        if a == 0 and b == len(P) - 1: continue
        if abs(P[a][0] - P[b][0]) > 10 or abs(P[a][1] - P[b][1]) > 10:
            if max(abs(P[a][0] - P[b][0]), abs(P[a][1] - P[b][1])) > 40: continue
        if inter(P[a], P[(a + 1) % len(P)], P[b], P[(b + 1) % len(P)]): crosses += 1
if crosses and not d.get('crossover'): fails.append(f'{crosses} self-intersections (set "crossover": true only for real figure-8 layouts like Suzuka)')
if crosses and d.get('crossover'): warns.append(f'{crosses} crossings (declared crossover)')
# width, elevation, camber
if min(W) < 6.5 or max(W) > 30: fails.append(f'width range {min(W):.1f}-{max(W):.1f} m')
slope = [(Z[(i + 1) % N] - Z[(i - 1) % N]) / (2 * L / N) for i in range(N)]
gmax = max(abs(s) for s in slope)
(fails if gmax > 0.25 else warns if gmax > 0.12 else []).append(f'max grade {gmax * 100:.1f}%')
if abs(Z[0] - Z[-1]) > 2: fails.append(f'elevation does not close: {Z[0]:.1f} vs {Z[-1]:.1f}')
if max(abs(c) for c in CS) > 0.201: fails.append('crossfall beyond 20%')
if d['quality'].get('camber') in ('none', None) and any(abs(c) > 0 for c in CS): warns.append('camber quality none but cs non-zero')
# pit lane
pit = d['pit']
if not pit.get('pts') or len(pit['pts']) < 10: fails.append('pit lane missing')
else:
    pl = pit['len']; dist_track = ((pit['exit'] - pit['entry']) % N) * L / N
    if not (0.6 * dist_track < pl < 1.6 * dist_track + 200): warns.append(f'pit lane {pl:.0f} m vs track between entry/exit {dist_track:.0f} m')
    e0 = math.dist(pit['pts'][0], (X[pit['entry']], Y[pit['entry']])); e1 = math.dist(pit['pts'][-1], (X[pit['exit']], Y[pit['exit']]))
    if e0 > 40 or e1 > 40: fails.append(f'pit ends far from track ({e0:.0f} m, {e1:.0f} m)')
    if dist_track > L / 2: fails.append('pit lane runs backwards? (entry->exit covers more than half the lap)')
# start line: pit lane usually spans station 0
named = sum(1 for n in d['names'] if n);
if named < N * 0.2: warns.append(f'only {named}/{N} stations named')
if not d['corners']: fails.append('corners list empty')
for c in d.get('corners', []):
    if not (0 <= c.get('i', -1) < N) or not c.get('name'): fails.append(f'bad corner entry {c}'); break
print(f'{tid}: N {N} L {L:.1f} (official {d["official"]}, {off:+.2f}%), width {min(W):.1f}-{max(W):.1f}, z {min(Z):.1f}-{max(Z):.1f} m, '
      f'max grade {gmax * 100:.1f}%, cs p95 {sorted(abs(c) for c in CS)[int(N * 0.95)] * 100:.1f}%, tightest R {1 / kmax:.1f} m, pit {pit["entry"]}->{pit["exit"]} {pit.get("len")} m, corners {len(d["corners"])}')
for w in warns: print('  WARN', w)
for f in fails: print('  FAIL', f)
# preview
S = 1400; xs = X + [p[0] for p in pit['pts']]; ys = Y + [p[1] for p in pit['pts']]
mnx, mxx, mny, mxy = min(xs), max(xs), min(ys), max(ys); sc = (S - 120) / max(mxx - mnx, mxy - mny)
T = lambda x, y: (60 + (y - mny) * sc, 60 + (x - mnx) * sc)
img = Image.new('RGB', (S, S), (16, 20, 26)); g = ImageDraw.Draw(img)
NX = [-(Y[(i + 1) % N] - Y[i - 1]) for i in range(N)]; NY = [(X[(i + 1) % N] - X[i - 1]) for i in range(N)]
zl, zh = min(Z), max(Z) or 1
for i in range(N):
    j = (i + 1) % N; l = math.hypot(NX[i], NY[i]) or 1; nx, ny = NX[i] / l, NY[i] / l
    t = (Z[i] - zl) / ((zh - zl) or 1); col = (int(60 + 190 * t), int(120 + 60 * (1 - t)), int(230 - 180 * t))
    g.line([T(X[i], Y[i]), T(X[j], Y[j])], fill=col, width=max(2, int(W[i] * sc)))
    for s in (-1, 1):
        a = T(X[i] + s * nx * W[i] / 2, Y[i] + s * ny * W[i] / 2); b = T(X[j] + s * nx * W[i] / 2, Y[j] + s * ny * W[i] / 2)
        g.line([a, b], fill=(230, 230, 230), width=1)
pp = [T(p[0], p[1]) for p in pit['pts']]; g.line(pp, fill=(255, 200, 60), width=2)
g.ellipse([T(X[0], Y[0])[0] - 7, T(X[0], Y[0])[1] - 7, T(X[0], Y[0])[0] + 7, T(X[0], Y[0])[1] + 7], fill=(255, 255, 255))
a = T(X[0], Y[0]); b = T(X[15], Y[15]); g.line([a, b], fill=(255, 60, 60), width=5)   # arrow: race direction
for c in d.get('corners', []):
    p = T(X[c['i']], Y[c['i']]); g.text((p[0] + 6, p[1] - 6), f"{c.get('n', '')} {c['name']}", fill=(255, 255, 255))
g.text((20, 20), f'{d.get("name")}  L {L:.0f} m ({off:+.2f}%)  z {zl:.0f}-{zh:.0f} m   white dot = start, red = direction, yellow = pit lane', fill=(255, 255, 255))
img.save(f'tracks/{tid}_preview.png')
sys.exit(1 if fails else 0)
