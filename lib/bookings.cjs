// Bookings: create (guest + admin), lookup, cancel, admin list / change. Every mutation runs inside the store's
// write queue, so the capacity check and the write are one atomic step.
'use strict';
const { newId, newReference, digitsOf, isDate, localDateTime, humanDate, humanTime } = require('./util.cjs');
const { HttpError, validationError } = require('./http.cjs');
const validate = require('./validate.cjs');
const availability = require('./availability.cjs');
const settingsLib = require('./settings.cjs');
const customers = require('./customers.cjs');
const subscribers = require('./subscribers.cjs');
const activity = require('./activity.cjs');

const slotFull = (b, seatsLeft) => new HttpError(409, 'slot_full',
  b.type === 'recording'
    ? (seatsLeft > 0 ? `Only ${seatsLeft} ${seatsLeft === 1 ? 'place is' : 'places are'} left for that recording night.` : 'That recording night is full.')
    : (seatsLeft > 0 ? `We only have ${seatsLeft} ${seatsLeft === 1 ? 'seat' : 'seats'} left at ${humanTime(b.time)}. Please try another time.` : `${humanTime(b.time)} on ${humanDate(b.date)} has just filled up. Please try another time.`),
  { seatsLeft });

function cancelState(settings, b, now) {
  if (b.status === 'cancelled') return { cancellable: false, why: 'already_cancelled' };
  if (b.status !== 'pending' && b.status !== 'confirmed') return { cancellable: false, why: 'not_cancellable' };
  const deadline = new Date(localDateTime(b.date, b.time).getTime() - settings.cancelCutoffMinutes * 60000);
  return { cancellable: now < deadline, why: now < deadline ? null : 'too_late', cancelBy: deadline.toISOString() };
}

/** What a guest may see of their own booking. */
function guestView(settings, b, now) {
  const c = cancelState(settings, b, now || new Date());
  return {
    reference: b.reference, type: b.type, date: b.date, time: b.time, party: b.party, status: b.status,
    name: b.name, email: b.email, phone: b.phone, occasion: b.occasion, notes: b.notes, marketingOptIn: !!b.marketingOptIn,
    createdAt: b.createdAt, updatedAt: b.updatedAt, cancellable: c.cancellable, cancelBy: c.cancelBy || null,
  };
}

/** Shared create path. `input` is a validated booking; opts: { who: 'guest'|'admin', admin, force, demo }. */
function createInTx(tx, app, input, opts) {
  const settings = settingsLib.get(app, tx);
  const list = tx.get('bookings');
  const now = new Date();
  const b = Object.assign({}, input);
  if (b.type === 'recording') b.time = settings.recordingDoors; // one slot: doors
  if (b.email) {
    const dup = list.find((x) => x.email === b.email && x.date === b.date && x.time === b.time && x.status !== 'cancelled');
    if (dup) throw new HttpError(409, 'duplicate', `There is already a booking for ${b.email} on ${humanDate(b.date)} at ${humanTime(b.time)}. Use "Manage a booking" to change it.`);
  }
  const verdict = availability.check(settings, list, { date: b.date, time: b.time, party: b.party, type: b.type, now, admin: !!opts.admin, force: !!opts.force });
  if (!verdict.ok) {
    if (verdict.slotFull) throw slotFull(b, verdict.seatsLeft);
    throw validationError({ [verdict.field]: verdict.message }, verdict.message);
  }
  const customer = customers.upsert(tx, { name: b.name, email: b.email, phone: b.phone, marketingOptIn: b.marketingOptIn, demo: opts.demo });
  const nowIso = now.toISOString();
  const booking = {
    id: newId('bkg'), reference: newReference(new Set(list.map((x) => x.reference))),
    type: b.type, date: b.date, time: b.time, party: b.party, status: opts.admin ? b.status || 'confirmed' : 'confirmed',
    name: b.name, email: b.email || '', phone: b.phone || '', occasion: b.occasion || 'none', notes: b.notes || '',
    marketingOptIn: !!b.marketingOptIn, consent: opts.admin ? null : true, consentAt: opts.admin ? null : nowIso,
    table: b.table || '', internalNotes: b.internalNotes || '', source: opts.admin ? b.source || 'admin' : 'web',
    forced: !!(opts.admin && opts.force), customerId: customer ? customer.id : null, createdAt: nowIso, updatedAt: nowIso,
  };
  if (opts.demo) booking.demo = true;
  list.push(booking); tx.save('bookings');
  customers.recompute(tx, booking.customerId);
  if (booking.marketingOptIn && booking.email) subscribers.add(tx, app, { email: booking.email, source: 'booking', demo: opts.demo });
  activity.log(tx, { who: opts.who, action: 'booking.created', reference: booking.reference, detail: { type: booking.type, date: booking.date, time: booking.time, party: booking.party, source: booking.source } });
  if (booking.email) activity.queueMail(tx, activity.bookingConfirmation(app, booking));
  return { booking, settings };
}

