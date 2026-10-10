/* 학교생활기록부 기반 면접 준비 안내 — 코어
   전역 MJ: 저장, 라우터, UI 도우미, 지연 로딩 */
(function () {
  "use strict";
  var MJ = (window.MJ = window.MJ || {});
  MJ.data = MJ.data || {};
  MJ.content = MJ.content || {};
  MJ.views = {};
  MJ.VERSION = "1.0.0";

  /* ───────── 기본 도우미 ───────── */
  MJ.$ = function (sel, root) { return (root || document).querySelector(sel); };
  MJ.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  MJ.esc = function (v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  MJ.uid = function (p) { return (p || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  MJ.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  MJ.clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  MJ.pct = function (p, d) { return p == null ? "–" : (p * 100).toFixed(d || 0) + "%"; };

  /* 한글 조사 */
  function lastCode(word) {
    var s = String(word || "").replace(/[\s\)\]\}"'”’」』>]+$/g, "");
    return s ? s.charCodeAt(s.length - 1) : 0;
  }
  MJ.hasBatchim = function (word) {
    var c = lastCode(word);
    if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
    var ch = String.fromCharCode(c);
    if (ch === "Ⅰ" || ch === "Ⅲ") return true;                  // 일, 삼
    if (ch === "Ⅱ") return false;                                // 이
    if (/[0-9]/.test(ch)) return /[013678]/.test(ch);          // 영,일,삼,육,칠,팔
    if (/[A-Za-z]/.test(ch)) {
      var w = (String(word).match(/[A-Za-z]+[\s\)\]\}"'”’」』>]*$/) || [""])[0].replace(/[^A-Za-z]/g, "");
      if (/^[A-Z]{1,4}$/.test(w)) return /[LMNR]/.test(ch);    // 약어는 글자 이름으로: 엘,엠,엔,알
      return /[bcdgklmnpqrtx]/i.test(ch);                        // 낱말은 소리로: Spring(스프링)→을, Book(북)→을, Data(데이터)→를
    }
    return false;
  };
  MJ.isRieul = function (word) {
    var c = lastCode(word);
    if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 === 8;
    return /[lL178Ⅰ]/.test(String.fromCharCode(c));
  };
  var JOSA = { "을": ["을", "를"], "이": ["이", "가"], "은": ["은", "는"], "과": ["과", "와"], "으로": ["으로", "로"], "이라는": ["이라는", "라는"] };
  MJ.josa = function (word, token) {
    var p = JOSA[token];
    if (!p) return "";
    var b = MJ.hasBatchim(word);
    if (token === "으로") return b && !MJ.isRieul(word) ? "으로" : "로";
    return b ? p[0] : p[1];
  };

  /* 날짜 */
  MJ.today = function () { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  MJ.parseDate = function (s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  MJ.iso = function (d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  MJ.dayDiff = function (a, b) { return Math.round((a - b) / 86400000); };
  MJ.addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  var WD = ["일", "월", "화", "수", "목", "금", "토"];
  MJ.fmtDate = function (s, withYear) {
    var d = typeof s === "string" ? MJ.parseDate(s) : s;
    if (!d) return "";
    return (withYear ? d.getFullYear() + ". " : "") + (d.getMonth() + 1) + ". " + d.getDate() + ".(" + WD[d.getDay()] + ")";
  };
  MJ.dday = function (s) {
    var d = MJ.parseDate(s); if (!d) return "";
    var n = MJ.dayDiff(d, MJ.today());
    return n === 0 ? "D-DAY" : n > 0 ? "D-" + n : "D+" + (-n);
  };
  MJ.fmtSec = function (sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + ("0" + s).slice(-2); };

  /* ───────── 저장 ───────── */
  var KEY = "mj.v1", KEY_REC = "mj.v1.record";
  var DEFAULT = {
    v: 1, targets: [], recordPolicy: "session", questions: [], answers: {}, practice: [], checks: {},
    progress: { know: 0, univ: 0, record: 0, questions: 0, answers: 0, practice: 0 },
    quiz: null, settings: { rate: 5.2, ttsOn: true, sttOn: false, recOn: false, answerSec: 60, thinkSec: 5, tails: true }
  };
  var state = null, record = null, listeners = [];
  function safeGet(st, k) { try { return st.getItem(k); } catch (e) { return null; } }
  function safeSet(st, k, v) { try { st.setItem(k, v); return true; } catch (e) { return false; } }
  function safeDel(st, k) { try { st.removeItem(k); } catch (e) { /* 무시 */ } }
  /* 저장 상태·백업 파일을 믿지 않는다: 모양을 맞추고, 화면 속성에 들어가는 id 는 안전한 글자만 남긴다. */
  var ID_OK = /^[A-Za-z0-9_-]{1,40}$/;
  function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
  function arr(x) { return Array.isArray(x) ? x.filter(isObj) : []; }
  function normalize(s) {
    s = isObj(s) ? s : {};
    var out = Object.assign(MJ.clone(DEFAULT), s);
    ["targets", "questions", "practice"].forEach(function (k) { out[k] = arr(s[k]); });
    ["answers", "checks"].forEach(function (k) { out[k] = isObj(s[k]) ? s[k] : {}; });
    out.settings = Object.assign(MJ.clone(DEFAULT.settings), isObj(s.settings) ? s.settings : {});
    out.progress = Object.assign(MJ.clone(DEFAULT.progress), isObj(s.progress) ? s.progress : {});
    if (out.recordPolicy !== "local") out.recordPolicy = "session";
    var idMap = {};
    out.questions.forEach(function (q) {
      if (!ID_OK.test(String(q.id))) { var n = MJ.uid("q"); idMap[q.id] = n; q.id = n; }
      q.text = String(q.text || ""); q.depth = [0, 1, 2, 3].indexOf(+q.depth) >= 0 ? +q.depth : 0;
      q.tails = Array.isArray(q.tails) ? q.tails.map(String) : [];
      if (!isObj(q.src)) q.src = { type: "custom" };
    });
    Object.keys(idMap).forEach(function (o) { if (out.answers[o]) { out.answers[idMap[o]] = out.answers[o]; delete out.answers[o]; } });
    out.questions = out.questions.filter(function (q) { return q.text; });
    out.targets.forEach(function (t) { if (!ID_OK.test(String(t.id))) t.id = MJ.uid("t"); t.univ = String(t.univ || ""); });
    out.practice.forEach(function (p) { p.items = arr(p.items); p.at = String(p.at || ""); });
    return out;
  }
  function normRecord(r) {
    var keys = (MJ.AREAS || []).map(function (a) { return a.k; });
    return arr(r).filter(function (it) { return typeof it.text === "string"; }).map(function (it) {
      if (!ID_OK.test(String(it.id))) it.id = MJ.uid("r");
      if (keys.length && keys.indexOf(it.area) < 0) it.area = keys[0];
      it.subject = String(it.subject || ""); it.tags = Array.isArray(it.tags) ? it.tags : []; it.chips = isObj(it.chips) ? it.chips : {};
      return it;
    });
  }
  function loadState() {
    var raw = safeGet(window.localStorage, KEY), s = null;
    try { s = raw ? JSON.parse(raw) : null; } catch (e) { s = null; }
    try { state = normalize(s); } catch (e) { state = MJ.clone(DEFAULT); }
    var st = state.recordPolicy === "local" ? window.localStorage : window.sessionStorage;
    var rr = safeGet(st, KEY_REC);
    try { record = normRecord(rr ? JSON.parse(rr) : []); } catch (e) { record = []; }
  }
  function saveState() { safeSet(window.localStorage, KEY, JSON.stringify(state)); }
  function saveRecord() {
    if (state.recordPolicy === "local") { safeSet(window.localStorage, KEY_REC, JSON.stringify(record)); safeDel(window.sessionStorage, KEY_REC); }
    else { safeSet(window.sessionStorage, KEY_REC, JSON.stringify(record)); safeDel(window.localStorage, KEY_REC); }
  }
  MJ.store = {
    get: function () { return state; },
    save: function () { saveState(); listeners.forEach(function (f) { try { f(state); } catch (e) { /* 무시 */ } }); },
    on: function (f) { listeners.push(f); },
    record: function () { return record; },
    saveRecord: function () { saveRecord(); },
    setRecordPolicy: function (p) { state.recordPolicy = p; saveRecord(); MJ.store.save(); },
    exportAll: function () { return { app: "mj", v: 1, at: new Date().toISOString(), state: state, record: record }; },
    importAll: function (obj) {
      if (!obj || obj.app !== "mj" || !obj.state) throw new Error("이 안내서의 백업 파일이 아닙니다.");
      var ns = normalize(obj.state), nr = normRecord(obj.record);   // 정규화가 끝난 뒤에만 바꾼다
      state = ns; record = nr;
      saveState(); saveRecord();
    },
    resetAll: function () {
      safeDel(window.localStorage, KEY); safeDel(window.localStorage, KEY_REC); safeDel(window.sessionStorage, KEY_REC);
      loadState();
    },
    mark: function (step, val) { if ((state.progress[step] || 0) < val) { state.progress[step] = val; MJ.store.save(); } }
  };

  /* ───────── 지연 로딩 ───────── */
  var loading = {};
  /* ───────── 보안코드(배포판) ─────────
     window.MJ_API 가 있으면(build.py --secure) 잠긴 자료는 파일이 아니라 자료 서버에서 이용권을 보여 주고 받는다. */
  var PROTECTED = /^(hugi_\d{3}|hugi_index|guide|guide_univ|stats|qbank_[a-z]+)$/;
  var TOK = "mj.tok";
  MJ.secure = { api: String(window.MJ_API || "").replace(/\/$/, "") };
  function tokGet() {
    var raw = safeGet(window.sessionStorage, TOK) || safeGet(window.localStorage, TOK), t = null;
    try { t = raw ? JSON.parse(raw) : null; } catch (e) { t = null; }
    return t && t.t && t.e > Date.now() + 60e3 ? t : null;
  }
  function tokDrop() { safeDel(window.sessionStorage, TOK); safeDel(window.localStorage, TOK); }
  var lockWait = [];
  MJ.lock = function (msg) {
    return new Promise(function (res) {
      lockWait.push(res);
      if (MJ.$("#lock")) { if (msg) MJ.$("#lockMsg").textContent = msg; return; }
      var d = document.createElement("div");
      d.id = "lock"; d.className = "lock";
      d.innerHTML = '<form class="lock-box" autocomplete="off"><img src="assets/logo_cnecc.svg" alt="충청남도교육청진로융합교육원" width="165" height="50"><h1>학교생활기록부 기반 면접 준비 안내</h1>' +
        '<p>학교에서 안내받은 <b>보안코드</b>를 입력하세요. 보안코드는 학교 선생님께 문의하세요.</p>' +
        '<label class="f" for="lockCode">보안코드</label><input class="in" id="lockCode" inputmode="text" autocapitalize="characters" spellcheck="false" placeholder="예: CNE-XXXX-XXXX">' +
        '<label class="ckline small"><input type="checkbox" id="lockKeep" style="width:18px;height:18px;flex:none"> <span>이 기기에서 12시간 동안 기억하기 <span class="mute">(함께 쓰는 컴퓨터에서는 켜지 마세요)</span></span></label>' +
        '<p class="lock-msg" id="lockMsg" role="alert">' + MJ.esc(msg || "") + '</p><button class="btn primary lg" type="submit" id="lockGo">들어가기</button>' +
        '<p class="small mute" style="margin-top:14px">입력한 학생부와 답변은 이 기기 안에서만 처리됩니다. 보안코드는 자료를 여는 데에만 씁니다.</p></form>';
      document.body.appendChild(d); document.body.classList.add("locked");
      var f = d.querySelector("form"), inp = d.querySelector("#lockCode"), btn = d.querySelector("#lockGo");
      setTimeout(function () { inp.focus(); }, 50);
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var code = inp.value.trim(); if (!code) { MJ.$("#lockMsg").textContent = "보안코드를 입력하세요."; return; }
        btn.disabled = true; btn.textContent = "확인하는 중";
        fetch(MJ.secure.api + "/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code }) })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (x) {
            if (!x.ok || !x.j.token) throw new Error(x.j.error || "보안코드가 맞지 않습니다.");
            var t = JSON.stringify({ t: x.j.token, e: Date.now() + (x.j.hours || 12) * 3600e3 - 120e3, l: x.j.label || "" });
            tokDrop();
            safeSet(d.querySelector("#lockKeep").checked ? window.localStorage : window.sessionStorage, TOK, t);
            d.remove(); document.body.classList.remove("locked");
            var w = lockWait; lockWait = []; w.forEach(function (f2) { f2(); });
          })
          .catch(function (err) {
            MJ.$("#lockMsg").textContent = /fetch|network|Failed/i.test(err.message) ? "자료 서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요." : err.message;
            btn.disabled = false; btn.textContent = "들어가기"; inp.select();
          });
      });
    });
  };
  MJ.secure.logout = function () { tokDrop(); location.reload(); };
  function secureLoad(name) {
    var t = tokGet();
    if (!t) return MJ.lock().then(function () { return secureLoad(name); });
    return fetch(MJ.secure.api + "/api/d/" + name, { headers: { Authorization: "Bearer " + t.t } }).then(function (r) {
      if (r.status === 401) { tokDrop(); return MJ.lock("보안코드를 다시 입력하세요.").then(function () { return secureLoad(name); }); }
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || "자료를 불러오지 못했습니다. 잠시 뒤 다시 시도하세요."); });
      return r.json().then(function (j) { MJ.data[name] = j; return j; });
    }, function () { throw new Error("자료 서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요."); });
  }

  MJ.load = function (name) {
    if (MJ.data[name]) return Promise.resolve(MJ.data[name]);
    if (loading[name]) return loading[name];
    if (MJ.secure.api && PROTECTED.test(name)) {
      loading[name] = secureLoad(name).catch(function (e) { delete loading[name]; throw e; });
      return loading[name];
    }
    loading[name] = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "data/" + name + ".js?v=" + (MJ.BUILD || MJ.VERSION);
      s.onload = function () { if (MJ.data[name]) res(MJ.data[name]); else { delete loading[name]; rej(new Error("자료를 읽지 못했습니다. 잠시 뒤 다시 시도하세요.")); } };
      s.onerror = function () { delete loading[name]; rej(new Error("자료를 불러오지 못했습니다. 잠시 뒤 다시 시도하세요.")); };
      document.head.appendChild(s);
    });
    return loading[name];
  };

  /* ───────── UI 도우미 ───────── */
  var toastTimer = null;
  MJ.toast = function (msg) {
    var t = MJ.$("#toast"); if (!t) return;
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("on"); }, 2600);
  };
  var openModals = [];
  MJ.closeModals = function () { openModals.slice().forEach(function (c) { c(); }); };
  MJ.modal = function (opt) {
    var host = MJ.$("#modalHost");
    var wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    wrap.innerHTML = '<div class="modal ' + (opt.wide ? "wide" : "") + '" role="dialog" aria-modal="true" aria-label="' + MJ.esc(opt.title || "") + '">' +
      '<div class="modal-head"><h3>' + MJ.esc(opt.title || "") + '</h3><button class="icon-btn" data-close aria-label="닫기">' + MJ.icon("x") + "</button></div>" +
      '<div class="modal-body"></div><div class="modal-foot"></div></div>';
    var body = MJ.$(".modal-body", wrap), foot = MJ.$(".modal-foot", wrap);
    if (typeof opt.body === "string") body.innerHTML = opt.body; else if (opt.body) body.appendChild(opt.body);
    var opener = document.activeElement;
    function close() {
      if (!wrap.isConnected) return;
      wrap.remove(); document.removeEventListener("keydown", onKey); openModals.splice(openModals.indexOf(close), 1);
      if (opt.onClose) opt.onClose();
      try { if (opener && opener.isConnected && opener.focus) opener.focus(); } catch (e) { /* 무시 */ }
    }
    openModals.push(close);
    function onKey(e) {
      if (openModals[openModals.length - 1] !== close) return;   // 겹친 창은 맨 위 것만
      if (e.key === "Escape") close();
      if (e.key === "Tab") {   // 창 안에서만 돈다
        var f = [].filter.call(wrap.querySelectorAll("button,input,select,textarea,a[href]"), function (x) { return !x.disabled && x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    (opt.actions || [{ label: "닫기" }]).forEach(function (a) {
      var b = document.createElement("button");
      b.className = "btn " + (a.kind || ""); b.textContent = a.label;
      b.addEventListener("click", function () { var keep = false; try { keep = a.run && a.run(body) === false; } finally { if (!keep) close(); } });
      foot.appendChild(b);
    });
    wrap.addEventListener("click", function (e) { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", onKey);
    host.appendChild(wrap);
    var f = MJ.$("input,textarea,select,button.primary", body) || MJ.$("button", wrap); if (f) f.focus();
    return { el: wrap, body: body, close: close };
  };
  MJ.confirm = function (msg, yes, label) {
    MJ.modal({ title: "확인", body: "<p>" + MJ.esc(msg) + "</p>", actions: [{ label: "취소" }, { label: label || "확인", kind: "primary", run: yes }] });
  };
  /* 초기화: 무엇이 지워지는지 보여 주고, 확인을 받은 뒤 처음 상태로 되돌린다. */
  MJ.resetAsk = function () {
    var st = MJ.store.get() || {}, rec = (MJ.store.record ? MJ.store.record() : []) || [];
    ["targets", "questions", "practice"].forEach(function (k) { if (!Array.isArray(st[k])) st[k] = []; });
    var ans = Object.keys(st.answers || {}).filter(function (k) { var a = st.answers[k]; return a && Object.keys(a.slots || {}).some(function (s) { return String(a.slots[s] || "").trim(); }); }).length;
    var rows = [["지원 대학·면접 일정", st.targets.length, "곳"], ["옮겨 적은 학생부 문장", rec.length, "개"], ["질문함의 질문", st.questions.length, "개"],
      ["써 둔 답변", ans, "개"], ["연습 기록", st.practice.length, "회"]];
    var total = rows.reduce(function (a, r) { return a + r[1]; }, 0);
    var body = '<p>이 기기에 저장된 내용을 모두 지우고 처음 상태로 되돌립니다. <b>되돌릴 수 없습니다.</b></p>' +
      '<ul class="reset-list">' + rows.map(function (r) { return "<li><span>" + r[0] + "</span><b>" + r[1] + r[2] + "</b></li>"; }).join("") + "</ul>" +
      '<p class="small mute">읽은 단계 표시, 점검표 체크, 연습 설정도 함께 처음으로 돌아갑니다. ' +
      (total ? "남겨 두고 싶다면 먼저 ‘내 자료’에서 백업 파일을 내려받으세요." : "지금은 저장된 내용이 거의 없습니다.") + "</p>";
    var acts = [{ label: "취소" }];
    if (total) acts.push({ label: "백업하러 가기", run: function () { MJ.go("#/notes"); } });
    acts.push({ label: "모두 지우고 처음부터", kind: "danger-fill", run: function () {
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* 무시 */ }
      MJ.store.resetAll(); MJ.toast("처음 상태로 되돌렸습니다."); MJ.go("#/home"); window.scrollTo(0, 0);
    } });
    MJ.modal({ title: "초기화", body: body, actions: acts });
  };
  /* 위임 이벤트: data-act="이름" */
  MJ.on = function (root, type, map) {
    root.addEventListener(type, function (e) {
      var t = e.target.closest("[data-act]");
      if (!t || !root.contains(t)) return;
      var fn = map[t.getAttribute("data-act")];
      if (fn) fn(t, e);
    });
  };
  var ICONS = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    reset: '<path d="M4 4.5v5h5"/><path d="M4.6 14.5a7.6 7.6 0 101.3-7.3L4 9.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    mic: '<path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3"/>',
    print: '<path d="M7 8V4h10v4M7 17H4v-7h16v7h-3M7 14h10v6H7z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
  };
  MJ.icon = function (name, size) {
    return '<svg class="ic" viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  };
  MJ.FACTORS = { "학업": "학업역량", "진로": "진로역량", "공동체": "공동체역량", "소통": "의사소통", "신뢰": "기록의 신뢰도" };
  MJ.AREAS = [
    { k: "seteuk", n: "교과 세특", full: "교과 세부능력 및 특기사항" },
    { k: "jayul", n: "자율·자치", full: "자율·자치활동" },
    { k: "dongari", n: "동아리", full: "동아리활동" },
    { k: "jinro", n: "진로", full: "진로활동" },
    { k: "haengteuk", n: "행동특성", full: "행동특성 및 종합의견" },
    { k: "gwamok", n: "이수·성적", full: "교과 이수·성적" },
    { k: "chulgyeol", n: "출결", full: "출결" }
  ];
  MJ.areaName = function (k, full) { var a = MJ.AREAS.filter(function (x) { return x.k === k; })[0]; return a ? (full ? a.full : a.n) : k; };
  MJ.KINDS = { opinion: "의견·판단", experience: "경험·과정", concept: "개념·지식", fact: "사실 확인" };
  MJ.TRACKS = ["인문사회", "자연", "공학", "의약보건", "교육", "예체능"];
  MJ.factorTag = function (f) { return f ? '<span class="tag f-' + MJ.esc(f) + '">' + MJ.esc(f) + "</span>" : ""; };
  MJ.depthTag = function (d) { d = +d; return d >= 1 && d <= 3 ? '<span class="tag depth d' + d + '">' + ["", "확인", "설명", "확장"][d] + "</span>" : ""; };

  /* 학과명 → 계열 추정 */
  var TRACK_RULES = [
    ["교육", /교육(과|학과|학부)|교대|사범/],
    ["의약보건", /의예|의학|치의|한의|약학|수의|간호|보건|물리치료|작업치료|임상병리|방사선|치위생|응급구조|재활|안경광학/],
    ["공학", /공학|공과|컴퓨터|소프트웨어|전자|전기|기계|건축|토목|화공|신소재|재료|반도체|로봇|산업|에너지|항공|자동차|정보통신|인공지능|AI|데이터|시스템|환경공/],
    ["자연", /수학|통계|물리|화학|생명|생물|지구|천문|대기|해양|식품|영양|농|원예|산림|동물|바이오|자연과학/],
    ["예체능", /미술|디자인|음악|체육|스포츠|무용|연극|영화|영상|공연|조형|실용음악|패션|뷰티|만화|애니/],
    ["인문사회", /./]
  ];
  /* 학과 이름 → 학과군 {k, t}. 분류표는 content/majors.js (통계 파이프라인과 함께 쓴다). */
  var majorRx = null;
  MJ.majorGroup = function (major) {
    var m = String(major || "").replace(/\s+/g, "");
    if (!m) return null;
    if (!majorRx) majorRx = (MJ.content.majors || []).map(function (g) { return { k: g.k, t: g.t, rx: new RegExp(g.re) }; });
    for (var i = 0; i < majorRx.length; i++) if (majorRx[i].rx.test(m)) return majorRx[i];
    return null;
  };
  /* 내 학과군: 고른 값이 있으면 그것, 없으면 등록한 면접의 지원 학과에서 찾는다. */
  MJ.myMajorGroup = function (univ) {
    var st = MJ.store.get();
    if (st.myMajor) return st.myMajor;
    var ts = st.targets.slice().sort(function (a, b) { return (a.univ === univ ? 0 : 1) - (b.univ === univ ? 0 : 1); });
    for (var i = 0; i < ts.length; i++) { var g = MJ.majorGroup(ts[i].major); if (g) return g.k; }
    return "";
  };
  MJ.guessTrack = function (major) {
    var m = String(major || "");
    if (!m.trim()) return "";
    var mg = MJ.majorGroup(m);
    if (mg && mg.t) return mg.t;
    for (var i = 0; i < TRACK_RULES.length; i++) if (TRACK_RULES[i][1].test(m)) return TRACK_RULES[i][0];
    return "인문사회";
  };
  MJ.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  /* ───────── 단계·라우터 ───────── */
  MJ.STEPS = [
    { id: "know", no: 1, name: "면접 바로 알기", sub: "무엇을 평가하는지, 내 면접은 어떤 유형인지" },
    { id: "univ", no: 2, name: "내 대학 알아보기", sub: "대학이 밝힌 기준과 선배들이 겪은 면접" },
    { id: "record", no: 3, name: "내 학생부 읽기", sub: "면접관의 눈으로 표시하고 정리하기" },
    { id: "questions", no: 4, name: "예상 질문 만들기", sub: "내 문장에서 질문과 꼬리질문 뽑기" },
    { id: "answers", no: 5, name: "답변 설계하기", sub: "구조에 맞춰 쓰고 키워드로 줄이기" },
    { id: "practice", no: 6, name: "실전 연습하기", sub: "소리 내어 말하고 되돌아보기" }
  ];
  var EXTRA = [
    { id: "hugi", name: "선배 후기", sub: "대학별 실제 면접에서 받은 질문" },
    { id: "finish", name: "점검·마무리", sub: "체크리스트와 흔한 실수" },
    { id: "notes", name: "내 자료", sub: "면접 노트 인쇄, 백업" }
  ];
  MJ.register = function (id, view) { MJ.views[id] = view; };
  function parseHash() {
    var h = (location.hash || "#/home").replace(/^#\/?/, "");
    var parts = h.split("?");
    var seg = parts[0].split("/").filter(Boolean);
    var q = {};
    var dec = function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } };
    (parts[1] || "").split("&").forEach(function (kv) { if (!kv) return; var i = kv.indexOf("="); q[dec(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? "" : dec(kv.slice(i + 1)); });
    return { id: seg[0] || "home", sub: seg.slice(1), q: q };
  }
  MJ.go = function (hash) { if (location.hash === hash) render(); else location.hash = hash; };
  var current = null;
  function render() {
    var r = parseHash();
    var view = MJ.views[r.id] || MJ.views.home;
    if (!MJ.views[r.id]) r.id = "home";
    if (current && current.view && current.view.leave) { try { current.view.leave(); } catch (e) { /* 무시 */ } }
    MJ.closeModals();   // 앞 화면의 확인 창이 다음 화면에 남지 않게
    /* 화면마다 새 그릇을 쓴다. 같은 요소를 다시 쓰면 앞 화면의 이벤트 처리기가 남아 겹쳐 실행된다. */
    var old = MJ.$("#view"), el = document.createElement("div");
    el.id = "view";
    old.parentNode.replaceChild(el, old);
    el.className = "view v-" + r.id;
    current = { id: r.id, view: view };
    document.title = (view.title ? view.title + " · " : "") + "학교생활기록부 기반 면접 준비 안내";
    try { view.render(el, r); }
    catch (e) {
      el.innerHTML = '<div class="card warn"><h2>화면을 표시하지 못했습니다</h2><p>' + MJ.esc(e.message) + "</p></div>";
      if (window.console) console.error(e);
    }
    renderSide(r.id);
    closeSide();
    window.scrollTo(0, 0);
    var main = MJ.$("#main"); if (main && r.id !== "home") main.focus({ preventScroll: true });
  }
  /* 같은 화면을 다시 그릴 때는 보던 위치를 지킨다. */
  MJ.rerender = function () { var y = window.scrollY; render(); window.scrollTo(0, y); };
  function renderSide(active) {
    var st = MJ.store.get(), p = MJ.calcProgress ? MJ.calcProgress() : st.progress;
    var html = '<a class="side-item home ' + (active === "home" ? "on" : "") + '" href="#/home"><span class="side-no">' + homeIcon() + '</span><span class="side-tx"><b>홈</b><small>내 면접과 준비 일정</small></span></a>';
    html += '<div class="side-label">준비 6단계</div>';
    MJ.STEPS.forEach(function (s) {
      var done = p[s.id] >= 2, half = p[s.id] === 1;
      html += '<a class="side-item ' + (active === s.id ? "on " : "") + (done ? "done" : half ? "half" : "") + '" href="#/' + s.id + '"' + (active === s.id ? ' aria-current="page"' : "") + '>' +
        '<span class="side-no">' + (done ? MJ.icon("check", 16) : s.no) + '</span><span class="side-tx"><b>' + s.name + "</b><small>" + s.sub + "</small></span></a>";
    });
    html += '<div class="side-label">그 밖에</div>';
    EXTRA.forEach(function (s) {
      html += '<a class="side-item ex ' + (active === s.id ? "on" : "") + '" href="#/' + s.id + '"><span class="side-no">·</span><span class="side-tx"><b>' + s.name + "</b><small>" + s.sub + "</small></span></a>";
    });
    var doneN = MJ.STEPS.filter(function (s) { return p[s.id] >= 2; }).length;
    html += '<div class="side-label">준비 진행</div><div class="side-prog">6단계 가운데 ' + doneN + '단계 완료<div class="meter"><i style="width:' + (doneN / 6 * 100).toFixed(0) + '%"></i></div></div>';
    html += '<p class="side-privacy">' + MJ.icon("info", 14) + " 입력한 내용은 이 기기 안에서만 처리됩니다.</p>";
    html += '<button class="side-reset" type="button" data-reset>' + MJ.icon("reset", 15) + " 초기화 <small>모두 지우고 처음부터</small></button>";
    MJ.$("#sideInner").innerHTML = html;
    var sb = MJ.$("#stepbar");
    if (sb) {
      sb.innerHTML = '<a class="' + (active === "home" ? "on" : "") + '" href="#/home" aria-label="홈"><i>' + homeIcon() + "</i><span>홈</span></a>" + MJ.STEPS.map(function (s) {
        var done = p[s.id] >= 2, half = p[s.id] === 1;
        return '<a class="' + (active === s.id ? "on " : "") + (done ? "done" : half ? "half" : "") + '" href="#/' + s.id + '" aria-label="' + s.no + "단계 " + s.name + '"><i>' + (done ? MJ.icon("check", 13) : s.no) + "</i><span>" + s.name + "</span></a>";
      }).join("");
      var cur = sb.querySelector("a.on"); if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) { /* 무시 */ } }
    }
  }
  function homeIcon() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>'; }
  function openSide() { document.body.classList.add("side-open"); MJ.$("#scrim").hidden = false; MJ.$("#menuBtn").setAttribute("aria-expanded", "true"); }
  function closeSide() { document.body.classList.remove("side-open"); MJ.$("#scrim").hidden = true; MJ.$("#menuBtn").setAttribute("aria-expanded", "false"); }

  /* 단계 머리말·다음 단계 버튼 */
  MJ.stepHead = function (id, extra) {
    var s = MJ.STEPS.filter(function (x) { return x.id === id; })[0];
    if (!s) return "";
    return '<header class="step-head"><div class="step-kicker">' + s.no + "단계 <span>/ 6</span></div><h1>" + s.name + "</h1><p>" + (extra || s.sub) + "</p></header>";
  };
  MJ.stepNav = function (id) {
    var i = MJ.STEPS.map(function (x) { return x.id; }).indexOf(id);
    var prev = i > 0 ? MJ.STEPS[i - 1] : null, next = i >= 0 && i < MJ.STEPS.length - 1 ? MJ.STEPS[i + 1] : null;
    var h = '<nav class="step-nav">';
    h += prev ? '<a class="btn ghost" href="#/' + prev.id + '">' + MJ.icon("back") + " " + prev.no + "단계 " + prev.name + "</a>" : '<a class="btn ghost" href="#/home">' + MJ.icon("back") + " 홈</a>";
    h += next ? '<a class="btn primary" href="#/' + next.id + '">' + next.no + "단계 " + next.name + " " + MJ.icon("arrow") + "</a>" : '<a class="btn primary" href="#/finish">점검·마무리 ' + MJ.icon("arrow") + "</a>";
    return h + "</nav>";
  };

  /* 영역별 면접 준비 안내(content/areaguide.js). open 이면 펼친 채로 그린다. */
  MJ.areaTip = function (key, opt) {
    opt = opt || {};
    var g = (MJ.content.areaGuide || {})[key]; if (!g) return "";
    var a = MJ.AREAS.filter(function (x) { return x.k === key; })[0];
    var name = a ? a.full : ({ reading: "독서", common: "지원동기·공통 질문" })[key] || key;
    var body = '<p>' + MJ.esc(g.see) + '</p><div class="duo"><div><h4>이런 질문으로 나옵니다</h4><ul>' + g.asks.map(function (x) { return "<li>" + MJ.esc(x) + "</li>"; }).join("") +
      '</ul></div><div><h4>이렇게 준비하세요</h4><ul>' + g.prep.map(function (x) { return "<li>" + MJ.esc(x) + "</li>"; }).join("") + "</ul></div></div>";
    return '<details class="acc atip"' + (opt.open ? " open" : "") + '><summary><span><b>' + MJ.esc(name) + '</b>에서 면접관이 보는 것 <span class="mute small">여러 대학 가이드북이 공통으로 밝힌 내용</span></span></summary><div class="acc-body">' + body + "</div></details>";
  };

  /* 표: 좁은 화면에서는 한 줄이 카드 하나로 쌓인다(data-l 에 머리말). */
  MJ.table = function (head, rows, opt) {
    opt = opt || {};
    return '<div class="table-wrap ' + (opt.stack === false ? "" : "stack") + '"><table class="t"><thead><tr>' + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return "<td" + (i > 0 && head[i] ? ' data-l="' + MJ.esc(String(head[i]).replace(/<[^>]+>/g, "")) + '"' : "") + ">" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  };

  /* 막대 그림 */
  MJ.bars = function (rows, opt) {
    opt = opt || {};
    var max = opt.max || Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([0.0001]));
    return '<div class="bars">' + rows.map(function (r) {
      var w = Math.max(1.5, (r.v / max) * 100);
      return '<div class="bar-row"><span class="bar-label">' + MJ.esc(r.label) + '</span><span class="bar-track"><span class="bar-fill ' + (r.cls || "") + '" style="width:' + w.toFixed(1) + '%"></span></span><span class="bar-val">' + (r.text || MJ.pct(r.v)) + "</span></div>";
    }).join("") + "</div>";
  };

  MJ.start = function () {
    loadState();
    if (MJ.secure.api && !tokGet()) MJ.lock();   // 배포판: 보안코드를 넣기 전에는 화면을 가린다
    var stamp = document.querySelector('script[src*="core.js"]');
    var m = stamp && /[?&]v=([^&]+)/.exec(stamp.src);
    MJ.BUILD = m && m[1] !== "__V__" ? m[1] : MJ.VERSION;
    MJ.$("#menuBtn").addEventListener("click", function () { document.body.classList.contains("side-open") ? closeSide() : openSide(); });
    MJ.$("#scrim").addEventListener("click", closeSide);
    document.addEventListener("click", function (e) { if (e.target.closest("[data-reset]")) { closeSide(); MJ.resetAsk(); } });
    window.addEventListener("hashchange", render);
    var top = MJ.$("#totop");
    if (top) {
      top.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
      window.addEventListener("scroll", function () { top.hidden = window.scrollY < 700 || document.body.classList.contains("in-stage"); }, { passive: true });
    }
    MJ.store.on(function () { var r = parseHash(); renderSide(MJ.views[r.id] ? r.id : "home"); });
    /* 같은 기기의 다른 창·탭에서 저장하면 이 창의 내용이 낡는다. 입력 중인 화면은 알리기만 한다. */
    window.addEventListener("storage", function (e) {
      if (e.key !== KEY && e.key !== KEY_REC) return;
      var id = parseHash().id;
      if (id === "answers" || id === "practice") { MJ.toast("다른 창에서 이 안내서의 내용이 바뀌었습니다. 한 창에서만 쓰세요. 여기서 저장하면 다른 창의 변경을 덮어쓸 수 있습니다."); return; }
      loadState(); MJ.rerender();
    });
    render();
  };
})();
