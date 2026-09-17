// Contact-form messages.
'use strict';
const { newId, digitsOf } = require('./util.cjs');
const { HttpError, validationError } = require('./http.cjs');
const validate = require('./validate.cjs');
const customers = require('./customers.cjs');
const activity = require('./activity.cjs');

/** POST /api/contact -> 201 { id } */
async function create(app, body) {
  if (validate.honeypotTripped(body)) return { status: 201, json: { id: newId('msg') } }; // stored nowhere
  const { value, fields } = validate.contact(body);
  if (validate.hasErrors(fields)) throw validationError(fields);
  const message = await app.store.transaction((tx) => {
    const customer = customers.upsert(tx, { name: value.name, email: value.email, phone: value.phone });
    const nowIso = new Date().toISOString();
    const m = {
      id: newId('msg'), name: value.name, email: value.email, phone: value.phone, topic: value.topic, message: value.message,
      status: 'new', internalNotes: '', consent: true, consentAt: nowIso, createdAt: nowIso, updatedAt: nowIso, customerId: customer ? customer.id : null,
    };
    tx.get('messages').push(m); tx.save('messages');
    activity.log(tx, { who: 'guest', action: 'message.received', reference: m.id, detail: { topic: m.topic } });
    activity.queueMail(tx, activity.contactAcknowledgement(app, m));
    return m;
  });
  return { status: 201, json: { id: message.id } };
}

/** GET /api/admin/messages?status=&topic=&q= */
function list(app, query) {
  let rows = app.store.read('messages');
  const statuses = String(query.status || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (statuses.length) rows = rows.filter((m) => statuses.includes(m.status));
  if (query.topic) rows = rows.filter((m) => m.topic === query.topic);
  const q = String(query.q || '').trim().toLowerCase();
  if (q) {
    const digits = digitsOf(q);
    rows = rows.filter((m) => [m.name, m.email, m.phone, m.message, m.id].some((v) => String(v || '').toLowerCase().includes(q)) || (digits.length >= 3 && digitsOf(m.phone).includes(digits)));
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { messages: rows, total: rows.length, counts: countByStatus(app.store.read('messages')) };
}
function countByStatus(all) {
  const counts = { new: 0, open: 0, done: 0 };
  for (const m of all) if (m.status in counts) counts[m.status]++;
  return counts;
}

/** PATCH /api/admin/messages/:id { status?, internalNotes? } */
async function patch(app, id, body) {
  const { value, fields } = validate.messagePatch(body);
  if (validate.hasErrors(fields)) throw validationError(fields);
  return app.store.transaction((tx) => {
    const m = tx.get('messages').find((x) => x.id === id);
    if (!m) throw new HttpError(404, 'not_found', 'No message with that id.');
    const before = m.status;
    Object.assign(m, value, { updatedAt: new Date().toISOString() });
    tx.save('messages');
    activity.log(tx, { who: 'admin', action: value.status && value.status !== before ? `message.${value.status}` : 'message.updated', reference: m.id });
    return { message: m };
  });
}

module.exports = { create, list, patch };
