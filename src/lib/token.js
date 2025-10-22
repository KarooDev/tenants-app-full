// src/lib/token.js
import { auth } from "./firebase";

let inFlight = null;
let lastIssuedAt = 0;

/**
 * Safe ID token getter.
 * - Returns string token, or null if no user yet.
 * - Dedupes concurrent calls.
 * - Retries once with force refresh if the first attempt fails.
 */
export async function getStableIdToken({ force = false } = {}) {
  const u = auth.currentUser;
  if (!u) return null;

  const shouldForce = force || Date.now() - lastIssuedAt > 55 * 60 * 1000;

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const tok = await u.getIdToken(shouldForce);
        lastIssuedAt = Date.now();
        return tok;
      } catch {
        try {
          const tok = await u.getIdToken(true);
          lastIssuedAt = Date.now();
          return tok;
        } catch {
          return null;
        }
      } finally {
        inFlight = null;
      }
    })();
  }
  try {
    return await inFlight;
  } catch {
    return null;
  }
}
