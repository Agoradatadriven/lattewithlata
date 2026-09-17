// In-memory sliding-window rate limiter. A limiter holds one or more { max, windowMs } rules per key (the client IP).
'use strict';

function createLimiter(rules) {
  const hits = new Map(); // key -> ascending timestamps
  const longest = Math.max(...rules.map((r) => r.windowMs));

  /** Count one request. Returns { ok: true } or { ok: false, retryAfter } (seconds). */
  function take(key, now = Date.now()) {
    const list = (hits.get(key) || []).filter((t) => now - t < longest);
    for (const rule of rules) {
      const inWindow = list.filter((t) => now - t < rule.windowMs);
      if (inWindow.length >= rule.max) {
        hits.set(key, list);
        return { ok: false, retryAfter: Math.max(1, Math.ceil((inWindow[0] + rule.windowMs - now) / 1000)) };
      }
    }
    list.push(now); hits.set(key, list);
    return { ok: true };
  }
  /** Check without counting. */
  function peek(key, now = Date.now()) {
    const list = (hits.get(key) || []).filter((t) => now - t < longest);
    for (const rule of rules) {
      const inWindow = list.filter((t) => now - t < rule.windowMs);
      if (inWindow.length >= rule.max) return { ok: false, retryAfter: Math.max(1, Math.ceil((inWindow[0] + rule.windowMs - now) / 1000)) };
    }
    return { ok: true };
  }
  const reset = (key) => hits.delete(key);
  function sweep(now = Date.now()) {
    for (const [key, list] of hits) {
      const keep = list.filter((t) => now - t < longest);
      if (keep.length) hits.set(key, keep); else hits.delete(key);
    }
  }
  const timer = setInterval(sweep, 60 * 1000);
  if (timer.unref) timer.unref();
  return { take, peek, reset, sweep, size: () => hits.size };
}

module.exports = { createLimiter };
