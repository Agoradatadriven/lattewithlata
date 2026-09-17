// Latte with Lata - static site + booking / CRM JSON API. Zero dependencies (Node built-ins only).
//   node server.cjs [port]      start (default 5178, or PORT env)      env: DATA_DIR, ADMIN_TOKEN, HOST, TRUST_PROXY=1
//   node server.cjs --seed      write clearly-marked DEMO data         node server.cjs --reset [--all]   clear data/
//   node server.cjs --help
// Static behaviour matches serve.cjs (MIME table, Range support). API contract: PAGES-SPEC.md section 4 / API.md.
'use strict';
const http = require('http');
const path = require('path');
const { createStore } = require('./lib/store.cjs');
const { HttpError, sendJson, sendError, readJsonBody, clientIp, securityHeaders, CSP_API } = require('./lib/http.cjs');
const { serveStatic } = require('./lib/static.cjs');
const { createLimiter } = require('./lib/ratelimit.cjs');
const { isDate } = require('./lib/util.cjs');
const settingsLib = require('./lib/settings.cjs');
const availability = require('./lib/availability.cjs');
const bookings = require('./lib/bookings.cjs');
const customers = require('./lib/customers.cjs');
const messages = require('./lib/messages.cjs');
const subscribers = require('./lib/subscribers.cjs');
const events = require('./lib/events.cjs');
const admin = require('./lib/admin.cjs');
const activity = require('./lib/activity.cjs');
const seedLib = require('./lib/seed.cjs');

const VERSION = '1.0.0';
const ROOT = __dirname;
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const portArg = args.find((a) => /^\d+$/.test(a));
const PORT = Number(portArg || process.env.PORT || 5178);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));

const HELP = `Latte with Lata server ${VERSION}
  node server.cjs [port]        start the site + API (default port 5178, or PORT env)
  node server.cjs --seed        write DEMO data (demo: true, @example.com, 555 numbers); real records are kept
  node server.cjs --reset       print, then delete, every data file (keeps admin-token.txt; add --all to remove it too)
  node server.cjs --help        this text
Environment: PORT, HOST (default 127.0.0.1; use 0.0.0.0 on a host), DATA_DIR (default ./data), ADMIN_TOKEN,
             TRUST_PROXY=N (N reverse proxies in front: trust the address the proxy appended to X-Forwarded-For),
             LWL_CSP_RELAXED=1 (allow inline scripts).`;

// ---------------------------------------------------------------------------------------------------------------
// App context + handlers
// ---------------------------------------------------------------------------------------------------------------
function createApp() {
  const store = createStore(DATA_DIR);
  const token = admin.resolveToken(DATA_DIR);
  return {
    root: ROOT, dataDir: DATA_DIR, store, token,
    auth: admin.createAuth(token.token),
    limits: {
      post: createLimiter([{ max: 10, windowMs: 60 * 1000 }, { max: 60, windowMs: 60 * 60 * 1000 }]), // public POSTs per IP
      lookup: createLimiter([{ max: 30, windowMs: 60 * 1000 }]),                                        // booking lookups per IP
    },
  };
}

const ok = (json) => ({ status: 200, json });

function getAvailability(app, query, isStaff) {
  const settings = settingsLib.get(app);
  const fields = {};
  const type = query.type === undefined || query.type === '' ? 'table' : query.type;
  if (type !== 'table' && type !== 'recording') fields.type = 'type must be table or recording.';
  if (!isDate(query.date)) fields.date = 'date must be a YYYY-MM-DD date.';
  let party = query.party === undefined || query.party === '' ? (type === 'recording' ? 1 : 2) : Number(query.party);
  if (!Number.isInteger(party) || party < 1) fields.party = 'party must be a whole number of 1 or more.';
  else if (type === 'table' && party > settings.maxParty) fields.party = settings.largePartyNote;
  else if (type === 'recording' && party > settings.recordingMaxParty) fields.party = `Recording night places are limited to ${settings.recordingMaxParty} per booking.`;
  if (Object.keys(fields).length) throw new HttpError(400, 'validation', fields.party || fields.date || fields.type, { fields });
  // excludeRef: "count the seats as if this booking did not exist" - for the CRM's edit form. Honoured for a signed-in
  // staff session only: on the public endpoint it would let anyone probe whether a reference exists (and its party size).
  const excludeRef = isStaff && query.excludeRef ? String(query.excludeRef).trim().toUpperCase() : undefined;
  return availability.availability(settings, app.store.read('bookings'), { date: query.date, type, party, now: new Date(), excludeRef });
}

