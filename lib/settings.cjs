// Booking settings: defaults seeded from content/site.json, persisted in data/settings.json, validated on PUT.
'use strict';
const fs = require('fs');
const path = require('path');
const { WEEKDAYS, isDate, isTime, toMinutes, parseHumanTime, isoDate } = require('./util.cjs');

const DEFAULT_HOURS = {
  mon: { open: '07:00', close: '18:00' }, tue: { open: '07:00', close: '18:00' }, wed: { open: '07:00', close: '18:00' },
  thu: { open: '07:00', close: '18:00' }, fri: { open: '07:00', close: '22:00' }, sat: { open: '08:00', close: '22:00' },
  sun: { open: '08:00', close: '15:00' },
};

let siteCache = { file: '', mtimeMs: -1, size: -1, data: {} };
function readSite(root) { // cached by mtime + size: this is read on every API request
  const file = path.join(root, 'content', 'site.json');
  try {
    const st = fs.statSync(file);
    if (siteCache.file === file && siteCache.mtimeMs === st.mtimeMs && siteCache.size === st.size) return siteCache.data;
    const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    siteCache = { file, mtimeMs: st.mtimeMs, size: st.size, data };
    return data;
  } catch { return {}; }
}

/** visit.hours rows ("Mon - Thu", "7:00 am", "6:00 pm") -> { mon: { open, close }, ... }. Falls back to the defaults. */
function hoursFromSite(site) {
  const rows = site && site.visit && Array.isArray(site.visit.hours) ? site.visit.hours : [];
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const out = {};
  for (const row of rows) {
    const open = parseHumanTime(row.open), close = parseHumanTime(row.close);
    if (!open || !close || toMinutes(open) >= toMinutes(close)) continue;
    const names = String(row.days || '').toLowerCase().match(/mon|tue|wed|thu|fri|sat|sun/g) || [];
    let days = names;
    if (names.length === 2 && /[-–—]|to/.test(String(row.days))) {
      const a = order.indexOf(names[0]), b = order.indexOf(names[1]);
      days = a <= b ? order.slice(a, b + 1) : order.slice(a).concat(order.slice(0, b + 1));
    }
    for (const d of days) out[d] = { open, close };
  }
  if (!Object.keys(out).length) return JSON.parse(JSON.stringify(DEFAULT_HOURS));
  for (const d of order) if (!(d in out)) out[d] = null; // a day the site does not list is closed
  return out;
}

function contactFromSite(site) {
  const visit = (site && site.visit) || {};
  const lines = (site && site.footer && site.footer.columns && site.footer.columns.address) || [];
  const email = lines.find((l) => /@/.test(String(l))) || '';
  return { phone: visit.phone || '', phoneHref: visit.phoneHref || '', email, address: visit.address || null };
}

function defaults(root) {
  const site = readSite(root);
  const contact = contactFromSite(site);
  const reach = [contact.phone && `call us on ${contact.phone}`, contact.email && `email ${contact.email}`].filter(Boolean).join(' or ');
  return {
    hours: hoursFromSite(site),
    slotMinutes: 30,
    turnMinutes: 90,
    lastSeatingMinutes: 90, // the last table slot starts this long before closing
    minLeadMinutes: 60,
    cancelCutoffMinutes: 120,
    capacityPerSlot: 28,
    maxParty: 8,
    leadDays: 60,
    recordingWeekday: 4,
    recordingDoors: '18:30',
    recordingSeats: 40,
    recordingMaxParty: 4,
    blockedDates: [],
    hoursOverrides: {},
    largePartyNote: `For parties of more than 8, please ${reach || 'call or email us'} and we will set the room up for you.`,
    timezoneNote: 'All times are local cafe time.',
  };
}

/** Effective settings = defaults overlaid with whatever data/settings.json holds. Pass the tx inside a transaction. */
function get(app, tx) {
  const stored = tx ? tx.get('settings') : app.store.read('settings');
  const base = defaults(app.root);
  const s = Object.assign({}, base, stored && typeof stored === 'object' ? stored : {});
  s.largePartyNote = String(s.largePartyNote || base.largePartyNote).replace(/more than \d+/, `more than ${s.maxParty}`);
  return s;
}

/** First start: write data/settings.json so the owner can see and edit the defaults. */
async function ensure(app) {
  if (app.store.read('settings')) return;
  await app.store.transaction((tx) => { if (!tx.get('settings')) tx.set('settings', defaults(app.root)); });
}

/** The public /api/config view. */
function publicConfig(app) {
  const s = get(app);
  const contact = contactFromSite(readSite(app.root));
  return {
    hours: s.hours,
    slotMinutes: s.slotMinutes,
    turnMinutes: s.turnMinutes,
    lastSeatingMinutes: s.lastSeatingMinutes,
    maxParty: s.maxParty,
    largePartyNote: s.largePartyNote,
    recording: { weekday: s.recordingWeekday, doors: s.recordingDoors, seats: s.recordingSeats, maxParty: s.recordingMaxParty },
    blockedDates: s.blockedDates,
    hoursOverrides: s.hoursOverrides,
    timezoneNote: s.timezoneNote,
    leadDays: s.leadDays,
    minLeadMinutes: s.minLeadMinutes,
    cancelCutoffMinutes: s.cancelCutoffMinutes,
    today: isoDate(new Date()),
    contact,
  };
}

