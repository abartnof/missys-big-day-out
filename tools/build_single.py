"""Build missys-big-day-out.html (and an identical index.html), the game as one self-contained page (JS inlined,
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
# fonts referenced from CSS are embedded too, so the page still makes no network requests
for f in sorted((SRC / "assets").glob("*.ttf")):
    html = html.replace('url("assets/' + f.name + '")', 'url("data:font/ttf;base64,' + base64.b64encode(f.read_bytes()).decode() + '")')
head_js = "<script>window.__ASSETS=" + json.dumps(assets) + ";</script>\n"
html = html.replace("<script>", head_js + "<script>", 1)
# The same page twice: missys-big-day-out.html is the one to download, and index.html is what
# GitHub Pages serves at the site's root. (A redirect page there kept Safari's audio silent.)
# Build id = hash of the page; version.json lets an already-open copy notice a newer deploy and reload.
import hashlib
build = hashlib.sha256(html.encode()).hexdigest()[:12]
html = html.replace("<script>", '<script>window.BUILD_ID = "' + build + '";</script>\n<script>', 1)
for name in ("missys-big-day-out.html", "index.html"):
    (ROOT / name).write_text(html)
(ROOT / "version.json").write_text(json.dumps({"build": build}) + "\n")
print("wrote missys-big-day-out.html, index.html and version.json (build " + build + "),", len(html) // 1024, "KB")
