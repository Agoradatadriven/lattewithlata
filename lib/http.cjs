// HTTP plumbing shared by the API and the static handler: error type, JSON responses, body reader, security headers.
'use strict';

const BODY_LIMIT = 20 * 1024; // 20 KB

class HttpError extends Error {
  /** @param {number} status @param {string} code @param {string} message @param {object} [extra] fields / headers / anything merged into the JSON body */
  constructor(status, code, message, extra) {
    super(message);
    this.status = status; this.code = code; this.extra = extra || {};
  }
}
const validationError = (fields, message) =>
  new HttpError(400, 'validation', message || 'Please check the highlighted fields.', { fields });

// Content-Security-Policy. Inline <script> blocks of the site's own HTML are allowed by hash (see static.cjs);
// inline styles are allowed because GSAP / Splide animate through style attributes.
const CSP_BASE = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' https://www.openstreetmap.org https://www.google.com https://maps.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];
function cspForPage(scriptHashes) {
  const relaxed = process.env.LWL_CSP_RELAXED === '1';
  const script = relaxed ? "script-src 'self' 'unsafe-inline'" : `script-src 'self'${(scriptHashes || []).map((h) => ` '${h}'`).join('')}`;
  return [CSP_BASE[0], script, ...CSP_BASE.slice(1)].join('; ');
}
const CSP_API = "default-src 'none'; frame-ancestors 'none'";

function securityHeaders(extra) {
  return Object.assign({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }, extra);
}

function sendJson(res, status, body, headers) {
  const json = JSON.stringify(body);
  res.writeHead(status, securityHeaders(Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
    'Content-Security-Policy': CSP_API,
  }, headers)));
  res.end(json);
}

function sendError(res, err) {
  if (err instanceof HttpError) {
    const { headers, ...rest } = err.extra;
    return sendJson(res, err.status, Object.assign({ error: err.code, message: err.message }, rest), headers);
  }
  console.error('[api] unexpected error:', err && err.stack ? err.stack : err);
  return sendJson(res, 500, { error: 'server_error', message: 'Something went wrong on our side. Please try again or call the cafe.' });
}

/** Read a JSON object body with a hard size limit. Rejects with 413 / 400. An empty body is {}. */
function readJsonBody(req, limit = BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      req.resume(); // drain without buffering so the client can read the 413
      return reject(new HttpError(413, 'payload_too_large', `Request body is larger than ${Math.round(limit / 1024)} KB.`));
    }
    const chunks = []; let size = 0; let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limit) {
        done = true; chunks.length = 0;
        reject(new HttpError(413, 'payload_too_large', `Request body is larger than ${Math.round(limit / 1024)} KB.`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return; done = true;
      const text = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
      if (!text.trim()) return resolve({});
      let body;
      try { body = JSON.parse(text); } catch { return reject(new HttpError(400, 'invalid_json', 'The request body is not valid JSON.')); }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) return reject(new HttpError(400, 'invalid_json', 'The request body must be a JSON object.'));
      resolve(body);
    });
    req.on('error', (err) => { if (!done) { done = true; reject(err); } });
  });
}

/** Number of reverse proxies in front of the server (TRUST_PROXY=1, 2 ...); 0 = X-Forwarded-* headers are not trusted. */
function trustedProxyHops() {
  const n = Number(process.env.TRUST_PROXY);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10) : 0;
}

/**
 * Client address. X-Forwarded-For is only trusted when TRUST_PROXY is set. Each proxy APPENDS the address it saw, so the
 * entries on the left are whatever the client chose to send: we take the entry added by our own outermost trusted proxy
 * (the Nth from the right), never the first one - otherwise a spoofed header would dodge the rate limits and the login lockout.
 */
function clientIp(req) {
  const hops = trustedProxyHops();
  if (hops) {
    const list = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length) return list[Math.max(0, list.length - hops)].slice(0, 64);
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

const isHttps = (req) => String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    if (!(k in out)) { try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); } }
  }
  return out;
}

module.exports = { BODY_LIMIT, HttpError, validationError, securityHeaders, cspForPage, CSP_API, sendJson, sendError, readJsonBody, clientIp, trustedProxyHops, isHttps, parseCookies };