/** POST /api/bookings */
async function createPublic(app, body) {
  if (validate.honeypotTripped(body)) { // pretend success, store nothing
    const fake = { reference: newReference(), type: body.type === 'recording' ? 'recording' : 'table', date: isDate(body.date) ? body.date : null, time: typeof body.time === 'string' ? body.time.slice(0, 5) : null, party: Number(body.party) || 1, status: 'confirmed' };
    return { status: 201, json: { reference: fake.reference, status: 'confirmed', booking: fake } };
  }
  const { value, fields } = validate.booking(body, { admin: false });
  if (validate.hasErrors(fields)) throw validationError(fields);
  const { booking, settings } = await app.store.transaction((tx) => createInTx(tx, app, value, { who: 'guest' }));
  return { status: 201, json: { reference: booking.reference, status: booking.status, booking: guestView(settings, booking) } };
}

/** POST /api/admin/bookings (phone / walk-in / admin) */
async function createAdmin(app, body) {
  const { value, fields } = validate.booking(body, { admin: true });
  if (validate.hasErrors(fields)) throw validationError(fields);
  const { booking } = await app.store.transaction((tx) => createInTx(tx, app, value, { who: 'admin', admin: true, force: value.force }));
  return { status: 201, json: { reference: booking.reference, status: booking.status, booking } };
}

function findForGuest(list, reference, email) {
  const ref = String(reference || '').trim().toUpperCase();
  const mail = String(email || '').trim().toLowerCase();
  if (!ref || !mail) return null;
  return list.find((b) => b.reference === ref && b.email && b.email === mail) || null;
}
const notFound = () => new HttpError(404, 'not_found', 'We could not find a booking with that reference and email address.');

/** GET /api/bookings/lookup?reference=&email= */
function lookup(app, query) {
  const fields = {};
  if (!String(query.reference || '').trim()) fields.reference = 'Please enter your booking reference (LWL-XXXXXX).';
  if (!String(query.email || '').trim()) fields.email = 'Please enter the email address used for the booking.';
  if (validate.hasErrors(fields)) throw validationError(fields);
  const b = findForGuest(app.store.read('bookings'), query.reference, query.email);
  if (!b) throw notFound();
  return { booking: guestView(settingsLib.get(app), b) };
}

/** POST /api/bookings/cancel { reference, email } */
async function cancelPublic(app, body) {
  if (validate.honeypotTripped(body)) throw notFound();
  const fields = {};
  if (!String(body.reference || '').trim()) fields.reference = 'Please enter your booking reference (LWL-XXXXXX).';
  if (!String(body.email || '').trim()) fields.email = 'Please enter the email address used for the booking.';
  if (validate.hasErrors(fields)) throw validationError(fields);
  return app.store.transaction((tx) => {
    const settings = settingsLib.get(app, tx);
    const b = findForGuest(tx.get('bookings'), body.reference, body.email);
    if (!b) throw notFound();
    const now = new Date();
    const state = cancelState(settings, b, now);
    if (state.why === 'already_cancelled') return { booking: guestView(settings, b, now) }; // idempotent
    if (state.why === 'not_cancellable') throw new HttpError(409, 'not_cancellable', `This booking is marked ${b.status.replace('_', ' ')} and can no longer be cancelled online.`);
    if (state.why === 'too_late') throw new HttpError(409, 'too_late', 'Online cancellation closes 2 hours before the booking. Please call us and we will sort it out.');
    b.status = 'cancelled'; b.cancelledAt = now.toISOString(); b.cancelledBy = 'guest'; b.updatedAt = b.cancelledAt;
    tx.save('bookings');
    customers.recompute(tx, b.customerId);
    activity.log(tx, { who: 'guest', action: 'booking.cancelled', reference: b.reference });
    activity.queueMail(tx, activity.bookingCancellation(app, b));
    return { booking: guestView(settings, b, now) };
  });
}

