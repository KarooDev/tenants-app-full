// src/lib/sessionCache.js
import { session } from '../api/auth';

const KEY = "bx.session.v1";

const TTL_MS = 2 * 60 * 1000; // 2 minutes is enough to cover a reload

async function loadSession(idToken) {
  const cached = readSessionCache();
  if (cached) return cached;

  const res = await session(idToken); // de-duped now
  if (res?.user) writeSessionCache(res.user);
  return res?.user ?? null;
}

export function readSessionCache() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { ts, user } = JSON.parse(raw);
    if (!ts || Date.now() - ts > TTL_MS) return null;
    return user || null;
  } catch {
    return null;
  }
}

export function writeSessionCache(user) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), user }));
  } catch {}
}

export function clearSessionCache() {
  try { localStorage.removeItem(KEY); } catch {}
}
