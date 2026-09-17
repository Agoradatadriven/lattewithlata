// Availability engine. Pure functions over (settings, bookings) - the caller decides whether they run on a snapshot
// (GET /api/availability) or inside the store's write queue (booking create / change), which is what makes the
// capacity check race-safe.
//
// Tables:    30-minute slots from opening until `lastSeatingMinutes` before closing. A booking holds its seats for
//            `turnMinutes` (its slot and the next two). A slot is bookable for a party when every slot the party
//            would occupy still has room under `capacityPerSlot`.
// Recording: Thursday recording night, one slot at doors (18:30), `recordingSeats` places, 1-4 per booking.
'use strict';
const { isoDate, parseDate, addDays, weekdayKey, weekdayIndex, toMinutes, fromMinutes, localDateTime, humanTime } = require('./util.cjs');

const isActive = (b) => b.status !== 'cancelled' && b.status !== 'no_show';

function hoursFor(settings, date) {
  const overrides = settings.hoursOverrides || {};
  if (Object.prototype.hasOwnProperty.call(overrides, date)) return overrides[date]; // null = closed that day
  return (settings.hours && settings.hours[weekdayKey(date)]) || null;
}

function tableSlots(settings, date) {
  const h = hoursFor(settings, date);
  if (!h) return [];
  const out = [];
  for (let t = toMinutes(h.open); t <= toMinutes(h.close) - settings.lastSeatingMinutes; t += settings.slotMinutes) out.push(fromMinutes(t));
  return out;
}

/** Table seats occupied during the slot that starts at `minute`. */
function usedAt(settings, bookings, date, minute, excludeRef) {
  let used = 0;
  for (const b of bookings) {
    if (b.type !== 'table' || b.date !== date || !isActive(b) || b.reference === excludeRef) continue;
    const start = toMinutes(b.time);
    if (start < minute + settings.slotMinutes && start + settings.turnMinutes > minute) used += b.party;
  }
  return used;
}

function tableSeatsLeft(settings, bookings, date, time, excludeRef) {
  const start = toMinutes(time);
  let worst = 0;
  for (let m = start; m < start + settings.turnMinutes; m += settings.slotMinutes) worst = Math.max(worst, usedAt(settings, bookings, date, m, excludeRef));
  return Math.max(0, settings.capacityPerSlot - worst);
}

function recordingSeatsLeft(settings, bookings, date, excludeRef) {
  let used = 0;
  for (const b of bookings) if (b.type === 'recording' && b.date === date && isActive(b) && b.reference !== excludeRef) used += b.party;
  return Math.max(0, settings.recordingSeats - used);
}

/** Is the day bookable at all? -> { open, reasonCode?, reason?, hours } */
function dayStatus(settings, date, type, now, opts) {
  const admin = !!(opts && opts.admin);
  if (!parseDate(date)) return { open: false, reasonCode: 'invalid_date', reason: 'That is not a valid date.', hours: null };
  const today = isoDate(now);
  const hours = hoursFor(settings, date);
  if (date < today) return { open: false, reasonCode: 'past', reason: 'That date has already passed.', hours };
  if (!admin && date > addDays(today, settings.leadDays)) return { open: false, reasonCode: 'too_far', reason: `Bookings open ${settings.leadDays} days ahead. Please pick an earlier date.`, hours };
  if ((settings.blockedDates || []).includes(date)) return { open: false, reasonCode: 'blocked', reason: 'We are not taking bookings on that date.', hours };
  if (type === 'recording') {
    if (weekdayIndex(date) !== settings.recordingWeekday) return { open: false, reasonCode: 'not_recording_night', reason: `Recording nights are on Thursdays, doors ${humanTime(settings.recordingDoors)}.`, hours };
    if (Object.prototype.hasOwnProperty.call(settings.hoursOverrides || {}, date) && hours === null) return { open: false, reasonCode: 'closed', reason: 'The cafe is closed on that day.', hours };
    return { open: true, hours };
  }
  if (!hours || tableSlots(settings, date).length === 0) return { open: false, reasonCode: 'closed', reason: 'The cafe is closed on that day.', hours: hours || null };
  return { open: true, hours };
}

