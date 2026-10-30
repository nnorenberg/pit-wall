import json, sys, math, os, statistics
sys.path.insert(0, 'tools'); from edges import load, pix, PX, MPP
tid = sys.argv[1]; STEP = 5
st = json.load(open(f'osm/{tid}_stations.json'))
def stripes(img, nx, ny):
    dE, dN = -ny, -nx
    D = [s / 10 for s in range(-155, 156)]
    B, S = [], []
    for d in D:
        c = pix(img, PX / 2 + d * dE / MPP, PX / 2 - d * dN / MPP)
        if c is None: B.append(None); S.append(None); continue
        B.append(sum(c) / 3); S.append(max(c) - min(c))
    out = []
    for k in range(9, len(D) - 9):
        if B[k] is None: continue
        L = [B[k - j] for j in range(4, 10) if B[k - j] is not None]; R = [B[k + j] for j in range(4, 10) if B[k + j] is not None]
        if len(L) < 3 or len(R) < 3: continue
        contrast = B[k] - max(sum(L) / len(L), sum(R) / len(R))
        if contrast > 22 and S[k] < 55 and B[k] > 115 and B[k] >= max(x for x in B[k - 2:k + 3] if x is not None):
            if out and D[k] - out[-1][0] < 0.35:
                if contrast > out[-1][1]: out[-1] = (D[k], contrast)
            else: out.append((D[k], contrast))
    return out
idx = list(range(0, st['N'], STEP))
cands = []
for i in idx:
    img = load(tid, i)
    if img is None: cands.append([]); continue
    s = stripes(img, st['nx'][i], st['ny'][i])
    pairs = []
    for a in range(len(s)):
        for b in range(a + 1, len(s)):
            w = s[b][0] - s[a][0]; c = (s[a][0] + s[b][0]) / 2
            if 8.5 <= w <= 19 and abs(c) <= 9.5: pairs.append((c, w, s[a][1] + s[b][1]))
    cands.append(pairs)
# Viterbi over stations: states are candidate pairs plus "missing"
MISS = 5.0
prev = None
for n, pairs in enumerate(cands):
    states = [(None, None, 0)] + pairs
    cur = []
    for st_ in states:
        emit = MISS if st_[0] is None else abs(st_[1] - 12.5) * 0.25 - min(st_[2], 160) / 160
        if prev is None: cur.append((emit, -1)); continue
        best = (1e18, -1)
        for pi, (pcost, _) in enumerate(prev[1]):
            ps = prev[0][pi]
            if st_[0] is None or ps[0] is None: tr = 0.5
            else: tr = abs(st_[0] - ps[0]) * 1.6 + abs(st_[1] - ps[1]) * 2.2
            v = pcost + tr + emit
            if v < best[0]: best = (v, pi)
        cur.append(best)
    if n == 0: hist = []
    hist.append((states, cur)); prev = (states, cur)
# backtrack
k = min(range(len(prev[1])), key=lambda j: prev[1][j][0]); path = []
for n in range(len(hist) - 1, -1, -1):
    states, cur = hist[n]; path.append(states[k]); k = cur[k][1]
path.reverse()
res = [{'i': i, 'c': p[0], 'w': p[1]} for i, p in zip(idx, path)]
found = sum(r['c'] is not None for r in res)
json.dump(res, open(f'ortho/{tid}_edges.json', 'w'))
ws = [r['w'] for r in res if r['w']]; cs = [r['c'] for r in res if r['c'] is not None]
print(tid, 'stations', len(res), 'found', found, 'width median', round(statistics.median(ws), 2), 'p10/p90', round(sorted(ws)[len(ws)//10], 1), round(sorted(ws)[len(ws)*9//10], 1), 'centre shift |median|', round(statistics.median(abs(c) for c in cs), 2), 'max', round(max(abs(c) for c in cs), 1))
