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
