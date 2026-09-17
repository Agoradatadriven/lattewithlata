// Customers - the CRM core. One record per person, keyed by lower-cased email (fallback: phone digits for phone /
// walk-in bookings without an email). Upserted on every booking, contact message and newsletter sign-up; the
// aggregates are recomputed from the bookings whenever a booking changes.
'use strict';
const { newId, digitsOf, localDateTime, isoDate } = require('./util.cjs');
const { HttpError, validationError } = require('./http.cjs');
const validate = require('./validate.cjs');
const activity = require('./activity.cjs');

const keyOf = (email, phone) => (email ? String(email).toLowerCase() : (digitsOf(phone) ? `tel:${digitsOf(phone)}` : null));

/** Find or create the customer for these contact details inside a transaction. Returns the working-copy record. */
function upsert(tx, { name, email, phone, marketingOptIn, demo }) {
  const list = tx.get('customers');
  const nowIso = new Date().toISOString();
  const key = keyOf(email, phone);
  if (!key) return null;
  let c = list.find((x) => x.key === key);
  if (!c && email && digitsOf(phone)) { // a phone-only record for the same number: adopt the email
    c = list.find((x) => !x.email && x.key === `tel:${digitsOf(phone)}`);
    if (c) { c.email = String(email).toLowerCase(); c.key = c.email; }
  }
  if (!c) {
    c = {
      id: newId('cus'), key, name: name || '', email: email ? String(email).toLowerCase() : '', phone: phone || '',
      firstSeen: nowIso, lastSeen: nowIso, bookings: 0, covers: 0, cancellations: 0, noShows: 0, upcoming: 0,
      lastVisit: null, nextVisit: null, marketingOptIn: false, tags: [], notes: '', vip: false,
    };
    if (demo) c.demo = true;
    list.push(c);
  }
  if (name) c.name = name;
  if (phone) c.phone = phone;
  if (marketingOptIn === true) c.marketingOptIn = true;
  c.lastSeen = nowIso;
  tx.save('customers');
  return c;
}

/** Pure: fill the aggregate fields of one customer from the bookings list. */
function computeAggregates(c, bookings, now, index) {
  const mine = index ? index.get(c.id) || [] : bookings.filter((b) => b.customerId === c.id);
  const today = isoDate(now);
  let covers = 0, cancellations = 0, noShows = 0, upcoming = 0, count = 0, lastVisit = null, nextVisit = null;
  for (const b of mine) {
    if (b.status === 'cancelled') { cancellations++; continue; }
    count++;
    if (b.status === 'no_show') { noShows++; continue; }
    covers += b.party;
    if (b.status === 'seated' || b.status === 'completed') { if (!lastVisit || b.date > lastVisit) lastVisit = b.date; }
    else if ((b.status === 'pending' || b.status === 'confirmed') && (b.date > today || (b.date === today && localDateTime(b.date, b.time) >= now))) {
      upcoming++;
      if (!nextVisit || b.date < nextVisit) nextVisit = b.date;
    }
  }
  Object.assign(c, { bookings: count, covers, cancellations, noShows, upcoming, lastVisit, nextVisit });
  return c;
}

function recompute(tx, customerId) {
  if (!customerId) return;
  const c = tx.get('customers').find((x) => x.id === customerId);
  if (!c) return;
  computeAggregates(c, tx.get('bookings'), new Date());
  tx.save('customers');
}

const matches = (c, q) => {
  const needle = q.toLowerCase(); const digits = digitsOf(q);
  return [c.name, c.email, c.phone, c.notes, (c.tags || []).join(' ')].some((v) => String(v || '').toLowerCase().includes(needle))
    || (digits.length >= 3 && digitsOf(c.phone).includes(digits));
};

/** GET /api/admin/customers?q=&vip=1&tag=&optin=1 - aggregates are refreshed at read time so `upcoming` is never stale. */
function list(app, query) {
  const now = new Date();
  const bookings = app.store.read('bookings');
  const index = new Map();
  for (const b of bookings) { if (!index.has(b.customerId)) index.set(b.customerId, []); index.get(b.customerId).push(b); }
  let rows = app.store.read('customers').map((c) => computeAggregates(c, bookings, now, index));
  const q = String(query.q || '').trim();
  if (q) rows = rows.filter((c) => matches(c, q));
  if (query.vip === '1' || query.vip === 'true') rows = rows.filter((c) => c.vip);
  if (query.optin === '1' || query.optin === 'true') rows = rows.filter((c) => c.marketingOptIn);
  if (query.tag) rows = rows.filter((c) => (c.tags || []).includes(String(query.tag).toLowerCase()));
  rows.sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
  return { customers: rows, total: rows.length };
}

/** GET /api/admin/customers/:id -> profile + history */
function profile(app, id) {
  const bookings = app.store.read('bookings');
  const c = app.store.read('customers').find((x) => x.id === id);
  if (!c) throw new HttpError(404, 'not_found', 'No customer with that id.');
  computeAggregates(c, bookings, new Date());
  const history = bookings.filter((b) => b.customerId === c.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const messages = app.store.read('messages').filter((m) => m.customerId === c.id || (c.email && m.email === c.email)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const subscriber = c.email ? app.store.read('subscribers').find((s) => s.email === c.email) || null : null;
  return { customer: c, bookings: history, messages, subscriber, subscribed: !!subscriber };
}

/** PATCH /api/admin/customers/:id { tags?, notes?, vip?, name?, phone?, marketingOptIn? } */
async function patch(app, id, body) {
  const { value, fields } = validate.customerPatch(body);
  if (validate.hasErrors(fields)) throw validationError(fields);
  return app.store.transaction((tx) => {
    const c = tx.get('customers').find((x) => x.id === id);
    if (!c) throw new HttpError(404, 'not_found', 'No customer with that id.');
    const changed = Object.keys(value).filter((k) => JSON.stringify(c[k]) !== JSON.stringify(value[k]));
    Object.assign(c, value);
    if (value.marketingOptIn === false && c.email) { // opting a guest out also takes them off the newsletter list
      const subs = tx.get('subscribers'); const i = subs.findIndex((x) => x.email === c.email);
      if (i !== -1) { subs.splice(i, 1); tx.save('subscribers'); }
    }
    computeAggregates(c, tx.get('bookings'), new Date());
    tx.save('customers');
    if (changed.length) activity.log(tx, { who: 'admin', action: 'customer.updated', reference: c.id, detail: { changed } });
    return { customer: c };
  });
}

module.exports = { keyOf, upsert, computeAggregates, recompute, list, profile, patch };
