// server/lib/cache.js
// ==========================
// Simple in-memory cache with TTL. Swap with Redis in prod if needed.
const store = new Map();


export function get(key) {
const v = store.get(key);
if (!v) return null;
const { exp, val } = v;
if (exp && Date.now() > exp) { store.delete(key); return null; }
return val;
}
export function put(key, val, ttlSec = 300) {
store.set(key, { val, exp: Date.now() + Math.max(30, ttlSec) * 1000 });
}
export function del(key) { store.delete(key); }
export function keys() { return [...store.keys()]; }


// ==========================