/** Filtering shared by the admin list and the CSV export: from, to, status (comma list), type, q, customerId, sort. */
function filter(list, query) {
  const fields = {};
  if (query.from && !isDate(query.from)) fields.from = 'from must be a YYYY-MM-DD date.';
  if (query.to && !isDate(query.to)) fields.to = 'to must be a YYYY-MM-DD date.';
  const statuses = String(query.status || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (statuses.some((s) => !validate.STATUSES.includes(s))) fields.status = `status must be one of ${validate.STATUSES.join(', ')}.`;
  if (query.type && !validate.TYPES.includes(query.type)) fields.type = 'type must be table or recording.';
  if (validate.hasErrors(fields)) throw validationError(fields);
  let rows = list;
  if (query.from) rows = rows.filter((b) => b.date >= query.from);
  if (query.to) rows = rows.filter((b) => b.date <= query.to);
  if (statuses.length) rows = rows.filter((b) => statuses.includes(b.status));
  if (query.type) rows = rows.filter((b) => b.type === query.type);
  if (query.customerId) rows = rows.filter((b) => b.customerId === query.customerId);
  const q = String(query.q || '').trim().toLowerCase();
  if (q) {
    const digits = digitsOf(q);
    const phoneSearch = digits.length >= 3 && /^[\d\s+().-]+$/.test(q);
    rows = rows.filter((b) => [b.name, b.email, b.phone, b.reference].some((v) => String(v || '').toLowerCase().includes(q)) || (phoneSearch && digitsOf(b.phone).includes(digits)));
  }
  const dir = query.sort === 'desc' ? -1 : 1;
  rows = rows.slice().sort((a, b) => dir * (a.date + a.time + a.createdAt).localeCompare(b.date + b.time + b.createdAt));
  return rows;
}

/** GET /api/admin/bookings */
function listAdmin(app, query) {
  const rows = filter(app.store.read('bookings'), query);
  const covers = rows.filter(availability.isActive).reduce((n, b) => n + b.party, 0);
  return { bookings: rows, total: rows.length, covers };
}

/** GET /api/admin/bookings/:reference -> { booking } (the full staff record) */
function getAdmin(app, reference) {
  const ref = String(reference || '').trim().toUpperCase();
  const b = app.store.read('bookings').find((x) => x.reference === ref);
  if (!b) throw new HttpError(404, 'not_found', 'No booking with that reference.');
  return { booking: b };
}

/** PATCH /api/admin/bookings/:reference */
async function patchAdmin(app, reference, body) {
  const { value, fields, force } = validate.bookingPatch(body);
  if (validate.hasErrors(fields)) throw validationError(fields);
  const ref = String(reference || '').trim().toUpperCase();
  return app.store.transaction((tx) => {
    const settings = settingsLib.get(app, tx);
    const list = tx.get('bookings');
    const b = list.find((x) => x.reference === ref);
    if (!b) throw new HttpError(404, 'not_found', 'No booking with that reference.');
    const next = Object.assign({}, b, value);
    if (next.type === 'recording') next.time = settings.recordingDoors;
    const moved = next.date !== b.date || next.time !== b.time || next.party !== b.party;
    const reactivated = !availability.isActive(b) && availability.isActive(next);
    if ((moved && availability.isActive(next)) || reactivated) {
      const verdict = availability.check(settings, list, { date: next.date, time: next.time, party: next.party, type: next.type, excludeRef: b.reference, now: new Date(), admin: true, force });
      if (!verdict.ok) {
        if (verdict.slotFull) throw slotFull(next, verdict.seatsLeft);
        throw validationError({ [verdict.field]: verdict.message }, verdict.message);
      }
      if (force) next.forced = true;
    }
    const changes = {};
    for (const k of Object.keys(value)) if (JSON.stringify(b[k]) !== JSON.stringify(next[k])) changes[k] = k === 'internalNotes' || k === 'notes' ? 'edited' : [b[k], next[k]];
    if (!Object.keys(changes).length) return { booking: b };
    const nowIso = new Date().toISOString();
    Object.assign(b, next, { updatedAt: nowIso });
    if (changes.status && b.status === 'cancelled') { b.cancelledAt = nowIso; b.cancelledBy = 'admin'; }
    if (changes.status && b.status !== 'cancelled') { delete b.cancelledAt; delete b.cancelledBy; }
    tx.save('bookings');
    customers.recompute(tx, b.customerId);
    activity.log(tx, { who: 'admin', action: changes.status ? `booking.${b.status}` : 'booking.updated', reference: b.reference, detail: { changes } });
    if (b.email && changes.status && b.status === 'cancelled') activity.queueMail(tx, activity.bookingCancellation(app, b));
    else if (b.email && moved && availability.isActive(b)) activity.queueMail(tx, activity.bookingUpdate(app, b));
    return { booking: b };
  });
}

module.exports = { createInTx, createPublic, createAdmin, lookup, cancelPublic, filter, listAdmin, getAdmin, patchAdmin, guestView };
