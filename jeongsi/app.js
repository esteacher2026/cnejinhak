/*
 * 정시(수능위주전형) 입시결과 조회
 * 대학이 발표한 2024·2025·2026 정시(수능위주) 입결을 모집단위별로 3개년 비교.
 * 헤드라인 지표는 수능 평균백분위 70%컷. 모든 값은 발표 원본 그대로 표기(재가공 없음).
 */
let DATA = { metadata: {}, records: [] };
const DATA_URL = "./data/jeongsi-data.json";
// 어디가 정시 입결은 2026(최근 완료연도)만 값 제공 → 단일연도. 반영 과목수는 일부 모집단위만 배지 표기.
const RESULT_YEAR = 2026;             // 헤드라인·정렬·매칭 기준(어디가 직접)
const YEARS = [2024, 2025, 2026];      // 2024·2025는 김현석 XLSX(어디가 정시입결) 병합

const state = {
  query: "",
  university: "",
  major: "",
  regions: new Set(),
  guns: new Set(),
  percentile: "",
  band: "3",
  sort: "avg70_desc",
  pageSize: 80,
  page: 1,
  selectedId: null,
};

let lastView = [];

/* ---------- 유틸 ---------- */
function byId(id) { return DATA.records.find((r) => r.id === id); }

function normalize(value) {
  return String(value || "").trim().toLowerCase()
    .replace(/\s+/g, "").replace(/[\(\)\[\]\{\}·ㆍ,./_\-:]/g, "");
}
function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function fmt(v) { return v === "" || v == null ? "–" : String(v); }
function escapeHtml(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function escapeAttr(v) { return escapeHtml(v); }
function debounce(fn, wait = 160) {
  let t = null;
  return (...a) => { if (t) clearTimeout(t); t = setTimeout(() => { t = null; fn(...a); }, wait); };
}

/* ---------- 연도별 접근 ---------- */
function yearData(record, year) { return record.years?.[String(year)] || null; }
// 헤드라인: 수능 평균백분위 70%컷
function avg70(record, year) {
  const d = yearData(record, year);
  return d ? toNumber(d.p70?.avg) : null;
}
function competition(record, year) {
  const d = yearData(record, year);
  return d ? toNumber(d.c) : null;
}
function recruit(record, year) {
  const d = yearData(record, year);
  return d ? toNumber(d.m?.[2]) : null;
}

/* ---------- 필터 / 정렬 ---------- */
function tokenize(value) {
  return String(value || "").split(/[\s,]+/).map(normalize).filter(Boolean);
}
function passesTokens(tokens, hay) { return tokens.every((t) => hay.includes(t)); }
function passesText(record, value, fields) {
  const tokens = tokenize(value);
  if (!tokens.length) return true;
  const hay = fields.map((f) => normalize(record[f])).join("");
  return passesTokens(tokens, hay);
}

function filteredRecords() {
  const queryTokens = tokenize(state.query);
  return DATA.records.filter((r) => {
    if (queryTokens.length && !passesTokens(queryTokens, r.searchText)) return false;
    if (!passesText(r, state.university, ["university", "uniBase"])) return false;
    if (!passesText(r, state.major, ["dept", "jname"])) return false;
    if (state.regions.size && !state.regions.has(r.region)) return false;
    if (state.guns.size && !state.guns.has(r.gun)) return false;
    const target = toNumber(state.percentile);
    if (target !== null) {
      const cut = latest(r, avg70);
      const band = toNumber(state.band) ?? 3;
      if (cut === null || Math.abs(cut - target) > band) return false;
    }
    return true;
  });
}

// 내 평균백분위와 최신 70%컷의 차(양수=내가 더 높음)
function pctDiff(record) {
  const target = toNumber(state.percentile);
  const cut = latest(record, avg70);
  if (target === null || cut === null) return null;
  return target - cut;
}


function latest(record, accessor) {
  for (const y of [2026, 2025, 2024]) {
    const v = accessor(record, y);
    if (v !== null) return v;
  }
  return null;
}

function sortRecords(records) {
  const sorted = [...records];
  const big = (v) => (v == null ? -Infinity : v);
  const small = (v) => (v == null ? Infinity : v);
  sorted.sort((a, b) => {
    switch (state.sort) {
      case "near": {
        const da = pctDiff(a), db = pctDiff(b);
        return Math.abs(da ?? Infinity) - Math.abs(db ?? Infinity) || big(latest(b, avg70)) - big(latest(a, avg70));
      }
      case "avg70_asc":
        return small(latest(a, avg70)) - small(latest(b, avg70)) || a.university.localeCompare(b.university, "ko");
      case "comp_desc":
        return big(latest(b, competition)) - big(latest(a, competition)) || a.university.localeCompare(b.university, "ko");
      case "uni":
        return a.university.localeCompare(b.university, "ko") || a.dept.localeCompare(b.dept, "ko");
      case "avg70_desc":
      default:
        return big(latest(b, avg70)) - big(latest(a, avg70)) || a.university.localeCompare(b.university, "ko");
    }
  });
  return sorted;
}

function visibleRecords() {
  lastView = sortRecords(filteredRecords());
  if (!state.selectedId || !lastView.some((r) => r.id === state.selectedId)) {
    state.selectedId = lastView[0]?.id || null;
  }
  const maxPage = Math.max(1, Math.ceil(lastView.length / state.pageSize));
  if (state.page > maxPage) state.page = maxPage;
  return lastView;
}

/* ---------- 마운트 ---------- */
function mount() {
  const app = document.querySelector("#app");
  const c = DATA.metadata.counts || {};
  app.innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">정</div>
          <div>
            <h1>정시(수능위주) 입시결과 조회</h1>
            <p>대학 발표 2024·2025·2026 정시 입결 — 수능 백분위·경쟁률 3개년 비교</p>
          </div>
        </div>
        <div class="top-actions">
          <a class="button secondary home-link" href="/" aria-label="메인으로 이동"><span aria-hidden="true">⌂</span> 메인</a>
          <button class="button" data-action="reset">초기화</button>
        </div>
      </div>
    </header>

    <div class="notice-bar" role="note">
      <span class="notice-tag">⚠ 주의</span>
      <span>대학 발표 정시(수능위주) 입시결과 원본(참고용·판정 없음). 대학마다 수능 반영 과목 수가 달라 평균백분위 비교에 주의하세요.</span>
    </div>

    <main class="main-layout">
      <aside class="sidebar">${renderFilterPanel()}</aside>
      <section class="content">
        <div class="panel">
          <div class="toolbar">
            <div class="field">
              <label for="query">통합 검색</label>
              <input id="query" class="control" value="${escapeAttr(state.query)}" placeholder="대학, 학과, 전형, 지역" />
            </div>
            <div class="field">
              <label for="university">대학명</label>
              <input id="university" class="control" value="${escapeAttr(state.university)}" placeholder="예: 건국대" />
            </div>
            <div class="field">
              <label for="major">모집단위·전형</label>
              <input id="major" class="control" value="${escapeAttr(state.major)}" placeholder="예: 컴퓨터, 일반" />
            </div>
            <div class="field">
              <label for="sort">정렬</label>
              <select id="sort" class="select">
                ${option("avg70_desc", "평균백분위 70% 높은순", state.sort)}
                ${option("avg70_asc", "평균백분위 70% 낮은순", state.sort)}
                ${option("near", "내 백분위 근접순", state.sort)}
                ${option("comp_desc", "경쟁률 높은순", state.sort)}
                ${option("uni", "대학명순", state.sort)}
              </select>
            </div>
          </div>
          <div id="resultSummary" class="result-summary"></div>
          <div id="tabContent" class="tab-content"></div>
        </div>
        <footer class="site-footer">
          <div><strong>제작</strong> 충청남도교육청진로융합교육원 교육연구사 정재연</div>
          <div><strong>출처</strong> 대입정보포털(ADIGA) 정시 입시결과 · 2026 어디가 직접, 2024·2025 어디가 정시입결 자료(목포제일고 김현석)</div>
        </footer>
      </section>
    </main>
  `;
  bindStaticEvents();
  renderDynamic();
}

function renderFilterPanel() {
  const dist = DATA.metadata.distributions || {};
  return `
    <section class="panel panel-pad">
      <div class="section-title"><h2>필터</h2><span>정시 입결</span></div>
      <div class="field-grid">
        <div class="field">
          <label for="percentile">내 평균백분위</label>
          <div class="range-row">
            <input id="percentile" class="control" type="number" min="0" max="100" step="0.1" value="${escapeAttr(state.percentile)}" placeholder="예: 85" inputmode="decimal" />
            <select id="band" class="select" aria-label="허용 범위">
              ${option("1", "±1", state.band)}${option("2", "±2", state.band)}${option("3", "±3", state.band)}${option("5", "±5", state.band)}
            </select>
          </div>
          <span class="field-hint">2026 평균백분위 70%컷이 내 백분위 ±범위인 모집단위만</span>
        </div>
        <div class="field">
          <span class="label">모집군</span>
          <div class="check-list compact">
            ${checks("gun", dist.guns || [])}
          </div>
        </div>
        <div class="field">
          <span class="label">지역</span>
          <div class="check-list">
            ${checks("region", dist.regions || [])}
          </div>
        </div>
      </div>
    </section>
  `;
}

const FILTER_SETS = { region: () => state.regions, gun: () => state.guns };
function checks(type, items) {
  return items.map((item) => {
    const set = FILTER_SETS[type]();
    const checked = set.has(item.name) ? "checked" : "";
    const label = type === "gun"
      ? (["가", "나", "다", "라", "마"].includes(item.name) ? `${item.name}군` : item.name)
      : item.name;
    return `<label class="check-item"><input type="checkbox" data-filter="${type}" value="${escapeAttr(item.name)}" ${checked} /><span>${escapeHtml(label)}</span><span class="count">${item.count}</span></label>`;
  }).join("");
}
function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

/* ---------- 이벤트 ---------- */
const debouncedRender = debounce(renderDynamic, 160);
function bindStaticEvents() {
  for (const id of ["query", "university", "major", "percentile"]) {
    document.querySelector(`#${id}`).addEventListener("input", (e) => {
      state[id] = e.target.value; state.page = 1; debouncedRender();
    });
  }
  document.querySelector("#band").addEventListener("change", (e) => {
    state.band = e.target.value; state.page = 1; renderDynamic();
  });
  document.querySelector("#sort").addEventListener("change", (e) => {
    state.sort = e.target.value; state.page = 1; renderDynamic();
  });
  document.querySelector(".sidebar").addEventListener("change", (e) => {
    const type = e.target.dataset?.filter;
    if (type && FILTER_SETS[type]) {
      toggleSet(FILTER_SETS[type](), e.target.value, e.target.checked);
      state.page = 1; renderDynamic();
    }
  });
  document.querySelector(".top-actions").addEventListener("click", (e) => {
    if (e.target.closest("[data-action='reset']")) resetState();
  });
  const tab = document.querySelector("#tabContent");
  tab.addEventListener("click", handleTabClick);
  tab.addEventListener("keydown", handleTabKeydown);
}
function toggleSet(set, value, checked) { checked ? set.add(value) : set.delete(value); }

