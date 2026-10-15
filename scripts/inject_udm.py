#!/usr/bin/env python3
"""scripts/udm_src/{udm.css,pane.html,pure.js,app.js} → sub2.html 마커 사이에 멱등 주입.
  python3 scripts/inject_udm.py            # 저장소 루트의 sub2.html
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / "udm_src"
TARGET = ROOT / "sub2.html"


def fill(text, start, end, body):
    for bad in (start, end, "</script>", "</style>"):
        if bad in body:
            sys.exit(f"주입 본문에 '{bad}' 포함 불가")
    pat = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if not pat.search(text):
        sys.exit(f"마커 없음: {start}")
    return pat.sub(lambda _m: start + "\n" + body.rstrip("\n") + "\n" + end, text, count=1)


def main():
    html = TARGET.read_text(encoding="utf-8")
    out = fill(html, "/* udm:css:start */", "/* udm:css:end */", (SRC / "udm.css").read_text(encoding="utf-8"))
    out = fill(out, "<!-- udm:pane:start -->", "<!-- udm:pane:end -->", (SRC / "pane.html").read_text(encoding="utf-8"))
    js = (SRC / "pure.js").read_text(encoding="utf-8") + "\n" + (SRC / "app.js").read_text(encoding="utf-8")
    out = fill(out, "/* udm:js:start */", "/* udm:js:end */", js)
    if out != html:
        TARGET.write_text(out, encoding="utf-8")
    print("injected" if out != html else "unchanged")


if __name__ == "__main__":
    main()
