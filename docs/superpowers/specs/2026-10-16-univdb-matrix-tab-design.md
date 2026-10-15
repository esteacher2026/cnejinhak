# sub2.html `#univDB` — "전공별 반영과목 매트릭스" 탭 추가 설계

- 작성일: 2026-10-16
- 대상 파일: `sub2.html` (전공별 선택과목 추천 지도), `index.html`(카드 설명 1줄), 신규 `scripts/build_subject_matrix.py`
- 원자료: `~/Downloads/2028학년도 계열별 대표 모집단위별 반영과목.xlsx` (시트 `반영과목`, A1:R245)
- 선택안: **B안** — 기존 `#univDB`(대학별 권장과목 검색)에 탭을 추가해 한 섹션에서 두 자료를 오간다.

---

## 1. 배경과 목표

### 1.1 두 자료의 관계

| | 파일 1: 권역별 대학별 권장과목 | 파일 2: 계열별 대표 모집단위별 반영과목 |
|---|---|---|
| 현재 상태 | **이미 sub2.html `#univDB`에 1,358건 전체 내장** (검색·필터·즐겨찾기·비교함) | 사이트에 없음 |
| 구조 | 대학 → 모집단위 → 과목(자유서술·교과군·세부과목 혼재) | 대표 모집단위 16개 → 대학 × 세부과목 16열 (●/빈칸 매트릭스) |
| 답하는 질문 | "이 대학 이 학과는 무엇을 권장하나" (세로 탐색) | "이 전공에 가려면 어느 대학이 어떤 과목을 보나 / 내가 들은 과목으로 어디가 맞나" (가로 비교) |
| 규모 | 47개 대학(캠퍼스 포함), 1,358행 | 7계열 16모집단위, 46개 대학, 241행 |

파일 1은 대학마다 표기 방식이 극단적으로 달라(자유서술형·교과군형·세부과목 나열형·조건부 표현) 대학 간 **비교가 불가능**하다. 파일 2는 과목 축을 16개로 고정했기 때문에 비교가 가능하다. 두 자료는 상보적이며, 파일 2의 대학 셀에서 파일 1 원문으로 건너갈 수 있어야 가치가 완성된다.

### 1.2 목표(성공 기준)

1. 교사·학생이 **모집단위 하나를 고르면 10초 안에** "어느 대학이 어떤 과목을 보는지, 어떤 과목이 공통인지"를 읽을 수 있다.
2. 학생이 **자기 이수(예정) 과목을 체크하면** 대학별 충족/부족이 즉시 표시된다(상담 장면의 핵심 질문).
3. 매트릭스의 대학명을 누르면 **파일 1 원문(핵심·권장·비고)으로 바로 연결**된다.
4. 원자료의 오류·모호한 셀은 **정정 사실과 근거를 정오표로 공개**한다(사이트 원칙: 출처 간 충돌·정정은 각주로 명시).
5. 기존 검색 탭의 동작·데이터(1,358건)는 **바이트 단위로 변경하지 않는다**(회귀 0).

### 1.3 범위 밖(YAGNI)

- 매트릭스 데이터의 즐겨찾기·비교함(기존 탭에 이미 있음, 매트릭스는 한 화면 비교가 목적).
- CSV 다운로드(인쇄 스타일로 대체).
- 파일 1 데이터 재파싱·재구성(이미 정규화되어 있음).
- 대표 모집단위 외 학과로의 확장(원자료에 없음).

---

## 2. 원자료 분석과 데이터 규칙

### 2.1 시트 구조

- 1–2행 제목/주석(`* 표시 대학은 학과 특성에 따라 일반 선택 과목 이수 후 진로와 적성에 맞게 과목 이수 권장 대학임`).
- 3–4행 2단 헤더. 열 고정:

| 열 | 교과군 | 세부과목 키 |
|---|---|---|
| C | 국어 | `kor` |
| D–H | 수학 | `alg` 대수, `prob` 확률과 통계, `calc1` 미적분Ⅰ, `calc2` 미적분Ⅱ, `geo` 기하 |
| I | 영어 | `eng` |
| J–M | 사회 | `soc` 일반사회, `hist` 역사, `geog` 지리, `eth` 윤리 |
| N–Q | 과학 | `phy` 물리학, `chem` 화학, `bio` 생명과학, `earth` 지구과학 |
| R | 기타 | `etc` (자유 텍스트) |

