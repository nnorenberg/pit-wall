import json, sys, time, urllib.request, urllib.parse, concurrent.futures as cf
sys.path.insert(0, 'tools'); from chain import to_ll2
g = json.load(open('osm/spa_geom2.json')); lat0, lon0 = g['frame']
URL = 'https://geoservices.wallonie.be/arcgis/rest/services/RELIEF/WALLONIE_MNT_2021_2022/MapServer/identify'
def q(lat, lon):
    d = 0.0005
    p = {'geometry': f'{lon},{lat}', 'geometryType': 'esriGeometryPoint', 'sr': 4326, 'layers': 'all', 'tolerance': 0, 'mapExtent': f'{lon-d},{lat-d},{lon+d},{lat+d}', 'imageDisplay': '200,200,96', 'returnGeometry': 'false', 'f': 'json'}
    for a in range(6):
        try:
            r = json.load(urllib.request.urlopen(URL + '?' + urllib.parse.urlencode(p), timeout=30))['results']
            v = r[0]['attributes'].get('Stretch.Pixel Value') or r[0]['attributes'].get('Pixel Value')
            return float(v) if v not in (None, 'NoData') else None
        except Exception: time.sleep(1 + a * 2)
jobs = []
for k in range(g['N']):
    offs = [0.0] + ([-(g['w'][k] / 2 - 1.2), g['w'][k] / 2 - 1.2] if k % 2 == 0 else [])
    for o in offs:
        x = g['x'][k] + g['nx'][k] * o; y = g['y'][k] + g['ny'][k] * o
        jobs.append((k, round(o, 2), *to_ll2(x, y, lat0, lon0)))
out = {}; t0 = time.time()
with cf.ThreadPoolExecutor(6) as ex:
    futs = {ex.submit(q, j[2], j[3]): j for j in jobs}
    for n, f in enumerate(cf.as_completed(futs)):
        k, o, _, _ = futs[f]; out[f'{k}:{o}'] = f.result()
        if n % 500 == 0: print(n, len(jobs), round(time.time() - t0), flush=True)
json.dump(out, open('osm/spa_lidar2.json', 'w')); print('done', len(out), 'missing', sum(v is None for v in out.values()), round(time.time() - t0))
