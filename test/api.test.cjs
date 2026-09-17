// Dependency-free API test runner.   node test/api.test.cjs
// Boots server.cjs on port 5402 (TEST_PORT env to change) with a throw-away data dir (DATA_DIR), exercises the whole
// contract from PAGES-SPEC.md section 4, prints one line per test and a final "N passed, M failed".
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 5402);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'lwl-test-'));

const util = require(path.join(ROOT, 'lib', 'util.cjs'));
const { isoDate, addDays, weekdayIndex, pad } = util;

// ---------------------------------------------------------------------------------------------------------------
// tiny harness
// ---------------------------------------------------------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
let ipCounter = 0;
const freshIp = () => { ipCounter++; return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`; };

function request(method, urlPath, opts = {}) {
  return new Promise((resolve, reject) => {
    const headers = Object.assign({ 'X-Forwarded-For': opts.ip || freshIp() }, opts.headers);
    let payload = null;
    if (opts.raw !== undefined) payload = Buffer.from(opts.raw);
    else if (opts.body !== undefined) { payload = Buffer.from(JSON.stringify(opts.body)); headers['Content-Type'] = 'application/json'; }
    if (payload) headers['Content-Length'] = payload.length;
    if (opts.cookie) headers.Cookie = opts.cookie;
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path: urlPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks); const text = buffer.toString('utf8');
        let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json, buffer });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const get = (p, opts) => request('GET', p, opts);
const post = (p, body, opts = {}) => request('POST', p, Object.assign({ body }, opts, { headers: Object.assign({ 'X-Requested-With': 'fetch' }, opts.headers) }));

let adminCookie = '';
const adm = (method, p, body) => request(method, p, { body, cookie: adminCookie });

const readData = (name) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), 'utf8')); } catch { return []; } };

// dates: far enough ahead to be bookable whatever time of day the suite runs, each test group on its own day
const today = isoDate(new Date());
function nextWeekday(weekday, minAhead) { let d = addDays(today, minAhead); while (weekdayIndex(d) !== weekday) d = addDays(d, 1); return d; }
const MON = nextWeekday(1, 3), TUE = nextWeekday(2, 3), WED = nextWeekday(3, 3), THU = nextWeekday(4, 3), FRI = nextWeekday(5, 3);
const MON2 = addDays(MON, 7), TUE2 = addDays(TUE, 7), WED2 = addDays(WED, 7);

let guestN = 0;
const guest = (over) => Object.assign({
  type: 'table', date: MON, time: '12:00', party: 2, name: `Test Guest ${++guestN}`, email: `guest${guestN}@example.com`, phone: '+1 555 010 0199',
  occasion: 'none', notes: '', marketingOptIn: false, consent: true, website: '',
}, over);
const slotOf = (res, time) => res.json.slots.find((s) => s.time === time);

// ---------------------------------------------------------------------------------------------------------------
// static files + hardening
// ---------------------------------------------------------------------------------------------------------------
test('static: index.html is served with security headers and a CSP', async () => {
  const r = await get('/');
  assert.strictEqual(r.status, 200);
  assert.match(r.headers['content-type'], /text\/html/);
  assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
  assert.strictEqual(r.headers['referrer-policy'], 'same-origin');
  assert.strictEqual(r.headers['x-frame-options'], 'DENY');
  assert.match(r.headers['content-security-policy'], /default-src 'self'/);
  assert.match(r.headers['content-security-policy'], /style-src 'self' 'unsafe-inline'/);
  assert.match(r.headers['content-security-policy'], /img-src 'self' data:/);
  assert.match(r.headers['content-security-policy'], /script-src 'self' 'sha256-/, 'the inline no-js script is allowed by hash');
  assert.ok(r.text.includes('<html'));
});
test('static: css is served with the right MIME type; Range requests give 206', async () => {
  const css = await get('/css/tokens.css');
  assert.strictEqual(css.status, 200); assert.match(css.headers['content-type'], /text\/css/);
  const part = await get('/index.html', { headers: { Range: 'bytes=0-99' } });
  assert.strictEqual(part.status, 206);
  assert.strictEqual(part.buffer.length, 100);
  assert.match(part.headers['content-range'], /^bytes 0-99\/\d+$/);
  const tail = await get('/index.html', { headers: { Range: 'bytes=-10' } });
  assert.strictEqual(tail.status, 206); assert.strictEqual(tail.buffer.length, 10);
  assert.strictEqual((await get('/no-such-file.html')).status, 404);
  assert.strictEqual((await request('POST', '/index.html')).status, 405);
});
test('static: data/, lib/, test/, dotfiles and server sources are never served', async () => {
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  for (const p of ['/data/.gitkeep', '/data/bookings.json', '/DATA/bookings.json', '/data./bookings.json', '/data%2fbookings.json', '/Data/admin-token.txt', '/lib/store.cjs', '/LIB/store.cjs', '/test/api.test.cjs', '/server.cjs', '/serve.cjs', '/.gitignore', '/.git/config', '/css/.hidden', '/node_modules/x/index.js', '/admin-token.txt',
    '/build-site.cjs', '/verify/handoff-pages/backend.md', '/VERIFY/pages/verify-booking-crm.md', '/API.md', '/README.md', '/PAGES-SPEC.md', '/content/COPY.md', '/.env', '/.claude/launch.json']) {
    const r = await get(p);
    assert.ok(r.status === 403 || r.status === 404, `${p} -> ${r.status}`);
    assert.ok(!/reference|LWL-|createStore|Hand-off|ADMIN_TOKEN/.test(r.text), `${p} leaked content`);
  }
  // the files the pages need stay public
  for (const p of ['/book.html', '/admin.html', '/js/lib/api.js', '/content/pages.json']) assert.strictEqual((await get(p)).status, 200, p);
});
test('static: book.html and admin.html get a strict CSP (no unsafe-inline / unsafe-eval scripts, no framing, no plugins)', async () => {
  for (const p of ['/book.html', '/admin.html']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p);
    const csp = r.headers['content-security-policy'];
    const script = csp.split(';').map((x) => x.trim()).find((x) => x.startsWith('script-src'));
    assert.ok(script && script.includes("'self'"), `${p}: ${script}`);
    assert.ok(!/unsafe-inline|unsafe-eval|\*|https?:/.test(script), `${p}: script-src is too wide: ${script}`);
    for (const d of ["default-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) assert.ok(csp.includes(d), `${p}: ${d}`);
    assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(r.text.replace(/<!--[\s\S]*?-->/g, '')), `${p} has an inline event handler`);
  }
  const api = await get('/api/health');
  assert.strictEqual(api.headers['content-security-policy'], "default-src 'none'; frame-ancestors 'none'");
});
test('static: path traversal is blocked', async () => {
  for (const p of ['/../rebuild-v2/index.html', '/css/../../rebuild-v2/index.html', '/..%2f..%2frebuild-v2/index.html', '/%2e%2e/%2e%2e/rebuild-v2/index.html', '/..%5c..%5crebuild-v2%5cindex.html', '/css/..%2f..%2f..%2f..%2fWindows/win.ini', '/%00/index.html', '/C:/Windows/win.ini', '/%E0%A4%A']) {
    const r = await get(p);
    assert.ok([400, 403, 404].includes(r.status), `${p} -> ${r.status}`);
  }
});
test('security: encoded, doubled, aliased and API-prefixed paths to private files are refused (GET, HEAD, Range)', async () => {
  const leak = /use strict|require\(|module\.exports|createStore|"reference"|\[core\]|ADMIN_TOKEN/;
  const paths = ['/.git/HEAD', '/%2egit/config', '/%2Egitignore', '/.claude/', '/lib%2fstore.cjs', '/%6cib/store.cjs', '/lib%20/store.cjs', '/lib./store.cjs', '//lib/store.cjs', '/./lib/store.cjs',
    '/css/%2e%2e/lib/store.cjs', '/css/..%2F..%2Flib/store.cjs', '/css/%2e%2e%5clib%5cstore.cjs', '/%252e%252e/lib/store.cjs', '/js/../server.cjs', '/data%5cbookings.json', '/data/', '/lib/', '/test/', '/verify/',
    '/server.CJS', '/Server.cjs', '/server.cjs.', '/server.cjs%20', '/server.cjs%00.html', '/server.cjs::$DATA', '/SERVER~1.CJS', '/API.MD', '/api.md', '/README.md%3F.html',
    '/api/../lib/store.cjs', '/api/..%2f..%2fserver.cjs', '/api/%2e%2e/%2e%2e/lib/store.cjs'];
  for (const p of paths) {
    const r = await get(p);
    assert.ok([400, 403, 404].includes(r.status), `GET ${p} -> ${r.status}`);
    assert.ok(!leak.test(r.text), `GET ${p} leaked source`);
  }
  for (const p of ['/server.cjs', '/lib/store.cjs', '/data/bookings.json', '/API.md', '/.git/config']) {
    const head = await request('HEAD', p);
    assert.ok([403, 404].includes(head.status) && head.buffer.length === 0, `HEAD ${p} -> ${head.status}`);
    const range = await get(p, { headers: { Range: 'bytes=0-40' } });
    assert.ok([403, 404].includes(range.status) && !leak.test(range.text), `Range ${p} -> ${range.status}`);
  }
});
test('security: every HTML page and every refusal carries CSP + nosniff + frame protection', async () => {
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  assert.ok(pages.length >= 8, pages.join(','));
  for (const f of pages) {
    const r = await request('HEAD', `/${f}`);
    assert.strictEqual(r.status, 200, f);
    const csp = r.headers['content-security-policy'] || '';
    for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'"]) assert.ok(csp.includes(d), `${f}: ${d}`);
    assert.ok(!/script-src[^;]*unsafe-(inline|eval)/.test(csp), `${f}: script-src must not allow inline / eval`);
    assert.strictEqual(r.headers['x-content-type-options'], 'nosniff', f); assert.strictEqual(r.headers['x-frame-options'], 'DENY', f);
  }
  for (const [method, p] of [['GET', '/server.cjs'], ['GET', '/no-such-page.html'], ['POST', '/index.html'], ['GET', '/api/nope'], ['POST', '/api/bookings'], ['GET', '/api/admin/summary']]) {
    const r = await request(method, p);
    assert.ok(r.status >= 400, `${method} ${p}`);
    assert.ok(r.headers['content-security-policy'], `${method} ${p}: CSP`); assert.strictEqual(r.headers['x-content-type-options'], 'nosniff', `${method} ${p}`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------------------------------------------
test('health', async () => {
  const r = await get('/api/health');
  assert.strictEqual(r.status, 200); assert.strictEqual(r.json.ok, true); assert.ok(r.json.version);
  assert.strictEqual(r.headers['cache-control'], 'no-store');
  assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
});
test('config: hours seeded from content/site.json, slot + recording settings', async () => {
  const { status, json } = await get('/api/config');
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(json.hours.mon, { open: '07:00', close: '18:00' });
  assert.deepStrictEqual(json.hours.thu, { open: '07:00', close: '18:00' });
  assert.deepStrictEqual(json.hours.fri, { open: '07:00', close: '22:00' });
  assert.deepStrictEqual(json.hours.sat, { open: '08:00', close: '22:00' });
  assert.deepStrictEqual(json.hours.sun, { open: '08:00', close: '15:00' });
  assert.strictEqual(json.slotMinutes, 30); assert.strictEqual(json.turnMinutes, 90); assert.strictEqual(json.maxParty, 8); assert.strictEqual(json.leadDays, 60);
  assert.strictEqual(json.recording.weekday, 4); assert.strictEqual(json.recording.doors, '18:30'); assert.strictEqual(json.recording.seats, 40);
  assert.ok(Array.isArray(json.blockedDates)); assert.ok(json.largePartyNote.length > 10); assert.ok(json.timezoneNote);
});
test('availability: slot grid, last slot 90 minutes before close', async () => {
  const r = await get(`/api/availability?date=${MON}&party=2&type=table`);
  assert.strictEqual(r.status, 200); assert.strictEqual(r.json.open, true); assert.strictEqual(r.json.date, MON); assert.strictEqual(r.json.type, 'table');
  assert.strictEqual(r.json.slots[0].time, '07:00'); assert.strictEqual(r.json.slots[r.json.slots.length - 1].time, '16:30'); assert.strictEqual(r.json.slots.length, 20);
  assert.ok(r.json.slots.every((s) => s.available === true && s.seatsLeft === 28));
  const fri = await get(`/api/availability?date=${FRI}&party=2`);
  assert.strictEqual(fri.json.slots[fri.json.slots.length - 1].time, '20:30');
});
test('availability: past date, too-far date, bad input, large party', async () => {
  const past = await get(`/api/availability?date=${addDays(today, -1)}&party=2`);
  assert.strictEqual(past.status, 200); assert.strictEqual(past.json.open, false); assert.strictEqual(past.json.reasonCode, 'past'); assert.deepStrictEqual(past.json.slots, []);
  const far = await get(`/api/availability?date=${addDays(today, 61)}&party=2`);
  assert.strictEqual(far.json.open, false); assert.strictEqual(far.json.reasonCode, 'too_far');
  assert.strictEqual((await get(`/api/availability?date=${addDays(today, 60)}&party=2`)).json.open, true);
  const bad = await get('/api/availability?date=2026-02-30&party=2');
  assert.strictEqual(bad.status, 400); assert.strictEqual(bad.json.error, 'validation'); assert.ok(bad.json.fields.date);
  const big = await get(`/api/availability?date=${MON}&party=9`);
  assert.strictEqual(big.status, 400); assert.match(big.json.fields.party, /call|email/i);
});
test('availability: recording nights are Thursdays only, one slot at doors', async () => {
  const thu = await get(`/api/availability?date=${THU}&party=2&type=recording`);
  assert.strictEqual(thu.json.open, true); assert.deepStrictEqual(thu.json.slots, [{ time: '18:30', available: true, seatsLeft: 40 }]);
  const mon = await get(`/api/availability?date=${MON}&party=2&type=recording`);
  assert.strictEqual(mon.json.open, false); assert.strictEqual(mon.json.reasonCode, 'not_recording_night');
  assert.strictEqual((await get(`/api/availability?date=${THU}&party=5&type=recording`)).status, 400);
});

let firstBooking = null;
test('booking: create -> 201, LWL reference, confirmed, seats held for 90 minutes', async () => {
  const body = guest({ email: 'Mixed.Case@Example.com', party: 4, notes: 'He said "hi", twice', marketingOptIn: true });
  const r = await post('/api/bookings', body);
  assert.strictEqual(r.status, 201, r.text);
  assert.match(r.json.reference, /^LWL-[2-9A-HJ-NP-Z]{6}$/);
  assert.strictEqual(r.json.status, 'confirmed');
  assert.strictEqual(r.json.booking.email, 'mixed.case@example.com');
  assert.strictEqual(r.json.booking.party, 4); assert.strictEqual(r.json.booking.cancellable, true);
  assert.ok(!('internalNotes' in r.json.booking) && !('customerId' in r.json.booking), 'guest view hides internal fields');
  firstBooking = r.json;
  const a = await get(`/api/availability?date=${MON}&party=2`);
  for (const t of ['11:00', '11:30', '12:00', '12:30', '13:00']) assert.strictEqual(slotOf(a, t).seatsLeft, 24, t);
  for (const t of ['10:30', '13:30']) assert.strictEqual(slotOf(a, t).seatsLeft, 28, t);
  const mail = readData('outbox').find((m) => m.reference === r.json.reference);
  assert.ok(mail && mail.to === 'mixed.case@example.com' && mail.subject && mail.text && mail.at, 'confirmation written to outbox.json');
  assert.ok(readData('activity').some((x) => x.action === 'booking.created' && x.reference === r.json.reference && x.who === 'guest' && x.at));
  assert.ok(readData('subscribers').some((s) => s.email === 'mixed.case@example.com' && s.source === 'booking'), 'opt-in adds a subscriber');
});
test('booking: validation errors are per field', async () => {
  const empty = await post('/api/bookings', { website: '' });
  assert.strictEqual(empty.status, 400); assert.strictEqual(empty.json.error, 'validation');
  for (const f of ['name', 'email', 'phone', 'party', 'date', 'time', 'consent']) assert.ok(empty.json.fields[f], `missing message for ${f}`);
  const cases = [
    [{ name: 'A' }, 'name'], [{ name: 'x'.repeat(81) }, 'name'], [{ email: 'not-an-email' }, 'email'], [{ phone: '12345' }, 'phone'], [{ phone: 'call me maybe' }, 'phone'],
    [{ party: 0 }, 'party'], [{ party: 2.5 }, 'party'], [{ party: 9 }, 'party'], [{ date: '2026-13-01' }, 'date'], [{ date: addDays(today, -2) }, 'date'], [{ date: addDays(today, 90) }, 'date'],
    [{ time: '12:15' }, 'time'], [{ time: '17:00' }, 'time'], [{ time: '25:00' }, 'time'], [{ notes: 'n'.repeat(501) }, 'notes'], [{ occasion: 'wedding' }, 'occasion'],
    [{ consent: false }, 'consent'], [{ type: 'banquet' }, 'type'], [{ type: 'recording', date: MON }, 'date'], [{ type: 'recording', date: THU, party: 5 }, 'party'],
  ];
  for (const [over, field] of cases) {
    const r = await post('/api/bookings', guest(over));
    assert.strictEqual(r.status, 400, `${JSON.stringify(over)} -> ${r.status} ${r.text}`);
    assert.ok(r.json.fields && r.json.fields[field], `${JSON.stringify(over)} should flag ${field}: ${r.text}`);
  }
  const big = await post('/api/bookings', guest({ party: 9 }));
  assert.match(big.json.fields.party, /call|email/i, 'large parties get the call / email note');
});
test('booking: duplicate (same email + date + time) -> 409 duplicate', async () => {
  const body = guest({ time: '09:00' });
  assert.strictEqual((await post('/api/bookings', body)).status, 201);
  const again = await post('/api/bookings', Object.assign({}, body, { email: body.email.toUpperCase() }));
  assert.strictEqual(again.status, 409); assert.strictEqual(again.json.error, 'duplicate');
});
test('public POST guards: X-Requested-With, JSON parse errors, 20 KB body limit', async () => {
  const noHeader = await request('POST', '/api/bookings', { body: guest() });
  assert.strictEqual(noHeader.status, 403);
  const badJson = await request('POST', '/api/contact', { raw: '{"name": ', headers: { 'X-Requested-With': 'fetch', 'Content-Type': 'application/json' } });
  assert.strictEqual(badJson.status, 400); assert.strictEqual(badJson.json.error, 'invalid_json');
  const arrayBody = await request('POST', '/api/contact', { raw: '[1,2]', headers: { 'X-Requested-With': 'fetch' } });
  assert.strictEqual(arrayBody.status, 400);
  const huge = await post('/api/contact', { name: 'Big Body', email: 'big@example.com', topic: 'general', message: 'x'.repeat(21 * 1024), consent: true, website: '' });
  assert.strictEqual(huge.status, 413); assert.strictEqual(huge.json.error, 'payload_too_large');
});
test('security: every public POST needs X-Requested-With: fetch - a plain form post or XHR header is refused and nothing is stored', async () => {
  const count = () => ({ bookings: readData('bookings').length, messages: readData('messages').length, subscribers: readData('subscribers').length, activity: readData('activity').length });
  const before = count();
  const routes = [
    ['/api/bookings', guest({ time: '11:30', email: 'no.header@example.com' })],
    ['/api/bookings/cancel', { reference: 'LWL-AAAAAA', email: 'no.header@example.com' }],
    ['/api/contact', { name: 'No Header', email: 'no.header@example.com', topic: 'general', message: 'A cross-site form tried to post this.', consent: true, website: '' }],
    ['/api/subscribe', { email: 'no.header@example.com', consent: true, source: 'test', website: '' }],
  ];
  for (const [p, body] of routes) {
    const variants = [
      { body },                                                                                   // JSON, no header
      { body, headers: { 'X-Requested-With': 'XMLHttpRequest' } },                                 // wrong value
      { raw: new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, // an HTML <form> on another site
      { raw: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' } },                     // the "simple request" CSRF trick
    ];
    for (const v of variants) {
      const r = await request('POST', p, v);
      assert.strictEqual(r.status, 403, `${p} ${JSON.stringify(v.headers || {})} -> ${r.status}`); assert.strictEqual(r.json.error, 'forbidden');
    }
  }
  assert.deepStrictEqual(count(), before, 'nothing was written');
});
test('security: 413 for an oversized chunked body (no Content-Length) and on admin routes; 400 for malformed JSON everywhere', async () => {
  const chunked = (p, headers, size) => new Promise((resolve, reject) => {
    let response = null;
    const req = http.request({ host: '127.0.0.1', port: PORT, method: 'POST', path: p, headers: Object.assign({ 'X-Forwarded-For': freshIp(), 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' }, headers) }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c));
      res.on('end', () => { response = { status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }; try { response.json = JSON.parse(response.text); } catch { /* */ } resolve(response); });
    });
    req.on('error', (err) => { if (!response) reject(err); }); // the server may close the socket while we are still sending
    const piece = Buffer.from(`{"message":"${'x'.repeat(4000)}`); let sent = 0;
    (function pump() { while (sent < size) { sent += piece.length; if (!req.write(piece)) return void req.once('drain', pump); } req.end(); })();
  });
  const big = await chunked('/api/contact', { 'X-Requested-With': 'fetch' }, 64 * 1024);
  assert.strictEqual(big.status, 413, big.text); assert.strictEqual(big.json.error, 'payload_too_large');
  const adminBig = await request('POST', '/api/admin/login', { raw: JSON.stringify({ token: 'x'.repeat(25 * 1024) }), headers: { 'Content-Type': 'application/json' } });
  assert.strictEqual(adminBig.status, 413, 'admin login body limit');
  for (const [p, headers] of [['/api/bookings', { 'X-Requested-With': 'fetch' }], ['/api/subscribe', { 'X-Requested-With': 'fetch' }], ['/api/admin/login', {}]]) {
    for (const raw of ['{"email": ', '{bad json}', 'null', '"a string"', ' ']) {
      const r = await request('POST', p, { raw, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) });
      assert.strictEqual(r.status, 400, `${p} ${JSON.stringify(raw)} -> ${r.status}`); assert.strictEqual(r.json.error, 'invalid_json');
    }
  }
  assert.strictEqual((await get('/api/health')).status, 200, 'the server is still up');
});
test('booking: honeypot pretends success and stores nothing', async () => {
  const before = readData('bookings').length;
  const r = await post('/api/bookings', guest({ time: '10:00', website: 'http://spam.example' }));
  assert.strictEqual(r.status, 201); assert.match(r.json.reference, /^LWL-/);
  assert.strictEqual(readData('bookings').length, before);
  assert.strictEqual((await get(`/api/bookings/lookup?reference=${r.json.reference}&email=${encodeURIComponent(`guest${guestN}@example.com`)}`)).status, 404);
  const c = await post('/api/contact', { name: 'Bot', email: 'bot@example.com', topic: 'general', message: 'Buy cheap things now!!', consent: true, website: 'x' });
  assert.strictEqual(c.status, 201); assert.ok(!readData('messages').some((m) => m.email === 'bot@example.com'));
});
test('lookup: reference + email (case-insensitive), nothing for a wrong email', async () => {
  const ok = await get(`/api/bookings/lookup?reference=${firstBooking.reference.toLowerCase()}&email=MIXED.case@example.com`);
  assert.strictEqual(ok.status, 200); assert.strictEqual(ok.json.booking.reference, firstBooking.reference); assert.strictEqual(ok.json.booking.status, 'confirmed');
  assert.strictEqual((await get(`/api/bookings/lookup?reference=${firstBooking.reference}&email=someone.else@example.com`)).status, 404);
  assert.strictEqual((await get('/api/bookings/lookup?reference=LWL-ZZZZZZ&email=mixed.case@example.com')).status, 404);
  const missing = await get('/api/bookings/lookup?reference=&email=');
  assert.strictEqual(missing.status, 400); assert.ok(missing.json.fields.reference && missing.json.fields.email);
});
test('cancel: guest cancels, seats come back, repeat is idempotent, wrong email is 404', async () => {
  assert.strictEqual((await post('/api/bookings/cancel', { reference: firstBooking.reference, email: 'wrong@example.com' })).status, 404);
  const r = await post('/api/bookings/cancel', { reference: firstBooking.reference, email: 'Mixed.Case@example.com' });
  assert.strictEqual(r.status, 200, r.text); assert.strictEqual(r.json.booking.status, 'cancelled'); assert.strictEqual(r.json.booking.cancellable, false);
  const a = await get(`/api/availability?date=${MON}&party=2`);
  assert.strictEqual(slotOf(a, '12:00').seatsLeft, 28);
  const again = await post('/api/bookings/cancel', { reference: firstBooking.reference, email: 'mixed.case@example.com' });
  assert.strictEqual(again.status, 200); assert.strictEqual(again.json.booking.status, 'cancelled');
  assert.ok(readData('outbox').some((m) => m.reference === firstBooking.reference && /cancel/i.test(m.subject)));
  assert.strictEqual(readData('activity').filter((x) => x.action === 'booking.cancelled' && x.reference === firstBooking.reference).length, 1);
  // a cancelled booking no longer blocks a fresh one at the same time
  assert.strictEqual((await post('/api/bookings', guest({ email: 'mixed.case@example.com', party: 4 }))).status, 201);
});
test('rate limit: 10 public POSTs a minute per IP, then 429 with Retry-After', async () => {
  const ip = '203.0.113.77';
  for (let i = 0; i < 10; i++) {
    const r = await post('/api/subscribe', { email: `limit${i}@example.com`, consent: true, source: 'test', website: '' }, { ip });
    assert.strictEqual(r.status, 201, `request ${i + 1}: ${r.status}`);
  }
  const blocked = await post('/api/subscribe', { email: 'limit-x@example.com', consent: true, source: 'test', website: '' }, { ip });
  assert.strictEqual(blocked.status, 429); assert.strictEqual(blocked.json.error, 'rate_limited');
  assert.ok(Number(blocked.headers['retry-after']) >= 1);
  assert.strictEqual((await post('/api/subscribe', { email: 'limit-y@example.com', consent: true, source: 'test', website: '' }, { ip: '203.0.113.78' })).status, 201, 'other IPs are unaffected');
});
let messageId = null;
test('contact: 201 { id }, stored as a new message, validation per field', async () => {
  const r = await post('/api/contact', { name: 'Test Writer', email: 'Writer@Example.com', phone: '', topic: 'podcast-guest', message: 'I would love to come on the show and talk about libraries.', consent: true, website: '' });
  assert.strictEqual(r.status, 201, r.text); assert.ok(r.json.id); messageId = r.json.id;
  const stored = readData('messages').find((m) => m.id === r.json.id);
  assert.ok(stored && stored.status === 'new' && stored.email === 'writer@example.com' && stored.topic === 'podcast-guest');
  assert.ok(readData('customers').some((c) => c.email === 'writer@example.com'), 'contact upserts a customer');
  const bad = await post('/api/contact', { name: '', email: 'nope', topic: 'sales', message: 'short', consent: false, website: '' });
  assert.strictEqual(bad.status, 400);
  for (const f of ['name', 'email', 'topic', 'message', 'consent']) assert.ok(bad.json.fields[f], f);
  assert.strictEqual((await post('/api/contact', { name: 'Long Msg', email: 'l@example.com', topic: 'general', message: 'y'.repeat(2001), consent: true })).status, 400);
});
test('subscribe: 201 first time, 200 after that, consent + source recorded', async () => {
  const first = await post('/api/subscribe', { email: 'Reader@Example.com', consent: true, source: 'footer', website: '' });
  assert.strictEqual(first.status, 201);
  const second = await post('/api/subscribe', { email: 'reader@example.com', consent: true, source: 'footer', website: '' });
  assert.strictEqual(second.status, 200);
  const rows = readData('subscribers').filter((s) => s.email === 'reader@example.com');
  assert.strictEqual(rows.length, 1); assert.ok(rows[0].consentAt); assert.strictEqual(rows[0].source, 'footer');
  assert.strictEqual((await post('/api/subscribe', { email: 'nope', consent: true })).status, 400);
  const noConsent = await post('/api/subscribe', { email: 'ok@example.com', consent: false });
  assert.strictEqual(noConsent.status, 400); assert.ok(noConsent.json.fields.consent);
});
test('events: upcoming Thursday recording nights with live seatsLeft', async () => {
  const before = await get('/api/events');
  assert.strictEqual(before.status, 200); assert.ok(before.json.events.length >= 1);
  for (const e of before.json.events) {
    assert.ok(e.id && e.title && e.date >= today); assert.strictEqual(weekdayIndex(e.date), 4, `${e.date} is a Thursday`);
    assert.strictEqual(e.doors, '18:30'); assert.strictEqual(e.seats, 40); assert.ok(e.seatsLeft >= 0 && e.seatsLeft <= 40);
    for (const k of ['guest', 'role', 'pillar', 'blurb', 'image']) assert.ok(k in e, k);
  }
  const target = before.json.events.find((e) => e.bookable);
  assert.ok(target, 'at least one bookable recording night');
  const r = await post('/api/bookings', guest({ type: 'recording', date: target.date, time: '18:30', party: 3, occasion: 'recording-guest' }));
  assert.strictEqual(r.status, 201, r.text); assert.strictEqual(r.json.booking.type, 'recording'); assert.strictEqual(r.json.booking.time, '18:30');
  const after = await get('/api/events');
  assert.strictEqual(after.json.events.find((e) => e.date === target.date).seatsLeft, target.seatsLeft - 3);
});
test('api: unknown route 404, wrong method 405 - both JSON', async () => {
  const a = await get('/api/nope'); assert.strictEqual(a.status, 404); assert.strictEqual(a.json.error, 'not_found');
  const b = await request('DELETE', '/api/bookings'); assert.strictEqual(b.status, 405); assert.strictEqual(b.json.error, 'method_not_allowed');
});