- 5–245행 데이터. A=계열, B=모집단위, 셀 값 = 대학명(반영) / `-` / 빈칸.
- 계열·모집단위(16개, 행 수): 인문(영어영문 14, 철학 13) · 사회(경영 25, 심리 11) · 교육(국어교육 11, 수학교육 14) · 자연(생명과학 16, 물리 18, 화학 21) · 공학(기계공학 24, 컴퓨터공학 35) · 의약(약학 11, 의예 18) · 예체능(시각디자인 5, 음악 1, 체육 4).

### 2.2 셀 해석 규칙(빌드 스크립트가 구현)

| 규칙 | 해석 | JSON 표현 |
|---|---|---|
| R1 | 세부과목 열에 대학명 | 해당 과목 반영 | `marks: ["calc2", ...]` |
| R2 | 교과군 범위 전체 병합(`D:H`, `J:M`, `N:Q`) + 대학명 | "그 교과 전체" (세부 지정 없음) | `groups: ["math"]` (`math`/`soc`/`sci`) |
| R3 | 부분 병합(`N129:P129`, `N147:P147` = 물·화·생) | 병합이 덮는 세부과목 각각 반영 | `marks` 로 전개 |
| R4 | `C:R` 전체 병합 + 대학명(한라대 54·170·204행) | 전 교과 반영(파일 1 한라대 원문 "국어, 영어, 수학, 사회, 과학 교과"와 일치) | `groups: ["kor","math","eng","soc","sci"]`, `allSubjects: true` |
| R5 | 대학명 뒤 `⁎` 또는 `*` | 원자료 별표(일반선택 이수 후 진로·적성 권장). 단국대·아주대·협성대는 행 전체, 경북대·숭실대·충남대는 특정 셀에만 붙음 → **셀 단위 플래그**로 보존 | `stars: ["phy"]` 또는 `starAll: true` |
| R6 | `(역사/도덕 포함)` 등 괄호 메모 | 셀 메모 | `cellNotes: {"soc": "역사/도덕 포함"}` |
| R7 | 기타 열 `서울대\n(제2외/한문)` | 첫 줄 대학명, 괄호 안은 기타 과목 텍스트 | `etc: "제2외/한문"` (영남대 42행처럼 텍스트 없으면 `etc: ""`) |
| R8 | 한 행에 대학명이 둘 이상 섞인 경우(51·78행 충북대 행의 "충남대") | 2.3 정오표로 정정 | — |
| R9 | 공백만 있는 셀(`' '`, 83·239행) | 빈칸 | — |
| R10 | 대학명 정규화 | 캠퍼스 괄호 보존, 파일 1 `university_display` 키로 매핑 | `university`, `universityKey` |

대학명 매핑표(파일 2 → 파일 1 `university_display`): `강원대`/`(춘천)` → `강원대(춘천)`, `강원대(삼척)` → `강원대(삼척·도계)`, `경성대` → `경성대학교`, `전남대` → `전남대(광주)`, `한체대` → `한국체대`, 그 외 동일. `동양대`는 파일 1에 없음 → 권역 `영남권/경북`을 스크립트 상수로 부여하고 `universityKey: null`.

권역·지역은 파일 1 레코드의 `region_group`/`region`에서 조인한다(매트릭스 권역 필터용).

### 2.3 정오표(errata) — 스크립트가 적용하고 페이지가 공개

