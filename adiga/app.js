/*
 * 대학발표 입시결과 조회
 * 대학이 발표한 2024·2025·2026 수시 입결의 70%컷·50%컷을
 * 모집단위별로 3개년 비교하는 데이터 조회 도구. (참고용, 판정/추천 없음)
 * ※ 모집인원·경쟁률은 과거연도(2024/2025) 원자료에 없어 다루지 않음.
 */
let DATA = { metadata: {}, records: [] };
const DATA_URL = "./data/admission-data.json";
const YEARS = [2024, 2025, 2026];

const METRICS = [
  { key: "grade70", label: "70%컷", kind: "grade" },
  { key: "grade50", label: "50%컷", kind: "grade" },
];

const state = {
  query: "",
  university: "",
  major: "",
  regions: new Set(),
  tracks: new Set(),
  grade: "",
  sort: "cut70",
  pageSize: 80,
  page: 1,
  selectedId: null,
};

// 단일 등급 필터: 입력 등급 ±GRADE_BAND 범위의 2026 70%컷만 표시.
const GRADE_BAND = 0.2;

let lastView = [];

/* ---------- 유틸 ---------- */

function byId(id) {
  return DATA.records.find((record) => record.id === id);
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\(\)\[\]\{\}·ㆍ,./_\-:]/g, "");
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  if (digits === 0) return Math.round(number).toLocaleString("ko-KR");
  return number.toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function formatGrade(value) {
  return formatNumber(value, 2);
}

