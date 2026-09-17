// GET /api/events - upcoming Thursday recording nights. Content comes from content/pages.json (`events.upcoming`);
// when that file or key does not exist yet, the next 8 Thursdays are generated. Seats come from the booking engine.
'use strict';
const fs = require('fs');
const path = require('path');
const { isoDate, isDate, addDays, weekdayIndex } = require('./util.cjs');
const availability = require('./availability.cjs');
const settingsLib = require('./settings.cjs');

let cache = { mtimeMs: -1, size: -1, list: null };

function readContentEvents(root) {
  const file = path.join(root, 'content', 'pages.json');
  let st;
  try { st = fs.statSync(file); } catch { return null; }
  if (cache.list !== undefined && cache.mtimeMs === st.mtimeMs && cache.size === st.size) return cache.list;
  let list = null;
  try {
    const pages = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    const found = (pages && pages.events && pages.events.upcoming) || (pages && pages['events.upcoming']) || null;
    if (Array.isArray(found)) list = found.filter((e) => e && typeof e === 'object' && isDate(e.date));
  } catch { list = null; } // the file may be mid-edit by the content lane: fall back quietly
  cache = { mtimeMs: st.mtimeMs, size: st.size, list };
  return list;
}

function generated(today, weekday, count) {
  const out = [];
  let d = today;
  while (weekdayIndex(d) !== weekday) d = addDays(d, 1);
  for (let i = 0; i < count; i++, d = addDays(d, 7)) out.push({ id: `rec-${d}`, date: d, title: 'Thursday recording night', generated: true });
  return out;
}

const orNull = (v) => (v === undefined || v === '' ? null : v);

function list(app) {
  const settings = settingsLib.get(app);
  const bookings = app.store.read('bookings');
  const now = new Date();
  const today = isoDate(now);
  let source = (readContentEvents(app.root) || []).filter((e) => e.date >= today);
  if (!source.length) source = generated(today, settings.recordingWeekday, 8);
  source.sort((a, b) => a.date.localeCompare(b.date));
  const events = source.map((e) => {
    const verdict = availability.check(settings, bookings, { date: e.date, time: settings.recordingDoors, party: 1, type: 'recording', now });
    const seatsLeft = availability.recordingSeatsLeft(settings, bookings, e.date);
    return Object.assign({}, e, { // content fields (dateLabel, start, end, org, price ...) pass through untouched
      id: String(e.id || `rec-${e.date}`), date: e.date, doors: settings.recordingDoors, title: e.title || 'Thursday recording night',
      guest: orNull(e.guest), role: orNull(e.role), pillar: orNull(e.pillar), blurb: orNull(e.blurb), image: orNull(e.image), imageAlt: orNull(e.imageAlt || e.alt),
      seats: settings.recordingSeats, seatsLeft, bookable: verdict.ok === true,
      bookableReason: verdict.ok ? null : (verdict.slotFull ? 'full' : verdict.message),
      type: 'recording', maxParty: settings.recordingMaxParty,
    });
  });
  return { events };
}

module.exports = { list };
