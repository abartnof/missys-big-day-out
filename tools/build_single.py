"""Build dist/missys-big-day-out.html: one self-contained file (JS inlined, images as
base64 data URIs, zero external requests). Works by double-clicking (file://).

Usage: python3 -I tools/build_single.py
(The repo root index.html also works as-is on GitHub Pages / any static host,
and from file://, because the game never uses fetch/XHR.)
"""
import base64, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text()

assets = {}
for p in sorted((ROOT / "assets").rglob("*.png")):
    assets[p.relative_to(ROOT).as_posix()] = "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()

def inline(m):
    src = m.group(1)
    code = (ROOT / src).read_text().replace("</script", "<\\/script")
    return "<script>\n" + code + "\n</script>"

html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
head_js = "<script>window.__ASSETS=" + json.dumps(assets) + ";</script>\n"
html = html.replace("<script>", head_js + "<script>", 1)
out = ROOT / "dist"
out.mkdir(exist_ok=True)
(out / "missys-big-day-out.html").write_text(html)
print("wrote", out / "missys-big-day-out.html", len(html) // 1024, "KB")
