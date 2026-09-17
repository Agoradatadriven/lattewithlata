// Audit log (data/activity.json) and the email outbox (data/outbox.json). Both are appended inside the caller's
// transaction so a mutation and its log line are committed together.
'use strict';
const { newId, humanDate, humanTime } = require('./util.cjs');
const settingsLib = require('./settings.cjs');

const ACTIVITY_KEEP = 5000;
const OUTBOX_KEEP = 2000;

/** entry: { who: 'guest' | 'admin' | 'system', action, reference, detail? } */
function log(tx, entry) {
  const list = tx.get('activity');
  list.push(Object.assign({ id: newId('act'), at: new Date().toISOString() }, entry));
  if (list.length > ACTIVITY_KEEP) list.splice(0, list.length - ACTIVITY_KEEP);
  tx.save('activity');
}

// EMAIL SWAP-IN POINT -------------------------------------------------------------------------------------------
// No email is sent. Every message the site would send is appended to data/outbox.json as { to, subject, text, at }.
// To go live, deliver the message here (or run a small worker that drains outbox.json): call your provider's HTTPS
// API (Postmark, SES, Resend, Mailgun ...) with `mail`, and record the provider id / error on the outbox entry.
// Keep it after the data write and never let a delivery failure fail the booking.
function queueMail(tx, mail) {
  if (!mail || !mail.to) return;
  const list = tx.get('outbox');
  list.push(Object.assign({ id: newId('out'), at: new Date().toISOString(), sent: false }, mail));
  if (list.length > OUTBOX_KEEP) list.splice(0, list.length - OUTBOX_KEEP);
  tx.save('outbox');
}

function signature(app) {
  const c = settingsLib.contactFromSite(settingsLib.readSite(app.root));
  const addr = c.address ? [c.address.line1, c.address.city].filter(Boolean).join(', ') : '';
  return ['Latte with Lata', addr, c.phone].filter(Boolean).join('\n');
}
const what = (b) => (b.type === 'recording'
  ? `${b.party} ${b.party === 1 ? 'place' : 'places'} at the Thursday recording night on ${humanDate(b.date)}, doors ${humanTime(b.time)}`
  : `a table for ${b.party} on ${humanDate(b.date)} at ${humanTime(b.time)}`);

function bookingConfirmation(app, b) {
  return {
    kind: 'booking.confirmation', reference: b.reference, to: b.email,
    subject: `Your booking at Latte with Lata - ${b.reference}`,
    text: `Hello ${b.name},\n\nYou are booked: ${what(b)}.\nReference: ${b.reference}\n\nTo change or cancel, open "Manage a booking" on the booking page with this reference and your email address, or call us. Online cancellation closes 2 hours before your time.\n\nSee you soon,\n${signature(app)}`,
  };
}
function bookingCancellation(app, b) {
  return {
    kind: 'booking.cancellation', reference: b.reference, to: b.email,
    subject: `Booking cancelled - ${b.reference}`,
    text: `Hello ${b.name},\n\nYour booking (${what(b)}) has been cancelled. Reference: ${b.reference}\n\nWe hope to see you another day.\n${signature(app)}`,
  };
}
function bookingUpdate(app, b) {
  return {
    kind: 'booking.update', reference: b.reference, to: b.email,
    subject: `Your booking was updated - ${b.reference}`,
    text: `Hello ${b.name},\n\nYour booking now reads: ${what(b)}.\nReference: ${b.reference}\n\nIf this is not what you expected, please call us.\n${signature(app)}`,
  };
}
function contactAcknowledgement(app, m) {
  return {
    kind: 'contact.acknowledgement', reference: m.id, to: m.email,
    subject: 'We have your message - Latte with Lata',
    text: `Hello ${m.name},\n\nThank you for writing to us. A person reads every message and we will reply as soon as we can.\n\n${signature(app)}`,
  };
}
function subscribeWelcome(app, s) {
  return {
    kind: 'subscribe.welcome', reference: s.id, to: s.email,
    subject: 'You are on the list - Latte with Lata',
    text: `You will get the Thursday email from Latte with Lata - one email a week, never more. Reply "unsubscribe" at any time and we will remove you.\n\n${signature(app)}`,
  };
}

module.exports = { log, queueMail, bookingConfirmation, bookingCancellation, bookingUpdate, contactAcknowledgement, subscribeWelcome };
