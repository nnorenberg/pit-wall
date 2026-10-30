# season calendars and F1 tyre allocations for the page, from the research files
import json, re, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
s = json.load(open('calendar/schedule.json')); f1s = json.load(open('ref/f1/_season.json'))
cal = {}
cal['f1'] = [{'round': r['round'], 'name': r['name'], 'track': r['circuit'], 'sprint': bool(r.get('sprint')), 'status': r.get('status'), 'date': r.get('date')} for r in f1s['rounds']]
def hours(name):
    m = re.search(r'(\d+)\s*Hours', name or '');
    return int(m.group(1)) if m else (10 if '1812' in (name or '') else 6)
cal['wec'] = [{'round': e['round'], 'name': e['name'], 'track': e['circuitId'], 'hours': hours(e['name']), 'status': e.get('status'), 'date': e.get('date')} for e in s['wec']['events'] if e.get('round', 0) >= 1]
for k in ('gt4', 'tcr'):
    cal[k] = [{'round': e['round'], 'name': e.get('name') or e['circuitId'].replace('_', ' ').title(), 'track': e['circuitId'], 'status': e.get('status'), 'date': e.get('dates')} for e in s[k]['events']]
alloc = {}
for r in f1s['rounds']:
    t = r.get('tyres') or {}
    if t.get('hard'): alloc[r['circuit']] = [t['hard'], t['medium'], t['soft']]
# not yet nominated by Pirelli for 2026: provisional, the 2025 choice at the same circuit
for c, a in {'las_vegas': ['C3', 'C4', 'C5'], 'lusail': ['C1', 'C2', 'C3'], 'yas_marina': ['C3', 'C4', 'C5']}.items():
    alloc.setdefault(c, a)
open('caldata.js', 'w').write('const CAL_DATA = ' + json.dumps(cal) + ';\nconst ALLOC_DATA = ' + json.dumps(alloc) + ';\n')
for k, v in cal.items(): print(k, len(v), [x['track'] for x in v])
print('alloc', len(alloc))
