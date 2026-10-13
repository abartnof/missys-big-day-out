"""Build missys-big-day-out.html, the game as one self-contained page (JS inlined,
images as base64 data URIs, zero external requests) from the sources in src/.
GitHub Pages serves it, and a downloaded copy plays by double-clicking.

Usage: python3 -I tools/build_single.py
"""
import base64, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
html = (SRC / "index.html").read_text()

assets = {}
for p in sorted((SRC / "assets").rglob("*.png")):
    assets[p.relative_to(SRC).as_posix()] = "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()

def inline(m):
    src = m.group(1)
    code = (SRC / src).read_text().replace("</script", "<\\/script")
    return "<script>\n" + code + "\n</script>"

html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
head_js = "<script>window.__ASSETS=" + json.dumps(assets) + ";</script>\n"
html = html.replace("<script>", head_js + "<script>", 1)
out = ROOT / "missys-big-day-out.html"
out.write_text(html)
print("wrote", out, len(html) // 1024, "KB")
