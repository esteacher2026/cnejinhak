const DATA = window.INTERVIEW_APP_DATA;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const number = new Intl.NumberFormat("ko-KR");

const STORE = {
  theme: "sri_theme",
  inputs: "sri_inputs",
  stars: "sri_stars",
  memos: "sri_memos",
};

function loadJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const state = {
  generated: [],
  selectedQuestion: 0,
  selectedUniversity: null,
  filterDimension: null,
  starOnly: false,
  stars: new Set(loadJSON(STORE.stars, [])),
  memos: loadJSON(STORE.memos, {}),
  regionFilter: 0,
  mockOrder: [],
  mockPos: 0,
  mockStage: "prep",
  mockRemaining: 30,
  mockStageTotal: 30,
  mockTimer: null,
  audioCtx: null,
};

const standardColors = {
  "학업역량": "#2563eb",
  "진로·전공역량": "#0f766e",
  "인성·공동체": "#b45309",
  "의사소통": "#db2777",
  "적성·창의": "#7c3aed",
  "기타": "#64748b",
};

const slotPriority = {
  inquiry: [
    "inquiry_question",
    "question_refinement",
    "hypothesis",
    "variable_control",
    "planning",
    "source_reliability",
    "method",
    "method_choice",
    "evidence",
    "verification",
    "data_interpretation",
    "unexpected",
    "limitation",
    "follow_up_inquiry",
  ],
  creative: ["unexpected", "limitation", "alternative", "comparison", "ethical_issue", "condition_change"],
  collaboration: ["collaboration_role", "conflict", "responsibility", "social_impact", "community_value"],
};

const trackBoost = {
  "인문": ["communication", "creative", "reflection"],
  "자연": ["inquiry", "academic", "creative"],
  "의약": ["collaboration", "communication", "reflection"],
  "예체능": ["self", "major", "reflection"],
};

const trackNotes = {
  "인문": "인문·사회 계열에 맞춰 의사소통·비판적 사고·성찰 문항을 앞쪽에 배치합니다.",
  "자연": "자연·공학 계열에 맞춰 탐구·학업역량 문항을 앞쪽에 배치합니다.",
  "의약": "의약·보건 계열에 맞춰 인성·협력·소통 문항을 앞쪽에 배치합니다.",
  "예체능": "예술·체육 계열에 맞춰 자기주도성·전공 관심 문항을 앞쪽에 배치합니다.",
};

const exampleActivities = [
  { activity: "바이오 플라스틱 제작 및 생분해성 비교 실험", major: "환경공학·생명과학 계열" },
  { activity: "기후변화에 따른 지역 이상기온 공공데이터 분석 탐구", major: "대기과학·환경 계열" },
  { activity: "청소년 문해력 저하 원인 조사 및 개선 방안 보고서", major: "국어교육·인문 계열" },
  { activity: "지역 아동센터 학습 멘토링 봉사활동", major: "교육학·사회복지 계열" },
  { activity: "교내 급식 잔반 감소 캠페인 공동 프로젝트", major: "경영·사회과학 계열" },
  { activity: "머신러닝을 활용한 지역 교통량 예측 모델 제작 프로젝트", major: "컴퓨터공학·AI 계열" },
];

const regionGroups = [
  ["전체", null],
  ["서울", ["서울"]],
  ["경기·인천", ["경기", "인천"]],
  ["충청", ["대전", "세종", "충남", "충북"]],
  ["강원", ["강원"]],
  ["영남", ["부산", "대구", "울산", "경북", "경남"]],
  ["호남·제주", ["광주", "전남", "전북", "제주"]],
];

const activitySuffixes = [
  "탐구",
  "실험",
  "분석",
  "보고서",
  "보고서 작성",
  "프로젝트",
  "연구",
  "공동 연구",
  "발표",
  "토론",
  "제작",
  "활동",
  "봉사활동",
  "멘토링",
  "개선",
];

