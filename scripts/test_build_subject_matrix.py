import importlib.util
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("bsm", HERE / "build_subject_matrix.py")
bsm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bsm)

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
    assert {r["university"] for r in data["records"] if r["universityKey"] is None} == {"동양대"}
    assert recs[243]["regionGroup"] == "영남권"
    assert len(data["errata"]) == 8
