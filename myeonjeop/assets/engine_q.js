/* 질문 엔진: 학생부 문장 → 핵심어 추출 → 질문 틀 채우기 */
(function () {
  "use strict";
  var MJ = window.MJ;
  var Q = (MJ.q = {});

  /* ───────── 핵심어 추출 ───────── */
  var QUOTE = /[‘'“"「『<《]([^‘’'“”"「」『』<>《》]{2,40})[’'”"」』>》]/g;
  var ROLE = /(모둠장|조장|팀장|부장|차장|회장|부회장|반장|부반장|기장|총무|서기|사회자|발표자|진행자|멘토|기획자|편집장|리더|대표)/g;
  var TOPIC_PATS = [
    /([^,.;]{4,40}?)(?:을|를)\s*주제로/g,
    /([^,.;]{4,40}?)(?:이라는|라는)\s*주제/g,
    /([^,.;]{4,36}?)에\s*(?:대해|대하여|대한|관해|관하여|관한)\s*(?:탐구|조사|발표|보고서|토론|연구|분석|글|에세이|칼럼)/g,
    /([^,.;]{3,30}?)\s*(?:실험|프로젝트|캠페인|설문 조사|설문조사|모의재판|토론)(?:을|를)\s*(?:수행|진행|설계|기획|실시|주도)/g,
    /([^,.;]{4,36}?)(?:을|를)\s*(?:탐구|조사|분석|비교)(?:함|하여|하고|하였|했|한)/g
  ];
  var RESULT_PATS = [
    /([^,.;]{6,48}?(?:이라는|라는|다는)\s*(?:결론|결과|사실|점))(?=을|를|에|이|은|는|으로|과|와|\s|$)/g
  ];
  var BOOK_PATS = [
    /[『「《]([^』」》]{2,40})[』」》]/g,
    /[‘'“"]([^’'”"]{2,40})[’'”"]\s*(?:\([^)]{1,20}\))?\s*(?:을|를|이라는 책|라는 책|이란 책|란 책)?\s*(?:읽고|읽은|읽으며|읽어|독서)/g
  ];
  var CUT = /^(?:.*(?:하며|하고|하여|해서|하면서|으며|이며|으로써|에서는|에서|통해|위해|바탕으로|이후|뒤|중)\s+)/;
  var LEAD = /^(?:또한|특히|이후|이를 통해|이를|이에|그리고|평소|수업 중|수업 시간에|수업에서|시간에|단원에서|단원을 학습한 뒤|학습한 뒤)\s*/;

  function tidy(s) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    var m = CUT.exec(s);
    if (m && s.length - m[0].length >= 4) s = s.slice(m[0].length);
    var qi = Math.max(s.lastIndexOf("‘"), s.lastIndexOf("“"), s.lastIndexOf("「"));
    if (qi >= 0) s = s.slice(qi + 1);
    s = s.replace(/^\(?[^()]*\)\s*/, "");
    s = s.replace(LEAD, "").replace(/^[\s·,'"‘’“”()\[\]]+|[\s·,'"‘’“”()\[\]]+$/g, "");
    return s;
  }
  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { var k = x.replace(/\s+/g, ""); if (x && !seen[k]) { seen[k] = 1; out.push(x); } });
    return out;
  }
  function allMatches(re, text, idx) {
    var out = [], m; re.lastIndex = 0;
    while ((m = re.exec(text))) { out.push(m[idx == null ? 1 : idx]); if (m.index === re.lastIndex) re.lastIndex++; }
    return out;
  }

  var lexCache = null;
  function lexicon() {
    if (lexCache) return lexCache;
    var L = MJ.content.lexicon || { terms: {}, suffix: [], stop: [] };
    var terms = [];
    Object.keys(L.terms).forEach(function (g) { L.terms[g].forEach(function (t) { terms.push(t); }); });
    terms.sort(function (a, b) { return b.length - a.length; });
    var stop = {}; (L.stop || []).forEach(function (s) { stop[s] = 1; });
    var suf = (L.suffix || []).slice().sort(function (a, b) { return b.length - a.length; });
    var sufRe = suf.length ? new RegExp("([가-힣A-Za-z0-9]{2,10}(?:의 )?(?:" + suf.map(escRe).join("|") + "))(?![가-힣])", "g") : null;
    lexCache = { terms: terms, stop: stop, sufRe: sufRe };
    return lexCache;
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  Q.findConcepts = function (text) {
    var L = lexicon(), found = [], spans = [];
    var low = text;
    L.terms.forEach(function (t) {
      var from = 0, i;
      while ((i = low.indexOf(t, from)) >= 0) {
        var end = i + t.length, clash = false;
        for (var k = 0; k < spans.length; k++) if (i < spans[k][1] && end > spans[k][0]) { clash = true; break; }
        // 영문 약어는 낱말 경계에서만
        if (!clash && /^[A-Za-z0-9]+$/.test(t)) {
          var b = text.charAt(i - 1), a = text.charAt(end);
          if (/[A-Za-z0-9]/.test(b) || /[A-Za-z0-9]/.test(a)) clash = true;
        }
        if (!clash) { spans.push([i, end]); found.push([i, t]); }
        from = end;
      }
    });
    if (L.sufRe) {
      var m; L.sufRe.lastIndex = 0;
      while ((m = L.sufRe.exec(text))) {
        var t = m[1].trim(), i = m.index, end = i + m[1].length, clash = false;
        if (L.stop[t] || t.length < 3) continue;
        for (var k = 0; k < spans.length; k++) if (i < spans[k][1] && end > spans[k][0]) { clash = true; break; }
        if (!clash) { spans.push([i, end]); found.push([i, t]); }
      }
    }
    found.sort(function (a, b) { return a[0] - b[0]; });
    return uniq(found.map(function (x) { return x[1]; }));
  };

  Q.extract = function (text, area) {
    text = String(text || "");
    var chips = { topic: [], concept: [], book: [], role: [], result: [] };
    // 책
    BOOK_PATS.forEach(function (re) { allMatches(re, text).forEach(function (b) { chips.book.push(b.trim()); }); });
    chips.book = uniq(chips.book).slice(0, 4);
    // 주제
    var topics = [];
    allMatches(QUOTE, text).forEach(function (t) {
      t = t.trim();
      if (chips.book.indexOf(t) < 0 && t.length >= 4) topics.push(t);
    });
    var asConcept = [];
    TOPIC_PATS.forEach(function (re) { allMatches(re, text).forEach(function (t) {
      t = tidy(t); if (t.length < 4 || t.length > 34 || /[‘’“”]/.test(t)) return;
      if (/(원리|개념|이론|법칙|구조|정의)$/.test(t)) asConcept.push(t.replace(/의?\s*(원리|개념|정의)$/, "")); else topics.push(t);
    }); });
    chips.topic = uniq(topics).filter(function (t) { return !/^(이|그|저)\s/.test(t); }).slice(0, 4);
    // 역할
    chips.role = uniq(allMatches(ROLE, text)).slice(0, 3);
    // 결과
    var res = [];
    RESULT_PATS.forEach(function (re) { allMatches(re, text).forEach(function (t) { t = tidy(t); if (t.length >= 6) res.push(t); }); });
    chips.result = uniq(res).slice(0, 2);
    // 개념어
    var cs = uniq(Q.findConcepts(text).concat(asConcept)).filter(function (c) { return c.length >= 2 && chips.book.indexOf(c) < 0; });
    // 두 글자짜리 흔한 낱말(표본, 여론 …)보다 구체적인 용어를 앞에 둔다. 나머지는 문장에 나온 순서.
    chips.concept = cs.filter(function (c) { return c.length >= 3; }).concat(cs.filter(function (c) { return c.length < 3; })).slice(0, 8);
    return chips;
  };

  /* 표시(색) 제안: 학업 / 진로 / 공동체 / 확인 */
  var TAG_RULES = [
    ["확인", /미인정|무단|지각|결석|조퇴|하락|내려|떨어|부족|미흡|소극|어려움을 겪|다소|다만|아쉬|산만|이수하지|미이수|개설되지|선택하지 않/],
    ["공동체", /협력|협업|배려|나눔|봉사|갈등|조율|중재|경청|존중|모둠|조원|급우|친구|멘토|도움|책임|역할 분담|리더|회장|반장|부장|공동체|규칙|솔선/],
    ["진로", /진로|전공|학과|직업|희망|꿈|관심 분야|장래|계열|대학|연구원|교사|의사|간호|개발자|엔지니어/],
    ["학업", /탐구|개념|원리|이론|분석|실험|보고서|발표|이해|적용|증명|풀이|자료|비교|토론|독서|읽고|논리|심화|질문/]
  ];
  Q.suggestTags = function (text, area) {
    var tags = [];
    TAG_RULES.forEach(function (r) { if (r[1].test(text)) tags.push(r[0]); });
    if (area === "seteuk" && tags.indexOf("학업") < 0) tags.push("학업");
    if (area === "jinro" && tags.indexOf("진로") < 0) tags.push("진로");
    if ((area === "chulgyeol") && tags.indexOf("확인") < 0) tags.push("확인");
    if (area === "gwamok" || area === "chulgyeol") tags = tags.filter(function (t) { return t === "확인" || t === "진로"; });
    return tags;
  };

  /* ───────── 틀 채우기 ───────── */
  var SLOT = /\{(topic|concept|book|role|subject|result)(?:\|(을|이|은|과|으로|이라는))?\}/g;
  Q.fill = function (tpl, vals) {
    return String(tpl).replace(SLOT, function (_, name, josa) {
      var v = vals[name] || "";
      var shown = name === "book" ? "『" + v + "』" : name === "topic" || name === "result" ? "‘" + v + "’" : v;
      return shown + (josa ? MJ.josa(v, josa) : "");
    }).replace(/활동(’?)\s*활동/g, "활동$1").replace(/\s+/g, " ").trim();
  };
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  function pick(arr, seed) { return arr[seed % arr.length]; }

  var ACTIVITY = { seteuk: 1, jayul: 1, dongari: 1, jinro: 1 };
  function templatesFor(area) {
    return (MJ.content.qt || []).filter(function (t) { return t.area.indexOf(area) >= 0 || (ACTIVITY[area] && t.area.indexOf("any") >= 0); });
  }
  /* 이수·성적 기록에서 과목 이름 찾기 */
  var SUBJ = /(통합사회|통합과학|한국사|공통수학\s?[12ⅠⅡ]?|공통국어\s?[12ⅠⅡ]?|공통영어\s?[12ⅠⅡ]?|수학\s?[ⅠⅡ]|수학|미적분\s?[ⅠⅡ]?|확률과\s?통계|기하|대수|경제\s?수학|인공지능\s?수학|물리학\s?[ⅠⅡ]?|화학\s?[ⅠⅡ]?|생명과학\s?[ⅠⅡ]?|지구과학\s?[ⅠⅡ]?|역학과\s?에너지|전자기와\s?양자|물질과\s?에너지|화학\s?반응의\s?세계|세포와\s?물질대사|생물의\s?유전|지구시스템과학|행성우주과학|과학과제\s?연구|융합과학\s?탐구|정보|인공지능\s?기초|프로그래밍|국어|문학|독서|화법과\s?작문|언어와\s?매체|영어\s?[ⅠⅡ]?|영어\s?독해와\s?작문|사회·문화|사회와\s?문화|생활과\s?윤리|윤리와\s?사상|정치와\s?법|정치|법과\s?사회|경제|세계사|동아시아사|한국지리|세계지리|사회문제\s?탐구|제2외국어|중국어\s?[ⅠⅡ]?|일본어\s?[ⅠⅡ]?|한문|기술·가정|보건|심리학|교육학|체육|음악|미술)/g;
  function subjectNear(text, cond) {
    var subs = [], m; SUBJ.lastIndex = 0;
    while ((m = SUBJ.exec(text))) subs.push([m.index, m[1].trim()]);
    if (!subs.length) return "";
    var key = COND[cond], km = key ? key.exec(text) : null;
    if (!km) return subs[0][1];
    var best = subs[0];
    subs.forEach(function (x) { if (x[0] < km.index) best = x; });
    return best[1];
  }
  function sentencesOf(text) { return String(text).replace(/([.。])\s+/g, "$1\n").split(/\n+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 3; }); }
  function usable(t, vals) { return (t.needs || []).every(function (n) { return vals[n]; }); }
  /* 기록에 그 사실이 있어야만 성립하는 틀(cond) */
  var COND = {
    nottaken: /이수하지|미이수|개설되지|선택하지 않|듣지 않|수강하지/,
    up: /상승|올라|올랐|향상|올림/, down: /하락|내려|떨어/, low: /낮은|낮음|낮게|부족|미흡/,
    late: /(미인정|무단)\s*지각|지각[^.\n]{0,8}(미인정|무단)/, absent: /(미인정|무단)\s*결석|결석[^.\n]{0,8}(미인정|무단)/,
    leave: /(미인정|무단)\s*(조퇴|결과)|(조퇴|결과)[^.\n]{0,8}(미인정|무단)/, many: /여러|많|잦|[3-9]\s*회|\d{2}\s*회|[3-9]\s*일/
  };
  function condOk(t, text) { return !t.cond || (COND[t.cond] && COND[t.cond].test(text)); }

  /* 한 항목에서 만들 질문 구성(의도×깊이). 영역마다 기본 묶음이 다르다. */
  var RECIPE = {
    seteuk: [["motive", 1], ["process", 2], ["concept", 2], ["concept", 3], ["growth", 2], ["extend", 3], ["process", 1], ["motive", 2]],
    jayul: [["motive", 1], ["process", 2], ["process", 1], ["growth", 2], ["extend", 3], ["concept", 2]],
    dongari: [["motive", 1], ["process", 2], ["process", 1], ["concept", 2], ["growth", 2], ["extend", 3]],
    jinro: [["motive", 2], ["process", 1], ["growth", 2], ["extend", 3], ["concept", 2], ["motive", 1]],
    haengteuk: [["process", 1], ["growth", 2], ["process", 2], ["extend", 3], ["growth", 1], ["motive", 2], ["concept", 2], ["growth", 3]],
    gwamok: [["motive", 2], ["process", 2], ["growth", 2], ["extend", 3], ["motive", 1], ["process", 1], ["concept", 2]],
    chulgyeol: [["process", 1], ["growth", 2], ["process", 2], ["extend", 3]]
  };

  /* item: {id, area, subject, text, chips}  opt: {count, salt, exclude:[tplId]} */
  Q.generate = function (item, opt) {
    opt = opt || {};
    var chips = item.chips || Q.extract(item.text, item.area);
    var base = {
      subject: item.subject || "",
      topic: (chips.topic || [])[0] || "", concept: (chips.concept || [])[0] || "",
      book: (chips.book || [])[0] || "", role: (chips.role || [])[0] || "", result: (chips.result || [])[0] || ""
    };
    var unexcused = /미인정|무단/.test(item.text);
    var pool = templatesFor(item.area).filter(function (t) {
      if (!condOk(t, item.text)) return false;
      if (!unexcused && /미인정|무단/.test(t.text)) return false;   // 질병·인정 결석을 미인정으로 묻지 않는다
      return true;
    });
    var recipe = RECIPE[item.area] || RECIPE.seteuk;
    var count = opt.count || Math.min(recipe.length, item.area === "seteuk" ? 7 : item.area === "chulgyeol" ? 2 : 5);
    var used = {}; (opt.exclude || []).forEach(function (id) { used[id] = 1; });
    var out = [], seed = hash(item.id + "|" + (opt.salt || 0));
    var conceptIdx = 0, topicIdx = 0;

    var avoid = {}; (opt.avoidTexts || []).forEach(function (t) { avoid[t] = 1; });
    function push(q) { if (q && !avoid[q.text]) { avoid[q.text] = 1; out.push(q); } }
    if (!ACTIVITY[item.area]) {
      sentencesOf(item.text).forEach(function (sen) {
        Object.keys(COND).forEach(function (c) {
          if (!COND[c].test(sen)) return;
          var vals = Object.assign({}, base); if (!vals.subject) vals.subject = subjectNear(sen, c);
          var cs = pool.filter(function (t) { return t.cond === c && !used[t.id] && usable(t, vals); });
          if (cs.length) { var t = pick(cs, seed + out.length); used[t.id] = 1; push(build(t, vals, item)); }
        });
      });
      if (!base.subject && item.area === "gwamok") base.subject = subjectNear(item.text, "");
      pool = pool.filter(function (t) { return !t.cond; });
      /* 이수하지 않은 과목을 '선택한 이유'·'공부한 방법'으로 묻지 않는다: 보완·대신·개설을 묻는 틀만 남긴다 */
      if (item.area === "gwamok" && COND.nottaken.test(item.text)) {
        pool = pool.filter(function (t) { return /보완|대신|개설|이수|듣지|못한|않은/.test(t.text); });
        count = Math.min(count, out.length + 2);
      }
    }
    // 행특의 유보 표현(다만, 다소 …)은 실제 질문으로 이어지기 쉽다.
    if (item.area === "haengteuk" && /다만|다소|편이나|필요함|노력이 필요|아쉬/.test(item.text)) {
      var hp = pool.filter(function (t) { return t.id === "ht-p2-04" && !used[t.id]; })[0];
      if (hp) { used[hp.id] = 1; push(build(hp, base, item)); }
    }
    function tryCell(intent, depth) {
      var cands = pool.filter(function (t) { return t.intent === intent && t.depth === depth && !used[t.id]; });
      if (!cands.length) return null;
      // 추출 칸을 쓰는 틀을 먼저, 없으면 일반형
      var vals = Object.assign({}, base);
      if (intent === "concept" && chips.concept && chips.concept.length) vals.concept = chips.concept[conceptIdx++ % chips.concept.length];
      if (item.area === "seteuk" && chips.topic && chips.topic.length > 1 && intent !== "concept") vals.topic = chips.topic[topicIdx++ % chips.topic.length];
      var specific = cands.filter(function (t) { return (t.needs || []).length && usable(t, vals); });
      var generic = cands.filter(function (t) { return !(t.needs || []).length; });
      var conds = cands.filter(function (t) { return t.cond && usable(t, vals); });
      var from = conds.length ? conds : specific.length ? specific : generic;
      if (!from.length) return null;
      var t = pick(from, seed + out.length * 7 + depth);
      used[t.id] = 1;
      return build(t, vals, item);
    }
    for (var i = 0; i < recipe.length && out.length < count; i++) push(tryCell(recipe[i][0], recipe[i][1]));
    // 기록의 사실(미이수, 지각 등)에 맞는 틀은 빠뜨리지 않는다.
    pool.filter(function (t) { return t.cond && !used[t.id] && usable(t, base); }).slice(0, 2).forEach(function (t) { used[t.id] = 1; push(build(t, base, item)); });
    // 책이 적힌 문장은 책 질문을 하나 보탠다.
    if (base.book) {
      var bk = pool.filter(function (t) { return (t.needs || []).indexOf("book") >= 0 && !used[t.id]; });
      if (bk.length) { var t = pick(bk, seed + 3); used[t.id] = 1; push(build(t, base, item)); }
    }
    return out;
  };
  function build(t, vals, item) {
    return {
      id: MJ.uid("q"), tpl: t.id, text: Q.fill(t.text, vals), kind: t.kind, factor: t.factor, depth: t.depth, intent: t.intent,
      purpose: t.purpose, tails: (t.tails || []).map(function (x) { return Q.fill(x, vals); }),
      src: { type: "item", ref: item.id, area: item.area, subject: item.subject || "" }, star: false, hidden: false
    };
  }
  /* 같은 칸(의도×깊이)의 다른 틀로 바꾸기 */
  Q.swap = function (q, item, excludeIds) {
    var chips = item.chips || {};
    var vals = { subject: item.subject || "", topic: (chips.topic || [])[0] || "", concept: (chips.concept || [])[0] || "", book: (chips.book || [])[0] || "", role: (chips.role || [])[0] || "", result: (chips.result || [])[0] || "" };
    var all = templatesFor(item.area).filter(function (t) { return condOk(t, item.text); });
    var cands = all.filter(function (t) { return t.intent === q.intent && t.depth === q.depth && excludeIds.indexOf(t.id) < 0 && usable(t, vals); });
    if (!cands.length) cands = all.filter(function (t) { return t.intent === q.intent && excludeIds.indexOf(t.id) < 0 && usable(t, vals); });
    if (!cands.length) return null;
    var t = cands[Math.floor(Math.random() * cands.length)];
    var n = build(t, vals, item); n.id = q.id; n.star = q.star;
    return n;
  };

  Q.fromCommon = function (c) {
    return { id: MJ.uid("q"), tpl: c.id, text: c.text, kind: c.kind, factor: c.factor, depth: 2, intent: "", purpose: c.intent, guide: c.guide, avoid: c.avoid, tails: c.tails || [], src: { type: "common", ref: c.id }, star: false, hidden: false };
  };
  Q.fromWeak = function (w, text) {
    return { id: MJ.uid("q"), tpl: w.id, text: text || w.text, kind: "fact", factor: "신뢰", depth: 2, intent: "", purpose: w.intent, guide: w.guide, tails: w.tails || [], src: { type: "weak", ref: w.id, cat: w.cat }, star: false, hidden: false };
  };
  Q.fromGajang = function (adj, area) {
    var g = MJ.content.gajang;
    var text = g.make.replace("{adj}", adj.label).replace(/\{area(?:\|(을|이|은|과|으로|이라는))?\}/, function (_, j) { return area.label + (j ? MJ.josa(area.label, j) : ""); });
    return { id: MJ.uid("q"), tpl: "gj-" + adj.key + "-" + area.key, text: text, kind: "experience", factor: "학업", depth: 2, intent: "", purpose: "많은 활동 가운데 무엇을 고르는지, 그 이유를 스스로 설명할 수 있는지 봅니다.", tails: ["그 활동을 고른 기준은 무엇인가요?", "그 경험이 이후의 선택에 어떤 영향을 주었나요?"], src: { type: "gajang", ref: adj.key + "-" + area.key }, star: false, hidden: false };
  };
  Q.custom = function (text, kind) {
    return { id: MJ.uid("q"), tpl: "", text: text, kind: kind || "experience", factor: "", depth: 0, intent: "", purpose: "", tails: [], src: { type: "custom" }, star: false, hidden: false };
  };

  /* 평가요소 구성 비교: 내 질문함 vs 대학 비율 */
  Q.mix = function (questions) {
    var c = { "학업": 0, "진로": 0, "공동체": 0, "소통": 0, "신뢰": 0 }, n = 0;
    questions.forEach(function (q) { if (!q.hidden && c[q.factor] != null) { c[q.factor]++; n++; } });
    var out = {}; Object.keys(c).forEach(function (k) { out[k] = n ? c[k] / n : 0; });
    return { n: n, share: out, count: c };
  };

  /* 기출 대조: 계열 자료에서 핵심어가 들어간 문항 찾기 */
  var TRACK_FILE = { "인문사회": "inmun", "공학": "gonghak", "자연": "jayeon", "의약보건": "uiyak", "교육": "gyoyuk", "예체능": "yeche", "공통": "common" };
  Q.loadBank = function (track) {
    var f = "qbank_" + (TRACK_FILE[track] || "common");
    return MJ.load(f);
  };
  Q.searchBank = function (bank, words, typeIdx, limit, mgIdx) {
    var out = [];
    words = (words || []).filter(Boolean).map(function (w) { return w.replace(/\s+/g, ""); });
    for (var i = 0; i < bank.q.length && out.length < (limit || 30); i++) {
      var q = bank.q[i];
      if (typeIdx != null && typeIdx >= 0 && q[1] !== typeIdx) continue;
      if (mgIdx != null && mgIdx >= 0 && q[2] !== mgIdx) continue;
      if (words.length) {
        var t = q[0].replace(/\s+/g, ""), hit = false;
        for (var k = 0; k < words.length; k++) if (t.indexOf(words[k]) >= 0) { hit = true; break; }
        if (!hit) continue;
      }
      out.push(q);
    }
    return out;
  };
})();
