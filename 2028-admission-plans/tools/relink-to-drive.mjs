// universities.json 의 로컬 files/ 링크를 4개 다운로드 도구의 구글드라이브 링크로 교체한다.
// - admission/report/jonghap : update-doc-links.mjs 의 별칭/수동매칭 로직을 그대로 재사용(제목 기반)
// - campuses[].u(시행계획)    : 전용 매처(제목 스코어 + 캠퍼스 라우팅 + 강원대 번호매핑)
// 드라이브 대응이 없는 필드는 링크를 제거(파일 전량 삭제 전제, 드라이브 전용 정책).
//   사용:  node tools/relink-to-drive.mjs          (dry-run, 변경 미적용)
//          node tools/relink-to-drive.mjs --apply  (universities.json 갱신)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');          // .../2028-admission-plans
const repoRoot = path.resolve(root, '..');           // .../cnejinhak  (data.js 위치)
const dataPath = path.join(root, 'data', 'universities.json');
const apply = process.argv.includes('--apply');

const driveView = (id) => `https://drive.google.com/file/d/${id}/view?usp=sharing`;

// ---- 다운로드 도구 데이터 로드 (window.* 에 배열을 심는다) ----
global.window = {};
for (const f of ['2027susi-download-data.js', '2028admission-plan-data.js', '2026prelearning-report-data.js', '2027hakjong-guide-data.js']) {
  await import(pathToFileURL(path.join(repoRoot, f)).href);
}
const SUSI = window.SUSI_GUIDES_2027;
const PLAN = window.ADMISSION_PLANS_2028;
const REPORT = window.PRELEARNING_REPORTS_2026;
const HAKJONG = window.HAKJONG_GUIDES_2027;

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const indexByRecord = new Map(data.map((record, index) => [record, index]));

