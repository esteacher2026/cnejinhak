const fs = require('fs');
const p = process.argv[2];
const data = JSON.parse(fs.readFileSync(p, 'utf8'));
fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
console.log('reformatted:', p, '— records:', data.length);
