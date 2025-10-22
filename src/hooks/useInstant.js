// src/hooks/useInstant.js
// Cache-first hook: returns cached data immediately (if any),
// then revalidates via fetcher and updates subscribers.

import { useEffect, useRef, useState } from "react";
import { readCache, writeCache, subscribe } from "../lib/instantCache";

export default function useInstant({ userId, endpoint, params, fetcher, ttl }) {
  const [data, setData] = useState(() => readCache(userId, endpoint, params));
  const [loading, setLoading] = useState(data === undefined);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const unsub = subscribe(userId, endpoint, params, (v) => {
      if (!mounted.current) return;
      setData(v);
      setLoading(false);
    });

    // revalidate
    (async () => {
      try {
        const res = await fetcher();
        // if backend wraps {ok:true, items:[]}, store only the meaningful payload
        const value = ("items" in (res || {})) ? res.items : res;
        writeCache(userId, endpoint, params, value, ttl);
        if (mounted.current) { setError(null); setLoading(false); }
      } catch (e) {
        if (mounted.current) { setError(e); setLoading(false); }
      }
    })();

    return () => { mounted.current = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, endpoint, JSON.stringify(params)]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetcher();
      const value = ("items" in (res || {})) ? res.items : res;
      writeCache(userId, endpoint, params, value, ttl);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refresh };
}
