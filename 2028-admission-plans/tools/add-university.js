#!/usr/bin/env node
/**
 * 대학 추가 헬퍼.
 *
 * 사용법:
 *   node tools/add-university.js '<json-string>' [pdf-path-or-comma-separated]
 *
 * 예:
 *   node tools/add-university.js '{
 *     "name": "○○대학교",
 *     "type": "사립",
 *     "home": "https://...",
 *     "region": "경기",
 *     "lat": 37.5,
 *     "lng": 127.0,
 *     "campuses": [{"c":"본교"}]
 *   }' "D:\\Downloads\\모집요강.pdf"
 *
 * 클로드가 호출하는 게 가장 편함 — JSON 직접 만들고 PDF 복사까지 처리.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'universities.json');
const FILES_DIR = path.join(ROOT, 'files');

function nextPdfNumber() {
  if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
  const existing = fs.readdirSync(FILES_DIR)
    .map(f => f.match(/^2028-admission-plan-(\d{3})\.pdf$/i))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10));
  const max = existing.length ? Math.max(...existing) : 0;
  return max + 1;
}

function main() {
  const [, , entryJson, pdfArg] = process.argv;
  if (!entryJson) {
    console.error('Usage: node tools/add-university.js <json-string> [pdf-path[,pdf-path...]]');
    process.exit(1);
  }
  const entry = JSON.parse(entryJson);
  if (!entry.name || !entry.type || !entry.region || entry.lat == null || entry.lng == null) {
    console.error('Missing required fields: name, type, region, lat, lng');
    process.exit(1);
  }

  if (!entry.campuses || !entry.campuses.length) {
    entry.campuses = [{ c: '본교', u: '' }];
  }
  if (entry.added === undefined) entry.added = false;

  const pdfs = pdfArg ? pdfArg.split(',').map(s => s.trim()).filter(Boolean) : [];
  pdfs.forEach((src, i) => {
    if (!fs.existsSync(src)) {
      console.error(`PDF not found: ${src}`);
      process.exit(1);
    }
    const n = String(nextPdfNumber()).padStart(3, '0');
    const dstName = `2028-admission-plan-${n}.pdf`;
    fs.copyFileSync(src, path.join(FILES_DIR, dstName));
    const rel = `files/${dstName}`;
    if (entry.campuses[i]) entry.campuses[i].u = rel;
    else entry.campuses.push({ c: '본교', u: rel });
    console.log(`copied ${src} → ${dstName}`);
  });

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  data.push(entry);
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`added ${entry.name} (${entry.region}). Total: ${data.length}`);
}

main();
