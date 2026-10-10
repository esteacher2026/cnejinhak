/* 5단계 답변 설계하기 */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;
  var BUILDER_OF = [[/motive/, "motive"], [/intro/, "intro"], [/last/, "last"]];

  function ordered(st) {
    return st.questions.filter(function (q) { return !q.hidden; }).slice().sort(function (a, b) { return (b.star ? 1 : 0) - (a.star ? 1 : 0); });
  }
  function answered(st, q) { var a = st.answers[q.id]; return !!(a && Object.keys(a.slots || {}).some(function (k) { return (a.slots[k] || "").trim(); })); }

  function pickList(st, cur, flt) {
    var qs = ordered(st);
    if (flt === "star") qs = qs.filter(function (q) { return q.star; });
    else if (flt === "todo") qs = qs.filter(function (q) { return !answered(st, q); });
    else if (flt === "done") qs = qs.filter(function (q) { return answered(st, q); });
    if (!qs.length && flt) return '<div class="empty">조건에 맞는 질문이 없습니다.</div>';
    if (!qs.length) return '<div class="empty"><b>질문함이 비어 있습니다</b>4단계에서 질문을 먼저 만들어 주세요.<div style="margin-top:10px"><a class="btn primary" href="#/questions">4단계로 가기</a></div></div>';
    return '<div class="qpick">' + qs.map(function (q) {
      return '<button class="' + (cur === q.id ? "on" : "") + '" data-act="pick" data-id="' + esc(q.id) + '"><span>' + (q.star ? "★ " : "") + esc(q.text) + '</span><span class="st">' + (answered(st, q) ? '<span class="tag ok">작성</span>' : '<span class="tag">' + MJ.KINDS[q.kind] + "</span>") + "</span></button>";
    }).join("") + "</div>";
  }

  var flushNow = function () { };
  window.addEventListener("pagehide", function () { flushNow(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flushNow(); });

  function slotHtml(s, ans) {
    var v = (ans.slots[s.key] || "");
    return '<div class="slot ' + (s.reserve ? "reserve" : "") + '"><div class="slot-head"><b><span class="slot-no">' + (s.reserve ? "+" : s._no) + "</span>" + esc(s.label) + (s.reserve ? ' <span class="tag warn">꼬리질문 대비 · 말하지 않고 남겨 둠</span>' : "") + '</b><small><span data-sec="' + s.key + '">0</span>초 / 권장 ' + s.sec + '초</small></div><p class="hint">' + esc(s.hint) + '</p><textarea class="in" data-slot="' + s.key + '" placeholder="' + esc(s.starter || "") + '">' + esc(v) + "</textarea></div>";
  }

  function editor(el, st, q) {
    var ans = st.answers[q.id] || { kind: q.kind || MJ.a.guessKind(q.text), slots: {}, keywords: [], tails: {} };   // 입력이 생길 때 저장소에 넣는다
    ans.tails = ans.tails || {}; ans.keywords = ans.keywords || [];
    var f = MJ.a.frame(ans.kind), qs = ordered(st), idx = qs.map(function (x) { return x.id; }).indexOf(q.id);
    f.slots.forEach(function (sl, i) { sl._no = i + 1; });
    var rec = MJ.store.record(), srcItem = q.src && q.src.type === "item" ? rec.filter(function (x) { return x.id === q.src.ref; })[0] : null;
    var ex = (MJ.content.coach.examples || []).filter(function (e) { return e.kind === ans.kind; })[0];
    var draft = "";
    BUILDER_OF.forEach(function (b) { if (b[0].test(q.tpl || "") && st.builders && st.builders[b[1]]) { var arr = st.builders[b[1]], steps = ((MJ.content.coach.builders || {})[b[1]] || {}).steps || [], last = arr[steps.length ? steps.length - 1 : arr.length - 1]; if (last) draft = last; } });

    var h = '<div class="card"><div class="row between"><a class="btn sm ghost" href="#/answers">' + MJ.icon("back", 15) + ' 질문 고르기로</a><div class="row"><button class="btn sm" data-act="nav" data-d="-1"' + (idx <= 0 ? " disabled" : "") + '>이전</button><span class="small mute">' + (idx + 1) + " / " + qs.length + '</span><button class="btn sm" data-act="nav" data-d="1"' + (idx >= qs.length - 1 ? " disabled" : "") + ">다음</button></div></div>" +
      '<div class="row" style="gap:5px;margin-top:12px">' + MJ.factorTag(q.factor) + MJ.depthTag(q.depth) + (q.star ? '<span class="tag warn">★ 별표</span>' : "") + '<span class="grow"></span><span class="savestate" id="saveState">입력하면 자동으로 저장됩니다</span></div><div class="qhead">' + esc(q.text) + "</div>" +
      (q.purpose ? '<div class="qp small mute"><b style="color:var(--ink2)">면접관의 의도</b> ' + esc(q.purpose) + "</div>" : "") +
      (srcItem ? '<div class="srcbox"><b>학생부 문장' + (srcItem.subject ? " · " + esc(srcItem.subject) : "") + "</b>" + esc(srcItem.text) + "</div>" : "") +
      (q.guide ? '<details class="acc" style="margin-top:10px"><summary>이 질문은 이렇게 준비하세요</summary><div class="acc-body"><ul>' + q.guide.map(function (g) { return "<li>" + esc(g) + "</li>"; }).join("") + "</ul>" + (q.avoid ? '<h3 style="font-size:14px;margin-top:8px">피할 것</h3><ul>' + q.avoid.map(function (g) { return "<li>" + esc(g) + "</li>"; }).join("") + "</ul>" : "") + "</div></details>" : "") + "</div>";

    h += '<div class="split"><div><div class="card flat"><div class="row between"><div><b>답변 구조: ' + esc(f.name) + '</b><div class="small mute">' + esc(f.when) + '</div></div><select class="in" id="kindSel" style="width:auto">' + Object.keys(MJ.KINDS).map(function (k) { return '<option value="' + k + '"' + (k === ans.kind ? " selected" : "") + ">" + MJ.KINDS[k] + " 질문</option>"; }).join("") + "</select></div></div>";
    if (draft) h += '<div class="callout small"><b class="t">만들기 도구에서 쓴 초안</b>' + esc(draft) + "</div>";
    h += f.slots.map(function (s) { return slotHtml(s, ans); }).join("");
    h += '<p class="hint">' + esc(f.shorten || "") + "</p>";
    if (ex) h += '<details class="acc"><summary>같은 유형의 답을 다듬은 예시 보기</summary><div class="acc-body"><p class="small mute">' + esc(ex.question) + '</p><div class="ba"><div class="b"><h4>처음 쓴 답</h4>' + esc(ex.before) + '</div><div class="a"><h4>다듬은 답</h4>' + esc(ex.after) + '</div></div><ul style="margin-top:10px">' + ex.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + '</ul><p class="src">가상의 예시입니다. 내용을 따라 쓰지 말고 무엇이 달라졌는지만 보세요.</p></div></details>';
    if (q.tails && q.tails.length) {
      h += '<div class="card flat"><h3>꼬리질문에도 한 줄씩 답해 보세요</h3>' + q.tails.map(function (t, i) { return '<div class="field"><label class="f">' + esc(t) + '</label><input class="in" data-tail="' + i + '" value="' + esc(ans.tails[i] || "") + '" placeholder="핵심만 한 줄로"></div>'; }).join("") + "</div>";
    }
    h += '</div><div><div class="card flat" id="checkPanel" style="position:sticky;top:calc(var(--top) + var(--stepbar) + 12px)"><h3>말하면 몇 초일까</h3><div class="row between small"><b id="totSec">0초</b><span class="mute">권장 ' + MJ.a.targetSec(ans.kind) + '초 안팎 · 최대 70초</span></div><div class="meter" style="margin:6px 0 14px"><i id="totBar" style="width:0"></i></div>' +
      '<h3>문장 점검</h3><div class="checks" id="checks"></div>' +
      '<h3 style="margin-top:16px">키워드만 남기기</h3><p class="hint">연습할 때는 글을 덮고 키워드만 봅니다. 답변에서 낱말을 서너 개 눌러 고르세요.</p><div class="kwwords" id="kwWords"></div>' +
      '<div class="notecard" style="margin-top:12px"><h4>키워드 카드</h4><div class="ks" id="kwCard"></div></div>' +
      '<div class="row end" style="margin-top:12px"><a class="btn sm primary" href="#/practice?q=' + esc(q.id) + '">이 질문 소리 내어 연습 ' + MJ.icon("arrow", 15) + "</a></div></div></div></div>";
    h += '<div class="mbar"><b id="mSec">0초</b><div class="meter"><i id="mBar" style="width:0"></i></div><button class="btn sm" data-act="tocheck">점검 <span id="mIssue"></span></button></div>';
    el.querySelector("#ansBody").innerHTML = h;
    el.classList.add("has-mbar");

    var body = el.querySelector("#ansBody"), saveT = null;
    function refresh() {
      f.slots.forEach(function (s) { var x = body.querySelector('[data-sec="' + s.key + '"]'); if (x) x.textContent = Math.round(MJ.a.estSec(ans.slots[s.key] || "")); });
      var sec = MJ.a.totalSec(ans), bar = body.querySelector("#totBar");
      body.querySelector("#totSec").textContent = "약 " + Math.round(sec) + "초";
      bar.style.width = MJ.clamp(sec / 90 * 100, 0, 100) + "%"; bar.className = sec > 90 ? "over" : sec > 70 ? "long" : "";
      var cks = MJ.a.check(ans), issues = cks.filter(function (c) { return c.lv === "bad" || c.lv === "red"; }).length;
      var mb = body.querySelector("#mBar"); mb.style.width = bar.style.width; mb.className = bar.className;
      body.querySelector("#mSec").textContent = "약 " + Math.round(sec) + "초";
      body.querySelector("#mIssue").textContent = issues ? issues + "건" : "통과";
      body.querySelector("#checks").innerHTML = cks.map(function (c) { return '<div class="check ' + (c.lv === "info" ? "" : c.lv) + '"><span class="d">' + (c.lv === "ok" ? "✓" : c.lv === "info" ? "i" : "!") + "</span><span>" + esc(c.text) + "</span></div>"; }).join("");
      var words = MJ.a.words(MJ.a.joined(ans)), seen = {};
      body.querySelector("#kwWords").innerHTML = words.length ? words.map(function (w) { var s = MJ.a.stem(w); return '<button type="button" class="kw ' + (ans.keywords.indexOf(s) >= 0 ? "on" : "") + '" aria-pressed="' + (ans.keywords.indexOf(s) >= 0) + '" data-act="kw" data-w="' + esc(s) + '">' + esc(w) + "</button>"; }).join(" ") : '<span class="mute small">답변을 쓰면 낱말이 나타납니다.</span>';
      ans.keywords = ans.keywords.filter(function (k) { if (seen[k]) return false; seen[k] = 1; return words.some(function (w) { return MJ.a.stem(w) === k; }); });
      body.querySelector("#kwCard").innerHTML = ans.keywords.length ? ans.keywords.map(function (k) { return '<span class="tag navy" style="font-size:14px;padding:4px 12px">' + esc(k) + "</span>"; }).join("") : '<span class="mute small">아직 고른 키워드가 없습니다.</span>';
    }
    var ss = body.querySelector("#saveState");
    function save() {
      if (!st.answers[q.id]) st.answers[q.id] = ans;
      ans.updated = Date.now(); clearTimeout(saveT);
      if (ss) { ss.textContent = "저장하는 중"; ss.classList.remove("on"); }
      saveT = setTimeout(function () { saveT = null; MJ.store.save(); if (ss) { ss.textContent = "✓ 이 기기에 저장됨"; ss.classList.add("on"); } }, 400);
    }
    /* 새로 고침·탭 닫기·앱 전환 직전에 남은 저장을 바로 한다 */
    flushNow = function () { if (saveT) { clearTimeout(saveT); saveT = null; MJ.store.save(); } };
    function grow(t) { t.style.height = "auto"; t.style.height = Math.max(84, t.scrollHeight + 2) + "px"; }
    body.querySelectorAll("textarea[data-slot]").forEach(grow);
    body.addEventListener("input", function (e) {
      var t = e.target;
      if (t.tagName === "TEXTAREA") grow(t);
      if (t.hasAttribute("data-slot")) { ans.slots[t.getAttribute("data-slot")] = t.value; save(); refresh(); }
      else if (t.hasAttribute("data-tail")) { ans.tails[t.getAttribute("data-tail")] = t.value; save(); }
    });
    body.querySelector("#kindSel").addEventListener("change", function (e) {
      var oldKeys = MJ.a.frame(ans.kind).slots.map(function (s) { return s.key; });
      var texts = oldKeys.map(function (k) { return (ans.slots[k] || "").trim(); }).filter(Boolean);
      ans.kind = e.target.value; q.kind = ans.kind;
      var newKeys = MJ.a.frame(ans.kind).slots.map(function (s) { return s.key; });
      if (texts.length) {
        oldKeys.forEach(function (k) { if (newKeys.indexOf(k) < 0) delete ans.slots[k]; });
        var free = newKeys.filter(function (k) { return !(ans.slots[k] || "").trim(); });
        texts.forEach(function (t, i) {
          if (newKeys.some(function (k) { return ans.slots[k] === t; })) return;
          var k = free[Math.min(i, free.length - 1)];
          if (k) ans.slots[k] = ans.slots[k] ? ans.slots[k] + "\n" + t : t;
        });
        MJ.toast("써 둔 내용을 새 구조의 칸으로 순서대로 옮겼습니다. 칸에 맞게 다듬어 보세요.");
      }
      if (st.answers[q.id] || texts.length) st.answers[q.id] = ans;
      MJ.store.save(); MJ.rerender();
    });
    refresh();
    return {
      kw: function (t) { var w = t.getAttribute("data-w"), i = ans.keywords.indexOf(w); if (i >= 0) ans.keywords.splice(i, 1); else { if (ans.keywords.length >= 6) { MJ.toast("키워드는 여섯 개까지 고를 수 있습니다. 서너 개가 알맞습니다."); return; } ans.keywords.push(w); } save(); refresh(); },
      nav: function (t) { var n = qs[idx + (+t.getAttribute("data-d"))]; if (n) { MJ.store.save(); MJ.go("#/answers?q=" + n.id); } },
      tocheck: function () { var x = body.querySelector("#checkPanel"); if (x) x.scrollIntoView({ behavior: "smooth", block: "start" }); }
    };
  }

  function learnHtml() {
    var C = MJ.content.coach, h = '<div class="card"><h2>답변의 세 가지 원칙</h2><div class="grid g3">' + C.principles.map(function (p, i) { return '<div><span class="num">' + (i + 1) + '</span><h3 style="margin-top:8px">' + esc(p.title) + '</h3><p class="small">' + esc(p.text) + "</p></div>"; }).join("") + "</div></div>";
    h += '<div class="card"><h2>질문 유형에 따라 순서가 달라집니다</h2><p>구조는 외워서 재생하는 답안이 아니라 생각을 정리하는 순서입니다. 질문이 무엇을 묻는지에 따라 네 가지 가운데 하나를 고릅니다.</p>';
    Object.keys(C.frames).forEach(function (k) {
      var f = C.frames[k];
      h += '<details class="acc"><summary><span><b>' + MJ.KINDS[k] + " 질문</b> · " + esc(f.name) + '</span></summary><div class="acc-body"><p class="small mute">' + esc(f.when) + '</p><div class="table-wrap"><table class="t"><thead><tr><th>순서</th><th>무엇을 말하나</th><th>권장</th><th>이렇게 시작</th></tr></thead><tbody>' +
        f.slots.map(function (s) { return "<tr><td><b>" + esc(s.label) + "</b>" + (s.reserve ? '<br><span class="tag warn">남겨 둠</span>' : "") + "</td><td>" + esc(s.hint) + "</td><td>" + s.sec + "초</td><td class=\"small mute\">" + esc(s.starter || "") + "</td></tr>"; }).join("") + '</tbody></table></div><p class="hint">' + esc(f.shorten || "") + "</p></div></details>";
    });
    h += "</div>";
    h += '<div class="card"><h2>평범한 답을 다듬으면</h2><p>모두 새로 쓴 가상의 예시입니다. 내용을 따라 하지 말고, 무엇이 달라졌는지만 보세요.</p>' + C.examples.map(function (e) {
      return '<details class="acc"><summary><span><span class="tag">' + MJ.KINDS[e.kind] + "</span> " + esc(e.question) + '</span></summary><div class="acc-body"><div class="ba"><div class="b"><h4>처음 쓴 답</h4>' + esc(e.before) + '</div><div class="a"><h4>다듬은 답</h4>' + esc(e.after) + '</div></div><h3 style="font-size:14px;margin-top:12px">무엇이 달라졌나</h3><ul>' + e.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div></details>";
    }).join("") + "</div>";
    var kg = C.keywordGuide;
    h += '<div class="card"><h2>' + esc(kg.title) + "</h2><p>" + esc(kg.text) + "</p><ol>" + kg.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></div>";
    return h;
  }
  function buildHtml(st, key) {
    var B = MJ.content.coach.builders, keys = Object.keys(B), b = B[key] || B[keys[0]];
    key = B[key] ? key : keys[0];
    st.builders = st.builders || {}; var vals = st.builders[key] || (st.builders[key] = []);
    var names = { motive: "지원동기", intro: "자기소개", last: "마지막 말", weak: "약점 답변" };
    var h = '<div class="chips" style="margin-bottom:12px">' + keys.map(function (k) { return '<button class="chip ' + (k === key ? "on" : "") + '" data-act="bsel" data-k="' + k + '">' + (names[k] || k) + "</button>"; }).join("") + "</div>";
    h += '<div class="card"><h2>' + esc(b.title || names[key]) + "</h2>" + (b.lead ? "<p>" + esc(b.lead) + "</p>" : "") + b.steps.map(function (s, i) {
      return '<div class="slot"><div class="slot-head"><b><span class="num" style="display:inline-grid;margin-right:8px">' + (i + 1) + "</span>" + esc(s.title) + '</b><small><span data-bsec="' + i + '"></span></small></div><p style="margin-bottom:6px">' + esc(s.ask) + '</p><p class="hint">' + esc(s.hint) + '</p><textarea class="in" data-b="' + i + '" placeholder="' + esc(s.placeholder || "") + '">' + esc(vals[i] || "") + "</textarea></div>";
    }).join("") + '<p class="hint">마지막 칸에 쓴 문장은 질문함의 해당 질문 답변 화면에 초안으로 함께 보입니다.</p></div>';
    return { html: h, key: key };
  }
  function emergHtml() {
    var C = MJ.content.coach;
    return '<div class="card"><h2>막혔을 때 쓸 수 있는 말</h2><p>면접에서는 누구나 한두 번 막힙니다. 그때 쓸 문장을 미리 입에 붙여 두면 당황하는 시간이 줄어듭니다.</p>' + C.emergency.map(function (e) {
      return '<div class="mist"><span class="num">' + MJ.icon("info", 15) + "</span><div><b>" + esc(e.situation) + '</b><div class="callout" style="margin:6px 0">“' + esc(e.line) + '”</div><p class="small mute">' + esc(e.tip) + "</p></div></div>";
    }).join("") + "</div>";
  }

  MJ.register("answers", {
    title: "5단계 답변 설계하기",
    render: function (el, r) {
      var st = MJ.store.get(), tab = r.q.tab || "write", qid = r.q.q || "";
      var tabs = [["write", "답변 쓰기"], ["learn", "구조 익히기"], ["build", "만들기 도구"], ["emerg", "막혔을 때"]];
      var h = MJ.stepHead("answers") + '<div class="tabs">' + tabs.map(function (t) { return '<button class="tab ' + (tab === t[0] ? "on" : "") + '" data-act="tab" data-t="' + t[0] + '">' + t[1] + "</button>"; }).join("") + '</div><div id="ansBody"></div>' + MJ.stepNav("answers");
      el.innerHTML = h;
      var body = el.querySelector("#ansBody"), ed = null, bkey = r.q.b || "motive";
      if (tab === "write") {
        var q = st.questions.filter(function (x) { return x.id === qid; })[0];
        if (q) ed = editor(el, st, q);
        else {
          var n = st.questions.filter(function (x) { return !x.hidden; }).length, na = st.questions.filter(function (x) { return !x.hidden && answered(st, x); }).length;
          var pf = r.q.pf || "";
          body.innerHTML = '<div class="card"><div class="card-head"><h2>답을 쓸 질문 고르기</h2><span class="sub">작성 ' + na + " / " + n + '</span></div>' + (n ? '<div class="meter" style="margin-bottom:12px"><i style="width:' + (na / n * 100).toFixed(0) + '%"></i></div>' : "") + '<p>별표를 붙인 질문이 위에 옵니다. 모든 질문에 답을 쓸 필요는 없습니다. 별표 질문과 공통 질문부터 쓰세요.</p>' +
            (n ? '<div class="chips" style="margin-bottom:10px">' + [["", "전체"], ["star", "별표"], ["todo", "아직 안 쓴 질문"], ["done", "쓴 질문"]].map(function (x) { return '<button class="chip ' + (pf === x[0] ? "on" : "") + '" data-act="pf" data-f="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>" : "") + pickList(st, "", pf) + '</div><div class="callout tip"><b class="t">글은 생각을 정리하려고 씁니다</b>여기서 쓴 답은 외울 대본이 아닙니다. 순서를 잡고 군더더기를 덜어 낸 뒤, 키워드만 남겨 말로 연습합니다.</div>';
        }
      } else if (tab === "learn") body.innerHTML = learnHtml();
      else if (tab === "build") { var bb = buildHtml(st, bkey); body.innerHTML = bb.html; bkey = bb.key; }
      else body.innerHTML = emergHtml();

      body.addEventListener("input", function (e) {
        var t = e.target; if (!t.hasAttribute("data-b")) return;
        st.builders[bkey][+t.getAttribute("data-b")] = t.value;
        var x = body.querySelector('[data-bsec="' + t.getAttribute("data-b") + '"]'); if (x) x.textContent = t.value.trim() ? "말하면 약 " + Math.round(MJ.a.estSec(t.value)) + "초" : "";
        clearTimeout(body._t); body._t = setTimeout(function () { MJ.store.save(); }, 400);
      });
      MJ.on(el, "click", {
        tab: function (t) { MJ.go("#/answers?tab=" + t.getAttribute("data-t")); },
        pick: function (t) { MJ.go("#/answers?q=" + t.getAttribute("data-id")); },
        pf: function (t) { MJ.go("#/answers" + (t.getAttribute("data-f") ? "?pf=" + t.getAttribute("data-f") : "")); },
        tocheck: function () { if (ed) ed.tocheck(); },
        bsel: function (t) { MJ.go("#/answers?tab=build&b=" + t.getAttribute("data-k")); },
        kw: function (t) { if (ed) ed.kw(t); },
        nav: function (t) { if (ed) ed.nav(t); }
      });
    },
    leave: function () { flushNow(); flushNow = function () { }; MJ.store.save(); }
  });
})();
