/* 1단계 면접 바로 알기 + 통계 그림 공용 */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;

  /* ───────── 통계 그림(여러 화면에서 쓴다) ───────── */
  /* 출처·참고는 바닥글에만 적는다. 그림 아래에는 표본 수만 남긴다. */
  function srcLine(S, metric, n) {
    return n != null ? '<p class="src">표본 ' + Number(n).toLocaleString() + "건</p>" : "";
  }
  function distBars(d, order, cls) {
    var keys = order || Object.keys(d).sort(function (a, b) { return d[b] - d[a]; });
    return MJ.bars(keys.filter(function (k) { return d[k] != null; }).map(function (k) { return { label: k, v: d[k], cls: cls }; }), { max: 1 });
  }
  var R = {
    time: function (G, S) {
      if (!G.time) return "";
      return '<div class="kpis"><div class="kpi"><b>' + G.time.med + '분</b><span>면접 시간 중앙값</span></div>' + (G.time.q1 === G.time.q3 ? "" : '<div class="kpi"><b>' + G.time.q1 + "~" + G.time.q3 + "분</b><span>절반이 이 범위</span></div>") + "</div>" + srcLine(S, "time", G.time.n);
    },
    panel: function (G, S) {
      if (!G.panel) return "";
      var d = G.panel.d;
      return distBars({ "1명": d["1"], "2명": d["2"], "3명": d["3"], "4명 이상": d["4+"] }, ["1명", "2명", "3명", "4명 이상"]) + srcLine(S, "panel", G.panel.n);
    },
    qcount: function (G, S) {
      if (!G.qcount) return "";
      return '<div class="kpis"><div class="kpi"><b>' + G.qcount.med + '개</b><span>한 번의 면접에서 받은 질문(중앙값)</span></div></div>' + srcLine(S, "qcount", G.qcount.n);
    },
    preopen: function (G, S) {
      if (!G.preopen) return "";
      return distBars({ "미리 알려 주지 않음": 1 - G.preopen.open, "일부 또는 전부 미리 공개": G.preopen.open }, null, "n") + srcLine(S, "preopen", G.preopen.n);
    },
    form: function (G, S) { return G.form ? distBars(G.form.d) + srcLine(S, "form", G.form.n) : ""; },
    content: function (G, S) { return G.content ? distBars(G.content.d, ["서류기반", "인성", "제시문"]) + '<p class="src">한 면접에 여러 내용이 함께 표기될 수 있어 합이 100%를 넘습니다.</p>' + srcLine(S, "content", G.content.n) : ""; },
    qtypes: function (G, S, top) {
      if (!G.qtypes) return "";
      var r = G.qtypes.r, keys = Object.keys(r).sort(function (a, b) { return r[b] - r[a]; }).slice(0, top || 10);
      return MJ.bars(keys.map(function (k) { return { label: k, v: r[k] }; }), { max: Math.max(0.5, r[keys[0]]) }) + '<p class="src">후기 한 건에 그 유형의 질문이 한 번 이상 나온 비율입니다.</p>' + srcLine(S, "qtypes", G.qtypes.n);
    }
  };
  MJ.stat = {
    R: R, srcLine: srcLine,
    block: function (ref, S) {
      var G = S.global;
      switch (ref) {
        case "global.time": return R.time(G, S);
        case "global.panel": return R.panel(G, S);
        case "global.qcount": return R.qcount(G, S);
        case "global.preopen": return R.preopen(G, S);
        case "global.qtypes": return R.qtypes(G, S, 10);
        case "global.form": return R.form(G, S);
        case "byType.content":
          return '<div class="grid g2">' + ["종합", "교과"].map(function (t) {
            var g = S.byType[t]; if (!g || !g.content) return "";
            return '<div><h3>학생부' + t + "전형</h3>" + distBars(g.content.d, ["서류기반", "인성", "제시문"], t === "교과" ? "a" : "") + '<p class="src">표본 ' + g.content.n.toLocaleString() + "건</p></div>";
          }).join("") + '</div><p class="src">한 면접에 여러 내용이 함께 표기될 수 있어 합이 100%를 넘습니다.</p>';
        case "byTrack.qtypes":
          var rows = MJ.TRACKS.map(function (t) {
            var g = S.byTrack[t]; if (!g || !g.qtypes) return "";
            var r = g.qtypes.r, keys = Object.keys(r).sort(function (a, b) { return r[b] - r[a]; }).slice(0, 4);
            return "<tr><td><b>" + t + '</b></td><td data-l="자주 나온 질문 유형(상위 4개)"><div class="chips" style="gap:5px">' + keys.map(function (k) { return '<span class="tag teal">' + esc(k) + " " + MJ.pct(r[k]) + "</span>"; }).join("") + '</div></td><td class="mute small" data-l="표본">' + g.qtypes.n.toLocaleString() + "건</td></tr>";
          }).join("");
          return '<div class="table-wrap stack"><table class="t"><thead><tr><th>계열</th><th>자주 나온 질문 유형(상위 4개)</th><th>표본</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
        case "advice":
          return MJ.bars((S.advice || []).slice(0, 8).map(function (a) { return { label: a.label, v: a.r, cls: "g" }; }), { max: Math.max(0.3, (S.advice[0] || {}).r || 0.3) }) + '<p class="src">선배들이 후배에게 남긴 당부 글에서 주제가 언급된 비율입니다.</p>' + srcLine(S, "advice");
      }
      return "";
    }
  };

  /* ───────── 본문 블록 ───────── */
  function block(b) {
    switch (b.type) {
      case "p": return "<p>" + esc(b.text) + "</p>";
      case "list": return "<ul>" + b.items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>";
      case "table": return '<div style="margin:10px 0 14px">' + MJ.table(b.head.map(esc), b.rows.map(function (r) { return r.map(function (c, i) { return i === 0 ? "<b>" + esc(c) + "</b>" : esc(c); }); })) + "</div>";
      case "callout": return '<div class="callout ' + (b.tone === "info" ? "" : esc(b.tone)) + '"><b class="t">' + esc(b.title) + "</b>" + esc(b.text) + "</div>";
      case "stat": return '<div class="statbox card flat" data-stat="' + esc(b.ref) + '"><p class="mute small">통계를 불러오는 중입니다.</p></div>';
    }
    return "";
  }

  function quizHtml(st) {
    return '<section class="card sec" id="sec-quiz"><div class="card-head"><h2>3분 OX 진단: 면접 상식 10문항</h2>' + (st.quiz ? '<span class="tag ok">지난 결과 ' + st.quiz.score + " / " + st.quiz.total + "</span>" : "") + "</div><div id=\"quizBox\"></div></section>";
  }
  function runQuiz(box) {
    var items = MJ.content.know.quiz, i = 0, score = 0, wrong = [];
    function ask() {
      if (i >= items.length) return end();
      var q = items[i];
      box.innerHTML = '<div class="quiz-prog"><i style="width:' + (i / items.length * 100) + '%"></i></div><p class="mute small">' + (i + 1) + " / " + items.length + '</p><p class="quiz-q">' + esc(q.q) + '</p><div class="quiz-ox"><button class="btn" data-a="1">O</button><button class="btn" data-a="0">X</button></div><div id="quizWhy"></div>';
      box.querySelectorAll("[data-a]").forEach(function (b) {
        b.addEventListener("click", function () {
          var ans = b.getAttribute("data-a") === "1", ok = ans === q.a;
          if (ok) score++; else wrong.push(q);
          box.querySelectorAll("[data-a]").forEach(function (x) { x.disabled = true; });
          box.querySelector("#quizWhy").innerHTML = '<div class="callout ' + (ok ? "tip" : "warn") + '" style="margin-top:14px"><b class="t">' + (ok ? "맞습니다." : "아닙니다.") + " 정답은 " + (q.a ? "O" : "X") + "</b>" + esc(q.why) + '</div><div class="row end"><button class="btn primary" id="quizNext">' + (i + 1 < items.length ? "다음" : "결과 보기") + "</button></div>";
          box.querySelector("#quizNext").addEventListener("click", function () { i++; ask(); });
          box.querySelector("#quizNext").focus();
        });
      });
    }
    function end() {
      var st = MJ.store.get();
      st.quiz = { score: score, total: items.length, at: MJ.iso(MJ.today()) };
      MJ.store.mark("know", 2); MJ.store.save();
      box.innerHTML = '<div class="kpis"><div class="kpi"><b>' + score + " / " + items.length + "</b><span>맞힌 문항</span></div></div>" +
        (wrong.length ? '<h3>다시 볼 내용</h3><ul>' + wrong.map(function (q) { return "<li><b>" + esc(q.q) + "</b> → 정답 " + (q.a ? "O" : "X") + ". " + esc(q.why) + "</li>"; }).join("") + "</ul>" : '<p style="margin-top:10px">모두 맞혔습니다. 모두 맞혔습니다. 2단계에서 지원 대학의 면접 방식을 확인하세요.</p>') +
        '<div class="row" style="margin-top:14px"><button class="btn" id="quizAgain">다시 풀기</button><a class="btn primary" href="#/univ">2단계로 가기 ' + MJ.icon("arrow") + "</a></div>";
      box.querySelector("#quizAgain").addEventListener("click", function () { i = 0; score = 0; wrong = []; ask(); });
    }
    box.innerHTML = '<p>면접에 대한 말 10가지입니다. 맞으면 O, 틀리면 X를 누르세요. 풀고 나면 어디부터 읽어야 할지 보입니다.</p><button class="btn primary" id="quizStart">시작하기</button>';
    box.querySelector("#quizStart").addEventListener("click", ask);
  }

  function blindHtml() {
    var b = MJ.content.know.blind;
    var rows = b.never.map(function (n) {
      var parts = String(n.example).split("→");
      return "<tr><td><b>" + esc(n.label) + '</b></td><td data-l="피할 말">' + esc((parts[0] || "").replace(/^피할 말:\s*/, "").trim()) + '</td><td data-l="바꿔 말하기">' + esc((parts[1] || "").replace(/^\s*바꿔 말하기:\s*/, "").trim()) + "</td></tr>";
    }).join("");
    return '<section class="card sec prose" id="sec-blind"><h2>블라인드 면접 규정</h2><p class="lead">대부분의 대학이 면접에서 지원자의 신상을 가립니다. 아래 내용을 말하거나 드러내면 불이익을 받을 수 있습니다.</p>' +
      '<div class="table-wrap stack"><table class="t"><thead><tr><th>드러내면 안 되는 것</th><th>피할 말</th><th>바꿔 말하기</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="grid g2" style="margin-top:14px"><div><h3>입어도 되는 옷</h3><ul>' + b.dress.ok.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div><div><h3>피해야 할 옷·소지품</h3><ul>" + b.dress.ng.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div></div>" +
      '<div class="callout warn">' + esc(b.note) + "</div></section>";
  }

  MJ.register("know", {
    title: "1단계 면접 바로 알기",
    render: function (el, r) {
      var K = MJ.content.know, st = MJ.store.get();
      MJ.store.mark("know", 1);
      var toc = K.sections.map(function (s) { return '<button class="chip" data-act="jump" data-id="sec-' + s.id + '">' + esc(s.title) + "</button>"; }).join("") +
        '<button class="chip" data-act="jump" data-id="sec-blind">블라인드 규정</button><button class="chip" data-act="jump" data-id="sec-quiz">3분 진단</button>';
      var chars = 0; K.sections.forEach(function (s) { s.blocks.forEach(function (b) { chars += (b.text || "").length + (b.items || []).join("").length + (b.rows || []).join("").length; }); });
      var h = MJ.stepHead("know", "무엇을 평가하는지, 내 전형은 어떤 유형인지 · 읽는 데 약 " + Math.max(5, Math.round(chars / 600)) + "분") + '<div class="toc" id="toc">' + toc + "</div>";
      K.sections.forEach(function (s) {
        h += '<section class="card sec prose" id="sec-' + s.id + '"><h2>' + esc(s.title) + '</h2><p class="lead">' + esc(s.lead) + "</p>" + s.blocks.map(block).join("") + "</section>";
        if (s.id === "types") h += blindHtml();
      });
      h += quizHtml(st);
      h += '<div class="card flat"><div class="row between"><span>여기까지 읽었다면 1단계를 마친 것으로 표시하세요.</span><button class="btn ' + (st.progress.know >= 2 ? "" : "primary") + '" data-act="done">' + (st.progress.know >= 2 ? "완료로 표시됨" : "1단계 완료로 표시") + "</button></div></div>";
      h += MJ.stepNav("know");
      el.innerHTML = h;
      runQuiz(el.querySelector("#quizBox"));
      MJ.on(el, "click", {
        jump: function (t) { var x = document.getElementById(t.getAttribute("data-id")); if (x) x.scrollIntoView({ behavior: "smooth", block: "start" }); },
        done: function (t) { MJ.store.mark("know", 2); t.textContent = "완료로 표시됨"; t.classList.remove("primary"); MJ.toast("1단계를 완료로 표시했습니다."); }
      });
      MJ.load("stats").then(function (S) {
        el.querySelectorAll("[data-stat]").forEach(function (box) { box.innerHTML = MJ.stat.block(box.getAttribute("data-stat"), S) || '<p class="mute small">표본이 부족해 표시하지 않습니다.</p>'; });
      }).catch(function () {
        el.querySelectorAll("[data-stat]").forEach(function (box) { box.innerHTML = '<p class="mute small">통계 자료를 불러오지 못했습니다.</p>'; });
      });
      if (r.q.quiz) setTimeout(function () { var x = document.getElementById("sec-quiz"); if (x) x.scrollIntoView({ block: "start" }); }, 60);
      /* 읽고 있는 곳을 차례 줄에 표시 */
      if (window.IntersectionObserver) {
        var chips = {}; el.querySelectorAll("#toc [data-id]").forEach(function (c) { chips[c.getAttribute("data-id")] = c; });
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (!e.isIntersecting) return;
            Object.keys(chips).forEach(function (k) { chips[k].classList.toggle("cur", k === e.target.id); });
            var c = chips[e.target.id], bar = el.querySelector("#toc");
            if (c && bar) bar.scrollLeft = c.offsetLeft - bar.clientWidth / 2 + c.clientWidth / 2;
          });
        }, { rootMargin: "-30% 0px -60% 0px" });
        el.querySelectorAll(".sec").forEach(function (s) { io.observe(s); });
        this._io = io;
      }
    },
    leave: function () { if (this._io) { this._io.disconnect(); this._io = null; }
    }
  });
})();
