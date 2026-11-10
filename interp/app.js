/* 온말(ONMAL) 진로진학 상담 통역 — app.js
   구조: 언어표 → 동기화(Firestore/로컬) → 음성인식(Azure/WebSpeech) → 번역(Worker/데모) → 화면
   음성은 어디에도 저장하지 않는다. 텍스트는 방 종료 시 삭제된다. */
(() => {
"use strict";
const CFG = Object.assign({ WORKER_URL: "", FIREBASE: null, REFINE_KO_TO_X: true, REFINE_X_TO_KO: false,
  SHOW_PRIVACY_TOGGLE: true, SEGMENT_SILENCE_MS: 900, SEGMENT_SILENCE_MS_CLIENT: 1050, AUTO_END_MIN: 60, IDLE_PAUSE_MIN: 10, GATED_AUDIO: false, SHOW_KO_READING: true, CENTER_NAME: "충남진로진학상담센터" }, window.INTERP_CONFIG || {});
const APP_VERSION = "2026.11.10c";
const QS = new URLSearchParams(location.search);
const DEMO = QS.has("demo") || !CFG.WORKER_URL;   // 연습 모드(?demo=1): 내장 음성인식 + 가짜 번역 + 같은 브라우저 탭 간 동기화. 외부 서비스를 쓰지 않는다
const LIVE = !DEMO;
const GATED = QS.has("gate") ? QS.get("gate") !== "0" : !!CFG.GATED_AUDIO;   // 말할 때만 보내기(config.js의 GATED_AUDIO). 시험할 때는 주소에 ?gate=1(켬) / ?gate=0(끔)
const FB = DEMO ? null : CFG.FIREBASE;            // Firestore 설정(없으면 탭 간 동기화)
const BASE = CFG.WORKER_URL === "/" ? "" : CFG.WORKER_URL;   // "/" = 같은 서버(로컬 시험 서버)
const HOME = location.pathname + (QS.has("demo") ? "?demo=1" : "");
const ROOM_BUSY_MS = 3 * 3600e3;     // 이 시간 안에 상담사 신호가 있던 방은 '사용 중'으로 본다
const ROOM_RESUME_MS = 2 * 3600e3;   // 이 시간 안에 쓰던 방은 첫 화면에서 '이어서 하기'를 묻는다
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
  ko: { speak: "읽어주기", connected: "연결됨", waiting: "상담사 연결 대기", lost: "연결 끊김, 다시 연결 중", ended: "상담이 종료되었습니다", thanks: "감사합니다.", notice: "이 상담은 AI 자동 통역을 사용합니다. 음성은 저장되지 않습니다.", micOn: "듣는 중", micOff: "마이크 꺼짐", tapMic: "시작", stopMic: "일시정지", type: "글자로 입력…", send: "보내기", paused: "대화가 없어 마이크를 잠시 멈췄습니다. [시작]을 누르면 다시 듣습니다." },
  en: { speak: "Read aloud", connected: "Connected", waiting: "Waiting for counselor", lost: "Connection lost, reconnecting", ended: "The session has ended", thanks: "Thank you.", notice: "This session uses AI interpretation. Your voice is not recorded.", micOn: "Listening", micOff: "Mic off", tapMic: "Start", stopMic: "Pause", type: "Type here…", send: "Send", paused: "Microphone paused. Tap Start to speak." },
  vi: { speak: "Đọc to", connected: "Đã kết nối", waiting: "Đang chờ tư vấn viên", lost: "Mất kết nối, đang kết nối lại", ended: "Buổi tư vấn đã kết thúc", thanks: "Cảm ơn bạn.", notice: "Buổi tư vấn này dùng phiên dịch AI. Giọng nói của bạn không được lưu lại.", micOn: "Đang nghe", micOff: "Mic tắt", tapMic: "Bắt đầu", stopMic: "Tạm dừng", type: "Nhập văn bản…", send: "Gửi", paused: "Micro đã tạm dừng. Nhấn Bắt đầu để nói." },
  zh: { speak: "朗读", connected: "已连接", waiting: "等待咨询师", lost: "连接中断，正在重连", ended: "咨询已结束", thanks: "谢谢。", notice: "本次咨询使用AI实时翻译，不会保存您的语音。", micOn: "正在听", micOff: "麦克风已关", tapMic: "开始", stopMic: "暂停", type: "输入文字…", send: "发送", paused: "麦克风已暂停。点击“开始”即可说话。" },
  ru: { speak: "Озвучить", connected: "Подключено", waiting: "Ожидание консультанта", lost: "Связь потеряна, переподключение", ended: "Консультация завершена", thanks: "Спасибо.", notice: "Используется ИИ-перевод. Ваш голос не записывается.", micOn: "Слушаю", micOff: "Микрофон выкл.", tapMic: "Начать", stopMic: "Пауза", type: "Введите текст…", send: "Отправить", paused: "Микрофон приостановлен. Нажмите «Начать», чтобы говорить." },
  ja: { speak: "読み上げ", connected: "接続中", waiting: "相談員を待っています", lost: "接続が切れました。再接続中", ended: "相談は終了しました", thanks: "ありがとうございました。", notice: "この相談はAI通訳を使用します。音声は保存されません。", micOn: "聞き取り中", micOff: "マイクオフ", tapMic: "開始", stopMic: "一時停止", type: "文字で入力…", send: "送信", paused: "マイクを一時停止しました。「開始」を押すと話せます。" },
  th: { speak: "อ่านออกเสียง", connected: "เชื่อมต่อแล้ว", waiting: "รอที่ปรึกษา", lost: "การเชื่อมต่อหลุด กำลังเชื่อมต่อใหม่", ended: "การให้คำปรึกษาสิ้นสุดแล้ว", thanks: "ขอบคุณค่ะ/ครับ", notice: "การให้คำปรึกษานี้ใช้ AI แปลภาษา ไม่มีการบันทึกเสียงของคุณ", micOn: "กำลังฟัง", micOff: "ปิดไมค์", tapMic: "เริ่ม", stopMic: "หยุดชั่วคราว", type: "พิมพ์ข้อความ…", send: "ส่ง", paused: "หยุดไมค์ชั่วคราว แตะ “เริ่ม” เพื่อพูด" },
  id: { speak: "Bacakan", connected: "Terhubung", waiting: "Menunggu konselor", lost: "Koneksi terputus, menyambung ulang", ended: "Sesi telah berakhir", thanks: "Terima kasih.", notice: "Sesi ini menggunakan penerjemah AI. Suara Anda tidak direkam.", micOn: "Mendengarkan", micOff: "Mik mati", tapMic: "Mulai", stopMic: "Jeda", type: "Ketik di sini…", send: "Kirim", paused: "Mikrofon dijeda. Ketuk Mulai untuk berbicara." },
  uz: { speak: "Ovoz chiqarib o'qish", connected: "Ulandi", waiting: "Maslahatchi kutilmoqda", lost: "Aloqa uzildi, qayta ulanmoqda", ended: "Maslahat yakunlandi", thanks: "Rahmat.", notice: "Bu maslahatda sun'iy intellekt tarjimasi ishlatiladi. Ovozingiz saqlanmaydi.", micOn: "Tinglanmoqda", micOff: "Mikrofon o'chiq", tapMic: "Boshlash", stopMic: "To'xtatish", type: "Matn kiriting…", send: "Yuborish", paused: "Mikrofon to'xtatildi. Gapirish uchun «Boshlash»ni bosing." },
  mn: { speak: "Уншиж өгөх", connected: "Холбогдсон", waiting: "Зөвлөхийг хүлээж байна", lost: "Холболт тасарсан, дахин холбогдож байна", ended: "Зөвлөгөө дууслаа", thanks: "Баярлалаа.", notice: "Энэ зөвлөгөөнд хиймэл оюуны орчуулга ашиглана. Таны дуу хоолой хадгалагдахгүй.", micOn: "Сонсож байна", micOff: "Микрофон унтраалттай", tapMic: "Эхлэх", stopMic: "Түр зогсоох", type: "Бичиж оруулах…", send: "Илгээх", paused: "Микрофон түр зогслоо. Ярихын тулд «Эхлэх» дээр дарна уу." },
  ne: { speak: "पढेर सुनाउनुहोस्", connected: "जोडियो", waiting: "परामर्शदाताको प्रतीक्षा", lost: "जडान टुट्यो, पुनः जोड्दै", ended: "परामर्श समाप्त भयो", thanks: "धन्यवाद।", notice: "यो परामर्शमा AI अनुवाद प्रयोग हुन्छ। तपाईंको आवाज रेकर्ड गरिँदैन।", micOn: "सुन्दै", micOff: "माइक बन्द", tapMic: "सुरु", stopMic: "रोक्नुहोस्", type: "यहाँ लेख्नुहोस्…", send: "पठाउनुहोस्", paused: "माइक रोकिएको छ। बोल्न «सुरु» थिच्नुहोस्।" },
  km: { speak: "អានឮៗ", connected: "បានភ្ជាប់", waiting: "កំពុងរង់ចាំអ្នកប្រឹក្សា", lost: "ការតភ្ជាប់ដាច់ កំពុងភ្ជាប់ឡើងវិញ", ended: "ការប្រឹក្សាបានបញ្ចប់", thanks: "សូមអរគុណ។", notice: "ការប្រឹក្សានេះប្រើការបកប្រែដោយ AI។ សំឡេងរបស់អ្នកមិនត្រូវបានថតទុកទេ។", micOn: "កំពុងស្តាប់", micOff: "មីក្រូបិទ", tapMic: "ចាប់ផ្តើម", stopMic: "ផ្អាក", type: "វាយអក្សរនៅទីនេះ…", send: "ផ្ញើ", paused: "មីក្រូត្រូវបានផ្អាក។ ចុច «ចាប់ផ្តើម» ដើម្បីនិយាយ។" },
  fil: { speak: "Basahin nang malakas", connected: "Nakakonekta", waiting: "Hinihintay ang counselor", lost: "Nawala ang koneksyon, kumokonekta muli", ended: "Tapos na ang sesyon", thanks: "Salamat.", notice: "Gumagamit ng AI interpretation ang sesyong ito. Hindi nire-record ang boses mo.", micOn: "Nakikinig", micOff: "Naka-off ang mic", tapMic: "Simulan", stopMic: "I-pause", type: "Mag-type dito…", send: "Ipadala", paused: "Naka-pause ang mikropono. I-tap ang Simulan para magsalita." },
};
const T = (lang, k) => (UI[lang] || UI.en)[k] || UI.en[k];

/* ───────────── 상태 ───────────── */
const S = {
  role: null,            // 'counselor' | 'client'
  room: null,            // 화면·QR·주소에 보이는 4자리 코드
  roomId: null,          // Firestore 방 문서 ID(코드-해시, roomDocId)
  myLang: "ko", theirLang: null,
  msgs: new Map(),       // id → msg
  order: [],
  sync: null, reco: null, tts: null,
  micOn: false, fs: 22,
  refineKoToX: CFG.REFINE_KO_TO_X, refineXToKo: CFG.REFINE_X_TO_KO, privacyOff: false, autoSpeak: false, showLatency: localStorage.getItem('interp_lat') === '1',
  peerSeen: 0, glossary: null, phrases: [], wake: null, seq: 0,
  micWanted: false, micHold: false, autoPaused: null, muteUntil: 0, lastTalk: Date.now(), ended: false, opening: false,
};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const pin = () => localStorage.getItem("interp_pin") || "";
const toast = (t, ms = 2200) => { const e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove("on"), ms); };
const show = (id) => { document.querySelectorAll(".screen").forEach(s => s.classList.remove("on")); $(id).classList.add("on"); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const icon = (name) => `<svg class="ic"><use href="#i-${name}"/></svg>`;
const setBtn = (el, ic, label) => { el.innerHTML = icon(ic) + (label ? `<span>${esc(label)}</span>` : ""); };

/* 화면 안 대화상자(확인·입력). 확인하면 입력값(입력칸이 없으면 true), 취소하면 null */
let dlgDone = null;
function ask({ title, desc = "", value, ok = "확인", cancel = "취소", danger = false, type = "text" }) {
  return new Promise((resolve) => {
    closeAll();
    const input = $("#dlgInput"), hasInput = value !== undefined;
    $("#dlgTitle").textContent = title; $("#dlgDesc").textContent = desc; $("#dlgDesc").style.display = desc ? "" : "none";
    input.style.display = hasInput ? "" : "none"; input.value = hasInput ? value : ""; input.rows = type === "text" ? 3 : 1;
    input.inputMode = type === "pin" ? "numeric" : "text"; input.style.webkitTextSecurity = type === "pin" ? "disc" : "";
    input.onkeydown = (e) => { if (e.key === "Enter" && type !== "text" && !e.isComposing) { e.preventDefault(); $("#dlgOk").click(); } };
    $("#dlgOk").textContent = ok; $("#dlgOk").className = "btn" + (danger ? " danger" : ""); $("#dlgCancel").textContent = cancel;
    dlgDone = (v) => { dlgDone = null; $("#dlg").classList.remove("on"); $("#scrim").classList.remove("on"); resolve(v); };
    $("#dlgOk").onclick = () => dlgDone?.(hasInput ? input.value : true); $("#dlgCancel").onclick = () => dlgDone?.(null);
    $("#dlg").classList.add("on"); $("#scrim").classList.add("on");
    if (hasInput) setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 60);
  });
}

