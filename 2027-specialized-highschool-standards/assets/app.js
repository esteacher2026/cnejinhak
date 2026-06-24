const PAGE_SIZE = 80;

const state = {
  query: "",
  office: "",
  standard: "",
  issue: "all",
  sort: "source",
  visibleCount: PAGE_SIZE,
};

const issueLabels = {
  all: "전체",
  note: "비고 있음",
  missing: "기준학과 미기재",
  placeholder: "표기 확인",
};

const els = {
  queryInput: document.querySelector("#queryInput"),
  officeSelect: document.querySelector("#officeSelect"),
  standardSelect: document.querySelector("#standardSelect"),
  sortSelect: document.querySelector("#sortSelect"),
  summaryStrip: document.querySelector("#summaryStrip"),
  officeBars: document.querySelector("#officeBars"),
  resultCount: document.querySelector("#resultCount"),
  resultBody: document.querySelector("#resultBody"),
  activeFilters: document.querySelector("#activeFilters"),
  loadRow: document.querySelector("#loadRow"),
  loadMoreButton: document.querySelector("#loadMoreButton"),
  loadNote: document.querySelector("#loadNote"),
  resetButton: document.querySelector("#resetButton"),
  csvButton: document.querySelector("#csvButton"),
  clearOfficeButton: document.querySelector("#clearOfficeButton"),
  detailDialog: document.querySelector("#detailDialog"),
  detailTitle: document.querySelector("#detailTitle"),
  detailBody: document.querySelector("#detailBody"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
};

let dataset;
let currentRecords = [];
let standardKeyByRaw = new Map();
let officeColor = new Map();
let officeOrder = [];

init();

async function init() {
  const response = await fetch("data/dataset.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Dataset load failed: ${response.status}`);
  }
  dataset = await response.json();

  buildLookups();
  populateControls();
  applyHash();
  renderStaticSections();
  bindEvents();
  render();
}

function buildLookups() {
  // Map every raw standard variant to its canonical facet key,
  // so a clicked pill can become an exact filter.
  dataset.standardFacets.forEach((facet) => {
    standardKeyByRaw.set(facet.key, facet.key);
    (facet.rawVariants || []).forEach((variant) => {
      standardKeyByRaw.set(variant.value, facet.key);
    });
  });

  // Stable, distinct dot color per office for quick scanning.
  officeOrder = [...dataset.offices].sort((a, b) => b.records - a.records);
  officeOrder.forEach((office, index) => {
    const hue = Math.round((index * 360) / officeOrder.length);
    officeColor.set(office.name, `hsl(${hue} 46% 42%)`);
  });
}

function bindEvents() {
  els.queryInput.addEventListener("input", () => {
    state.query = els.queryInput.value;
    state.visibleCount = PAGE_SIZE;
    syncHash();
    render();
  });

  els.officeSelect.addEventListener("change", () => {
    state.office = els.officeSelect.value;
    state.visibleCount = PAGE_SIZE;
    syncHash();
    render();
  });

  els.standardSelect.addEventListener("change", () => {
    state.standard = els.standardSelect.value;
    state.visibleCount = PAGE_SIZE;
    syncHash();
    render();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    state.visibleCount = PAGE_SIZE;
    syncHash();
    render();
  });

  document.querySelectorAll("[data-issue]").forEach((button) => {
    button.addEventListener("click", () => {
      setIssue(button.dataset.issue);
    });
  });

  els.loadMoreButton.addEventListener("click", () => {
    state.visibleCount += PAGE_SIZE;
    renderResults();
  });

  els.resetButton.addEventListener("click", resetFilters);
  els.csvButton.addEventListener("click", downloadCsv);
  els.clearOfficeButton.addEventListener("click", () => {
    setOffice("");
  });

  els.closeDialogButton.addEventListener("click", () => els.detailDialog.close());
  els.detailDialog.addEventListener("click", (event) => {
    if (event.target === els.detailDialog) {
      els.detailDialog.close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !isTypingTarget(event.target)) {
      event.preventDefault();
      els.queryInput.focus();
      els.queryInput.select();
    } else if (event.key === "Escape" && document.activeElement === els.queryInput && state.query) {
      els.queryInput.value = "";
      state.query = "";
      state.visibleCount = PAGE_SIZE;
      syncHash();
      render();
    }
  });

  window.addEventListener("hashchange", () => {
    applyHash();
    render();
  });
}

function isTypingTarget(node) {
  return node instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(node.tagName);
}

function populateControls() {
  officeOrder.forEach((office) => {
    const option = document.createElement("option");
    option.value = office.name;
    option.textContent = `${office.office} (${formatNumber(office.records)})`;
    els.officeSelect.append(option);
  });

  dataset.standardFacets
    .filter((facet) => facet.key !== "-")
    .forEach((facet) => {
      const option = document.createElement("option");
      option.value = facet.key;
      option.textContent = `${facet.label} (${formatNumber(facet.count)})`;
      els.standardSelect.append(option);
    });
}

/* ---------- URL state (deep linking) ---------- */
function applyHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  state.query = params.get("q") || "";
  state.office = optionExists(els.officeSelect, params.get("office")) ? params.get("office") : "";
  state.standard = optionExists(els.standardSelect, params.get("std")) ? params.get("std") : "";
  state.issue = issueLabels[params.get("issue")] ? params.get("issue") : "all";
  state.sort = optionExists(els.sortSelect, params.get("sort")) ? params.get("sort") : "source";
  state.visibleCount = PAGE_SIZE;
  syncControls();
}