// Routing table. Flags: post = public POST (needs X-Requested-With: fetch, rate limited, JSON body <= 20 KB);
// admin = needs a session (401 otherwise); body = read a JSON body; limit = named limiter.
const ROUTES = [
  // public
  ['GET',    '/api/health',                    {},                 (c) => ok({ ok: true, version: VERSION, time: new Date().toISOString() })],
  ['GET',    '/api/config',                    {},                 (c) => ok(settingsLib.publicConfig(c.app))],
  ['GET',    '/api/availability',              {},                 (c) => ok(getAvailability(c.app, c.query, !!c.app.auth.session(c.req)))],
  ['GET',    '/api/events',                    {},                 (c) => ok(events.list(c.app))],
  ['POST',   '/api/bookings',                  { post: true },     (c) => bookings.createPublic(c.app, c.body)],
  ['GET',    '/api/bookings/lookup',           { limit: 'lookup' }, (c) => ok(bookings.lookup(c.app, c.query))],
  ['POST',   '/api/bookings/cancel',           { post: true },     async (c) => ok(await bookings.cancelPublic(c.app, c.body))],
  ['POST',   '/api/contact',                   { post: true },     (c) => messages.create(c.app, c.body)],
  ['POST',   '/api/subscribe',                 { post: true },     (c) => subscribers.subscribe(c.app, c.body)],
  // admin
  ['POST',   '/api/admin/login',               { body: true },     async (c) => {
    const result = c.app.auth.login(c.req, c.ip, c.body);
    await c.app.store.transaction((tx) => activity.log(tx, { who: 'admin', action: 'admin.login', reference: 'session' }));
    return result;
  }],
  ['GET',    '/api/admin/session',             { admin: true },    (c) => ok(c.app.auth.describe(c.session))],
  ['POST',   '/api/admin/logout',              { admin: true },    (c) => c.app.auth.logout(c.req, c.session)],
  ['GET',    '/api/admin/summary',             { admin: true },    (c) => ok(admin.summary(c.app))],
  ['GET',    '/api/admin/bookings',            { admin: true },    (c) => ok(bookings.listAdmin(c.app, c.query))],
  ['POST',   '/api/admin/bookings',            { admin: true, body: true }, (c) => bookings.createAdmin(c.app, c.body)],
  ['GET',    '/api/admin/bookings/:reference', { admin: true },    (c) => ok(bookings.getAdmin(c.app, c.params.reference))],
  ['PATCH',  '/api/admin/bookings/:reference', { admin: true, body: true }, async (c) => ok(await bookings.patchAdmin(c.app, c.params.reference, c.body))],
  ['GET',    '/api/admin/customers',           { admin: true },    (c) => ok(customers.list(c.app, c.query))],
  ['GET',    '/api/admin/customers/:id',       { admin: true },    (c) => ok(customers.profile(c.app, c.params.id))],
  ['PATCH',  '/api/admin/customers/:id',       { admin: true, body: true }, async (c) => ok(await customers.patch(c.app, c.params.id, c.body))],
  ['GET',    '/api/admin/messages',            { admin: true },    (c) => ok(messages.list(c.app, c.query))],
  ['PATCH',  '/api/admin/messages/:id',        { admin: true, body: true }, async (c) => ok(await messages.patch(c.app, c.params.id, c.body))],
  ['GET',    '/api/admin/subscribers',         { admin: true },    (c) => ok(subscribers.list(c.app, c.query))],
  ['DELETE', '/api/admin/subscribers/id/:id',  { admin: true },    async (c) => ok(await subscribers.removeById(c.app, c.params.id))], // preferred: no address in the URL
  ['DELETE', '/api/admin/subscribers/:email',  { admin: true },    async (c) => ok(await subscribers.remove(c.app, c.params.email))],
  ['GET',    '/api/admin/settings',            { admin: true },    (c) => ok(admin.getSettings(c.app))],
  ['PUT',    '/api/admin/settings',            { admin: true, body: true }, async (c) => ok(await admin.putSettings(c.app, c.body))],
  ['GET',    '/api/admin/activity',            { admin: true },    (c) => ok(admin.activityLog(c.app, c.query))],
  ['GET',    '/api/admin/export',              { admin: true },    (c) => admin.exportCsv(c.app, c.query)],
].map(([method, pattern, opts, handler]) => ({ method, pattern, opts, handler, parts: pattern.split('/').filter(Boolean) }));

function matchRoute(method, pathname) {
  let parts;
  try { parts = pathname.split('/').filter(Boolean).map(decodeURIComponent); } catch { return { error: new HttpError(400, 'bad_request', 'Malformed URL.') }; }
  let pathMatched = false; const allowed = [];
  for (const route of ROUTES) {
    if (route.parts.length !== parts.length) continue;
    const params = {};
    const hit = route.parts.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = parts[i]), true) : seg === parts[i]));
    if (!hit) continue;
    pathMatched = true; allowed.push(route.method);
    if (route.method === method || (method === 'HEAD' && route.method === 'GET')) return { route, params };
  }
  if (pathMatched) return { error: new HttpError(405, 'method_not_allowed', `Use ${[...new Set(allowed)].join(' or ')} for this endpoint.`, { headers: { Allow: [...new Set(allowed)].join(', ') } }) };
  return { error: new HttpError(404, 'not_found', 'No such API endpoint.') };
}