// ====== update-doc-links.mjs 에서 가져온 매칭 로직 (제목 문자열 기반) ======
function norm(value) {
  return String(value || '').normalize('NFKC').toLowerCase()
    .replace(/[()[\]{}「」『』·ㆍ・\s_'",.+\-]/g, '');
}
function abbrev(name) {
  return name
    .replace(/여자대학교/g, '여대').replace(/교육대학교/g, '교대')
    .replace(/과학기술대학교/g, '과기대').replace(/공과대학교/g, '공대')
    .replace(/외국어대학교/g, '외대').replace(/기술교육대학교/g, '기술교육대')
    .replace(/체육대학교/g, '체대').replace(/신학대학교/g, '신학대')
    .replace(/장신대학교/g, '장신대').replace(/성서대학교/g, '성서대')
    .replace(/대학교/g, '대').replace(/대학$/g, '대');
}
function specialAliases(name) {
  const aliases = {
    국립강릉원주대학교: ['강릉원주대', '국립강릉원주대'],
    국립경국대학교: ['경국대', '국립경국대'],
    국립공주대학교: ['공주대', '국립공주대'],
    국립군산대학교: ['군산대', '국립군산대'],
    국립금오공과대학교: ['금오공대', '국립금오공대'],
    국립목포대학교: ['목포대', '국립목포대'],
    국립목포해양대학교: ['목포해양대', '국립목포해양대'],
    국립부경대학교: ['부경대', '국립부경대'],
    국립순천대학교: ['순천대', '국립순천대'],
    국립창원대학교: ['창원대', '국립창원대'],
    국립한국교통대학교: ['한국교통대', '국립한국교통대'],
    국립한국해양대학교: ['한국해양대', '국립한국해양대'],
    국립한밭대학교: ['한밭대', '국립한밭대'],
    대구예술대학교: ['대구예대'],
    서울과학기술대학교: ['서울과기대'],
    영산선학대학교: ['영선선학대'],
    한국기술교육대학교: ['한국기술교육대', '한국기술교대', '한기대', 'KOREATECH'],
    한국외국어대학교: ['한국외대'],
    한국체육대학교: ['한국체대'],
    한경국립대학교: ['한경귝립대'],
    호남신학대학교: ['호남신대'],
    포항공과대학교: ['POSTECH', '포스텍'],
    한국에너지공과대학교: ['KENTECH', '켄텍', '한국에너지공대'],
    한국예술종합학교: ['한예종'],
    한국과학기술원: ['KAIST', '카이스트'],
    '한국과학기술원(KAIST)': ['KAIST', '카이스트', '한국과학기술원'],
    '광주과학기술원(GIST)': ['GIST', '지스트', '광주과학기술원'],
    '대구경북과학기술원(DGIST)': ['DGIST', '디지스트', '대구경북과학기술원'],
    '울산과학기술원(UNIST)': ['UNIST', '유니스트', '울산과학기술원'],
    경찰대학: ['경찰대', '경찰대학교'],
    공군사관학교: ['공사'],
    국군간호사관학교: ['국간사'],
    육군사관학교: ['육사'],
    해군사관학교: ['해사'],
    한양대학교: ['한양대'],
    '한양대학교(ERICA)': ['한양대ERICA', '한양대에리카'],
    '동국대학교(WISE)': ['동국대WISE', '동국대와이즈'],
    '건국대학교(글로컬)': ['건국대글로컬'],
    '고려대학교(세종)': ['고려대세종'],
    '연세대학교(미래)': ['연세대미래'],
  };
  return aliases[name] || [];
}
function aliasesFor(record) {
  const aliases = new Set();
  const names = [record.name, record.name.replace(/^국립/, '').replace(/^공립/, '')];
  for (const name of names) { aliases.add(name); aliases.add(abbrev(name)); aliases.add(name.replace(/학교$/, '')); }
  for (const alias of specialAliases(record.name)) aliases.add(alias);
  return [...aliases].map((alias) => norm(alias)).filter((alias) => alias.length >= 2);
}
const aliasGroups = new Map();
for (const record of data) {
  for (const alias of aliasesFor(record)) {
    if (!aliasGroups.has(alias)) aliasGroups.set(alias, new Set());
    aliasGroups.get(alias).add(record);
  }
}
const aliasEntries = [...aliasGroups.entries()]
  .map(([alias, records]) => ({ alias, records: [...records] }))
  .sort((a, b) => b.alias.length - a.alias.length);

function recordsByName(name, region = '') {
  const records = data.filter((r) => r.name === name && (!region || r.region === region));
  if (!records.length) throw new Error(`대상 학교를 찾지 못했습니다: ${name}${region ? `/${region}` : ''}`);
  return records;
}
const fallbackLabels = { admission: '수시모집요강', report: '선행학습 보고서', jonghap: '학종 가이드북' };

// name = 드라이브 항목의 title (원본 파일명)
function manualTarget(category, name) {
  const compact = norm(name);
  const target = (school, region = '', label = '') => ({ records: recordsByName(school, region), label });
  if (category === 'admission') {
    if (/강원대.*강릉원주/.test(name)) return target('국립강릉원주대학교');
    if (/강원대.*춘천.*삼척/.test(name)) return target('강원대학교');
    if (/상명대.*서울/.test(name)) return target('상명대학교', '서울');
    if (/상명대.*천안/.test(name)) return target('상명대학교', '충남');
    if (/국립창원대.*남해전형기간자율화/.test(name)) return target('국립창원대학교', '', '남해 전형기간 자율화');
    if (/국립창원대.*거창/.test(name)) return target('국립창원대학교', '', '거창캠퍼스 수시모집요강');
    if (/국립창원대.*남해/.test(name)) return target('국립창원대학교', '', '남해캠퍼스 수시모집요강');
    if (/국립창원대.*창원/.test(name)) return target('국립창원대학교', '', '창원캠퍼스 수시모집요강');
  }
  if (category === 'report') {
    if (/국립창원대학교.*남해/.test(name)) return target('국립창원대학교', '', '남해캠퍼스 선행학습 보고서');
    if (/국립창원대학교.*창원/.test(name)) return target('국립창원대학교', '', '창원캠퍼스 선행학습 보고서');
  }
  if (category === 'jonghap') {
    if (/강원대.*춘천.*삼척/.test(name)) return target('강원대학교');
    if (/한양대.*에리카/i.test(name) || /한양대.*ERICA/i.test(name)) return target('한양대학교(ERICA)');
    if (/홍익대.*미술/.test(name)) return target('홍익대학교', '', '미술계열 가이드북');
    if (/홍익대/.test(name)) return target('홍익대학교', '', '학생부종합 가이드북');
    if (/성신.*농/.test(name)) return target('성신여자대학교', '', '농어촌 입학정보 안내서');
    if (/성신/.test(name)) return target('성신여자대학교', '', '학생부위주전형 가이드북');
  }
  if (compact.includes(norm('POSTECH'))) return target('포항공과대학교');
  if (compact.includes(norm('KENTECH'))) return target('한국에너지공과대학교');
  if (compact.includes(norm('KAIST'))) return target('한국과학기술원(KAIST)');
  if (compact.includes(norm('DGIST'))) return target('대구경북과학기술원(DGIST)');
  if (compact.includes(norm('GIST'))) return target('광주과학기술원(GIST)');
  if (compact.includes(norm('UNIST'))) return target('울산과학기술원(UNIST)');
  if (compact.includes(norm('한국기술교대'))) return target('한국기술교육대학교');
  if (compact.includes(norm('한예종'))) return target('한국예술종합학교');
  if (compact.includes(norm('경찰대학교'))) return target('경찰대학');
  if (compact.includes(norm('공사')) && compact.includes(norm('선행'))) return target('공군사관학교');
  if (compact.includes(norm('해사')) && compact.includes(norm('선행'))) return target('해군사관학교');
  if (compact.includes(norm('육사')) && compact.includes(norm('선행'))) return target('육군사관학교');
  if (compact.includes(norm('국간사')) && compact.includes(norm('선행'))) return target('국군간호사관학교');
  return null;
}
function autoTarget(name) {
  const compact = norm(name);
  const hit = aliasEntries.find((entry) => compact.includes(entry.alias));
  if (!hit) return null;
  return { records: hit.records, label: '' };
}
function scoreSource(category, name) {
  let score = 100; // 모두 PDF로 간주(드라이브)
  if (/2027학년도|2027/.test(name)) score += 10;
  if (/2026학년도|2026/.test(name)) score += 5;
  if (/보고서/.test(name)) score += 10;
  if (/최종|공개용|공지용/.test(name)) score += 2;
  if (/\(ocr\)/i.test(name)) score -= 20;
  if (/\(1\)/.test(name)) score -= 10;
  if (category === 'jonghap' && /(학생부종합|학생부위주|학종)/.test(name)) score += 20;
  if (category === 'jonghap' && /(미술|농·어촌|농어촌)/.test(name)) score += 5;
  return score;
}
function primaryRank(doc) {
  const label = doc.label || '';
  const name = doc.name || '';
  if (/창원캠퍼스/.test(label)) return 0;
  if (/학생부종합|학생부위주|학종/.test(label + name)) return 1;
  if (/거창/.test(label)) return 2;
  if (/남해/.test(label)) return 3;
  if (/미술|농어촌|농·어촌/.test(label + name)) return 4;
  return 1;
}
function groupKey(category, records) {
  return `${category}|${records.map((r) => indexByRecord.get(r)).sort((a, b) => a - b).join(',')}`;
}

// ====== admission / report / jonghap 매칭 ======
const docSources = { admission: SUSI, report: REPORT, jonghap: HAKJONG };
const report = { dropped: [], assigned: {}, unmatchedDrive: {}, plan: {} };

function assignDocCategory(category) {
  const list = docSources[category];
  const groups = new Map();
  const unmatchedDrive = [];
  for (const entry of list) {
    const name = entry.title || '';
    const t = manualTarget(category, name) || autoTarget(name);
    if (!t) { unmatchedDrive.push(entry.university || name); continue; }
    const key = groupKey(category, t.records);
    if (!groups.has(key)) groups.set(key, { records: t.records, docs: [] });
    groups.get(key).docs.push({ label: t.label || '', id: entry.id, name, score: scoreSource(category, name) });
  }
  const assignedRecords = new Set();
  for (const group of groups.values()) {
    const bestByLabel = new Map();
    for (const doc of group.docs) {
      const k = doc.label || fallbackLabels[category];
      const old = bestByLabel.get(k);
      if (!old || doc.score > old.score) bestByLabel.set(k, doc);
    }
    const docs = [...bestByLabel.values()].sort((a, b) => primaryRank(a) - primaryRank(b) || b.score - a.score);
    const needsObjects = docs.length > 1 || docs.some((d) => (d.label || fallbackLabels[category]) !== fallbackLabels[category]);
    const value = needsObjects
      ? docs.map((d) => ({ label: d.label || fallbackLabels[category], href: driveView(d.id) }))
      : driveView(docs[0].id);
    for (const record of group.records) { record[category] = value; assignedRecords.add(record); }
  }
  // 드라이브 대응이 없어 남은 로컬 링크 제거
  for (const record of data) {
    if (record[category] && !assignedRecords.has(record)) {
      report.dropped.push(`${category}\t${record.name}(${record.region})`);
      delete record[category];
    }
  }
  report.assigned[category] = assignedRecords.size;
  report.unmatchedDrive[category] = unmatchedDrive;
}
assignDocCategory('admission');
assignDocCategory('report');
assignDocCategory('jonghap');

// ====== 시행계획(campuses[].u) 매칭 ======
const baseName = (n) => n.replace(/\s*\([^)]*\)\s*/g, '').trim();
function planScore(e) {
  const t = e.title || '';
  let s = 20; // plan 관련 기본(주요사항/기타자료 등도 그 학교가 올린 유일 문서일 수 있어 양수 유지)
  if (/시행계획|전형계획/.test(t)) s = 100;
  else if (/기본계획/.test(t)) s = 60;
  else if (/모집요강|모집계획/.test(t)) s = 40;
  else if (/주요\s*사항/.test(t)) s = 30;
  if (/모집인원|모집단위별/.test(t)) s -= 90; // 엑셀 모집인원표는 시행계획 아님
  if (/재외국민|외국인/.test(t)) s -= 15;
  if (e.fileType === 'PDF') s += 5;
  else if (e.fileType === 'XLSX') s -= 60;
  return s;
}
// 괄호 캠퍼스 레코드(연세대(미래) 등) → 캠퍼스 키워드
function campusTokens(name) {
  const m = name.match(/\(([^)]+)\)/);
  if (!m) return [];
  const inner = m[1].toUpperCase();
  const map = { ERICA: ['erica', '에리카'], WISE: ['wise', '와이즈'], 글로컬: ['글로컬'], 세종: ['세종'], 미래: ['미래'] };
  for (const [k, v] of Object.entries(map)) if (inner.includes(k.toUpperCase())) return v;
  return [norm(m[1])];
}
const CITY_REGION = { 천안: '충남' };