| # | 원자료 위치 | 문제 | 조치 | 근거 |
|---|---|---|---|---|
| E1 | 32–33행 경영 | `강원대` / `(춘천)` 두 행으로 분리 기재 | 한 행(강원대(춘천))으로 병합 | 셀 병합 `D32:D33` 등이 같은 행임을 보여줌 |
| E2 | 51행 경영 | 국어·영어는 `충북대`, 일반사회(`J51:M51` 병합)는 `충남대` | 사회 전체 = 충북대로 정정 | 50행이 충남대 행, 51행은 충북대 행 |
| E3 | 78행 국어교육 | 국어 `충북대`, 일반사회 `충남대(역사/도덕포함)` | 충북대로 정정, 메모 유지 | 77행이 충남대 행 |
| E4 | 195–201행 컴퓨터공학 | 원광대·전남대·전북대·조선대·중앙대·충남대·충북대 7행이 컴퓨터공학 아래 **중복** 수록. 원광대 195=229(의예), 조선대 198=191 및 232(의예), 충남대 200=234(의예), 충북대 201=235(의예), 중앙대 199=233(의예)와 **셀 패턴이 동일**. 원광대는 파일 1에 컴퓨터 계열 모집단위 자체가 없음 | 매트릭스에서 **제외**(`excluded: true`), 정오표에 표시 | 파일 1 원문 대조(전남대 전자컴퓨터공학부=수학·물리학=188행과 일치, 조선대 컴퓨터공학전공=수학·과학=191행과 일치) |
| E5 | 55행 경영 한양대 | 미적분Ⅱ·기하·물리학·화학·생명과학 = 자연계 패턴. 파일 1의 한양대 자료는 "자연 > 전 모집단위" 1건뿐 | **유지하되 ⚠ 경고 플래그**(`warn: "자연계열 안내가 경영에 적용된 것으로 보임"`) | 파일 1 한양대 원문 |
| E6 | 239행 시각디자인 조선대 | 병합 `J239:N239`가 사회 4열 + 물리학까지 걸침 | 사회 전체로만 해석 | 파일 1 조선대 디자인 계열 = "국어, 사회" |
| E7 | 54·170·204행 한라대 | `C:R` 전체 병합 | R4 적용(전 교과) | 파일 1 한라대 원문 |
| E8 | 129·147행 | 과학 부분 병합(물·화·생) | R3 적용 | 파일 1 경기대 "과학(3과목)" |

정오표는 JSON `errata[]`에 들어가며 페이지의 "정오표·해석 규칙" 모달에서 그대로 렌더링한다. 정정 전 원문 값은 `raw` 필드에 보존한다.

### 2.4 출력 JSON 스키마 (`<script id="matrix-data" type="application/json">`)

```json
{
  "meta": { "year": "2028", "source": "2028학년도 계열별 대표 모집단위별 반영과목", "built": "2026-10-16", "sourceRows": 241, "records": 233 },
  "subjects": [
    { "key": "kor",  "label": "국어",       "short": "국어", "group": "kor" },
    { "key": "alg",  "label": "대수",       "short": "대수", "group": "math" },
    { "key": "prob", "label": "확률과 통계", "short": "확통", "group": "math" },
    { "key": "calc1","label": "미적분Ⅰ",    "short": "미적Ⅰ", "group": "math" },
    { "key": "calc2","label": "미적분Ⅱ",    "short": "미적Ⅱ", "group": "math" },
    { "key": "geo",  "label": "기하",       "short": "기하", "group": "math" },
    { "key": "eng",  "label": "영어",       "short": "영어", "group": "eng" },
    { "key": "soc",  "label": "일반사회",   "short": "일사", "group": "soc" },
    { "key": "hist", "label": "역사",       "short": "역사", "group": "soc" },
    { "key": "geog", "label": "지리",       "short": "지리", "group": "soc" },
    { "key": "eth",  "label": "윤리",       "short": "윤리", "group": "soc" },
    { "key": "phy",  "label": "물리학",     "short": "물리", "group": "sci" },
    { "key": "chem", "label": "화학",       "short": "화학", "group": "sci" },
    { "key": "bio",  "label": "생명과학",   "short": "생명", "group": "sci" },
    { "key": "earth","label": "지구과학",   "short": "지구", "group": "sci" }
  ],
  "groups": [ { "key": "kor", "label": "국어" }, { "key": "math", "label": "수학" }, { "key": "eng", "label": "영어" }, { "key": "soc", "label": "사회" }, { "key": "sci", "label": "과학" } ],
  "units": [
    { "key": "eng-lit",       "field": "인문",   "label": "영어영문",   "order": 1 },
    { "key": "philosophy",    "field": "인문",   "label": "철학",       "order": 2 },
    { "key": "business",      "field": "사회",   "label": "경영",       "order": 3 },
    { "key": "psychology",    "field": "사회",   "label": "심리",       "order": 4 },
    { "key": "korean-edu",    "field": "교육",   "label": "국어교육",   "order": 5 },
    { "key": "math-edu",      "field": "교육",   "label": "수학교육",   "order": 6 },
    { "key": "life-science",  "field": "자연",   "label": "생명과학",   "order": 7 },
    { "key": "physics",       "field": "자연",   "label": "물리",       "order": 8 },
    { "key": "chemistry",     "field": "자연",   "label": "화학",       "order": 9 },
    { "key": "mech-eng",      "field": "공학",   "label": "기계공학",   "order": 10 },
    { "key": "computer-eng",  "field": "공학",   "label": "컴퓨터공학", "order": 11 },
    { "key": "pharmacy",      "field": "의약",   "label": "약학",       "order": 12 },
    { "key": "medicine",      "field": "의약",   "label": "의예",       "order": 13 },
    { "key": "visual-design", "field": "예체능", "label": "시각디자인", "order": 14 },
    { "key": "music",         "field": "예체능", "label": "음악",       "order": 15 },
    { "key": "phys-ed",       "field": "예체능", "label": "체육",       "order": 16 }
  ],
  "records": [
    {
      "id": "m-0171", "srcRow": 171, "unit": "mech-eng", "field": "공학",
      "university": "한양대(ERICA)", "universityKey": "한양대(ERICA)", "regionGroup": "수도권", "region": "경기",
      "marks": ["calc1", "calc2", "phy"], "groups": [], "allSubjects": false, "stars": [], "starAll": false,
      "cellNotes": {}, "etc": null, "warn": null, "excluded": false, "excludedReason": null,
      "raw": { "C": "-", "D": "-", "E": "-", "F": "한양대(ERICA)", "G": null, "H": "-", "I": "-", "J": "-", "K": "-", "L": "-", "M": "-", "N": "한양대(ERICA)", "O": "-", "P": "-", "Q": "-", "R": "-", "merges": ["F171:G171"] }
    }
  ],
  "errata": [
    { "id": "E1", "rows": [32, 33], "unit": "business", "issue": "강원대 / (춘천) 두 행으로 분리 기재", "action": "한 행으로 병합", "basis": "셀 병합 D32:D33 등이 같은 행임을 보여줌" }
  ],
  "unitLinks": {
    "eng-lit": ["영어영문", "영문", "영어"], "philosophy": ["철학"], "business": ["경영학", "경영"], "psychology": ["심리"],
    "korean-edu": ["국어교육"], "math-edu": ["수학교육"], "life-science": ["생명과학", "생물", "생명"], "physics": ["물리"],
    "chemistry": ["화학과", "화학"], "mech-eng": ["기계"], "computer-eng": ["컴퓨터", "소프트웨어", "SW", "전산", "인공지능", "AI"],
    "pharmacy": ["약학"], "medicine": ["의예", "의학", "의과"], "visual-design": ["시각디자인", "디자인"], "music": ["음악"], "phys-ed": ["체육", "스포츠"]
  }
}
```

