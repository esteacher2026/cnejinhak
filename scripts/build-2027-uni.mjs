import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const oldHtmlCandidates = [
  path.join(root, "2025uni_legacy_2025.html"),
  path.join(root, "2025uni.html"),
];
const csvPath = process.argv[2] || "C:\\Users\\eric\\Documents\\카카오톡 받은 파일\\adiga_2027_university_departments_capacity_20260612.csv";
const outputHtmlPath = path.join(root, "2027uni.html");
const outputCompatHtmlPath = path.join(root, "2025uni.html");
const outputDataPath = path.join(root, "2027uni_data.js");

const DATA_YEAR = "2027학년도";
const GENERATED_DATE = "2026-06-12";

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === "\"") inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  const headers = rows.shift().map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

async function readFirstExisting(paths) {
  const errors = [];
  for (const filePath of paths) {
    try {
      return { filePath, text: await fs.readFile(filePath, "utf8") };
    } catch (error) {
      errors.push(`${filePath}: ${error.message}`);
    }
  }
  throw new Error(`Could not read any source HTML:\n${errors.join("\n")}`);
}

function uniq(list) {
  return [...new Set(list.filter((v) => v !== undefined && v !== null && String(v).trim() !== ""))];
}

function countBy(list, selector) {
  const map = new Map();
  list.forEach((item) => {
    const key = selector(item);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function majority(list, selector) {
  const ranked = [...countBy(list, selector).entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "ko"));
  return ranked[0]?.[0] || "";
}

function clampList(list, limit) {
  return uniq(list.map((v) => String(v || "").trim())).slice(0, limit);
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘“”"'`]/g, "")
    .replace(/[()[\]{}<>]/g, " ")
    .replace(/[·ㆍ・･/\\|_,.;:~!?+*^$#@=%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normSchool(value) {
  let out = String(value ?? "").normalize("NFKC");
  out = out.replace(/\[[^\]]*]/g, "");
  out = out.replace(/\([^)]*\)/g, "");
  out = out.replace(/\s+/g, "");
  return out.trim();
}

function schoolKeys(value) {
  const base = normSchool(value);
  const keys = [base];
  if (base.startsWith("국립")) keys.push(base.replace(/^국립/, ""));
  else if (base) keys.push(`국립${base}`);
  return uniq(keys);
}

function parseUniversity(value) {
  const raw = String(value ?? "").trim();
  const campus = raw.match(/\[([^\]]+)]/)?.[1] || "";
  return {
    raw,
    school: normSchool(raw),
    campus,
  };
}

function normDept(value) {
  let out = String(value ?? "").normalize("NFKC").toLowerCase();
  out = out.replace(/\([^)]*\)/g, "");
  out = out.replace(/\[[^\]]*]/g, "");
  out = out.replace(/\s+/g, "");
  out = out.replace(/[·ㆍ・･/\\|_,.;:~!?+*^$#@=%\-]/g, "");
  out = out.replace(/전공$/, "");
  return out.trim();
}

function looseDept(value) {
  return normDept(value)
    .replace(/학과$/g, "")
    .replace(/학부$/g, "")
    .replace(/계열$/g, "")
    .replace(/전공$/g, "")
    .replace(/과정$/g, "");
}

function bigrams(value) {
  const s = value || "";
  if (s.length <= 1) return s ? [s] : [];
  const out = [];
  for (let i = 0; i < s.length - 1; i += 1) out.push(s.slice(i, i + 2));
  return out;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (longer.includes(shorter)) return Math.min(0.96, 0.62 + shorter.length / Math.max(10, longer.length) * 0.34);
  const aa = new Set(bigrams(a));
  const bb = new Set(bigrams(b));
  const union = new Set([...aa, ...bb]).size || 1;
  let inter = 0;
  aa.forEach((item) => { if (bb.has(item)) inter += 1; });
  const jaccard = inter / union;
  const lengthRatio = shorter.length / Math.max(1, longer.length);
  return jaccard * 0.78 + lengthRatio * 0.22;
}

const FIELD_RULES = [
  { field: "자율융합", rx: /자유전공|자율전공|무전공|융합|통합모집|글로벌미래|미래융합|창의융합|계열|전 모집단위/, tags: ["자유전공·무전공", "융합·탐색"] },
  { field: "의약보건", rx: /의예|의학|간호|약학|치의|치위생|한의|수의|물리치료|작업치료|임상병리|방사선|보건|응급|재활|의료|바이오메디컬|보건행정/, tags: ["보건·의료", "생명·바이오"] },
  { field: "교육", rx: /교육|초등|유아|특수교육|사범|교직|국어교육|영어교육|수학교육|사회교육|과학교육|체육교육|역사교육|윤리교육|지리교육/, tags: ["교육·교직", "상담·복지"] },
  { field: "AI·소프트웨어", rx: /컴퓨터|소프트웨어|소프트|인공지능|AI|데이터|빅데이터|정보보호|사이버|모바일|게임공학|디지털|스마트|핀테크|미디어기술|인터넷|IT|IoT/i, tags: ["AI·데이터·SW", "첨단산업"] },
  { field: "공학", rx: /공학|전자|전기|기계|로봇|자동차|모빌리티|건축|토목|화학공|신소재|재료|반도체|디스플레이|나노|에너지|항공|우주|조선|해양|산업경영|안전공|환경공|도시공|메카트로닉스/, tags: ["공학·기술", "첨단산업"] },
  { field: "경영경제", rx: /경영|경제|회계|세무|무역|금융|보험|부동산|물류|관광|호텔|외식|창업|마케팅|비즈니스|국제통상|유통/, tags: ["경영·경제·금융", "창업·마케팅"] },
  { field: "인문사회", rx: /국어|영어|중국|일본|러시아|프랑스|독일|스페인|언어|문학|철학|사학|역사|사회|심리|행정|정치|법학|경찰|복지|미디어|신문|광고|커뮤니케이션|문화|국제|글로벌|군사|안보/, tags: ["인문·사회", "법·행정·공공"] },
  { field: "자연생명", rx: /수학|물리|화학|생명|생물|통계|식품|환경|지구|해양|산림|농업|원예|동물|축산|수산|바이오|분자|유전학|유전체|유전자|의생명|응용생명/, tags: ["자연과학", "생명·바이오"] },
  { field: "예체능", rx: /디자인|미술|음악|성악|작곡|피아노|무용|체육|스포츠|연극|영화|영상|공연|패션|뷰티|게임|만화|애니|웹툰|조형|시각|산업디자인|실용음악/, tags: ["예술·디자인·콘텐츠", "스포츠"] },
];

const TOPIC_RULES = [
  { tag: "자유전공·무전공", rx: /자유전공|자율전공|무전공|통합모집|전 모집단위|계열|미래융합|글로벌융합|창의융합/ },
  { tag: "AI·데이터·SW", rx: /AI|인공지능|데이터|빅데이터|소프트웨어|컴퓨터|정보보호|사이버|프로그래밍|디지털|스마트|핀테크|IoT/i },
  { tag: "반도체·첨단산업", rx: /반도체|디스플레이|나노|신소재|첨단|모빌리티|로봇|미래자동차|차세대|배터리|이차전지/ },
  { tag: "보건·의료", rx: /의예|의학|간호|약학|치의|한의|수의|물리치료|작업치료|임상|방사선|보건|응급|재활|의료|치위생/ },
  { tag: "교육·교직", rx: /교육|초등|유아|특수교육|사범|교직|교육과/ },
  { tag: "상담·복지", rx: /상담|심리|복지|청소년|아동|가족|노인|재활/ },
  { tag: "기후·환경·에너지", rx: /환경|기후|탄소|에너지|신재생|수소|그린|생태|지구|해양환경/ },
  { tag: "바이오·생명", rx: /바이오|생명|생물|의생명|분자|유전학|유전체|유전자|제약|화장품|식품생명/ },
  { tag: "경영·경제·금융", rx: /경영|경제|회계|세무|금융|무역|물류|관광|호텔|마케팅|창업|부동산/ },
  { tag: "미디어·콘텐츠", rx: /미디어|콘텐츠|영상|방송|광고|커뮤니케이션|신문|웹툰|만화|게임|애니/ },
  { tag: "디자인·예술", rx: /디자인|미술|음악|공연|연극|영화|패션|뷰티|조형|공예|실용음악/ },
  { tag: "스포츠", rx: /체육|스포츠|운동|레저|태권도|골프/ },
  { tag: "국방·항공·해양", rx: /군사|국방|안보|항공|우주|드론|해양|조선|선박|항해/ },
  { tag: "농림·식품·동물", rx: /농업|산림|원예|축산|동물|식품|스마트팜|수산|조경/ },
  { tag: "법·행정·공공", rx: /법학|행정|경찰|소방|공공|정책|정치|외교|공무원/ },
  { tag: "언어·국제", rx: /영어|중국|일본|러시아|프랑스|독일|스페인|언어|국제|글로벌|통번역/ },
];

const FIELD_TEMPLATES = {
  "의약보건": {
    courses: ["해부학", "생리학", "보건의료법규", "임상실습", "환자안전", "의료윤리"],
    careers: ["보건의료 전문가", "의료기사", "보건직 공무원", "임상 연구 인력"],
  },
  "교육": {
    courses: ["교육학개론", "교육심리", "교수학습방법", "교육과정", "생활지도와 상담", "학교현장실습"],
    careers: ["교사", "교육연구원", "진로진학상담교사", "교육행정 인력"],
  },
  "AI·소프트웨어": {
    courses: ["프로그래밍", "자료구조", "데이터분석", "인공지능", "알고리즘", "소프트웨어 프로젝트"],
    careers: ["소프트웨어 개발자", "데이터 분석가", "AI 엔지니어", "정보보안 전문가"],
  },
  "공학": {
    courses: ["공학수학", "기초설계", "재료/회로/역학 기초", "캡스톤디자인", "품질관리", "실험실습"],
    careers: ["공학기술자", "연구개발 인력", "품질관리 전문가", "생산기술 엔지니어"],
  },
  "경영경제": {
    courses: ["경영학원론", "경제학원론", "회계원리", "마케팅", "통계와 데이터분석", "전략기획"],
    careers: ["경영기획자", "마케팅 전문가", "금융·회계 실무자", "창업가"],
  },
  "인문사회": {
    courses: ["사회과학방법론", "글쓰기와 발표", "자료분석", "정책/문화/언어 탐구", "현장실습", "융합세미나"],
    careers: ["기획·조사 전문가", "공공기관 실무자", "콘텐츠 기획자", "상담·복지 인력"],
  },
  "자연생명": {
    courses: ["일반수학/통계", "일반물리·화학·생물", "실험설계", "데이터 분석", "연구방법론", "현장실습"],
    careers: ["연구원", "품질분석 전문가", "바이오·식품 연구 인력", "환경 분석 인력"],
  },
  "예체능": {
    courses: ["전공실기", "작품기획", "디지털 제작", "포트폴리오", "현장 프로젝트", "문화산업 이해"],
    careers: ["디자이너", "콘텐츠 제작자", "예술·체육 지도자", "문화기획자"],
  },
  "자율융합": {
    courses: ["전공탐색", "융합기초", "진로설계", "데이터 리터러시", "문제해결 프로젝트", "학업설계"],
    careers: ["융합형 기획자", "전공연계 전문가", "프로젝트 매니저", "신산업 실무자"],
  },
};

function classifyField(dept, oldMajor = "") {
  const haystack = `${dept} ${oldMajor}`;
  const direct = FIELD_RULES.find((rule) => rule.rx.test(haystack));
  if (direct) return direct.field;
  if (/공학/.test(oldMajor)) return "공학";
  if (/자연/.test(oldMajor)) return "자연생명";
  if (/예체능/.test(oldMajor)) return "예체능";
  if (/의학/.test(oldMajor)) return "의약보건";
  if (/인문사회/.test(oldMajor)) return "인문사회";
  return "미분류";
}

function classifyTopics(dept, courses = [], careers = [], oldTags = []) {
  const haystack = `${dept} ${courses.join(" ")} ${careers.join(" ")} ${oldTags.join(" ")}`;
  const tags = [];
  TOPIC_RULES.forEach((rule) => {
    if (rule.rx.test(haystack)) tags.push(rule.tag);
  });
  oldTags.forEach((tag) => {
    if (tag && !tags.includes(tag)) tags.push(tag);
  });
  return tags.slice(0, 8);
}

function capacityBand(capacity) {
  if (capacity === 0) return "0명";
  if (capacity <= 19) return "1~19명";
  if (capacity <= 49) return "20~49명";
  if (capacity <= 99) return "50~99명";
  if (capacity <= 199) return "100~199명";
  return "200명 이상";
}

function preferredOldScore(record, deptKey) {
  let score = 0;
  if (record.schoolType === "대학교") score += 40;
  if (record.schoolType === "교육대학") score += 35;
  if (record.degree === "학사") score += 20;
  if (record.time === "주간") score += 8;
  score += Math.min(18, (record.courses?.length || 0) / 6);
  score += Math.min(12, (record.careers?.length || 0) / 3);
  score -= Math.abs(normDept(record.dept).length - deptKey.length) * 0.25;
  return score;
}

function sortOldCandidates(candidates, deptKey) {
  return [...candidates].sort((a, b) => preferredOldScore(b, deptKey) - preferredOldScore(a, deptKey));
}

function buildStudentQuestions(record) {
  const tag = record.topics[0] || record.field || "진로";
  const course = record.courses[0] || FIELD_TEMPLATES[record.field]?.courses?.[0] || "핵심 교과";
  const career = record.careers[0] || FIELD_TEMPLATES[record.field]?.careers?.[0] || "관련 직업";
  return [
    `${tag} 분야에서 해결하고 싶은 사회 문제는 무엇인가?`,
    `${course}를 배운다면 고등학교 어떤 과목의 개념과 연결할 수 있는가?`,
    `${career}로 성장하기 위해 지금 확인해야 할 역량과 경험은 무엇인가?`,
    `같은 학교 또는 같은 지역의 비슷한 학과와 비교했을 때 이 학과의 차별점은 무엇인가?`,
  ];
}

function confidenceLabel(level) {
  return {
    exact: "정확 매칭",
    strong: "강한 매칭",
    fuzzy: "유사 매칭",
    template: "학과군 보강",
    inferred: "키워드 추정",
  }[level] || "키워드 추정";
}

async function main() {
  const [oldHtmlSource, csvText] = await Promise.all([
    readFirstExisting(oldHtmlCandidates),
    fs.readFile(csvPath, "utf8"),
  ]);
  const oldHtml = oldHtmlSource.text;

  const match = oldHtml.match(/<script id="dept-data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Could not find dept-data JSON in 2025uni.html");
  const oldData = JSON.parse(match[1]);
  const rawRows = parseCsv(csvText);

  const undergraduateTypes = new Set(["대학교", "교육대학", "산업대학", "사이버대학(대학)", "방송통신대학", "각종학교(대학)", "기술대학"]);
  const oldUseful = oldData
    .filter((r) => r.school && r.dept && undergraduateTypes.has(r.schoolType))
    .map((r) => ({
      ...r,
      courses: Array.isArray(r.courses) ? r.courses : [],
      careers: Array.isArray(r.careers) ? r.careers : [],
      tags: Array.isArray(r.tags) ? r.tags : [],
      _deptKey: normDept(r.dept),
      _looseDept: looseDept(r.dept),
      _schoolKeys: schoolKeys(r.school),
    }));

  const byPair = new Map();
  const bySchool = new Map();
  const byDept = new Map();
  const add = (map, key, value) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  oldUseful.forEach((record) => {
    record._schoolKeys.forEach((schoolKey) => {
      add(bySchool, schoolKey, record);
      add(byPair, `${schoolKey}|${record._deptKey}`, record);
      add(byPair, `${schoolKey}|${record._looseDept}`, record);
    });
    add(byDept, record._deptKey, record);
    add(byDept, record._looseDept, record);
  });

  const grouped = new Map();
  rawRows.forEach((row, index) => {
    const uni = parseUniversity(row["대학교"]);
    const dept = String(row["학과"] || "").trim();
    const capacity = Number.parseInt(String(row["모집인원"] || "0").replace(/,/g, ""), 10) || 0;
    const key = `${uni.raw}|${dept}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        rawUniversity: uni.raw,
        school: uni.school,
        campus: uni.campus,
        dept,
        rows: [],
      });
    }
    grouped.get(key).rows.push({ index, capacity });
  });

  const groupedRows = [...grouped.values()].map((item) => {
    const values = item.rows.map((row) => row.capacity);
    const capacityValues = [...new Set(values)].sort((a, b) => b - a);
    return {
      ...item,
      rawRowCount: item.rows.length,
      rawCapacityTotal: values.reduce((sum, value) => sum + value, 0),
      capacity: Math.max(...values),
      capacityValues,
      duplicateSameValue: item.rows.length > 1 && capacityValues.length === 1,
      duplicateMixedValue: capacityValues.length > 1,
    };
  });

  const schoolMeta = new Map();
  groupedRows.forEach((item) => {
    const keys = schoolKeys(item.school);
    const oldCandidates = uniq(keys.flatMap((key) => bySchool.get(key) || []));
    schoolMeta.set(item.school, {
      region: majority(oldCandidates, (r) => r.region),
      district: majority(oldCandidates, (r) => r.district),
      schoolType: majority(oldCandidates, (r) => r.schoolType) || "대학교",
      degree: majority(oldCandidates, (r) => r.degree) || "학사",
      years: majority(oldCandidates, (r) => r.years) || "4년",
      time: majority(oldCandidates, (r) => r.time) || "주간",
    });
  });

  function findMatch(item) {
    const deptKey = normDept(item.dept);
    const deptLoose = looseDept(item.dept);
    const schools = schoolKeys(item.school);

    for (const schoolKey of schools) {
      const exact = byPair.get(`${schoolKey}|${deptKey}`) || [];
      if (exact.length) return { level: "exact", score: 1, record: sortOldCandidates(exact, deptKey)[0] };
      const loose = byPair.get(`${schoolKey}|${deptLoose}`) || [];
      if (loose.length) return { level: "strong", score: 0.96, record: sortOldCandidates(loose, deptKey)[0] };
    }

    const sameSchool = uniq(schools.flatMap((schoolKey) => bySchool.get(schoolKey) || []));
    let best = null;
    sameSchool.forEach((candidate) => {
      const score = Math.max(similarity(deptKey, candidate._deptKey), similarity(deptLoose, candidate._looseDept));
      if (!best || score > best.score || (score === best.score && preferredOldScore(candidate, deptKey) > preferredOldScore(best.record, deptKey))) {
        best = { level: score >= 0.86 ? "strong" : "fuzzy", score, record: candidate };
      }
    });
    if (best && best.score >= 0.72) return best;

    const deptCandidates = [...(byDept.get(deptKey) || []), ...(byDept.get(deptLoose) || [])];
    if (deptCandidates.length) return { level: "template", score: 0.58, record: sortOldCandidates(deptCandidates, deptKey)[0] };
    return { level: "inferred", score: 0, record: null };
  }

  const records = groupedRows.map((item, idx) => {
    const matched = findMatch(item);
    const old = matched.record;
    const schoolDefaults = schoolMeta.get(item.school) || {};
    const field = classifyField(item.dept, old?.major || "");
    const template = FIELD_TEMPLATES[field] || FIELD_TEMPLATES["인문사회"];
    const exactish = ["exact", "strong", "fuzzy"].includes(matched.level);
    const courses = exactish
      ? clampList(old?.courses || [], 24)
      : clampList([...(old?.courses || []), ...template.courses], 14);
    const careers = exactish
      ? clampList(old?.careers || [], 16)
      : clampList([...(old?.careers || []), ...template.careers], 10);
    const fieldTags = FIELD_RULES.find((rule) => rule.field === field)?.tags || [];
    const topics = classifyTopics(item.dept, courses, careers, [...(old?.tags || []), ...fieldTags]);
    const flags = [];
    if (item.duplicateSameValue) flags.push(`동일 모집인원 ${item.rawRowCount}회 반복 정리`);
    if (item.duplicateMixedValue) flags.push(`서로 다른 모집인원 값: ${item.capacityValues.join(", ")}`);
    if (item.capacity === 0) flags.push("모집인원 0명 또는 미공개");
    if (!exactish) flags.push("교과·직업 정보는 학과군 기준 보강");

    return {
      id: idx + 1,
      school: item.school,
      campus: item.campus,
      schoolDisplay: item.campus ? `${item.school}[${item.campus}]` : item.school,
      dept: item.dept,
      capacity: item.capacity,
      capacityBand: capacityBand(item.capacity),
      capacityValues: item.capacityValues,
      rawRowCount: item.rawRowCount,
      rawCapacityTotal: item.rawCapacityTotal,
      region: old?.region || schoolDefaults.region || "",
      district: old?.district || schoolDefaults.district || "",
      schoolType: old?.schoolType || schoolDefaults.schoolType || "대학교",
      years: old?.years || schoolDefaults.years || "4년",
      degree: old?.degree || schoolDefaults.degree || "학사",
      time: old?.time || schoolDefaults.time || "주간",
      field,
      originalMajor: old?.major || "",
      college: old?.college || "",
      courses,
      careers,
      topics,
      tags: topics,
      matchLevel: matched.level,
      matchLabel: confidenceLabel(matched.level),
      matchScore: Number(matched.score.toFixed(2)),
      sourceDept: old?.dept || "",
      sourceSchool: old?.school || "",
      dataNote: exactish ? "기존 학과 메타데이터와 학교·학과 기준으로 연결" : "학과명 키워드와 유사 학과군 기준으로 보강",
      flags,
      questions: [],
    };
  });

  const schoolStats = new Map();
  records.forEach((record) => {
    if (!schoolStats.has(record.school)) schoolStats.set(record.school, { deptCount: 0, capacity: 0 });
    const current = schoolStats.get(record.school);
    current.deptCount += 1;
    current.capacity += record.capacity;
  });
  records.forEach((record) => {
    const stat = schoolStats.get(record.school);
    record.schoolDeptCount = stat.deptCount;
    record.schoolCapacity = stat.capacity;
    record.questions = buildStudentQuestions(record);
  });

  records.sort((a, b) => a.school.localeCompare(b.school, "ko") || a.dept.localeCompare(b.dept, "ko"));
  records.forEach((record, index) => { record.id = index + 1; });

  const summarize = (list, selector) => [...countBy(list, selector).entries()]
    .map(([name, count]) => ({
      name,
      count,
      capacity: list.filter((item) => selector(item) === name).reduce((sum, item) => sum + item.capacity, 0),
    }))
    .sort((a, b) => b.capacity - a.capacity || b.count - a.count || a.name.localeCompare(b.name, "ko"));

  const topSchools = [...schoolStats.entries()]
    .map(([school, stat]) => ({ school, ...stat }))
    .sort((a, b) => b.capacity - a.capacity || b.deptCount - a.deptCount || a.school.localeCompare(b.school, "ko"))
    .slice(0, 20);

  const deptStatsMap = new Map();
  records.forEach((record) => {
    const key = normDept(record.dept);
    const current = deptStatsMap.get(key) || { dept: record.dept, count: 0, capacity: 0 };
    current.count += 1;
    current.capacity += record.capacity;
    deptStatsMap.set(key, current);
  });

  const audit = {
    dataYear: DATA_YEAR,
    generatedDate: GENERATED_DATE,
    sourceCsv: path.basename(csvPath),
    rawRows: rawRows.length,
    dedupRows: records.length,
    schools: new Set(records.map((r) => r.school)).size,
    campuses: new Set(records.map((r) => r.schoolDisplay)).size,
    totalCapacityRaw: rawRows.reduce((sum, row) => sum + (Number.parseInt(String(row["모집인원"] || "0").replace(/,/g, ""), 10) || 0), 0),
    totalCapacityRepresentative: records.reduce((sum, record) => sum + record.capacity, 0),
    zeroCapacityRows: records.filter((record) => record.capacity === 0).length,
    duplicateGroups: records.filter((record) => record.rawRowCount > 1).length,
    duplicateSameValue: records.filter((record) => record.rawRowCount > 1 && record.capacityValues.length === 1).length,
    duplicateMixedValue: records.filter((record) => record.capacityValues.length > 1).length,
    reviewNeeded: records.filter((record) => record.flags.length).length,
    matchCounts: Object.fromEntries([...countBy(records, (r) => r.matchLevel).entries()].sort()),
    fieldSummary: summarize(records, (r) => r.field),
    capacityBands: summarize(records, (r) => r.capacityBand),
    topSchools,
    topDepartments: [...deptStatsMap.values()].sort((a, b) => b.capacity - a.capacity || b.count - a.count).slice(0, 20),
    sourceNotes: [
      "2027학년도 대학별 개설학과·모집인원 CSV를 기준으로 구성했습니다.",
      "동일 학교·학과가 반복되고 모집인원이 같은 경우 대표값 1건으로 정리했습니다.",
      "동일 학교·학과에 서로 다른 모집인원 값이 있는 경우 가장 큰 값을 대표값으로 표시하고 검토 플래그를 남겼습니다.",
      "교과목·관련직업·주제 태그는 기존 전국대학별학과정보 메타데이터와 학과명 키워드로 보강했습니다.",
    ],
  };

  const dataJs = `/* Generated by scripts/build-2027-uni.mjs on ${GENERATED_DATE}. */\nwindow.UNI2027_DATA=${JSON.stringify(records)};\nwindow.UNI2027_AUDIT=${JSON.stringify(audit)};\n`;
  const html = buildHtml().replace(/\\`/g, "`").replace(/\\\$\{/g, "${");
  await fs.writeFile(outputDataPath, dataJs, "utf8");
  await fs.writeFile(outputHtmlPath, html, "utf8");
  await fs.writeFile(outputCompatHtmlPath, html, "utf8");

  console.log(JSON.stringify({
    sourceHtml: oldHtmlSource.filePath,
    outputHtml: outputHtmlPath,
    outputCompatHtml: outputCompatHtmlPath,
    outputData: outputDataPath,
    records: records.length,
    schools: audit.schools,
    totalCapacity: audit.totalCapacityRepresentative,
    matchCounts: audit.matchCounts,
  }, null, 2));
}

function buildHtml() {
  return String.raw`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>2027 대학 개설학과·모집인원·진로 검색</title>
  <meta name="description" content="2027학년도 대학별 개설학과, 모집인원, 계열, 교과목, 관련 직업, 상담 주제를 함께 탐색하는 교사용 진로진학 검색 도구">
  <style>
    :root{
      --bg:#f6f7f9;
      --paper:#ffffff;
      --ink:#111827;
      --muted:#667085;
      --subtle:#8a94a6;
      --line:#d9dee8;
      --line2:#ecedf2;
      --primary:#174ea6;
      --primary-weak:#e8f0fe;
      --green:#0f766e;
      --green-weak:#e7f6f3;
      --amber:#a15c07;
      --amber-weak:#fff5df;
      --red:#b42318;
      --red-weak:#fff0ee;
      --slate:#263244;
      --violet:#6842a0;
      --max:1360px;
      --radius:8px;
      --shadow:0 10px 26px rgba(17,24,39,.08);
    }
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{
      margin:0;
      background:var(--bg);
      color:var(--ink);
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans KR","Apple SD Gothic Neo",sans-serif;
      line-height:1.5;
      word-break:keep-all;
    }
    a{color:inherit}
    button,input,select{font:inherit}
    button{touch-action:manipulation}
    .skip{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}
    .skip:focus{left:16px;top:16px;width:auto;height:auto;background:#111827;color:#fff;padding:10px 14px;border-radius:6px;z-index:9999}
    .topbar{
      position:sticky;top:0;z-index:60;
      background:rgba(255,255,255,.94);
      border-bottom:1px solid var(--line);
      backdrop-filter:saturate(1.1) blur(14px);
    }
    .topbar-inner{
      max-width:var(--max);margin:0 auto;padding:10px 18px;
      display:flex;align-items:center;justify-content:space-between;gap:16px;
    }
    .brand{display:flex;align-items:center;gap:10px;text-decoration:none;min-width:0}
    .brand-mark{
      width:38px;height:38px;border-radius:8px;background:var(--slate);color:#fff;
      display:grid;place-items:center;font-weight:900;font-size:13px;letter-spacing:0;
    }
    .brand-title{font-weight:900;letter-spacing:0;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .brand-sub{display:block;color:var(--muted);font-size:12px;font-weight:700}
    .top-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
    .btn,.chip,.icon-btn{
      border:1px solid var(--line);background:#fff;color:var(--ink);
      border-radius:8px;padding:9px 12px;min-height:38px;
      display:inline-flex;align-items:center;justify-content:center;gap:7px;
      text-decoration:none;cursor:pointer;font-weight:800;box-shadow:0 1px 0 rgba(17,24,39,.03);
    }
    .btn:hover,.chip:hover,.icon-btn:hover{border-color:#b8c2d2;box-shadow:0 7px 18px rgba(17,24,39,.08)}
    .btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}
    .btn.green{background:var(--green);border-color:var(--green);color:#fff}
    .btn.light{background:#f8fafc}
    .btn.small{min-height:32px;padding:6px 9px;font-size:13px}
    .btn.danger{color:var(--red);border-color:#ffd2cc;background:#fff}
    .wrap{max-width:var(--max);margin:0 auto;padding:20px 18px 70px}
    .tool-head{
      display:grid;grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr);gap:14px;align-items:stretch;
    }
    .hero,.source-panel,.panel{
      background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 1px 0 rgba(17,24,39,.03);
    }
    .hero{padding:22px}
    .eyebrow{display:inline-flex;align-items:center;gap:7px;color:var(--primary);font-weight:900;font-size:13px;margin-bottom:8px}
    h1{font-size:clamp(25px,3.2vw,42px);line-height:1.15;margin:0;letter-spacing:0}
    .hero-lead{margin:12px 0 0;color:#344054;font-size:17px;max-width:840px}
    .source-panel{padding:16px;display:flex;flex-direction:column;gap:12px}
    .source-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .source-title strong{font-size:16px}
    .source-title span{font-size:12px;color:var(--muted);font-weight:800}
    .source-panel ul{margin:0;padding-left:18px;color:#475467;font-size:13px}
    .stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}
    .stat{
      border:1px solid var(--line2);border-radius:8px;background:#fbfcfe;padding:12px;
      min-height:82px;display:flex;flex-direction:column;justify-content:space-between;
    }
    .stat span{font-size:12px;color:var(--muted);font-weight:800}
    .stat b{font-size:24px;line-height:1.1;letter-spacing:0}
    .stat small{font-size:12px;color:var(--subtle)}
    .search-panel{margin-top:14px;padding:14px}
    .search-grid{display:grid;grid-template-columns:minmax(260px,1fr) repeat(2,minmax(140px,180px)) auto;gap:10px;align-items:end}
    .field{display:flex;flex-direction:column;gap:6px;min-width:0}
    label{font-size:12px;font-weight:900;color:#344054}
    input,select{
      width:100%;height:42px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);
      padding:0 11px;outline:none;
    }
    input:focus,select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(23,78,166,.12)}
    .quick-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .chip{min-height:32px;padding:6px 10px;font-size:13px;color:#344054}
    .chip.theme{background:#fbfcfe}
    .layout{display:grid;grid-template-columns:290px minmax(0,1fr);gap:14px;margin-top:14px;align-items:start}
    .tool-head > *,.layout > *,.content > *,.dashboard > *,.search-grid > *{min-width:0}
    .filters{position:sticky;top:72px;padding:14px;max-height:calc(100vh - 86px);overflow:auto}
    .filter-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
    .filter-head h2,.panel h2{margin:0;font-size:17px;letter-spacing:0}
    .filter-stack{display:grid;gap:12px}
    .check-row{display:flex;align-items:center;gap:8px;font-size:13px;color:#344054}
    .check-row input{width:17px;height:17px}
    .filter-caption{margin:12px 0 0;font-size:12px;color:var(--muted)}
    .content{display:grid;gap:14px}
    .dashboard{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}
    .metric-panel{padding:14px}
    .panel-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
    .panel-title strong{font-size:16px}
    .panel-title span{font-size:12px;color:var(--muted);font-weight:800}
    .bar-list{display:grid;gap:8px}
    .bar-item{display:grid;grid-template-columns:94px minmax(0,1fr) 78px;gap:8px;align-items:center;font-size:13px}
    .bar-label{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .bar-track{height:9px;background:#edf0f5;border-radius:999px;overflow:hidden}
    .bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--primary),var(--green))}
    .bar-value{text-align:right;color:#475467;font-variant-numeric:tabular-nums}
    .top-list{display:grid;gap:7px}
    .top-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;font-size:13px;border-bottom:1px solid var(--line2);padding-bottom:7px}
    .top-item:last-child{border-bottom:0;padding-bottom:0}
    .top-item b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .top-item span{color:#475467;font-variant-numeric:tabular-nums}
    .toolbar{padding:12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center}
    .result-title strong{display:block;font-size:17px}
    .result-title span{display:block;color:var(--muted);font-size:13px;margin-top:2px}
    .toolbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .toolbar-actions select{height:38px;min-width:150px}
    .active-filters{display:flex;flex-wrap:wrap;gap:8px}
    .filter-pill{
      display:inline-flex;align-items:center;gap:7px;background:#eef4ff;color:#183b74;border:1px solid #cdddfb;
      border-radius:8px;padding:6px 8px;font-size:12px;font-weight:800;
    }
    .filter-pill button{border:0;background:transparent;color:inherit;cursor:pointer;font-weight:900;padding:0}
    .results{display:grid;gap:10px}
    .dept-card{
      background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px;box-shadow:0 1px 0 rgba(17,24,39,.03);
      display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:14px;align-items:start;
    }
    .dept-main{min-width:0}
    .card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .dept-name{margin:0;font-size:19px;line-height:1.25;letter-spacing:0}
    .school-name{margin-top:4px;color:#475467;font-size:14px}
    mark{background:#fff2a8;border-radius:4px;padding:0 2px}
    .badge-row,.tag-list,.match-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
    .badge{
      display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:6px;
      padding:4px 7px;font-size:12px;font-weight:800;color:#344054;background:#fff;
    }
    .badge.field{background:var(--green-weak);border-color:#bde4dd;color:#0a5d56}
    .badge.match{background:var(--primary-weak);border-color:#c9dafc;color:#174ea6}
    .badge.review{background:var(--amber-weak);border-color:#f5d591;color:#7a4300}
    .badge.zero{background:var(--red-weak);border-color:#ffc9c2;color:var(--red)}
    .preview{margin:10px 0 0;color:#344054;font-size:13px}
    .preview b{color:#111827}
    .capacity-box{
      border:1px solid var(--line2);border-radius:8px;background:#fbfcfe;padding:12px;
      display:grid;gap:7px;min-width:0;
    }
    .capacity-box span{font-size:12px;color:var(--muted);font-weight:900}
    .capacity-box strong{font-size:28px;line-height:1;font-variant-numeric:tabular-nums}
    .capacity-box small{color:#667085;font-size:12px}
    .card-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}
    .empty{padding:28px;text-align:center;color:#475467;border:1px dashed #c8cfdb;border-radius:8px;background:#fff}
    .more-wrap{text-align:center}
    .compare-zone{display:none;padding:14px}
    .compare-zone.active{display:block}
    .compare-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}
    .compare-head h2{margin:0;font-size:17px}
    .table-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px}
    table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
    th,td{padding:10px;border-bottom:1px solid var(--line2);text-align:left;vertical-align:top}
    th{background:#f8fafc;color:#344054;font-size:12px}
    tr:last-child td{border-bottom:0}
    .guide-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .guide{border:1px solid var(--line);background:#fff;border-radius:8px;padding:14px}
    .guide h3{margin:0 0 7px;font-size:15px}
    .guide p{margin:0;color:#475467;font-size:13px}
    footer{margin-top:22px;color:#667085;font-size:13px}
    .floating-stack{position:fixed;right:18px;bottom:18px;z-index:50;display:grid;gap:8px}
    .floating-stack a{background:#111827;color:#fff;border-radius:8px;padding:9px 11px;text-decoration:none;font-weight:900;font-size:13px;box-shadow:var(--shadow)}
    .modal{position:fixed;inset:0;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;padding:20px;z-index:100}
    .modal.active{display:flex}
    .modal-card{background:#fff;border-radius:8px;max-width:980px;width:min(980px,100%);max-height:88vh;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.26)}
    .modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:18px;border-bottom:1px solid var(--line)}
    .modal-head h2{margin:0;font-size:22px}
    .modal-head p{margin:5px 0 0;color:#667085}
    .modal-body{padding:18px;overflow:auto;max-height:calc(88vh - 84px)}
    .detail-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .detail-box{border:1px solid var(--line2);border-radius:8px;background:#fbfcfe;padding:11px;min-height:74px}
    .detail-box span{display:block;color:#667085;font-size:12px;font-weight:900;margin-bottom:4px}
    .detail-box b{display:block;font-size:15px;overflow-wrap:anywhere}
    .section-title{font-size:16px;margin:18px 0 9px}
    .pill-wrap{display:flex;flex-wrap:wrap;gap:7px}
    .pill{background:#f8fafc;border:1px solid var(--line);border-radius:6px;padding:5px 8px;font-size:13px}
    .copy-box{border:1px solid var(--line);border-radius:8px;background:#fbfcfe;padding:12px;white-space:pre-wrap;font-size:13px;color:#344054}
    .related-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .related-card{border:1px solid var(--line);background:#fff;border-radius:8px;padding:10px;text-align:left;cursor:pointer}
    .related-card b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .related-card span{display:block;color:#667085;font-size:12px;margin-top:3px}
    @media (max-width:1080px){
      .tool-head,.layout,.dashboard{grid-template-columns:1fr}
      .filters{position:static;max-height:none}
      .search-grid{grid-template-columns:1fr 1fr}
      .search-grid .btn{grid-column:auto}
    }
    @media (max-width:760px){
      .topbar-inner{padding:9px 12px}.brand-sub{display:none}.top-actions .btn:not(.main-link){display:none}
      .wrap{padding:14px 12px 64px}
      .hero{padding:17px}
      .stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .search-grid{grid-template-columns:1fr}
      .toolbar{grid-template-columns:1fr}
      .dept-card{grid-template-columns:1fr}
      .card-actions{grid-template-columns:1fr 1fr}
      .guide-grid,.detail-grid,.related-list{grid-template-columns:1fr}
      .floating-stack{right:12px;bottom:12px}
    }
  </style>
</head>
<body>
  <a class="skip" href="#main">본문으로 바로가기</a>
  <header class="topbar" id="top">
    <div class="topbar-inner">
      <a class="brand" href="#main" aria-label="2027 대학 개설학과 검색 홈">
        <span class="brand-mark">2027</span>
        <span class="brand-title">대학 개설학과·모집인원 검색 <span class="brand-sub">진로진학 상담 데이터 도구</span></span>
      </a>
      <nav class="top-actions" aria-label="상단 이동">
        <a class="btn light" href="#filters">필터</a>
        <a class="btn light" href="#resultsTitle">결과</a>
        <a class="btn main-link" href="index.html">메인</a>
      </nav>
    </div>
  </header>

  <main class="wrap" id="main">
    <section class="tool-head" aria-labelledby="pageTitle">
      <div class="hero">
        <span class="eyebrow">2027학년도 기준 · 대학별 개설학과 + 모집인원 + 진로 메타데이터</span>
        <h1 id="pageTitle">학생의 관심사에서 출발해 대학 학과와 모집 규모를 함께 봅니다.</h1>
        <p class="hero-lead">학과명, 학교명, 지역, 계열, 교과목, 관련 직업, 상담 주제를 한 번에 검색하고 2027학년도 모집인원을 같이 확인할 수 있습니다.</p>
        <div class="stat-grid" id="statGrid" aria-label="자료 요약"></div>
      </div>
      <aside class="source-panel" aria-label="자료 기준">
        <div class="source-title">
          <strong>자료 기준과 해석</strong>
          <span id="generatedDate">업데이트 확인 중</span>
        </div>
        <ul id="sourceNotes">
          <li>자료를 불러오는 중입니다.</li>
        </ul>
        <button class="btn green" id="downloadAllBtn" type="button">전체 정리 CSV 다운로드</button>
      </aside>
    </section>

    <section class="panel search-panel" aria-label="통합 검색">
      <div class="search-grid">
        <div class="field">
          <label for="q">통합 검색</label>
          <input id="q" list="searchSuggestions" type="search" autocomplete="off" placeholder="학과명, 학교명, 직업, 교과목, 관심 주제 입력 예: 자유전공, 간호, 반도체, 데이터분석">
          <datalist id="searchSuggestions">
            <option value="자유전공"><option value="자율전공"><option value="간호학과"><option value="의예과"><option value="반도체"><option value="인공지능"><option value="데이터분석"><option value="사회복지"><option value="초등교육"><option value="물리치료"><option value="디자인"><option value="스마트팜"><option value="항공"><option value="기후환경">
          </datalist>
        </div>
        <div class="field">
          <label for="schoolQuick">대학명</label>
          <input id="schoolQuick" list="schoolSuggestions" type="search" autocomplete="off" placeholder="예: 부산대학교">
          <datalist id="schoolSuggestions"></datalist>
        </div>
        <div class="field">
          <label for="sort">정렬</label>
          <select id="sort">
            <option value="auto">추천순</option>
            <option value="capacity">모집인원 많은순</option>
            <option value="dept">학과명순</option>
            <option value="school">학교명순</option>
            <option value="region">지역순</option>
            <option value="quality">매칭품질순</option>
          </select>
        </div>
        <button class="btn primary" id="searchBtn" type="button">검색 적용</button>
      </div>
      <div class="quick-row" aria-label="추천 검색어">
        <button class="chip theme" data-query="자유전공">자유전공</button>
        <button class="chip theme" data-query="AI 데이터">AI·데이터</button>
        <button class="chip theme" data-query="반도체">반도체</button>
        <button class="chip theme" data-query="간호">간호</button>
        <button class="chip theme" data-query="의예과">의예과</button>
        <button class="chip theme" data-query="초등교육">초등교육</button>
        <button class="chip theme" data-query="사회복지">사회복지</button>
        <button class="chip theme" data-query="기후 환경 에너지">기후·환경</button>
      </div>
    </section>

    <section class="layout">
      <aside class="panel filters" id="filters" aria-label="검색 필터">
        <div class="filter-head">
          <h2>필터</h2>
          <button class="btn small" id="resetBtn" type="button">초기화</button>
        </div>
        <div class="filter-stack">
          <div class="field">
            <label for="region">지역</label>
            <select id="region"></select>
          </div>
          <div class="field">
            <label for="field">계열·분야</label>
            <select id="field"></select>
          </div>
          <div class="field">
            <label for="topic">상담 주제</label>
            <select id="topic"></select>
          </div>
          <div class="field">
            <label for="capacityBand">모집인원 구간</label>
            <select id="capacityBand"></select>
          </div>
          <div class="field">
            <label for="matchLevel">자료 보강 상태</label>
            <select id="matchLevel"></select>
          </div>
          <label class="check-row" for="reviewOnly">
            <input type="checkbox" id="reviewOnly">
            <span>검토 필요 항목만 보기</span>
          </label>
        </div>
        <p class="filter-caption">모집인원은 동일 학교·학과 반복값을 정리한 대표값입니다. 세부 전형별 최종 인원은 각 대학 모집요강으로 다시 확인하세요.</p>
      </aside>

      <section class="content" aria-labelledby="resultsTitle">
        <section class="dashboard" aria-label="자료 대시보드">
          <div class="panel metric-panel">
            <div class="panel-title"><strong>계열별 모집 규모</strong><span>대표 모집인원 기준</span></div>
            <div class="bar-list" id="fieldBars"></div>
          </div>
          <div class="panel metric-panel">
            <div class="panel-title"><strong>모집 규모 상위 학과군</strong><span>학과명 묶음 기준</span></div>
            <div class="top-list" id="topDepartments"></div>
          </div>
        </section>

        <div class="panel toolbar">
          <div class="result-title">
            <strong id="resultsTitle">검색 결과</strong>
            <span id="resultSummary">조건에 맞는 학과를 계산하는 중입니다.</span>
          </div>
          <div class="toolbar-actions">
            <button class="btn small" id="exportBtn" type="button">현재 결과 CSV</button>
            <button class="btn small" id="copySummaryBtn" type="button">요약 복사</button>
          </div>
        </div>

        <div class="active-filters" id="activeFilters" aria-label="적용된 필터"></div>
        <div class="results" id="results" aria-live="polite"></div>
        <div class="more-wrap"><button class="btn" id="moreBtn" type="button">더 보기</button></div>

        <section id="compareZone" class="panel compare-zone" aria-label="비교 담기">
          <div class="compare-head">
            <h2>비교 담기</h2>
            <div class="toolbar-actions">
              <button class="btn small" id="copyCompareBtn" type="button">비교표 복사</button>
              <button class="btn small danger" id="clearCompareBtn" type="button">비우기</button>
            </div>
          </div>
          <div id="compareTable"></div>
        </section>

        <section class="guide-grid" aria-label="교사용 활용 안내">
          <article class="guide">
            <h3>학생 상담</h3>
            <p>관심 키워드로 후보 학과군을 찾고 모집인원, 유사 학과, 관련 직업을 함께 비교합니다.</p>
          </article>
          <article class="guide">
            <h3>진로 수업</h3>
            <p>AI, 반도체, 복지, 환경처럼 수업 주제와 학과·직업을 연결하는 탐색 활동에 활용합니다.</p>
          </article>
          <article class="guide">
            <h3>자료 점검</h3>
            <p>0명, 중복, 유사 매칭 항목은 검토 플래그로 확인하고 대학별 모집요강과 교차 확인합니다.</p>
          </article>
        </section>
      </section>
    </section>

    <footer>
      <p><b>제작자:</b> 충청남도교육청진로융합교육원 교육연구사 정재연</p>
      <p><b>기준:</b> 2027학년도 대학별 개설학과·모집인원 CSV, 전국대학별학과정보 메타데이터 재매칭</p>
      <p><b>주의:</b> 본 도구는 진로진학 상담을 위한 탐색 자료이며, 전형별 최종 모집인원과 지원 가능 여부는 대학별 모집요강 및 대입정보포털에서 확인해야 합니다.</p>
    </footer>
  </main>

  <div class="floating-stack" aria-label="빠른 이동">
    <a href="#top">위로</a>
    <a href="index.html">메인</a>
  </div>

  <div class="modal" id="detailModal" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <h2 id="detailTitle">학과 상세</h2>
          <p id="detailSub"></p>
        </div>
        <button class="icon-btn" id="closeModalBtn" type="button" aria-label="상세 창 닫기">닫기</button>
      </div>
      <div class="modal-body" id="detailBody"></div>
    </div>
  </div>

  <div class="toast" id="toast" role="status" aria-live="polite" style="position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 14px;border-radius:8px;opacity:0;pointer-events:none;transition:.18s;z-index:120;font-weight:800;font-size:13px"></div>

  <script src="2027uni_data.js"></script>
  <script>
    const DATA = Array.isArray(window.UNI2027_DATA) ? window.UNI2027_DATA : [];
    const AUDIT = window.UNI2027_AUDIT || {};
    const nf = new Intl.NumberFormat('ko-KR');
    const $ = (id) => document.getElementById(id);
    const recordById = new Map(DATA.map(r => [r.id, r]));
    const qualityRank = { exact:5, strong:4, fuzzy:3, template:2, inferred:1 };
    const SYNONYMS = {
      'ai':['인공지능','머신러닝','데이터','소프트웨어','AI'],
      '인공지능':['ai','머신러닝','딥러닝','데이터','소프트웨어'],
      '데이터분석':['데이터','빅데이터','통계','데이터사이언스','머신러닝'],
      '자유전공':['자율전공','무전공','전공탐색','통합모집','계열'],
      '자율전공':['자유전공','무전공','전공탐색','통합모집'],
      '무전공':['자유전공','자율전공','전공탐색'],
      '반도체':['전자','전기','소재','나노','디스플레이','첨단산업'],
      '간호':['간호학과','간호사'],
      '간호사':['간호','간호학과'],
      '기후':['기후변화','탄소중립','환경','에너지'],
      '탄소중립':['탄소','기후','환경','에너지','지속가능'],
      '드론':['무인항공','항공','로봇','국방'],
      '상담':['심리','청소년','상담사','복지'],
      '사회복지':['복지','상담','청소년','노인','아동'],
      '게임':['게임콘텐츠','게임그래픽','프로그래밍','콘텐츠'],
      '스마트팜':['농업','원예','식물','식품','데이터'],
      '초등교육':['교육','교사','교육대학','교직']
    };
    const state = {
      query:'',
      school:'',
      filters:{region:'', field:'', topic:'', capacityBand:'', matchLevel:'', reviewOnly:false},
      sort:'auto',
      page:1,
      pageSize:24,
      current:[],
      compare:[]
    };

    function esc(value){
      return String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }
    function norm(value){
      return String(value ?? '').toLowerCase().normalize('NFKC')
        .replace(/[()[\]{}.,;:·ㆍ・/\\|_\-–—]/g,' ')
        .replace(/\s+/g,' ')
        .trim();
    }
    function uniq(list){
      return [...new Set(list.filter(v => v !== undefined && v !== null && String(v).trim() !== ''))]
        .sort((a,b) => String(a).localeCompare(String(b),'ko'));
    }
    function toast(message){
      const t = $('toast');
      t.textContent = message || '처리되었습니다.';
      t.style.opacity = '1';
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => { t.style.opacity = '0'; }, 1700);
    }
    function debounce(fn, delay=130){
      let timer;
      return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    }
    function copyText(text){
      if(navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.focus(); area.select();
      document.execCommand('copy');
      area.remove();
      return Promise.resolve();
    }

    DATA.forEach((r) => {
      r.courses = Array.isArray(r.courses) ? r.courses : [];
      r.careers = Array.isArray(r.careers) ? r.careers : [];
      r.topics = Array.isArray(r.topics) ? r.topics : [];
      r.flags = Array.isArray(r.flags) ? r.flags : [];
      r.questions = Array.isArray(r.questions) ? r.questions : [];
      r._courses = r.courses.join(' ');
      r._careers = r.careers.join(' ');
      r._topics = r.topics.join(' ');
      r._flags = r.flags.join(' ');
      r._n = {
        dept:norm(r.dept), school:norm(r.schoolDisplay || r.school), courses:norm(r._courses),
        careers:norm(r._careers), topics:norm(r._topics),
        meta:norm([r.region,r.district,r.field,r.originalMajor,r.college,r.capacityBand,r.matchLabel].join(' '))
      };
      r._search = norm([r.schoolDisplay,r.school,r.campus,r.dept,r.region,r.district,r.field,r.originalMajor,r.college,r._courses,r._careers,r._topics,r._flags,r.matchLabel].join(' '));
    });

    function populateSelect(id, values, allText='전체'){
      const el = $(id);
      const selected = el.value;
      el.innerHTML = '<option value="">' + esc(allText) + '</option>' + values.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
      if(values.includes(selected)) el.value = selected;
    }
    function populateFilters(){
      populateSelect('region', uniq(DATA.map(r => r.region)), '전체 지역');
      populateSelect('field', uniq(DATA.map(r => r.field)), '전체 계열·분야');
      populateSelect('topic', uniq(DATA.flatMap(r => r.topics)), '전체 상담 주제');
      populateSelect('capacityBand', ['0명','1~19명','20~49명','50~99명','100~199명','200명 이상'], '전체 모집인원');
      populateSelect('matchLevel', uniq(DATA.map(r => r.matchLabel)), '전체 보강 상태');
      $('schoolSuggestions').innerHTML = uniq(DATA.map(r => r.school)).map(v => '<option value="' + esc(v) + '">').join('');
    }
    function renderStats(){
      const stats = [
        ['정리 학과', nf.format(AUDIT.dedupRows || DATA.length) + '건', '중복 대표값 정리'],
        ['대학', nf.format(AUDIT.schools || uniq(DATA.map(r => r.school)).length) + '개', '학교명 기준'],
        ['대표 모집인원', nf.format(AUDIT.totalCapacityRepresentative || 0) + '명', '중복 최대값 기준'],
        ['검토 플래그', nf.format(AUDIT.reviewNeeded || 0) + '건', '0명·중복·추정 포함']
      ];
      $('statGrid').innerHTML = stats.map(([label,value,note]) => \`<div class="stat"><span>\${esc(label)}</span><b>\${esc(value)}</b><small>\${esc(note)}</small></div>\`).join('');
      $('generatedDate').textContent = (AUDIT.generatedDate || '2026-06-12') + ' 업데이트';
      $('sourceNotes').innerHTML = (AUDIT.sourceNotes || []).map(note => '<li>' + esc(note) + '</li>').join('');
    }
    function renderDashboard(){
      const fields = (AUDIT.fieldSummary || []).slice(0, 9);
      const max = Math.max(...fields.map(x => x.capacity), 1);
      $('fieldBars').innerHTML = fields.map(x => \`
        <div class="bar-item">
          <div class="bar-label" title="\${esc(x.name)}">\${esc(x.name)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:\${Math.max(4, x.capacity / max * 100)}%"></div></div>
          <div class="bar-value">\${nf.format(x.capacity)}</div>
        </div>\`).join('');
      $('topDepartments').innerHTML = (AUDIT.topDepartments || []).slice(0, 8).map(x => \`
        <div class="top-item"><b title="\${esc(x.dept)}">\${esc(x.dept)}</b><span>\${nf.format(x.capacity)}명 · \${nf.format(x.count)}개교</span></div>\`).join('');
    }
    function expandedTerms(query){
      const raw = norm(query);
      const base = raw.split(' ').filter(Boolean);
      const map = new Map();
      base.forEach(t => map.set(t, {term:t, weight:1, base:true}));
      base.concat(raw ? [raw] : []).forEach(t => {
        (SYNONYMS[t] || []).forEach(s => {
          const ns = norm(s);
          if(ns && !map.has(ns)) map.set(ns, {term:ns, weight:.52, base:false});
        });
      });
      return [...map.values()];
    }
    function scoreRecord(r, terms){
      if(!terms.length) return 1 + Math.min(7, r.capacity / 80);
      let score = 0;
      let matched = 0;
      for(const item of terms){
        const t = item.term;
        const w = item.weight;
        let local = 0;
        if(r._n.dept === t) local += 130;
        if(r._n.dept.includes(t)) local += 88;
        if(r._n.school.includes(t)) local += 58;
        if(r._n.careers.includes(t)) local += 54;
        if(r._n.topics.includes(t)) local += 48;
        if(r._n.courses.includes(t)) local += 34;
        if(r._n.meta.includes(t)) local += 18;
        if(r._search.includes(t)) local += 8;
        if(local > 0){ matched += item.base ? 1 : .35; score += local * w; }
      }
      if(score <= 0) return -9999;
      score += Math.min(8, r.capacity / 70);
      score += (qualityRank[r.matchLevel] || 1) * .9;
      return score + matched;
    }
    function passFilters(r){
      const f = state.filters;
      if(state.school && !norm(r.schoolDisplay).includes(norm(state.school)) && !norm(r.school).includes(norm(state.school))) return false;
      if(f.region && r.region !== f.region) return false;
      if(f.field && r.field !== f.field) return false;
      if(f.topic && !r.topics.includes(f.topic)) return false;
      if(f.capacityBand && r.capacityBand !== f.capacityBand) return false;
      if(f.matchLevel && r.matchLabel !== f.matchLevel) return false;
      if(f.reviewOnly && !r.flags.length) return false;
      return true;
    }
    function sortResults(items, hasQuery){
      const sort = state.sort;
      const byText = (a,b,field) => String(a.r[field] || '').localeCompare(String(b.r[field] || ''),'ko');
      items.sort((a,b) => {
        if(sort === 'capacity') return b.r.capacity - a.r.capacity || byText(a,b,'school') || byText(a,b,'dept');
        if(sort === 'dept') return byText(a,b,'dept') || byText(a,b,'school');
        if(sort === 'school') return byText(a,b,'school') || byText(a,b,'dept');
        if(sort === 'region') return byText(a,b,'region') || byText(a,b,'school') || byText(a,b,'dept');
        if(sort === 'quality') return (qualityRank[b.r.matchLevel] || 0) - (qualityRank[a.r.matchLevel] || 0) || b.r.capacity - a.r.capacity;
        if(hasQuery) return b.score - a.score || b.r.capacity - a.r.capacity || byText(a,b,'dept');
        return b.r.capacity - a.r.capacity || byText(a,b,'school') || byText(a,b,'dept');
      });
      return items;
    }
    function computeResults(){
      const terms = expandedTerms(state.query);
      const hasQuery = terms.length > 0;
      let items = DATA.filter(passFilters).map(r => ({r, score: scoreRecord(r, terms)}));
      if(hasQuery) items = items.filter(x => x.score > 0);
      state.current = sortResults(items, hasQuery);
    }
    function summarizeFilters(){
      const labels = [];
      if(state.query) labels.push('검색어: ' + state.query);
      if(state.school) labels.push('대학명: ' + state.school);
      const names = {region:'지역',field:'계열',topic:'주제',capacityBand:'모집인원',matchLevel:'보강상태'};
      Object.entries(state.filters).forEach(([k,v]) => { if(v && k !== 'reviewOnly') labels.push(names[k] + ': ' + v); });
      if(state.filters.reviewOnly) labels.push('검토 필요만');
      labels.push('2027학년도 기준');
      return labels.join(' · ');
    }
    function renderActiveFilters(){
      const box = $('activeFilters');
      const chips = [];
      if(state.query) chips.push({key:'query', label:'검색어: ' + state.query});
      if(state.school) chips.push({key:'school', label:'대학명: ' + state.school});
      const names = {region:'지역',field:'계열',topic:'주제',capacityBand:'모집인원',matchLevel:'보강상태'};
      Object.entries(state.filters).forEach(([k,v]) => {
        if(v && k !== 'reviewOnly') chips.push({key:k, label:names[k] + ': ' + v});
      });
      if(state.filters.reviewOnly) chips.push({key:'reviewOnly', label:'검토 필요만'});
      box.innerHTML = chips.map(c => '<span class="filter-pill">' + esc(c.label) + '<button type="button" aria-label="' + esc(c.label) + ' 해제" data-clear-filter="' + esc(c.key) + '">×</button></span>').join('');
    }
    function highlight(text){
      let out = esc(text || '');
      const terms = expandedTerms(state.query).filter(x => x.base).map(x => x.term).filter(t => t.length >= 2);
      terms.slice(0,4).forEach(t => {
        const safe = t.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
        if(safe) out = out.replace(new RegExp(safe, 'gi'), m => '<mark>' + m + '</mark>');
      });
      return out;
    }
    function renderResults(){
      computeResults();
      const total = state.current.length;
      const visible = state.current.slice(0, state.page * state.pageSize);
      const capacity = state.current.reduce((sum, item) => sum + item.r.capacity, 0);
      $('resultSummary').textContent = \`\${nf.format(total)}건 · 대표 모집인원 \${nf.format(capacity)}명 · 현재 \${nf.format(visible.length)}건 표시 · \${summarizeFilters()}\`;
      $('moreBtn').style.display = visible.length < total ? 'inline-flex' : 'none';
      renderActiveFilters();
      if(!total){
        $('results').innerHTML = '<div class="empty"><h3 style="margin:0 0 8px">검색 결과가 없습니다.</h3><p style="margin:0">검색어를 줄이거나 지역·계열·모집인원 필터를 조정해 보세요.</p></div>';
        return;
      }
      $('results').innerHTML = visible.map(({r}) => cardHTML(r)).join('');
    }
    function flagBadges(r){
      const badges = [];
      if(r.matchLevel === 'exact' || r.matchLevel === 'strong') badges.push('<span class="badge match">' + esc(r.matchLabel) + '</span>');
      else badges.push('<span class="badge review">' + esc(r.matchLabel) + '</span>');
      if(r.capacity === 0) badges.push('<span class="badge zero">0명/미공개</span>');
      if(r.flags.length) badges.push('<span class="badge review">검토 필요</span>');
      return badges.join('');
    }
    function cardHTML(r){
      const courses = r.courses.slice(0, 7).join(' · ') || '교과·탐색 키워드 정보 없음';
      const careers = r.careers.slice(0, 5).join(' · ') || '관련 직업 정보 없음';
      const topics = r.topics.slice(0, 5).map(t => '<span class="badge">' + esc(t) + '</span>').join('');
      const compared = state.compare.includes(r.id);
      const district = r.district ? ' ' + r.district : '';
      const capValues = r.capacityValues.length > 1 ? '원자료 값 ' + r.capacityValues.join(', ') : '원자료 ' + r.rawRowCount + '행';
      return \`
        <article class="dept-card">
          <div class="dept-main">
            <div class="card-head">
              <div>
                <h3 class="dept-name">\${highlight(r.dept)}</h3>
                <div class="school-name">\${highlight(r.schoolDisplay)} · \${esc(r.region || '지역 정보 없음')}\${esc(district)}</div>
              </div>
            </div>
            <div class="badge-row">
              <span class="badge field">\${esc(r.field)}</span>
              <span class="badge">\${esc(r.capacityBand)}</span>
              <span class="badge">\${esc(r.campus || '캠퍼스 정보 없음')}</span>
              \${flagBadges(r)}
            </div>
            <div class="tag-list">\${topics}</div>
            <p class="preview"><b>교과·탐색 키워드</b> · \${highlight(courses)}</p>
            <p class="preview"><b>관련 직업</b> · \${highlight(careers)}</p>
          </div>
          <aside class="capacity-box" aria-label="모집인원">
            <span>대표 모집인원</span>
            <strong>\${nf.format(r.capacity)}</strong>
            <small>\${esc(capValues)}</small>
            <small>\${esc(r.matchLabel)} · 학교 내 \${nf.format(r.schoolDeptCount)}개 학과</small>
            <div class="card-actions">
              <button class="btn small primary" data-detail="\${r.id}" type="button">상세</button>
              <button class="btn small" data-compare="\${r.id}" type="button">\${compared ? '담김' : '비교'}</button>
            </div>
          </aside>
        </article>\`;
    }
    function getRecord(id){ return recordById.get(Number(id)); }
    function detailHTML(r){
      const district = r.district ? ' ' + r.district : '';
      const pill = (arr) => arr.length ? arr.map(c => '<span class="pill">' + esc(c) + '</span>').join('') : '<span class="pill">정보 없음</span>';
      const flags = r.flags.length ? r.flags.map(f => '- ' + f).join('\n') : '검토 플래그 없음';
      const questions = r.questions.map((q, i) => \`\${i + 1}. \${q}\`).join('\n');
      const summary = buildStudentSummary(r);
      return \`
        <div class="detail-grid">
          <div class="detail-box"><span>대표 모집인원</span><b>\${nf.format(r.capacity)}명</b></div>
          <div class="detail-box"><span>원자료 값</span><b>\${esc(r.capacityValues.join(', '))}</b></div>
          <div class="detail-box"><span>계열·분야</span><b>\${esc(r.field)}</b></div>
          <div class="detail-box"><span>자료 보강</span><b>\${esc(r.matchLabel)}</b></div>
          <div class="detail-box"><span>학교</span><b>\${esc(r.schoolDisplay)}</b></div>
          <div class="detail-box"><span>지역</span><b>\${esc(r.region || '정보 없음')}\${esc(district)}</b></div>
          <div class="detail-box"><span>학위/수업</span><b>\${esc(r.degree || '정보 없음')} · \${esc(r.time || '정보 없음')}</b></div>
          <div class="detail-box"><span>학교 규모</span><b>\${nf.format(r.schoolDeptCount)}개 학과 · \${nf.format(r.schoolCapacity)}명</b></div>
        </div>
        <h3 class="section-title">상담 주제 태그</h3>
        <div class="pill-wrap">\${pill(r.topics)}</div>
        <h3 class="section-title">교과·탐색 키워드</h3>
        <div class="pill-wrap">\${pill(r.courses)}</div>
        <h3 class="section-title">관련 직업</h3>
        <div class="pill-wrap">\${pill(r.careers)}</div>
        <h3 class="section-title">학생 상담 질문</h3>
        <div class="copy-box">\${esc(questions)}</div>
        <h3 class="section-title">자료 검토 메모</h3>
        <div class="copy-box">\${esc(flags)}</div>
        <h3 class="section-title">학생용 요약</h3>
        <div class="copy-box" id="summaryText">\${esc(summary)}</div>
        <div class="quick-row">
          <button class="btn primary" data-copy-summary="\${r.id}" type="button">학생용 요약 복사</button>
          <button class="btn" data-compare="\${r.id}" type="button">비교 담기</button>
        </div>
        <h3 class="section-title">비슷한 학과</h3>
        <div class="related-list">\${relatedHTML(r)}</div>\`;
    }
    function relatedHTML(r){
      const sourceTopics = new Set(r.topics);
      const deptTokens = norm(r.dept).split(' ').filter(t => t.length >= 2);
      const candidates = DATA.filter(x => x.id !== r.id).map(x => {
        let score = 0;
        x.topics.forEach(t => { if(sourceTopics.has(t)) score += 8; });
        if(x.field === r.field) score += 7;
        if(x.region && x.region === r.region) score += 3;
        deptTokens.forEach(t => { if(x._n.dept.includes(t)) score += 10; });
        score += Math.min(4, x.capacity / 100);
        return {r:x, score};
      }).filter(x => x.score > 0).sort((a,b) => b.score - a.score || b.r.capacity - a.r.capacity).slice(0,4);
      if(!candidates.length) return '<div class="copy-box">추천할 유사 학과 정보가 부족합니다.</div>';
      return candidates.map(({r:x}) => \`<button class="related-card" data-detail="\${x.id}" type="button"><b>\${esc(x.dept)}</b><span>\${esc(x.schoolDisplay)} · \${esc(x.region || '지역 정보 없음')} · \${nf.format(x.capacity)}명</span></button>\`).join('');
    }
    function buildStudentSummary(r){
      const district = r.district ? ' ' + r.district : '';
      const courses = r.courses.slice(0, 8).join(', ') || '정보 없음';
      const careers = r.careers.slice(0, 6).join(', ') || '정보 없음';
      const notes = r.flags.length ? r.flags.join('; ') : '특이사항 없음';
      return \`\${r.dept}
- 학교/지역: \${r.schoolDisplay} · \${r.region || '지역 정보 없음'}\${district}
- 대표 모집인원: \${nf.format(r.capacity)}명 (\${r.capacityBand})
- 계열·분야: \${r.field}
- 상담 주제: \${r.topics.slice(0,4).join(', ') || '정보 없음'}
- 교과·탐색 키워드: \${courses}
- 관련 직업: \${careers}
- 자료 확인: \${r.matchLabel}, \${notes}\`;
    }
    function openDetail(id){
      const r = getRecord(id);
      if(!r) return;
      const district = r.district ? ' ' + r.district : '';
      $('detailTitle').textContent = r.dept;
      $('detailSub').textContent = \`\${r.schoolDisplay} · \${r.region || '지역 정보 없음'}\${district} · 대표 모집인원 \${nf.format(r.capacity)}명\`;
      $('detailBody').innerHTML = detailHTML(r);
      $('detailModal').classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeDetail(){
      $('detailModal').classList.remove('active');
      document.body.style.overflow = '';
    }
    function renderCompare(){
      const selected = state.compare.map(getRecord).filter(Boolean);
      const zone = $('compareZone');
      if(!selected.length){ zone.classList.remove('active'); $('compareTable').innerHTML = ''; return; }
      zone.classList.add('active');
      $('compareTable').innerHTML = \`<div class="table-wrap"><table><thead><tr><th>학과</th><th>학교</th><th>지역</th><th>모집인원</th><th>계열</th><th>상담 주제</th><th>삭제</th></tr></thead><tbody>\${selected.map(r => \`
        <tr><td><b>\${esc(r.dept)}</b></td><td>\${esc(r.schoolDisplay)}</td><td>\${esc(r.region || '')}</td><td>\${nf.format(r.capacity)}명</td><td>\${esc(r.field)}</td><td>\${esc(r.topics.slice(0,4).join(', ') || '정보 없음')}</td><td><button class="btn small danger" data-remove-compare="\${r.id}" type="button">삭제</button></td></tr>
      \`).join('')}</tbody></table></div>\`;
    }
    function toggleCompare(id){
      id = Number(id);
      if(state.compare.includes(id)){
        state.compare = state.compare.filter(v => v !== id);
        toast('비교 목록에서 제거했습니다.');
      }else{
        if(state.compare.length >= 8){ toast('비교는 최대 8개까지 담을 수 있습니다.'); return; }
        state.compare.push(id);
        toast('비교 목록에 담았습니다.');
      }
      localStorage.setItem('careerDeptCompare2027', JSON.stringify(state.compare));
      renderCompare();
      renderResults();
    }
    function rowsToCsv(rows){
      const headers = ['학교','캠퍼스','학과','대표모집인원','원자료모집인원값','원자료행수','지역','시군구','계열분야','상담주제','교과탐색키워드','관련직업','자료보강상태','검토메모'];
      const body = rows.map(r => [r.school,r.campus,r.dept,r.capacity,r.capacityValues.join('|'),r.rawRowCount,r.region,r.district,r.field,r.topics.join('|'),r.courses.join('|'),r.careers.join('|'),r.matchLabel,r.flags.join('|')]);
      return [headers, ...body].map(row => row.map(cell => '"' + String(cell ?? '').replace(/"/g,'""') + '"').join(',')).join('\n');
    }
    function downloadCsv(rows, filename){
      const blob = new Blob(['\ufeff' + rowsToCsv(rows)], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
    function compareText(){
      const selected = state.compare.map(getRecord).filter(Boolean);
      return selected.map(buildStudentSummary).join('\n\n---\n\n');
    }
    function applyFromControls(){
      state.query = $('q').value.trim();
      state.school = $('schoolQuick').value.trim();
      state.filters.region = $('region').value;
      state.filters.field = $('field').value;
      state.filters.topic = $('topic').value;
      state.filters.capacityBand = $('capacityBand').value;
      state.filters.matchLevel = $('matchLevel').value;
      state.filters.reviewOnly = $('reviewOnly').checked;
      state.sort = $('sort').value;
      state.page = 1;
      renderResults();
    }
    function setControlsFromState(){
      $('q').value = state.query;
      $('schoolQuick').value = state.school;
      $('region').value = state.filters.region;
      $('field').value = state.filters.field;
      $('topic').value = state.filters.topic;
      $('capacityBand').value = state.filters.capacityBand;
      $('matchLevel').value = state.filters.matchLevel;
      $('reviewOnly').checked = state.filters.reviewOnly;
      $('sort').value = state.sort;
    }
    function resetAll(){
      state.query = '';
      state.school = '';
      state.filters = {region:'', field:'', topic:'', capacityBand:'', matchLevel:'', reviewOnly:false};
      state.sort = 'auto';
      state.page = 1;
      setControlsFromState();
      renderResults();
      toast('검색 조건을 초기화했습니다.');
    }
    document.addEventListener('click', async (e) => {
      const queryBtn = e.target.closest('[data-query]');
      if(queryBtn){
        $('q').value = queryBtn.dataset.query;
        applyFromControls();
        $('resultsTitle').scrollIntoView({behavior:'smooth', block:'start'});
      }
      const clearBtn = e.target.closest('[data-clear-filter]');
      if(clearBtn){
        const key = clearBtn.dataset.clearFilter;
        if(key === 'query') $('q').value = '';
        else if(key === 'school') $('schoolQuick').value = '';
        else if(key === 'reviewOnly') $('reviewOnly').checked = false;
        else if(key in state.filters) $(key).value = '';
        applyFromControls();
      }
      const detailBtn = e.target.closest('[data-detail]');
      if(detailBtn) openDetail(detailBtn.dataset.detail);
      const compareBtn = e.target.closest('[data-compare]');
      if(compareBtn) toggleCompare(compareBtn.dataset.compare);
      const removeBtn = e.target.closest('[data-remove-compare]');
      if(removeBtn) toggleCompare(removeBtn.dataset.removeCompare);
      const summaryBtn = e.target.closest('[data-copy-summary]');
      if(summaryBtn){
        const r = getRecord(summaryBtn.dataset.copySummary);
        if(r){ await copyText(buildStudentSummary(r)); toast('학생용 요약을 복사했습니다.'); }
      }
    });
    $('q').addEventListener('input', debounce(applyFromControls));
    $('schoolQuick').addEventListener('input', debounce(applyFromControls));
    $('searchBtn').addEventListener('click', applyFromControls);
    ['region','field','topic','capacityBand','matchLevel','sort'].forEach(id => $(id).addEventListener('change', applyFromControls));
    $('reviewOnly').addEventListener('change', applyFromControls);
    $('resetBtn').addEventListener('click', resetAll);
    $('moreBtn').addEventListener('click', () => { state.page += 1; renderResults(); });
    $('exportBtn').addEventListener('click', () => downloadCsv(state.current.map(x => x.r), '2027대학_학과검색_현재결과.csv'));
    $('downloadAllBtn').addEventListener('click', () => downloadCsv(DATA, '2027대학_개설학과_모집인원_정리.csv'));
    $('copySummaryBtn').addEventListener('click', async () => {
      const text = \`\${summarizeFilters()}\n검색 결과 \${nf.format(state.current.length)}건, 대표 모집인원 \${nf.format(state.current.reduce((s,x)=>s+x.r.capacity,0))}명\`;
      await copyText(text);
      toast('검색 요약을 복사했습니다.');
    });
    $('closeModalBtn').addEventListener('click', closeDetail);
    $('detailModal').addEventListener('click', (e) => { if(e.target.id === 'detailModal') closeDetail(); });
    document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeDetail(); });
    $('clearCompareBtn').addEventListener('click', () => {
      state.compare = [];
      localStorage.removeItem('careerDeptCompare2027');
      renderCompare(); renderResults(); toast('비교 목록을 비웠습니다.');
    });
    $('copyCompareBtn').addEventListener('click', async () => {
      const text = compareText();
      if(!text){ toast('비교 목록이 비어 있습니다.'); return; }
      await copyText(text);
      toast('비교표 내용을 복사했습니다.');
    });
    try{
      const saved = JSON.parse(localStorage.getItem('careerDeptCompare2027') || '[]');
      state.compare = Array.isArray(saved) ? saved.filter(id => recordById.has(id)).slice(0,8) : [];
    }catch(e){ state.compare = []; }

    if(!DATA.length){
      $('results').innerHTML = '<div class="empty"><h3 style="margin:0 0 8px">데이터를 불러오지 못했습니다.</h3><p style="margin:0">2027uni_data.js 파일이 같은 폴더에 있는지 확인해 주세요.</p></div>';
    }else{
      populateFilters();
      renderStats();
      renderDashboard();
      setControlsFromState();
      renderCompare();
      renderResults();
    }
  </script>
</body>
</html>`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