// PLAN 항목 → 후보 레코드(같은 base 이름 묶음). 제목 기반 매칭(GIST/DGIST 등 정확) 후 university 폴백.
function resolveCandidates(e) {
  let t = manualTarget('plan', e.title) || autoTarget(e.title);
  let recs = t ? t.records : [];
  if (!recs.length) {
    const k = norm(String(e.university || '').replace(/\([^)]*\)/g, ''));
    if (k.length >= 2) {
      const hit = aliasEntries.find((en) => en.alias === k)
        || aliasEntries.find((en) => en.alias.length >= 3 && k.includes(en.alias));
      recs = hit ? hit.records : [];
    }
  }
  if (!recs.length) return [];
  const bases = new Set(recs.map((r) => baseName(r.name)));
  return data.filter((r) => bases.has(baseName(r.name)));
}
// PLAN 항목을 base-name 대학 단위로 묶는다(같은 대학의 지역분리/괄호캠퍼스 레코드를 함께 처리)
const planByBase = new Map(); // base -> { records, entries }
const planOrphan = [];
for (const e of PLAN) {
  if (planScore(e) <= 0) continue; // 엑셀 모집인원 등 비-plan 문서 제외
  const cands = resolveCandidates(e);
  if (!cands.length) { planOrphan.push(e.university); continue; }
  const base = baseName(cands[0].name);
  if (!planByBase.has(base)) planByBase.set(base, { records: cands, entries: [] });
  planByBase.get(base).entries.push(e);
}

