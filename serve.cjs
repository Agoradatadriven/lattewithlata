// Zero-dependency static server for the Latte with Lata rebuild. Usage: node serve.cjs [port]  (or PORT env). Default 5178.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 5178);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('forbidden'); } // fixed 2026-09-17: a bare startsWith(ROOT) also matched sibling folders such as rebuild-v2
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404 ' + p); }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) { // media seeking
      const [s, e] = range.replace('bytes=', '').split('-');
      const start = Number(s) || 0, end = e ? Number(e) : st.size - 1;
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`; headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers); return fs.createReadStream(file, { start, end }).pipe(res);
    }
    headers['Content-Length'] = st.size; res.writeHead(200, headers); fs.createReadStream(file).pipe(res);
  });
});
server.listen(PORT, '127.0.0.1', () => console.log(`Latte with Lata rebuild -> http://localhost:${PORT}/`));