function fmtMetric(kind, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return formatGrade(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function debounce(fn, wait = 160) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}

/* ---------- 연도별 데이터 접근 ---------- */

// 특정 연도의 지표 묶음을 반환(없으면 null).
// 70/50컷은 어디가 CSV(정확), 모집·경쟁·충원은 2024/2025=수시 XLSX 계열대표(참고)·2026=해당 전형.
// 신뢰할 수 없는 등급(1.0/1.0 placeholder, 50>70 역전)은 모든 연도에서 자료없음(null) 처리.
function yearData(record, year) {
  let data;
  if (year === 2026) {
    data = {
      grade70: record.grade70,
      grade50: record.grade50,
      recruit: record.recruit2026 ?? null,
      competition: record.competition2026 ?? null,
      waitlist: record.waitlist2026 ?? null,
      realCompetition: record.realCompetition2026 ?? null,
      fillRate: record.fillRate2026 ?? null,
    };
  } else {
    const history = record.history?.years?.[String(year)];
    if (!history) return null;
    data = {
      grade70: history.grade70 ?? null,
      grade50: history.grade50 ?? null,
      recruit: history.recruit ?? null,
      competition: history.competition ?? null,
      waitlist: history.waitlist ?? null,
      realCompetition: history.realCompetition ?? null,
      fillRate: history.fillRate ?? null,
    };
  }
  const placeholder = data.grade50 === 1 && data.grade70 === 1;
  const inverted = data.grade50 !== null && data.grade70 !== null && data.grade50 > data.grade70;
  if (placeholder || inverted) {
    data.grade50 = null;
    data.grade70 = null;
  }
  return data;
}

function metricValue(record, year, key) {
  const data = yearData(record, year);
  return data ? data[key] : null;
}

function delta2526(record) {
  return record.history?.trend?.deltaFrom2025 ?? null;
}

/* ---------- 필터 / 정렬 ---------- */

// 공백/쉼표로 먼저 나눈 뒤 각 토큰을 정규화한다(여러 단어 AND 검색).
function tokenize(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map(normalize)
    .filter(Boolean);
}

function passesTokens(tokens, haystack) {
  return tokens.every((token) => haystack.includes(token));
}

function passesText(record, value, fields) {
  const tokens = tokenize(value);
  if (!tokens.length) return true;
  const haystack = fields.map((field) => normalize(record[field])).join("");
  return passesTokens(tokens, haystack);
}

function filteredRecords() {
  const grade = toNumber(state.grade);
  const lo = grade === null ? null : grade - GRADE_BAND;
  const hi = grade === null ? null : grade + GRADE_BAND;
  const queryTokens = tokenize(state.query);

  return DATA.records.filter((record) => {
    if (queryTokens.length && !passesTokens(queryTokens, record.searchText)) return false;
    if (!passesText(record, state.university, ["university", "universityCanon"])) return false;
    if (!passesText(record, state.major, ["major", "program"])) return false;
    if (state.regions.size && !state.regions.has(record.region)) return false;
    if (state.tracks.size && !state.tracks.has(record.track)) return false;
    // 등급 필터: 입력 등급 ±0.5의 2026 70%컷만(자료없음 제외).
    if (grade !== null) {
      const cut70 = metricValue(record, 2026, "grade70");
      if (cut70 === null || cut70 < lo || cut70 > hi) return false;
    }
    return true;
  });
}

function sortRecords(records) {
  const sorted = [...records];
  const asc = (value) => (value ?? Infinity);
  // 정렬도 표시되는 2026 값 기준(placeholder·역전 등급은 null → 맨 뒤로).
  const v = (record, key) => metricValue(record, 2026, key);
  sorted.sort((a, b) => {
    switch (state.sort) {
      case "cut50":
        return asc(v(a, "grade50")) - asc(v(b, "grade50")) || a.university.localeCompare(b.university, "ko");
      case "change":
        return asc(delta2526(a)) - asc(delta2526(b));
      case "cut70":
      default:
        return asc(v(a, "grade70")) - asc(v(b, "grade70")) || a.university.localeCompare(b.university, "ko");
    }
  });
  return sorted;
}

function visibleRecords() {
  lastView = sortRecords(filteredRecords());
  if (!state.selectedId || !lastView.some((record) => record.id === state.selectedId)) {
    state.selectedId = lastView[0]?.id || null;
  }
  const maxPage = Math.max(1, Math.ceil(lastView.length / state.pageSize));
  if (state.page > maxPage) state.page = maxPage;
  return lastView;
}

/* ---------- 마운트 ---------- */

function mount() {
  const app = document.querySelector("#app");
  app.innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">입</div>
          <div>
            <h1>대학발표 입시결과 조회</h1>
            <p>대학이 발표한 2024·2025·2026 수시 입결 — 70%컷·50%컷 3개년 비교</p>
          </div>
        </div>
        <div class="top-actions">
          <a class="button secondary home-link" href="/" aria-label="메인으로 이동">
            <span aria-hidden="true">⌂</span> 메인
          </a>
          <button class="button" data-action="reset">초기화</button>
        </div>
      </div>
    </header>

    <div class="notice-bar" role="note">
      <span class="notice-tag">⚠ 주의</span>
      <span>사례등급은 대학 등급산출방법에 따라 평균등급과 차이가 날 수 있습니다.</span>
    </div>

    <main class="main-layout">
      <aside class="sidebar">
        ${renderFilterPanel()}
      </aside>
      <section class="content">
        <div class="panel">
          <div class="toolbar">
            <div class="field">
              <label for="query">통합 검색</label>
              <input id="query" class="control" value="${escapeAttr(state.query)}" placeholder="대학, 학과, 전형, 지역" />
            </div>
            <div class="field">
              <label for="university">대학명</label>
              <input id="university" class="control" value="${escapeAttr(state.university)}" placeholder="예: 경북대" />
            </div>
            <div class="field">
              <label for="major">모집단위</label>
              <input id="major" class="control" value="${escapeAttr(state.major)}" placeholder="예: 간호, 컴퓨터" />
            </div>
            <div class="field">
              <label for="sort">정렬</label>
              <select id="sort" class="select">
                ${option("cut70", "2026 70%컷 낮은순", state.sort)}
                ${option("cut50", "2026 50%컷 낮은순", state.sort)}
                ${option("change", "70%컷 강화순(25→26)", state.sort)}
              </select>
            </div>
          </div>
          <div id="resultSummary" class="result-summary"></div>
          <div id="tabContent" class="tab-content"></div>
        </div>
        <footer class="site-footer">
          <div><strong>제작</strong> 충청남도교육청진로융합교육원 교육연구사 정재연</div>
          <div><strong>출처</strong> 대입정보포털(ADIGA) · 대학별 발표 수시 입결</div>
        </footer>
      </section>
    </main>
  `;

  bindStaticEvents();
  renderDynamic();
}

function renderFilterPanel() {
  return `
    <section class="panel panel-pad">
      <div class="section-title">
        <h2>필터</h2>
        <span>수시 입결</span>
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="grade">내신 등급</label>
          <input id="grade" class="control" type="number" min="1" max="9" step="0.01" value="${escapeAttr(state.grade)}" placeholder="예: 3.5" inputmode="decimal" />
          <span class="field-hint">입력 등급 ±${GRADE_BAND} 범위의 70%컷만 표시</span>
        </div>
        <div class="field">
          <span class="label">중심전형</span>
          <div class="check-list compact">
            ${distributionChecks("track", DATA.metadata.distributions?.tracks || [])}
          </div>
        </div>
        <div class="field">
          <span class="label">지역</span>
          <div class="check-list">
            ${distributionChecks("region", DATA.metadata.distributions?.regions || [])}
          </div>
        </div>
      </div>
    </section>
  `;
}

function distributionChecks(type, items) {
  return items
    .map((item) => {
      const set = type === "region" ? state.regions : state.tracks;
      const checked = set.has(item.name) ? "checked" : "";
      return `
        <label class="check-item">
          <input type="checkbox" data-filter="${type}" value="${escapeAttr(item.name)}" ${checked} />
          <span>${escapeHtml(item.name)}</span>
          <span class="count">${formatNumber(item.count, 0)}</span>
        </label>
      `;
    })
    .join("");
}

function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

/* ---------- 이벤트 ---------- */

const debouncedRender = debounce(renderDynamic, 160);

function bindStaticEvents() {
  for (const id of ["query", "university", "major", "grade"]) {
    document.querySelector(`#${id}`).addEventListener("input", (event) => {
      state[id] = event.target.value;
      state.page = 1;
      debouncedRender();
    });
  }

  document.querySelector("#sort").addEventListener("change", (event) => {
    state.sort = event.target.value;
    state.page = 1;
    renderDynamic();
  });

  document.querySelector(".sidebar").addEventListener("change", (event) => {
    const checkbox = event.target;
    if (checkbox.matches("[data-filter='region']")) {
      toggleSet(state.regions, checkbox.value, checkbox.checked);
      state.page = 1;
      renderDynamic();
    } else if (checkbox.matches("[data-filter='track']")) {
      toggleSet(state.tracks, checkbox.value, checkbox.checked);
      state.page = 1;
      renderDynamic();
    }
  });

  document.querySelector(".top-actions").addEventListener("click", (event) => {
    if (event.target.closest("[data-action='reset']")) resetState();
  });

  const tab = document.querySelector("#tabContent");
  tab.addEventListener("click", handleTabClick);
  tab.addEventListener("keydown", handleTabKeydown);
}

