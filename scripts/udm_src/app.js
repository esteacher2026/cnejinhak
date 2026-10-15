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
  const NF = new Intl.NumberFormat('ko-KR');
  const COL = new Intl.Collator('ko-KR', { numeric: true });
  const REGIONS = ['수도권', '영남권', '중부권', '호남권'];
  const DEFAULT_UNIT = 'computer-eng';
  const mobile = window.matchMedia('(max-width: 680px)');

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
  let byUnit = new Map(), byId = new Map(), UNIT_BY_KEY = new Map(), SUBJ_BY_GROUP = {}, SUBJ_BY_KEY = {}, GROUP_LABEL = {};
  if (M) {
    byUnit = UDM.indexByUnit(M.records);
    byId = new Map(M.records.map(r => [r.id, r]));
    UNIT_BY_KEY = new Map(M.units.map(u => [u.key, u]));
    M.subjects.forEach(s => { (SUBJ_BY_GROUP[s.group] = SUBJ_BY_GROUP[s.group] || []).push(s.key); SUBJ_BY_KEY[s.key] = s; });
    M.groups.forEach(g => { GROUP_LABEL[g.key] = g.label; });
  }
  const el = {
    legend: $('udmLegend'), units: $('udmUnits'), tools: $('udmTools'), viewSeg: $('udmViewSeg'),
    region: $('udmRegion'), search: $('udmSearch'), sort: $('udmSort'), checkBtn: $('udmCheckBtn'),
    check: $('udmCheck'), head: $('udmHead'), result: $('udmResult'), subject: $('udmSubject'), errataBtn: $('udmErrataBtn')
  };

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

  /* ---------- 데이터 선택 ---------- */
  function visibleRecords() {
    let rs = (byUnit.get(st.unit) || []).slice();
    if (st.region) rs = rs.filter(r => r.regionGroup === st.region);
    if (st.q) { const q = st.q.toLowerCase(); rs = rs.filter(r => r.university.toLowerCase().includes(q)); }
    const score = r => r.allSubjects ? 99 : r.marks.length + r.groups.length * 3;
    const missN = r => { const e = UDM.evaluate(r, st.mySubs, SUBJ_BY_GROUP); return e.ok ? 0 : e.missing.length + e.groupsMissing.length + (r.allSubjects ? 1 : 0); };
    if (st.sort === 'name') rs.sort((a, b) => COL.compare(a.university, b.university));
    else if (st.sort === 'count') rs.sort((a, b) => score(b) - score(a) || COL.compare(a.university, b.university));
    else if (st.sort === 'region') rs.sort((a, b) => REGIONS.indexOf(a.regionGroup) - REGIONS.indexOf(b.regionGroup) || COL.compare(a.region || '', b.region || '') || COL.compare(a.university, b.university));
    else if (st.sort === 'missing' && st.check && typeof UDM.evaluate === 'function') rs.sort((a, b) => missN(a) - missN(b) || COL.compare(a.university, b.university));
    else rs.sort((a, b) => a.srcRow - b.srcRow);
    return rs;
  }
  const evalOf = r => (st.check && typeof UDM.evaluate === 'function') ? UDM.evaluate(r, st.mySubs, SUBJ_BY_GROUP) : null;
  function missingLabel(ev) {
    return [...ev.missing.map(k => SUBJ_BY_KEY[k].label), ...ev.groupsMissing.map(g => GROUP_LABEL[g] + ' 전체')].join(', ');
  }

  /* ---------- 렌더 ---------- */
  function renderLegend() {
    el.legend.innerHTML = `<span><span class="dot"></span> 반영과목</span><span><span class="band">수학 전체</span> 교과 전체(세부 지정 없음)</span>
      <span>✱ 원자료 별표(일반선택 이수 후 진로·적성에 맞게 이수 권장)</span><span>※ 셀 메모(예: 역사/도덕 포함)</span><span>⚠ 원자료 확인 필요</span>`;
  }
  function renderUnits() {
    const fields = [...new Set(M.units.map(u => u.field))];
    el.units.innerHTML = fields.map(f => `<div class="udm-field"><span class="udm-field-l">${esc(f)}</span>${
      M.units.filter(u => u.field === f).map(u => `<button type="button" class="udm-unit ${u.key === st.unit ? 'on' : ''}" data-udm-unit="${u.key}" aria-pressed="${u.key === st.unit}">${esc(u.label)}<span class="ct">${(byUnit.get(u.key) || []).length}</span></button>`).join('')
    }</div>`).join('');
  }
  function renderTools() {
    el.region.innerHTML = `<option value="">전체 권역</option>` + REGIONS.map(r => `<option value="${r}">${r}</option>`).join('');
    el.region.value = st.region; el.search.value = st.q; el.sort.value = st.sort;
    el.viewSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === st.view));
    el.checkBtn.setAttribute('aria-pressed', st.check ? 'true' : 'false');
    el.sort.querySelector('[value="missing"]').disabled = !st.check;
  }
  function renderHead(recs) {
    const u = UNIT_BY_KEY.get(st.unit);
    let extra = '';
    if (st.check) { const ok = recs.filter(r => evalOf(r).ok).length; extra = ` · 내 과목으로 충족 <b>${ok}</b> / ${recs.length}`; }
    el.head.innerHTML = `<strong>${esc(u.field)} · ${esc(u.label)}</strong><span>${NF.format(recs.length)}개 대학 · 권역 ${esc(st.region || '전체')}${st.q ? ` · "${esc(st.q)}"` : ''}${extra}</span>`;
  }
  function cellsFor(r, ev) {
    let out = '';
    M.groups.forEach(g => {
      const gcols = M.subjects.filter(c => c.group === g.key);
      if (r.groups.includes(g.key)) {
        const gOk = ev ? (r.allSubjects ? ev.ok : !ev.groupsMissing.includes(g.key)) : null;
        const star = r.starAll || gcols.some(c => r.stars.includes(c.key));
        const note = gcols.map(c => r.cellNotes[c.key]).find(Boolean);
        out += `<td colspan="${gcols.length}" class="udm-band ${gOk === null ? '' : gOk ? 'ok' : 'miss'}" title="${esc(g.label)} 교과 전체(세부 과목 지정 없음)${note ? ' · ' + esc(note) : ''}">${esc(g.label)} 전체${star ? '<sup>✱</sup>' : ''}${note ? '<i class="nt">※</i>' : ''}</td>`;
        return;
      }
      gcols.forEach(c => {
        const on = r.marks.includes(c.key);
        const star = on && (r.starAll || r.stars.includes(c.key));
        const note = on ? r.cellNotes[c.key] : null;
        let cls = 'udm-cell' + (on ? ' on' : '');
        if (on && ev) cls += st.mySubs.has(c.key) ? ' ok' : ' miss';
        out += `<td class="${cls}" data-col="${c.key}"${note ? ` title="${esc(note)}"` : ''}>${on ? `<span class="dot"></span><span class="sr">${esc(c.label)} 반영</span>` : ''}${star ? '<sup>✱</sup>' : ''}${note ? '<i class="nt">※</i>' : ''}</td>`;
      });
    });
    return out;
  }
  function uniCell(r, ev) {
    const badge = !ev ? '' : ev.ok ? '<span class="udm-badge ok">충족</span>'
      : `<span class="udm-badge miss" title="부족: ${esc(missingLabel(ev) || '선택한 과목 없음')}">부족 ${ev.missing.length + ev.groupsMissing.length + (r.allSubjects ? 1 : 0)}</span>`;
    return `<button type="button" class="udm-uni-btn" data-udm-link="${r.id}" title="권장과목 원문 보기">${esc(r.university)}</button>${r.warn ? `<span class="udm-warn" title="${esc(r.warn)}">⚠</span>` : ''}${badge}<span class="udm-reg">${esc(r.regionGroup || '권역 미상')}${r.region ? ' · ' + esc(r.region) : ''}</span>`;
  }
  function countLabel(r) { return r.allSubjects ? '전 교과' : `${r.marks.length}과목${r.groups.length ? ` +교과 ${r.groups.length}` : ''}`; }

  function renderTable(recs) {
    const head1 = M.groups.map(g => `<th colspan="${M.subjects.filter(c => c.group === g.key).length}">${esc(g.label)}</th>`).join('');
    const head2 = M.subjects.map(c => `<th data-col="${c.key}"><span class="full">${esc(c.label)}</span><span class="short">${esc(c.short)}</span></th>`).join('');
    const rows = recs.map(r => {
      const ev = evalOf(r);
      return `<tr data-id="${r.id}"><th scope="row" class="udm-uni">${uniCell(r, ev)}</th>${cellsFor(r, ev)}<td class="udm-etc">${r.etc === null ? '' : esc(r.etc || '기타')}</td><td class="udm-cnt">${countLabel(r)}</td></tr>`;
    }).join('');
    const fc = UDM.footerCounts(recs, M.subjects, M.groups), N = recs.length;
    const foot = M.subjects.map(c => {
      const k = fc.marks[c.key], gk = fc.groups[c.group], pct = N ? Math.round(k / N * 100) : 0;
      return `<td class="udm-foot" data-col="${c.key}"><b>${k}</b>${gk ? `<small>+${gk}</small>` : ''}<span class="bar"><i style="width:${pct}%"></i></span></td>`;
    }).join('');
    el.result.innerHTML = `<div class="udm-table-wrap"><div class="udm-table-scroll"><table class="udm-table">
      <thead><tr><th rowspan="2" class="udm-uni-h">대학 <small>${N}개</small></th>${head1}<th rowspan="2">기타</th><th rowspan="2">반영 수</th></tr><tr>${head2}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th scope="row">반영 대학 수 / ${N}<br><small>+n = 교과 전체 지정</small></th>${foot}<td></td><td></td></tr></tfoot></table></div></div>`;
  }
  function renderCards(recs) {
    el.result.innerHTML = `<div class="udm-cards">${recs.map(r => {
      const ev = evalOf(r);
      const chips = M.groups.map(g => {
        if (r.groups.includes(g.key)) return `<span class="udm-chip band ${ev ? ((r.allSubjects ? !ev.ok : ev.groupsMissing.includes(g.key)) ? 'miss' : 'ok') : ''}">${esc(g.label)} 전체${r.starAll ? '✱' : ''}</span>`;
        return M.subjects.filter(c => c.group === g.key && r.marks.includes(c.key)).map(c =>
          `<span class="udm-chip ${ev ? (st.mySubs.has(c.key) ? 'ok' : 'miss') : ''}" ${r.cellNotes[c.key] ? `title="${esc(r.cellNotes[c.key])}"` : ''}><span class="gl">${esc(g.label)}</span>${esc(c.label)}${r.starAll || r.stars.includes(c.key) ? '✱' : ''}</span>`).join('');
      }).join('');
      return `<article class="udm-card"><div class="udm-card-top"><div>${uniCell(r, ev)}</div><span class="udm-cnt">${countLabel(r)}</span></div>
        <div class="udm-chips">${chips || '<span class="small">세부 과목 표시 없음</span>'}${r.etc !== null ? `<span class="udm-chip"><span class="gl">기타</span>${esc(r.etc || '기타')}</span>` : ''}</div></article>`;
    }).join('')}</div>`;
  }
  function renderView() {
    const isUnit = st.view === 'unit';
    el.subject.hidden = isUnit; el.head.hidden = !isUnit; el.result.hidden = !isUnit; el.check.hidden = !(isUnit && st.check);
    if (!isUnit) { if (typeof renderSubjectView === 'function') renderSubjectView(); return; }
    const recs = visibleRecords();
    if (st.check && typeof renderCheck === 'function') renderCheck(recs);
    renderHead(recs);
    if (!recs.length) { el.result.innerHTML = '<div class="empty" style="padding:40px">조건에 맞는 대학이 없습니다.<br>권역을 전체로 바꾸거나 검색어를 지워 보세요.</div>'; return; }
    if (mobile.matches) renderCards(recs); else renderTable(recs);
  }
  function renderAll() { renderLegend(); renderUnits(); renderTools(); renderView(); }

  /* ---------- 이벤트 ---------- */
  let debounceT;
  function bind() {
    paneMatrix.addEventListener('click', e => {
      const u = e.target.closest('[data-udm-unit]');
      if (u) { st.unit = u.dataset.udmUnit; store('udb2028.mUnit', st.unit); renderUnits(); renderView(); return; }
      const v = e.target.closest('[data-view]');
      if (v && el.viewSeg.contains(v)) { st.view = v.dataset.view; renderTools(); renderView(); return; }
      if (e.target.closest('#udmCheckBtn')) { if (typeof toggleCheck === 'function') toggleCheck(); return; }
      const link = e.target.closest('[data-udm-link]');
      if (link) { if (typeof linkToSearch === 'function') linkToSearch(byId.get(link.dataset.udmLink)); return; }
      const go = e.target.closest('[data-udm-goto]');
      if (go) { gotoRecord(go.dataset.udmGoto); return; }
      if (e.target.closest('#udmErrataBtn')) { if (typeof openErrata === 'function') openErrata(); }
    });
    paneMatrix.addEventListener('change', e => {
      if (e.target === el.region) { st.region = el.region.value; renderView(); }
      else if (e.target === el.sort) { st.sort = el.sort.value; renderView(); }
      else if (e.target.matches('[data-udm-sub]') && typeof onSubjectToggle === 'function') onSubjectToggle(e.target);
      else if (e.target.matches('[data-udm-subject], [data-udm-incgroups]') && typeof onSubjectViewChange === 'function') onSubjectViewChange(e.target);
    });
    el.search.addEventListener('input', () => { clearTimeout(debounceT); debounceT = setTimeout(() => { st.q = el.search.value.trim(); renderView(); }, 200); });
    paneMatrix.addEventListener('mouseover', e => {
      const c = e.target.closest('[data-col]'); if (!c) return;
      paneMatrix.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
      paneMatrix.querySelectorAll(`[data-col="${c.dataset.col}"]`).forEach(x => x.classList.add('hl'));
    });
    paneMatrix.addEventListener('mouseleave', () => paneMatrix.querySelectorAll('.hl').forEach(x => x.classList.remove('hl')));
    mobile.addEventListener('change', () => { if (st.tab === 'matrix' && st.view === 'unit') renderView(); });
  }
  function gotoRecord(id) {
    const r = byId.get(id); if (!r) return;
    st.unit = r.unit; st.view = 'unit'; st.region = ''; st.q = '';
    store('udb2028.mUnit', st.unit); renderUnits(); renderTools(); renderView();
    const row = el.result.querySelector(`[data-id="${id}"]`);
    if (row) { row.classList.add('udm-hl'); row.scrollIntoView({ block: 'center' }); setTimeout(() => row.classList.remove('udm-hl'), 2500); }
  }

  /* ---------- 내 이수과목 점검 ---------- */
  function toggleCheck() {
    st.check = !st.check;
    if (st.check) st.sort = 'missing'; else if (st.sort === 'missing') st.sort = 'source';
    renderTools(); renderView();
    if (st.check) el.check.scrollIntoView({ block: 'nearest' });
  }
  function renderCheck(recs) {
    const groupsHtml = M.groups.map(g => `<div class="udm-ck-group"><b>${esc(g.label)}</b>${
      M.subjects.filter(c => c.group === g.key).map(c => `<label class="udb-toggle ${st.mySubs.has(c.key) ? 'on' : ''}"><input type="checkbox" data-udm-sub="${c.key}" ${st.mySubs.has(c.key) ? 'checked' : ''}>${esc(c.label)}</label>`).join('')
    }</div>`).join('');
    const tally = {};
    let ok = 0;
    recs.forEach(r => {
      const ev = UDM.evaluate(r, st.mySubs, SUBJ_BY_GROUP);
      if (ev.ok) { ok++; return; }
      ev.missing.forEach(k => { tally[k] = (tally[k] || 0) + 1; });
      ev.groupsMissing.forEach(g => { tally['g:' + g] = (tally['g:' + g] || 0) + 1; });
    });
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, n]) => `${k.startsWith('g:') ? GROUP_LABEL[k.slice(2)] + ' 전체' : SUBJ_BY_KEY[k].label}(${n})`).join(', ');
    el.check.innerHTML = `<div class="udm-ck-head"><strong>내가 이수했거나 이수할 과목을 체크하세요</strong><span class="small">교과 전체로 안내된 대학은 그 교과에서 1과목 이상 체크하면 충족으로 봅니다(관대한 기준). 기타 열은 판정에 넣지 않습니다.</span></div>
      ${groupsHtml}
      <div class="udm-ck-sum">선택 <b>${st.mySubs.size}</b>과목 → 충족 <b>${ok}</b> / ${recs.length}개 대학${top ? ` · 가장 많이 부족한 과목: ${esc(top)}` : ''}
        <button type="button" class="btn btn-outline" id="udmCheckClear" style="margin-left:8px;padding:.3rem .6rem;font-size:.8rem">모두 해제</button></div>`;
  }
  function onSubjectToggle(input) {
    const k = input.dataset.udmSub;
    if (input.checked) st.mySubs.add(k); else st.mySubs.delete(k);
    store('udb2028.mySubs', JSON.stringify([...st.mySubs]));
    renderView();
  }
  paneMatrix.addEventListener('click', e => {
    if (e.target.closest('#udmCheckClear')) { st.mySubs.clear(); store('udb2028.mySubs', '[]'); renderView(); }
  });

  /* ---------- 과목별 보기(역조회) ---------- */
  function renderSubjectView() {
    const s = SUBJ_BY_KEY[st.subject] || M.subjects[0];
    const opts = M.groups.map(g => `<optgroup label="${esc(g.label)}">${M.subjects.filter(c => c.group === g.key).map(c => `<option value="${c.key}" ${c.key === s.key ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</optgroup>`).join('');
    const rows = M.units.map(u => {
      const recs = byUnit.get(u.key) || [];
      const hit = UDM.subjectCoverage(recs, s.key, s.group, st.includeGroups);
      return { u, recs, hit, pct: recs.length ? Math.round(hit.length / recs.length * 100) : 0 };
    }).sort((a, b) => b.pct - a.pct || b.hit.length - a.hit.length);
    el.subject.innerHTML = `<div class="udm-sv-tools"><label>과목 <select class="udb-mini-select" data-udm-subject aria-label="과목 선택">${opts}</select></label>
        <label class="udb-toggle ${st.includeGroups ? 'on' : ''}"><input type="checkbox" data-udm-incgroups ${st.includeGroups ? 'checked' : ''}>교과 전체 지정 포함</label>
        <span class="small">「${esc(s.label)}」을(를) 반영과목으로 안내한 대학 수 / 모집단위별 대학 수</span></div>
      <div class="udm-sv-list">${rows.map(({ u, recs, hit, pct }) => `<details class="udm-sv-row"><summary><span class="u">${esc(u.field)} · ${esc(u.label)}</span><span class="bar"><i style="width:${pct}%"></i></span><b>${hit.length}</b><span class="n">/ ${recs.length}</span></summary>
        <div class="udm-sv-unis">${hit.map(r => `<button type="button" class="udm-chip link" data-udm-goto="${r.id}">${esc(r.university)}${r.marks.includes(s.key) ? '' : ' <span class="gl">(교과 전체)</span>'}</button>`).join('') || '<span class="small">해당 대학 없음</span>'}</div></details>`).join('')}</div>`;
  }
  function onSubjectViewChange(target) {
    if (target.matches('[data-udm-subject]')) st.subject = target.value;
    else st.includeGroups = target.checked;
    renderSubjectView();
  }

  /* ---------- 부트 ---------- */
  function init() {
    bindTabs();
    if (M) {
      const saved = read('udb2028.mUnit', DEFAULT_UNIT);
      st.unit = UNIT_BY_KEY.has(saved) ? saved : DEFAULT_UNIT;
      try { JSON.parse(read('udb2028.mySubs', '[]')).forEach(k => { if (SUBJ_BY_KEY[k]) st.mySubs.add(k); }); } catch { /* 무시 */ }
      bind();
    }
    const h = location.hash;
    const initial = h === '#univDB-matrix' ? 'matrix' : h === '#univDB' ? 'search'
      : (read('udb2028.tab', 'search') === 'matrix' ? 'matrix' : 'search');
    activateTab(initial, { hash: false });
  }
  init();
})();
