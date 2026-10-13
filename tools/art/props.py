#!/usr/bin/env python3
"""Original NES-style street props. Run: python3 -I tools/art/props.py
Writes tools/art/out/props_layer.png (496x280 RGBA, hard pixels only)."""
import os
from PIL import Image

W, H = 496, 280
OL = (0x1c, 0x1a, 0x26, 255)


def C(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def hsh(x, y, n):
    return ((x * 73856093) ^ (y * 19349663) ^ (x * y * 83492791)) % n


class Layer(dict):
    def px(self, x, y, c): self[(x, y)] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self[(x, y)] = c

    def disc(self, cx, cy, r, c):
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6:
                    self[(x, y)] = c

    def line(self, x0, y0, x1, y1, w, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            o = w // 2
            for dy in range(w):
                for dx in range(w):
                    self[(x - o + dx, y - o + dy)] = c

    def bevel(self, pal):
        """edge shade: pal=(light, mid, dark); light from top-left."""
        keys = set(self)
        for (x, y) in keys:
            if (x - 1, y) not in keys or (x, y - 1) not in keys:
                self[(x, y)] = pal[0]
            elif (x + 1, y) not in keys or (x, y + 1) not in keys:
                self[(x, y)] = pal[2]
            else:
                self[(x, y)] = pal[1]


class Box:
    def __init__(self, img, x, y, w, h):
        self.img, self.x, self.y, self.w, self.h = img, x, y, w, h

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.img.putpixel((self.x + x, self.y + y), c)

    def commit(self, L, outline=True):
        if outline:
            for (x, y) in list(L):
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if (x + dx, y + dy) not in L:
                        self.set(x + dx, y + dy, OL)
        for (x, y), c in L.items():
            self.set(x, y, c)


def clump(L, cx, cy, r, pal):
    dark, mid, light, hi = pal
    L.disc(cx, cy, r, dark)
    L.disc(cx - 1, cy - 1, r - 1.2, mid)
    if r >= 4:
        L.disc(cx - 2, cy - 2, r - 3.2, light)
    if r >= 6:
        L.px(int(cx - 3), int(cy - 3), hi)
        L.px(int(cx - 2), int(cy - 4), hi)


def speckle(L, pal, mod=9):
    for (x, y), c in list(L.items()):
        h = hsh(x, y, mod)
        if h == 0 and c in (pal[1], pal[2]): L[(x, y)] = pal[0]
        elif h == 1 and c == pal[1]: L[(x, y)] = pal[2]


# ---- palettes -------------------------------------------------------------
WOOD = [C('#f0b868'), C('#c98040'), C('#98582e'), C('#6a3a22')]  # hi, mid, dark, deep
G1 = [C('#2a6a3c'), C('#3f9a52'), C('#6cc46e'), C('#a8e890')]  # dark..hi
G2 = [C('#1c4a34'), C('#2c7444'), C('#46a05a'), C('#7acc78')]
GH = [C('#1f5a34'), C('#34843f'), C('#58b058'), C('#8cdc84')]
BARK = [C('#b88050'), C('#8a5a38'), C('#5e3a28')]
TERRA = [C('#e8946a'), C('#c0603c'), C('#823a2c')]
YEL = [C('#fbe870'), C('#f4c820'), C('#b88a10')]
BLK = [C('#5c5c74'), C('#34343f'), C('#24242e')]
ORG = [C('#ffa850'), C('#f07820'), C('#b8481a')]
RED = [C('#ff7060'), C('#d82c2c'), C('#8c1c2c')]
NAVY = [C('#6c80c0'), C('#38457a'), C('#242c52')]
GREY = [C('#b4bad0'), C('#848ca8'), C('#555b78')]
WHITE = C('#f4f4f8'); WSH = C('#bcc0d4')


def shade_rect(L, x0, y0, x1, y1, pal):
    sub = Layer(); sub.rect(x0, y0, x1, y1, pal[1]); sub.bevel(pal); L.update(sub)


# ---- crates ----------------------------------------------------------------
def crate(L, x0, y0, w, h):
    """full crate incl. its own outline row/col (drawn inside x0..x0+w-1)."""
    x1, y1 = x0 + w - 1, y0 + h - 1
    L.rect(x0, y0, x1, y1, OL)
    ix0, iy0, ix1, iy1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1
    # frame
    L.rect(ix0, iy0, ix1, iy1, WOOD[1])
    for x in range(ix0, ix1 + 1): L.px(x, iy0, WOOD[0])
    for y in range(iy0, iy1 + 1): L.px(ix0, y, WOOD[0])
    for x in range(ix0, ix1 + 1): L.px(x, iy1, WOOD[2])
    for y in range(iy0, iy1 + 1): L.px(ix1, y, WOOD[2])
    # inner panel
    fx0, fy0, fx1, fy1 = ix0 + 2, iy0 + 2, ix1 - 2, iy1 - 2
    if fx1 > fx0 + 1 and fy1 > fy0 + 1:
        L.rect(fx0, fy0, fx1, fy1, WOOD[2])
        for y in range(fy0, fy1 + 1):  # planks
            if (y - fy0) % 4 == 3: L.rect(fx0, y, fx1, y, WOOD[3])
        # diagonal brace, light with dark underside
        n = max(fx1 - fx0, fy1 - fy0)
        for i in range(n + 1):
            bx = fx0 + round((fx1 - fx0) * i / n)
            by = fy1 - round((fy1 - fy0) * i / n)
            L.px(bx, by, WOOD[1])
            if by - 1 >= fy0: L.px(bx, by - 1, WOOD[0])
            if by + 1 <= fy1: L.px(bx, by + 1, WOOD[2])
        # nails
        for nx, ny in ((ix0, iy0), (ix1, iy0), (ix0, iy1), (ix1, iy1)):
            L.px(nx, ny, WOOD[3])
    else:
        L.rect(ix0 + 1, iy0 + 1, ix1 - 1, iy1 - 1, WOOD[2])


# ---- generic bits ----------------------------------------------------------
def bag(L, x0, y0, w, h, pal, tie=C('#e8c040')):
    """garbage bag with tied neck; occupies x0..x0+w-1, y0..y0+h-1 (fill only)."""
    nh = max(4, h // 3)
    body_top = y0 + nh
    bh = h - nh
    cx = x0 + (w - 1) / 2
    B = Layer()
    for y in range(body_top, y0 + h):
        t = (y - body_top + 0.5) / bh
        # bulge: widest around 60%, round bottom
        if t < 0.6: half = (w / 2) * (0.45 + 0.55 * (t / 0.6) ** 0.7)
        else: half = (w / 2) * (1 - ((t - 0.6) / 0.4) ** 2.2 * 0.38)
        for x in range(x0, x0 + w):
            if abs(x - cx) <= half - 0.2: B[(x, y)] = pal[1]
    # neck + frills
    nx = int(round(cx))
    for y in range(y0 + 2, body_top + 1):
        B[(nx, y)] = pal[1]; B[(nx - 1, y)] = pal[1]
    B[(nx - 2, y0)] = pal[1]; B[(nx - 3, y0 + 1)] = pal[1]; B[(nx + 1, y0)] = pal[1]
    B[(nx + 2, y0 + 1)] = pal[1]; B[(nx - 2, y0 + 1)] = pal[1]; B[(nx + 1, y0 + 1)] = pal[1]
    B[(nx - 1, y0 + 1)] = pal[1]; B[(nx, y0 + 1)] = pal[1]
    # shading
    keys = set(B)
    for (x, y) in keys:
        if (x + 1, y) not in keys or (x, y + 1) not in keys or (x + 1, y + 1) not in keys:
            B[(x, y)] = pal[2]
        elif x > cx + 1 and y > body_top + 1 and (x + 2, y) not in keys: B[(x, y)] = pal[2]
    for (x, y) in keys:
        if y > body_top and B[(x, y)] == pal[1]:
            if (x - 1, y) not in keys or (x, y - 1) not in keys: B[(x, y)] = pal[0]
    # specular streak top-left + fold lines
    sx = int(x0 + w * 0.28)
    for i in range(max(2, bh // 3)):
        if (sx, body_top + 2 + i) in B: B[(sx, body_top + 2 + i)] = pal[0]
        if (sx + 1, body_top + 2 + i) in B and i < 2: B[(sx + 1, body_top + 2 + i)] = pal[0]
    for i in range(bh // 2):
        px_ = nx + 1 + i // 2
        if (px_, body_top + 1 + i) in B and B[(px_, body_top + 1 + i)] == pal[1]: B[(px_, body_top + 1 + i)] = pal[2]
    B[(nx - 1, body_top)] = tie; B[(nx, body_top)] = tie
    B[(nx - 1, body_top - 1)] = tie
    # outline ring individually for each bag (keeps piles readable)
    for (x, y) in list(B):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in B: L[(x + dx, y + dy)] = OL
    L.update(B)


def hedge(L, x0, y0, x1, y1, r, rad):
    mask = set()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx = min(x - x0, x1 - x); dy = min(y - y0, y1 - y)
            if dx < rad and dy < rad and (rad - dx - 0.5) ** 2 + (rad - dy - 0.5) ** 2 > rad * rad: continue
            mask.add((x, y))
    T = Layer()
    for (x, y) in mask: T[(x, y)] = GH[0]
    step = r * 2 - 1
    row = 0
    cy = y0 + r - 1
    while cy < y1 + r:
        cx = x0 + r - 1 + (r if row % 2 else 0) - (r if row % 2 else 0)
        off = (step // 2) * (row % 2)
        cx = x0 + off - (1 if row % 2 else 0)
        while cx < x1 + r:
            S = Layer(); clump(S, cx, cy, r, GH)
            for k, c in S.items():
                if k in mask: T[k] = c
            cx += step
        cy += r + 1; row += 1
    speckle(T, GH, 16)
    # keep the very top/left rim lit
    for (x, y) in mask:
        if (x, y - 1) not in mask and T[(x, y)] == GH[1]: T[(x, y)] = GH[2]
    for (x, y) in mask:
        if ((x, y + 1) not in mask or (x + 1, y) not in mask) and T[(x, y)] != GH[0]:
            T[(x, y)] = GH[0] if hsh(x, y, 2) else GH[1]
    L.update(T)


def shrub(L, x0, y0, x1, y1, planter_h, pal=GH):
    """A rounded, lumpy shrub (overlapping leaf clumps, drawn back to front) in a stone planter."""
    fy1 = y1 - planter_h + 2                     # foliage spills a little over the planter rim
    w, h = x1 - x0 + 1, fy1 - y0 + 1
    r = max(4, min(10, h // 3))
    n = max(2, w // (r + 2))
    span = w - 2 * r
    clumps = [(x0 + r + i * span / (n - 1), fy1 - r + 1, r) for i in range(n)]               # low row
    if h > 3 * r:                                                                             # middle row
        clumps += [(x0 + r + (i + 0.5) * span / (n - 1), y0 + h // 2, r + 1) for i in range(n - 1)]
    clumps += [(x0 + r + (i + 0.5) * span / (n - 1), y0 + r + (2 if i % 2 else 1), r + (1 if i % 2 else 2))
               for i in range(n - 1)]                                                         # top row, lit
    for cx, cy, rr in clumps:
        S = Layer(); clump(S, cx, cy, rr, pal)
        for (x, y), c in S.items():
            if x0 <= x <= x1 and y0 <= y <= fy1: L[(x, y)] = c
    speckle(L, pal, 14)
    shade_rect(L, x0, y1 - planter_h + 1, x1, y1, GREY)      # planter / curb
    for x in range(x0, x1 + 1):
        L[(x, y1 - planter_h + 1)] = GREY[0]                 # lit rim


def trunk(L, cx, y0, y1, hw, flare=3, pal=BARK):
    for y in range(y0, y1 + 1):
        fl = max(0, flare - (y1 - y)) if flare else 0
        for x in range(cx - hw - fl, cx + hw + 1 + fl):
            L[(x, y)] = pal[1]
    keys = set(L)
    for (x, y) in list(keys):
        if (x - 1, y) not in keys: L[(x, y)] = pal[0]
    for (x, y) in list(keys):
        if (x + 1, y) not in keys or (x + 2, y) not in keys and hsh(x, y, 3) == 0: L[(x, y)] = pal[2]
    for (x, y) in list(keys):
        if L[(x, y)] == pal[1] and hsh(x, y // 2, 5) == 0: L[(x, y)] = pal[2]


# ---- build -----------------------------------------------------------------
def build():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    boxes = {}

    def mk(name, x, y, w, h):
        boxes[name] = (x, y, w, h)
        return Box(img, x, y, w, h)

    # crates
    b = mk('crateL', 0, 200, 32, 59); L = Layer()
    crate(L, 0, 38, 32, 21); crate(L, 1, 19, 30, 20); crate(L, 0, 0, 32, 20)
    b.commit(L, False)
    b = mk('crateM', 34, 200, 32, 48); L = Layer()
    crate(L, 0, 24, 32, 24); crate(L, 3, 0, 27, 25)
    b.commit(L, False)
    b = mk('crateS', 68, 200, 17, 32); L = Layer()
    crate(L, 0, 16, 17, 16); crate(L, 1, 0, 15, 16)
    b.commit(L, False)

    # dumpster
    b = mk('dumpster', 87, 200, 48, 32); L = Layer()
    body = Layer(); body.rect(3, 10, 44, 29, G1[1])
    for x in range(4, 44, 1): body.px(x, 10, G1[2]) if x else None
    for (x, y) in list(body):  # shading
        if x in (3, 4): body[(x, y)] = G1[2]
        if x >= 43: body[(x, y)] = G1[0]
        if y >= 28: body[(x, y)] = G1[0]
    for x in (11, 19, 27, 35):  # ribs
        for y in range(12, 28):
            body[(x, y)] = G1[0]; body[(x + 1, y)] = G1[2]
    for y in range(11, 13):
        for x in range(4, 43): body[(x, y)] = G1[2] if y == 11 else G1[1]
    # side hazard/label plate
    body.rect(15, 17, 22, 21, WHITE)
    body.rect(16, 18, 21, 18, G1[0]); body.rect(16, 20, 20, 20, G1[0])
    for x in range(15, 23): body.px(x, 21, WSH)
    L.update(body)
    # wheels
    for wx in (6, 38):
        L.rect(wx, 30, wx + 3, 30, BLK[1]); L.rect(wx, 31, wx + 3, 31, BLK[1])
    # lid
    lid = Layer(); lid.rect(0, 2, 47, 9, G1[1])
    for x in range(0, 48): lid.px(x, 2, G1[2]); lid.px(x, 3, G1[2]) if x % 1 == 0 else None
    for x in range(0, 48): lid.px(x, 2, C('#a8e890')); lid.px(x, 3, G1[2])
    for x in range(0, 48): lid.px(x, 8, G1[0]); lid.px(x, 9, G1[0])
    lid.rect(46, 4, 47, 9, G1[0])
    for x in range(1, 47): lid.px(x, 3, G1[2])
    lid.rect(0, 4, 1, 8, G1[2])
    lid.rect(19, 4, 28, 5, G1[2])  # handle
    lid.rect(19, 4, 28, 4, G1[0] if False else C('#a8e890'))
    L.update(lid)
    L.rect(3, 29, 44, 29, G1[0])
    b.commit(L)
    # restore: shrink so outline stays inside box
    # (shape spans y2..31 -> outline row y1 and y32 clipped, bottom row y31 is wheel)

    # tree1
    b = mk('tree1', 137, 200, 46, 48); L = Layer()
    trunk(L, 23, 30, 46, 2, 3)
    for cx, cy, r in ((23, 9, 8), (12, 14, 8), (34, 14, 8), (8, 23, 6), (38, 23, 6), (23, 18, 10),
                      (15, 28, 7), (31, 28, 7), (23, 29, 6)):
        clump(L, cx, cy, r, G1)
    speckle(L, G1, 11)
    b.commit(L)
    # tree2
    b = mk('tree2', 185, 200, 48, 48); L = Layer()
    trunk(L, 24, 32, 46, 3, 3)
    for cx, cy, r in ((24, 8, 8), (11, 12, 8), (37, 12, 8), (8, 22, 7), (39, 22, 7), (24, 17, 10),
                      (14, 27, 8), (34, 27, 8), (24, 30, 8), (24, 24, 8)):
        clump(L, cx, cy, r, G2)
    speckle(L, G2, 8)
    for (x, y), c in list(L.items()):  # a few berries
        if c == G2[2] and hsh(x, y, 23) == 0:
            L[(x, y)] = C('#e0503c'); L[(x + 1, y)] = C('#e0503c') if (x + 1, y) in L else L[(x, y)]
    b.commit(L)

    # bare tree
    b = mk('bare', 235, 200, 44, 48); T = Layer()
    for x0, y0, x1, y1, w in ((22, 46, 22, 30, 5), (22, 30, 10, 17, 3), (22, 30, 34, 15, 3),
                              (22, 29, 21, 7, 3), (10, 17, 5, 7, 2), (10, 17, 14, 6, 2),
                              (34, 15, 40, 6, 2), (34, 15, 29, 5, 2), (22, 38, 12, 31, 2),
                              (22, 36, 33, 29, 2), (21, 14, 15, 10, 2), (21, 16, 28, 11, 2)):
        T.line(x0, y0, x1, y1, w, BARK[1])
    for y in range(40, 47):
        for x in range(22 - 3 - (y - 40) // 3, 22 + 4 + (y - 40) // 3): T.px(x, y, BARK[1])
    T.bevel(BARK)
    for (x, y) in list(T):
        if hsh(x, y, 6) == 0 and T[(x, y)] == BARK[1]: T[(x, y)] = BARK[2]
    b.commit(T)
    TW = C('#5e3a28')
    twigs = ((12, 31, 6, 26), (6, 26, 3, 23), (6, 26, 4, 28), (33, 29, 40, 25), (40, 25, 42, 22), (40, 25, 42, 27),
             (5, 7, 3, 3), (5, 7, 8, 3), (4, 11, 1, 9), (14, 6, 12, 2), (14, 6, 17, 2), (40, 6, 42, 2),
             (40, 6, 37, 2), (29, 5, 26, 1), (29, 5, 32, 1), (21, 7, 19, 3), (21, 7, 24, 3), (15, 10, 12, 8),
             (28, 11, 31, 8), (28, 11, 32, 12), (37, 12, 41, 12), (22, 20, 17, 19), (13, 22, 8, 20))
    for x0, y0, x1, y1 in twigs:
        L2 = Layer(); L2.line(x0, y0, x1, y1, 1, TW)
        for (x, y), c in L2.items(): b.set(x, y, c)

    # hedge square
    b = mk('hedge', 281, 200, 46, 46); L = Layer()
    shrub(L, 1, 1, 44, 44, 9); b.commit(L)

    # garbage bag
    b = mk('bag', 329, 200, 25, 26); L = Layer()
    bag(L, 1, 1, 23, 24, NAVY); b.commit(L, False)

    # pots
    def pot(name, x, flower, fl_hi, leaf):
        b = mk(name, x, 200, 21, 29); L = Layer()
        P = Layer()
        for y in range(19, 28):
            inset = 1 + (y - 22) // 3 if y > 22 else 0
            P.rect(4 + inset, y, 16 - inset, y, TERRA[1])
        P.rect(3, 19, 17, 22, TERRA[1])
        for (px_, py) in list(P):
            if px_ <= 4 + (1 if py > 22 else 0) or py == 19: P[(px_, py)] = TERRA[0]
            elif px_ >= 15 - (1 if py > 24 else 0) or py in (22, 27): P[(px_, py)] = TERRA[2]
        for xx in range(3, 18): P.px(xx, 19, TERRA[0]); P.px(xx, 22, TERRA[2])
        P.rect(5, 23, 7, 26, TERRA[1]); P.rect(5, 23, 5, 25, TERRA[0])
        # bush
        for cx, cy, r in ((10, 5, 5), (5, 10, 5), (15, 10, 5), (10, 12, 6), (4, 15, 3), (16, 15, 3)):
            clump(L, cx, cy, r, GH)
        speckle(L, GH, 9)
        for fx, fy in flower:
            L.rect(fx, fy, fx + 1, fy + 1, flower_col[0] if False else fl_hi[0])
            L.px(fx, fy, fl_hi[1]); L.px(fx + 1, fy + 1, fl_hi[2] if len(fl_hi) > 2 else fl_hi[0])
        L.update(P)
        b.commit(L)

    flower_col = None
    PINK = [C('#ff90b8'), C('#ffd0e0'), C('#d8407c')]
    pot('pot1', 356, [(5, 2), (11, 1), (3, 8), (15, 6), (8, 8), (12, 12), (6, 13), (16, 12)], PINK, None)
    YF = [C('#f8d020'), C('#fff0a0'), C('#d89010')]
    pot('pot2', 379, [(6, 2), (13, 3), (3, 9), (9, 7), (15, 9), (7, 13), (13, 13)], YF, None)

    # hydrant
    b = mk('hydrant', 402, 200, 16, 18); L = Layer()
    L.rect(2, 15, 13, 16, RED[1])  # base
    L.rect(4, 6, 11, 14, RED[1])  # body
    L.rect(5, 2, 10, 5, RED[1]); L.rect(4, 4, 11, 5, RED[1])  # bonnet
    L.rect(7, 1, 8, 1, RED[1])
    L.rect(1, 8, 3, 11, RED[1]); L.rect(12, 8, 14, 11, RED[1])
    L.bevel(RED)
    for x in range(4, 12): L.px(x, 6, RED[2]); L.px(x, 5, RED[0]) if x < 8 else None
    for x in range(3, 13): L.px(x, 14, RED[2])
    L.rect(2, 15, 13, 15, RED[0] if False else RED[1]); L.rect(2, 16, 13, 16, RED[2])
    L.rect(2, 15, 3, 15, RED[0])
    for y in range(8, 12): L.px(3, y, RED[2]); L.px(12, y, RED[0])  # nozzle shade/join
    L.px(1, 9, RED[0]); L.px(1, 8, RED[0]); L.px(14, 9, RED[2]); L.px(14, 10, RED[2]); L.px(14, 8, RED[1]); L.px(14, 11, RED[2])
    L.rect(1, 10, 1, 11, RED[2]); L.rect(1, 8, 1, 9, RED[0])
    L.rect(1, 9, 3, 9, RED[1]) if False else None
    L.rect(5, 7, 5, 13, RED[0])  # body highlight stripe
    L.px(5, 3, RED[0]); L.px(7, 2, RED[0]); L.px(6, 2, RED[0])
    L.px(9, 3, RED[2]); L.px(10, 4, RED[2])
    L.rect(7, 9, 8, 10, GREY[1]); L.px(7, 9, GREY[0]); L.px(8, 10, GREY[2])  # steel port
    b.commit(L)

    # trash can
    b = mk('can', 420, 200, 17, 16); L = Layer()
    L.rect(2, 4, 14, 14, G1[1])
    for y in range(4, 15):
        L.px(2, y, G1[2]); L.px(3, y, G1[2]); L.px(14, y, G1[0]); L.px(13, y, G1[0])
    for x in (5, 8, 11):
        for y in range(6, 14): L.px(x, y, G1[0]); L.px(x - 1, y, G1[2]) if x == 5 else None
    for x in (6, 9):
        for y in range(6, 14): L.px(x, y, G1[2])
    L.rect(4, 4, 12, 4, G1[0]); L.rect(2, 13, 14, 14, G1[0]); L.rect(2, 13, 4, 13, G1[1])
    L.rect(1, 1, 15, 3, G1[1])
    for x in range(1, 16): L.px(x, 1, C('#a8e890')); L.px(x, 2, G1[2]) if False else None; L.px(x, 3, G1[0])
    L.rect(1, 2, 2, 2, G1[2]); L.rect(3, 2, 14, 2, G1[2]); L.px(15, 2, G1[0])
    L.rect(6, 1, 10, 1, C('#a8e890'))
    L.rect(7, 4, 9, 4, G1[0])
    b.commit(L)

    # bollard
    b = mk('bollard', 439, 200, 10, 18); L = Layer()
    for y in range(1, 17):
        for x in range(1, 9):
            if (y == 1 and x in (1, 8)) or (y == 2 and False): continue
            band = ((y + x // 2) // 3) % 2
            if x == 1: c = YEL[0] if band == 0 else BLK[0]
            elif x >= 7: c = YEL[2] if band == 0 else BLK[2]
            else: c = YEL[1] if band == 0 else BLK[1]
            L.px(x, y, c)
    b.commit(L)

    # ---- row B ----
    b = mk('hedgeLong', 0, 262, 45, 14); L = Layer()
    shrub(L, 1, 1, 43, 12, 3); b.commit(L)

    def cone(b, ox):
        L = Layer()
        rows = {1: (6, 8), 2: (6, 8), 3: (5, 9), 4: (5, 9), 5: (4, 10), 6: (4, 10), 7: (3, 11), 8: (3, 11), 9: (2, 12)}
        for y, (a, c) in rows.items(): L.rect(ox + a, y, ox + c, y, ORG[1])
        L.rect(ox + 1, 10, ox + 13, 11, ORG[2])
        for y, (a, c) in rows.items():
            L.px(ox + a, y, ORG[0]); L.px(ox + a + 1, y, ORG[0]) if y > 5 else None
            L.px(ox + c, y, ORG[2])
            if y > 2: L.px(ox + c - 1, y, ORG[2]) if y > 6 else None
        # white reflective bands
        for y, (a, c) in ((4, (5, 9)), (5, (4, 10)), (7, (3, 11)), (8, (3, 11))):
            pass
        for y in (4, 5):
            a, c = rows[y]
            for x in range(a, c + 1): L.px(ox + x, y, WHITE)
            L.px(ox + c, y, WSH)
        for y in (7, 8):
            a, c = rows[y]
            for x in range(a, c + 1): L.px(ox + x, y, WHITE)
            L.px(ox + c, y, WSH); L.px(ox + c - 1, y, WSH)
        L.rect(ox + 1, 10, ox + 13, 10, ORG[1]); L.px(ox + 1, 10, ORG[0]); L.px(ox + 2, 10, ORG[0])
        L.rect(ox + 1, 11, ox + 13, 11, ORG[2])
        L.px(ox + 6, 1, ORG[0])
        b.commit(L)
    b = mk('cones', 47, 262, 30, 13); cone(b, 0); cone(b, 15)

    # barrier
    b = mk('barrier', 79, 262, 36, 18); L = Layer()
    for (lx0, lx1, step) in ((5, 7, -1), (27, 29, 1)):  # legs (splayed)
        for y in range(9, 17):
            off = (y - 9) // 3 * step * 1
            L.rect(lx0 + off - (0 if step < 0 else 0), y, lx1 + off, y, GREY[1])
            L.px(lx0 + off, y, GREY[0]); L.px(lx1 + off, y, GREY[2])
        L.rect(lx0 + 2 * step, 16, lx1 + 2 * step, 16, GREY[2])
    for (by0, by1) in ((1, 5), (7, 10)):
        for y in range(by0, by1 + 1):
            for x in range(1, 35):
                band = ((x - y) // 4) % 2
                if y == by0: c = YEL[0] if band == 0 else BLK[0]
                elif y == by1: c = YEL[2] if band == 0 else BLK[2]
                else: c = YEL[1] if band == 0 else BLK[1]
                L.px(x, y, c)
    b.commit(L)

    # bags pile
    b = mk('bags', 117, 262, 47, 15); L = Layer()
    PL = [C('#8a90a8'), C('#4a4e66'), C('#2c2f44')]
    bag(L, 28, 1, 18, 13, NAVY)
    bag(L, 1, 1, 16, 13, NAVY)
    bag(L, 10, 4, 16, 10, [C('#808a9c'), C('#3e4458'), C('#262a3a')])
    b.commit(L, False)

    # lamp head
    b = mk('lampHead', 166, 262, 50, 16); L = Layer()
    # arm
    L.rect(3, 3, 46, 5, GREY[1])
    for x in range(3, 47): L.px(x, 3, GREY[0]); L.px(x, 5, GREY[2])
    # mount block + pole stub
    L.rect(19, 1, 30, 8, GREY[1])
    for x in range(19, 31): L.px(x, 1, GREY[0]); L.px(x, 8, GREY[2])
    for y in range(1, 9): L.px(19, y, GREY[0]); L.px(30, y, GREY[2]); L.px(29, y, GREY[2])
    L.rect(22, 9, 27, 14, GREY[1])
    for y in range(9, 15): L.px(22, y, GREY[0]); L.px(27, y, GREY[2]); L.px(26, y, GREY[2])
    L.rect(21, 13, 28, 14, GREY[1]); L.rect(21, 13, 28, 13, GREY[0]); L.rect(21, 14, 28, 14, GREY[2])
    # shades
    for cx in (7, 42):
        L.rect(cx - 1, 6, cx, 7, GREY[2])
        rows = ((6, 3, 3), (7, 3, 3), (8, 2, 4), (9, 1, 5), (10, 0, 6), (11, 0, 6))
        S = {8: 2, 9: 1, 10: 0, 11: 0}
        for y, a, c in ((7, 2, 2), (8, 1, 3), (9, 0, 4), (10, -1, 5), (11, -2, 6), (12, -3, 7)):
            for x in range(cx + a - 1, cx + c + 0):
                L.px(x, y, NAVY[1] if False else GREY[1])
            L.px(cx + a - 1, y, GREY[0]); L.px(cx + c - 1, y, GREY[2])
        for x in range(cx - 4, cx + 5): L.px(x, 12, GREY[2])
        for x in range(cx - 3, cx + 4): L.px(x, 13, C('#fff2a0'))
        for x in (cx - 3, cx + 3): L.px(x, 13, C('#ffc840'))
    b.commit(L)
    return img, boxes


def verify(img, boxes):
    mask = Image.new('1', (W, H), 0)
    for (x, y, w, h) in boxes.values():
        for yy in range(y, y + h):
            for xx in range(x, x + w): mask.putpixel((xx, yy), 1)
    px = img.load(); mp = mask.load()
    for y in range(H):
        for x in range(W):
            a = px[x, y][3]
            assert a in (0, 255), (x, y)
            if a and not mp[x, y]: raise AssertionError('outside boxes %d,%d' % (x, y))
    for n, (x, y, w, h) in boxes.items():
        bottom = [px[xx, y + h - 1][3] for xx in range(x, x + w)]
        assert any(bottom), n + ' bottom row empty'
        cols = [any(px[xx, yy][3] for yy in range(y, y + h)) for xx in range(x, x + w)]
        print('%-9s width fill %2d/%2d  bottom opaque %2d' % (n, sum(cols), w, sum(1 for v in bottom if v)))


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(here, 'out'), exist_ok=True)
    img, boxes = build()
    verify(img, boxes)
    img.save(os.path.join(here, 'out', 'props_layer.png'))
