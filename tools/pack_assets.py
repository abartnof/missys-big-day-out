"""Copy the non-dog assets the game uses into src/assets/ and emit src/assets/props.js
(alpha-trimmed rects of props inside general.png). Re-runnable.
Usage: python3 -I tools/pack_assets.py
"""
import json, shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets_raw" / "dog_game_items"
OUT = ROOT / "src" / "assets"
(OUT / "items").mkdir(parents=True, exist_ok=True)

for n in "dry_dog_food meat1 bacon sausage_p fish salmon rubber_duck milk_chocolate red_grape green_grape wine_red coffee_bag".split():
    shutil.copy(RAW / "Pixel_Mart" / (n + ".png"), OUT / "items" / (n + ".png"))
shutil.copy(RAW / "city" / "general.png", OUT / "general.png")
shutil.copy(RAW / "city" / "bgs1.png", OUT / "bgs1.png")
# far skyline: keep only the pale city silhouette of bgs2 (the sky itself is drawn as a gradient in game.js)
bg2 = Image.open(RAW / "city" / "bgs2.png").convert("RGBA")
sky = bg2.crop((0, 250, 640, 360)); spx = sky.load()
for yy in range(sky.height):
    for xx in range(sky.width):
        if spx[xx, yy][:3] == (255, 255, 255) or spx[xx, yy][:3] == (254, 254, 255) or (yy < 6 and spx[xx, yy][:3] != (222, 236, 255) and spx[xx, yy][:3] != (202, 224, 255)):
            spx[xx, yy] = (255, 255, 255, 0)
sky.save(OUT / "skyline_far.png")
# mid towers: only the tower rows of bgs1 plus the solid base below (hidden behind buildings)
shutil.copy(RAW / "city" / "bgs1.png", OUT / "bgs1.png")

# parrot variants: recolor the brown bird (exact palette swap, done at build time)
SRCB = {(144, 82, 18): 0, (107, 56, 3): 1, (174, 109, 42): 2, (67, 37, 6): 3, (203, 159, 66): 4, (166, 128, 47): 5, (222, 173, 72): 6}
PARROTS = {
    "green": [(60, 170, 70), (38, 120, 50), (110, 210, 100), (20, 70, 35), (240, 200, 60), (225, 55, 50), (255, 225, 100)],
    "blue": [(40, 100, 200), (25, 65, 150), (90, 150, 240), (15, 35, 90), (245, 205, 70), (240, 200, 60), (255, 228, 110)],
    "red": [(205, 50, 50), (150, 30, 40), (240, 100, 80), (80, 15, 25), (250, 210, 70), (60, 120, 220), (255, 232, 130)],
    "grey": None,
}
bird = Image.open(RAW / "FreeAnimalPack" / "BirdFly.png").convert("RGBA")
for name, pal in PARROTS.items():
    im = bird.copy(); px = im.load()
    if pal:
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a and (r, g, b) in SRCB:
                    px[x, y] = pal[SRCB[(r, g, b)]] + (a,)
    im.save(OUT / ("bird_%s.png" % name))
shutil.copy(RAW / "minifolks/MinifolksVillagers/Outline/MiniNobleWoman.png", OUT / "woman.png")
for src, dst in (("Jumping.png", "critter_rabbit.png"), ("JumpCattt.png", "critter_cat.png"), ("FrogIdle.png", "critter_frog.png")):
    shutil.copy(RAW / "FreeAnimalPack" / src, OUT / dst)
# The frog is drawn at 1x but is chunkier than Missy, so shrink it to about 2/3 inside each 32x32 frame,
# feet on the same baseline. Hard alpha keeps the edges crisp like the rest of the pixel art.
frog = Image.open(RAW / "FreeAnimalPack" / "FrogIdle.png").convert("RGBA")
small = Image.new("RGBA", frog.size)
for i in range(frog.width // 32):
    cell = frog.crop((i * 32, 0, i * 32 + 32, 32))
    x0, y0, x1, y1 = cell.getbbox()
    body = cell.crop((x0, y0, x1, y1))
    body = body.resize((max(1, round(body.width * 2 / 3)), max(1, round(body.height * 2 / 3))), Image.LANCZOS)
    body.putalpha(body.getchannel("A").point(lambda a: 255 if a >= 110 else 0))
    small.alpha_composite(body, (i * 32 + 16 - body.width // 2, y1 - body.height))
small.save(OUT / "critter_frog.png")
shutil.copy(RAW / "toilet_files" / "toilet-sheet.png", OUT / "toilet.png")
di = Image.open(RAW / "DogMegaPackFree" / "DogItems.png").convert("RGBA")
bones = Image.new("RGBA", (46, 15))
bones.paste(di.crop((5, 8, 28, 23)), (0, 0)); bones.paste(di.crop((37, 8, 60, 23)), (23, 0))
bones.save(OUT / "bones.png")

g = Image.open(RAW / "city" / "general.png").convert("RGBA")
loose = {  # name: (x, y, w, h) loose rect, trimmed to alpha below
    "hydrant": (0, 62, 16, 18), "bag": (224, 98, 28, 30), "can": (223, 144, 20, 17),
    "cones": (224, 128, 32, 16), "bollard": (244, 142, 10, 19), "barrier": (262, 142, 36, 19),
    "crateS": (143, 128, 18, 32), "crateL": (160, 100, 32, 61), "crateM": (192, 110, 32, 51),
    "dumpster": (256, 112, 48, 32), "bags": (257, 96, 52, 16),
    "tree1": (257, 48, 47, 48), "tree2": (304, 48, 48, 48), "bare": (353, 48, 47, 48),
    "hedge": (193, 49, 46, 46), "hedgeLong": (194, 33, 45, 14),
    "pot1": (68, 160, 24, 32), "pot2": (100, 160, 24, 32), "lampHead": (14, 95, 52, 16),
}
props = {}
for k, (x, y, w, h) in loose.items():
    bb = g.crop((x, y, x + w, y + h)).getchannel("A").point(lambda v: 255 if v > 0 else 0).getbbox()
    props[k] = [x + bb[0], y + bb[1], bb[2] - bb[0], bb[3] - bb[1]]
(OUT / "props.js").write_text("const PROPS = " + json.dumps(props) + ";\n")
print(props)
