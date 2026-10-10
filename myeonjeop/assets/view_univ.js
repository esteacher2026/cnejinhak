/* 2단계 내 대학 알아보기: 대학이 밝힌 것 + 선배들이 겪은 것 */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;
  var SITE = "https://jinhak.esteacher.kr/";

  function findU(name) { return MJ.data.univ.list.filter(function (u) { return u.k === name; })[0]; }
  function rangeText(d) { return d.map(function (r) { return MJ.fmtDate(r[0]) + (r[1] !== r[0] ? "~" + MJ.fmtDate(r[1]) : ""); }).join(", "); }

  var SPECIAL = /기회균형|농어촌|특성화|특수교육|저소득|기초생활|차상위|재외|북한|장애|보훈|국가유공|만학|서해|정원외|계약학과|위탁|성인|재직|고른기회|사회배려|사회통합|다문화|군인|선취업/;
  function schedule(u, st) {
    if (!u || !u.adms.length) return '<p class="mute">2027학년도 수시 면접 일정 자료에 이 대학의 학생부 위주 면접 전형이 없습니다. 모집요강을 확인하세요.</p>';
    function row(a, i) {
      var gap = a.s1 ? MJ.dayDiff(MJ.parseDate(a.d[0][0]), MJ.parseDate(a.s1)) : null;
      var saved = st.targets.some(function (t) { return t.univ === u.k && t.adm === a.n; });
      return ["<b>" + esc(a.s || a.n) + '</b> <span class="tag teal">' + esc(a.t) + "</span>",
        rangeText(a.d) + (a.d.length > 1 ? ' <span class="mute small">(모집단위에 따라 다름)</span>' : ""),
        a.s1 ? '<span style="white-space:nowrap">' + MJ.fmtDate(a.s1) + '</span> <span class="' + (gap <= 4 ? "tag warn" : "mute small") + '" style="white-space:nowrap">면접까지 ' + gap + "일</span>" : '<span class="mute small" style="white-space:nowrap">모집요강 확인</span>',
        saved ? '<span class="tag ok">담김</span>' : '<button class="btn sm" data-act="keep" data-i="' + i + '">내 면접에 담기</button>'];
    }
    var head = ["전형", "면접일", "1단계 발표", ""];
    var gen = [], spe = [];
    u.adms.forEach(function (a, i) { (SPECIAL.test(a.n) ? spe : gen).push(row(a, i)); });
    if (!gen.length) { gen = spe; spe = []; }
    var h = MJ.table(head, gen);
    if (spe.length) h += '<details class="acc" style="margin-top:8px"><summary>기회균형·농어촌 등 특별전형 ' + spe.length + '개 더 보기</summary><div class="acc-body">' + MJ.table(head, spe) + "</div></details>";
    return h + '<p class="src">1단계 발표일은 자료에서 확인된 경우만 표시했습니다. 날짜는 반드시 입학처 공지로 다시 확인하세요.</p>';
  }

  /* 대학이 가이드북에서 밝힌 면접 개요 */
  function guideHtml(G, name) {
    var L = (G && G.univ[name]) || [], n = (G && G.count && G.count[name]) || 0;
    if (!L.length && !n) return "";
    var link = n ? '<div class="row" style="margin-bottom:10px"><a class="btn sm primary" href="#/questions?tab=guide&u=' + encodeURIComponent(name) + '">이 대학이 공개한 면접 질문 ' + n + "개 보기</a></div>" : "";
    return L.map(function (o) { return guideBlock(G, name, o); }).join("") + link;
  }
  function guideBlock(G, name, o) {
    var h = '<div class="card flat guidebox" style="margin-bottom:10px"><h3>' + (o.src ? "선행학습 영향평가 보고서" : "대학 가이드북") + '에서 밝힌 면접</h3><table class="t" style="margin:6px 0 10px"><tbody>' +
      (o.adms.length ? "<tr><th>면접 전형</th><td>" + esc(o.adms.join(", ")) + "</td></tr>" : "") +
      (o.format ? "<tr><th>진행 방식</th><td>" + esc(o.format) + "</td></tr>" : "") +
      (o.factors.length ? "<tr><th>평가요소</th><td>" + esc(o.factors.join(", ")) + "</td></tr>" : "") + "</tbody></table>";
    if (o.notes.length) h += "<ul class=\"small\">" + o.notes.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    if (!o.n) h += '<p class="small mute" style="margin:0">이 ' + (o.src ? "보고서" : "가이드북") + "에는 학생부 기반 면접 질문이 실려 있지 않습니다.</p>";
    return h + "</div>";
  }

  function ratioBar(fs) {
    var sum = 0, parts = {};
    fs.forEach(function (f) { if (f.v) { sum += f.v; var k = f.s || "기타"; parts[k] = (parts[k] || 0) + f.v; } });
    if (!sum) return "";
    var keys = Object.keys(parts);
    return '<div class="ratio">' + keys.map(function (k) { return '<i class="' + esc(k) + '" style="width:' + (parts[k] / sum * 100).toFixed(1) + '%"></i>'; }).join("") + '</div><div class="legend">' +
      keys.map(function (k) { return '<span><i class="ratio ' + k + '" style="display:inline-block;margin:0 4px 0 0;width:9px;height:9px;border-radius:3px;vertical-align:0;background:' + colorOf(k) + '"></i>' + (MJ.FACTORS[k] || "기타") + " " + Math.round(parts[k] / sum * 100) + "%</span>"; }).join("") + "</div>";
  }
  function colorOf(k) { return { "학업": "var(--f-hak)", "진로": "var(--f-jin)", "공동체": "var(--f-gong)", "소통": "var(--f-so)", "신뢰": "var(--f-sin)" }[k] || "#94a3b8"; }

  function officialHtml(o, uname) {
    if (!o) return '<div class="empty"><b>공식 면접평가 안내 자료가 없습니다</b>대입정보포털 어디가에 면접평가 안내가 실린 대학만 표시됩니다. 모집요강의 면접 안내를 직접 확인하세요.</div>';
    if (!o.blocks.length) return '<div class="empty"><b>' + esc(o.status || "면접 없음") + "</b>학생부종합전형 면접평가 안내에 면접이 없는 것으로 나와 있습니다.</div>";
    var h = "";
    o.blocks.forEach(function (b, bi) {
      var out = /제시문|MMI|다중미니|인적성/.test(b.src + " " + b.proc);
      var pct = b.f.reduce(function (s, f) { return s + (f.v || 0); }, 0);
      h += '<div class="card flat" style="margin-bottom:10px"><h3>' + esc(b.adm) + (b.campus ? ' <span class="tag">' + esc(b.campus) + "</span>" : "") + (b.sp ? ' <span class="tag">특별전형</span>' : "") + "</h3>";
      h += '<table class="t" style="margin:6px 0 10px"><tbody>' +
        (b.proc ? "<tr><th>진행 방법</th><td>" + esc(b.proc) + "</td></tr>" : "") + (b.time ? "<tr><th>면접 시간</th><td>" + esc(b.time) + "</td></tr>" : "") + (b.src ? "<tr><th>면접 자료</th><td>" + esc(b.src) + "</td></tr>" : "") + "</tbody></table>";
      if (out) h += '<div class="callout warn small"><b class="t">제시문 면접이 포함된 전형입니다</b>제시문을 읽고 답하는 부분은 이 안내서가 다루지 않습니다. 학생부를 확인하는 부분만 이곳에서 준비하세요.</div>';
      if (b.f.length) {
        h += ratioBar(b.f);
        if (pct && (pct < 95 || pct > 105)) h += '<p class="src">반영값이 배점으로 제시된 대학입니다. 막대는 합계를 100으로 환산한 비율입니다.</p>';
        h += '<div style="margin-top:8px">' + b.f.map(function (f) {
          return '<div class="factor-row"><div><b>' + esc(f.n) + "</b> " + MJ.factorTag(f.s) + (f.i ? '<div class="items">' + esc(f.i) + "</div>" : "") + "</div><div><b>" + (f.v != null ? esc(String(f.v)) : "") + "</b></div></div>";
        }).join("") + "</div>";
      }
      var qs = [];
      b.f.forEach(function (f) { (f.q || []).forEach(function (q) { qs.push({ t: q, s: f.s }); }); });
      (b.q || []).forEach(function (q) { qs.push({ t: q, s: "" }); });
      if (qs.length) {
        h += '<details class="acc" style="margin-top:12px"><summary>대학이 공개한 예시 문항 ' + qs.length + '개</summary><div class="acc-body"><div class="qlist">' +
          qs.map(function (q, qi) { return '<div class="qline"><span>' + esc(q.t) + " " + MJ.factorTag(q.s) + '</span><button class="btn sm" data-act="addq" data-b="' + bi + '" data-q="' + qi + '">담기</button></div>'; }).join("") +
          '</div><p class="src">○○ 표시는 학생마다 달라지는 내용입니다. 내 학생부의 활동을 넣어 읽어 보세요.</p></div></details>';
      }
      h += "</div>";
    });
    h += '<p class="src">평가요소 옆의 색 표시는 이 안내서의 표준 분류입니다.</p>';
    return h;
  }

  function statsHtml(S, uname, type, track) {
    var U = S.byUniv[uname], G = null, note = "", scope = "";
    if (U) {
      G = (type && U[type]) || U.all; scope = uname + (type && U[type] ? " · 학생부" + type + "전형" : " · 전체 전형");
    }
    if (!G) {
      if (!type && track && S.byTrack[track]) { G = S.byTrack[track]; scope = "전체 대학 · " + track + " 계열 평균"; }
      else { G = S.byType[type || "종합"] || S.global; scope = "전체 대학 · 학생부" + (type || "종합") + "전형 평균"; }
      note = '<div class="callout warn small"><b class="t">이 대학의 후기 표본이 부족합니다</b>후기가 ' + S.meta.minN + "건에 못 미쳐 대학별 수치를 내지 않았습니다. " + (!type && track && S.byTrack[track] ? "지원 학과와 같은 계열의 전체 평균을 대신 보여 드립니다." : "같은 전형유형의 전체 평균을 대신 보여 드립니다.") + " 아래 ‘내 학과군의 면접 경향’도 함께 보세요.</div>";
    }
    var R = MJ.stat.R, h = note;
    h += '<p class="small mute" style="margin-bottom:8px">' + esc(scope) + " · 후기 " + G.n.toLocaleString() + "건</p>";
    h += '<div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      (G.time ? '<div class="kpi"><b>' + G.time.med + "분</b><span>면접 시간 중앙값</span><small>" + (G.time.q1 === G.time.q3 ? "절반 이상이 " + G.time.q1 + "분" : "절반이 " + G.time.q1 + "~" + G.time.q3 + "분") + " · " + G.time.n + "건</small></div>" : "") +
      (G.qcount ? '<div class="kpi"><b>' + G.qcount.med + "개</b><span>받은 질문 수(중앙값)</span><small>" + G.qcount.n + "건</small></div>" : "") +
      (G.tail ? '<div class="kpi"><b>' + MJ.pct(G.tail.r) + "</b><span>꼬리질문을 언급한 후기</span><small>" + G.tail.n + "건</small></div>" : "") +
      (G.preopen ? '<div class="kpi"><b>' + MJ.pct(G.preopen.open) + "</b><span>문항을 미리 공개</span><small>" + G.preopen.n + "건</small></div>" : "") + "</div>";
    if (G.panel) h += "<h3>면접관 수</h3>" + R.panel(G, S);
    if (G.form) h += "<h3>면접 형태</h3>" + R.form(G, S);
    if (G.content) h += "<h3>면접 내용</h3>" + R.content(G, S);
    if (G.qtypes) h += "<h3>자주 나온 질문 유형</h3>" + R.qtypes(G, S, 8);
    if (G.mood && (G.mood.soft || G.mood.hard)) h += "<h3>분위기를 언급한 후기</h3>" + MJ.bars([{ label: "편안했다는 언급", v: G.mood.soft, cls: "g" }, { label: "압박을 느꼈다는 언급", v: G.mood.hard, cls: "a" }], { max: Math.max(0.3, G.mood.soft, G.mood.hard) }) + '<p class="src">분위기를 적은 후기 ' + G.mood.n.toLocaleString() + "건 가운데의 비율입니다. 한 후기에 두 가지가 함께 적히기도 하고, 같은 대학에서도 면접실에 따라 다릅니다.</p>";
    if (U && U.adms) {
      var ks = Object.keys(U.adms);
      if (ks.length) h += "<h3>전형별 면접 시간</h3>" + MJ.table(["전형(후기 표기)", "시간 중앙값", "후기"], ks.map(function (k) { var a = U.adms[k]; return [esc(k), a.time ? a.time.med + "분" : "–", a.n + "건"]; }), { stack: false });
    }
    h += '<p class="src" style="margin-top:14px;padding-top:10px;border-top:1px dashed var(--line)">후기를 남긴 학생 가운데 합격자가 많을 수 있고 일부 지역과 대학에 몰려 있어, 참고용 경향으로만 읽어야 합니다.</p>';
    return h;
  }

  /* 내 학과군의 면접 경향: 대학에 후기가 없어도 같은 학과군 지원자들이 받은 질문의 경향을 보여 준다. */
  function majorCard(S, mg) {
    var M = S.byMajor || {}, names = Object.keys(M), e = M[mg], all = S.global.qtypes.r;
    var sel = '<select class="in" id="mgSel" style="width:auto;min-width:220px" aria-label="학과군 고르기"><option value="">학과군을 고르세요</option>' +
      names.map(function (k) { return '<option value="' + esc(k) + '"' + (k === mg ? " selected" : "") + ">" + esc(k) + "</option>"; }).join("") + "</select>";
    var h = '<div class="card-head"><h2>내 학과군의 면접 경향</h2>' + sel + "</div>";
    if (!e) return h + '<p class="mute">지원 학과와 비슷한 학과들을 묶어, 그 학과군 지원자들이 면접에서 받은 질문의 경향을 보여 드립니다. 대학에 후기가 없어도 참고할 수 있습니다. 위에서 학과군을 고르거나, ‘내 면접’에 지원 학과를 적으면 자동으로 정해집니다.</p>';
    var r = e.qtypes.r, keys = Object.keys(r).sort(function (a, b) { return r[b] - r[a]; }).slice(0, 8);
    var more = Object.keys(r).filter(function (k) { return r[k] - all[k] >= 0.08; }).sort(function (a, b) { return (r[b] - all[b]) - (r[a] - all[a]); });
    h += '<p class="small mute" style="margin-bottom:10px">' + esc(mg) + " 지원자의 면접 후기 " + e.n.toLocaleString() + "건을 모아 본 경향입니다. 대학과 전형에 따라 다를 수 있습니다.</p>";
    h += '<div class="duo"><div><h3>자주 나온 질문 유형</h3>' + MJ.bars(keys.map(function (k) { return { label: k, v: r[k], text: MJ.pct(r[k]) }; }), { max: Math.max(0.5, r[keys[0]]) }) +
      (more.length ? '<div class="callout small" style="margin-bottom:0"><b class="t">다른 학과보다 눈에 띄게 많이 나온 질문</b>' + more.slice(0, 4).map(function (k) { return esc(k) + " (전체 " + MJ.pct(all[k]) + " → " + MJ.pct(r[k]) + ")"; }).join(", ") + "</div>" : "") + "</div><div>";
    h += "<h3>면접에서 자주 물은 개념어</h3>";
    if (e.terms && e.terms.length) {
      h += '<p class="small mute">이 학과군 후기의 질문에 유난히 자주 나온 낱말입니다. 누르면 그 낱말이 들어간 실제 질문을 찾아볼 수 있습니다.</p><div class="chips" style="margin-top:8px">' +
        e.terms.map(function (t) { return '<a class="chip" href="#/questions?tab=bank&mg=' + encodeURIComponent(mg) + "&w=" + encodeURIComponent(t[0]) + '">' + esc(t[0]) + ' <span class="x">' + t[1] + "</span></a>"; }).join("") + "</div>" +
        '<p class="src">숫자는 그 낱말이 질문에 나온 후기 수입니다. 내 학생부에 같은 낱말이 있다면 뜻과 원리를 설명할 수 있어야 합니다.</p>';
    } else h += '<p class="mute small">이 학과군은 두드러지게 많이 나온 개념어가 없습니다. 지원동기·경험·직업관 질문을 중심으로 준비하세요.</p>';
    h += (e.tail ? '<p class="small" style="margin-top:12px">꼬리질문을 언급한 후기 <b>' + MJ.pct(e.tail.r) + "</b> (전체 " + MJ.pct(S.global.tail.r) + ")</p>" : "") +
      '<div class="row" style="margin-top:10px"><a class="btn sm" href="#/questions?tab=bank&mg=' + encodeURIComponent(mg) + '">이 학과군의 실제 질문 보기</a></div></div></div>';
    return h;
  }

  function gapNote(o, S, uname) {
    var U = S.byUniv[uname]; if (!o || !o.blocks.length || !U || !U.all.time) return "";
    var m = /(\d{1,2})\s*분/.exec(o.blocks[0].time || ""); if (!m) return "";
    var off = +m[1], med = U.all.time.med;
    if (Math.abs(off - med) >= 4) return '<div class="callout warn"><b class="t">안내와 후기가 다릅니다</b>대학 안내의 면접 시간은 ' + esc(o.blocks[0].time) + "인데, 후기의 중앙값은 " + med + "분입니다. 전형이나 연도에 따라 달라졌을 수 있으니 올해 모집요강을 기준으로 삼으세요.</div>";
    return "";
  }

  MJ.register("univ", {
    title: "2단계 내 대학 알아보기",
    render: function (el, r) {
      var st = MJ.store.get(), list = MJ.data.univ.list, name = r.q.u || "", type = r.q.t || "";
      MJ.store.mark("univ", 1);
      var h = MJ.stepHead("univ");
      h += '<div class="card"><div class="searchbox"><label class="f" for="uq">대학 찾기</label><input class="in" id="uq" autocomplete="off" placeholder="대학 이름을 입력하세요 (예: 충남대)" value="' + esc(name) + '"><div class="sugg" id="us" hidden></div></div>';
      if (st.targets.length) h += '<div class="chips" style="margin-top:10px"><span class="small mute" style="padding-top:5px">내 면접:</span>' + st.targets.map(function (t) { return '<a class="chip ' + (t.univ === name ? "on" : "") + '" href="#/univ?u=' + encodeURIComponent(t.univ) + '">' + esc(t.univ) + "</a>"; }).join("") + "</div>";
      h += '<details class="acc" style="margin-top:12px"><summary>면접이 있는 대학 전체 보기 (' + list.length + '개)</summary><div class="acc-body"><div class="chips">' + list.map(function (u) { return '<a class="chip" href="#/univ?u=' + encodeURIComponent(u.k) + '">' + esc(u.k) + "</a>"; }).join("") + "</div></div></details></div>";

      if (!name) {
        h += '<div class="card"><h2>이 화면에서 볼 수 있는 것</h2><div class="duo"><div><h3 class="col">대학이 밝힌 것</h3><ul><li>평가요소와 반영 비율</li><li>면접 방식, 시간, 면접 자료</li><li>대학이 공개한 예시 문항</li><li>가이드북에 실린 면접 안내와 질문</li><li>면접일과 1단계 발표일</li></ul></div><div><h3 class="col">선배들이 겪은 것</h3><ul><li>실제 면접 시간과 면접관 수</li><li>질문 유형의 분포</li><li>꼬리질문과 분위기에 대한 언급</li><li>전형별 차이</li></ul></div></div>' +
          '<div class="callout">두 정보를 나란히 보면 준비의 방향이 정해집니다. 평가요소 비율은 4단계에서 질문 구성을 맞추는 데 쓰이고, 면접 시간과 질문 수는 6단계에서 문항 수와 답변 시간을 정할 때 참고합니다.</div></div>';
        h += '<div class="card" id="gstat"><h2>전체 평균 먼저 보기</h2><p class="mute small">통계를 불러오는 중입니다.</p></div>';
        h += '<section class="card" id="mgCard"><p class="mute small">불러오는 중입니다.</p></section>';
      } else {
        var u = findU(name);
        h += '<div class="card"><div class="card-head"><h2>' + esc(name) + (u && u.r ? ' <span class="tag">' + esc(u.r) + "</span>" : "") + '</h2><div class="row" id="uTop">' + (st.targets.some(function (t) { return t.univ === name; }) ? '<span class="tag ok">내 면접에 있음</span><button class="btn sm" data-act="keep" data-i="-1">다른 전형도 담기</button>' : '<button class="btn sm primary" data-act="keep" data-i="-1">' + MJ.icon("plus", 15) + " 내 면접에 담기</button>") + "</div></div><h3>면접 전형과 일정</h3>" + schedule(u, st) + "</div>";
        h += '<div id="gap"></div>';
        h += '<div class="duo"><section class="card"><h3 class="col">' + MJ.icon("info", 16) + ' 대학이 밝힌 것</h3><div id="off"><p class="mute small">불러오는 중입니다.</p></div></section>' +
          '<section class="card"><h3 class="col">' + MJ.icon("eye", 16) + " 선배들이 겪은 것</h3>" +
          '<div class="chips" style="margin-bottom:10px">' + [["", "전체"], ["종합", "종합"], ["교과", "교과"]].map(function (x) { return '<a class="chip ' + (type === x[0] ? "on" : "") + '" href="#/univ?u=' + encodeURIComponent(name) + (x[0] ? "&t=" + x[0] : "") + '">' + x[1] + "</a>"; }).join("") + '</div><div id="sts"><p class="mute small">불러오는 중입니다.</p></div></section></div>';
        h += '<section class="card" id="mgCard"><p class="mute small">불러오는 중입니다.</p></section>';
        h += '<div class="card flat"><h3>더 자세히 보려면</h3><div class="row"><a class="btn sm" target="_blank" rel="noopener" href="' + SITE + 'jonghap_interview.html">대학별 면접평가 비교</a><a class="btn sm" target="_blank" rel="noopener" href="' + SITE + '2027gosa.html">대학별고사 일정 캘린더</a><a class="btn sm" target="_blank" rel="noopener" href="' + SITE + '2026prelearning-report.html">선행학습 영향평가 보고서</a><a class="btn sm" target="_blank" rel="noopener" href="' + SITE + '2027hakjong-guide.html">학생부종합전형 가이드북</a></div><p class="src">대학이 직접 낸 가이드북과 선행학습 영향평가 보고서에는 실제 면접 문항과 평가 기준이 실려 있습니다. 지원 대학의 자료는 꼭 읽어 보세요.</p></div>';
      }
      h += MJ.stepNav("univ");
      el.innerHTML = h;

      var uq = el.querySelector("#uq"), us = el.querySelector("#us");
      /* 찾기 후보: 면접 일정이 있는 대학 + 일정 자료에는 없지만 공개 면접 질문·안내가 있는 대학 */
      var sugList = list.slice();
      MJ.load("guide_univ").then(function (GU) {
        var have = {}; list.forEach(function (u) { have[u.k] = 1; });
        Object.keys(GU.univ || {}).concat(Object.keys(GU.count || {})).forEach(function (k) {
          if (!have[k] && /[가-힣]{2}/.test(k) && !/공동$/.test(k)) { have[k] = 1; sugList.push({ k: k, r: "", extra: true }); }
        });
      }).catch(function () { });
      uq.addEventListener("input", function () {
        var v = uq.value.trim().replace(/\s+/g, "");
        if (!v) { us.hidden = true; return; }
        var hits = sugList.filter(function (u) { return u.k.replace(/\s+/g, "").indexOf(v) >= 0; }).slice(0, 12);
        us.innerHTML = hits.map(function (u) { return '<button type="button" data-k="' + esc(u.k) + '"><span>' + esc(u.k) + "</span><small>" + esc(u.r || "") + (u.off ? " · 평가요소 자료 있음" : "") + (u.extra ? "공개 질문·안내만 있음" : "") + "</small></button>"; }).join("") || '<button type="button" disabled><span class="mute">목록에 없는 대학입니다</span></button>';
        us.hidden = false;
      });
      us.addEventListener("click", function (e) { var b = e.target.closest("button[data-k]"); if (b) MJ.go("#/univ?u=" + encodeURIComponent(b.getAttribute("data-k"))); });
      uq.addEventListener("keydown", function (e) { if (e.key === "Escape") { us.hidden = true; return; } if (e.key === "Enter" && !e.isComposing && !us.hidden) { var b = us.querySelector("button[data-k]"); if (b) MJ.go("#/univ?u=" + encodeURIComponent(b.getAttribute("data-k"))); } });

      var offData = null, mg = MJ.myMajorGroup(name);
      var mgDef = (MJ.content.majors || []).filter(function (g) { return g.k === mg; })[0];
      var myTrack = (mgDef && mgDef.t) || ((st.targets.filter(function (t) { return t.univ === name; })[0] || {}).track) || "";
      function drawMajor(S) {
        var box = el.querySelector("#mgCard"); if (!box) return;
        box.innerHTML = majorCard(S, mg);
        var sel = box.querySelector("#mgSel");
        if (sel) sel.addEventListener("change", function () { st.myMajor = sel.value; MJ.store.save(); mg = sel.value; drawMajor(S); });
      }
      MJ.on(el, "click", {
        keep: function (t) {
          var u = findU(name), i = +t.getAttribute("data-i"), a = u && i >= 0 ? u.adms[i] : (u && u.adms[0]);
          MJ.targetForm(null, { univ: name, adm: a ? a.n : "", type: a ? a.t : "종합", date: a ? a.d[0][0] : "", s1: a ? a.s1 || "" : "" }, function () { MJ.rerender(); });
        },
        addq: function (t) {
          if (!offData) return;
          var b = offData.blocks[+t.getAttribute("data-b")], qs = [];
          b.f.forEach(function (f) { (f.q || []).forEach(function (q) { qs.push({ t: q, s: f.s }); }); });
          (b.q || []).forEach(function (q) { qs.push({ t: q, s: "" }); });
          var q = qs[+t.getAttribute("data-q")]; if (!q) return;
          if (st.questions.some(function (x) { return x.text === q.t; })) { MJ.toast("이미 질문함에 있습니다."); return; }
          st.questions.push({ id: MJ.uid("q"), tpl: "", text: q.t, kind: MJ.a.guessKind(q.t), factor: q.s || "", depth: 0, intent: "", purpose: "", tails: [], src: { type: "official", ref: name }, star: false, hidden: false });
          MJ.store.save(); t.textContent = "담김"; t.disabled = true; MJ.toast("질문함에 담았습니다.");
        }
      });

      if (name) {
        MJ.load("official").then(function (O) {
          offData = O[name] || null;
          return MJ.load("guide_univ").catch(function () { return null; }).then(function (G) {
            var gh = guideHtml(G, name);
            el.querySelector("#off").innerHTML = gh + (gh && !offData ? "" : officialHtml(offData, name));
          });
        }).then(function () { return MJ.load("stats"); })
          .then(function (S) {
            el.querySelector("#sts").innerHTML = statsHtml(S, name, type, myTrack); el.querySelector("#gap").innerHTML = gapNote(offData, S, name); drawMajor(S);
            return MJ.load("hugi_index").then(function (HI) {
              var x = HI.u[name], box = el.querySelector("#sts"); if (!x || !box) return;
              var top = el.querySelector("#uTop"); if (top) top.insertAdjacentHTML("afterbegin", '<a class="btn sm" href="#/hugi?u=' + encodeURIComponent(name) + '">선배 후기 ' + x[1].toLocaleString() + "건</a>");
              box.insertAdjacentHTML("beforeend", '<div class="callout tip small" style="margin:12px 0 0"><b class="t">선배 후기 ' + x[1].toLocaleString() + '건</b>선배들이 이 대학 면접에서 실제로 받은 질문과 진행 방식, 후배에게 남긴 말을 볼 수 있습니다.<div class="row" style="margin-top:8px"><a class="btn sm primary" href="#/hugi?u=' + encodeURIComponent(name) + (type ? "&t=" + (type === "종합" ? 0 : 1) : "") + '">선배 후기 보기</a></div></div>');
            }).catch(function () { });
          })
          .catch(function (e) { var x = el.querySelector("#sts"); if (x) x.innerHTML = '<p class="mute small">자료를 불러오지 못했습니다. ' + esc(e.message) + "</p>"; });
      } else {
        MJ.load("stats").then(function (S) {
          var g = el.querySelector("#gstat"); if (!g) return;
          g.innerHTML = "<h2>전체 평균 먼저 보기</h2><div class=\"grid g2\"><div><h3>면접 시간</h3>" + MJ.stat.block("global.time", S) + "<h3>면접관 수</h3>" + MJ.stat.block("global.panel", S) + "</div><div><h3>자주 나온 질문 유형</h3>" + MJ.stat.block("global.qtypes", S) + "</div></div>";
          drawMajor(S);
        }).catch(function () { });
      }
    }
  });
})();