function optionExists(select, value) {
  return Boolean(value) && [...select.options].some((option) => option.value === value);
}

function syncControls() {
  els.queryInput.value = state.query;
  els.officeSelect.value = state.office;
  els.standardSelect.value = state.standard;
  els.sortSelect.value = state.sort;
  document.querySelectorAll("[data-issue]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.issue === state.issue);
  });
}

function syncHash() {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.office) params.set("office", state.office);
  if (state.standard) params.set("std", state.standard);
  if (state.issue !== "all") params.set("issue", state.issue);
  if (state.sort !== "source") params.set("sort", state.sort);
  const hash = params.toString();
  history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
}

/* ---------- Static sections ---------- */
function renderStaticSections() {
  renderStats();
}

function renderStats() {
  const stats = [
    ["시도교육청", dataset.stats.officeCount],
    ["학교", dataset.stats.schoolCount],
    ["학과 행", dataset.stats.recordCount],
    ["기준학과 종류", dataset.stats.standardRawCount],
    ["비고 행", dataset.stats.noteCount],
  ];
  els.summaryStrip.replaceChildren(
    ...stats.map(([label, value]) => {
      const card = document.createElement("article");
      card.className = "stat-card";
      card.innerHTML = `
        <span class="stat-value">${formatNumber(value)}</span>
        <span class="stat-label">${escapeHtml(label)}</span>
      `;
      return card;
    }),
  );
}

/* ---------- Office facet (live counts) ---------- */
function renderOfficeBars() {
  const counts = officeFacetCounts();
  const max = Math.max(1, ...officeOrder.map((office) => counts.get(office.name) || 0));

  els.officeBars.replaceChildren(
    ...officeOrder.map((office, index) => {
      const count = counts.get(office.name) || 0;
      const button = document.createElement("button");
      button.className = "office-bar";
      button.type = "button";
      button.dataset.office = office.name;
      button.classList.toggle("is-active", office.name === state.office);
      button.classList.toggle("is-dim", count === 0 && office.name !== state.office);
      button.setAttribute("aria-pressed", String(office.name === state.office));
      button.innerHTML = `
        <span class="office-bar-rank">${index + 1}</span>
        <span class="office-bar-name" title="${escapeHtml(office.office)}">${escapeHtml(office.office)}</span>
        <span class="office-bar-count">${formatNumber(count)}</span>
        <span class="office-bar-track" aria-hidden="true">
          <span class="office-bar-fill" style="width:${(count / max) * 100}%"></span>
        </span>
      `;
      button.addEventListener("click", () => {
        setOffice(office.name === state.office ? "" : office.name);
      });
      return button;
    }),
  );
}

// Count per office under all active filters EXCEPT the office filter itself.
function officeFacetCounts() {
  const tokens = searchTokens();
  const counts = new Map();
  dataset.records.forEach((record) => {
    if (!matchesNonOffice(record, tokens)) return;
    counts.set(record.office, (counts.get(record.office) || 0) + 1);
  });
  return counts;
}

/* ---------- Filtering ---------- */
function render() {
  currentRecords = getFilteredRecords();
  els.resultCount.textContent = formatNumber(currentRecords.length);
  renderActiveFilters();
  renderOfficeBars();
  renderResults();
}

function searchTokens() {
  return normalizeSearch(state.query).split(" ").filter(Boolean);
}

function matchesNonOffice(record, tokens) {
  if (state.standard && !record.standardKeys.includes(state.standard)) return false;
  if (state.issue === "note" && !record.flags.hasNote) return false;
  if (state.issue === "missing" && !record.flags.missingStandard) return false;
  if (state.issue === "placeholder" && !record.flags.placeholderStandard) return false;
  return tokens.every((token) => record.searchText.includes(token));
}

function getFilteredRecords() {
  const tokens = searchTokens();
  const filtered = dataset.records.filter((record) => {
    if (state.office && record.office !== state.office) return false;
    return matchesNonOffice(record, tokens);
  });
  return filtered.sort(compareRecords);
}