`raw`는 원자료 C–R 셀 값(병합 범위 포함)을 그대로 보존한다. `errata[]`의 항목 구조는 위 E1과 같고 2.3의 E1–E8 전부를 담는다.

`unitLinks`는 파일 1 모집단위명과의 키워드 매칭표(3.5절). 예상 크기 ≈ 60KB(raw 포함). 기존 sub2.html 3.4MB 대비 무시 가능.

---

## 3. UI 설계

### 3.1 탭 구조

`#univDB` 섹션의 `section-head` 바로 아래에 ARIA 탭 바를 넣고, 기존 내용을 `#udbPaneSearch`로, 새 내용을 `#udbPaneMatrix`로 감싼다.

```
#univDB
 ├ .section-head  (h2 "대학별 권장과목 확인", 설명문에 두 자료 모두 언급)
 ├ .udb-tabs  [role=tablist]
 │    ├ button#udbTabSearch  [role=tab]  "대학별 권장과목 검색"  (1,358건)
 │    └ button#udbTabMatrix  [role=tab]  "전공별 반영과목 매트릭스" (16개 대표 모집단위)
 ├ #udbPaneSearch [role=tabpanel]   ← 기존 마크업 그대로 이동(변경 없음)
 └ #udbPaneMatrix [role=tabpanel] hidden
```

- 탭 상태: URL 해시 `#univDB` → 검색, `#univDB-matrix` → 매트릭스. 전환 시 `history.replaceState`. `localStorage['udb2028.tab']`에도 저장(해시 없을 때 복원).
- 키보드: ←/→, Home/End로 탭 이동(표준 tablist 패턴). 활성 탭 `aria-selected`, 비활성 패널 `hidden`.
- 상단 nav의 "대학별 권장과목" 링크는 그대로 `#univDB`.
- 기존 `udb-bridge`("대학별 권장과목 검색하기 →")와 전공 카드의 `udbSearchByMajor` 진입은 검색 탭을 강제 활성화한 뒤 동작한다.