/** The admin view: every stored key, plus `recording` in the same shape /api/config uses. */
function adminView(s) {
  return Object.assign({}, s, { recording: { weekday: s.recordingWeekday, doors: s.recordingDoors, seats: s.recordingSeats, maxParty: s.recordingMaxParty } });
}

function checkHoursPair(v) {
  if (v === null || v === false || (v && v.closed === true)) return { value: null };
  if (!v || typeof v !== 'object' || !isTime(v.open) || !isTime(v.close)) return { error: 'Use { "open": "HH:MM", "close": "HH:MM" } or null for closed.' };
  if (toMinutes(v.open) >= toMinutes(v.close)) return { error: 'Opening time must be before closing time.' };
  return { value: { open: v.open, close: v.close } };
}

const intIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** Validate a PUT /api/admin/settings body. Only the keys that are present are changed. Returns { patch, fields }. */
function validatePatch(body, current) {
  const fields = {}; const patch = {};
  if ('capacityPerSlot' in body) { if (intIn(body.capacityPerSlot, 1, 500)) patch.capacityPerSlot = body.capacityPerSlot; else fields.capacityPerSlot = 'Seats per slot must be a whole number from 1 to 500.'; }
  if ('recordingSeats' in body) { if (intIn(body.recordingSeats, 1, 500)) patch.recordingSeats = body.recordingSeats; else fields.recordingSeats = 'Recording seats must be a whole number from 1 to 500.'; }
  if ('maxParty' in body) { if (intIn(body.maxParty, 1, 50)) patch.maxParty = body.maxParty; else fields.maxParty = 'Largest online party must be a whole number from 1 to 50.'; }
  if ('leadDays' in body) { if (intIn(body.leadDays, 1, 365)) patch.leadDays = body.leadDays; else fields.leadDays = 'Booking window must be 1 to 365 days.'; }
  if ('blockedDates' in body) {
    const list = Array.isArray(body.blockedDates) ? body.blockedDates.map((d) => (d && typeof d === 'object' ? d.date : d)) : null;
    if (!list || list.length > 366 || !list.every(isDate)) fields.blockedDates = 'Blocked dates must be a list of YYYY-MM-DD dates (366 at most).';
    else patch.blockedDates = [...new Set(list)].sort();
  }
  if ('hoursOverrides' in body) {
    let src = body.hoursOverrides;
    if (Array.isArray(src)) { // also accept [ { date, open, close } | { date, closed: true } ]
      const map = {};
      for (const row of src) if (row && typeof row === 'object') map[row.date] = row.closed === true || (!row.open && !row.close) ? null : { open: row.open, close: row.close };
      src = map;
    }
    if (!src || typeof src !== 'object' || Object.keys(src).length > 366) fields.hoursOverrides = 'Hours overrides must be an object keyed by YYYY-MM-DD date.';
    else {
      const out = {};
      for (const date of Object.keys(src).sort()) {
        if (!isDate(date)) { fields.hoursOverrides = `"${date}" is not a YYYY-MM-DD date.`; break; }
        const r = checkHoursPair(src[date]);
        if (r.error) { fields.hoursOverrides = `${date}: ${r.error}`; break; }
        out[date] = r.value;
      }
      if (!fields.hoursOverrides) patch.hoursOverrides = out;
    }
  }
  if ('hours' in body) {
    const src = body.hours; const out = {};
    if (!src || typeof src !== 'object' || Array.isArray(src)) fields.hours = 'Hours must be an object with the keys mon to sun.';
    else {
      for (const d of WEEKDAYS) {
        const r = checkHoursPair(d in src ? src[d] : current.hours[d]);
        if (r.error) { fields.hours = `${d}: ${r.error}`; break; }
        out[d] = r.value;
      }
      if (!fields.hours) patch.hours = out;
    }
  }
  const nextCapacity = patch.capacityPerSlot !== undefined ? patch.capacityPerSlot : current.capacityPerSlot;
  const nextMaxParty = patch.maxParty !== undefined ? patch.maxParty : current.maxParty;
  if (!fields.capacityPerSlot && !fields.maxParty && nextMaxParty > nextCapacity) {
    fields['capacityPerSlot' in body ? 'capacityPerSlot' : 'maxParty'] = `Seats per slot (${nextCapacity}) cannot be lower than the largest online party (${nextMaxParty}).`;
  }
  return { patch, fields };
}

module.exports = { DEFAULT_HOURS, defaults, get, ensure, publicConfig, adminView, validatePatch, hoursFromSite, contactFromSite, readSite };
