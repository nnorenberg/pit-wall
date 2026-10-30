import json, sys, time, urllib.request
sys.path.insert(0, 'tools'); from chain import to_ll
tid, dataset = sys.argv[1], sys.argv[2]
st = json.load(open(f'osm/{tid}_stations.json')); fr = json.load(open(f'osm/{tid}_frame.json'))
N = st['N']; locs = [to_ll(st['x'][i], st['y'][i], fr['lat0'], fr['lon0']) for i in range(N)]
out = [None] * N
for a in range(0, N, 100):
    chunk = locs[a:a + 100]
    q = '|'.join(f'{la:.7f},{lo:.7f}' for la, lo in chunk)
    for attempt in range(6):
        try:
            r = json.load(urllib.request.urlopen(f'https://api.opentopodata.org/v1/{dataset}?locations={q}', timeout=60))
            if r.get('status') == 'OK':
                for k, res in enumerate(r['results']): out[a + k] = res['elevation']
                break
        except Exception as e: pass
        time.sleep(2 + attempt * 2)
    time.sleep(1.2)
json.dump({'dataset': dataset, 'z': out}, open(f'osm/{tid}_elev_{dataset}.json', 'w'))
print(tid, dataset, 'missing', sum(v is None for v in out), 'range', min(v for v in out if v is not None), max(v for v in out if v is not None))
