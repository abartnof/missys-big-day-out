"""Recolor Elthen's fox sprite sheet into Missy, a white dog.

The orange/white/grey fur becomes shades of white; the outline becomes a warm
dark brown; interior dark pixels (eyes, nose, mouth) stay near-black.

Usage: python3 -I tools/recolor_fox.py <fox_sheet.png> <out.png>
"""
import sys
from PIL import Image

FUR = {
    (157, 80, 33): (208, 206, 212),   # dark orange  -> fur shadow
    (214, 121, 65): (238, 237, 240),  # orange       -> white fur
    (255, 255, 255): (255, 255, 255), # white        -> highlight
    (184, 184, 184): (224, 223, 228), # grey (white shading) -> mid white
    (79, 79, 78): (186, 184, 192),    # leg tips     -> deep shadow
    (59, 59, 57): (170, 168, 178),
}
OUTLINE = (47, 47, 46)
OUTLINE_EDGE = (62, 58, 66)   # silhouette outline: soft charcoal
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
