"""Render the Arabic project idea as a self-contained HTML document and PDF."""

import base64
import html
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "generated-artifacts/delivery/pdf"
OUTPUT.mkdir(parents=True, exist_ok=True)


def inline(text):
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html.escape(text))


sections = []
in_list = False
for line in (ROOT / "docs/PROJECT_IDEA.md").read_text().splitlines():
    line = line.strip()
    is_list = line.startswith("- ") or re.match(r"^\d+\. ", line)
    if in_list and not is_list:
        sections.append("</ul>")
        in_list = False
    if not line:
        continue
    if is_list:
        if not in_list:
            sections.append("<ul>")
            in_list = True
        item = re.sub(r"^(?:- |[0-9]+\. )", "", line)
        sections.append(f"<li>{inline(item)}</li>")
    elif line.startswith("## "):
        sections.append(f"<h2>{inline(line[3:])}</h2>")
    elif line.startswith("# "):
        sections.append(f"<h1>{inline(line[2:])}</h1>")
    elif line == "---":
        sections.append("<hr>")
    else:
        sections.append(f"<p>{inline(line)}</p>")
if in_list:
    sections.append("</ul>")

font = base64.b64encode(
    (ROOT / "artifacts/nasaem-presentation/src/assets/fonts/tajawal-bold.ttf").read_bytes()
).decode()
logo = base64.b64encode((ROOT / "docs/assets/replit.svg").read_bytes()).decode()
document = """<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="author" content="Mohamed El_saed">
<title>فكرة مشروع نسايم — Mohamed El_saed</title><style>
@font-face{font-family:Tajawal;src:url(data:font/ttf;base64,FONT) format('truetype');font-weight:700}
@page{size:A4;margin:17mm 19mm}
*{box-sizing:border-box}body{font:700 12pt/1.65 Tajawal,Arial,sans-serif;color:#193b2d;margin:0}
header{display:flex;align-items:center;gap:12px;border-bottom:4px solid #a32e28;padding-bottom:12px;margin-bottom:22px}
header img{width:34px;height:34px}header span{font-size:11pt}
h1{font-size:25pt;line-height:1.35;margin:0 0 12px;color:#a32e28}
h2{font-size:15pt;margin:18px 0 5px;break-after:avoid}
p{margin:6px 0}li{margin:2px 0;break-inside:avoid}ul{padding-right:22px;margin:6px 0}
hr{border:0;border-top:2px solid #f0c84e;margin-top:20px}
strong{color:#193b2d}footer{font-size:10pt;margin-top:18px;color:#354d40}
</style></head><body><header><img alt="Replit" src="data:image/svg+xml;base64,LOGO">
<span>منحة لتعلّم Vibe Coding · Replit</span></header>CONTENT
<footer>من إنشاء Mohamed El_saed · نسايم للمنظفات</footer></body></html>"""
document = document.replace("FONT", font).replace("LOGO", logo).replace("CONTENT", "\n".join(sections))
html_path = OUTPUT / "Nasaem-Project-Idea-Mohamed-El_saed.html"
pdf_path = html_path.with_suffix(".pdf")
html_path.write_text(document, encoding="utf-8")
browser = shutil.which("chromium") or shutil.which("google-chrome")
if not browser:
    raise SystemExit("Chromium is required to render the Arabic PDF; no output PDF was created.")
subprocess.run([
    browser, "--headless", "--no-sandbox", "--disable-gpu",
    "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=3000", f"--print-to-pdf={pdf_path}", html_path.as_uri(),
], check=True, timeout=90, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
assert pdf_path.read_bytes().startswith(b"%PDF-"), "Invalid PDF"
print(pdf_path.relative_to(ROOT))
