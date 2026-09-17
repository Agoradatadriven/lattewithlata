// Static file handler - same behaviour as serve.cjs (MIME table, index.html for "/", Range support for media,
// Cache-Control: no-cache) plus: strict path-traversal checks, a deny list (data/, lib/, test/, verify/, node_modules/,
// dotfiles, server-side sources, *.md docs) and security headers with a hash-based Content-Security-Policy for HTML pages.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream');
const { securityHeaders, cspForPage } = require('./http.cjs');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };

const DENY_DIRS = new Set(['data', 'lib', 'test', 'node_modules', 'verify']); // first path segment, compared lower-cased (verify/ = internal QA reports)
const DENY_EXT = new Set(['.cjs', '.log', '.bak', '.tmp', '.env', '.md']);       // server sources, leftovers, internal docs (API.md, PAGES-SPEC.md ...)

const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
const isInside = (file, dir) => { const f = norm(file), d = norm(dir); return f === d || f.startsWith(d.endsWith(path.sep) ? d : d + path.sep); };

function plain(res, status, text) {
  res.writeHead(status, securityHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': cspForPage([]) }));
  res.end(text);
}

// sha256 hashes of the inline <script> blocks of an HTML file, cached by mtime + size. The HTML parser normalises
// CR LF to LF before the browser hashes the block, so we do the same.
const hashCache = new Map();
function inlineScriptHashes(file, st) {
  const hit = hashCache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.hashes;
  const hashes = [];
  try {
    const html = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    let m;
    while ((m = re.exec(html))) {
      if (/\bsrc\s*=/.test(m[1]) || !m[2]) continue;
      const h = `sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}`;
      if (!hashes.includes(h)) hashes.push(h);
    }
  } catch { /* unreadable: no inline scripts allowed */ }
  hashCache.set(file, { mtimeMs: st.mtimeMs, size: st.size, hashes });
  return hashes;
}

/** Resolve a request path to a file under root, or return a { status, text } refusal. */
function resolvePath(root, dataDir, rawUrl) {
  let p;
  try { p = decodeURIComponent(String(rawUrl).split('?')[0].split('#')[0]); } catch { return { status: 400, text: 'bad request' }; }
  if (!p.startsWith('/') || /[\0\\:]/.test(p)) return { status: 403, text: 'forbidden' };
  if (p.endsWith('/')) p += 'index.html';
  const segments = p.split('/').filter((s) => s !== '');
  for (const seg of segments) {
    // "..", dotfiles, Windows aliases ("data." / "data " / 8.3 short names) are never served
    if (seg === '..' || seg.startsWith('.') || /[. ]$/.test(seg) || seg.includes('~')) return { status: 403, text: 'forbidden' };
  }
  if (segments.length && DENY_DIRS.has(segments[0].toLowerCase())) return { status: 403, text: 'forbidden' };
  const file = path.normalize(path.join(root, ...segments));
  if (!isInside(file, root)) return { status: 403, text: 'forbidden' };
  if (isInside(file, dataDir)) return { status: 403, text: 'forbidden' };
  if (DENY_EXT.has(path.extname(file).toLowerCase())) return { status: 403, text: 'forbidden' };
  return { file, display: p };
}

function serveStatic(app, req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return plain(res, 405, 'method not allowed');
  }
  const r = resolvePath(app.root, app.dataDir, req.url);
  if (!r.file) return plain(res, r.status, r.text);
  fs.stat(r.file, (err, st) => {
    if (err || !st.isFile()) return plain(res, 404, '404 ' + r.display);
    const ext = path.extname(r.file).toLowerCase();
    const headers = securityHeaders({
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes',
      'Content-Security-Policy': cspForPage(ext === '.html' ? inlineScriptHashes(r.file, st) : []),
    });
    const head = req.method === 'HEAD';
    const range = req.headers.range;
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
    if (m && (m[1] !== '' || m[2] !== '')) { // media seeking
      let start, end;
      if (m[1] === '') { start = Math.max(0, st.size - Number(m[2])); end = st.size - 1; } // suffix range: last N bytes
      else { start = Number(m[1]); end = m[2] === '' ? st.size - 1 : Math.min(Number(m[2]), st.size - 1); }
      if (start >= st.size || start > end) {
        headers['Content-Range'] = `bytes */${st.size}`;
        res.writeHead(416, headers); return res.end();
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`; headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      if (head) return res.end();
      return void pipeline(fs.createReadStream(r.file, { start, end }), res, () => {}); // pipeline closes the file when the browser aborts a media request
    }
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    if (head) return res.end();
    pipeline(fs.createReadStream(r.file), res, () => {});
  });
}

module.exports = { serveStatic, resolvePath, MIME };
