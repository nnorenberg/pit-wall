import json, math, sys, urllib.request, urllib.parse, concurrent.futures as cf, time
sys.path.insert(0, 'tools'); from chain import to_ll
st = json.load(open('osm/spa_stations.json')); fr = json.load(open('osm/spa_frame.json'))
URL = 'https://geoservices.wallonie.be/arcgis/rest/services/RELIEF/WALLONIE_MNT_2021_2022/MapServer/identify'
def q(lat, lon):
    d = 0.0005
    params = {'geometry': f'{lon},{lat}', 'geometryType': 'esriGeometryPoint', 'sr': 4326, 'layers': 'all', 'tolerance': 0,
              'mapExtent': f'{lon-d},{lat-d},{lon+d},{lat+d}', 'imageDisplay': '200,200,96', 'returnGeometry': 'false', 'f': 'json'}
    for attempt in range(5):
        try:
            with urllib.request.urlopen(URL + '?' + urllib.parse.urlencode(params), timeout=30) as r:
                res = json.load(r)['results']
                v = res[0]['attributes'].get('Stretch.Pixel Value') or res[0]['attributes'].get('Pixel Value')
                return float(v) if v not in (None, 'NoData') else None
        except Exception as e:
            time.sleep(1 + attempt * 2)
    return None
N = st['N']; jobs = []
OFF = [-4.0, 0.0, 4.0]
for i in range(N):
    for o in (OFF if i % 2 == 0 else [0.0]):
        x = st['x'][i] + st['nx'][i] * o; y = st['y'][i] + st['ny'][i] * o
        lat, lon = to_ll(x, y, fr['lat0'], fr['lon0'])
        jobs.append((i, o, lat, lon))
out = {}
t0 = time.time()
with cf.ThreadPoolExecutor(6) as ex:
    futs = {ex.submit(q, j[2], j[3]): j for j in jobs}
    for n, f in enumerate(cf.as_completed(futs)):
        i, o, lat, lon = futs[f]; out[f'{i}:{o}'] = f.result()
        if n % 500 == 0: print(n, len(jobs), round(time.time() - t0), flush=True)
json.dump(out, open('osm/spa_lidar.json', 'w'))
print('done', len(out), 'missing', sum(v is None for v in out.values()), round(time.time() - t0))