const activityProfiles = [
  {
    id: "experiment",
    label: "실험·제작형",
    clues: ["실험", "비교", "측정", "제작", "시료", "변인", "생분해", "반응", "배양", "관찰"],
    priority: ["variable_control", "hypothesis", "method_choice", "verification", "data_interpretation", "limitation", "follow_up_inquiry"],
    guidance: "실험·제작형 활동으로 읽었습니다. 변인 설정, 측정 기준, 반복 가능성, 한계 인식을 중심으로 문항을 구성합니다.",
    questions: {
      inquiry_question: "{activity}에서 가장 먼저 확인하고 싶었던 현상이나 관계는 무엇이었고, 이를 어떤 탐구 질문으로 바꾸었나요?",
      hypothesis: "{activity}를 시작할 때 세운 예상 결과는 무엇이었고, 그 예상은 어떤 교과 개념이나 선행 자료에 근거했나요?",
      variable_control: "{activity}에서 독립변인, 종속변인, 통제변인을 각각 무엇으로 보았나요?",
      planning: "{activity}를 진행하기 위해 시료, 조건, 절차, 측정 기준을 어떻게 설계했나요?",
      method: "{activity}에서 사용한 실험 또는 제작 방법이 탐구 질문을 확인하는 데 적절하다고 본 이유는 무엇인가요?",
      method_choice: "비교 실험이나 제작 방식을 선택할 때 다른 방법과 비교해 어떤 장점과 한계를 고려했나요?",
      evidence: "{activity}의 결론을 뒷받침한 관찰값, 비교 결과, 변화 양상 중 가장 중요한 근거는 무엇인가요?",
      verification: "{activity} 결과의 타당성을 높이기 위해 반복 실험, 대조 조건, 오차 점검 중 무엇이 더 필요하다고 보았나요?",
      data_interpretation: "실험 결과를 해석할 때 단순한 차이와 의미 있는 차이를 어떻게 구분했나요?",
      limitation: "{activity}에서 재료, 조건 통제, 측정 도구 중 가장 큰 한계는 무엇이었고 결론에 어떤 영향을 주었나요?",
      follow_up_inquiry: "{activity}를 후속 실험으로 발전시킨다면 어떤 조건을 새로 바꾸어 검증하겠습니까?",
    },
    tails: {
      variable_control: ["통제하지 못한 변인이 있다면 결과 해석에 어떤 영향을 주었나요?", "그 변인을 다시 통제한다면 절차를 어떻게 바꾸겠습니까?"],
      method_choice: ["선택하지 않은 방법이 더 적절할 수 있는 조건은 무엇인가요?", "측정 기준을 더 정교하게 만들 방법은 무엇인가요?"],
      limitation: ["한계를 인정해도 이 활동에서 얻은 의미 있는 결론은 무엇인가요?", "대학 수준의 장비나 지식이 있다면 어떤 부분을 먼저 보완하겠습니까?"],
    },
  },
  {
    id: "data",
    label: "자료분석형",
    clues: ["자료", "데이터", "공공데이터", "통계", "분석", "시각화", "상관", "변화", "추이", "지역"],
    priority: ["source_reliability", "method_choice", "data_interpretation", "evidence", "verification", "limitation", "follow_up_inquiry"],
    guidance: "자료분석형 활동으로 읽었습니다. 자료 출처, 변수 선택, 해석의 타당성, 상관과 인과 구분을 중심으로 문항을 구성합니다.",
    questions: {
      inquiry_question: "{activity}에서 분석을 통해 확인하고 싶었던 핵심 질문은 무엇이었나요?",
      source_reliability: "{activity}에서 사용한 자료의 출처와 신뢰도를 어떻게 확인했나요?",
      method: "{activity}에서 자료를 정리하거나 시각화할 때 어떤 기준으로 변수를 선택했나요?",
      method_choice: "여러 분석 방법 중 그 방법을 선택한 이유는 무엇이며, 다른 방법을 쓰면 해석이 어떻게 달라질 수 있나요?",
      evidence: "{activity}에서 결론을 뒷받침한 수치, 변화 추이, 비교 결과는 무엇인가요?",
      verification: "자료 분석 결과가 우연이나 편향이 아닌지 확인하기 위해 어떤 추가 검증이 필요하다고 보았나요?",
      data_interpretation: "{activity}의 자료를 해석할 때 상관관계와 인과관계를 어떻게 구분했나요?",
      limitation: "{activity}에서 자료의 기간, 표본, 누락값, 지역 차이 중 가장 조심해야 할 한계는 무엇이었나요?",
      follow_up_inquiry: "같은 주제를 더 깊게 분석한다면 어떤 새 자료나 변수를 추가하고 싶나요?",
    },
    tails: {
      source_reliability: ["자료 출처가 다르면 결론이 달라질 가능성이 있나요?", "가장 신뢰한 자료와 덜 신뢰한 자료를 구분한 기준은 무엇인가요?"],
      data_interpretation: ["그래프만 보고 과장해서 해석할 위험은 무엇인가요?", "반례가 될 수 있는 지역이나 기간이 있다면 무엇을 확인하겠습니까?"],
      limitation: ["자료의 한계를 보완하기 위해 어떤 추가 자료가 필요할까요?", "결론을 어느 정도 범위까지만 말하는 것이 타당할까요?"],
    },
  },
  {
    id: "report",
    label: "조사·보고서형",
    clues: ["보고서", "조사", "탐구", "논문", "기사", "독서", "문헌", "정책", "요인", "사례"],
    priority: ["question_refinement", "source_reliability", "evidence", "alternative", "limitation", "follow_up_inquiry"],
    guidance: "조사·보고서형 활동으로 읽었습니다. 질문 구체화, 자료 선별, 근거의 질, 반대 관점 검토를 중심으로 문항을 구성합니다.",
    questions: {
      question_refinement: "{activity}에서 넓은 관심사를 면접에서 설명 가능한 탐구 질문으로 좁힌 기준은 무엇인가요?",
      source_reliability: "{activity}에서 자료를 찾을 때 신뢰할 수 있는 자료와 참고만 한 자료를 어떻게 구분했나요?",
      method: "{activity}에서 조사 범위와 비교 기준을 어떻게 정했나요?",
      evidence: "{activity}의 핵심 주장 하나를 고르고, 그 주장을 뒷받침한 가장 설득력 있는 근거를 설명해 주세요.",
      alternative: "{activity}에서 본인의 결론과 다른 해석이나 반대 의견은 무엇이었고 어떻게 검토했나요?",
      limitation: "{activity}가 조사나 보고서 수준에서 갖는 한계는 무엇이며, 그 한계를 어떻게 표시했나요?",
      follow_up_inquiry: "{activity}를 후속 보고서로 발전시킨다면 새로 세울 질문은 무엇인가요?",
    },
    tails: {
      evidence: ["그 근거가 충분하지 않다고 보는 사람에게 어떻게 답하겠습니까?", "근거의 양보다 질이 중요했던 지점은 무엇인가요?"],
      alternative: ["반대 관점에서 타당하다고 인정할 부분은 무엇인가요?", "그 관점을 받아들인다면 결론을 어떻게 수정해야 하나요?"],
    },
  },
  {
    id: "service",
    label: "봉사·개선형",
    clues: ["봉사", "멘토링", "아동센터", "지역", "개선", "문제", "캠페인", "나눔", "도움", "학습"],
    priority: ["community_value", "collaboration_role", "communication_audience", "listening", "reflection_change", "follow_up_inquiry"],
    guidance: "봉사·개선형 활동으로 읽었습니다. 대상 이해, 문제 발견, 소통 방식, 개선 근거, 공동체적 의미를 중심으로 문항을 구성합니다.",
    questions: {
      inquiry_question: "{activity}에서 단순 참여를 넘어 스스로 발견한 문제나 개선 질문은 무엇이었나요?",
      method: "{activity}에서 대상자의 필요를 파악하기 위해 어떤 관찰이나 소통 방식을 사용했나요?",
      evidence: "{activity}에서 방식이 개선되었다고 판단한 근거는 무엇인가요?",
      communication_audience: "{activity}에서 상대가 이해하거나 받아들이기 쉽게 표현을 바꾼 경험이 있나요?",
      listening: "{activity} 중 타인의 반응이나 의견을 듣고 자신의 방식을 수정한 사례를 말해 주세요.",
      community_value: "{activity}가 개인적 보람을 넘어 학교나 지역사회에 어떤 의미를 가질 수 있다고 보았나요?",
      reflection_change: "{activity} 이후 사람을 이해하거나 돕는 방식에서 달라진 점은 무엇인가요?",
      follow_up_inquiry: "{activity}를 지속한다면 다음에는 어떤 기준으로 효과를 확인하고 싶나요?",
    },
    tails: {
      communication_audience: ["상대가 예상과 다르게 반응했을 때 어떻게 조정했나요?", "도움을 주는 입장에서 조심해야 할 태도는 무엇인가요?"],
      community_value: ["실제 변화와 본인의 느낌을 어떻게 구분했나요?", "지속 가능한 활동이 되려면 무엇이 필요할까요?"],
    },
  },
  {
    id: "collab",
    label: "공동연구·동아리형",
    clues: ["동아리", "공동", "팀", "협력", "역할", "조정", "연구", "프로젝트", "발표", "토론"],
    priority: ["collaboration_role", "conflict", "responsibility", "presentation", "reflection_change", "follow_up_inquiry"],
    guidance: "공동연구·동아리형 활동으로 읽었습니다. 역할 분담, 갈등 조정, 공동 산출물, 자신의 기여도를 중심으로 문항을 구성합니다.",
    questions: {
      collaboration_role: "{activity}에서 본인이 맡은 역할은 무엇이었고, 공동 결과물에 어떤 구체적 기여를 했나요?",
      conflict: "{activity} 과정에서 의견 차이가 있었다면 어떤 기준으로 조율했나요?",
      responsibility: "{activity}에서 맡은 책임을 끝까지 수행하기 위해 스스로 관리한 부분은 무엇인가요?",
      presentation: "{activity}의 결과를 팀 밖의 사람에게 설명할 때 핵심 메시지를 어떻게 정리했나요?",
      evidence: "{activity}에서 본인의 주장이나 팀의 결론을 뒷받침한 근거는 무엇이었나요?",
      limitation: "공동으로 진행한 {activity}에서 역할 분담이나 협업 방식의 한계는 무엇이었나요?",
      follow_up_inquiry: "{activity}를 다시 팀으로 진행한다면 역할, 일정, 검증 방식 중 무엇을 바꾸겠습니까?",
    },
    tails: {
      collaboration_role: ["본인이 빠졌다면 결과가 어떻게 달라졌을까요?", "역할 분담이 공정했는지 어떻게 판단했나요?"],
      conflict: ["상대 의견에서 받아들인 부분은 무엇이었나요?", "갈등 이후 팀의 방식이 어떻게 달라졌나요?"],
    },
  },
];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value, length = 70) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function qkey(text) {
  let hash = 5381;
  const value = String(text ?? "");
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return `q${hash.toString(36)}`;
}

