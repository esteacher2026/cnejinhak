# sub2.html `#univDB` 반영과목 매트릭스 탭 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `sub2.html`의 "대학별 권장과목 확인" 섹션에 탭을 추가해, 2028학년도 「계열별 대표 모집단위별 반영과목」 엑셀(16개 대표 모집단위 × 대학 × 과목 15열)을 매트릭스·내 이수과목 점검·과목별 역조회·파일 1 원문 연결과 함께 제공한다.

**Architecture:** 파이썬 빌드 스크립트가 엑셀을 읽어 셀 해석 규칙과 정오표를 적용한 JSON을 만들고 `sub2.html`의 `<script id="matrix-data">`에 주입한다. 프런트는 `scripts/udm_src/`(css·pane.html·pure.js·app.js)가 소스이고, `scripts/inject_udm.py`가 `sub2.html`의 마커 사이에 멱등 주입한다. 기존 검색 탭 코드는 전역 함수 2개 export 외에 손대지 않는다.

**Tech Stack:** Python 3.9+ (openpyxl read_only, pytest), 바닐라 JS(IIFE, 외부 라이브러리 없음), Node 20 (`node:test`로 순수 함수 테스트), 정적 HTML(GitHub Pages).

**Spec:** `docs/superpowers/specs/2026-10-16-univdb-matrix-tab-design.md`

## Global Constraints

- 작업 저장소는 `/Users/jyj/claude/cnejinhak` (브랜치 `main`, `origin/main`과 일치). **`git add -A` 금지**, 변경 파일 경로만 명시해 stage. push는 사용자 확인 후에만.
- `sub2.html`은 3.4MB(653행이 2MB 한 줄). **Read/Edit 도구로 열지 말고** `scripts/patch_html.py`·`scripts/inject_udm.py`·`scripts/build_subject_matrix.py --inject`로만 수정한다. 확인은 `grep -n`/`sed -n`.
- 기존 검색 탭의 `records-data`·`options-data` 블록과 udb IIFE는 바이트 단위로 보존(허용 변경: Task 4의 export 2줄, 설명문 1줄, 패널 래퍼 2줄).
- 새 CSS 클래스는 `.udm-` 접두사, 탭 바만 `.udb-tabs`/`.udb-tab`. 새 JS는 전역에 `UDM`(순수 함수 객체) 외 아무것도 노출하지 않는다. localStorage 키는 `udb2028.tab`, `udb2028.mUnit`, `udb2028.mySubs`.
- 색·반경·그림자는 기존 토큰(`--navy #0f2f5f`, `--blue`, `--green #059669`, `--mint`, `--sky`, `--yellow`, `--line`, `--muted`, `--radius 20px`, `--shadow`)만 사용. 글꼴 설정은 본문 상속.
- 모집단위 키 16개(고정): `eng-lit, philosophy, business, psychology, korean-edu, math-edu, life-science, physics, chemistry, mech-eng, computer-eng, pharmacy, medicine, visual-design, music, phys-ed`. 과목 키 15개: `kor, alg, prob, calc1, calc2, geo, eng, soc, hist, geog, eth, phy, chem, bio, earth`. 교과군 키 5개: `kor, math, eng, soc, sci`.
- 원자료 경로: `/Users/jyj/Downloads/2028학년도 계열별 대표 모집단위별 반영과목.xlsx` (시트 `반영과목`, 데이터 5–245행). 원자료는 신뢰하지 않는 입력이므로 파이썬은 `-I`로 실행.
- 레코드 총수 233건(원자료 241행 − E1 1행 − E4 7행), 모집단위별: 영어영문 14·철학 13·경영 24·심리 11·국어교육 11·수학교육 14·생명과학 16·물리 18·화학 21·기계공학 24·컴퓨터공학 28·약학 11·의예 18·시각디자인 5·음악 1·체육 4.
- 파이썬 실행 환경: 저장소 루트의 `.venv-udm/`(`python3 -m venv .venv-udm && .venv-udm/bin/pip install openpyxl pytest`). `.gitignore`에 `.venv-udm/` 추가(파일이 없으면 생성).
- 미리보기: `.claude/launch.json`의 `cnejinhak-fresh`(포트 8756, `/Users/jyj/claude/cnejinhak`). 확인 URL `http://localhost:8756/sub2.html#univDB-matrix`.

## Review Focus

1. 점검 모드를 켠 뒤 과목을 하나도 체크하지 않은 상태 → 모든 대학이 "부족"이고 요약은 `충족 0 / N`, 한라대(전 교과)도 부족이어야 한다. (Task 6 `evaluate` 빈 집합 테스트)
2. 권역 필터·대학 검색으로 결과가 0건 → 푸터 분모 0에서 `NaN%`가 나오지 않고 빈 상태 문구가 보여야 한다. (Task 5 `footerCounts([])` 테스트 + 브라우저 확인)
3. localStorage에 저장된 모집단위 키가 데이터에 없음(키 개편) → 기본 모집단위 `computer-eng`로 복원. (Task 5 init 가드 + 브라우저 확인)
4. 원문 연결에서 `universityKey`가 없는 대학(동양대)과 키워드 0건 대학(단국대)이 각각 토스트/대학 전체 필터로 떨어져야 한다. (Task 8 `matchUnitRecords` 테스트)
5. JSON 페이로드에 `</script>`가 포함돼도 페이지가 깨지지 않아야 한다. (Task 3 `inject` 이스케이프 테스트)

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `scripts/build_subject_matrix.py` (신규) | 엑셀 → JSON. 시트 읽기, 셀 파서, 행 해석, 정오표, 파일 1 권역 조인, `--inject`. |
| `scripts/test_build_subject_matrix.py` (신규) | 위 스크립트의 pytest. 합성 입력 단위 테스트 + 실제 엑셀 통합 테스트(파일 없으면 skip). |
| `scripts/patch_html.py` (신규) | 큰 HTML에 줄 단위 삽입/치환(앵커 1개 보장). 일회성 구조 패치용. |
| `scripts/inject_udm.py` (신규) | `scripts/udm_src/*` → `sub2.html` 마커 사이 멱등 주입. |
| `scripts/udm_src/udm.css` (신규) | 탭 바 + 매트릭스 스타일. |
| `scripts/udm_src/pane.html` (신규) | `#udbPaneMatrix` 정적 골격. |
| `scripts/udm_src/pure.js` (신규) | DOM 없는 순수 함수 `UDM` (판정·집계·매칭). Node 테스트 대상. |
| `scripts/udm_src/app.js` (신규) | 탭·상태·렌더·이벤트 IIFE. |
| `scripts/test_udm_pure.mjs` (신규) | `pure.js`의 `node:test` 테스트. |
| `sub2.html` (수정) | 탭 바·패널 래퍼·마커·export 2줄·설명문·meta. 나머지는 주입 결과. |
| `index.html` (수정) | sub2 카드 설명 1줄. |

---

### Task 1: 빌드 스크립트 — 시트 읽기와 셀 파서

**Files:**
- Create: `scripts/build_subject_matrix.py`
- Create: `scripts/test_build_subject_matrix.py`
- Create/Modify: `.gitignore`

**Interfaces:**
- Produces: `nfc(s) -> str`, `blank(v) -> str|None`, `parse_univ_cell(raw) -> (name, star: bool, note: str|None)`, `parse_etc_cell(raw) -> (name, star, note, etc_text: str)`, `read_sheet(path) -> (cells: dict[(row,col)->str], merges: list[(r1,c1,r2,c2)])`, 상수 `SUBJECTS, GROUPS, GROUP_COLS, KEY_BY_COL, UNITS, UNIT_KEY_BY_LABEL, UNIT_LINKS, NAME_MAP, REGION_OVERRIDE, COL_ETC=18, FIRST_DATA_ROW=5, LAST_DATA_ROW=245`.

- [ ] **Step 1: 가상환경과 .gitignore**

```bash
cd /Users/jyj/claude/cnejinhak && python3 -m venv .venv-udm && .venv-udm/bin/pip install -q openpyxl pytest && (grep -qx '.venv-udm/' .gitignore 2>/dev/null || echo '.venv-udm/' >> .gitignore) && .venv-udm/bin/python -c "import openpyxl, pytest; print('ok')"
```
Expected: `ok`

- [ ] **Step 2: 실패하는 테스트 작성** — `scripts/test_build_subject_matrix.py`

```python
import importlib.util, sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("bsm", HERE / "build_subject_matrix.py")
bsm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bsm)

XLSX = Path.home() / "Downloads" / "2028학년도 계열별 대표 모집단위별 반영과목.xlsx"


def test_constants_shape():
    assert [s[0] for s in bsm.SUBJECTS] == ["kor", "alg", "prob", "calc1", "calc2", "geo", "eng",
                                            "soc", "hist", "geog", "eth", "phy", "chem", "bio", "earth"]
    assert bsm.GROUP_COLS == {"math": (4, 8), "soc": (10, 13), "sci": (14, 17)}
    assert bsm.KEY_BY_COL[3] == "kor" and bsm.KEY_BY_COL[17] == "earth"
    assert len(bsm.UNITS) == 16 and bsm.UNIT_KEY_BY_LABEL["컴퓨터공학"] == "computer-eng"
    assert set(bsm.UNIT_LINKS) == {u[0] for u in bsm.UNITS}


@pytest.mark.parametrize("raw,expected", [
    ("단국대⁎", ("단국대", True, None)),
    ("아주대*", ("아주대", True, None)),
    ("단국대(천안)⁎", ("단국대(천안)", True, None)),
    ("충남대(역사/도덕 포함)", ("충남대", False, "역사/도덕 포함")),
    ("충남대(역사/도덕포함)", ("충남대", False, "역사/도덕 포함")),
    ("강원대(삼척)", ("강원대(삼척·도계)", False, None)),
    ("(춘천)", ("강원대(춘천)", False, None)),
    ("전남대", ("전남대(광주)", False, None)),
    ("한체대", ("한국체대", False, None)),
    ("경성대", ("경성대학교", False, None)),
    (" 고려대 ", ("고려대", False, None)),
])
def test_parse_univ_cell(raw, expected):
    assert bsm.parse_univ_cell(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("서울대\n(제2외/한문)", ("서울대", False, None, "제2외/한문")),
    ("영남대", ("영남대", False, None, "")),
    ("협성대*", ("협성대", True, None, "")),
    ("강원대(삼척)\n(미술,미술창작,미술 감상과 비평)", ("강원대(삼척·도계)", False, None, "미술,미술창작,미술 감상과 비평")),
])
def test_parse_etc_cell(raw, expected):
    assert bsm.parse_etc_cell(raw) == expected


@pytest.mark.parametrize("raw,expected", [(None, None), ("", None), (" ", None), ("-", None), (" 광운대 ", "광운대")])
def test_blank(raw, expected):
    assert bsm.blank(raw) == expected


@pytest.mark.skipif(not XLSX.exists(), reason="원자료 없음")
def test_read_sheet_real_file():
    cells, merges = bsm.read_sheet(XLSX)
    assert cells[(3, 1)] == "계열" and cells[(4, 4)] == "대수"
    assert cells[(5, 1)] == "인문" and cells[(5, 2)] == "영어영문" and cells[(5, 9)] == "강원대(춘천)"
    assert (7, 4, 7, 8) in merges          # D7:H7 수학 전체
    assert (54, 3, 54, 18) in merges       # C54:R54 한라대 전 교과
    assert (239, 10, 239, 14) in merges    # J239:N239 (E6 대상)
    assert cells[(245, 18)].startswith("한체대")
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd /Users/jyj/claude/cnejinhak && .venv-udm/bin/python -I -m pytest scripts/test_build_subject_matrix.py -q 2>&1 | tail -3`
Expected: 수집 단계 오류(`FileNotFoundError` 또는 `AttributeError: module 'bsm' has no attribute ...`).

- [ ] **Step 4: 스크립트 1부 작성** — `scripts/build_subject_matrix.py`

```python
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
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd /Users/jyj/claude/cnejinhak && .venv-udm/bin/python -I -m pytest scripts/test_build_subject_matrix.py -q 2>&1 | tail -3`
Expected: `22 passed` (실제 파일이 없으면 1 skipped).

- [ ] **Step 6: 커밋**

```bash
cd /Users/jyj/claude/cnejinhak && git add .gitignore scripts/build_subject_matrix.py scripts/test_build_subject_matrix.py && git commit -q -m "build_subject_matrix: 시트 읽기·셀 파서

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 2: 행 해석 — 병합·별표·메모·기타

**Files:**
- Modify: `scripts/build_subject_matrix.py` (끝에 추가)
- Modify: `scripts/test_build_subject_matrix.py` (끝에 추가)

**Interfaces:**
- Produces: `interpret_row(rownum: int, row_cells: dict[int, str|None], row_merges: list[tuple[int,int]]) -> dict` — 키 `university, marks, groups, allSubjects, stars, starAll, cellNotes, etc`. `row_cells`는 열 3..18의 `blank()` 적용값, `row_merges`는 그 행 안의 가로 병합 `(c1, c2)`(c1<c2, c1>=3).
- `row_merge_map(merges) -> dict[int, list[(c1,c2)]]`.

- [ ] **Step 1: 실패하는 테스트 추가**

```python
def _cells(**kw):
    """열 문자 → 값. 예: _cells(C='단국대⁎', I='단국대⁎')"""
    out = {c: None for c in range(3, 19)}
    for col, v in kw.items():
        out[bsm._col_to_num(col)] = bsm.blank(v)
    return out


