import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'udm_src', 'pure.js'), 'utf8');
const UDM = new Function(src + '\n;return UDM;')();

test('tabFromHash', () => {
  assert.equal(UDM.tabFromHash('#univDB-matrix'), 'matrix');
  assert.equal(UDM.tabFromHash('#univDB'), 'search');
  assert.equal(UDM.tabFromHash(''), 'search');
});

const S = [
  { key: 'kor', group: 'kor' }, { key: 'alg', group: 'math' }, { key: 'calc2', group: 'math' },
  { key: 'eng', group: 'eng' }, { key: 'soc', group: 'soc' }, { key: 'phy', group: 'sci' }, { key: 'chem', group: 'sci' }
];
const G = [{ key: 'kor' }, { key: 'math' }, { key: 'eng' }, { key: 'soc' }, { key: 'sci' }];
const R = [
  { id: 'a', srcRow: 20, unit: 'mech-eng', marks: ['calc2', 'phy'], groups: [], allSubjects: false, excluded: false },
  { id: 'b', srcRow: 10, unit: 'mech-eng', marks: ['kor'], groups: ['math'], allSubjects: false, excluded: false },
  { id: 'c', srcRow: 30, unit: 'mech-eng', marks: [], groups: ['kor', 'math', 'eng', 'soc', 'sci'], allSubjects: true, excluded: false },
  { id: 'x', srcRow: 40, unit: 'mech-eng', marks: ['phy'], groups: [], allSubjects: false, excluded: true },
  { id: 'd', srcRow: 5, unit: 'physics', marks: ['phy'], groups: [], allSubjects: false, excluded: false }
];

test('indexByUnit drops excluded and sorts by srcRow', () => {
  const idx = UDM.indexByUnit(R);
  assert.deepEqual(idx.get('mech-eng').map(r => r.id), ['b', 'a', 'c']);
  assert.deepEqual(idx.get('physics').map(r => r.id), ['d']);
  assert.equal(idx.has('music'), false);
});

test('footerCounts counts marks and whole-group bands', () => {
  const fc = UDM.footerCounts(UDM.indexByUnit(R).get('mech-eng'), S, G);
  assert.deepEqual(fc.marks, { kor: 1, alg: 0, calc2: 1, eng: 0, soc: 0, phy: 1, chem: 0 });
  assert.deepEqual(fc.groups, { kor: 1, math: 2, eng: 1, soc: 1, sci: 1 });
});

test('footerCounts on empty input is all zeros', () => {
  const fc = UDM.footerCounts([], S, G);
  assert.equal(Object.values(fc.marks).reduce((a, b) => a + b, 0), 0);
  assert.equal(Object.values(fc.groups).reduce((a, b) => a + b, 0), 0);
});

const SBG = { kor: ['kor'], math: ['alg', 'calc2'], eng: ['eng'], soc: ['soc'], sci: ['phy', 'chem'] };

test('evaluate: all marks checked → ok', () => {
  const r = { marks: ['calc2', 'phy'], groups: [], allSubjects: false };
  assert.deepEqual(UDM.evaluate(r, new Set(['calc2', 'phy', 'kor']), SBG), { ok: true, na: false, missing: [], groupsMissing: [] });
});
test('evaluate: missing marks listed in record order', () => {
  const r = { marks: ['alg', 'calc2', 'phy'], groups: [], allSubjects: false };
  assert.deepEqual(UDM.evaluate(r, new Set(['calc2']), SBG), { ok: false, na: false, missing: ['alg', 'phy'], groupsMissing: [] });
});
test('evaluate: whole group needs ≥1 subject of that group', () => {
  const r = { marks: ['kor'], groups: ['math', 'sci'], allSubjects: false };
  assert.deepEqual(UDM.evaluate(r, new Set(['kor', 'alg']), SBG), { ok: false, na: false, missing: [], groupsMissing: ['sci'] });
  assert.equal(UDM.evaluate(r, new Set(['kor', 'alg', 'chem']), SBG).ok, true);
});
test('evaluate: empty selection fails everything incl. allSubjects', () => {
  assert.equal(UDM.evaluate({ marks: [], groups: ['kor', 'math', 'eng', 'soc', 'sci'], allSubjects: true }, new Set(), SBG).ok, false);
  assert.equal(UDM.evaluate({ marks: [], groups: ['kor', 'math', 'eng', 'soc', 'sci'], allSubjects: true }, new Set(['eng']), SBG).ok, true);
  assert.equal(UDM.evaluate({ marks: ['phy'], groups: [], allSubjects: false }, new Set(), SBG).ok, false);
});
test('evaluate: record with nothing judgeable (etc only) is na, never ok', () => {
  const r = { marks: [], groups: [], allSubjects: false };
  assert.deepEqual(UDM.evaluate(r, new Set(), SBG), { ok: false, na: true, missing: [], groupsMissing: [] });
  assert.equal(UDM.evaluate(r, new Set(['kor', 'eng']), SBG).ok, false);
  assert.equal(UDM.evaluate({ marks: ['kor'], groups: [], allSubjects: false }, new Set(['kor']), SBG).na, false);
});

test('subjectCoverage with and without whole-group bands', () => {
  const recs = UDM.indexByUnit(R).get('mech-eng');     // b(kor + math 전체), a(calc2, phy), c(전 교과)
  assert.deepEqual(UDM.subjectCoverage(recs, 'calc2', 'math', false).map(r => r.id), ['a']);
  assert.deepEqual(UDM.subjectCoverage(recs, 'calc2', 'math', true).map(r => r.id), ['b', 'a', 'c']);
  assert.deepEqual(UDM.subjectCoverage(recs, 'eng', 'eng', true).map(r => r.id), ['c']);
  assert.deepEqual(UDM.subjectCoverage([], 'eng', 'eng', true), []);
});

const F1 = [
  { id: 'k1', university_display: '고려대', unit_name: '기계공학부', unit_parent: '공과대학' },
  { id: 'k2', university_display: '고려대', unit_name: '화공생명공학과', unit_parent: '공과대학' },
  { id: 'a1', university_display: '아주대', unit_name: '소프트웨어학과', unit_parent: '소프트웨어융합대학' },
  { id: 'a2', university_display: '아주대', unit_name: '사이버보안학과', unit_parent: '소프트웨어융합대학' },
  { id: 'd1', university_display: '단국대', unit_name: '공과대학', unit_parent: null }
];
test('matchUnitRecords: exact single hit, multi hit, none, null key', () => {
  assert.deepEqual(UDM.matchUnitRecords(F1, '고려대', ['기계']).map(r => r.id), ['k1']);
  assert.deepEqual(UDM.matchUnitRecords(F1, '아주대', ['컴퓨터', '소프트웨어']).map(r => r.id), ['a1', 'a2']);
  assert.deepEqual(UDM.matchUnitRecords(F1, '단국대', ['기계']), []);
  assert.deepEqual(UDM.matchUnitRecords(F1, null, ['기계']), []);
});
test('pickKeyword prefers the keyword matching most hits', () => {
  const hits = UDM.matchUnitRecords(F1, '아주대', ['컴퓨터', '소프트웨어']);
  assert.equal(UDM.pickKeyword(hits, ['컴퓨터', '소프트웨어']), '소프트웨어');
  assert.equal(UDM.pickKeyword([], ['컴퓨터']), '');
});