function hasFinalConsonant(value) {
  const chars = String(value ?? "").trim();
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const code = chars.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
    if (/[A-Za-z0-9]/.test(chars[i])) return true;
  }
  return false;
}

function endsWithFinalRieul(value) {
  const chars = String(value ?? "").trim();
  const code = chars.charCodeAt(chars.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8;
}

function particle(value, pair) {
  const final = hasFinalConsonant(value);
  const map = {
    "을/를": final ? "을" : "를",
    "이/가": final ? "이" : "가",
    "은/는": final ? "은" : "는",
    "과/와": final ? "과" : "와",
    "으로/로": final && !endsWithFinalRieul(value) ? "으로" : "로",
  };
  return map[pair] || "";
}

function fixActivityParticles(text, activity) {
  const escaped = escapeRegExp(activity);
  return text
    .replace(new RegExp(`${escaped}(을|를)`, "g"), `${activity}${particle(activity, "을/를")}`)
    .replace(new RegExp(`${escaped}(이|가)`, "g"), `${activity}${particle(activity, "이/가")}`)
    .replace(new RegExp(`${escaped}(은|는)`, "g"), `${activity}${particle(activity, "은/는")}`)
    .replace(new RegExp(`${escaped}(과|와)`, "g"), `${activity}${particle(activity, "과/와")}`)
    .replace(new RegExp(`${escaped}(으로|로)`, "g"), `${activity}${particle(activity, "으로/로")}`);
}

function dim(id) {
  return DATA.dimensions.find((item) => item.id === id) || DATA.dimensions[0];
}

function toast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove("show"), 1600);
}

function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const btn = $("#themeBtn");
  if (btn) {
    btn.textContent = dark ? "☀️" : "🌙";
    btn.title = dark ? "밝은 화면으로 전환" : "어두운 화면으로 전환";
  }
}

function initTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  applyTheme(dark);
  $("#themeBtn").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme !== "dark";
    applyTheme(next);
    try {
      localStorage.setItem(STORE.theme, next ? "dark" : "light");
    } catch {}
  });
}

