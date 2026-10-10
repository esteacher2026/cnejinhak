/* 답변 코칭 엔진: 구조 추천, 말하기 시간 환산, 문장 점검 */
(function () {
  "use strict";
  var MJ = window.MJ;
  var A = (MJ.a = {});

  A.syllables = function (text) { var m = String(text || "").match(/[가-힣0-9A-Za-z]/g); return m ? m.length : 0; };
  A.estSec = function (text, rate) { return A.syllables(text) / (rate || MJ.store.get().settings.rate || 5.2); };
  A.sentences = function (text) {
    return String(text || "").replace(/([.?!。])\s+/g, "$1\n").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  };
  A.frame = function (kind) { var f = (MJ.content.coach || {}).frames || {}; return f[kind] || f.experience; };
  A.joined = function (ans) {
    var f = A.frame(ans.kind), out = [];
    f.slots.forEach(function (s) { if (!s.reserve && ans.slots[s.key]) out.push(ans.slots[s.key].trim()); });
    return out.join(" ");
  };
  A.totalSec = function (ans) { return A.estSec(A.joined(ans)); };
  A.targetSec = function (kind) {
    var f = A.frame(kind), t = 0;
    f.slots.forEach(function (s) { if (!s.reserve) t += s.sec || 0; });
    return t;
  };

  /* 질문 문장으로 답변 유형 추정(사용자가 바꿀 수 있다) */
  A.guessKind = function (text) {
    var t = String(text || "");
    if (/결석|지각|조퇴|출결|성적이|등급이|이수하지|선택하지 않|듣지 않|떨어진|낮은 이유|하락/.test(t)) return "fact";
    if (/설명해|원리|개념|정의|무엇인가요\?*$|차이|어떤 내용|줄거리|핵심 (주장|내용)/.test(t) && !/경험|활동|역할/.test(t)) return "concept";
    if (/지원|동기|생각|의견|입장|찬성|반대|중요하다고|이유는|왜 |계획|하고 싶은 말|장점|단점|자기소개|어떤 (사람|교사|의사|간호사)/.test(t)) return "opinion";
    return "experience";
  };

  var LEARN = /배웠|배우게|알게|깨달|느꼈|달라|바꾸|바뀌|이후|앞으로|다음에는|고쳐|돌아보|부족했|아쉬웠|성장|생각하게/;
  var BRAG = /수상|1등|일등|최우수|우수상|칭찬|인정받|좋은 (결과|성적|평가)|성공적|만점/;

  A.check = function (ans) {
    var C = MJ.content.coach || {}, f = A.frame(ans.kind), out = [];
    var slots = ans.slots || {}, text = A.joined(ans);
    var filled = f.slots.filter(function (s) { return !s.reserve && (slots[s.key] || "").trim(); });
    var need = f.slots.filter(function (s) { return !s.reserve; });
    if (!filled.length) return [{ lv: "info", text: "칸을 채우면 여기에서 문장을 점검해 드립니다." }];

    // 1. 빈 칸
    need.forEach(function (s) { if (!(slots[s.key] || "").trim()) out.push({ lv: "bad", text: "‘" + s.label + "’ 칸이 비어 있습니다. " + (s.hint || "") }); });

    // 2. 말하기 시간
    var sec = A.estSec(text), target = A.targetSec(ans.kind);
    if (sec < 18 && filled.length === need.length) out.push({ lv: "bad", text: "말하면 약 " + Math.round(sec) + "초입니다. 너무 짧으면 근거가 전달되지 않습니다. 사례나 과정을 한 문장 더하세요." });
    else if (sec > 90) out.push({ lv: "red", text: "말하면 약 " + Math.round(sec) + "초입니다. 한 답변이 1분 30초를 넘으면 다음 질문을 받을 시간이 줄어듭니다. 절반으로 줄여 보세요." });
    else if (sec > 70) out.push({ lv: "bad", text: "말하면 약 " + Math.round(sec) + "초입니다. 1분 안쪽이 듣기 좋습니다. 배경 설명부터 덜어 내세요." });
    else if (filled.length === need.length) out.push({ lv: "ok", text: "말하면 약 " + Math.round(sec) + "초입니다. (권장 " + target + "초 안팎)" });

    // 3. 칸 사이 균형
    var total = A.syllables(text) || 1;
    if (ans.kind === "experience" && slots.situation && A.syllables(slots.situation) / total > 0.38)
      out.push({ lv: "bad", text: "상황 설명이 전체의 " + Math.round(A.syllables(slots.situation) / total * 100) + "%입니다. 면접관이 궁금한 것은 배경이 아니라 내가 한 행동입니다." });
    if (ans.kind === "opinion" && slots.point && A.sentences(slots.point).length > 2)
      out.push({ lv: "bad", text: "결론은 한두 문장으로 먼저 말하세요. 이유는 다음 칸에서 풀면 됩니다." });
    if (ans.kind === "fact" && slots.fact && A.syllables(slots.fact) / total > 0.4)
      out.push({ lv: "bad", text: "사실 설명이 깁니다. 사실은 짧게 인정하고, 이후에 무엇을 했는지에 시간을 쓰세요." });
    if (ans.kind === "concept" && slots.define && A.sentences(slots.define).length > 2)
      out.push({ lv: "bad", text: "정의는 한 문장으로 끊어 말하세요. 길어지면 무엇을 아는지 흐려집니다." });

    // 4. 긴 문장
    var longs = A.sentences(text).filter(function (s) { return A.syllables(s) > 75; });
    if (longs.length) out.push({ lv: "bad", text: "한 문장이 너무 깁니다(" + longs.length + "곳). 말로 하면 끝맺기 어렵습니다. 두 문장으로 나누세요." });

    // 5. 추상어
    var abs = (C.abstractWords || []).filter(function (w) { return text.indexOf(w) >= 0; });
    if (abs.length) out.push({ lv: "bad", text: "막연한 표현이 있습니다: " + abs.slice(0, 5).map(function (w) { return "‘" + w + "’"; }).join(", ") + ". 무엇을 어떻게 했는지로 바꿔 쓰세요." });

    // 6. 구체성(수치·장면)
    var body = ["action", "example", "case", "fix", "result"].map(function (k) { return slots[k] || ""; }).join(" ");
    if (body.trim().length > 20 && !/[0-9]|‘|’|'|"|“|번|회|명|개|주|일|시간|단계|차례/.test(body))
      out.push({ lv: "bad", text: "숫자나 장면이 보이지 않습니다. 몇 번, 몇 명, 어떤 순서였는지 하나만 넣어도 답이 살아납니다." });

    // 7. 마무리가 성찰인가
    var endKey = ans.kind === "experience" ? "reflect" : ans.kind === "opinion" ? "wrap" : ans.kind === "fact" ? "change" : null;
    if (endKey && (slots[endKey] || "").trim()) {
      var e = slots[endKey];
      if (ans.kind !== "opinion" && BRAG.test(e) && !LEARN.test(e)) out.push({ lv: "bad", text: "마무리가 성과 자랑으로 끝납니다. 그 경험으로 무엇이 달라졌는지로 닫으세요." });
      else if (ans.kind === "experience" && !LEARN.test(e)) out.push({ lv: "bad", text: "성찰 칸에 배운 점이나 달라진 점이 드러나지 않습니다." });
    }

    // 8. 블라인드 위반 가능 표현
    (C.blindPatterns || []).forEach(function (p) {
      var re; try { re = new RegExp(p.re); } catch (err) { return; }
      var m = re.exec(text);
      if (m) out.push({ lv: "red", text: "블라인드 면접에서 문제가 될 수 있는 표현: ‘" + m[0] + "’ (" + p.label + "). 대학의 유의사항을 확인하고 바꿔 말하세요." });
    });

    // 9. 글에 섞인 군말
    var fill = ["솔직히", "사실 ", "약간 ", "뭔가", "일단 ", "그냥 ", "어쨌든"].filter(function (w) { return text.indexOf(w) >= 0; });
    if (fill.length) out.push({ lv: "bad", text: "습관처럼 쓰는 말이 있습니다: " + fill.map(function (w) { return "‘" + w.trim() + "’"; }).join(", ") + ". 빼도 뜻이 같다면 빼세요." });

    // 10. 같은 말머리 반복
    var ss = A.sentences(text), jeo = ss.filter(function (s) { return /^(저는|제가)/.test(s); }).length;
    if (ss.length >= 4 && jeo >= Math.ceil(ss.length * 0.7)) out.push({ lv: "bad", text: "문장 대부분이 ‘저는’, ‘제가’로 시작합니다. 몇 곳은 주어를 빼거나 활동을 주어로 바꾸세요." });

    // 11. 문어체·명사형 종결
    if (/(함|음|됨|임)[.]?\s*$/.test(text.trim()) || /(하였음|했음|알게 됨)/.test(text))
      out.push({ lv: "bad", text: "학생부 문체(‘~함’, ‘~음’)가 남아 있습니다. 말하듯 ‘~했습니다’로 바꾸세요." });

    // 12. 개념 질문: 꼬리질문 대비
    if (ans.kind === "concept") {
      var rs = f.slots.filter(function (s) { return s.reserve; })[0];
      if (rs && !(slots[rs.key] || "").trim()) out.push({ lv: "info", text: "‘" + rs.label + "’ 칸은 말하지 않고 남겨 두는 칸입니다. 한 줄 적어 두면 꼬리질문에 바로 답할 수 있습니다." });
    }
    if (!out.some(function (o) { return o.lv === "bad" || o.lv === "red"; }) && filled.length === need.length)
      out.push({ lv: "ok", text: "구조와 길이가 알맞습니다. 이제 키워드만 남기고 소리 내어 말해 보세요." });
    return out;
  };

  /* 키워드 고르기용 낱말 나누기 */
  A.words = function (text) {
    return String(text || "").split(/\s+/).map(function (w) { return w.replace(/^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9]+$/g, ""); }).filter(Boolean);
  };
  var TAIL = /(으로써|으로서|에서는|에서도|이라는|라는|이라고|라고|에게서|에게|으로|에서|까지|부터|처럼|보다|이며|이고|하고|하며|하여|해서|했고|했으며|했습니다|합니다|입니다|습니다|였습니다|이었습니다|은|는|이|가|을|를|의|에|로|와|과|도|만)$/;
  A.stem = function (w) { var s = w.replace(TAIL, ""); return s.length >= 2 ? s : w; };

  /* 받아쓰기 분석 */
  A.speech = function (transcript, sec) {
    var C = MJ.content.coach || {}, t = String(transcript || "");
    var syl = A.syllables(t), counts = {}, n = 0;
    (C.fillerWords || []).forEach(function (w) {
      var re = new RegExp("(^|\\s)" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\s|[,.]|$)", "g"), m = t.match(re);
      if (m && m.length) { counts[w] = m.length; n += m.length; }
    });
    return { syl: syl, spm: sec > 0 ? Math.round(syl / sec * 60) : 0, fillers: n, fillerMap: counts };
  };
})();
