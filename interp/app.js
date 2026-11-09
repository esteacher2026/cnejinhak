/* 상담 통역 패드 — app.js
   구조: 언어표 → 동기화(Firestore/로컬) → 음성인식(Azure/WebSpeech) → 번역(Worker/데모) → 화면
   음성은 어디에도 저장하지 않는다. 텍스트는 방 종료 시 삭제된다. */
(() => {
"use strict";
const CFG = Object.assign({ WORKER_URL: "", FIREBASE: null, REFINE_KO_TO_X: true, REFINE_X_TO_KO: false,
  SHOW_PRIVACY_TOGGLE: true, SEGMENT_SILENCE_MS: 650, SHOW_KO_READING: true, CENTER_NAME: "충남진로진학상담센터" }, window.INTERP_CONFIG || {});
const LIVE = !!CFG.WORKER_URL;
const BASE = CFG.WORKER_URL === "/" ? "" : CFG.WORKER_URL;   // "/" = 같은 서버(로컬 시험 서버)
const $ = (s) => document.querySelector(s);

/* ───────────── 언어표 ─────────────
   code: 번역·용어집 키 / azure: 음성인식 로케일 / tr: Azure Translator 코드 / voice: Azure TTS 음성 / top: 상단 고정 */
const LANGS = [
  { code: "ko", name: "한국어", ko: "한국어", azure: "ko-KR", tr: "ko", voice: "ko-KR-SunHiNeural" },
  { code: "vi", name: "Tiếng Việt", ko: "베트남어", azure: "vi-VN", tr: "vi", voice: "vi-VN-HoaiMyNeural", top: 1 },
  { code: "zh", name: "中文(简体)", ko: "중국어(간체)", azure: "zh-CN", tr: "zh-Hans", voice: "zh-CN-XiaoxiaoNeural", top: 2 },
  { code: "ru", name: "Русский", ko: "러시아어", azure: "ru-RU", tr: "ru", voice: "ru-RU-SvetlanaNeural", top: 3 },
  { code: "uz", name: "Oʻzbekcha", ko: "우즈베크어", azure: "uz-UZ", tr: "uz", voice: "uz-UZ-MadinaNeural", top: 4 },
  { code: "mn", name: "Монгол", ko: "몽골어", azure: "mn-MN", tr: "mn-Cyrl", voice: "mn-MN-YesuiNeural", top: 5 },
  { code: "th", name: "ไทย", ko: "태국어", azure: "th-TH", tr: "th", voice: "th-TH-PremwadeeNeural", top: 6 },
  { code: "km", name: "ខ្មែរ", ko: "크메르어", azure: "km-KH", tr: "km", voice: "km-KH-SreymomNeural", top: 7 },
  { code: "ne", name: "नेपाली", ko: "네팔어", azure: "ne-NP", tr: "ne", voice: "ne-NP-HemkalaNeural", top: 8 },
  { code: "fil", name: "Filipino", ko: "필리핀어", azure: "fil-PH", tr: "fil", voice: "fil-PH-BlessicaNeural", top: 9 },
  { code: "id", name: "Bahasa Indonesia", ko: "인도네시아어", azure: "id-ID", tr: "id", voice: "id-ID-GadisNeural", top: 10 },
  { code: "ja", name: "日本語", ko: "일본어", azure: "ja-JP", tr: "ja", voice: "ja-JP-NanamiNeural", top: 11 },
  { code: "en", name: "English", ko: "영어", azure: "en-US", tr: "en", voice: "en-US-JennyNeural", top: 12 },
  { code: "my", name: "မြန်မာ", ko: "미얀마어", azure: "my-MM", tr: "my", voice: "my-MM-NilarNeural" },
  { code: "kk", name: "Қазақша", ko: "카자흐어", azure: "kk-KZ", tr: "kk", voice: "kk-KZ-AigulNeural" },
  { code: "lo", name: "ລາວ", ko: "라오어", azure: "lo-LA", tr: "lo", voice: "lo-LA-KeomanyNeural" },
  { code: "hi", name: "हिन्दी", ko: "힌디어", azure: "hi-IN", tr: "hi", voice: "hi-IN-SwaraNeural" },
  { code: "ar", name: "العربية", ko: "아랍어", azure: "ar-SA", tr: "ar", voice: "ar-SA-ZariyahNeural", rtl: true },
  { code: "bn", name: "বাংলা", ko: "벵골어", azure: "bn-IN", tr: "bn", voice: "bn-IN-TanishaaNeural" },
  { code: "si", name: "සිංහල", ko: "싱할라어", azure: "si-LK", tr: "si", voice: "si-LK-ThiliniNeural" },
  { code: "ur", name: "اردو", ko: "우르두어", azure: "ur-IN", tr: "ur", voice: "ur-IN-GulNeural", rtl: true },
  { code: "ta", name: "தமிழ்", ko: "타밀어", azure: "ta-IN", tr: "ta", voice: "ta-IN-PallaviNeural" },
  { code: "zh-Hant", name: "中文(繁體)", ko: "중국어(번체)", azure: "zh-TW", tr: "zh-Hant", voice: "zh-TW-HsiaoChenNeural" },
  { code: "es", name: "Español", ko: "스페인어", azure: "es-ES", tr: "es", voice: "es-ES-ElviraNeural" },
  { code: "fr", name: "Français", ko: "프랑스어", azure: "fr-FR", tr: "fr", voice: "fr-FR-DeniseNeural" },
  { code: "ky", name: "Кыргызча", ko: "키르기스어", azure: null, tr: "ky", voice: null },   // 음성인식 없음 → 글자 입력
];
const L = Object.fromEntries(LANGS.map(l => [l.code, l]));

/* 내담자 화면 안내문(최소). 없는 언어는 영어로 */
const UI = {
  ko: { speak: "읽어주기", connected: "연결됨", waiting: "상담사 연결 대기", lost: "연결 끊김, 다시 연결 중", ended: "상담이 종료되었습니다", thanks: "감사합니다.", notice: "이 상담은 AI 자동 통역을 사용합니다. 음성은 저장되지 않습니다.", micOn: "듣는 중", micOff: "마이크 꺼짐", tapMic: "🎤 시작", stopMic: "⏸ 일시정지", type: "글자로 입력…", send: "보내기" },
  en: { speak: "Read aloud", connected: "Connected", waiting: "Waiting for counselor", lost: "Connection lost, reconnecting", ended: "The session has ended", thanks: "Thank you.", notice: "This session uses AI interpretation. Your voice is not recorded.", micOn: "Listening", micOff: "Mic off", tapMic: "🎤 Start", stopMic: "⏸ Pause", type: "Type here…", send: "Send" },
  vi: { speak: "Đọc to", connected: "Đã kết nối", waiting: "Đang chờ tư vấn viên", lost: "Mất kết nối, đang kết nối lại", ended: "Buổi tư vấn đã kết thúc", thanks: "Cảm ơn bạn.", notice: "Buổi tư vấn này dùng phiên dịch AI. Giọng nói của bạn không được lưu lại.", micOn: "Đang nghe", micOff: "Mic tắt", tapMic: "🎤 Bắt đầu", stopMic: "⏸ Tạm dừng", type: "Nhập văn bản…", send: "Gửi" },
  zh: { speak: "朗读", connected: "已连接", waiting: "等待咨询师", lost: "连接中断，正在重连", ended: "咨询已结束", thanks: "谢谢。", notice: "本次咨询使用AI实时翻译，不会保存您的语音。", micOn: "正在听", micOff: "麦克风已关", tapMic: "🎤 开始", stopMic: "⏸ 暂停", type: "输入文字…", send: "发送" },
  ru: { speak: "Озвучить", connected: "Подключено", waiting: "Ожидание консультанта", lost: "Связь потеряна, переподключение", ended: "Консультация завершена", thanks: "Спасибо.", notice: "Используется ИИ-перевод. Ваш голос не записывается.", micOn: "Слушаю", micOff: "Микрофон выкл.", tapMic: "🎤 Начать", stopMic: "⏸ Пауза", type: "Введите текст…", send: "Отправить" },
  ja: { speak: "読み上げ", connected: "接続中", waiting: "相談員を待っています", lost: "接続が切れました。再接続中", ended: "相談は終了しました", thanks: "ありがとうございました。", notice: "この相談はAI通訳を使用します。音声は保存されません。", micOn: "聞き取り中", micOff: "マイクオフ", tapMic: "🎤 開始", stopMic: "⏸ 一時停止", type: "文字で入力…", send: "送信" },
  th: { speak: "อ่านออกเสียง", connected: "เชื่อมต่อแล้ว", waiting: "รอที่ปรึกษา", lost: "การเชื่อมต่อหลุด กำลังเชื่อมต่อใหม่", ended: "การให้คำปรึกษาสิ้นสุดแล้ว", thanks: "ขอบคุณค่ะ/ครับ", notice: "การให้คำปรึกษานี้ใช้ AI แปลภาษา ไม่มีการบันทึกเสียงของคุณ", micOn: "กำลังฟัง", micOff: "ปิดไมค์", tapMic: "🎤 เริ่ม", stopMic: "⏸ หยุดชั่วคราว", type: "พิมพ์ข้อความ…", send: "ส่ง" },
  id: { speak: "Bacakan", connected: "Terhubung", waiting: "Menunggu konselor", lost: "Koneksi terputus, menyambung ulang", ended: "Sesi telah berakhir", thanks: "Terima kasih.", notice: "Sesi ini menggunakan penerjemah AI. Suara Anda tidak direkam.", micOn: "Mendengarkan", micOff: "Mik mati", tapMic: "🎤 Mulai", stopMic: "⏸ Jeda", type: "Ketik di sini…", send: "Kirim" },
  fil: { speak: "Basahin nang malakas", connected: "Nakakonekta", waiting: "Hinihintay ang counselor", lost: "Nawala ang koneksyon, kumokonekta muli", ended: "Tapos na ang sesyon", thanks: "Salamat.", notice: "Gumagamit ng AI interpretation ang sesyong ito. Hindi nire-record ang boses mo.", micOn: "Nakikinig", micOff: "Naka-off ang mic", tapMic: "🎤 Simulan", stopMic: "⏸ I-pause", type: "Mag-type dito…", send: "Ipadala" },
};
const T = (lang, k) => (UI[lang] || UI.en)[k] || UI.en[k];

/* ───────────── 상태 ───────────── */
const S = {
  role: null,            // 'counselor' | 'client'
  room: null,
  myLang: "ko", theirLang: null,
  msgs: new Map(),       // id → msg
  order: [],
  sync: null, reco: null, tts: null,
  micOn: false, fs: 22,
  refineKoToX: CFG.REFINE_KO_TO_X, refineXToKo: CFG.REFINE_X_TO_KO, privacyOff: false, autoSpeak: false,
  peerSeen: 0, glossary: null, phrases: [], wake: null, seq: 0,
};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const pin = () => localStorage.getItem("interp_pin") || "";
const toast = (t, ms = 2200) => { const e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove("on"), ms); };
const show = (id) => { document.querySelectorAll(".screen").forEach(s => s.classList.remove("on")); $(id).classList.add("on"); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ───────────── Worker 호출 ───────────── */
async function api(path, body, opt = {}) {
  const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "X-Center-Pin": pin() }, body: body ? JSON.stringify(body) : undefined, signal: opt.signal });
  if (!r.ok) throw new Error(path + " " + r.status + " " + (await r.text()).slice(0, 200));
  return r;
}

