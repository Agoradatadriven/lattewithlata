// Atomic JSON file datastore.
//  - one JSON file per collection in the data dir (bookings.json, customers.json, ...)
//  - every mutation runs inside ONE serial write queue (store.transaction), so a read-check-write sequence such as
//    "is there capacity? then add the booking" can never interleave with another request (no overbooking)
//  - writes go to a temp file, are fsynced, then renamed over the target (a crash never leaves a half-written file);
//    the previous good version is kept as <name>.json.bak
//  - reads are corruption-safe: an unparseable file is moved aside (<name>.json.corrupt-<ts>) and the .bak (or the
//    collection default) is used instead, so one bad file cannot take the site down
'use strict';
const fs = require('fs');
const path = require('path');
const { clone } = require('./util.cjs');

const COLLECTIONS = {
  bookings: () => [],
  customers: () => [],
  messages: () => [],
  subscribers: () => [],
  activity: () => [],
  outbox: () => [],
  settings: () => null,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const cache = new Map(); // name -> { data, mtimeMs, size }
  let queue = Promise.resolve();
  let tmpCounter = 0;

  const fileOf = (name) => path.join(dir, `${name}.json`);
  const assertName = (name) => { if (!Object.prototype.hasOwnProperty.call(COLLECTIONS, name)) throw new Error(`unknown collection "${name}"`); };

  function parseFile(file) {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    if (!text.trim()) throw new Error('empty file');
    return JSON.parse(text);
  }

  function loadFromDisk(name) {
    const file = fileOf(name);
    let st;
    try { st = fs.statSync(file); } catch { return { data: COLLECTIONS[name](), mtimeMs: 0, size: -1 }; }
    try {
      return { data: parseFile(file), mtimeMs: st.mtimeMs, size: st.size };
    } catch (err) {
      const aside = `${file}.corrupt-${Date.now()}`;
      try { fs.renameSync(file, aside); } catch { /* keep going: the default below still protects the site */ }
      console.error(`[store] ${name}.json is unreadable (${err.message}); moved to ${path.basename(aside)}`);
      try {
        const data = parseFile(`${file}.bak`);
        fs.copyFileSync(`${file}.bak`, file); // the backup becomes the committed version again
        const st2 = fs.statSync(file);
        console.error(`[store] ${name}.json restored from ${name}.json.bak`);
        return { data, mtimeMs: st2.mtimeMs, size: st2.size };
      } catch { return { data: COLLECTIONS[name](), mtimeMs: -1, size: -1 }; }
    }
  }

  /** Current committed value (deep copy - callers may mutate it freely). */
  function read(name) {
    assertName(name);
    const hit = cache.get(name);
    let st = null;
    try { st = fs.statSync(fileOf(name)); } catch { /* missing */ }
    const fresh = hit && ((st === null && hit.size === -1 && hit.mtimeMs === 0) || (st !== null && st.mtimeMs === hit.mtimeMs && st.size === hit.size));
    if (fresh) return clone(hit.data);
    const loaded = loadFromDisk(name);
    cache.set(name, loaded);
    return clone(loaded.data);
  }

  async function renameWithRetry(from, to) {
    for (let attempt = 0; ; attempt++) {
      try { return await fs.promises.rename(from, to); } catch (err) {
        // Windows: a virus scanner or indexer can hold the target for a few ms
        if (attempt >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
        await sleep(15 * (attempt + 1));
      }
    }
  }

  async function writeAtomic(name, data) {
    const file = fileOf(name);
    const tmp = `${file}.tmp-${process.pid}-${++tmpCounter}`;
    const json = JSON.stringify(data, null, 2) + '\n';
    const fh = await fs.promises.open(tmp, 'w', 0o600);
    try { await fh.writeFile(json, 'utf8'); await fh.sync(); } finally { await fh.close(); }
    try { await fs.promises.copyFile(file, `${file}.bak`); } catch { /* first write: nothing to back up */ }
    try { await renameWithRetry(tmp, file); } catch (err) { await fs.promises.unlink(tmp).catch(() => {}); throw err; }
    let st = null;
    try { st = fs.statSync(file); } catch { /* ignore */ }
    cache.set(name, { data: clone(data), mtimeMs: st ? st.mtimeMs : -1, size: st ? st.size : -1 });
  }

  /**
   * Run fn(tx) alone in the write queue. tx.get(name) returns a working copy (the same object for the whole
   * transaction); tx.save(name) marks it dirty. Dirty collections are committed when fn resolves; when fn throws
   * nothing is written.
   */
  function transaction(fn) {
    const run = async () => {
      const working = new Map();
      const dirty = new Set();
      const tx = {
        get(name) { if (!working.has(name)) working.set(name, read(name)); return working.get(name); },
        set(name, value) { assertName(name); working.set(name, value); dirty.add(name); return value; },
        save(name) { assertName(name); if (!working.has(name)) working.set(name, read(name)); dirty.add(name); },
      };
      const result = await fn(tx);
      for (const name of dirty) await writeAtomic(name, working.get(name));
      return result;
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }

  const flush = () => queue;

  return { dir, read, transaction, flush, collections: Object.keys(COLLECTIONS), fileOf };
}

module.exports = { createStore, COLLECTIONS };
