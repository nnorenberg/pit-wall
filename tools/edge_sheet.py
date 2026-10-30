import tempfile, os, json, subprocess, sys
sys.path.insert(0, 'tools'); from edges import PX, MPP
tid = sys.argv[1]; pick = [int(a) for a in sys.argv[3:]]; out = sys.argv[2]
st = json.load(open(f'osm/{tid}_stations.json')); E = {r['i']: r for r in json.load(open(f'ortho/{tid}_edges.json'))}
files = []
for i in pick:
    r = E.get(i); nx, ny = st['nx'][i], st['ny'][i]; dE, dN = -ny, -nx
    P = lambda d: (PX / 2 + d * dE / MPP, PX / 2 - d * dN / MPP)
    cmd = ['magick', '-size', f'{PX}x{PX}', '-depth', '8', f'rgb:ortho/{tid}/{i}.raw', '-fill', 'none']
    (x0, y0), (x1, y1) = P(-15), P(15); cmd += ['-stroke', 'rgba(255,255,0,0.5)', '-draw', f'line {x0},{y0} {x1},{y1}']
    if r and r['c'] is not None:
        for d, col in ((r['c'] - r['w'] / 2, 'cyan'), (r['c'] + r['w'] / 2, 'red'), (r['c'], 'lime')):
            cx, cy = P(d); cmd += ['-stroke', col, '-strokewidth', '1', '-draw', f'circle {cx},{cy} {cx+2.5},{cy}']
    lab = f"{i} " + (f"w{r['w']:.1f} c{r['c']:+.1f}" if r and r['c'] is not None else 'miss')
    cmd += ['-scale', '150%', '-fill', 'yellow', '-stroke', 'none', '-pointsize', '13', '-annotate', '+4+14', lab, os.path.join(tempfile.gettempdir(), f'sheet_{i}.png')]
    subprocess.run(cmd); files.append(os.path.join(tempfile.gettempdir(), f'sheet_{i}.png'))
subprocess.run(['magick', 'montage', *files, '-tile', '6x', '-geometry', '+2+2', '-background', '#222', out])
