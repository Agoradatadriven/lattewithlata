// Request validation. Every validator returns { value, fields } where `fields` maps a field name to a message that
// can be shown next to the input. Format rules live here; availability rules (hours, capacity) live in availability.cjs.
'use strict';
const { cleanText, digitsOf, isDate, isTime } = require('./util.cjs');

const EMAIL_RE = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\.]{2,}$/;
const PHONE_RE = /^[0-9+ ().\-]{7,20}$/;
const OCCASIONS = ['none', 'birthday', 'meeting', 'date', 'recording-guest', 'other'];
const TOPICS = ['general', 'booking', 'events', 'podcast-guest', 'press', 'other'];
const STATUSES = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'];
const TYPES = ['table', 'recording'];
const SOURCES = ['phone', 'walk-in', 'admin'];
const MESSAGE_STATUSES = ['new', 'open', 'done'];

function email(v) {
  const s = cleanText(v).toLowerCase();
  if (!s) return { error: 'Please enter your email address.' };
  if (s.length > 254 || !EMAIL_RE.test(s)) return { error: 'That email address does not look right.' };
  return { value: s };
}
function phone(v, required) {
  const s = cleanText(v);
  if (!s) return required ? { error: 'Please enter a phone number we can reach you on.' } : { value: '' };
  const digits = digitsOf(s).length;
  if (!PHONE_RE.test(s) || digits < 7 || digits > 15) return { error: 'Use 7 to 20 digits; spaces and + are fine.' };
  return { value: s };
}
function name(v) {
  const s = cleanText(v);
  if (s.length < 2) return { error: 'Please enter your name (at least 2 characters).' };
  if (s.length > 80) return { error: 'Please keep the name under 80 characters.' };
  return { value: s };
}
function partySize(v) {
  const n = typeof v === 'string' && /^\d{1,3}$/.test(v.trim()) ? Number(v) : v;
  if (!Number.isInteger(n) || n < 1) return { error: 'Tell us how many people are coming (a whole number).' };
  if (n > 500) return { error: 'That party is larger than the cafe.' };
  return { value: n };
}
function text(v, max, label, multiline) {
  const s = cleanText(v, multiline);
  if (s.length > max) return { error: `Please keep ${label} under ${max} characters.` };
  return { value: s };
}
function put(out, fields, key, result) { if (result.error) fields[key] = result.error; else out[key] = result.value; }

const honeypotTripped = (body) => body.website !== undefined && body.website !== null && String(body.website).trim() !== '';

/** POST /api/bookings (public) and POST /api/admin/bookings (admin: email or phone is enough, no consent box). */
function booking(body, opts) {
  const admin = !!(opts && opts.admin);
  const fields = {}; const value = {};
  const type = body.type === undefined || body.type === null || body.type === '' ? 'table' : body.type;
  if (TYPES.includes(type)) value.type = type; else fields.type = 'Choose a table or a recording night.';
  if (isDate(body.date)) value.date = body.date; else fields.date = 'Please choose a date (YYYY-MM-DD).';
  if (value.type === 'recording' && !isTime(body.time)) value.time = null; // filled with the doors time
  else if (isTime(body.time)) value.time = body.time; else fields.time = 'Please choose a time (HH:MM).';
  put(value, fields, 'party', partySize(body.party));
  put(value, fields, 'name', name(body.name));
  if (admin) {
    const hasEmail = cleanText(body.email) !== '';
    if (hasEmail) put(value, fields, 'email', email(body.email)); else value.email = '';
    put(value, fields, 'phone', phone(body.phone, !hasEmail));
    if (fields.phone && !hasEmail && !cleanText(body.phone)) fields.phone = 'Enter an email address or a phone number for the guest.';
  } else {
    put(value, fields, 'email', email(body.email));
    put(value, fields, 'phone', phone(body.phone, true));
  }
  const occasion = body.occasion === undefined || body.occasion === null || body.occasion === '' ? 'none' : body.occasion;
  if (OCCASIONS.includes(occasion)) value.occasion = occasion; else fields.occasion = 'Please choose an occasion from the list.';
  put(value, fields, 'notes', text(body.notes, 500, 'the notes', true));
  value.marketingOptIn = body.marketingOptIn === true;
  if (admin) {
    put(value, fields, 'internalNotes', text(body.internalNotes, 2000, 'the internal notes', true));
    put(value, fields, 'table', text(body.table, 20, 'the table label'));
    const source = body.source === undefined || body.source === null || body.source === '' ? 'admin' : body.source;
    if (SOURCES.includes(source)) value.source = source; else fields.source = 'Source must be phone, walk-in or admin.';
    const status = body.status === undefined || body.status === null || body.status === '' ? 'confirmed' : body.status;
    if (['pending', 'confirmed', 'seated', 'completed'].includes(status)) value.status = status; else fields.status = 'A new booking can be pending, confirmed, seated or completed.';
    value.force = body.force === true;
  } else if (body.consent !== true) {
    fields.consent = 'Please tick the box so we may use these details for your booking.';
  }
  return { value, fields };
}

