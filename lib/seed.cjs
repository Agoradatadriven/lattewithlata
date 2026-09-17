// CLI helpers: `node server.cjs --seed` (clearly-marked DEMO data) and `node server.cjs --reset` (clear data/).
// Every demo record carries demo: true, an obviously fictional name, an @example.com address and a 555-01xx number.
// Seeding replaces earlier demo records and never touches real ones.
'use strict';
const fs = require('fs');
const path = require('path');
const { newId, newReference, isoDate, addDays, weekdayIndex } = require('./util.cjs');
const availability = require('./availability.cjs');
const settingsLib = require('./settings.cjs');
const customersLib = require('./customers.cjs');

function prng(seed) { // mulberry32 - the same demo set every time
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PEOPLE = [
  ['Basil Sampleton', ['regular'], true], ['Clementine Placeholder', ['regular', 'window-seat'], true], ['Juniper Testwell', ['podcast-guest'], true],
  ['Saffron Demoson', ['press'], false], ['Hazel Mockford', ['regular'], false], ['Sorrel Fakenham', [], false], ['Pepper Dummyfield', ['allergy-nuts'], false],
  ['Rowan Exampleby', [], false], ['Olive Specimen', ['local-business'], false], ['Sage Notreal', [], false], ['Coriander Testa', [], false],
  ['Maple Fictionelle', ['birthday-club'], false], ['Fennel Madeupson', [], false], ['Poppy Loremworth', [], false], ['Alder Ipsumby', ['local-business'], false],
  ['Nutmeg Trialford', [], false], ['Bramble Sampleigh', [], false], ['Tansy Demoux', ['vegetarian'], false], ['Linden Mockridge', [], false],
  ['Myrtle Placeholt', [], false], ['Caraway Testerman', [], false], ['Dill Fauxley', ['regular'], false], ['Quince Pretendergast', [], false],
  ['Thyme Nobodie', [], false], ['Laurel Inventon', ['podcast-guest'], false],
];
const NOTES = ['', '', '', 'Window table if possible.', 'One high chair, please.', 'Bringing a laptop - near a socket?', 'Nut allergy at the table.', 'Celebrating a promotion.', 'Wheelchair access needed.'];
const OCCASIONS = ['none', 'none', 'none', 'none', 'birthday', 'meeting', 'date', 'other'];
const MESSAGES = [
  ['general', 'new', 'Do you have oat milk and is the cardamom cake made without nuts? Asking for a friend with an allergy.'],
  ['booking', 'new', 'We would like to bring twelve people for a team breakfast next month. Could you set up the long bench for us?'],
  ['events', 'open', 'Is the Thursday recording suitable for someone using a wheelchair? How early should we arrive for a good seat?'],
  ['podcast-guest', 'open', 'I run a small literacy charity and would love to be considered as a guest. Happy to share more details.'],
  ['press', 'done', 'I am writing a piece on podcast cafes for a local magazine. Could I visit on a recording night and take notes?'],
  ['other', 'done', 'I think I left a grey scarf on the bench by the window on Saturday. Has anyone handed it in?'],
];

const slug = (name) => name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

async function seed(app) {
  await settingsLib.ensure(app);
  const rand = prng(20260917);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const now = new Date();
  const today = isoDate(now);
  const stamp = (date, daysBefore, hour) => { const d = new Date(`${addDays(date, -daysBefore)}T00:00:00`); d.setHours(hour, Math.floor(rand() * 60), 0, 0); return new Date(Math.min(d.getTime(), now.getTime() - 60000)).toISOString(); };

  const result = await app.store.transaction((tx) => {
    const settings = settingsLib.get(app, tx);
    for (const name of ['bookings', 'customers', 'messages', 'subscribers', 'activity', 'outbox']) { // replace earlier demo rows only
      tx.set(name, tx.get(name).filter((r) => !r.demo));
    }
    const customers = tx.get('customers'), bookings = tx.get('bookings'), messages = tx.get('messages'), subscribers = tx.get('subscribers'), activity = tx.get('activity');

    const demoCustomers = PEOPLE.map(([name, tags, vip], i) => {
      const email = `${slug(name)}@example.com`;
      const firstSeen = stamp(today, 21 + Math.floor(rand() * 40), 9 + Math.floor(rand() * 8));
      const c = {
        id: newId('cus'), key: email, name, email, phone: `(555) 01${i % 10}-${1000 + i * 37}`,
        firstSeen, lastSeen: firstSeen, bookings: 0, covers: 0, cancellations: 0, noShows: 0, upcoming: 0, lastVisit: null, nextVisit: null,
        marketingOptIn: false, tags, notes: vip ? 'DEMO record. Likes the corner bench; always asks about the next guest.' : '', vip, demo: true,
      };
      customers.push(c);
      return c;
    });

    // ~40 bookings: 3 weeks back, 2 weeks ahead; regulars book more often
    const weighted = demoCustomers.flatMap((c, i) => Array(i < 5 ? 4 : i < 12 ? 2 : 1).fill(c));
    const taken = new Set(bookings.map((b) => b.reference));
    // two recording-night RSVPs on every Thursday in range first, then tables up to 40 bookings in total
    const plan = [];
    for (let off = -21; off <= 14; off++) if (weekdayIndex(addDays(today, off)) === settings.recordingWeekday) plan.push(addDays(today, off), addDays(today, off));
    let guard = 0;
    while (bookings.filter((b) => b.demo).length < 40 && guard++ < 500) {
      const c = pick(weighted);
      const recording = plan.length > 0;
      const date = recording ? plan.pop() : addDays(today, Math.floor(rand() * 36) - 21);
      const slots = recording ? [settings.recordingDoors] : availability.tableSlots(settings, date);
      if (!slots.length || (settings.blockedDates || []).includes(date)) continue;
      const time = pick(slots);
      if (bookings.some((b) => b.email === c.email && b.date === date)) { if (recording) plan.push(date); continue; }
      const party = recording ? 1 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 6);
      const left = recording ? availability.recordingSeatsLeft(settings, bookings, date) : availability.tableSeatsLeft(settings, bookings, date, time);
      if (left < party) continue;
      const r = rand();
      let status;
      if (date < today) status = r < 0.76 ? 'completed' : r < 0.87 ? 'no_show' : 'cancelled';
      else if (date === today) status = time > `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` ? 'confirmed' : r < 0.5 ? 'seated' : 'completed';
      else status = r < 0.8 ? 'confirmed' : r < 0.9 ? 'pending' : 'cancelled';
      const createdAt = stamp(date, 1 + Math.floor(rand() * 9), 8 + Math.floor(rand() * 12));
      const reference = newReference(taken); taken.add(reference);
      const optIn = rand() < 0.3;
      const b = {
        id: newId('bkg'), reference, type: recording ? 'recording' : 'table', date, time, party, status,
        name: c.name, email: c.email, phone: c.phone, occasion: recording ? 'none' : pick(OCCASIONS), notes: pick(NOTES),
        marketingOptIn: optIn, consent: true, consentAt: createdAt, table: status === 'seated' || status === 'completed' ? `T${1 + Math.floor(rand() * 12)}` : '',
        internalNotes: '', source: rand() < 0.75 ? 'web' : pick(['phone', 'walk-in']), forced: false, customerId: c.id, createdAt, updatedAt: createdAt, demo: true,
      };
      if (status === 'cancelled') { b.cancelledAt = createdAt; b.cancelledBy = 'guest'; }
      bookings.push(b);
      if (createdAt > c.lastSeen) c.lastSeen = createdAt;
      activity.push({ id: newId('act'), at: createdAt, who: b.source === 'web' ? 'guest' : 'admin', action: 'booking.created', reference, detail: { type: b.type, date, time, party, source: b.source }, demo: true });
      if (status !== 'confirmed' && status !== 'pending') activity.push({ id: newId('act'), at: status === 'cancelled' ? createdAt : new Date(Math.min(now.getTime(), new Date(`${date}T${time}:00`).getTime() + 3600000)).toISOString(), who: status === 'cancelled' ? 'guest' : 'admin', action: `booking.${status}`, reference, demo: true });
    }

    MESSAGES.forEach(([topic, status, message], i) => {
      const c = demoCustomers[6 + i * 3];
      const createdAt = stamp(today, i * 2, 10 + i);
      messages.push({ id: newId('msg'), name: c.name, email: c.email, phone: i % 2 ? c.phone : '', topic, message: `[DEMO] ${message}`, status, internalNotes: status === 'done' ? 'DEMO: answered by phone.' : '', consent: true, consentAt: createdAt, createdAt, updatedAt: createdAt, customerId: c.id, demo: true });
      activity.push({ id: newId('act'), at: createdAt, who: 'guest', action: 'message.received', reference: messages[messages.length - 1].id, detail: { topic }, demo: true });
    });

    demoCustomers.filter((_, i) => i % 5 !== 4).slice(0, 15).forEach((c, i) => {
      const createdAt = stamp(today, i % 12, 7 + (i % 10));
      subscribers.push({ id: newId('sub'), email: c.email, source: pick(['newsletter', 'footer', 'booking', 'events']), consent: true, consentAt: createdAt, createdAt, customerId: c.id, demo: true });
      c.marketingOptIn = true;
    });

    for (const c of demoCustomers) customersLib.computeAggregates(c, bookings, now);
    activity.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    for (const name of ['bookings', 'customers', 'messages', 'subscribers', 'activity']) tx.save(name);
    return { bookings: bookings.filter((b) => b.demo).length, customers: demoCustomers.length, messages: MESSAGES.length, subscribers: subscribers.filter((s) => s.demo).length, vip: demoCustomers.filter((c) => c.vip).length };
  });
  return result;
}

