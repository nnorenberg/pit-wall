"""Shared helpers for building Apex School circuit files (tracks/<id>.json).

Coordinate convention (must match the sim): local metres from a frame centre (lat0, lon0),
    x = -(lat - lat0) * m_per_deg_lat,   y = -(lon - lon0) * m_per_deg_lon   (WGS84 metres per degree at lat0)
Stations are evenly spaced (~3 m) along the centreline, in RACE DIRECTION, station 0 on the start/finish (timing) line.
Normal at station k: n = (-ty, tx) where t is the unit tangent. Crossfall cs[k] = rise per metre of road toward +n.
Run with the venv:  venv/bin/python  (numpy, scipy, tifffile, imagecodecs, pillow, pyproj available)
"""
import json, math, os, time, urllib.request, urllib.parse

UA = 'PitWall/1.0 (circuit research; contact %s)' % os.environ.get('PITWALL_CONTACT', 'set PITWALL_CONTACT to your email')   # OSM/Overpass ask for a contact
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']


def mpd(lat0):
    p = math.radians(lat0)
    return 111132.92 - 559.82 * math.cos(2 * p) + 1.175 * math.cos(4 * p), 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)


def to_xy(lat, lon, lat0, lon0):
    a, b = mpd(lat0); return -(lat - lat0) * a, -(lon - lon0) * b


def to_ll(x, y, lat0, lon0):
    a, b = mpd(lat0); return lat0 - x / a, lon0 - y / b


def http_get(url, data=None, timeout=120, tries=6, headers=None):
    h = {'User-Agent': UA}; h.update(headers or {})
    for t in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=h)
            return urllib.request.urlopen(req, timeout=timeout).read()
        except Exception as e:
            if t == tries - 1: raise
            time.sleep(3 + 5 * t)


def overpass(query, cache):
    """Run an Overpass QL query (use 'out geom;'), cache the JSON at `cache`. Rotates mirrors and backs off on errors."""
    if os.path.exists(cache): return json.load(open(cache))
    last = None
    for t in range(8):
        url = OVERPASS[t % len(OVERPASS)]
        try:
            raw = http_get(url, data=urllib.parse.urlencode({'data': query}).encode(), timeout=180, tries=1)
            d = json.loads(raw); json.dump(d, open(cache, 'w')); return d
        except Exception as e:
            last = e; time.sleep(10 + 10 * t)
    raise last


def chain_ways(ways, order):
    """ways: {id: element with 'geometry'}; order: list of way ids in race order. Orients each way to connect.
    Returns list of (lat, lon) without the closing duplicate."""
    pts = []
    for n, wid in enumerate(order):
        g = [(p['lat'], p['lon']) for p in ways[wid]['geometry']]
        if pts:
            if math.dist(g[-1], pts[-1]) < math.dist(g[0], pts[-1]): g = g[::-1]
            if math.dist(g[0], pts[-1]) < 2e-6: g = g[1:]
        elif len(order) > 1:
            n2 = [(p['lat'], p['lon']) for p in ways[order[1]]['geometry']]
            if min(math.dist(g[0], n2[0]), math.dist(g[0], n2[-1])) < min(math.dist(g[-1], n2[0]), math.dist(g[-1], n2[-1])): g = g[::-1]
        pts += g
    if math.dist(pts[0], pts[-1]) < 2e-6: pts = pts[:-1]
    return pts


def frame(ll):
    return sum(p[0] for p in ll) / len(ll), sum(p[1] for p in ll) / len(ll)


def _cr(p0, p1, p2, p3, t):
    d = lambda a, b: max(1e-4, math.dist(a, b) ** 0.5)
    t0 = 0; t1 = t0 + d(p0, p1); t2 = t1 + d(p1, p2); t3 = t2 + d(p2, p3); u = t1 + (t2 - t1) * t
    L = lambda a, b, ta, tb: (a[0] + (b[0] - a[0]) * (u - ta) / (tb - ta), a[1] + (b[1] - a[1]) * (u - ta) / (tb - ta))
    A1, A2, A3 = L(p0, p1, t0, t1), L(p1, p2, t1, t2), L(p2, p3, t2, t3)
    return L(L(A1, A2, t0, t2), L(A2, A3, t1, t3), t1, t2)


