"""Recolor the black-and-white stylo dog frames to an all-white dog.

The body patches (saddle, tail) become white, the ear becomes a light warm
grey so it stays distinct, the dark nose tip is preserved, and an eye (absent
from the source art) is painted between the ear and the nose.

Usage: python3 -I tools/whiten_dog.py <src_dir> <dst_dir> [debug_sheet.png]
src_dir holds animation folders (iddle, walk, run, ...) of PNG frames.
"""
import math
import sys
from collections import deque
from pathlib import Path
from PIL import Image

PATCH_L = 110      # luminance below which an opaque pixel is part of a dark patch
MIN_PATCH = 40     # ignore tiny dark specks (nose tip, AA noise)
DILATE = 2         # grow patch masks to cover their anti-aliased rims
BODY_TINT = (1.0, 0.985, 0.955)
EAR_TINT = (1.0, 0.955, 0.90)
EYE_RGB = (34, 28, 26)
EYE_R = 2.6


def lum(p):
    return (p[0] + p[1] + p[2]) / 3


def components(im):
    px = im.load()
    W, H = im.size
    seen, out = set(), []
    for y in range(H):
        for x in range(W):
            if (x, y) in seen:
                continue
            p = px[x, y]
            if p[3] < 200 or lum(p) >= PATCH_L:
                continue
            q, pts = deque([(x, y)]), []
            seen.add((x, y))
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen:
                        p = px[nx, ny]
                        if p[3] >= 200 and lum(p) < PATCH_L:
                            seen.add((nx, ny))
                            q.append((nx, ny))
            if len(pts) >= MIN_PATCH:
                out.append(pts)
    return out


def centroid(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def dilate(pts, r):
    s = set()
    for x, y in pts:
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                s.add((x + dx, y + dy))
    return s


def body_v(L):
    return 238 + (L - 150) * 0.45 if L >= 150 else 238 - (150 - L) * 0.55


def patch_v(L):
    if L < 75:
        return 244 + (L - 48) * 0.4
    if L < 150:
        return 244
    return body_v(L)


def ear_v(L):
    if L < 75:
        return 196 + (L - 40) * 0.9
    if L < 150:  # rim: blend ear tone into body
        t = (L - 75) / 75
        return 227 * (1 - t) + 238 * t
    return body_v(L)


def find_nose(im, ear_c, ear_set, patch_set):
    """Snout tip: the opaque non-patch pixel farthest from the ear centroid,
    restricted to the head region (within 32px of the ear)."""
    px = im.load()
    W, H = im.size
    ex, ey = ear_c
    best, bd = None, -1
    for y in range(max(0, int(ey) - 32), min(H, int(ey) + 33)):
        for x in range(max(0, int(ex) - 32), min(W, int(ex) + 33)):
            if px[x, y][3] < 200 or (x, y) in ear_set or (x, y) in patch_set:
                continue
            d = math.hypot(x - ex, y - ey)
            if d <= 32 and d > bd:
                # must be reachable from the ear without crossing other patches:
                # cheap proxy — the straight segment stays opaque.
                ok = True
                for i in range(1, 12):
                    sx = int(round(ex + (x - ex) * i / 12))
                    sy = int(round(ey + (y - ey) * i / 12))
                    if px[sx, sy][3] < 128:
                        ok = False
                        break
                if ok:
                    best, bd = (x, y), d
    return best


def eye_pos(ear_c, nose, ear_set):
    ex, ey = ear_c
    nx, ny = nose
    d = math.hypot(nx - ex, ny - ey)
    ux, uy = (nx - ex) / d, (ny - ey) / d
    t = 0.0
    while t < d and (int(round(ex + ux * t)), int(round(ey + uy * t))) in ear_set:
        t += 0.5
    t += 1.5 + EYE_R
    return ex + ux * t, ey + uy * t


def paint_eye(im, c):
    px = im.load()
    cx, cy = c
    for y in range(int(cy - EYE_R - 2), int(cy + EYE_R + 3)):
        for x in range(int(cx - EYE_R - 2), int(cx + EYE_R + 3)):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            cov = max(0.0, min(1.0, EYE_R + 0.5 - math.hypot(x + 0.5 - cx, y + 0.5 - cy)))
            if cov > 0:
                px[x, y] = (int(r + (EYE_RGB[0] - r) * cov), int(g + (EYE_RGB[1] - g) * cov),
                            int(b + (EYE_RGB[2] - b) * cov), a)


def process(im, prev_ear_c):
    im = im.convert("RGBA")
    comps = components(im)
    if prev_ear_c is None:  # first frame: dog faces right, ear is the rightmost patch
        ear = max(comps, key=lambda c: centroid(c)[0])
    else:
        ear = min(comps, key=lambda c: math.dist(centroid(c), prev_ear_c))
    ear_c = centroid(ear)
    ear_set = dilate(ear, DILATE)
    patch_set = set()
    for c in comps:
        if c is not ear:
            patch_set |= dilate(c, DILATE)
    patch_set -= ear_set
    nose = find_nose(im, ear_c, ear_set, patch_set)

    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            L = lum((r, g, b))
            if (x, y) in ear_set:
                v, tint = ear_v(L), EAR_TINT
            elif (x, y) in patch_set:
                v, tint = patch_v(L), BODY_TINT
            else:
                v, tint = body_v(L), BODY_TINT
            v = max(0, min(255, v))
            px[x, y] = (int(v * tint[0]), int(v * tint[1]), int(v * tint[2]), a)
    eye = eye_pos(ear_c, nose, ear_set) if nose else None
    if eye:
        paint_eye(im, eye)
    return im, ear_c, nose, eye


def main(src, dst, debug=None):
    src, dst = Path(src), Path(dst)
    thumbs = []
    for anim in sorted(p for p in src.iterdir() if p.is_dir() and p.name != "previewgif"):
        out = dst / anim.name
        out.mkdir(parents=True, exist_ok=True)
        ear_c = None
        frames = sorted(anim.glob("*.png"))
        for i, f in enumerate(frames):
            im, ear_c, nose, eye = process(Image.open(f), ear_c)
            im.save(out / f.name)
            if debug and i % 3 == 0:
                thumbs.append(im)
        print(anim.name, len(frames))
    if debug:
        cols = 8
        sheet = Image.new("RGBA", (256 * cols, 172 * ((len(thumbs) + cols - 1) // cols)), (96, 110, 130, 255))
        for i, t in enumerate(thumbs):
            sheet.alpha_composite(t, ((i % cols) * 256, (i // cols) * 172))
        sheet.save(debug)


if __name__ == "__main__":
    main(*sys.argv[1:4])
