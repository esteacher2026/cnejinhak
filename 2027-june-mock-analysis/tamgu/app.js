(function () {
  const data = window.TAMGU_DATA || { pages: [], sections: [], focusItems: [] };
  const totalPages = data.pages.length || 98;
  const subjects = data.sections.map((section) => section.subject);
  const groups = ["사회탐구", "과학탐구"];
  const pageText = new Map(data.pages.map((page) => [page.page, page.text || ""]));

  const diagnosis = [
    {
      group: "사회탐구",
      title: "도표형 문항은 비율 표준화와 조건 순서가 핵심",
      body: "사회·문화는 계층 이동, 사회 보장, 인구 부양비처럼 전체 집단 크기와 비율 환산을 함께 처리하는 문항에서 오답률이 높았습니다.",
      tags: ["비율 표준화", "도표 추론", "조건 대입"],
      page: 16,
    },
    {
      group: "사회탐구",
      title: "법·윤리 과목은 유사 개념의 경계가 변별",
      body: "정치와 법은 헌법재판소 권한과 법률관계 구분, 윤리 과목은 사상가의 공통 전제와 결론 차이를 구별하는 훈련이 중요합니다.",
      tags: ["사례 판단", "사상가 비교", "선지 검증"],
      page: 22,
    },
    {
      group: "과학탐구",
      title: "화학은 자료 형태를 먼저 읽고 계산 루틴을 고정",
      body: "화학Ⅰ·Ⅱ 모두 양적 관계, 평형, 중화, 증기압처럼 자료의 단위와 조건을 잘못 읽으면 풀이 방향이 크게 흔들리는 문항이 많았습니다.",
      tags: ["자료 해석", "양적 관계", "평형"],
      page: 54,
    },
    {
      group: "과학탐구",
      title: "생명과학은 복합 조건 구조화가 최상위 변별",
      body: "생명과학Ⅰ의 돌연변이와 흥분 전도, 생명과학Ⅱ의 유전자 발현·DNA 복제 문항은 조건을 표와 도식으로 재구성해야 합니다.",
      tags: ["복합 유전", "조건 구조화", "도식화"],
      page: 84,
    },
  ];

  const state = {
    group: "all",
    subject: "all",
    topGroup: "all",
    query: "",
    page: 1,
  };

  const els = {
    searchInput: document.getElementById("searchInput"),
    groupFilter: document.getElementById("groupFilter"),
    subjectFilter: document.getElementById("subjectFilter"),
    searchResults: document.getElementById("searchResults"),
    stats: document.getElementById("stats"),
    diagnosisGrid: document.getElementById("diagnosisGrid"),
    subjectGrid: document.getElementById("subjectGrid"),
    topSegment: document.getElementById("topSegment"),
    topList: document.getElementById("topList"),
    questionGrid: document.getElementById("questionGrid"),
    cardCount: document.getElementById("cardCount"),
    pageGrid: document.getElementById("pageGrid"),
    pageJump: document.getElementById("pageJump"),
    jumpButton: document.getElementById("jumpButton"),
    dialog: document.getElementById("pageDialog"),
    dialogImage: document.getElementById("dialogImage"),
    dialogTitle: document.getElementById("dialogTitle"),
    prevPage: document.getElementById("prevPage"),
    nextPage: document.getElementById("nextPage"),
    closeDialog: document.getElementById("closeDialog"),
  };

  function pagePath(page) {
    return `assets/pages/page-${String(page).padStart(2, "0")}.jpg`;
  }

  function sectionForPage(page) {
    return data.sections.find((section) => page >= section.start && page <= section.end);
  }

  function pageLabel(page) {
    const section = sectionForPage(page);
    if (section) return section.subject;
    if (page >= 3 && page <= 9) return "총평";
    if (page === 1) return "표지";
    if (page === 2) return "목차";
    return "기타";
  }

  function colorFor(group) {
    return group === "과학탐구"
      ? { accent: "#1f72b8", soft: "#edf4fb" }
      : { accent: "#3f8f5b", soft: "#edf8f0" };
  }

  function styleFor(group) {
    const c = colorFor(group);
    return `--accent:${c.accent};--accent-soft:${c.soft}`;
  }

  function cleanDisplayText(value) {
    return String(value ?? "")
      .replace(/[\uE000-\uF8FF]+/g, " ")
      .replace(/\s+([,.)])/g, "$1")
      .replace(/([(])\s+/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return cleanDisplayText(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function textBlob(item) {
    return Object.values(item).flat().filter(Boolean).join(" ").toLowerCase();
  }

  function matchesQuery(item) {
    const q = state.query;
    return !q || textBlob(item).includes(q);
  }

  function groupOk(group) {
    return state.group === "all" || group === state.group;
  }

  function subjectOk(subject) {
    return state.subject === "all" || subject === state.subject;
  }

  function renderStats() {
    const sorted = [...data.focusItems].sort((a, b) => (b.wrongRate || 0) - (a.wrongRate || 0));
    const top = sorted[0];
    const socialCount = data.focusItems.filter((item) => item.group === "사회탐구").length;
    const scienceCount = data.focusItems.filter((item) => item.group === "과학탐구").length;
    const avgTop = sorted.slice(0, 10).reduce((sum, item) => sum + (item.wrongRate || 0), 0) / 10;
    els.stats.innerHTML = [
      stat("분석 문항", `${data.focusItems.length}개`, `사회 ${socialCount} · 과학 ${scienceCount}`),
      stat("최고 오답률", `${top.wrongRate.toFixed(1)}%`, `${top.subject} ${top.number}번`),
      stat("TOP10 평균", `${avgTop.toFixed(1)}%`, "상위 오답률 문항 기준"),
      stat("원문 보존", `${totalPages}쪽`, "표·수식·그림 이미지 확인"),
    ].join("");
  }

  function stat(label, value, note) {
    return `<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
  }

  function renderSubjectFilter() {
    const buttons = [`<button class="chip is-active" type="button" data-subject="all">전체</button>`]
      .concat(subjects.map((subject) => `<button class="chip" type="button" data-subject="${escapeHtml(subject)}">${escapeHtml(subject)}</button>`));
    els.subjectFilter.innerHTML = buttons.join("");
  }

  function renderDiagnosis() {
    els.diagnosisGrid.innerHTML = diagnosis
      .map((card) => `
        <article class="diagnosis-card" style="${styleFor(card.group)}">
          <div class="label">${card.group}</div>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.body)}</p>
          <div class="badge-row">${card.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="card-actions">
            <button class="text-button primary" type="button" data-page="${card.page}">${openIcon()} 원문</button>
          </div>
        </article>
      `)
      .join("");
  }

  function renderSubjectGrid() {
    els.subjectGrid.innerHTML = data.sections
      .map((section) => {
        const items = data.focusItems.filter((item) => item.subject === section.subject);
        const top = [...items].sort((a, b) => (b.wrongRate || 0) - (a.wrongRate || 0))[0];
        return `
          <article class="subject-card" style="${styleFor(section.group)}">
            <div class="label">${section.group}</div>
            <h3>${escapeHtml(section.subject)}</h3>
            <p>${escapeHtml(section.theme)}</p>
            <div class="badge-row">
              <span class="tag">${section.reportPage}쪽 시작</span>
              <span class="tag">문항 ${items.length}개</span>
              <span class="rate">TOP ${top ? top.wrongRate.toFixed(1) : "-"}%</span>
            </div>
            <p><strong>최고 오답:</strong> ${top ? `${escapeHtml(top.number)}번 · ${escapeHtml(top.title)}` : "없음"}</p>
            <div class="card-actions">
              <button class="text-button primary" type="button" data-filter-subject="${escapeHtml(section.subject)}">${openIcon()} 문항 보기</button>
              <button class="text-button" type="button" data-page="${section.start}">원문</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderTopList() {
    const items = data.focusItems
      .filter((item) => state.topGroup === "all" || item.group === state.topGroup)
      .sort((a, b) => (b.wrongRate || 0) - (a.wrongRate || 0))
      .slice(0, 12);
    els.topList.innerHTML = items.map((item) => riskCard(item)).join("");
  }

  function riskCard(item) {
    return `
      <article class="risk-card" style="${styleFor(item.group)}">
        <div class="risk-score"><span>오답률</span><strong>${rateText(item)}</strong></div>
        <div>
          <div class="kicker">${escapeHtml(item.group)} · ${escapeHtml(item.subject)} · ${escapeHtml(item.number)}번</div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.analysis)}</p>
          <div class="badge-row">
            ${item.correct ? `<span class="tag">정답 ${escapeHtml(item.correct)}</span>` : ""}
            <span class="rank">과목 ${item.subjectRank || "-"}위</span>
            <span class="tag">${item.page}쪽</span>
          </div>
          <div class="card-actions">
            <button class="text-button primary" type="button" data-page="${item.page}">${openIcon()} 원문</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderQuestions() {
    const items = data.focusItems
      .filter((item) => groupOk(item.group) && subjectOk(item.subject) && matchesQuery(item))
      .sort((a, b) => {
        if ((b.wrongRate || 0) !== (a.wrongRate || 0)) return (b.wrongRate || 0) - (a.wrongRate || 0);
        return a.page - b.page;
      });
    els.cardCount.textContent = `${items.length}개 표시`;
    els.questionGrid.innerHTML = items.length ? items.map((item) => questionCard(item)).join("") : empty("조건에 맞는 문항 카드가 없습니다.");
  }

  function questionCard(item) {
    return `
      <article class="question-card" style="${styleFor(item.group)}">
        <div class="card-head">
          <div>
            <div class="kicker">${escapeHtml(item.group)} · ${escapeHtml(item.subject)}</div>
            <h3>${escapeHtml(item.number)}번 ${escapeHtml(item.title)}</h3>
          </div>
          <span class="rate">${rateText(item)}</span>
        </div>
        <div class="card-body">
          <div><strong>문항 분석</strong><p>${escapeHtml(item.analysis)}</p></div>
          <div><strong>대비 전략</strong><p>${escapeHtml(item.strategy || "원문 분석 내용을 확인하세요.")}</p></div>
        </div>
        <div class="badge-row">
          ${item.correct ? `<span class="tag">정답 ${escapeHtml(item.correct)}</span>` : ""}
          <span class="rank">과목 ${item.subjectRank || "-"}위</span>
          <span class="tag">${item.page}쪽</span>
        </div>
        <div class="card-actions">
          <button class="text-button primary" type="button" data-page="${item.page}">${openIcon()} 원문</button>
        </div>
      </article>
    `;
  }

  function renderPages() {
    const pages = data.pages.filter((page) => {
      const section = sectionForPage(page.page);
      const group = section ? section.group : page.group;
      const subject = section ? section.subject : page.subject;
      const groupMatch = state.group === "all" || group === state.group;
      const subjectMatch = state.subject === "all" || subject === state.subject;
      const queryMatch = !state.query || (page.text || "").toLowerCase().includes(state.query);
      return groupMatch && subjectMatch && queryMatch;
    });
    els.pageGrid.innerHTML = pages.length
      ? pages
          .map((page) => `
            <button class="page-card" type="button" data-page="${page.page}">
              <img loading="lazy" src="${pagePath(page.page)}" alt="${page.page}쪽 원문" />
              <span><b>${page.page}쪽</b><em>${escapeHtml(pageLabel(page.page))}</em></span>
            </button>
          `)
          .join("")
      : empty("조건에 맞는 원문 페이지가 없습니다.");
  }

  function renderSearchResults() {
    if (!state.query) {
      els.searchResults.innerHTML = "";
      return;
    }
    const cardMatches = data.focusItems
      .filter((item) => groupOk(item.group) && subjectOk(item.subject) && matchesQuery(item))
      .slice(0, 6);
    const pageMatches = data.pages
      .filter((page) => {
        const section = sectionForPage(page.page);
        const group = section ? section.group : page.group;
        const subject = section ? section.subject : page.subject;
        return (state.group === "all" || group === state.group) &&
          (state.subject === "all" || subject === state.subject) &&
          (page.text || "").toLowerCase().includes(state.query);
      })
      .slice(0, 8);
    const blocks = [];
    if (cardMatches.length) {
      blocks.push(`<p class="side-title">문항</p>`);
      blocks.push(...cardMatches.map((item) => resultButton(item.page, `${item.subject} ${item.number}번`, item.title)));
    }
    if (pageMatches.length) {
      blocks.push(`<p class="side-title">페이지</p>`);
      blocks.push(...pageMatches.map((page) => resultButton(page.page, `${page.page}쪽 · ${pageLabel(page.page)}`, snippet(page.text))));
    }
    els.searchResults.innerHTML = blocks.length ? blocks.join("") : `<p class="side-title">검색 결과 없음</p>`;
  }

  function resultButton(page, title, body) {
    return `<button class="result-button" type="button" data-page="${page}"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(body)}</small></button>`;
  }

  function snippet(text) {
    const source = text || "";
    const index = source.toLowerCase().indexOf(state.query);
    if (index < 0) return source.slice(0, 90);
    const start = Math.max(0, index - 42);
    const end = Math.min(source.length, index + state.query.length + 70);
    return `${start > 0 ? "..." : ""}${source.slice(start, end)}${end < source.length ? "..." : ""}`;
  }

  function rateText(item) {
    return item.wrongRate == null ? "-" : `${item.wrongRate.toFixed(1)}%`;
  }

  function empty(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function openIcon() {
    return `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>`;
  }

  function setActive(container, attr, value) {
    container.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset[attr] === value);
    });
  }

  function rerenderFiltered() {
    state.query = els.searchInput.value.trim().toLowerCase();
    renderQuestions();
    renderPages();
    renderSearchResults();
  }

  function openPage(page) {
    state.page = Math.min(totalPages, Math.max(1, Number(page) || 1));
    els.dialogImage.src = pagePath(state.page);
    els.dialogImage.alt = `${state.page}쪽 원문`;
    els.dialogTitle.textContent = `${state.page}쪽 · ${pageLabel(state.page)}`;
    els.pageJump.value = state.page;
    if (typeof els.dialog.showModal === "function" && !els.dialog.open) {
      els.dialog.showModal();
    } else {
      els.dialog.setAttribute("open", "");
    }
  }

  function closePage() {
    if (typeof els.dialog.close === "function") {
      els.dialog.close();
    } else {
      els.dialog.removeAttribute("open");
    }
  }

  function setupEvents() {
    document.addEventListener("click", (event) => {
      const filterButton = event.target.closest("[data-filter-subject]");
      if (filterButton) {
        state.subject = filterButton.dataset.filterSubject;
        state.group = data.sections.find((section) => section.subject === state.subject)?.group || "all";
        setActive(els.groupFilter, "group", state.group);
        setActive(els.subjectFilter, "subject", state.subject);
        document.getElementById("questions").scrollIntoView({ behavior: "smooth" });
        rerenderFiltered();
        return;
      }

      const pageButton = event.target.closest("[data-page]");
      if (pageButton) openPage(pageButton.dataset.page);
    });

    els.groupFilter.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-group]");
      if (!button) return;
      state.group = button.dataset.group;
      state.subject = "all";
      setActive(els.groupFilter, "group", state.group);
      setActive(els.subjectFilter, "subject", "all");
      rerenderFiltered();
    });

    els.subjectFilter.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-subject]");
      if (!button) return;
      state.subject = button.dataset.subject;
      if (state.subject !== "all") {
        state.group = data.sections.find((section) => section.subject === state.subject)?.group || "all";
        setActive(els.groupFilter, "group", state.group);
      }
      setActive(els.subjectFilter, "subject", state.subject);
      rerenderFiltered();
    });

    els.topSegment.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-group]");
      if (!button) return;
      state.topGroup = button.dataset.group;
      setActive(els.topSegment, "group", state.topGroup);
      renderTopList();
    });

    els.searchInput.addEventListener("input", rerenderFiltered);
    els.jumpButton.addEventListener("click", () => openPage(els.pageJump.value));
    els.pageJump.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openPage(els.pageJump.value);
    });
    els.prevPage.addEventListener("click", () => openPage(state.page - 1));
    els.nextPage.addEventListener("click", () => openPage(state.page + 1));
    els.closeDialog.addEventListener("click", closePage);
    els.dialog.addEventListener("click", (event) => {
      if (event.target === els.dialog) closePage();
    });
    document.addEventListener("keydown", (event) => {
      if (!els.dialog.open) return;
      if (event.key === "ArrowLeft") openPage(state.page - 1);
      if (event.key === "ArrowRight") openPage(state.page + 1);
    });

    const links = [...document.querySelectorAll(".toc-link")];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        links.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`));
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0.05, 0.2, 0.5] }
    );
    document.querySelectorAll("main section[id]").forEach((section) => observer.observe(section));
  }

  renderSubjectFilter();
  renderStats();
  renderDiagnosis();
  renderSubjectGrid();
  renderTopList();
  renderQuestions();
  renderPages();
  setupEvents();
})();
