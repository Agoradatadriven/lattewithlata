// Small shared helpers: local-time date maths, ids, references, text cleaning. No dependencies.
'use strict';
const crypto = require('crypto');

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0 / O / 1 / I

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date of a Date as YYYY-MM-DD (server local time is the cafe's time). */
function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/** Strict YYYY-MM-DD -> local Date at 00:00, or null when it is not a real calendar date. */
function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s === 'string' ? s : '');
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, da = +m[3];
  const d = new Date(y, mo, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null;
  return d;
}
const isDate = (s) => parseDate(s) !== null;

function addDays(iso, n) { const d = parseDate(iso); d.setDate(d.getDate() + n); return isoDate(d); }
function weekdayIndex(iso) { return parseDate(iso).getDay(); }
function weekdayKey(iso) { return WEEKDAYS[weekdayIndex(iso)]; }

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const isTime = (s) => typeof s === 'string' && TIME_RE.test(s);
function toMinutes(t) { const m = TIME_RE.exec(t); return m ? +m[1] * 60 + +m[2] : NaN; }
function fromMinutes(n) { return `${pad(Math.floor(n / 60))}:${pad(n % 60)}`; }

/** Local Date for a booking's date + time. */
function localDateTime(date, time) {
  const d = parseDate(date); if (!d) return null;
  const mins = toMinutes(time); if (Number.isNaN(mins)) return null;
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

/** "Thu 24 Sep 2026" */
function humanDate(iso) {
  const d = parseDate(iso); if (!d) return String(iso);
  return `${WEEKDAY_LABEL[d.getDay()]} ${d.getDate()} ${MONTH_LABEL[d.getMonth()]} ${d.getFullYear()}`;
}
/** "6:30 pm" */
function humanTime(t) {
  const mins = toMinutes(t); if (Number.isNaN(mins)) return String(t);
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
}
/** "7:00 am" / "10 pm" -> "07:00" / "22:00"; null when unparseable. */
function parseHumanTime(s) {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*$/i.exec(String(s || ''));
  if (!m) return isTime(s) ? s : null;
  let h = +m[1]; const mi = +(m[2] || 0);
  if (h < 1 || h > 12 || mi > 59) return null;
  if (/pm/i.test(m[3]) && h !== 12) h += 12;
  if (/am/i.test(m[3]) && h === 12) h = 0;
  return `${pad(h)}:${pad(mi)}`;
}

function newId(prefix) { return `${prefix}_${crypto.randomBytes(6).toString('hex')}`; }

function newReference(taken) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let s = '';
    for (let i = 0; i < 6; i++) s += REF_ALPHABET[crypto.randomInt(REF_ALPHABET.length)];
    const ref = `LWL-${s}`;
    if (!taken || !taken.has(ref)) return ref;
  }
  throw new Error('could not allocate a booking reference');
}
const REFERENCE_RE = new RegExp(`^LWL-[${REF_ALPHABET}]{6}$`);

/** Strip control characters, trim; single-line values also collapse whitespace. (Char codes, so no control bytes live in this file.) */
function stripControl(s, multiline) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 32 && c !== 127) out += ch;
    else if (multiline) { if (c === 10 || c === 9) out += ch; } // keep line breaks and tabs, drop the rest
    else out += ' ';
  }
  return out;
}
function cleanText(v, multiline) {
  if (v === undefined || v === null) return '';
  let s = String(v).normalize('NFC');
  if (multiline) s = stripControl(s.split('\r\n').join('\n').split('\r').join('\n'), true);
  else s = stripControl(s, false).replace(/\s+/g, ' ');
  return s.trim();
}

const digitsOf = (s) => String(s || '').replace(/\D+/g, '');

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

module.exports = {
  WEEKDAYS, REF_ALPHABET, REFERENCE_RE, pad, isoDate, parseDate, isDate, addDays, weekdayIndex, weekdayKey,
  isTime, toMinutes, fromMinutes, localDateTime, humanDate, humanTime, parseHumanTime,
  newId, newReference, cleanText, digitsOf, maskEmail, clone,
};
