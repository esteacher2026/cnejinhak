/* ---------- udm 앱: 탭·상태·렌더·이벤트 ---------- */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const section = $('univDB');
  const paneSearch = $('udbPaneSearch'), paneMatrix = $('udbPaneMatrix');
  if (!section || !paneSearch || !paneMatrix) return;
  const tabs = [...section.querySelectorAll('.udb-tab')];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = (k, fb) => { try { const v = localStorage.getItem(k); return v === null ? fb : v; } catch { return fb; } };
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 사생활 모드 등 */ } };

  let M = null, FILE1 = [];
  try {
    M = JSON.parse($('matrix-data').textContent);
    FILE1 = JSON.parse($('records-data').textContent);
  } catch (e) {
    paneMatrix.innerHTML = '<div class="empty" style="padding:40px">매트릭스 자료를 불러오지 못했습니다.</div>';
  }

  const st = {
    tab: 'search', unit: '', view: 'unit', region: '', q: '', sort: 'source',
    check: false, mySubs: new Set(), subject: 'calc2', includeGroups: true
  };
  let rendered = false;

  /* ---------- 탭 ---------- */
  function activateTab(name, opts = {}) {
    st.tab = name; section.dataset.tab = name;
    tabs.forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
    });
    paneSearch.hidden = name !== 'search'; paneMatrix.hidden = name !== 'matrix';
    const hash = name === 'matrix' ? '#univDB-matrix' : '#univDB';
    if (opts.hash !== false && location.hash !== hash) history.replaceState(null, '', hash);
    store('udb2028.tab', name);
    if (name === 'matrix' && M && !rendered) { rendered = true; renderAll(); }
    if (opts.scroll) section.scrollIntoView({ block: 'start' });
    if (opts.focus) { const b = tabs.find(x => x.dataset.tab === name); if (b) b.focus(); }
  }
  function bindTabs() {
    tabs.forEach(b => b.addEventListener('click', () => activateTab(b.dataset.tab)));
    section.querySelector('.udb-tabs').addEventListener('keydown', e => {
      const i = tabs.indexOf(document.activeElement); if (i < 0) return;
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j === null) return;
      e.preventDefault(); activateTab(tabs[j].dataset.tab, { focus: true });
    });
    window.addEventListener('hashchange', () => {
      if (location.hash === '#univDB-matrix') activateTab('matrix', { hash: false });
      else if (location.hash === '#univDB') activateTab('search', { hash: false });
    });
    // 전공 카드·대학명 진입점은 검색 탭을 먼저 켠다 (기존 함수는 수정하지 않고 감싼다)
    ['udbSearchByMajor', 'udbSearchUniversity'].forEach(fn => {
      const orig = window[fn]; if (typeof orig !== 'function') return;
      window[fn] = function () { activateTab('search'); return orig.apply(this, arguments); };
    });
  }

  /* ---------- 렌더(골격: 자료 요약 1줄) ---------- */
  function renderAll() {
    $('udmHead').innerHTML = `<strong>매트릭스 자료 ${M.meta.records}건</strong><span>대표 모집단위 ${M.units.length}개 · 정리 ${esc(M.meta.built)}</span>`;
  }

  /* ---------- 부트 ---------- */
  function init() {
    bindTabs();
    const h = location.hash;
    const initial = h === '#univDB-matrix' ? 'matrix' : h === '#univDB' ? 'search'
      : (read('udb2028.tab', 'search') === 'matrix' ? 'matrix' : 'search');
    activateTab(initial, { hash: false });
  }
  init();
})();
