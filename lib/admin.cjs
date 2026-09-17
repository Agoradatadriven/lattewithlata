// Admin auth (token login -> in-memory session cookie), dashboard summary, settings, activity log, CSV export.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { HttpError, validationError, isHttps, parseCookies, trustedProxyHops } = require('./http.cjs');
const { createLimiter } = require('./ratelimit.cjs');
const { isoDate, addDays, weekdayIndex } = require('./util.cjs');
const availability = require('./availability.cjs');
const settingsLib = require('./settings.cjs');
const bookingsLib = require('./bookings.cjs');
const customersLib = require('./customers.cjs');
const messagesLib = require('./messages.cjs');
const subscribersLib = require('./subscribers.cjs');
const activity = require('./activity.cjs');
const csv = require('./csv.cjs');

const COOKIE = 'lwl_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;
const TOKEN_FILE = 'admin-token.txt';

/** ADMIN_TOKEN env wins; otherwise a token is generated once and kept in data/admin-token.txt. */
function resolveToken(dataDir) {
  const env = String(process.env.ADMIN_TOKEN || '').trim();
  if (env) return { token: env, source: 'env' };
  const file = path.join(dataDir, TOKEN_FILE);
  try {
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved) return { token: saved, source: 'file' };
  } catch { /* first start */ }
  const token = crypto.randomBytes(24).toString('base64url');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, token + '\n', { mode: 0o600 });
  return { token, source: 'generated' };
}