### 3.2 매트릭스 패널 구성(위→아래)

1. **안내 notice** (기존 `.notice` 스타일): 출처·기준, 범례, "정오표·해석 규칙 보기" 버튼(모달).
2. **모집단위 선택기**: 계열 7개를 소제목으로, 그 아래 모집단위 칩 16개(버튼, 건수 배지 예: `컴퓨터공학 28`). 단일 선택. 기본값: 마지막 선택(localStorage `udb2028.mUnit`), 없으면 `컴퓨터공학`(가장 많은 대학, 공학 수요가 가장 큼).
3. **도구 행**(`.udm-tools`):
   - 보기 세그먼트: `모집단위별 보기`(기본) | `과목별 보기`(3.4절)
   - 권역 select(전체/수도권/영남권/중부권/호남권) — 파일 1 조인값 기준, 동양대는 영남권.
   - 대학 검색 input(부분일치, 디바운스 200ms).
   - 정렬 select: 원자료 순(기본) / 대학명순 / 반영 과목 수 많은 순 / 권역·지역순 / (점검 모드일 때) 부족 과목 적은 순.
   - `내 이수과목 점검` 토글 버튼(3.3절).
4. **매트릭스 표**(`.udm-table-wrap` 안, 가로 스크롤):
   - 2단 sticky 헤더: 1단 교과군(국어·수학·영어·사회·과학·기타), 2단 세부과목 15개 + 기타. 1051px 이하에서는 `short` 라벨.
   - 1열 sticky: 대학명(버튼, 클릭 → 3.5절 원문 연결) + 권역 작은 글씨 + ⚠/✱ 아이콘.
   - 셀: 반영 `●`(navy), 교과 전체는 해당 교과군 5/4/4열을 `colspan`으로 묶어 연한 navy 띠에 "수학 전체"라고 표기, 셀 별표는 `●✱`, 메모 있는 셀은 점선 밑줄 + `title`. 기타 열은 텍스트.
   - 마지막 열 `반영 수`: marks 수 + 교과 전체 수를 "n과목(+교과 전체 1)" 형식.
   - **푸터 행 "반영 대학 수"**: 열마다 `k / N`과 가로 미니바(비율). 교과 전체 지정은 그 교과군의 모든 세부열에 "+g" 로 별도 합산 표시(예: `12 +3`). 이 행이 "이 전공은 미적분Ⅱ·물리학이 사실상 필수"라는 패턴을 드러내는 핵심 장치다.
   - 행/열 호버 하이라이트(CSS `:hover` + 열은 JS로 `data-col` 클래스 토글).
   - 빈 결과(권역·검색으로 0건): 기존 `.empty` 스타일 메시지.
5. **모바일(≤680px) 카드 모드**: 표 대신 대학별 카드. 카드 = 대학명 + 권역 + 교과군별로 묶은 과목 칩(교과 전체는 "수학 전체" 칩), 기타, ✱/⚠. 점검 모드 상태 배지 포함. 680px 초과에서는 항상 표, 이하에서는 카드(토글 없음, 단순화).
6. **인쇄**: 도구 행·칩 숨김, 표는 가로 페이지 가정 `@media print` 최소 폭 해제.

### 3.3 내 이수과목 점검(학생 모드)

- 토글 ON 시 표 위에 패널 `.udm-check` 펼침: 교과군별 체크박스 15개(기타 제외). 선택은 `localStorage['udb2028.mySubs']`에 저장.
- 요약줄: `선택 n과목 → 충족 k / 전체 N 대학` + "부족 과목이 가장 많이 언급된 과목: 미적분Ⅱ(7개 대학)" 1줄.
- 행 판정 규칙(단순·설명 가능해야 함):
  - `marks`의 모든 과목이 체크됨 → **충족**(초록 배지).
  - `groups`(교과 전체)는 그 교과군에서 **1과목 이상** 체크되면 충족으로 간주. 배지에 "교과 전체 안내: 세부 과목 지정 없음" 툴팁. (관대한 기준임을 범례에 명시.)
  - 그 외 → **부족 n과목**(주황 배지) + 부족 과목 목록 툴팁/카드에 표기.
  - `allSubjects`(한라대) → 1과목 이상 체크 시 충족.
  - 기타 열은 판정에서 제외(표에 "기타 미반영" 각주).
