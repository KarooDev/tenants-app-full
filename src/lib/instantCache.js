// src/lib/instantCache.js
// Tiny stale-while-revalidate cache with memory + localStorage.
// Keyed by user + endpoint + params. Emits updates to live subscribers.

const mem = new Map();
const listeners = new Map();
const LS_PREFIX = "instant:v1:";   // bump if schema changes
const DEFAULT_TTL = 30_000;        // 30s perceived-instant window

const now = () => Date.now();

function k(userId, endpoint, params) {
  const p = params ? JSON.stringify(params) : "";
  return `${LS_PREFIX}${userId || "anon"}:${endpoint}:${p}`;
}

export function readCache(userId, endpoint, params) {
  const key = k(userId, endpoint, params);
  // 1) memory
  const hit = mem.get(key);
  if (hit && hit.exp > now()) return hit.value;

  // 2) localStorage (cheap sync)
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.exp > now()) {
        // refresh mem
        mem.set(key, parsed);
        return parsed.value;
      }
    }
  } catch {}
  return undefined;
}

export function writeCache(userId, endpoint, params, value, ttl = DEFAULT_TTL) {
  const key = k(userId, endpoint, params);
  const rec = { value, exp: now() + ttl };
  mem.set(key, rec);
  try { localStorage.setItem(key, JSON.stringify(rec)); } catch {}
  // notify
  const ls = listeners.get(key);
  if (ls) ls.forEach(fn => { try { fn(value); } catch {} });
}

export function subscribe(userId, endpoint, params, fn) {
  const key = k(userId, endpoint, params);
  let set = listeners.get(key);
  if (!set) { set = new Set(); listeners.set(key, set); }
  set.add(fn);
  return () => {
    const s = listeners.get(key);
    if (!s) return;
    s.delete(fn);
    if (!s.size) listeners.delete(key);
  };
}
