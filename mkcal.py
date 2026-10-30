# poles and per-car qualifying gaps for every circuit and class with real timing (current regulations)
import json, glob, re, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
roster = json.loads(open('roster.json').read())   # {cls: ["Make Model", ...]} written by node
tok = lambda s: set(re.findall(r'[a-z0-9]+', s.lower().replace('mercedes-amg', 'mercedesamg').replace('-', '')))
def match(cls, key):
    k = tok(key); best = None
    for r in roster[cls]:
        t = tok(r)
        if k <= t or t <= k or len(k & t) >= max(2, min(len(k), len(t)) - 1):
            best = r; break
    return best
pole, gaps = {}, {}
for f in sorted(glob.glob('ref/*/*_calib.json')):
    tid = os.path.basename(f)[:-11]; d = json.load(open(f))
    for cls, v in d.items():
        if cls.startswith('_') or not isinstance(v, dict) or cls not in roster or not v.get('pole'): continue
        est = cls == 'f1' and v.get('year', 2026) < 2026
        if est and not v.get('est2026'): continue                      # 2025 cars aren't the 2026 cars
        pole.setdefault(cls, {})[tid] = v['est2026'] if est else v['pole']
        if est: continue                                               # 2025 gaps don't carry over
        g = {}
        for k, x in (v.get('qualiGaps') or {}).items():
            m = match(cls, k)
            if m and x is not None and x / v['pole'] < 0.03 and m not in g: g[m] = round(x, 3)
        if g: gaps.setdefault(cls, {})[tid] = g
# LMGT3 where only a Hypercar pole exists (Monza ran GTE in 2023): median GT3/Hypercar ratio elsewhere
rs = sorted(pole['gt3'][t] / pole['hyper'][t] for t in pole.get('gt3', {}) if t in pole.get('hyper', {}))
for t in pole.get('hyper', {}):
    if t not in pole['gt3']: pole['gt3'][t] = round(pole['hyper'][t] * rs[len(rs) // 2], 3); print('gt3 estimated', t, pole['gt3'][t])
json.dump(pole, open('poles.json', 'w')); json.dump(gaps, open('gaps.json', 'w'))
for c in pole: print(c, len(pole[c]), sorted(pole[c]))
