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
