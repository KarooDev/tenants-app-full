// src/components/MobileDrawer.jsx
import { useEffect, useMemo, useRef } from "react";
import { NAV } from "../constants/nav";
import { useAuth } from "../providers/AuthProvider";
import { NavLink, Link } from "react-router-dom";
import { APP_VERSION } from "../lib/appInfo";
import { useI18n } from "../providers/I18nProvider";
import { auth } from "../lib/firebase";

/* ========== tiny icons (inline SVG) ========== */
function IconClose({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className}>
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconLogout({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className}>
      <path
        d="M9 6V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13 12H3m0 0 3-3m-3 3 3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconChevron({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className}>
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconIssue({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className}>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 7v6M12 16v1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconPay({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className}>
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M3 10h18" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconSettings({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className}>
      <path
        d="M10 2h4l1 3 3 1v4l-3 1-1 3h-4l-1-3-3-1V6l3-1 1-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/* ========== helpers ========== */
function initialsOf(user) {
  // fall back to Firebase currentUser if session user isn’t ready yet
  const fb = auth?.currentUser;
  const s =
    user?.full_name ||
    user?.username ||
    user?.email?.split("@")[0] ||
    fb?.displayName ||
    (fb?.email ? fb.email.split("@")[0] : "") ||
    "";
  const parts = s.trim().split(/\s+/).slice(0, 2);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* Big tile button (mobile app vibe) */
function Tile({ to, label, icon: Icon, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl px-3 py-3 border border-[var(--border)] bg-[var(--panel)]/80 hover:bg-white/5 active:scale-[.99] transition"
    >
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/5 ring-1 ring-[var(--border)] shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      <span className="text-[15px] font-medium truncate">{label}</span>
    </Link>
  );
}

/* List row with full-bleed active gradient (same as hero) */
function Cell({ to, icon: Icon, label, rtl, onClick }) {
  const ACTIVE_GRADIENT =
    "linear-gradient(135deg, color-mix(in oklab, var(--accent) 26%, transparent) 0%, transparent 70%)";
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          // full-bleed: cancel parent nav's padding
          "block no-underline -mx-2 pl-4 pr-3 py-3",
          "flex items-center justify-between",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
          rtl ? "flex-row-reverse" : "",
          isActive
            ? "text-[var(--accent-700)]"
            : "hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] text-[var(--text)]/85",
        ].join(" ")
      }
      style={({ isActive }) =>
        isActive ? { background: ACTIVE_GRADIENT } : undefined
      }
      end
    >
      <div
        className={[
          "flex items-center gap-3 min-w-0",
          rtl ? "flex-row-reverse text-right" : "",
        ].join(" ")}
      >
        {Icon ? <Icon className="w-5 h-5 shrink-0" /> : null}
        <span className="text-[15px] truncate">{label}</span>
      </div>
      <IconChevron className={rtl ? "rotate-180 opacity-70" : "opacity-70"} />
    </NavLink>
  );
}

export default function MobileDrawer({ open, onClose }) {
  const { user, signOut } = useAuth();
  const { dir, t, locale } = useI18n();
  const role = String(user?.role || "").toUpperCase();
  // Firebase fallbacks for instant identity paint
  const fb = auth?.currentUser;
  const displayName =
    user?.full_name ||
    user?.username ||
    fb?.displayName ||
    (fb?.email ? fb.email.split("@")[0] : "") ||
    "—";
  const email = user?.email || fb?.email || "—";
  const L = (en, ar) => (locale === "ar" ? ar : en); // used in tiles + footer

  const items = NAV.filter((i) => !role || i.roles?.includes(role));

  // role-aware top tiles
  const tiles = useMemo(() => {
    if (["TENANT", "OWNER"].includes(role)) {
      return [];
    }
    return [];
  }, [role, locale]); // L is stable enough here

  // slide side based on direction
  const slideClosed = dir === "rtl" ? "translate-x-full" : "-translate-x-full";
  const sideClass = dir === "rtl" ? "right-0 border-l" : "left-0 border-r";

  // focus trap + esc + body lock
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const prevFocusRef = useRef(null);

  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement;
      document.body.style.overflow = "hidden";
      setTimeout(() => closeBtnRef.current?.focus(), 0);
    } else {
      document.body.style.overflow = "";
      if (prevFocusRef.current instanceof HTMLElement)
        prevFocusRef.current.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleLogout() {
    try {
      if (typeof signOut === "function") await signOut();
      else if (auth?.signOut) await auth.signOut();
    } finally {
      onClose?.();
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 md:hidden ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label={t("homeAria")}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        className={`absolute top-0 h-[100dvh] w-[92vw] max-w-[420px]
                    bg-[var(--bg)] border-[var(--border)] flex flex-col
                    transform transition-transform duration-300
                    motion-reduce:transition-none motion-reduce:transform-none
                    ${sideClass} ${open ? "translate-x-0" : slideClosed}`}
      >
        {/* Hero Profile Header */}
        <div
          className="relative border-b border-[var(--border)] overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--accent) 26%, transparent) 0%, transparent 70%)",
          }}
        >
          <div
            className={`px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-4 ${
              dir === "rtl" ? "text-right" : ""
            }`}
          >
            {/* Close button */}
            <div
              className={`flex ${
                dir === "rtl" ? "justify-start" : "justify-end"
              }`}
            >
              <button
                ref={closeBtnRef}
                onClick={onClose}
                aria-label={t("close")}
                title={t("close")}
                className="p-2 rounded-xl text-[var(--text)]/85 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              >
                <IconClose />
              </button>
            </div>

            {/* Avatar + Name */}
            <div
              className={`mt-1 flex items-center gap-3 ${
                dir === "rtl" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-semibold shadow-sm"
                style={{
                  background:
                    "color-mix(in oklab, var(--accent) 18%, transparent)",
                  color: "var(--accent-700)",
                }}
                aria-hidden="true"
              >
                {initialsOf(user)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{displayName}</div>
                <div className="text-[13px] text-[var(--muted)] truncate">
                  {email}
                </div>
                {user?.role && (
                  <span className="inline-block mt-2 text-[11px] px-2 py-[3px] rounded-full border border-[var(--border)] bg-white/5">
                    {String(user.role).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tiles (Primary Actions) */}
        <div className="px-4">
          <div
            className={`grid grid-cols-2 gap-2 ${
              dir === "rtl" ? "[direction:rtl]" : ""
            }`}
          >
            {tiles.map((tItem) => (
              <Tile
                key={tItem.to}
                to={tItem.to}
                label={tItem.label}
                icon={tItem.icon}
                onClick={onClose}
              />
            ))}
          </div>
        </div>

        {/* Menu (full-bleed native cells) */}
        <nav className="px-2  overflow-y-auto flex-1">
          {items.map((it, idx) => (
            <div key={it.key}>
              <Cell
                to={it.path}
                icon={it.icon}
                label={locale === "ar" ? it.label_ar || it.label : it.label}
                rtl={dir === "rtl"}
                onClick={onClose}
              />
              {idx < items.length - 1 && (
                <div className="-mx-2 h-px bg-[var(--border)]/60" />
              )}
            </div>
          ))}
        </nav>

        {/* Sticky Footer: Logout + Version */}
        <div
          className={`px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 border-t border-[var(--border)] ${
            dir === "rtl" ? "text-right" : ""
          }`}
        >
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-3 border border-[var(--border)] bg-white/5 hover:bg-white/10 active:scale-[.99] transition"
          >
            <IconLogout />
            <span className="text-[15px] font-medium">
              {t("Sign out") || "Sign out"}
            </span>
          </button>

          <div className="mt-3">
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] rounded-full border border-[var(--border)] px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              {t("version") || L("v", "الإصدار ")}
              {APP_VERSION}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
