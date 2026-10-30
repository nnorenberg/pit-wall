#!/usr/bin/env bash
# Recalibrate grip per circuit and class against real poles: CLS=f1 ./recal.sh spa monza
set -e
cd "$(dirname "$0")"
python3 asm4.py >/dev/null
node cal4.js "$@" >> cal4.log 2>&1
python3 - <<'PY'
import json
t=json.load(open('trackcal.json'))
for k,v in t.items():
    vals=[x for c,x in v.items() if c!='_']
    if vals: v['_']=round(sum(vals)/len(vals),4)
json.dump(t,open('trackcal.json','w'))
PY
./build.sh > build.log 2>&1
tail -3 build.log
