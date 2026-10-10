/* 3단계 내 학생부 읽기: 문장 옮겨 적기, 표시, 핵심어 */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;
  var TAGS = ["학업", "진로", "공동체", "확인"];
  var TAGNAME = { "학업": "학업", "진로": "진로", "공동체": "공동체", "확인": "확인 필요" };
  var CHIPS = [["topic", "주제"], ["concept", "개념어"], ["book", "책"], ["role", "역할"], ["result", "결과"]];
  var justAdded = [];

  function markup(item) {
    var text = item.text, marks = [];
    function add(list, cls) { (list || []).forEach(function (w) { var i = text.indexOf(w); if (i >= 0) marks.push([i, i + w.length, cls]); }); }
    add(item.chips.concept, ""); add(item.chips.topic, "b"); add(item.chips.book, "r"); add(item.chips.role, "r");
    marks.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var out = "", pos = 0;
    marks.forEach(function (m) { if (m[0] < pos) return; out += esc(text.slice(pos, m[0])) + '<mark class="' + m[2] + '">' + esc(text.slice(m[0], m[1])) + "</mark>"; pos = m[1]; });
    return out + esc(text.slice(pos));
  }
  function itemHtml(item, nq) {
    var first = item.tags[0] || "";
    var h = '<div class="rec-item t-' + esc(first) + (justAdded.indexOf(item.id) >= 0 ? " flash" : "") + '" data-id="' + esc(item.id) + '"><div class="rec-meta"><span class="tag navy">' + esc(MJ.areaName(item.area)) + "</span>" + (item.subject ? '<span class="tag">' + esc(item.subject) + "</span>" : "") +
      '<span class="grow"></span>' + (nq ? '<span class="tag ok">질문 ' + nq + "개</span>" : "") + "</div>" +
      '<div class="rec-text">' + markup(item) + "</div>" +
      '<dl class="chipset"><dt>표시</dt><dd><div class="tagpick">' + TAGS.map(function (t) { return '<button class="chip ' + t + (item.tags.indexOf(t) >= 0 ? " on" : "") + '" data-act="tag" data-t="' + t + '" aria-pressed="' + (item.tags.indexOf(t) >= 0) + '">' + TAGNAME[t] + "</button>"; }).join("") + "</div></dd>";
    CHIPS.forEach(function (c) {
      var arr = item.chips[c[0]] || [];
      if (c[0] !== "topic" && c[0] !== "concept" && !arr.length) return;
      h += "<dt>" + c[1] + '</dt><dd><div class="chips">' + arr.map(function (w, i) { return '<button class="chip" data-act="rmchip" data-k="' + c[0] + '" data-i="' + i + '" title="눌러서 지우기">' + esc(w) + ' <span class="x">×</span></button>'; }).join("") +
        '<button class="chip" data-act="addchip" data-k="' + c[0] + '">+ 추가</button></div></dd>';
    });
    h += '</dl><div class="row between" style="margin-top:12px"><span><button class="btn link" data-act="del">지우기</button> <button class="btn link" data-act="edit" style="color:var(--teal-d)">고치기</button></span><button class="btn sm ' + (nq ? "" : "primary") + '" data-act="makeq">' + (nq ? "질문 더 만들기" : "이 문장으로 질문 만들기") + "</button></div></div>";
    return h;
  }

  function addItem(area, subject, text) {
    var rec = MJ.store.record();
    var chips = MJ.q.extract(text, area);
    var item = { id: MJ.uid("r"), area: area, subject: subject || "", text: text.trim(), chips: chips, tags: MJ.q.suggestTags(text, area) };
    rec.push(item); MJ.store.saveRecord(); MJ.store.save();
    return item;
  }
  MJ.recordAdd = addItem;
  var lastArea = "";

  /* 붙여 넣은 글을 문단으로 나누고, 세특이면 "과목명: 내용" 머리말에서 과목 이름을 뗀다. */
  var SUBJ_HEAD = /^\s*[\[(<]?\s*([가-힣A-Za-z0-9ⅠⅡ·\s]{2,14}?)\s*[\])>]?\s*[:：]\s+(?=\S)/;
  /* 나이스에서 통째로 복사한 글: 영역 제목 줄을 알아보고, 세특은 "과목명:" 줄마다 나눈다. */
  var AREA_HEAD = [[/세부\s*능력|세특/, "seteuk"], [/자율|자치/, "jayul"], [/동아리/, "dongari"], [/진로\s*활동/, "jinro"],
    [/행동\s*특성|종합\s*의견|행특/, "haengteuk"], [/출결|출석/, "chulgyeol"], [/교과\s*학습\s*발달|성적|이수\s*현황/, "gwamok"]];
  function headArea(line) {
    var l = line.replace(/[\s\[\]<>()■□▶·\d.]/g, "");
    if (l.length > 16 || /[다함음임요]$/.test(l)) return null;   // 문장이면 제목이 아니다
    for (var i = 0; i < AREA_HEAD.length; i++) if (AREA_HEAD[i][0].test(l)) return AREA_HEAD[i][1];
    return null;
  }
  function splitParas(text, area, subject) {
    var out = [], cur = null, curArea = area;
    function flush() { if (cur && cur.text.trim().length >= 4) { cur.text = cur.text.replace(/\s+/g, " ").trim(); out.push(cur); } cur = null; }
    String(text).split(/\n/).forEach(function (line) {
      if (!line.trim()) { flush(); return; }
      var ha = headArea(line);
      if (ha) { flush(); curArea = ha; return; }
      var m = curArea === "seteuk" ? SUBJ_HEAD.exec(line) : null;
      if (m && !/(다|함|음|임)$/.test(m[1])) { flush(); cur = { area: curArea, subject: m[1].replace(/\s+/g, " ").trim(), text: line.slice(m[0].length) }; return; }
      if (!cur) cur = { area: curArea, subject: curArea === area ? subject : "", text: "" };
      cur.text += " " + line;
    });
    flush();
    return out;
  }

  function editForm(item, done) {
    var body = document.createElement("div");
    body.innerHTML = '<div class="grid g2"><div class="field"><label class="f" for="efA">영역</label><select class="in" id="efA">' + MJ.AREAS.map(function (a) { return '<option value="' + a.k + '"' + (a.k === item.area ? " selected" : "") + ">" + a.full + "</option>"; }).join("") + '</select></div><div class="field"><label class="f" for="efS">과목 이름</label><input class="in" id="efS" value="' + esc(item.subject) + '" placeholder="세특일 때만"></div></div><div class="field"><label class="f" for="efT">문장</label><textarea class="in" id="efT" style="min-height:160px">' + esc(item.text) + "</textarea></div>";
    MJ.modal({
      title: "문장 고치기", body: body, actions: [{ label: "취소" }, {
        label: "저장", kind: "primary", run: function () {
          var t = body.querySelector("#efT").value.trim(); if (!t) return false;
          var changed = t !== item.text;
          item.area = body.querySelector("#efA").value; item.subject = body.querySelector("#efS").value.trim(); item.text = t;
          if (changed) { item.chips = MJ.q.extract(t, item.area); }
          MJ.store.saveRecord(); done();
        }
      }]
    });
  }
  function sampleModal(rec) {
    var body = '<p>실제 학생과 무관하게 새로 쓴 연습용 학생부입니다. 하나를 고르면 문장이 채워집니다.</p><div class="qpick">' + MJ.content.samples.map(function (s, i) { return '<button data-s="' + i + '"><span><b>' + esc(s.name) + "</b><br><span class=\"mute small\">" + s.items.length + "개 문장 · " + esc(s.track) + " 계열</span></span></button>"; }).join("") + "</div>" + (rec.length ? '<p class="hint">지금 있는 문장 뒤에 덧붙입니다.</p>' : "");
    var m = MJ.modal({ title: "가상 학생부 고르기", body: body, actions: [{ label: "닫기" }] });
    m.body.addEventListener("click", function (e) {
      var b = e.target.closest("[data-s]"); if (!b) return;
      var s = MJ.content.samples[+b.getAttribute("data-s")];
      justAdded = s.items.map(function (it) { return addItem(it.area, it.subject, it.text).id; });
      m.close(); MJ.rerender(); MJ.toast("가상 학생부 문장 " + s.items.length + "개를 넣었습니다.");
      focusNew();
    });
  }
  function focusNew() {
    setTimeout(function () {
      var x = justAdded.length && document.querySelector('.rec-item[data-id="' + justAdded[0] + '"]');
      if (x) x.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function () { justAdded = []; }, 2200);
    }, 60);
  }

  MJ.register("record", {
    title: "3단계 내 학생부 읽기",
    render: function (el, r) {
      var st = MJ.store.get(), rec = MJ.store.record();
      MJ.store.mark("record", rec.length ? 1 : 0);
      var h = MJ.stepHead("record");
      h += '<details class="acc" ' + (rec.length ? "" : "open") + '><summary><span><b>면접관의 눈으로 읽는 법</b> <span class="mute small">어떤 문장을 옮겨 적어야 하나</span></span></summary><div class="acc-body prose"><p>면접관은 여러 지원자의 학생부를 정해진 시간 안에 읽습니다. 읽다가 눈길이 멈추는 줄에서 질문이 시작됩니다. 학생부를 옆에 펴 놓고, 아래 다섯 가지에 해당하는 문장을 찾아 이곳에 옮겨 적으세요.</p>' +
        '<ul><li><b>낯선 개념이나 용어</b>가 적힌 문장: 정말 이해했는지 묻습니다.</li><li><b>주제, 책 제목, 숫자</b>가 적힌 문장: 무엇을 어떻게 했는지 묻습니다.</li><li><b>조장, 기획, 발표</b> 같은 역할이 적힌 문장: 내가 직접 한 일을 묻습니다.</li><li><b>칭찬이 크게 적힌</b> 문장: 그렇게 평가받은 장면을 묻습니다.</li><li><b>설명이 필요한</b> 기록: 결석·지각, 성적이 내려간 학기, 전공과 관련 깊은데 듣지 않은 과목.</li></ul>' +
        '<div class="callout tip" style="margin-bottom:0"><b class="t">옮겨 적은 문장마다 색으로 표시합니다</b><span class="tag f-학업">학업</span> 배운 내용과 탐구 · <span class="tag f-진로">진로</span> 전공과 이어지는 활동 · <span class="tag f-공동체">공동체</span> 함께한 경험 · <span class="tag warn">확인 필요</span> 설명해야 할 기록. ‘확인 필요’ 문장은 실제 면접에서 질문으로 이어지기 쉬우니 빠뜨리지 마세요.</div></div></details>';

      h += '<div class="card"><div class="card-head"><h2>문장 옮겨 적기</h2><button class="btn sm" data-act="sample">가상 학생부로 먼저 해 보기</button></div>' +
        '<div class="grid g2"><div class="field"><label class="f" for="rA">영역</label><select class="in" id="rA">' + MJ.AREAS.map(function (a) { return '<option value="' + a.k + '">' + a.full + "</option>"; }).join("") + '</select></div>' +
        '<div class="field" id="rSw"><label class="f" for="rS">과목 이름</label><input class="in" id="rS" placeholder="예: 화학Ⅰ"></div></div>' +
        '<div class="field"><label class="f" for="rT">학생부 문장</label><textarea class="in" id="rT" placeholder="학생부의 문장을 그대로 붙여 넣으세요.&#10;&#10;여러 활동을 한꺼번에 넣으려면 활동 사이에 빈 줄을 두세요. 빈 줄마다 따로 나누어 넣습니다."></textarea>' +
        '<p class="hint" id="rHint">이름, 학교 이름처럼 나를 알아볼 수 있는 내용은 빼고 넣으세요. 출결·성적은 “2학년 미인정 지각 2회”, “2학년 2학기 수학Ⅱ 한 등급 하락”처럼 사실만 적으면 됩니다.</p></div>' +
        '<div class="row between"><label class="ckline"><input type="checkbox" id="rP" ' + (st.recordPolicy === "local" ? "checked" : "") + ' style="width:18px;height:18px;flex:none"> <span>학생부 문장을 이 기기에 저장 <span class="mute">(끄면 창을 닫을 때 지워집니다. 다만 이 문장으로 만든 질문은 질문함에 남으니, 함께 쓰는 컴퓨터에서는 끝나고 ‘초기화’를 누르세요)</span></span></label><button class="btn primary" data-act="add">' + MJ.icon("plus") + " 추가</button></div></div>";

      if (!rec.length) h += '<div class="empty"><b>아직 옮겨 적은 문장이 없습니다</b>학생부에서 질문이 나올 만한 문장을 다섯 개 이상 옮겨 적어 보세요. 처음이라면 가상 학생부로 흐름을 먼저 익혀도 좋습니다.<div style="margin-top:12px"><button class="btn" data-act="sample">가상 학생부로 먼저 해 보기</button></div></div>';
      else {
        var nt = {}; TAGS.forEach(function (t) { nt[t] = rec.filter(function (x) { return x.tags.indexOf(t) >= 0; }).length; });
        var noQ = rec.filter(function (it) { return !st.questions.some(function (q) { return q.src && q.src.ref === it.id; }); }).length;
        h += '<div class="card flat"><div class="row between"><div class="row"><b>옮겨 적은 문장 ' + rec.length + "개</b>" + TAGS.map(function (t) { return '<span class="tag ' + (t === "확인" ? "warn" : "f-" + t) + '">' + TAGNAME[t] + " " + nt[t] + "</span>"; }).join("") + '</div><button class="btn sm primary" data-act="makeall"' + (noQ ? "" : " disabled") + ">" + (noQ ? "질문이 없는 문장 " + noQ + "개로 질문 만들기" : "모든 문장에 질문이 있습니다") + "</button></div>" +
          (rec.length < 5 ? '<p class="hint">' + (5 - rec.length) + "개만 더 넣으면 3단계가 완료로 표시됩니다. 영역마다 한 개 이상 넣는 것이 좋습니다.</p>" : "") +
          (nt["확인"] === 0 ? '<p class="hint">‘확인 필요’ 문장이 없습니다. 출결, 성적 변화, 이수하지 않은 과목을 한 번 더 살펴보세요.</p>' : "") +
          '<div class="marks" style="margin-top:10px"><span><mark class="y">노랑</mark> 개념어</span><span><mark class="b">보라</mark> 주제</span><span><mark class="r">초록</mark> 책·역할</span><span>자동으로 찾은 핵심어입니다. 틀린 것은 눌러 지우고, 빠진 것은 ‘+ 추가’로 넣으세요.</span></div></div>';
        MJ.AREAS.forEach(function (a) {
          var items = rec.filter(function (x) { return x.area === a.k; });
          if (!items.length) return;
          h += '<div class="qgroup">' + a.full + ' <span class="n">' + items.length + "</span></div>" + MJ.areaTip(a.k);
          items.forEach(function (it) { h += itemHtml(it, st.questions.filter(function (q) { return q.src && q.src.ref === it.id; }).length); });
        });
        h += '<div class="row between" style="margin-top:14px"><button class="btn link" data-act="clear">옮겨 적은 문장 모두 지우기</button><a class="btn primary" href="#/questions">질문함 보러 가기 ' + MJ.icon("arrow") + "</a></div>";
      }
      h += MJ.stepNav("record");
      el.innerHTML = h;

      function itemOf(t) { var id = t.closest(".rec-item").getAttribute("data-id"); return rec.filter(function (x) { return x.id === id; })[0]; }
      function makeQ(item) {
        var have = st.questions.filter(function (q) { return q.src && q.src.ref === item.id; }).map(function (q) { return q.tpl; });
        var qs = MJ.q.generate(item, { exclude: have, salt: have.length, count: have.length ? 4 : null, avoidTexts: st.questions.map(function (q) { return q.text; }) });
        qs.forEach(function (q) { st.questions.push(q); });
        return qs.length;
      }
      if (lastArea) el.querySelector("#rA").value = lastArea;
      var ta = el.querySelector("#rT"), aSel = el.querySelector("#rA"), sWrap = el.querySelector("#rSw"), hint = el.querySelector("#rHint"), hint0 = hint.textContent;
      function syncArea() { sWrap.style.visibility = aSel.value === "seteuk" || aSel.value === "gwamok" ? "visible" : "hidden"; }
      aSel.addEventListener("change", syncArea); syncArea();
      ta.addEventListener("input", function () {
        var ps = splitParas(ta.value, aSel.value, ""), n = ps.length, areas = {};
        ps.forEach(function (p) { areas[p.area] = 1; });
        var na = Object.keys(areas).length;
        hint.textContent = n > 1 ? n + "개 문단으로 나누어 넣습니다" + (na > 1 ? "(영역 제목을 알아보아 " + na + "개 영역으로 나눔)" : "") + ". 빈 줄, 영역 제목 줄, “과목 이름: 내용” 줄에서 나눕니다." : hint0;
      });
      el.querySelector("#rP").addEventListener("change", function (e) {
        MJ.store.setRecordPolicy(e.target.checked ? "local" : "session");
        MJ.toast(e.target.checked ? "학생부 문장을 이 기기에 저장합니다." : "창을 닫으면 학생부 문장이 지워집니다.");
      });
      MJ.on(el, "click", {
        add: function () {
          var paras = splitParas(ta.value, aSel.value, el.querySelector("#rS").value.trim());
          if (!paras.length) { MJ.toast("문장을 입력하세요."); ta.focus(); return; }
          justAdded = paras.map(function (p) { return addItem(p.area || aSel.value, p.subject, p.text).id; });
          lastArea = aSel.value;   // 다음 문장도 같은 영역으로 넣기 쉽게
          MJ.rerender(); MJ.toast(paras.length > 1 ? paras.length + "개 문단을 넣었습니다. 표시와 핵심어를 확인하세요." : "추가했습니다. 표시와 핵심어를 확인하세요.");
          focusNew();
        },
        sample: function () { sampleModal(rec); },
        tag: function (t) { var it = itemOf(t), k = t.getAttribute("data-t"), i = it.tags.indexOf(k); if (i >= 0) it.tags.splice(i, 1); else it.tags.push(k); MJ.store.saveRecord(); MJ.rerender(); },
        rmchip: function (t) { var it = itemOf(t); it.chips[t.getAttribute("data-k")].splice(+t.getAttribute("data-i"), 1); MJ.store.saveRecord(); MJ.rerender(); },
        addchip: function (t) {
          var it = itemOf(t), k = t.getAttribute("data-k"), label = CHIPS.filter(function (c) { return c[0] === k; })[0][1];
          var body = document.createElement("div");
          body.innerHTML = '<div class="field"><label class="f" for="ci">' + label + '</label><input class="in" id="ci" placeholder="' + (k === "topic" ? "예: 철의 부식 속도에 영향을 주는 요인" : k === "concept" ? "예: 산화 환원 반응" : "") + '"><p class="hint">문장 속 표현 그대로 짧게 적으세요. 질문에 그대로 들어갑니다.</p></div>';
          var add = function () { var v = body.querySelector("#ci").value.trim(); if (!v) return false; (it.chips[k] = it.chips[k] || []).unshift(v); MJ.store.saveRecord(); MJ.rerender(); };
          var m = MJ.modal({ title: label + " 추가", body: body, actions: [{ label: "취소" }, { label: "추가", kind: "primary", run: add }] });
          body.querySelector("#ci").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.isComposing) { if (add() !== false) m.close(); } });
        },
        del: function (t) { var it = itemOf(t); MJ.confirm("이 문장을 지울까요? 이 문장에서 만든 질문은 질문함에 남습니다.", function () { rec.splice(rec.indexOf(it), 1); MJ.store.saveRecord(); MJ.store.save(); MJ.rerender(); }, "지우기"); },
        edit: function (t) { editForm(itemOf(t), MJ.rerender); },
        makeq: function (t) { var n = makeQ(itemOf(t)); MJ.store.save(); MJ.rerender(); MJ.toast(n ? "질문 " + n + "개를 질문함에 담았습니다." : "더 만들 질문이 없습니다. 핵심어를 추가해 보세요."); },
        makeall: function () {
          var n = 0; rec.forEach(function (it) { if (!st.questions.some(function (q) { return q.src && q.src.ref === it.id; })) n += makeQ(it); });
          MJ.store.save();
          if (n) { MJ.toast("질문 " + n + "개를 만들었습니다."); MJ.go("#/questions"); } else MJ.toast("모든 문장에 이미 질문이 있습니다.");
        },
        clear: function () { MJ.confirm("옮겨 적은 문장을 모두 지울까요? 질문함의 질문은 남습니다.", function () { rec.length = 0; MJ.store.saveRecord(); MJ.store.save(); MJ.rerender(); }, "모두 지우기"); }
      });
      if (r && r.q.sample && !rec.length) setTimeout(function () { sampleModal(rec); }, 80);
    }
  });
})();
