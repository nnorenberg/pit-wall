import json, math, sys, statistics as stt
sys.path.insert(0, 'tools'); from chain import tracks, frame, key, to_ll, to_xy2, to_ll2
tid = sys.argv[1]; OFFICIAL = {'spa': 7004, 'monza': 5793}[tid]; START = {'spa': -220, 'monza': 420}[tid]
chain, ways = tracks()[tid]; lat0, lon0 = frame(chain)
closed = (key(chain[0]) == key(chain[-1])) if tid == 'spa' else round(chain[0]['lat'], 6) == round(chain[-1]['lat'], 6)
raw = [to_xy2(p['lat'], p['lon'], lat0, lon0) for p in (chain[:-1] if closed else chain)]
n = len(raw)
def cr(p0, p1, p2, p3, t):
    d = lambda a, b: max(1e-4, math.dist(a, b) ** 0.5)
    t0 = 0; t1 = t0 + d(p0, p1); t2 = t1 + d(p1, p2); t3 = t2 + d(p2, p3); u = t1 + (t2 - t1) * t
    L = lambda a, b, ta, tb: (a[0] + (b[0] - a[0]) * (u - ta) / (tb - ta), a[1] + (b[1] - a[1]) * (u - ta) / (tb - ta))
    A1, A2, A3 = L(p0, p1, t0, t1), L(p1, p2, t1, t2), L(p2, p3, t2, t3)
    return L(L(A1, A2, t0, t2), L(A2, A3, t1, t3), t1, t2)
dense = []
for i in range(n):
    seg = math.dist(raw[i], raw[(i + 1) % n]); k = max(1, int(seg / 1.0))
    for s in range(k): dense.append(cr(raw[i - 1], raw[i], raw[(i + 1) % n], raw[(i + 2) % n], s / k))
D = len(dense); cum = [0.0]
for i in range(D): cum.append(cum[-1] + math.dist(dense[i], dense[(i + 1) % D]))
Ld = cum[-1]
def nrm(i):
    a, b = dense[i - 1], dense[(i + 1) % D]; dx, dy = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dy); return -dy / l, dx / l
# photo-measured centre points and widths, moved into the accurate projection
st = json.load(open(f'osm/{tid}_stations.json')); E = json.load(open(f'ortho/{tid}_edges.json'))
meas = []
grid = {}
for i, p in enumerate(dense): grid.setdefault((int(p[0] // 20), int(p[1] // 20)), []).append(i)
for r in E:
    if r['c'] is None: continue
    i = r['i']; mx, my = st['x'][i] + r['c'] * st['nx'][i], st['y'][i] + r['c'] * st['ny'][i]
    la, lo = to_ll(mx, my, lat0, lon0); X, Y = to_xy2(la, lo, lat0, lon0)
    best, bd = None, 1e18
    gx, gy = int(X // 20), int(Y // 20)
    for ax in range(gx - 1, gx + 2):
        for ay in range(gy - 1, gy + 2):
            for j in grid.get((ax, ay), []):
                dd = (dense[j][0] - X) ** 2 + (dense[j][1] - Y) ** 2
                if dd < bd: bd, best = dd, j
    if best is None or bd > 15 ** 2: continue
    nx, ny = nrm(best); off = (X - dense[best][0]) * nx + (Y - dense[best][1]) * ny
    meas.append((cum[best], off, r['w']))
meas.sort()
def at_s(s):
    after = next((m for m in meas if m[0] >= s), (meas[0][0] + Ld, meas[0][1], meas[0][2]))
    before = next((m for m in reversed(meas) if m[0] <= s), (meas[-1][0] - Ld, meas[-1][1], meas[-1][2]))
    gap = after[0] - before[0]; f = (s - before[0]) / gap if gap else 0
    o = before[1] + (after[1] - before[1]) * f; w = before[2] + (after[2] - before[2]) * f
    if gap > 180:
        fade = min(1, min(s - before[0], after[0] - s) / 45); o *= (1 - fade); w = w * (1 - fade) + stt.median(m[2] for m in meas) * fade
    return o, w
OW = [at_s(cum[i]) for i in range(D)]
def runmed(v, win):
    return [sorted(v[(i + d) % D] for d in range(-win, win + 1))[win] for i in range(D)]
o = runmed([a for a, _ in OW], 10); w = runmed([b for _, b in OW], 10)
o = [sum(o[(i + d) % D] for d in range(-12, 13)) / 25 for i in range(D)]; w = [min(17, max(8, sum(w[(i + d) % D] for d in range(-12, 13)) / 25)) for i in range(D)]
x = [dense[i][0] + o[i] * nrm(i)[0] for i in range(D)]; y = [dense[i][1] + o[i] * nrm(i)[1] for i in range(D)]
for it in range(20):
    for lam in (0.5, -0.53):
        x = [x[i] + lam * ((x[i - 1] + x[(i + 1) % D]) / 2 - x[i]) for i in range(D)]
        y = [y[i] + lam * ((y[i - 1] + y[(i + 1) % D]) / 2 - y[i]) for i in range(D)]
cum2 = [0.0]
for i in range(D): cum2.append(cum2[-1] + math.hypot(x[(i + 1) % D] - x[i], y[(i + 1) % D] - y[i]))
L = cum2[-1]; M = round(L / 3)
# rotate so station 0 is the start/finish line, START metres from the first map point
s0 = START % L
X, Y, W = [], [], []; j = 0
for k in range(M):
    s = (s0 + k * L / M) % L
    j = 0 if s < cum2[j] else j
    while cum2[j + 1] < s: j += 1
    f = (s - cum2[j]) / (cum2[j + 1] - cum2[j]); a, b = j, (j + 1) % D
    X.append(x[a] + (x[b] - x[a]) * f); Y.append(y[a] + (y[b] - y[a]) * f); W.append(w[a] + (w[b] - w[a]) * f)
NX, NY = [], []
for k in range(M):
    a, b = (k - 1) % M, (k + 1) % M; dx, dy = X[b] - X[a], Y[b] - Y[a]; l = math.hypot(dx, dy); NX.append(-dy / l); NY.append(dx / l)
LL = [to_ll2(X[k], Y[k], lat0, lon0) for k in range(M)]
json.dump({'N': M, 'L': L, 'x': X, 'y': Y, 'nx': NX, 'ny': NY, 'w': W, 'll': LL, 'frame': [lat0, lon0], 'measured': len(meas)}, open(f'osm/{tid}_geom2.json', 'w'))
print(tid, 'raw map length', round(cum[-1], 1), 'final', round(L, 1), 'official', OFFICIAL, f'({(L / OFFICIAL - 1) * 100:+.2f}%)', 'stations', M, 'photo points used', len(meas), 'width median', round(stt.median(W), 2))
