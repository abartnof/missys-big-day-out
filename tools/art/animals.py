#!/usr/bin/env python3
"""Draws all animal sprites (parrots, rabbit, cat, frog, bones) from code.
Run: python3 -I tools/art/animals.py   (needs Pillow). Deterministic, original art."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'src', 'assets')
OL = '#1c1a26'


def rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


class C:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.p = {}

    def px(s, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h:
            s.p[(x, y)] = c

    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                s.px(x, y, c)

    def ell(s, cx, cy, rx, ry, c):
        for y in range(s.h):
            for x in range(s.w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    s.px(x, y, c)

    def cap(s, x0, y0, x1, y1, r, c, r1=None):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        r1 = r if r1 is None else r1
        for i in range(n + 1):
            t = i / n
            s.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r + (r1 - r) * t, r + (r1 - r) * t, c)

    def mp(s, rows, ox, oy, pal):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in pal:
                    s.px(ox + i, oy + j, pal[ch])

    def shade(s, table):
        """table: base -> (hi, lo). Rim highlight on top edge, shadow on bottom edge."""
        new = dict(s.p)
        for (x, y), c in s.p.items():
            if c in table:
                hi, lo = table[c]
                if (x, y - 1) not in s.p:
                    new[(x, y)] = hi
                elif (x, y + 1) not in s.p and (x, y - 1) in s.p:
                    new[(x, y)] = lo
        s.p = new

    def outline(s):
        add = []
        for (x, y) in s.p:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in s.p and 0 <= q[0] < s.w and 0 <= q[1] < s.h:
                    add.append(q)
        for q in add:
            s.p[q] = OL

    def img(s):
        im = Image.new('RGBA', (s.w, s.h), (0, 0, 0, 0))
        for (x, y), c in s.p.items():
            im.putpixel((x, y), rgb(c))
        return im


def sheet(frames, fw, fh):
    im = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        im.paste(f.img(), (i * fw, 0))
    return im


# ---------------------------------------------------------------- parrots
WING = {
    'U2': ["......ww........",
           ".....wwv........",
           ".....wwwv.......",
           "....wwwwv.......",
           "....wwwwwv......",
           "....vwwwwv......"],
    'U1': ["................",
           "......ww........",
           ".....wwwv.......",
           "....wwwwwv......",
           "....wwwwwwv.....",
           "...vwwwwwwv....."],
    'M':  ["................",
           "................",
           "..vwwwww........",
           ".vwwwwwwwv......",
           "..vwwwwwwwv.....",
           "...vvvvvvv......"],
    'D1': ["................",
           "................",
           "................",
           "....wwwwww......",
           "....wwwwwwv.....",
           "...vwwwwwwv....."],
    'D2': [],
}
# wing rows are placed with top at y=wy; D1/D2 hang below the body
WING_Y = {'U2': 1, 'U1': 2, 'M': 5, 'D1': 6, 'D2': 9}
WING['D1'] = ["....wwwwv.......",
              "....wwwwwv......",
              "...wwwwwwwv.....",
              "...vwwwwwwv....."]
WING['D2'] = ["...vwwwwwv......",
              "...wwwwwwwv.....",
              "....wwwwwwv.....",
              "....vwwwwv......",
              ".....vvvv......."]
WING['M'] = ["...wwwwww.......",
             "..wwwwwwwv......",
             ".vwwwwwwwv......",
             "..vvvvvvv......."]
WING_Y['M'] = 5
WING_Y['U2'] = 1
WING_Y['U1'] = 3
WING['U1'] = ["......ww........",
              ".....wwwv.......",
              "....wwwwwv......",
              "....wwwwwwv.....",
              "...vwwwwwwv....."]
WING['U2'] = ["....w...........",
              ".....ww.........",
              ".....wwwv.......",
              "....wwwwwv......",
              "....wwwwwwv.....",
              "....vwwwwwv....."]
WING_Y['U1'] = 2
WING_Y['D1'] = 8
WING_Y['D2'] = 8
SEQ = [('U2', 0), ('U1', 0), ('M', 0), ('M', 1), ('D1', 1), ('D2', 1), ('D1', 0)]

BIRDS = {
    'green': dict(b='#4cb84a', L='#8ee068', d='#2f8a3a', u='#a8e070', w='#2e8a3c', v='#1d6430',
                  t='#2f8a3a', a='#e04038', f='#ffd23a', y='#f0b030', e='#a86a18', k=OL, n='#e8e8d0'),
    'blue': dict(b='#3a6ed8', L='#78a8f8', d='#2446a0', u='#ffd23a', w='#2a56b8', v='#1a3478',
                 t='#2a56b8', a='#ffe888', f='#ffd23a', y='#3a3a44', e='#1e1e26', k=OL, n='#f4f0e0'),
    'red': dict(b='#d8302c', L='#ff7a5a', d='#982020', u='#e84a38', w='#2c5ed0', v='#e8c030',
                t='#2c5ed0', a='#e8c030', f='#ffd23a', y='#f4e4b0', e='#887048', k=OL, n='#f4f0e0'),
    'grey': dict(b='#9aa0b0', L='#d0d4e0', d='#686e82', u='#c4c8d6', w='#6c7488', v='#484e62',
                 t='#586078', a='#e87a8a', f='#ffb0a0', y='#e8d8b8', e='#8a7a58', k=OL, n='#ffffff'),
}


def bird_frame(P, pose, dy=0, perched=False):
    c = C(16, 16)
    if perched:
        c.ell(7.5, 9.5, 3.6, 4.4, P['b'])
        c.ell(7.5, 11.5, 2.4, 2.4, P['u'])
        c.cap(6, 12, 3.5, 14, 1.2, P['t'])
        c.ell(9, 4.6, 2.8, 2.7, P['b'])
        c.px(8, 3, P['L']); c.px(9, 2, P['L']); c.px(9, 3, P['L'])
        c.ell(6.8, 9.2, 2.0, 3.0, P['w'])
        c.px(6, 7, P['v']); c.px(5, 12, P['v']); c.px(6, 12, P['v'])
        c.px(8, 7, P['a'])
        for p in ((12, 4), (12, 5), (11, 6)):
            c.px(*p, P['y'])
        c.px(12, 6, P['e']); c.px(11, 7, P['e'])
        c.px(10, 4, P['k']); c.px(9, 5, P['a']) if False else None
        c.px(7, 14, P['f']); c.px(9, 14, P['f'])
        c.px(10, 3, P['n']) if False else None
        c.outline()
        return c
    c.ell(7.5, 8.5 + dy, 5.0, 2.9, P['b'])
    c.ell(7, 10 + dy, 3.6, 1.3, P['u'])
    c.cap(4, 9 + dy, 0.5, 10.5 + dy, 1.1, P['t'])
    c.ell(11, 6.3 + dy, 2.7, 2.6, P['b'])
    for p in ((9, 4), (10, 3), (11, 3), (12, 4)):
        c.px(p[0], p[1] + dy, P['L'])
    c.px(8, 7 + dy, P['L']); c.px(9, 7 + dy, P['L'])
    c.px(10, 7 + dy, P['a']) if False else None
    for p in ((14, 5), (14, 6), (15, 6)):
        c.px(p[0], p[1] + dy, P['y'])
    c.px(15, 7 + dy, P['e']); c.px(14, 7 + dy, P['e'])
    c.px(12, 5 + dy, P['k'])
    c.px(11, 7 + dy, P['a'])
    pal = {k: P[k] for k in 'wv'}
    c.mp(WING[pose], 0, WING_Y[pose] + dy, pal)
    c.px(11, 13 + dy, P['f']) if False else None
    c.outline()
    return c


def make_birds():
    for name, P in BIRDS.items():
        fr = [bird_frame(P, pose, dy) for pose, dy in SEQ]
        fr.append(bird_frame(P, None, perched=True))
        sheet(fr, 16, 16).save(os.path.join(OUT, f'bird_{name}.png'))


# ---------------------------------------------------------------- rabbit
def rabbit_frame(p):
    c = C(32, 32)
    fur = '#b88a5c'; dk = '#8a6040'; hi = '#dcb68a'; bel = '#efe0c0'; pink = '#e88a8a'
    gy = 30
    lift = p['lift']
    bx, by = p['body']; by -= lift
    hx, hy = p['head']; hy -= lift
    # tail
    c.ell(bx - p['brx'] - 0.5, by - 1 + p.get('tail', 0), 2.0, 2.0, '#f4f0e8')
    # far legs (darker)
    ffx, ffy = p['ff']
    c.cap(bx + p['brx'] - 3, by + 2, ffx - 1, ffy - lift, 1.0, dk)
    hfx, hfy = p['hf']
    c.cap(bx - 3, by + 1, hfx - 2, hfy - lift, 1.1, dk)
    # body
    c.cap(bx - p['brx'] + p['bry'], by, bx + p['brx'] - p['bry'], by + p.get('tilt', 0), p['bry'], fur)
    # belly
    c.ell(bx + 2, by + p['bry'] - 1.5, p['brx'] * 0.45, 1.5, bel)
    # near legs
    c.cap(bx + p['brx'] - 3, by + 2, ffx, ffy - lift, 1.1, fur)
    # haunch + hind
    c.ell(bx - 3.5, by + 1, p['hr'][0], p['hr'][1], fur)
    c.cap(bx - 3, by + 2, hfx, hfy - lift, 1.3, fur, 1.0)
    # feet pads
    c.rect(hfx - 2, hfy - lift - 1, hfx + 2, hfy - lift, fur)
    c.rect(ffx - 1, ffy - lift - 1, ffx + 1, ffy - lift, fur)
    # head
    c.ell(hx, hy, 4.3, 3.7, fur)
    c.ell(hx + 3, hy + 1.3, 2.4, 2.0, bel)
    # ears
    ex, ey = p['ear']  # tip offset relative to head
    for k, col in ((0, dk), (1, fur)):
        c.cap(hx - 1.5 + k * 1.8, hy - 2.5, hx - 1.5 + k * 1.8 + ex, hy - 2.5 + ey, 1.2, col, 0.8)
    c.shade({fur: (hi, dk)})
    # details
    c.px(hx + 2, hy - 1, OL)
    c.px(hx + 6, hy + 0.5, pink); c.px(hx + 6, hy + 1.5, pink) if False else None
    c.px(hx + 1, hy + 0, hi) if False else None
    c.outline()
    return c


def rabbit_poses():
    # body center, head center, ears tip offset, feet (x,y absolute); brx,bry body half sizes
    def P(lift, body, head, ear, ff, hf, brx=7, bry=4.5, hr=(4.2, 4.0), tilt=0, tail=0):
        return dict(lift=lift, body=body, head=head, ear=ear, ff=ff, hf=hf, brx=brx, bry=bry, hr=hr, tilt=tilt, tail=tail)
    G = 30
    return [
        P(0, (13, 24), (20, 20), (-6, -9), (21, G), (11, G)),                         # 0 sit
        P(0, (13, 25), (20, 22), (-9, -7), (22, G), (10, G), bry=4.0, hr=(4.4, 3.6)),  # 1 crouch low
        P(0, (14, 24), (22, 20), (-8, -8), (25, G), (9, G), brx=8, bry=4.0, tilt=-2),  # 2 push
        P(3, (14, 22), (23, 17), (-9, -4), (26, G - 1), (6, G), brx=9, bry=3.6, hr=(3.6, 3.2), tilt=-3),  # 3 leave
        P(7, (14, 19), (24, 15), (-10, -2), (27, G - 4), (4, G - 3), brx=10, bry=3.4, hr=(3.4, 3.0), tilt=-2),  # 4 stretched
        P(9, (15, 18), (25, 15), (-10, 0), (27, G - 3), (5, G - 3), brx=10, bry=3.4, hr=(3.4, 3.0), tilt=0),
        P(9, (15, 18), (24, 16), (-8, -6), (24, G - 2), (11, G - 2), brx=8, bry=4.0, hr=(4.0, 3.6), tilt=1),   # 6 tuck
        P(8, (15, 19), (23, 17), (-8, -6), (22, G - 2), (13, G - 2), brx=7, bry=4.5, hr=(4.2, 4.0), tilt=1),   # 7
        P(4, (14, 21), (22, 18), (-9, -5), (24, G), (10, G - 1), brx=8, bry=4.0, hr=(4.2, 3.8), tilt=1),       # 8 descend
        P(1, (14, 24), (23, 21), (-9, -4), (26, G), (9, G), brx=9, bry=3.8, hr=(4.0, 3.6), tilt=0),           # 9 land
        P(0, (13, 25), (20, 22), (-9, -6), (22, G), (11, G), bry=4.0, hr=(4.4, 3.6)),                         # 10 settle
    ]


def make_rabbit():
    sheet([rabbit_frame(p) for p in rabbit_poses()], 32, 32).save(os.path.join(OUT, 'critter_rabbit.png'))


# ---------------------------------------------------------------- cat
def cat_frame(p):
    c = C(32, 32)
    fur = '#e08a3c'; hi = '#f6b868'; dk = '#a85a22'; far = '#b86a2c'; bel = '#f8e0b8'; stripe = '#a85a22'
    lift = p['lift']
    rx, ry = p['rear']; ry -= lift      # hip centre
    cx_, cy_ = p['chest']; cy_ -= lift  # shoulder centre
    hx, hy = p['head']; hy -= lift
    tail = p['tail']  # list of points
    # tail
    pts = [(rx + a, ry + b - 0) for a, b in tail]
    for i in range(len(pts) - 1):
        c.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.2, fur)
    # far legs
    for key, ox, oy in (('hf', rx, ry), ('ff', cx_, cy_)):
        fx, fy = p[key]
        c.cap(ox, oy + 1, fx, fy - lift, 1.1, far)
        c.rect(fx, fy - lift - 1, fx + 1, fy - lift, far)
    # body
    c.cap(rx, ry, cx_, cy_, p['br'], fur, p['br'] + 0.4)
    c.cap(rx + 1, ry + p['br'] - 1.2, cx_ - 1, cy_ + p['br'] - 1.4, 1.0, bel)
    # stripes
    for t in (0.25, 0.5, 0.75):
        sx = rx + (cx_ - rx) * t; sy = ry + (cy_ - ry) * t - p['br'] + 0.5
        c.px(sx, sy + 0, stripe); c.px(sx, sy + 1, stripe)
    # near legs
    for key, ox, oy in (('hn', rx, ry), ('fn', cx_, cy_)):
        fx, fy = p[key]
        c.cap(ox, oy + 1, fx, fy - lift, 1.3, fur, 1.1)
        c.rect(fx - 1, fy - lift - 1, fx + 1, fy - lift, fur)
    # head
    c.ell(hx, hy, 4.2, 3.6, fur)
    c.ell(hx + 3, hy + 1.2, 2.2, 1.8, bel)
    # ears
    for ex in (-2.5, 1.0):
        c.px(hx + ex, hy - 4, fur); c.px(hx + ex + 1, hy - 4, fur)
        c.px(hx + ex, hy - 5, fur) if ex < 0 else c.px(hx + ex + 1, hy - 5, fur)
        c.px(hx + ex + 0.5, hy - 3, fur)
    c.shade({fur: (hi, dk)})
    c.px(hx + 1, hy - 4, dk) if False else None
    # face
    c.px(hx + 2, hy - 1, OL); c.px(hx + 3, hy - 1, '#9be07a') if False else None
    c.px(hx + 5, hy + 0, '#e87a90')
    c.px(hx + 1, hy - 2, stripe); c.px(hx - 1, hy - 3, stripe)
    c.outline()
    return c


def cat_poses():
    G = 30
    T_UP = [(-1, -1), (-3, -4), (-4, -8), (-3, -11)]
    T_BACK = [(-1, -1), (-4, -1), (-8, -2), (-11, -3)]
    T_LOW = [(-1, 0), (-4, 1), (-8, 1), (-11, 0)]
    T_HIGH = [(-1, -2), (-3, -6), (-6, -9), (-10, -10)]

    def P(lift, rear, chest, head, hn, hf, fn, ff, tail, br=3.6):
        return dict(lift=lift, rear=rear, chest=chest, head=head, hn=hn, hf=hf, fn=fn, ff=ff, tail=tail, br=br)

    out = []
    # 0 idle stand
    out.append(P(0, (9, 20), (20, 20), (25, 15), (8, G), (11, G), (20, G), (23, G), T_UP))
    # 1 crouch
    out.append(P(0, (8, 23), (19, 25), (25, 23), (8, G), (12, G), (23, G), (25, G), T_LOW, 3.4))
    # 2 deeper crouch, rear up
    out.append(P(0, (8, 22), (18, 26), (24, 25), (7, G), (11, G), (23, G), (26, G), T_LOW, 3.3))
    # 3 spring
    out.append(P(2, (8, 24), (20, 20), (26, 17), (4, G), (7, G - 1), (25, G - 5), (27, G - 4), T_BACK, 3.4))
    # 4 stretched airborne
    out.append(P(6, (7, 22), (21, 19), (27, 17), (1, G - 4), (3, G - 3), (28, G - 7), (30, G - 5), T_BACK, 3.2))
    # 5 stretched peak
    out.append(P(8, (7, 21), (21, 19), (27, 17), (1, G - 5), (3, G - 4), (29, G - 9), (31, G - 7), T_BACK, 3.2))
    # 6 reach (coming down, paws forward)
    out.append(P(5, (8, 21), (21, 21), (27, 20), (2, G - 3), (4, G - 2), (29, G - 6), (31, G - 4), T_HIGH, 3.3))
    # 7 run extended
    out.append(P(4, (8, 20), (21, 20), (26, 18), (2, G - 2), (4, G - 3), (27, G - 3), (30, G - 5), T_BACK, 3.2))
    # 8 run: front reaching down, hind trailing
    out.append(P(1, (9, 21), (21, 21), (26, 19), (5, G - 1), (7, G), (26, G), (29, G - 1), T_BACK, 3.3))
    # 9 run: contact gathered
    out.append(P(0, (11, 20), (20, 21), (25, 18), (12, G), (14, G), (20, G), (22, G - 1), T_BACK, 3.5))
    # 10 hind pushing
    out.append(P(1, (10, 19), (20, 20), (25, 17), (4, G), (8, G - 1), (22, G - 3), (25, G - 6), T_BACK, 3.4))
    # 11 gathered airborne
    out.append(P(4, (11, 20), (20, 20), (25, 17), (14, G - 4), (16, G - 3), (21, G - 4), (23, G - 3), T_BACK, 3.5))
    # 12 extending
    out.append(P(3, (9, 20), (21, 20), (26, 18), (6, G - 2), (8, G - 3), (25, G - 4), (28, G - 6), T_BACK, 3.3))
    return out


def make_cat():
    sheet([cat_frame(p) for p in cat_poses()], 32, 32).save(os.path.join(OUT, 'critter_cat.png'))


# ---------------------------------------------------------------- frog
def frog_frame(kind):
    c = C(32, 32)
    g = '#58b84a'; hi = '#98e078'; dk = '#2f8a3a'; bel = '#d8f0a0'
    cx = 16
    if kind == 'hop':
        # stretched: hind legs trailing right, front legs reaching left
        c.cap(21, 28, 29, 30, 1.4, dk)
        c.ell(15.5, 25, 6.5, 4.0, g)
        c.ell(11.5, 27.5, 4.0, 2.0, bel)
        c.cap(11, 27, 5, 29.5, 1.2, g)
        c.rect(3, 29, 6, 30, g)
        c.cap(19, 27, 27, 29, 1.7, g, 1.2)
        c.rect(27, 29, 30, 30, g)
        c.ell(11, 21.5, 3.6, 2.8, g)
        c.shade({g: (hi, dk)})
        c.rect(8, 19, 9, 20, '#fff8d0'); c.px(8, 20, OL)
        c.rect(12, 19, 13, 20, '#fff8d0'); c.px(12, 20, OL)
        c.px(6, 23, dk)
    else:
        c.ell(cx, 27, 7.4, 3.6, g)
        # hind legs folded
        c.ell(cx + 4.5, 28, 3.2, 2.4, g)
        c.rect(cx + 4, 29, cx + 8, 30, g)
        c.rect(cx - 8, 29, cx - 5, 30, g)
        c.ell(cx - 3, 28.5, 3, 2, g)
        c.ell(cx - 3, 25, 5.2, 3.4, g)
        belly = 2.4 if kind == 'puff' else 1.2
        c.ell(cx - 5, 28, 3.2, belly + 0.4, bel) if False else None
        c.shade({g: (hi, dk)})
        # throat
        if kind == 'puff':
            c.ell(cx - 5.5, 27.6, 3.4, 2.4, bel)
            c.px(cx - 5, 26, '#bfe088')
        else:
            c.rect(cx - 8, 28, cx - 4, 28, bel)
        # eyes
        for ex in (cx - 4, cx - 1):
            c.ell(ex, 22.2, 1.9, 1.9, g)
        c.shade({g: (hi, dk)})
        for ex in (cx - 4, cx - 1):
            if kind == 'blink':
                c.rect(ex - 1, 22, ex, 22, dk)
            else:
                c.rect(ex - 1, 21, ex, 22, '#fff8d0')
                c.px(ex - 1, 22, OL)
        c.px(cx - 8, 25, OL)
        c.rect(cx - 7, 26, cx - 5, 26, dk) if False else None
        c.px(cx + 3, 25, dk); c.px(cx + 1, 24, dk)
    c.outline()
    return c


def make_frog():
    sheet([frog_frame('idle'), frog_frame('hop'), frog_frame('puff'), frog_frame('blink')], 32, 32).save(
        os.path.join(OUT, 'critter_frog.png'))


# ---------------------------------------------------------------- bones
def bone(main, hi, dk):
    c = C(23, 15)
    c.rect(5, 5, 17, 9, main)
    for cx in (3.3, 19.7):
        c.ell(cx, 4.2, 2.7, 2.6, main)
        c.ell(cx, 10.8, 2.7, 2.6, main)
    c.shade({main: (hi, dk)})
    c.rect(4, 3, 5, 3, hi) if False else None
    c.outline()
    return c


def make_bones():
    im = Image.new('RGBA', (46, 15), (0, 0, 0, 0))
    im.paste(bone('#f4ecd0', '#ffffff', '#c8b890').img(), (0, 0))
    im.paste(bone('#d8b888', '#f0dcb0', '#a07e50').img(), (23, 0))
    # place with a 1px margin so outline fits
    im.save(os.path.join(OUT, 'bones.png'))


if __name__ == '__main__':
    make_birds(); make_rabbit(); make_cat(); make_frog(); make_bones()
