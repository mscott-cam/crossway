import math, sys
from PIL import Image

def field(im, x0, x1):
    W, H = im.size
    px = im.load()
    f = [[0.0] * (x1 - x0 + 2) for _ in range(H + 2)]
    for y in range(H):
        for x in range(x0, x1 + 1):
            f[y + 1][x - x0 + 1] = px[x, y][3] / 255.0
    return f

def contours(f, level=0.5):
    h = len(f); w = len(f[0])
    segs = {}
    def ek(kind, x, y): return (kind, x, y)
    def pt(key):
        kind, x, y = key
        if kind == 'h':
            a, b = f[y][x], f[y][x + 1]
            t = (level - a) / (b - a) if b != a else 0.5
            return (x + t, y)
        a, b = f[y][x], f[y + 1][x]
        t = (level - a) / (b - a) if b != a else 0.5
        return (x, y + t)
    links = {}
    for y in range(h - 1):
        for x in range(w - 1):
            a, b, c, d = f[y][x], f[y][x + 1], f[y + 1][x + 1], f[y + 1][x]
            case = (a >= level) * 8 + (b >= level) * 4 + (c >= level) * 2 + (d >= level)
            top, right, bottom, left = ek('h', x, y), ek('v', x + 1, y), ek('h', x, y + 1), ek('v', x, y)
            table = {1: [(left, bottom)], 2: [(bottom, right)], 3: [(left, right)], 4: [(top, right)],
                     6: [(top, bottom)], 7: [(left, top)], 8: [(left, top)], 9: [(top, bottom)],
                     11: [(top, right)], 12: [(left, right)], 13: [(bottom, right)], 14: [(left, bottom)]}
            if case in (5, 10):
                avg = (a + b + c + d) / 4
                if case == 5:
                    pairs = [(left, top), (bottom, right)] if avg >= level else [(left, bottom), (top, right)]
                else:
                    pairs = [(top, right), (left, bottom)] if avg >= level else [(left, top), (bottom, right)]
            else:
                pairs = table.get(case, [])
            for p, q in pairs:
                links.setdefault(p, []).append(q)
                links.setdefault(q, []).append(p)
    seen = set(); loops = []
    for start in list(links):
        if start in seen: continue
        loop = [start]; seen.add(start); prev = None; cur = start
        while True:
            nxt = None
            for n in links[cur]:
                if n != prev and n not in seen:
                    nxt = n; break
            if nxt is None: break
            seen.add(nxt); loop.append(nxt); prev, cur = cur, nxt
        if len(loop) > 3:
            loops.append([pt(k) for k in loop])
    return loops

def rdp(points, eps):
    if len(points) < 3: return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy)
    best, idx = -1, 0
    for i in range(1, len(points) - 1):
        x0, y0 = points[i]
        d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm if norm else math.hypot(x0 - x1, y0 - y1)
        if d > best: best, idx = d, i
    if best > eps:
        return rdp(points[:idx + 1], eps)[:-1] + rdp(points[idx:], eps)
    return [points[0], points[-1]]

def simplify_closed(pts, eps):
    n = len(pts)
    far = max(range(n), key=lambda i: math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
    a = rdp(pts[:far + 1], eps)
    b = rdp(pts[far:] + [pts[0]], eps)
    return a[:-1] + b[:-1]

def to_path(loops, eps, ox, oy, prec=1):
    out = []
    for lp in loops:
        s = simplify_closed(lp, eps)
        if len(s) < 3: continue
        out.append('M' + 'L'.join(f'{round(x + ox, prec)} {round(y + oy, prec)}' for x, y in s) + 'Z')
    return ''.join(out)

if __name__ == '__main__':
    im = Image.open('/Users/mscameron/Downloads/crossway_logo.png').convert('RGBA')
    mark = field(im, 0, 165)
    mark_path = to_path(contours(mark), 0.7, -1, -1)
    text = field(im, 200, 1803)
    text_path = to_path(contours(text), 0.45, 199, -1)
    open('/Users/mscameron/code/crossway/design/assets/mark.path', 'w').write(mark_path)
    open('/Users/mscameron/code/crossway/design/assets/text.path', 'w').write(text_path)
    print(len(mark_path), len(text_path))