function compareRecords(a, b) {
  if (state.sort === "school") {
    return compareText(a.school, b.school) || compareText(a.department, b.department) || a.sourceRow - b.sourceRow;
  }
  if (state.sort === "department") {
    return compareText(a.department, b.department) || compareText(a.school, b.school) || a.sourceRow - b.sourceRow;
  }
  if (state.sort === "standard") {
    return compareText(a.standard1 || a.standard2, b.standard1 || b.standard2) || compareText(a.school, b.school);
  }
  return compareText(a.office, b.office) || a.sourceRow - b.sourceRow;
}

/* ---------- Active filter chips (removable) ---------- */
function renderActiveFilters() {
  const chips = [];
  if (state.query.trim()) {
    chips.push({ clear: "query", label: `검색: ${state.query.trim()}` });
  }
  if (state.office) {
    const office = dataset.offices.find((item) => item.name === state.office);
    chips.push({ clear: "office", label: office ? office.office : state.office });
  }
  if (state.standard) {
    chips.push({ clear: "standard", label: `기준학과: ${state.standard}` });
  }
  if (state.issue !== "all") {
    chips.push({ clear: "issue", label: issueLabels[state.issue] });
  }

  els.activeFilters.replaceChildren(
    ...chips.map(({ clear, label }) => {
      const chip = document.createElement("button");
      chip.className = "filter-chip";
      chip.type = "button";
      chip.textContent = label;
      chip.setAttribute("aria-label", `${label} 필터 제거`);
      chip.addEventListener("click", () => clearFilter(clear));
      return chip;
    }),
  );
}

function clearFilter(kind) {
  if (kind === "query") {
    state.query = "";
    els.queryInput.value = "";
  } else if (kind === "office") {
    state.office = "";
    els.officeSelect.value = "";
  } else if (kind === "standard") {
    state.standard = "";
    els.standardSelect.value = "";
  } else if (kind === "issue") {
    setIssue("all");
    return;
  }
  state.visibleCount = PAGE_SIZE;
  syncHash();
  render();
}

