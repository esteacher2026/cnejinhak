import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const filesDir = path.join(root, 'files');
const dataPath = path.join(root, 'data', 'universities.json');
const home = os.homedir();
const apply = process.argv.includes('--apply');

const sources = {
  admission: path.join(home, 'Downloads', '2027 수시모집 요강(20260605)'),
  report: path.join(home, 'Downloads', '2026 선행학습영향평가 보고서(20260404)'),
  jonghap: path.join(home, 'Downloads', '2027 학생부 종합전형 가이드북(0611)', '2027 학생부 종합전형 가이드북(0611)'),
};

const prefixes = {
  admission: '2027-admission-guide',
  report: '2026-prior-learning',
  jonghap: '2027-jonghap-guide',
};

const fallbackLabels = {
  admission: '수시모집요강',
  report: '선행학습 보고서',
  jonghap: '학종 가이드북',
};

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const indexByRecord = new Map(data.map((record, index) => [record, index]));

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function norm(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[()[\]{}「」『』·ㆍ・\s_'",.+\-]/g, '');
}

function extname(filePath) {
  return path.extname(filePath).toLowerCase();
}

function docItems(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value])
    .map((item) => {
      if (typeof item === 'string') return { href: item, label: '' };
      return { href: item.href || item.url || item.u || '', label: item.label || '' };
    })
    .filter((item) => item.href);
}

function abbrev(name) {
  return name
    .replace(/여자대학교/g, '여대')
    .replace(/교육대학교/g, '교대')
    .replace(/과학기술대학교/g, '과기대')
    .replace(/공과대학교/g, '공대')
    .replace(/외국어대학교/g, '외대')
    .replace(/기술교육대학교/g, '기술교육대')
    .replace(/체육대학교/g, '체대')
    .replace(/신학대학교/g, '신학대')
    .replace(/장신대학교/g, '장신대')
    .replace(/성서대학교/g, '성서대')
    .replace(/대학교/g, '대')
    .replace(/대학$/g, '대');
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
  for (const name of names) {
    aliases.add(name);
    aliases.add(abbrev(name));
  }
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
  const records = data.filter((record) => record.name === name && (!region || record.region === region));
  if (!records.length) throw new Error(`대상 학교를 찾지 못했습니다: ${name}${region ? `/${region}` : ''}`);
  return records;
}

