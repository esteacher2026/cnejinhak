/* 4단계 예상 질문 만들기 */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;
  var FCOL = { "학업": "var(--f-hak)", "진로": "var(--f-jin)", "공동체": "var(--f-gong)", "소통": "var(--f-so)", "신뢰": "var(--f-sin)" };
  var SRCNAME = { item: "내 학생부", common: "공통 질문", weak: "확인 필요", gajang: "‘가장’ 질문", custom: "직접 추가", official: "대학 공개 질문", bank: "후기 속 질문", hugi: "선배 후기" };

  function fillAny(text, vals) {
    return String(text).replace(/\{([a-z]+)(?:\|(을|이|은|과|으로|이라는))?\}/g, function (_, k, j) { var v = vals[k] || "○○"; return v + (j ? MJ.josa(v, j) : ""); });
  }
  function hasAnswer(st, q) { var a = st.answers[q.id]; return !!(a && Object.keys(a.slots || {}).some(function (k) { return (a.slots[k] || "").trim(); })); }

  function qcard(q, st, rec) {
    var src = q.src || {}, line = "";
    if (src.type === "item") { var it = rec.filter(function (r) { return r.id === src.ref; })[0]; line = (src.subject ? src.subject + " · " : "") + MJ.areaName(src.area) + (it ? " — " + it.text.slice(0, 70) : ""); }
    else if (src.type === "official") line = src.ref + " 공개 예시 문항";
    else if (src.type === "hugi") line = "선배 후기에서 담은 질문 · " + (src.univ || "");
    else if (src.type === "bank") line = src.univ ? "선배 후기에서 담은 질문 · " + src.univ : "후기 속 질문" + (src.track ? " · " + src.track + " 계열" : "");
    var ans = hasAnswer(st, q);
    var h = '<div class="qcard ' + (q.star ? "star " : "") + (q.hidden ? "hid" : "") + '" data-id="' + esc(q.id) + '" data-text="' + esc(q.text) + '"><div class="row between" style="flex-wrap:nowrap;align-items:flex-start"><div class="row" style="gap:5px">' +
      MJ.factorTag(q.factor) + MJ.depthTag(q.depth) + '<span class="tag">' + (MJ.KINDS[q.kind] || "") + "</span>" + (ans ? '<span class="tag ok">답변 있음</span>' : "") +
      '</div><button class="starbtn ' + (q.star ? "on" : "") + '" data-act="star" aria-label="별표" aria-pressed="' + !!q.star + '" title="답하기 어려운 질문에 별표">' + MJ.icon("star", 23) + "</button></div>" +
      '<div class="qt">' + esc(q.text) + "</div>" + (q.purpose ? '<div class="qp"><b>면접관의 의도</b> ' + esc(q.purpose) + "</div>" : "") +
      (line ? '<div class="srcline" title="' + esc(line) + '">' + esc(line) + "</div>" : "");
    if (q.tails && q.tails.length) h += '<details class="tails"><summary>이어질 수 있는 꼬리질문 ' + q.tails.length + "개</summary><ol>" + q.tails.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol></details>";
    h += '<div class="qtools"><a class="btn sm ' + (ans ? "" : "primary") + '" href="#/answers?q=' + esc(q.id) + '">' + (ans ? "답변 고치기" : "답변 쓰기") + "</a>" + (src.type === "item" ? '<button class="btn sm" data-act="swap">' + MJ.icon("swap", 15) + " 다른 질문으로</button>" : "") +
      '<button class="btn sm" data-act="edit">' + MJ.icon("edit", 15) + ' 고치기</button><span class="grow"></span><button class="btn link" data-act="hide">' + (q.hidden ? "다시 보이기" : "숨기기") + '</button><button class="btn link" data-act="del">지우기</button></div></div>';
    return h;
  }
  var openSet = {};   // 펼친 묶음 기억(화면을 다시 그려도 유지)
  var GROUPS = [["item", "내 학생부에서 만든 질문"], ["common", "학생부 밖 공통 질문"], ["weak", "확인 필요 질문"], ["gajang", "‘가장’ 질문"], ["official", "대학 공개 질문"], ["bank", "후기 속 질문에서 담은 질문"], ["hugi", "선배 후기에서 담은 질문"], ["custom", "직접 추가한 질문"]];

  function ratioHtml(share, label) {
    var keys = Object.keys(share).filter(function (k) { return share[k] > 0; });
    return '<div><div class="row between small"><b>' + esc(label) + '</b></div><div class="ratio">' + keys.map(function (k) { return '<i style="width:' + (share[k] * 100).toFixed(1) + "%;background:" + (FCOL[k] || "#94a3b8") + '"></i>'; }).join("") + '</div><div class="legend">' +
      keys.map(function (k) { return '<span><i style="background:' + (FCOL[k] || "#94a3b8") + '"></i>' + (MJ.FACTORS[k] || k) + " " + Math.round(share[k] * 100) + "%</span>"; }).join("") + "</div></div>";
  }
  function univShare(O, target) {
    var o = O[target.univ]; if (!o || !o.blocks.length) return null;
    var key = (target.adm || "").replace(/^학생부(종합|교과)\(|\)$/g, "").replace(/\s+/g, "");
    var b = o.blocks.filter(function (x) { return key && x.adm.replace(/\s+/g, "").indexOf(key) >= 0; })[0] || o.blocks.filter(function (x) { return !x.sp; })[0] || o.blocks[0];
    var sum = 0, sh = {};
    b.f.forEach(function (f) { if (f.v && f.s) { sum += f.v; sh[f.s] = (sh[f.s] || 0) + f.v; } });
    if (!sum) return null;
    Object.keys(sh).forEach(function (k) { sh[k] /= sum; });
    return { share: sh, adm: b.adm };
  }

  MJ.register("questions", {
    title: "4단계 예상 질문 만들기",
    render: function (el, r) {
      var st = MJ.store.get(), rec = MJ.store.record(), tab = r.q.tab || "box", flt = r.q.f || "all";
      var qs = st.questions, visible = qs.filter(function (q) { return !q.hidden; });
      var tabs = [["box", "내 질문함", visible.length], ["rec", "학생부 문장에서"], ["common", "공통 질문"], ["weak", "확인 필요 질문"], ["gajang", "‘가장’ 질문"], ["guide", "대학 공개 질문"], ["bank", "후기 속 질문"]];
      var h = MJ.stepHead("questions") + '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button class="tab ' + (tab === t[0] ? "on" : "") + '" role="tab" aria-selected="' + (tab === t[0]) + '" data-act="tab" data-t="' + t[0] + '">' + t[1] + (t[2] != null ? '<span class="n">' + t[2] + "</span>" : "") + "</button>"; }).join("") + "</div>";

      if (tab === "box") {
        if (!qs.length) h += '<div class="empty"><b>질문함이 비어 있습니다</b>3단계에서 옮겨 적은 문장으로 질문을 만들거나, 위 탭에서 공통 질문을 담아 보세요.<div class="row" style="justify-content:center;margin-top:12px"><a class="btn primary" href="#/record">3단계로 가기</a><button class="btn" data-act="tab" data-t="common">공통 질문 보기</button></div></div>';
        else {
          var mix = MJ.q.mix(qs);
          h += '<div class="card"><div class="card-head"><h2>질문 구성 살펴보기</h2><span class="sub">평가요소가 표시된 질문 ' + mix.n + "개 기준</span></div><div class=\"mix\">" + ratioHtml(mix.share, "내 질문함") + '<div id="umix"></div></div><div id="mixtip"></div></div>';
          var fa = r.q.fa || "";
          var fl = [["all", "전체"], ["star", "별표"], ["noans", "답변 없음"], ["d3", "확장 질문"], ["hid", "숨긴 질문"]];
          var cnt = { all: visible.length, star: visible.filter(function (q) { return q.star; }).length, noans: visible.filter(function (q) { return !hasAnswer(st, q); }).length, d3: visible.filter(function (q) { return q.depth === 3; }).length, hid: qs.length - visible.length };
          h += '<div class="qtoolbar"><div class="row between"><div class="chips">' + fl.map(function (f) { return '<button class="chip ' + (flt === f[0] ? "on" : "") + '" data-act="flt" data-f="' + f[0] + '">' + f[1] + " " + cnt[f[0]] + "</button>"; }).join("") + '</div><button class="btn sm" data-act="custom">' + MJ.icon("plus", 15) + " 질문 직접 추가</button></div>" +
            '<div class="row"><div class="chips">' + [["", "모든 평가요소"]].concat(Object.keys(MJ.FACTORS).map(function (k) { return [k, MJ.FACTORS[k]]; })).map(function (f) { return '<button class="chip ' + (fa === f[0] ? "on" : "") + '" data-act="fa" data-f="' + f[0] + '">' + f[1] + "</button>"; }).join("") + '</div><input class="in grow" id="qSearch" type="search" placeholder="질문에서 낱말 찾기" style="min-width:160px;min-height:38px;padding:6px 12px" aria-label="질문에서 낱말 찾기"><button class="btn sm" data-act="openall">모두 펼치기</button><button class="btn sm" data-act="closeall">모두 접기</button></div></div>';
          var list = qs.filter(function (q) {
            if (fa && q.factor !== fa) return false;
            if (flt === "hid") return q.hidden;
            if (q.hidden) return false;
            if (flt === "star") return q.star;
            if (flt === "noans") return !hasAnswer(st, q);
            if (flt === "d3") return q.depth === 3;
            return true;
          });
          if (!list.length) h += '<div class="empty">조건에 맞는 질문이 없습니다.</div>';
          else {
            var filtered = flt !== "all" || !!fa, firstOpen = true;
            var sub = function (key, title, meta, cards) {
              var nA = cards.filter(function (q) { return hasAnswer(st, q); }).length, nS = cards.filter(function (q) { return q.star; }).length;
              var open = filtered || openSet[key] === true || (openSet[key] == null && firstOpen); firstOpen = false;
              return '<details class="acc qsub" data-key="' + esc(key) + '"' + (open ? " open" : "") + '><summary><span class="qsub-t">' + title + (meta ? '<small>' + esc(meta) + "</small>" : "") + '</span><span class="qsub-n">' + (nS ? '<span class="tag warn">★ ' + nS + "</span>" : "") + '<span class="tag ' + (nA === cards.length ? "ok" : "") + '">답변 ' + nA + " / " + cards.length + '</span></span></summary><div class="acc-body">' + cards.map(function (q) { return qcard(q, st, rec); }).join("") + "</div></details>";
            };
            GROUPS.forEach(function (g) {
              var gl = list.filter(function (q) { return (q.src || {}).type === g[0]; });
              if (!gl.length) return;
              h += '<div class="qgroup">' + g[1] + ' <span class="n">' + gl.length + "</span></div>";
              if (g[0] === "item") {
                var order = [], by = {};
                gl.forEach(function (q) { var k = q.src.ref; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(q); });
                order.forEach(function (k) {
                  var it = rec.filter(function (x) { return x.id === k; })[0], q0 = by[k][0];
                  var title = '<span class="tag navy">' + esc(MJ.areaName(q0.src.area)) + "</span> " + (q0.src.subject ? "<b>" + esc(q0.src.subject) + "</b>" : "");
                  h += sub("i:" + k, title, it ? it.text.slice(0, 64) + (it.text.length > 64 ? "…" : "") : "지운 문장에서 만든 질문", by[k]);
                });
              } else {
                gl.sort(function (a, b) { return (b.star ? 1 : 0) - (a.star ? 1 : 0); });
                h += sub("g:" + g[0], "<b>" + g[1] + "</b>", "", gl);
              }
            });
          }
          h += '<p class="empty" id="qNone" hidden>찾는 낱말이 들어간 질문이 없습니다.</p>';
          h += '<div class="callout tip"><b class="t">답하기 어려운 질문에 별표를 붙이세요</b>별표 질문은 5단계에서 먼저 답을 쓰고, 6단계에서 먼저 연습합니다. 꼬리질문까지 소리 내어 답해 보면 어디가 막히는지 알 수 있습니다.</div>' +
            '<div class="row end"><a class="btn primary" href="#/answers">별표 질문부터 답변 쓰기 ' + MJ.icon("arrow") + "</a></div>";
        }
      }
      if (tab === "rec") {
        if (!rec.length) h += '<div class="empty"><b>옮겨 적은 학생부 문장이 없습니다</b><a class="btn primary" href="#/record" style="margin-top:10px">3단계에서 문장 옮겨 적기</a></div>';
        else {
          h += '<div class="card flat"><p>문장 하나에서 깊이가 다른 질문을 만듭니다. <span class="tag depth">확인</span> 사실과 역할 → <span class="tag depth d2">설명</span> 이유와 개념 → <span class="tag depth d3">확장</span> 조건을 바꾸거나 한계를 묻는 질문 순으로 깊어집니다.</p></div>';
          rec.forEach(function (it) {
            var n = qs.filter(function (q) { return q.src && q.src.ref === it.id; }).length;
            h += '<div class="rec-item" data-rid="' + esc(it.id) + '"><div class="rec-meta"><span class="tag navy">' + esc(MJ.areaName(it.area)) + "</span>" + (it.subject ? '<span class="tag">' + esc(it.subject) + "</span>" : "") + '<span class="grow"></span><span class="tag ' + (n ? "ok" : "") + '">질문 ' + n + '개</span></div><div class="rec-text small">' + esc(it.text) + '</div><div class="row end" style="margin-top:8px"><a class="btn sm" href="#/questions?tab=guide&a=' + encodeURIComponent(it.area) + ((it.chips.concept || [])[0] ? "&w=" + encodeURIComponent(it.chips.concept[0]) : "") + '">대학 공개 질문 보기</a><button class="btn sm ' + (n ? "" : "primary") + '" data-act="more">' + (n ? "질문 더 만들기" : "질문 만들기") + "</button></div></div>";
          });
        }
      }
      if (tab === "common") {
        h += '<div class="card flat"><p>학생부에 무엇이 적혀 있든 나올 수 있는 질문입니다. 특히 지원동기와 마지막 말은 후기에서 가장 자주 나온 질문입니다. 모두 담아 두고 답을 준비하세요.</p><div class="row end"><a class="btn sm" href="#/questions?tab=guide&k=1">대학들이 실제로 쓴 공통 질문 보기</a><button class="btn sm primary" data-act="addallc">모두 담기</button></div></div>';
        MJ.content.commonQ.forEach(function (c) {
          var has = qs.some(function (q) { return q.tpl === c.id; });
          h += '<div class="qcard"><div class="row" style="gap:5px">' + MJ.factorTag(c.factor) + '<span class="tag">' + MJ.KINDS[c.kind] + '</span></div><div class="qt">' + esc(c.text) + '</div><div class="qp"><b>면접관의 의도</b> ' + esc(c.intent) + "</div>" +
            '<details class="acc" style="margin-top:10px"><summary>이렇게 준비하세요</summary><div class="acc-body"><ul>' + c.guide.map(function (g) { return "<li>" + esc(g) + "</li>"; }).join("") + '</ul><h3 style="font-size:14px;margin-top:10px">피할 것</h3><ul>' + c.avoid.map(function (g) { return "<li>" + esc(g) + "</li>"; }).join("") + "</ul></div></details>" +
            '<div class="qtools"><button class="btn sm ' + (has ? "" : "primary") + '" data-act="addc" data-id="' + c.id + '"' + (has ? " disabled" : "") + ">" + (has ? "담김" : "질문함에 담기") + "</button></div></div>";
        });
      }
      if (tab === "weak") {
        h += '<div class="card flat"><p>면접관이 설명을 듣고 싶어 하는 기록에 대한 질문입니다. 피하고 싶은 질문일수록 미리 답을 준비해야 합니다. 내 기록에 해당하는 질문에 빈칸을 채워 담으세요.</p></div>';
        var cats = [];
        MJ.content.weakQ.forEach(function (w) { if (cats.indexOf(w.cat) < 0) cats.push(w.cat); });
        cats.forEach(function (cat) {
          h += '<h3 style="margin:16px 0 8px;font-size:16px">' + esc(cat) + "</h3>";
          MJ.content.weakQ.filter(function (w) { return w.cat === cat; }).forEach(function (w) {
            h += '<div class="qcard" data-wid="' + w.id + '"><div class="qt">' + esc(fillAny(w.text, {})) + '</div><div class="qp"><b>면접관의 의도</b> ' + esc(w.intent) + "</div>";
            if (w.slots && w.slots.length) h += '<div class="row" style="margin-top:10px">' + w.slots.map(function (s) { return '<input class="in" style="width:auto;flex:1;min-width:120px" data-slot="' + s.key + '" placeholder="' + esc(s.label) + (s.ex ? " (예: " + esc(s.ex) + ")" : "") + '">'; }).join("") + "</div>";
            h += '<div class="qtools"><button class="btn sm primary" data-act="addw">질문함에 담기</button></div></div>';
          });
        });
      }
      if (tab === "gajang") {
        var g = MJ.content.gajang;
        h += '<div class="card"><h2>‘가장’ 질문 조합</h2><p>“가장 기억에 남는 활동은?”처럼 ‘가장’을 묻는 질문은 학생부의 수많은 활동 중 하나를 스스로 고르게 합니다. 꾸밈말과 영역을 바꿔 가며 하나씩 답을 정해 두면 어떤 조합이 나와도 당황하지 않습니다. 칸을 누르면 질문함에 담깁니다.</p><div class="gj"><div class="h"></div>' +
          g.adjs.map(function (a) { return '<div class="h">가장 ' + esc(a.label) + "</div>"; }).join("");
        g.areas.forEach(function (a) {
          h += '<div class="rh">' + esc(a.label) + "</div>" + g.adjs.map(function (ad) {
            var id = "gj-" + ad.key + "-" + a.key, on = qs.some(function (q) { return q.tpl === id; });
            return '<button class="' + (on ? "on" : "") + '" data-act="gj" data-a="' + ad.key + '" data-r="' + a.key + '" aria-label="가장 ' + esc(ad.label) + ' ' + esc(a.label) + (on ? " 담김" : " 담기") + '" aria-pressed="' + on + '">' + (on ? "담김" : "담기") + "</button>";
          }).join("");
        });
        h += '</div><p class="hint" style="margin-top:10px">담은 조합 ' + qs.filter(function (q) { return /^gj-/.test(q.tpl || ""); }).length + " / " + g.adjs.length * g.areas.length + "</p>";
        h += '<h3>꾸밈말에 따라 답의 초점이 달라집니다</h3><ul>' + g.adjs.map(function (a) { return "<li><b>가장 " + esc(a.label) + "</b>: " + esc(a.tip || "") + "</li>"; }).join("") + "</ul></div>";
      }
      if (tab === "guide") {
        var myU = r.q.u != null ? r.q.u : "", gWords = [];
        rec.forEach(function (it) { (it.chips.concept || []).slice(0, 2).forEach(function (c) { if (gWords.indexOf(c) < 0) gWords.push(c); }); });
        h += '<div class="card"><h2>대학이 공개한 면접 질문</h2><p>대학이 학생부종합전형 가이드북과 선행학습 영향평가 보고서 등에 직접 공개한 면접 질문입니다. 어떤 기록이 어떤 질문으로 바뀌는지, 대학이 그 질문으로 무엇을 확인하려는지 함께 볼 수 있습니다. 학생부교과전형처럼 모든 지원자에게 같은 질문을 하는 면접의 공통 질문도 들어 있습니다.</p>' +
          '<div class="grid g2"><div class="field"><label class="f" for="gU">대학</label><select class="in" id="gU"><option value="">전체 대학</option></select></div><div class="field"><label class="f" for="gW">찾을 낱말</label><input class="in" id="gW" placeholder="띄어 쓰면 모두 포함, 쉼표는 또는 (예: 리더십 갈등)" value="' + esc(r.q.w || "") + '"></div></div>' +
          '<details class="acc gfilter"' + (r.q.a || r.q.k || r.q.s || r.q.mg || window.innerWidth > 760 ? " open" : "") + '><summary><span><b>영역·학과군·질문 종류로 거르기</b></span></summary><div class="acc-body"><div class="grid g2"><div class="field"><label class="f" for="gA">학생부 영역</label><select class="in" id="gA"><option value="">전체 영역</option></select></div>' +
          '<div class="field"><label class="f" for="gM">학과군</label><select class="in" id="gM"><option value="-1">전체 학과</option></select></div>' +
          '<div class="field"><label class="f" for="gK">질문 종류</label><select class="in" id="gK"><option value="-1">전체</option><option value="0"' + (r.q.k === "0" ? " selected" : "") + '>학생부 확인 질문</option><option value="1"' + (r.q.k === "1" ? " selected" : "") + '>공통 질문(인성·가치·지원동기)</option><option value="2"' + (r.q.k === "2" ? " selected" : "") + '>상황 질문</option></select></div>' +
          '<div class="field"><label class="f" for="gS">자료</label><select class="in" id="gS"><option value="-1">전체</option><option value="0">대학 가이드북</option><option value="1">선행학습 영향평가 보고서</option><option value="2">그 밖의 대학 공개 자료</option></select></div></div></div></details>' +
          (gWords.length ? '<div class="chips" style="margin-bottom:10px"><span class="small mute" style="padding-top:5px">내 개념어:</span>' + gWords.slice(0, 12).map(function (w) { return '<button class="chip" data-act="gw" data-w="' + esc(w) + '">' + esc(w) + "</button>"; }).join("") + "</div>" : "") +
          '<div id="gTip"></div><div id="gR"><p class="mute small">불러오는 중입니다.</p></div><p class="src">질문은 대학이 공개한 문장 그대로이며, OOO 표시는 대학이 가린 부분입니다. ‘대학이 밝힌 의도’와 ‘답변 요령’은 가이드북의 설명을 짧게 정리한 것입니다. 같은 질문이 그대로 나온다는 뜻이 아니라, 대학이 학생부를 읽고 질문을 만드는 방식을 익히는 자료입니다.</p></div>';
      }
      if (tab === "bank") {
        var myMg = r.q.mg != null ? r.q.mg : MJ.myMajorGroup();
        var mgDef = (MJ.content.majors || []).filter(function (g) { return g.k === myMg; })[0];
        var tr = r.q.tr || (mgDef && mgDef.t) || (st.targets[0] && st.targets[0].track) || "공통";
        var words = [];
        rec.forEach(function (it) { (it.chips.concept || []).slice(0, 2).forEach(function (c) { if (words.indexOf(c) < 0) words.push(c); }); });
        h += '<div class="card"><h2>실제 면접에서는 이렇게 물었습니다</h2><p>면접 후기에서 질문 문장만 뽑은 자료입니다. 내 학생부의 개념어로 찾아보면, 같은 내용을 면접관이 어떤 말로 묻는지 알 수 있습니다.</p>' +
          '<div class="grid g2"><div class="field"><label class="f" for="bT">계열</label><select class="in" id="bT">' + MJ.TRACKS.concat(["공통"]).map(function (t) { return "<option" + (t === tr ? " selected" : "") + ">" + t + "</option>"; }).join("") + '</select></div><div class="field"><label class="f" for="bM">학과군</label><select class="in" id="bM"><option value="-1">이 계열 전체</option></select></div><div class="field"><label class="f" for="bY">질문 유형</label><select class="in" id="bY"><option value="-1">전체</option></select></div><div class="field"><label class="f" for="bW">찾을 낱말</label><input class="in" id="bW" placeholder="예: 삼투, 엔트로피, 기회비용" value="' + esc(r.q.w || "") + '"></div></div>' +
          (words.length ? '<div class="chips" style="margin-bottom:10px"><span class="small mute" style="padding-top:5px">내 개념어:</span>' + words.slice(0, 12).map(function (w) { return '<button class="chip" data-act="bw" data-w="' + esc(w) + '">' + esc(w) + "</button>"; }).join("") + "</div>" : "") +
          '<div id="bR"><p class="mute small">불러오는 중입니다.</p></div><p class="src">후기에 적힌 질문을 그대로 옮긴 것이어서 표현이 다듬어지지 않았을 수 있습니다. 대학과 연도는 표시하지 않습니다. 같은 질문이 내 면접에 나온다는 뜻이 아니라, 질문의 방식과 깊이를 익히는 자료입니다.</p></div>';
      }
      h += MJ.stepNav("questions");
      el.innerHTML = h;
      /* 휴대폰에서 고른 탭이 화면 밖에 있지 않게 가로로만 옮긴다 */
      var tabsEl = el.querySelector(".tabs"), onTab = tabsEl && tabsEl.querySelector(".tab.on");
      if (onTab) tabsEl.scrollLeft = Math.max(0, onTab.offsetLeft - (tabsEl.clientWidth - onTab.offsetWidth) / 2);

      function qOf(t) { var id = t.closest(".qcard").getAttribute("data-id"); return qs.filter(function (q) { return q.id === id; })[0]; }
      function go(tabName, extra) { MJ.go("#/questions?tab=" + tabName + (extra || "")); }
      MJ.on(el, "click", {
        tab: function (t) { go(t.getAttribute("data-t")); },
        flt: function (t) { go("box", "&f=" + t.getAttribute("data-f") + (r.q.fa ? "&fa=" + encodeURIComponent(r.q.fa) : "")); },
        fa: function (t) { go("box", "&f=" + flt + (t.getAttribute("data-f") ? "&fa=" + encodeURIComponent(t.getAttribute("data-f")) : "")); },
        star: function (t) { var q = qOf(t); q.star = !q.star; MJ.store.save(); t.classList.toggle("on", q.star); t.setAttribute("aria-pressed", q.star); t.closest(".qcard").classList.toggle("star", q.star); MJ.toast(q.star ? "별표를 붙였습니다. 5단계에서 먼저 답을 쓰게 됩니다." : "별표를 뗐습니다."); },
        hide: function (t) { var q = qOf(t); q.hidden = !q.hidden; MJ.store.save(); MJ.rerender(); },
        del: function (t) { var q = qOf(t); MJ.confirm("이 질문을 지울까요? 써 둔 답변도 함께 지워집니다.", function () { qs.splice(qs.indexOf(q), 1); delete st.answers[q.id]; MJ.store.save(); MJ.rerender(); }, "지우기"); },
        swap: function (t) {
          var q = qOf(t), it = rec.filter(function (x) { return x.id === q.src.ref; })[0];
          if (!it) { MJ.toast("원래 문장이 지워져 바꿀 수 없습니다."); return; }
          var used = qs.filter(function (x) { return x.src && x.src.ref === it.id; }).map(function (x) { return x.tpl; });
          var n = MJ.q.swap(q, it, used); if (!n) { MJ.toast("바꿀 수 있는 다른 질문이 없습니다."); return; }
          var doSwap = function () { qs[qs.indexOf(q)] = n; MJ.store.save(); MJ.rerender(); };
          if (q.edited || st.answers[q.id]) MJ.confirm("직접 고쳤거나 답변을 쓴 질문입니다. 다른 질문으로 바꾸면 고친 문장이 사라집니다. 바꿀까요?", doSwap, "바꾸기");
          else doSwap();
        },
        edit: function (t) {
          var q = qOf(t), body = document.createElement("div");
          body.innerHTML = '<div class="field"><label class="f" for="qe">질문</label><textarea class="in" id="qe">' + esc(q.text) + '</textarea></div><div class="field"><label class="f" for="qt2">꼬리질문 (한 줄에 하나)</label><textarea class="in" id="qt2">' + esc((q.tails || []).join("\n")) + '</textarea></div><div class="field"><label class="f" for="qk">답변 유형</label><select class="in" id="qk">' + Object.keys(MJ.KINDS).map(function (k) { return '<option value="' + k + '"' + (k === q.kind ? " selected" : "") + ">" + MJ.KINDS[k] + "</option>"; }).join("") + "</select></div>";
          MJ.modal({ title: "질문 고치기", body: body, actions: [{ label: "취소" }, { label: "저장", kind: "primary", run: function () { var v = body.querySelector("#qe").value.trim(); if (!v) return false; q.text = v; q.edited = true; q.tails = body.querySelector("#qt2").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean); q.kind = body.querySelector("#qk").value; MJ.store.save(); MJ.rerender(); } }] });
        },
        openall: function () { el.querySelectorAll("details.qsub").forEach(function (d) { d.open = true; }); },
        closeall: function () { el.querySelectorAll("details.qsub").forEach(function (d) { d.open = false; }); },
        custom: function () {
          var body = document.createElement("div");
          body.innerHTML = '<div class="field"><label class="f" for="qe">질문</label><textarea class="in" id="qe" placeholder="선생님이나 친구가 내 준 질문, 스스로 떠올린 질문을 적으세요."></textarea></div>';
          MJ.modal({ title: "질문 직접 추가", body: body, actions: [{ label: "취소" }, { label: "추가", kind: "primary", run: function () { var v = body.querySelector("#qe").value.trim(); if (!v) return false; qs.push(MJ.q.custom(v, MJ.a.guessKind(v))); MJ.store.save(); MJ.rerender(); } }] });
        },
        more: function (t) {
          var id = t.closest("[data-rid]").getAttribute("data-rid"), it = rec.filter(function (x) { return x.id === id; })[0];
          var have = qs.filter(function (q) { return q.src && q.src.ref === id; }).map(function (q) { return q.tpl; });
          var out = MJ.q.generate(it, { exclude: have, salt: have.length, count: have.length ? 4 : null, avoidTexts: qs.map(function (q) { return q.text; }) });
          out.forEach(function (q) { qs.push(q); }); MJ.store.save(); MJ.rerender();
          MJ.toast(out.length ? "질문 " + out.length + "개를 담았습니다." : "더 만들 질문이 없습니다.");
        },
        addc: function (t) { var c = MJ.content.commonQ.filter(function (x) { return x.id === t.getAttribute("data-id"); })[0]; qs.push(MJ.q.fromCommon(c)); MJ.store.save(); t.textContent = "담김"; t.disabled = true; t.classList.remove("primary"); },
        addallc: function () { var n = 0; MJ.content.commonQ.forEach(function (c) { if (!qs.some(function (q) { return q.tpl === c.id; })) { qs.push(MJ.q.fromCommon(c)); n++; } }); MJ.store.save(); MJ.rerender(); MJ.toast(n ? n + "개를 담았습니다." : "이미 모두 담겨 있습니다."); },
        addw: function (t) {
          var card = t.closest("[data-wid]"), w = MJ.content.weakQ.filter(function (x) { return x.id === card.getAttribute("data-wid"); })[0], vals = {}, miss = false;
          card.querySelectorAll("[data-slot]").forEach(function (i) { var v = i.value.trim(); if (!v) miss = true; vals[i.getAttribute("data-slot")] = v; });
          if (miss) { MJ.toast("빈칸을 채워 주세요."); return; }
          var txt = fillAny(w.text, vals);
          if (qs.some(function (x) { return x.text === txt; })) { MJ.toast("이미 질문함에 있습니다."); return; }
          var q = MJ.q.fromWeak(w, txt); q.star = true; qs.push(q); MJ.store.save(); MJ.toast("별표를 붙여 질문함에 담았습니다.");
          card.querySelectorAll("[data-slot]").forEach(function (i) { i.value = ""; });
        },
        gj: function (t) {
          var g = MJ.content.gajang, ad = g.adjs.filter(function (x) { return x.key === t.getAttribute("data-a"); })[0], ar = g.areas.filter(function (x) { return x.key === t.getAttribute("data-r"); })[0];
          var id = "gj-" + ad.key + "-" + ar.key, i = -1;
          qs.forEach(function (q, k) { if (q.tpl === id) i = k; });
          if (i >= 0) { delete st.answers[qs[i].id]; qs.splice(i, 1); }
          else { var q = MJ.q.fromGajang(ad, { key: ar.key, label: ar.q || ar.label }); if (g.tails) q.tails = g.tails.slice(0, 3); q.guide = g.guide; qs.push(q); }
          MJ.store.save(); MJ.rerender();
        },
        bw: function (t) { var i = el.querySelector("#bW"); i.value = t.getAttribute("data-w"); search(); },
        gmore: function () { gLim += 30; var y = window.scrollY; gsearch(true); window.scrollTo(0, y); },
        gw: function (t) { var i = el.querySelector("#gW"); i.value = t.getAttribute("data-w"); gsearch(); },
        addg: function (t) {
          var g = G && G.q[+t.getAttribute("data-i")]; if (!g) return;
          if (qs.some(function (q) { return q.text === g[1]; })) { MJ.toast("이미 질문함에 있습니다."); return; }
          qs.push({ id: MJ.uid("q"), tpl: "", text: g[1], kind: g[11] ? "opinion" : MJ.a.guessKind(g[1]), factor: g[3] || "", depth: 0, intent: "", purpose: g[7] || "", tails: g[9].slice(), guide: g[8] ? [g[8]] : null, src: { type: "official", ref: G.u[g[0]] }, star: false, hidden: false });
          MJ.store.save(); t.textContent = "담김"; t.disabled = true; t.classList.remove("primary"); MJ.toast("질문함에 담았습니다.");
        },
        addb: function (t) {
          var text = t.getAttribute("data-q");
          if (qs.some(function (q) { return q.text === text; })) { MJ.toast("이미 질문함에 있습니다."); return; }
          qs.push({ id: MJ.uid("q"), tpl: "", text: text, kind: MJ.a.guessKind(text), factor: "", depth: 0, intent: "", purpose: "", tails: [], src: { type: "bank", track: el.querySelector("#bT").value }, star: false, hidden: false });
          MJ.store.save(); t.textContent = "담김"; t.disabled = true;
        }
      });

      el.addEventListener("toggle", function (e) { var d = e.target; if (d.classList && d.classList.contains("qsub")) openSet[d.getAttribute("data-key")] = d.open; }, true);
      var qsearch = el.querySelector("#qSearch");
      if (qsearch) qsearch.addEventListener("input", function () {
        var w = qsearch.value.trim().replace(/\s+/g, ""), shown = 0;
        el.querySelectorAll(".qcard[data-text]").forEach(function (c) { var ok = !w || c.getAttribute("data-text").replace(/\s+/g, "").indexOf(w) >= 0; c.hidden = !ok; if (ok) shown++; });
        el.querySelectorAll("details.qsub").forEach(function (d) { var any = [].some.call(d.querySelectorAll(".qcard"), function (c) { return !c.hidden; }); d.hidden = !any; if (w && any) d.open = true; });
        el.querySelectorAll(".qgroup").forEach(function (g) { var n = g.nextElementSibling, any = false; while (n && n.classList.contains("qsub")) { if (!n.hidden) any = true; n = n.nextElementSibling; } g.hidden = !any; });
        var none = el.querySelector("#qNone"); if (none) none.hidden = shown > 0;
      });
      /* 대학 평가요소와 비교 */
      if (tab === "box" && qs.length && st.targets.length) {
        var tg = st.targets.slice().sort(function (a, b) { return (a.date || "9") < (b.date || "9") ? -1 : 1; })[0];
        MJ.load("official").then(function (O) {
          var us = univShare(O, tg), box = el.querySelector("#umix"); if (!us || !box) return;
          box.innerHTML = ratioHtml(us.share, tg.univ + " 평가요소");
          var mine = MJ.q.mix(qs).share, tips = [];
          if (MJ.q.mix(qs).n >= 8) ["학업", "진로", "공동체"].forEach(function (k) { if ((us.share[k] || 0) - (mine[k] || 0) > 0.15) tips.push(MJ.FACTORS[k]); });   // 평가요소가 붙은 질문이 적으면 비교하지 않는다
          el.querySelector("#mixtip").innerHTML = tips.length ? '<div class="callout warn small" style="margin-bottom:0">' + esc(tg.univ) + MJ.josa(tg.univ, "은") + " <b>" + esc(tips.join(", ")) + "</b>의 비중이 큰데, 내 질문함에는 이 요소의 질문이 적습니다. 해당 영역의 문장에서 질문을 더 만들어 보세요.</div>" : '<p class="hint">질문 구성이 대학의 평가요소 비중과 크게 어긋나지 않습니다. 의사소통은 질문의 종류가 아니라 모든 답변에서 함께 평가됩니다. 비율은 참고용이며, 실제 질문 수가 배점대로 나오는 것은 아닙니다.</p>';
        }).catch(function () { });
      }
      /* 대학 공개 질문 */
      var G = null, gLim = 30;
      function gsearch(keepLim) {
        if (keepLim !== true) gLim = 30;
        var box = el.querySelector("#gR"); if (!box || !G) return;
        var u = el.querySelector("#gU").value, a = el.querySelector("#gA").value, m = +el.querySelector("#gM").value, gk = +el.querySelector("#gK").value, gs = +el.querySelector("#gS").value;
        /* 낱말은 쉼표로 나눈다(‘산화 환원 반응’ 같은 개념어는 한 낱말로 본다) */
        var ws = el.querySelector("#gW").value.split(/,/).map(function (w) { return w.trim().split(/\s+/).filter(Boolean); }).filter(function (g) { return g.length; });
        var ui = u ? G.u.indexOf(u) : -1, ai = a ? G.meta.areas.indexOf(a) : -1;
        var res = [], score = {}, rank = {};
        /* 내 학생부 개념어가 든 질문을 먼저, 그다음 학생부 영역 순서로(공통 질문은 뒤로) */
        var mine = []; rec.forEach(function (it) { (it.chips.concept || []).concat(it.chips.topic || []).forEach(function (c) { c = c.replace(/\s+/g, ""); if (c.length >= 2 && mine.indexOf(c) < 0) mine.push(c); }); });
        G.q.forEach(function (g, i) {
          if (ui >= 0 && g[0] !== ui) return;
          if (ai >= 0 && g[2] !== ai) return;
          if (m >= 0 && g[5] !== m) return;
          if (gk >= 0 && g[11] !== gk) return;
          if (gs >= 0 && g[10] !== gs) return;
          var hay = (g[1] + " " + g[4] + " " + g[6]).replace(/\s+/g, "");
          if (ws.length && !ws.some(function (g) { return g.every(function (w) { return hay.indexOf(w) >= 0; }); })) return;
          /* 한 대학의 질문이 목록을 덮지 않게, 대학마다 몇 번째 질문인지(rank)로 번갈아 놓는다 */
          rank[g[0]] = (rank[g[0]] || 0) + 1;
          score[i] = (mine.some(function (c) { return hay.indexOf(c) >= 0; }) ? -1e6 : 0) + (ui >= 0 ? 0 : rank[g[0]] * 10) + g[2];
          res.push(i);
        });
        res.sort(function (x, y) { return score[x] - score[y] || x - y; });
        var tip = el.querySelector("#gTip"); if (tip) tip.innerHTML = a ? MJ.areaTip(a, { open: true }) : "";
        var LIM = gLim, has = {};
        try {   // 답변을 쓰고 돌아오거나 새로 고침해도 같은 결과가 나오게 주소에 남긴다(화면은 다시 그리지 않음)
          var qp = ["tab=guide"], mgText = m >= 0 ? G.mg[m] : "";
          [["u", u], ["a", a], ["mg", mgText], ["k", gk >= 0 ? String(gk) : ""], ["s", gs >= 0 ? String(gs) : ""], ["w", el.querySelector("#gW").value.trim()]].forEach(function (x) { if (x[1]) qp.push(x[0] + "=" + encodeURIComponent(x[1])); });
          history.replaceState(null, "", "#/questions?" + qp.join("&"));
        } catch (e) { /* 무시 */ }
        qs.forEach(function (q) { has[q.text] = 1; });
        box.innerHTML = '<p class="small mute" style="margin:0 0 8px">' + res.length + "개 질문</p>" + (res.length ? res.slice(0, LIM).map(function (i) {
          var g = G.q[i], an = MJ.AREAS.filter(function (x) { return x.k === G.meta.areas[g[2]]; })[0];
          var aname = an ? an.n : ({ reading: "독서", common: "공통" })[G.meta.areas[g[2]]] || "";
          return '<div class="qcard gq"><div class="row" style="gap:5px"><span class="tag teal">' + esc(G.u[g[0]]) + "</span>" + (g[4] ? '<span class="tag">' + esc(g[4]) + "</span>" : "") + '<span class="tag navy">' + esc(aname) + "</span>" + (g[6] ? '<span class="tag">' + esc(g[6]) + "</span>" : "") + MJ.factorTag(g[3]) + (g[11] ? '<span class="tag warn">' + esc(G.meta.types[g[11]]) + "</span>" : "") + (g[12] ? '<span class="tag warn">자기소개서를 받는 대학</span>' : "") + '<span class="grow"></span><span class="small mute">' + esc(G.meta.srcs[g[10]]) + "</span></div>" +
            '<div class="qt">' + esc(g[1]) + "</div>" + (g[7] ? '<div class="qp"><b>대학이 밝힌 의도</b> ' + esc(g[7]) + "</div>" : "") + (g[8] ? '<div class="qp"><b>답변 요령</b> ' + esc(g[8]) + "</div>" : "") +
            (g[9].length ? '<details class="tails"><summary>이어지는 질문 ' + g[9].length + "개</summary><ol>" + g[9].map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></details>" : "") +
            '<div class="qtools"><button class="btn sm ' + (has[g[1]] ? "" : "primary") + '" data-act="addg" data-i="' + i + '"' + (has[g[1]] ? " disabled" : "") + ">" + (has[g[1]] ? "담김" : "질문함에 담기") + "</button></div></div>";
        }).join("") + (res.length > LIM ? '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn" data-act="gmore">' + Math.min(30, res.length - LIM) + "개 더 보기 (" + LIM + " / " + res.length + ")</button></div>" : "") : '<div class="empty">조건에 맞는 질문이 없습니다. 낱말을 지우거나 대학·영역을 ‘전체’로 넓혀 보세요.</div>');
      }
      if (tab === "guide") {
        MJ.load("guide").then(function (data) {
          G = data;
          var cnt = {}; G.q.forEach(function (g) { cnt[g[0]] = (cnt[g[0]] || 0) + 1; });
          var su = el.querySelector("#gU"), want = myU;
          if (r.q.u == null && !r.q.k && !r.q.a && !r.q.w) st.targets.forEach(function (t) { if (!want && cnt[G.u.indexOf(t.univ)]) want = t.univ; });
          su.innerHTML = '<option value="">전체 대학 (' + G.q.length + ")</option>" + G.u.map(function (u, i) { return cnt[i] ? '<option value="' + esc(u) + '"' + (u === want ? " selected" : "") + ">" + esc(u) + " (" + cnt[i] + ")</option>" : ""; }).join("");
          var ac = {}; G.q.forEach(function (g) { ac[g[2]] = (ac[g[2]] || 0) + 1; });
          el.querySelector("#gA").innerHTML = '<option value="">전체 영역</option>' + G.meta.areas.map(function (a, i) {
            if (!ac[i]) return ""; var an = MJ.AREAS.filter(function (x) { return x.k === a; })[0];
            return '<option value="' + a + '"' + (a === r.q.a ? " selected" : "") + ">" + esc(an ? an.full : ({ reading: "독서", common: "지원동기·인성 등 공통" })[a]) + " (" + ac[i] + ")</option>";
          }).join("");
          var mc = {}; G.q.forEach(function (g) { if (g[5] >= 0) mc[g[5]] = (mc[g[5]] || 0) + 1; });
          var sm = el.querySelector("#gM");
          sm.innerHTML = '<option value="-1">전체 학과</option>' + Object.keys(mc).sort(function (x, y) { return mc[y] - mc[x]; }).map(function (i) { return '<option value="' + i + '">' + esc(G.mg[i]) + " (" + mc[i] + ")</option>"; }).join("");
          if (r.q.s) el.querySelector("#gS").value = r.q.s;
          if (r.q.mg) [].forEach.call(sm.options, function (o) { if (o.text.indexOf(r.q.mg + " (") === 0) sm.value = o.value; });
          ["#gU", "#gA", "#gM", "#gK", "#gS"].forEach(function (s) { el.querySelector(s).addEventListener("change", gsearch); });
          el.querySelector("#gW").addEventListener("input", function () { clearTimeout(gsearch.t); gsearch.t = setTimeout(gsearch, 250); });
          gsearch();
        }).catch(function (e) { el.querySelector("#gR").innerHTML = '<p class="mute small">' + esc(e.message) + "</p>"; });
      }
      /* 기출 찾기 */
      var bank = null, firstMg = true;
      function search() {
        var box = el.querySelector("#bR"); if (!box || !bank) return;
        var w = el.querySelector("#bW").value.split(/[,\s]+/).filter(Boolean), ty = +el.querySelector("#bY").value, mi = +el.querySelector("#bM").value;
        var res = MJ.q.searchBank(bank, w, ty, 40, mi);
        box.innerHTML = res.length ? '<div class="qlist">' + res.map(function (q) { return '<div class="qline"><span>' + esc(q[0]) + ' <span class="tag">' + esc(bank.types[q[1]]) + "</span>" + (q[3] ? ' <span class="tag warn">자기소개서를 받는 대학</span>' : "") + '</span><button class="btn sm" data-act="addb" data-q="' + esc(q[0]) + '">담기</button></div>'; }).join("") + "</div>" + (res.length >= 40 ? '<p class="hint">40개까지만 보여 줍니다. 낱말을 더 좁혀 보세요.</p>' : "") : '<div class="empty">조건에 맞는 질문이 없습니다. 낱말을 지우거나, 학과군을 ‘이 계열 전체’로 넓혀 보세요.</div>';
      }
      function loadBank() {
        var tr2 = el.querySelector("#bT").value;
        el.querySelector("#bR").innerHTML = '<p class="mute small">불러오는 중입니다.</p>';
        MJ.q.loadBank(tr2).then(function (b) {
          if (!el.isConnected || el.querySelector("#bT").value !== tr2) return;   // 그새 계열을 바꿨다
          bank = b; var sel = el.querySelector("#bY"), cur = sel.value;
          sel.innerHTML = '<option value="-1">전체</option>' + b.types.map(function (t, i) { return '<option value="' + i + '">' + t + "</option>"; }).join(""); sel.value = cur;
          if (sel.selectedIndex < 0) sel.value = "-1";
          /* 이 계열 자료에 문항이 있는 학과군만 고르게 한다 */
          var cnt = {}; b.q.forEach(function (q) { if (q[2] >= 0) cnt[q[2]] = (cnt[q[2]] || 0) + 1; });
          var ms = el.querySelector("#bM"), want = firstMg ? myMg : (ms.options[ms.selectedIndex] || {}).text;
          ms.innerHTML = '<option value="-1">이 계열 전체</option>' + Object.keys(cnt).sort(function (x, y) { return cnt[y] - cnt[x]; }).filter(function (i) { return cnt[i] >= 15; }).map(function (i) { return '<option value="' + i + '">' + esc(b.mg[i]) + " (" + cnt[i] + ")</option>"; }).join("");
          [].forEach.call(ms.options, function (o) { if (want && o.text.indexOf(want + " (") === 0) ms.value = o.value; });
          firstMg = false;
          search();
        }).catch(function (e) { el.querySelector("#bR").innerHTML = '<p class="mute small">' + esc(e.message) + "</p>"; });
      }
      if (tab === "bank") {
        el.querySelector("#bT").addEventListener("change", loadBank);
        el.querySelector("#bY").addEventListener("change", search);
        el.querySelector("#bM").addEventListener("change", search);
        el.querySelector("#bW").addEventListener("input", function () { clearTimeout(search.t); search.t = setTimeout(search, 250); });
        loadBank();
      }
    }
  });
})();
