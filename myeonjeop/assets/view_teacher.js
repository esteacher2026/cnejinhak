/* 선생님께: 수업·상담에서 쓰는 방법, 모의면접 운영, 빈 평가지 인쇄, 면접후기 제출 안내 */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;

  function sheetHtml() {
    var F = MJ.content.finish, rows = "";
    for (var i = 1; i <= 7; i++) rows += "<tr><td style=\"height:44pt\"><b>" + i + ".</b></td><td></td><td></td><td></td><td></td></tr>";
    var h = '<div class="ph"><div><h1>모의면접 관찰지</h1><p style="font-size:10pt;color:#444;margin:0">학생 번호 ______ · 지원 대학·학과 ____________________ · 관찰자 ________</p></div><img src="assets/logo_cnecc.svg" alt=""></div>' +
      '<p style="font-size:10pt">진행: 면접관 두 사람이 번갈아 묻고, 관찰자는 시간을 재며 표시합니다. 질문마다 꼬리질문을 하나 이상 이어 묻습니다. 끝나면 고칠 점을 두세 개만 골라 알려 줍니다.</p>' +
      '<table class="t" style="font-size:10pt"><thead><tr><th style="width:44%">질문과 꼬리질문</th><th>첫 문장에 답</th><th>구체적 사례</th><th>시간(초)</th><th style="width:22%">메모</th></tr></thead><tbody>' + rows + "</tbody></table><h2>끝난 뒤 점검</h2>";
    F.selfcheck.forEach(function (g) { h += '<p style="font-size:10pt;margin:3pt 0"><b>' + esc(g.area) + "</b> " + g.items.map(function (x) { return "□ " + esc(x.text); }).join(" ") + "</p>"; });
    return h + '<h2>다음 연습까지 고칠 것 한 가지</h2><div style="height:40pt;border:1pt solid #999"></div><p class="pfoot">학교생활기록부 기반 면접 준비 안내 · 충청남도교육청진로융합교육원</p>';
  }

  MJ.register("teacher", {
    title: "선생님께",
    render: function (el) {
      var h = '<header class="page-head"><h1>선생님께</h1><p>학생이 혼자서도 준비를 이어 가도록 만든 안내서입니다. 선생님은 연습의 방향을 잡아 주시면 됩니다.</p></header>';
      h += '<div class="card"><h2>학교에서 쓰는 세 가지 방법</h2><div class="grid g3">' +
        '<div class="card flat" style="margin:0"><h3>수업·창체 시간</h3><p class="small">가상 학생부로 질문이 만들어지는 과정을 보여 준 뒤, 각자 자기 세특 문장으로 질문을 만들어 짝과 묻고 답합니다.</p></div>' +
        '<div class="card flat" style="margin:0"><h3>진학 상담</h3><p class="small">학생이 ‘나의 면접 노트’를 인쇄해 오게 하고, 상담에서는 별표 질문과 꼬리질문에 집중합니다.</p></div>' +
        '<div class="card flat" style="margin:0"><h3>혼자 하는 연습</h3><p class="small">1단계 발표 뒤에는 6단계에서 시간을 재며 소리 내어 답하게 합니다. 모의면접 사이를 혼자 채우는 도구입니다.</p></div></div></div>';
      h += '<div class="card"><h2>한 차시 진행안</h2>' + MJ.table(["시간", "활동", "화면"], [
        ["10분", "학종 면접의 모습과 면접관이 보는 것을 함께 확인합니다.", "1단계 ‘면접관이 보는 것’, ‘통계로 보는 면접’"],
        ["15분", "가상 학생부 한 문장에서 확인, 설명, 확장 질문이 만들어지는 것을 시연합니다.", "3단계 ‘가상 학생부로 먼저 해 보기’ → 4단계"],
        ["15분", "각자 자기 세특 한 문장을 옮겨 적고 질문을 세 개 고릅니다.", "3단계 → 4단계"],
        ["10분", "짝과 번갈아 묻고 답하고, 꼬리질문을 하나씩 이어 묻습니다.", "4단계 내 질문함"]
      ]) + '<p class="hint" style="margin-top:8px">학생이 자기 학생부를 넣는 활동은 개인 기기에서 하게 해 주세요. 공용 컴퓨터를 쓴다면 끝난 뒤 왼쪽 메뉴의 ‘초기화’를 누르게 합니다.</p></div>';
      h += '<div class="card"><div class="card-head"><h2>모의면접 운영</h2><button class="btn sm primary" data-act="print">' + MJ.icon("print", 15) + " 빈 관찰지 인쇄</button></div><ul>" +
        "<li><b>구성:</b> 면접관 두 사람과 관찰자 한 사람. 실제 면접에 가까운 인원입니다.</li>" +
        "<li><b>시간:</b> 10분 안팎. 시간이 되면 답하는 중이라도 끊습니다.</li>" +
        "<li><b>질문:</b> 지원동기로 시작해 학생부 질문을 묻고 마지막 말로 끝냅니다. 질문은 대여섯 개면 충분합니다.</li>" +
        "<li><b>꼬리질문:</b> 질문마다 ‘왜’, ‘그러면’, ‘다른 경우에는’을 하나 이상 묻습니다. 준비 정도는 여기서 드러납니다.</li>" +
        "<li><b>되돌아보기:</b> 녹화해서 학생이 직접 보게 합니다. 고칠 점은 한 번에 두세 개만 알려 줍니다.</li></ul>" +
        '<p class="hint">학생이 질문을 만들어 두었다면 ‘내 자료’의 모의면접 질문지를 인쇄해 건네받으면 됩니다.</p></div>';
      h += '<div class="card"><h2>학생에게 안내해 주세요</h2><ul>' +
        "<li>보안코드는 우리 학교 학생과 교직원에게만 안내합니다. 단체 대화방 밖이나 외부 게시판에 올리지 않습니다.</li>" +
        "<li>학생이 입력한 학생부와 답변은 서버로 가지 않고 그 기기에만 남습니다. 기기를 바꾸려면 ‘내 자료’에서 백업합니다.</li>" +
        "<li>학교 망에서 연결이 안 되면 잠시 뒤 다시 시도하거나, 휴대폰의 와이파이를 끄고 데이터로 열면 됩니다.</li></ul></div>";
      h += '<div class="card"><h2>면접후기를 보내 주세요</h2><p>이 안내서의 선배 후기는 충남 고등학교 선생님과 학생들이 해마다 남겨 주신 기록을 바탕으로 합니다. 학생이 면접을 다녀오면 ‘면접 후 기록’에 적게 하고, 복사한 글을 모아 충남진학있슈 면접후기에 등록해 주세요.</p>' +
        '<ul class="small"><li>등록: <a href="http://jinhak.cne.go.kr" target="_blank" rel="noopener">충남진학있슈</a> → 면접후기등록 (개별 등록 또는 엑셀 일괄 등록)</li><li>제출 기한과 협력고 기준은 공문을 확인해 주세요.</li></ul></div>';
      h += '<div id="printArea" class="print-area print-only"></div>';
      el.innerHTML = h;
      MJ.on(el, "click", {
        print: function () {
          el.querySelector("#printArea").innerHTML = sheetHtml();
          document.body.classList.add("printing");
          var done = function () { document.body.classList.remove("printing"); window.removeEventListener("afterprint", done); };
          window.addEventListener("afterprint", done);
          setTimeout(done, 60000);
          setTimeout(function () { window.print(); }, 50);
        }
      });
    }
  });
})();
