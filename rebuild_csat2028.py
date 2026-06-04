# -*- coding: utf-8 -*-
"""
csat2028.html 재빌드 스크립트.
csat2028_src/{korean,math,english,social,science}.html 소스를 base64로 인코딩해
csat2028.html 안의 <script id="pageData"> JSON을 교체한다.

사용법:  python rebuild_csat2028.py
"""
import re, json, base64, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "csat2028_src")
TARGET = os.path.join(ROOT, "csat2028.html")
ORDER = ["korean", "math", "english", "social", "science"]

def main():
    data = {}
    for key in ORDER:
        path = os.path.join(SRC, key + ".html")
        with open(path, encoding="utf-8") as f:
            html = f.read()
        data[key] = base64.b64encode(html.encode("utf-8")).decode("ascii")

    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    with open(TARGET, encoding="utf-8") as f:
        page = f.read()

    pat = re.compile(
        r'(<script id="pageData" type="application/json">)(.*?)(</script>)', re.S)
    if not pat.search(page):
        print("ERROR: pageData script not found in csat2028.html", file=sys.stderr)
        sys.exit(1)

    new_page = pat.sub(lambda m: m.group(1) + payload + m.group(3), page, count=1)

    with open(TARGET, "w", encoding="utf-8", newline="\n") as f:
        f.write(new_page)

    # 검증: 다시 파싱되는지 확인
    m = pat.search(new_page)
    parsed = json.loads(m.group(2))
    assert set(parsed.keys()) == set(ORDER), "key mismatch"
    for key in ORDER:
        dec = base64.b64decode(parsed[key]).decode("utf-8")
        assert dec.startswith("<!doctype html>") or dec.startswith("<!DOCTYPE"), key
    print("OK: rebuilt csat2028.html")
    for key in ORDER:
        kb = len(data[key]) / 1024
        print(f"  - {key:8s}: {kb:6.1f} KB (b64)")
    print(f"  total file: {len(new_page)/1024:.1f} KB")

if __name__ == "__main__":
    main()