// ---------------------------------------------------------------------------------------------------------------
// admin
// ---------------------------------------------------------------------------------------------------------------
test('admin: every route is 401 JSON without a session', async () => {
  const routes = [['GET', '/api/admin/session'], ['POST', '/api/admin/logout'], ['GET', '/api/admin/summary'], ['GET', '/api/admin/bookings'], ['POST', '/api/admin/bookings'],
    ['PATCH', '/api/admin/bookings/LWL-AAAAAA'], ['GET', '/api/admin/customers'], ['GET', '/api/admin/customers/cus_x'], ['PATCH', '/api/admin/customers/cus_x'], ['GET', '/api/admin/messages'],
    ['PATCH', '/api/admin/messages/msg_x'], ['GET', '/api/admin/subscribers'], ['DELETE', '/api/admin/subscribers/a%40example.com'], ['GET', '/api/admin/settings'], ['PUT', '/api/admin/settings'],
    ['GET', '/api/admin/activity'], ['GET', '/api/admin/export?kind=bookings'], ['GET', '/api/admin/anything-else'],
    ['GET', '/api/admin/bookings/LWL-AAAAAA'], ['DELETE', '/api/admin/subscribers/id/sub_x']];
  for (const [method, p] of routes) {
    const r = await request(method, p, { body: method === 'GET' ? undefined : {}, cookie: 'lwl_admin=forged' });
    assert.strictEqual(r.status, 401, `${method} ${p} -> ${r.status}`); assert.strictEqual(r.json.error, 'unauthorized');
    const bare = await request(method, p, { body: method === 'GET' ? undefined : {} });
    assert.strictEqual(bare.status, 401, `${method} ${p} without a cookie -> ${bare.status}`);
  }
});
let TOKEN = '';
test('admin: token was generated, printed once and saved to data/admin-token.txt', async () => {
  assert.ok(TOKEN.length >= 32, 'token printed on startup');
  assert.strictEqual(fs.readFileSync(path.join(DATA, 'admin-token.txt'), 'utf8').trim(), TOKEN);
});
test('admin: login is limited to 5 failed attempts per 15 minutes per IP', async () => {
  const ip = '198.51.100.9';
  for (let i = 0; i < 5; i++) {
    const r = await request('POST', '/api/admin/login', { body: { token: `wrong-${i}` }, ip });
    assert.strictEqual(r.status, 401, `attempt ${i + 1}`); assert.ok(!r.headers['set-cookie']);
  }
  const locked = await request('POST', '/api/admin/login', { body: { token: TOKEN }, ip });
  assert.strictEqual(locked.status, 429); assert.ok(Number(locked.headers['retry-after']) > 0);
});
test('security: spoofed X-Forwarded-For entries cannot dodge the login lockout or the public rate limit', async () => {
  const real = '198.51.100.44';
  for (let i = 0; i < 5; i++) {
    const r = await request('POST', '/api/admin/login', { body: { token: `spoof-${i}` }, ip: `203.0.113.${i + 1}, ${real}` });
    assert.strictEqual(r.status, 401, `attempt ${i + 1}`);
  }
  const locked = await request('POST', '/api/admin/login', { body: { token: TOKEN }, ip: `192.0.2.99, ${real}` });
  assert.strictEqual(locked.status, 429, 'a new left-hand address does not reset the lockout'); assert.ok(!locked.headers['set-cookie']);
  const other = await request('POST', '/api/admin/login', { body: { token: TOKEN }, ip: `${real}, 198.51.100.45` });
  assert.strictEqual(other.status, 200, 'the proxy-added (last) address is the client');
  const ip = '198.51.100.60';
  for (let i = 0; i < 10; i++) assert.strictEqual((await post('/api/subscribe', { email: `spoof${i}@example.com`, consent: true, source: 'test', website: '' }, { ip: `10.200.0.${i}, ${ip}` })).status, 201);
  assert.strictEqual((await post('/api/subscribe', { email: 'spoof-x@example.com', consent: true, source: 'test', website: '' }, { ip: `10.200.1.1, ${ip}` })).status, 429);
});
test('admin: login sets an HttpOnly SameSite=Strict cookie; session works', async () => {
  const r = await request('POST', '/api/admin/login', { body: { token: TOKEN } });
  assert.strictEqual(r.status, 200, r.text); assert.strictEqual(r.json.authenticated, true);
  const cookie = r.headers['set-cookie'][0];
  assert.match(cookie, /^lwl_admin=[\w-]{20,};/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Path=\//); assert.match(cookie, /Max-Age=43200/);
  assert.ok(!/Secure/.test(cookie), 'no Secure flag over plain http');
  adminCookie = cookie.split(';')[0];
  const https = await request('POST', '/api/admin/login', { body: { token: TOKEN }, headers: { 'X-Forwarded-Proto': 'https' } });
  assert.match(https.headers['set-cookie'][0], /; Secure/);
  const s = await adm('GET', '/api/admin/session');
  assert.strictEqual(s.status, 200); assert.strictEqual(s.json.authenticated, true); assert.ok(s.json.expiresAt);
  const cross = await request('POST', '/api/admin/bookings', { body: {}, cookie: adminCookie, headers: { Origin: 'https://evil.example' } });
  assert.strictEqual(cross.status, 403, 'cross-origin admin writes are refused');
});
test('admin: summary metrics', async () => {
  const { status, json } = await adm('GET', '/api/admin/summary');
  assert.strictEqual(status, 200);
  assert.strictEqual(json.today.date, today); assert.ok(Array.isArray(json.today.list));
  assert.strictEqual(json.next7Days.days.length, 7); assert.strictEqual(typeof json.next7Days.covers, 'number');
  assert.strictEqual(typeof json.covers.today, 'number'); assert.ok(json.newMessages >= 1); assert.ok(json.newSubscribers >= 1);
  assert.strictEqual(typeof json.noShowRate, 'number'); assert.ok(Array.isArray(json.topGuests) && json.topGuests.length >= 1);
});
test('admin: bookings list filters (from / to / status / type / q)', async () => {
  const all = await adm('GET', '/api/admin/bookings');
  assert.strictEqual(all.status, 200); assert.ok(all.json.total >= 4); assert.ok('internalNotes' in all.json.bookings[0]);
  const sorted = all.json.bookings.map((b) => b.date + b.time); assert.deepStrictEqual(sorted, [...sorted].sort());
  const cancelled = await adm('GET', '/api/admin/bookings?status=cancelled');
  assert.ok(cancelled.json.bookings.length >= 1 && cancelled.json.bookings.every((b) => b.status === 'cancelled'));
  const multi = await adm('GET', '/api/admin/bookings?status=cancelled,confirmed');
  assert.strictEqual(multi.json.total, all.json.total);
  const rec = await adm('GET', '/api/admin/bookings?type=recording');
  assert.ok(rec.json.bookings.length >= 1 && rec.json.bookings.every((b) => b.type === 'recording'));
  const range = await adm('GET', `/api/admin/bookings?from=${MON}&to=${MON}`);
  assert.ok(range.json.bookings.length >= 2 && range.json.bookings.every((b) => b.date === MON));
  assert.strictEqual((await adm('GET', `/api/admin/bookings?from=${addDays(MON, 200)}`)).json.total, 0);
  const byRef = await adm('GET', `/api/admin/bookings?q=${firstBooking.reference.toLowerCase()}`);
  assert.strictEqual(byRef.json.total, 1);
  assert.ok((await adm('GET', '/api/admin/bookings?q=mixed.case')).json.total >= 2);
  assert.ok((await adm('GET', '/api/admin/bookings?q=Test%20Guest%201')).json.total >= 1);
  assert.ok((await adm('GET', '/api/admin/bookings?q=555%20010%200199')).json.total >= 3);
  assert.strictEqual((await adm('GET', '/api/admin/bookings?q=zzzz-no-match')).json.total, 0);
  assert.strictEqual((await adm('GET', '/api/admin/bookings?status=banana')).status, 400);
});
let flowRef = '', flowEmail = '';
test('admin: PATCH status flow confirmed -> seated -> completed updates the customer', async () => {
  const b = guest({ date: TUE2, time: '13:00', party: 3 }); flowEmail = b.email;
  flowRef = (await post('/api/bookings', b)).json.reference;
  const seated = await adm('PATCH', `/api/admin/bookings/${flowRef}`, { status: 'seated', table: 'T4', internalNotes: 'By the window' });
  assert.strictEqual(seated.status, 200, seated.text); assert.strictEqual(seated.json.booking.status, 'seated'); assert.strictEqual(seated.json.booking.table, 'T4');
  const done = await adm('PATCH', `/api/admin/bookings/${flowRef.toLowerCase()}`, { status: 'completed' });
  assert.strictEqual(done.json.booking.status, 'completed');
  const c = (await adm('GET', `/api/admin/customers?q=${encodeURIComponent(flowEmail)}`)).json.customers[0];
  assert.strictEqual(c.bookings, 1); assert.strictEqual(c.covers, 3); assert.strictEqual(c.lastVisit, TUE2); assert.strictEqual(c.noShows, 0); assert.strictEqual(c.upcoming, 0);
  assert.strictEqual((await adm('PATCH', `/api/admin/bookings/${flowRef}`, { status: 'done' })).status, 400);
  assert.strictEqual((await adm('PATCH', '/api/admin/bookings/LWL-ZZZZZZ', { status: 'seated' })).status, 404);
  const gone = await post('/api/bookings/cancel', { reference: flowRef, email: flowEmail });
  assert.strictEqual(gone.status, 409); assert.strictEqual(gone.json.error, 'not_cancellable');
});
test('admin: no_show updates the customer aggregates', async () => {
  const second = await post('/api/bookings', guest({ email: flowEmail, date: WED2, time: '09:30', party: 2 }));
  assert.strictEqual(second.status, 201);
  let c = (await adm('GET', `/api/admin/customers?q=${encodeURIComponent(flowEmail)}`)).json.customers[0];
  assert.strictEqual(c.bookings, 2); assert.strictEqual(c.upcoming, 1); assert.strictEqual(c.covers, 5);
  const ns = await adm('PATCH', `/api/admin/bookings/${second.json.reference}`, { status: 'no_show' });
  assert.strictEqual(ns.json.booking.status, 'no_show');
  c = (await adm('GET', `/api/admin/customers?q=${encodeURIComponent(flowEmail)}`)).json.customers[0];
  assert.strictEqual(c.noShows, 1); assert.strictEqual(c.covers, 3); assert.strictEqual(c.upcoming, 0);
  assert.strictEqual(readData('customers').find((x) => x.email === flowEmail).noShows, 1, 'persisted, not only computed on read');
  const a = await get(`/api/availability?date=${WED2}&party=2`);
  assert.strictEqual(slotOf(a, '09:30').seatsLeft, 28, 'a no-show frees the seats');
});
test('admin: GET /api/admin/bookings/:reference returns the full staff record', async () => {
  const r = await adm('GET', `/api/admin/bookings/${flowRef}`);
  assert.strictEqual(r.status, 200, r.text);
  assert.strictEqual(r.json.booking.reference, flowRef); assert.strictEqual(r.json.booking.status, 'completed'); assert.strictEqual(r.json.booking.table, 'T4');
  for (const k of ['id', 'internalNotes', 'source', 'customerId', 'consentAt', 'createdAt', 'updatedAt']) assert.ok(k in r.json.booking, k);
  assert.strictEqual((await adm('GET', `/api/admin/bookings/${flowRef.toLowerCase()}`)).json.booking.reference, flowRef, 'case-insensitive');
  const missing = await adm('GET', '/api/admin/bookings/LWL-ZZZZZZ');
  assert.strictEqual(missing.status, 404); assert.strictEqual(missing.json.error, 'not_found');
  assert.strictEqual((await get(`/api/admin/bookings/${flowRef}`)).status, 401, 'never public');
  assert.strictEqual((await get(`/api/bookings/${flowRef}`)).status, 404, 'there is no public by-reference route: guests need reference + email');
});
test('availability: excludeRef leaves a booking out of its own seat count - for staff sessions only', async () => {
  const date = addDays(WED2, 7);
  const made = await post('/api/bookings', guest({ date, time: '10:00', party: 6 }));
  assert.strictEqual(made.status, 201, made.text);
  const ref = made.json.reference;
  const plain = await get(`/api/availability?date=${date}&party=1`);
  for (const t of ['09:00', '09:30', '10:00', '10:30', '11:00']) assert.strictEqual(slotOf(plain, t).seatsLeft, 22, t);
  const staff = await request('GET', `/api/availability?date=${date}&party=1&excludeRef=${ref.toLowerCase()}`, { cookie: adminCookie });
  assert.strictEqual(staff.status, 200);
  assert.ok(staff.json.slots.every((x) => x.seatsLeft === 28), 'the edited booking does not count against itself');
  const other = await request('GET', `/api/availability?date=${date}&party=1&excludeRef=LWL-ZZZZZZ`, { cookie: adminCookie });
  assert.strictEqual(slotOf(other, '10:00').seatsLeft, 22, 'an unknown reference changes nothing');
  const anonymous = await get(`/api/availability?date=${date}&party=1&excludeRef=${ref}`);
  assert.strictEqual(slotOf(anonymous, '10:00').seatsLeft, 22, 'ignored without a staff session (no reference probing)');
  assert.strictEqual(slotOf(await request('GET', `/api/availability?date=${date}&party=1&excludeRef=${ref}`, { cookie: 'lwl_admin=forged' }), '10:00').seatsLeft, 22, 'a forged cookie is not a session');
  // recording nights
  const recDate = addDays(THU, 14);
  const before = (await get(`/api/availability?date=${recDate}&type=recording&party=1`)).json.slots[0].seatsLeft;
  const rsvp = await post('/api/bookings', guest({ type: 'recording', date: recDate, party: 4 }));
  assert.strictEqual(rsvp.status, 201, rsvp.text);
  assert.strictEqual((await get(`/api/availability?date=${recDate}&type=recording&party=1`)).json.slots[0].seatsLeft, before - 4);
  assert.strictEqual((await request('GET', `/api/availability?date=${recDate}&type=recording&party=1&excludeRef=${rsvp.json.reference}`, { cookie: adminCookie })).json.slots[0].seatsLeft, before);
});
test('admin: staff messages are written for staff (no "Send force: true")', async () => {
  const past = await adm('POST', '/api/admin/bookings', { date: addDays(today, -1), time: '12:00', party: 2, name: 'Past Walk In', phone: '555 010 0104', source: 'walk-in' });
  assert.strictEqual(past.status, 400); assert.ok(past.json.fields.date);
  assert.ok(!/force\s*:|send force|true/i.test(past.json.fields.date + past.json.message), past.json.fields.date);
  assert.match(past.json.fields.date, /already passed\. Staff can still record it with the override\./);
  const guestPast = await post('/api/bookings', guest({ date: addDays(today, -1) }));
  assert.ok(!/override|force/i.test(guestPast.json.fields.date), 'guests never see the staff hint');
});
test('admin: manual booking (phone / walk-in), phone-keyed customer, source validation', async () => {
  const r = await adm('POST', '/api/admin/bookings', { type: 'table', date: MON2, time: '08:00', party: 10, name: 'Phone Caller', phone: '(555) 010-0142', source: 'phone', internalNotes: 'Called at noon' });
  assert.strictEqual(r.status, 201, r.text); assert.match(r.json.reference, /^LWL-/); assert.strictEqual(r.json.booking.source, 'phone'); assert.strictEqual(r.json.booking.party, 10, 'staff may seat large parties');
  const c = (await adm('GET', '/api/admin/customers?q=Phone%20Caller')).json.customers[0];
  assert.ok(c && c.email === '' && c.bookings === 1 && c.covers === 10);
  assert.ok(readData('activity').some((x) => x.reference === r.json.reference && x.who === 'admin' && x.action === 'booking.created'));
  assert.strictEqual((await adm('POST', '/api/admin/bookings', { date: MON2, time: '08:00', party: 2, name: 'No Contact', source: 'phone' })).status, 400);
  const badSource = await adm('POST', '/api/admin/bookings', { date: MON2, time: '08:00', party: 2, name: 'Bad Source', phone: '555 010 0101', source: 'carrier-pigeon' });
  assert.strictEqual(badSource.status, 400); assert.ok(badSource.json.fields.source);
  const past = { date: addDays(today, -1), time: '12:00', party: 2, name: 'Walk In', phone: '555 010 0102', source: 'walk-in', status: 'completed' };
  assert.strictEqual((await adm('POST', '/api/admin/bookings', past)).status, 400, 'past dates need force');
  assert.strictEqual((await adm('POST', '/api/admin/bookings', Object.assign({ force: true }, past))).status, 201);
});
test('cancel rule: not inside 2 hours', async () => {
  const soon = new Date(Date.now() + 60 * 60000);
  const body = { date: isoDate(soon), time: `${pad(soon.getHours())}:${pad(soon.getMinutes())}`, party: 2, name: 'Soon Guest', email: 'soon@example.com', phone: '555 010 0103', source: 'phone', force: true };
  const made = await adm('POST', '/api/admin/bookings', body);
  assert.strictEqual(made.status, 201, made.text);
  const look = await get(`/api/bookings/lookup?reference=${made.json.reference}&email=soon@example.com`);
  assert.strictEqual(look.json.booking.cancellable, false);
  const r = await post('/api/bookings/cancel', { reference: made.json.reference, email: 'soon@example.com' });
  assert.strictEqual(r.status, 409); assert.strictEqual(r.json.error, 'too_late');
  assert.strictEqual((await adm('PATCH', `/api/admin/bookings/${made.json.reference}`, { status: 'cancelled' })).json.booking.status, 'cancelled', 'staff can still cancel');
});
test('admin: customers list, profile + history, PATCH tags / notes / vip', async () => {
  const list = await adm('GET', '/api/admin/customers');
  assert.ok(list.json.total >= 5);
  const c = (await adm('GET', '/api/admin/customers?q=mixed.case')).json.customers[0];
  assert.strictEqual(c.email, 'mixed.case@example.com'); assert.strictEqual(c.cancellations, 1); assert.strictEqual(c.bookings, 1); assert.strictEqual(c.marketingOptIn, true);
  for (const k of ['id', 'name', 'email', 'phone', 'firstSeen', 'lastSeen', 'bookings', 'covers', 'cancellations', 'noShows', 'upcoming', 'lastVisit', 'marketingOptIn', 'tags', 'notes', 'vip']) assert.ok(k in c, k);
  const p = await adm('PATCH', `/api/admin/customers/${c.id}`, { tags: ['Regular', 'window-seat', 'regular'], notes: 'Likes oat milk', vip: true });
  assert.strictEqual(p.status, 200, p.text); assert.deepStrictEqual(p.json.customer.tags, ['regular', 'window-seat']); assert.strictEqual(p.json.customer.vip, true);
  const profile = await adm('GET', `/api/admin/customers/${c.id}`);
  assert.strictEqual(profile.json.customer.notes, 'Likes oat milk'); assert.strictEqual(profile.json.bookings.length, 2); assert.strictEqual(profile.json.subscribed, true);
  assert.strictEqual((await adm('GET', '/api/admin/customers?vip=1')).json.total, 1);
  assert.strictEqual((await adm('PATCH', `/api/admin/customers/${c.id}`, { vip: 'yes' })).status, 400);
  assert.strictEqual((await adm('GET', '/api/admin/customers/cus_missing')).status, 404);
  const writer = await adm('GET', `/api/admin/customers/${(await adm('GET', '/api/admin/customers?q=writer@')).json.customers[0].id}`);
  assert.strictEqual(writer.json.messages.length, 1);
});
test('admin: messages list + PATCH', async () => {
  const list = await adm('GET', '/api/admin/messages');
  assert.ok(list.json.messages.some((m) => m.id === messageId && m.status === 'new'));
  const p = await adm('PATCH', `/api/admin/messages/${messageId}`, { status: 'open', internalNotes: 'Forwarded to Lata' });
  assert.strictEqual(p.json.message.status, 'open'); assert.strictEqual(p.json.message.internalNotes, 'Forwarded to Lata');
  assert.strictEqual((await adm('GET', '/api/admin/messages?status=new')).json.messages.some((m) => m.id === messageId), false);
  assert.strictEqual((await adm('PATCH', `/api/admin/messages/${messageId}`, { status: 'archived' })).status, 400);
  assert.strictEqual((await adm('PATCH', '/api/admin/messages/msg_missing', { status: 'done' })).status, 404);
});
test('admin: subscribers list + DELETE', async () => {
  const list = await adm('GET', '/api/admin/subscribers');
  assert.ok(list.json.subscribers.some((s) => s.email === 'reader@example.com'));
  const del = await adm('DELETE', `/api/admin/subscribers/${encodeURIComponent('Reader@example.com')}`);
  assert.strictEqual(del.status, 200, del.text);
  assert.strictEqual((await adm('DELETE', `/api/admin/subscribers/${encodeURIComponent('reader@example.com')}`)).status, 404);
  assert.strictEqual(readData('customers').find((c) => c.email === 'reader@example.com').marketingOptIn, false);
  assert.ok(!JSON.stringify(readData('activity').filter((a) => a.action === 'subscriber.removed')).includes('reader@example.com'), 'removed address is masked in the audit log');
});
test('admin: subscribers DELETE by id keeps the address out of the URL', async () => {
  assert.strictEqual((await post('/api/subscribe', { email: 'By.Id@Example.com', consent: true, source: 'footer-newsletter', website: '' })).status, 201);
  const row = (await adm('GET', '/api/admin/subscribers')).json.subscribers.find((x) => x.email === 'by.id@example.com');
  assert.ok(row && /^sub_[0-9a-f]+$/.test(row.id), 'rows carry an id'); assert.strictEqual(row.source, 'footer-newsletter');
  const del = await adm('DELETE', `/api/admin/subscribers/id/${row.id}`);
  assert.strictEqual(del.status, 200, del.text); assert.strictEqual(del.json.ok, true); assert.strictEqual(del.json.id, row.id); assert.strictEqual(del.json.removed, 'by.id@example.com');
  assert.ok(!readData('subscribers').some((x) => x.email === 'by.id@example.com'));
  assert.strictEqual(readData('customers').find((c) => c.email === 'by.id@example.com').marketingOptIn, false);
  const again = await adm('DELETE', `/api/admin/subscribers/id/${row.id}`);
  assert.strictEqual(again.status, 404); assert.strictEqual(again.json.error, 'not_found');
  assert.strictEqual((await adm('DELETE', '/api/admin/subscribers/id/sub_missing')).status, 404);
  assert.ok(!JSON.stringify(readData('activity')).includes('by.id@example.com'), 'the audit log keeps a masked address only');
  assert.strictEqual((await request('DELETE', `/api/admin/subscribers/id/${row.id}`, { cookie: adminCookie, headers: { Origin: 'https://evil.example' } })).status, 403, 'cross-origin delete refused');
  assert.strictEqual((await adm('DELETE', '/api/admin/subscribers/id')).status, 404, '"id" alone is treated as an (unknown) address by the email route');
});
test('admin: settings PUT is validated and changes availability', async () => {
  const s = await adm('GET', '/api/admin/settings');
  assert.strictEqual(s.json.capacityPerSlot, 28); assert.strictEqual(s.json.recordingSeats, 40); assert.deepStrictEqual(s.json.blockedDates, []); assert.deepStrictEqual(s.json.settings.hoursOverrides, {});
  const bad = await adm('PUT', '/api/admin/settings', { capacityPerSlot: 0, recordingSeats: 'many', blockedDates: ['tomorrow'], hoursOverrides: { [WED]: { open: '18:00', close: '09:00' } } });
  assert.strictEqual(bad.status, 400);
  for (const f of ['capacityPerSlot', 'recordingSeats', 'blockedDates', 'hoursOverrides']) assert.ok(bad.json.fields[f], f);
  const put = await adm('PUT', '/api/admin/settings', { capacityPerSlot: 12, recordingSeats: 30, blockedDates: [FRI], hoursOverrides: { [WED]: null, [addDays(WED, 14)]: { open: '10:00', close: '14:00' } } });
  assert.strictEqual(put.status, 200, put.text); assert.strictEqual(put.json.capacityPerSlot, 12);
  assert.strictEqual(slotOf(await get(`/api/availability?date=${addDays(MON, 14)}&party=2`), '12:00').seatsLeft, 12);
  const closed = await get(`/api/availability?date=${WED}&party=2`);
  assert.strictEqual(closed.json.open, false); assert.strictEqual(closed.json.reasonCode, 'closed'); assert.ok(closed.json.reason);
  const blocked = await get(`/api/availability?date=${FRI}&party=2`);
  assert.strictEqual(blocked.json.open, false); assert.strictEqual(blocked.json.reasonCode, 'blocked');
  assert.strictEqual((await post('/api/bookings', guest({ date: FRI, time: '12:00' }))).status, 400, 'blocked dates cannot be booked');
  assert.strictEqual((await post('/api/bookings', guest({ date: WED, time: '12:00' }))).status, 400, 'closed days cannot be booked');
  const short = await get(`/api/availability?date=${addDays(WED, 14)}&party=2`);
  assert.deepStrictEqual(short.json.slots.map((x) => x.time), ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30']);
  assert.strictEqual((await get(`/api/availability?date=${THU}&type=recording&party=1`)).json.slots[0].seatsLeft <= 30, true);
  const cfg = await get('/api/config');
  assert.deepStrictEqual(cfg.json.blockedDates, [FRI]); assert.strictEqual(cfg.json.recording.seats, 30);
  assert.ok(JSON.parse(fs.readFileSync(path.join(DATA, 'settings.json'), 'utf8')).capacityPerSlot === 12);
});
test('slot_full: a full slot is refused and shown as unavailable', async () => {
  assert.strictEqual((await adm('PUT', '/api/admin/settings', { capacityPerSlot: 10 })).status, 200);
  assert.strictEqual((await post('/api/bookings', guest({ date: MON2, time: '15:00', party: 8 }))).status, 201);
  const full = await post('/api/bookings', guest({ date: MON2, time: '15:30', party: 4 }));
  assert.strictEqual(full.status, 409); assert.strictEqual(full.json.error, 'slot_full'); assert.strictEqual(full.json.seatsLeft, 2);
  const a = await get(`/api/availability?date=${MON2}&party=4`);
  assert.deepStrictEqual(slotOf(a, '15:30'), { time: '15:30', available: false, seatsLeft: 2, reason: 'full' });
  assert.strictEqual(slotOf(await get(`/api/availability?date=${MON2}&party=2`), '15:30').available, true);
});
test('race: 10 parallel requests at a capacity-limited slot never overbook', async () => {
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => post('/api/bookings', guest({ date: TUE, time: '12:00', party: 2, email: `racer${i}@example.com` }))));
  const okCount = results.filter((r) => r.status === 201).length;
  const fullCount = results.filter((r) => r.status === 409 && r.json.error === 'slot_full').length;
  assert.strictEqual(okCount, 5, `statuses: ${results.map((r) => r.status).join(',')}`); assert.strictEqual(fullCount, 5);
  const seated = readData('bookings').filter((b) => b.date === TUE && b.time === '12:00' && b.status === 'confirmed').reduce((n, b) => n + b.party, 0);
  assert.strictEqual(seated, 10);
  assert.strictEqual(new Set(readData('bookings').map((b) => b.reference)).size, readData('bookings').length, 'references are unique');
  const a = await get(`/api/availability?date=${TUE}&party=1`);
  assert.deepStrictEqual(slotOf(a, '12:00'), { time: '12:00', available: false, seatsLeft: 0, reason: 'full' });
  // recording nights too: 12 parallel parties of 4 against the seats that are left (30 at most -> 7 fit)
  const recDate = addDays(THU, 7);
  const fit = Math.floor((await get(`/api/availability?date=${recDate}&type=recording&party=1`)).json.slots[0].seatsLeft / 4);
  const rec = await Promise.all(Array.from({ length: 12 }, (_, i) => post('/api/bookings', guest({ type: 'recording', date: recDate, time: '18:30', party: 4, email: `rec${i}@example.com` }))));
  assert.ok(fit >= 1 && fit <= 7, `fit: ${fit}`);
  assert.strictEqual(rec.filter((r) => r.status === 201).length, fit); assert.strictEqual(rec.filter((r) => r.status === 409 && r.json.error === 'slot_full').length, 12 - fit);
});
test('admin: moving a booking re-checks availability; force overrides capacity', async () => {
  const mover = await post('/api/bookings', guest({ date: TUE, time: '08:00', party: 2 }));
  const blocked = await adm('PATCH', `/api/admin/bookings/${mover.json.reference}`, { time: '12:00' });
  assert.strictEqual(blocked.status, 409); assert.strictEqual(blocked.json.error, 'slot_full');
  assert.strictEqual((await adm('PATCH', `/api/admin/bookings/${mover.json.reference}`, { time: '12:10' })).status, 400, 'off-grid time');
  assert.strictEqual((await adm('PATCH', `/api/admin/bookings/${mover.json.reference}`, { party: 11 })).status, 409, 'party above capacity');
  const forced = await adm('PATCH', `/api/admin/bookings/${mover.json.reference}`, { time: '12:00', force: true });
  assert.strictEqual(forced.status, 200, forced.text); assert.strictEqual(forced.json.booking.time, '12:00'); assert.strictEqual(forced.json.booking.forced, true);
  const moved = await adm('PATCH', `/api/admin/bookings/${mover.json.reference}`, { date: TUE2, time: '10:00', party: 3 });
  assert.strictEqual(moved.status, 200); assert.strictEqual(moved.json.booking.date, TUE2);
  assert.ok(readData('outbox').some((m) => m.reference === mover.json.reference && m.kind === 'booking.update'));
  assert.strictEqual((await adm('PUT', '/api/admin/settings', { capacityPerSlot: 28, recordingSeats: 40, blockedDates: [], hoursOverrides: {} })).status, 200);
});
test('admin: CSV export - BOM, header row, escaping, download headers', async () => {
  await adm('POST', '/api/admin/bookings', { date: MON2, time: '09:00', party: 2, name: '=HYPERLINK("http://x.example")', phone: '+1 555 010 0177', source: 'admin', notes: 'line one\nline two, with a comma' });
  const r = await adm('GET', '/api/admin/export?kind=bookings');
  assert.strictEqual(r.status, 200); assert.match(r.headers['content-type'], /text\/csv; charset=utf-8/);
  assert.match(r.headers['content-disposition'], /^attachment; filename="lwl-bookings-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.deepStrictEqual([...r.buffer.subarray(0, 3)], [0xEF, 0xBB, 0xBF], 'UTF-8 BOM');
  const lines = r.text.replace(/^\uFEFF/, '').split('\r\n');
  assert.ok(lines[0].startsWith('reference,type,date,time,party,status,name,email,phone,occasion,notes,'));
  assert.ok(r.text.includes('"He said ""hi"", twice"'), 'quotes are doubled');
  assert.ok(r.text.includes('"line one\nline two, with a comma"'), 'newlines and commas are quoted');
  assert.ok(r.text.includes('"\'=HYPERLINK(""http://x.example"")"'), 'formulas are neutralised');
  assert.ok(r.text.includes(",'+1 555 010 0177,") && !r.text.includes(',+1 555 010 0177,'), 'no exceptions: a phone number that starts with + gets the apostrophe too');
  const evil = [['+SUM(1+1)*cmd|x', "'+SUM(1+1)*cmd|x"], ['-2+3+cmd|x', "'-2+3+cmd|x"], ['@SUM(A1:A9)', "'@SUM(A1:A9)"], ['=1+1', "'=1+1"]];
  for (let i = 0; i < evil.length; i++) {
    const made = await adm('POST', '/api/admin/bookings', { date: MON2, time: '09:30', party: 1, name: evil[i][0], phone: `+1 555 010 02${pad(i)}`, source: 'admin', table: evil[i][0], internalNotes: evil[i][0] });
    assert.strictEqual(made.status, 201, made.text);
  }
  const guarded = (await adm('GET', '/api/admin/export?kind=bookings')).text;
  for (const [raw, safe] of evil) {
    assert.ok(guarded.includes(safe), `${raw} is prefixed with an apostrophe`);
    assert.ok(!guarded.split('\r\n').some((line) => line.split(',').some((c) => c === raw || c.startsWith(`"${raw}`))), `${raw} never starts a cell`);
  }
  const csvLib = require(path.join(ROOT, 'lib', 'csv.cjs'));
  for (const v of ['=x', '+x', '-x', '@x', '\t=x', '\r=x']) assert.ok(csvLib.cell(v).replace(/^"/, '').startsWith("'"), JSON.stringify(v));
  assert.strictEqual(csvLib.cell('+1 (555) 010-0177'), "'+1 (555) 010-0177"); assert.strictEqual(csvLib.cell('plain'), 'plain'); assert.strictEqual(csvLib.cell(-5), "'-5");
  const custCsv = (await adm('GET', '/api/admin/export?kind=customers')).text;
  assert.ok(custCsv.includes("'@SUM(A1:A9)") && !/,@SUM/.test(custCsv), 'the customers export is guarded too');
  for (const [kind, head] of [['customers', 'id,name,email,phone,vip,tags'], ['messages', 'id,createdAt,status,topic'], ['subscribers', 'email,source,consentAt']]) {
    const x = await adm('GET', `/api/admin/export?kind=${kind}`);
    assert.strictEqual(x.status, 200); assert.ok(x.text.replace(/^\uFEFF/, '').startsWith(head), kind);
  }
  assert.strictEqual((await adm('GET', '/api/admin/export?kind=everything')).status, 400);
  const filtered = await adm('GET', '/api/admin/export?kind=bookings&type=recording');
  assert.ok(filtered.text.split('\r\n').slice(1).filter(Boolean).every((l) => l.includes(',recording,')));
});
test('admin: activity log records who / action / reference / at', async () => {
  const { status, json } = await adm('GET', '/api/admin/activity');
  assert.strictEqual(status, 200); assert.ok(json.activity.length > 10 && json.activity.length <= 500);
  for (const a of json.activity) assert.ok(a.who && a.action && a.reference && a.at, JSON.stringify(a));
  assert.ok(json.activity[0].at >= json.activity[json.activity.length - 1].at, 'newest first');
  const actions = new Set(json.activity.map((a) => `${a.who}:${a.action}`));
  for (const x of ['guest:booking.created', 'guest:booking.cancelled', 'admin:booking.created', 'admin:booking.seated', 'admin:booking.completed', 'admin:booking.no_show', 'admin:settings.updated', 'admin:customer.updated', 'guest:message.received', 'guest:subscriber.added', 'admin:subscriber.removed']) assert.ok(actions.has(x), x);
  const one = await adm('GET', `/api/admin/activity?reference=${flowRef}`);
  assert.deepStrictEqual(one.json.activity.map((a) => a.action).reverse(), ['booking.created', 'booking.seated', 'booking.completed']);
});
test('admin: logout ends the session', async () => {
  const out = await adm('POST', '/api/admin/logout');
  assert.strictEqual(out.status, 200); assert.match(out.headers['set-cookie'][0], /Max-Age=0/);
  assert.strictEqual((await adm('GET', '/api/admin/session')).status, 401);
  for (const [method, p] of [['GET', '/api/admin/summary'], ['GET', '/api/admin/bookings'], ['GET', `/api/admin/bookings/${flowRef}`], ['GET', '/api/admin/customers'], ['GET', '/api/admin/export?kind=customers'],
    ['PATCH', `/api/admin/bookings/${flowRef}`], ['PUT', '/api/admin/settings'], ['DELETE', '/api/admin/subscribers/id/sub_x'], ['POST', '/api/admin/logout']]) {
    const r = await adm(method, p, method === 'GET' ? undefined : {});
    assert.strictEqual(r.status, 401, `${method} ${p} after logout -> ${r.status}`);
  }
  assert.strictEqual(slotOf(await request('GET', `/api/availability?date=${MON}&party=1&excludeRef=${firstBooking.reference}`, { cookie: adminCookie }), '09:00').seatsLeft,
    slotOf(await get(`/api/availability?date=${MON}&party=1`), '09:00').seatsLeft, 'excludeRef stops working with the session');
});

// ---------------------------------------------------------------------------------------------------------------
// robustness: a damaged data file, a restart
// ---------------------------------------------------------------------------------------------------------------
test('robustness: the running server moves a corrupt data file aside and keeps serving', async () => {
  const file = path.join(DATA, 'messages.json');
  const before = readData('messages').length;
  assert.ok(before >= 1);
  fs.writeFileSync(file, '{"half a file": [');
  assert.strictEqual((await get('/api/health')).status, 200);
  const r = await post('/api/contact', { name: 'After The Crash', email: 'after.crash@example.com', topic: 'general', message: 'Is the inbox still working after the damage?', consent: true, website: '' });
  assert.strictEqual(r.status, 201, r.text);
  assert.ok(fs.readdirSync(DATA).some((f) => f.startsWith('messages.json.corrupt-')), 'the unreadable file is renamed aside');
  const now = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(Array.isArray(now) && now.some((m) => m.id === r.json.id), 'messages.json is valid JSON again and holds the new message');
  assert.ok(now.length >= before, `earlier messages came back from the .bak copy (${now.length} >= ${before})`);
  fs.writeFileSync(path.join(DATA, 'outbox.json'), ''); // a truncated file must not stop public writes either
  assert.strictEqual((await post('/api/subscribe', { email: 'after.crash@example.com', consent: true, source: 'test', website: '' })).status, 201);
  assert.ok(/unreadable/i.test(serverLog()), 'the damage is reported on stderr');
});
test('robustness: a restart keeps data, token and settings - and ends every session', async () => {
  const bookingsBefore = readData('bookings').length, customersBefore = readData('customers').length;
  const login = await request('POST', '/api/admin/login', { body: { token: TOKEN } });
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  assert.strictEqual((await request('PUT', '/api/admin/settings', { body: { blockedDates: [FRI] }, cookie })).status, 200);
  await restartServer();
  assert.strictEqual((await get('/api/health')).status, 200);
  assert.strictEqual(readData('bookings').length, bookingsBefore); assert.strictEqual(readData('customers').length, customersBefore);
  const look = await get(`/api/bookings/lookup?reference=${flowRef}&email=${encodeURIComponent(flowEmail)}`);
  assert.strictEqual(look.status, 200, look.text); assert.strictEqual(look.json.booking.status, 'completed');
  assert.deepStrictEqual((await get('/api/config')).json.blockedDates, [FRI], 'settings survive');
  assert.strictEqual((await request('GET', '/api/admin/session', { cookie })).status, 401, 'sessions are in memory: a restart signs staff out');
  const again = await request('POST', '/api/admin/login', { body: { token: TOKEN } });
  assert.strictEqual(again.status, 200, 'the same token still signs in');
  const c2 = again.headers['set-cookie'][0].split(';')[0];
  assert.strictEqual((await request('GET', '/api/admin/bookings', { cookie: c2 })).json.total, bookingsBefore);
  assert.strictEqual((await request('PUT', '/api/admin/settings', { body: { blockedDates: [] }, cookie: c2 })).status, 200);
});

// ---------------------------------------------------------------------------------------------------------------
// in-process unit checks (no server needed)
// ---------------------------------------------------------------------------------------------------------------
test('unit: lead time - nothing in the past or less than 60 minutes ahead', async () => {
  const availability = require(path.join(ROOT, 'lib', 'availability.cjs'));
  const settings = require(path.join(ROOT, 'lib', 'settings.cjs')).defaults(ROOT);
  const d = util.parseDate(MON); d.setHours(11, 30, 0, 0);
  const a = availability.availability(settings, [], { date: MON, type: 'table', party: 2, now: d });
  assert.deepStrictEqual(a.slots.find((s) => s.time === '12:00'), { time: '12:00', available: false, seatsLeft: 28, reason: 'past' });
  assert.strictEqual(a.slots.find((s) => s.time === '09:00').available, false);
  assert.strictEqual(a.slots.find((s) => s.time === '12:30').available, true);
  assert.strictEqual(availability.check(settings, [], { date: MON, time: '12:00', party: 2, type: 'table', now: d }).field, 'time');
  assert.strictEqual(availability.check(settings, [], { date: MON, time: '12:30', party: 2, type: 'table', now: d }).ok, true);
  assert.strictEqual(availability.check(settings, [], { date: MON, time: '12:00', party: 2, type: 'table', now: d, admin: true }).ok, true, 'staff can seat a walk-in now');
  const late = util.parseDate(MON); late.setHours(17, 0, 0, 0);
  assert.strictEqual(availability.availability(settings, [], { date: MON, type: 'table', party: 2, now: late }).reasonCode, 'too_late_today');
});
test('security (unit): CSV injection - every cell starting with = + - @ TAB or CR gets an apostrophe, no exceptions', async () => {
  const { cell, toCsv } = require(path.join(ROOT, 'lib', 'csv.cjs'));
  const cases = [
    ['=1+1', "'=1+1"], ['+1 555 010 0199', "'+1 555 010 0199"], ['+64 21 555 0123', "'+64 21 555 0123"], ['-2+3+cmd|\' /C calc\'!A0', "'-2+3+cmd|' /C calc'!A0"],
    ['@SUM(A1:A9)', "'@SUM(A1:A9)"], ['\t=cmd', "'\t=cmd"], ['=HYPERLINK("http://x.example","click")', '"\'=HYPERLINK(""http://x.example"",""click"")"'],
    ['\r=cmd', '"\'\r=cmd"'], [-5, "'-5"], [['=a', 'b'], "'=a; b"],
    ['plain', 'plain'], ['a=b', 'a=b'], ['LWL-7KQ2MD', 'LWL-7KQ2MD'], ['2026-09-17', '2026-09-17'], [42, '42'], [true, 'yes'], [null, ''], ['', ''],
  ];
  for (const [input, expected] of cases) assert.strictEqual(cell(input), expected, JSON.stringify(input));
  const out = toCsv([['=header', 'a'], ['name', 'b']], [{ a: '@x', b: '+y' }]);
  assert.strictEqual(out, "﻿'=header,name\r\n'@x,'+y\r\n", 'header cells are guarded too');
  // no line of any CSV the server can build starts a cell with a formula character
  for (const line of out.replace(/^﻿/, '').split('\r\n').filter(Boolean)) for (const c of line.split(',')) assert.ok(!/^"?[=+\-@\t\r]/.test(c), c);
});
test('security (unit): client address - X-Forwarded-For only behind TRUST_PROXY, and the proxy-added entry wins', async () => {
  const { clientIp } = require(path.join(ROOT, 'lib', 'http.cjs'));
  const req = (xff) => ({ headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress: '127.0.0.1' } });
  const saved = process.env.TRUST_PROXY;
  try {
    delete process.env.TRUST_PROXY;
    assert.strictEqual(clientIp(req('203.0.113.9')), '127.0.0.1', 'not trusted without TRUST_PROXY');
    process.env.TRUST_PROXY = '1';
    assert.strictEqual(clientIp(req('203.0.113.9')), '203.0.113.9');
    assert.strictEqual(clientIp(req('1.2.3.4, 203.0.113.9')), '203.0.113.9', 'a client-supplied left entry is ignored');
    assert.strictEqual(clientIp(req('')), '127.0.0.1');
    process.env.TRUST_PROXY = '2';
    assert.strictEqual(clientIp(req('6.6.6.6, 198.51.100.1, 10.0.0.2')), '198.51.100.1', 'two proxies: second from the right');
    process.env.TRUST_PROXY = 'yes';
    assert.strictEqual(clientIp(req('203.0.113.9')), '127.0.0.1', 'only a hop count enables it');
  } finally { if (saved === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = saved; }
});
test('security (unit): a DATA_DIR inside the site root is never served, whatever it is called', async () => {
  const { resolvePath } = require(path.join(ROOT, 'lib', 'static.cjs'));
  const dataDir = path.join(ROOT, 'content', 'private-store');
  const probes = ['/content/private-store/bookings.json', '/content/private-store/', '/content/x/../private-store/bookings.json', '/content/private-store%2fadmin-token.txt'];
  if (process.platform === 'win32') probes.push('/CONTENT/Private-Store/admin-token.txt'); // case-insensitive file system
  for (const p of probes) assert.strictEqual(resolvePath(ROOT, dataDir, p).status, 403, p);
  assert.ok(resolvePath(ROOT, dataDir, '/content/pages.json').file, 'its neighbours are still public');
});
test('unit: store writes atomically and survives a corrupt file', async () => {
  const { createStore } = require(path.join(ROOT, 'lib', 'store.cjs'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lwl-store-'));
  const realError = console.error; const warnings = []; console.error = (...a) => warnings.push(a.join(' ')); // the store reports corruption on stderr
  try {
    const store = createStore(dir);
    await Promise.all(Array.from({ length: 25 }, (_, i) => store.transaction((tx) => { const list = tx.get('bookings'); list.push({ n: i, count: list.length }); tx.save('bookings'); })));
    const rows = store.read('bookings');
    assert.strictEqual(rows.length, 25); assert.deepStrictEqual(rows.map((r) => r.count), rows.map((_, i) => i), 'transactions ran one at a time');
    assert.deepStrictEqual(fs.readdirSync(dir).filter((f) => f.includes('.tmp-')), [], 'no temp files left behind');
    await assert.rejects(store.transaction((tx) => { tx.get('bookings').push({ n: 'x' }); tx.save('bookings'); throw new Error('boom'); }));
    assert.strictEqual(store.read('bookings').length, 25, 'a failed transaction writes nothing');
    fs.writeFileSync(path.join(dir, 'bookings.json'), '{"this is": not json');
    const recovered = createStore(dir).read('bookings');
    assert.strictEqual(recovered.length, 24, 'falls back to the .bak copy (one write behind)');
    assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('bookings.json.corrupt-')), 'the corrupt file is kept aside');
    fs.writeFileSync(path.join(dir, 'messages.json'), '');
    assert.deepStrictEqual(createStore(dir).read('messages'), [], 'no backup: safe default');
    assert.ok(warnings.some((w) => /bookings.json is unreadable/.test(w)), 'corruption is reported');
  } finally { console.error = realError; fs.rmSync(dir, { recursive: true, force: true }); }
});
test('cli: --seed writes clearly-marked demo data, --reset clears it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lwl-seed-'));
  const run = (flag) => new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'server.cjs'), ...flag], { env: Object.assign({}, process.env, { DATA_DIR: dir }) });
    let out = ''; p.stdout.on('data', (c) => (out += c)); p.stderr.on('data', (c) => (out += c)); p.on('close', (code) => resolve({ code, out }));
  });
  try {
    const seeded = await run(['--seed']);
    assert.strictEqual(seeded.code, 0, seeded.out); assert.match(seeded.out, /DEMO/);
    const read = (n) => JSON.parse(fs.readFileSync(path.join(dir, `${n}.json`), 'utf8'));
    const b = read('bookings'), c = read('customers');
    assert.ok(b.length >= 38 && b.length <= 42, `bookings: ${b.length}`); assert.strictEqual(c.length, 25); assert.strictEqual(read('messages').length, 6); assert.strictEqual(read('subscribers').length, 15);
    for (const row of [...b, ...c, ...read('messages'), ...read('subscribers')]) { assert.strictEqual(row.demo, true); assert.match(row.email, /@example\.com$/); }
    assert.ok(b.every((x) => /^\(555\) 01/.test(x.phone))); assert.ok(c.some((x) => x.vip) && c.some((x) => x.tags.length));
    assert.ok(b.some((x) => x.date < today) && b.some((x) => x.date > today), 'past and upcoming');
    assert.ok(new Set(b.map((x) => x.status)).size >= 4, 'a spread of statuses'); assert.ok(b.some((x) => x.type === 'recording'));
    await run(['--seed']);
    assert.strictEqual(read('customers').length, 25, 'seeding twice does not duplicate');
    const reset = await run(['--reset', '--all']);
    assert.match(reset.out, /bookings\.json/); assert.deepStrictEqual(fs.readdirSync(dir), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------------------------------------------
// boot, run, report
// ---------------------------------------------------------------------------------------------------------------
let child = null, log = '', exited = true;
const serverLog = () => log;
async function startServer() {
  const env = Object.assign({}, process.env, { DATA_DIR: DATA, TRUST_PROXY: '1', LWL_QUIET: '1', PORT: String(PORT) });
  delete env.ADMIN_TOKEN;
  exited = false;
  const proc = spawn(process.execPath, [path.join(ROOT, 'server.cjs'), String(PORT)], { env, cwd: ROOT });
  child = proc;
  proc.stdout.on('data', (c) => { log += c; const m = /Admin token: (\S+)/.exec(log); if (m && !TOKEN) TOKEN = m[1]; });
  proc.stderr.on('data', (c) => { log += c; });
  proc.on('exit', () => { if (child === proc) exited = true; });
  for (let i = 0; i < 100 && !exited; i++) {
    try { if ((await get('/api/health')).status === 200) return true; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  return false;
}
async function stopServer() {
  if (!child || exited) return;
  const proc = child;
  await new Promise((resolve) => { proc.once('exit', resolve); proc.kill(); });
}
async function restartServer() {
  await stopServer();
  if (!(await startServer())) throw new Error('the server did not come back after the restart');
}

async function main() {
  const up = await startServer();
  let passed = 0, failed = 0;
  if (!up) { console.error(`server did not start on port ${PORT}:\n${log}`); failed = tests.length; }
  else {
    for (const t of tests) {
      try { await t.fn(); passed++; console.log(`  ok    ${t.name}`); }
      catch (err) { failed++; console.log(`  FAIL  ${t.name}\n        ${String(err && err.message ? err.message : err).split('\n').join('\n        ')}`); }
    }
  }
  await stopServer();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch { /* best effort */ }
  if (failed && /error/i.test(log)) console.log(`\nserver output:\n${log.slice(-2000)}`);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main();