- 셀 색: 체크된 과목 열의 `●`는 초록, 체크 안 된 열의 `●`는 주황 → "내가 안 들은 과목을 어느 대학이 보는지"가 색으로 드러남.
- 정렬 옵션 "부족 과목 적은 순"이 자동 활성화(사용자가 바꾸면 유지).

### 3.4 과목별 보기(역조회)

- 과목 select(15과목 + "교과 전체 지정 포함" 체크).
- 결과: 16개 모집단위 행 × `반영 대학 수 / 전체`, 비율 미니바, 펼치면 대학 칩 목록(클릭 시 해당 모집단위 매트릭스로 전환 + 그 대학 행 하이라이트).
- 답하는 질문: "기하를 안 들으면 어느 전공에서 불리한가".

### 3.5 파일 1 원문 연결

- 매트릭스의 대학명 클릭 → `linkToSearch(record)`:
  1. `universityKey`가 없으면(동양대) 토스트 "권장과목 원문 자료에 없는 대학입니다" 후 종료.
  2. 파일 1 레코드 중 `university_display === universityKey` 이고 `unit_name`·`unit_parent`에 `unitLinks[unit]` 키워드 중 하나가 포함된 레코드를 찾는다.
  3. 정확히 1건 → 기존 상세 모달을 연다(`window.udbOpenRecord(id)` — 기존 IIFE에 **1줄 export 추가**).
  4. 2건 이상 → 검색 탭으로 전환하고 대학 필터 + 모집단위 키워드 검색어를 적용(`window.udbFilterUniversity(universityKey, keyword)` — 기존 IIFE에 export 추가, 내부적으로 `resetAll()` 후 `st.university`·`st.query` 설정).
  5. 0건(단국대·경북대 등 단과대 단위로만 수록된 대학, 사전 조사에서 대학×모집단위 쌍의 약 1/8) → 대학 필터만 적용해 검색 탭으로 전환하고 결과 헤드라인에 "모집단위 단위 자료가 없어 대학 전체를 표시합니다" 안내.
- 검색 탭 → 매트릭스 역방향 링크: 기존 상세 모달 하단에 "이 대학의 대표 모집단위 매트릭스 보기" 버튼을 **추가하지 않는다**(YAGNI, 모달 코드 수정 최소화). 대신 매트릭스 안내문에 "검색 탭에서 원문 확인" 흐름만 설명.

### 3.6 정오표·해석 규칙 모달

- 기존 공용 모달(`#modalBackdrop`, `openModal(head, body)` 패턴)을 재사용. 매트릭스 IIFE는 자체 `openModal`을 같은 방식으로 정의(DOM id 공유, 기존 포커스 트랩 패치가 그대로 적용됨).
- 내용: 2.2 해석 규칙 요약(범례), 2.3 정오표 표(`errata[]` 렌더), 출처·기준일, "정확한 반영 기준은 각 대학 모집요강 확인" 문구.

---

## 4. 코드 구조와 변경 범위

### 4.1 `sub2.html` 변경(모두 추가, 기존 코드 수정은 2곳)

| 위치 | 변경 |
|---|---|
| `<style>` 끝 | `/* ===== univ-matrix (udm) ===== */` 블록 추가. 접두사 `.udm-`. 탭 바 `.udb-tabs`. 기존 `@media(max-width:1050px)`/`(max-width:680px)`/`print` 블록 **안에 규칙 추가하지 않고** 별도 미디어 블록을 새 CSS 블록 끝에 둔다(기존 규칙 불변). |
| `#univDB` 마크업 | `section-head` 설명문 1문장 교체, 탭 바 삽입, 기존 내용을 `<div id="udbPaneSearch" role="tabpanel">…</div>`로 감쌈, `#udbPaneMatrix` 추가. |
| `records-data` 뒤 | `<script id="matrix-data" type="application/json">…</script>` 추가. |
| 기존 udb IIFE 끝(`window.udbSearchUniversity` 아래) | `window.udbOpenRecord = openDetail;` 와 `window.udbFilterUniversity = function(univ, q){ resetAll(); st.university = univ; st.query = q || ''; refreshSelects(); syncControls(); applyFilters(); }` **2개 export만 추가**. |
| 기존 udb IIFE `udbSearchByMajor`/`udbSearchUniversity` | 수정하지 않음. 새 IIFE가 두 전역 함수를 **감싸서 재할당**한다: `const orig = window.udbSearchByMajor; window.udbSearchByMajor = m => { activateTab('search'); orig(m); }` (udbSearchUniversity도 동일). `.udb-bridge` 링크(`href="#univDB"`)는 해시 변경 리스너가 검색 탭을 활성화한다. |
| 마지막 UX 패치 IIFE 앞 | 새 IIFE `(function(){ 'use strict'; /* udm */ })();` 추가. |
| `<head>` meta description/og | "16개 대표 모집단위 반영과목 매트릭스" 1구 추가. |