function describeFile(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(data)) return `${data.length} record${data.length === 1 ? '' : 's'}${data.length ? ` (${data.filter((r) => r && r.demo).length} demo)` : ''}`;
    return 'settings object';
  } catch { return `${fs.statSync(file).size} bytes`; }
}

/** Remove everything in the data dir except .gitkeep (and the admin token unless includeToken). Prints first. */
function reset(dataDir, { includeToken, log = console.log } = {}) {
  let names = [];
  try { names = fs.readdirSync(dataDir); } catch { /* no data dir: nothing to do */ }
  names = names.filter((n) => n !== '.gitkeep' && (includeToken || n !== 'admin-token.txt') && fs.statSync(path.join(dataDir, n)).isFile());
  if (!names.length) { log(`Nothing to remove in ${dataDir}.`); return []; }
  log(`Removing from ${dataDir}:`);
  for (const n of names) log(`  - ${n}  ${n.endsWith('.json') ? describeFile(path.join(dataDir, n)) : ''}`.trimEnd());
  for (const n of names) fs.unlinkSync(path.join(dataDir, n));
  log(`Removed ${names.length} file${names.length === 1 ? '' : 's'}.${includeToken ? '' : ' (admin-token.txt is kept; add --all to remove it too)'}`);
  return names;
}

module.exports = { seed, reset };