def test_interpret_plain_marks():
    r = bsm.interpret_row(171, _cells(F="한양대(ERICA)", N="한양대(ERICA)"), [(6, 7)])  # F171:G171 부분 병합
    assert r["university"] == "한양대(ERICA)"
    assert r["marks"] == ["calc1", "calc2", "phy"] and r["groups"] == [] and r["allSubjects"] is False
    assert r["stars"] == [] and r["starAll"] is False and r["cellNotes"] == {} and r["etc"] is None


def test_interpret_group_merges_and_star_all():
    r = bsm.interpret_row(7, _cells(C="단국대⁎", D="단국대⁎", I="단국대⁎", J="단국대⁎"), [(4, 8), (10, 13)])
    assert r["university"] == "단국대"
    assert r["marks"] == ["kor", "eng"] and r["groups"] == ["math", "soc"]
    assert r["starAll"] is True and r["stars"] == []


def test_interpret_partial_science_merge():
    r = bsm.interpret_row(129, _cells(N="경기대"), [(14, 16)])  # N129:P129
    assert r["marks"] == ["phy", "chem", "bio"] and r["groups"] == []


def test_interpret_all_subjects():
    r = bsm.interpret_row(54, _cells(C="한라대"), [(3, 18)])
    assert r["allSubjects"] is True and r["groups"] == ["kor", "math", "eng", "soc", "sci"]
    assert r["marks"] == [] and r["etc"] is None


def test_interpret_cell_star_and_note():
    r = bsm.interpret_row(186, _cells(G="숭실대", H="숭실대", N="숭실대*"), [(14, 17)])
    assert r["marks"] == ["calc2", "geo"] and r["groups"] == ["sci"]
    assert r["starAll"] is False and r["stars"] == ["bio", "chem", "earth", "phy"]
    r2 = bsm.interpret_row(66, _cells(C="충남대", E="충남대", I="충남대", J="충남대(역사/도덕 포함)"), [(10, 13)])
    assert r2["groups"] == ["soc"] and r2["cellNotes"] == {"soc": "역사/도덕 포함"}


def test_interpret_etc_only_and_etc_text():
    r = bsm.interpret_row(11, _cells(R="서울대\n(제2외/한문)"), [])
    assert r["university"] == "서울대" and r["marks"] == [] and r["etc"] == "제2외/한문"
    r2 = bsm.interpret_row(42, _cells(C="영남대", D="영남대", I="영남대", J="영남대", R="영남대"), [(4, 8), (10, 13)])
    assert r2["etc"] == "" and r2["marks"] == ["kor", "eng"]


def test_interpret_rejects_mixed_universities():
    with pytest.raises(ValueError, match="row 51"):
        bsm.interpret_row(51, _cells(I="충북대", J="충남대"), [(10, 13)])


def test_interpret_rejects_empty_row():
    with pytest.raises(ValueError, match="row 33"):
        bsm.interpret_row(33, _cells(), [])


def test_row_merge_map_filters_horizontal_in_data_cols():
    merges = [(32, 4, 33, 4), (7, 4, 7, 8), (1, 1, 1, 18), (54, 3, 54, 18)]
    assert bsm.row_merge_map(merges) == {7: [(4, 8)], 1: [(1, 18)], 54: [(3, 18)]}
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/jyj/claude/cnejinhak && .venv-udm/bin/python -I -m pytest scripts/test_build_subject_matrix.py -q -k interpret 2>&1 | tail -3`
Expected: `AttributeError: ... no attribute 'interpret_row'`

- [ ] **Step 3: 구현 추가** (`read_sheet` 뒤에)

```python
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
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/jyj/claude/cnejinhak && .venv-udm/bin/python -I -m pytest scripts/test_build_subject_matrix.py -q 2>&1 | tail -3`
Expected: 모두 passed.

- [ ] **Step 5: 커밋**

```bash
cd /Users/jyj/claude/cnejinhak && git add scripts/build_subject_matrix.py scripts/test_build_subject_matrix.py && git commit -q -m "build_subject_matrix: 행 해석(병합·별표·메모·기타)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 3: 정오표·빌드·권역 조인·주입 CLI

**Files:**
- Modify: `scripts/build_subject_matrix.py` (끝에 추가)
- Modify: `scripts/test_build_subject_matrix.py` (끝에 추가)
- Modify: `sub2.html` (`<script id="matrix-data">` 블록이 `options-data` 뒤에 생김)

**Interfaces:**
- Produces: `ERRATA` 상수, `apply_errata(cells, merges) -> (cells, merges, excluded: dict[row->errata_id], warns: dict[row->str], errata_out: list[dict])`, `load_file1_regions(html_path) -> dict[university_display -> (region_group, region)]`, `build(cells, merges, regions: dict, built: str) -> dict` (원본 cells를 받아 내부에서 `apply_errata`를 적용하고 정정 전 값을 `raw`에 보존, 스펙 2.4 스키마), `inject(html_path, data) -> None`, `main(argv)`.
- JSON 레코드 키(프런트가 의존): `id, srcRow, unit, field, university, universityKey, regionGroup, region, marks, groups, allSubjects, stars, starAll, cellNotes, etc, warn, excluded, excludedReason, raw`. 최상위: `meta{year,source,built,sourceRows,records}, subjects[{key,label,short,group}], groups[{key,label}], units[{key,field,label,order}], records[], errata[{id,rows,unit,issue,action,basis}], unitLinks{}`.

- [ ] **Step 1: 실패하는 테스트 추가**

```python
def _mini_cells():
    """E1·E2·E6 검증용 최소 시트: 32–33행 경영 강원대 분리, 51행 충북대/충남대 혼재, 239행 조선대."""
    cells = {(32, 1): "사회", (32, 2): "경영", (32, 3): "강원대", (32, 5): "강원대", (32, 9): "강원대",
             (33, 1): "사회", (33, 2): "경영", (33, 3): "(춘천)", (33, 5): "(춘천)", (33, 9): "(춘천)",
             (51, 1): "사회", (51, 2): "경영", (51, 9): "충북대", (51, 10): "충남대",
             (55, 1): "사회", (55, 2): "경영", (55, 7): "한양대",
             (78, 1): "교육", (78, 2): "국어교육", (78, 3): "충북대", (78, 10): "충남대(역사/도덕포함)",
             (195, 1): "공학", (195, 2): "컴퓨터공학", (195, 4): "원광대",
             (239, 1): "예체능", (239, 2): "시각디자인", (239, 3): "조선대", (239, 10): "조선대"}
    merges = [(32, 4, 33, 4), (51, 10, 51, 13), (78, 10, 78, 13), (195, 4, 195, 8), (239, 10, 239, 14)]
    return cells, merges


def test_apply_errata_rules():
    cells, merges, excluded, warns, out = bsm.apply_errata(*_mini_cells())
    assert cells[(32, 3)] == "강원대(춘천)" and cells[(32, 5)] == "강원대(춘천)"
    assert not any(r == 33 for r, _ in cells)
    assert cells[(51, 10)] == "충북대"
    assert cells[(78, 10)] == "충북대(역사/도덕 포함)"
    assert excluded == {r: "E4" for r in range(195, 202)}
    assert 55 in warns and "자연" in warns[55]
    assert (239, 10, 239, 13) in merges and (239, 10, 239, 14) not in merges
    assert [e["id"] for e in out] == ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"]
    assert all({"id", "rows", "unit", "issue", "action", "basis"} <= set(e) for e in out)


def test_build_minimal():
    cells, merges = _mini_cells()
    data = bsm.build(cells, merges, {"강원대(춘천)": ("중부권", "강원"), "충북대": ("중부권", "충북")}, built="2026-10-16")
    recs = {r["srcRow"]: r for r in data["records"]}
    assert set(recs) == {32, 51, 55, 78, 195, 239}
    assert recs[32]["university"] == "강원대(춘천)" and recs[32]["regionGroup"] == "중부권" and recs[32]["marks"] == ["kor", "prob", "eng"]
    assert recs[51]["groups"] == ["soc"] and recs[51]["universityKey"] == "충북대"
    assert recs[55]["warn"] and recs[55]["excluded"] is False
    assert recs[195]["excluded"] is True and recs[195]["excludedReason"] == "E4"
    assert recs[239]["groups"] == ["soc"] and recs[239]["marks"] == ["kor"]
    assert recs[32]["raw"]["C"] == "강원대" and recs[32]["raw"]["merges"] == []
    assert recs[51]["universityKey"] == "충북대" and recs[55]["universityKey"] is None  # 한양대는 regions에 없음
    assert data["meta"]["records"] == 5 and data["meta"]["sourceRows"] == 7  # 원자료 7행(33행 포함)
    assert data["units"][10] == {"key": "computer-eng", "field": "공학", "label": "컴퓨터공학", "order": 11}
    assert data["subjects"][2] == {"key": "prob", "label": "확률과 통계", "short": "확통", "group": "math"}
    assert data["unitLinks"]["mech-eng"] == ["기계"]


def test_inject_idempotent_and_escaped(tmp_path):
    html = tmp_path / "sub2.html"
    html.write_text('<p>x</p>\n<script id="options-data" type="application/json">{"a":1}</script>\n<p>y</p>\n', encoding="utf-8")
    data = {"meta": {"note": "</script><b>"}, "records": []}
    bsm.inject(html, data)
    first = html.read_text(encoding="utf-8")
    assert first.count('<script id="matrix-data" type="application/json">') == 1
    assert "<\\/script><b>" in first and first.index("matrix-data") > first.index("options-data")
    bsm.inject(html, data)
    assert html.read_text(encoding="utf-8") == first


@pytest.mark.skipif(not XLSX.exists(), reason="원자료 없음")
def test_build_real_file_counts():
    cells, merges = bsm.read_sheet(XLSX)
    regions = bsm.load_file1_regions(HERE.parent / "sub2.html")
    data = bsm.build(cells, merges, regions, built="2026-10-16")
    active = [r for r in data["records"] if not r["excluded"]]
    assert len(active) == 233 and data["meta"]["records"] == 233 and data["meta"]["sourceRows"] == 241
    by_unit = {}
    for r in active:
        by_unit[r["unit"]] = by_unit.get(r["unit"], 0) + 1
    assert by_unit == {"eng-lit": 14, "philosophy": 13, "business": 24, "psychology": 11, "korean-edu": 11, "math-edu": 14,
                       "life-science": 16, "physics": 18, "chemistry": 21, "mech-eng": 24, "computer-eng": 28,
                       "pharmacy": 11, "medicine": 18, "visual-design": 5, "music": 1, "phys-ed": 4}
    recs = {r["srcRow"]: r for r in data["records"]}
    assert recs[54]["allSubjects"] and recs[54]["university"] == "한라대"
    assert recs[129]["marks"] == ["phy", "chem", "bio"]
    assert recs[55]["warn"] and recs[7]["starAll"] and recs[7]["groups"] == ["math", "soc"]
    assert recs[11]["etc"] == "제2외/한문" and recs[245]["university"] == "한국체대"
    assert [r for r in data["records"] if r["universityKey"] is None and not r["excluded"]] and \
        {r["university"] for r in data["records"] if r["universityKey"] is None} == {"동양대"}
    assert recs[243]["regionGroup"] == "영남권"
    assert len(data["errata"]) == 8
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/jyj/claude/cnejinhak && .venv-udm/bin/python -I -m pytest scripts/test_build_subject_matrix.py -q -k "errata or build or inject" 2>&1 | tail -3`
Expected: `AttributeError: ... 'apply_errata'`

- [ ] **Step 3: 구현 추가** (`interpret_row` 뒤에)

```python
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
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/jyj/claude/cnejinhak && .venv-udm/bin/python -I -m pytest scripts/test_build_subject_matrix.py -q 2>&1 | tail -3`
Expected: 모두 passed (실제 파일 테스트 포함). 실패하면 통합 테스트의 어느 assert인지 보고 해당 행의 `raw`를 `--json`으로 덤프해 규칙과 비교한다.

- [ ] **Step 5: 실제 주입 실행과 확인**

```bash
cd /Users/jyj/claude/cnejinhak && .venv-udm/bin/python -I scripts/build_subject_matrix.py "$HOME/Downloads/2028학년도 계열별 대표 모집단위별 반영과목.xlsx" --html sub2.html --json /tmp/matrix.json --inject && grep -c 'id="matrix-data"' sub2.html && git diff --stat && git diff sub2.html | grep -c '^[-+]<script id="records-data"'
```
Expected: 요약 4줄(원자료 241행 → 레코드 233건 (제외 7행) / 모집단위별 … / 파일 1 미매핑 대학: ['동양대'] / sub2.html matrix-data 갱신) + `1` + `sub2.html | 1 +` + 마지막 `0`(records-data 줄은 변경되지 않음). `/tmp/matrix.json` 크기는 100KB 미만.

- [ ] **Step 6: 커밋**