### 4.2 새 IIFE(`udm`) 모듈 구조

```
const M = JSON.parse(matrix-data)
const R1 = JSON.parse(records-data)   // 파일 1. 기존 IIFE가 내부 변수를 노출하지 않으므로 다시 파싱(2MB, 수십 ms, 허용)
state = { tab, unit, view:'unit'|'subject', region:'', q:'', sort:'source', check:false, mySubs:Set, subject:'calc2', includeGroups:true }
index = { byUnit: Map<unitKey, record[]>, byUniv: Map<universityKey, record[]> }   // excluded 제외
renderTabs() / activateTab(name, {scroll})
renderUnitChips()
renderTools()
visibleRecords() → unit·region·q 필터 + sort
renderMatrixTable() / renderCards()  (viewport ≤680 판단은 matchMedia)
renderFooterCounts(records)
evaluate(record, mySubs) → { ok, missing[], groupOk[] }
renderCheckPanel()
renderSubjectView()
linkToSearch(record)
openErrataModal()
bind()  — 패널 루트 1개에 이벤트 위임(data-udm-* 속성)
init()  — 해시/스토리지 복원 → 렌더
```

파일 1 레코드는 `records-data`를 다시 파싱해 `university_display`로 인덱싱한다(기존 IIFE 내부 변수를 건드리지 않기 위함).

### 4.3 빌드 스크립트 `scripts/build_subject_matrix.py`

- 입력: xlsx 경로(인자), 출력: `--json out.json`(검토용) 및 `--inject sub2.html`(`<script id="matrix-data">` 블록을 통째로 교체, 없으면 `records-data` 뒤에 삽입).
- xlsx는 openpyxl 일반 모드에서 스타일 오류로 열리지 않으므로 `read_only=True`로 값만 읽고, 병합 범위는 `xl/worksheets/sheet2.xml`의 `<x:mergeCell ref>`를 직접 파싱한다(네임스페이스 접두사 `x:` 주의).
- 한글은 `unicodedata.normalize('NFC')` 적용.
- 정오표(2.3)는 스크립트 상단 `ERRATA` 상수(행 번호·조치·근거)로 선언하고, 적용 결과를 JSON `errata[]`에 그대로 내보낸다.
- 실행 시 요약 출력: 원자료 행 수, 제외 행, 레코드 수, 모집단위별 건수, 파일 1 매핑 실패 대학 목록(동양대 1개여야 함).
- `python3 -I` 로 실행 가능해야 함(원자료는 신뢰하지 않는 입력).
- 의존성: `openpyxl`만 사용(저장소의 다른 스크립트는 pandas를 쓰지만, 이 파일은 스타일 손상으로 pandas/openpyxl 일반 모드가 실패하므로 read_only 모드 + XML 직접 파싱이 필요). 시스템 python3에는 openpyxl이 없으므로 venv에 설치해 실행한다. 스크립트 상단 docstring에 실행 예시를 적는다.

### 4.4 `index.html`

`sub2.html` 카드 설명문에 "대표 모집단위별 반영과목 매트릭스" 1구 추가(2075행 부근 `support-card`).

---

## 5. 데이터 흐름

```
xlsx ─(build_subject_matrix.py)─► matrix-data JSON(sub2.html 내장)
                                       │
sub2.html 로드 ─► records-data(파일1) ──┼──► udm IIFE: 인덱스 구축 → 해시/스토리지로 탭·모집단위 복원 → 렌더
                                       │
사용자: 모집단위 칩 ─► state.unit ─► renderMatrixTable/renderCards + 푸터 집계
사용자: 점검 토글/체크 ─► state.mySubs ─► evaluate() 재렌더(행 배지·셀 색·정렬)
사용자: 대학명 클릭 ─► linkToSearch ─► udbOpenRecord(id) | udbFilterUniversity(univ, q) + 탭 전환
```

