import json, math, re
def load(path): d = json.load(open(path)); return {e['id']: e for e in d['elements']}
key = lambda p: (round(p['lat'], 7), round(p['lon'], 7))
def auto_chain(ways, start, skip):
    used, chain, names = set(), [], []
    cur, pts = start, ways[start]['geometry']
    while True:
        used.add(cur); st = len(chain); chain += pts if not chain else pts[1:]
        names.append((ways[cur].get('tags', {}).get('name'), st, len(chain) - 1))
        end = key(chain[-1]); nxt = None
        for wid, e in ways.items():
            if wid in used or wid in skip: continue
            g = e['geometry']
            if key(g[0]) == end: nxt = (wid, g); break
            if key(g[-1]) == end: nxt = (wid, g[::-1]); break
        if not nxt: break
        cur, pts = nxt
    return chain, names
def order_chain(ways, order):
    k6 = lambda p: (round(p['lat'], 6), round(p['lon'], 6))
    chain, names = [], []
    for wid in order:
        g = ways[wid]['geometry']
        if chain:
            if k6(g[0]) != k6(chain[-1]) and k6(g[-1]) == k6(chain[-1]): g = g[::-1]
        elif len(order) > 1:
            n2 = ways[order[1]]['geometry']
            if k6(g[0]) in (k6(n2[0]), k6(n2[-1])): g = g[::-1]
        st = len(chain); chain += g if not chain else g[1:]
        nm = ways[wid].get('tags', {}).get('name')
        if nm: names.append([nm, st, len(chain) - 1])
    return chain, names
def frame(chain):
    lat0 = sum(p['lat'] for p in chain) / len(chain); lon0 = sum(p['lon'] for p in chain) / len(chain)
    return lat0, lon0
def to_xy(lat, lon, lat0, lon0):
    E = (lon - lon0) * math.cos(math.radians(lat0)) * 111320; N = (lat - lat0) * 110574
    return -N, -E
def to_ll(x, y, lat0, lon0):
    N, E = -x, -y
    return lat0 + N / 110574, lon0 + E / (math.cos(math.radians(lat0)) * 111320)
SPA_SKIP = {34403881, 126807525, 175688514, 323851541, 1134119259}
MONZA_ORDER = [19842206,179968242,179968264,179968220,179968262,179968245,179968263,179968229,179968251,179968230,179968252,179968228,1443867792,1443867793,179968254,179968226,179968249,179968239,179968257,179968234]
def tracks():
    out = {}
    w = load('osm/spa.json'); c, n = auto_chain(w, 175178443, SPA_SKIP); out['spa'] = (c, w)
    w = load('osm/monza.json'); c, n = order_chain(w, MONZA_ORDER); out['monza'] = (c, w)
    return out
if __name__ == '__main__':
    import sys
    sim = open(sys.argv[1]).read()
    for tid, const in (('spa', 'SPA'), ('monza', 'MONZA')):
        c, _ = tracks()[tid]
        lat0, lon0 = frame(c)
        closed = key(c[0]) == key(c[-1]) if tid == 'spa' else round(c[0]['lat'], 6) == round(c[-1]['lat'], 6)
        pts = [to_xy(p['lat'], p['lon'], lat0, lon0) for p in (c[:-1] if closed else c)]
        emb = json.loads(re.search(r'const ' + const + r' = (\{.*?\});', sim).group(1))['pts']
        dmax = max(math.dist(a, b) for a, b in zip(pts, emb)) if len(pts) == len(emb) else None
        print(tid, 'points', len(pts), 'embedded', len(emb), 'max diff m', dmax, 'frame', lat0, lon0)
        json.dump({'lat0': lat0, 'lon0': lon0}, open(f'osm/{tid}_frame.json', 'w'))

# ---- accurate local projection (WGS84 ellipsoid metres per degree at the track's latitude) ----
def mpd(lat0):
    p = math.radians(lat0)
    return 111132.92 - 559.82 * math.cos(2 * p) + 1.175 * math.cos(4 * p), 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)
def to_xy2(lat, lon, lat0, lon0):
    mlat, mlon = mpd(lat0); return -(lat - lat0) * mlat, -(lon - lon0) * mlon
def to_ll2(x, y, lat0, lon0):
    mlat, mlon = mpd(lat0); return lat0 - x / mlat, lon0 - y / mlon