const tooSoon = (settings, date, time, now) => localDateTime(date, time).getTime() - now.getTime() < settings.minLeadMinutes * 60000;

/** GET /api/availability. `excludeRef` (staff only, see server.cjs) leaves one booking out of the seat count - used while that booking is being edited. */
function availability(settings, bookings, { date, type, party, now, excludeRef }) {
  const day = dayStatus(settings, date, type, now);
  const out = { date, type, party, open: day.open, hours: day.hours || null, slots: [] };
  if (!day.open) { out.reason = day.reason; out.reasonCode = day.reasonCode; return out; }
  const times = type === 'recording' ? [settings.recordingDoors] : tableSlots(settings, date);
  for (const time of times) {
    const seatsLeft = type === 'recording' ? recordingSeatsLeft(settings, bookings, date, excludeRef) : tableSeatsLeft(settings, bookings, date, time, excludeRef);
    const slot = { time, available: true, seatsLeft };
    if (tooSoon(settings, date, time, now)) { slot.available = false; slot.reason = 'past'; }
    else if (seatsLeft < party) { slot.available = false; slot.reason = 'full'; }
    out.slots.push(slot);
  }
  if (!out.slots.some((s) => s.available)) {
    const allPast = out.slots.every((s) => s.reason === 'past');
    out.reasonCode = allPast ? 'too_late_today' : 'full';
    out.reason = allPast ? 'Online booking has closed for today. Please call us and we will do our best.' : 'We are fully booked for that party size on this date.';
  }
  return out;
}

/**
 * Can this booking be placed? Returns { ok: true } | { ok: false, field, message } | { ok: false, slotFull: true, seatsLeft }.
 * opts: { date, time, party, type, excludeRef?, now, admin?, force? } - admin skips the lead-time and party-size limits,
 * force (admin only) skips every availability rule.
 */
function check(settings, bookings, opts) {
  const { date, time, party, type, excludeRef, now, admin, force } = opts;
  if (admin && force) return { ok: true };
  const day = dayStatus(settings, date, type, now, { admin });
  if (!day.open) return { ok: false, field: 'date', message: day.reason + (admin && day.reasonCode === 'past' ? ' Staff can still record it with the override.' : '') };
  if (type === 'recording') {
    if (!admin && party > settings.recordingMaxParty) return { ok: false, field: 'party', message: `Recording night places are limited to ${settings.recordingMaxParty} per booking.` };
    if (!admin && tooSoon(settings, date, settings.recordingDoors, now)) return { ok: false, field: 'date', message: 'Online booking for tonight has closed. Come to the door - walk-ins are seated if there is room.' };
    const seatsLeft = recordingSeatsLeft(settings, bookings, date, excludeRef);
    return seatsLeft >= party ? { ok: true } : { ok: false, slotFull: true, seatsLeft };
  }
  if (!admin && party > settings.maxParty) return { ok: false, field: 'party', message: settings.largePartyNote };
  if (!tableSlots(settings, date).includes(time)) return { ok: false, field: 'time', message: 'Please choose one of the listed times. Tables are booked on the half hour, last seating 90 minutes before closing.' };
  if (!admin && tooSoon(settings, date, time, now)) return { ok: false, field: 'time', message: 'That time has passed or is less than an hour away. Please call us for a table right now.' };
  const seatsLeft = tableSeatsLeft(settings, bookings, date, time, excludeRef);
  return seatsLeft >= party ? { ok: true } : { ok: false, slotFull: true, seatsLeft };
}

module.exports = { isActive, hoursFor, tableSlots, tableSeatsLeft, recordingSeatsLeft, dayStatus, availability, check };
