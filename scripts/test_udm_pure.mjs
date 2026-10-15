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