function toggleSet(set, value, checked) {
  if (checked) set.add(value);
  else set.delete(value);
}

function handleTabClick(event) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "prev-page") {
    state.page = Math.max(1, state.page - 1);
    renderDynamic();
    return;
  }
  if (action === "next-page") {
    const maxPage = Math.max(1, Math.ceil(lastView.length / state.pageSize));
    state.page = Math.min(maxPage, state.page + 1);
    renderDynamic();
    return;
  }
  const header = event.target.closest("th[data-sort]");
  if (header) {
    state.sort = header.dataset.sort;
    state.page = 1;
    const select = document.querySelector("#sort");
    if (select) select.value = state.sort;
    renderDynamic();
    return;
  }
  const row = event.target.closest("tr[data-id]");
  if (row) {
    state.selectedId = row.dataset.id;
    renderDynamic();
    focusRow(state.selectedId);
  }
}

function focusRow(id) {
  if (!id) return;
  const el = document.querySelector(`#tabContent tr[data-id="${CSS.escape(id)}"]`);
  if (el) el.focus();
}

function handleTabKeydown(event) {
  const header = event.target.closest("th[data-sort]");
  if (header && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    state.sort = header.dataset.sort;
    state.page = 1;
    const select = document.querySelector("#sort");
    if (select) select.value = state.sort;
    renderDynamic();
    return;
  }
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    state.selectedId = row.dataset.id;
    renderDynamic();
    focusRow(state.selectedId);
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const sibling = event.key === "ArrowDown" ? row.nextElementSibling : row.previousElementSibling;
    if (sibling && sibling.matches("tr[data-id]")) sibling.focus();
  }
}

function resetState() {
  Object.assign(state, {
    query: "",
    university: "",
    major: "",
    grade: "",
    sort: "cut70",
    page: 1,
    selectedId: null,
  });
  state.regions.clear();
  state.tracks.clear();
  mount();
}

/* ---------- 렌더 ---------- */

