import json, math, sys, statistics as stt
sys.path.insert(0, 'tools'); from chain import tracks, frame, to_xy2
tid = sys.argv[1]; zsrc = sys.argv[2]
g = json.load(open(f'osm/{tid}_geom2.json')); N = g['N']; L = g['L']; ds = L / N
Z = json.load(open(zsrc))
zc = [Z.get(f'{k}:0.0') for k in range(N)]
# fill any missing centre values
for k in range(N):
    if zc[k] is None: zc[k] = zc[k - 1]
def circ_avg(v, half):
    return [sum(v[(i + d) % N] for d in range(-half, half + 1)) / (2 * half + 1) for i in range(N)]
if tid == 'monza':
    # 5 m terrain model: remove spikes, then smooth over ~60 m
    zc = [sorted(zc[(k + d) % N] for d in range(-7, 8))[7] for k in range(N)]
    z = circ_avg(circ_avg(circ_avg(zc, 5), 5), 5)
else:
    z = circ_avg(circ_avg(zc, 2), 2)                  # 50 cm LiDAR: ~15 m smoothing keeps crests and dips
# crossfall: rise per metre toward +n (right of travel), from points 1.2 m inside each edge
cs_raw = []
for k in range(N):
    kk = k - (k % 2)
    a = Z.get(f'{kk}:{-round(g["w"][kk] / 2 - 1.2, 2)}'); b = Z.get(f'{kk}:{round(g["w"][kk] / 2 - 1.2, 2)}')
    c0 = Z.get(f'{kk}:0.0'); half = g['w'][kk] / 2 - 1.2
    if a is None or b is None or c0 is None: cs_raw.append(0.0); continue
    s1, s2 = (c0 - a) / half, (b - c0) / half
    # a step at one edge (verge, barrier, gutter) shows up as the two halves disagreeing: trust the gentler half
    cs_raw.append((s1 + s2) / 2 if abs(s1 - s2) < 0.03 else (s1 if abs(s1) < abs(s2) else s2))
cs = circ_avg(circ_avg(cs_raw, 4), 4)                 # ~50 m smoothing
cs = [max(-0.12, min(0.12, c)) for c in cs]
if tid == 'monza': cs = [0.0] * N                     # no survey-grade data: camber left unmeasured
# corner names: nearest raw map segment's way name
chain, ways = tracks()[tid]; lat0, lon0 = g['frame']
raw = [(to_xy2(p['lat'], p['lon'], lat0, lon0), p) for p in chain]
seg_name = []
from chain import auto_chain, order_chain, SPA_SKIP, MONZA_ORDER
names_ranges = (auto_chain(ways, 175178443, SPA_SKIP)[1] if tid == 'spa' else order_chain(ways, MONZA_ORDER)[1])
def name_of(ci):
    for r in names_ranges:
        nm, a, b = (r[0], r[1], r[2])
        if nm and a <= ci <= b: return nm
    return None
def segdist(P, A, B):
    ax, ay = A; bx, by = B; dx, dy = bx - ax, by - ay; l2 = dx * dx + dy * dy or 1e-9
    t = max(0, min(1, ((P[0] - ax) * dx + (P[1] - ay) * dy) / l2)); qx, qy = ax + t * dx, ay + t * dy
    return (P[0] - qx) ** 2 + (P[1] - qy) ** 2
names = []
for k in range(N):
    P = (g['x'][k], g['y'][k])
    best = min(range(len(raw) - 1), key=lambda ci: segdist(P, raw[ci][0], raw[ci + 1][0]))
    names.append(name_of(best) or name_of(best + 1))
# pit lane polyline, projected and densified
pid = {'spa': 323851541, 'monza': 38168747}[tid]
pts = [to_xy2(p['lat'], p['lon'], lat0, lon0) for p in ways[pid]['geometry']]
def nearest(P):
    return min(range(N), key=lambda k: (g['x'][k] - P[0]) ** 2 + (g['y'][k] - P[1]) ** 2)
ia, ib = nearest(pts[0]), nearest(pts[-1])
fwd = lambda a, b: (b - a) % N
if fwd(ia, ib) > N / 2: pts = pts[::-1]; ia, ib = ib, ia
dense = []
for a, b in zip(pts, pts[1:]):
    n = max(1, int(math.dist(a, b) / 3))
    for s in range(n): dense.append((a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n))
dense.append(pts[-1]); plen = sum(math.dist(a, b) for a, b in zip(dense, dense[1:]))
out = {'N': N, 'L': round(L, 2), 'ds': ds,
       'x': [round(v, 2) for v in g['x']], 'y': [round(v, 2) for v in g['y']], 'w': [round(v, 2) for v in g['w']],
       'z': [round(v, 2) for v in z], 'cs': [round(v, 4) for v in cs], 'names': names,
       'pit': {'pts': [[round(a, 1), round(b, 1)] for a, b in dense], 'entry': ia, 'exit': ib, 'len': round(plen, 1)},
       'zsrc': zsrc}
json.dump(out, open(f'osm/{tid}_track.json', 'w'), separators=(',', ':'))
slope = [(z[(k + 1) % N] - z[k - 1]) / (2 * ds) for k in range(N)]
print(tid, 'N', N, 'L', round(L, 1), 'elev range', round(min(z), 1), round(max(z), 1), 'max climb %', round(max(slope) * 100, 1), 'max descent %', round(min(slope) * 100, 1),
      'crossfall p5/p95 %', round(sorted(cs)[N // 20] * 100, 1), round(sorted(cs)[19 * N // 20] * 100, 1), 'pit', ia, ib, round(plen), 'm')
