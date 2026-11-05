/* 면접 후 기록: 받은 질문을 잊기 전에 적어 두고, 다음 면접 준비와 후배를 위한 후기로 잇는다 */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;

  function lines(t) { return String(t || "").split(/\n/).map(function (x) { return x.replace(/^\s*(\d+[.)]|[-·•])\s*/, "").trim(); }).filter(Boolean); }

  /* 진학있슈 면접후기 칸 순서에 맞춘 글. 이름·학교·합격 여부는 넣지 않는다 */
  function asText(a) {
    return ["[대학명] " + a.univ, "[학과] " + (a.major || ""), "[전형명] " + (a.adm || ""), "[면접 형태] " + (a.form || ""),
      "[면접 진행방식] " + (a.proc || ""), "[받은 질문]\n" + (a.qs || []).map(function (q, i) { return (i + 1) + ". " + q; }).join("\n"),
      "[후배에게 당부] " + (a.advice || "")].join("\n");
  }

  function formHtml(a) {
    return '<div class="grid g2"><div class="field"><label class="f" for="afU">대학</label><input class="in" id="afU" value="' + esc(a.univ || "") + '" placeholder="예: 충남대학교"></div>' +
      '<div class="field"><label class="f" for="afA">전형</label><input class="in" id="afA" value="' + esc(a.adm || "") + '"></div></div>' +
      '<div class="grid g2"><div class="field"><label class="f" for="afM">학과</label><input class="in" id="afM" value="' + esc(a.major || "") + '"></div>' +
      '<div class="field"><label class="f" for="afF">면접 형태 <span class="mute">(선택)</span></label><input class="in" id="afF" value="' + esc(a.form || "") + '" placeholder="예: 면접관 2명, 10분, 학생부 기반"></div></div>' +
      '<div class="field"><label class="f" for="afQ">받은 질문 <span class="mute">(한 줄에 하나씩, 기억나는 대로)</span></label><textarea class="in" id="afQ" rows="7" placeholder="지원동기를 말해 보세요.&#10;세특에 나온 ○○의 원리를 설명해 보세요.&#10;그때 왜 그 방법을 골랐나요?">' + esc((a.qs || []).join("\n")) + "</textarea></div>" +
      '<div class="field"><label class="f" for="afP">진행 방식 <span class="mute">(선택)</span></label><textarea class="in" id="afP" rows="2" placeholder="대기 시간, 입실 순서, 자료를 볼 수 있었는지 등">' + esc(a.proc || "") + "</textarea></div>" +
      '<div class="field"><label class="f" for="afD">후배에게 하고 싶은 말 <span class="mute">(선택)</span></label><textarea class="in" id="afD" rows="2">' + esc(a.advice || "") + "</textarea></div>";
  }

  MJ.register("after", {
    title: "면접 후 기록",
    render: function (el, r) {
      var st = MJ.store.get(), t = r.q.t ? st.targets.filter(function (x) { return x.id === r.q.t; })[0] : null;
      var today = MJ.iso(MJ.today());
      var past = st.targets.filter(function (x) { return x.date && x.date < today; });
      var cur = t ? { univ: t.univ, adm: String(t.adm || ""), major: t.major || "", tid: t.id } : {};
      var h = '<header class="page-head"><h1>면접 후 기록</h1><p>받은 질문은 하루만 지나도 흐려집니다. 면접장을 나온 날 적어 두면 다음 면접 준비에 쓸 수 있고, 후배에게는 가장 좋은 자료가 됩니다.</p></header>';
      if (past.length && !t) h += '<div class="chips" style="margin-bottom:12px"><span class="small mute" style="padding-top:6px">다녀온 면접:</span>' + past.map(function (x) { return '<a class="chip" href="#/after?t=' + esc(x.id) + '">' + esc(x.univ) + " 적기</a>"; }).join("") + "</div>";
      h += '<div class="card"><h2>' + (t ? esc(t.univ) + " 기록" : "새 기록") + "</h2>" + formHtml(cur) +
        '<div class="callout warn small"><b class="t">적지 않을 것</b>내 이름, 학교 이름, 사는 지역, 다른 사람의 이름과 연락처, 합격·불합격 결과는 적지 마세요. 내 답변도 적지 않아도 됩니다.</div>' +
        '<div class="row end"><button class="btn primary" data-act="save">이 기기에 저장</button></div></div>';

      var list = st.afters.slice().reverse();
      if (list.length) {
        h += '<div class="card"><h2>저장한 기록 ' + list.length + "건</h2>" + list.map(function (a) {
          return '<div class="card flat" style="margin-bottom:10px"><div class="row between"><b>' + esc(a.univ || "대학 미입력") + "</b>" + (a.major ? ' <span class="small mute">' + esc(a.major) + "</span>" : "") + '<span class="grow"></span><span class="tag">질문 ' + (a.qs || []).length + "개</span></div>" +
            (a.form ? '<p class="small mute" style="margin:6px 0 0">' + esc(a.form) + "</p>" : "") +
            '<ol class="small" style="margin:8px 0 10px;padding-left:20px">' + (a.qs || []).map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ol>" +
            '<div class="row"><button class="btn sm primary" data-act="copy" data-id="' + esc(a.id) + '">후기 글 복사</button><button class="btn sm" data-act="toq" data-id="' + esc(a.id) + '">내 질문함에 담기</button><button class="btn sm" data-act="del" data-id="' + esc(a.id) + '">지우기</button></div></div>';
        }).join("") + "</div>";
        h += '<div class="card"><h2>이 기록으로 할 수 있는 일</h2><ul>' +
          "<li><b>다음 면접 준비:</b> 내 질문함에 담아 답변을 다시 짜 보세요. 막혔던 질문은 다른 대학에서 또 나올 수 있습니다.</li>" +
          "<li><b>후배에게 남기기:</b> ‘후기 글 복사’를 눌러 진로진학 담당 선생님께 전하세요. 이 안내서의 선배 후기도 이렇게 모였습니다.</li></ul></div>";
      }
      el.innerHTML = h;

      var read = function () {
        return { univ: el.querySelector("#afU").value.trim(), adm: el.querySelector("#afA").value.trim(), major: el.querySelector("#afM").value.trim(), form: el.querySelector("#afF").value.trim(),
          qs: lines(el.querySelector("#afQ").value), proc: el.querySelector("#afP").value.trim(), advice: el.querySelector("#afD").value.trim() };
      };
      var byId = function (t2) { var id = t2.getAttribute("data-id"); return st.afters.filter(function (x) { return x.id === id; })[0]; };
      MJ.on(el, "click", {
        save: function () {
          var a = read();
          if (!a.qs.length && !a.proc && !a.advice) { MJ.toast("받은 질문을 하나 이상 적어 주세요."); return; }
          a.id = MJ.uid("af"); a.at = today;
          st.afters.push(a);
          var ok = MJ.store.save();
          if (ok) MJ.toast("이 기기에 저장했습니다.");
          MJ.go("#/after");
          if (location.hash === "#/after") MJ.rerender();
        },
        copy: function (t2) { var a = byId(t2); if (a) MJ.copyText(asText(a), "후기 글을 복사했습니다. 이름·학교가 들어가지 않았는지 한 번 더 보고 전해 주세요."); },
        toq: function (t2) {
          var a = byId(t2); if (!a) return;
          var have = {}; st.questions.forEach(function (q) { have[q.text] = 1; });
          var n = 0;
          (a.qs || []).forEach(function (txt) { if (have[txt]) return; have[txt] = 1; st.questions.push(MJ.q.custom(txt, MJ.a.guessKind(txt))); n++; });
          MJ.store.save();
          MJ.toast(n ? "질문 " + n + "개를 내 질문함에 담았습니다." : "이미 모두 담겨 있습니다.");
        },
        del: function (t2) { var a = byId(t2); if (!a) return; MJ.confirm("이 기록을 지울까요?", function () { st.afters.splice(st.afters.indexOf(a), 1); MJ.store.save(); MJ.rerender(); }, "지우기"); }
      });
    }
  });
})();
