// src/hooks/useSessionRestore.js
import useInstant from "./useInstant";

/**
 * Wraps useInstant to restore/check the auth session silently.
 * Return shape:
 *  - restoring: boolean (show thin progress bar)
 *  - error: error or null (show inline banner if present)
 *  - session: the normalized session payload, if any
 */
export default function useSessionRestore({ userId, fetcher, ttl = 60_000 }) {
  // Use a stable cache key (endpoint + params) so multiple consumers share it
  const endpoint = "auth/session";
  const params = {}; // no params for session check

  const { data, loading, error, refresh } = useInstant({
    userId,
    endpoint,
    params,
    fetcher, // e.g. () => api.auth.session() or () => api("/auth/session")
    ttl
  });

  // If backend returns { ok, user, token } or similar, keep the meaningful part.
  const session = data && (data.session || data.user ? data : { session: data });

  return {
    restoring: loading,
    error,
    session,
    refresh
  };
}
