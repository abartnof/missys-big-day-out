"""Copy the third-party assets the game uses (food icons, the owner and window neighbours, the toilet) into
src/assets/. The street, buildings, skylines, parrots, critters and bones are original
art drawn by tools/art/build_art.py; Missy comes from tools/recolor_fox.py. Re-runnable.
Usage: python3 -I tools/pack_assets.py
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets_raw" / "dog_game_items"
OUT = ROOT / "src" / "assets"
(OUT / "items").mkdir(parents=True, exist_ok=True)

for n in "dry_dog_food meat1 bacon sausage_p fish salmon rubber_duck milk_chocolate red_grape green_grape wine_red coffee_bag".split():
    shutil.copy(RAW / "Pixel_Mart" / (n + ".png"), OUT / "items" / (n + ".png"))
shutil.copy(RAW / "minifolks/MinifolksVillagers/Outline/MiniNobleWoman.png", OUT / "woman.png")
shutil.copy(RAW / "toilet_files" / "toilet-sheet.png", OUT / "toilet.png")
# the other MiniFolks villagers lean out of windows along the street (the owner is MiniNobleWoman)
(OUT / "villagers").mkdir(exist_ok=True)
VIL = RAW / "minifolks/MinifolksVillagers/Outline"
for f in sorted(VIL.glob("Mini*.png")):
    if f.stem != "MiniNobleWoman":
        shutil.copy(f, OUT / "villagers" / (f.stem[4:].lower() + ".png"))