async function handleApi(app, req, res) {
  const started = Date.now();
  const q = req.url.indexOf('?');
  const pathname = q === -1 ? req.url : req.url.slice(0, q);
  const query = Object.fromEntries(new URLSearchParams(q === -1 ? '' : req.url.slice(q + 1)));
  let status = 500;
  try {
    const cleanPath = pathname.replace(/\/+$/, '');
    // every /api/admin/* path except login answers 401 without a session - unknown paths included
    if (cleanPath.startsWith('/api/admin') && cleanPath !== '/api/admin/login' && !app.auth.session(req)) throw new HttpError(401, 'unauthorized', 'Please sign in.');
    const m = matchRoute(req.method, cleanPath);
    if (m.error) throw m.error;
    const { route, params } = m;
    const ip = clientIp(req);
    const ctx = { app, req, res, params, query, ip, body: {}, session: null };

    if (route.opts.admin) {
      ctx.session = app.auth.session(req);
      if (!ctx.session) throw new HttpError(401, 'unauthorized', 'Please sign in.');
    }
    if (pathname.startsWith('/api/admin/') && req.method !== 'GET' && req.method !== 'HEAD') admin.assertSameOrigin(req);
    if (route.opts.post) {
      if (String(req.headers['x-requested-with'] || '').toLowerCase() !== 'fetch') throw new HttpError(403, 'forbidden', 'Missing X-Requested-With: fetch header.');
    }
    const limiter = route.opts.post ? app.limits.post : route.opts.limit ? app.limits[route.opts.limit] : null;
    if (limiter) {
      const gate = limiter.take(ip);
      if (!gate.ok) throw new HttpError(429, 'rate_limited', 'Too many requests. Please wait a moment and try again.', { retryAfter: gate.retryAfter, headers: { 'Retry-After': String(gate.retryAfter) } });
    }
    if (route.opts.post || route.opts.body) ctx.body = await readJsonBody(req);

    const result = await route.handler(ctx);
    status = result.status || 200;
    if (result.body !== undefined) { // non-JSON download (CSV)
      const buf = Buffer.from(result.body, 'utf8');
      res.writeHead(status, securityHeaders(Object.assign({ 'Content-Length': buf.length, 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP_API }, result.headers)));
      res.end(req.method === 'HEAD' ? undefined : buf);
    } else sendJson(res, status, result.json, result.headers);
  } catch (err) {
    status = err instanceof HttpError ? err.status : 500;
    if (status === 413) res.setHeader('Connection', 'close');
    sendError(res, err);
  } finally {
    if (process.env.LWL_QUIET !== '1') console.log(`${new Date().toISOString()} ${req.method} ${pathname} ${status} ${Date.now() - started}ms`); // no query string: it can hold an email
  }
}

function createServer(app) {
  return http.createServer((req, res) => {
    const url = req.url || '/';
    if (url === '/api' || url.startsWith('/api/') || url.startsWith('/api?')) return void handleApi(app, req, res);
    try { serveStatic(app, req, res); } catch (err) { console.error('[static]', err); if (!res.headersSent) res.writeHead(500, securityHeaders({ 'Content-Type': 'text/plain; charset=utf-8' })); res.end('server error'); }
  });
}

// ---------------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------------
async function main() {
  if (flags.has('--help') || flags.has('-h')) { console.log(HELP); return; }
  if (flags.has('--reset')) { seedLib.reset(DATA_DIR, { includeToken: flags.has('--all') }); return; }
  if (flags.has('--seed')) {
    const app = { root: ROOT, dataDir: DATA_DIR, store: createStore(DATA_DIR) };
    const r = await seedLib.seed(app);
    console.log(`DEMO data written to ${DATA_DIR}: ${r.bookings} bookings, ${r.customers} customers (${r.vip} VIP), ${r.messages} messages, ${r.subscribers} subscribers.`);
    console.log('Every demo record has demo: true, a fictional name, an @example.com address and a 555 number. Remove with: node server.cjs --reset');
    return;
  }
  const unknown = [...flags].filter((f) => !['--all'].includes(f));
  if (unknown.length) { console.error(`Unknown option ${unknown.join(' ')}\n\n${HELP}`); process.exitCode = 2; return; }

  const app = createApp();
  await settingsLib.ensure(app);
  const server = createServer(app);
  server.on('error', (err) => { console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use.` : err); process.exit(1); });
  server.listen(PORT, HOST, () => {
    console.log(`Latte with Lata -> http://localhost:${PORT}/   (API: /api/health, CRM: /admin.html, data: ${DATA_DIR})`);
    console.log(app.token.source === 'env' ? 'Admin token: (taken from the ADMIN_TOKEN environment variable)' : `Admin token: ${app.token.token}`);
  });
  const shutdown = () => { server.close(); app.store.flush().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}

if (require.main === module) main().catch((err) => { console.error(err); process.exit(1); });

module.exports = { createApp, createServer, ROUTES, VERSION };