---

## 6. 오류 처리·예외

- `matrix-data` 파싱 실패 → 매트릭스 탭에 "자료를 불러오지 못했습니다" 1줄 표시, 검색 탭은 영향 없음(각 IIFE가 독립, try/catch로 격리).
- `localStorage` 접근 불가(사생활 모드) → 모든 읽기/쓰기 try/catch, 기본값 사용(기존 패턴과 동일).
- 해시가 `#univDB-matrix`인데 저장된 모집단위가 데이터에 없음 → 기본 모집단위로.
- 파일 1 매핑 실패 대학(동양대) → 권역은 상수, 원문 링크는 비활성 + 토스트.
- `excluded` 레코드는 인덱스에서 빠지지만 정오표 모달에서는 "제외됨"으로 열람 가능.

---

## 7. 테스트 계획

### 7.1 빌드 스크립트(pytest, `scripts/test_build_subject_matrix.py`)

- 병합 해석: `D7:H7` → `groups=['math']`, `N129:P129` → `marks=['phy','chem','bio']`, `C54:R54` → `allSubjects`.
- 별표: `단국대⁎` → `starAll`(행 전체 별표일 때), `숭실대*` 물리학 셀만 → `stars=['phy']`.
- 메모: `충남대(역사/도덕 포함)` → `cellNotes.soc`.
- 기타 열: `서울대\n(제2외/한문)` → `university='서울대', etc='제2외/한문'`; `영남대` → `etc=''`.
- 정오표: E1 병합 후 경영 강원대(춘천) 1건, E2·E3 대학명 정정, E4 7건 `excluded`, E5 `warn` 존재, E6 사회 전체만.
- 총계: 원자료 241행 → 레코드 **233건**(241 − E1 1행 − E4 7행), 모집단위별 건수가 기대표(컴퓨터공학 28 등)와 일치.
- 대학명 매핑: 파일 1 키 없는 대학은 동양대 1개뿐.
- 주입 멱등성: `--inject` 두 번 실행해도 sub2.html 바이트 동일.

### 7.2 브라우저 검증(`cnejinhak-fresh`, 포트 8756)

- 회귀: 검색 탭 레코드 수 1,358 표시, 필터·상세 모달·비교함 정상, `records-data` 블록 해시값 변경 없음(`git diff`로 확인).
- 탭: 기본 검색 탭, `#univDB-matrix` 접속 시 매트릭스 탭, ←/→ 키 전환, 새로고침 후 복원.
- 매트릭스: 컴퓨터공학 선택 시 28행, 푸터 "미적분Ⅱ" 반영 대학 수가 수작업 집계와 일치, 단국대 행이 "수학 전체" 띠로 표시, 한라대 행이 전 교과 띠, 한양대(경영) ⚠ 표시.
- 점검 모드: 대수·확통·미적Ⅰ·미적Ⅱ·물리학 체크 → 한양대(ERICA) 기계공학 충족, 고려대 기계공학(미적Ⅱ·물리학) 충족, 국민대(미적Ⅰ·Ⅱ·기하·물리) 부족 1(기하).
- 원문 연결: 고려대 × 기계공학 클릭 → 상세 모달 "고려대 · 공과대학 > 기계공학부"; 단국대 × 기계공학 → 검색 탭 대학 필터 전환 + 안내 문구; 동양대 → 토스트.
- 과목별 보기: "기하" 선택 시 16행, 수학교육·물리 상위.
- 반응형: 375px에서 카드 모드, 가로 스크롤 없음; 1024px에서 표 + 짧은 헤더.
- 인쇄 미리보기: 도구 숨김, 표 전체 출력.

---

## 8. 작업 순서(요약, 상세는 구현 계획에서)

1. 빌드 스크립트 + 테스트(데이터 확정, JSON 검토).
2. sub2.html: 탭 바·패널 마크업 + CSS + 기존 IIFE export 2줄.
3. udm IIFE: 모집단위별 보기(표·카드·푸터) → 점검 모드 → 과목별 보기 → 원문 연결 → 정오표 모달.
4. index.html 카드 문구, meta.
5. 브라우저 검증, 회귀 확인, 메모리 갱신(sub2-univdb-embedded에 매트릭스 탭 추가 사실 기록).
6. 게시는 사용자 확인 후 메모리의 안전 절차(명시 경로 stage, `git push origin HEAD:main`, `git add -A` 금지)로.