function renderDynamic() {
  const records = visibleRecords();
  renderSummary(records);
  document.querySelector("#tabContent").innerHTML = renderResults(records);
}

function renderSummary(records) {
  const cut70 = records.map((record) => metricValue(record, 2026, "grade70")).filter((value) => value !== null);
  const median = cut70.length ? medianOf(cut70) : null;
  const universities = new Set(records.map((record) => record.university)).size;
  document.querySelector("#resultSummary").innerHTML = `
    <strong>${formatNumber(records.length, 0)}</strong>개 모집단위
    · ${formatNumber(universities, 0)}개 대학
    · 전체 ${formatNumber(DATA.records.length, 0)}건 중
    · 2026 70%컷 중앙값 <strong>${formatGrade(median)}</strong>
  `;
}

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function trackTag(record) {
  if (record.trackType === "comprehensive") return `<span class="track-tag comp">종합</span>`;
  if (record.trackType === "subject") return `<span class="track-tag subj">교과</span>`;
  return escapeHtml(record.track);
}

// 정렬 가능한 표 헤더. 클릭 시 해당 기준으로 정렬되고 활성 표시(▲)된다.
function sortableTh(extraClass, sortKey, label, sub) {
  const active = state.sort === sortKey;
  return `<th class="${extraClass} sortable${active ? " active" : ""}" data-sort="${sortKey}" role="button" tabindex="0" title="${escapeAttr(label)} 정렬" aria-label="${escapeAttr(label)} 정렬">${escapeHtml(label)}${sub ? ` <span>${escapeHtml(sub)}</span>` : ""}<i class="sort-mark">▲</i></th>`;
}

// 한 지표의 3개년 값(24·25·26)을 한 셀에 압축 표기. 2026 강조.
function yr3(record, metric) {
  const cells = YEARS.map((year) => {
    const value = metricValue(record, year, metric.key);
    return `<span class="y${year === 2026 ? " now" : ""}"><i>${String(year).slice(2)}</i>${fmtMetric(metric.kind, value)}</span>`;
  }).join("");
  return `<div class="yr3">${cells}</div>`;
}

function renderResults(records) {
  if (!records.length) {
    return `<div class="empty"><div>조건에 맞는 모집단위가 없습니다.</div></div>`;
  }

  const start = (state.page - 1) * state.pageSize;
  const pageRecords = records.slice(start, start + state.pageSize);
  const maxPage = Math.max(1, Math.ceil(records.length / state.pageSize));
  const selected = byId(state.selectedId) || pageRecords[0];

  return `
    <div class="result-layout">
      <div class="table-shell">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th class="col-uni">대학</th>
                <th class="col-major">모집단위 · 전형</th>
                ${sortableTh("col-yr col-primary", "cut70", "70%컷", "24 · 25 · 26")}
                ${sortableTh("col-yr", "cut50", "50%컷", "24 · 25 · 26")}
                ${sortableTh("col-spark", "change", "70%컷 추이", "25→26")}
              </tr>
            </thead>
            <tbody>
              ${pageRecords.map(renderResultRow).join("")}
            </tbody>
          </table>
        </div>
        <div class="pager">
          <span>${formatNumber(start + 1, 0)}-${formatNumber(Math.min(start + state.pageSize, records.length), 0)} / ${formatNumber(records.length, 0)}</span>
          <div class="pager-actions">
            <button class="button secondary" data-action="prev-page" ${state.page <= 1 ? "disabled" : ""}>이전</button>
            <button class="button secondary" data-action="next-page" ${state.page >= maxPage ? "disabled" : ""}>다음</button>
          </div>
        </div>
      </div>
      ${renderDetail(selected)}
    </div>
  `;
}

function renderResultRow(record) {
  const selected = record.id === state.selectedId ? "selected" : "";
  const ariaLabel = `${record.university} ${record.major}, 2026 70%컷 ${formatGrade(metricValue(record, 2026, "grade70"))}`;
  return `
    <tr class="${selected}" data-id="${record.id}" tabindex="0" role="button" aria-pressed="${selected ? "true" : "false"}" aria-label="${escapeAttr(ariaLabel)}">
      <td class="col-uni">
        <div class="cell-main">
          <strong title="${escapeAttr(record.university)}">${escapeHtml(record.university)}</strong>
          <span>${escapeHtml(record.region)}</span>
        </div>
      </td>
      <td class="col-major">
        <div class="cell-main">
          <strong title="${escapeAttr(record.major)}">${escapeHtml(record.major)}</strong>
          <span title="${escapeAttr(record.program)}">${trackTag(record)} · ${escapeHtml(record.program)}</span>
        </div>
      </td>
      <td class="col-yr col-primary">${yr3(record, METRICS[0])}</td>
      <td class="col-yr">${yr3(record, METRICS[1])}</td>
      <td class="col-spark">${trendCell(record)}</td>
    </tr>
  `;
}