/** PATCH /api/admin/bookings/:reference - only the keys that are present. */
function bookingPatch(body) {
  const fields = {}; const value = {};
  if ('status' in body) { if (STATUSES.includes(body.status)) value.status = body.status; else fields.status = `Status must be one of ${STATUSES.join(', ')}.`; }
  if ('date' in body) { if (isDate(body.date)) value.date = body.date; else fields.date = 'Please choose a date (YYYY-MM-DD).'; }
  if ('time' in body) { if (isTime(body.time)) value.time = body.time; else fields.time = 'Please choose a time (HH:MM).'; }
  if ('party' in body) put(value, fields, 'party', partySize(body.party));
  if ('table' in body) put(value, fields, 'table', text(body.table, 20, 'the table label'));
  if ('notes' in body) put(value, fields, 'notes', text(body.notes, 500, 'the notes', true));
  if ('internalNotes' in body) put(value, fields, 'internalNotes', text(body.internalNotes, 2000, 'the internal notes', true));
  if ('name' in body) put(value, fields, 'name', name(body.name));
  if ('phone' in body) put(value, fields, 'phone', phone(body.phone, false));
  if ('occasion' in body) { if (OCCASIONS.includes(body.occasion)) value.occasion = body.occasion; else fields.occasion = 'Please choose an occasion from the list.'; }
  return { value, fields, force: body.force === true };
}

/** POST /api/contact */
function contact(body) {
  const fields = {}; const value = {};
  put(value, fields, 'name', name(body.name));
  put(value, fields, 'email', email(body.email));
  put(value, fields, 'phone', phone(body.phone, false));
  const topic = body.topic === undefined || body.topic === null || body.topic === '' ? 'general' : body.topic;
  if (TOPICS.includes(topic)) value.topic = topic; else fields.topic = 'Please choose a topic from the list.';
  const message = cleanText(body.message, true);
  if (message.length < 10) fields.message = 'Please write a few words so we know how to help (at least 10 characters).';
  else if (message.length > 2000) fields.message = 'Please keep the message under 2000 characters.';
  else value.message = message;
  if (body.consent !== true) fields.consent = 'Please tick the box so we may reply to you.';
  return { value, fields };
}

/** POST /api/subscribe */
function subscribe(body) {
  const fields = {}; const value = {};
  put(value, fields, 'email', email(body.email));
  if (body.consent !== true) fields.consent = 'Please tick the box to receive the Thursday email.';
  const source = cleanText(body.source).toLowerCase().replace(/[^a-z0-9_\-:.]/g, '').slice(0, 40);
  value.source = source || 'newsletter';
  return { value, fields };
}

/** PATCH /api/admin/customers/:id */
function customerPatch(body) {
  const fields = {}; const value = {};
  if ('tags' in body) {
    const tags = Array.isArray(body.tags) ? body.tags.map((t) => cleanText(t).toLowerCase()).filter(Boolean) : null;
    if (!tags || tags.length > 12 || tags.some((t) => t.length > 24)) fields.tags = 'Use up to 12 tags of at most 24 characters each.';
    else value.tags = [...new Set(tags)];
  }
  if ('notes' in body) put(value, fields, 'notes', text(body.notes, 2000, 'the notes', true));
  if ('vip' in body) { if (typeof body.vip === 'boolean') value.vip = body.vip; else fields.vip = 'VIP must be true or false.'; }
  if ('name' in body) put(value, fields, 'name', name(body.name));
  if ('phone' in body) put(value, fields, 'phone', phone(body.phone, false));
  if ('marketingOptIn' in body) { if (typeof body.marketingOptIn === 'boolean') value.marketingOptIn = body.marketingOptIn; else fields.marketingOptIn = 'Opt-in must be true or false.'; }
  return { value, fields };
}

/** PATCH /api/admin/messages/:id */
function messagePatch(body) {
  const fields = {}; const value = {};
  if ('status' in body) { if (MESSAGE_STATUSES.includes(body.status)) value.status = body.status; else fields.status = 'Status must be new, open or done.'; }
  if ('internalNotes' in body) put(value, fields, 'internalNotes', text(body.internalNotes, 2000, 'the internal notes', true));
  return { value, fields };
}

const hasErrors = (fields) => Object.keys(fields).length > 0;

module.exports = { OCCASIONS, TOPICS, STATUSES, TYPES, SOURCES, MESSAGE_STATUSES, EMAIL_RE, honeypotTripped, hasErrors, email, booking, bookingPatch, contact, subscribe, customerPatch, messagePatch };
