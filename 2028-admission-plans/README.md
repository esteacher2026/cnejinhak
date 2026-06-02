# 2028 전국 4년제 대학 입학 안내

cnejinhak repo의 `2028-admission-plans/` 하위 모듈. 메인 사이트 jinhak.esteacher.kr에서 카드 클릭으로 진입.

## 구조

```
cnejinhak/
├── index.html                              ← 메인 사이트 (카드 링크가 여기로 연결)
└── 2028-admission-plans/
    ├── unimap.html                         ← 진입 페이지 (HTML/JS/CSS)
    ├── data/
    │   └── universities.json               ← 대학 데이터 (이것만 수정하면 됨)
    ├── files/
    │   └── 2028-admission-plan-XXX.pdf     ← 모집요강 PDF들 (213개)
    └── tools/
        ├── serve.js                        ← 로컬 미리보기 서버
        ├── reformat-json.js                ← JSON 정렬
        ├── smoke-test.js                   ← JSON 검증
        └── add-university.js               ← 대학 추가 헬퍼
```

## 자료 추가/수정하는 방법

### 방법 A. 클로드에게 부탁하기 (제일 빠름)

`D:\claude\cnejinhak` 에서 Claude Code를 열고:

> "○○대학교 추가해줘. 사립, 경기도, 위도 37.5, 경도 127.0, 홈페이지 https://...,
>  PDF는 D:\Downloads\모집요강.pdf"

→ 클로드가 자동으로:
1. `2028-admission-plans/data/universities.json`에 새 항목 추가
2. PDF를 `2028-admission-plans/files/2028-admission-plan-XXX.pdf`로 복사 (다음 번호 자동)
3. git add + git commit + git push 실행
4. GitHub Pages에 1-2분 후 반영

### 방법 B. 직접 수정

`2028-admission-plans/data/universities.json`을 열어서 항목 추가하고:

```
git add . && git commit -m "Add ○○대" && git push
```

## 로컬에서 미리 보기

```
cd 2028-admission-plans
node tools/serve.js
# → http://127.0.0.1:8765 접속
```

## 데이터 스키마

```json
{
  "name": "대학교 이름",
  "type": "국립 | 공립 | 사립",
  "home": "https://입학처주소",
  "region": "서울 | 경기 | ... (17개 시도)",
  "lat": 37.5,
  "lng": 127.0,
  "added": false,
  "campuses": [
    { "c": "본교", "u": "files/2028-admission-plan-XXX.pdf" }
  ]
}
```

- `added: true` — 원본 자료에 없어 추가 수록한 대학 표시 (지도에 금색 테두리)
- `campuses[].u: ""` — PDF가 아직 없으면 빈 문자열 ("시행계획 준비중" 표시)

## 라이브 URL

- https://jinhak.esteacher.kr/2028-admission-plans/unimap.html
- 또는 https://esteacher2026.github.io/cnejinhak/2028-admission-plans/unimap.html
