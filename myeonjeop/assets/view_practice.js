/* 6단계 실전 연습하기: 혼자 연습(질문 읽어 주기, 타이머, 꼬리질문, 녹음, 받아쓰기) */
(function () {
  "use strict";
  var MJ = window.MJ, esc = MJ.esc;
  var run = null;   // 진행 중인 연습
  var QUICK = [["head", "첫 문장에서 질문에 답했다"], ["concrete", "장면이나 숫자를 하나 이상 말했다"], ["time", "시간 안에 끝맺었다"], ["own", "외운 문장이 아니라 내 말로 했다"]];
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function answered(st, q) { var a = st.answers[q.id]; return !!(a && Object.keys(a.slots || {}).some(function (k) { return (a.slots[k] || "").trim(); })); }
  /* 저장은 UTC(ISO)로 하므로 표시할 때 이 기기의 날짜로 바꾼다 */
  function localDay(iso) { var d = new Date(iso); if (isNaN(d)) return String(iso).slice(0, 10); var p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* 실제 면접처럼: 여는 질문 → 학생부 질문 → 마지막 말 */
  function realSet(st, n) {
    var qs = st.questions.filter(function (q) { return !q.hidden; });
    var by = function (re) { return qs.filter(function (q) { return re.test(q.tpl || ""); })[0]; };
    var open = by(/intro/) || by(/motive/), last = by(/last/);
    var mid = shuffle(qs.filter(function (q) { return q !== open && q !== last && (q.src || {}).type !== "common"; })).sort(function (a, b) { return (b.star ? 1 : 0) - (a.star ? 1 : 0); });
    var commons = shuffle(qs.filter(function (q) { return q !== open && q !== last && (q.src || {}).type === "common"; }));
    var out = [];
    if (open) out.push(open);
    var room = n - out.length - (last ? 1 : 0);
    var nc = Math.min(commons.length, Math.max(0, Math.round(room * 0.25)));
    mid.slice(0, room - nc).forEach(function (q) { out.push(q); });
    commons.slice(0, room - (out.length - (open ? 1 : 0))).forEach(function (q) { out.push(q); });
    if (last) out.push(last);
    return out.slice(0, n);
  }
  /* 대학 맞춤: 그 대학이 공개한 질문(guide.js)과 내 질문함의 별표·학생부 질문을 섞는다.
     공개 질문은 질문함에 담지 않은 임시 질문(temp)으로 쓰고, 끝난 뒤 원하면 담는다. */
  var RX_OPEN = /intro/;
  function univSet(st, G, univ, n) {
    var ui = G.u.indexOf(univ), mine = st.questions.filter(function (q) { return !q.hidden; });
    var have = {}; mine.forEach(function (q) { have[q.text] = 1; });
    var pool = shuffle(G.q.map(function (g, i) { return i; }).filter(function (i) {
      var g = G.q[i];
      return g[0] === ui && !have[g[1]] && (g[11] !== 0 || /○|◯|OO|ㅇㅇ|□/.test(g[1]));
    }));
    var toQ = function (i) {
      var g = G.q[i];
      return { id: "g" + i, temp: true, tpl: "", text: g[1], kind: g[11] ? "opinion" : MJ.a.guessKind(g[1]), factor: g[3] || "", depth: 0, purpose: g[7] || "", tails: g[9].slice(), guide: g[8] ? [g[8]] : null, src: { type: "official", ref: univ } };
    };
    var by = function (re) { return mine.filter(function (q) { return re.test(q.tpl || "") || (!q.tpl && re === RX_OPEN && /자기\s*소개|지원\s*(동기|한\s*이유)/.test(q.text)); })[0]; };
    var open = by(RX_OPEN) || by(/motive/), last = by(/last/);
    if (!open) { var oi = pool.filter(function (i) { return /지원\s*(동기|이유)|자기\s*소개/.test(G.q[i][1]); })[0]; if (oi != null) { open = toQ(oi); pool.splice(pool.indexOf(oi), 1); } }
    var room = n - (open ? 1 : 0) - (last ? 1 : 0);
    var nOff = Math.min(pool.length, Math.max(1, Math.round(room * 0.6)));
    var own = shuffle(mine.filter(function (q) { return q !== open && q !== last && (q.src || {}).type !== "common"; })).sort(function (a, b) { return (b.star ? 1 : 0) - (a.star ? 1 : 0); });
    var mid = pool.slice(0, nOff).map(toQ).concat(own.slice(0, room - nOff));
    if (mid.length < room) mid = mid.concat(pool.slice(nOff, nOff + room - mid.length).map(toQ));
    var out = [];
    if (open) out.push(open);
    shuffle(mid).forEach(function (q) { out.push(q); });
    if (last) out.push(last);
    return out.slice(0, n);
  }
  function buildSet(st, mode, n, qid) {
    var qs = st.questions.filter(function (q) { return !q.hidden; });
    if (mode === "one") return qs.filter(function (q) { return q.id === qid; });
    if (mode === "star") return shuffle(qs.filter(function (q) { return q.star; })).slice(0, n);
    if (mode === "written") return shuffle(qs.filter(function (q) { return answered(st, q); })).slice(0, n);
    if (mode === "real") return realSet(st, n);
    return shuffle(qs).slice(0, n);
  }

  function speak(text, done) {
    var st = MJ.store.get();
    if (!st.settings.ttsOn || !window.speechSynthesis) { if (done) setTimeout(done, 300); return; }
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text); u.lang = "ko-KR"; u.rate = 1;
      var vs = window.speechSynthesis.getVoices().filter(function (v) { return /ko/i.test(v.lang); }); if (vs[0]) u.voice = vs[0];
      var fired = false, fin = function () { if (!fired) { fired = true; if (done) done(); } };
      u.onend = fin; u.onerror = fin;
      window.speechSynthesis.speak(u);
      setTimeout(fin, Math.max(4000, text.length * 260));   // 음성 엔진이 끝을 알리지 않는 기기 대비
    } catch (e) { if (done) done(); }
  }
  function stopAll() {
    if (!run) return;
    clearInterval(run.timer);
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* 무시 */ }
    try { if (run.rec && run.rec.state !== "inactive") run.rec.stop(); } catch (e) { /* 무시 */ }
    try { if (run.stream) run.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* 무시 */ }
    try { if (run.sr) { run.sr.onend = null; run.sr.stop(); } } catch (e) { /* 무시 */ }
    (run.urls || []).forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* 무시 */ } });
  }

  function setupHtml(st, r) {
    var s = st.settings, qs = st.questions.filter(function (q) { return !q.hidden; });
    var nStar = qs.filter(function (q) { return q.star; }).length, nWr = qs.filter(function (q) { return answered(st, q); }).length;
    var one = r.q.q ? qs.filter(function (q) { return q.id === r.q.q; })[0] : null;
    var h = MJ.stepHead("practice");
    if (!qs.length && !st.targets.length) return h + '<div class="empty"><b>연습할 질문이 없습니다</b>4단계에서 질문을 만들어 질문함에 담거나, 2단계에서 지원 대학을 담으면 그 대학이 공개한 질문으로 연습할 수 있습니다.<div class="row" style="justify-content:center;margin-top:10px"><a class="btn primary" href="#/questions">4단계로 가기</a><a class="btn" href="#/univ">2단계로 가기</a></div></div>' + MJ.stepNav("practice");
    if (!qs.length) h += '<div class="callout small">질문함이 비어 있어 지원 대학이 공개한 질문으로만 연습할 수 있습니다. 4단계에서 내 학생부 질문을 만들면 섞어서 연습합니다.</div>';
    h += '<div class="card"><h2>연습 방법 정하기</h2><div class="field"><label class="f">질문 묶음</label><div class="chips" id="pMode">' +
      (one ? '<button class="chip on" data-m="one">이 질문만</button>' : "") +
      '<button class="chip ' + (one ? "" : "on") + '" data-m="real"' + (qs.length ? "" : " disabled") + '>실제 면접처럼</button><button class="chip" data-m="star"' + (nStar ? "" : " disabled") + ">별표 질문 (" + nStar + ')</button><button class="chip" data-m="written"' + (nWr ? "" : " disabled") + ">답변을 쓴 질문 (" + nWr + ')</button><button class="chip" data-m="all"' + (qs.length ? "" : " disabled") + '>전체에서 무작위 (' + qs.length + ")</button></div>" +
      (one ? '<p class="hint">' + esc(one.text) + "</p>" : '<p class="hint" id="pModeHint">자기소개나 지원동기로 시작해 학생부 질문을 거쳐 마지막 말로 끝나는 순서입니다.</p>') + "</div>" +
      '<div class="grid g3"><div class="field"><label class="f" for="pN">문항 수</label><select class="in" id="pN">' + [3, 5, 7, 10].map(function (n) { return "<option" + (n === 7 ? " selected" : "") + ">" + n + "</option>"; }).join("") + '</select></div><div class="field"><label class="f" for="pA">답변 시간</label><select class="in" id="pA">' + [45, 60, 90, 120].map(function (n) { return '<option value="' + n + '"' + (n === s.answerSec ? " selected" : "") + ">" + n + "초</option>"; }).join("") + '</select></div><div class="field"><label class="f" for="pT">생각할 시간</label><select class="in" id="pT">' + [0, 5, 10].map(function (n) { return '<option value="' + n + '"' + (n === s.thinkSec ? " selected" : "") + ">" + (n ? n + "초" : "없음") + "</option>"; }).join("") + "</select></div></div>" +
      '<div id="pStat" class="hint" style="margin:-4px 0 10px"></div>' +
      '<label class="switch"><span><b>꼬리질문 이어서 받기</b><small>답이 끝나면 꼬리질문 하나가 이어집니다. 준비 정도가 가장 잘 드러나는 지점입니다.</small></span><input type="checkbox" id="pTail" ' + (s.tails ? "checked" : "") + "></label>" +
      '<label class="switch"><span><b>질문을 소리로 읽어 주기</b><small>기기의 음성 기능을 씁니다. 소리가 나지 않으면 화면의 질문을 읽으세요.</small></span><input type="checkbox" id="pTts" ' + (s.ttsOn ? "checked" : "") + "></label>" +
      '<details class="acc" style="margin-top:10px"' + (s.recOn || s.sttOn ? " open" : "") + '><summary><span><b>녹음과 받아쓰기</b> <span class="mute small">선택 · 마이크를 씁니다</span></span></summary><div class="acc-body">' +
      '<label class="switch"><span><b>내 답변 녹음해서 다시 듣기</b><small>녹음은 이 기기의 메모리에만 잠시 머물고, 화면을 떠나면 지워집니다. 어디로도 전송되지 않습니다.</small></span><input type="checkbox" id="pRec" ' + (s.recOn ? "checked" : "") + "></label>" +
      '<label class="switch"><span><b>받아쓰기로 말 속도와 군말 세기</b><small>' + (SR ? "브라우저의 음성 인식 기능을 씁니다. 크롬·엣지에서는 음성이 브라우저 제조사의 서버로 보내져 글자로 바뀝니다. 원하지 않으면 끄세요." : "이 브라우저는 음성 인식을 지원하지 않습니다. 크롬이나 엣지에서 쓸 수 있습니다.") + '</small></span><input type="checkbox" id="pStt" ' + (s.sttOn && SR ? "checked" : "") + (SR ? "" : " disabled") + "></label></div></details>" +
      '<div class="row end" style="margin-top:14px"><button class="btn primary lg" data-act="start">' + MJ.icon("play") + " 연습 시작</button></div></div>";

    h += '<div class="card flat"><h3>연습 요령</h3><ul><li>써 둔 답변은 덮고, 키워드만 떠올리며 말합니다. 문장이 매번 달라져도 괜찮습니다.</li><li>앉아서 정면을 보고, 실제로 소리를 내어 말합니다. 속으로 하는 연습은 시간이 맞지 않습니다.</li><li>혼자 세 번쯤 한 뒤에는 친구나 선생님에게 질문지를 건네 면접관 역할을 부탁하세요. <a href="#/notes">내 자료</a>에서 질문지를 인쇄할 수 있습니다.</li></ul></div>';
    if (st.practice.length) {
      h += '<div class="card"><div class="card-head"><h2>연습 기록</h2><span class="sub">모두 ' + st.practice.length + '회</span></div><div class="table-wrap"><table class="t"><thead><tr><th>날짜</th><th>문항</th><th>평균 답변 시간</th><th>자기점검</th><th>말 속도</th></tr></thead><tbody>' +
        st.practice.slice(-8).reverse().map(function (p) {
          var secs = p.items.map(function (i) { return i.sec; }), avg = secs.length ? secs.reduce(function (a, b) { return a + b; }, 0) / secs.length : 0;
          var ok = 0, tot = 0; p.items.forEach(function (i) { QUICK.forEach(function (k) { if (i.self && k[0] in i.self) { tot++; if (i.self[k[0]]) ok++; } }); });
          var spm = p.items.filter(function (i) { return i.stt && i.stt.spm; }).map(function (i) { return i.stt.spm; });
          return "<tr><td>" + MJ.fmtDate(localDay(p.at)) + "</td><td>" + p.items.length + "개</td><td>" + Math.round(avg) + "초</td><td>" + (tot ? ok + " / " + tot : "–") + "</td><td>" + (spm.length ? Math.round(spm.reduce(function (a, b) { return a + b; }, 0) / spm.length) + "음절/분" : "–") + "</td></tr>";
        }).join("") + "</tbody></table></div>" + weakList(st) + "</div>";
    }
    return h + MJ.stepNav("practice");
  }
  function weakList(st) {
    var bad = {};
    st.practice.forEach(function (p) { p.items.forEach(function (i) { if (!i.self) return; var miss = QUICK.filter(function (k) { return i.self[k[0]] === false; }).length; if (miss >= 2) bad[i.qid] = 1; else delete bad[i.qid]; }); });
    var qs = st.questions.filter(function (q) { return bad[q.id]; });
    if (!qs.length) return "";
    return '<h3 style="margin-top:14px">다시 연습하면 좋은 질문</h3><div class="qlist">' + qs.slice(0, 6).map(function (q) { return '<div class="qline"><span>' + esc(q.text) + '</span><a class="btn sm" href="#/practice?q=' + esc(q.id) + '">연습</a></div>'; }).join("") + "</div>";
  }

  /* ───────── 진행 화면 ───────── */
  function stage(el, st) {
    var s = st.settings;
    var lastItems = null;
    function item() { return run.items[run.i]; }
    function draw(html) { el.innerHTML = '<div class="stage">' + html + '</div><div class="row between" style="margin-top:12px"><button class="btn sm" data-act="quit">그만하기</button><span class="small mute">' + (run.i + 1) + " / " + run.items.length + " 문항</span></div>"; }
    function head(label) { return '<div class="pbar"><i style="width:' + (run.i / run.items.length * 100) + '%"></i></div><div class="ph">' + label + "</div>"; }
    function kwHint(q) { var a = st.answers[q.id]; if (!a || !a.keywords || !a.keywords.length) return ""; return '<details class="kwhint"><summary style="cursor:pointer;opacity:.8">내 키워드 보기</summary><div style="margin-top:6px">' + a.keywords.map(function (k) { return "<span>" + esc(k) + "</span>"; }).join("") + "</div></details>"; }

    function ask(tail) {
      var it = item(), text = tail ? it.tail : it.q.text;
      draw(head(tail ? "꼬리질문" : "질문 " + (run.i + 1)) + '<div class="q ' + (tail ? "tail" : "") + '">' + esc(text) + '</div><div class="kwhint" id="thinkBox">' + (s.ttsOn ? "질문을 듣고 있습니다" : "질문을 읽고 준비되면 시작하세요") + '</div><div class="row" style="justify-content:center">' + (s.ttsOn ? '<button class="btn" data-act="replay">다시 듣기</button>' : "") + '<button class="btn primary lg" data-act="answer">답변 시작</button></div>');
      var gone = false;
      run.replay = function () { gone = true; ask(tail); };
      run.phase = tail ? "askTail" : "ask";
      speak(text, function () {
        if (gone || !run || run.phase !== (tail ? "askTail" : "ask")) return;
        var left = s.thinkSec, box = el.querySelector("#thinkBox");
        if (!s.ttsOn && !left) return;            // 읽어 주지 않을 때는 학생이 ‘답변 시작’을 누른다
        if (!left) { answer(tail); return; }
        box.textContent = "생각할 시간 " + left + "초";
        clearInterval(run.timer);
        run.timer = setInterval(function () { left--; if (!run || !box.isConnected) { clearInterval(run && run.timer); return; } if (left <= 0) { clearInterval(run.timer); answer(tail); } else box.textContent = "생각할 시간 " + left + "초"; }, 1000);
      });
      run.onAnswer = function () { gone = true; clearInterval(run.timer); try { window.speechSynthesis.cancel(); } catch (e) { /* 무시 */ } answer(tail); };
    }
    function answer(tail) {
      var it = item(), limit = tail ? Math.round(s.answerSec * 0.6) : s.answerSec, t0 = Date.now();
      run.phase = tail ? "ansTail" : "ans";
      draw(head(tail ? "꼬리질문에 답하는 중" : "답변하는 중") + '<div class="q ' + (tail ? "tail" : "") + '" style="font-size:18px;opacity:.9">' + esc(tail ? it.tail : it.q.text) + '</div><div class="timer" id="tm">' + MJ.fmtSec(limit) + "</div>" + (run.recOn || run.sttOn ? '<div class="rec"><i></i>' + (run.recOn ? "녹음" : "") + (run.recOn && run.sttOn ? " · " : "") + (run.sttOn ? "받아쓰기" : "") + " 중</div>" : "") + (tail ? "" : kwHint(it.q)) + '<div class="row" style="justify-content:center"><button class="btn primary lg" data-act="done">답변 끝</button></div>');
      startCapture(it, tail);
      clearInterval(run.timer);
      run.timer = setInterval(function () {
        var el2 = el.querySelector("#tm"); if (!el2) { clearInterval(run.timer); return; }
        var used = (Date.now() - t0) / 1000, left = limit - used;
        el2.textContent = left >= 0 ? MJ.fmtSec(left) : "+" + MJ.fmtSec(-left);
        el2.className = "timer " + (left < 0 ? "over" : left < 10 ? "warn" : "");
      }, 250);
      run.onDone = function () {
        clearInterval(run.timer);
        var used = Math.round((Date.now() - t0) / 1000);
        stopCapture(it, tail, used, function () {
          if (tail) { it.tailSec = used; review(); }
          else { it.sec = used; it.limit = limit; if (run.tails && it.tail) ask(true); else review(); }
        });
      };
    }
    function startCapture(it, tail) {
      if (run.recOn && run.stream) {
        try {
          var chunks = [], rec = new MediaRecorder(run.stream);
          rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          var myRun = run;
          rec.onstop = function () { var url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || "audio/webm" })); if (!run || run !== myRun) { URL.revokeObjectURL(url); return; } run.urls.push(url); if (tail) it.tailUrl = url; else it.url = url; if (run.afterRec) { var f = run.afterRec; run.afterRec = null; f(); } };
          rec.start(); run.rec = rec;
        } catch (e) { run.rec = null; }
      }
      if (run.sttOn && SR) {
        try {
          var sr = new SR(); sr.lang = "ko-KR"; sr.continuous = true; sr.interimResults = false;
          run.text = "";
          sr.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) run.text += e.results[i][0].transcript + " "; };
          sr.onend = function () { if (run && run.sr === sr && (run.phase === "ans" || run.phase === "ansTail")) { try { sr.start(); } catch (e) { /* 무시 */ } } };
          sr.onerror = function () { /* 무시 */ };
          sr.start(); run.sr = sr;
        } catch (e) { run.sr = null; }
      }
    }
    function stopCapture(it, tail, used, next) {
      run.phase = "stop";
      if (run.sr) { var sr = run.sr; run.sr = null; try { sr.onend = null; sr.stop(); } catch (e) { /* 무시 */ } if (!tail) { it.text = run.text || ""; it.stt = MJ.a.speech(it.text, used); } }
      if (run.rec && run.rec.state !== "inactive") { run.afterRec = next; try { run.rec.stop(); } catch (e) { run.afterRec = null; next(); } setTimeout(function () { if (run && run.afterRec) { var f = run.afterRec; run.afterRec = null; f(); } }, 1200); }
      else next();
    }
    function review() {
      var it = item(); run.phase = "review";
      it.self = it.self || {};
      var over = it.sec > it.limit;
      var h = head("돌아보기") + '<div class="q" style="font-size:17px;opacity:.9">' + esc(it.q.text) + '</div><div style="font-size:15px">답변 ' + it.sec + "초" + (over ? " · <b style=\"color:#ffd27a\">정한 시간을 " + (it.sec - it.limit) + "초 넘겼습니다</b>" : "") + (it.tailSec != null ? " · 꼬리질문 " + it.tailSec + "초" : "") + "</div>";
      if (it.stt && it.stt.syl > 10) {
        var f = Object.keys(it.stt.fillerMap).map(function (k) { return k + " " + it.stt.fillerMap[k] + "회"; }).join(", ");
        h += '<div style="font-size:14.5px;opacity:.92">말 속도 약 ' + it.stt.spm + "음절/분" + (it.stt.spm > 380 ? " (빠른 편)" : it.stt.spm < 220 ? " (느린 편)" : "") + " · 군말 " + it.stt.fillers + "회" + (f ? " (" + esc(f) + ")" : "") + "</div>";
      }
      if (it.url) h += '<audio controls src="' + it.url + '" style="width:min(420px,100%);margin:0 auto"></audio>';
      if (it.tailUrl) h += '<audio controls src="' + it.tailUrl + '" style="width:min(420px,100%);margin:0 auto"></audio>';
      h += '<div style="text-align:left;max-width:460px;margin:0 auto;width:100%">' + QUICK.map(function (k) { return '<label style="display:flex;gap:10px;align-items:center;padding:7px 4px;cursor:pointer"><input type="checkbox" data-self="' + k[0] + '" style="width:18px;height:18px"' + (k[0] === "time" && !over ? " checked" : "") + "> " + k[1] + "</label>"; }).join("") + "</div>";
      h += '<div class="row" style="justify-content:center"><button class="btn" data-act="again">같은 질문 다시</button><button class="btn primary" data-act="next">' + (run.i + 1 < run.items.length ? "다음 질문" : "마치기") + "</button></div>";
      draw(h);
    }
    function collect() { var it = item(); QUICK.forEach(function (k) { var c = el.querySelector('[data-self="' + k[0] + '"]'); if (c) it.self[k[0]] = c.checked; }); }
    function finish() {
      var rec = { at: new Date().toISOString(), mode: run.mode, items: run.items.filter(function (i) { return i.sec != null; }).map(function (i) { return { qid: i.q.id, sec: i.sec, tailSec: i.tailSec, self: i.self, stt: i.stt ? { spm: i.stt.spm, fillers: i.stt.fillers } : null }; }) };
      if (rec.items.length) { st.practice.push(rec); MJ.store.save(); }
      var items = run.items.filter(function (i) { return i.sec != null; });
      lastItems = items;
      var h = '<div class="card"><h2>연습을 마쳤습니다</h2>' + (items.some(function (i) { return i.q.temp; }) ? '<p class="small mute">대학이 공개한 질문은 질문함에 담아 두면 5단계에서 답을 쓰고 다시 연습할 수 있습니다.</p>' : "") +
        MJ.table(["질문", "답변", "자기점검", ""], items.map(function (i) {
          var ok = QUICK.filter(function (k) { return i.self && i.self[k[0]]; }).length;
          return [esc(i.q.text), i.sec + "초" + (i.sec > i.limit ? ' <span class="tag warn">초과</span>' : i.sec < 5 ? ' <span class="tag warn">너무 짧음</span>' : ""), ok + " / " + QUICK.length,
            i.q.temp ? '<button class="btn sm" data-act="keepq" data-id="' + esc(i.q.id) + '">질문함에 담기</button>' : '<a class="btn sm" href="#/answers?q=' + esc(i.q.id) + '">답변 고치기</a>'];
        }));
      var texts = items.filter(function (i) { return i.text && i.text.trim().length > 10; });
      if (texts.length) h += '<details class="acc" style="margin-top:12px"><summary>받아쓴 내 답변 보기</summary><div class="acc-body">' + texts.map(function (i) { return "<p><b>" + esc(i.q.text) + "</b><br>" + esc(i.text) + "</p>"; }).join("") + '<p class="src">받아쓰기는 틀릴 수 있습니다. 이 글은 저장되지 않으며 화면을 떠나면 사라집니다.</p></div></details>';
      h += '<h3 style="margin-top:16px">녹음을 들으며 한 번 더 점검하세요</h3><p class="small mute">' + (items.some(function (i) { return i.url; }) ? "아래 항목은 내 답변을 다시 들어야 판단할 수 있습니다." : "녹음을 켜고 연습하면 아래 항목을 스스로 확인하기 쉽습니다.") + "</p>";
      MJ.content.finish.selfcheck.forEach(function (g) {
        h += '<h3 style="font-size:14.5px">' + esc(g.area) + '</h3><div class="sc-grid">' + g.items.map(function (x) { return '<label class="sc-item"><input type="checkbox"> ' + esc(x.text) + "</label>"; }).join("") + "</div>";
      });
      h += '<div class="row end" style="margin-top:16px"><button class="btn" data-act="restart">다시 연습</button><a class="btn primary" href="#/finish">점검·마무리 ' + MJ.icon("arrow") + "</a></div></div>";
      stopAll(); run = null; document.body.classList.remove("in-stage");
      el.innerHTML = h; window.scrollTo(0, 0);
    }

    MJ.on(el, "click", {
      answer: function () { if (run && run.onAnswer) run.onAnswer(); },
      replay: function () { if (run && run.replay) { clearInterval(run.timer); run.replay(); } },
      restart: function () { MJ.go("#/practice"); },
      done: function () { if (run && run.onDone) { var f = run.onDone; run.onDone = null; f(); } },
      keepq: function (t) {
        var q = (lastItems || []).filter(function (i) { return i.q.id === t.getAttribute("data-id"); })[0]; if (!q) return;
        q = q.q;
        if (!st.questions.some(function (x) { return x.text === q.text; })) {
          var n = Object.assign({}, q, { id: MJ.uid("q"), star: true, hidden: false }); delete n.temp; st.questions.push(n); MJ.store.save();
        }
        t.textContent = "담김"; t.disabled = true; MJ.toast("별표를 붙여 질문함에 담았습니다.");
      },
      again: function () { var it = item(); it.sec = null; it.tailSec = null; it.self = {}; ask(false); },
      next: function () { collect(); run.i++; if (run.i >= run.items.length) finish(); else ask(false); },
      quit: function () { MJ.confirm("연습을 그만할까요? 여기까지의 기록은 저장됩니다.", function () { if (!run) return; if (run.phase === "review") collect(); finish(); }, "그만하기"); }
    });
    ask(false);
  }

  MJ.register("practice", {
    title: "6단계 실전 연습하기",
    render: function (el, r) {
      var st = MJ.store.get();
      stopAll(); run = null;
      el.innerHTML = setupHtml(st, r);
      var modeBox = el.querySelector("#pMode"); if (!modeBox) return;
      var mode = r.q.q && modeBox.querySelector('[data-m="one"]') ? "one" : "real";
      var tg0 = st.targets.slice().sort(function (a, b) { return (a.date || "9") < (b.date || "9") ? -1 : 1; })[0];
      var selU = tg0 ? tg0.univ : "";
      if (tg0 && !r.q.q) MJ.load("guide_univ").then(function (GU) {
        if (!modeBox.isConnected) return;
        var seenU = {}, anchor = modeBox.children[1] || null, made = 0;
        st.targets.forEach(function (t) {
          var n = (GU.count || {})[t.univ]; if (!n || seenU[t.univ]) return; seenU[t.univ] = 1;
          var b = document.createElement("button"); b.className = "chip"; b.setAttribute("data-m", "univ"); b.setAttribute("data-u", t.univ); b.textContent = t.univ + " 맞춤 (공개 질문 " + n + ")";
          modeBox.insertBefore(b, anchor); made++;
        });
        if (made && !st.questions.filter(function (q) { return !q.hidden; }).length) { var f = modeBox.querySelector('[data-m="univ"]'); if (f) f.click(); }
      }).catch(function () { });
      var HINT = { univ: "지원 대학이 공개한 면접 질문과 내 질문함의 별표·학생부 질문을 섞어 그 대학 면접처럼 연습합니다. 공개 질문의 ○○ 자리는 내 활동으로 바꿔 답하세요.", real: "자기소개나 지원동기로 시작해 학생부 질문을 거쳐 마지막 말로 끝나는 순서입니다.", star: "별표를 붙인 질문만 무작위로 냅니다.", written: "답변을 써 둔 질문만 무작위로 냅니다. 글을 덮고 말해 보세요.", all: "질문함 전체에서 무작위로 냅니다." };
      modeBox.addEventListener("click", function (e) {
        var b = e.target.closest("[data-m]"); if (!b || b.disabled) return;
        mode = b.getAttribute("data-m"); if (b.getAttribute("data-u")) selU = b.getAttribute("data-u"); modeBox.querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("on", c === b); });
        var hint = el.querySelector("#pModeHint"); if (hint && HINT[mode]) hint.textContent = HINT[mode];
      });
      /* 내 대학의 실제 형식 안내 */
      var tg = st.targets.slice().sort(function (a, b) { return (a.date || "9") < (b.date || "9") ? -1 : 1; })[0];
      MJ.load("stats").then(function (S) {
        var box = el.querySelector("#pStat"); if (!box) return;
        var U = tg && S.byUniv[tg.univ], G = (U && (U[tg.type] || U.all)) || S.global, who = U ? tg.univ : "전체 평균";
        if (G.time) box.innerHTML = MJ.icon("clock", 14) + " " + esc(who) + " 후기 기준: 면접 " + G.time.med + "분" + (S.global.qcount ? ", 질문 " + (G.qcount ? G.qcount.med : S.global.qcount.med) + "개 안팎" : "") + ". 실제 답변은 한 번에 1분 안팎이 알맞습니다. 남는 시간은 꼬리질문과 면접관의 말에 쓰입니다.";
      }).catch(function () { });

      MJ.on(el, "click", {
        start: function (t) {
          if (t.disabled) return;
          t.disabled = true; setTimeout(function () { t.disabled = false; }, 1500);   // 두 번 눌러 마이크를 두 번 여는 일 방지
          var s = st.settings;
          s.answerSec = +el.querySelector("#pA").value; s.thinkSec = +el.querySelector("#pT").value; s.tails = el.querySelector("#pTail").checked;
          s.ttsOn = el.querySelector("#pTts").checked; s.recOn = el.querySelector("#pRec").checked; s.sttOn = el.querySelector("#pStt").checked;
          MJ.store.save();
          var nSel = +el.querySelector("#pN").value;
          if (mode === "univ") { MJ.load("guide").then(function (G) { if (el.isConnected) go(univSet(st, G, selU, nSel)); }).catch(function (e) { MJ.toast(e.message); }); return; }
          go(buildSet(st, mode, nSel, r.q.q));
        }
      });
      function go(set) {
          var s = st.settings;
          if (!set.length) { MJ.toast("이 묶음에 해당하는 질문이 없습니다."); return; }
          run = { mode: mode, i: 0, tails: s.tails, recOn: false, sttOn: s.sttOn && !!SR, urls: [], items: set.map(function (q) { return { q: q, tail: q.tails && q.tails.length ? q.tails[Math.floor(Math.random() * q.tails.length)] : "" }; }) };
          var begin = function () { document.body.classList.add("in-stage"); stage(el, st); window.scrollTo(0, 0); };
          if (s.recOn && navigator.mediaDevices && window.MediaRecorder) {
            var myRun = run;
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
              if (!el.isConnected || run !== myRun) { stream.getTracks().forEach(function (k) { k.stop(); }); return; }   // 그새 화면을 떠났다
              run.stream = stream; run.recOn = true; begin();
            }, function () { if (el.isConnected && run === myRun) { MJ.toast("마이크를 쓸 수 없어 녹음 없이 진행합니다."); begin(); } });
          } else begin();
      }
    },
    leave: function () { stopAll(); run = null; document.body.classList.remove("in-stage"); }
  });
})();
