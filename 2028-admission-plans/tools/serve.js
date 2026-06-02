const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const port = 8765;
http.createServer((req, res) => {
  let p = req.url === '/' ? '/unimap.html' : decodeURIComponent(req.url.split('?')[0]);
  const full = path.join(root, p);
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(full).toLowerCase();
    const ct = {
      '.html': 'text/html;charset=utf-8',
      '.json': 'application/json;charset=utf-8',
      '.pdf': 'application/pdf',
      '.js': 'text/javascript;charset=utf-8',
      '.css': 'text/css;charset=utf-8'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  });
}).listen(port, () => console.log(`serving D:\\claude\\2028claude on http://127.0.0.1:${port}`));