function handleTabClick(e) {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "prev-page") { state.page = Math.max(1, state.page - 1); renderDynamic(); return; }
  if (action === "next-page") {
    const maxPage = Math.max(1, Math.ceil(lastView.length / state.pageSize));
    state.page = Math.min(maxPage, state.page + 1); renderDynamic(); return;
  }
  const header = e.target.closest("th[data-sort]");
  if (header) {
    state.sort = header.dataset.sort; state.page = 1;
    const sel = document.querySelector("#sort"); if (sel) sel.value = state.sort;
    renderDynamic(); return;
  }
  const row = e.target.closest("tr[data-id]");
  if (row) { state.selectedId = row.dataset.id; renderDynamic(); focusRow(state.selectedId); }
}
function focusRow(id) {
  if (!id) return;
  const el = document.querySelector(`#tabContent tr[data-id="${CSS.escape(id)}"]`);
  if (el) el.focus();
}
function handleTabKeydown(e) {
  const header = e.target.closest("th[data-sort]");
  if (header && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault(); state.sort = header.dataset.sort; state.page = 1;
    const sel = document.querySelector("#sort"); if (sel) sel.value = state.sort;
    renderDynamic(); return;
  }
  const row = e.target.closest("tr[data-id]");
  if (!row) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault(); state.selectedId = row.dataset.id; renderDynamic(); focusRow(state.selectedId);
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const sib = e.key === "ArrowDown" ? row.nextElementSibling : row.previousElementSibling;
    if (sib && sib.matches("tr[data-id]")) sib.focus();
  }
}
function resetState() {
  Object.assign(state, { query: "", university: "", major: "", sort: "avg70_desc", page: 1, selectedId: null, percentile: "", band: "3" });
  state.regions.clear(); state.guns.clear();
  mount();
}