def densify_closed(xy, step=1.0):
    """Centripetal Catmull-Rom through the map nodes, ~step m apart (closed loop)."""
    n = len(xy); out = []
    for i in range(n):
        k = max(1, int(math.dist(xy[i], xy[(i + 1) % n]) / step))
        for s in range(k): out.append(_cr(xy[i - 1], xy[i], xy[(i + 1) % n], xy[(i + 2) % n], s / k))
    return out


def taubin(x, y, iters=20, lam=0.5, mu=-0.53):
    """Shrink-free smoothing of a closed polyline."""
    D = len(x); x = list(x); y = list(y)
    for _ in range(iters):
        for l in (lam, mu):
            x = [x[i] + l * ((x[i - 1] + x[(i + 1) % D]) / 2 - x[i]) for i in range(D)]
            y = [y[i] + l * ((y[i - 1] + y[(i + 1) % D]) / 2 - y[i]) for i in range(D)]
    return x, y


def resample(x, y, ds=3.0, start=None, extra=None):
    """Resample a closed loop at ~ds m. start=(x,y): station 0 placed at the nearest point to it.
    extra: optional list of per-point arrays to interpolate alongside. Returns X, Y, [extras], L."""
    D = len(x); cum = [0.0]
    for i in range(D): cum.append(cum[-1] + math.hypot(x[(i + 1) % D] - x[i], y[(i + 1) % D] - y[i]))
    L = cum[-1]; M = round(L / ds)
    s0 = 0.0
    if start:
        j = min(range(D), key=lambda i: (x[i] - start[0]) ** 2 + (y[i] - start[1]) ** 2); s0 = cum[j]
    X, Y = [], []; E = [[] for _ in (extra or [])]; j = 0
    for k in range(M):
        s = (s0 + k * L / M) % L
        if s < cum[j]: j = 0
        while cum[j + 1] < s: j += 1
        f = (s - cum[j]) / ((cum[j + 1] - cum[j]) or 1); a, b = j, (j + 1) % D
        X.append(x[a] + (x[b] - x[a]) * f); Y.append(y[a] + (y[b] - y[a]) * f)
        for e, arr in zip(E, extra or []): e.append(arr[a] + (arr[b] - arr[a]) * f)
    return X, Y, E, L


def normals(X, Y):
    M = len(X); NX, NY = [], []
    for k in range(M):
        a, b = (k - 1) % M, (k + 1) % M; dx, dy = X[b] - X[a], Y[b] - Y[a]; l = math.hypot(dx, dy) or 1
        NX.append(-dy / l); NY.append(dx / l)
    return NX, NY


def signed_area(X, Y):
    return 0.5 * sum(X[i] * Y[(i + 1) % len(X)] - X[(i + 1) % len(X)] * Y[i] for i in range(len(X)))


def sample_points(X, Y, W, frame0, every=2, inset=1.2):
    """Points to sample elevation at: centre of every station, and both edges (inset m inside) of every `every`th.
    Returns list of (key, lat, lon); keys are 'k:offset' strings as used by profile_from_samples."""
    NX, NY = normals(X, Y); out = []
    for k in range(len(X)):
        offs = [0.0] + ([-round(W[k] / 2 - inset, 2), round(W[k] / 2 - inset, 2)] if k % every == 0 else [])
        for o in offs:
            la, lo = to_ll(X[k] + o * NX[k], Y[k] + o * NY[k], *frame0)
            out.append((f'{k}:{o}', la, lo))
    return out


def _circ_avg(v, half):
    N = len(v); return [sum(v[(i + d) % N] for d in range(-half, half + 1)) / (2 * half + 1) for i in range(N)]


def _circ_med(v, half):
    N = len(v); return [sorted(v[(i + d) % N] for d in range(-half, half + 1))[half] for i in range(N)]