function createAuth(token) {
  const sessions = new Map(); // sid -> { createdAt, expiresAt }
  const failures = createLimiter([{ max: 5, windowMs: 15 * 60 * 1000 }]);
  const digest = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest();
  const expected = digest(token);

  const sweep = setInterval(() => { const now = Date.now(); for (const [sid, s] of sessions) if (s.expiresAt <= now) sessions.delete(sid); }, 10 * 60 * 1000);
  if (sweep.unref) sweep.unref();

  function cookie(req, value, maxAgeSeconds) {
    return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${isHttps(req) ? '; Secure' : ''}`;
  }

  function session(req) {
    const sid = parseCookies(req)[COOKIE];
    if (!sid) return null;
    const s = sessions.get(sid);
    if (!s) return null;
    if (s.expiresAt <= Date.now()) { sessions.delete(sid); return null; }
    return Object.assign({ sid }, s);
  }

  /** POST /api/admin/login { token } */
  function login(req, ip, body) {
    const gate = failures.peek(ip);
    if (!gate.ok) throw new HttpError(429, 'rate_limited', 'Too many sign-in attempts. Please wait and try again.', { retryAfter: gate.retryAfter, headers: { 'Retry-After': String(gate.retryAfter) } });
    const given = typeof body.token === 'string' ? body.token.trim() : '';
    const ok = given.length > 0 && given.length <= 512 && crypto.timingSafeEqual(digest(given), expected); // constant time
    if (!ok) {
      failures.take(ip);
      throw new HttpError(401, 'invalid_token', 'That token is not right.');
    }
    failures.reset(ip);
    const sid = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    sessions.set(sid, { createdAt: now, expiresAt: now + SESSION_MS });
    return { status: 200, headers: { 'Set-Cookie': cookie(req, sid, SESSION_MS / 1000) }, json: { ok: true, authenticated: true, expiresAt: new Date(now + SESSION_MS).toISOString() } };
  }

  function logout(req, current) {
    if (current) sessions.delete(current.sid);
    return { status: 200, headers: { 'Set-Cookie': cookie(req, '', 0) }, json: { ok: true, authenticated: false } };
  }

  const describe = (s) => ({ ok: true, authenticated: true, expiresAt: new Date(s.expiresAt).toISOString() });

  return { session, login, logout, describe, sessionCount: () => sessions.size };
}

/** Same-origin guard for state-changing admin requests (on top of SameSite=Strict). */
function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin || origin === 'null') { if (origin === 'null') throw new HttpError(403, 'forbidden', 'Cross-origin request refused.'); return; }
  let host;
  try { host = new URL(origin).host; } catch { throw new HttpError(403, 'forbidden', 'Cross-origin request refused.'); }
  // X-Forwarded-Host only counts behind a trusted proxy (TRUST_PROXY); a direct client could otherwise name any host
  const forwarded = trustedProxyHops() ? String(req.headers['x-forwarded-host'] || '').split(',')[0].trim() : '';
  const allowed = [req.headers.host, forwarded].filter(Boolean);
  if (!allowed.includes(host)) throw new HttpError(403, 'forbidden', 'Cross-origin request refused.');
}

/** GET /api/admin/summary */
function summary(app) {
  const now = new Date();
  const today = isoDate(now);
  const settings = settingsLib.get(app);
  const bookings = app.store.read('bookings');
  const active = bookings.filter(availability.isActive);
  const sum = (rows) => rows.reduce((n, b) => n + b.party, 0);
  const byTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

  const todays = bookings.filter((b) => b.date === today).sort(byTime);
  const todaysActive = todays.filter(availability.isActive);
  const weekEnd = addDays(today, 6);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const rows = active.filter((b) => b.date === date);
    const recording = rows.filter((b) => b.type === 'recording');
    days.push({
      date, bookings: rows.length, covers: sum(rows), tableCovers: sum(rows.filter((b) => b.type === 'table')), recordingSeats: sum(recording),
      closed: !availability.dayStatus(settings, date, 'table', now, { admin: true }).open,
    });
  }
  const last30 = active.filter((b) => b.date >= addDays(today, -30) && b.date < today);
  const window90 = bookings.filter((b) => b.date >= addDays(today, -90) && b.date <= today && (b.status === 'completed' || b.status === 'no_show' || b.status === 'seated'));
  const noShowCount = window90.filter((b) => b.status === 'no_show').length;

  const messages = app.store.read('messages');
  const subscribers = app.store.read('subscribers');
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const { customers } = customersLib.list(app, {});
  const topGuests = customers.filter((c) => c.bookings > 0).sort((a, b) => b.bookings - a.bookings || b.covers - a.covers).slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, bookings: c.bookings, covers: c.covers, noShows: c.noShows, lastVisit: c.lastVisit, vip: !!c.vip, tags: c.tags || [] }));

  let nextRecording = today;
  while (weekdayIndex(nextRecording) !== settings.recordingWeekday) nextRecording = addDays(nextRecording, 1);

  return {
    generatedAt: now.toISOString(),
    today: {
      date: today, bookings: todaysActive.length, covers: sum(todaysActive),
      pending: todays.filter((b) => b.status === 'pending').length, confirmed: todays.filter((b) => b.status === 'confirmed').length,
      seated: todays.filter((b) => b.status === 'seated').length, completed: todays.filter((b) => b.status === 'completed').length,
      cancelled: todays.filter((b) => b.status === 'cancelled').length, noShows: todays.filter((b) => b.status === 'no_show').length,
      list: todays,
    },
    next7Days: { from: today, to: weekEnd, bookings: days.reduce((n, d) => n + d.bookings, 0), covers: days.reduce((n, d) => n + d.covers, 0), days },
    covers: { today: sum(todaysActive), next7Days: days.reduce((n, d) => n + d.covers, 0), last30Days: sum(last30) },
    newMessages: messages.filter((m) => m.status === 'new').length,
    openMessages: messages.filter((m) => m.status === 'open').length,
    newSubscribers: subscribers.filter((s) => String(s.createdAt) >= weekAgo).length,
    subscribers: subscribers.length,
    customers: customers.length,
    noShowRate: window90.length ? Math.round((noShowCount / window90.length) * 1000) / 1000 : 0,
    noShows: { count: noShowCount, outOf: window90.length, windowDays: 90 },
    topGuests,
    nextRecording: { date: nextRecording, doors: settings.recordingDoors, seats: settings.recordingSeats, seatsLeft: availability.recordingSeatsLeft(settings, bookings, nextRecording) },
  };
}

/** PUT /api/admin/settings */
async function putSettings(app, body) {
  return app.store.transaction((tx) => {
    const current = settingsLib.get(app, tx);
    const { patch, fields } = settingsLib.validatePatch(body, current);
    if (Object.keys(fields).length) throw validationError(fields);
    const next = Object.assign({}, current, patch);
    tx.set('settings', next);
    activity.log(tx, { who: 'admin', action: 'settings.updated', reference: 'settings', detail: { changed: Object.keys(patch) } });
    const view = settingsLib.adminView(next);
    return Object.assign({}, view, { settings: view });
  });
}
function getSettings(app) {
  const view = settingsLib.adminView(settingsLib.get(app));
  return Object.assign({}, view, { settings: view });
}

/** GET /api/admin/activity - latest 500, newest first */
function activityLog(app, query) {
  let rows = app.store.read('activity');
  const total = rows.length;
  if (query.reference) rows = rows.filter((a) => String(a.reference).toLowerCase() === String(query.reference).toLowerCase());
  if (query.who) rows = rows.filter((a) => a.who === query.who);
  rows = rows.slice(-500).reverse();
  return { activity: rows, total };
}

/** GET /api/admin/export?kind=bookings|customers|messages|subscribers -> CSV download */
function exportCsv(app, query) {
  const kind = String(query.kind || '');
  if (!csv.COLUMNS[kind]) throw validationError({ kind: 'kind must be bookings, customers, messages or subscribers.' });
  let rows;
  if (kind === 'bookings') rows = bookingsLib.filter(app.store.read('bookings'), query);
  else if (kind === 'customers') rows = customersLib.list(app, query).customers;
  else if (kind === 'messages') rows = messagesLib.list(app, query).messages;
  else rows = subscribersLib.list(app, query).subscribers;
  return {
    status: 200,
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="lwl-${kind}-${isoDate(new Date())}.csv"` },
    body: csv.toCsv(csv.COLUMNS[kind], rows),
  };
}

module.exports = { COOKIE, TOKEN_FILE, resolveToken, createAuth, assertSameOrigin, summary, getSettings, putSettings, activityLog, exportCsv };
