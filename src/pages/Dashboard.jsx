// src/pages/Dashboard.jsx
import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { NAV } from "../constants/nav";
import { api } from "../api";
import { getStableIdToken } from "../lib/token";
import { getCached, setCached } from "../lib/warmCache";
import { useI18n } from "../providers/I18nProvider";

const money = (n, cur = "USD", locale = undefined) =>
  (Number(n) || 0).toLocaleString(locale, { style: "currency", currency: cur });

/* tiny i18n helper for this page only */
function L(locale, en, ar) {
  return locale === "ar" ? ar : en;
}

/* ========= Icons (lightweight SVG, no deps) ========= */
function IconChevron({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className} aria-hidden="true">
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconBuilding({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 21h16M6 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16M10 8h2M10 12h2M10 16h2M16 21V9h2a1 1 0 0 1 1 1v11"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconTicket({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 8v8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconMoney({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M3 7h18v10H3zM7 12h10M6 9v6M18 9v6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function IconStar({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 18l-5.8 3.1 1.1-6.4-4.7-4.6 6.5-.9L12 3z"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

/* ========= Micro-components ========= */
function RolePill({ children }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-2 py-[2px] rounded-full border border-[var(--border)]"
      style={{ background: "rgba(34,197,94,.12)", color: "#7dd3a7" }}
    >
      {children}
    </span>
  );
}

function SectionHeader({ title, action, dir }) {
  return (
    <div className={`flex items-center justify-between ${dir === "rtl" ? "flex-row-reverse" : ""}`}>
      <h2 className="text-base font-medium opacity-80">{title}</h2>
      {action}
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 p-4">
      {/* glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-25"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 26%, transparent), transparent 70%)",
        }}
      />
      <div className="flex items-center gap-3">
        <div className="grid place-items-center h-9 w-9 rounded-xl ring-1 ring-[var(--border)] bg-white/5 shrink-0">
          {Icon ? <Icon className="w-5 h-5 text-[var(--text)]/85" /> : null}
        </div>
        <div className="min-w-0">
          <div className="text-sm opacity-70">{title}</div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
          {sub ? <div className="text-[11px] text-[var(--muted)] mt-1">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

function QuickTile({ to, label, icon: Icon, rtl, hint = "Open" }) {
  return (
    <Link
      to={to}
      className={[
        "group relative overflow-hidden rounded-2xl border border-[var(--border)]",
        "bg-[var(--panel)]/80 backdrop-blur-sm",
        "p-3 flex items-center gap-3",
        "ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
        "transition-transform hover:-translate-y-[1px] hover:shadow-[0_8px_20px_rgba(0,0,0,.14)]",
      ].join(" ")}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-25"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 26%, transparent), transparent 70%)",
        }}
      />
      <div
        className={[
          "relative grid place-items-center h-9 w-9 shrink-0 rounded-xl",
          "ring-1 ring-[var(--border)] bg-white/[.06]",
          "group-hover:scale-[1.04] transition-transform",
        ].join(" ")}
      >
        {Icon ? (
          <Icon className="w-4 h-4 text-[var(--text)]/90" aria-hidden="true" />
        ) : (
          <span className="w-3 h-3 rounded-full bg-[var(--accent)]/70" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-[11px] text-[var(--muted)]">{hint}</div>
      </div>
      <IconChevron
        className={[
          "text-[var(--muted)] group-hover:text-[var(--text)]/80 transition-colors",
          rtl ? "rotate-180" : "",
        ].join(" ")}
      />
    </Link>
  );
}

/* Lightweight skeleton */
function Skeleton({ className = "" }) {
  return (
    <div
      className={className}
      style={{
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%)",
        backgroundSize: "400% 100%",
        animation: "dashPulse 1.2s ease-in-out infinite",
        borderRadius: "1rem",
      }}
    />
  );
}
// keyframes once per page
if (typeof document !== "undefined" && !document.getElementById("dashPulseKF")) {
  const style = document.createElement("style");
  style.id = "dashPulseKF";
  style.textContent = `
@keyframes dashPulse { 
  0% { background-position: 100% 0; } 
  100% { background-position: 0 0; } 
}`;
  document.head.appendChild(style);
}

/* ========= Cache keys / TTLs ========= */
const TTL_BUILDINGS = 120_000;
const TTL_ISSUES = 60_000;
const TTL_CHARGES = 45_000;
const TTL_RATINGS = 60_000;

const KEY_BUILDINGS = "buildings/list";
const KEY_ISSUES = "issues/list";
const keyCharges = (status, scope = "all") => `charges/list?status=${status || "ALL"}&scope=${scope}`;
const keyRatingsSummary = (building_id = "") => `ratings/summary?b=${building_id || "ALL"}`;

// treat undefined/null as not fresh (warmCache returns undefined when expired)
const hasFresh = (key) => getCached(key) !== undefined && getCached(key) !== null;

/* ========= Page ========= */
export default function Dashboard() {
  const { user } = useAuth();
  const { locale, dir } = useI18n();
  const uid = String(user?.ID || "anon");
  const role = String(user?.role || "").toUpperCase();

  const isAdmin = role === "ADMIN";
  const isMgmt = role === "BUILDING_MGMT";
  const isStaff = role === "STAFF";
  const isTenant = role === "TENANT";
  const isOwner = role === "OWNER";
  const isTenantOrOwner = isTenant || isOwner;

  const allowed = useMemo(() => NAV.filter((i) => i.roles?.includes(role)), [role]);
  const myBuildingId = String(user?.building_id || "");

  // --- seed from cache for instant paint ---
  const cachedBuildings = getCached(KEY_BUILDINGS);
  const cachedIssues = getCached(KEY_ISSUES);
  const cachedChargesPending = getCached(keyCharges("PENDING", isTenantOrOwner ? `u:${uid}` : "all"));
  const cachedChargesOverdue = getCached(keyCharges("OVERDUE", isTenantOrOwner ? `u:${uid}` : "all"));
  const cachedRatings = getCached(keyRatingsSummary(myBuildingId || "ALL"));

  const [buildings, setBuildings] = useState(Array.isArray(cachedBuildings) ? cachedBuildings : []);
  const [issues, setIssues] = useState(Array.isArray(cachedIssues) ? cachedIssues : []);
  const [chargesPending, setChargesPending] = useState(Array.isArray(cachedChargesPending) ? cachedChargesPending : []);
  const [chargesOverdue, setChargesOverdue] = useState(Array.isArray(cachedChargesOverdue) ? cachedChargesOverdue : []);
  const [ratingsSummary, setRatingsSummary] = useState(Array.isArray(cachedRatings) ? cachedRatings : []);

  // loading flags (grouped to keep UI snappy)
  const [loadingHero, setLoadingHero] = useState(!(hasFresh(KEY_BUILDINGS) && hasFresh(keyRatingsSummary(myBuildingId || "ALL"))));
  const [loadingKPIs, setLoadingKPIs] = useState(!(hasFresh(KEY_ISSUES) && hasFresh(keyCharges("PENDING", isTenantOrOwner ? `u:${uid}` : "all"))));
  const [loadingListBits, setLoadingListBits] = useState(!(hasFresh(keyCharges("OVERDUE", isTenantOrOwner ? `u:${uid}` : "all"))));
  const [error, setError] = useState("");

  const inFlight = useRef(false);

  // keep Apps Script warm when landing on dashboard
  useEffect(() => {
    (async () => {
      try { await api.get?.("auth/health", { _t: Date.now() }); } catch {}
    })();
  }, []);

  // --- loader (one-time auth retry, soft vs hard by cache freshness) ---
  useEffect(() => {
    if (inFlight.current) return;
    inFlight.current = true;

    const softHero = hasFresh(KEY_BUILDINGS) && hasFresh(keyRatingsSummary(myBuildingId || "ALL"));
    const softKPIs = hasFresh(KEY_ISSUES) && hasFresh(keyCharges("PENDING", isTenantOrOwner ? `u:${uid}` : "all"));
    const softListBits = hasFresh(keyCharges("OVERDUE", isTenantOrOwner ? `u:${uid}` : "all"));

    if (!softHero) setLoadingHero(true);
    if (!softKPIs) setLoadingKPIs(true);
    if (!softListBits) setLoadingListBits(true);

    (async () => {
      try {
        // token #1
        let idToken = await getStableIdToken();
        if (!idToken) return;

        // buildings
        try {
          let bRes = await api.buildings.list({ idToken });
          if (!bRes?.ok && String(bRes?.error || "") === "not_authenticated") {
            idToken = await getStableIdToken();
            if (idToken) bRes = await api.buildings.list({ idToken });
          }
          if (bRes?.ok) {
            const list = Array.isArray(bRes.items) ? bRes.items : [];
            setBuildings(list);
            setCached(KEY_BUILDINGS, list, TTL_BUILDINGS);
          }
        } catch {}

        // issues (scoped: tenants/owners usually only see their own — filter client side for KPI)
        try {
          let iRes = await api.issues.list({ idToken });
          if (!iRes?.ok && String(iRes?.error || "") === "not_authenticated") {
            idToken = await getStableIdToken();
            if (idToken) iRes = await api.issues.list({ idToken });
          }
          if (iRes?.ok) {
            const list = Array.isArray(iRes.items) ? iRes.items : [];
            setIssues(list);
            setCached(KEY_ISSUES, list, TTL_ISSUES);
          }
        } catch {}

        // charges (pending)
        try {
          let cp = await api.charges.list({ idToken, status: "PENDING" });
          if (!cp?.ok && String(cp?.error || "") === "not_authenticated") {
            idToken = await getStableIdToken();
            if (idToken) cp = await api.charges.list({ idToken, status: "PENDING" });
          }
          if (cp?.ok) {
            const list = Array.isArray(cp.items) ? cp.items : [];
            setChargesPending(list);
            setCached(keyCharges("PENDING", isTenantOrOwner ? `u:${uid}` : "all"), list, TTL_CHARGES);
          }
        } catch {}

        // charges (overdue)
        try {
          if (isTenantOrOwner) {
            setChargesOverdue([]);
            setCached(keyCharges("OVERDUE", `u:${uid}`), [], TTL_CHARGES);
          } else {
            let co = await api.charges.list({ idToken, status: "OVERDUE" });
            if (!co?.ok && String(co?.error || "") === "not_authenticated") {
              idToken = await getStableIdToken();
              if (idToken) co = await api.charges.list({ idToken, status: "OVERDUE" });
            }
            if (co?.ok) {
              const list = Array.isArray(co.items) ? co.items : [];
              setChargesOverdue(list);
              setCached(keyCharges("OVERDUE", "all"), list, TTL_CHARGES);
            }
          }
        } catch {}

        // ratings summary (by building or visible)
        try {
          let rs = await api.ratings.summary({ idToken, building_id: myBuildingId || undefined });
          if (!rs?.ok && String(rs?.error || "") === "not_authenticated") {
            idToken = await getStableIdToken();
            if (idToken) rs = await api.ratings.summary({ idToken, building_id: myBuildingId || undefined });
          }
          if (rs?.ok) {
            const list = Array.isArray(rs.items) ? rs.items : [];
            setRatingsSummary(list);
            setCached(keyRatingsSummary(myBuildingId || "ALL"), list, TTL_RATINGS);
          }
        } catch {}
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg !== "not_authenticated") setError(msg);
      } finally {
        setLoadingHero(false);
        setLoadingKPIs(false);
        setLoadingListBits(false);
        inFlight.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, role, myBuildingId, isTenantOrOwner]);

  // --- derived data ---
  const buildingList = Array.isArray(buildings) ? buildings : [];
  const issuesList = Array.isArray(issues) ? issues : [];
  const pendingList = Array.isArray(chargesPending) ? chargesPending : [];
  const overdueList = Array.isArray(chargesOverdue) ? chargesOverdue : [];
  const ratingRows = Array.isArray(ratingsSummary) ? ratingsSummary : [];

  const openIssuesCount = (isTenantOrOwner
    ? issuesList.filter((it) => String(it.raised_by_user_id) === String(user?.ID))
    : issuesList
  ).filter((it) => !["RESOLVED", "CLOSED"].includes(String(it.status).toUpperCase())).length;

  let nextPayment = null;
  if (isTenantOrOwner) {
    const ch = pendingList
      .filter((c) => ["PENDING", "OVERDUE"].includes(String(c.status).toUpperCase()))
      .slice()
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    if (ch.length) nextPayment = ch[0];
  }
  const pendingTotal = isTenantOrOwner
    ? 0
    : pendingList.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const overdueTotal = isTenantOrOwner
    ? 0
    : overdueList.reduce((a, c) => a + (Number(c.amount) || 0), 0);

  let buildingRatingAvg = null;
  if (myBuildingId) {
    const hit = ratingRows.find((x) => String(x.building_id) === String(myBuildingId));
    buildingRatingAvg = hit ? Number(hit.avg) : null;
  } else if (ratingRows.length) {
    const sum = ratingRows.reduce((a, x) => a + Number(x.avg || 0), 0);
    buildingRatingAvg = sum / ratingRows.length;
  }

  // --- small entry skeleton to avoid layout shift on first mount ---
  const [showSkeleton, setShowSkeleton] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 240);
    return () => clearTimeout(t);
  }, []);

  /* ========= Skeleton ========= */
  if (showSkeleton) {
    return (
      <div className="space-y-6" dir={dir}>
        <Skeleton className="h-28 border border-[var(--border)]" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Skeleton className="h-24 border border-[var(--border)]" />
          <Skeleton className="h-24 border border-[var(--border)]" />
          <Skeleton className="h-24 border border-[var(--border)] hidden md:block" />
        </div>
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <Skeleton className="h-14 border border-[var(--border)]" />
          <Skeleton className="h-14 border border-[var(--border)]" />
          <Skeleton className="h-14 border border-[var(--border)]" />
          <Skeleton className="h-14 border border-[var(--border)] hidden sm:block" />
        </div>
      </div>
    );
  }

  /* ========= Content ========= */
  const greetName = user?.full_name ? `, ${user.full_name}` : "";
  const fmtDate = (d) => new Date(d).toLocaleDateString(locale);
  const rtl = dir === "rtl";

  return (
    <div className="space-y-7 md:space-y-8" dir={dir}>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 p-4 md:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-10 size-40 rounded-full opacity-25"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 26%, transparent), transparent 70%)",
          }}
        />
        <div className={`flex items-start justify-between ${rtl ? "flex-row-reverse" : ""}`}>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold">
              {L(locale, `Welcome${greetName} 👋`, `مرحبا${greetName} 👋`)}
            </h1>
            <div className={`mt-2 flex flex-wrap items-center gap-2 text-[var(--muted)] ${rtl ? "flex-row-reverse" : ""}`}>
              <RolePill>{role || L(locale, "UNKNOWN", "غير معروف")}</RolePill>
              {user?.username && (
                <span className="text-xs px-2 py-1 rounded-full border border-[var(--border)] bg-white/5">
                  {L(locale, "Username:", "اسم المستخدم:")}{" "}
                  <span className="text-[var(--text)]">{user.username}</span>
                </span>
              )}
              {user?.building_id && (
                <span className="text-xs px-2 py-1 rounded-full border border-[var(--border)] bg-white/5">
                  {L(locale, "Building:", "المبنى:")}{" "}
                  <span className="text-[var(--text)]">
                    {buildingList.find((b) => String(b.ID) === String(user.building_id))?.name ||
                      user.building_id}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Quick hero peek (rating or next payment) */}
          <div className="hidden sm:block text-right">
            <div className="text-[11px] text-[var(--muted)]">
              {isTenantOrOwner ? L(locale, "Next payment", "الدفعة القادمة") : L(locale, "Avg rating", "متوسط التقييم")}
            </div>
            <div className="text-xl font-semibold">
              {loadingHero ? "…" : isTenantOrOwner
                ? nextPayment
                  ? money(nextPayment.amount, nextPayment.currency || "USD", locale)
                  : "—"
                : buildingRatingAvg != null
                ? `${buildingRatingAvg.toFixed(2)} / 5`
                : "—"}
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          title={L(locale, "Buildings", "المباني")}
          value={loadingHero ? "…" : (buildingList.length || 0)}
          sub={
            user?.building_id
              ? L(locale, "Visible (scoped)", "مرئية (ضمن النطاق)")
              : L(locale, "Visible buildings", "المباني المرئية")
          }
          icon={IconBuilding}
        />
        <StatCard
          title={L(locale, "Open issues", "البلاغات المفتوحة")}
          value={loadingKPIs ? "…" : openIssuesCount}
          sub={L(locale, "Excludes Resolved/Closed", "باستثناء المُغلقة/المحلولة")}
          icon={IconTicket}
        />
        <StatCard
          title={L(locale, "Payments due", "المدفوعات المستحقة")}
          value={
            isTenantOrOwner
              ? "—"
              : (loadingKPIs || loadingListBits)
                ? "…"
                : money(pendingTotal + overdueTotal, "USD", locale)
          }
          sub={
            isTenantOrOwner
              ? L(locale, "Personal view", "عرض شخصي")
              : (loadingKPIs || loadingListBits)
                ? "…"
                : `${L(locale, "Pending", "قيد الانتظار")} ${money(pendingTotal, "USD", locale)} · ${L(
                    locale,
                    "Overdue",
                    "متأخرة"
                  )} ${money(overdueTotal, "USD", locale)}`
          }
          icon={IconMoney}
        />
      </section>

      {/* Quick links */}
      <section className="space-y-3">
        <SectionHeader
          title={L(locale, "Quick links", "روابط سريعة")}
          dir={dir}
          action={
            <Link
              to={allowed?.[0]?.path || "/"}
              className="text-[12px] px-2 py-1 rounded-lg border border-[var(--border)] hover:bg-black/5"
            >
              {L(locale, "Open first", "افتح الأول")}
            </Link>
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {allowed.map((item) => (
            <QuickTile
              key={item.key}
              to={item.path}
              icon={item.icon}
              rtl={rtl}
              label={locale === "ar" ? item.label_ar || item.label : item.label}
              hint={locale === "ar" ? "افتح" : "Open"}
            />
          ))}
        </div>
      </section>

      {/* Role-specific panel */}
      {isAdmin || isMgmt || isStaff ? (
        <section className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <IconBuilding className="w-4 h-4 text-[var(--muted)]" />
              <div className="text-sm opacity-70">{L(locale, "Manage buildings", "إدارة المباني")}</div>
            </div>
            <div className="text-xs opacity-80">
              {L(
                locale,
                "Add or update buildings, blocks and units.",
                "أضف أو حدّث المباني والكتل والوحدات."
              )}
            </div>
            <div className="mt-3">
              <Link to="/buildings" className="text-sm underline opacity-90 hover:opacity-100">
                {L(locale, "Go to Buildings", "اذهب إلى المباني")}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <IconTicket className="w-4 h-4 text-[var(--muted)]" />
              <div className="text-sm opacity-70">{L(locale, "Triage issues", "فرز البلاغات")}</div>
            </div>
            <div className="text-xs opacity-80">
              {L(locale, "Track and resolve tenant issues.", "تتبع وحل مشكلات السكان.")}
            </div>
            <div className="mt-3">
              <Link to="/issues" className="text-sm underline opacity-90 hover:opacity-100">
                {L(locale, "Go to Issues", "اذهب إلى البلاغات")}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <IconMoney className="w-4 h-4 text-[var(--muted)]" />
              <div className="text-sm opacity-70">{L(locale, "Payments & charges", "المدفوعات والرسوم")}</div>
            </div>
            <div className="text-xs opacity-80">
              {L(locale, "Create charges and record payments.", "أنشئ الرسوم وسجّل المدفوعات.")}
            </div>
            <div className="mt-3">
              <Link to="/payments" className="text-sm underline opacity-90 hover:opacity-100">
                {L(locale, "Go to Payments", "اذهب إلى المدفوعات")}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-4 md:col-span-3">
            <div className="flex items-center gap-2 mb-2">
              <IconStar className="w-4 h-4 text-[var(--muted)]" />
              <div className="text-sm opacity-70">{L(locale, "Building rating", "تقييم المبنى")}</div>
            </div>
            <div className="text-2xl font-semibold">
              {loadingHero ? "…" : (buildingRatingAvg != null ? `${buildingRatingAvg.toFixed(2)} / 5` : "—")}
            </div>
            <div className="text-xs opacity-70 mt-1">
              {user?.building_id
                ? L(locale, "Average of ratings for your building.", "متوسط التقييمات لمبناك.")
                : L(locale, "Average of ratings across visible buildings.", "متوسط التقييمات عبر المباني المرئية.")}
            </div>
          </div>
        </section>
      ) : (
        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <div className="text-sm opacity-70 mb-1">
              {L(locale, "Next payment", "الدفعة القادمة")}
            </div>
            <div className="text-2xl font-semibold">
              {loadingHero ? "…" : (nextPayment ? money(nextPayment.amount, nextPayment.currency || "USD", locale) : "—")}
            </div>
            <div className="text-xs opacity-70 mt-2">
              {nextPayment
                ? L(
                    locale,
                    `Due ${fmtDate(nextPayment.due_date)} · ${nextPayment.title || "Charge"}`,
                    `مستحق في ${fmtDate(nextPayment.due_date)} · ${nextPayment.title || "رسوم"}`
                  )
                : L(locale, "No upcoming unpaid charges", "لا توجد رسوم غير مدفوعة قادمة")}
            </div>
            <div className="mt-3">
              <Link to="/payments" className="text-sm underline opacity-90 hover:opacity-100">
                {L(locale, "View payments", "عرض المدفوعات")}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-4">
            <div className="text-sm opacity-70 mb-1">
              {L(locale, "Report an issue", "الإبلاغ عن مشكلة")}
            </div>
            <div className="text-xs opacity-80">
              {L(
                locale,
                "Having a problem (plumbing, electrical, etc.)? Open a ticket so management can help.",
                "هل لديك مشكلة (سباكة، كهرباء، إلخ)؟ افتح تذكرة ليتمكن فريق الإدارة من مساعدتك."
              )}
            </div>
            <div className="mt-2 text-sm opacity-80">
              {L(locale, "Open issues:", "البلاغات المفتوحة:")} {loadingKPIs ? "…" : openIssuesCount}
            </div>
            <div className="mt-3">
              <Link to="/issues" className="text-sm underline opacity-90 hover:opacity-100">
                {L(locale, "Go to Issues", "اذهب إلى البلاغات")}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-4 md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <IconStar className="w-4 h-4 text-[var(--muted)]" />
              <div className="text-sm opacity-70">{L(locale, "Building rating", "تقييم المبنى")}</div>
            </div>
            <div className="text-2xl font-semibold">
              {loadingHero ? "…" : (buildingRatingAvg != null ? `${buildingRatingAvg.toFixed(2)} / 5` : "—")}
            </div>
            <div className="text-xs opacity-70 mt-1">
              {L(locale, "Average rating for your building.", "متوسط التقييم لمبناك.")}
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="card p-3 text-sm text-red-300 border border-[var(--border)] rounded-xl">
          {error}
        </div>
      )}
    </div>
  );
}
