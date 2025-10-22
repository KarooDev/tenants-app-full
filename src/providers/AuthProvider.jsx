// src/providers/AuthProvider.jsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth } from "../lib/firebase";
import { onIdTokenChanged } from "firebase/auth";
import api from "../api";
import {
  readSessionCache,
  writeSessionCache,
  clearSessionCache,
} from "../lib/sessionCache";
import { warmCache } from "../lib/warmCache";

const Ctx = createContext({
  user: null,
  loading: true,
  refresh: async () => {},
  requireVerified: false,
});
export const useAuth = () => useContext(Ctx);

export default function AuthProvider({ children }) {
  // 1) Synchronous hydration from cache → instant role/building on first paint
  const cached = readSessionCache();
  const [user, setUser] = useState(cached || null); // null | optimistic | server user
  const [loading, setLoading] = useState(!cached); // if we had cache, don't show loader
  const didInit = useRef(false);

  async function fetchSessionIntoState(fbUser) {
    if (!fbUser) {
      setUser(null);
      clearSessionCache();
      return;
    }
    try {
      const idToken = await fbUser.getIdToken(); // NOT force-refresh
      const sess = await api.session({ idToken });
      if (sess?.ok) {
        setUser(sess.user);
        writeSessionCache(sess.user); // keep it warm for the next reload
        // 🔥 pre-warm heavy lists so the first nav is instant
        try {
          const { warmCache } = await import("../lib/warmCache");
          warmCache(sess.user);
        } catch {}
        // pre-warm hot endpoints *after* we have a confirmed user
        try {
          warmCache(sess.user);
        } catch {}
        return;
        
      }
      else if (sess?.status === "UNLINKED") {
        clearSessionCache();
        window.location.assign("/sign-up");
        return;
      }
      // server said no
      const err = String(sess?.error || "");
      clearSessionCache();
      if (err === "not_verified") {
        setUser(null);
        window.location.assign("/await-approval");
        return;
      }
      if (err === "user_inactive") {
        setUser(null);
        window.location.assign("/account-disabled");
        return;
      }
      if (err === "no_linked_user") {
        setUser(null);
        const url = new URL(window.location.href);
        const invite = url.searchParams.get("invite");
        const full_name = fbUser.displayName || "";
        const username = url.searchParams.get("username") || "";
        const params = new URLSearchParams();
        if (invite) params.set("invite", invite);
        if (full_name) params.set("full_name", full_name);
        if (username) params.set("username", username);
        window.location.assign(
          `/sign-up${params.toString() ? `?${params}` : ""}`
        );
        return;
      }
      setUser(null);
    } catch {
      // network hiccup → keep whatever we had; callers can refresh()
    }
  }

  useEffect(() => {
    // warm the backend without blocking
    try {
      api.get?.("auth/health", { _t: Date.now() });
    } catch {}

    // safety: ensure we clear "loading" if Firebase never fires
    const t = setTimeout(() => {
      if (!didInit.current) {
        didInit.current = true;
        setLoading(false);
      }
    }, 1200);

    const unsub = onIdTokenChanged(auth, async (fb) => {
      if (!didInit.current) setLoading(true);

      if (fb) {
        if (!user) {
          // 1) try session cache for instant full data
          const cached = readSessionCache();
          if (cached) {
            setUser(cached);
            try {
              warmCache(cached);
            } catch {}
          } else {
            // 2) fall back to optimistic FB-only identity (no role/building yet)
            setUser({
              _optimistic: true,
              email: fb.email || "",
              full_name: fb.displayName || "",
              username:
                fb.displayName ||
                (fb.email ? fb.email.split("@")[0] : "") ||
                "",
              // leave role/building_id undefined so NAV/filters don’t misclassify
            });
          }
        }
        if (!didInit.current) {
          didInit.current = true;
          setLoading(false);
          clearTimeout(t);
        }
        // Reconcile with backend (fills role/building etc.)
        fetchSessionIntoState(fb);
      } else {
        clearSessionCache();
        // debounce transient nulls during token refresh
        const hadUser = !!user;
        if (hadUser) {
          setTimeout(() => {
            if (!auth.currentUser) setUser(null);
          }, 900);
        } else {
          setUser(null);
        }
        if (!didInit.current) {
          didInit.current = true;
          setLoading(false);
          clearTimeout(t);
        }
      }
    });

    return () => {
      clearTimeout(t);
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh: () => fetchSessionIntoState(auth.currentUser),
      requireVerified: false,
    }),
    [user, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
