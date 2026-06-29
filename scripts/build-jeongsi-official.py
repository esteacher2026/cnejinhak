from __future__ import annotations

import argparse
import html as html_lib
import http.cookiejar
import json
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from io import StringIO
from pathlib import Path
from typing import Any

import pandas as pd
from lxml import html


BASE = "https://www.adiga.kr"
CRITERIA_VIEW_URL = f"{BASE}/uct/acd/ade/criteriaAndResultView.do?menuId=PCUCTACD2000"
CRITERIA_LIST_URL = f"{BASE}/uct/acd/ade/criteriaAndResultAjax.do"
POPUP_URL = f"{BASE}/uct/acd/ade/criteriaAndResultPopup.do"
ITEM_OLD_URL = f"{BASE}/uct/acd/ade/criteriaAndResultItemAjax.do"
ITEM_NEW_URL = f"{BASE}/uct/acd/ade/criteriaAndResultItemNewAjax.do"
UP_CD_CSAT = "40"
ITEM_CD_RESULT = "42"

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = Path.home() / "Documents" / "adiga_jeongsi_official"
RAW_DIR = OUT_DIR / "raw"
SITE_DATA = ROOT / "jeongsi" / "data" / "jeongsi-data.json"

RESULT_TO_SEARCH_SYR = {
    2024: "2025",
    2025: "2026",
    2026: "2027",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}


@dataclass(frozen=True)
class University:
    unv_cd: str
    unv_name: str
    region: str = ""
    rcmt_sat: Any = ""
    rnum: Any = ""


def log(message: str) -> None:
    print(message, flush=True)


def clean(value: Any) -> str:
    if value is None:
        return ""
    text = html_lib.unescape(str(value)).replace("\xa0", " ").replace("\u200b", "")
    text = re.sub(r"\s+", " ", text).strip()
    if re.fullmatch(r"-?\d+\.0", text):
        return str(int(float(text)))
    return text


def cell_value(value: Any) -> str:
    text = clean(value)
    if text in {"-", "0.0"}:
        return "" if text == "-" else "0"
    return text


def strip_zero(value: str) -> str:
    value = clean(value)
    value = value.replace(",", "").replace("점", "")
    if not re.fullmatch(r"-?\d+(?:\.\d+)?", value):
        return value
    number = float(value)
    if abs(number - round(number)) < 0.0000001:
        return str(int(round(number)))
    return str(number).rstrip("0").rstrip(".")


def numeric_value(value: Any) -> float | None:
    text = strip_zero(clean(value))
    if not re.fullmatch(r"-?\d+(?:\.\d+)?", text):
        return None
    return float(text)


def percentile_value(value: Any) -> str:
    text = strip_zero(clean(value))
    number = numeric_value(text)
    if number is None:
        return text
    if 0 <= number <= 100:
        return text
    return ""


def is_likely_total_score(value: Any) -> bool:
    number = numeric_value(value)
    if number is None:
        return False
    return number >= 100 and abs(number - round(number / 50) * 50) < 0.0000001


def append_note(ydata: dict[str, Any], note: str) -> None:
    if not note:
        return
    existing = clean(ydata.get("note", ""))
    ydata["note"] = f"{existing} / {note}" if existing else note


def norm_key(value: Any) -> str:
    text = clean(value)
    text = text.replace("・", "").replace("·", "").replace("ㆍ", "")
    text = text.replace("（", "(").replace("）", ")")
    text = re.sub(r"[\s\[\]{}]", "", text)
    return text