function fillControls() {
  $("#focusSelect").innerHTML = `<option value="">균형 구성</option>${DATA.dimensions
    .filter((item) => item.id !== "basic")
    .map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`)
    .join("")}`;
}

function renderExampleChips() {
  $("#exampleChips").innerHTML = exampleActivities
    .map((item, index) => `<button class="chip-btn" type="button" data-example="${index}">${esc(item.activity)}</button>`)
    .join("");
  $("#exampleChips").onclick = (event) => {
    const btn = event.target.closest("[data-example]");
    if (!btn) return;
    const example = exampleActivities[Number(btn.dataset.example)];
    if (!example) return;
    $("#keywordInput").value = example.activity;
    $("#majorInput").value = example.major;
    generate();
    toast("예시 활동으로 문항을 생성했습니다.");
  };
}

function fillHeroStats() {
  $("#statDims").textContent = DATA.dimensions.length;
  $("#statUnis").textContent = DATA.jinhak.universities.length;
  $("#statQuestions").textContent = $("#countSelect").value;
}

function saveInputs() {
  saveJSON(STORE.inputs, {
    activity: $("#keywordInput").value,
    major: $("#majorInput").value,
    track: $("#trackSelect").value,
    focus: $("#focusSelect").value,
    count: $("#countSelect").value,
    generic: $("#genericToggle").checked,
    hard: $("#hardToggle").checked,
    prep: $("#prepSeconds").value,
    answer: $("#answerSeconds").value,
    shuffle: $("#mockShuffle").checked,
    starOnly: $("#mockStarOnly").checked,
    sound: $("#mockSound").checked,
    tts: $("#mockTts").checked,
  });
}

function restoreInputs() {
  const saved = loadJSON(STORE.inputs, null);
  if (!saved) return;
  if (saved.activity) $("#keywordInput").value = saved.activity;
  if (saved.major) $("#majorInput").value = saved.major;
  if (saved.track != null) $("#trackSelect").value = saved.track;
  if (saved.focus != null) $("#focusSelect").value = saved.focus;
  if (saved.count) $("#countSelect").value = saved.count;
  if (typeof saved.generic === "boolean") $("#genericToggle").checked = saved.generic;
  if (typeof saved.hard === "boolean") $("#hardToggle").checked = saved.hard;
  if (saved.prep) $("#prepSeconds").value = saved.prep;
  if (saved.answer) $("#answerSeconds").value = saved.answer;
  if (typeof saved.shuffle === "boolean") $("#mockShuffle").checked = saved.shuffle;
  if (typeof saved.starOnly === "boolean") $("#mockStarOnly").checked = saved.starOnly;
  if (typeof saved.sound === "boolean") $("#mockSound").checked = saved.sound;
  if (typeof saved.tts === "boolean") $("#mockTts").checked = saved.tts;
}

function switchMode(mode) {
  $$(".mode-tab").forEach((tab) => tab.classList.toggle("on", tab.dataset.mode === mode));
  $$(".mode-panel").forEach((panel) => panel.classList.toggle("on", panel.id === `mode-${mode}`));
  if (mode === "mock") updateMockDisplay();
  else stopSpeech();
}

function hasActivitySuffix(activity) {
  return activitySuffixes.some((suffix) => activity.includes(suffix));
}

function detectActivityProfile(activity) {
  const text = normalize(activity);
  let best = null;
  let bestScore = -1;

  for (const profile of activityProfiles) {
    let score = 0;
    for (const clue of profile.clues) {
      if (text.includes(normalize(clue))) score += clue.length >= 4 ? 3 : 2;
    }
    if (score > bestScore) {
      best = profile;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : activityProfiles[2];
}

function renderActivityFeedback(activity, profile) {
  const hasSuffix = hasActivitySuffix(activity);
  const feedback = $("#activityFeedback");
  if (!feedback) return;
  const trackNote = trackNotes[$("#trackSelect").value] || "";
  feedback.classList.toggle("warn", !hasSuffix);
  feedback.textContent = hasSuffix
    ? `${profile.guidance} 현재 활동명은 학생부식 활동명으로 충분히 읽힙니다. ${trackNote}`.trim()
    : `${profile.guidance} 다만 활동명 끝을 '탐구', '실험', '분석 보고서', '프로젝트', '활동'처럼 마무리하면 질문이 더 자연스럽게 맞춰집니다. ${trackNote}`.trim();
}

function sortTemplatesForProfile(list, profile, fallbackPriority = []) {
  const priority = profile?.priority || [];
  list.sort((a, b) => {
    const ai = priority.includes(a.slot) ? priority.indexOf(a.slot) : 999;
    const bi = priority.includes(b.slot) ? priority.indexOf(b.slot) : 999;
    if (ai !== bi) return ai - bi;
    const fai = fallbackPriority.includes(a.slot) ? fallbackPriority.indexOf(a.slot) : 999;
    const fbi = fallbackPriority.includes(b.slot) ? fallbackPriority.indexOf(b.slot) : 999;
    return fai - fbi;
  });
}

function selectTemplates(focus, includeBasic, count = 30, profile = null, track = "") {
  const groups = new Map();
  for (const template of DATA.templates) {
    if (template.dimension === "basic" && !includeBasic) continue;
    if (!groups.has(template.dimension)) groups.set(template.dimension, []);
    groups.get(template.dimension).push(template);
  }

  for (const [dimension, priority] of Object.entries(slotPriority)) {
    const list = groups.get(dimension);
    if (!list) continue;
    sortTemplatesForProfile(list, profile, priority);
  }

  const orderByProfile = {
    experiment: ["inquiry", "academic", "inquiry", "creative", "inquiry", "major", "reflection", "self", "collaboration", "communication"],
    data: ["inquiry", "academic", "inquiry", "creative", "major", "inquiry", "reflection", "communication", "self", "collaboration"],
    report: ["inquiry", "academic", "creative", "inquiry", "major", "reflection", "communication", "self", "collaboration"],
    service: ["inquiry", "collaboration", "communication", "reflection", "self", "inquiry", "major", "creative", "academic"],
    collab: ["collaboration", "inquiry", "communication", "reflection", "self", "major", "creative", "academic"],
  };
  const baseOrder = orderByProfile[profile?.id] || [
    "inquiry",
    "academic",
    "inquiry",
    "creative",
    "inquiry",
    "major",
    "inquiry",
    "reflection",
    "self",
    "collaboration",
    "communication",
  ];
  let dimensionOrder = focus ? [focus, ...baseOrder.filter((dimension) => dimension !== focus)] : [...baseOrder];
  const boost = trackBoost[track];
  if (boost) {
    const boosted = boost.filter((dimension) => groups.has(dimension) && dimension !== focus);
    dimensionOrder = focus ? [focus, ...boosted, ...dimensionOrder.slice(1)] : [...boosted, ...dimensionOrder];
  }
  if (includeBasic) dimensionOrder.splice(Math.min(4, dimensionOrder.length), 0, "basic");

  const picked = [];
  const cursor = Object.fromEntries([...groups.keys()].map((dimension) => [dimension, 0]));
  while (picked.length < count) {
    const before = picked.length;
    for (const dimension of dimensionOrder) {
      const list = groups.get(dimension) || [];
      const index = cursor[dimension] || 0;
      if (index >= list.length) continue;
      picked.push(list[index]);
      cursor[dimension] = index + 1;
      if (picked.length >= count) break;
    }
    if (picked.length === before) break;
  }
  return picked;
}

function replaceTokens(text, activity, major) {
  const replaced = text
    .replaceAll("{activity}", activity)
    .replaceAll("{keyword}", activity)
    .replaceAll("{major}", major || "지원 전공");
  return fixActivityParticles(replaced, activity);
}

function uniqueList(items) {
  return [...new Set(items.filter(Boolean))];
}

function profileQuestionText(template, profile) {
  return profile?.questions?.[template.slot] || template.text;
}

function profileTails(template, profile, hard) {
  const profileItems = profile?.tails?.[template.slot] || [];
  const baseItems = hard ? template.tails : template.tails.slice(0, 1);
  return uniqueList([...profileItems, ...baseItems]).slice(0, hard ? 3 : 1);
}

function profileIntent(template, profile) {
  const additions = {
    experiment: "실험 설계와 검증 가능성을 활동 기록 안에서 구체적으로 설명할 수 있는지 확인합니다.",
    data: "자료 선택, 분석 기준, 해석의 타당성을 구체적으로 설명할 수 있는지 확인합니다.",
    report: "조사 질문, 근거의 질, 반대 관점 검토가 드러나는지 확인합니다.",
    service: "대상 이해, 소통 방식, 개선 근거와 공동체적 의미를 확인합니다.",
    collab: "공동 활동 속 실제 역할, 조율 과정, 본인의 기여도를 확인합니다.",
  };
  if (profile?.questions?.[template.slot] && additions[profile.id]) return additions[profile.id];
  return template.intent;
}

function generate() {
  const activity = compact($("#keywordInput").value || "학생부 활동", 100);
  const major = compact($("#majorInput").value || "지원 전공", 80);
  const focus = $("#focusSelect").value;
  const track = $("#trackSelect").value;
  const count = Number($("#countSelect").value) || 30;
  const includeBasic = $("#genericToggle").checked;
  const hard = $("#hardToggle").checked;
  const profile = detectActivityProfile(activity);
  const templates = selectTemplates(focus, includeBasic, count, profile, track);
  renderActivityFeedback(activity, profile);

  state.generated = templates.map((template, index) => {
    const d = dim(template.dimension);
    const questionText = profileQuestionText(template, profile);
    const tails = profileTails(template, profile, hard);
    return {
      id: `g${index + 1}`,
      number: index + 1,
      question: replaceTokens(questionText, activity, major),
      dimension: template.dimension,
      title: template.title,
      intent: profileIntent(template, profile),
      tails: tails.map((tail) => replaceTokens(tail, activity, major)),
      difficulty: Math.min(5, 2 + (index % 4) + (["creative", "inquiry"].includes(template.dimension) ? 1 : 0)),
      color: d.color,
      profileLabel: profile.label,
    };
  });

  state.selectedQuestion = 0;
  state.mockOrder = [];
  state.mockPos = 0;
  $("#resultTitle").textContent = `${activity} 면접 예상문항`;
  $("#statQuestions").textContent = state.generated.length;
  saveInputs();
  renderAll();
  updateMockDisplay();
}

function renderAll() {
  renderIntentStrip();
  renderQuestions();
  renderAnswer();
  renderCategoryChart();
}

function questionVisible(item) {
  if (state.filterDimension && item.dimension !== state.filterDimension) return false;
  if (state.starOnly && !state.stars.has(qkey(item.question))) return false;
  return true;
}

function renderIntentStrip() {
  const counts = new Map();
  for (const item of state.generated) counts.set(item.dimension, (counts.get(item.dimension) || 0) + 1);
  $("#intentStrip").innerHTML = [...counts.entries()].map(([id, count]) => {
    const d = dim(id);
    const active = state.filterDimension === id;
    return `<button type="button" class="intent-item ${active ? "active" : ""}" data-dim="${esc(id)}" style="border-left-color:${esc(d.color)}" title="클릭하면 이 평가요소 문항만 표시합니다">
      <span>${esc(d.short)}${active ? " · 필터 중" : ""}</span>
      <b>${esc(d.name)} ${count}문항</b>
    </button>`;
  }).join("");

  $("#intentStrip").onclick = (event) => {
    const btn = event.target.closest(".intent-item");
    if (!btn) return;
    state.filterDimension = state.filterDimension === btn.dataset.dim ? null : btn.dataset.dim;
    renderIntentStrip();
    renderQuestions();
  };
}

function renderFilterNote(visibleCount) {
  const note = $("#filterNote");
  const active = Boolean(state.filterDimension || state.starOnly);
  note.hidden = !active;
  if (!active) return;
  const labels = [];
  if (state.filterDimension) labels.push(`${dim(state.filterDimension).name} 문항`);
  if (state.starOnly) labels.push("★ 중요 문항");
  note.innerHTML = `${esc(labels.join(" · "))}만 표시 중 (${visibleCount}문항) <button type="button" id="clearFilterBtn">필터 해제</button>`;
  $("#clearFilterBtn").onclick = () => {
    state.filterDimension = null;
    state.starOnly = false;
    $("#starFilterBtn").classList.remove("on");
    renderIntentStrip();
    renderQuestions();
  };
}

function renderQuestions() {
  const visible = state.generated.filter(questionVisible);
  renderFilterNote(visible.length);

  if (!visible.length) {
    $("#questionList").innerHTML = `<div class="empty">${state.starOnly ? "★ 표시한 문항이 없습니다. 문항 카드의 별을 눌러 중요 문항을 표시해 보세요." : "표시할 문항이 없습니다."}</div>`;
    return;
  }

  $("#questionList").innerHTML = visible.map((item, order) => {
    const index = state.generated.indexOf(item);
    const d = dim(item.dimension);
    const starred = state.stars.has(qkey(item.question));
    return `<article class="question-card ${index === state.selectedQuestion ? "selected" : ""}" style="border-left-color:${esc(d.color)};animation-delay:${Math.min(order * 25, 400)}ms" data-index="${index}">
      <div class="question-main">
        <div class="qno">Q${item.number}</div>
        <div>
          <p class="qtext">${esc(item.question)}</p>
          <div class="qmeta">
            <span class="badge" style="border-color:${esc(d.color)};color:${esc(d.color)}">${esc(d.name)}</span>
            <span class="badge">난도 ${"●".repeat(item.difficulty)}${"○".repeat(5 - item.difficulty)}</span>
            <span class="badge">${esc(item.profileLabel)}</span>
            <span class="badge">${esc(item.title)}</span>
          </div>
        </div>
        <button class="star-btn ${starred ? "on" : ""}" type="button" data-star="${index}" title="중요 문항 표시" aria-label="중요 문항 표시" aria-pressed="${starred}">${starred ? "★" : "☆"}</button>
      </div>
      <div class="tail-box">
        <p>꼬리질문</p>
        <ul>${item.tails.map((tail) => `<li>${esc(tail)}</li>`).join("")}</ul>
      </div>
    </article>`;
  }).join("");

  $("#questionList").onclick = (event) => {
    const starBtn = event.target.closest(".star-btn");
    if (starBtn) {
      toggleStar(Number(starBtn.dataset.star));
      return;
    }
    const card = event.target.closest(".question-card");
    if (!card) return;
    state.selectedQuestion = Number(card.dataset.index);
    renderQuestions();
    renderAnswer();
  };
}

function toggleStar(index) {
  const item = state.generated[index];
  if (!item) return;
  const key = qkey(item.question);
  if (state.stars.has(key)) state.stars.delete(key);
  else state.stars.add(key);
  saveJSON(STORE.stars, [...state.stars]);
  renderQuestions();
}

function frameHint(step, question) {
  const activity = compact($("#keywordInput").value || "해당 활동", 56);
  const hints = {
    "활동 기록 근거": `${activity}가 학생부 어느 영역에 기록되어 있는지 먼저 짚습니다.`,
    "핵심 개념": "활동을 설명할 수 있는 교과 개념이나 원리를 한 문장으로 잡습니다.",
    "수업 연결": "관련 교과 단원, 수업 활동, 세특 기록과 어떻게 이어지는지 설명합니다.",
    "적용 사례": "개념을 실제 활동이나 다른 사례에 적용해 본 지점을 말합니다.",
    "탐구 과정": "자료 수집, 실험, 토론, 발표 등 실제 과정을 순서대로 말합니다.",
    "탐구 질문": "처음 가졌던 호기심을 검증 가능한 질문 형태로 정리합니다.",
    "방법 선택": "왜 그 조사, 실험, 분석, 비교 방법을 택했는지 이유를 말합니다.",
    "자료와 근거": "사용한 자료의 출처, 신뢰도, 결론을 뒷받침하는 핵심 근거를 제시합니다.",
    "해석과 한계": "결과를 그대로 주장하지 말고 한계와 반대 가능성을 함께 둡니다.",
    "후속 학습": "이 경험이 다음 수업, 독서, 전공 관심으로 이어진 지점을 연결합니다.",
    "후속 탐구": "이번 활동 이후 새롭게 생긴 질문과 다음 검증 방법을 제시합니다.",
    "처음 관심": "처음 관심이 생긴 계기를 개인 경험보다 학습 맥락과 함께 말합니다.",
    "심화 활동": "한 번의 활동이 아니라 이어진 탐색, 독서, 발표, 실험을 묶습니다.",
    "전공과의 연결": "지원 분야에서 왜 이 경험이 의미 있는지 구체 과목이나 주제와 연결합니다.",
    "나만의 문제의식": "남들도 할 수 있는 말보다 본인이 갖게 된 질문을 제시합니다.",
    "문제 발견": "활동 중 스스로 발견한 불편함, 의문, 개선점을 말합니다.",
    "계획": "자료, 일정, 역할, 방법을 어떻게 정했는지 설명합니다.",
    "실행": "본인이 직접 한 행동을 동사 중심으로 말합니다.",
    "수정": "막힌 지점에서 기준을 바꾸거나 방법을 조정한 경험을 말합니다.",
    "성장": "성실했다는 표현보다 이후 행동이 어떻게 달라졌는지 말합니다.",
    "기존 접근": "처음 사용한 방식이나 일반적인 관점을 요약합니다.",
    "문제점": "그 방식이 가진 약점, 조건, 오류 가능성을 제시합니다.",
    "대안": "현실적으로 가능한 보완책을 하나 제안합니다.",
    "근거": "대안을 고른 이유를 자료, 경험, 개념으로 뒷받침합니다.",
    "적용 가능성": "다른 상황에 적용할 때 필요한 조건을 덧붙입니다.",
    "상황": "팀 활동의 목표와 당시 어려움을 간단히 설명합니다.",
    "나의 역할": "맡은 역할과 실제 기여를 구체 행동으로 말합니다.",
    "타인과 조율": "다른 의견을 듣고 어떻게 조정했는지 말합니다.",
    "결과": "산출물, 발표, 변화 등 공동 과제의 마무리를 말합니다.",
    "배운 태도": "협력에서 배운 태도를 다음 활동에 어떻게 적용했는지 연결합니다.",
    "전달 대상": "누구에게 설명하거나 설득했는지 분명히 합니다.",
    "핵심 메시지": "상대가 꼭 이해해야 하는 한 문장을 먼저 둡니다.",
    "상대 반응": "질문, 반박, 피드백을 어떻게 받아들였는지 말합니다.",
    "조정한 표현": "상대 수준에 맞춰 바꾼 예시나 비유를 말합니다.",
    "이전 생각": "활동 전의 생각이나 편견을 솔직하게 제시합니다.",
    "경험": "생각을 바꾼 구체 장면을 말합니다.",
    "깨달음": "단순 감상이 아니라 판단 기준의 변화를 말합니다.",
    "변화": "수업 태도, 탐구 방식, 진로 관점의 변화를 말합니다.",
    "앞으로의 적용": "입학 후 학습 계획이나 후속 질문으로 마무리합니다.",
  };
  return hints[step] || `${question.slice(0, 22)}…에 맞춰 학생부 근거를 붙입니다.`;
}

function renderAnswer() {
  const item = state.generated[state.selectedQuestion];
  if (!item) return;
  const d = dim(item.dimension);
  const label = $("#selectedQuestionLabel");
  label.textContent = `Q${item.number}`;
  label.style.background = d.color;
  $("#selectedQuestionText").textContent = item.question;
  $("#answerFrame").innerHTML = d.answerFrame.map((step) => `<div class="frame-step" style="border-top-color:${esc(d.color)}">
    <b>${esc(step)}</b>
    <span>${esc(frameHint(step, item.question))}</span>
  </div>`).join("");
  $("#answerMemo").value = state.memos[qkey(item.question)] || "";
}

function saveMemo(question, text) {
  const key = qkey(question);
  const value = String(text ?? "").trim();
  if (value) state.memos[key] = String(text);
  else delete state.memos[key];
  saveJSON(STORE.memos, state.memos);
}

function renderCategoryChart() {
  const counts = new Map();
  for (const item of state.generated) counts.set(item.dimension, (counts.get(item.dimension) || 0) + 1);
  const max = Math.max(1, ...counts.values());
  $("#categoryChart").innerHTML = [...counts.entries()].map(([id, count]) => {
    const d = dim(id);
    return `<div class="bar-row">
      <span>${esc(d.name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%;background:${esc(d.color)}"></div></div>
      <b>${count}</b>
    </div>`;
  }).join("");
}

function renderRegionChips() {
  $("#regionChips").innerHTML = regionGroups
    .map(([label], index) => `<button class="region-chip ${state.regionFilter === index ? "on" : ""}" type="button" data-region="${index}">${esc(label)}</button>`)
    .join("");
  $("#regionChips").onclick = (event) => {
    const btn = event.target.closest(".region-chip");
    if (!btn) return;
    state.regionFilter = Number(btn.dataset.region);
    renderRegionChips();
    renderUniversities();
  };
}

function renderUniversities() {
  const query = normalize($("#universitySearch").value);
  const regions = regionGroups[state.regionFilter || 0][1];
  const rows = DATA.jinhak.universities
    .filter((uni) => !regions || regions.includes(uni.region))
    .filter((uni) => !query || universitySearchText(uni).includes(query))
    .sort((a, b) => (b.recruitment || 0) - (a.recruitment || 0))
    .slice(0, 80);

  if (!state.selectedUniversity || !rows.some((uni) => uni.code === state.selectedUniversity)) {
    state.selectedUniversity = rows[0]?.code || null;
  }

  $("#universityList").innerHTML = rows.length
    ? rows.map((uni) => `<button class="uni-btn ${uni.code === state.selectedUniversity ? "on" : ""}" type="button" data-code="${esc(uni.code)}">
        <b>${esc(uni.name)}</b>
        <span>${esc(uni.region)} · ${esc(uni.status)} · ${number.format(uni.recruitment || 0)}명</span>
      </button>`).join("")
    : `<div class="empty">조건에 맞는 대학이 없습니다.</div>`;

  $("#universityList").onclick = (event) => {
    const btn = event.target.closest(".uni-btn");
    if (!btn) return;
    state.selectedUniversity = btn.dataset.code;
    renderUniversities();
  };

  renderUniversityDetail();
}

function renderUniversityDetail() {
  const uni = DATA.jinhak.universities.find((item) => item.code === state.selectedUniversity);
  if (!uni) {
    $("#universityDetail").innerHTML = `<div class="empty">대학을 선택해 주세요.</div>`;
    return;
  }
  const primary = uni.blocks?.[0] || {};
  const blocks = (uni.blocks || []).slice(0, 5);
  $("#universityDetail").innerHTML = `<h2>${esc(uni.name)}</h2>
    <div class="uni-summary">
      <div class="summary-cell"><span>지역</span><b>${esc(uni.region || "-")}</b></div>
      <div class="summary-cell"><span>면접 상태</span><b>${esc(uni.status || "-")}</b></div>
      <div class="summary-cell"><span>대표 시간</span><b>${esc(primary.time || "-")}</b></div>
      <div class="summary-cell"><span>방식</span><b>${esc((uni.methods || []).join(", ") || "-")}</b></div>
    </div>
    ${blocks.map(renderEvalBlock).join("") || `<div class="empty">표시할 평가기준이 없습니다.</div>`}`;
}

function renderEvalBlock(block) {
  const factors = block.factors || [];
  const max = Math.max(100, ...factors.map((factor) => Number(factor.value || 0)));
  return `<section class="eval-block">
    <div class="eval-block-head">
      <h3>${esc(block.admission || "공통 전형")}</h3>
      <div class="qmeta">
        <span class="badge">${esc(block.process || "진행방법 없음")}</span>
        <span class="badge">${esc(block.source || "출제방식 없음")}</span>
      </div>
    </div>
    <div class="factor-list">
      ${factors.map((factor) => {
        const color = standardColors[factor.standard] || "#64748b";
        const value = Number(factor.value || 0);
        return `<div class="factor-item">
          <div class="factor-top"><span>${esc(factor.name || factor.standard || "평가요소")}</span><b>${value ? `${value}%` : "-"}</b></div>
          <div class="factor-bar"><i style="width:${Math.max(8, (value / max) * 100)}%;background:${esc(color)}"></i></div>
          ${factor.items ? `<p class="factor-note">${esc(compact(factor.items, 160))}</p>` : ""}
        </div>`;
      }).join("")}
    </div>
  </section>`;
}

function renderRubric() {
  $("#rubricGrid").innerHTML = DATA.dimensions.map((item) => `<article class="rubric-card" style="border-top-color:${esc(item.color)}">
    <h3>${esc(item.name)}</h3>
    <p>${esc(item.description)}</p>
    <ul>${item.signals.map((signal) => `<li>${esc(signal)}</li>`).join("")}</ul>
  </article>`).join("");
}

function universitySearchText(uni) {
  const blocks = uni.blocks || [];
  const terms = [uni.name, uni.region, uni.status, ...(uni.methods || [])];
  for (const block of blocks) {
    terms.push(block.admission, block.process, block.source);
    for (const factor of block.factors || []) {
      terms.push(factor.name, factor.standard, factor.items);
    }
  }
  return normalize(terms.filter(Boolean).join(" "));
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const m = String(Math.floor(safe / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function beep(frequency = 880, duration = 0.15, delay = 0) {
  if (!$("#mockSound").checked) return;
  try {
    state.audioCtx = state.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = state.audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  } catch {}
}

function stopSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}

function speakCurrentQuestion() {
  if (!$("#mockTts").checked || !window.speechSynthesis) return;
  const item = currentMockItem();
  if (!item) return;
  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(item.question);
  utterance.lang = "ko-KR";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

function currentMockItem() {
  if (!state.generated.length) return null;
  const index = state.mockOrder.length ? state.mockOrder[state.mockPos] : 0;
  return state.generated[index] || null;
}

function buildMockOrder() {
  let indices = state.generated.map((_, index) => index);
  if ($("#mockStarOnly").checked) {
    const starred = indices.filter((index) => state.stars.has(qkey(state.generated[index].question)));
    if (starred.length) indices = starred;
    else toast("★ 표시한 문항이 없어 전체 문항으로 진행합니다.");
  }
  if ($("#mockShuffle").checked) {
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
  }
  state.mockOrder = indices;
  state.mockPos = 0;
}

function clearMockTimer() {
  if (state.mockTimer) clearInterval(state.mockTimer);
  state.mockTimer = null;
}

function startMockTimer(seconds) {
  clearMockTimer();
  state.mockStageTotal = Math.max(1, Number(seconds) || 0);
  state.mockRemaining = Math.max(0, Number(seconds) || 0);
  updateMockDisplay();
  state.mockTimer = setInterval(() => {
    state.mockRemaining -= 1;
    if (state.mockRemaining <= 0) {
      if (state.mockStage === "prep") {
        startAnswerStage();
      } else {
        clearMockTimer();
        state.mockRemaining = 0;
        beep(523, 0.14);
        beep(392, 0.2, 0.18);
        toast("답변 시간이 끝났습니다.");
        updateMockDisplay();
      }
      return;
    }
    updateMockDisplay();
  }, 1000);
}

function startMock() {
  if (!state.generated.length) generate();
  buildMockOrder();
  state.mockStage = "prep";
  loadMockMemo();
  startMockTimer(Number($("#prepSeconds").value || 30));
  speakCurrentQuestion();
  saveInputs();
}

function startAnswerStage() {
  state.mockStage = "answer";
  beep(880, 0.16);
  startMockTimer(Number($("#answerSeconds").value || 90));
}

function loadMockMemo() {
  const item = currentMockItem();
  $("#mockNotes").value = item ? state.memos[qkey(item.question)] || "" : "";
}

function moveMockQuestion(step) {
  if (!state.generated.length) return;
  if (!state.mockOrder.length) buildMockOrder();
  const total = state.mockOrder.length;
  state.mockPos = (state.mockPos + step + total) % total;
  state.mockStage = "prep";
  loadMockMemo();
  startMockTimer(Number($("#prepSeconds").value || 30));
  speakCurrentQuestion();
}

function updateMockDisplay() {
  const total = state.mockOrder.length || state.generated.length || 30;
  const position = state.mockOrder.length ? state.mockPos : 0;
  const item = currentMockItem();
  const isAnswer = state.mockStage === "answer";
  const danger = state.mockTimer && state.mockRemaining <= 10;

  $("#mockProgress").textContent = `문항 ${Math.min(position + 1, total)} / ${total}`;
  const timer = $("#mockTimer");
  timer.textContent = formatTime(state.mockRemaining);
  timer.classList.toggle("danger", Boolean(danger));

  const stage = $("#mockStage");
  stage.textContent = isAnswer ? "답변" : "준비";
  stage.classList.toggle("answer", isAnswer);

  const fill = $("#timerFill");
  fill.style.width = `${Math.max(0, Math.min(100, (state.mockRemaining / state.mockStageTotal) * 100))}%`;
  fill.classList.toggle("answer", isAnswer && !danger);
  fill.classList.toggle("danger", Boolean(danger));

  $("#mockProgressFill").style.width = `${((position + 1) / total) * 100}%`;
  $("#mockQuestion").textContent = item ? item.question : "먼저 문항을 생성한 뒤 모의면접을 시작하세요.";
}

function copyQuestions() {
  const text = exportText();
  navigator.clipboard?.writeText(text).then(() => toast("복사했습니다.")).catch(() => {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    toast("복사했습니다.");
  });
}

function exportText() {
  const title = $("#resultTitle").textContent;
  const lines = [title, ""];
  for (const item of state.generated) {
    const d = dim(item.dimension);
    const starred = state.stars.has(qkey(item.question));
    lines.push(`Q${item.number}.${starred ? " ★" : ""} ${item.question}`);
    lines.push(`평가요소: ${d.name}`);
    lines.push(`평가의도: ${item.intent}`);
    if (item.tails.length) lines.push(`꼬리질문: ${item.tails.join(" / ")}`);
    const memo = state.memos[qkey(item.question)];
    if (memo) lines.push(`내 답변 메모: ${memo.replace(/\s*\n\s*/g, " / ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

function downloadQuestions() {
  const blob = new Blob([exportText()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const activity = normalize($("#keywordInput").value || "interview").replace(/\s+/g, "_");
  a.href = url;
  a.download = `student-record-interview-${activity || "questions"}.txt`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("TXT 파일을 만들었습니다.");
}

function bindEvents() {
  $$(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchMode(tab.dataset.mode));
  });

  $("#generateBtn").addEventListener("click", generate);
  $("#keywordInput").addEventListener("input", () => {
    const activity = compact($("#keywordInput").value || "학생부 활동", 100);
    renderActivityFeedback(activity, detectActivityProfile(activity));
  });
  $("#trackSelect").addEventListener("change", generate);
  $("#focusSelect").addEventListener("change", generate);
  $("#countSelect").addEventListener("change", generate);

  $("#starFilterBtn").addEventListener("click", () => {
    state.starOnly = !state.starOnly;
    $("#starFilterBtn").classList.toggle("on", state.starOnly);
    renderQuestions();
  });

  $("#answerMemo").addEventListener("input", () => {
    const item = state.generated[state.selectedQuestion];
    if (item) saveMemo(item.question, $("#answerMemo").value);
  });

  $("#copyBtn").addEventListener("click", copyQuestions);
  $("#downloadBtn").addEventListener("click", downloadQuestions);
  $("#printBtn").addEventListener("click", () => window.print());
  $("#resetBtn").addEventListener("click", () => {
    $("#keywordInput").value = "바이오 플라스틱 제작 및 생분해성 비교 실험";
    $("#majorInput").value = "환경공학·생명과학 계열";
    $("#trackSelect").value = "";
    $("#focusSelect").value = "";
    $("#countSelect").value = "30";
    $("#genericToggle").checked = false;
    $("#hardToggle").checked = true;
    state.filterDimension = null;
    state.starOnly = false;
    $("#starFilterBtn").classList.remove("on");
    clearMockTimer();
    stopSpeech();
    state.mockOrder = [];
    state.mockPos = 0;
    state.mockStage = "prep";
    state.mockRemaining = Number($("#prepSeconds").value || 30);
    switchMode("generate");
    generate();
    toast("입력값을 초기화했습니다.");
  });

  $("#startMockBtn").addEventListener("click", startMock);
  $("#skipStageBtn").addEventListener("click", () => {
    if (state.mockStage === "prep") startAnswerStage();
    else moveMockQuestion(1);
  });
  $("#nextMockBtn").addEventListener("click", () => moveMockQuestion(1));
  $("#prevMockBtn").addEventListener("click", () => moveMockQuestion(-1));

  $("#mockNotes").addEventListener("input", () => {
    const item = currentMockItem();
    if (item) saveMemo(item.question, $("#mockNotes").value);
  });

  ["mockShuffle", "mockStarOnly", "mockSound", "mockTts"].forEach((id) => {
    $(`#${id}`).addEventListener("change", () => {
      if (id === "mockTts" && !$("#mockTts").checked) stopSpeech();
      saveInputs();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (!$("#mode-mock").classList.contains("on")) return;
    const target = event.target;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (event.code === "Space") {
      event.preventDefault();
      if (state.mockStage === "prep") startAnswerStage();
      else moveMockQuestion(1);
    } else if (event.key === "ArrowRight") {
      moveMockQuestion(1);
    } else if (event.key === "ArrowLeft") {
      moveMockQuestion(-1);
    }
  });

  $("#universitySearch").addEventListener("input", renderUniversities);

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((item) => item.classList.toggle("on", item === tab));
      $$(".tab-body").forEach((body) => body.classList.toggle("on", body.id === `tab-${tab.dataset.tab}`));
    });
  });
}

function init() {
  if (!DATA) {
    document.body.innerHTML = "<p>데이터를 불러오지 못했습니다.</p>";
    return;
  }
  initTheme();
  fillControls();
  renderExampleChips();
  restoreInputs();
  fillHeroStats();
  bindEvents();
  renderRegionChips();
  renderRubric();
  renderUniversities();
  generate();
  state.mockRemaining = Number($("#prepSeconds").value || 30);
  state.mockStageTotal = state.mockRemaining;
  updateMockDisplay();
}

init();
