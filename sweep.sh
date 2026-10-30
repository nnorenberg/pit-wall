#!/usr/bin/env bash
# Run every 2026 calendar weekend headless through all its sessions; prints any ERR / NAN / FAST / NODEBRIEF lines
set -e
cd "$(dirname "$0")"
python3 asm4.py >/dev/null; python3 mkdata.py >/dev/null
node -e 'const fs=require("fs");eval(fs.readFileSync("caldata.js","utf8").replace(/^const /mg,"global."));for(const s in CAL_DATA)CAL_DATA[s].forEach((r,i)=>console.log(s,i))' > jobs.txt
xargs -P "$(nproc 2>/dev/null || echo 4)" -L 1 node sweep.js < jobs.txt > sweep.log 2>&1
echo "$(grep -c '^OK' sweep.log) of $(wc -l < jobs.txt) weekends OK"
grep -E 'ERR|NAN|FAST|NODEBRIEF' sweep.log || echo "no problems found"
