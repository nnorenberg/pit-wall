#!/usr/bin/env bash
# Build the single-file game: sim + calendars + real-world timing injected into the page -> dist/pit-wall.html
set -e
cd "$(dirname "$0")"
python3 asm4.py; python3 mkdata.py >/dev/null; python3 mk_page4.py
python3 - <<'PY'
import json, glob, os
ref = json.load(open('ref.json'))
for f in sorted(glob.glob('ref/*/*.json')):
    b = os.path.basename(f)
    if b.startswith('_') or b.endswith('_calib.json'): continue
    tid = b[:-5]; d = json.load(open(f))
    for cls, years in d.items():
        if cls.startswith('_') or not isinstance(years, dict): continue
        dst = ref.setdefault(tid, {}).setdefault(cls, {})
        if d.get('_sources') and '_src' not in dst: dst['_src'] = [x if isinstance(x, str) else (x.get('url') or x.get('name') or '') for x in d['_sources']][:3]
        for y, v in years.items():
            if y not in dst: dst[y] = v
p = open('page4.html').read(); s = open('sim4.js').read().replace("if (typeof module !== 'undefined')", 'if (false)') + open('caldata.js').read()
p = p.replace('/*SIM*/\n', s, 1).replace('/*REF*/', '// Real-world timing, normalised from official sources (see the reference panel for each source)\nconst REF = ' + json.dumps(ref, separators=(',', ':')) + ';', 1)
open('apex-school.html', 'w').write(p)
print('html', len(p), 'ref tracks', len(ref))
PY
mkdir -p dist; cp apex-school.html dist/pit-wall.html
node -e "const h=require('fs').readFileSync('apex-school.html','utf8');[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((x,i)=>{try{new Function(x[1]);console.log('ok',i,x[1].length)}catch(e){console.log('ERR',i,e.message)}})"
