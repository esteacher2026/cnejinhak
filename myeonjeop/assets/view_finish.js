/* 점검·마무리: 체크리스트, 흔한 실수, 마음 다스리기 */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;

  function cl(items, st) {
    return '<div class="cl">' + items.map(function (i) {
      var on = !!st.checks[i.id];
      return '<label class="' + (on ? "on" : "") + '"><input type="checkbox" data-ck="' + i.id + '"' + (on ? " checked" : "") + "><span>" + esc(i.text) + (i.why ? "<small>" + esc(i.why) + "</small>" : "") + "</span></label>";
    }).join("") + "</div>";
  }
  function count(items, st) { return items.filter(function (i) { return st.checks[i.id]; }).length + " / " + items.length; }

  MJ.register("finish", {
    title: "점검·마무리",
    render: function (el, r) {
      var F = MJ.content.finish, st = MJ.store.get(), tab = r.q.tab || "check";
      var tabs = [["check", "체크리스트"], ["mistake", "흔한 실수 " + MJ.content.finish.mistakes.length + "가지"], ["mental", "긴장 다루기"], ["advice", "선배들의 당부"]];
      var h = '<header class="page-head"><h1>점검·마무리</h1><p>면접이 가까워지면 새로 채우기보다 빠진 것을 확인합니다.</p></header><div class="tabs">' + tabs.map(function (t) { return '<button class="tab ' + (tab === t[0] ? "on" : "") + '" data-act="tab" data-t="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>";
      if (tab === "check") {
        var up = st.targets.filter(function (t) { return t.date && MJ.dayDiff(MJ.parseDate(t.date), MJ.today()) >= 0; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
        if (up) h += '<div class="callout"><b class="t">' + esc(up.univ) + " 면접 " + MJ.dday(up.date) + "</b>" + MJ.fmtDate(up.date, true) + " · " + esc(up.adm || "") + "</div>";
        var dd = []; F.checklists.dday.forEach(function (p) { p.items.forEach(function (i) { dd.push(i); }); });
        h += '<details class="acc" open><summary><span><b>일주일 전</b></span><span class="tag">' + count(F.checklists.d7, st) + '</span></summary><div class="acc-body">' + cl(F.checklists.d7, st) + "</div></details>";
        h += '<details class="acc"><summary><span><b>전날</b></span><span class="tag">' + count(F.checklists.d1, st) + '</span></summary><div class="acc-body">' + cl(F.checklists.d1, st) + "</div></details>";
        h += '<details class="acc"><summary><span><b>면접 당일</b></span><span class="tag">' + count(dd, st) + '</span></summary><div class="acc-body">' + F.checklists.dday.map(function (p) { return '<h3 style="font-size:15px;margin:12px 0 6px">' + esc(p.phase) + "</h3>" + cl(p.items, st); }).join("") + "</div></details>";
        h += '<div class="row end" style="margin-top:12px"><button class="btn sm" data-act="reset">체크 모두 지우기</button><a class="btn sm" href="#/notes">인쇄하러 가기</a></div>';
      } else if (tab === "mistake") {
        h += '<div class="card"><p>면접 후기에서 선배들이 아쉬웠다고 적은 내용과 대학 가이드북이 경고한 내용을 모아 정리했습니다. 각각 이 안내서의 어느 단계에서 대비할 수 있는지 함께 적었습니다.</p>' + F.mistakes.map(function (m, i) {
          return '<div class="mist"><span class="num">' + (i + 1) + "</span><div><b>" + esc(m.title) + '</b><p class="small" style="margin:4px 0">' + esc(m.why) + '</p><p class="small"><span class="tag ok">이렇게</span> ' + esc(m.fix) + "</p></div></div>";
        }).join("") + "</div>";
      } else if (tab === "mental") {
        h += '<div class="grid g2">' + F.mental.map(function (m) { return '<div class="card" style="margin:0"><h3>' + esc(m.title) + "</h3><p>" + esc(m.text) + "</p></div>"; }).join("") + "</div>";
        var em = (MJ.content.coach || {}).emergency || [];
        if (em.length) h += '<div class="card" style="margin-top:16px"><h2>막혔을 때 쓸 수 있는 말</h2>' + em.map(function (e) { return "<p><b>" + esc(e.situation) + "</b><br>“" + esc(e.line) + "”</p>"; }).join("") + "</div>";
      } else {
        h += '<div class="card"><h2>선배들이 후배에게 남긴 말</h2><p>면접을 마친 선배들이 후배에게 남긴 당부를 주제별로 세었습니다. 학생부를 꼼꼼히 읽으라는 말과 긴장을 다루는 방법이 가장 많이 나왔습니다.</p><div id="adv"><p class="mute small">불러오는 중입니다.</p></div></div>';
      }
      el.innerHTML = h;
      el.addEventListener("change", function (e) {
        var t = e.target; if (!t.hasAttribute("data-ck")) return;
        if (t.checked) st.checks[t.getAttribute("data-ck")] = true; else delete st.checks[t.getAttribute("data-ck")];
        t.closest("label").classList.toggle("on", t.checked); MJ.store.save();
        /* 묶음 머리의 '체크한 수 / 전체' 를 바로 고친다 */
        var d = t.closest("details"), tag = d && d.querySelector("summary .tag");
        if (tag) { var all = d.querySelectorAll("[data-ck]"), on = d.querySelectorAll("[data-ck]:checked"); tag.textContent = on.length + " / " + all.length; }
      });
      MJ.on(el, "click", {
        tab: function (t) { MJ.go("#/finish?tab=" + t.getAttribute("data-t")); },
        reset: function () { MJ.confirm("체크한 항목을 모두 지울까요?", function () { st.checks = {}; MJ.store.save(); MJ.rerender(); }, "지우기"); }
      });
      if (tab === "advice") MJ.load("stats").then(function (S) { var b = el.querySelector("#adv"); if (b) b.innerHTML = MJ.stat.block("advice", S); }).catch(function () { });
    }
  });
})();