/* ───────────── 번역 ───────────── */
const trCache = new Map();
async function translateQuick(text, from, to) {
  if (!text.trim() || from === to) return text;
  const key = from + "|" + to + "|" + text;
  if (trCache.has(key)) return trCache.get(key);
  let out;
  if (!LIVE) { await sleep(180); out = `[${L[to]?.ko || to}] ${text}`; }
  else { const r = await api("/translate", { text, from: L[from].tr, to: L[to].tr }); out = (await r.json()).text; }
  if (trCache.size > 400) trCache.delete(trCache.keys().next().value);
  trCache.set(key, out); return out;
}
/* 정밀 번역(Claude) — 스트리밍, 조각이 올 때마다 onChunk(누적문) */
async function refine(msg, onChunk) {
  const ctx = S.order.slice(-9, -1).map(id => S.msgs.get(id)).filter(m => m && !m.partial && m.src)
    .map(m => ({ role: m.role, lang: m.srcLang, text: m.src }));
  if (!LIVE) { await sleep(1100); const t = msg.tgt + " ✓"; onChunk(t); return t; }
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await api("/refine", { text: msg.src, from: msg.srcLang, to: msg.tgtLang, quick: msg.tgt, context: ctx, role: msg.role }, { signal: ctrl.signal });
    const reader = r.body.getReader(); const dec = new TextDecoder(); let acc = "";
    while (true) { const { value, done } = await reader.read(); if (done) break; acc += dec.decode(value, { stream: true }); onChunk(acc); }
    return acc.trim();
  } finally { clearTimeout(timer); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function wantRefine(from, to) {
  if (S.privacyOff || from === to) return false;
  return from === "ko" ? S.refineKoToX : S.refineXToKo;
}

/* ───────────── 동기화 ───────────── */
class LocalSync {   // 같은 브라우저 탭 간(데모)
  constructor(room, role, onMsg, onPeer) { this.ch = new BroadcastChannel("interp-" + room); this.role = role; this.ch.onmessage = (e) => { const d = e.data; if (d.type === "msg") onMsg(d.msg); else if (d.type === "hb") onPeer(d.role, d.lang, d.ended); }; this.hb = setInterval(() => this.beat(), 3000); this.lang = null; }
  setLang(l) { this.lang = l; this.beat(); }
  beat(ended) { this.ch.postMessage({ type: "hb", role: this.role, lang: this.lang, ended: !!ended }); }
  send(msg) { this.ch.postMessage({ type: "msg", msg }); }
  async end() { this.beat(true); clearInterval(this.hb); this.ch.close(); }
}
class FirestoreSync {
  constructor(room, role, onMsg, onPeer) { this.room = room; this.role = role; this.onMsg = onMsg; this.onPeer = onPeer; this.pending = new Map(); this.lang = null; }
  async init() {
    const [{ initializeApp }, fs] = await Promise.all([import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"), import("https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js")]);
    this.fs = fs; this.db = fs.getFirestore(initializeApp(CFG.FIREBASE));
    this.roomRef = fs.doc(this.db, "rooms", this.room);
    const expireAt = new Date(Date.now() + 24 * 3600e3);
    await fs.setDoc(this.roomRef, { [this.role + "At"]: fs.serverTimestamp(), expireAt, status: "open" }, { merge: true });
    this.unsubRoom = fs.onSnapshot(this.roomRef, (d) => { const v = d.data() || {}; const other = this.role === "counselor" ? "client" : "counselor"; const ts = v[other + "At"]; if (ts) this.onPeer(other, v[other + "Lang"] || null, v.status === "ended"); });
    this.unsubMsgs = fs.onSnapshot(fs.query(fs.collection(this.roomRef, "msgs"), fs.orderBy("seq")), (snap) => { snap.docChanges().forEach(c => { const m = c.doc.data(); if (m.role !== this.role) this.onMsg(m); }); });
    this.hb = setInterval(() => this.beat(), 8000);
  }
  async setLang(l) { this.lang = l; await this.fs.setDoc(this.roomRef, { [this.role + "Lang"]: l }, { merge: true }); }
  beat() { this.fs.setDoc(this.roomRef, { [this.role + "At"]: this.fs.serverTimestamp() }, { merge: true }).catch(() => {}); }
  send(msg) {   // 같은 id는 덮어쓰기(부분→확정→정밀). 300ms 합치기
    this.pending.set(msg.id, msg);
    if (this.t) return; this.t = setTimeout(() => { this.t = null; const batch = [...this.pending.values()]; this.pending.clear();
      batch.forEach(m => this.fs.setDoc(this.fs.doc(this.roomRef, "msgs", m.id), { ...m, expireAt: new Date(Date.now() + 24 * 3600e3) }).catch(e => console.warn(e))); }, 300);
  }
  async end() {
    clearInterval(this.hb); this.unsubRoom?.(); this.unsubMsgs?.();
    try { await this.fs.setDoc(this.roomRef, { status: "ended" }, { merge: true });
      if (this.role === "counselor") { const snap = await this.fs.getDocs(this.fs.collection(this.roomRef, "msgs")); await Promise.all(snap.docs.map(d => this.fs.deleteDoc(d.ref))); await this.fs.deleteDoc(this.roomRef); }
    } catch (e) { console.warn("room cleanup", e); }
  }
}

/* ───────────── 음성인식 ───────────── */
class WebSpeechReco {   // 브라우저 내장(데모·예비). Chrome/Edge/Safari 일부
  constructor(langs, onPartial, onFinal, onState) { this.lang = langs[0]; this.onPartial = onPartial; this.onFinal = onFinal; this.onState = onState; this.alive = false; }
  static ok() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const r = this.r = new SR();
    r.lang = this.lang; r.continuous = true; r.interimResults = true; this.alive = true;
    r.onresult = (e) => { let interim = "", fin = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else interim += t; }
      if (fin.trim()) this.onFinal(fin.trim(), this.lang); else if (interim.trim()) this.onPartial(interim.trim(), this.lang); };
    r.onerror = (e) => { if (e.error === "not-allowed") { this.onState("denied"); this.alive = false; } };
    r.onend = () => { if (this.alive) { try { r.start(); } catch {} } else this.onState("off"); };
    r.start(); this.onState("on");
  }
  stop() { this.alive = false; try { this.r?.stop(); } catch {} }
}
class AzureReco {
  constructor(langs, onPartial, onFinal, onState) { this.langs = langs; this.onPartial = onPartial; this.onFinal = onFinal; this.onState = onState; }
  static async load() { if (window.SpeechSDK) return; await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://aka.ms/csspeech/jsbrowserpackageraw"; s.onload = ok; s.onerror = () => no(new Error("Speech SDK 로드 실패")); document.head.appendChild(s); }); }
  async start() {
    await AzureReco.load(); const SDK = window.SpeechSDK;
    const tok = await (await api("/token")).json();                     // { token, region }
    const sc = SDK.SpeechConfig.fromAuthorizationToken(tok.token, tok.region);
    sc.setProperty(SDK.PropertyId.Speech_SegmentationSilenceTimeoutMs, String(CFG.SEGMENT_SILENCE_MS));
    sc.setProperty(SDK.PropertyId.SpeechServiceResponse_PostProcessingOption, "TrueText");
    const audio = SDK.AudioConfig.fromDefaultMicrophoneInput();
    let reco;
    if (this.langs.length > 1) {   // 내담자 패드: 모국어 + 한국어 연속 자동 감지
      sc.setProperty(SDK.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous");
      const auto = SDK.AutoDetectSourceLanguageConfig.fromLanguages(this.langs);
      reco = SDK.SpeechRecognizer.FromConfig(sc, auto, audio);
    } else { sc.speechRecognitionLanguage = this.langs[0]; reco = new SDK.SpeechRecognizer(sc, audio); }
    if (this.langs.includes("ko-KR") && S.glossary) {                 // 입시 용어 인식 힌트
      const pl = SDK.PhraseListGrammar.fromRecognizer(reco); let n = 0;
      for (const [term, v] of Object.entries(S.glossary.terms)) { if (!v.stt_hint) continue; pl.addPhrase(term); n++; (v.aliases_ko || []).forEach(a => { if (n < 480) { pl.addPhrase(a); n++; } }); if (n >= 480) break; }
    }
    const langOf = (res) => { try { const d = SDK.AutoDetectSourceLanguageResult.fromResult(res).language; return d || this.langs[0]; } catch { return this.langs[0]; } };
    reco.recognizing = (_, e) => { if (e.result.text) this.onPartial(e.result.text, langOf(e.result)); };
    reco.recognized = (_, e) => { if (e.result.reason === SDK.ResultReason.RecognizedSpeech && e.result.text.trim()) this.onFinal(e.result.text.trim(), langOf(e.result)); };
    reco.canceled = (_, e) => { console.warn("azure canceled", e.errorDetails); this.onState(e.errorDetails?.includes("1006") || e.errorDetails?.includes("401") ? "retry" : "off"); };
    reco.sessionStopped = () => this.onState("off");
    this.reco = reco; this.renew = setInterval(() => api("/token").then(r => r.json()).then(t => { reco.authorizationToken = t.token; }).catch(() => {}), 8 * 60e3);
    await new Promise((ok, no) => reco.startContinuousRecognitionAsync(ok, no)); this.onState("on");
  }
  stop() { clearInterval(this.renew); const r = this.reco; if (!r) return; r.stopContinuousRecognitionAsync(() => { r.close(); }, () => {}); this.reco = null; }
}

/* ───────────── TTS ───────────── */
async function speak(text, lang) {
  const l = L[lang]; if (!text) return;
  if (LIVE && l?.voice) {
    try { await AzureReco.load(); const SDK = window.SpeechSDK; const tok = await (await api("/token")).json();
      const sc = SDK.SpeechConfig.fromAuthorizationToken(tok.token, tok.region); sc.speechSynthesisVoiceName = l.voice;
      const syn = new SDK.SpeechSynthesizer(sc); syn.speakTextAsync(text, () => syn.close(), (e) => { console.warn(e); syn.close(); webSpeak(text, l.azure); }); return; } catch (e) { console.warn(e); }
  }
  webSpeak(text, l?.azure || lang);
}
function webSpeak(text, locale) { if (!window.speechSynthesis) return toast("이 기기는 음성 출력을 지원하지 않습니다"); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = locale || "ko-KR"; speechSynthesis.speak(u); }

/* ───────────── 메시지 처리 ───────────── */
function upsert(m, fromPeer) {
  const old = S.msgs.get(m.id); S.msgs.set(m.id, Object.assign(old || {}, m));
  if (!old) { S.order.push(m.id); S.order.sort((a, b) => (S.msgs.get(a).seq || 0) - (S.msgs.get(b).seq || 0)); }
  render(m.id);
  if (fromPeer && !m.partial && S.role === "client" && S.autoSpeak && !old?.spoken && (m.tgtRefined || m.tgt)) { S.msgs.get(m.id).spoken = true; speak(m.tgtRefined || m.tgt, S.myLang); }
}
let partialId = null, partialTimer = null, lastQuickAt = 0;
function onPartial(text, azureLang) {
  const srcLang = codeOfAzure(azureLang); const tgtLang = srcLang === S.myLang ? S.theirLang : S.myLang;
  if (!partialId) partialId = uid();
  const m = { id: partialId, role: S.role, srcLang, tgtLang, src: text, partial: true, ts: Date.now(), seq: S.msgs.get(partialId)?.seq ?? ++S.seq * 1000 + Date.now() % 1000 };
  upsert(m); S.sync.send(m);
  const now = Date.now();
  if (now - lastQuickAt > 700) { lastQuickAt = now; const id = partialId; translateQuick(text, srcLang, tgtLang).then(t => { const cur = S.msgs.get(id); if (cur && cur.partial) { cur.tgt = t; upsert(cur); S.sync.send(cur); } }).catch(() => {}); }
}
async function onFinal(text, azureLang) {
  const srcLang = codeOfAzure(azureLang); const tgtLang = srcLang === S.myLang ? S.theirLang : S.myLang;
  const id = partialId || uid(); partialId = null;
  const base = S.msgs.get(id) || { id, role: S.role, seq: ++S.seq * 1000 + Date.now() % 1000 };
  const m = Object.assign(base, { srcLang, tgtLang, src: text, partial: false, ts: Date.now() });
  upsert(m); S.sync.send(m);
  try { m.tgt = await translateQuick(text, srcLang, tgtLang); } catch (e) { m.tgt = m.tgt || text; m.err = true; console.warn(e); }
  upsert(m); S.sync.send(m);
  if (wantRefine(srcLang, tgtLang)) {
    try { let last = 0; const out = await refine(m, (acc) => { if (Date.now() - last > 250) { last = Date.now(); m.tgtRefined = acc; upsert(m); } });
      if (out && out !== m.tgt) { m.tgtRefined = out; } else { delete m.tgtRefined; } upsert(m); S.sync.send(m); } catch (e) { console.warn("refine", e); }
  }
}
function codeOfAzure(az) { return (LANGS.find(l => l.azure === az) || L[az] || L[S.myLang]).code; }
async function sendTyped(text) {   // 글자 입력(음성 없는 언어·소음 환경)
  if (!text.trim()) return; await onFinal(text.trim(), L[S.myLang].azure || S.myLang);
}

/* ───────────── 화면 ───────────── */
function render(id) {
  const m = S.msgs.get(id); if (!m) return;
  const list = $("#list"); let el = document.getElementById("m-" + id);
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  if (!el) { el = document.createElement("div"); el.id = "m-" + id; el.innerHTML = `<span class="tag">정밀</span><div class="big"></div><div class="orig"></div><div class="meta"><span class="who"></span><span class="time"></span></div>`;
    // seq 순서에 맞는 위치에 삽입
    const idx = S.order.indexOf(id); const next = S.order[idx + 1]; const nextEl = next && document.getElementById("m-" + next); list.insertBefore(el, nextEl || null); }
  const mine = m.role === S.role;
  el.className = "msg " + (mine ? "mine" : "theirs") + (m.partial ? " partial" : "") + (m.tgtRefined ? " refined" : "");
  const big = el.querySelector(".big"), orig = el.querySelector(".orig");
  // 내 화면 언어로 보여줄 글: 원문이 내 언어면 원문, 아니면 번역
  const showText = m.srcLang === S.myLang ? m.src : (m.tgtRefined || m.tgt || (m.partial ? "…" : m.src));
  const showLang = m.srcLang === S.myLang ? m.srcLang : (m.tgt || m.tgtRefined ? m.tgtLang : m.srcLang);
  big.innerHTML = underline(esc(showText), showLang); big.dir = L[showLang]?.rtl ? "rtl" : "ltr"; big.lang = L[showLang]?.azure || showLang;
  if (!mine && m.srcLang !== S.myLang) { orig.textContent = m.src || ""; orig.style.display = ""; orig.dir = L[m.srcLang]?.rtl ? "rtl" : "ltr"; } else orig.style.display = "none";
  el.querySelector(".who").textContent = mine ? (S.role === "counselor" ? "나(상담사)" : "") : (S.role === "counselor" ? L[m.srcLang]?.ko || "내담자" : "");
  el.querySelector(".time").textContent = new Date(m.ts || Date.now()).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (atBottom) list.scrollTop = list.scrollHeight;
}
/* 용어 밑줄: 보여주는 언어의 용어집 항목을 찾아 점선 밑줄 */
let glIndex = {};
function buildGlIndex() {
  glIndex = {}; if (!S.glossary) return;
  for (const [ko, v] of Object.entries(S.glossary.terms)) {
    (glIndex.ko ||= []).push({ s: ko, ko }); (v.aliases_ko || []).forEach(a => a.length >= 2 && glIndex.ko.push({ s: a, ko }));
    for (const [lang, t] of Object.entries(v.tr || {})) if (t.term && t.term.length >= 3) (glIndex[lang] ||= []).push({ s: t.term.replace(/\s*\(.*?\)\s*$/, ""), ko });
  }
  for (const k in glIndex) glIndex[k].sort((a, b) => b.s.length - a.s.length);
}
const glRe = {};
function underline(html, lang) {   // 한 번의 치환으로 처리(삽입한 태그 안을 다시 매칭하지 않도록)
  const arr = glIndex[lang]; if (!arr || !html) return html;
  if (!glRe[lang]) {
    const map = new Map(arr.map(x => [esc(x.s).toLowerCase(), x.ko]));
    glRe[lang] = { map, re: new RegExp(arr.map(x => esc(x.s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), lang === "ko" ? "g" : "gi") };
  }
  const { re, map } = glRe[lang];
  return html.replace(re, (mm) => `<span class="gl" data-ko="${esc(map.get(mm.toLowerCase()) || "")}">${mm}</span>`);
}
function showGl(ko) {
  const v = S.glossary?.terms[ko]; if (!v) return; const t = v.tr?.[S.myLang];
  $("#glTerm").textContent = t?.term ? `${t.term}  ·  ${ko}` : ko;
  $("#glDef").textContent = t?.def || (S.myLang === "ko" ? v.ko_def : "");
  $("#glDef2").textContent = S.myLang === "ko" ? "" : v.ko_def;
  $("#popGl").classList.add("on"); $("#scrim").classList.add("on");
}
function setFont(d) { S.fs = Math.min(40, Math.max(16, S.fs + d)); document.documentElement.style.setProperty("--fs", S.fs + "px"); localStorage.setItem("interp_fs_" + S.role, S.fs); }
function setConn(state) {
  const dot = $("#connDot"); dot.className = "dot " + (state === "ok" ? "ok" : state === "wait" ? "warn" : "bad");
  const info = $("#topInfo"); const pair = S.theirLang ? `${L[S.myLang].name} ⇄ ${L[S.theirLang].name}` : L[S.myLang].name;
  const st = state === "ok" ? T(S.myLang, "connected") : state === "wait" ? T(S.myLang, "waiting") : T(S.myLang, "lost");
  info.innerHTML = `<b>${S.room}</b> · ${esc(pair)} · ${esc(st)}` + (LIVE ? "" : " · <span style='color:var(--amber)'>DEMO</span>");
}
function micState(st) {
  const box = $("#micBox"), btn = $("#btnMic");
  if (st === "on") { S.micOn = true; box.classList.remove("off"); $("#micText").textContent = T(S.myLang, "micOn"); btn.textContent = T(S.myLang, "stopMic"); vu(true); }
  else { S.micOn = false; box.classList.add("off"); $("#micText").textContent = st === "denied" ? "마이크 권한이 거부되었습니다 · Microphone blocked" : T(S.myLang, "micOff"); btn.textContent = T(S.myLang, "tapMic"); vu(false);
    if (st === "denied") $("#textIn").classList.add("on");
    if (st === "retry") setTimeout(() => startMic(), 1500); }
}
let vuTimer = null;
function vu(on) { clearInterval(vuTimer); const bars = document.querySelectorAll("#micBox .vu i"); if (!on) { bars.forEach(b => b.style.height = "6px"); return; } vuTimer = setInterval(() => bars.forEach(b => b.style.height = (6 + Math.random() * 18) + "px"), 120); }

/* ───────────── 마이크 ───────────── */
async function startMic() {
  if (S.micOn) return;
  const me = L[S.myLang];
  if (!me.azure) { $("#textIn").classList.add("on"); return toast("이 언어는 음성 인식이 없어 글자 입력으로 진행합니다"); }
  const langs = S.role === "client" ? [me.azure, "ko-KR"] : [me.azure];
  try {
    S.reco = LIVE ? new AzureReco(langs, onPartial, onFinal, micState) : new WebSpeechReco(langs, onPartial, onFinal, micState);
    if (!LIVE && !WebSpeechReco.ok()) { $("#textIn").classList.add("on"); return toast("이 브라우저는 내장 음성인식이 없습니다. 글자 입력으로 시험하세요 (운영 모드에서는 Azure 사용)"); }
    await S.reco.start();
  } catch (e) {
    console.warn(e); micState("off");
    if (String(e?.message || e).includes("401")) {   // PIN 없음/불일치 → 바로 입력받기
      const p = prompt("센터 PIN을 입력하세요 · Enter the center PIN", ""); if (p) { localStorage.setItem("interp_pin", p.trim()); return startMic(); }
      return toast("PIN이 없어 음성 인식을 시작할 수 없습니다. 첫 화면의 PIN 설정에서 입력하세요.", 5000);
    }
    $("#textIn").classList.add("on"); toast("음성 인식 시작 실패: " + String(e?.message || e || "마이크를 사용할 수 없습니다"), 4000);
  }
}
function stopMic() { S.reco?.stop(); S.reco = null; micState("off"); }

/* ───────────── 방 시작/종료 ───────────── */
async function openRoom(room, role, myLang, theirLang) {
  S.room = room; S.role = role; S.myLang = myLang; S.theirLang = theirLang; S.msgs.clear(); S.order = []; $("#list").innerHTML = "";
  S.fs = +localStorage.getItem("interp_fs_" + role) || (role === "client" ? 26 : 22); document.documentElement.style.setProperty("--fs", S.fs + "px");
  const onMsg = (m) => upsert(m, true);
  const onPeer = (otherRole, lang, ended) => { S.peerSeen = Date.now(); if (lang && otherRole === "client" && S.role === "counselor") { S.theirLang = lang; } if (ended) return endScreen(true); setConn("ok"); };
  S.sync = CFG.FIREBASE ? new FirestoreSync(room, role, onMsg, onPeer) : new LocalSync(room, role, onMsg, onPeer);
  if (S.sync.init) { try { await S.sync.init(); } catch (e) { console.error(e); toast("동기화 연결 실패: " + e.message, 5000); } }
  S.sync.setLang(myLang);
  setConn("wait"); setInterval(() => { if (S.room && Date.now() - S.peerSeen > 25000) setConn(S.peerSeen ? "lost" : "wait"); }, 5000);
  // 역할별 UI
  $("#btnPhrases").style.display = role === "counselor" ? "" : "none";
  $("#btnEnd").style.display = role === "counselor" ? "" : "none";
  $("#btnSettings").style.display = role === "counselor" ? "" : "none";
  $("#btnMic").textContent = T(myLang, "tapMic"); $("#micText").textContent = T(myLang, "micOff"); $("#btnSpeak").textContent = "🔊 " + T(myLang, "speak");
  $("#textInput").placeholder = T(myLang, "type"); $("#btnTextSend").textContent = T(myLang, "send");
  $("#textIn").classList.toggle("on", !L[myLang].azure);
  show("#s-talk");
  if (role === "client") { const n = document.createElement("div"); n.className = "notice"; n.textContent = T(myLang, "notice"); $("#list").appendChild(n); }
  else { const n = document.createElement("div"); n.className = "notice"; n.textContent = `내담자 패드에서 코드 ${room} 로 접속하면 연결됩니다. 🎤 시작을 누르고 말씀하세요. 상대 발화는 한국어로, 내 발화는 ${L[theirLang]?.ko || ""}로 번역되어 상대 화면에 표시됩니다.`; $("#list").appendChild(n); }
  try { S.wake = await navigator.wakeLock?.request("screen"); } catch {}
  document.addEventListener("visibilitychange", async () => { if (document.visibilityState === "visible" && !S.wake?.released) return; try { S.wake = await navigator.wakeLock?.request("screen"); } catch {} });
  startMic();
}
async function endRoom() {
  stopMic(); await S.sync?.end(); endScreen(false);
}
function endScreen(byPeer) {
  stopMic(); if (byPeer) S.sync?.end?.();
  $("#endTitle").textContent = T(S.myLang, "ended"); $("#endSub").textContent = T(S.myLang, "thanks");
  const acts = $("#endActions"); acts.innerHTML = "";
  if (S.role === "counselor") {
    const b = document.createElement("button"); b.className = "btn"; b.textContent = "상담 내용 텍스트로 저장 (이름 없음)"; b.onclick = exportTxt; acts.appendChild(b);
    const n = document.createElement("div"); n.className = "notice"; n.textContent = "저장하지 않으면 이 화면을 떠날 때 대화 내용은 사라집니다. 방 데이터는 삭제되었습니다."; acts.appendChild(n);
  }
  const back = document.createElement("button"); back.className = "btn secondary"; back.textContent = S.role === "counselor" ? "처음으로" : "Close · 닫기"; back.onclick = () => location.href = location.pathname; acts.appendChild(back);
  show("#s-end"); try { S.wake?.release(); } catch {}
}
function exportTxt() {
  const lines = [`${CFG.CENTER_NAME} 상담 통역 기록`, `일시: ${new Date().toLocaleString("ko-KR")}`, `언어: 한국어 ⇄ ${L[S.theirLang]?.ko || ""}`, `※ AI 자동 통역 기록이며 오역이 있을 수 있습니다. 개인 식별 정보는 포함하지 않습니다.`, ""];
  for (const id of S.order) { const m = S.msgs.get(id); if (!m || m.partial || !m.src) continue; const who = m.role === "counselor" ? "상담사" : "내담자"; const t = new Date(m.ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    lines.push(`[${t}] ${who}: ${m.src}`); if (m.tgtLang !== m.srcLang && (m.tgtRefined || m.tgt)) lines.push(`        → ${m.tgtRefined || m.tgt}`); }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/plain;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `상담통역_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.txt`; a.click();
}

/* ───────────── 설정·문장 시트 ───────────── */
function openSheet(id) { $(id).classList.add("on"); $("#scrim").classList.add("on"); }
function closeAll() { document.querySelectorAll(".sheet,.pop").forEach(e => e.classList.remove("on")); $("#scrim").classList.remove("on"); }
function renderSettings() {
  const b = $("#settingsBody"); b.innerHTML = "";
  const opt = (label, key, desc) => { const d = document.createElement("div"); d.className = "opt"; d.innerHTML = `<div><div>${label}</div><div style="font-size:13px;color:var(--sub)">${desc || ""}</div></div><div class="switch ${S[key] ? "on" : ""}"></div>`; d.querySelector(".switch").onclick = (e) => { S[key] = !S[key]; e.target.classList.toggle("on", S[key]); }; b.appendChild(d); };
  opt("정밀 번역: 한국어 → 내담자 언어", "refineKoToX", "Claude가 용어집·상담 문맥을 반영해 1~2초 뒤 자막을 교체");
  opt("정밀 번역: 내담자 언어 → 한국어", "refineXToKo", "끄면 초벌 번역만 표시(더 빠름)");
  if (CFG.SHOW_PRIVACY_TOGGLE) opt("개인정보 구간 (정밀 번역 일시 중지)", "privacyOff", "이름·연락처·주소를 말하는 동안 켜 두면 해외 API로 문장이 가지 않음");
  const d = document.createElement("div"); d.className = "opt"; d.innerHTML = `<div>내담자 언어 바꾸기</div><select id="selLang" style="font:inherit;font-size:16px;padding:8px"></select>`; b.appendChild(d);
  const sel = d.querySelector("select"); LANGS.filter(l => l.code !== "ko").forEach(l => { const o = document.createElement("option"); o.value = l.code; o.textContent = `${l.ko} · ${l.name}`; if (l.code === S.theirLang) o.selected = true; sel.appendChild(o); });
  sel.onchange = () => { S.theirLang = sel.value; setConn("ok"); toast("내담자 언어를 바꿨습니다. 내담자 패드는 다시 접속해야 합니다."); };
  const x = document.createElement("button"); x.className = "btn secondary"; x.textContent = "닫기"; x.onclick = closeAll; b.appendChild(x);
}
async function renderPhrases() {
  const b = $("#phraseList"); b.innerHTML = "";
  S.phrases.forEach(p => { const e = document.createElement("button"); e.className = "phr"; e.textContent = p; e.onclick = () => { closeAll(); sendTyped(p); }; b.appendChild(e); });
}

/* ───────────── 시작 화면 ───────────── */
function renderLangGrid(all) {
  const g = $("#langGrid"); g.innerHTML = "";
  LANGS.filter(l => l.code !== "ko" && (all || l.top)).sort((a, b) => (a.top || 99) - (b.top || 99)).forEach(l => {
    const e = document.createElement("button"); e.className = "lang" + (l.azure ? "" : " textonly"); e.innerHTML = `<b>${esc(l.name)}</b><span>${esc(l.ko)}</span>`;
    e.onclick = () => { document.querySelectorAll(".lang").forEach(x => x.classList.remove("sel")); e.classList.add("sel"); S.theirLang = l.code; prepareRoom(); }; g.appendChild(e); });
}
function prepareRoom() {
  S.room = String(Math.floor(1000 + Math.random() * 9000));
  $("#roomCode").textContent = S.room; $("#roomCard").style.display = "";
  const url = `${location.origin}${location.pathname}?room=${S.room}&role=client&lang=${S.theirLang}` + (pin() ? `&pin=${encodeURIComponent(pin())}` : "");
  $("#qr").innerHTML = ""; try { new QRCode($("#qr"), { text: url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M }); } catch {}
  $("#joinUrlNote").textContent = "내담자 패드 주소: " + url;
  $("#roomCard").scrollIntoView({ behavior: "smooth", block: "start" });
}
async function boot() {
  $("#modeBadge").className = "badge " + (LIVE ? "live" : "demo"); $("#modeBadge").textContent = LIVE ? "운영 모드" : "데모 모드";
  $("#startNotice").style.display = LIVE ? "none" : "";
  $("#centerName").textContent = CFG.CENTER_NAME + " · 이주배경 학생·학부모 상담용 실시간 자막 통역";
  try { S.glossary = await (await fetch("glossary.json")).json(); buildGlIndex(); } catch (e) { console.warn("glossary", e); }
  try { S.phrases = await (await fetch("phrases.json")).json(); } catch {}
  // 버튼
  $("#btnCounselor").onclick = () => { renderLangGrid(false); $("#roomCard").style.display = "none"; show("#s-setup"); };
  $("#btnMoreLangs").onclick = () => renderLangGrid(true);
  $("#btnStartTalk").onclick = () => openRoom(S.room, "counselor", "ko", S.theirLang);
  $("#btnClient").onclick = () => show("#s-join");
  $("#btnJoin").onclick = () => { const c = $("#joinCode").value.trim(); if (c.length !== 4) return toast("4자리 코드를 입력하세요"); const lang = prompt("내담자 언어 코드 (vi, zh, ru, uz, mn, th, km, ne, fil, id, ja, en …)", "vi") || "en"; openRoom(c, "client", L[lang] ? lang : "en", "ko"); };
  $("#btnBackStart").onclick = $("#btnBackStart2").onclick = () => show("#s-start");
  $("#btnPin").onclick = () => { $("#pinCard").style.display = $("#pinCard").style.display === "none" ? "" : "none"; $("#pinInput").value = pin(); };
  $("#btnPinSave").onclick = () => { localStorage.setItem("interp_pin", $("#pinInput").value.trim()); $("#pinCard").style.display = "none"; toast("PIN 저장됨"); };
  $("#btnMic").onclick = () => S.micOn ? stopMic() : startMic();
  $("#btnSpeak").onclick = () => { const last = [...S.order].reverse().map(id => S.msgs.get(id)).find(m => m && !m.partial && m.role !== S.role); if (!last) return toast("읽을 문장이 없습니다"); speak(last.srcLang === S.myLang ? last.src : (last.tgtRefined || last.tgt), S.myLang); };
  $("#btnPhrases").onclick = () => { renderPhrases(); openSheet("#sheetPhrases"); };
  $("#btnSettings").onclick = () => { renderSettings(); openSheet("#sheetSettings"); };
  $("#btnEnd").onclick = () => { if (confirm("상담을 종료할까요? 방 데이터가 삭제됩니다.")) endRoom(); };
  $("#btnFontUp").onclick = () => setFont(2); $("#btnFontDown").onclick = () => setFont(-2);
  $("#btnKeyboard").onclick = () => { $("#textIn").classList.toggle("on"); if ($("#textIn").classList.contains("on")) $("#textInput").focus(); };
  $("#btnTextSend").onclick = () => { const v = $("#textInput").value; $("#textInput").value = ""; sendTyped(v); };
  $("#textInput").onkeydown = (e) => { if (e.key === "Enter") $("#btnTextSend").click(); };
  $("#scrim").onclick = $("#btnGlClose").onclick = closeAll;
  $("#list").addEventListener("click", (e) => { const g = e.target.closest(".gl"); if (g) showGl(g.dataset.ko); });
  window.addEventListener("beforeunload", () => { if (S.role === "counselor" && S.sync && S.msgs.size) return "상담이 진행 중입니다."; });
  // URL로 바로 참여(QR·센터 고정 방) — 버튼 바인딩 뒤에 처리
  const q = new URLSearchParams(location.search);
  if (q.get("pin")) { localStorage.setItem("interp_pin", q.get("pin")); history.replaceState(null, "", location.pathname + "?" + (() => { q.delete("pin"); return q.toString(); })()); }
  if (q.get("room") && q.get("role") === "client") { const lang = q.get("lang") || "en"; return openRoom(q.get("room"), "client", L[lang] ? lang : "en", "ko"); }
  if (q.get("room") && q.get("role") === "counselor") { const lang = q.get("lang") || "vi"; return openRoom(q.get("room"), "counselor", "ko", L[lang] ? lang : "vi"); }   // 센터 고정 방 URL용
}
document.addEventListener("DOMContentLoaded", boot);
})();
