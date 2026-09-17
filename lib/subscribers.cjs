// Newsletter subscribers. Sign-up is idempotent; consent time and source are recorded with every row.
'use strict';
const { newId, maskEmail } = require('./util.cjs');
const { HttpError, validationError } = require('./http.cjs');
const validate = require('./validate.cjs');
const customers = require('./customers.cjs');
const activity = require('./activity.cjs');

/** Add a subscriber inside an existing transaction. Returns { created, subscriber }. */
function add(tx, app, { email, source, demo }) {
  const list = tx.get('subscribers');
  const existing = list.find((s) => s.email === email);
  if (existing) return { created: false, subscriber: existing };
  const nowIso = new Date().toISOString();
  const customer = customers.upsert(tx, { email, marketingOptIn: true, demo });
  const subscriber = { id: newId('sub'), email, source, consent: true, consentAt: nowIso, createdAt: nowIso, customerId: customer ? customer.id : null };
  if (demo) subscriber.demo = true;
  list.push(subscriber); tx.save('subscribers');
  activity.log(tx, { who: 'guest', action: 'subscriber.added', reference: subscriber.id, detail: { source } });
  activity.queueMail(tx, activity.subscribeWelcome(app, subscriber));
  return { created: true, subscriber };
}

/** POST /api/subscribe -> 201 (new) / 200 (already subscribed) */
async function subscribe(app, body) {
  if (validate.honeypotTripped(body)) return { status: 201, json: { ok: true, status: 'subscribed' } }; // bots get a polite nothing
  const { value, fields } = validate.subscribe(body);
  if (validate.hasErrors(fields)) throw validationError(fields);
  const r = await app.store.transaction((tx) => add(tx, app, value));
  return { status: r.created ? 201 : 200, json: { ok: true, status: r.created ? 'subscribed' : 'already_subscribed' } };
}

function list(app, query) {
  let rows = app.store.read('subscribers');
  const q = String((query && query.q) || '').trim().toLowerCase();
  if (q) rows = rows.filter((s) => s.email.includes(q) || String(s.source || '').includes(q));
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { subscribers: rows, total: rows.length };
}

/** Shared removal: `find(list)` returns the index of the row to drop. The audit log keeps a masked address only. */
function removeWhere(app, find) {
  return app.store.transaction((tx) => {
    const list = tx.get('subscribers');
    const i = find(list);
    if (i === -1) throw new HttpError(404, 'not_found', 'That address is not on the list.');
    const [row] = list.splice(i, 1); tx.save('subscribers');
    const c = tx.get('customers').find((x) => x.email === row.email);
    if (c) { c.marketingOptIn = false; tx.save('customers'); }
    activity.log(tx, { who: 'admin', action: 'subscriber.removed', reference: maskEmail(row.email) });
    return { ok: true, removed: row.email, id: row.id };
  });
}

/** DELETE /api/admin/subscribers/id/:id - preferred: no personal data in the URL (or in a proxy / access log) */
async function removeById(app, rawId) {
  const id = String(rawId || '').trim();
  return removeWhere(app, (list) => list.findIndex((s) => s.id === id));
}

/** DELETE /api/admin/subscribers/:email - kept for API clients that only know the address */
async function remove(app, rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  return removeWhere(app, (list) => list.findIndex((s) => s.email === email));
}

module.exports = { add, subscribe, list, remove, removeById };
