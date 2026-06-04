# -*- coding: utf-8 -*-
"""
preview.html(내신 통합 안내) 재빌드 스크립트.
preview_src/{korean,math,english,social,science}.html 소스를 base64로 인코딩해
preview.html 안의  const PAGE_DATA = {...};  객체를 교체한다.

csat2028.html의 rebuild_csat2028.py와 같은 역할.
차이점: preview.html은 <script id="pageData"> 태그가 아니라
        JS 변수 선언  const PAGE_DATA = { ... };  형태로 데이터를 담는다.

사용법:  python rebuild_preview.py
"""
import re, json, base64, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "preview_src")
TARGET = os.path.join(ROOT, "preview.html")
ORDER = ["korean", "math", "english", "social", "science"]

# const PAGE_DATA = { ... };  (base64 문자열에는 '}' 가 없으므로 비탐욕 매칭이 안전)
PAT = re.compile(r'(const PAGE_DATA = )(\{.*?\})(;)', re.S)


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

    if not PAT.search(page):
        print("ERROR: const PAGE_DATA not found in preview.html", file=sys.stderr)
        sys.exit(1)

    new_page = PAT.sub(lambda m: m.group(1) + payload + m.group(3), page, count=1)

    with open(TARGET, "w", encoding="utf-8", newline="\n") as f:
        f.write(new_page)

    # 검증: 다시 파싱되고 디코드되는지 확인
    m = PAT.search(new_page)
    parsed = json.loads(m.group(2))
    assert set(parsed.keys()) == set(ORDER), "key mismatch"
    for key in ORDER:
        dec = base64.b64decode(parsed[key]).decode("utf-8")
        assert dec.lstrip().lower().startswith("<!doctype html>"), key
    print("OK: rebuilt preview.html")
    for key in ORDER:
        kb = len(data[key]) / 1024
        print(f"  - {key:8s}: {kb:6.1f} KB (b64)")
    print(f"  total file: {len(new_page)/1024:.1f} KB")


if __name__ == "__main__":
    main()