function renderDetail(record) {
  if (!record) {
    return `<aside class="detail-panel"><div class="panel panel-pad empty">선택된 모집단위가 없습니다.</div></aside>`;
  }
  const delta = delta2526(record);
  const deltaText =
    delta === null
      ? ""
      : `<span class="delta ${trendClass(record)}">25→26 ${delta > 0 ? "+" : ""}${formatGrade(delta)}</span>`;

  return `
    <aside class="detail-panel">
      <section class="panel panel-pad">
        <div class="detail-head">
          <div class="chip-row">
            ${trackTag(record)}
            <span class="chip">${escapeHtml(record.region)}</span>
          </div>
          <h2>${escapeHtml(record.university)} ${escapeHtml(record.major)}</h2>
          <p>${escapeHtml(record.program)}</p>
        </div>
        <div class="section-title">
          <h3>입결 컷 (3개년)</h3>
          ${deltaText}
        </div>
        ${renderCutTable(record)}
        <div class="trend-chart">${trendChart(record)}</div>
        <div class="chart-legend">
          <span class="lg lg70">70%컷</span>
          <span class="lg lg50">50%컷</span>
        </div>
      </section>
      <section class="panel panel-pad">
        <div class="section-title">
          <h3>모집 · 경쟁 (3개년)</h3>
          <span>수시 입결</span>
        </div>
        ${renderCompTable(record)}
      </section>
    </aside>
  `;
}

function renderCutTable(record) {
  const rows = YEARS.map((year) => {
    const data = yearData(record, year);
    const now = year === 2026 ? "now-row" : "";
    const g70 = data ? fmtMetric("grade", data.grade70) : "–";
    const g50 = data ? fmtMetric("grade", data.grade50) : "–";
    return `<tr class="${now}"><th>${year}</th><td>${g70}</td><td>${g50}</td></tr>`;
  }).join("");
  return `
    <div class="table-shell detail-3yr">
      <table>
        <thead><tr><th>연도</th><th>70%컷</th><th>50%컷</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderCompTable(record) {
  const fmtCount = (v) => (v == null ? "–" : `${formatNumber(v, 0)}`);
  const fmtRatio = (v) => (v == null ? "–" : formatNumber(v, 2));
  const fmtPct = (v) => (v == null ? "–" : `${Math.round(v * 100)}%`);
  const rows = YEARS.map((year) => {
    const data = yearData(record, year);
    const now = year === 2026 ? "now-row" : "";
    if (!data || (data.recruit == null && data.competition == null)) {
      return `<tr class="${now}"><th>${year}</th><td colspan="4" class="muted-cell">자료 없음</td></tr>`;
    }
    return `
      <tr class="${now}">
        <th>${year}</th>
        <td>${fmtCount(data.recruit)}</td>
        <td>${fmtRatio(data.competition)}</td>
        <td>${fmtRatio(data.realCompetition)}</td>
        <td>${fmtPct(data.fillRate)}</td>
      </tr>
    `;
  }).join("");
  return `
    <div class="table-shell detail-3yr">
      <table>
        <thead><tr><th>연도</th><th>모집</th><th>경쟁률</th><th>실질경쟁</th><th>충원율</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ---------- 추세 / 차트 ---------- */

function cutSeries(record, key) {
  return YEARS.map((year) => ({ year, value: metricValue(record, year, key) }));
}

function trendValues(record) {
  return cutSeries(record, "grade70");
}

// 70컷 변화 방향 → 색상 클래스. 등급은 낮을수록 우수: delta<0이면 컷 상승(강화).
function trendClass(record) {
  const delta = delta2526(record);
  if (delta === null) return "flat";
  if (delta <= -0.3) return "up"; // 강화(컷 상승·어려워짐)
  if (delta >= 0.3) return "down"; // 완화(쉬워짐)
  return "flat";
}

function sparkline(record) {
  const values = trendValues(record).filter((item) => item.value !== null);
  if (values.length < 2) return `<span class="spark-empty">–</span>`;
  const width = 84;
  const height = 28;
  const pad = 4;
  const min = Math.min(...values.map((item) => item.value));
  const max = Math.max(...values.map((item) => item.value));
  const spread = Math.max(0.2, max - min);
  const points = values.map((item) => {
    const x = pad + ((item.year - 2024) / 2) * (width - pad * 2);
    const y = pad + ((item.value - min) / spread) * (height - pad * 2);
    return { x, y };
  });
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];
  return `
    <svg class="spark ${trendClass(record)}" viewBox="0 0 ${width} ${height}" role="img" aria-label="70%컷 추이">
      <polyline class="line" points="${line}"></polyline>
      <circle class="dot end" cx="${last.x}" cy="${last.y}" r="2.6"></circle>
    </svg>
  `;
}