const planAssignedCampus = new Set(); // "recIdx#campIdx"
const setCampus = (record, i, id) => { record.campuses[i].u = driveView(id); planAssignedCampus.add(`${indexByRecord.get(record)}#${i}`); };
const etextOf = (e) => `${e.campus || ''} ${e.title || ''}`.normalize('NFKC').toLowerCase();
const bestOf = (arr) => arr.slice().sort((a, b) => planScore(b) - planScore(a))[0];

// 한 레코드에 맞는 항목 선택: 괄호토큰 > 도시→지역 > (캠퍼스명시)지역명 > 전체용(공백) > 최고점
function pickEntryForRecord(record, entries) {
  const tokens = campusTokens(record.name);
  if (tokens.length) { const m = bestOf(entries.filter((e) => tokens.some((t) => etextOf(e).includes(t)))); if (m) return m; }
  const cityHit = bestOf(entries.filter((e) => Object.entries(CITY_REGION).some(([city, r]) => r === record.region && etextOf(e).includes(city))));
  if (cityHit) return cityHit;
  const reg = norm(record.region);
  const regHit = bestOf(entries.filter((e) => e.campus && reg.length >= 2 && etextOf(e).includes(reg)));
  if (regHit) return regHit;
  return bestOf(entries.filter((e) => !e.campus)) || bestOf(entries);
}