def profile_from_samples(Z, W, quality, every=2, inset=1.2, ds=3.0):
    """Z: dict 'k:offset' -> elevation (m). quality: 'lidar' (<=1 m), 'dtm' (2-10 m), 'global' (~30 m+).
    Returns z[], cs[] (cs zero unless lidar/dtm-1m quality). Robust camber: trust the gentler half-slope when they disagree."""
    N = len(W)
    zc = [Z.get(f'{k}:0.0') for k in range(N)]
    for k in range(N):
        if zc[k] is None: zc[k] = zc[k - 1] if zc[k - 1] is not None else next(v for v in zc if v is not None)
    if quality == 'lidar':
        z = _circ_avg(_circ_avg(_circ_med(zc, 2), 2), 2)                  # ~15 m
    elif quality == 'dtm':
        z = _circ_avg(_circ_avg(_circ_avg(_circ_med(zc, 7), 5), 5), 5)    # ~60 m
    else:
        h = max(3, int(40 / ds))
        z = _circ_avg(_circ_avg(_circ_avg(_circ_med(zc, h), h), h), h)    # ~250 m: a 30 m surface model only resolves broad hills
    cs = [0.0] * N
    if quality == 'lidar':
        raw = []
        for k in range(N):
            kk = k - (k % every); half = W[kk] / 2 - inset
            a = Z.get(f'{kk}:{-round(half, 2)}'); b = Z.get(f'{kk}:{round(half, 2)}'); c0 = Z.get(f'{kk}:0.0')
            if a is None or b is None or c0 is None or half < 2: raw.append(0.0); continue
            s1, s2 = (c0 - a) / half, (b - c0) / half
            raw.append((s1 + s2) / 2 if abs(s1 - s2) < 0.03 else (s1 if abs(s1) < abs(s2) else s2))
        cs = [max(-0.20, min(0.20, c)) for c in _circ_avg(_circ_avg(raw, 4), 4)]   # real banking (Zandvoort, Madring) reaches ~18-24%
    return z, cs


def nearest_station(X, Y, P):
    return min(range(len(X)), key=lambda k: (X[k] - P[0]) ** 2 + (Y[k] - P[1]) ** 2)


def pit_polyline(pit_ll, X, Y, frame0, step=3.0):
    """pit_ll: [(lat, lon)...] of the pit lane from where it leaves the track to where it rejoins (any direction).
    Returns dict pts/entry/exit/len oriented in race direction."""
    pts = [to_xy(la, lo, *frame0) for la, lo in pit_ll]
    N = len(X); ia, ib = nearest_station(X, Y, pts[0]), nearest_station(X, Y, pts[-1])
    if (ib - ia) % N > N / 2: pts = pts[::-1]; ia, ib = ib, ia
    dense = []
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(math.dist(a, b) / step))
        for s in range(n): dense.append((a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n))
    dense.append(pts[-1])
    return {'pts': [[round(a, 1), round(b, 1)] for a, b in dense], 'entry': ia, 'exit': ib,
            'len': round(sum(math.dist(a, b) for a, b in zip(dense, dense[1:])), 1)}


def names_from_ways(X, Y, frame0, named_ways, name_map=None, max_d=40):
    """named_ways: list of (name, [(lat,lon),...]). Each station takes the name of the nearest named way within max_d m."""
    segs = []
    for nm, ll in named_ways:
        p = [to_xy(a, b, *frame0) for a, b in ll]
        for a, b in zip(p, p[1:]): segs.append((nm, a, b))
    def sd(P, A, B):
        dx, dy = B[0] - A[0], B[1] - A[1]; l2 = dx * dx + dy * dy or 1e-9
        t = max(0, min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / l2)); return (P[0] - A[0] - t * dx) ** 2 + (P[1] - A[1] - t * dy) ** 2
    out = []
    for k in range(len(X)):
        best, bd = None, max_d ** 2
        for nm, a, b in segs:
            if min(abs(a[0] - X[k]), abs(b[0] - X[k])) > max_d + 300: continue
            d = sd((X[k], Y[k]), a, b)
            if d < bd: bd, best = d, nm
        out.append((name_map or {}).get(best, best) if best else None)
    return out


def write_track(tid, meta, X, Y, W, z, cs, names, pit, out_dir='tracks'):
    """Write tracks/<tid>.json. meta must follow tracks/SPEC.md (name, official, sources, quality, ...)."""
    N = len(X); L = sum(math.hypot(X[(i + 1) % N] - X[i], Y[(i + 1) % N] - Y[i]) for i in range(N))
    d = dict(meta); d.update({'id': tid, 'N': N, 'L': round(L, 2), 'ds': L / N,
        'x': [round(v, 2) for v in X], 'y': [round(v, 2) for v in Y], 'w': [round(v, 2) for v in W],
        'z': [round(v, 2) for v in z], 'cs': [round(v, 4) for v in cs], 'names': names, 'pit': pit})
    json.dump(d, open(os.path.join(out_dir, f'{tid}.json'), 'w'), separators=(',', ':'))
    return d