// 표의 "70%컷 추이" 칸: 스파크라인 + 25→26 변화(강화/완화/유사) 색상 배지.
function trendCell(record) {
  const delta = delta2526(record);
  const direction = record.history?.trend?.direction;
  let badge = `<span class="delta flat">–</span>`;
  if (delta !== null && direction && direction !== "자료부족") {
    if (direction === "유사") {
      badge = `<span class="delta flat">유사</span>`;
    } else {
      badge = `<span class="delta ${trendClass(record)}">${direction} ${formatGrade(Math.abs(delta))}</span>`;
    }
  }
  return `<div class="trend-cell">${sparkline(record)}${badge}</div>`;
}

function trendChart(record) {
  const s70 = cutSeries(record, "grade70");
  const s50 = cutSeries(record, "grade50");
  const present = [...s70, ...s50].filter((item) => item.value !== null).map((item) => item.value);
  if (present.length < 2) {
    return `<div class="empty">연결된 3개년 자료가 부족합니다.</div>`;
  }
  const width = 360;
  const height = 134;
  const padX = 30;
  const padY = 26;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const spread = Math.max(0.4, max - min);
  const project = (series) =>
    series.map((item) => {
      const x = padX + ((item.year - 2024) / 2) * (width - padX * 2);
      if (item.value === null) return { ...item, x, y: null };
      const y = padY + ((item.value - min) / spread) * (height - padY * 2);
      return { ...item, x, y };
    });
  const p70 = project(s70);
  const p50 = project(s50);
  const poly = (pts) => pts.filter((p) => p.y !== null).map((p) => `${p.x},${p.y}`).join(" ");
  const dots = (pts, cls, label) =>
    pts
      .map((p) => {
        if (p.y === null) return "";
        const text = label ? `<text x="${p.x}" y="${p.y - 9}" text-anchor="middle">${formatGrade(p.value)}</text>` : "";
        return `<circle class="dot ${cls}" cx="${p.x}" cy="${p.y}" r="${label ? 4.5 : 3}"></circle>${text}`;
      })
      .join("");
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="2024~2026 70%·50%컷 추이">
      <line class="axis" x1="${padX}" x2="${width - padX}" y1="${height - padY}" y2="${height - padY}"></line>
      <polyline class="line line50" points="${poly(p50)}"></polyline>
      <polyline class="line line70" points="${poly(p70)}"></polyline>
      ${dots(p50, "d50", false)}
      ${dots(p70, "d70", true)}
      ${s70.map((item) => {
        const x = padX + ((item.year - 2024) / 2) * (width - padX * 2);
        return `<text class="xlabel" x="${x}" y="${height - 6}" text-anchor="middle">${item.year}</text>`;
      }).join("")}
    </svg>
  `;
}

/* ---------- 초기화 ---------- */

function showBootError(title, detail) {
  const app = document.querySelector("#app");
  if (app) {
    app.innerHTML = `<div class="boot-panel error"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
  }
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    DATA = await response.json();
  } catch (error) {
    showBootError("입결 데이터를 불러오지 못했습니다.", `${DATA_URL} 확인 후 scripts/prepare_data.py로 생성하세요. (${error.message})`);
    return;
  }
  if (!DATA.records?.length) {
    showBootError("데이터가 비어 있습니다.", "scripts/prepare_data.py를 실행해 data/admission-data.json을 생성하세요.");
    return;
  }
  mount();
}

init();