let planRecordsAssigned = 0;
for (const { records, entries } of planByBase.values()) {
  for (const record of records) {
    // 강원대: 시행계획 제목 선두번호(1춘천 2강릉 3삼척 4원주) → 캠퍼스 순서
    if (record.name === '강원대학교' && record.campuses.length > 1) {
      const sihaeng = entries.filter((e) => e.docType === '시행계획')
        .sort((a, b) => (parseInt((a.title.match(/(\d+)/) || [])[1] || '99', 10) - parseInt((b.title.match(/(\d+)/) || [])[1] || '99', 10)));
      const log = [];
      record.campuses.forEach((c, i) => { if (sihaeng[i]) { setCampus(record, i, sihaeng[i].id); log.push(`${c.c}→${sihaeng[i].campus}`); } else log.push(`${c.c}→(없음)`); });
      report.plan['강원대학교'] = log.join(', ');
      planRecordsAssigned++; continue;
    }
    // 국립창원대: 본교→창원 / 제2·제3→거창,남해
    if (record.name === '국립창원대학교' && record.campuses.length > 1) {
      const changwon = entries.find((e) => /창원/.test(e.title) && !/거창|남해/.test(e.title));
      const combo = entries.find((e) => /거창|남해/.test(e.title));
      const log = [];
      record.campuses.forEach((c, i) => { const pick = i === 0 ? (changwon || combo) : (combo || changwon); if (pick) { setCampus(record, i, pick.id); log.push(`${c.c}→${pick.campus}`); } else log.push(`${c.c}→(없음)`); });
      report.plan['국립창원대학교'] = log.join(', ');
      planRecordsAssigned++; continue;
    }
    const pick = pickEntryForRecord(record, entries);
    if (!pick) continue;
    record.campuses.forEach((c, i) => setCampus(record, i, pick.id));
    planRecordsAssigned++;
    if (record.campuses.length > 1 || /\(/.test(record.name) || records.length > 1) {
      report.plan[`${record.name}${records.length > 1 ? `[${record.region}]` : ''}`] = `${record.campuses.map((c) => c.c).join('/')} → [${pick.campus || '공백'}] ${pick.title.slice(0, 34)}`;
    }
  }
}

// 드라이브 대응 없는 campus u 제거
for (const record of data) {
  if (!record.campuses) continue;
  record.campuses.forEach((c, i) => {
    if (c.u && c.u.startsWith('files/') && !planAssignedCampus.has(`${indexByRecord.get(record)}#${i}`)) {
      report.dropped.push(`plan\t${record.name}(${record.region})/${c.c}`);
      delete c.u;
    }
  });
}
report.unmatchedDrive.plan = [...new Set(planOrphan)];

// ====== 검증: files/ 잔존 여부 ======
const leftover = [];
for (const record of data) {
  const blob = JSON.stringify(record);
  if (blob.includes('files/')) leftover.push(record.name);
}

// ====== 리포트 ======
console.log(JSON.stringify({
  mode: apply ? 'APPLY' : 'dry-run',
  assigned: report.assigned,
  planRecordsAssigned,
  droppedLinks: report.dropped.length,
  leftoverFilesRefs: leftover.length,
}, null, 2));
console.log('\n[시행계획 다중/괄호 캠퍼스 배정]');
for (const [k, v] of Object.entries(report.plan)) console.log(`  ${k}: ${v}`);
if (report.dropped.length) {
  console.log('\n[드라이브 대응 없어 링크 제거됨 → 버튼 미표시/준비중]');
  for (const d of report.dropped) console.log('  ' + d);
}
console.log('\n[드라이브엔 있으나 레코드 매칭 실패(고아, 참고용)]');
for (const [cat, arr] of Object.entries(report.unmatchedDrive)) {
  if (arr.length) console.log(`  ${cat}: ${[...new Set(arr)].join(', ')}`);
}
if (leftover.length) console.log('\n⚠ files/ 참조가 남은 레코드:', leftover.join(', '));

if (apply) {
  fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log('\n✅ universities.json 갱신 완료');
} else {
  console.log('\n(dry-run: 변경 미적용. --apply 로 실제 반영)');
}