def norm_dept(value: Any) -> str:
    text = norm_key(value)
    replacements = {
        "(5년제)": "(5)",
        "(5년)": "(5)",
        "(6년제)": "(6)",
        "(6년)": "(6)",
        "(4년제)": "(4)",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def split_university_name(name: str) -> tuple[str, str, str]:
    text = clean(name)
    match = re.match(r"^(.*?)\[(.*?)\]$", text)
    if match:
        base = clean(match.group(1))
        campus = clean(match.group(2))
    else:
        base = text
        campus = ""
    return base, campus, base


def short_university_name(name: str) -> str:
    base, _, _ = split_university_name(name)
    return base


def parse_csrf(page_html: str) -> str:
    match = re.search(r'name="_csrf"\s+value="([^"]+)"', page_html)
    if not match:
        match = re.search(r'<meta name="_csrf"\s+content="([^"]+)"', page_html)
    return match.group(1) if match else ""


def make_opener() -> urllib.request.OpenerDirector:
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def fetch_text(
    opener: urllib.request.OpenerDirector,
    url: str,
    *,
    data: dict[str, str] | None = None,
    referer: str | None = None,
    timeout: int = 60,
    attempts: int = 3,
) -> str:
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer
    payload = None
    method = "GET"
    if data is not None:
        payload = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
        headers["X-Requested-With"] = "XMLHttpRequest"
        method = "POST"
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(url, data=payload, headers=headers, method=method)
            with opener.open(request, timeout=timeout) as response:
                return response.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last_error = exc
            time.sleep(0.8 * attempt)
    raise RuntimeError(f"request failed after {attempts} attempts: {url}") from last_error


def read_or_fetch(path: Path, fetcher: Any, *, force: bool = False) -> str:
    if not force and path.exists() and path.stat().st_size > 20:
        return path.read_text(encoding="utf-8", errors="replace")
    text = fetcher()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return text


def parse_universities(fragment: str) -> list[University]:
    decoded = html_lib.unescape(fragment)
    objects = re.findall(r"fnSelCompUnv\(this,\s*(\{.*?\})\)", decoded, flags=re.S)
    universities: list[University] = []
    for obj in objects:
        try:
            data = json.loads(obj)
        except json.JSONDecodeError:
            continue
        code = str(data.get("unvCd") or "").strip()
        if not code:
            continue
        universities.append(
            University(
                unv_cd=code,
                unv_name=clean(data.get("unvNm")),
                region=clean(data.get("stdClsfRgnNm")),
                rcmt_sat=data.get("rcmtSat") if data.get("rcmtSat") is not None else "",
                rnum=data.get("rnum") if data.get("rnum") is not None else "",
            )
        )
    return universities


def fetch_university_list(
    opener: urllib.request.OpenerDirector,
    search_syr: str,
    *,
    force: bool = False,
) -> list[University]:
    log(f"Fetching university list for searchSyr={search_syr}")
    list_dir = RAW_DIR / "lists" / search_syr
    main_path = list_dir / "criteria_view.html"
    main_html = read_or_fetch(main_path, lambda: fetch_text(opener, CRITERIA_VIEW_URL), force=force)
    csrf = parse_csrf(main_html)

    universities: list[University] = []
    seen: set[str] = set()
    empty_pages = 0
    for page in range(1, 61):
        page_path = list_dir / f"page_{page:02d}.html"
        fragment = read_or_fetch(
            page_path,
            lambda page=page: fetch_text(
                opener,
                CRITERIA_LIST_URL,
                data={
                    "_csrf": csrf,
                    "pagination.currentPage": str(page),
                    "pagination.cntPerPage": "15",
                    "searchSyr": search_syr,
                    "searchConstIndex": "0",
                    "unvCd": "",
                    "compUnvCd": "",
                    "searchUnvComp": "0",
                    "tsrdCmphSlcnArtclUpCd": "10",
                    "searchStdClsfRgnCn": "",
                    "searchUnvNm": "",
                },
                referer=CRITERIA_VIEW_URL,
            ),
            force=force,
        )
        parsed = parse_universities(fragment)
        if not parsed:
            empty_pages += 1
            if empty_pages >= 2:
                break
            continue
        empty_pages = 0
        for university in parsed:
            if university.unv_cd in seen:
                continue
            seen.add(university.unv_cd)
            universities.append(university)
        if len(parsed) < 15 and page > 1:
            break
        time.sleep(0.03)

    log(f"  {search_syr}: {len(universities)} universities")
    return universities


def extract_rows(table: Any) -> list[list[str]]:
    rows: list[list[str]] = []
    for tr in table.xpath(".//tr"):
        cells = [clean(cell.text_content()) for cell in tr.xpath("./th|./td")]
        if any(cells):
            rows.append(cells)
    return rows


def gun_from_text(value: str) -> str:
    text = clean(value)
    match = re.search(r"([가나다])\s*군", text)
    if match:
        return match.group(1)
    match = re.search(r"정시\s*\(([가나다])\)", text)
    if match:
        return match.group(1)
    match = re.search(r"^([가나다])$", text)
    if match:
        return match.group(1)
    return ""


def canonical_admission(value: str) -> str:
    text = clean(value)
    text = re.sub(r"^[가나다]\s*군\s*", "", text)
    if not text:
        return "수능위주"
    if text.startswith("수능(") or text.startswith("수능위주("):
        return text
    if text.startswith("수능"):
        return text
    return f"수능({text})"


def admission_key(value: str) -> str:
    text = canonical_admission(value)
    text = text.replace("수능위주", "").replace("수능", "").replace("정시", "")
    text = text.replace("(", "").replace(")", "").replace("[", "").replace("]", "")
    text = re.sub(r"^[가나다]군", "", text)
    text = text.replace(" ", "")
    return text or "수능위주"


def choose_subject(values: list[str]) -> str:
    for value in values:
        normalized = strip_zero(value)
        if normalized and normalized != "0":
            return normalized
    return ""


def ydata_empty_note(m: list[str], c: str, w: str, note: str) -> dict[str, Any]:
    return {
        "m": m,
        "c": strip_zero(c),
        "w": strip_zero(w),
        "hs": ["", "", ""],
        "p50": {"kor": "", "math": "", "t1": "", "t2": "", "avg": "", "hist": "", "eng": ""},
        "p70": {"kor": "", "math": "", "t1": "", "t2": "", "avg": "", "hist": "", "eng": ""},
        "avg": {"50": "", "70": "", "80": "", "90": "", "100": ""},
        "note": clean(note),
    }


def make_ydata_new(cells: list[str]) -> dict[str, Any]:
    if len(cells) < 9:
        return ydata_empty_note(["", "", ""], "", "", "표 구조 미확인")
    m = [strip_zero(cells[2]), strip_zero(cells[3]), strip_zero(cells[4])]
    comp = strip_zero(cells[5]) if len(cells) > 5 else ""
    wait = strip_zero(cells[6]) if len(cells) > 6 else ""
    if len(cells) < 31:
        reason = cells[-1] if cells else ""
        return ydata_empty_note(m, comp, wait, reason)
    p50 = {
        "kor": strip_zero(cells[9]),
        "math": strip_zero(cells[10]),
        "t1": choose_subject(cells[11:14]),
        "t2": choose_subject(cells[14:17]),
        "avg": strip_zero(cells[17]),
        "hist": strip_zero(cells[18]),
        "eng": strip_zero(cells[19]),
    }
    p70 = {
        "kor": strip_zero(cells[20]),
        "math": strip_zero(cells[21]),
        "t1": choose_subject(cells[22:25]),
        "t2": choose_subject(cells[25:28]),
        "avg": strip_zero(cells[28]),
        "hist": strip_zero(cells[29]),
        "eng": strip_zero(cells[30]),
    }
    return {
        "m": m,
        "c": comp,
        "w": wait,
        "hs": [strip_zero(cells[7]), strip_zero(cells[8]), ""],
        "p50": p50,
        "p70": p70,
        "avg": {"50": p50["avg"], "70": p70["avg"], "80": "", "90": "", "100": ""},
    }


def make_ydata_old(data: list[str]) -> dict[str, Any]:
    if len(data) == 6:
        first_score = strip_zero(data[3])
        second_score = strip_zero(data[4])
        last_score = strip_zero(data[5])
        last_number = numeric_value(last_score)
        if is_likely_total_score(last_score) and not is_likely_total_score(second_score):
            hs = [first_score, second_score, last_score]
            avg70 = ""
        else:
            hs = ["", first_score, second_score]
            avg70 = percentile_value(last_score)
        ydata = {
            "m": ["", "", strip_zero(data[0])],
            "c": strip_zero(data[1]),
            "w": strip_zero(data[2]),
            "hs": hs,
            "p50": {"kor": "", "math": "", "t1": "", "t2": "", "eng": "", "hist": "", "avg": ""},
            "p70": {"kor": "", "math": "", "t1": "", "t2": "", "eng": "", "hist": "", "avg": avg70},
            "avg": {"50": "", "70": avg70, "80": "", "90": "", "100": ""},
        }
        if last_number is not None and last_number > 100 and not is_likely_total_score(last_score):
            append_note(ydata, "ADIGA 원표의 평균백분위 항목이 100을 초과하여 백분위 비교에서 제외")
        elif last_number is not None and last_number > 100:
            append_note(ydata, "ADIGA 원표에 평균백분위가 없어 환산점수만 제공")
        return ydata
    if len(data) < 8:
        m = [strip_zero(data[0]) if len(data) > 0 else "", strip_zero(data[1]) if len(data) > 1 else "", strip_zero(data[2]) if len(data) > 2 else ""]
        return ydata_empty_note(m, data[3] if len(data) > 3 else "", data[4] if len(data) > 4 else "", "표 구조 미확인")
    p50 = {
        "kor": strip_zero(data[8]) if len(data) > 8 else "",
        "math": strip_zero(data[9]) if len(data) > 9 else "",
        "t1": strip_zero(data[10]) if len(data) > 10 else "",
        "t2": strip_zero(data[11]) if len(data) > 11 else "",
        "eng": strip_zero(data[12]) if len(data) > 12 else "",
        "hist": strip_zero(data[13]) if len(data) > 13 else "",
    }
    p70 = {
        "kor": strip_zero(data[14]) if len(data) > 14 else "",
        "math": strip_zero(data[15]) if len(data) > 15 else "",
        "t1": strip_zero(data[16]) if len(data) > 16 else "",
        "t2": strip_zero(data[17]) if len(data) > 17 else "",
        "eng": strip_zero(data[18]) if len(data) > 18 else "",
        "hist": strip_zero(data[19]) if len(data) > 19 else "",
    }
    p50["avg"] = average_from_subjects(p50)
    p70["avg"] = average_from_subjects(p70)
    return {
        "m": [strip_zero(data[0]), strip_zero(data[1]), strip_zero(data[2])],
        "c": strip_zero(data[3]),
        "w": strip_zero(data[4]),
        "hs": [strip_zero(data[5]), strip_zero(data[6]), strip_zero(data[7])],
        "p50": p50,
        "p70": p70,
        "avg": {"50": p50["avg"], "70": p70["avg"], "80": "", "90": "", "100": ""},
    }


def average_from_subjects(p: dict[str, str]) -> str:
    values: list[float] = []
    for key in ("kor", "math", "t1", "t2"):
        value = p.get(key, "")
        if re.fullmatch(r"\d+(?:\.\d+)?", value):
            values.append(float(value))
    if not values:
        return ""
    avg = sum(values) / len(values)
    return strip_zero(f"{avg:.2f}")


def parse_new_fragment(fragment: str, university: University, result_year: int) -> list[dict[str, Any]]:
    doc = html.fromstring(fragment)
    rows_out: list[dict[str, Any]] = []
    for card_no, div in enumerate(doc.xpath('//div[contains(concat(" ", normalize-space(@class), " "), " tbAdmRes ")]'), start=1):
        title_nodes = div.xpath(".//h5[1]")
        title = clean(title_nodes[0].text_content()) if title_nodes else ""
        if not title:
            continue
        table_nodes = div.xpath(".//table")
        if not table_nodes:
            continue
        for row_no, cells in enumerate(extract_rows(table_nodes[0]), start=1):
            if len(cells) < 2 or not cells[0].startswith("정시("):
                continue
            dept = cells[1]
            if not dept or dept == "모집단위":
                continue
            rows_out.append(make_row(university, result_year, gun_from_text(cells[0]), title, dept, make_ydata_new(cells), card_no, row_no))
    return rows_out


def parse_old_fragment(fragment: str, university: University, result_year: int) -> list[dict[str, Any]]:
    doc = html.fromstring(fragment)
    tables = doc.xpath("//table")
    if not tables:
        return []
    table_html = html.tostring(tables[-1], encoding="unicode")
    try:
        df = pd.read_html(StringIO(table_html))[0]
    except ValueError:
        return []
    rows_out: list[dict[str, Any]] = []
    for row_no, raw_row in enumerate(df.fillna("").values.tolist(), start=1):
        cells = [clean(value) for value in raw_row]
        if not any(cells):
            continue
        if cells[0] in {"구분", "최초", "모집시기", "과목별 백분위(영어, 한국사는 등급 표기)"}:
            continue
        if cells[0] in {"국", "수", "탐1", "탐2", "영", "한"}:
            continue
        if "대학별 산출방식" in cells[0]:
            continue

        first = cells[0]
        gun = gun_from_text(first)
        if not gun:
            continue
        if re.fullmatch(r"[가나다]\s*군", first):
            if len(cells) >= 9 and not looks_numeric(cells[2]):
                title = canonical_admission(cells[1])
                dept = cells[2]
                data = cells[3:]
            elif len(cells) >= 8:
                title = "수능위주"
                dept = cells[1]
                data = cells[2:]
            else:
                continue
        else:
            if len(cells) < 8:
                continue
            title = canonical_admission(re.sub(r"^[가나다]\s*군\s*", "", first))
            dept = cells[1]
            data = cells[2:]
        if not dept or dept == "모집단위":
            continue
        rows_out.append(make_row(university, result_year, gun, title, dept, make_ydata_old(data), 1, row_no))
    return rows_out


def looks_numeric(value: str) -> bool:
    text = clean(value).replace(",", "").replace("점", "")
    return bool(re.fullmatch(r"-?\d+(?:\.\d+)?|-", text))


def sanitize_ydata(ydata: dict[str, Any]) -> dict[str, Any]:
    for key, label in (("p50", "50%컷"), ("p70", "70%컷")):
        bucket = ydata.get(key)
        if not isinstance(bucket, dict):
            continue
        avg = bucket.get("avg", "")
        number = numeric_value(avg)
        if number is not None and number > 100:
            bucket["avg"] = ""
            if isinstance(ydata.get("avg"), dict):
                ydata["avg"]["50" if key == "p50" else "70"] = ""
            append_note(ydata, f"ADIGA 원표의 {label} 평균값이 100을 초과하여 백분위 비교에서 제외")
    return ydata


def make_row(
    university: University,
    result_year: int,
    gun: str,
    jname: str,
    dept: str,
    ydata: dict[str, Any],
    card_no: int,
    row_no: int,
) -> dict[str, Any]:
    base, campus, uni_base = split_university_name(university.unv_name)
    ydata = sanitize_ydata(ydata)
    return {
        "unvCd": university.unv_cd,
        "university": base,
        "uniBase": uni_base,
        "campus": campus,
        "region": university.region,
        "gun": gun,
        "jname": canonical_admission(jname),
        "admissionKey": admission_key(jname),
        "dept": clean(dept),
        "deptKey": norm_dept(dept),
        "jtype": "수능위주",
        "year": result_year,
        "data": ydata,
        "source": {
            "searchSyr": RESULT_TO_SEARCH_SYR[result_year],
            "upCd": UP_CD_CSAT,
            "cardNo": card_no,
            "rowNo": row_no,
        },
    }


def fetch_result_fragment(
    opener: urllib.request.OpenerDirector,
    university: University,
    result_year: int,
    *,
    force: bool = False,
) -> str:
    search_syr = RESULT_TO_SEARCH_SYR[result_year]
    result_dir = RAW_DIR / "results" / str(result_year)
    if result_year == 2026:
        item_path = result_dir / f"{university.unv_cd}_itemnew.html"
        referer = f"{POPUP_URL}?unvCd={university.unv_cd}&searchSyr={search_syr}&tsrdCmphSlcnArtclUpCd={UP_CD_CSAT}"
        return read_or_fetch(
            item_path,
            lambda: fetch_text(
                opener,
                ITEM_NEW_URL,
                data={
                    "searchSyr": search_syr,
                    "unvCd": university.unv_cd,
                    "tsrdCmphSlcnArtclUpCd": UP_CD_CSAT,
                    "compUnvCd": "",
                },
                referer=referer,
                timeout=80,
            ),
            force=force,
        )

    popup_path = result_dir / f"{university.unv_cd}_popup.html"
    item_path = result_dir / f"{university.unv_cd}_item.html"
    popup_url = f"{POPUP_URL}?unvCd={university.unv_cd}&searchSyr={search_syr}&tsrdCmphSlcnArtclUpCd={UP_CD_CSAT}"
    popup_html = read_or_fetch(
        popup_path,
        lambda: fetch_text(opener, popup_url, referer=CRITERIA_VIEW_URL, timeout=80),
        force=force,
    )
    csrf = parse_csrf(popup_html)
    return read_or_fetch(
        item_path,
        lambda: fetch_text(
            opener,
            ITEM_OLD_URL,
            data={
                "_csrf": csrf,
                "searchSyr": search_syr,
                "searchStdClsfRgnCn": "",
                "searchUnvNm": "",
                "unvCd": university.unv_cd,
                "compUnvCd": "",
                "searchUnvComp": "0",
                "tsrdCmphSlcnArtclUpCd": UP_CD_CSAT,
                "tsrdCmphSlcnArtclCd": ITEM_CD_RESULT,
            },
            referer=popup_url,
            timeout=80,
        ),
        force=force,
    )


def record_key(row: dict[str, Any]) -> tuple[str, str, str, str]:
    return (row["unvCd"], row["deptKey"], row["admissionKey"], row["gun"])


def build_records(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for row in sorted(rows, key=lambda r: (r["unvCd"], r["deptKey"], r["admissionKey"], r["gun"], -r["year"])):
        key = record_key(row)
        if key not in grouped:
            grouped[key] = {
                "id": "-".join(key),
                "unvCd": row["unvCd"],
                "university": row["university"],
                "uniBase": row["uniBase"],
                "campus": row["campus"],
                "region": row["region"],
                "gun": row["gun"],
                "jname": row["jname"],
                "admissionKey": row["admissionKey"],
                "dept": row["dept"],
                "deptKey": row["deptKey"],
                "jtype": "수능위주",
                "years": {},
            }
        record = grouped[key]
        year_key = str(row["year"])
        if year_key in record["years"]:
            existing = record["years"][year_key]
            if data_score(row["data"]) <= data_score(existing):
                continue
        ydata = row["data"]
        ydata["source"] = row["source"]
        record["years"][year_key] = ydata
        if row["year"] == 2026:
            record["university"] = row["university"]
            record["uniBase"] = row["uniBase"]
            record["campus"] = row["campus"]
            record["region"] = row["region"]
            record["jname"] = row["jname"]
            record["dept"] = row["dept"]
    records = list(grouped.values())
    for record in records:
        record["searchText"] = "".join(
            [
                record.get("university", ""),
                record.get("dept", ""),
                record.get("jname", ""),
                record.get("region", ""),
                record.get("gun", ""),
            ]
        )
        record.pop("deptKey", None)
        record.pop("admissionKey", None)
    records.sort(key=lambda r: (r.get("university", ""), r.get("gun", ""), r.get("jname", ""), r.get("dept", "")))
    for idx, record in enumerate(records, start=1):
        record["id"] = f'{record["unvCd"]}-{idx:05d}'
    return records


def data_score(ydata: dict[str, Any]) -> int:
    score = 0
    for value in json.dumps(ydata, ensure_ascii=False).split('"'):
        if value and value not in {"0", "-", "0.0"}:
            score += 1
    return score


def distribution(records: list[dict[str, Any]], field: str) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for record in records:
        value = record.get(field) or "기타"
        counts[value] = counts.get(value, 0) + 1
    return [{"name": name, "count": count} for name, count in sorted(counts.items())]


def write_site_data(records: list[dict[str, Any]], rows: list[dict[str, Any]], *, dry_run: bool = False) -> dict[str, Any]:
    by_year = {str(year): sum(1 for row in rows if row["year"] == year) for year in sorted(RESULT_TO_SEARCH_SYR)}
    metadata = {
        "title": "정시(수능위주전형) 입시결과",
        "years": sorted(RESULT_TO_SEARCH_SYR),
        "generated": datetime.now().strftime("%Y-%m-%d"),
        "source": "대입정보포털(ADIGA) 공식 정시(수능위주전형) 전형 결과",
        "counts": {
            "records": len(records),
            "universities": len({record["unvCd"] for record in records}),
            "officialRowsByYear": by_year,
        },
        "distributions": {
            "regions": distribution(records, "region"),
            "guns": distribution(records, "gun"),
        },
        "official": {
            "baseUrl": BASE,
            "upCd": UP_CD_CSAT,
            "resultYearToSearchSyr": {str(k): v for k, v in RESULT_TO_SEARCH_SYR.items()},
        },
    }
    payload = {"metadata": metadata, "records": records}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    official_json = OUT_DIR / "jeongsi-data-official.json"
    official_json.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if not dry_run:
        SITE_DATA.parent.mkdir(parents=True, exist_ok=True)
        if SITE_DATA.exists():
            backup = SITE_DATA.with_name(f"jeongsi-data.backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json")
            shutil.copy2(SITE_DATA, backup)
            log(f"Backed up existing data to {backup}")
        SITE_DATA.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        log(f"Wrote {SITE_DATA}")
    log(f"Wrote official copy {official_json}")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", nargs="+", type=int, default=[2024, 2025, 2026])
    parser.add_argument("--limit", type=int, default=0, help="Limit universities per searchSyr for smoke tests.")
    parser.add_argument("--force", action="store_true", help="Refetch cached ADIGA HTML.")
    parser.add_argument("--dry-run", action="store_true", help="Do not overwrite site data.")
    args = parser.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    opener = make_opener()
    universities_by_search: dict[str, list[University]] = {}
    for search_syr in sorted({RESULT_TO_SEARCH_SYR[year] for year in args.years}):
        universities = fetch_university_list(opener, search_syr, force=args.force)
        if args.limit:
            universities = universities[: args.limit]
        universities_by_search[search_syr] = universities

    all_rows: list[dict[str, Any]] = []
    statuses: list[dict[str, Any]] = []
    for result_year in args.years:
        search_syr = RESULT_TO_SEARCH_SYR[result_year]
        universities = universities_by_search[search_syr]
        log(f"Collecting result_year={result_year} from searchSyr={search_syr}: {len(universities)} universities")
        for idx, university in enumerate(universities, start=1):
            status = {"resultYear": result_year, "searchSyr": search_syr, "unvCd": university.unv_cd, "unvName": university.unv_name, "rows": 0, "status": "ok", "error": ""}
            try:
                fragment = fetch_result_fragment(opener, university, result_year, force=args.force)
                if result_year == 2026:
                    rows = parse_new_fragment(fragment, university, result_year)
                else:
                    rows = parse_old_fragment(fragment, university, result_year)
                status["rows"] = len(rows)
                all_rows.extend(rows)
            except Exception as exc:
                status["status"] = "error"
                status["error"] = f"{type(exc).__name__}: {exc}"
            statuses.append(status)
            if idx % 20 == 0 or idx == len(universities):
                log(f"  {result_year}: {idx}/{len(universities)} universities, rows={sum(s['rows'] for s in statuses if s['resultYear'] == result_year)}")
            time.sleep(0.04)

    status_path = OUT_DIR / "collection-status.json"
    status_path.write_text(json.dumps(statuses, ensure_ascii=False, indent=2), encoding="utf-8")
    records = build_records(all_rows)
    payload = write_site_data(records, all_rows, dry_run=args.dry_run)
    log(
        "Done: "
        + json.dumps(
            {
                "records": payload["metadata"]["counts"]["records"],
                "universities": payload["metadata"]["counts"]["universities"],
                "rowsByYear": payload["metadata"]["counts"]["officialRowsByYear"],
                "errors": sum(1 for status in statuses if status["status"] != "ok"),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
