// CSV export: RFC 4180 quoting, CRLF rows, UTF-8 BOM (so Excel reads accents correctly) and spreadsheet-formula
// neutralising (CSV / formula injection): EVERY cell whose text starts with = + - @ TAB or CR is prefixed with an
// apostrophe - no exceptions, so "+1 555 010 0199" is exported as "'+1 555 010 0199" and -5 as "'-5".
'use strict';

const BOM = '\uFEFF';
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(v) {
  if (v === undefined || v === null) return '';
  let s = Array.isArray(v) ? v.join('; ') : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** columns: [ [header, key | (row) => value] ] */
function toCsv(columns, rows) {
  const lines = [columns.map((c) => cell(c[0])).join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(typeof c[1] === 'function' ? c[1](row) : row[c[1]])).join(','));
  return BOM + lines.join('\r\n') + '\r\n';
}

const same = (keys) => keys.map((k) => [k, k]);

const COLUMNS = {
  bookings: same(['reference', 'type', 'date', 'time', 'party', 'status', 'name', 'email', 'phone', 'occasion', 'notes', 'table', 'internalNotes', 'source', 'marketingOptIn', 'createdAt', 'updatedAt', 'cancelledAt', 'demo']),
  customers: same(['id', 'name', 'email', 'phone', 'vip', 'tags', 'bookings', 'covers', 'cancellations', 'noShows', 'upcoming', 'lastVisit', 'nextVisit', 'firstSeen', 'lastSeen', 'marketingOptIn', 'notes', 'demo']),
  messages: same(['id', 'createdAt', 'status', 'topic', 'name', 'email', 'phone', 'message', 'internalNotes', 'demo']),
  subscribers: same(['email', 'source', 'consentAt', 'createdAt', 'demo']),
};

module.exports = { toCsv, cell, COLUMNS, BOM };
