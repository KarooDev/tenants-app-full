// src/components/Sidebar.jsx
import { useMemo } from "react";
import { NavLink, Link } from "react-router-dom";
import { NAV } from "../constants/nav";
import { useAuth } from "../providers/AuthProvider";
import { APP_VERSION } from "../lib/appInfo";
import { useI18n } from "../providers/I18nProvider";
import { auth } from "../lib/firebase";
import { signOut as fbSignOut } from "firebase/auth";

/* ---------- tiny icons (inline SVG) ---------- */
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

/* ---------- helpers ---------- */
function initialsOf(user) {
  const s =
    user?.full_name ||
    user?.username ||
    (user?.email ? user.email.split("@")[0] : "");
  const parts = s.trim().split(/\s+/).slice(0, 2);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* Native list cell (mirrors icon/chevron correctly in RTL) */
function Cell({ to, icon: Icon, label, rtl, onClick }) {
  const ACTIVE_GRADIENT = rtl
    ? "linear-gradient(315deg, color-mix(in oklab, var(--accent) 22%, transparent) 0%, transparent 70%)"
    : "linear-gradient(135deg, color-mix(in oklab, var(--accent) 22%, transparent) 0%, transparent 70%)";

  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "block no-underline -mx-2 py-2.5",
          rtl ? "pr-4 pl-3" : "pl-4 pr-3", // mirror paddings
          "flex items-center justify-between",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
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
      {/* Chevron: left in RTL, right in LTR */}
      <IconChevron
        className={[
          "opacity-70 shrink-0",
          rtl ? "order-first rotate-180 ml-0 mr-2" : "order-last mr-0 ml-2",
        ].join(" ")}
      />

      {/* Icon + label: mirror order inside only */}
      <div
        className={[
          "flex items-center gap-3 min-w-0 flex-1",
          rtl ? "flex-row-reverse text-right" : "",
        ].join(" ")}
      >
        {Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
        <span className="text-[14px] truncate">{label}</span>
      </div>
    </NavLink>
  );
}

/* ---------- component ---------- */
export default function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const { locale, dir, t } = useI18n();
  const rtl = dir === "rtl";

  const roleUp = String(user?.role || "").toUpperCase();
  const items = NAV.filter((i) => !roleUp || i.roles?.includes(roleUp));

  const tiles = useMemo(() => [], []);

  async function handleSignOut() {
    try {
      await fbSignOut(auth);
      window.location.assign(`${import.meta.env.BASE_URL || "/"}`);
    } catch (e) {
      alert(e?.message || "Sign out failed");
    }
  }

  const fb = auth?.currentUser;
  const displayName =
    user?.full_name ||
    user?.username ||
    fb?.displayName ||
    (fb?.email ? fb.email.split("@")[0] : "") ||
    "—";
  const email = user?.email || fb?.email || "";
  const logoutText =
    t("Sign out") ||
    t("logout") ||
    (locale === "ar" ? "تسجيل الخروج" : "Log out");
  const versionLabel = t("version") || (locale === "ar" ? "الإصدار" : "v");

  return (
    <div
      dir={dir}
      className="h-dvh flex flex-col bg-[var(--bg)] text-[var(--text)]"
    >
      {/* Hero banner */}
      <div
        className="overflow-hidden"
        style={{
          background: rtl
            ? "linear-gradient(315deg, color-mix(in oklab, var(--accent) 22%, transparent) 0%, transparent 70%)"
            : "linear-gradient(135deg, color-mix(in oklab, var(--accent) 22%, transparent) 0%, transparent 70%)",
        }}
      >
        {/* Brand */}
        <div className={`px-3 pt-6 pb-3 ${rtl ? "text-right" : ""}`}>
          <Link
            to="/"
            onClick={onNavigate}
            aria-label={
              t("homeAria") || (locale === "ar" ? "الرئيسية" : "Home")
            }
            className={`inline-flex items-center ${
              rtl ? "flex-row-reverse" : ""
            }`}
          >
            <img
              src={`${import.meta.env.BASE_URL}bineytna.svg`}
              alt="Bineytna"
              className="block h-7 w-auto shrink-0"
              draggable="false"
              decoding="async"
              loading="eager"
            />
          </Link>
        </div>

        {/* User block */}
        <div className={`px-4 py-4 ${rtl ? "text-right" : ""}`}>
          <div
            className={`flex items-center gap-3 ${
              rtl ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className="w-11 h-11 rounded-full overflow-hidden grid place-items-center font-semibold shadow-sm select-none shrink-0"
              style={{ aspectRatio: "1 / 1" }} // keeps it perfectly circular everywhere
              aria-hidden="true"
            >
              {initialsOf(user)}
            </div>

            <div className="min-w-0">
              <div className="font-semibold leading-tight truncate">
                {displayName}
              </div>
              <div className="text-[12px] text-[var(--muted)] truncate">
                {email || "—"}
              </div>
              {user?.role && (
                <span className="inline-block mt-2 text-[11px] px-2 py-[3px] rounded-full border border-[var(--border)] bg-white/5">
                  {roleUp}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav list */}
      <nav className="px-2 overflow-y-auto flex-1">
        {items.map((it, idx) => (
          <div key={it.key}>
            {idx === 0 ? <div className="-mx-2 h-px" /> : null}
            <Cell
              to={it.path}
              icon={it.icon}
              label={locale === "ar" ? it.label_ar || it.label : it.label}
              rtl={rtl}
              onClick={onNavigate}
            />
            <div className="-mx-2 h-px bg-[var(--border)]/60" />
          </div>
        ))}
        {tiles.length > 0 && (
          <div className="px-2 py-3 grid grid-cols-1 gap-2">
            {tiles.map((t) => t)}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div
        className={`px-2 pb-4 pt-3 border-t border-[var(--border)] ${
          rtl ? "text-right" : ""
        }`}
      >
        <button
          onClick={handleSignOut}
          className={[
            "w-full rounded-lg px-3 py-2 flex items-center gap-3 hover:bg-black/5",
            rtl ? "flex-row-reverse text-right" : "text-left",
          ].join(" ")}
          aria-label={logoutText}
          title={logoutText}
        >
          <IconLogout className="text-current opacity-90 shrink-0" />
          <span className="text-sm">{logoutText}</span>
        </button>

        <div className={`mt-3 ${rtl ? "text-right" : ""}`}>
          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] rounded-full border border-[var(--border)] px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            {versionLabel} {APP_VERSION}
          </span>
        </div>
      </div>
    </div>
  );
}
