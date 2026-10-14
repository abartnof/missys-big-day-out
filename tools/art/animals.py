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
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
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


# ---------------------------------------------------------------- bunny and kitty
# Small, chibi proportions (big round heads, short legs, shiny eyes), drawn at about
# Missy's size. Poses are absolute coordinates in a 32x32 frame facing right; feet touch y=30.
def cute_eye(c, x, y, iris=OL):
    """2x2 eye with a white catchlight, and a blush pixel below and behind it."""
    c.px(x, y, '#ffffff'); c.px(x + 1, y, iris); c.px(x, y + 1, iris); c.px(x + 1, y + 1, iris)
    c.px(x - 1, y + 2, '#f4a0b4')


def rabbit_frame(p):
    c = C(32, 32)
    fur = '#f2f0ec'; hi = '#ffffff'; dk = '#c4c4d0'; far = '#d6d6e0'; ear = '#f4a6b8'
    (rx, ry), (fx, fy), r = p['rear'], p['front'], p['r']
    hx, hy = p['head']
    (hfx, hfy), (ffx, ffy) = p['hf'], p['ff']
    tx, ty = p['ears']
    # far ear and far legs, darker
    c.cap(hx - 2.2, hy - 2, hx - 2.2 + tx - 1, hy - 2 + ty + 1, 1.0, far, 0.8)
    c.cap(rx, ry + 1, hfx + 1, hfy, 0.8, far)
    c.cap(fx, fy + 1, ffx - 1, ffy, 0.7, far)
    # body, round haunch, puff tail
    c.cap(rx, ry, fx, fy, r, fur)
    c.ell(rx - 0.5, ry + 0.5, r + 0.6, r + 0.4, fur)
    c.ell(rx - r - 0.6, ry - 1.2, 1.5, 1.5, fur)
    # near legs: long hind foot, little front paw
    c.cap(rx, ry + 1, hfx, hfy, 1.0, fur)
    c.rect(hfx - 1, hfy - 1, hfx + 2, hfy, fur)
    c.cap(fx, fy + 1, ffx, ffy, 0.8, fur)
    c.rect(ffx, ffy - 1, ffx + 1, ffy, fur)
    # near ear (long, pink inside) and big round head
    c.cap(hx - 1, hy - 2, hx - 1 + tx, hy - 2 + ty, 1.2, fur, 1.0)
    c.ell(hx, hy, 3.8, 3.4, fur)
    c.shade({fur: (hi, dk)})
    c.cap(hx - 1 + tx * 0.3, hy - 2 + ty * 0.3, hx - 1 + tx * 0.85, hy - 2 + ty * 0.85, 0.5, ear)
    cute_eye(c, hx + 1, hy - 1)
    c.px(hx + 3, hy + 1, '#e87a90')
    c.outline()
    return c


def rabbit_poses():
    def P(rear, front, r, head, ears, hf, ff):
        return dict(rear=rear, front=front, r=r, head=head, ears=ears, hf=hf, ff=ff)
    return [
        P((12, 26), (16, 26), 3.0, (20, 22), (-4, -6), (13, 30), (18, 30)),   # 0 gathered on the ground
        P((12, 25), (18, 23), 2.8, (22, 19), (-6, -4), (7, 30), (23, 27)),    # 1 push off
        P((11, 23), (19, 22), 2.8, (23, 18), (-7, -2), (4, 27), (25, 26)),    # 2 stretched flight
        P((11, 22), (19, 22), 2.8, (23, 18), (-7, -1), (4, 26), (26, 25)),    # 3 peak
        P((11, 22), (19, 23), 2.8, (23, 19), (-6, -3), (6, 26), (24, 28)),    # 4 front paws reach down
        P((12, 22), (19, 25), 2.9, (23, 21), (-6, -4), (11, 26), (22, 30)),   # 5 front touchdown
        P((13, 23), (18, 26), 3.0, (22, 22), (-5, -5), (17, 28), (20, 30)),   # 6 hind legs swing past
        P((13, 25), (17, 26), 3.0, (21, 22), (-4, -6), (17, 30), (14, 29)),   # 7 gathered landing
    ]


def make_rabbit():
    sheet([rabbit_frame(p) for p in rabbit_poses()], 32, 32).save(os.path.join(OUT, 'critter_rabbit.png'))


