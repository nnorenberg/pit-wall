import json, csv, io, statistics as stt
def secs(t):
    if not t: return None
    p = t.strip().split(':'); v = 0.0
    for x in p: v = v * 60 + float(x)
    return v
# ---- F1 Spa 2026 race: pace, degradation within stints, pit loss ----
for c in ('spa', 'monza'):
    d = json.load(open(f'f1_{c}_2026_race.json'))
    pits = {}
    for p in d['pits']:
        dur = secs(p['duration']) if ':' in p['duration'] else float(p['duration'])
        pits.setdefault(p['driverId'], []).append((int(p['lap']), dur))
    durs = [x[1] for v in pits.values() for x in v if x[1] < 60]
    print(f'== F1 {c} 2026: pit lane time median {stt.median(durs):.1f}s (n={len(durs)}), stops per driver', stt.mean(len(v) for v in pits.values()))
    slopes = []
    for drv, L in d['laps'].items():
        laps = {int(k): secs(v) for k, v in L.items()}
        stops = sorted(l for l, _ in pits.get(drv, []))
        bounds = [1] + [s + 1 for s in stops] + [max(laps) + 1]
        for a, b in zip(bounds, bounds[1:]):
            seq = [(l, laps[l]) for l in range(a + 2, b - 1) if l in laps]
            if len(seq) < 8: continue
            med = stt.median(t for _, t in seq); seq = [(l, t) for l, t in seq if t < med * 1.03]
            if len(seq) < 8: continue
            n = len(seq); mx = sum(l for l, _ in seq) / n; my = sum(t for _, t in seq) / n
            s = sum((l - mx) * (t - my) for l, t in seq) / sum((l - mx) ** 2 for l, _ in seq)
            slopes.append((drv, a, b - 1, round(s, 3), round(min(t for _, t in seq), 3)))
    print('   stint slope s/lap (fuel burn + tyre wear combined): median', stt.median(s[3] for s in slopes), 'n', len(slopes))
    print('   samples', slopes[:6])
# ---- WEC Spa 2026 ----
raw = open('wec_spa_2026_analysis.csv', encoding='utf-8-sig').read()
rows = list(csv.DictReader(io.StringIO(raw.replace('; ', ';')), delimiter=';'))
for cls in ('HYPERCAR', 'LMGT3'):
    R = [r for r in rows if r['CLASS'] == cls]
    cars = {}
    for r in R: cars.setdefault(r['NUMBER'], []).append(r)
    stints, pitt, tops, greens = [], [], [], []
    for no, L in cars.items():
        L.sort(key=lambda r: int(r['LAP_NUMBER']))
        n = 0
        for r in L:
            n += 1
            if r['TOP_SPEED']: tops.append(float(r['TOP_SPEED']))
            if r['FLAG_AT_FL'] == 'GF' and r['LAP_TIME'] and not r['PIT_TIME'] and r['CROSSING_FINISH_LINE_IN_PIT'] != 'B': greens.append(secs(r['LAP_TIME']))
            if r['PIT_TIME']:
                pitt.append(secs(r['PIT_TIME'])); stints.append(n); n = 0
    greens.sort()
    print(f'== WEC {cls}: laps {len(R)}, cars {len(cars)}, stint laps median {stt.median(stints)} (p25 {sorted(stints)[len(stints)//4]}, p75 {sorted(stints)[3*len(stints)//4]}), pit time median {stt.median(pitt):.1f}s, top speed p50/p95 {stt.median(tops):.1f}/{sorted(tops)[int(len(tops)*.95)]:.1f} km/h, fastest green {greens[0]:.3f}, green p10 {greens[len(greens)//10]:.3f}')
