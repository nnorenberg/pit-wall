import json, sys, math, os, statistics
PX = 160; MPP = 0.2
def load(tid, i):
    p = f'ortho/{tid}/{i}.raw'
    if not os.path.exists(p) or os.path.getsize(p) != PX * PX * 3: return None
    return open(p, 'rb').read()
def pix(img, fx, fy):
    x, y = int(round(fx)), int(round(fy))
    if x < 0 or y < 0 or x >= PX or y >= PX: return None
    k = (y * PX + x) * 3; return img[k], img[k + 1], img[k + 2]
def profile(img, nx, ny):
    dE, dN = -ny, -nx                       # sim normal -> east/north
    out = []
    for s in range(-150, 151):              # -15 m .. +15 m every 0.1 m
        d = s / 10
        c = pix(img, PX / 2 + d * dE / MPP, PX / 2 - d * dN / MPP)
        out.append((d, c))
    return out
def edges(img, nx, ny):
    prof = profile(img, nx, ny)
    br = {round(d, 1): (sum(c) / 3, max(c) - min(c)) for d, c in prof if c}
    core = [br[round(d / 10, 1)][0] for d in range(-20, 21) if round(d / 10, 1) in br]
    if len(core) < 10: return None, None, None
    base = statistics.median(core)
    def find(sign):
        run = []
        for s in range(25, 140):            # from 2.5 m to 14 m out
            d = round(sign * s / 10, 1)
            if d not in br: break
            b, sat = br[d]
            white = b > base + 55 and b > 150 and sat < 45
            if white: run.append(s / 10)
            elif run: break
        return (run[0] + run[-1]) / 2 if run and len(run) <= 6 else None
    return find(+1), find(-1), base
if __name__ == '__main__':
    tid = sys.argv[1]; st = json.load(open(f'osm/{tid}_stations.json'))
    for i in [int(a) for a in sys.argv[2:]]:
        img = load(tid, i)
        if img: print(i, edges(img, st['nx'][i], st['ny'][i]))
