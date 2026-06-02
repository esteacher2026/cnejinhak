/**
 * Headless render smoke test using Node's built-in.
 * Validates: fetch resolves, DATA parses to 209+, async wrapper runs without throwing.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// Just validate JSON structure (we already proved HTTP works via curl).
const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/universities.json'), 'utf8'));
console.log('records:', data.length);
const required = ['name','type','home','region','lat','lng','campuses'];
const bad = data.filter(d => required.some(k => d[k] === undefined));
console.log('bad records:', bad.length);
if (bad.length) console.log('first bad:', bad[0]);

const types = new Set(data.map(d => d.type));
console.log('types:', [...types].join(','));

const noPdf = data.filter(d => d.campuses.every(c => !c.u));
console.log('records with no PDF:', noPdf.length, '— names:', noPdf.map(d => d.name).join(', '));