```bash
cd /Users/jyj/claude/cnejinhak && git add scripts/build_subject_matrix.py scripts/test_build_subject_matrix.py sub2.html && git commit -q -m "sub2: 반영과목 매트릭스 데이터(matrix-data) 주입 + 빌드 스크립트 완성

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 4: 패치 도구, 탭 바, 주입기, 프런트 골격

**Files:**
- Create: `scripts/patch_html.py`, `scripts/inject_udm.py`, `scripts/udm_src/udm.css`, `scripts/udm_src/pane.html`, `scripts/udm_src/pure.js`, `scripts/udm_src/app.js`, `scripts/test_udm_pure.mjs`
- Modify: `sub2.html` (탭 바, 패널 래퍼, 마커 4곳, export 2줄, 설명문 1줄)

**Interfaces:**
- Produces: `UDM.tabFromHash(hash) -> 'matrix'|'search'`; `window.udbOpenRecord(id)`, `window.udbFilterUniversity(universityDisplay, query)` (기존 udb IIFE); `sub2.html` 마커 `/* udm:css:start|end */`, `<!-- udm:pane:start|end -->`, `/* udm:js:start|end */`; 섹션 `#univDB[data-tab]`; 탭 버튼 `.udb-tab[data-tab]`; 패널 `#udbPaneSearch`, `#udbPaneMatrix`.
- `app.js`의 `activateTab(name, {hash, scroll, focus})`, `renderAll()`(Task 5가 완성), 상태 `st`.

- [ ] **Step 1: 패치 도구 작성** — `scripts/patch_html.py`

```python
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
g.add_argument("--after"); g.add_argument("--before"); g.add_argument("--replace-line"); g.add_argument("--replace-text")
p.add_argument("--file"); p.add_argument("--with", dest="with_")
a = p.parse_args()
path = Path(a.html)
text = path.read_text(encoding="utf-8")
if a.replace_text is not None:
    if text.count(a.replace_text) != 1:
        sys.exit(f"문자열이 {text.count(a.replace_text)}회 등장(정확히 1회 필요): {a.replace_text!r}")
    path.write_text(text.replace(a.replace_text, a.with_ or "", 1), encoding="utf-8")
    print("ok: text replaced"); sys.exit(0)
anchor = a.after or a.before or a.replace_line
lines = text.split("\n")
hits = [i for i, l in enumerate(lines) if anchor in l]
if len(hits) != 1:
    sys.exit(f"앵커가 {len(hits)}줄에 매칭(정확히 1줄 필요): {anchor!r}")
part = Path(a.file).read_text(encoding="utf-8").rstrip("\n").split("\n")
i = hits[0]
if a.after: lines[i + 1:i + 1] = part
elif a.before: lines[i:i] = part
else: lines[i:i + 1] = part
path.write_text("\n".join(lines), encoding="utf-8")
print(f"ok: {len(part)}줄 → {i + 1}행 부근")
```

- [ ] **Step 2: 주입기 작성** — `scripts/inject_udm.py`

```python
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
```

- [ ] **Step 3: 순수 함수 테스트(실패) 작성** — `scripts/test_udm_pure.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'udm_src', 'pure.js'), 'utf8');
const UDM = new Function(src + '\n;return UDM;')();

test('tabFromHash', () => {
  assert.equal(UDM.tabFromHash('#univDB-matrix'), 'matrix');
  assert.equal(UDM.tabFromHash('#univDB'), 'search');
  assert.equal(UDM.tabFromHash(''), 'search');
});
```

Run: `cd /Users/jyj/claude/cnejinhak && node --test scripts/test_udm_pure.mjs 2>&1 | tail -3`
Expected: 실패 (`ENOENT ... pure.js`).

- [ ] **Step 4: pure.js 작성** — `scripts/udm_src/pure.js`

```js
/* ---------- udm 순수 함수 (DOM 없음, node:test 대상) ---------- */
const UDM = {
  tabFromHash(hash) { return hash === '#univDB-matrix' ? 'matrix' : 'search'; }
};
```

Run: `node --test scripts/test_udm_pure.mjs 2>&1 | tail -3` → Expected: `pass 1`.

- [ ] **Step 5: 탭 바 CSS 작성** — `scripts/udm_src/udm.css`

```css
/* ===== univ-matrix (udm) ===== */
.udb-tabs{display:flex;gap:6px;padding:5px;background:#eef2f8;border:1px solid var(--line);border-radius:16px;margin-bottom:16px}
.udb-tab{flex:1;border:0;background:transparent;border-radius:12px;padding:.8rem .9rem;font-weight:850;font-size:.95rem;color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;transition:.13s background ease,.13s color ease}
.udb-tab .tct{font-size:.74rem;font-weight:800;background:rgba(15,47,95,.08);border-radius:999px;padding:.12rem .5rem;color:#475569}
.udb-tab.on{background:#fff;color:var(--navy);box-shadow:0 2px 8px rgba(15,47,95,.14)}
.udb-tab.on .tct{background:var(--sky);color:var(--navy)}
.udb-tab:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
#univDB[data-tab="matrix"] #udbResultCount{display:none}
.udm-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px 14px;margin:14px 0 10px}
.udm-head strong{font-size:1.15rem;letter-spacing:-.03em}
.udm-head span{color:var(--muted);font-size:.88rem}
@media(max-width:680px){.udb-tab{font-size:.88rem;padding:.7rem .5rem}}
```

- [ ] **Step 6: 패널 골격 작성** — `scripts/udm_src/pane.html`

```html
<div id="udbPaneMatrix" class="udb-pane" role="tabpanel" aria-labelledby="udbTabMatrix" hidden>
  <div class="notice" style="margin-bottom:16px">
    <strong>안내:</strong> 2028학년도 「계열별 대표 모집단위별 반영과목」을 과목 축 15개로 정리한 매트릭스입니다. ●는 그 대학이 해당 과목을 반영과목으로 안내했다는 뜻이고, 띠는 교과 전체(세부 과목 지정 없음)를 뜻합니다. 정확한 반영 기준과 최신 변경 사항은 각 대학 입학처 모집요강을 반드시 확인하세요.
    <button class="btn btn-outline udm-errata-btn" type="button" id="udmErrataBtn">정오표·해석 규칙 보기</button>
  </div>
  <div class="udm-legend" id="udmLegend"></div>
  <div class="udm-units" id="udmUnits"></div>
  <div class="udm-tools" id="udmTools">
    <div class="udb-seg udm-viewseg" id="udmViewSeg">
      <button type="button" data-view="unit" class="on">모집단위별 보기</button>
      <button type="button" data-view="subject">과목별 보기</button>
    </div>
    <select class="udb-mini-select" id="udmRegion" aria-label="권역"></select>
    <input class="udm-search" id="udmSearch" type="search" placeholder="대학명 검색" autocomplete="off" aria-label="대학명 검색">
    <select class="udb-mini-select" id="udmSort" aria-label="정렬">
      <option value="source">원자료 순</option>
      <option value="name">대학명순</option>
      <option value="count">반영 과목 많은 순</option>
      <option value="region">권역·지역순</option>
      <option value="missing">부족 과목 적은 순</option>
    </select>
    <button class="btn btn-dark udm-check-btn" type="button" id="udmCheckBtn" aria-pressed="false">내 이수과목 점검</button>
  </div>
  <div class="udm-check" id="udmCheck" hidden></div>
  <div class="udm-head" id="udmHead"></div>
  <div id="udmResult" aria-live="polite"></div>
  <div class="udm-subject" id="udmSubject" hidden></div>
</div>
```

- [ ] **Step 7: app.js 골격 작성** — `scripts/udm_src/app.js`

```js
/* ---------- udm 앱: 탭·상태·렌더·이벤트 ---------- */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const section = $('univDB');
  const paneSearch = $('udbPaneSearch'), paneMatrix = $('udbPaneMatrix');
  if (!section || !paneSearch || !paneMatrix) return;
  const tabs = [...section.querySelectorAll('.udb-tab')];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = (k, fb) => { try { const v = localStorage.getItem(k); return v === null ? fb : v; } catch { return fb; } };
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 사생활 모드 등 */ } };

  let M = null, FILE1 = [];
  try {
    M = JSON.parse($('matrix-data').textContent);
    FILE1 = JSON.parse($('records-data').textContent);
  } catch (e) {
    paneMatrix.innerHTML = '<div class="empty" style="padding:40px">매트릭스 자료를 불러오지 못했습니다.</div>';
  }

  const st = {
    tab: 'search', unit: '', view: 'unit', region: '', q: '', sort: 'source',
    check: false, mySubs: new Set(), subject: 'calc2', includeGroups: true
  };
  let rendered = false;

  /* ---------- 탭 ---------- */
  function activateTab(name, opts = {}) {
    st.tab = name; section.dataset.tab = name;
    tabs.forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
    });
    paneSearch.hidden = name !== 'search'; paneMatrix.hidden = name !== 'matrix';
    const hash = name === 'matrix' ? '#univDB-matrix' : '#univDB';
    if (opts.hash !== false && location.hash !== hash) history.replaceState(null, '', hash);
    store('udb2028.tab', name);
    if (name === 'matrix' && M && !rendered) { rendered = true; renderAll(); }
    if (opts.scroll) section.scrollIntoView({ block: 'start' });
    if (opts.focus) { const b = tabs.find(x => x.dataset.tab === name); if (b) b.focus(); }
  }
  function bindTabs() {
    tabs.forEach(b => b.addEventListener('click', () => activateTab(b.dataset.tab)));
    section.querySelector('.udb-tabs').addEventListener('keydown', e => {
      const i = tabs.indexOf(document.activeElement); if (i < 0) return;
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j === null) return;
      e.preventDefault(); activateTab(tabs[j].dataset.tab, { focus: true });
    });
    window.addEventListener('hashchange', () => {
      if (location.hash === '#univDB-matrix') activateTab('matrix', { hash: false });
      else if (location.hash === '#univDB') activateTab('search', { hash: false });
    });
    // 전공 카드·대학명 진입점은 검색 탭을 먼저 켠다 (기존 함수는 수정하지 않고 감싼다)
    ['udbSearchByMajor', 'udbSearchUniversity'].forEach(fn => {
      const orig = window[fn]; if (typeof orig !== 'function') return;
      window[fn] = function () { activateTab('search'); return orig.apply(this, arguments); };
    });
  }

  /* ---------- 렌더(골격: 자료 요약 1줄) ---------- */
  function renderAll() {
    $('udmHead').innerHTML = `<strong>매트릭스 자료 ${M.meta.records}건</strong><span>대표 모집단위 ${M.units.length}개 · 정리 ${esc(M.meta.built)}</span>`;
  }

  /* ---------- 부트 ---------- */
  function init() {
    bindTabs();
    const h = location.hash;
    const initial = h === '#univDB-matrix' ? 'matrix' : h === '#univDB' ? 'search'
      : (read('udb2028.tab', 'search') === 'matrix' ? 'matrix' : 'search');
    activateTab(initial, { hash: false });
  }
  init();
})();
```

- [ ] **Step 8: sub2.html 일회성 구조 패치** (순서대로, 각 명령은 `ok:`를 출력해야 함)

```bash
cd /Users/jyj/claude/cnejinhak && P=.venv-udm/bin/python && T=$(mktemp -d) && \
printf '%s\n' '<div class="udb-tabs" role="tablist" aria-label="자료 선택">' \
'  <button type="button" role="tab" id="udbTabSearch" class="udb-tab on" data-tab="search" aria-selected="true" aria-controls="udbPaneSearch">대학별 권장과목 검색 <span class="tct">1,358건</span></button>' \
'  <button type="button" role="tab" id="udbTabMatrix" class="udb-tab" data-tab="matrix" aria-selected="false" aria-controls="udbPaneMatrix" tabindex="-1">전공별 반영과목 매트릭스 <span class="tct">16개 대표 모집단위</span></button>' \
'</div>' \
'<div id="udbPaneSearch" class="udb-pane" role="tabpanel" aria-labelledby="udbTabSearch">' > $T/tabs.html && \
$P scripts/patch_html.py sub2.html --before '<div class="notice" style="margin-bottom:16px">' --file $T/tabs.html && \
printf '%s\n' '</div><!-- /udbPaneSearch -->' '<!-- udm:pane:start -->' '<!-- udm:pane:end -->' > $T/pane.html && \
$P scripts/patch_html.py sub2.html --after '<nav class="udb-pager" id="udbPager"' --file $T/pane.html && \
printf '%s\n' '/* udm:css:start */' '/* udm:css:end */' > $T/css.txt && \
$P scripts/patch_html.py sub2.html --before '</style>' --file $T/css.txt && \
printf '%s\n' '<script>' '/* udm:js:start */' '/* udm:js:end */' '</script>' > $T/js.txt && \
$P scripts/patch_html.py sub2.html --after 'class="scroll-top" id="scrollTopBtn"' --file $T/js.txt && \
printf '%s\n' '  // 매트릭스 탭(udm)에서 쓰는 진입점: 상세 모달 열기 / 대학 필터 + 검색어 적용' \
'  window.udbOpenRecord = openDetail;' \
'  window.udbFilterUniversity = function (univ, q) { resetAll(); st.university = univ || ""; st.query = q || ""; refreshSelects(); syncControls(); applyFilters(); };' > $T/exports.txt && \
$P scripts/patch_html.py sub2.html --before '  // 대학명 직접 검색용 보조 진입점' --file $T/exports.txt && \
$P scripts/patch_html.py sub2.html --replace-text '2028학년도 권역별·대학별 자료 1,358건을 검색·비교할 수 있습니다.</p>' --with '2028학년도 권역별·대학별 권장과목 1,358건 검색과, 16개 대표 모집단위의 대학별 반영과목 매트릭스를 제공합니다.</p>' && \
$P scripts/inject_udm.py && grep -c 'udm:' sub2.html
```
Expected: `ok:` 6회, `ok: text replaced`, `injected`, 마지막 숫자 `6`. 앵커가 1줄이 아니라는 오류가 나면 `grep -n '<앵커>' sub2.html`로 실제 줄을 확인하고 더 긴 앵커 부분 문자열로 재시도한다(패치는 실패 시 파일을 바꾸지 않는다).