/* 방의 Firestore 문서 ID = "코드-해시". 해시는 SHA-256(센터 PIN + ":" + 코드)의 앞 12자리(hex)라서 4자리 코드만 알아서는 방을 열 수 없다.
   화면·QR·주소에는 4자리 코드만 보인다. ID는 방을 잡거나 들어갈 때 한 번 계산해 그 상담이 끝날 때까지 그대로 쓴다(도중에 PIN을 고쳐 넣어도 같은 방) */
async function roomDocId(code, p = pin()) {
  if (!window.crypto?.subtle) { toast("https 주소로 접속해야 상담 방을 열 수 있습니다 · Please open the https:// address", 8000); throw new Error("crypto.subtle unavailable (insecure context)"); }   // 보안 연결(https·localhost)에서만 해시 계산을 쓸 수 있다
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(p).trim() + ":" + code));
  return code + "-" + Array.from(new Uint8Array(hash, 0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
}
const askPin = async (desc) => ((await ask({ title: "센터 PIN", desc: desc || "센터 PIN을 입력하세요 · Enter the center PIN", value: "", type: "pin", ok: "확인 · OK", cancel: "취소 · Cancel" })) || "").trim();
/* 기기에 저장된 센터 PIN을 Worker가 받아 주는지: true 맞음 / false 틀림 / null 확인 못 함(오프라인 등 — 이때는 막지 않는다) */
let pinGood = null;
async function pinOk() {
  if (pinGood && pinGood === pin()) return true;
  try { await getToken(true); pinGood = pin(); return true; } catch (e) { return String(e?.message || e).includes(" 401 ") ? false : null; }
}

/* 이 패드에서 연 상담 방 목록(기기에만 저장). 끝내지 못하고 닫힌 방을 다음에 이어 하거나 지우기 위해 쓴다.
   room = 4자리 코드, id = 방 문서 ID. 옛 판(문서 ID가 4자리 코드였던 때)에서 만든 항목에는 id가 없다 */
const Rooms = {
  all() { try { return JSON.parse(localStorage.getItem("interp_rooms") || "[]"); } catch { return []; } },
  save(a) { try { localStorage.setItem("interp_rooms", JSON.stringify(a.slice(-20))); } catch {} },
  get(room) { return this.all().find(r => r.room === room); },
  idOf(r) { return r.id || r.room; },
  touch(room, lang, started, id) { const old = this.get(room); const a = this.all().filter(r => r.room !== room); a.push({ room, id: id || old?.id, lang, at: old?.at || Date.now(), last: Date.now(), started: !!(started || old?.started) }); this.save(a); },
  drop(room) { this.save(this.all().filter(r => r.room !== room)); },
};

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
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 6000);   // 6초 넘으면 초벌 자막 유지
  try {
    const r = await api("/refine", { text: msg.src, from: msg.srcLang, to: msg.tgtLang, quick: msg.tgt, context: ctx, role: msg.role }, { signal: ctrl.signal });
    const acc = (await r.text()).trim();   // Worker가 정리된 완성본을 한 번에 돌려줌
    if (acc) onChunk(acc);
    return acc;
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
  async end(byPeer) { if (!byPeer) this.beat(true); clearInterval(this.hb); this.ch.close(); }
}
class FirestoreSync {   // 여기서 id는 모두 방 문서 ID(roomDocId로 계산한 값)다. 4자리 코드를 그대로 넘기지 않는다
  constructor(id, role, onMsg, onPeer) { this.id = id; this.role = role; this.onMsg = onMsg; this.onPeer = onPeer; this.pending = new Map(); this.lang = null; this.peerMs = undefined; this.closed = false; }
  static sdk() {   // Firebase SDK는 처음 필요할 때 한 번만 불러온다
    return FirestoreSync._sdk ||= Promise.all([import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"), import("https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js")])
      .then(([app, fs]) => ({ fs, db: fs.getFirestore(app.initializeApp(FB)) })).catch((e) => { FirestoreSync._sdk = null; throw e; });
  }
  /* 방 상태: 없으면 null, 있으면 { open, age(상담사의 마지막 신호 뒤 ms) } */
  static async peek(id) {
    const { fs, db } = await FirestoreSync.sdk(); const d = await fs.getDoc(fs.doc(db, "rooms", id)); if (!d.exists()) return null;
    const v = d.data(); const at = v.counselorAt?.toMillis?.() || 0; return { open: v.status === "open", at, age: at ? Date.now() - at : Infinity };
  }
  /* 방 비우기: 메시지와 방 문서를 지운다. notify면 먼저 '종료'를 알려 상대 패드가 종료 화면으로 가게 한다.
     알린 경우에는 잠시 뒤 메시지를 한 번 더 지운다(종료 신호와 엇갈려 상대 패드에서 뒤늦게 도착한 자막이 남지 않게) */
  static async purge(id, notify) {
    const { fs, db } = await FirestoreSync.sdk(); const ref = fs.doc(db, "rooms", id);
    const wipe = async () => { const snap = await fs.getDocs(fs.collection(ref, "msgs")); await Promise.all(snap.docs.map(d => fs.deleteDoc(d.ref))); };
    if (notify) await fs.setDoc(ref, { status: "ended" }, { merge: true });
    await wipe(); await fs.deleteDoc(ref);
    if (notify) setTimeout(() => wipe().catch(() => {}), 1500);
  }
  /* 새 상담용으로 방 차지: 다른 상담이 쓰는 중이면 false. 끝나지 않고 남은 옛 방이면 비운 뒤 차지한다(옛 대화가 다음 사람에게 보이지 않게) */
  static async claim(id) {
    const st = await FirestoreSync.peek(id); if (st && st.open && st.age < ROOM_BUSY_MS) return false;
    if (st) await FirestoreSync.purge(id);
    const { fs, db } = await FirestoreSync.sdk(); const ref = fs.doc(db, "rooms", id);
    return fs.runTransaction(db, async (tx) => {   // 확인과 차지를 한 번에: 같은 순간 다른 패드가 먼저 잡았으면 포기
      if ((await tx.get(ref)).exists()) return false;
      tx.set(ref, { counselorAt: fs.serverTimestamp(), expireAt: new Date(Date.now() + 24 * 3600e3), status: "open" }); return true;
    });
  }
  async init() {
    const { fs, db } = await FirestoreSync.sdk(); this.fs = fs; this.db = db;
    this.roomRef = fs.doc(db, "rooms", this.id);
    const other = this.role === "counselor" ? "client" : "counselor";
    // 방 문서는 상담사 패드만 만든다. 내담자 패드는 있는 방에만 들어가고, 방이 없으면(끝났거나 상담사가 방을 바꿨다) 종료로 처리한다
    const here = { [this.role + "At"]: fs.serverTimestamp(), expireAt: new Date(Date.now() + 24 * 3600e3) };
    if (this.role === "counselor") await fs.setDoc(this.roomRef, { ...here, status: "open" }, { merge: true });
    else { try { await fs.updateDoc(this.roomRef, here); } catch (e) { if (e?.code !== "not-found") throw e; return this.gone(); } }
    if (this.closed) return;   // 연결하는 사이 이미 끝났다
    this.unsubRoom = fs.onSnapshot(this.roomRef, (d) => {
      if (!d.exists()) { if (!d.metadata.fromCache) this.gone(); return; }   // 방이 지워졌다(종료 신호 없이 비워졌거나 신호를 놓쳤다) → 종료. 내 신호로 방을 되살리지 않는다
      const v = d.data(); const lang = v[other + "Lang"] || null;
      if (v.status === "ended") return this.onPeer(other, lang, true);
      if (other === "counselor" && !lang) return;   // 상담사가 방 코드만 잡아 두고 아직 들어오지 않았다(들어오면 언어가 기록된다)
      // 상대의 신호 시각이 '바뀌었을 때'만 살아 있다고 본다. 내 신호로 생긴 스냅숏에 그대로 남아 있는 옛 값은 세지 않는다
      const ms = v[other + "At"]?.toMillis?.() || 0; if (!ms || ms === this.peerMs) return;
      const first = this.peerMs === undefined; this.peerMs = ms;
      if (!first || Math.abs(Date.now() - ms) < 60000) this.onPeer(other, lang, false);
    });
    let initial = true;
    this.unsubMsgs = fs.onSnapshot(fs.query(fs.collection(this.roomRef, "msgs"), fs.orderBy("seq")), (snap) => {
      snap.docChanges().forEach(c => { if (c.type === "removed") return; const m = c.doc.data(); if (initial || m.role !== this.role || (m.editedBy && m.editedBy !== this.role)) this.onMsg(m, initial); });
      initial = false;
    });
    this.hb = setInterval(() => this.beat(), 12000);
    this.flush();   // 연결 전에 쌓인 것이 있으면 보낸다
  }
  /* 방 문서가 없어졌다: 상대가 끝냈거나 상담사가 시작 전에 방을 바꿨다. 종료 화면으로 보낸다(그 뒤로는 아무것도 쓰지 않는다) */
  gone() { if (!this.closed) this.onPeer(this.role === "counselor" ? "client" : "counselor", null, true); }
  // 언어·신호는 있는 방 문서만 고친다(updateDoc). 지워진 방을 다시 만들지 않기 위해서다
  async setLang(l) { this.lang = l; if (this.fs && !this.closed) await this.fs.updateDoc(this.roomRef, { [this.role + "Lang"]: l }).catch((e) => { if (e?.code === "not-found") this.gone(); else console.warn(e); }); }
  beat() { if (this.fs && !this.closed) this.fs.updateDoc(this.roomRef, { [this.role + "At"]: this.fs.serverTimestamp(), [this.role + "Lang"]: this.lang }).catch((e) => { if (e?.code === "not-found") this.gone(); }); }
  send(msg) {   // 같은 id는 덮어쓰기(부분→확정→정밀). 확정·번역은 바로, 말하는 중의 부분 자막은 300ms 묶음
    if (this.closed) return;   // 끝난 뒤에 돌아온 번역 결과는 보내지 않는다(지운 방에 메시지가 다시 생기지 않게)
    this.pending.set(msg.id, { ...msg });
    if (!msg.partial) return this.flush();
    this.t ||= setTimeout(() => this.flush(), 300);
  }
  flush() {
    clearTimeout(this.t); this.t = null; if (!this.fs || this.closed) return;
    const batch = [...this.pending.values()]; this.pending.clear();
    batch.forEach(m => this.fs.setDoc(this.fs.doc(this.roomRef, "msgs", m.id), { ...m, expireAt: new Date(Date.now() + 24 * 3600e3) }).catch(e => { console.warn(e); this.onError?.(e); }));
  }
  async end(byPeer) {
    this.closed = true; this.pending.clear();   // 이 뒤로는 방에 아무것도 쓰지 않는다
    clearInterval(this.hb); clearTimeout(this.t); this.unsubRoom?.(); this.unsubMsgs?.();
    if (byPeer || this.role !== "counselor") return;   // 방을 지우는 것은 상담사 패드만(상대가 끝낸 방을 다시 만들지 않는다)
    try { await FirestoreSync.purge(this.id, true); } catch (e) { console.warn("room cleanup", e); }
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
/* 말할 때만 보내기(GATED_AUDIO): 음성 인식 사용 시간은 Azure로 보낸 소리의 길이(조용한 시간 포함)로 계산된다.
   그래서 마이크 소리를 직접 받아 말이 감지된 구간만 보낸다.
     마이크 → micWorklet(16kHz 16bit 모노로 낮춤, 20ms 조각 + 음량) → SpeechGate(말 감지) → Azure 입력 스트림
   말이 시작되면 직전 0.3초부터 보내고(첫 음절이 잘리지 않게), 말이 끝나면 문장이 확정되도록 침묵을 조금 더 보낸 뒤 멈춘다.
   <gate-core> 부터 </gate-core> 까지는 화면·SDK 없이 도는 부분이다(tools/test_gate.mjs 가 이 구간만 꺼내 점검한다). */
/*<gate-core>*/
const FRAME_MS = 20, PRE_MS = 300, FLUSH_MS = 2000;   // 조각 길이 / 말 시작 앞에 붙여 보내는 길이 / 문장 확정을 기다리며 더 보내는 한도
const AUD = { gated: false, micMs: 0, sentMs: 0, wireMs: 0, opens: 0, empty: 0, fallback: "" };   // 이 화면을 연 뒤의 합계(점검용 → audioStat). micMs 마이크가 켜져 있던 시간 / sentMs 말로 판단해 내보낸 길이 / wireMs 실제로 Azure에 전송된 길이
function micWorklet() {   // AudioWorklet 안에서 실행된다. 이 함수의 글자 그대로를 모듈로 넘기므로 바깥 변수를 쓰면 안 된다
  class OnmalMic extends AudioWorkletProcessor {
    constructor() {
      super();
      const R = this.R = sampleRate / 16000; this.N = 1; this.h = null;
      if (R > 1.0001) {   // 장치가 16kHz보다 높으면(보통 48kHz) 7.2kHz 아래만 남긴 뒤(겹침 방지) 16kHz로 낮춘다
        const N = this.N = Math.round(R * 24) | 1, M = (N - 1) / 2, fc = 7200 / sampleRate, h = this.h = new Float32Array(N); let sum = 0;
        for (let i = 0; i < N; i++) { const k = i - M; h[i] = (k === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * k) / (Math.PI * k)) * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1))); sum += h[i]; }
        for (let i = 0; i < N; i++) h[i] /= sum;
      }
      this.buf = new Float32Array(4096); this.w = 0; this.pos = this.N - 1;   // 들어온 소리(고리 모양 보관) / 지금까지 받은 표본 수 / 다음에 내보낼 자리
      this.out = new Int16Array(320); this.n = 0; this.e = 0; this.hp = 0; this.px = 0;
    }
    at(i) { const b = this.buf, h = this.h; if (!h) return b[i & 4095]; let a = 0; for (let k = 0; k < this.N; k++) a += h[k] * b[(i - k) & 4095]; return a; }
    process(inputs) {
      const x = inputs[0] && inputs[0][0]; if (!x) return true;
      const b = this.buf; for (let i = 0; i < x.length; i++) b[(this.w + i) & 4095] = x[i]; this.w += x.length;
      while (this.pos + 1 < this.w) {
        const i = Math.floor(this.pos), f = this.pos - i; let y = this.at(i); if (f > 1e-6) y += (this.at(i + 1) - y) * f; this.pos += this.R;
        const d = y - this.px; this.px = y; this.hp = 0.96 * (this.hp + d); this.e += this.hp * this.hp;   // 음량은 100Hz 아래(책상 울림·바람 소리)를 뺀 값으로 잰다
        this.out[this.n++] = y >= 1 ? 32767 : y <= -1 ? -32768 : Math.round(y * 32767);
        if (this.n === 320) { const pcm = this.out.buffer; this.port.postMessage({ pcm, db: 10 * Math.log10(this.e / 320 + 1e-10) }, [pcm]); this.out = new Int16Array(320); this.n = 0; this.e = 0; }
      }
      if (this.w > 1073741824) { this.w -= 1073741824; this.pos -= 1073741824; }   // 오래 켜 두어도 자리 계산이 넘치지 않게(4096의 배수만큼 당긴다)
      return true;
    }
  }
  registerProcessor("onmal-mic", OnmalMic);
}
/* 20ms 조각마다 frame(소리, 음량dB)을 부르면 말이 있는 구간의 조각만 write로 내보낸다. 시간은 모두 조각 수로 센다(화면이 잠깐 멈춰도 어긋나지 않게) */
class SpeechGate {
  constructor(hangMs, write) {
    this.write = write; this.hang = Math.ceil(hangMs / FRAME_MS); this.flush = Math.ceil(FLUSH_MS / FRAME_MS); this.keep = Math.ceil(PRE_MS / FRAME_MS) + 6;
    this.pre = []; this.open = false; this.pending = false; this.heard = false;   // 앞부분 보관 / 보내는 중 / 인식 중인 문장이 아직 확정되지 않음 / 이번 구간에서 인식된 말이 있음
    this.quiet = 0; this.total = 0; this.recent = 0; this.soft = 0; this.warm = 15; this.wait = 0; this.since = 1e9; this.late = false;
    this.sm = null; this.cur = Infinity; this.n = 0; this.mins = []; this.floor = -60; this.on = -55; this.off = -59; this.db = -100;
  }
  frame(pcm, db) {
    AUD.micMs += FRAME_MS; this.db = db;
    if (this.warm > 0) { this.warm--; this.pre.push(pcm); if (this.pre.length > this.keep) this.pre.shift(); return; }   // 켠 직후 0.3초는 판단하지 않고 보관만 한다(장치가 막 켜질 때의 무음·튀는 소리가 바닥 소음 값을 흐리지 않게)
    // 바닥 소음 = 최근 약 3초에서 가장 조용했던 값(말하는 중에도 낱말 사이 틈에서 잡힌다). 문턱은 그보다 12dB 위, 단 -55~-30dB 안에서만 움직인다
    this.sm = this.sm === null ? db : this.sm + (db - this.sm) * 0.35; if (this.sm < this.cur) this.cur = this.sm;
    if (++this.n >= 20) { this.mins.push(this.cur); if (this.mins.length > 8) this.mins.shift(); this.cur = Infinity; this.n = 0; }
    this.floor = Math.min(this.cur, ...this.mins); this.on = Math.min(-30, Math.max(-55, this.floor + 12)); this.off = this.on - 4;
    const loud = db > this.on, voiced = db > this.off;
    if (!this.open) {   // 대기: 최근 소리를 보관하다가, 최근 3조각 중 2조각이 문턱을 넘거나 약한 소리가 0.12초 이어지면 말이 시작된 것으로 본다
      this.pre.push(pcm); if (this.pre.length > this.keep) this.pre.shift(); this.since++;
      if (this.pending && ++this.wait >= 75) this.seal();   // 멈춘 뒤에야 '말하는 중' 신호가 왔는데 1.5초가 지나도 확정이 없으면 무음 한 덩이로 문장을 닫는다(말풍선이 '듣는 중'으로 남지 않게)
      this.recent = ((this.recent << 1) | (loud ? 1 : 0)) & 7; this.soft = voiced ? this.soft + 1 : 0;
      if ((this.recent & 1) + ((this.recent >> 1) & 1) + ((this.recent >> 2) & 1) >= 2 || this.soft >= 6) this.begin();
      return;
    }
    this.send(pcm); this.quiet = voiced ? 0 : this.quiet + 1;
    if (this.quiet < this.hang || this.total % 5) return;               // 침묵이 이어진 뒤, 100ms 단위에서 끊는다(SDK가 100ms 묶음으로 보내므로 남는 조각이 없게)
    if (this.pending && this.quiet < this.hang + this.flush) return;    // 문장이 아직 확정되지 않았으면 조금 더 보낸다
    this.end();
  }
  begin() { this.open = true; this.quiet = 0; this.heard = false; this.recent = 0; this.soft = 0; this.wait = 0; AUD.opens++; const pre = this.pre; this.pre = []; pre.forEach(b => this.send(b)); }
  send(pcm) { this.write(pcm); this.total++; AUD.sentMs += FRAME_MS; }
  seal() { const n = Math.ceil(this.hang / 5) * 5; this.write(new ArrayBuffer(n * FRAME_MS * 32)); this.total += n; AUD.sentMs += n * FRAME_MS; this.pending = false; this.wait = 0; }   // 완전한 무음 한 덩이(문장 끊김 대기 시간보다 길게) → 인식기가 문장을 닫는다
  end() {
    if (this.pending) this.seal();   // 한도까지 더 보내도 확정되지 않았을 때
    this.late = !this.heard; if (this.late) AUD.empty++; this.since = 0; this.open = false;
  }
  result(final) {   // 인식기가 알려 준다: 말하는 중(false) / 문장 확정(true)
    this.pending = !final; this.wait = 0;
    if (this.open) this.heard = true; else if (this.late && this.since < 100) { this.late = false; AUD.empty--; }   // 멈춘 직후(2초 안)에 온 결과는 방금 보낸 구간의 것이다(짧은 말은 결과가 늦게 온다)
  }
}
/*</gate-core>*/
class GatedMic {   // 마이크 + 위의 두 부품 + Azure 입력 스트림(push)
  static async open(SDK, hangMs) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });   // 권한 거부·장치 없음은 그대로 던진다(startMic이 안내)
    const m = new GatedMic(); m.stream = stream;
    try { await m.init(SDK, hangMs); } catch (e) { m.release(); m.end(); const err = new Error("gated audio: " + (e?.message || e)); err.fallback = true; throw err; }   // 이 기기에서 안 되면 기본 마이크로 넘어가게 표시
    return m;
  }
  async init(SDK, hangMs) {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (!ctx.audioWorklet || !window.AudioWorkletNode || ctx.sampleRate < 16000) throw new Error("AudioWorklet unavailable");
    GatedMic.url ||= URL.createObjectURL(new Blob(["(" + micWorklet + ")()"], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(GatedMic.url);
    this.push = SDK.AudioInputStream.createPushStream(SDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1));
    this.gate = new SpeechGate(hangMs, (pcm) => this.push.write(pcm));
    const node = this.node = new AudioWorkletNode(ctx, "onmal-mic", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: "explicit" });
    const first = new Promise((ok, no) => { const t = setTimeout(() => no(new Error("no audio from microphone")), 2500); this.onFirst = () => { clearTimeout(t); this.onFirst = null; ok(); }; });
    node.port.onmessage = (e) => { if (!this.gate) return; this.onFirst?.(); this.gate.frame(e.data.pcm, e.data.db); vuLevel(e.data.db); };
    this.src = ctx.createMediaStreamSource(this.stream); this.src.connect(node);
    const mute = ctx.createGain(); mute.gain.value = 0; node.connect(mute); mute.connect(ctx.destination);   // 스피커로는 내보내지 않는다(처리가 계속 돌도록 연결만 해 둔다)
    this.stream.getAudioTracks().forEach(t => { t.onended = () => this.onLost?.(); });                      // 마이크가 빠짐(클립 마이크·블루투스) → 다시 연결
    ctx.onstatechange = () => { if (this.gate && ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {}); };
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    await first;   // 소리가 실제로 들어오는지 확인한 뒤에 쓴다
  }
  release() {   // 마이크를 바로 놓는다(브라우저의 녹음 표시가 꺼진다)
    this.gate = null; this.onFirst = null; this.onLost = null;
    try { this.stream.getTracks().forEach(t => { t.onended = null; t.stop(); }); } catch {}
    try { if (this.node) this.node.port.onmessage = null; this.src?.disconnect(); this.node?.disconnect(); } catch {}
    try { if (this.ctx) { this.ctx.onstatechange = null; this.ctx.close().catch(() => {}); } } catch {}
  }
  end() { try { this.push?.close(); } catch {} }   // 입력 스트림 닫기(인식기를 멈춘 뒤에)
}
function audioStat() {   // 점검용(?debug=1 → __onmal.audio()): micSec 마이크가 켜져 있던 초, sentSec 그동안 Azure로 실제 전송된 소리의 초(SDK가 다시 보낸 것 포함). 말할 때만 보내기가 꺼져 있으면 둘이 거의 같다
  const r = S.reco, g = r?.mic?.gate, live = r?.t0 && !r.gated ? Date.now() - r.t0 : 0, mic = AUD.micMs + live, sec = (ms) => Math.round(ms / 100) / 10;
  return { gated: AUD.gated, micSec: sec(mic), sentSec: sec(AUD.wireMs), savedPct: mic ? Math.max(0, Math.round((1 - AUD.wireMs / mic) * 100)) : 0, gateSec: sec(AUD.sentMs), opens: AUD.opens, emptyOpens: AUD.empty, sending: g ? g.open : live > 0,
    levelDb: g ? Math.round(g.db) : null, floorDb: g ? Math.round(g.floor) : null, thresholdDb: g ? Math.round(g.on) : null, sampleRate: r?.mic?.ctx?.sampleRate || null, fallback: AUD.fallback };
}
function audioHud() {   // ?debug=1 일 때만: 위 숫자를 화면 왼쪽 아래에 보여 준다. 누르면 0부터 다시 센다
  const e = document.createElement("div"); e.id = "audioHud"; e.title = "누르면 0부터 다시 셉니다";
  e.style.cssText = "position:fixed;left:10px;bottom:calc(96px + env(safe-area-inset-bottom));z-index:15;max-width:calc(100vw - 20px);padding:7px 11px;border-radius:10px;background:rgba(12,53,64,.9);color:#fff;font:12.5px/1.5 ui-monospace,Consolas,monospace;white-space:pre-line;cursor:pointer";
  e.onclick = () => { AUD.micMs = AUD.sentMs = AUD.wireMs = AUD.opens = AUD.empty = 0; if (S.reco?.t0) S.reco.t0 = Date.now(); };
  const draw = () => {
    const a = audioStat(), on = S.micOn;
    e.textContent = `Azure로 보냄 ${a.sentSec.toFixed(1)}초 / 마이크 ${a.micSec.toFixed(1)}초` + (a.micSec ? ` = ${100 - a.savedPct}% (절감 ${a.savedPct}%)` : "") + "\n"
      + (!on ? "마이크 꺼짐" : a.levelDb === null ? "말할 때만 보내기 꺼짐 · 켜져 있는 동안 모두 보냄" + (a.fallback ? ` (${a.fallback})` : "") : `${a.sending ? "● 보내는 중" : "○ 대기"} · 지금 ${a.levelDb}dB · 문턱 ${a.thresholdDb}dB · 바닥 ${a.floorDb}dB · 말 구간 ${a.opens}회(빈 구간 ${a.emptyOpens})`);
  };
  document.body.appendChild(e); draw(); setInterval(draw, 500);
}
class AzureReco {
  constructor(langs, onPartial, onFinal, onState) { this.langs = langs; this.onPartial = onPartial; this.onFinal = onFinal; this.onState = onState; }
  static async load() { if (window.SpeechSDK) return; await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://aka.ms/csspeech/jsbrowserpackageraw"; s.onload = ok; s.onerror = () => no(new Error("Speech SDK load failed (network)")); document.head.appendChild(s); }); }
  async start() {
    await AzureReco.load(); const SDK = window.SpeechSDK;
    const tok = await getToken(true);                                // { token, region }
    const sc = SDK.SpeechConfig.fromAuthorizationToken(tok.token, tok.region);
    const segMs = S.role === "client" ? (CFG.SEGMENT_SILENCE_MS_CLIENT || CFG.SEGMENT_SILENCE_MS) : CFG.SEGMENT_SILENCE_MS;
    sc.setProperty(SDK.PropertyId.Speech_SegmentationSilenceTimeoutMs, String(segMs));
    sc.setProperty(SDK.PropertyId.SpeechServiceResponse_PostProcessingOption, "TrueText");
    let audio = null;
    if (GATED && navigator.mediaDevices?.getUserMedia) {   // 말할 때만 보내기: 말이 끝난 뒤 문장 끊김 대기 시간 + 0.3초까지만 더 보낸다
      try { const mic = this.mic = await GatedMic.open(SDK, segMs + 300); mic.onLost = () => this.onState("retry"); audio = SDK.AudioConfig.fromStreamInput(mic.push); AUD.fallback = ""; }
      catch (e) { if (!e?.fallback) throw e; console.warn(e); AUD.fallback = e.message; }   // 이 기기에서 준비가 안 되면 아래의 기본 마이크(켜져 있는 동안 모두 보냄)로 진행
      if (this.stopped) return this.stop();   // 준비하는 사이 사용자가 멈췄다
    }
    if (!audio) audio = SDK.AudioConfig.fromDefaultMicrophoneInput();
    this.gated = AUD.gated = !!this.mic;
    let reco;
    if (this.langs.length > 1) {   // 내담자 패드: 모국어 + 한국어 연속 자동 감지
      sc.setProperty(SDK.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous");
      const auto = SDK.AutoDetectSourceLanguageConfig.fromLanguages(this.langs);
      reco = SDK.SpeechRecognizer.FromConfig(sc, auto, audio);
    } else { sc.speechRecognitionLanguage = this.langs[0]; reco = new SDK.SpeechRecognizer(sc, audio); }
    if (this.langs.includes("ko-KR") && S.glossary) {                 // 입시 용어 인식 힌트
      const pl = SDK.PhraseListGrammar.fromRecognizer(reco); let n = 0;
      ["정시는", "정시로", "정시 모집", "수시는", "수시로", "수시 모집", "아포스티유", "학종은", "내신은", "수능최저"].forEach(a => { pl.addPhrase(a); n++; });
      for (const [term, v] of Object.entries(S.glossary.terms)) { if (!v.stt_hint) continue; pl.addPhrase(term); n++; (v.aliases_ko || []).forEach(a => { if (n < 480) { pl.addPhrase(a); n++; } }); if (n >= 480) break; }
    }
    const langOf = (res) => { try { const d = SDK.AutoDetectSourceLanguageResult.fromResult(res).language; return d || this.langs[0]; } catch { return this.langs[0]; } };
    reco.recognizing = (_, e) => { this.mic?.gate?.result(false); if (e.result.text) this.onPartial(e.result.text, langOf(e.result)); };
    reco.recognized = (_, e) => { this.mic?.gate?.result(true); if (e.result.reason === SDK.ResultReason.RecognizedSpeech && e.result.text.trim()) this.onFinal(e.result.text.trim(), langOf(e.result)); };
    reco.canceled = (_, e) => {   // 네트워크 끊김·토큰 만료는 다시 연결(횟수·간격은 retryMic이 관리), 권한 거부 등은 중단
      console.warn("azure canceled", e.errorDetails); const d = String(e.errorDetails || "");
      this.onState(/1006|1001|1007|401|websocket|connection|timeout|network/i.test(d) ? "retry" : "off");
    };
    reco.sessionStopped = () => this.onState("off");
    if (QS.has("debug")) try { SDK.Connection.fromRecognizer(reco).messageSent = (a) => { const m = a.message; if (m?.path === "audio" && m.binaryMessage) AUD.wireMs += m.binaryMessage.byteLength / 32; }; } catch (e) { console.warn(e); }   // 점검용: 실제로 전송된 소리의 길이(16kHz 16bit = 1ms에 32바이트)
    this.reco = reco; this.renew = setInterval(() => getToken(true).then(t => { reco.authorizationToken = t.token; }).catch(() => {}), 8 * 60e3);
    await new Promise((ok, no) => reco.startContinuousRecognitionAsync(ok, no)); this.t0 = Date.now(); this.onState("on");
  }
  stop() {
    this.stopped = true; clearInterval(this.renew);
    if (this.t0 && !this.gated) AUD.micMs += Date.now() - this.t0; this.t0 = 0;   // 기본 마이크는 조각을 세지 않으므로 켜져 있던 시간으로 잰다
    const mic = this.mic; this.mic = null; mic?.release();
    const r = this.reco; this.reco = null; if (!r) { mic?.end(); return; }
    r.stopContinuousRecognitionAsync(() => { r.close(); mic?.end(); }, () => { mic?.end(); });
  }
}

/* ───────────── TTS ───────────── */
let tokCache = null;
async function getToken(fresh) {   // Azure 토큰(10분 유효). 음성 인식은 늘 새로 받고, 읽어주기는 8분 안의 것을 다시 쓴다
  if (!fresh && tokCache && Date.now() - tokCache.at < 8 * 60e3) return tokCache;
  const t = await (await api("/token")).json(); tokCache = { ...t, at: Date.now() }; return tokCache;
}
async function speak(text, lang) {
  const l = L[lang]; if (!text) return;
  const muted = !partialId; if (muted) S.muteUntil = Date.now() + 20000;   // 읽어주는 동안 들린 소리는 자막으로 만들지 않는다(말하는 중이 아니었을 때만)
  const unmute = (ms = 900) => { if (muted) S.muteUntil = Date.now() + ms; };
  if (LIVE && l?.voice) {
    try { await AzureReco.load(); const SDK = window.SpeechSDK; const tok = await getToken(); const t0 = Date.now();
      const sc = SDK.SpeechConfig.fromAuthorizationToken(tok.token, tok.region); sc.speechSynthesisVoiceName = l.voice;
      const syn = new SDK.SpeechSynthesizer(sc);
      syn.speakTextAsync(text, (res) => { syn.close(); unmute(Math.max(0, t0 + (res?.audioDuration || 0) / 10000 - Date.now()) + 1200); }, (e) => { console.warn(e); syn.close(); webSpeak(text, l.azure, unmute); }); return; } catch (e) { console.warn(e); }
  }
  webSpeak(text, l?.azure || lang, unmute);
}
function webSpeak(text, locale, done) {
  if (!window.speechSynthesis) { done?.(0); return toast("이 기기는 음성 출력을 지원하지 않습니다"); }
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = locale || "ko-KR"; u.onend = u.onerror = () => done?.(); speechSynthesis.speak(u);
}

/* ───────────── 메시지 처리 ───────────── */
function upsert(m, fromPeer) {
  const old = S.msgs.get(m.id); S.msgs.set(m.id, Object.assign(old || {}, m));
  if (!old) { S.order.push(m.id); S.order.sort((a, b) => (S.msgs.get(a).seq || 0) - (S.msgs.get(b).seq || 0) || (a < b ? -1 : 1)); }
  S.lastTalk = Date.now(); if (fromPeer && S.autoPaused === "idle") resumeMic();   // 상대가 다시 말하면 멈춰 둔 마이크를 켠다
  render(m.id);
  if (fromPeer && !m.partial && S.role === "client" && S.autoSpeak && !old?.spoken && (m.tgtRefined || m.tgt)) { S.msgs.get(m.id).spoken = true; speak(m.tgtRefined || m.tgt, S.myLang); }
}
let partialId = null, partialTimer = null, lastQuickAt = 0;
function onPartial(text, azureLang) {
  const srcLang = codeOfAzure(azureLang); const tgtLang = srcLang === S.myLang ? S.theirLang : S.myLang;
  if (!partialId) partialId = uid();
  const isNew = !S.msgs.has(partialId);
  const m = { id: partialId, role: S.role, srcLang, tgtLang, src: text, partial: true, ts: Date.now(), tLast: Date.now(), seq: S.msgs.get(partialId)?.seq ?? ++S.seq * 1000 + Date.now() % 1000 };
  upsert(m); vuPulse();
  if (isNew) S.sync.send(m);   // 첫 조각은 바로 보내 상대 화면에 '듣는 중' 말풍선을 띄우고, 그 뒤로는 번역이 붙을 때만 보낸다(동기화 쓰기 절약)
  const now = Date.now();
  if (now - lastQuickAt > 700) { lastQuickAt = now; const id = partialId; translateQuick(text, srcLang, tgtLang).then(t => { const cur = S.msgs.get(id); if (cur && cur.partial) { cur.tgt = t; upsert(cur); S.sync.send(cur); } }).catch(() => {}); }
}
async function onFinal(text, azureLang) {
  const srcLang = codeOfAzure(azureLang); const tgtLang = srcLang === S.myLang ? S.theirLang : S.myLang;
  const id = partialId || uid(); partialId = null;
  const base = S.msgs.get(id) || { id, role: S.role, seq: ++S.seq * 1000 + Date.now() % 1000 };
  if (srcLang === "ko") text = fixKo(text);
  const t0 = base.tLast || Date.now();
  const m = Object.assign(base, { srcLang, tgtLang, src: text, partial: false, ts: Date.now(), tLast: t0, tFinal: Date.now() });
  upsert(m); S.sync.send(m);
  try { m.tgt = await translateQuick(text, srcLang, tgtLang); } catch (e) { m.tgt = m.tgt || text; m.err = true; console.warn(e); }
  m.tQuick = Date.now(); upsert(m); S.sync.send(m);
  if (wantRefine(srcLang, tgtLang)) {
    try { let last = 0; const out = await refine(m, (acc) => { if (Date.now() - last > 250) { last = Date.now(); m.tgtRefined = acc; upsert(m); } });
      if (out && out !== m.tgt) { m.tgtRefined = out; } else { delete m.tgtRefined; } m.tRefined = Date.now(); upsert(m); S.sync.send(m); } catch (e) { console.warn("refine", e); }
  }
}
/* 한국어 인식 오류 교정: 시험에서 확인된 오인식을 확정 문장에서 바로잡는다(번역 전에 적용) */
const KO_FIX = [
  [/(?<![가-힣])정 ?씨(는|로|에|가|와|를|도|만|의)(?=\s|$|[,.?!])/g, "정시$1"], [/정 ?씨 ?모집/g, "정시모집"],
  [/아스포스티유|아포스티 유|아포 스티유|아포스티부/g, "아포스티유"],
  [/수시 ?로 ?지원/g, "수시로 지원"], [/학종 ?전형/g, "학생부종합전형"],
  [/학생부 ?종합 ?전형/g, "학생부종합전형"], [/학교 ?생활 ?기록부 ?를/g, "학교생활기록부를"], [/학교 ?생활 ?기록부/g, "학교생활기록부"],
  [/수능 ?최저 ?학력 ?기준/g, "수능최저학력기준"], [/특성화 ?고(는|를|에|가|의)/g, "특성화고$1"], [/교육감 ?전형/g, "교육감전형"],
];
function fixKo(t) { let s = t; for (const [re, rep] of KO_FIX) s = s.replace(re, rep); return s; }
function codeOfAzure(az) { return (LANGS.find(l => l.azure === az) || L[az] || L[S.myLang]).code; }
async function sendTyped(text) {   // 글자 입력(음성 없는 언어·소음 환경)
  if (!text.trim()) return; await onFinal(text.trim(), L[S.myLang].azure || S.myLang);
}
/* 상담사 전용: 말풍선 수정·다시 번역·삭제 */
async function retranslate(m) {
  m.editedBy = S.role; delete m.tgtRefined; m.tgt = ""; upsert(m); S.sync.send(m);
  try { m.tgt = await translateQuick(m.src, m.srcLang, m.tgtLang); } catch (e) { m.tgt = m.src; console.warn(e); }
  upsert(m); S.sync.send(m);
  if (wantRefine(m.srcLang, m.tgtLang)) { try { const out = await refine(m, () => {}); if (out && out !== m.tgt) m.tgtRefined = out; } catch (e) { console.warn(e); } }
  upsert(m); S.sync.send(m);
}
function msgActions(id) {
  const m = S.msgs.get(id); if (!m || m.partial) return;
  const mine = m.role === S.role; const b = $("#msgActionBody"); b.innerHTML = "";
  const add = (label, desc, fn, danger) => { const e = document.createElement("button"); e.className = "phr"; if (danger) e.style.color = "var(--red)"; e.innerHTML = `<b>${label}</b><div style="font-size:13px;color:var(--sub)">${desc}</div>`; e.onclick = () => { closeAll(); fn(); }; b.appendChild(e); };
  const preview = document.createElement("div"); preview.className = "notice"; preview.textContent = (mine ? m.src : (m.tgtRefined || m.tgt || m.src)).slice(0, 120); b.appendChild(preview);
  if (mine) add("원문 수정 후 다시 번역", "잘못 인식된 내 말을 고치면 상대 화면의 번역도 바뀝니다", async () => { const v = await ask({ title: "원문 수정", desc: "고친 문장으로 다시 번역해 상대 화면에 보냅니다.", value: m.src, ok: "수정하고 다시 번역" }); if (v && v.trim() && v.trim() !== m.src) { m.src = v.trim(); m.edited = true; retranslate(m); } });
  else add("번역문 직접 수정", "내 화면의 한국어 번역만 고칩니다(상대 화면은 그대로)", async () => { const v = await ask({ title: "번역문 수정", desc: "내 화면에 보이는 번역만 바뀝니다.", value: m.tgtRefined || m.tgt || "", ok: "수정" }); if (v && v.trim()) { m.tgtRefined = v.trim(); m.edited = true; upsert(m); } });
  add("다시 번역", "같은 원문으로 초벌·정밀 번역을 다시 받습니다", () => retranslate(m));
  if (!mine && m.tgtLang !== m.srcLang) add("읽어주기", "이 문장을 내 언어로 읽어줍니다", () => speak(m.tgtRefined || m.tgt, S.myLang));
  add("이 말풍선 삭제", "잘못 인식된 소음·헛말을 양쪽 화면에서 지웁니다", () => { m.deleted = true; m.editedBy = S.role; upsert(m); S.sync.send(m); }, true);
  const x = document.createElement("button"); x.className = "btn secondary"; x.textContent = "닫기"; x.onclick = closeAll; b.appendChild(x);
  openSheet("#sheetMsg");
}

/* ───────────── 화면 ───────────── */
function render(id) {
  const m = S.msgs.get(id); if (!m) return;
  const list = $("#list"); let el = document.getElementById("m-" + id);
  if (m.deleted) { el?.remove(); return; }
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  if (!el) { el = document.createElement("div"); el.id = "m-" + id; el.innerHTML = `<div class="hd"><span class="who"></span><span class="stage"></span><span class="time"></span></div><div class="big"></div><div class="orig"></div><span class="tag"></span>`;
    // seq 순서에 맞는 위치에 삽입
    const idx = S.order.indexOf(id); const next = S.order[idx + 1]; const nextEl = next && document.getElementById("m-" + next); list.insertBefore(el, nextEl || null); }
  const mine = m.role === S.role;
  el.className = "msg " + (mine ? "mine" : "theirs") + (m.partial ? " partial" : "") + (m.tgtRefined ? " refined" : "") + (m.edited ? " edited" : "");
  el.querySelector(".stage").textContent = m.partial ? (S.myLang === "ko" ? "듣는 중" : "…") : m.edited ? "수정됨" : m.tgtRefined ? (S.myLang === "ko" ? "정밀 번역" : "✓") : "";
  const big = el.querySelector(".big"), orig = el.querySelector(".orig");
  // 내 화면 언어로 보여줄 글: 원문이 내 언어면 원문, 아니면 번역
  const showText = m.srcLang === S.myLang ? m.src : (m.tgtRefined || m.tgt || (m.partial ? "…" : m.src));
  const showLang = m.srcLang === S.myLang ? m.srcLang : (m.tgt || m.tgtRefined ? m.tgtLang : m.srcLang);
  big.innerHTML = underline(esc(showText), showLang); big.dir = L[showLang]?.rtl ? "rtl" : "ltr"; big.lang = L[showLang]?.azure || showLang;
  if (!mine && m.srcLang !== S.myLang) { orig.textContent = m.src || ""; orig.style.display = ""; orig.dir = L[m.srcLang]?.rtl ? "rtl" : "ltr"; } else orig.style.display = "none";
  el.querySelector(".who").textContent = mine ? (S.role === "counselor" ? "상담사" : L[S.myLang]?.name || "") : (S.role === "counselor" ? `내담자 · ${L[m.srcLang]?.name || ""}` : (L[m.srcLang]?.name || ""));
  let timeTxt = new Date(m.ts || Date.now()).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (S.showLatency && S.role === "counselor" && m.tLast && m.tFinal) { const f = (a) => a ? ((a - m.tLast) / 1000).toFixed(1) + "s" : "–"; timeTxt = `확정 ${f(m.tFinal)} · 번역 ${f(m.tQuick)} · 정밀 ${f(m.tRefined)} · ` + timeTxt; }
  el.querySelector(".time").textContent = timeTxt;
  if (atBottom) list.scrollTop = list.scrollHeight;
}
/* 용어 밑줄: 보여주는 언어의 용어집 항목을 찾아 점선 밑줄 */
let glIndex = {};
const KO_ABBR = new Set(["학종", "세특", "창체", "모평", "학평", "추합", "표점", "외고", "예고", "체고", "토픽", "자소서", "생기부", "학생부"]);
function buildGlIndex() {
  glIndex = {}; if (!S.glossary) return;
  for (const [ko, v] of Object.entries(S.glossary.terms)) {
    (glIndex.ko ||= []).push({ s: ko, ko }); (v.aliases_ko || []).forEach(a => (a.length >= 3 || KO_ABBR.has(a)) && glIndex.ko.push({ s: a, ko }));   // 두 글자 별칭은 흔한 줄임말만(상담·학과·등급 같은 일상어에 밑줄이 번지지 않게)
    for (const [lang, t] of Object.entries(v.tr || {})) if (t.term && t.term.length >= 3) (glIndex[lang] ||= []).push({ s: t.term.replace(/\s*\(.*?\)\s*$/, ""), ko });
  }
  for (const k in glIndex) glIndex[k].sort((a, b) => b.s.length - a.s.length);
}
const glRe = {};
function underline(html, lang) {   // 한 번의 치환으로 처리(삽입한 태그 안을 다시 매칭하지 않도록)
  const arr = glIndex[lang]; if (!arr || !html) return html;
  if (!glRe[lang]) {
    const map = new Map(arr.map(x => [esc(x.s).toLowerCase(), x.ko]));
    const alt = arr.map(x => esc(x.s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    glRe[lang] = { map, re: lang === "ko" ? new RegExp(`(?<![가-힣])(?:${alt})`, "g") : new RegExp(alt, "gi") };   // 한국어는 낱말 첫머리에서만(간호'학과' 같은 낱말 속 일치 방지)
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
  const st = state === "ok" ? T(S.myLang, "connected") : state === "wait" ? (S.role === "counselor" ? "내담자 연결 대기" : T(S.myLang, "waiting")) : (S.role === "counselor" ? "내담자 패드 연결 끊김" : T(S.myLang, "lost"));
  info.innerHTML = `<b class="room">${esc(S.room)}</b><span class="pair">${esc(pair)}</span><span class="st">· ${esc(st)}</span>` + (LIVE ? "" : `<span class="demo">· 연습</span>`);
}
function micState(st) {
  const box = $("#micBox"), btn = $("#btnMic");
  if (st === "on") { S.micOn = true; micRetry = 0; box.classList.remove("off"); $("#micText").textContent = T(S.myLang, "micOn"); setBtn(btn, "pause", T(S.myLang, "stopMic")); vu(true); return; }
  S.micOn = false; box.classList.add("off"); setBtn(btn, "mic", T(S.myLang, "tapMic")); vu(false);
  if (st === "retry") return retryMic();
  $("#micText").textContent = st === "denied" ? "마이크 권한이 거부되었습니다 · Microphone blocked" : micRetryTimer ? T(S.myLang, "lost") : T(S.myLang, "micOff");
  if (st === "denied") { S.micWanted = false; $("#textIn").classList.add("on"); }
}
/* 음성 인식이 끊기면(와이파이 순간 끊김·토큰 만료) 간격을 늘려 가며 다시 연결한다. 사용자가 일시정지를 누르면 멈춘다 */
let micRetry = 0, micRetryTimer = null;
function retryMic() {
  const old = S.reco; S.reco = null; try { old?.stop(); } catch {}
  clearTimeout(micRetryTimer); micRetryTimer = null;
  if (!S.micWanted || S.ended) return micState("off");
  if (++micRetry > 6) {
    micRetry = 0; S.micWanted = false; micState("off"); $("#textIn").classList.add("on");
    return toast(S.myLang === "ko" ? "음성 인식 연결이 계속 끊깁니다. 네트워크를 확인한 뒤 [시작]을 다시 눌러 주세요." : T(S.myLang, "lost"), 5000);
  }
  $("#micText").textContent = T(S.myLang, "lost");
  micRetryTimer = setTimeout(() => { micRetryTimer = null; if (S.micWanted && !S.micOn && !S.ended) startMic(true); }, Math.min(15000, 1500 * 2 ** (micRetry - 1)));
}
/* 마이크 막대: 듣는 동안 잔잔히 움직이다가 실제로 말이 인식될 때 크게 움직인다. 말할 때만 보내기에서는 실제 입력 음량을 따라 움직인다 */
let vuTimer = null, vuHot = 0, vuLvl = 0, vuLvlAt = 0;
const vuPulse = () => { vuHot = Date.now() + 450; };
const vuLevel = (db) => { vuLvl = Math.max(Math.min(1, Math.max(0, (db + 60) / 40)), vuLvl * 0.8); vuLvlAt = Date.now(); };   // -60dB → 0, -20dB → 1 (내려갈 때는 천천히)
function vu(on) {
  clearInterval(vuTimer); const bars = document.querySelectorAll("#micBox .vu i"); if (!on) { bars.forEach(b => b.style.height = "6px"); return; }
  vuTimer = setInterval(() => { const hot = Date.now() < vuHot, live = Date.now() - vuLvlAt < 400; bars.forEach(b => b.style.height = (live ? 5 + vuLvl * (12 + Math.random() * 7) : hot ? 8 + Math.random() * 16 : 5 + Math.random() * 3) + "px"); }, 120);
}

/* ───────────── 마이크 ───────────── */
async function startMic(isRetry) {
  if (S.micOn || S.reco) return;
  const me = L[S.myLang]; S.micHold = false; S.autoPaused = null;
  if (!me.azure) { $("#textIn").classList.add("on"); return toast("이 언어는 음성 인식이 없어 글자 입력으로 진행합니다"); }
  if (!isRetry) { micRetry = 0; clearTimeout(micRetryTimer); micRetryTimer = null; }
  if (!LIVE && !WebSpeechReco.ok()) { $("#textIn").classList.add("on"); return toast("이 브라우저는 내장 음성인식이 없습니다. 글자 입력으로 연습하세요."); }
  S.micWanted = true;
  const langs = S.role === "client" ? [me.azure, "ko-KR"] : [me.azure];
  const heard = (fn) => (text, lang) => { if (Date.now() < S.muteUntil) return; fn(text, lang); };   // 읽어주기 소리는 자막으로 만들지 않는다
  let reco;
  try {
    reco = S.reco = new (LIVE ? AzureReco : WebSpeechReco)(langs, heard(onPartial), heard(onFinal), (st) => { if (S.reco === reco) micState(st); });   // 지난 인식기의 뒤늦은 신호는 무시
    await reco.start();
    if (S.reco !== reco) { try { reco.stop(); } catch {} }   // 시작하는 사이 사용자가 멈췄으면 닫는다
  } catch (e) {
    console.warn(e); const msg = String(e?.message || e || "");
    if (S.reco === reco) S.reco = null; try { reco?.stop(); } catch {}
    if (msg.includes("401")) {   // PIN 없음·불일치 → 바로 입력받기
      S.micWanted = false; micState("off");
      const p = await ask({ title: "센터 PIN", desc: "센터 PIN을 입력하세요 · Enter the center PIN", value: "", type: "pin", ok: "확인 · OK", cancel: "취소 · Cancel" });
      if (p && p.trim()) { localStorage.setItem("interp_pin", p.trim()); return startMic(); }
      return toast("PIN이 없어 음성 인식을 시작할 수 없습니다. 첫 화면의 기기 설정(PIN)에서 입력하세요.", 5000);
    }
    if (/fetch|network|load failed|timeout|websocket|1006|50\d/i.test(msg)) { micState("off"); return retryMic(); }   // 네트워크 문제 → 자동 재시도
    S.micWanted = false;
    if (/NotAllowed|Permission|denied/i.test(msg)) { micState("denied"); return toast("마이크 사용을 허용해 주세요 · Please allow microphone access", 5000); }
    micState("off"); $("#textIn").classList.add("on"); toast("음성 인식 시작 실패: " + (msg || "마이크를 사용할 수 없습니다"), 4000);
  }
}
function stopMic() { S.micWanted = false; S.autoPaused = null; clearTimeout(micRetryTimer); micRetryTimer = null; micRetry = 0; const r = S.reco; S.reco = null; try { r?.stop(); } catch {} micState("off"); }
/* 자동 일시정지: 음성 인식은 조용한 시간도 사용 시간으로 계산되므로, 대화가 한동안 없거나 화면이 오래 가려지면 잠시 멈춘다.
   사용자가 누른 일시정지와 달리 조건이 풀리면(상대가 말함·화면으로 돌아옴) 스스로 다시 켠다 */
function pauseMic(why) {
  if (!S.micOn && !S.reco) return; stopMic(); S.autoPaused = why;
  if (why === "idle") { $("#micText").textContent = T(S.myLang, "paused"); toast(T(S.myLang, "paused"), 6000); }
}
function resumeMic() { if (!S.autoPaused || S.ended) return; S.autoPaused = null; startMic(); }
async function requestWake() { if (S.ended || !S.room || (S.wake && !S.wake.released)) return; try { S.wake = await navigator.wakeLock?.request("screen"); } catch {} }
let hiddenTimer = null;
function onVisibility() {
  clearTimeout(hiddenTimer);
  if (document.visibilityState === "hidden") { hiddenTimer = setTimeout(() => { if (document.visibilityState === "hidden" && S.micOn) pauseMic("hidden"); }, 120000); return; }
  if (S.autoPaused === "hidden") resumeMic(); requestWake();
}
let syncWarnAt = 0;
function syncProblem(e) {   // 자막이 상대 화면에 전달되지 않을 때 알린다(20초에 한 번)
  if (Date.now() - syncWarnAt < 20000) return; syncWarnAt = Date.now();
  const quota = /resource-exhausted|quota/i.test(String(e?.code || "") + String(e?.message || e));
  toast(S.myLang !== "ko" ? T(S.myLang, "lost") : quota ? "오늘 동기화 사용량 한도에 도달해 자막이 상대 화면에 전달되지 않습니다." : "자막을 상대 화면에 보내지 못했습니다. 네트워크를 확인해 주세요.", 5000);
}

/* ───────────── 방 시작/종료 ───────────── */
async function openRoom(room, role, myLang, theirLang, id) {   // room = 4자리 코드, id = 방 문서 ID(부르는 쪽이 찾거나 잡아 둔 값. 없으면 코드와 지금의 PIN으로 계산)
  if (S.opening) return; S.opening = true;
  S.room = room; S.role = role; S.myLang = myLang; S.theirLang = theirLang; S.msgs.clear(); S.order = []; S.summary = ""; S.ended = false; S.seq = 0; S.lastTalk = Date.now(); $("#list").innerHTML = "";
  S.fs = +localStorage.getItem("interp_fs_" + role) || (role === "client" ? 26 : 22); document.documentElement.style.setProperty("--fs", S.fs + "px");
  // 역할별 화면
  $("#btnPhrases").style.display = role === "counselor" ? "" : "none";
  $("#btnEnd").style.display = role === "counselor" ? "" : "none";
  $("#btnSettings").style.display = role === "counselor" ? "" : "none";
  setBtn($("#btnMic"), "mic", T(myLang, "tapMic")); $("#micText").textContent = T(myLang, "micOff"); setBtn($("#btnSpeak"), "speaker", T(myLang, "speak"));
  $("#textInput").placeholder = T(myLang, "type"); $("#btnTextSend").textContent = T(myLang, "send");
  $("#textIn").classList.toggle("on", !L[myLang].azure);
  const hello = document.createElement("div"); hello.className = "hello"; hello.innerHTML = `<svg class="sym" aria-hidden="true"><use href="#onmal-sym"/></svg><div></div>`;
  hello.lastChild.innerHTML = role === "client" ? `<b>${esc(L[myLang].name)} ⇄ 한국어</b>${esc(T(myLang, "notice"))}`
    : `<b>방 ${esc(room)} · 한국어 ⇄ ${esc(L[theirLang]?.ko || "")}</b>내담자 패드에서 코드 ${esc(room)}(으)로 들어오면 연결됩니다. [시작]을 누르고 말씀하세요. 내 말은 ${esc(L[theirLang]?.ko || "")}로 번역되어 상대 화면에, 상대 말은 한국어로 이 화면에 나타납니다.`;
  $("#list").appendChild(hello);
  show("#s-talk"); setConn("wait");
  history.replaceState(null, "", `${location.pathname}?room=${room}&role=${role}&lang=${role === "client" ? myLang : theirLang}${QS.has("demo") ? "&demo=1" : ""}`);   // 새로고침해도 같은 방으로 돌아온다
  // 동기화
  const onMsg = (m, restoring) => {
    if (m.seq) S.seq = Math.max(S.seq, Math.floor(m.seq / 1000));   // 상대 발화 뒤에 내 다음 발화가 오도록 순번을 맞춘다(두 패드의 대화 순서 유지)
    if (!restoring && m.role === S.role && !(m.editedBy && m.editedBy !== S.role)) return;   // 내 발화는 상대가 고친 경우 또는 새로고침 복원 때만 받음
    upsert(m, !restoring);
  };
  const onPeer = (otherRole, lang, ended) => {
    S.peerSeen = Date.now();
    if (lang && lang !== S.peerLang) { S.peerLang = lang; if (otherRole === "client" && S.role === "counselor") S.theirLang = lang; }   // 내담자가 고른 언어를 따른다(바뀌었을 때만 — 상담사가 설정에서 바꾼 값은 유지)
    if (ended) return endScreen(true);
    setConn("ok"); if (S.micHold) startMic();   // 내담자 패드는 상담사가 들어온 뒤에 듣기 시작
  };
  if (FB) S.roomId = id ||= await roomDocId(room);
  S.sync = FB ? new FirestoreSync(id, role, onMsg, onPeer) : new LocalSync(room, role, onMsg, onPeer);
  S.sync.onError = syncProblem;
  if (S.sync.init) { try { await S.sync.init(); } catch (e) { console.error(e); toast("동기화 연결 실패: " + e.message, 5000); } }
  S.sync.setLang(myLang);
  setInterval(() => { if (S.room && !S.ended && Date.now() - S.peerSeen > 40000) setConn(S.peerSeen ? "lost" : "wait"); }, 5000);
  if (FB && role === "counselor") { Rooms.touch(room, theirLang, true, id); setInterval(() => { if (!S.ended) Rooms.touch(room, S.theirLang, true); }, 60000); }
  requestWake();
  scheduleAutoEnd(role === "counselor" ? CFG.AUTO_END_MIN : (CFG.AUTO_END_MIN ? CFG.AUTO_END_MIN + 40 : 0));   // 내담자 패드는 상담사 종료를 따르고, 예비로 40분 더 뒤에 자체 종료
  if (CFG.IDLE_PAUSE_MIN) setInterval(() => { if (!S.ended && S.micOn && Date.now() - S.lastTalk > CFG.IDLE_PAUSE_MIN * 60e3) pauseMic("idle"); }, 20000);
  await Promise.race([glossaryReady, sleep(3500)]);   // 용어 인식 힌트에 용어집이 필요(느린 네트워크에서는 기다리지 않고 시작)
  if (S.ended) return;   // 기다리는 사이 끝났으면(방이 없어졌거나 상대가 종료) 마이크를 켜지 않는다
  if (role === "client" && !S.peerSeen && L[myLang].azure) { S.micHold = true; $("#micText").textContent = T(myLang, "waiting"); }   // 기다리는 동안은 음성 인식 사용 시간을 쓰지 않는다
  else startMic();
}
/* 자동 종료: 시작 N분 뒤 종료, 5분 전 안내 + 연장 */
let autoEndAt = 0, autoTimer = null, autoWarned = false;
function scheduleAutoEnd(minutes) {
  clearInterval(autoTimer); if (!minutes) return;
  autoEndAt = Date.now() + minutes * 60e3; autoWarned = false;
  autoTimer = setInterval(() => {
    const left = autoEndAt - Date.now();
    if (left <= 0) { clearInterval(autoTimer); toast(S.myLang === "ko" ? "정해진 시간이 지나 상담을 자동 종료합니다" : T(S.myLang, "ended"), 4000); return S.role === "counselor" ? endRoom() : endScreen(true); }
    if (left <= 5 * 60e3 && !autoWarned) { autoWarned = true; showAutoEndBanner(Math.ceil(left / 60e3)); }
  }, 15e3);
}
function showAutoEndBanner(min) {
  let b = document.getElementById("autoEndBanner");
  if (!b) { b = document.createElement("div"); b.id = "autoEndBanner"; b.className = "notice"; b.style.cssText = "position:sticky;top:0;z-index:5;background:#fff7ed;border-color:#fdba74;color:#9a3412;display:flex;gap:10px;align-items:center;justify-content:space-between"; $("#list").prepend(b); }
  const ko = S.myLang === "ko";
  b.innerHTML = `<span>${ko ? `약 ${min}분 뒤 상담이 자동 종료됩니다.` : `This session will end automatically in about ${min} min.`}</span>` + (S.role === "counselor" ? `<button class="iconbtn" id="btnExtend">30분 연장</button>` : "");
  const x = b.querySelector("#btnExtend"); if (x) x.onclick = () => { scheduleAutoEnd(30); b.remove(); toast("30분 연장했습니다"); };
}
async function endRoom() {
  clearInterval(autoTimer);
  stopMic(); const room = S.room; await S.sync?.end(); Rooms.drop(room); endScreen(false);
}
/* 새로고침·재접속 시 내 발화도 복원(초기 스냅샷은 전부 받음) */
function endScreen(byPeer) {
  if (S.ended) return; S.ended = true;
  clearInterval(autoTimer); stopMic(); if (byPeer) S.sync?.end?.(true); history.replaceState(null, "", HOME);
  $("#endTitle").textContent = T(S.myLang, "ended"); $("#endSub").textContent = T(S.myLang, "thanks");
  const acts = $("#endActions"); acts.innerHTML = "";
  if (S.role === "counselor") {
    if (LIVE) { const sb = document.createElement("button"); sb.className = "btn"; sb.textContent = "상담 요약 만들기 (AI, 5항목)"; sb.onclick = () => makeSummary(sb); acts.appendChild(sb);
      const box = document.createElement("div"); box.id = "summaryBox"; box.className = "card"; box.style.display = "none"; box.style.whiteSpace = "pre-wrap"; box.style.fontSize = "17px"; box.style.lineHeight = "1.55"; acts.appendChild(box); }
    const b = document.createElement("button"); b.className = "btn secondary"; b.textContent = "상담 내용 텍스트로 저장 (이름 없음)"; b.onclick = exportTxt; acts.appendChild(b);
    const n = document.createElement("div"); n.className = "notice"; n.textContent = "저장하지 않으면 이 화면을 떠날 때 대화 내용은 사라집니다. 방 데이터는 삭제되었습니다."; acts.appendChild(n);
  }
  const back = document.createElement("button"); back.className = "btn secondary"; back.textContent = S.role === "counselor" ? "처음으로" : "Close · 닫기"; back.onclick = () => { location.href = HOME; }; acts.appendChild(back);
  show("#s-end"); try { S.wake?.release(); } catch {}
}
async function makeSummary(btn) {
  const lines = S.order.map(id => S.msgs.get(id)).filter(m => m && !m.partial && !m.deleted && m.src)
    .map(m => ({ role: m.role, text: m.srcLang === "ko" ? m.src : (m.tgtRefined || m.tgt || m.src) }));   // 한국어 쪽 텍스트만
  if (!lines.length) return toast("요약할 대화가 없습니다");
  btn.disabled = true; btn.textContent = "요약 작성 중…";
  try { const r = await api("/summary", { lines, theirLang: S.theirLang }); const d = await r.json();
    S.summary = d.summary || ""; const box = $("#summaryBox"); box.style.display = ""; box.textContent = S.summary || (d.refused ? "요약을 만들 수 없는 내용입니다." : "요약 결과가 비어 있습니다.");
    btn.textContent = "요약 다시 만들기"; btn.disabled = false; toast("요약을 텍스트 저장에 함께 넣습니다");
  } catch (e) { console.warn(e); btn.disabled = false; btn.textContent = "상담 요약 만들기 (AI, 5항목)"; toast("요약 실패: " + String(e.message || e), 4000); }
}
function exportTxt() {
  const lines = [`온말(ONMAL) 상담 통역 기록 · ${CFG.CENTER_NAME}`, `일시: ${new Date().toLocaleString("ko-KR")}`, `언어: 한국어 ⇄ ${L[S.theirLang]?.ko || ""}`, `※ AI 자동 통역 기록이며 오역이 있을 수 있습니다. 개인 식별 정보는 포함하지 않습니다.`, ""];
  for (const id of S.order) { const m = S.msgs.get(id); if (!m || m.partial || !m.src || m.deleted) continue; const who = m.role === "counselor" ? "상담사" : "내담자"; const t = new Date(m.ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    lines.push(`[${t}] ${who}: ${m.src}`); if (m.tgtLang !== m.srcLang && (m.tgtRefined || m.tgt)) lines.push(`        → ${m.tgtRefined || m.tgt}`); }
  if (S.summary) { lines.push("", "■ 상담 요약 (AI 자동 작성, 확인 후 사용)", S.summary); }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/plain;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); const d = new Date(), p2 = (n) => String(n).padStart(2, "0"); a.download = `온말_상담기록_${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.txt`; a.click();
}

/* ───────────── 설정·문장 시트 ───────────── */
function openSheet(id) { $(id).classList.add("on"); $("#scrim").classList.add("on"); }
function closeAll() { document.querySelectorAll(".sheet,.pop").forEach(e => e.classList.remove("on")); $("#scrim").classList.remove("on"); dlgDone?.(null); }
function renderSettings() {
  const b = $("#settingsBody"); b.innerHTML = "";
  const opt = (label, key, desc) => { const d = document.createElement("div"); d.className = "opt"; d.innerHTML = `<div><div>${label}</div><div style="font-size:13px;color:var(--sub)">${desc || ""}</div></div><div class="switch ${S[key] ? "on" : ""}"></div>`; d.querySelector(".switch").onclick = (e) => { S[key] = !S[key]; e.target.classList.toggle("on", S[key]); }; b.appendChild(d); };
  opt("정밀 번역: 한국어 → 내담자 언어", "refineKoToX", "Claude가 용어집·상담 문맥을 반영해 1~2초 뒤 자막을 교체");
  opt("정밀 번역: 내담자 언어 → 한국어", "refineXToKo", "끄면 초벌 번역만 표시(더 빠름)");
  if (CFG.SHOW_PRIVACY_TOGGLE) opt("개인정보 구간 (정밀 번역 일시 중지)", "privacyOff", "이름·연락처·주소를 말하는 동안 켜 두면 해외 API로 문장이 가지 않음");
  opt("지연 시간 표시 (시험용)", "showLatency", "말이 끝난 뒤 자막 확정·초벌·정밀까지 걸린 초를 말풍선에 표시"); b.lastChild.querySelector(".switch").addEventListener("click", () => { localStorage.setItem("interp_lat", S.showLatency ? "1" : "0"); S.order.forEach(render); });
  const d = document.createElement("div"); d.className = "opt"; d.innerHTML = `<div>내담자 언어 바꾸기</div><select id="selLang" style="font:inherit;font-size:16px;padding:8px"></select>`; b.appendChild(d);
  const sel = d.querySelector("select"); LANGS.filter(l => l.code !== "ko").forEach(l => { const o = document.createElement("option"); o.value = l.code; o.textContent = `${l.ko} · ${l.name}`; if (l.code === S.theirLang) o.selected = true; sel.appendChild(o); });
  sel.onchange = () => { S.theirLang = sel.value; setConn("ok"); toast("내담자 언어를 바꿨습니다. 내담자 패드는 다시 접속해야 합니다."); };
  const v = document.createElement("div"); v.className = "notice"; v.textContent = `온말 v${APP_VERSION} · 방 ${S.room}` + (LIVE ? "" : " · 연습 모드"); b.appendChild(v);
  const x = document.createElement("button"); x.className = "btn secondary"; x.textContent = "닫기"; x.onclick = closeAll; b.appendChild(x);
}
async function renderPhrases() {
  const b = $("#phraseList"); b.innerHTML = "";
  S.phrases.forEach(p => { const e = document.createElement("button"); e.className = "phr"; e.textContent = p; e.onclick = () => { closeAll(); sendTyped(p); }; b.appendChild(e); });
}

/* ───────────── 시작 화면 ───────────── */
function renderLangGrid() {   // 전체 언어를 처음부터 표시(자주 쓰는 언어 먼저)
  const g = $("#langGrid"); g.innerHTML = "";
  LANGS.filter(l => l.code !== "ko").sort((a, b) => (a.top || 99) - (b.top || 99)).forEach(l => {
    const e = document.createElement("button"); e.className = "lang" + (l.azure ? "" : " textonly"); e.innerHTML = `<b>${esc(l.name)}</b><span>${esc(l.ko)}</span>`;
    e.onclick = () => { document.querySelectorAll(".lang").forEach(x => x.classList.remove("sel")); e.classList.add("sel"); S.theirLang = l.code; prepareRoom(); }; g.appendChild(e); });
}
function renderJoinLangs() {   // 내담자 참여 화면 언어 버튼(모국어 표기 크게) — 전체 언어 표시
  const g = $("#joinLangGrid"); g.innerHTML = "";
  LANGS.filter(l => l.code !== "ko").sort((a, b) => (a.top || 99) - (b.top || 99)).forEach(l => {
    const e = document.createElement("button"); e.className = "lang" + (l.code === S.joinLang ? " sel" : ""); e.innerHTML = `<b>${esc(l.name)}</b><span>${esc(l.ko)}</span>`;
    e.onclick = () => { S.joinLang = l.code; document.querySelectorAll("#joinLangGrid .lang").forEach(x => x.classList.remove("sel")); e.classList.add("sel"); $("#joinCode").focus(); }; g.appendChild(e); });
}
/* 상담사가 언어를 고르면 방 코드를 정한다. 다른 상담이 쓰는 코드는 피하고, 끝나지 않고 남은 옛 방이면 비운 뒤 쓴다 */
let claiming = 0, claimBeat = null;
async function prepareRoom() {
  const my = ++claiming; const card = $("#roomCard"); card.style.display = ""; $("#roomCode").textContent = "····"; $("#qr").innerHTML = ""; $("#joinUrlNote").textContent = ""; $("#btnStartTalk").disabled = true;
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  releaseClaim(true);   // 언어를 다시 고르면 앞서 잡아 둔 빈 방은 지운다
  if (FB) {   // 방 주소가 센터 PIN으로 만들어지므로 맞는 PIN이 있어야 방을 잡는다. 없거나 Worker가 받지 않으면 여기서 입력받는다(QR로 내담자 패드에 전해지는 PIN도 이 값)
    for (let ok = pin() ? await pinOk() : false; ok === false; ok = await pinOk()) {
      if (my !== claiming) return;
      const p = await askPin(pin() ? "센터 PIN이 맞지 않습니다. 다시 입력해 주세요." : "상담 방을 만들려면 센터 PIN이 필요합니다. 센터에서 안내받은 번호를 넣으세요.");
      if (my !== claiming) return;
      if (!p) { card.style.display = "none"; document.querySelectorAll("#langGrid .lang").forEach(x => x.classList.remove("sel")); return toast("센터 PIN이 있어야 상담 방을 만들 수 있습니다", 4000); }
      localStorage.setItem("interp_pin", p);
    }
    if (my !== claiming) return;
  }
  let room = null, id = null, claimed = false;
  for (let i = 0; i < 6 && !room; i++) {
    const c = String(Math.floor(1000 + Math.random() * 9000));
    if (!FB) { room = c; break; }
    const cid = await roomDocId(c);
    try { if (await FirestoreSync.claim(cid)) { room = c; id = cid; claimed = true; } } catch (e) { console.warn("room claim", e); room = c; id = cid; }   // 확인이 안 되면(오프라인 등) 그대로 진행
  }
  room ||= String(Math.floor(1000 + Math.random() * 9000)); if (FB) id ||= await roomDocId(room);
  if (my !== claiming) { if (claimed) FirestoreSync.purge(id).catch(() => {}); return; }   // 그 사이 다른 언어를 눌렀으면 이 방은 버린다
  S.room = room; S.roomId = id;
  if (claimed) { const prev = Rooms.get(room); if (prev && Rooms.idOf(prev) !== id) dropRoom(prev); Rooms.touch(room, S.theirLang, false, id); }   // 같은 코드로 남아 있던 다른 주소의 옛 방은 정리한다
  claimBeat ||= setInterval(() => { if (S.room && !S.role && Rooms.get(S.room)) Rooms.touch(S.room, S.theirLang, false); }, 60000);   // 코드 화면에 머무는 동안 '쓰는 중' 표시를 갱신
  $("#roomCode").textContent = room; $("#btnStartTalk").disabled = false;
  const url = `${location.origin}${location.pathname}?room=${room}&role=client&lang=${S.theirLang}` + (pin() ? `&pin=${encodeURIComponent(pin())}` : "") + (QS.has("demo") ? "&demo=1" : "");
  try { new QRCode($("#qr"), { text: url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M }); } catch {}
  $("#joinUrlNote").textContent = "내담자 패드 주소: " + url;
}
function releaseClaim(keepCount) {   // 시작하지 않은 채 잡아 둔 방을 놓는다
  if (!keepCount) claiming++;
  const r = S.room; S.room = S.roomId = null; const mine = r && Rooms.get(r); if (!FB || !mine || mine.started) return;   // 내가 차지해 둔 빈 방만 지운다
  Rooms.drop(r); FirestoreSync.purge(Rooms.idOf(mine)).catch(() => {});
}
/* 내담자 패드가 들어갈 방 찾기(코드 입력·QR). 코드와 PIN으로 문서 ID를 계산해 열려 있는 방인지 본다. PIN이 없는 패드는 먼저 PIN을 묻고,
   입력한 PIN은 방을 찾았을 때만 기기에 저장한다(잘못 넣은 PIN이 남아 다음에도 방을 못 찾는 일이 없게).
   돌려주는 값: { id } 들어가도 됨(오프라인 등으로 확인하지 못한 때 포함) / { typed } 없는 방·끝난 방 — PIN이 다르면 문서 ID가 달라져 역시 여기로 온다 / { cancel } PIN 입력을 취소함 */
async function findRoom(code) {
  const typed = !pin(); const p = pin() || await askPin();
  if (!p) return { cancel: true };
  const id = await roomDocId(code, p); let found = false;
  try { const st = await FirestoreSync.peek(id); if (!st || !st.open || st.age > ROOM_BUSY_MS) return { typed }; found = true; } catch (e) { console.warn("room check", e); }
  if (typed && found) localStorage.setItem("interp_pin", p);
  return { id };
}
async function joinByCode() {
  const c = $("#joinCode").value.trim(); if (!/^\d{4}$/.test(c)) return toast("4자리 코드를 입력하세요 · Enter the 4-digit code"); if (!S.joinLang) return toast("언어를 선택하세요 · Select your language");
  let id;
  if (FB) {   // 없는 방·끝난 방이면 기다리게 두지 않고 바로 알려 준다
    const b = $("#btnJoin"); b.disabled = true; const r = await findRoom(c).finally(() => { b.disabled = false; });
    if (r.cancel) return;
    if (!r.id) return toast(r.typed ? "코드와 PIN을 다시 확인해 주세요 · Please check the code and PIN" : "코드를 다시 확인해 주세요 · Please check the code", 3500);
    id = r.id;
  }
  openRoom(c, "client", S.joinLang, "ko", id);
}
/* 주소로 바로 들어오기: 내담자는 QR, 상담사는 새로고침 복원 */
async function enterByUrl(room, role, lang) {
  if (role === "client") {
    let id;
    if (FB) { const r = await findRoom(room); if (!r.id) { history.replaceState(null, "", HOME); if (!r.cancel) toast("상담이 종료되었습니다. 상담사 화면의 QR을 다시 찍어 주세요 · This session has ended", 6000); return false; } id = r.id; }
    openRoom(room, "client", L[lang] && lang !== "ko" ? lang : "en", "ko", id); return true;
  }
  const mine = Rooms.get(room);   // 방금까지(10분 안) 이 패드가 쓰던 방만 바로 복원한다. 그 밖에는 첫 화면에서 '이어서 하기'로 묻는다(오래된 탭이 저절로 마이크를 켜지 않게)
  if (FB && !(mine?.started && Date.now() - mine.last < 10 * 60e3)) { history.replaceState(null, "", HOME); return false; }
  openRoom(room, "counselor", "ko", L[lang] && lang !== "ko" ? lang : "vi", mine && Rooms.idOf(mine)); return true;   // 방을 잡을 때의 주소 그대로(그 뒤 PIN을 고쳤어도 같은 방으로 돌아온다)
}
/* 끝내지 못하고 남은 방: 최근 것은 이어서 할지 묻고, 오래된 것·시작하지 않은 것은 지운다 */
async function checkLeftovers() {
  if (!FB) return; let cand = null;
  for (const r of Rooms.all()) { if (r.started && Date.now() - r.last < ROOM_RESUME_MS && (!cand || r.last > cand.last)) cand = r; }
  for (const r of Rooms.all()) {
    if (r.room === cand?.room) continue;
    if (!r.started && Date.now() - r.last < 5 * 60e3) continue;   // 방금 잡은 빈 방: 같은 기기의 다른 탭이 지금 코드 화면에 있을 수 있다
    dropRoom(r);
  }
  if (!cand) return;
  try { const st = await FirestoreSync.peek(Rooms.idOf(cand)); if (!st || !st.open) return Rooms.drop(cand.room); } catch (e) { return console.warn("resume check", e); }
  const t = new Date(cand.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  $("#resumeDesc").textContent = `방 ${cand.room} · ${L[cand.lang]?.ko || ""} · ${t} 시작`; $("#resumeCard").hidden = false;
  $("#btnResume").onclick = () => openRoom(cand.room, "counselor", "ko", L[cand.lang] ? cand.lang : "vi", Rooms.idOf(cand));
  $("#btnResumeEnd").onclick = () => { $("#resumeCard").hidden = true; dropRoom(cand, true); toast("이전 상담 방을 지웠습니다"); };
}
async function dropRoom(r, force) {   // 내가 떠난 뒤 다른 기기가 다시 쓰기 시작한 방(상담사 신호가 내 마지막 기록보다 새로움)은 건드리지 않는다
  Rooms.drop(r.room); const id = Rooms.idOf(r);
  try { const st = await FirestoreSync.peek(id); if (!st || (!force && st.at > r.last + 120000)) return; await FirestoreSync.purge(id, r.started); } catch (e) { console.warn("leftover room", e); }
}
let glossaryReady = Promise.resolve();
async function boot() {
  $("#modeBadge").hidden = LIVE; $("#startNotice").style.display = LIVE ? "none" : "";
  $("#centerName").textContent = CFG.CENTER_NAME; $("#appVer").textContent = "온말 v" + APP_VERSION;
  $("#btnDemo").hidden = !CFG.WORKER_URL; $("#btnDemo").textContent = QS.has("demo") ? "연습 모드 끝내기" : "연습 모드";
  // 용어집·문장은 뒤에서 불러온다(느린 네트워크에서도 버튼이 바로 눌리게)
  glossaryReady = fetch("glossary.json?v=" + APP_VERSION).then(r => r.json()).then(g => { S.glossary = g; buildGlIndex(); S.order.forEach(render); }).catch(e => console.warn("glossary", e));
  fetch("phrases.json?v=" + APP_VERSION).then(r => r.json()).then(p => { S.phrases = p; }).catch(() => {});
  // 버튼
  $("#btnCounselor").onclick = () => { renderLangGrid(); $("#roomCard").style.display = "none"; show("#s-setup"); };
  $("#btnStartTalk").onclick = () => { if (S.room && S.theirLang) openRoom(S.room, "counselor", "ko", S.theirLang, S.roomId); };
  $("#btnClient").onclick = () => { S.joinLang = null; renderJoinLangs(); show("#s-join"); };
  $("#btnJoin").onclick = joinByCode;
  $("#joinCode").onkeydown = (e) => { if (e.key === "Enter") joinByCode(); };
  $("#btnBackStart").onclick = () => { releaseClaim(); show("#s-start"); };
  $("#btnBackStart2").onclick = () => show("#s-start");
  $("#btnPin").onclick = () => { const c = $("#pinCard"); c.style.display = c.style.display === "none" ? "" : "none"; $("#pinInput").value = pin(); if (c.style.display !== "none") c.scrollIntoView({ behavior: "smooth", block: "center" }); };
  $("#btnPinSave").onclick = () => { localStorage.setItem("interp_pin", $("#pinInput").value.trim()); $("#pinCard").style.display = "none"; toast("PIN 저장됨"); };
  $("#btnDemo").onclick = () => { location.href = location.pathname + (QS.has("demo") ? "" : "?demo=1"); };
  $("#btnMic").onclick = () => (S.micOn || S.reco) ? stopMic() : startMic();
  $("#btnSpeak").onclick = () => { const last = [...S.order].reverse().map(id => S.msgs.get(id)).find(m => m && !m.partial && !m.deleted && m.role !== S.role); if (!last) return toast("읽을 문장이 없습니다 · Nothing to read yet"); speak(last.srcLang === S.myLang ? last.src : (last.tgtRefined || last.tgt), S.myLang); };
  $("#btnPhrases").onclick = () => { renderPhrases(); openSheet("#sheetPhrases"); };
  $("#btnSettings").onclick = () => { renderSettings(); openSheet("#sheetSettings"); };
  $("#btnEnd").onclick = async () => { if (await ask({ title: "상담을 종료할까요?", desc: "양쪽 화면의 대화가 지워집니다. 종료 화면에서 요약을 만들거나 텍스트로 저장할 수 있습니다.", ok: "종료", danger: true })) endRoom(); };
  $("#btnFontUp").onclick = () => setFont(2); $("#btnFontDown").onclick = () => setFont(-2);
  $("#btnKeyboard").onclick = () => { $("#textIn").classList.toggle("on"); if ($("#textIn").classList.contains("on")) $("#textInput").focus(); };
  $("#btnTextSend").onclick = () => { const v = $("#textInput").value; $("#textInput").value = ""; sendTyped(v); };
  $("#textInput").onkeydown = (e) => { if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) $("#btnTextSend").click(); };   // 한글 조합 중 Enter는 무시
  $("#scrim").onclick = $("#btnGlClose").onclick = closeAll;
  $("#list").addEventListener("click", (e) => { const g = e.target.closest(".gl"); if (g) return showGl(g.dataset.ko); const b = e.target.closest(".msg"); if (b && S.role === "counselor") msgActions(b.id.slice(2)); });
  window.addEventListener("beforeunload", (e) => { if (S.role === "counselor" && S.sync && S.msgs.size && !S.ended) { e.preventDefault(); e.returnValue = ""; } });
  window.addEventListener("online", () => { if (S.micWanted && !S.micOn && !S.reco && !S.ended) { clearTimeout(micRetryTimer); micRetryTimer = null; micRetry = 0; startMic(true); } });
  document.addEventListener("visibilitychange", onVisibility);
  if (QS.has("debug")) { window.__onmal = { S, Rooms, roomDocId, micState, startMic, stopMic, pauseMic, resumeMic, onPartial, onFinal, speak, upsert, audio: audioStat }; if (LIVE) audioHud(); }   // 점검용(?debug=1). audio(): 마이크가 켜져 있던 초·Azure로 보낸 초(연습 모드에서는 Azure를 쓰지 않으므로 숫자판을 띄우지 않는다)
  // 주소로 바로 들어오기(QR·새로고침) — 버튼 바인딩 뒤에 처리
  if (QS.get("pin")) { localStorage.setItem("interp_pin", QS.get("pin")); QS.delete("pin"); history.replaceState(null, "", location.pathname + (QS.toString() ? "?" + QS.toString() : "")); }
  const room = QS.get("room"), role = QS.get("role");
  if (room && /^\d{4}$/.test(room) && (role === "client" || role === "counselor") && await enterByUrl(room, role, QS.get("lang"))) return;
  checkLeftovers();
}
document.addEventListener("DOMContentLoaded", boot);
})();
