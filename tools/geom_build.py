import json, math, sys, statistics as stt
tid = sys.argv[1]
st = json.load(open(f'osm/{tid}_stations.json')); E = json.load(open(f'ortho/{tid}_edges.json'))
N = st['N']; ds = st['ds']
# 1) centre shift c and width w at every station, gaps filled
K = [(r['i'], r['c'], r['w']) for r in E]
known = [(i, c, w) for i, c, w in K if c is not None]
def interp(i):
    # circular linear interpolation between nearest known samples
    after = next(((j, c, w) for j, c, w in known if j >= i), (known[0][0] + N, known[0][1], known[0][2]))
    before = next(((j, c, w) for j, c, w in reversed(known) if j <= i), (known[-1][0] - N, known[-1][1], known[-1][2]))
    if after[0] == before[0]: return before[1], before[2]
    f = (i - before[0]) / (after[0] - before[0]); gap = after[0] - before[0]
    c = before[1] + (after[1] - before[1]) * f; w = before[2] + (after[2] - before[2]) * f
    if gap > 60:   # long gap with no visible lines: trust the map centre, keep a typical width
        fade = min(1, min(i - before[0], after[0] - i) / 15); c *= (1 - fade); w = w * (1 - fade) + stt.median(x[2] for x in known) * fade
    return c, w
cw = [interp(i) for i in range(N)]
def smooth(vals, win):
    out = []
    for i in range(N):
        seg = sorted(vals[(i + d) % N] for d in range(-win, win + 1)); out.append(seg[len(seg) // 2])
    return out
c = smooth([x[0] for x in cw], 7); w = smooth([x[1] for x in cw], 7)
c = [sum(c[(i + d) % N] for d in range(-5, 6)) / 11 for i in range(N)]; w = [sum(w[(i + d) % N] for d in range(-5, 6)) / 11 for i in range(N)]
w = [min(17, max(8, x)) for x in w]
x = [st['x'][i] + c[i] * st['nx'][i] for i in range(N)]; y = [st['y'][i] + c[i] * st['ny'][i] for i in range(N)]
# 2) Taubin smoothing: removes jitter without shrinking corners
for it in range(30):
    for lam in (0.5, -0.53):
        x = [x[i] + lam * ((x[i - 1] + x[(i + 1) % N]) / 2 - x[i]) for i in range(N)]
        y = [y[i] + lam * ((y[i - 1] + y[(i + 1) % N]) / 2 - y[i]) for i in range(N)]
# 3) resample at 3 m
cum = [0.0]
for i in range(N): cum.append(cum[-1] + math.hypot(x[(i + 1) % N] - x[i], y[(i + 1) % N] - y[i]))
L = cum[-1]; M = round(L / 3); X, Y, Wn = [], [], []; j = 0
for k in range(M):
    s = k * L / M
    while cum[j + 1] < s: j += 1
    f = (s - cum[j]) / (cum[j + 1] - cum[j]); a, b = j, (j + 1) % N
    X.append(x[a] + (x[b] - x[a]) * f); Y.append(y[a] + (y[b] - y[a]) * f); Wn.append(w[a] + (w[b] - w[a]) * f)
NX, NY = [], []
for k in range(M):
    a, b = (k - 1) % M, (k + 1) % M; dx, dy = X[b] - X[a], Y[b] - Y[a]; l = math.hypot(dx, dy); NX.append(-dy / l); NY.append(dx / l)
json.dump({'N': M, 'L': L, 'x': X, 'y': Y, 'nx': NX, 'ny': NY, 'w': Wn}, open(f'osm/{tid}_geom2.json', 'w'))
print(tid, 'length', round(L, 1), 'stations', M, 'width median', round(stt.median(Wn), 2), 'min', round(min(Wn), 1), 'max', round(max(Wn), 1), 'max centre shift', round(max(abs(v) for v in c), 2))
