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

const checkLabels = {
  office_sheet_count: "교육청 시트",
  record_count: "학과 행",
  school_count: "학교 수",
  note_count: "비고 행",
  missing_standard_count: "기준학과 미기재",
  duplicate_full_row_count: "중복 행",
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
  loadMoreButton: document.querySelector("#loadMoreButton"),
  resetButton: document.querySelector("#resetButton"),
  clearOfficeButton: document.querySelector("#clearOfficeButton"),
  detailDialog: document.querySelector("#detailDialog"),
  detailTitle: document.querySelector("#detailTitle"),
  detailBody: document.querySelector("#detailBody"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
};

let dataset;
let currentRecords = [];

init();

async function init() {
  const response = await fetch("data/dataset.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Dataset load failed: ${response.status}`);
  }
  dataset = await response.json();

  populateControls();
  renderStaticSections();
  bindEvents();
  render();
}

function bindEvents() {
  els.queryInput.addEventListener("input", () => {
    state.query = els.queryInput.value;
    state.visibleCount = PAGE_SIZE;
    render();
  });

  els.officeSelect.addEventListener("change", () => {
    state.office = els.officeSelect.value;
    state.visibleCount = PAGE_SIZE;
    render();
  });

  els.standardSelect.addEventListener("change", () => {
    state.standard = els.standardSelect.value;
    state.visibleCount = PAGE_SIZE;
    render();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    state.visibleCount = PAGE_SIZE;
    render();
  });

  document.querySelectorAll("[data-issue]").forEach((button) => {
    button.addEventListener("click", () => {
      state.issue = button.dataset.issue;
      state.visibleCount = PAGE_SIZE;
      document.querySelectorAll("[data-issue]").forEach((item) => {
        item.classList.toggle("is-active", item.dataset.issue === state.issue);
      });
      render();
    });
  });

  els.loadMoreButton.addEventListener("click", () => {
    state.visibleCount += PAGE_SIZE;
    renderResults();
  });

  els.resetButton.addEventListener("click", resetFilters);
  els.clearOfficeButton.addEventListener("click", () => {
    state.office = "";
    els.officeSelect.value = "";
    state.visibleCount = PAGE_SIZE;
    render();
  });
  els.closeDialogButton.addEventListener("click", () => els.detailDialog.close());
  els.detailDialog.addEventListener("click", (event) => {
    const rect = els.detailDialog.getBoundingClientRect();
    const isOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (isOutside) {
      els.detailDialog.close();
    }
  });
}

function populateControls() {
  dataset.offices.forEach((office) => {
    const option = document.createElement("option");
    option.value = office.name;
    option.textContent = `${office.office} (${office.records.toLocaleString("ko-KR")})`;
    els.officeSelect.append(option);
  });

  dataset.standardFacets
    .filter((facet) => facet.key !== "-")
    .forEach((facet) => {
      const option = document.createElement("option");
      option.value = facet.key;
      option.textContent = `${facet.label} (${facet.count.toLocaleString("ko-KR")})`;
      els.standardSelect.append(option);
    });
}

function renderStaticSections() {
  renderStats();
  renderOfficeBars();
}

function renderStats() {
  const stats = [
    ["시도교육청", dataset.stats.officeCount],
    ["학교", dataset.stats.schoolCount],
    ["학과 행", dataset.stats.recordCount],
    ["기준학과 원문", dataset.stats.standardRawCount],
    ["비고 행", dataset.stats.noteCount],
  ];
  els.summaryStrip.replaceChildren(
    ...stats.map(([label, value]) => {
      const card = document.createElement("article");
      card.className = "stat-card";
      card.innerHTML = `
        <span class="stat-value">${Number(value).toLocaleString("ko-KR")}</span>
        <span class="stat-label">${escapeHtml(label)}</span>
      `;
      return card;
    }),
  );
}

function renderOfficeBars() {
  const max = Math.max(...dataset.offices.map((office) => office.records));
  els.officeBars.replaceChildren(
    ...dataset.offices.map((office) => {
      const button = document.createElement("button");
      button.className = "office-bar";
      button.type = "button";
      button.dataset.office = office.name;
      button.innerHTML = `
        <span class="office-bar-name">${escapeHtml(office.office)}</span>
        <span class="office-bar-count">${office.records.toLocaleString("ko-KR")}</span>
        <span class="office-bar-track" aria-hidden="true">
          <span class="office-bar-fill" style="width:${Math.max(4, (office.records / max) * 100)}%"></span>
        </span>
      `;
      button.addEventListener("click", () => {
        state.office = office.name;
        els.officeSelect.value = office.name;
        state.visibleCount = PAGE_SIZE;
        render();
      });
      return button;
    }),
  );
}

function render() {
  currentRecords = getFilteredRecords();
  els.resultCount.textContent = currentRecords.length.toLocaleString("ko-KR");
  renderActiveFilters();
  renderResults();
  updateOfficeBarState();
}

function getFilteredRecords() {
  const tokens = normalizeSearch(state.query).split(" ").filter(Boolean);
  const filtered = dataset.records.filter((record) => {
    if (state.office && record.sourceSheet !== state.office) {
      return false;
    }
    if (state.standard && !record.standardKeys.includes(state.standard)) {
      return false;
    }
    if (state.issue === "note" && !record.flags.hasNote) {
      return false;
    }
    if (state.issue === "missing" && !record.flags.missingStandard) {
      return false;
    }
    if (state.issue === "placeholder" && !record.flags.placeholderStandard) {
      return false;
    }
    return tokens.every((token) => record.searchText.includes(token));
  });

  return filtered.sort((a, b) => compareRecords(a, b));
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
  return compareText(a.sourceSheet, b.sourceSheet) || a.sourceRow - b.sourceRow;
}

function renderActiveFilters() {
  const chips = [];
  if (state.query.trim()) {
    chips.push(`검색: ${state.query.trim()}`);
  }
  if (state.office) {
    const option = els.officeSelect.selectedOptions[0];
    chips.push(option ? option.textContent : state.office);
  }
  if (state.standard) {
    const option = els.standardSelect.selectedOptions[0];
    chips.push(option ? option.textContent : state.standard);
  }
  if (state.issue !== "all") {
    chips.push(issueLabels[state.issue]);
  }

  els.activeFilters.replaceChildren(
    ...chips.map((label) => {
      const chip = document.createElement("span");
      chip.className = "filter-chip";
      chip.textContent = label;
      return chip;
    }),
  );
}

function renderResults() {
  const visible = currentRecords.slice(0, state.visibleCount);
  if (visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "조건에 맞는 행이 없습니다.";
    els.resultBody.replaceChildren(empty);
  } else {
    els.resultBody.replaceChildren(...visible.map(renderRow));
  }

  els.loadMoreButton.parentElement.hidden = currentRecords.length <= state.visibleCount;
}

function renderRow(record) {
  const row = document.createElement("button");
  row.className = "result-row";
  row.type = "button";
  row.setAttribute("role", "row");
  row.setAttribute("aria-label", `${record.school} ${record.department} 상세 보기`);
  row.addEventListener("click", () => openDetail(record));

  row.append(
    makeCell("시도교육청", `<strong>${escapeHtml(record.office)}</strong>`),
    makeCell("학교명", `<strong>${escapeHtml(record.school)}</strong>`),
    makeCell("학과명", buildDepartmentHtml(record)),
    makeCell("기준학과", buildStandardsHtml(record)),
  );

  return row;
}

function buildDepartmentHtml(record) {
  const badges = [];
  if (record.flags.hasNote) {
    badges.push('<span class="badge is-note">비고</span>');
  }
  if (record.flags.missingStandard) {
    badges.push('<span class="badge is-warning">기준학과 미기재</span>');
  }
  if (record.flags.placeholderStandard) {
    badges.push('<span class="badge is-warning">표기 확인</span>');
  }
  return `<strong>${escapeHtml(record.department)}</strong>${badges.length ? `<span>${badges.join(" ")}</span>` : ""}`;
}

function buildStandardsHtml(record) {
  const standards = [record.standard1, record.standard2].filter(Boolean);
  if (standards.length === 0) {
    return '<span class="badge is-warning">미기재</span>';
  }
  return `<span class="standard-stack">${standards
    .map((standard) => `<span class="standard-pill">${escapeHtml(standard)}</span>`)
    .join("")}</span>`;
}

function makeCell(label, html) {
  const cell = document.createElement("span");
  cell.className = "result-cell";
  cell.dataset.label = label;
  cell.setAttribute("role", "cell");
  cell.innerHTML = html;
  return cell;
}

function openDetail(record) {
  els.detailTitle.textContent = `${record.school} · ${record.department}`;
  const badges = [
    record.flags.hasNote ? '<span class="badge is-note">비고 있음</span>' : "",
    record.flags.missingStandard ? '<span class="badge is-warning">기준학과 미기재</span>' : "",
    record.flags.placeholderStandard ? '<span class="badge is-warning">표기 확인</span>' : "",
  ]
    .filter(Boolean)
    .join(" ");

  els.detailBody.innerHTML = `
    ${badges ? `<div>${badges}</div>` : ""}
    <dl class="detail-grid">
      <dt>시도교육청</dt><dd>${escapeHtml(record.office)}</dd>
      <dt>학교명</dt><dd>${escapeHtml(record.school)}</dd>
      <dt>학과명</dt><dd>${escapeHtml(record.department)}</dd>
      <dt>기준학과 1</dt><dd>${escapeHtml(record.standard1 || "미기재")}</dd>
      <dt>기준학과 2</dt><dd>${escapeHtml(record.standard2 || "미기재")}</dd>
      <dt>비고</dt><dd>${escapeHtml(record.note || "없음")}</dd>
    </dl>
  `;
  els.detailDialog.showModal();
}

function updateOfficeBarState() {
  document.querySelectorAll(".office-bar").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.office === state.office);
  });
}

function resetFilters() {
  state.query = "";
  state.office = "";
  state.standard = "";
  state.issue = "all";
  state.sort = "source";
  state.visibleCount = PAGE_SIZE;

  els.queryInput.value = "";
  els.officeSelect.value = "";
  els.standardSelect.value = "";
  els.sortSelect.value = "source";
  document.querySelectorAll("[data-issue]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.issue === "all");
  });
  render();
}

function normalizeSearch(value) {
  return String(value ?? "")
    .replace(/[･ㆍ〮・]/g, "·")
    .replace(/\uffda/g, "-")
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

function formatDateTime(value) {
  if (!value) {
    return "";
  }
  return String(value).replace("T", " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
