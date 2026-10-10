/* 홈: 내 면접, 준비 일정표, 오늘 할 일, 6단계 */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;

  /* 진행률은 저장된 내용에서 계산한다. 0=시작 전, 1=진행 중, 2=완료 */
  MJ.calcProgress = function () {
    var st = MJ.store.get(), rec = MJ.store.record(), p = st.progress;
    var nq = st.questions.filter(function (q) { return !q.hidden; }).length;
    var na = Object.keys(st.answers).filter(function (k) { var a = st.answers[k]; return a && Object.keys(a.slots || {}).some(function (s) { return (a.slots[s] || "").trim(); }); }).length;
    return {
      know: p.know || 0,
      univ: st.targets.length ? 2 : (p.univ || 0),
      record: rec.length >= 5 ? 2 : rec.length ? 1 : (p.record >= 2 ? 2 : 0),
      questions: nq >= 12 ? 2 : nq ? 1 : 0,
      answers: na >= 5 ? 2 : na ? 1 : 0,
      practice: st.practice.length >= 3 ? 2 : st.practice.length ? 1 : 0
    };
  };

  function upcoming(targets) {
    var t = MJ.today();
    return targets.filter(function (x) { return x.date && MJ.dayDiff(MJ.parseDate(x.date), t) >= 0; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  var WEIGHT = { know: 1, univ: 1, record: 3, questions: 3, answers: 4, practice: 4 };
  var TODO = {
    know: ["3분 OX 진단을 풀어 흔한 오해부터 바로잡으세요.", "‘면접관이 보는 것’과 ‘내 면접 유형 찾기’를 읽으세요.", "블라인드 규정에서 내가 조심할 표현을 확인하세요."],
    univ: ["지원 대학의 평가요소와 반영 비율을 확인하세요.", "선배들이 겪은 면접 시간·질문 유형을 살펴보세요.", "면접 일정과 1단계 발표일을 ‘내 면접’에 담으세요."],
    record: ["학생부를 처음부터 끝까지 소리 내어 한 번 읽으세요.", "면접관의 눈에 띌 문장을 영역별로 5개 이상 옮겨 적으세요.", "‘확인 필요’로 표시할 문장(출결, 성적 변화, 미이수 과목)을 찾으세요."],
    questions: ["옮겨 적은 문장마다 질문을 만들고 꼬리질문까지 읽어 보세요.", "학생부 밖 공통 질문 " + MJ.content.commonQ.length + "개를 내 질문함에 담으세요.", "답하기 어려운 질문에 별표를 붙이세요."],
    answers: ["별표 질문부터 구조에 맞춰 답변을 쓰세요.", "문장 점검에서 지적된 곳을 고치세요.", "답변마다 키워드 서너 개만 남기세요."],
    practice: ["키워드 카드만 보고 소리 내어 답해 보세요.", "꼬리질문 연습을 켜고 한 세트를 끝까지 해 보세요.", "녹음을 듣고 자기점검 항목을 체크하세요."]
  };

  function buildPlan(target, prog) {
    var today = MJ.today(), D = MJ.parseDate(target.date), N = MJ.dayDiff(D, today);
    var s1 = target.s1 ? MJ.parseDate(target.s1) : null;
    var rows = [], ids = MJ.STEPS.map(function (s) { return s.id; });
    var gap = s1 ? MJ.dayDiff(D, s1) : null;
    var tight = s1 && gap <= 4 && MJ.dayDiff(s1, today) > 0;   // 발표~면접 간격이 짧다
    var endAll = MJ.addDays(D, -1);
    var span = Math.max(0, MJ.dayDiff(endAll, today));
    var cum = 0, total = 16;
    ids.forEach(function (id) {
      cum += WEIGHT[id];
      var due;
      if (tight) {
        if (id === "practice") due = endAll;
        else { var sp = Math.max(0, MJ.dayDiff(s1, today)); due = MJ.addDays(today, Math.round(sp * (cum / 12))); }
      } else due = MJ.addDays(today, Math.round(span * (cum / total)));
      if (due > endAll) due = endAll;
      if (due < today) due = today;
      rows.push({ id: id, due: due, st: prog[id] });
    });
    return { rows: rows, N: N, gap: gap, tight: tight, s1: s1 };
  }

  function targetCard(t, i, isMain, many) {
    var n = t.date ? MJ.dayDiff(MJ.parseDate(t.date), MJ.today()) : null;
    var cls = n == null ? "" : n < 0 ? "past" : n <= 3 ? "soon" : "";
    var adm = String(t.adm || "").replace(/^학생부(종합|교과)\((.+)\)$/, "$2");
    return '<div class="target ' + (isMain ? "is-main" : "") + '"><div class="dd ' + cls + '">' + (t.date ? MJ.dday(t.date) + "<small>" + MJ.fmtDate(t.date) + "</small>" : "미정<small>날짜 입력</small>") + "</div>" +
      '<div><b>' + esc(t.univ) + '</b> <span class="tag teal">' + esc(t.type || "") + "</span>" + (isMain && many ? ' <span class="tag warn">일정표 기준</span>' : "") +
      '<div class="meta">' + esc(adm) + (t.major ? " · " + esc(t.major) : "") + (t.track ? " · " + esc(t.track) + " 계열" : "") + "</div>" +
      (t.s1 ? '<div class="meta">1단계 발표 ' + MJ.fmtDate(t.s1) + (t.date ? " → 면접까지 " + MJ.dayDiff(MJ.parseDate(t.date), MJ.parseDate(t.s1)) + "일" : "") + "</div>" : "") + "</div>" +
      '<div class="acts row">' + (!isMain && many && n != null && n >= 0 ? '<button class="btn sm" data-act="main" data-i="' + i + '">일정표 기준으로</button>' : "") +
      '<a class="btn sm" href="#/univ?u=' + encodeURIComponent(t.univ) + '">면접 정보</a><button class="btn sm" data-act="edit" data-i="' + i + '">수정</button></div></div>';
  }

  var SPECIAL = /기회균형|농어촌|특성화|특수교육|저소득|기초생활|차상위|재외|북한|장애|보훈|국가유공|만학|서해|정원외|계약학과|위탁|성인|재직|고른기회|사회배려|사회통합|다문화|군인|선취업/;
  MJ.targetForm = function (idx, preset, done) {
    var st = MJ.store.get();
    var cur = idx != null ? MJ.clone(st.targets[idx]) : Object.assign({ id: MJ.uid("t"), univ: "", adm: "", type: "종합", major: "", track: "", date: "", s1: "" }, preset || {});
    var list = MJ.data.univ.list;
    var body = document.createElement("div");
    body.innerHTML =
      '<div class="field searchbox"><label class="f" for="tfU">대학</label><input class="in" id="tfU" autocomplete="off" placeholder="대학 이름을 입력하세요" value="' + esc(cur.univ) + '"><div class="sugg" id="tfS" hidden></div>' +
      '<p class="hint">목록에 없으면 이름을 그대로 입력하고 아래 내용을 직접 채우세요.</p></div>' +
      '<div class="field"><label class="f" for="tfA">전형</label><select class="in" id="tfA"></select><input class="in" id="tfA2" placeholder="전형 이름" style="margin-top:6px" hidden></div>' +
      '<div class="grid g2"><div class="field"><label class="f" for="tfD">면접일</label><input class="in" type="date" id="tfD" value="' + esc(cur.date) + '"><p class="hint" id="tfDh"></p></div>' +
      '<div class="field"><label class="f" for="tfS1">1단계 합격자 발표일 <span class="mute">(선택)</span></label><input class="in" type="date" id="tfS1" value="' + esc(cur.s1 || "") + '"></div></div>' +
      '<div class="grid g2"><div class="field"><label class="f" for="tfM">지원 학과(모집단위)</label><input class="in" id="tfM" list="tfML" placeholder="예: 화학공학과" value="' + esc(cur.major) + '"><datalist id="tfML"></datalist></div>' +
      '<div class="field"><label class="f" for="tfT">계열</label><select class="in" id="tfT"><option value="">선택</option>' + MJ.TRACKS.map(function (t) { return "<option" + (cur.track === t ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="callout warn small">날짜는 2026년 6월 기준 자료입니다. 모집단위·고사장에 따라 달라질 수 있으니 대학 입학처 공지로 꼭 확인하고 고쳐 주세요.</div>';
    var $ = function (s) { return body.querySelector(s); };
    var uIn = $("#tfU"), sg = $("#tfS"), aSel = $("#tfA"), a2 = $("#tfA2");
    function findU(name) { return list.filter(function (u) { return u.k === name; })[0]; }
    function fillAdm() {
      var u = findU(uIn.value.trim());
      if (!u || !u.adms.length) { aSel.innerHTML = '<option value="">직접 입력</option>'; a2.hidden = false; a2.value = cur.adm || ""; $("#tfML").innerHTML = ""; return; }
      /* 일반전형을 먼저, 기회균형·농어촌 등 특별전형은 뒤 묶음으로. 기본 선택은 첫 일반전형 */
      var opt = function (a, i) { return '<option value="' + i + '"' + (a.n === cur.adm ? " selected" : "") + ">" + esc(a.n) + "</option>"; };
      var gen = [], spe = [];
      u.adms.forEach(function (a, i) { (SPECIAL.test(a.n) ? spe : gen).push(opt(a, i)); });
      aSel.innerHTML = (gen.length ? gen.join("") : "") + (spe.length ? '<optgroup label="특별전형">' + spe.join("") + "</optgroup>" : "") + '<option value="x">직접 입력</option>';
      a2.hidden = true; onAdm(true);
      MJ.load("units").then(function (un) { fillUnits(un); }).catch(function () { });
    }
    function fillUnits(un) {
      var u = findU(uIn.value.trim()); if (!u) return;
      var a = u.adms[+aSel.value]; if (!a) return;
      var arr = ((un[u.k] || {})[a.n]) || [];
      $("#tfML").innerHTML = arr.map(function (x) { return '<option value="' + esc(x[0]) + '">'; }).join("");
    }
    function onAdm(keep) {
      var u = findU(uIn.value.trim());
      if (aSel.value === "x") { a2.hidden = false; return; }
      a2.hidden = true;
      var a = u && u.adms[+aSel.value]; if (!a) return;
      var dIn = $("#tfD"), sIn = $("#tfS1");
      if (!keep || !dIn.value) dIn.value = a.d[0][0];
      if (!keep || !sIn.value) sIn.value = a.s1 || "";
      $("#tfDh").textContent = "자료상 면접 기간: " + a.d.map(function (r) { return MJ.fmtDate(r[0]) + (r[1] !== r[0] ? "~" + MJ.fmtDate(r[1]) : ""); }).join(", ");
      if (MJ.data.units) fillUnits(MJ.data.units);
    }
    function pickUnitDate() {
      var u = findU(uIn.value.trim()), un = MJ.data.units; if (!u || !un) return;
      var a = u.adms[+aSel.value]; if (!a) return;
      var hit = ((un[u.k] || {})[a.n] || []).filter(function (x) { return x[0] === $("#tfM").value.trim(); })[0];
      if (hit && a.d[hit[1]]) $("#tfD").value = a.d[hit[1]][0];
    }
    uIn.addEventListener("input", function () {
      var v = uIn.value.trim().replace(/\s+/g, "");
      if (!v) { sg.hidden = true; return; }
      var hits = list.filter(function (u) { return u.k.replace(/\s+/g, "").indexOf(v) >= 0; }).slice(0, 12);
      sg.innerHTML = hits.map(function (u) { return '<button type="button" data-k="' + esc(u.k) + '"><span>' + esc(u.k) + "</span><small>" + esc(u.r || "") + " · 면접 전형 " + u.adms.length + "개</small></button>"; }).join("");
      sg.hidden = !hits.length;
    });
    sg.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; uIn.value = b.getAttribute("data-k"); sg.hidden = true; cur.adm = ""; fillAdm(); });
    uIn.addEventListener("change", fillAdm);
    aSel.addEventListener("change", function () { onAdm(false); });
    $("#tfM").addEventListener("change", function () { var t = MJ.guessTrack($("#tfM").value); if (t) $("#tfT").value = t; pickUnitDate(); });
    fillAdm();
    var actions = [{ label: "취소" }];
    if (idx != null) actions.push({ label: "삭제", kind: "danger", run: function () { st.targets.splice(idx, 1); MJ.store.save(); if (done) done(); } });
    actions.push({
      label: "저장", kind: "primary", run: function () {
        var name = uIn.value.trim(); if (!name) { MJ.toast("대학 이름을 입력하세요."); return false; }
        var u = findU(name), a = u && aSel.value !== "x" ? u.adms[+aSel.value] : null;
        cur.univ = name; cur.adm = a ? a.n : a2.value.trim(); cur.type = a ? a.t : (/교과/.test(a2.value) ? "교과" : "종합");
        cur.date = $("#tfD").value; cur.s1 = $("#tfS1").value; cur.major = $("#tfM").value.trim(); cur.track = $("#tfT").value || MJ.guessTrack(cur.major);
        var dup = st.targets.filter(function (t, i) { return i !== idx && t.univ === cur.univ && t.adm === cur.adm; })[0];
        if (dup) { MJ.toast("같은 대학·전형이 이미 내 면접에 있습니다. 홈에서 그 항목을 고치세요."); return false; }
        if (idx != null) st.targets[idx] = cur; else st.targets.push(cur);
        MJ.store.save(); MJ.toast("내 면접에 담았습니다."); if (done) done();
      }
    });
    MJ.modal({ title: idx != null ? "내 면접 수정" : "내 면접 등록", body: body, actions: actions });
  };

  MJ.register("home", {
    title: "",
    render: function (el) {
      var st = MJ.store.get(), prog = MJ.calcProgress();
      var ups = upcoming(st.targets);
      var main = ups.filter(function (t) { return t.id === st.mainTarget; })[0] || ups[0];
      var doneN = MJ.STEPS.filter(function (s) { return prog[s.id] >= 2; }).length;
      var started = st.targets.length || doneN || MJ.STEPS.some(function (s) { return prog[s.id] > 0; });
      var nextId = MJ.STEPS.map(function (s) { return s.id; }).filter(function (id) { return prog[id] < 2; })[0];

      var h = '<section class="hero"><div class="k"><i></i>학생부 기반 면접 · 2027학년도 수시</div><h1>면접관의 눈으로 <em>내 학생부</em>를 읽습니다</h1>' +
        "<p>면접관은 여러 지원자의 학생부를 한정된 시간에 읽고, 눈에 띄는 줄에서 질문을 시작하는 경우가 많습니다. 같은 눈으로 내 기록을 읽고, 질문을 만들고, 답을 설계하고, 소리 내어 연습하도록 여섯 단계로 안내합니다.</p>" +
        '<div class="row">' + (st.targets.length && nextId
          ? '<a class="btn primary lg" href="#/' + nextId + '">이어서 하기 · ' + MJ.STEPS.filter(function (x) { return x.id === nextId; })[0].no + "단계 " + MJ.icon("arrow") + '</a><button class="btn" data-act="add">' + MJ.icon("plus") + " 면접 추가</button>"
          : '<button class="btn primary lg" data-act="add">' + MJ.icon("plus") + ' 내 면접 등록</button><a class="btn" href="#/know?quiz=1">3분 OX 진단</a>') + "</div>" +
        (started ? '<div class="overall"><span>준비 진행 <b>' + doneN + ' / 6</b></span><div class="meter"><i style="width:' + (doneN / 6 * 100).toFixed(0) + '%"></i></div></div>' : "") + "</section>";

      if (!started) {
        h += '<section style="margin-bottom:18px"><div class="howto">' +
          '<div><span class="num">1</span><b>면접일을 등록합니다</b><p>대학과 전형을 고르면 면접일과 1단계 발표일이 채워지고, 남은 날짜에 맞춰 준비 일정이 짜입니다.</p></div>' +
          '<div><span class="num">2</span><b>여섯 단계를 차례로 따라갑니다</b><p>면접 이해, 대학 정보, 학생부 읽기, 질문 만들기, 답변 설계, 실전 연습 순서입니다. 앞 단계에서 만든 것을 다음 단계에서 그대로 씁니다.</p></div>' +
          '<div><span class="num">3</span><b>소리 내어 연습합니다</b><p>키워드만 보고 말하고, 꼬리질문까지 받아 봅니다. 질문지를 인쇄해 선생님이나 친구에게 면접관을 부탁할 수 있습니다.</p></div></div>' +
          '<div class="callout" style="margin-bottom:0">처음이라면 <a href="#/record?sample=1"><b>가상 학생부로 먼저 둘러보기</b></a>를 권합니다. 실제 내 학생부를 넣기 전에 질문이 어떻게 만들어지는지 볼 수 있습니다. 입력한 내용은 이 기기 밖으로 나가지 않습니다.</div></section>';
      }

      h += '<section class="card"><div class="card-head"><h2>내 면접</h2><button class="btn sm" data-act="add">' + MJ.icon("plus", 15) + " 추가</button></div>";
      if (!st.targets.length) h += '<div class="empty"><b>등록한 면접이 없습니다</b>대학과 전형을 등록하면 면접일까지 남은 날짜에 맞춰 준비 일정을 짜 드립니다.<div style="margin-top:12px"><button class="btn primary" data-act="add">' + MJ.icon("plus") + " 내 면접 등록</button></div></div>";
      else {
        var sorted = st.targets.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) { return (a.t.date || "9") < (b.t.date || "9") ? -1 : 1; });
        h += sorted.map(function (x) { return targetCard(x.t, x.i, main && x.t === main, ups.length > 1); }).join("");
        h += conflict(st.targets);
      }
      h += "</section>";

      if (main) {
        var plan = buildPlan(main, prog);
        h += '<section class="card"><div class="card-head"><h2>준비 일정표</h2><span class="sub">' + esc(main.univ) + " 면접 " + MJ.dday(main.date) + " 기준</span></div>";
        if (plan.tight) h += '<div class="callout warn"><b class="t">1단계 발표에서 면접까지 ' + plan.gap + "일뿐입니다</b>발표를 보고 시작하면 늦을 수 있습니다. 5단계(답변 설계)까지는 발표 전에 마치고, 남은 기간에는 연습만 하도록 일정을 당겼습니다.</div>";
        else if (plan.N <= 3) h += '<div class="callout warn"><b class="t">면접이 ' + (plan.N === 0 ? "오늘입니다" : plan.N + "일 남았습니다") + "</b>새 질문을 늘리기보다 별표 질문의 답을 키워드로 줄이고, 소리 내어 말하는 연습에 시간을 쓰세요.</div>";
        h += '<div class="plan">';
        var nowSet = false, today = MJ.today();
        plan.rows.forEach(function (r) {
          var s = MJ.STEPS.filter(function (x) { return x.id === r.id; })[0];
          var done = r.st >= 2, isNow = !done && !nowSet; if (isNow) nowSet = true;
          var late = !done && MJ.dayDiff(r.due, today) < 0;
          h += '<div class="plan-row ' + (done ? "done" : isNow ? "now" : "") + '"><span class="plan-dot">' + (done ? MJ.icon("check", 15) : s.no) + '</span><div><a href="#/' + s.id + '"><b>' + s.name + "</b></a><small>" + s.sub + '</small></div><span class="plan-date ' + (late ? "late" : "") + '">' + (done ? "완료" : isNow && MJ.dayDiff(r.due, today) === 0 ? "오늘까지" : MJ.fmtDate(r.due) + "까지") + "</span></div>";
        });
        h += '</div><p class="src">남은 날짜를 단계별 분량에 따라 나눈 권장 일정입니다. 학생부 읽기부터 실전 연습까지의 단계에 더 많은 시간을 배분했습니다.</p></section>';
      }

      if (started && nextId) {
        var ns = MJ.STEPS.filter(function (x) { return x.id === nextId; })[0];
        h += '<section class="card"><div class="card-head"><h2>오늘 할 일 <span class="sub">' + ns.no + "단계 " + ns.name + '</span></h2><a class="btn sm primary" href="#/' + nextId + '">' + ns.no + "단계로 가기 " + MJ.icon("arrow", 15) + "</a></div><div class=\"stack\">" +
          TODO[nextId].map(function (t, i) { return '<div class="todo"><span class="n">' + (i + 1) + "</span><span>" + t + "</span></div>"; }).join("") + "</div></section>";
      } else if (started) h += '<section class="card"><h2>여섯 단계를 모두 마쳤습니다</h2><p>남은 기간에는 <a href="#/practice">실전 연습</a>을 반복하고, <a href="#/finish">점검·마무리</a>의 체크리스트를 확인하세요.</p></section>';

      h += '<section><div class="card-head"><h2 style="font-size:19.5px">준비 6단계</h2></div><div class="stepcards">';
      MJ.STEPS.forEach(function (s) {
        var p = prog[s.id];
        h += '<a class="stepcard ' + (p >= 2 ? "done" : p === 1 ? "half" : "") + '" href="#/' + s.id + '"><span class="st">' + (p >= 2 ? '<span class="tag ok">완료</span>' : p === 1 ? '<span class="tag warn">진행 중</span>' : "") + '</span><span class="no">' + (p >= 2 ? MJ.icon("check", 15) : s.no) + "</span><b>" + s.name + "</b><small>" + s.sub + "</small></a>";
      });
      h += '</div><div class="row" style="margin-top:12px"><a class="btn" href="#/finish">점검·마무리</a><a class="btn" href="#/notes">내 자료(인쇄·백업)</a></div></section>';

      el.innerHTML = h;
      MJ.on(el, "click", {
        add: function () { MJ.targetForm(null, null, MJ.rerender); },
        edit: function (t) { MJ.targetForm(+t.getAttribute("data-i"), null, MJ.rerender); },
        main: function (t) { st.mainTarget = st.targets[+t.getAttribute("data-i")].id; MJ.store.save(); MJ.rerender(); }
      });
    }
  });

  function conflict(targets) {
    var by = {}, out = [];
    targets.forEach(function (t) { if (t.date) (by[t.date] = by[t.date] || []).push(t.univ); });
    Object.keys(by).forEach(function (d) { if (by[d].length > 1) out.push(MJ.fmtDate(d) + ": " + by[d].join(", ")); });
    var csat = (MJ.data.univ.meta || {}).csat, pre = 0;
    targets.forEach(function (t) { if (t.date && csat && t.date < csat) pre++; });
    var h = "";
    if (out.length) h += '<div class="callout red small"><b class="t">같은 날 면접이 겹칩니다</b>' + esc(out.join(" / ")) + ". 시간대가 다른지, 조정이 가능한지 입학처에 확인하세요.</div>";
    if (pre) h += '<p class="hint">수능(' + MJ.fmtDate(csat) + ") 전에 치르는 면접이 " + pre + "건 있습니다. 수능 준비와 겹치지 않게 면접 준비를 미리 시작해 수능 공부와 겹치지 않게 하세요.</p>";
    return h;
  }
})();
