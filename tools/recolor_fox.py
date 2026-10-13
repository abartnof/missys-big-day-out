"""Recolor Elthen's fox sprite sheet into a cream cocker spaniel.

The orange/white/grey fur becomes shades of cream; the outline becomes a warm
dark brown; interior dark pixels (eyes, nose, mouth) stay near-black.

Usage: python3 -I tools/recolor_fox.py <fox_sheet.png> <out.png>
"""
import sys
from PIL import Image

FUR = {
    (157, 80, 33): (205, 168, 118),   # dark orange  -> cream shadow
    (214, 121, 65): (234, 205, 156),  # orange       -> cream
    (255, 255, 255): (250, 235, 204), # white        -> light cream
    (184, 184, 184): (222, 194, 148), # grey (white shading) -> mid cream
    (79, 79, 78): (176, 140, 98),     # leg tips     -> deep cream
    (59, 59, 57): (160, 124, 84),
}
OUTLINE = (47, 47, 46)
OUTLINE_EDGE = (72, 50, 38)   # silhouette outline: warm dark brown
FEATURE = (36, 26, 22)        # interior dark pixels: eyes, nose, mouth


def main(src, dst):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    W, H = im.size
    out = im.copy()
    opx = out.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            c = (r, g, b)
            if c in FUR:
                opx[x, y] = FUR[c] + (a,)
            elif c == OUTLINE:
                edge = any(
                    not (0 <= nx < W and 0 <= ny < H) or px[nx, ny][3] == 0
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
                )
                opx[x, y] = (OUTLINE_EDGE if edge else FEATURE) + (a,)
    out.save(dst)


if __name__ == "__main__":
    main(*sys.argv[1:3])
