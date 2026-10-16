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
    tab: 'search', view: 'unit', unit: '', univ: '', region: '', q: '', sort: 'name',
    check: false, mySubs: new Set(), subject: 'calc2', includeGroups: true
  };
  let rendered = false;
  let byUnit = new Map(), byUniv = new Map(), byId = new Map(), UNIT_BY_KEY = new Map(), UNIV_LIST = [];
  const SUBJ_BY_GROUP = {}, SUBJ_BY_KEY = {}, GROUP_LABEL = {}, UNIT_ORDER = {};
  if (M) {
    M.units.forEach(u => { UNIT_BY_KEY.set(u.key, u); UNIT_ORDER[u.key] = u.order; });
    byUnit = UDM.indexByUnit(M.records);
    byUniv = UDM.indexByUniversity(M.records, UNIT_ORDER);
    byId = new Map(M.records.map(r => [r.id, r]));
    UNIV_LIST = [...byUniv.keys()].sort(COL.compare);
    M.subjects.forEach(s => { (SUBJ_BY_GROUP[s.group] = SUBJ_BY_GROUP[s.group] || []).push(s.key); SUBJ_BY_KEY[s.key] = s; });
    M.groups.forEach(g => { GROUP_LABEL[g.key] = g.label; });
  }
  const el = {
    tools: $('udmTools'), viewSeg: $('udmViewSeg'), region: $('udmRegion'), search: $('udmSearch'), sort: $('udmSort'),
    checkBtn: $('udmCheckBtn'), unitBox: $('udmUnitBox'), units: $('udmUnits'), univBox: $('udmUnivBox'), univSel: $('udmUnivSel'),
    check: $('udmCheck'), head: $('udmHead'), legend: $('udmLegend'), result: $('udmResult'), subject: $('udmSubject')
  };

  /* ---------- 해시(딥링크) ---------- */
  function matrixHash() {
    if (st.view === 'unit') return UDM.buildHash('matrix', { unit: st.unit });
    if (st.view === 'univ') return UDM.buildHash('matrix', { univ: st.univ });
    return UDM.buildHash('matrix');
  }
  function syncHash() {
    const h = st.tab === 'matrix' ? matrixHash() : '#univDB';
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  function applyHash(p) {
    if (p.unit && UNIT_BY_KEY.has(p.unit)) { st.view = 'unit'; st.unit = p.unit; store('udb2028.mUnit', p.unit); return true; }
    if (p.univ && byUniv.has(p.univ)) { st.view = 'univ'; st.univ = p.univ; return true; }
    return false;
  }

  /* ---------- 탭 ---------- */
  function activateTab(name, opts = {}) {
    st.tab = name; section.dataset.tab = name;
    tabs.forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
    });
    paneSearch.hidden = name !== 'search'; paneMatrix.hidden = name !== 'matrix';
    if (opts.hash !== false) syncHash();
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
      const p = UDM.parseHash(location.hash);
      if (p.tab === 'matrix') {
        // '#univDB-matrix…'는 실제 요소 id가 아니라 브라우저가 스크롤하지 않으므로 직접 섹션으로 이동
        if (M && applyHash(p) && rendered) renderAll();
        activateTab('matrix', { hash: false, scroll: true });
      } else if (p.tab === 'search') activateTab('search', { hash: false });
    });
    // 전공 카드·대학명 진입점은 검색 탭을 먼저 켠다 (기존 함수는 수정하지 않고 감싼다)
    ['udbSearchByMajor', 'udbSearchUniversity'].forEach(fn => {
      const orig = window[fn]; if (typeof orig !== 'function') return;
      window[fn] = function () { activateTab('search'); return orig.apply(this, arguments); };
    });
  }

  /* ---------- 데이터 선택 ---------- */
  const evalOf = r => st.check ? UDM.evaluate(r, st.mySubs, SUBJ_BY_GROUP) : null;
  function missN(r) { const e = UDM.evaluate(r, st.mySubs, SUBJ_BY_GROUP); return e.ok ? 0 : e.na ? 999 : e.missing.length + e.groupsMissing.length + (r.allSubjects ? 1 : 0); }
  function visibleRecords() {
    let rs = (byUnit.get(st.unit) || []).slice();
    if (st.region) rs = rs.filter(r => r.regionGroup === st.region);
    if (st.q) { const q = st.q.toLowerCase(); rs = rs.filter(r => r.university.toLowerCase().includes(q)); }
    const score = r => r.allSubjects ? 99 : r.marks.length + r.groups.length * 3;
    const byName = (a, b) => COL.compare(a.university, b.university);
    if (st.sort === 'source') rs.sort((a, b) => a.srcRow - b.srcRow);
    else if (st.sort === 'count') rs.sort((a, b) => score(b) - score(a) || byName(a, b));
    else if (st.sort === 'region') rs.sort((a, b) => REGIONS.indexOf(a.regionGroup) - REGIONS.indexOf(b.regionGroup) || COL.compare(a.region || '', b.region || '') || byName(a, b));
    else if (st.sort === 'missing' && st.check) rs.sort((a, b) => missN(a) - missN(b) || byName(a, b));
    else rs.sort(byName);
    return rs;
  }
  function missingLabel(ev) {
    return [...ev.missing.map(k => SUBJ_BY_KEY[k].label), ...ev.groupsMissing.map(g => GROUP_LABEL[g] + ' 전체')].join(', ');
  }
  function countLabel(r) {
    if (r.allSubjects) return '전 교과';
    const parts = [];
    if (r.marks.length) parts.push(`${r.marks.length}과목`);
    if (r.groups.length) parts.push(r.groups.map(g => GROUP_LABEL[g]).join('·') + ' 전체');
    return parts.join(' + ') || (r.etc !== null ? '기타만' : '—');
  }
  function badgeHtml(r, ev) {
    if (!ev) return '';
    if (ev.ok) return '<span class="udm-badge ok">충족</span>';
    if (ev.na) return '<span class="udm-badge na" title="국어~과학 15개 과목 중 안내된 과목이 없어(기타 열만) 판정하지 않습니다">판정 없음</span>';
    return `<span class="udm-badge miss">부족 ${ev.missing.length + ev.groupsMissing.length + (r.allSubjects ? 1 : 0)}</span>`;
  }
  function missLine(r, ev) {
    if (!ev || ev.ok || ev.na) return '';
    const t = r.allSubjects && !st.mySubs.size ? '체크한 과목이 없음' : (missingLabel(ev) || '체크한 과목이 없음');
    return `<span class="udm-missl">부족: ${esc(t)}</span>`;
  }

  /* ---------- 공통 렌더 조각 ---------- */
  function renderLegend() {
    el.legend.innerHTML = `<span><span class="dot"></span> 반영과목</span><span><span class="band">수학 전체</span> 교과 전체(세부 지정 없음)</span>
      <span>✱ 원자료 별표(일반선택 이수 후 진로·적성에 맞게 이수 권장)</span><span>※ 셀 메모</span><span>⚠ 원자료 확인 필요</span>
      <span>${M.groups.map(g => `<i class="sw" style="background:var(--g-${g.key})"></i>${esc(g.label)}`).join(' ')}</span>`;
  }
  function uniCell(r, ev) {
    return `<button type="button" class="udm-uni-btn" data-udm-link="${r.id}" title="권장과목 원문 보기">${esc(r.university)}</button>${r.warn ? `<span class="udm-warn" title="${esc(r.warn)}">⚠</span>` : ''}${badgeHtml(r, ev)}<span class="udm-reg">${esc(r.regionGroup || '권역 미상')}${r.region ? ' · ' + esc(r.region) : ''}</span>${missLine(r, ev)}`;
  }
  function unitCell(r, ev) {
    const u = UNIT_BY_KEY.get(r.unit);
    return `<button type="button" class="udm-uni-btn" data-udm-goto="${r.id}" title="이 모집단위 매트릭스로 이동">${esc(u.label)}</button>${r.warn ? `<span class="udm-warn" title="${esc(r.warn)}">⚠</span>` : ''}${badgeHtml(r, ev)}<span class="udm-reg">${esc(u.field)} 계열</span>${missLine(r, ev)}`;
  }
  function cellsFor(r, ev) {
    let out = '';
    M.groups.forEach(g => {
      const gcols = M.subjects.filter(c => c.group === g.key);
      if (r.groups.includes(g.key)) {
        const gOk = ev ? (r.allSubjects ? ev.ok : !ev.groupsMissing.includes(g.key)) : null;
        const star = r.starAll || gcols.some(c => r.stars.includes(c.key));
        const note = gcols.map(c => r.cellNotes[c.key]).find(Boolean);
        out += `<td colspan="${gcols.length}" class="udm-band gb ${gOk === null ? '' : gOk ? 'ok' : 'miss'}" data-g="${g.key}" title="${esc(g.label)} 교과 전체(세부 과목 지정 없음)${note ? ' · ' + esc(note) : ''}">${esc(g.label)} 전체${star ? '<sup>✱</sup>' : ''}${note ? '<i class="nt">※</i>' : ''}</td>`;
        return;
      }
      gcols.forEach((c, i) => {
        const on = r.marks.includes(c.key);
        const star = on && (r.starAll || r.stars.includes(c.key));
        const note = on ? r.cellNotes[c.key] : null;
        let cls = 'udm-cell' + (on ? ' on' : '') + (i === 0 ? ' gb' : '');
        if (on && ev) cls += st.mySubs.has(c.key) ? ' ok' : ' miss';
        out += `<td class="${cls}" data-col="${c.key}" data-g="${g.key}"${note ? ` title="${esc(note)}"` : ''}>${on ? `<span class="dot"></span><span class="sr">${esc(c.label)} 반영</span>` : ''}${star ? '<sup>✱</sup>' : ''}${note ? '<i class="nt">※</i>' : ''}</td>`;
      });
    });
    return out;
  }
  function tableHead(firstLabel) {
    const head1 = M.groups.map(g => `<th colspan="${M.subjects.filter(c => c.group === g.key).length}" class="gh gb" data-g="${g.key}" style="--gc:var(--g-${g.key})">${esc(g.label)}</th>`).join('');
    const head2 = M.subjects.map((c, i, arr) => `<th data-col="${c.key}" data-g="${c.group}" class="${(i === 0 || arr[i - 1].group !== c.group) ? 'gb' : ''}${st.check && st.mySubs.has(c.key) ? ' chk' : ''}"><span class="full">${esc(c.label)}</span><span class="short">${esc(c.short)}</span></th>`).join('');
    return `<thead><tr><th rowspan="2" class="udm-rh-h">${firstLabel}</th>${head1}<th rowspan="2" class="gb">기타</th><th rowspan="2">반영 과목</th></tr><tr>${head2}</tr></thead>`;
  }
  function tableFoot(recs) {
    const fc = UDM.footerCounts(recs, M.subjects, M.groups), N = recs.length;
    const cells = M.subjects.map((c, i, arr) => {
      const k = fc.marks[c.key], gk = fc.groups[c.group], pe = N ? Math.round(k / N * 100) : 0, pg = N ? Math.round(gk / N * 100) : 0;
      return `<td class="udm-foot ${(i === 0 || arr[i - 1].group !== c.group) ? 'gb' : ''}" data-col="${c.key}" data-g="${c.group}" title="${esc(c.label)}: 세부 지정 ${k}개 대학 + 교과 전체 ${gk}개 대학"><b>${k + gk}</b><small>${gk ? `세부 ${k} · 전체 ${gk}` : `세부 ${k}`}</small><span class="bar"><i class="e" style="width:${pe}%"></i><i class="g" style="width:${pg}%"></i></span></td>`;
    }).join('');
    return `<tfoot><tr><th scope="row">반영 대학 수 / ${N}<br><small>파랑 = 세부 지정 · 보라 = 교과 전체</small></th>${cells}<td class="gb"></td><td></td></tr></tfoot>`;
  }
  function renderTable(recs, mode) {
    const rows = recs.map(r => {
      const ev = evalOf(r);
      return `<tr data-id="${r.id}"><th scope="row" class="udm-rh">${mode === 'univ' ? unitCell(r, ev) : uniCell(r, ev)}</th>${cellsFor(r, ev)}<td class="udm-etc gb">${r.etc === null ? '' : esc(r.etc || '기타')}</td><td class="udm-cnt">${countLabel(r)}</td></tr>`;
    }).join('');
    el.result.innerHTML = `<div class="udm-table-wrap"><div class="udm-table-scroll"><table class="udm-table">${tableHead(mode === 'univ' ? `모집단위 <small>${recs.length}개</small>` : `대학 <small>${recs.length}개</small>`)}<tbody>${rows}</tbody>${mode === 'univ' ? '' : tableFoot(recs)}</table></div></div>`;
  }
  function cardGroups(r, ev) {
    return M.groups.map(g => {
      const gcols = M.subjects.filter(c => c.group === g.key);
      let chips = '';
      if (r.groups.includes(g.key)) {
        const gOk = ev ? (r.allSubjects ? ev.ok : !ev.groupsMissing.includes(g.key)) : null;
        chips = `<span class="udm-chip band ${gOk === null ? '' : gOk ? 'ok' : 'miss'}">${esc(g.label)} 전체${r.starAll ? '✱' : ''}</span>`;
      } else {
        chips = gcols.filter(c => r.marks.includes(c.key)).map(c =>
          `<span class="udm-chip ${ev ? (st.mySubs.has(c.key) ? 'ok' : 'miss') : ''}"${r.cellNotes[c.key] ? ` title="${esc(r.cellNotes[c.key])}"` : ''}>${esc(c.label)}${r.starAll || r.stars.includes(c.key) ? '✱' : ''}</span>`).join('');
      }
      if (!chips) return '';
      return `<div class="udm-cg" style="--gc:var(--g-${g.key})">${gcols.length > 1 ? `<span class="cgl">${esc(g.label)}</span>` : ''}${chips}</div>`;
    }).join('');
  }
  function renderCards(recs, mode) {
    el.result.innerHTML = `<div class="udm-cards">${recs.map(r => {
      const ev = evalOf(r);
      const groups = cardGroups(r, ev);
      return `<article class="udm-card" data-id="${r.id}"><div class="udm-card-top"><div>${mode === 'univ' ? unitCell(r, ev) : uniCell(r, ev)}</div><span class="udm-cnt">${countLabel(r)}</span></div>
        <div class="udm-cgs">${groups || '<span class="small">국어~과학 세부 과목 표시 없음</span>'}${r.etc !== null ? `<div class="udm-cg"><span class="cgl" style="color:#713f12">기타</span><span class="udm-chip">${esc(r.etc || '원자료 표기')}</span></div>` : ''}</div></article>`;
    }).join('')}</div>`;
  }

  /* ---------- 뷰별 렌더 ---------- */
  function renderUnits() {
    const fields = [...new Set(M.units.map(u => u.field))];
    el.units.innerHTML = fields.map(f => `<div class="udm-field"><span class="udm-field-l">${esc(f)}</span>${
      M.units.filter(u => u.field === f).map(u => `<button type="button" class="udm-unit ${u.key === st.unit ? 'on' : ''}" data-udm-unit="${u.key}" aria-pressed="${u.key === st.unit}">${esc(u.label)}<span class="ct">${(byUnit.get(u.key) || []).length}</span></button>`).join('')
    }</div>`).join('');
  }
  function renderUnivSel() {
    el.univSel.innerHTML = UNIV_LIST.map(u => `<option value="${esc(u)}" ${u === st.univ ? 'selected' : ''}>${esc(u)} (${byUniv.get(u).length})</option>`).join('');
  }
  function renderTools() {
    el.tools.dataset.view = st.view;
    el.viewSeg.querySelectorAll('button').forEach(b => { const on = b.dataset.view === st.view; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    el.region.innerHTML = `<option value="">전체 권역</option>` + REGIONS.map(r => `<option value="${r}">${r}</option>`).join('');
    el.region.value = st.region; el.search.value = st.q; el.sort.value = st.sort;
    el.checkBtn.setAttribute('aria-pressed', st.check ? 'true' : 'false');
    el.sort.querySelector('[value="missing"]').disabled = !st.check;
    el.unitBox.hidden = st.view !== 'unit'; el.univBox.hidden = st.view !== 'univ';
  }
  function headHtml(title, sub) {
    return `<div class="ht"><strong>${title}</strong><span>${sub}</span></div><div class="hb"><button class="btn btn-outline" type="button" id="udmCopyLink" title="현재 보기로 바로 오는 주소를 복사합니다">🔗 링크 복사</button></div>`;
  }
  function checkSummary(recs) {
    if (!st.check) return '';
    const ok = recs.filter(r => evalOf(r).ok).length;
    return ` · 내 과목으로 충족 <b>${ok}</b> / ${recs.length}`;
  }
  function renderUnitView() {
    const recs = visibleRecords();
    const u = UNIT_BY_KEY.get(st.unit);
    if (st.check) renderCheck(recs);
    el.head.innerHTML = headHtml(`${esc(u.field)} · ${esc(u.label)}`, `${NF.format(recs.length)}개 대학 · 권역 ${esc(st.region || '전체')}${st.q ? ` · "${esc(st.q)}"` : ''}${checkSummary(recs)}`);
    if (!recs.length) { el.result.innerHTML = '<div class="empty" style="padding:40px">조건에 맞는 대학이 없습니다.<br>권역을 전체로 바꾸거나 검색어를 지워 보세요.</div>'; return; }
    if (mobile.matches) renderCards(recs, 'unit'); else renderTable(recs, 'unit');
  }
  function renderUnivView() {
    if (!byUniv.has(st.univ)) st.univ = UNIV_LIST[0];
    renderUnivSel();
    const recs = byUniv.get(st.univ) || [];
    const r0 = recs[0];
    if (st.check) renderCheck(recs);
    el.head.innerHTML = headHtml(esc(st.univ), `${recs.length}개 대표 모집단위 · ${esc(r0?.regionGroup || '권역 미상')}${r0?.region ? ' · ' + esc(r0.region) : ''}${r0 && !r0.universityKey ? ' · 권장과목 원문 자료 없음' : ''}${checkSummary(recs)}`);
    if (mobile.matches) renderCards(recs, 'univ'); else renderTable(recs, 'univ');
  }
  function renderView() {
    const v = st.view;
    el.subject.hidden = v !== 'subject';
    el.head.hidden = v === 'subject'; el.legend.hidden = v === 'subject'; el.result.hidden = v === 'subject';
    el.check.hidden = !(st.check && v !== 'subject');
    renderTools();
    if (v === 'subject') renderSubjectView();
    else if (v === 'univ') renderUnivView();
    else renderUnitView();
  }
  function renderAll() {
    $('udmStatUnits').textContent = NF.format(M.units.length);
    $('udmStatUnivs').textContent = NF.format(UNIV_LIST.length);
    $('udmStatRecords').textContent = NF.format(M.meta.records);
    $('udmStatErrata').textContent = NF.format(M.errata.length);
    renderLegend(); renderUnits(); renderView();
  }

  /* ---------- 내 이수과목 점검 ---------- */
  function toggleCheck() {
    st.check = !st.check;
    if (st.check) st.sort = 'missing'; else if (st.sort === 'missing') st.sort = 'name';
    renderView();
    if (st.check) el.check.scrollIntoView({ block: 'nearest' });
  }
  function renderCheck(recs) {
    const groupsHtml = M.groups.map(g => {
      const keys = SUBJ_BY_GROUP[g.key];
      const allOn = keys.every(k => st.mySubs.has(k));
      return `<div class="udm-ck-group" style="--gc:var(--g-${g.key})"><b>${esc(g.label)}</b>${
        M.subjects.filter(c => c.group === g.key).map(c => `<label class="udb-toggle ${st.mySubs.has(c.key) ? 'on' : ''}"><input type="checkbox" data-udm-sub="${c.key}" ${st.mySubs.has(c.key) ? 'checked' : ''}>${esc(c.label)}</label>`).join('')
      }${keys.length > 1 ? `<button type="button" class="udm-ck-quick" data-udm-selgroup="${g.key}">${allOn ? `${esc(g.label)} 모두 해제` : `${esc(g.label)} 모두 선택`}</button>` : ''}</div>`;
    }).join('');
    const tally = {};
    let ok = 0, na = 0;
    recs.forEach(r => {
      const ev = UDM.evaluate(r, st.mySubs, SUBJ_BY_GROUP);
      if (ev.ok) { ok++; return; }
      if (ev.na) { na++; return; }
      ev.missing.forEach(k => { tally[k] = (tally[k] || 0) + 1; });
      ev.groupsMissing.forEach(g => { tally['g:' + g] = (tally['g:' + g] || 0) + 1; });
    });
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, n]) => `${k.startsWith('g:') ? GROUP_LABEL[k.slice(2)] + ' 전체' : SUBJ_BY_KEY[k].label}(${n})`).join(', ');
    el.check.innerHTML = `<div class="udm-ck-head"><strong>내가 이수했거나 이수할 과목을 체크하세요</strong><span class="small">체크한 과목은 표 머리글에 ✓로 표시됩니다. 교과 전체로 안내된 대학은 그 교과에서 1과목 이상 체크하면 충족으로 봅니다(관대한 기준). 기타 열은 판정에 넣지 않습니다.</span></div>
      ${groupsHtml}
      <div class="udm-ck-sum"><span>선택 <b>${st.mySubs.size}</b>과목 → 충족 <b>${ok}</b> / ${recs.length}${na ? ` (판정 없음 ${na})` : ''}</span>${top ? `<span>· 가장 많이 부족한 과목: ${esc(top)}</span>` : ''}
        <button type="button" class="btn btn-outline" id="udmCheckClear" style="padding:.3rem .6rem;font-size:.8rem">모두 해제</button></div>`;
  }
  function setSubs(keys, on) {
    keys.forEach(k => { if (on) st.mySubs.add(k); else st.mySubs.delete(k); });
    store('udb2028.mySubs', JSON.stringify([...st.mySubs]));
    renderView();
  }

  /* ---------- 과목별 보기(역조회) ---------- */
  function renderSubjectView() {
    const s = SUBJ_BY_KEY[st.subject] || M.subjects[0];
    const opts = M.groups.map(g => `<optgroup label="${esc(g.label)}">${M.subjects.filter(c => c.group === g.key).map(c => `<option value="${c.key}" ${c.key === s.key ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</optgroup>`).join('');
    const rows = M.units.map(u => {
      const recs = byUnit.get(u.key) || [];
      const sp = UDM.coverageSplit(recs, s.key, s.group);
      const total = st.includeGroups ? sp.total : sp.explicit;
      const hit = UDM.subjectCoverage(recs, s.key, s.group, st.includeGroups);
      return { u, recs, sp, total, hit, pct: recs.length ? Math.round(total / recs.length * 100) : 0 };
    }).sort((a, b) => b.pct - a.pct || b.total - a.total);
    el.subject.innerHTML = `<div class="udm-sv-tools"><label>과목 <select class="udb-mini-select" data-udm-subject aria-label="과목 선택">${opts}</select></label>
        <label class="udb-toggle ${st.includeGroups ? 'on' : ''}"><input type="checkbox" data-udm-incgroups ${st.includeGroups ? 'checked' : ''}>교과 전체 지정 포함</label>
        <span class="small">「${esc(s.label)}」을(를) 반영과목으로 안내한 대학 수 / 모집단위별 대학 수 · 파랑 = 세부 지정, 보라 = 교과 전체 · 모집단위 이름을 누르면 표로 이동</span></div>
      <div class="udm-sv-list">${rows.map(({ u, recs, sp, total, hit, pct }) => {
        const pe = recs.length ? Math.round(sp.explicit / recs.length * 100) : 0, pg = st.includeGroups && recs.length ? Math.round(sp.viaGroup / recs.length * 100) : 0;
        return `<details class="udm-sv-row"><summary><span class="u"><button type="button" class="udm-linkbtn" data-udm-unit-go="${u.key}">${esc(u.field)} · ${esc(u.label)}</button></span><span class="bar"><i class="e" style="width:${pe}%"></i><i class="g" style="width:${pg}%"></i></span><b>${total}</b><span class="n">/ ${recs.length}</span><small>세부 ${sp.explicit}${st.includeGroups ? ` · 전체 ${sp.viaGroup}` : ''}</small></summary>
        <div class="udm-sv-unis">${hit.map(r => `<button type="button" class="udm-chip link" data-udm-goto="${r.id}">${esc(r.university)}${r.marks.includes(s.key) ? '' : ' <span class="gl">(교과 전체)</span>'}</button>`).join('') || '<span class="small">해당 대학 없음</span>'}</div></details>`;
      }).join('')}</div>`;
  }

  /* ---------- 이동·연결 ---------- */
  function gotoUnit(key) {
    if (!UNIT_BY_KEY.has(key)) return;
    st.unit = key; st.view = 'unit'; st.region = ''; st.q = '';
    store('udb2028.mUnit', key); renderUnits(); renderView(); syncHash();
    el.head.scrollIntoView({ block: 'start' });
  }
  function gotoRecord(id) {
    const r = byId.get(id); if (!r) return;
    gotoUnit(r.unit);
    const row = el.result.querySelector(`[data-id="${id}"]`);
    if (row) { row.classList.add('udm-hl'); row.scrollIntoView({ block: 'center' }); setTimeout(() => row.classList.remove('udm-hl'), 2500); }
  }
  function toast(msg) {
    let t = $('udmToast');
    if (!t) { t = document.createElement('div'); t.id = 'udmToast'; t.className = 'udm-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }
  function linkToSearch(r) {
    if (!r) return;
    if (!r.universityKey) { toast(`${r.university}: 권장과목 원문 자료에 없는 대학입니다.`); return; }
    const kws = M.unitLinks[r.unit] || [];
    const hits = UDM.matchUnitRecords(FILE1, r.universityKey, kws);
    if (hits.length === 1 && typeof window.udbOpenRecord === 'function') { window.udbOpenRecord(hits[0].id); return; }
    activateTab('search', { scroll: true });
    if (typeof window.udbFilterUniversity === 'function') window.udbFilterUniversity(r.universityKey, UDM.pickKeyword(hits, kws));
    if (!hits.length) toast(`${r.university}: 모집단위 단위 자료가 없어 대학 전체를 표시합니다.`);
  }
  function univToSearch() {
    const r0 = (byUniv.get(st.univ) || [])[0];
    if (!r0 || !r0.universityKey) { toast(`${st.univ}: 권장과목 원문 자료에 없는 대학입니다.`); return; }
    activateTab('search', { scroll: true });
    if (typeof window.udbFilterUniversity === 'function') window.udbFilterUniversity(r0.universityKey, '');
  }
  function copyLink() {
    syncHash();
    const url = location.origin + location.pathname + location.search + matrixHash();
    const done = () => toast('현재 보기 링크를 복사했습니다.');
    const fail = () => window.prompt('아래 주소를 복사하세요', url);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fail); else fail();
  }

  /* ---------- 정오표·해석 규칙 ---------- */
  function openModal(headHtml, bodyHtml) {
    $('modalHead').innerHTML = headHtml; $('modalBody').innerHTML = bodyHtml;
    $('modalBackdrop').classList.add('open');
  }
  function openErrata() {
    const unitLabel = k => k.split('/').map(x => (UNIT_BY_KEY.get(x) || { label: x }).label).join('/');
    const head = `<div class="badge-row"><span class="badge">전공별 반영과목 매트릭스</span><span class="badge purple">정오표 · 해석 규칙</span></div>
      <h3 id="modalTitle">정오표와 셀 해석 규칙</h3>
      <p class="small">출처: ${esc(M.meta.source)} · 정리 ${esc(M.meta.built)} · 원자료 ${M.meta.sourceRows}행 → ${M.meta.records}건. 대학이 공개한 안내를 정리한 참고 자료이며, 정확한 반영 기준과 최신 변경 사항은 각 대학 입학처 모집요강을 반드시 확인하세요.</p>`;
    const rules = `<div class="detail-box wide"><h4>셀 해석 규칙</h4><ul class="udm-rules">
      <li><b>●</b> 세부과목 열에 대학명이 있으면 그 과목을 반영과목으로 안내한 것입니다.</li>
      <li><b>교과 전체 띠</b> 원자료에서 수학(5열)·사회(4열)·과학(4열) 범위가 통째로 병합된 경우로, 세부 과목을 지정하지 않고 교과 전체를 안내한 것입니다.</li>
      <li><b>부분 병합</b>(예: 물리학·화학·생명과학 3열)은 병합이 덮는 과목 각각을 반영한 것으로 봅니다.</li>
      <li><b>전 교과</b> 한 행 전체가 병합된 대학(한라대)은 국어·수학·영어·사회·과학 교과 전체로 봅니다.</li>
      <li><b>✱</b> 원자료의 별표. 안내문 기준 "학과 특성에 따라 일반 선택 과목 이수 후 진로와 적성에 맞게 과목 이수 권장" 대학이며, 별표가 특정 셀에만 있으면 그 셀에만 표시합니다.</li>
      <li><b>※</b> 셀 메모(예: 역사/도덕 포함). 마우스를 올리면 내용이 보입니다.</li>
      <li><b>기타</b> 열은 자유 서술(제2외/한문, 미술 등)이라 점검 판정에 넣지 않으며, 기타만 안내된 행은 "판정 없음"으로 둡니다.</li>
      <li><b>내 이수과목 점검</b>은 ● 과목이 모두 체크되면 충족, 교과 전체 띠는 그 교과에서 1과목 이상 체크되면 충족으로 보는 관대한 기준입니다.</li>
      <li><b>푸터 "반영 대학 수"</b>는 세부 지정 대학 수(파랑)와 교과 전체 지정 대학 수(보라)를 합한 값입니다.</li></ul></div>`;
    const table = `<div class="detail-box wide"><h4>정오표 (${M.errata.length}건)</h4>
      <div class="udb-table-wrap" style="box-shadow:none"><div class="udb-table-scroll"><table class="udb-table" style="min-width:760px"><thead><tr><th>#</th><th>원자료 행</th><th>모집단위</th><th>문제</th><th>조치</th><th>근거</th></tr></thead>
      <tbody>${M.errata.map(e => `<tr><td>${esc(e.id)}</td><td>${esc(e.rows.length > 4 ? `${e.rows[0]}–${e.rows[e.rows.length - 1]}` : e.rows.join(', '))}</td><td>${esc(unitLabel(e.unit))}</td><td>${esc(e.issue)}</td><td>${esc(e.action)}</td><td>${esc(e.basis)}</td></tr>`).join('')}</tbody></table></div></div>
      <p class="small" style="margin-top:8px">제외된 행(E4)의 원문은 빌드 JSON의 <code>raw</code>에 보존되어 있습니다.</p></div>`;
    openModal(head, `<div class="detail-grid">${rules}${table}</div>`);
  }

  /* ---------- 이벤트 ---------- */
  let debounceT;
  function bind() {
    paneMatrix.addEventListener('click', e => {
      const u = e.target.closest('[data-udm-unit]');
      if (u) { st.unit = u.dataset.udmUnit; store('udb2028.mUnit', st.unit); renderUnits(); renderView(); syncHash(); return; }
      const v = e.target.closest('[data-view]');
      if (v && el.viewSeg.contains(v)) { st.view = v.dataset.view; renderView(); syncHash(); return; }
      if (e.target.closest('#udmCheckBtn')) { toggleCheck(); return; }
      if (e.target.closest('#udmCheckClear')) { setSubs([...st.mySubs], false); return; }
      const sg = e.target.closest('[data-udm-selgroup]');
      if (sg) { const keys = SUBJ_BY_GROUP[sg.dataset.udmSelgroup]; setSubs(keys, !keys.every(k => st.mySubs.has(k))); return; }
      const link = e.target.closest('[data-udm-link]');
      if (link) { linkToSearch(byId.get(link.dataset.udmLink)); return; }
      const go = e.target.closest('[data-udm-goto]');
      if (go) { gotoRecord(go.dataset.udmGoto); return; }
      const ug = e.target.closest('[data-udm-unit-go]');
      if (ug) { gotoUnit(ug.dataset.udmUnitGo); return; }
      if (e.target.closest('#udmErrataBtn')) { openErrata(); return; }
      if (e.target.closest('#udmCopyLink')) { copyLink(); return; }
      if (e.target.closest('#udmUnivOrig')) { univToSearch(); }
    });
    paneMatrix.addEventListener('change', e => {
      if (e.target === el.region) { st.region = el.region.value; renderView(); }
      else if (e.target === el.sort) { st.sort = el.sort.value; renderView(); }
      else if (e.target === el.univSel) { st.univ = el.univSel.value; renderView(); syncHash(); }
      else if (e.target.matches('[data-udm-sub]')) setSubs([e.target.dataset.udmSub], e.target.checked);
      else if (e.target.matches('[data-udm-subject]')) { st.subject = e.target.value; renderSubjectView(); }
      else if (e.target.matches('[data-udm-incgroups]')) { st.includeGroups = e.target.checked; renderSubjectView(); }
    });
    el.search.addEventListener('input', () => { clearTimeout(debounceT); debounceT = setTimeout(() => { st.q = el.search.value.trim(); renderView(); }, 200); });
    paneMatrix.addEventListener('mouseover', e => {
      const c = e.target.closest('[data-col]'); if (!c) return;
      paneMatrix.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
      paneMatrix.querySelectorAll(`[data-col="${c.dataset.col}"]`).forEach(x => x.classList.add('hl'));
    });
    paneMatrix.addEventListener('mouseleave', () => paneMatrix.querySelectorAll('.hl').forEach(x => x.classList.remove('hl')));
    mobile.addEventListener('change', () => { if (st.tab === 'matrix' && st.view !== 'subject') renderView(); });
  }

  /* ---------- 부트 ---------- */
  function init() {
    bindTabs();
    const p = UDM.parseHash(location.hash);
    if (M) {
      const saved = read('udb2028.mUnit', DEFAULT_UNIT);
      st.unit = UNIT_BY_KEY.has(saved) ? saved : DEFAULT_UNIT;
      st.univ = UNIV_LIST[0] || '';
      try { JSON.parse(read('udb2028.mySubs', '[]')).forEach(k => { if (SUBJ_BY_KEY[k]) st.mySubs.add(k); }); } catch { /* 무시 */ }
      applyHash(p);
      bind();
    }
    const initial = p.tab || (read('udb2028.tab', 'search') === 'matrix' ? 'matrix' : 'search');
    // 딥링크로 들어온 경우 섹션까지 스크롤 (요소 id가 없어 브라우저가 대신 해 주지 않음)
    activateTab(initial, { hash: false, scroll: p.tab === 'matrix' });
  }
  init();
})();
