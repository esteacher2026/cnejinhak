#!/usr/bin/env python3
"""큰 단일 HTML(sub2.html)에 줄 단위로 안전하게 삽입/치환한다. 앵커 부분 문자열을 포함하는 줄이 정확히 1개여야 한다.

  python3 scripts/patch_html.py sub2.html --after  '앵커'  --file part.txt
  python3 scripts/patch_html.py sub2.html --before '앵커'  --file part.txt
  python3 scripts/patch_html.py sub2.html --replace-line '앵커' --file part.txt
  python3 scripts/patch_html.py sub2.html --replace-text '옛 문자열' --with '새 문자열'   # 파일 전체에서 정확히 1회
"""
import argparse
import sys
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("html")
g = p.add_mutually_exclusive_group(required=True)
g.add_argument("--after")
g.add_argument("--before")
g.add_argument("--replace-line")
g.add_argument("--replace-text")
p.add_argument("--file")
p.add_argument("--with", dest="with_")
a = p.parse_args()
path = Path(a.html)
text = path.read_text(encoding="utf-8")
if a.replace_text is not None:
    if text.count(a.replace_text) != 1:
        sys.exit(f"문자열이 {text.count(a.replace_text)}회 등장(정확히 1회 필요): {a.replace_text!r}")
    path.write_text(text.replace(a.replace_text, a.with_ or "", 1), encoding="utf-8")
    print("ok: text replaced")
    sys.exit(0)
anchor = a.after or a.before or a.replace_line
lines = text.split("\n")
hits = [i for i, l in enumerate(lines) if anchor in l]
if len(hits) != 1:
    sys.exit(f"앵커가 {len(hits)}줄에 매칭(정확히 1줄 필요): {anchor!r}")
part = Path(a.file).read_text(encoding="utf-8").rstrip("\n").split("\n")
i = hits[0]
if a.after:
    lines[i + 1:i + 1] = part
elif a.before:
    lines[i:i] = part
else:
    lines[i:i + 1] = part
path.write_text("\n".join(lines), encoding="utf-8")
print(f"ok: {len(part)}줄 → {i + 1}행 부근")