function manualTarget(category, filePath) {
  const name = path.basename(filePath);
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

function autoTarget(filePath) {
  const compact = norm(path.basename(filePath));
  const hit = aliasEntries.find((entry) => compact.includes(entry.alias));
  if (!hit) return null;
  return { records: hit.records, label: '' };
}

function shouldInclude(category, filePath) {
  const ext = extname(filePath);
  const name = path.basename(filePath);
  if (category === 'admission') {
    if (!['.pdf', '.hwp', '.hwpx'].includes(ext)) return false;
    return !/사관학교경찰대학\s*정리/.test(name);
  }
  if (category === 'report') {
    if (!['.pdf', '.hwp', '.hwpx'].includes(ext)) return false;
    if (/경기도교육청|남서을/.test(name)) return false;
    if (/2025학년도/.test(name)) return false;
    if (!/(선행|자체평가|보고서)/.test(name)) return false;
    if (/(기출문제|문제지|답안지|면접문항|논술\(AAT\)|논술문제지)/.test(name)) return false;
    if (/자료/.test(name) && !/보고서/.test(name)) return false;
    return true;
  }
  if (category === 'jonghap') return ext === '.pdf';
  return false;
}

function scoreSource(category, filePath) {
  const name = path.basename(filePath);
  const ext = extname(filePath);
  let score = ext === '.pdf' ? 100 : 50;
  if (/2027학년도|2027/.test(name)) score += 10;
  if (/2026학년도|2026/.test(name)) score += 5;
  if (/보고서/.test(name)) score += 10;
  if (/최종|공개용|공지용/.test(name)) score += 2;
  if (/\(ocr\)/i.test(name)) score -= 20;
  if (/\(1\)/.test(name)) score -= 10;
  if (/남서을/.test(name)) score -= 40;
  if (category === 'jonghap' && /(학생부종합|학생부위주|학종)/.test(name)) score += 20;
  if (category === 'jonghap' && /(미술|농·어촌|농어촌)/.test(name)) score += 5;
  return score;
}

function primaryRank(doc) {
  const label = doc.label || '';
  const name = path.basename(doc.source);
  if (/창원캠퍼스/.test(label)) return 0;
  if (/학생부종합|학생부위주|학종/.test(label + name)) return 1;
  if (/거창/.test(label)) return 2;
  if (/남해/.test(label)) return 3;
  if (/미술|농어촌|농·어촌/.test(label + name)) return 4;
  return 1;
}

function groupKey(category, records) {
  return `${category}|${records.map((record) => indexByRecord.get(record)).sort((a, b) => a - b).join(',')}`;
}

function maxManagedNumber(prefix) {
  if (!fs.existsSync(filesDir)) return 0;
  const re = new RegExp(`^${prefix}-(\\d+)\\.`, 'i');
  return fs.readdirSync(filesDir)
    .map((name) => name.match(re)?.[1])
    .filter(Boolean)
    .map(Number)
    .reduce((max, value) => Math.max(max, value), 0);
}

function nextHref(prefix, filePath, counters) {
  counters[prefix] += 1;
  return `files/${prefix}-${String(counters[prefix]).padStart(3, '0')}${extname(filePath)}`;
}

function hashFile(filePath) {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

function sameFile(source, href) {
  const dest = path.join(root, href);
  return fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(source).size && hashFile(dest) === hashFile(source);
}

const groups = new Map();
const unmatched = [];

for (const [category, sourceDir] of Object.entries(sources)) {
  for (const filePath of walk(sourceDir)) {
    if (!shouldInclude(category, filePath)) continue;
    const target = manualTarget(category, filePath) || autoTarget(filePath);
    if (!target) {
      unmatched.push({ category, file: filePath });
      continue;
    }
    const key = groupKey(category, target.records);
    if (!groups.has(key)) groups.set(key, { category, records: target.records, docs: [] });
    groups.get(key).docs.push({
      source: filePath,
      label: target.label || '',
      score: scoreSource(category, filePath),
    });
  }
}

for (const group of groups.values()) {
  const bestByLabel = new Map();
  for (const doc of group.docs) {
    const key = doc.label || fallbackLabels[group.category];
    const old = bestByLabel.get(key);
    if (!old || doc.score > old.score) bestByLabel.set(key, doc);
  }
  group.docs = [...bestByLabel.values()].sort((a, b) => primaryRank(a) - primaryRank(b) || b.score - a.score || a.source.localeCompare(b.source, 'ko'));
}

const counters = Object.fromEntries(Object.values(prefixes).map((prefix) => [prefix, maxManagedNumber(prefix)]));
const copies = [];
const fieldUpdates = [];

for (const group of [...groups.values()].sort((a, b) => groupKey(a.category, a.records).localeCompare(groupKey(b.category, b.records)))) {
  const prefix = prefixes[group.category];
  const existingHrefs = [...new Set(group.records.flatMap((record) => docItems(record[group.category]).map((item) => item.href)))];
  const usedHrefs = new Set();
  const newItems = [];

  for (const [index, doc] of group.docs.entries()) {
    const sourceExt = extname(doc.source);
    let href = existingHrefs.find((candidate) => !usedHrefs.has(candidate) && extname(candidate) === sourceExt);
    if (!href && index === 0 && existingHrefs[0] && extname(existingHrefs[0]) === sourceExt) href = existingHrefs[0];
    if (!href) href = nextHref(prefix, doc.source, counters);
    usedHrefs.add(href);
    const label = doc.label || fallbackLabels[group.category];
    newItems.push({ href, label, source: doc.source });
    copies.push({ source: doc.source, href, changed: !sameFile(doc.source, href) });
  }

  const needsObjects = newItems.length > 1 || newItems.some((item) => item.label !== fallbackLabels[group.category]);
  const value = needsObjects
    ? newItems.map((item) => ({ label: item.label, href: item.href }))
    : newItems[0]?.href;

  for (const record of group.records) {
    const before = JSON.stringify(record[group.category] || null);
    record[group.category] = value;
    const after = JSON.stringify(record[group.category] || null);
    if (before !== after) fieldUpdates.push({ school: record.name, region: record.region, category: group.category, before, after });
  }
}

const changedCopies = copies.filter((copy) => copy.changed);

if (apply) {
  fs.mkdirSync(filesDir, { recursive: true });
  for (const copy of changedCopies) {
    fs.copyFileSync(copy.source, path.join(root, copy.href));
  }
  fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const counts = {
  mode: apply ? 'apply' : 'dry-run',
  groups: groups.size,
  sourceDocs: [...groups.values()].reduce((sum, group) => sum + group.docs.length, 0),
  fileCopiesNeeded: changedCopies.length,
  fieldUpdates: fieldUpdates.length,
  unmatched: unmatched.length,
};

console.log(JSON.stringify(counts, null, 2));
if (fieldUpdates.length) {
  console.log('\n[field updates]');
  for (const item of fieldUpdates) console.log(`${item.category}\t${item.school}\t${item.region}`);
}
if (changedCopies.length) {
  console.log('\n[file copies]');
  for (const item of changedCopies) console.log(`${item.href}\t${path.basename(item.source)}`);
}
if (unmatched.length) {
  console.log('\n[unmatched]');
  for (const item of unmatched) console.log(`${item.category}\t${item.file}`);
}