- [ ] **Step 9: 브라우저 확인**

`preview_start {name: "cnejinhak-fresh"}` → `navigate` `http://localhost:8756/sub2.html#univDB-matrix` → `read_console_messages {onlyErrors:true}` 에 오류 없음 → `javascript_tool`:
```js
({ tab: document.getElementById('univDB').dataset.tab, matrixHidden: document.getElementById('udbPaneMatrix').hidden, searchHidden: document.getElementById('udbPaneSearch').hidden, head: document.getElementById('udmHead').textContent, count: document.getElementById('udbResultCount').textContent, hasExports: typeof udbOpenRecord + '/' + typeof udbFilterUniversity })
```
Expected: `tab:"matrix", matrixHidden:false, searchHidden:true, head: "매트릭스 자료 233건대표 모집단위 16개 · 정리 <Task 3 빌드일>", count: "1,358건 / 전체 1,358건", hasExports:"function/function"`.
그 다음 `computer {action:'left_click', ref: <#udbTabSearch>}` 후 같은 스크립트로 `tab:"search"`, `location.hash === '#univDB'` 확인. `navigate` `http://localhost:8756/sub2.html`(해시 없음) → 저장된 탭(search)이 복원되고 해시가 추가되지 않음(`location.hash === ''`).

- [ ] **Step 10: 커밋**

```bash
cd /Users/jyj/claude/cnejinhak && git add scripts/patch_html.py scripts/inject_udm.py scripts/udm_src/udm.css scripts/udm_src/pane.html scripts/udm_src/pure.js scripts/udm_src/app.js scripts/test_udm_pure.mjs sub2.html && git commit -q -m "sub2 #univDB: 검색/매트릭스 탭 바와 udm 프런트 골격

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 5: 매트릭스 보기 — 모집단위 칩, 도구, 표/카드, 푸터 집계

**Files:**
- Modify: `scripts/udm_src/pure.js` (`indexByUnit`, `footerCounts` 추가)
- Modify: `scripts/udm_src/udm.css` (매트릭스 스타일 추가)
- Modify: `scripts/udm_src/app.js` (전체 교체)
- Modify: `scripts/test_udm_pure.mjs`

**Interfaces:**
- Produces: `UDM.indexByUnit(records) -> Map<unitKey, record[]>` (excluded 제외, srcRow 순), `UDM.footerCounts(records, subjects, groups) -> {marks:{subjectKey:n}, groups:{groupKey:n}}`.
- `app.js`: `visibleRecords()`, `renderUnits()`, `renderTools()`, `renderHead(recs)`, `renderTable(recs)`, `renderCards(recs)`, `renderView()`, `bind()`; 상태 키 `st.unit`(localStorage `udb2028.mUnit`), `st.region`, `st.q`, `st.sort`.
- 이 Task의 `renderView()`·`bind()`는 Task 6–9가 정의할 함수(`toggleCheck`, `renderCheck`, `onSubjectToggle`, `renderSubjectView`, `onSubjectViewChange`, `linkToSearch`, `openErrata`)를 `typeof fn === 'function'` 가드로 호출한다. 함수 선언은 IIFE 안에서 호이스팅되므로 Task 6–9는 같은 IIFE 안에 선언만 추가하면 되고, 가드는 그 전까지 아무 동작도 하지 않게 한다(`typeof`는 미선언 식별자에도 안전).

- [ ] **Step 1: 순수 함수 테스트 추가**

```js
const S = [
  { key: 'kor', group: 'kor' }, { key: 'alg', group: 'math' }, { key: 'calc2', group: 'math' },
  { key: 'eng', group: 'eng' }, { key: 'soc', group: 'soc' }, { key: 'phy', group: 'sci' }, { key: 'chem', group: 'sci' }
];
const G = [{ key: 'kor' }, { key: 'math' }, { key: 'eng' }, { key: 'soc' }, { key: 'sci' }];
const R = [
  { id: 'a', srcRow: 20, unit: 'mech-eng', marks: ['calc2', 'phy'], groups: [], allSubjects: false, excluded: false },
  { id: 'b', srcRow: 10, unit: 'mech-eng', marks: ['kor'], groups: ['math'], allSubjects: false, excluded: false },
  { id: 'c', srcRow: 30, unit: 'mech-eng', marks: [], groups: ['kor', 'math', 'eng', 'soc', 'sci'], allSubjects: true, excluded: false },
  { id: 'x', srcRow: 40, unit: 'mech-eng', marks: ['phy'], groups: [], allSubjects: false, excluded: true },
  { id: 'd', srcRow: 5, unit: 'physics', marks: ['phy'], groups: [], allSubjects: false, excluded: false }
];

test('indexByUnit drops excluded and sorts by srcRow', () => {
  const idx = UDM.indexByUnit(R);
  assert.deepEqual(idx.get('mech-eng').map(r => r.id), ['b', 'a', 'c']);
  assert.deepEqual(idx.get('physics').map(r => r.id), ['d']);
  assert.equal(idx.has('music'), false);
});

test('footerCounts counts marks and whole-group bands', () => {
  const fc = UDM.footerCounts(UDM.indexByUnit(R).get('mech-eng'), S, G);
  assert.deepEqual(fc.marks, { kor: 1, alg: 0, calc2: 1, eng: 0, soc: 0, phy: 1, chem: 0 });
  assert.deepEqual(fc.groups, { kor: 1, math: 2, eng: 1, soc: 1, sci: 1 });
});

test('footerCounts on empty input is all zeros', () => {
  const fc = UDM.footerCounts([], S, G);
  assert.equal(Object.values(fc.marks).reduce((a, b) => a + b, 0), 0);
  assert.equal(Object.values(fc.groups).reduce((a, b) => a + b, 0), 0);
});
```

Run: `node --test scripts/test_udm_pure.mjs 2>&1 | tail -3` → Expected: 3 fail.

- [ ] **Step 2: pure.js에 추가** (`tabFromHash` 뒤, 객체 안)

```js
  indexByUnit(records) {
    const m = new Map();
    records.filter(r => !r.excluded).sort((a, b) => a.srcRow - b.srcRow)
      .forEach(r => { if (!m.has(r.unit)) m.set(r.unit, []); m.get(r.unit).push(r); });
    return m;
  },
  footerCounts(records, subjects, groups) {
    const marks = {}, grp = {};
    subjects.forEach(s => { marks[s.key] = 0; });
    groups.forEach(g => { grp[g.key] = 0; });
    records.forEach(r => {
      r.marks.forEach(k => { if (k in marks) marks[k]++; });
      const gs = r.allSubjects ? groups.map(g => g.key) : r.groups;
      gs.forEach(g => { if (g in grp) grp[g]++; });
    });
    return { marks, groups: grp };
  }
