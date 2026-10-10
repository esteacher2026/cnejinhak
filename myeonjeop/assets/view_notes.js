/* 내 자료: 인쇄, 백업·복원, 설정 */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;

  var PFOOT = '<p class="pfoot">학교생활기록부 기반 면접 준비 안내 · 충청남도교육청진로융합교육원</p>';
  function picked(st) {
    var qs = st.questions.filter(function (q) { return !q.hidden; });
    return qs.slice().sort(function (a, b) { return (b.star ? 1 : 0) - (a.star ? 1 : 0); });
  }
  function head(title, st) {
    var t = st.targets.map(function (x) { return x.univ + (x.date ? " " + MJ.fmtDate(x.date) : ""); }).join(" · ");
    return '<div class="ph"><div><h1>' + title + '</h1><p style="font-size:10pt;color:#444;margin:0">' + esc(t ? t + " · " : "") + MJ.fmtDate(MJ.today(), true) + ' 인쇄</p></div><img src="assets/logo_cnecc.svg" alt="충청남도교육청진로융합교육원"></div>';
  }
  /* 면접 노트: 질문 + 내 키워드 + 꼬리질문 메모 */
  function noteHtml(st) {
    var h = head("나의 면접 노트", st) + '<p style="font-size:10pt">대본이 아닙니다. 키워드만 보고 말로 풀어내는 연습에 쓰세요.</p>';
    picked(st).forEach(function (q, i) {
      var a = st.answers[q.id] || {}, kws = a.keywords || [];
      h += '<div class="pq"><div class="q">' + (i + 1) + ". " + (q.star ? "★ " : "") + esc(q.text) + "</div>" +
        (kws.length ? '<div class="k"><b>키워드</b> ' + esc(kws.join(" · ")) + "</div>" : '<div class="lines"></div>') +
        (q.tails && q.tails.length ? '<div class="t"><b>꼬리질문</b> ' + q.tails.map(function (t, k) { return esc(t) + (a.tails && a.tails[k] ? " → " + esc(a.tails[k]) : ""); }).join(" / ") + "</div>" : "") + "</div>";
    });
    return h + PFOOT;
  }
  /* 면접관용 질문지: 선생님·친구·가족에게 건네는 종이 */
  function sheetHtml(st) {
    var h = head("모의면접 질문지 (면접관용)", st) + '<p style="font-size:10pt">진행 방법: 질문을 읽어 주고, 답이 끝나면 꼬리질문 하나를 이어서 묻습니다. 한 답변은 1분 안쪽이 알맞습니다. 답을 들으며 오른쪽 칸에 표시해 주세요. (○ 잘됨 / △ 보통 / × 아쉬움)</p>' +
      '<table class="t" style="font-size:10pt"><thead><tr><th style="width:52%">질문과 꼬리질문</th><th>첫 문장에 답</th><th>구체적 사례</th><th>시간</th><th>메모</th></tr></thead><tbody>';
    picked(st).slice(0, 12).forEach(function (q, i) {
      h += "<tr><td><b>" + (i + 1) + ". " + esc(q.text) + "</b>" + (q.tails && q.tails.length ? '<br><span style="color:#333">↳ ' + q.tails.slice(0, 2).map(esc).join("<br>↳ ") + "</span>" : "") + '</td><td></td><td></td><td></td><td style="width:20%"></td></tr>';
    });
    h += "</tbody></table><h2>끝난 뒤 함께 이야기할 것</h2>";
    MJ.content.finish.selfcheck.forEach(function (g) { h += '<p style="font-size:10pt;margin:3pt 0"><b>' + esc(g.area) + "</b> " + g.items.map(function (x) { return "□ " + esc(x.text); }).join(" ") + "</p>"; });
    return h + PFOOT;
  }
  function checkHtml(st) {
    var F = MJ.content.finish, h = head("면접 체크리스트", st);
    [["일주일 전", F.checklists.d7], ["전날", F.checklists.d1]].forEach(function (x) { h += "<h2>" + x[0] + "</h2>" + x[1].map(function (i) { return '<p style="margin:2pt 0">□ ' + esc(i.text) + "</p>"; }).join(""); });
    h += "<h2>면접 당일</h2>" + F.checklists.dday.map(function (p) { return '<p style="margin:5pt 0 2pt"><b>' + esc(p.phase) + "</b></p>" + p.items.map(function (i) { return '<p style="margin:2pt 0">□ ' + esc(i.text) + "</p>"; }).join(""); }).join("");
    var em = MJ.content.coach.emergency;
    h += "<h2>막혔을 때 쓸 말</h2>" + em.map(function (e) { return '<p style="margin:2pt 0"><b>' + esc(e.situation) + "</b> “" + esc(e.line) + "”</p>"; }).join("");
    return h + PFOOT;
  }

  MJ.register("notes", {
    title: "내 자료",
    render: function (el) {
      var st = MJ.store.get(), rec = MJ.store.record();
      var nq = st.questions.filter(function (q) { return !q.hidden; }).length, na = Object.keys(st.answers).filter(function (k) { var a = st.answers[k]; return a && Object.keys(a.slots || {}).some(function (s) { return String(a.slots[s] || "").trim(); }); }).length;
      var h = '<header class="page-head"><h1>내 자료</h1><p>만든 질문과 답변을 종이로 뽑고, 다른 기기로 옮길 수 있습니다.</p></header>';
      h += '<div class="card"><h2>인쇄하기</h2><div class="grid g3">' +
        '<div class="card flat" style="margin:0"><h3>나의 면접 노트</h3><p class="small mute">질문 ' + nq + "개와 내가 고른 키워드, 꼬리질문 메모. 대기실에서 볼 수 있는 한 묶음입니다.</p><button class=\"btn sm primary\" data-act=\"print\" data-k=\"note\"" + (nq ? "" : " disabled") + ">" + MJ.icon("print", 15) + " 인쇄</button></div>" +
        '<div class="card flat" style="margin:0"><h3>모의면접 질문지</h3><p class="small mute">선생님, 친구, 가족에게 건네는 면접관용 종이. 질문 12개와 꼬리질문, 표시 칸이 들어갑니다.</p><button class="btn sm primary" data-act="print" data-k="sheet"' + (nq ? "" : " disabled") + ">" + MJ.icon("print", 15) + " 인쇄</button></div>" +
        '<div class="card flat" style="margin:0"><h3>면접 체크리스트</h3><p class="small mute">일주일 전, 전날, 당일 점검 항목과 막혔을 때 쓸 말.</p><button class="btn sm primary" data-act="print" data-k="check">' + MJ.icon("print", 15) + " 인쇄</button></div></div>" +
        '<p class="hint" style="margin-top:10px">별표 질문이 앞에 옵니다. 인쇄 창에서 ‘PDF로 저장’을 고르면 파일로 남길 수 있습니다.</p></div>';

      h += '<div class="card"><h2>내 자료는 어디에 있나요</h2><div class="table-wrap"><table class="t"><tbody>' +
        "<tr><th>학생부 문장</th><td>" + rec.length + "개 · " + (st.recordPolicy === "local" ? "이 기기에 저장 중" : "창을 닫으면 지워짐") + '</td><td><button class="btn sm" data-act="policy">' + (st.recordPolicy === "local" ? "저장 끄기" : "이 기기에 저장") + "</button></td></tr>" +
        "<tr><th>질문함·답변·연습 기록</th><td>질문 " + st.questions.length + "개 · 답변 " + na + "개 · 연습 " + st.practice.length + "회 · 이 기기에 저장</td><td></td></tr>" +
        "<tr><th>녹음·받아쓴 글</th><td>저장하지 않음. 연습 화면을 떠나면 사라집니다.</td><td></td></tr></tbody></table></div>" +
        '<p class="small" style="margin-top:10px">이 안내서에는 서버가 없습니다. 입력한 내용은 지금 쓰는 브라우저 안에만 있고 어디로도 전송되지 않습니다. 그래서 다른 기기나 다른 브라우저에서는 보이지 않으며, 브라우저의 사이트 데이터(쿠키 등)를 지우면 함께 사라집니다. 함께 쓰는 컴퓨터에서는 끝나고 아래의 ‘모두 지우기’나 화면 위쪽의 ‘초기화’를 눌러 주세요.</p></div>';

      h += '<div class="card"><h2>백업과 옮기기</h2><p class="small">백업 파일을 내려받아 두면 다른 기기에서 이어서 쓸 수 있습니다. 파일에는 질문, 답변, 학생부 문장이 들어 있으니 다른 사람에게 보내지 마세요.</p><div class="row"><button class="btn" data-act="export">백업 파일 내려받기</button><label class="btn" style="cursor:pointer">백업 파일 불러오기<input type="file" id="imp" accept=".json,application/json" hidden></label><button class="btn danger" data-act="wipe">모두 지우기</button></div></div>';

      h += '<div class="card"><h2>말하기 속도 맞추기</h2><p class="small">5단계의 “말하면 몇 초” 계산에 쓰는 속도입니다. 실제로 재 보니 계산보다 길거나 짧다면 바꾸세요.</p><div class="chips" id="rate">' + [[4.4, "천천히"], [5.2, "보통"], [6.0, "빠르게"]].map(function (x) { return '<button class="chip ' + (Math.abs(st.settings.rate - x[0]) < 0.05 ? "on" : "") + '" data-act="rate" data-r="' + x[0] + '">' + x[1] + " (1분에 약 " + Math.round(x[0] * 60) + "음절)</button>"; }).join("") + "</div></div>";
      h += '<div id="printArea" class="print-area print-only"></div>';
      el.innerHTML = h;

      el.querySelector("#imp").addEventListener("change", function (e) {
        var f = e.target.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          var obj = null;
          try { obj = JSON.parse(rd.result); } catch (err) { MJ.toast("백업 파일을 읽지 못했습니다. 이 안내서에서 내려받은 .json 파일인지 확인하세요."); return; }
          if (!obj || obj.app !== "mj" || !obj.state) { MJ.toast("이 안내서의 백업 파일이 아닙니다."); return; }
          var cur = MJ.store.get(), nq = (obj.state.questions || []).length;
          var go = function () { try { MJ.store.importAll(obj); MJ.toast("백업을 불러왔습니다."); MJ.rerender(); } catch (err) { MJ.toast("백업 파일을 불러오지 못했습니다."); } };
          if (cur.questions.length || MJ.store.record().length || cur.targets.length)
            MJ.confirm("지금 이 기기에 있는 질문 " + cur.questions.length + "개와 학생부 문장, 답변이 백업 파일의 내용(질문 " + nq + "개)으로 바뀝니다. 불러올까요?", go, "불러오기");
          else go();
        };
        rd.readAsText(f);
        e.target.value = "";   // 같은 파일을 다시 골라도 불러오게
      });
      MJ.on(el, "click", {
        print: function (t) {
          var k = t.getAttribute("data-k"), area = el.querySelector("#printArea");
          area.innerHTML = k === "note" ? noteHtml(st) : k === "sheet" ? sheetHtml(st) : checkHtml(st);
          document.body.classList.add("printing");
          var done = function () { document.body.classList.remove("printing"); window.removeEventListener("afterprint", done); };
          window.addEventListener("afterprint", done);
          setTimeout(done, 60000);   // afterprint 를 알리지 않는 브라우저 대비
          setTimeout(function () { window.print(); }, 50);
        },
        policy: function () { MJ.store.setRecordPolicy(st.recordPolicy === "local" ? "session" : "local"); MJ.rerender(); },
        export: function () { MJ.download("면접준비_백업_" + MJ.iso(MJ.today()) + ".json", JSON.stringify(MJ.store.exportAll())); },
        wipe: function () { MJ.resetAsk(); },
        rate: function (t) { st.settings.rate = +t.getAttribute("data-r"); MJ.store.save(); MJ.rerender(); }
      });
    }
  });
})();