/* ---------- Results ---------- */
function renderResults() {
  const visible = currentRecords.slice(0, state.visibleCount);
  if (visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<strong>조건에 맞는 행이 없습니다.</strong><span>검색어나 필터를 바꿔 다시 시도해 보세요.</span>`;
    els.resultBody.replaceChildren(empty);
  } else {
    const tokens = highlightTokens();
    els.resultBody.replaceChildren(...visible.map((record) => renderRow(record, tokens)));
  }

  const remaining = currentRecords.length - state.visibleCount;
  els.loadRow.hidden = remaining <= 0;
  if (currentRecords.length > 0) {
    els.loadNote.textContent = `전체 ${formatNumber(currentRecords.length)}개 중 ${formatNumber(
      Math.min(state.visibleCount, currentRecords.length),
    )}개 표시`;
  } else {
    els.loadNote.textContent = "";
  }
}

function renderRow(record, tokens) {
  const row = document.createElement("button");
  row.className = "result-row";
  row.type = "button";
  row.setAttribute("role", "row");
  row.setAttribute("aria-label", `${record.school} ${record.department} 상세 보기`);
  row.addEventListener("click", () => openDetail(record));

  const officeCell = makeCell(
    "시도교육청",
    `<span class="cell-office" style="--office-dot:${officeColor.get(record.office) || "var(--brand)"}">${escapeHtml(
      record.office,
    )}</span>`,
  );
  officeCell.classList.add("cell-office-wrap");

  row.append(
    officeCell,
    makeCell("학교명", `<strong>${highlight(record.school, tokens)}</strong>`),
    makeCell("학과명", buildDepartmentHtml(record, tokens)),
    makeCell("기준학과", buildStandardsHtml(record, tokens, true)),
  );

  return row;
}

function buildDepartmentHtml(record, tokens) {
  const badges = [];
  if (record.flags.hasNote) badges.push('<span class="badge is-note">비고</span>');
  if (record.flags.missingStandard) badges.push('<span class="badge is-warning">기준학과 미기재</span>');
  if (record.flags.placeholderStandard) badges.push('<span class="badge is-warning">표기 확인</span>');
  const badgeRow = badges.length ? `<span class="badge-row">${badges.join("")}</span>` : "";
  return `<strong>${highlight(record.department, tokens)}</strong>${badgeRow}`;
}

function buildStandardsHtml(record, tokens, clickable) {
  const standards = [record.standard1, record.standard2].filter(Boolean);
  if (standards.length === 0) {
    return '<span class="badge is-warning">미기재</span>';
  }
  return `<span class="standard-stack">${standards
    .map((standard) => {
      const key = standardKeyByRaw.get(standard);
      const canFilter = clickable && key && optionExists(els.standardSelect, key);
      const attr = canFilter
        ? ` data-standard="${escapeHtml(key)}" role="button" tabindex="0" title="이 기준학과로 필터"`
        : "";
      return `<span class="standard-pill"${attr}>${highlight(standard, tokens)}</span>`;
    })
    .join("")}</span>`;
}

function makeCell(label, html) {
  const cell = document.createElement("span");
  cell.className = "result-cell";
  cell.dataset.label = label;
  cell.setAttribute("role", "cell");
  cell.innerHTML = html;
  cell.querySelectorAll(".standard-pill[data-standard]").forEach((pill) => {
    const activate = (event) => {
      event.stopPropagation();
      setStandard(pill.dataset.standard);
    };
    pill.addEventListener("click", activate);
    pill.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(event);
      }
    });
  });
  return cell;
}

/* ---------- Detail dialog ---------- */
function openDetail(record) {
  els.detailTitle.textContent = `${record.school} · ${record.department}`;
  const badges = [
    record.flags.hasNote ? '<span class="badge is-note">비고 있음</span>' : "",
    record.flags.missingStandard ? '<span class="badge is-warning">기준학과 미기재</span>' : "",
    record.flags.placeholderStandard ? '<span class="badge is-warning">표기 확인</span>' : "",
  ]
    .filter(Boolean)
    .join(" ");

  const standardsHtml =
    [record.standard1, record.standard2].filter(Boolean).length === 0
      ? '<span class="badge is-warning">미기재</span>'
      : buildStandardsHtml(record, [], false);

  els.detailBody.innerHTML = `
    ${badges ? `<div class="detail-badges">${badges}</div>` : ""}
    <dl class="detail-grid">
      <dt>시도교육청</dt><dd>${escapeHtml(record.office)}</dd>
      <dt>학교명</dt><dd>${escapeHtml(record.school)}</dd>
      <dt>학과명</dt><dd>${escapeHtml(record.department)}</dd>
      <dt>기준학과</dt><dd>${standardsHtml}</dd>
      <dt>비고</dt><dd>${escapeHtml(record.note || "없음")}</dd>
    </dl>
    <p class="meta-box">
      <strong>원본 위치</strong> · 시트 ${escapeHtml(record.sourceSheet)} · ${escapeHtml(String(record.sourceRow))}행
      ${record.sourceRange ? `<br />범위 ${escapeHtml(record.sourceRange)}` : ""}
    </p>
  `;
  els.detailDialog.showModal();
}

/* ---------- State setters ---------- */
function setOffice(value) {
  state.office = value;
  els.officeSelect.value = value;
  state.visibleCount = PAGE_SIZE;
  syncHash();
  render();
}

function setStandard(value) {
  state.standard = value;
  els.standardSelect.value = value;
  state.visibleCount = PAGE_SIZE;
  syncHash();
  render();
  els.queryInput.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setIssue(value) {
  state.issue = value;
  state.visibleCount = PAGE_SIZE;
  document.querySelectorAll("[data-issue]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.issue === value);
  });
  syncHash();
  render();
}

function resetFilters() {
  state.query = "";
  state.office = "";
  state.standard = "";
  state.issue = "all";
  state.sort = "source";
  state.visibleCount = PAGE_SIZE;
  syncControls();
  syncHash();
  render();
}

/* ---------- CSV export ---------- */
function downloadCsv() {
  if (currentRecords.length === 0) return;
  const header = ["시도교육청", "학교명", "학과명", "기준학과1", "기준학과2", "비고", "원본시트", "원본행"];
  const lines = [header, ...currentRecords.map((record) => [
    record.office,
    record.school,
    record.department,
    record.standard1 || "",
    record.standard2 || "",
    record.note || "",
    record.sourceSheet,
    record.sourceRow,
  ])];
  const csv = lines.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `특성화고_기준학과_${stampToday()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function stampToday() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

/* ---------- Highlighting ---------- */
function highlightTokens() {
  return state.query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function highlight(text, tokens) {
  const safe = escapeHtml(text);
  if (!tokens || tokens.length === 0) return safe;
  const pattern = tokens.map(escapeRegex).filter(Boolean).join("|");
  if (!pattern) return safe;
  return safe.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
}

/* ---------- Helpers ---------- */
function normalizeSearch(value) {
  return String(value ?? "")
    .replace(/[･ㆍ〮・]/g, "·")
    .replace(/ￚ/g, "-")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ko-KR")
    .trim();
}

function compareText(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), "ko-KR", { numeric: true, sensitivity: "base" });
}

function formatNumber(value) {
  return Number(value).toLocaleString("ko-KR");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
