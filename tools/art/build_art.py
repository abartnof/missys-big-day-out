"""Draw the game's original art and install it into src/assets/.

Runs the three drawing scripts in this folder, then stacks their layers into
general.png (building modules in the top band, street props below) and writes
props.js with each prop's rectangle in that sheet.

Usage: python3 -I tools/art/build_art.py
"""
import json, subprocess, sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / "src" / "assets"

for script in ("animals.py", "props.py", "buildings.py"):
    subprocess.run([sys.executable, "-I", str(HERE / script)], check=True, cwd=ROOT)

PROPS = {  # x, y, w, h in general.png; must match the boxes props.py draws into
    "crateL": [0, 200, 32, 59], "crateM": [34, 200, 32, 48], "crateS": [68, 200, 17, 32],
    "dumpster": [87, 200, 48, 32], "tree1": [137, 200, 46, 48], "tree2": [185, 200, 48, 48],
    "bare": [235, 200, 44, 48], "hedge": [281, 200, 46, 46], "bag": [329, 200, 25, 26],
    "pot1": [356, 200, 21, 29], "pot2": [379, 200, 21, 29], "hydrant": [402, 200, 16, 18],
    "can": [420, 200, 17, 16], "bollard": [439, 200, 10, 18],
    "hedgeLong": [0, 262, 45, 14], "cones": [47, 262, 30, 13], "barrier": [79, 262, 36, 18],
    "bags": [117, 262, 47, 15], "lampHead": [166, 262, 50, 16],
}
sheet = Image.new("RGBA", (496, 280))
for layer in ("buildings_layer.png", "props_layer.png"):
    sheet.alpha_composite(Image.open(HERE / "out" / layer).convert("RGBA"))
sheet.save(OUT / "general.png")
(OUT / "props.js").write_text("const PROPS = " + json.dumps(PROPS) + ";\n")
print("wrote general.png, props.js")
