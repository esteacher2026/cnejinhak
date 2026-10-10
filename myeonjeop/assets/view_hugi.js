/* 선배 후기 보기: 대학별 실제 면접 경험(받은 질문·진행 방식·당부). 답변과 고등학교 이름은 싣지 않는다. */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;
  var PAGE = 20;

  function typeName(i, idx) { return ["학생부종합", "학생부교과", "기타"][i] || idx.types[i] || ""; }
  function addQ(st, text, univ) {
    text = String(text).replace(/^↳\s*/, "");
    if (st.questions.some(function (q) { return q.text === text; })) return false;
    st.questions.push({ id: MJ.uid("q"), tpl: "", text: text, kind: MJ.a.guessKind(text), factor: "", depth: 0, intent: "", purpose: "", tails: [], src: { type: "hugi", univ: univ }, star: false, hidden: false });
    return true;
  }

  function pickHtml(idx, st) {
    var names = Object.keys(idx.u).sort(function (a, b) { return idx.u[b][1] - idx.u[a][1]; });
    var mine = st.targets.map(function (t) { return t.univ; }).filter(function (u, i, a) { return idx.u[u] && a.indexOf(u) === i; });
    var h = '<div class="card"><div class="searchbox"><label class="f" for="hq">대학 찾기</label><input class="in" id="hq" autocomplete="off" placeholder="대학 이름을 입력하세요 (예: 충남대)"><div class="sugg" id="hs" hidden></div></div>';
    if (mine.length) h += '<div class="chips" style="margin-top:10px"><span class="small mute" style="padding-top:5px">내 면접:</span>' + mine.map(function (u) { return '<a class="chip" href="#/hugi?u=' + encodeURIComponent(u) + '">' + esc(u) + " " + idx.u[u][1] + "</a>"; }).join("") + "</div>";
    h += '<details class="acc" style="margin-top:12px"><summary>후기가 많은 대학부터 보기 (' + names.length + '개)</summary><div class="acc-body"><div class="chips">' + names.slice(0, 80).map(function (u) { return '<a class="chip" href="#/hugi?u=' + encodeURIComponent(u) + '">' + esc(u) + ' <span class="x">' + idx.u[u][1] + "</span></a>"; }).join("") + "</div></div></details></div>";
    return h;
  }

  MJ.register("hugi", {
    title: "선배 후기 보기",
    render: function (el, r) {
      var st = MJ.store.get(), name = r.q.u || "";
      el.innerHTML = '<header class="page-head"><h1>선배 후기 보기</h1><p>선배들이 실제 면접에서 받은 질문과 면접 진행 방식, 후배에게 남긴 말입니다.</p></header><div id="hBody"><p class="mute small">불러오는 중입니다.</p></div>';
      MJ.load("hugi_index").then(function (idx) {
        var body = el.querySelector("#hBody"); if (!body || !el.isConnected) return;
        var notice = '<details class="acc hnote"><summary><span><b>읽기 전에</b> <span class="mute small">기억에 의존해 쓴 기록이라 실제와 다를 수 있습니다</span></span></summary><div class="acc-body small">학생이 면접을 마친 뒤 기억에 의존해 쓴 기록이라 실제와 다를 수 있습니다. 여러 지역 선배들의 후기를 모았고, 고등학교 이름·연도·출처는 가렸으며 학생이 한 답변은 싣지 않았습니다. ‘요약’ 표시가 붙은 후기는 주요 질문 몇 개와 면접 시간·면접관 수·분위기만 보여 줍니다. 같은 질문이 내 면접에 나온다는 뜻이 아니니, 질문의 흐름과 분위기를 익히는 데 쓰세요. 면접 방식은 해마다 바뀔 수 있으니 올해 모집요강으로 꼭 확인하세요.</div></details>';
        if (!name || !idx.u[name]) {
          body.innerHTML = (name ? '<div class="empty"><b>' + esc(name) + "의 후기가 없습니다</b>다른 대학을 찾아보거나, 4단계 ‘후기 속 질문’과 ‘대학 공개 질문’을 살펴보세요.</div>" : "") + pickHtml(idx, st) + notice;
          var hq = body.querySelector("#hq"), hs = body.querySelector("#hs"), all = Object.keys(idx.u);
          hq.addEventListener("input", function () {
            var v = hq.value.trim().replace(/\s+/g, ""); if (!v) { hs.hidden = true; return; }
            var hits = all.filter(function (u) { return u.replace(/\s+/g, "").indexOf(v) >= 0; }).slice(0, 12);
            hs.innerHTML = hits.map(function (u) { return '<button type="button" data-k="' + esc(u) + '"><span>' + esc(u) + "</span><small>후기 " + idx.u[u][1] + "건</small></button>"; }).join("") || '<button type="button" disabled><span class="mute">후기가 있는 대학이 아닙니다</span></button>';
            hs.hidden = false;
          });
          hs.addEventListener("click", function (e) { var b = e.target.closest("button[data-k]"); if (b) MJ.go("#/hugi?u=" + encodeURIComponent(b.getAttribute("data-k"))); });
          hq.addEventListener("keydown", function (e) { if (e.key === "Escape") { hs.hidden = true; return; } if (e.key === "Enter" && !e.isComposing && !hs.hidden) { var b = hs.querySelector("button[data-k]"); if (b) MJ.go("#/hugi?u=" + encodeURIComponent(b.getAttribute("data-k"))); } });
          return;
        }
        var meta = idx.u[name];
        return MJ.load(meta[0]).then(function (D) {
          if (!el.isConnected) return;
          var tg = st.targets.filter(function (t) { return t.univ === name; })[0];
          var mg = MJ.myMajorGroup(name);
          var h = '<div class="card"><div class="card-head"><h2>' + esc(name) + ' <span class="tag">' + meta[1].toLocaleString() + '건</span></h2><div class="row"><a class="btn sm" href="#/univ?u=' + encodeURIComponent(name) + '">대학 정보</a><a class="btn sm" href="#/hugi">다른 대학</a></div></div>' +
            '<div class="grid g2"><div class="field"><label class="f" for="hS">후기 형태</label><select class="in" id="hS"><option value="">전체</option><option value="a"' + (r.q.s === "a" ? " selected" : "") + '>자세한 후기 (진행 방식·당부 포함)</option><option value="3"' + (r.q.s === "3" ? " selected" : "") + ">짧은 요약 (주요 질문만)</option></select></div>" +
            '<div class="field"><label class="f" for="hT">전형</label><select class="in" id="hT"><option value="">전체</option><option value="0"' + (r.q.t === "0" ? " selected" : "") + '>학생부종합</option><option value="1"' + (r.q.t === "1" ? " selected" : "") + '>학생부교과</option><option value="2"' + (r.q.t === "2" ? " selected" : "") + '>기타</option></select></div>' +
            "</div><details class=\"acc hmore\"" + (r.q.m || r.q.w || window.innerWidth > 760 ? " open" : "") + '><summary><span><b>학과·질문 낱말로 찾기</b></span></summary><div class="acc-body"><div class="grid g2">' +
            '<div class="field"><label class="f" for="hM">학과</label><input class="in" id="hM" placeholder="학과 이름 일부 (예: 간호)" value="' + esc(r.q.m != null ? r.q.m : "") + '"></div>' +
            '<div class="field"><label class="f" for="hW">질문 낱말</label><input class="in" id="hW" placeholder="받은 질문에서 찾기 (예: 동아리)" value="' + esc(r.q.w || "") + '"></div></div>' +
            "</div></div></details>" + (mg ? '<label class="ckline small"><input type="checkbox" id="hG"' + (r.q.g === "0" ? "" : " checked") + ' style="width:18px;height:18px;flex:none"> <span>내 학과군(' + esc(mg) + ')의 후기만 보기</span></label>' : "") +
            "</div>" + notice + '<div id="hR"></div>';
          body.innerHTML = h;
          var lim = PAGE;
          function rows() {
            var sv = body.querySelector("#hS").value, t = body.querySelector("#hT").value, m = body.querySelector("#hM").value.trim().replace(/\s+/g, "");
            var w = body.querySelector("#hW").value.trim().split(/\s+/).filter(Boolean), g = body.querySelector("#hG");
            var useG = g && g.checked && !m;
            return D.r.filter(function (x) {
              if (sv === "3" && x[9] !== 3) return false;
              if (sv === "a" && x[9] === 3) return false;
              if (t !== "" && x[0] !== +t) return false;
              if (m && String(x[2]).replace(/\s+/g, "").indexOf(m) < 0) return false;
              if (useG) { var gg = MJ.majorGroup(x[2]); if (!gg || gg.k !== mg) return false; }
              if (w.length) { var hay = x[6].join(" "); if (!w.every(function (k) { return hay.indexOf(k) >= 0; })) return false; }
              return true;
            });
          }
          function draw(keep) {
            if (!keep) lim = PAGE;
            var res = rows(), box = body.querySelector("#hR"), has = {};
            st.questions.forEach(function (q) { has[q.text] = 1; });
            try {
              var qp = ["u=" + encodeURIComponent(name)];
              [["s", "#hS"], ["t", "#hT"], ["m", "#hM"], ["w", "#hW"]].forEach(function (x) { var v = body.querySelector(x[1]).value.trim(); if (v) qp.push(x[0] + "=" + encodeURIComponent(v)); });
              var g = body.querySelector("#hG"); if (g && !g.checked) qp.push("g=0");
              history.replaceState(null, "", "#/hugi?" + qp.join("&"));
            } catch (e) { /* 무시 */ }
            box.innerHTML = '<p class="small mute" style="margin:4px 0 8px">' + res.length.toLocaleString() + "건</p>" + (res.length ? res.slice(0, lim).map(function (x, i) {
              var tags = [x[3], x[4] ? x[4] + "분" : "", x[5] ? "면접관 " + x[5] + "명" : ""].filter(Boolean);
              return '<article class="hcard" data-i="' + i + '"><div class="hhead"><b>' + esc(typeName(x[0], idx)) + (x[1] ? " · " + esc(x[1]) : "") + "</b>" + (x[2] ? ' <span class="tag teal">' + esc(x[2]) + "</span>" : "") + tags.map(function (k) { return ' <span class="tag">' + esc(k) + "</span>"; }).join("") + (x[9] === 3 ? ' <span class="tag warn">요약</span>' : "") + "</div>" +
                (x[6].length ? "<h4>" + (x[9] === 3 ? "주요 질문" : "받은 질문") + " " + x[6].length + "개</h4><ol class=\"hq\">" + x[6].map(function (q) {
                  var tail = /^↳/.test(q), tx = q.replace(/^↳\s*/, "");
                  return '<li class="' + (tail ? "tail" : "") + '"><span>' + (tail ? '<span class="mute">꼬리질문 · </span>' : "") + esc(tx) + "</span>" + (tail ? "" : has[tx] ? '<span class="tag ok">담김</span>' : '<button class="btn sm ghost qadd" data-act="addq" data-q="' + esc(tx) + '">담기</button>') + "</li>";
                }).join("") + "</ol>" : '<p class="small mute">질문을 따로 적지 않은 후기입니다.</p>') +
                (x[7] ? '<details class="acc"><summary>진행 방식·분위기</summary><div class="acc-body small">' + esc(x[7]).replace(/\n/g, "<br>") + "</div></details>" : "") +
                (x[8] ? '<details class="acc"><summary>후배에게 남긴 말</summary><div class="acc-body small">' + esc(x[8]).replace(/\n/g, "<br>") + "</div></details>" : "") +
                (x[6].length ? '<div class="row end" style="margin-top:8px"><button class="btn sm" data-act="addall" data-i="' + i + '">이 질문들 모두 질문함에 담기</button></div>' : "") + "</article>";
            }).join("") + (res.length > lim ? '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-act="hmore">' + Math.min(PAGE, res.length - lim) + "건 더 보기 (" + lim + " / " + res.length + ")</button></div>" : "")
              : '<div class="empty">조건에 맞는 후기가 없습니다. 학과 칸을 비우거나 ‘내 학과군 후기만 보기’를 끄고, 후기 형태·전형을 ‘전체’로 넓혀 보세요.</div>');
            cur = res;
          }
          var cur = [];
          ["#hS", "#hT", "#hG"].forEach(function (s) { var x = body.querySelector(s); if (x) x.addEventListener("change", function () { draw(); }); });
          ["#hM", "#hW"].forEach(function (s) { body.querySelector(s).addEventListener("input", function () { clearTimeout(draw.t); draw.t = setTimeout(draw, 250); }); });
          MJ.on(body, "click", {
            hmore: function () { lim += PAGE; var y0 = window.scrollY; draw(true); window.scrollTo(0, y0); },
            addq: function (t) { if (addQ(st, t.getAttribute("data-q"), name)) { MJ.store.save(); t.outerHTML = '<span class="tag ok">담김</span>'; MJ.toast("질문함에 담았습니다."); } },
            addall: function (t) {
              var x = cur[+t.getAttribute("data-i")]; if (!x) return;
              var n = 0; x[6].forEach(function (q) { if (!/^↳/.test(q) && addQ(st, q, name)) n++; });
              MJ.store.save();
              t.closest(".hcard").querySelectorAll("[data-act=addq]").forEach(function (b) { b.outerHTML = '<span class="tag ok">담김</span>'; });
              t.textContent = "담김"; t.disabled = true;   // 펼쳐 둔 칸이 접히지 않게 다시 그리지 않는다
              MJ.toast(n ? n + "개를 질문함에 담았습니다(꼬리질문 제외). 선배의 학생부에 맞춘 질문은 내 기록에 맞게 고쳐 쓰세요." : "이미 모두 담겨 있습니다.");
            }
          });
          draw();
        });
      }).catch(function (e) { var b = el.querySelector("#hBody"); if (b) b.innerHTML = '<p class="mute small">' + esc(e.message) + "</p>"; });
    }
  });
})();