```
(앞 메서드 `tabFromHash(...) { ... }` 뒤에 쉼표를 붙인다.)

Run: `node --test scripts/test_udm_pure.mjs 2>&1 | tail -3` → Expected: `pass 4`.

- [ ] **Step 3: 매트릭스 CSS 추가** — `scripts/udm_src/udm.css` 끝에

```css
/* 범례 */
.udm-legend{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin-bottom:12px;color:var(--muted);font-size:.82rem;font-weight:800}
.udm-legend .dot,.udm-cell .dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--navy);vertical-align:middle}
.udm-legend .band{display:inline-block;padding:.05rem .5rem;border-radius:6px;background:var(--sky);color:var(--navy);font-weight:850}
/* 모집단위 칩 */
.udm-units{display:grid;gap:8px;margin-bottom:14px}
.udm-field{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.udm-field-l{min-width:52px;color:var(--muted);font-size:.8rem;font-weight:850}
.udm-unit{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;color:#475569;border-radius:999px;padding:.42rem .75rem;font-weight:850;font-size:.86rem;cursor:pointer;transition:.13s all ease}
.udm-unit:hover{border-color:rgba(37,99,235,.5)}
.udm-unit .ct{color:var(--muted);font-size:.76rem;font-weight:800}
.udm-unit.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.udm-unit.on .ct{color:rgba(255,255,255,.78)}
/* 도구 행 */
.udm-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:10px 12px;box-shadow:var(--shadow)}
.udm-viewseg{max-width:300px;flex:1 1 220px}
.udm-search{flex:1 1 160px;min-width:140px;padding:.6rem .8rem;border-radius:12px;border:1px solid var(--line);font-weight:700}
.udm-check-btn[aria-pressed="true"]{background:var(--green)}
/* 표 */
.udm-table-wrap{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:#fff;box-shadow:var(--shadow)}
.udm-table-scroll{overflow:auto;max-height:75vh}
.udm-table{border-collapse:separate;border-spacing:0;font-size:.82rem;min-width:900px;width:100%}
.udm-table th,.udm-table td{border-bottom:1px solid var(--line);border-right:1px solid #eef2f8;padding:6px 6px;text-align:center;vertical-align:middle}
.udm-table thead th{position:sticky;z-index:3;background:var(--sky);color:var(--navy);font-weight:850;white-space:nowrap}
.udm-table thead tr:first-child th{top:0}
.udm-table thead tr:last-child th{top:34px;font-size:.76rem}
.udm-table thead th .short{display:none}
.udm-table th.udm-uni-h,.udm-table th.udm-uni{position:sticky;left:0;z-index:2;text-align:left;background:#fff;min-width:150px;max-width:220px}
.udm-table thead th.udm-uni-h{z-index:4;background:var(--sky)}
.udm-table tfoot th{position:sticky;left:0;bottom:0;z-index:4;background:#f8fbff;text-align:left}
.udm-table tfoot td{position:sticky;bottom:0;z-index:3;background:#f8fbff}
.udm-uni-btn{border:0;background:transparent;padding:0;font:inherit;font-weight:850;color:var(--navy);cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}
.udm-uni-btn:hover{color:var(--blue)}
.udm-reg{display:block;color:var(--muted);font-size:.72rem;font-weight:800}
.udm-warn{margin-left:4px;color:#b45309;cursor:help}
.udm-cell.on{background:#f3f8ff}
.udm-cell sup{color:#b45309;font-size:.7em;margin-left:1px}
.udm-cell .nt{color:#92400e;font-style:normal;font-size:.7em;margin-left:2px}
.udm-cell .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.udm-band{background:var(--sky);color:var(--navy);font-weight:850;font-size:.76rem;border-radius:6px}
.udm-cell.ok,.udm-band.ok{background:var(--mint)}
.udm-cell.ok .dot{background:var(--green)}
.udm-cell.miss,.udm-band.miss{background:#fff3e0}
.udm-cell.miss .dot{background:#d97706}
.udm-band.miss{color:#92400e}
.udm-etc{font-size:.76rem;color:#713f12;min-width:90px;max-width:160px;word-break:keep-all}
.udm-cnt{white-space:nowrap;color:var(--muted);font-weight:800;font-size:.76rem}
.udm-table tbody tr:hover td,.udm-table tbody tr:hover th{background:#f8fbff}
.udm-table .hl{background:#fffbea}
.udm-table tr.udm-hl th,.udm-table tr.udm-hl td{background:var(--yellow)}
.udm-foot b{display:block;color:var(--navy)}
.udm-foot small{color:#6d28d9;font-weight:800}
.udm-foot .bar{display:block;height:4px;background:#e2e8f0;border-radius:2px;margin-top:3px;overflow:hidden}
.udm-foot .bar i{display:block;height:100%;background:var(--blue)}
.udm-badge{display:inline-block;margin-left:5px;border-radius:7px;padding:.12rem .45rem;font-size:.72rem;font-weight:850;vertical-align:middle}
.udm-badge.ok{background:var(--mint);color:#046c4e}
.udm-badge.miss{background:#fef3c7;color:#92400e;cursor:help}
/* 카드(모바일) */
.udm-cards{display:grid;gap:10px}
.udm-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px 14px;box-shadow:0 8px 20px rgba(15,47,95,.06)}
.udm-card-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px}
.udm-chips{display:flex;flex-wrap:wrap;gap:5px}
.udm-chip{display:inline-flex;align-items:center;gap:3px;border-radius:999px;padding:.22rem .55rem;font-size:.78rem;font-weight:800;background:#f3f6fb;color:#334155}
.udm-chip.band{background:var(--sky);color:var(--navy)}
.udm-chip.ok{background:var(--mint);color:#046c4e}
.udm-chip.miss{background:#fef3c7;color:#92400e}
.udm-chip.link{cursor:pointer;border:1px solid var(--line);background:#fff}
.udm-chip.link:hover{border-color:var(--blue);color:var(--blue)}
.udm-chip .gl{color:var(--muted);font-weight:700}
@media(max-width:1050px){.udm-table thead th .full{display:none}.udm-table thead th .short{display:inline}}
@media print{.udm-tools,.udm-units,.udm-errata-btn,.udb-tabs{display:none!important}.udm-table-scroll{max-height:none;overflow:visible}.udm-table{min-width:0;font-size:.7rem}}
```

- [ ] **Step 4: app.js 전체 교체** — `scripts/udm_src/app.js`

```js
/* ---------- udm 앱: 탭·상태·렌더·이벤트 ---------- */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const section = $('univDB');
  const paneSearch = $('udbPaneSearch'), paneMatrix = $('udbPaneMatrix');
  if (!section || !paneSearch || !paneMatrix) return;
  const tabs = [...section.querySelectorAll('.udb-tab')];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = (k, fb) => { try { const v = localStorage.getItem(k); return v === null ? fb : v; } catch { return fb; } };
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 사생활 모드 등 */ } };
  const NF = new Intl.NumberFormat('ko-KR');
  const COL = new Intl.Collator('ko-KR', { numeric: true });
  const REGIONS = ['수도권', '영남권', '중부권', '호남권'];
  const DEFAULT_UNIT = 'computer-eng';
  const mobile = window.matchMedia('(max-width: 680px)');

  let M = null, FILE1 = [];
  try {
    M = JSON.parse($('matrix-data').textContent);
    FILE1 = JSON.parse($('records-data').textContent);
  } catch (e) {
    paneMatrix.innerHTML = '<div class="empty" style="padding:40px">매트릭스 자료를 불러오지 못했습니다.</div>';
  }

  const st = {
    tab: 'search', unit: '', view: 'unit', region: '', q: '', sort: 'source',
    check: false, mySubs: new Set(), subject: 'calc2', includeGroups: true
  };
  let rendered = false;
  let byUnit = new Map(), byId = new Map(), UNIT_BY_KEY = new Map(), SUBJ_BY_GROUP = {}, SUBJ_BY_KEY = {}, GROUP_LABEL = {};
  if (M) {
    byUnit = UDM.indexByUnit(M.records);
    byId = new Map(M.records.map(r => [r.id, r]));
    UNIT_BY_KEY = new Map(M.units.map(u => [u.key, u]));
    M.subjects.forEach(s => { (SUBJ_BY_GROUP[s.group] = SUBJ_BY_GROUP[s.group] || []).push(s.key); SUBJ_BY_KEY[s.key] = s; });
    M.groups.forEach(g => { GROUP_LABEL[g.key] = g.label; });
  }
  const el = {
    legend: $('udmLegend'), units: $('udmUnits'), tools: $('udmTools'), viewSeg: $('udmViewSeg'),
    region: $('udmRegion'), search: $('udmSearch'), sort: $('udmSort'), checkBtn: $('udmCheckBtn'),
    check: $('udmCheck'), head: $('udmHead'), result: $('udmResult'), subject: $('udmSubject'), errataBtn: $('udmErrataBtn')
  };

  /* ---------- 탭 ---------- */
  function activateTab(name, opts = {}) {
    st.tab = name; section.dataset.tab = name;
    tabs.forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
    });
    paneSearch.hidden = name !== 'search'; paneMatrix.hidden = name !== 'matrix';
    const hash = name === 'matrix' ? '#univDB-matrix' : '#univDB';
    if (opts.hash !== false && location.hash !== hash) history.replaceState(null, '', hash);
    store('udb2028.tab', name);
    if (name === 'matrix' && M && !rendered) { rendered = true; renderAll(); }
    if (opts.scroll) section.scrollIntoView({ block: 'start' });
    if (opts.focus) { const b = tabs.find(x => x.dataset.tab === name); if (b) b.focus(); }
  }
  function bindTabs() {
    tabs.forEach(b => b.addEventListener('click', () => activateTab(b.dataset.tab)));
    section.querySelector('.udb-tabs').addEventListener('keydown', e => {
      const i = tabs.indexOf(document.activeElement); if (i < 0) return;
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j === null) return;
      e.preventDefault(); activateTab(tabs[j].dataset.tab, { focus: true });
    });
    window.addEventListener('hashchange', () => {
      if (location.hash === '#univDB-matrix') activateTab('matrix', { hash: false });
      else if (location.hash === '#univDB') activateTab('search', { hash: false });
    });
    ['udbSearchByMajor', 'udbSearchUniversity'].forEach(fn => {
      const orig = window[fn]; if (typeof orig !== 'function') return;
      window[fn] = function () { activateTab('search'); return orig.apply(this, arguments); };
    });
  }

  /* ---------- 데이터 선택 ---------- */
  function visibleRecords() {
    let rs = (byUnit.get(st.unit) || []).slice();
    if (st.region) rs = rs.filter(r => r.regionGroup === st.region);
    if (st.q) { const q = st.q.toLowerCase(); rs = rs.filter(r => r.university.toLowerCase().includes(q)); }
    const score = r => r.allSubjects ? 99 : r.marks.length + r.groups.length * 3;
    const missN = r => { const e = UDM.evaluate(r, st.mySubs, SUBJ_BY_GROUP); return e.ok ? 0 : e.missing.length + e.groupsMissing.length + (r.allSubjects ? 1 : 0); };
    if (st.sort === 'name') rs.sort((a, b) => COL.compare(a.university, b.university));
    else if (st.sort === 'count') rs.sort((a, b) => score(b) - score(a) || COL.compare(a.university, b.university));
    else if (st.sort === 'region') rs.sort((a, b) => REGIONS.indexOf(a.regionGroup) - REGIONS.indexOf(b.regionGroup) || COL.compare(a.region || '', b.region || '') || COL.compare(a.university, b.university));
    else if (st.sort === 'missing' && st.check && typeof UDM.evaluate === 'function') rs.sort((a, b) => missN(a) - missN(b) || COL.compare(a.university, b.university));
    else rs.sort((a, b) => a.srcRow - b.srcRow);
    return rs;
  }
  const evalOf = r => (st.check && typeof UDM.evaluate === 'function') ? UDM.evaluate(r, st.mySubs, SUBJ_BY_GROUP) : null;
  function missingLabel(ev) {
    return [...ev.missing.map(k => SUBJ_BY_KEY[k].label), ...ev.groupsMissing.map(g => GROUP_LABEL[g] + ' 전체')].join(', ');
  }

  /* ---------- 렌더 ---------- */
  function renderLegend() {
    el.legend.innerHTML = `<span><span class="dot"></span> 반영과목</span><span><span class="band">수학 전체</span> 교과 전체(세부 지정 없음)</span>
      <span>✱ 원자료 별표(일반선택 이수 후 진로·적성에 맞게 이수 권장)</span><span>※ 셀 메모(예: 역사/도덕 포함)</span><span>⚠ 원자료 확인 필요</span>`;
  }
  function renderUnits() {
    const fields = [...new Set(M.units.map(u => u.field))];
    el.units.innerHTML = fields.map(f => `<div class="udm-field"><span class="udm-field-l">${esc(f)}</span>${
      M.units.filter(u => u.field === f).map(u => `<button type="button" class="udm-unit ${u.key === st.unit ? 'on' : ''}" data-udm-unit="${u.key}" aria-pressed="${u.key === st.unit}">${esc(u.label)}<span class="ct">${(byUnit.get(u.key) || []).length}</span></button>`).join('')
    }</div>`).join('');
  }
  function renderTools() {
    el.region.innerHTML = `<option value="">전체 권역</option>` + REGIONS.map(r => `<option value="${r}">${r}</option>`).join('');
    el.region.value = st.region; el.search.value = st.q; el.sort.value = st.sort;
    el.viewSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === st.view));
    el.checkBtn.setAttribute('aria-pressed', st.check ? 'true' : 'false');
    el.sort.querySelector('[value="missing"]').disabled = !st.check;
  }
  function renderHead(recs) {
    const u = UNIT_BY_KEY.get(st.unit);
    let extra = '';
    if (st.check) { const ok = recs.filter(r => evalOf(r).ok).length; extra = ` · 내 과목으로 충족 <b>${ok}</b> / ${recs.length}`; }
    el.head.innerHTML = `<strong>${esc(u.field)} · ${esc(u.label)}</strong><span>${NF.format(recs.length)}개 대학 · 권역 ${esc(st.region || '전체')}${st.q ? ` · "${esc(st.q)}"` : ''}${extra}</span>`;
  }
  function cellsFor(r, ev) {
    let out = '';
    M.groups.forEach(g => {
      const gcols = M.subjects.filter(c => c.group === g.key);
      if (r.groups.includes(g.key)) {
        const gOk = ev ? !ev.groupsMissing.includes(g.key) : null;
        const star = r.starAll || gcols.some(c => r.stars.includes(c.key));
        const note = gcols.map(c => r.cellNotes[c.key]).find(Boolean);
        out += `<td colspan="${gcols.length}" class="udm-band ${gOk === null ? '' : gOk ? 'ok' : 'miss'}" title="${esc(g.label)} 교과 전체(세부 과목 지정 없음)${note ? ' · ' + esc(note) : ''}">${esc(g.label)} 전체${star ? '<sup>✱</sup>' : ''}${note ? '<i class="nt">※</i>' : ''}</td>`;
        return;
      }
      gcols.forEach(c => {
        const on = r.marks.includes(c.key);
        const star = on && (r.starAll || r.stars.includes(c.key));
        const note = on ? r.cellNotes[c.key] : null;
        let cls = 'udm-cell' + (on ? ' on' : '');
        if (on && ev) cls += st.mySubs.has(c.key) ? ' ok' : ' miss';
        out += `<td class="${cls}" data-col="${c.key}"${note ? ` title="${esc(note)}"` : ''}>${on ? `<span class="dot"></span><span class="sr">${esc(c.label)} 반영</span>` : ''}${star ? '<sup>✱</sup>' : ''}${note ? '<i class="nt">※</i>' : ''}</td>`;
      });
    });
    return out;
  }
  function uniCell(r, ev) {
    const badge = !ev ? '' : ev.ok ? '<span class="udm-badge ok">충족</span>'
      : `<span class="udm-badge miss" title="부족: ${esc(missingLabel(ev) || '선택한 과목 없음')}">부족 ${ev.missing.length + ev.groupsMissing.length + (r.allSubjects ? 1 : 0)}</span>`;
    return `<button type="button" class="udm-uni-btn" data-udm-link="${r.id}" title="권장과목 원문 보기">${esc(r.university)}</button>${r.warn ? `<span class="udm-warn" title="${esc(r.warn)}">⚠</span>` : ''}${badge}<span class="udm-reg">${esc(r.regionGroup || '권역 미상')}${r.region ? ' · ' + esc(r.region) : ''}</span>`;
  }
  function countLabel(r) { return r.allSubjects ? '전 교과' : `${r.marks.length}과목${r.groups.length ? ` +교과 ${r.groups.length}` : ''}`; }

  function renderTable(recs) {
    const head1 = M.groups.map(g => `<th colspan="${M.subjects.filter(c => c.group === g.key).length}">${esc(g.label)}</th>`).join('');
    const head2 = M.subjects.map(c => `<th data-col="${c.key}"><span class="full">${esc(c.label)}</span><span class="short">${esc(c.short)}</span></th>`).join('');
    const rows = recs.map(r => {
      const ev = evalOf(r);
      return `<tr data-id="${r.id}"><th scope="row" class="udm-uni">${uniCell(r, ev)}</th>${cellsFor(r, ev)}<td class="udm-etc">${r.etc === null ? '' : esc(r.etc || '기타')}</td><td class="udm-cnt">${countLabel(r)}</td></tr>`;
    }).join('');
    const fc = UDM.footerCounts(recs, M.subjects, M.groups), N = recs.length;
    const foot = M.subjects.map(c => {
      const k = fc.marks[c.key], gk = fc.groups[c.group], pct = N ? Math.round(k / N * 100) : 0;
      return `<td class="udm-foot" data-col="${c.key}"><b>${k}</b>${gk ? `<small>+${gk}</small>` : ''}<span class="bar"><i style="width:${pct}%"></i></span></td>`;
    }).join('');
    el.result.innerHTML = `<div class="udm-table-wrap"><div class="udm-table-scroll"><table class="udm-table">
      <thead><tr><th rowspan="2" class="udm-uni-h">대학 <small>${N}개</small></th>${head1}<th rowspan="2">기타</th><th rowspan="2">반영 수</th></tr><tr>${head2}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th scope="row">반영 대학 수 / ${N}<br><small>+n = 교과 전체 지정</small></th>${foot}<td></td><td></td></tr></tfoot></table></div></div>`;
  }
  function renderCards(recs) {
    el.result.innerHTML = `<div class="udm-cards">${recs.map(r => {
      const ev = evalOf(r);
      const chips = M.groups.map(g => {
        if (r.groups.includes(g.key)) return `<span class="udm-chip band ${ev ? (ev.groupsMissing.includes(g.key) ? 'miss' : 'ok') : ''}">${esc(g.label)} 전체${r.starAll ? '✱' : ''}</span>`;
        return M.subjects.filter(c => c.group === g.key && r.marks.includes(c.key)).map(c =>
          `<span class="udm-chip ${ev ? (st.mySubs.has(c.key) ? 'ok' : 'miss') : ''}" ${r.cellNotes[c.key] ? `title="${esc(r.cellNotes[c.key])}"` : ''}><span class="gl">${esc(g.label)}</span>${esc(c.label)}${r.starAll || r.stars.includes(c.key) ? '✱' : ''}</span>`).join('');
      }).join('');
      return `<article class="udm-card"><div class="udm-card-top"><div>${uniCell(r, ev)}</div><span class="udm-cnt">${countLabel(r)}</span></div>
        <div class="udm-chips">${chips || '<span class="small">세부 과목 표시 없음</span>'}${r.etc !== null ? `<span class="udm-chip"><span class="gl">기타</span>${esc(r.etc || '기타')}</span>` : ''}</div></article>`;
    }).join('')}</div>`;
  }
  function renderView() {
    const isUnit = st.view === 'unit';
    el.subject.hidden = isUnit; el.head.hidden = !isUnit; el.result.hidden = !isUnit; el.check.hidden = !(isUnit && st.check);
    if (!isUnit) { if (typeof renderSubjectView === 'function') renderSubjectView(); return; }
    const recs = visibleRecords();
    if (st.check && typeof renderCheck === 'function') renderCheck(recs);
    renderHead(recs);
    if (!recs.length) { el.result.innerHTML = '<div class="empty" style="padding:40px">조건에 맞는 대학이 없습니다.<br>권역을 전체로 바꾸거나 검색어를 지워 보세요.</div>'; return; }
    if (mobile.matches) renderCards(recs); else renderTable(recs);
  }
  function renderAll() { renderLegend(); renderUnits(); renderTools(); renderView(); }

  /* ---------- 이벤트 ---------- */
  let debounceT;
  function bind() {
    paneMatrix.addEventListener('click', e => {
      const u = e.target.closest('[data-udm-unit]');
      if (u) { st.unit = u.dataset.udmUnit; store('udb2028.mUnit', st.unit); renderUnits(); renderView(); return; }
      const v = e.target.closest('[data-view]');
      if (v && el.viewSeg.contains(v)) { st.view = v.dataset.view; renderTools(); renderView(); return; }
      if (e.target.closest('#udmCheckBtn')) { if (typeof toggleCheck === 'function') toggleCheck(); return; }
      const link = e.target.closest('[data-udm-link]');
      if (link) { if (typeof linkToSearch === 'function') linkToSearch(byId.get(link.dataset.udmLink)); return; }
      const go = e.target.closest('[data-udm-goto]');
      if (go) { gotoRecord(go.dataset.udmGoto); return; }
      if (e.target.closest('#udmErrataBtn')) { if (typeof openErrata === 'function') openErrata(); }
    });
    paneMatrix.addEventListener('change', e => {
      if (e.target === el.region) { st.region = el.region.value; renderView(); }
      else if (e.target === el.sort) { st.sort = el.sort.value; renderView(); }
      else if (e.target.matches('[data-udm-sub]') && typeof onSubjectToggle === 'function') onSubjectToggle(e.target);
      else if (e.target.matches('[data-udm-subject], [data-udm-incgroups]') && typeof onSubjectViewChange === 'function') onSubjectViewChange(e.target);
    });
    el.search.addEventListener('input', () => { clearTimeout(debounceT); debounceT = setTimeout(() => { st.q = el.search.value.trim(); renderView(); }, 200); });
    paneMatrix.addEventListener('mouseover', e => {
      const c = e.target.closest('[data-col]'); if (!c) return;
      paneMatrix.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
      paneMatrix.querySelectorAll(`[data-col="${c.dataset.col}"]`).forEach(x => x.classList.add('hl'));
    });
    paneMatrix.addEventListener('mouseleave', () => paneMatrix.querySelectorAll('.hl').forEach(x => x.classList.remove('hl')));
    mobile.addEventListener('change', () => { if (st.tab === 'matrix' && st.view === 'unit') renderView(); });
  }
  function gotoRecord(id) {
    const r = byId.get(id); if (!r) return;
    st.unit = r.unit; st.view = 'unit'; st.region = ''; st.q = '';
    store('udb2028.mUnit', st.unit); renderUnits(); renderTools(); renderView();
    const row = el.result.querySelector(`[data-id="${id}"]`);
    if (row) { row.classList.add('udm-hl'); row.scrollIntoView({ block: 'center' }); setTimeout(() => row.classList.remove('udm-hl'), 2500); }
  }

  /* ---------- 부트 ---------- */
  function init() {
    bindTabs();
    if (M) {
      const saved = read('udb2028.mUnit', DEFAULT_UNIT);
      st.unit = UNIT_BY_KEY.has(saved) ? saved : DEFAULT_UNIT;
      try { JSON.parse(read('udb2028.mySubs', '[]')).forEach(k => { if (SUBJ_BY_KEY[k]) st.mySubs.add(k); }); } catch { /* 무시 */ }
      bind();
    }
    const h = location.hash;
    const initial = h === '#univDB-matrix' ? 'matrix' : h === '#univDB' ? 'search'
      : (read('udb2028.tab', 'search') === 'matrix' ? 'matrix' : 'search');
    activateTab(initial, { hash: false });
  }
  init();
})();
```

- [ ] **Step 5: 주입과 브라우저 확인**

Run: `cd /Users/jyj/claude/cnejinhak && .venv-udm/bin/python scripts/inject_udm.py && node --test scripts/test_udm_pure.mjs 2>&1 | tail -2`
Expected: `injected`, `pass 4`.

브라우저: `navigate` `http://localhost:8756/sub2.html#univDB-matrix` → 콘솔 오류 없음 → `javascript_tool`:
```js
(() => { const t = document.querySelector('.udm-table'); const rows = [...t.tBodies[0].rows];
  const foot = [...t.tFoot.rows[0].cells].slice(1, 16).map(c => c.querySelector('b')?.textContent);
  return { unit: document.querySelector('.udm-unit.on').textContent, rows: rows.length, head: document.getElementById('udmHead').textContent,
    danguk: rows.find(r => r.textContent.includes('단국대'))?.querySelector('.udm-band')?.textContent,
    halla: rows.find(r => r.textContent.includes('한라대'))?.querySelectorAll('.udm-band').length,
    calc2Count: foot[4], phyCount: foot[11] }; })()
```
Expected: `unit:"컴퓨터공학28", rows:28, head:"공학 · 컴퓨터공학28개 대학 · 권역 전체", danguk:"수학 전체✱", halla:5`. `calc2Count`·`phyCount`는 `/tmp/matrix.json`에서 `unit=="computer-eng" && !excluded` 레코드 중 `marks`에 `calc2`/`phy`가 든 수와 같아야 한다(파이썬 한 줄로 계산해 대조: `jq`가 없으면 `python3 -c "import json;d=json.load(open('/tmp/matrix.json'));rs=[r for r in d['records'] if r['unit']=='computer-eng' and not r['excluded']];print(sum('calc2' in r['marks'] for r in rs),sum('phy' in r['marks'] for r in rs))"`).

이어서: 경영 칩 클릭 → 한양대 행에 `⚠`가 있고 `title`에 "자연계열" 포함; 권역 `호남권` 선택 → 행 수가 줄고 푸터 분모가 바뀜; 검색창에 `zzz` → 빈 상태 문구와 `NaN` 없음; `resize_window {preset:'mobile'}` 후 `.udm-cards` 존재·`.udm-table` 없음; `resize_window {preset:'desktop'}` 복원. `localStorage.setItem('udb2028.mUnit','nope')` 후 새로고침 → 컴퓨터공학으로 복원.

- [ ] **Step 6: 커밋**

```bash
cd /Users/jyj/claude/cnejinhak && git add scripts/udm_src scripts/test_udm_pure.mjs sub2.html && git commit -q -m "sub2 매트릭스: 모집단위별 보기(표·카드·푸터 집계)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 6: 내 이수과목 점검 모드

**Files:**
- Modify: `scripts/udm_src/pure.js` (`evaluate` 추가)
- Modify: `scripts/udm_src/app.js` (`toggleCheck`, `renderCheck`, `onSubjectToggle` 추가)
- Modify: `scripts/udm_src/udm.css` (점검 패널 스타일)
- Modify: `scripts/test_udm_pure.mjs`

**Interfaces:**
- Produces: `UDM.evaluate(record, mySubs: Set<string>, subjectsByGroup: {groupKey: subjectKey[]}) -> {ok: boolean, missing: subjectKey[], groupsMissing: groupKey[]}`.
- `app.js`: `toggleCheck()`, `renderCheck(recs)`, `onSubjectToggle(inputEl)` — Task 5의 `bind()`/`renderView()`가 이미 호출한다.

- [ ] **Step 1: 테스트 추가**

```js
const SBG = { kor: ['kor'], math: ['alg', 'calc2'], eng: ['eng'], soc: ['soc'], sci: ['phy', 'chem'] };

test('evaluate: all marks checked → ok', () => {
  const r = { marks: ['calc2', 'phy'], groups: [], allSubjects: false };
  assert.deepEqual(UDM.evaluate(r, new Set(['calc2', 'phy', 'kor']), SBG), { ok: true, missing: [], groupsMissing: [] });
});
test('evaluate: missing marks listed in record order', () => {
  const r = { marks: ['alg', 'calc2', 'phy'], groups: [], allSubjects: false };
  assert.deepEqual(UDM.evaluate(r, new Set(['calc2']), SBG), { ok: false, missing: ['alg', 'phy'], groupsMissing: [] });
});
test('evaluate: whole group needs ≥1 subject of that group', () => {
  const r = { marks: ['kor'], groups: ['math', 'sci'], allSubjects: false };
  assert.deepEqual(UDM.evaluate(r, new Set(['kor', 'alg']), SBG), { ok: false, missing: [], groupsMissing: ['sci'] });
  assert.equal(UDM.evaluate(r, new Set(['kor', 'alg', 'chem']), SBG).ok, true);
});
test('evaluate: empty selection fails everything incl. allSubjects', () => {
  assert.equal(UDM.evaluate({ marks: [], groups: ['kor', 'math', 'eng', 'soc', 'sci'], allSubjects: true }, new Set(), SBG).ok, false);
  assert.equal(UDM.evaluate({ marks: [], groups: ['kor', 'math', 'eng', 'soc', 'sci'], allSubjects: true }, new Set(['eng']), SBG).ok, true);
  assert.equal(UDM.evaluate({ marks: ['phy'], groups: [], allSubjects: false }, new Set(), SBG).ok, false);
});
test('evaluate: record with nothing marked (etc only) is ok', () => {
  assert.equal(UDM.evaluate({ marks: [], groups: [], allSubjects: false }, new Set(), SBG).ok, true);
});
```

Run: `node --test scripts/test_udm_pure.mjs 2>&1 | tail -2` → Expected: 5 fail (`UDM.evaluate is not a function`).

- [ ] **Step 2: pure.js에 추가** (`footerCounts` 뒤, 쉼표 주의)

```js
  evaluate(rec, mySubs, subjectsByGroup) {
    const missing = rec.marks.filter(k => !mySubs.has(k));
    const groupsMissing = rec.groups.filter(g => !(subjectsByGroup[g] || []).some(k => mySubs.has(k)));
    const allMissing = !!rec.allSubjects && mySubs.size === 0;
    return { ok: !missing.length && !groupsMissing.length && !allMissing, missing, groupsMissing };
  }
```

Run: `node --test scripts/test_udm_pure.mjs 2>&1 | tail -2` → Expected: `pass 9`.

- [ ] **Step 3: app.js에 점검 모드 추가** (`gotoRecord` 함수 뒤, `/* ---------- 부트` 앞)

```js
  /* ---------- 내 이수과목 점검 ---------- */
  function toggleCheck() {
    st.check = !st.check;
    if (st.check) st.sort = 'missing'; else if (st.sort === 'missing') st.sort = 'source';
    renderTools(); renderView();
    if (st.check) el.check.scrollIntoView({ block: 'nearest' });
  }
  function renderCheck(recs) {
    const groupsHtml = M.groups.map(g => `<div class="udm-ck-group"><b>${esc(g.label)}</b>${
      M.subjects.filter(c => c.group === g.key).map(c => `<label class="udb-toggle ${st.mySubs.has(c.key) ? 'on' : ''}"><input type="checkbox" data-udm-sub="${c.key}" ${st.mySubs.has(c.key) ? 'checked' : ''}>${esc(c.label)}</label>`).join('')
    }</div>`).join('');
    const tally = {};
    let ok = 0;
    recs.forEach(r => {
      const ev = UDM.evaluate(r, st.mySubs, SUBJ_BY_GROUP);
      if (ev.ok) { ok++; return; }
      ev.missing.forEach(k => { tally[k] = (tally[k] || 0) + 1; });
      ev.groupsMissing.forEach(g => { tally['g:' + g] = (tally['g:' + g] || 0) + 1; });
    });
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, n]) => `${k.startsWith('g:') ? GROUP_LABEL[k.slice(2)] + ' 전체' : SUBJ_BY_KEY[k].label}(${n})`).join(', ');
    el.check.innerHTML = `<div class="udm-ck-head"><strong>내가 이수했거나 이수할 과목을 체크하세요</strong><span class="small">교과 전체로 안내된 대학은 그 교과에서 1과목 이상 체크하면 충족으로 봅니다(관대한 기준). 기타 열은 판정에 넣지 않습니다.</span></div>
      ${groupsHtml}
      <div class="udm-ck-sum">선택 <b>${st.mySubs.size}</b>과목 → 충족 <b>${ok}</b> / ${recs.length}개 대학${top ? ` · 가장 많이 부족한 과목: ${esc(top)}` : ''}
        <button type="button" class="btn btn-outline" id="udmCheckClear" style="margin-left:8px;padding:.3rem .6rem;font-size:.8rem">모두 해제</button></div>`;
  }
  function onSubjectToggle(input) {
    const k = input.dataset.udmSub;
    if (input.checked) st.mySubs.add(k); else st.mySubs.delete(k);
    store('udb2028.mySubs', JSON.stringify([...st.mySubs]));
    renderView();
  }
  paneMatrix.addEventListener('click', e => {
    if (e.target.closest('#udmCheckClear')) { st.mySubs.clear(); store('udb2028.mySubs', '[]'); renderView(); }
  });
```

- [ ] **Step 4: CSS 추가** — `udm.css` 끝에

```css
/* 점검 패널 */
.udm-check{margin-top:12px;background:#fff;border:1px solid #b9e3d3;border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow);display:grid;gap:10px}
.udm-ck-head strong{display:block;color:#046c4e}
.udm-ck-group{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.udm-ck-group b{min-width:44px;color:var(--navy);font-size:.84rem}
.udm-ck-group .udb-toggle{padding:.38rem .7rem;font-size:.82rem}
.udm-ck-sum{border-top:1px solid var(--line);padding-top:10px;font-weight:800;color:#334155;font-size:.9rem}
.udm-ck-sum b{color:#046c4e}
```

- [ ] **Step 5: 주입·테스트·브라우저 확인**

Run: `cd /Users/jyj/claude/cnejinhak && .venv-udm/bin/python scripts/inject_udm.py && node --test scripts/test_udm_pure.mjs 2>&1 | tail -2` → `injected`, `pass 9`.

브라우저(`#univDB-matrix`, 기계공학 칩 클릭 → "내 이수과목 점검" 클릭):
- 체크 전: 요약 `선택 0과목 → 충족 0 / 24개 대학`, 모든 행 `부족` 배지, 한라대도 부족.
- `대수·확률과 통계·미적분Ⅰ·미적분Ⅱ·물리학` 체크 → `javascript_tool`:
```js
(() => { const row = n => [...document.querySelectorAll('.udm-table tbody tr')].find(r => r.textContent.includes(n));
  const b = n => row(n)?.querySelector('.udm-badge')?.textContent; return { erica: b('한양대(ERICA)'), korea: b('고려대'), kookmin: b('국민대'), kookminTitle: row('국민대')?.querySelector('.udm-badge')?.title, sort: document.getElementById('udmSort').value, sum: document.querySelector('.udm-ck-sum').textContent.slice(0, 30) }; })()
```
Expected: `erica:"충족", korea:"충족", kookmin:"부족 1", kookminTitle:"부족: 기하", sort:"missing"`, 요약에 `선택 5과목`. 새로고침 후 체크 상태가 유지되고(localStorage), 점검 버튼 OFF 시 정렬이 `원자료 순`으로 돌아간다. 모바일 프리셋에서 카드의 칩이 초록/주황으로 구분된다.

- [ ] **Step 6: 커밋**

```bash
cd /Users/jyj/claude/cnejinhak && git add scripts/udm_src scripts/test_udm_pure.mjs sub2.html && git commit -q -m "sub2 매트릭스: 내 이수과목 점검 모드

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 7: 과목별 보기(역조회)

**Files:**
- Modify: `scripts/udm_src/pure.js` (`subjectCoverage` 추가)
- Modify: `scripts/udm_src/app.js` (`renderSubjectView`, `onSubjectViewChange` 추가)
- Modify: `scripts/udm_src/udm.css`
- Modify: `scripts/test_udm_pure.mjs`

**Interfaces:**
- Produces: `UDM.subjectCoverage(records, subjectKey, groupKey, includeGroups) -> record[]` (해당 과목을 반영하는 레코드; `includeGroups`면 교과 전체/전 교과 포함).
- `app.js`: `renderSubjectView()`, `onSubjectViewChange(el)`; 마크업 `select[data-udm-subject]`, `input[data-udm-incgroups]`, `details.udm-sv-row`, `button[data-udm-goto]`.

- [ ] **Step 1: 테스트 추가**

```js
test('subjectCoverage with and without whole-group bands', () => {
  const recs = UDM.indexByUnit(R).get('mech-eng');     // b(kor + math 전체), a(calc2, phy), c(전 교과)
  assert.deepEqual(UDM.subjectCoverage(recs, 'calc2', 'math', false).map(r => r.id), ['a']);
  assert.deepEqual(UDM.subjectCoverage(recs, 'calc2', 'math', true).map(r => r.id), ['b', 'a', 'c']);
  assert.deepEqual(UDM.subjectCoverage(recs, 'eng', 'eng', true).map(r => r.id), ['c']);
  assert.deepEqual(UDM.subjectCoverage([], 'eng', 'eng', true), []);
});
```

Run: `node --test scripts/test_udm_pure.mjs 2>&1 | tail -2` → 1 fail.

- [ ] **Step 2: pure.js에 추가** (`evaluate` 뒤)

```js
  subjectCoverage(records, subjectKey, groupKey, includeGroups) {
    return records.filter(r => r.marks.includes(subjectKey) || (includeGroups && (r.allSubjects || r.groups.includes(groupKey))));
  }
```
→ `pass 10`.

- [ ] **Step 3: app.js에 추가** (점검 모드 코드 뒤)

```js
  /* ---------- 과목별 보기(역조회) ---------- */
  function renderSubjectView() {
    const s = SUBJ_BY_KEY[st.subject] || M.subjects[0];
    const opts = M.groups.map(g => `<optgroup label="${esc(g.label)}">${M.subjects.filter(c => c.group === g.key).map(c => `<option value="${c.key}" ${c.key === s.key ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</optgroup>`).join('');
    const rows = M.units.map(u => {
      const recs = byUnit.get(u.key) || [];
      const hit = UDM.subjectCoverage(recs, s.key, s.group, st.includeGroups);
      return { u, recs, hit, pct: recs.length ? Math.round(hit.length / recs.length * 100) : 0 };
    }).sort((a, b) => b.pct - a.pct || b.hit.length - a.hit.length);
    el.subject.innerHTML = `<div class="udm-sv-tools"><label>과목 <select class="udb-mini-select" data-udm-subject aria-label="과목 선택">${opts}</select></label>
        <label class="udb-toggle ${st.includeGroups ? 'on' : ''}"><input type="checkbox" data-udm-incgroups ${st.includeGroups ? 'checked' : ''}>교과 전체 지정 포함</label>
        <span class="small">「${esc(s.label)}」을(를) 반영과목으로 안내한 대학 수 / 모집단위별 대학 수</span></div>
      <div class="udm-sv-list">${rows.map(({ u, recs, hit, pct }) => `<details class="udm-sv-row"><summary><span class="u">${esc(u.field)} · ${esc(u.label)}</span><span class="bar"><i style="width:${pct}%"></i></span><b>${hit.length}</b><span class="n">/ ${recs.length}</span></summary>
        <div class="udm-sv-unis">${hit.map(r => `<button type="button" class="udm-chip link" data-udm-goto="${r.id}">${esc(r.university)}${r.marks.includes(s.key) ? '' : ' <span class="gl">(교과 전체)</span>'}</button>`).join('') || '<span class="small">해당 대학 없음</span>'}</div></details>`).join('')}</div>`;
  }
  function onSubjectViewChange(target) {
    if (target.matches('[data-udm-subject]')) st.subject = target.value;
    else st.includeGroups = target.checked;
    renderSubjectView();
  }
```

- [ ] **Step 4: CSS 추가**

```css
/* 과목별 보기 */
.udm-sv-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 10px}
.udm-sv-tools label{font-weight:850;color:var(--navy);font-size:.86rem}
.udm-sv-list{display:grid;gap:6px}
.udm-sv-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:4px 12px}
.udm-sv-row summary{display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 0;font-weight:850;list-style:none}
.udm-sv-row summary::-webkit-details-marker{display:none}
.udm-sv-row summary .u{min-width:150px;color:var(--navy)}
.udm-sv-row summary .bar{flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}
.udm-sv-row summary .bar i{display:block;height:100%;background:var(--blue)}
.udm-sv-row summary b{min-width:24px;text-align:right}
.udm-sv-row summary .n{color:var(--muted);font-size:.82rem;min-width:36px}
.udm-sv-unis{display:flex;flex-wrap:wrap;gap:6px;padding:4px 0 10px}
@media(max-width:680px){.udm-sv-row summary{flex-wrap:wrap}.udm-sv-row summary .u{min-width:0;width:100%}}
```

- [ ] **Step 5: 주입·확인**

Run: `.venv-udm/bin/python scripts/inject_udm.py && node --test scripts/test_udm_pure.mjs 2>&1 | tail -2` → `injected`, `pass 10`.

브라우저: "과목별 보기" 클릭 → 16행 `details`, 기본 과목 미적분Ⅱ; 과목을 `기하`로 바꾸면 수학교육·물리가 상단에 옴; "교과 전체 지정 포함" 해제 시 숫자가 줄어듦; 한 행을 펼쳐 대학 칩 클릭 → 모집단위별 보기로 전환되고 그 대학 행이 노랗게 강조됨(`tr.udm-hl`).

- [ ] **Step 6: 커밋**

```bash
cd /Users/jyj/claude/cnejinhak && git add scripts/udm_src scripts/test_udm_pure.mjs sub2.html && git commit -q -m "sub2 매트릭스: 과목별 보기(역조회)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 8: 파일 1 원문 연결과 토스트

**Files:**
- Modify: `scripts/udm_src/pure.js` (`matchUnitRecords`, `pickKeyword` 추가)
- Modify: `scripts/udm_src/app.js` (`linkToSearch`, `toast` 추가)
- Modify: `scripts/udm_src/udm.css` (토스트)
- Modify: `scripts/test_udm_pure.mjs`

**Interfaces:**
- Produces: `UDM.matchUnitRecords(file1Records, universityKey, keywords) -> file1Record[]`, `UDM.pickKeyword(hits, keywords) -> string` (hits 중 가장 많이 포함된 키워드, 없으면 `''`).
- 소비: Task 4의 `window.udbOpenRecord(id)`, `window.udbFilterUniversity(univ, q)`.

- [ ] **Step 1: 테스트 추가**

```js
const F1 = [
  { id: 'k1', university_display: '고려대', unit_name: '기계공학부', unit_parent: '공과대학' },
  { id: 'k2', university_display: '고려대', unit_name: '화공생명공학과', unit_parent: '공과대학' },
  { id: 'a1', university_display: '아주대', unit_name: '소프트웨어학과', unit_parent: '소프트웨어융합대학' },
  { id: 'a2', university_display: '아주대', unit_name: '사이버보안학과', unit_parent: '소프트웨어융합대학' },
  { id: 'd1', university_display: '단국대', unit_name: '공과대학', unit_parent: null }
];
test('matchUnitRecords: exact single hit, multi hit, none, null key', () => {
  assert.deepEqual(UDM.matchUnitRecords(F1, '고려대', ['기계']).map(r => r.id), ['k1']);
  assert.deepEqual(UDM.matchUnitRecords(F1, '아주대', ['컴퓨터', '소프트웨어']).map(r => r.id), ['a1', 'a2']);
  assert.deepEqual(UDM.matchUnitRecords(F1, '단국대', ['기계']), []);
  assert.deepEqual(UDM.matchUnitRecords(F1, null, ['기계']), []);
});
test('pickKeyword prefers the keyword matching most hits', () => {
  const hits = UDM.matchUnitRecords(F1, '아주대', ['컴퓨터', '소프트웨어']);
  assert.equal(UDM.pickKeyword(hits, ['컴퓨터', '소프트웨어']), '소프트웨어');
  assert.equal(UDM.pickKeyword([], ['컴퓨터']), '');
});
```
→ 2 fail.

- [ ] **Step 2: pure.js에 추가** (`subjectCoverage` 뒤)

```js
  matchUnitRecords(file1, universityKey, keywords) {
    if (!universityKey) return [];
    const text = r => (r.unit_name || '') + ' ' + (r.unit_parent || '');
    return file1.filter(r => r.university_display === universityKey && keywords.some(k => text(r).includes(k)));
  },
  pickKeyword(hits, keywords) {
    const text = r => (r.unit_name || '') + ' ' + (r.unit_parent || '');
    let best = '', bestN = 0;
    keywords.forEach(k => { const n = hits.filter(r => text(r).includes(k)).length; if (n > bestN) { best = k; bestN = n; } });
    return best;
  }
```
→ `pass 12`.

- [ ] **Step 3: app.js에 추가** (과목별 보기 코드 뒤)

```js
  /* ---------- 파일 1 원문 연결 ---------- */
  function toast(msg) {
    let t = $('udmToast');
    if (!t) { t = document.createElement('div'); t.id = 'udmToast'; t.className = 'udm-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }
  function linkToSearch(r) {
    if (!r) return;
    if (!r.universityKey) { toast(`${r.university}: 권장과목 원문 자료에 없는 대학입니다.`); return; }
    const kws = M.unitLinks[r.unit] || [];
    const hits = UDM.matchUnitRecords(FILE1, r.universityKey, kws);
    if (hits.length === 1 && typeof window.udbOpenRecord === 'function') { window.udbOpenRecord(hits[0].id); return; }
    activateTab('search', { scroll: true });
    if (typeof window.udbFilterUniversity === 'function') window.udbFilterUniversity(r.universityKey, UDM.pickKeyword(hits, kws));
    if (!hits.length) toast(`${r.university}: 모집단위 단위 자료가 없어 대학 전체를 표시합니다.`);
  }
```

- [ ] **Step 4: CSS 추가**

```css
/* 토스트 */
.udm-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);opacity:0;pointer-events:none;z-index:90;background:var(--navy);color:#fff;font-weight:800;font-size:.86rem;padding:.65rem 1rem;border-radius:12px;box-shadow:0 16px 36px rgba(15,47,95,.3);transition:.2s all ease;max-width:calc(100% - 28px)}
.udm-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
body.has-cmpbar .udm-toast{bottom:92px}
```

- [ ] **Step 5: 주입·확인**

Run: `.venv-udm/bin/python scripts/inject_udm.py && node --test scripts/test_udm_pure.mjs 2>&1 | tail -2` → `injected`, `pass 12`.

브라우저(`#univDB-matrix`, 기계공학):
- `고려대` 클릭 → 모달 제목 `고려대 · 공과대학 > 기계공학부`(`#modalTitle`), 닫기 후 탭은 여전히 매트릭스.
- `단국대` 클릭 → 검색 탭으로 전환(`#univDB` 해시), 대학 select 값 `단국대`, 토스트 "모집단위 단위 자료가 없어…" 표시, 결과 건수 16.
- 매트릭스 탭 → 체육 → `동양대` 클릭 → 토스트 "권장과목 원문 자료에 없는 대학입니다", 탭 유지.
- 컴퓨터공학 → `아주대` 클릭 → 검색 탭, 대학 `아주대` + 검색어 `소프트웨어`, 결과 ≥2건.
- 전공 카드 섹션의 "대학별 권장과목 확인" 버튼(`udbSearchByMajor`)을 매트릭스 탭 상태에서 눌러도 검색 탭으로 전환되는지 확인.

- [ ] **Step 6: 커밋**

```bash
cd /Users/jyj/claude/cnejinhak && git add scripts/udm_src scripts/test_udm_pure.mjs sub2.html && git commit -q -m "sub2 매트릭스: 권장과목 원문 연결(모달/대학 필터)과 토스트

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 9: 정오표·해석 규칙 모달, index 카드, meta

**Files:**
- Modify: `scripts/udm_src/app.js` (`openModal`, `openErrata` 추가)
- Modify: `scripts/udm_src/udm.css`
- Modify: `index.html` (sub2 카드 설명), `sub2.html` (meta description·og:description — `patch_html.py --replace-text`)

**Interfaces:**
- `openErrata()`는 Task 5의 `bind()`가 `#udmErrataBtn` 클릭에서 호출. 공용 모달 DOM `#modalBackdrop/#modalHead/#modalBody` 재사용.

- [ ] **Step 1: app.js에 추가** (원문 연결 코드 뒤)

```js
  /* ---------- 정오표·해석 규칙 ---------- */
  function openModal(headHtml, bodyHtml) {
    $('modalHead').innerHTML = headHtml; $('modalBody').innerHTML = bodyHtml;
    $('modalBackdrop').classList.add('open');
  }
  function openErrata() {
    const unitLabel = k => k.split('/').map(x => (UNIT_BY_KEY.get(x) || { label: x }).label).join('/');
    const head = `<div class="badge-row"><span class="badge">전공별 반영과목 매트릭스</span><span class="badge purple">정오표 · 해석 규칙</span></div>
      <h3 id="modalTitle">정오표와 셀 해석 규칙</h3>
      <p class="small">출처: ${esc(M.meta.source)} · 정리 ${esc(M.meta.built)} · 원자료 ${M.meta.sourceRows}행 → ${M.meta.records}건. 정확한 반영 기준은 각 대학 입학처 모집요강을 확인하세요.</p>`;
    const rules = `<div class="detail-box wide"><h4>셀 해석 규칙</h4><ul class="udm-rules">
      <li><b>●</b> 세부과목 열에 대학명이 있으면 그 과목을 반영과목으로 안내한 것입니다.</li>
      <li><b>교과 전체 띠</b> 원자료에서 수학(5열)·사회(4열)·과학(4열) 범위가 통째로 병합된 경우로, 세부 과목을 지정하지 않고 교과 전체를 안내한 것입니다.</li>
      <li><b>부분 병합</b>(예: 물리학·화학·생명과학 3열)은 병합이 덮는 과목 각각을 반영한 것으로 봅니다.</li>
      <li><b>전 교과</b> 한 행 전체가 병합된 대학(한라대)은 국어·수학·영어·사회·과학 교과 전체로 봅니다.</li>
      <li><b>✱</b> 원자료의 별표. 안내문 기준 "학과 특성에 따라 일반 선택 과목 이수 후 진로와 적성에 맞게 과목 이수 권장" 대학이며, 별표가 특정 셀에만 있으면 그 셀에만 표시합니다.</li>
      <li><b>※</b> 셀 메모(예: 역사/도덕 포함). 마우스를 올리면 내용이 보입니다.</li>
      <li><b>기타</b> 열은 자유 서술(제2외/한문, 미술 등)이라 점검 판정에 넣지 않습니다.</li>
      <li><b>내 이수과목 점검</b>은 ● 과목이 모두 체크되면 충족, 교과 전체 띠는 그 교과에서 1과목 이상 체크되면 충족으로 보는 관대한 기준입니다.</li></ul></div>`;
    const table = `<div class="detail-box wide"><h4>정오표 (${M.errata.length}건)</h4>
      <div class="udb-table-wrap" style="box-shadow:none"><div class="udb-table-scroll"><table class="udb-table" style="min-width:760px"><thead><tr><th>#</th><th>원자료 행</th><th>모집단위</th><th>문제</th><th>조치</th><th>근거</th></tr></thead>
      <tbody>${M.errata.map(e => `<tr><td>${esc(e.id)}</td><td>${esc(e.rows.length > 4 ? `${e.rows[0]}–${e.rows[e.rows.length - 1]}` : e.rows.join(', '))}</td><td>${esc(unitLabel(e.unit))}</td><td>${esc(e.issue)}</td><td>${esc(e.action)}</td><td>${esc(e.basis)}</td></tr>`).join('')}</tbody></table></div></div>
      <p class="small" style="margin-top:8px">제외된 행(E4)의 원문은 빌드 JSON의 <code>raw</code>에 보존되어 있습니다.</p></div>`;
    openModal(head, `<div class="detail-grid">${rules}${table}</div>`);
  }
```

- [ ] **Step 2: CSS 추가**

```css
/* 정오표 모달 */
.udm-rules{margin:0;padding-left:18px;display:grid;gap:6px;font-size:.88rem;line-height:1.55}
.udm-rules b{color:var(--navy)}
.udm-errata-btn{margin-left:10px;padding:.4rem .8rem;font-size:.82rem;vertical-align:middle}
```

- [ ] **Step 3: index.html 카드와 sub2 meta**

```bash
cd /Users/jyj/claude/cnejinhak && P=.venv-udm/bin/python && \
$P scripts/patch_html.py index.html --replace-text '<p>2022개정교육과정에서 전공별 선택과목을 설계하는 방법에 대한 정보를 제공합니다.</p>' --with '<p>2022개정교육과정 전공별 선택과목 설계 방법과, 2028학년도 대학별 권장과목·대표 모집단위별 반영과목 매트릭스를 제공합니다.</p>' && \
$P scripts/patch_html.py sub2.html --replace-text '2028학년도 대학별 권장과목 1,358건 검색까지 한 페이지에서 제공합니다.' --with '2028학년도 대학별 권장과목 1,358건 검색과 16개 대표 모집단위 반영과목 매트릭스까지 한 페이지에서 제공합니다.' && \
$P scripts/patch_html.py sub2.html --replace-text '2028학년도 대학별 권장과목 1,358건을 한눈에 비교하는' --with '2028학년도 대학별 권장과목 1,358건·대표 모집단위 반영과목 매트릭스를 한눈에 비교하는' && \
$P scripts/inject_udm.py
```
Expected: `ok: text replaced` 3회, `injected`. (문자열이 1회가 아니라고 나오면 `grep -n` 으로 현재 문구를 확인해 `--replace-text` 값을 실제 문구로 맞춘다.)

- [ ] **Step 4: 브라우저 확인**

`#univDB-matrix` → "정오표·해석 규칙 보기" 클릭 → `#modalTitle` = "정오표와 셀 해석 규칙", 표 행 8개, E4 행의 원자료 행이 `195–201`; Esc/닫기로 닫힘(기존 포커스 트랩 패치가 동작). `http://localhost:8756/index.html`에서 선택과목설계 카드 문구 확인.

- [ ] **Step 5: 커밋**

```bash
cd /Users/jyj/claude/cnejinhak && git add scripts/udm_src sub2.html index.html && git commit -q -m "sub2 매트릭스: 정오표·해석 규칙 모달, index 카드·meta 문구

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 10: 최종 검증(회귀·반응형·인쇄)과 메모리 갱신

**Files:**
- Modify: `/Users/jyj/.claude/projects/-Users-jyj-claude/memory/sub2-univdb-embedded.md` (매트릭스 탭 추가 사실)
- 코드 변경 없음(문제 발견 시 해당 Task로 돌아가 수정 후 재커밋)

- [ ] **Step 1: 데이터·검색 탭 회귀**

```bash
cd /Users/jyj/claude/cnejinhak && git diff b97aaed..HEAD -- sub2.html | grep -c '^[-+]<script id="records-data"\|^[-+]<script id="options-data"'; .venv-udm/bin/python -I -m pytest scripts/test_build_subject_matrix.py -q 2>&1 | tail -1; node --test scripts/test_udm_pure.mjs 2>&1 | grep -E '^# (pass|fail)'; .venv-udm/bin/python scripts/inject_udm.py
```
Expected: `0`, `passed`, `# pass 12` / `# fail 0`, `unchanged`(주입 멱등).

브라우저 `http://localhost:8756/sub2.html#univDB` → `javascript_tool`:
```js
({ count: document.getElementById('udbResultCount').textContent, cards: document.querySelectorAll('.udb-card').length, errors: 0 })
```
Expected: `count:"1,358건 / 전체 1,358건", cards:24`. 검색창에 `고려대 생명과학` 입력 → 결과 감소, 카드의 "상세 보기" → 모달 열림, 즐겨찾기·비교함 버튼 동작. 콘솔 오류 0.

- [ ] **Step 2: 반응형·인쇄·접근성**

- `resize_window {preset:'mobile'}` → `#univDB-matrix`: 가로 스크롤 없음(`document.documentElement.scrollWidth <= window.innerWidth`), 카드 모드, 탭 2개가 한 줄에 들어감. `resize_window {preset:'tablet'}` → 표 모드에 짧은 헤더(`.short` 표시). `resize_window {preset:'desktop'}`.
- `read_page {filter:'interactive'}`로 탭 버튼이 `role=tab`/`aria-selected`를 갖는지, 모집단위 칩이 `aria-pressed`를 갖는지 확인. 탭 바에 포커스 두고 `computer {action:'key', text:'ArrowRight'}` → 탭 전환.
- `javascript_tool`: `window.matchMedia('print')` 대신 인쇄 스타일 확인은 `[...document.styleSheets].some(s => [...s.cssRules].some(r => r.media && r.media.mediaText === 'print' && r.cssRules[0].selectorText.includes('.udm-tools')))` → `true`.

- [ ] **Step 3: 스크린샷 증빙**

`computer {action:'screenshot'}` 2장: (1) 데스크톱 컴퓨터공학 매트릭스 + 푸터, (2) 점검 모드 ON 상태. 결과 메시지에 첨부.

- [ ] **Step 4: 메모리 갱신**

`sub2-univdb-embedded.md` 본문 끝에 추가:
```
**2026-10-16 추가:** `#univDB`에 탭 바가 생겨 두 번째 탭 "전공별 반영과목 매트릭스"(파일 2, 233건·16개 대표 모집단위)가 들어감. 소스는 `scripts/udm_src/`(css/pane.html/pure.js/app.js) → `scripts/inject_udm.py`로 sub2.html 마커(`udm:css`, `udm:pane`, `udm:js`) 사이에 주입. 데이터는 `scripts/build_subject_matrix.py <xlsx> --html sub2.html --inject`(정오표 E1–E8 내장, `.venv-udm` 필요). sub2.html을 직접 편집하지 말고 소스 수정 후 재주입할 것. 설계: docs/superpowers/specs/2026-10-16-univdb-matrix-tab-design.md
```

- [ ] **Step 5: 게시 여부는 사용자에게**

커밋은 모두 로컬 `main`(origin/main보다 앞섬). push는 사용자 확인 후 `gh auth setup-git && git push origin HEAD:main`(메모리의 안전 절차, force 금지). 결과 보고에 커밋 목록(`git log --oneline b97aaed..HEAD`)과 스크린샷을 포함한다.
