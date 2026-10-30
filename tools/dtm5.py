import json, sys, math, time, urllib.request, urllib.parse
sys.path.insert(0, 'tools'); from chain import to_ll2
g = json.load(open('osm/monza_geom2.json')); lat0, lon0 = g['frame']
def wm(lat, lon): return lon * 20037508.34 / 180, math.log(math.tan((90 + lat) * math.pi / 360)) * 20037508.34 / math.pi
jobs = []
for k in range(g['N']):
    for o in ([0.0] + ([-(g['w'][k] / 2 - 1.2), g['w'][k] / 2 - 1.2] if k % 2 == 0 else [])):
        la, lo = to_ll2(g['x'][k] + g['nx'][k] * o, g['y'][k] + g['ny'][k] * o, lat0, lon0); jobs.append((k, round(o, 2), *wm(la, lo)))
out = {}
URL = 'https://www.cartografia.servizirl.it/arcgis2/rest/services/BaseMap/DTM5_RL_img/ImageServer/getSamples'
for a in range(0, len(jobs), 150):
    ch = jobs[a:a + 150]
    body = urllib.parse.urlencode({'geometry': json.dumps({'points': [[j[2], j[3]] for j in ch], 'spatialReference': {'wkid': 102100}}), 'geometryType': 'esriGeometryMultipoint', 'returnFirstValueOnly': 'true', 'interpolation': 'RSP_BilinearInterpolation', 'f': 'json'}).encode()
    for att in range(5):
        try:
            r = json.load(urllib.request.urlopen(URL, data=body, timeout=90))
            for s in r['samples']: j = ch[s['locationId']]; out[f'{j[0]}:{j[1]}'] = float(s['value'])
            break
        except Exception as e: time.sleep(3 + att * 3)
    time.sleep(0.3)
json.dump(out, open('osm/monza_dtm5.json', 'w')); print('monza dtm5', len(out), 'of', len(jobs))