/* ---------- 렌더 ---------- */
function renderDynamic() {
  const records = visibleRecords();
  renderSummary(records);
  document.querySelector("#tabContent").innerHTML = renderResults(records);
}
function renderSummary(records) {
  const vals = records.map((r) => latest(r, avg70)).filter((v) => v !== null);
  const med = vals.length ? medianOf(vals) : null;
  const unis = new Set(records.map((r) => r.unvCd)).size;
  const target = toNumber(state.percentile);
  const matchNote = target === null ? "" :
    ` · <strong class="hl-match">내 백분위 ${target} ±${escapeHtml(state.band)}</strong> 매칭`;
  document.querySelector("#resultSummary").innerHTML = `
    <strong>${records.length.toLocaleString("ko-KR")}</strong>개 모집단위
    · ${unis}개 대학
    · 전체 ${DATA.records.length.toLocaleString("ko-KR")}건 중
    · 평균백분위 70% 중앙값 <strong>${med == null ? "–" : med}</strong>${matchNote}`;
}
function medianOf(values) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
}

function gunTag(record) {
  const cls = { "가": "comp", "나": "subj", "다": "" }[record.gun] || "";
  const label = ["가", "나", "다", "라", "마"].includes(record.gun) ? `${record.gun}군` : record.gun;
  return `<span class="track-tag ${cls}">${escapeHtml(label)}</span>`;
}

