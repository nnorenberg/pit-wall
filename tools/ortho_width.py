import json, sys, math, os, subprocess, urllib.request, urllib.parse, concurrent.futures as cf, time
sys.path.insert(0, 'tools'); from chain import to_ll
tid = sys.argv[1]; STEP = 5; PX = 160; MPP = 0.2   # 32 m square at 20 cm per pixel
st = json.load(open(f'osm/{tid}_stations.json')); fr = json.load(open(f'osm/{tid}_frame.json'))
os.makedirs(f'ortho/{tid}', exist_ok=True)
def wm(lat, lon): return lon * 20037508.34 / 180, math.log(math.tan((90 + lat) * math.pi / 360)) * 20037508.34 / math.pi
def fetch(i):
    path = f'ortho/{tid}/{i}.raw'
    if os.path.exists(path) and os.path.getsize(path) == PX * PX * 3: return i, True
    lat, lon = to_ll(st['x'][i], st['y'][i], fr['lat0'], fr['lon0'])
    half = PX * MPP / 2
    if tid == 'spa':
        dlat = half / 110574; dlon = half / (111320 * math.cos(math.radians(lat)))
        url = 'https://geoservices.wallonie.be/arcgis/rest/services/IMAGERIE/ORTHO_2026_PRINTEMPS/MapServer/export?' + urllib.parse.urlencode({'bbox': f'{lon-dlon},{lat-dlat},{lon+dlon},{lat+dlat}', 'bboxSR': 4326, 'imageSR': 4326, 'size': f'{PX},{PX}', 'format': 'png24', 'f': 'image'})
        ext = 'png'
    else:
        X, Y = wm(lat, lon); h = half / math.cos(math.radians(lat))
        url = 'https://www.cartografia.servizirl.it/arcgis2/rest/services/BaseMap/Ortofoto2018_2019/ImageServer/exportImage?' + urllib.parse.urlencode({'bbox': f'{X-h},{Y-h},{X+h},{Y+h}', 'bboxSR': 102100, 'size': f'{PX},{PX}', 'format': 'jpg', 'f': 'image'})
        ext = 'jpg'
    for attempt in range(5):
        try:
            data = urllib.request.urlopen(url, timeout=60).read()
            if data.startswith(b'{'): raise ValueError(data[:100])
            tmp = f'ortho/{tid}/{i}.{ext}'; open(tmp, 'wb').write(data)
            subprocess.run(['magick', tmp, '-resize', f'{PX}x{PX}!', '-depth', '8', f'rgb:{path}'], check=True)
            os.remove(tmp); return i, True
        except Exception as e:
            time.sleep(2 + attempt * 3)
    return i, False
idx = list(range(0, st['N'], STEP))
t0 = time.time(); ok = 0
with cf.ThreadPoolExecutor(4) as ex:
    for n, (i, good) in enumerate(ex.map(fetch, idx)):
        ok += good
        if n % 50 == 0: print(n, len(idx), ok, round(time.time() - t0), flush=True)
print('fetched', ok, 'of', len(idx), round(time.time() - t0))
