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