function sortableTh(extra, key, label, sub) {
  const active = state.sort === key;
  return `<th class="${extra} sortable${active ? " active" : ""}" data-sort="${key}" role="button" tabindex="0" title="${escapeAttr(label)} 정렬">${escapeHtml(label)}${sub ? ` <span>${escapeHtml(sub)}</span>` : ""}<i class="sort-mark">▲</i></th>`;
}

function renderResults(records) {
  if (!records.length) return `<div class="empty"><div>조건에 맞는 모집단위가 없습니다.</div></div>`;
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
                <th class="col-yr">모집</th>
                <th class="col-yr">경쟁률</th>
                ${sortableTh("col-yr col-primary", "avg70_desc", "평균백분위 70%", "24·25·26")}
              </tr>
            </thead>
            <tbody>${pageRecords.map(renderRow).join("")}</tbody>
          </table>
        </div>
        <div class="pager">
          <span>${(start + 1).toLocaleString("ko-KR")}-${Math.min(start + state.pageSize, records.length).toLocaleString("ko-KR")} / ${records.length.toLocaleString("ko-KR")}</span>
          <div class="pager-actions">
            <button class="button secondary" data-action="prev-page" ${state.page <= 1 ? "disabled" : ""}>이전</button>
            <button class="button secondary" data-action="next-page" ${state.page >= maxPage ? "disabled" : ""}>다음</button>
          </div>
        </div>
      </div>
      ${renderDetail(selected)}
    </div>`;
}

function renderRow(record) {
  const sel = record.id === state.selectedId ? "selected" : "";
  return `
    <tr class="${sel}" data-id="${record.id}" tabindex="0" role="button" aria-pressed="${sel ? "true" : "false"}">
      <td class="col-uni"><div class="cell-main"><strong title="${escapeAttr(record.university)}">${escapeHtml(record.university)}</strong><span>${escapeHtml(record.region)}</span></div></td>
      <td class="col-major"><div class="cell-main"><strong title="${escapeAttr(record.dept)}">${escapeHtml(record.dept)}${record.variant ? ` <span class="variant-tag">${escapeHtml(record.variant)}</span>` : ""}</strong><span title="${escapeAttr(record.jname)}">${gunTag(record)} <b class="jeonhyeong">${escapeHtml(record.jname)}</b>${areaTag(record)}</span></div></td>
      <td class="col-yr">${cellVal(recruit(record, RESULT_YEAR))}</td>
      <td class="col-yr">${cellVal(competition(record, RESULT_YEAR))}</td>
      <td class="col-yr col-primary">${yr3(record, avg70)}${diffBadge(record)}</td>
    </tr>`;
}

function cellVal(v) { return v == null ? "–" : v; }

// 한 지표의 3개년 값을 한 셀에 미니표기. 2026 강조.
function yr3(record, accessor) {
  const cells = YEARS.map((y) => {
    const v = accessor(record, y);
    const now = y === RESULT_YEAR;
    return `<span class="y${now ? " now" : ""}"><i>${String(y).slice(2)}</i>${v == null ? "–" : v}</span>`;
  }).join("");
  return `<div class="yr3">${cells}</div>`;
}

// 수능 반영 과목 수 배지 — 반영비율 표에 명시된 소수영역(1~3과목) 모집단위만(확인된 것만)
function areaTag(record) {
  if (!record.areas) return "";
  const n = record.areas.length;
  return ` <span class="area-tag" title="이 모집단위는 수능 ${n}과목(${record.areas.join("·")})만 반영합니다. 평균백분위가 4과목 반영 대학과 다른 척도이니 비교에 주의하세요.">수능 ${n}과목</span>`;
}

// 내 백분위 입력 시: 최신 70%컷과의 차를 표기(+여유 / -부족)
function diffBadge(record) {
  const d = pctDiff(record);
  if (d === null) return "";
  const sign = d > 0 ? "+" : "";
  const cls = d >= 0 ? "up" : "down";
  return `<div class="diff-badge ${cls}" title="내 백분위 − 70%컷">${sign}${d.toFixed(1)}</div>`;
}

/* ---------- 상세 패널 ---------- */
function renderDetail(record) {
  if (!record) return `<aside class="detail-panel"><div class="panel panel-pad empty">선택된 모집단위가 없습니다.</div></aside>`;
  return `
    <aside class="detail-panel">
      <section class="panel panel-pad">
        <div class="detail-head">
          <div class="chip-row">
            ${gunTag(record)}
            <span class="chip">${escapeHtml(record.region)}</span>
            <span class="chip">${escapeHtml(record.jtype || "수능위주")}</span>
            ${record.variant ? `<span class="chip">${escapeHtml(record.variant)}</span>` : ""}
          </div>
          <h2>${escapeHtml(record.university)} ${escapeHtml(record.dept)}</h2>
          <p class="detail-jeonhyeong">${escapeHtml(record.jname)}</p>
        </div>
        ${record.areas ? `<p class="area-note">⚠ 이 모집단위는 수능 <b>${record.areas.length}과목</b>(${record.areas.join("·")})만 반영합니다(반영비율 표 기준). 평균백분위는 이 과목들의 평균이라 4과목 반영 대학과 직접 비교는 부적절합니다.</p>` : ""}
        <div class="section-title"><h3>모집 · 경쟁 · 충원</h3><span>2024·2025·2026</span></div>
        ${recruitTable(record)}
      </section>
      <section class="panel panel-pad">
        <div class="section-title"><h3>수능 백분위 (3개년)</h3><span>국·수·탐·영</span></div>
        <p class="cmp-note">✓ 연도 간·대학 간 비교는 <b>백분위</b> 기준이 신뢰할 수 있습니다. 환산점수는 연도·대학마다 만점·산출식이 달라 직접 비교가 부적절합니다(아래 접기).</p>
        <div class="sub-h">70%컷 (국·수·탐·영)</div>
        ${pctTable(record, "p70")}
        <div class="sub-h">50%컷 (국·수·탐·영)</div>
        ${pctTable(record, "p50")}
        <details class="method-details" style="margin-top:12px">
          <summary>수능 환산점수 (연도·대학별 척도 · 직접 비교 부적절)</summary>
          <p class="cmp-note warn">⚠ 환산점수는 연도·대학마다 만점·산출식이 달라 <b>직접 비교에 부적합</b>합니다. 같은 연도 내 참고로만 보세요.</p>
          ${hwansanTable(record)}
        </details>
        ${notes(record)}
      </section>
    </aside>`;
}

// 모집·경쟁·충원 (3개년)
function recruitTable(record) {
  const rows = YEARS.map((y) => {
    const d = yearData(record, y);
    const now = y === RESULT_YEAR ? "now-row" : "";
    if (!d) return `<tr class="${now}"><th>${y}</th><td colspan="3" class="muted-cell">자료 없음</td></tr>`;
    return `<tr class="${now}"><th>${y}</th><td>${fmt(d.m?.[2])}</td><td>${fmt(d.c)}</td><td>${fmt(d.w)}</td></tr>`;
  }).join("");
  return `<div class="table-shell detail-3yr"><table>
    <thead><tr><th>연도</th><th>모집</th><th>경쟁률</th><th>충원</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function tamgu(p) {
  const a = fmt(p.t1), b = fmt(p.t2);
  if (a === "–" && b === "–") return "–";
  if (b === "–") return a;
  if (a === "–") return b;
  return `${a} / ${b}`;
}

// 수능 백분위(70%컷 또는 50%컷)를 3개년 과목별로. 2026 강조.
// 2024·2025는 XLSX에서 70%컷 과목별·50%컷 평균만 제공(나머지 칸은 자료 없음).
function pctTable(record, key) {
  const rows = YEARS.map((y) => {
    const d = yearData(record, y);
    const now = y === RESULT_YEAR ? "now-row" : "";
    const p = d?.[key];
    if (!p) return `<tr class="${now}"><th>${y}</th><td colspan="6" class="muted-cell">자료 없음</td></tr>`;
    return `<tr class="${now}"><th>${y}</th><td>${fmt(p.kor)}</td><td>${fmt(p.math)}</td><td>${tamgu(p)}</td><td><strong>${fmt(p.avg)}</strong></td><td>${fmt(p.eng)}</td><td>${fmt(p.hist)}</td></tr>`;
  }).join("");
  return `<div class="table-shell detail-3yr"><table>
    <thead><tr><th>연도</th><th>국어</th><th>수학</th><th>탐구</th><th>평균</th><th>영어</th><th>한국사</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

// 수능 환산점수 (3개년) — 연도별 만점·척도 달라 직접 비교 부적절
function hwansanTable(record) {
  const rows = YEARS.map((y) => {
    const d = yearData(record, y);
    const now = y === RESULT_YEAR ? "now-row" : "";
    if (!d) return `<tr class="${now}"><th>${y}</th><td colspan="3" class="muted-cell">자료 없음</td></tr>`;
    return `<tr class="${now}"><th>${y}</th><td>${fmt(d.hs?.[0])}</td><td>${fmt(d.hs?.[1])}</td><td>${fmt(d.hs?.[2])}</td></tr>`;
  }).join("");
  return `<div class="table-shell detail-3yr"><table>
    <thead><tr><th>연도</th><th>환산50%</th><th>환산70%</th><th>총점</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function notes(record) {
  const items = YEARS.map((y) => {
    const d = yearData(record, y);
    return d?.note ? `<li><b>${y}</b> ${escapeHtml(d.note)}</li>` : "";
  }).filter(Boolean).join("");
  return items ? `<ul class="note-list">${items}</ul>` : "";
}

/* ---------- 초기화 ---------- */
function showBootError(title, detail) {
  const app = document.querySelector("#app");
  if (app) app.innerHTML = `<div class="boot-panel error"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
}
async function init() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (e) {
    showBootError("입결 데이터를 불러오지 못했습니다.", `${DATA_URL} 확인 후 scripts/prepare_data.py로 생성하세요. (${e.message})`);
    return;
  }
  if (!DATA.records?.length) {
    showBootError("데이터가 비어 있습니다.", "scripts/prepare_data.py를 실행해 data/jeongsi-data.json을 생성하세요.");
    return;
  }
  mount();
}
init();
