// src/lib/warmCache.js
import { api } from "../api";
import { getStableIdToken } from "./token";

/** ---------- internals ---------- */
const MEM = new Map(); // key -> { exp:number, data:any }
const PREFIX = "wc:";  // localStorage namespace

/** Build a stable cache key (keeps your behavior) */
export function keyOf(name, params = {}) {
  const SAFE_PARAMS = Object.fromEntries(
    Object.entries(params).filter(
      ([k]) => k !== "idToken" && k !== "token" && k !== "authorization"
    )
  );
  const q = Object.entries(SAFE_PARAMS)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("&");
  return q ? `${name}?${q}` : name;
}

/** ---------- persistence helpers ---------- */
function readLS(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function writeLS(key, obj) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(obj)); } catch {}
}
function delLS(key) {
  try { localStorage.removeItem(PREFIX + key); } catch {}
}

/** Set a value into cache (memory + localStorage) */
export function setCached(keyOrName, data, ttlMs = 15_000) {
  const key = String(keyOrName);
  const exp = Date.now() + ttlMs;
  MEM.set(key, { exp, data });
  writeLS(key, { exp, data });
  return data;
}

/** Get cached value or null (NO fetch). Checks memory, then localStorage. */
export function getCached(keyOrName) {
  const key = String(keyOrName);
  const now = Date.now();

  const m = MEM.get(key);
  if (m) {
    if (m.exp > now) return m.data;
    MEM.delete(key);
  }

  const fromLS = readLS(key);
  if (!fromLS) return null;
  if (fromLS.exp > now) {
    // promote to memory
    MEM.set(key, { exp: fromLS.exp, data: fromLS.data });
    return fromLS.data;
  }
  // expired → clean up
  delLS(key);
  return null;
}

/**
 * Fetch with cache: returns cached if fresh; otherwise runs fetcher() and caches the result.
 * Only caches arrays or objects with an "ok" flag (keeps your original safety).
 */
export async function withCache(name, params, fetcher, ttlMs = 15_000) {
  const key = keyOf(name, params);
  const hit = getCached(key);
  if (hit !== null) return hit;

  const data = await fetcher();
  if (data && (Array.isArray(data) || (typeof data === "object" && "ok" in data))) {
    setCached(key, data, ttlMs);
  }
  return data;
}

/** Optional utilities */
export function delCached(keyOrName) {
  const key = String(keyOrName);
  MEM.delete(key);
  delLS(key);
}
export function clearCached() {
  MEM.clear();
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    });
  } catch {}
}

/**
 * Pre-warm the most used endpoints for the current user.
 * Now persisted → subsequent reloads render instantly from cache.
 */
export async function warmCache(user) {
  if (!user) return;

  // Guard to avoid spamming warms across quick navigations (persists too)
  const guardKey = "__warm_guard__";
  const guard = getCached(guardKey);
  if (guard) return;
  setCached(guardKey, true, 4000);

  try {
    const idToken = await getStableIdToken();
    if (!idToken) return;

    // Buildings
     if (api?.buildings?.list) {
         withCache("buildings/list", { idToken }, () => api.buildings.list({ idToken }), 60_000);
       }

    // Issues
     if (api?.issues?.list) {
         withCache("issues/list", { idToken }, () => api.issues.list({ idToken }), 30_000);
       }

    // Ratings (when available)
    const bId = user?.building_id ? String(user.building_id) : undefined;
    if (api?.ratings?.summary) {
      withCache(
        "ratings/summary",
        bId ? { idToken, building_id: bId } : { idToken },
        () => api.ratings.summary(bId ? { idToken, building_id: bId } : { idToken }),
        60_000
      );
    }

    // Charges: warm by role
    const role = String(user?.role || "").toUpperCase();
    if (role === "TENANT" || role === "OWNER") {
      withCache(
        "charges/list",
        { idToken },
        () => api.charges.list({ idToken }),
        60_000
      );
    } else {
      withCache(
        "charges/list",
        { idToken, status: "PENDING" },
        () => api.charges.list({ idToken, status: "PENDING" }),
        45_000
      );
      withCache(
        "charges/list",
        { idToken, status: "OVERDUE" },
        () => api.charges.list({ idToken, status: "OVERDUE" }),
        45_000
      );
    }
  } catch {
    // best-effort warm; ignore errors
  }
}

/** Convenience helpers for pages (unchanged API) */
export const cached = {

      buildingsList: async (idToken) => {
        if (!api?.buildings?.list) return null;           // <-- guard
        return withCache(
          "buildings/list",
          { idToken },
          () => api.buildings.list({ idToken }),
          60_000
        );
      },

      issuesList: async (idToken) => {
          if (!api?.issues?.list) return null;              // <-- guard
          return withCache(
            "issues/list",
            { idToken },
            () => api.issues.list({ idToken }),
            30_000
          );
        },

  chargesList: async (idToken, params = {}) =>
    withCache("charges/list", { idToken, ...params }, () =>
      api.charges.list({ idToken, ...params })
    , 60_000),

    ratingsSummary: async (idToken, building_id) => {
        const params = building_id ? { idToken, building_id } : { idToken };
        if (api?.ratings?.summary) {
          return withCache(
            "ratings/summary",
            params,
            () => api.ratings.summary(params),
            60_000
          );
        }
        // Fallback to list if summary isn’t implemented
        if (api?.ratings?.list) {
          return withCache(
            "ratings/list",
            params,
            () => api.ratings.list(params),
            30_000
          );
        }
        return null;
      },
};

export default {
  warmCache,
  getCached,
  setCached,
  withCache,
  keyOf,
  cached,
  delCached,
  clearCached,
};