def cat_frame(p):
    c = C(32, 32)
    fur = '#f09040'; hi = '#ffc070'; dk = '#c06424'; far = '#c8702c'; bel = '#fbe6c4'; stripe = OL
    (rx, ry), (cx_, cy_), hx, hy = p['rear'], p['chest'], *p['head']
    br = p.get('br', 2.3)
    pts = [(rx + a, ry + b) for a, b in p['tail']]
    for i in range(len(pts) - 1):
        c.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.9, fur)
    for key, ox, oy in (('hf', rx, ry), ('ff', cx_, cy_)):
        fx, fy = p[key]
        c.cap(ox, oy + 1, fx, fy, 0.8, far)
        c.rect(fx, fy - 1, fx + 1, fy, far)
    # body (a raised middle arches the back when gathered), pale belly
    c.cap(rx, ry, cx_, cy_, br, fur, br + 0.3)
    if p.get('arch'):
        c.ell((rx + cx_) / 2, (ry + cy_) / 2 - p['arch'], br + 0.6, br, fur)
    c.cap(rx + 1, ry + br - 0.8, cx_ - 1, cy_ + br - 0.8, 0.8, bel)
    for key, ox, oy in (('hn', rx, ry), ('fn', cx_, cy_)):
        fx, fy = p[key]
        c.cap(ox, oy + 1, fx, fy, 0.9, fur)
        c.rect(fx - 1, fy - 1, fx + 1, fy, fur)
    # big round head, pointy ears, pale muzzle
    c.ell(hx, hy, 3.6, 3.2, fur)
    for ex in (-2.5, 1.5):
        c.rect(hx + ex, hy - 4, hx + ex + 1, hy - 3, fur)
        c.px(hx + ex + (0 if ex < 0 else 1), hy - 5, fur)
    c.shade({fur: (hi, dk)})
    c.ell(hx + 2.2, hy + 1.5, 1.7, 1.2, bel)
    c.px(hx - 2, hy - 4, '#f4a6b8'); c.px(hx + 2, hy - 4, '#f4a6b8')
    # tabby stripes on the back and forehead
    for t in (0.2, 0.45, 0.7):
        sx, sy = rx + (cx_ - rx) * t, ry + (cy_ - ry) * t - br - p.get('arch', 0) * (1 - abs(t - 0.5) * 2)
        c.px(sx, sy + 1, stripe); c.px(sx, sy + 2, stripe)
    c.px(hx - 1, hy - 3, stripe); c.px(hx, hy - 3, stripe)
    cute_eye(c, hx + 1, hy - 1, '#2a3a20')
    c.px(hx + 3.6, hy + 0.6, '#e87a90')
    c.outline()
    return c


def cat_poses():
    T_BACK = [(-1, -1), (-4, -2), (-7, -2), (-9, -3)]
    T_CURL = [(-1, -1), (-3, -3), (-5, -5), (-8, -5)]
    T_LOW = [(-1, 0), (-4, 0), (-7, 1), (-9, 0)]

    def P(rear, chest, head, hn, hf, fn, ff, tail, arch=0, br=2.3):
        return dict(rear=rear, chest=chest, head=head, hn=hn, hf=hf, fn=fn, ff=ff, tail=tail, arch=arch, br=br)
    return [
        P((10, 23), (21, 23), (25, 20), (4, 26), (5, 27), (28, 25), (29, 26), T_BACK),           # 0 stretched flight
        P((10, 24), (21, 25), (25, 22), (5, 27), (6, 28), (26, 30), (28, 29), T_BACK),           # 1 front touchdown
        P((11, 24), (20, 26), (24, 23), (9, 28), (8, 27), (23, 30), (25, 30), T_CURL, 1),        # 2 front plant, hind swings
        P((12, 23), (19, 26), (23, 23), (14, 29), (13, 28), (20, 30), (22, 30), T_CURL, 2),      # 3 gathered
        P((12, 23), (19, 24), (23, 21), (17, 30), (16, 30), (15, 28), (14, 29), T_CURL, 2),      # 4 hind land ahead
        P((11, 24), (19, 23), (23, 20), (14, 30), (13, 30), (24, 26), (23, 27), T_LOW, 1),       # 5 push off
        P((9, 25), (20, 23), (24, 20), (5, 30), (7, 29), (27, 24), (26, 25), T_BACK),            # 6 extend
        P((10, 22), (21, 22), (25, 19), (3, 25), (5, 26), (29, 23), (28, 24), T_BACK),           # 7 flight
    ]


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
