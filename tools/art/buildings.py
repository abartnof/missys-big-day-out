#!/usr/bin/env python3
"""Original building-module art + skylines. Run: python3 -I tools/art/buildings.py"""
import os, random
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

def C(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5)) + (255,)

# stone facade
ST_OUT = C('#4a4a58'); ST_D = C('#7a7a88'); ST = C('#9a9aa6'); ST_L = C('#b4b4be'); ST_HI = C('#cdcdd4')
GLASS = C('#5a86a6'); GLASS_L = C('#8fb6cf'); GLASS_D = C('#2c4660'); FRAME = C('#e4e0d2'); FRAME_D = C('#a8a392')
DARK = C('#20242e'); DARK2 = C('#2e3442')
RED = C('#b03a34'); RED_D = C('#7a2424'); RED_L = C('#d05a4c')
WOOD = C('#8a6038'); WOOD_D = C('#5e3f24'); WOOD_L = C('#a87a48')
CREAM = C('#e6dcb8'); YEL = C('#e8c860')

def rect(d, x0, y0, x1, y1, c):  # inclusive
    d.rectangle([x0, y0, x1, y1], fill=c)

def px(d, x, y, c): d.point((x, y), fill=c)

def stone(d, x0, y0, w, h, seed=0):
    """Ashlar facade: 8px courses, blocks 16 wide, offset alternate."""
    rect(d, x0, y0, x0+w-1, y0+h-1, ST)
    for cy in range(0, h, 8):
        rect(d, x0, y0+cy, x0+w-1, y0+cy, ST_D)          # joint
        off = 0 if (cy // 8 + seed) % 2 == 0 else 8
        for bx in range(-16, w + 16, 16):
            xx = bx + off
            if 0 <= xx < w: rect(d, x0+xx, y0+cy, x0+xx, min(y0+cy+7, y0+h-1), ST_D)
            if 0 <= xx+1 < w: px(d, x0+xx+1, y0+cy+1, ST_L)
            if 0 <= xx+2 < w: px(d, x0+xx+2, y0+cy+1, ST_L)

def cornice(d, x0, y0, w):
    """4px ledge at top of every module (same in all modules)."""
    rect(d, x0, y0, x0+w-1, y0, ST_HI)
    rect(d, x0, y0+1, x0+w-1, y0+2, ST_L)
    rect(d, x0, y0+3, x0+w-1, y0+3, ST_D)

def frame_module(d, x0, y0, w, h):
    """1px dark outline at left/right/bottom; top left to the cornice."""
    rect(d, x0, y0, x0, y0+h-1, ST_OUT)
    rect(d, x0+w-1, y0, x0+w-1, y0+h-1, ST_OUT)
    rect(d, x0, y0+h-1, x0+w-1, y0+h-1, ST_OUT)
    rect(d, x0, y0, x0+w-1, y0, ST_OUT)

def sill(d, x0, y, w):
    rect(d, x0, y, x0+w-1, y, ST_HI)
    rect(d, x0, y+1, x0+w-1, y+1, ST_D)
    rect(d, x0+1, y+2, x0+w-2, y+2, ST_OUT)

def window_base(d, x0, y0, kind):
    stone(d, x0, y0, 32, 32)
    cornice(d, x0, y0, 32)
    wx, wy, ww, wh = x0+10, y0+8, 12, 17
    # recessed opening
    rect(d, wx-1, wy-1, wx+ww, wy+wh, ST_OUT)
    inner = (wx, wy, wx+ww-1, wy+wh-1)
    if kind == 'panes':
        rect(d, *inner, FRAME)
        rect(d, wx+1, wy+1, wx+ww-2, wy+wh-2, GLASS)
        rect(d, wx+ww//2-1, wy+1, wx+ww//2, wy+wh-2, FRAME)
        rect(d, wx+1, wy+wh//2-1, wx+ww-2, wy+wh//2, FRAME)
        for ax, ay in ((wx+2, wy+2), (wx+ww//2+1, wy+2), (wx+2, wy+wh//2+1), (wx+ww//2+1, wy+wh//2+1)):
            px(d, ax, ay, GLASS_L); px(d, ax+1, ay, GLASS_L); px(d, ax, ay+1, GLASS_L)
    elif kind == 'blinds':
        rect(d, *inner, FRAME)
        rect(d, wx+1, wy+1, wx+ww-2, wy+wh-2, GLASS)
        for yy in range(wy+1, wy+10, 2):
            rect(d, wx+1, yy, wx+ww-2, yy, CREAM)
            rect(d, wx+1, yy+1, wx+ww-2, yy+1, FRAME_D)
        rect(d, wx+ww//2, wy+10, wx+ww//2, wy+wh-2, FRAME)
        px(d, wx+2, wy+12, GLASS_L); px(d, wx+3, wy+12, GLASS_L)
    elif kind == 'dark':
        rect(d, *inner, FRAME_D)
        rect(d, wx+1, wy+1, wx+ww-2, wy+wh-2, DARK)
        rect(d, wx+ww//2-1, wy+1, wx+ww//2, wy+wh-2, FRAME_D)
        rect(d, wx+1, wy+wh//2-1, wx+ww-2, wy+wh//2, FRAME_D)
        px(d, wx+2, wy+2, DARK2); px(d, wx+3, wy+2, DARK2); px(d, wx+2, wy+3, DARK2)
        px(d, wx+8, wy+11, DARK2); px(d, wx+9, wy+11, DARK2)
    elif kind == 'curtain':
        rect(d, *inner, FRAME)
        rect(d, wx+1, wy+1, wx+ww-2, wy+wh-2, YEL)
        for xx in (wx+1, wx+2, wx+ww-3, wx+ww-2):
            rect(d, xx, wy+1, xx, wy+wh-2, RED if xx in (wx+1, wx+ww-2) else RED_L)
        rect(d, wx+1, wy+1, wx+ww-2, wy+2, RED_D)       # pelmet
        rect(d, wx+5, wy+4, wx+6, wy+wh-2, C('#f0dc90'))
        rect(d, wx+1, wy+wh-4, wx+ww-2, wy+wh-4, FRAME)
    elif kind == 'boarded':
        rect(d, *inner, DARK)
        for yy in (wy+1, wy+7, wy+12):
            rect(d, wx, yy, wx+ww-1, yy+3, WOOD)
            rect(d, wx, yy, wx+ww-1, yy, WOOD_L)
            rect(d, wx, yy+3, wx+ww-1, yy+3, WOOD_D)
            px(d, wx+1, yy+1, WOOD_D); px(d, wx+ww-2, yy+1, WOOD_D)
    sill(d, wx-2, wy+wh+1, ww+4)
    frame_module(d, x0, y0, 32, 32)

def shop_base(d, x0, w, sign=None):
    h = 48
    stone(d, x0, 0, w, 12, seed=1)
    cornice(d, x0, 0, w)
    # lower facade: darker plinth stone
    rect(d, x0, 12, x0+w-1, h-1, ST)
    # signboard band
    rect(d, x0, 4, x0+w-1, 11, ST_D)
    rect(d, x0, 4, x0+w-1, 4, ST_OUT)
    rect(d, x0, 11, x0+w-1, 11, ST_OUT)
    return h

def finish_shop(d, x0, w):
    # ground plinth + outline
    rect(d, x0, 44, x0+w-1, 46, ST_D)
    rect(d, x0, 44, x0+w-1, 44, ST_L)
    frame_module(d, x0, 0, w, 48)

def shop_shutter(d, x0, w):
    shop_base(d, x0, w)
    # sign: plain painted board
    rect(d, x0+4, 6, x0+w-5, 9, CREAM)
    for xx in range(x0+6, x0+w-7, 4): rect(d, xx, 7, xx+1, 8, RED_D)
    # shutter housing + shutter
    rect(d, x0+3, 13, x0+w-4, 16, ST_OUT)
    rect(d, x0+3, 13, x0+w-4, 13, DARK2)
    rect(d, x0+4, 17, x0+w-5, 43, C('#7c8794'))
    for yy in range(18, 43, 3):
        rect(d, x0+4, yy, x0+w-5, yy, C('#a2adb8'))
        rect(d, x0+4, yy+1, x0+w-5, yy+1, C('#6a7580'))
    rect(d, x0+4, 17, x0+w-5, 17, ST_OUT)
    rect(d, x0+4, 17, x0+4, 43, ST_OUT); rect(d, x0+w-5, 17, x0+w-5, 43, ST_OUT)
    rect(d, x0+4, 42, x0+w-5, 43, DARK2)                   # bottom bar
    rect(d, x0+w//2-2, 40, x0+w//2+1, 41, YEL)             # handle
    # graffiti tag, small
    for i, (a, b) in enumerate(((10, 28), (11, 27), (12, 26), (13, 27), (14, 28), (16, 26), (17, 27), (18, 28))):
        px(d, x0+a+8, b, C('#d86050') if i % 2 else C('#e8c860'))
    finish_shop(d, x0, w)

def shop_door(d, x0, w):
    shop_base(d, x0, w)
    rect(d, x0+4, 6, x0+w-5, 9, DARK2)
    for xx in range(x0+6, x0+w-6, 3): px(d, xx, 7, YEL)
    # fanlight
    rect(d, x0+7, 13, x0+w-8, 17, ST_OUT)
    rect(d, x0+8, 14, x0+w-9, 16, GLASS)
    px(d, x0+9, 14, GLASS_L)
    # door
    rect(d, x0+7, 18, x0+w-8, 43, ST_OUT)
    rect(d, x0+8, 18, x0+w-9, 43, RED)
    rect(d, x0+8, 18, x0+8, 43, RED_L)
    rect(d, x0+w-9, 18, x0+w-9, 43, RED_D)
    for (a, b, c2, e) in ((11, 21, 14, 28), (17, 21, 20, 28), (11, 32, 14, 40), (17, 32, 20, 40)):
        if x0+c2 < x0+w-9:
            rect(d, x0+a, b, x0+c2, e, RED_D); rect(d, x0+a+1, b+1, x0+c2-1, e-1, RED)
    px(d, x0+w-12, 33, YEL); px(d, x0+w-12, 34, YEL)       # knob
    # step
    rect(d, x0+4, 44, x0+w-5, 45, ST_HI)
    rect(d, x0+4, 46, x0+w-5, 46, ST_D)
    finish_shop(d, x0, w)
    rect(d, x0+4, 44, x0+w-5, 44, ST_HI); rect(d, x0+4, 45, x0+w-5, 45, ST_L)

def shop_window(d, x0, w):
    shop_base(d, x0, w)
    rect(d, x0+4, 6, x0+w-5, 9, C('#3c6a54'))
    for xx in range(x0+6, x0+w-7, 3): px(d, xx, 7, CREAM); px(d, xx+1, 8, CREAM)
    # awning, striped
    for i, xx in enumerate(range(x0+2, x0+w-2, 4)):
        col = RED if i % 2 == 0 else CREAM
        rect(d, xx, 13, min(xx+3, x0+w-3), 19, col)
    rect(d, x0+2, 20, x0+w-3, 20, RED_D)
    for i, xx in enumerate(range(x0+2, x0+w-2, 4)):        # scallops
        px(d, xx+1, 21, RED if i % 2 == 0 else CREAM); px(d, xx+2, 21, RED if i % 2 == 0 else CREAM)
    rect(d, x0+2, 13, x0+w-3, 13, RED_D)
    # glass
    rect(d, x0+4, 23, x0+w-5, 42, ST_OUT)
    rect(d, x0+5, 24, x0+w-6, 41, GLASS)
    for k in range(4):
        px(d, x0+7+k*2, 25+k*2, GLASS_L); px(d, x0+8+k*2, 25+k*2, GLASS_L)
    # goods on shelf
    rect(d, x0+5, 38, x0+w-6, 38, WOOD)
    for i, cc in enumerate((RED_L, YEL, C('#70b070'), YEL)):
        rect(d, x0+7+i*5, 34, x0+9+i*5, 37, cc)
    rect(d, x0+5, 39, x0+w-6, 41, WOOD_D)
    finish_shop(d, x0, w)

def shop_poster(d, x0, w):
    shop_base(d, x0, w)
    rect(d, x0+4, 6, x0+w-5, 9, C('#3a4e78'))
    for xx in range(x0+7, x0+w-8, 4): rect(d, xx, 7, xx+1, 8, CREAM)
    # blank wall, lower part brick-ish plaster
    rect(d, x0, 12, x0+w-1, 43, C('#8c8c98'))
    for cy in range(12, 44, 8):
        rect(d, x0, cy, x0+w-1, cy, ST_D)
    # board
    rect(d, x0+5, 16, x0+w-6, 38, WOOD_D)
    rect(d, x0+6, 17, x0+w-7, 37, C('#c8a878'))
    # notices
    rect(d, x0+8, 19, x0+15, 27, CREAM); rect(d, x0+9, 21, x0+14, 21, DARK2); rect(d, x0+9, 23, x0+13, 23, DARK2); rect(d, x0+9, 25, x0+14, 25, DARK2)
    px(d, x0+11, 19, RED)
    rect(d, x0+17, 20, x0+23, 31, C('#e8c860')); rect(d, x0+18, 22, x0+22, 25, RED_D); rect(d, x0+18, 27, x0+22, 27, DARK2); rect(d, x0+18, 29, x0+21, 29, DARK2)
    rect(d, x0+9, 30, x0+14, 35, C('#9fc8d8')); rect(d, x0+10, 32, x0+13, 32, DARK2); rect(d, x0+10, 34, x0+12, 34, DARK2)
    rect(d, x0+17, 33, x0+23, 35, CREAM)
    for (a, b) in ((11, 19), (20, 20), (11, 30)): px(d, x0+a, b, RED_D)
    finish_shop(d, x0, w)

# ---- bricks (16x16 period) ----
def brick_tile(base, mortar, hi, lo, speck):
    im = Image.new('RGBA', (48, 48), mortar)
    d = ImageDraw.Draw(im)
    rnd = random.Random(sum(base[:3]))
    for row in range(6):
        y = row * 8
        off = 0 if row % 2 == 0 else 8
        for bx in range(-16, 64, 16):
            x = bx + off
            # block spans x+1..x+15 minus mortar col at x
            for xx in range(x+1, x+16):
                for yy in range(y+1, y+8):
                    if 0 <= xx < 48:
                        px(d, xx, yy, base)
            for xx in range(x+1, x+16):
                if 0 <= xx < 48:
                    px(d, xx, y+1, hi)
                    px(d, xx, y+7, lo)
    # period-16 speckle so the 48 and 32 windows both tile
    pat = {}
    for _ in range(14):
        pat[(rnd.randrange(16), rnd.randrange(16))] = rnd.choice(speck)
    for (sx, sy), c in pat.items():
        for ox in range(0, 48, 16):
            for oy in range(0, 48, 16):
                x, y = sx+ox, sy+oy
                if im.getpixel((x, y)) in (base, hi, lo): px(d, x, y, c)
    return im

def build_layer():
    im = Image.new('RGBA', (496, 280), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for x, k in zip((64, 96, 128, 160, 192), ('panes', 'blinds', 'dark', 'curtain', 'boarded')):
        window_base(d, x, 0, k)
    shop_shutter(d, 256, 48); shop_door(d, 304, 32); shop_window(d, 336, 32); shop_poster(d, 368, 32)
    specs = [
        (C('#a8483c'), C('#6e3a34'), C('#c4685a'), C('#8e3a30'), [C('#963f35'), C('#b85a4c')]),
        (C('#5c7488'), C('#34444e'), C('#7c94a6'), C('#465c6c'), [C('#506a7e'), C('#6e8698')]),
        (C('#4c8060'), C('#2c4a38'), C('#6aa07c'), C('#3c6a4c'), [C('#447858'), C('#5c9470')]),
        (C('#8a6444'), C('#4e382a'), C('#a8825e'), C('#6e4e36'), [C('#7c5a3c'), C('#98724e')]),
    ]
    for i, s in enumerate(specs):
        im.paste(brick_tile(*s), (448, i * 48))
    return im

# ---- skylines ----
def skyline(w, h, plan, rows_fn):
    pass

def tower_row(rnd, total, wmin, wmax):
    """widths that sum exactly to total (periodic)."""
    ws = []; left = total
    while left > 0:
        k = rnd.randint(wmin, wmax)
        if left - k < wmin: k = left
        ws.append(k); left -= k
    return ws

def build_mid():
    W, H = 640, 360
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    FILL = (113, 173, 187, 255)
    tones = [((140, 196, 208, 255), (126, 184, 198, 255)), ((152, 205, 214, 255), (136, 192, 206, 255)),
             ((131, 188, 203, 255), (120, 179, 194, 255))]
    LIT = (206, 232, 214, 255)
    rnd = random.Random(7)
    ws = tower_row(rnd, W, 20, 44)
    x = 0
    for i, bw in enumerate(ws):
        top = rnd.choice([70, 72, 78, 84, 90, 96, 74, 80, 100])
        light, dark = tones[rnd.randrange(3)]
        rect(d, x, top, x+bw-1, 119, light)
        rect(d, x+bw-3, top, x+bw-1, 119, dark)            # shaded side
        rect(d, x, top, x+bw-1, top, tuple(min(255, c+14) for c in light[:3]) + (255,))
        # roof details
        kind = rnd.randrange(4)
        if kind == 0 and bw > 12:
            ax = x + bw//2; rect(d, ax, top-8, ax, top-1, light)
        elif kind == 1 and bw > 14:
            rect(d, x+3, top-3, x+bw-8, top-1, dark)
        elif kind == 2 and bw > 16:
            rect(d, x+4, top-5, x+9, top-1, light); rect(d, x+4, top-5, x+9, top-5, dark)
        # windows grid, mostly dim, a few lit
        for wy in range(top+4, 112, 6):
            for wx in range(x+3, x+bw-5, 5):
                if rnd.random() < 0.55:
                    px(d, wx, wy, LIT if rnd.random() < 0.3 else dark)
        x += bw
    rect(d, 0, 119, W-1, H-1, FILL)
    # tint tower tops sitting at row 118 -> keep a hairline of separation
    return im

def build_far():
    W, H = 640, 110
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cols = [(204, 220, 232, 255), (196, 214, 228, 255), (210, 226, 236, 255)]
    rnd = random.Random(31)
    ws = tower_row(rnd, W, 14, 40)
    x = 0
    for bw in ws:
        top = rnd.choice([44, 54, 62, 70, 78, 86])
        c = rnd.choice(cols)
        rect(d, x, top, x+bw-1, H-1, c)
        if rnd.random() < 0.4 and bw > 12:
            rect(d, x+bw//2-1, top-6, x+bw//2, top-1, c)
        elif rnd.random() < 0.3 and bw > 16:
            rect(d, x+3, top-4, x+bw-5, top-1, c)
        # faint window columns
        wc = tuple(max(0, v-10) for v in c[:3]) + (255,)
        for wx in range(x+3, x+bw-3, 6):
            for wy in range(top+5, H-4, 9):
                rect(d, wx, wy, wx+1, wy+2, wc)
        x += bw
    return im

if __name__ == '__main__':
    build_layer().save(os.path.join(OUT, 'buildings_layer.png'))
    build_mid().save(os.path.join(ROOT, 'src/assets/bgs1.png'))
    build_far().save(os.path.join(ROOT, 'src/assets/skyline_far.png'))
    print('ok')
