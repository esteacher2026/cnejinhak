#!/usr/bin/env python3
"""2028학년도 계열별 대표 모집단위별 반영과목 xlsx → sub2.html `matrix-data` JSON.

사용 예:
  .venv-udm/bin/python -I scripts/build_subject_matrix.py \
      "$HOME/Downloads/2028학년도 계열별 대표 모집단위별 반영과목.xlsx" \
      --html sub2.html --json /tmp/matrix.json --inject

- 원자료는 스타일 손상으로 openpyxl 일반 모드가 실패하므로 read_only로 값만 읽고,
  병합 범위는 시트 XML의 <mergeCell ref=...>를 직접 파싱한다(한셀 저장 파일은 `x:` 접두사).
- 설계: docs/superpowers/specs/2026-10-16-univdb-matrix-tab-design.md (2장 데이터 규칙)
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

SHEET_NAME = "반영과목"
FIRST_DATA_ROW, LAST_DATA_ROW = 5, 245
COL_FIELD, COL_UNIT, COL_FIRST_SUBJECT, COL_ETC = 1, 2, 3, 18

# (key, label, short, group, column)
SUBJECTS = [
    ("kor", "국어", "국어", "kor", 3),
    ("alg", "대수", "대수", "math", 4), ("prob", "확률과 통계", "확통", "math", 5),
    ("calc1", "미적분Ⅰ", "미적Ⅰ", "math", 6), ("calc2", "미적분Ⅱ", "미적Ⅱ", "math", 7), ("geo", "기하", "기하", "math", 8),
    ("eng", "영어", "영어", "eng", 9),
    ("soc", "일반사회", "일사", "soc", 10), ("hist", "역사", "역사", "soc", 11),
    ("geog", "지리", "지리", "soc", 12), ("eth", "윤리", "윤리", "soc", 13),
    ("phy", "물리학", "물리", "sci", 14), ("chem", "화학", "화학", "sci", 15),
    ("bio", "생명과학", "생명", "sci", 16), ("earth", "지구과학", "지구", "sci", 17),
]
GROUPS = [("kor", "국어"), ("math", "수학"), ("eng", "영어"), ("soc", "사회"), ("sci", "과학")]
KEY_BY_COL = {c: k for k, _, _, _, c in SUBJECTS}
GROUP_BY_KEY = {k: g for k, _, _, g, _ in SUBJECTS}
GROUP_COLS = {g: (min(c for k, _, _, gg, c in SUBJECTS if gg == g), max(c for k, _, _, gg, c in SUBJECTS if gg == g))
              for g, _ in GROUPS if sum(1 for s in SUBJECTS if s[3] == g) > 1}

# (key, field, label)
UNITS = [
    ("eng-lit", "인문", "영어영문"), ("philosophy", "인문", "철학"),
    ("business", "사회", "경영"), ("psychology", "사회", "심리"),
    ("korean-edu", "교육", "국어교육"), ("math-edu", "교육", "수학교육"),
    ("life-science", "자연", "생명과학"), ("physics", "자연", "물리"), ("chemistry", "자연", "화학"),
    ("mech-eng", "공학", "기계공학"), ("computer-eng", "공학", "컴퓨터공학"),
    ("pharmacy", "의약", "약학"), ("medicine", "의약", "의예"),
    ("visual-design", "예체능", "시각디자인"), ("music", "예체능", "음악"), ("phys-ed", "예체능", "체육"),
]
UNIT_KEY_BY_LABEL = {label: key for key, _, label in UNITS}
UNIT_LINKS = {
    "eng-lit": ["영어영문", "영문", "영어"], "philosophy": ["철학"], "business": ["경영학", "경영"], "psychology": ["심리"],
    "korean-edu": ["국어교육"], "math-edu": ["수학교육"], "life-science": ["생명과학", "생물", "생명"], "physics": ["물리"],
    "chemistry": ["화학과", "화학"], "mech-eng": ["기계"], "computer-eng": ["컴퓨터", "소프트웨어", "SW", "전산", "인공지능", "AI"],
    "pharmacy": ["약학"], "medicine": ["의예", "의학", "의과"], "visual-design": ["시각디자인", "디자인"], "music": ["음악"], "phys-ed": ["체육", "스포츠"],
}
# 파일 2 표기 → 파일 1 university_display
NAME_MAP = {"(춘천)": "강원대(춘천)", "강원대": "강원대(춘천)", "강원대(삼척)": "강원대(삼척·도계)",
            "경성대": "경성대학교", "전남대": "전남대(광주)", "한체대": "한국체대"}
# 파일 1에 없는 대학의 권역/지역
REGION_OVERRIDE = {"동양대": ("영남권", "경북")}

_NOTE_RE = re.compile(r"^(.*?)\s*\(\s*역사\s*/\s*도덕\s*포함\s*\)\s*$")


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def blank(v):
    """빈칸·'-'·공백만 있는 셀 → None, 그 외는 strip된 문자열."""
    if v is None:
        return None
    t = str(v).strip()
    return None if t in ("", "-", "－") else t


def parse_univ_cell(raw: str):
    """'단국대⁎' → ('단국대', True, None); '충남대(역사/도덕 포함)' → ('충남대', False, '역사/도덕 포함')."""
    t = nfc(str(raw)).strip()
    star = False
    if t.endswith(("*", "⁎")):
        star, t = True, t[:-1].strip()
    note = None
    m = _NOTE_RE.match(t)
    if m:
        t, note = m.group(1).strip(), "역사/도덕 포함"
    return NAME_MAP.get(t, t), star, note


def parse_etc_cell(raw: str):
    """기타 열: '서울대\\n(제2외/한문)' → ('서울대', False, None, '제2외/한문'); '영남대' → ('영남대', False, None, '')."""
    lines = [l.strip() for l in nfc(str(raw)).split("\n") if l.strip()]
    name, star, note = parse_univ_cell(lines[0])
    rest = " ".join(lines[1:]).strip()
    if rest.startswith("(") and rest.endswith(")"):
        rest = rest[1:-1].strip()
    return name, star, note, rest


def _sheet_xml_path(xlsx: Path, sheet_name: str) -> str:
    with zipfile.ZipFile(xlsx) as z:
        wb = z.read("xl/workbook.xml").decode("utf-8")
        rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    m = re.search(r'<(?:\w+:)?sheet\b[^>]*\bname="' + re.escape(sheet_name) + r'"[^>]*\br:id="([^"]+)"', wb)
    if not m:
        raise SystemExit(f"시트 '{sheet_name}'을 workbook.xml에서 찾지 못함")
    t = re.search(r'<Relationship\b[^>]*\bId="' + re.escape(m.group(1)) + r'"[^>]*\bTarget="([^"]+)"', rels)
    if not t:
        raise SystemExit("워크시트 relationship을 찾지 못함")
    target = t.group(1).lstrip("/")
    return target if target.startswith("xl/") else "xl/" + target


def _col_to_num(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n


def parse_merge_ref(ref: str):
    a, b = ref.split(":")
    ma, mb = re.match(r"([A-Z]+)(\d+)", a), re.match(r"([A-Z]+)(\d+)", b)
    return int(ma.group(2)), _col_to_num(ma.group(1)), int(mb.group(2)), _col_to_num(mb.group(1))


def read_merges(xlsx: Path, sheet_xml: str):
    with zipfile.ZipFile(xlsx) as z:
        xml = z.read(sheet_xml).decode("utf-8")
    return [parse_merge_ref(r) for r in re.findall(r'<(?:\w+:)?mergeCell\b[^>]*\bref="([^"]+)"', xml)]


def read_sheet(xlsx):
    """셀 값(dict[(row,col)] = NFC 문자열)과 병합 범위 목록을 돌려준다."""
    import openpyxl  # 지연 import: 테스트에서 상수만 쓸 때 불필요
    xlsx = Path(xlsx)
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    ws = wb[SHEET_NAME]
    cells = {}
    for row in ws.iter_rows(min_row=1, max_row=LAST_DATA_ROW):
        for c in row:
            if c.value is not None and str(c.value) != "":
                cells[(c.row, c.column)] = nfc(str(c.value))
    wb.close()
    return cells, read_merges(xlsx, _sheet_xml_path(xlsx, SHEET_NAME))


def row_merge_map(merges):
    """가로 병합만 행별로 모은다: {row: [(c1, c2), ...]}."""
    out = {}
    for r1, c1, r2, c2 in merges:
        if r1 == r2 and c2 > c1:
            out.setdefault(r1, []).append((c1, c2))
    return out


def interpret_row(rownum: int, row_cells: dict, row_merges: list) -> dict:
    """스펙 2.2 규칙 R1–R7, R9 적용. 대학명이 둘 이상이거나 없으면 ValueError."""
    marks, groups, stars, notes = [], [], [], {}
    names = []          # (name, star)
    all_subjects = False
    etc = None
    covered = set()

    def take(raw):
        name, star, note = parse_univ_cell(raw)
        names.append((name, star))
        return star, note

    for c1, c2 in sorted(row_merges):
        covered.update(range(c1, c2 + 1))
        raw = row_cells.get(c1)
        if not raw:
            continue
        star, note = take(raw)
        if (c1, c2) == (COL_FIRST_SUBJECT, COL_ETC):                      # R4 전 교과
            all_subjects = True
            groups = [g for g, _ in GROUPS]
            continue
        group = next((g for g, span in GROUP_COLS.items() if span == (c1, c2)), None)
        cols = [c for c in range(c1, c2 + 1) if c in KEY_BY_COL]
        if group:                                                         # R2 교과 전체
            groups.append(group)
        else:                                                             # R3 부분 병합
            marks.extend(KEY_BY_COL[c] for c in cols)
        if star:
            stars.extend(KEY_BY_COL[c] for c in cols)
        if note and cols:
            notes[KEY_BY_COL[cols[0]]] = note

    for c in range(COL_FIRST_SUBJECT, COL_ETC + 1):
        if c in covered:
            continue
        raw = row_cells.get(c)
        if not raw:
            continue
        if c == COL_ETC:                                                  # R7 기타
            name, star, note, text = parse_etc_cell(raw)
            names.append((name, star))
            etc = text
            continue
        star, note = take(raw)                                            # R1
        marks.append(KEY_BY_COL[c])
        if star:
            stars.append(KEY_BY_COL[c])
        if note:
            notes[KEY_BY_COL[c]] = note

    uniq = sorted({n for n, _ in names})
    if len(uniq) != 1:
        raise ValueError(f"row {rownum}: 대학명이 하나가 아님 {uniq}")
    star_all = all(s for _, s in names)
    order = {k: i for i, (k, *_rest) in enumerate(SUBJECTS)}
    return {
        "university": uniq[0],
        "marks": sorted(set(marks), key=order.get),
        "groups": groups,
        "allSubjects": all_subjects,
        "stars": [] if star_all else sorted(set(stars)),
        "starAll": star_all,
        "cellNotes": notes,
        "etc": etc,
    }


ERRATA = [
    {"id": "E1", "rows": [32, 33], "unit": "business",
     "issue": "강원대 / (춘천) 두 행으로 분리 기재", "action": "한 행(강원대(춘천))으로 병합",
     "basis": "셀 병합 D32:D33 등이 같은 행임을 보여줌",
     "fix": {"type": "merge_rows", "into": 32, "drop": 33, "rename": {"강원대": "강원대(춘천)", "(춘천)": "강원대(춘천)"}}},
    {"id": "E2", "rows": [51], "unit": "business",
     "issue": "국어·영어는 충북대, 사회(병합)는 충남대로 기재", "action": "사회 전체 = 충북대로 정정",
     "basis": "50행이 충남대 행, 51행은 충북대 행", "fix": {"type": "set_cell", "row": 51, "col": 10, "value": "충북대"}},
    {"id": "E3", "rows": [78], "unit": "korean-edu",
     "issue": "국어는 충북대, 사회(병합)는 충남대(역사/도덕포함)로 기재", "action": "충북대로 정정, 메모 유지",
     "basis": "77행이 충남대 행", "fix": {"type": "set_cell", "row": 78, "col": 10, "value": "충북대(역사/도덕 포함)"}},
    {"id": "E4", "rows": list(range(195, 202)), "unit": "computer-eng",
     "issue": "원광대·전남대·전북대·조선대·중앙대·충남대·충북대 7행이 컴퓨터공학 아래 중복 수록. 원광대 195=229(의예), 조선대 198=191·232, 중앙대 199=233, 충남대 200=234, 충북대 201=235와 셀 패턴 동일. 원광대는 권장과목 자료에 컴퓨터 계열 모집단위 없음",
     "action": "매트릭스에서 제외(원자료 확인 필요)",
     "basis": "권장과목 원문: 전남대 전자컴퓨터공학부=수학·물리학(188행과 일치), 조선대 컴퓨터공학전공=수학·과학(191행과 일치)",
     "fix": {"type": "exclude", "rows": list(range(195, 202))}},
    {"id": "E5", "rows": [55], "unit": "business",
     "issue": "한양대 경영에 미적분Ⅱ·기하·물리학·화학·생명과학(자연계 패턴) 기재", "action": "유지하되 ⚠ 경고 표시",
     "basis": "권장과목 원문의 한양대 자료는 '자연 > 전 모집단위' 1건뿐",
     "fix": {"type": "warn", "row": 55, "text": "자연계열 전 모집단위 안내가 경영(인문)에 적용된 것으로 보임 — 원자료 확인 필요"}},
    {"id": "E6", "rows": [239], "unit": "visual-design",
     "issue": "병합 J239:N239가 사회 4열 + 물리학까지 걸침", "action": "사회 전체로만 해석",
     "basis": "권장과목 원문의 조선대 디자인 계열 = 국어, 사회",
     "fix": {"type": "replace_merge", "row": 239, "old": (10, 14), "new": (10, 13)}},
    {"id": "E7", "rows": [54, 170, 204], "unit": "business/mech-eng/computer-eng",
     "issue": "한라대 행이 C:R 전체 병합", "action": "전 교과 반영으로 해석(규칙 R4)",
     "basis": "권장과목 원문 한라대 = 국어, 영어, 수학, 사회, 과학 교과", "fix": {"type": "note"}},
    {"id": "E8", "rows": [129, 147], "unit": "chemistry",
     "issue": "과학 열 부분 병합(물리학·화학·생명과학)", "action": "병합이 덮는 세 과목 각각 반영(규칙 R3)",
     "basis": "권장과목 원문 경기대 '과학(3과목)'", "fix": {"type": "note"}},
]


def apply_errata(cells: dict, merges: list):
    cells, merges = dict(cells), list(merges)
    excluded, warns, out = {}, {}, []
    for e in ERRATA:
        f = e["fix"]
        if f["type"] == "merge_rows":
            into, drop, ren = f["into"], f["drop"], f["rename"]
            for (r, c), v in list(cells.items()):
                if r == into and v in ren:
                    cells[(r, c)] = ren[v]
                elif r == drop:
                    if c >= COL_FIRST_SUBJECT and v in ren and (into, c) not in cells:
                        cells[(into, c)] = ren[v]
                    del cells[(r, c)]
        elif f["type"] == "set_cell":
            cells[(f["row"], f["col"])] = f["value"]
        elif f["type"] == "exclude":
            for r in f["rows"]:
                excluded[r] = e["id"]
        elif f["type"] == "warn":
            warns[f["row"]] = f["text"]
        elif f["type"] == "replace_merge":
            r, (o1, o2), (n1, n2) = f["row"], f["old"], f["new"]
            if (r, o1, r, o2) not in merges:
                raise SystemExit(f"{e['id']}: 병합 {r}:{o1}-{o2}이 원자료에 없음")
            merges = [(r, n1, r, n2) if m == (r, o1, r, o2) else m for m in merges]
        out.append({k: e[k] for k in ("id", "rows", "unit", "issue", "action", "basis")})
    return cells, merges, excluded, warns, out


def load_file1_regions(html_path) -> dict:
    """sub2.html의 records-data(파일 1)에서 university_display → (region_group, region)."""
    text = Path(html_path).read_text(encoding="utf-8")
    m = re.search(r'<script id="records-data" type="application/json">(.*?)</script>', text, re.S)
    if not m:
        raise SystemExit("records-data 블록을 찾지 못함")
    regions = {}
    for r in json.loads(m.group(1)):
        regions.setdefault(r["university_display"], (r["region_group"], r["region"]))
    return regions


_COL_LETTER = {c: chr(64 + c) for c in range(COL_FIRST_SUBJECT, COL_ETC + 1)}


def build(cells, merges, regions, built) -> dict:
    """원본 cells/merges → 정오표 적용 → 레코드. 정정 전 셀 값은 각 레코드의 raw에 보존한다."""
    raw_cells = cells
    source_rows = sum(1 for r in range(FIRST_DATA_ROW, LAST_DATA_ROW + 1) if raw_cells.get((r, COL_UNIT)))
    cells, merges, excluded, warns, errata = apply_errata(cells, merges)
    merge_rows = row_merge_map(merges)
    records = []
    for r in range(FIRST_DATA_ROW, LAST_DATA_ROW + 1):
        unit_label = cells.get((r, COL_UNIT))
        if not unit_label:
            continue
        if unit_label not in UNIT_KEY_BY_LABEL:
            raise SystemExit(f"row {r}: 알 수 없는 모집단위 '{unit_label}'")
        row_cells = {c: blank(cells.get((r, c))) for c in range(COL_FIRST_SUBJECT, COL_ETC + 1)}
        row_merges = [(c1, c2) for c1, c2 in merge_rows.get(r, []) if c1 >= COL_FIRST_SUBJECT]
        rec = interpret_row(r, row_cells, row_merges)
        name = rec["university"]
        key = name if name in regions else None
        region = regions.get(name) or REGION_OVERRIDE.get(name) or (None, None)
        records.append({
            "id": f"m-{r:04d}", "srcRow": r,
            "unit": UNIT_KEY_BY_LABEL[unit_label], "field": cells.get((r, COL_FIELD)),
            "university": name, "universityKey": key, "regionGroup": region[0], "region": region[1],
            **{k: rec[k] for k in ("marks", "groups", "allSubjects", "stars", "starAll", "cellNotes", "etc")},
            "warn": warns.get(r), "excluded": r in excluded, "excludedReason": excluded.get(r),
            "raw": {**{_COL_LETTER[c]: raw_cells.get((r, c)) for c in range(COL_FIRST_SUBJECT, COL_ETC + 1)},
                    "merges": [f"{_COL_LETTER[c1]}{r}:{_COL_LETTER[c2]}{r}" for c1, c2 in row_merges]},
        })
    return {
        "meta": {"year": "2028", "source": "2028학년도 계열별 대표 모집단위별 반영과목", "built": built,
                 "sourceRows": source_rows,
                 "records": sum(1 for x in records if not x["excluded"])},
        "subjects": [{"key": k, "label": l, "short": s, "group": g} for k, l, s, g, _ in SUBJECTS],
        "groups": [{"key": k, "label": l} for k, l in GROUPS],
        "units": [{"key": k, "field": f, "label": l, "order": i + 1} for i, (k, f, l) in enumerate(UNITS)],
        "records": records,
        "errata": errata,
        "unitLinks": UNIT_LINKS,
    }


def inject(html_path, data) -> None:
    """<script id="matrix-data"> 블록을 교체하거나 options-data 뒤에 삽입(멱등)."""
    path = Path(html_path)
    text = path.read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    block = f'<script id="matrix-data" type="application/json">{payload}</script>'
    pat = re.compile(r'<script id="matrix-data" type="application/json">.*?</script>', re.S)
    if pat.search(text):
        new = pat.sub(lambda _m: block, text, count=1)
    else:
        anchor = re.search(r'<script id="options-data" type="application/json">.*?</script>\n', text, re.S)
        if not anchor:
            raise SystemExit("options-data 블록을 찾지 못함")
        new = text[:anchor.end()] + block + "\n" + text[anchor.end():]
    if new != text:
        path.write_text(new, encoding="utf-8")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx")
    ap.add_argument("--html", default="sub2.html", help="파일 1 권역 조인 및 --inject 대상")
    ap.add_argument("--json", help="검토용 JSON 출력 경로")
    ap.add_argument("--inject", action="store_true", help="--html 파일의 matrix-data 블록을 갱신")
    ap.add_argument("--built", default=_dt.date.today().isoformat())
    a = ap.parse_args(argv)
    cells, merges = read_sheet(a.xlsx)
    data = build(cells, merges, load_file1_regions(a.html), a.built)
    excluded = [r for r in data["records"] if r["excluded"]]
    by_unit = {}
    for r in data["records"]:
        if not r["excluded"]:
            by_unit[r["unit"]] = by_unit.get(r["unit"], 0) + 1
    unmapped = sorted({r["university"] for r in data["records"] if r["universityKey"] is None})
    print(f"원자료 {data['meta']['sourceRows']}행 → 레코드 {data['meta']['records']}건 (제외 {len(excluded)}행)")
    print("모집단위별:", ", ".join(f"{u['label']} {by_unit.get(u['key'], 0)}" for u in data["units"]))
    print("파일 1 미매핑 대학:", unmapped or "없음")
    if a.json:
        Path(a.json).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    if a.inject:
        inject(a.html, data)
        print(f"{a.html} matrix-data 갱신")
    return 0


if __name__ == "__main__":
    sys.exit(main())
