// src/pages/CashDrawer.jsx — FULL REPLACEMENT (i18n-ready, aligned with Payments UI)
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  startTransition,
  useRef,
} from "react";
import { useAuth } from "../providers/AuthProvider";
import { useI18n } from "../providers/I18nProvider";
import { getStableIdToken } from "../lib/token";
import { api } from "../api"; // buildings list
import {
  fetchCashDrawer,
  fetchCashDrawerFromSheet,
  fetchDrawerFromLedgerPeek,
  fetchCashLedger,
  collectCash,
  spendCash,
  adjustCash,
} from "../api/cash";

/* ================= utilities ================ */
const money = (n, cur = "USD") =>
  (Number(n) || 0).toLocaleString(undefined, {
    style: "currency",
    currency: cur,
  });
const dateFmt = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString();
};

// ---- robust date->time + consistent DESC sort by entry_date (newest first)
function toTime(v) {
  if (!v) return 0;
  const d = new Date(v);
  if (!isNaN(d)) return d.getTime();
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getTime();
  return 0;
}
function sortLedgerDescByDate(list) {
  return [...(list || [])].sort((a, b) => {
    const ta = toTime(a.entry_date);
    const tb = toTime(b.entry_date);
    if (tb !== ta) return tb - ta; // newer first
    if (b.ID && a.ID && b.ID !== a.ID) return String(b.ID).localeCompare(String(a.ID));
    return 0;
  });
}

/* -------- small UI helpers (same vibe as Payments) -------- */
function Badge({ children, tone = "default", className = "" }) {
  const tones = {
    default: { bg: "rgba(255,255,255,.05)", fg: "var(--muted)" },
    green: { bg: "rgba(34,197,94,.12)", fg: "#7dd3a7" },
    red: { bg: "rgba(239,68,68,.12)", fg: "#f39aa0" },
    amber: { bg: "rgba(245,158,11,.12)", fg: "#f5c16b" },
    blue: { bg: "rgba(59,130,246,.12)", fg: "#9ec5ff" },
    gray: { bg: "rgba(255,255,255,.05)", fg: "var(--muted)" },
  };
  const t = tones[tone] || tones.default;
  return (
    <span
      className={`px-2 py-[2px] rounded-full text-[11px] border ${className}`}
      style={{ background: t.bg, color: t.fg, borderColor: "var(--border)" }}
    >
      {children}
    </span>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-[var(--muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

function Section({ title, right, children }) {
  return (
    <div className="card border border-[var(--border)] rounded-2xl p-4 md:p-5 shadow-sm bg-white">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-base md:text-lg font-semibold">{title}</h3>
        {right}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/* ---------- compact toolbar + popup filters ---------- */
function Toolbar({
  buildingId,
  buildings,
  onChangeBuilding,
  onOpenFilters,
  activeCount,
  t,
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Building select (shows when many buildings or no fixed id) */}
      {Array.isArray(buildings) && buildings.length > 0 && (
        <select
          value={String(buildingId || "")}
          onChange={(e) => onChangeBuilding(e.target.value)}
          className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
          aria-label={t("cash.aria.selectBuilding")}
        >
          {buildings.map((b) => (
            <option key={b.ID} value={b.ID}>
              {b.name || b.ID}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={onOpenFilters}
        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5 relative"
        aria-label={t("cash.filters.open")}
      >
        {t("cash.filters.title")}
        {activeCount > 0 && (
          <span className="ml-2 inline-flex items-center justify-center text-[11px] rounded-full px-2 py-[2px] bg-[var(--accent)] text-white">
            {activeCount}
          </span>
        )}
      </button>
    </div>
  );
}

function FilterPopup({
  open,
  onClose,
  onApply,
  initial, // { date_from, date_to, limit }
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial, open]);

  // lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const hasScrollbar =
      window.innerWidth > document.documentElement.clientWidth;
    if (hasScrollbar) {
      const sw = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${sw}px`;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  if (!open) return null;
  const update = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  function applyPreset(preset) {
    const now = new Date(); // current local time
    if (preset === "THIS_MONTH") {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const from = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      const lastDayThisMonth = new Date(Date.UTC(y, m + 1, 0))
        .toISOString()
        .slice(0, 10);
      update("date_from", from);
      update("date_to", lastDayThisMonth); // inclusive in UI
    } else if (preset === "LAST_7") {
      const to = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      )
        .toISOString()
        .slice(0, 10);
      const from = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)
      )
        .toISOString()
        .slice(0, 10);
      update("date_from", from);
      update("date_to", to); // inclusive in UI
    } else if (preset === "ALL") {
      update("date_from", "");
      update("date_to", "");
    }
  }

  return (
    <div className="fixed inset-0 h-[100dvh] z-[60] flex items-end md:items-center justify-center overscroll-contain">
      <div
        className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-[96vw] md:w-[640px] max-h-[90vh] overflow-auto card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-semibold">{t("cash.filters.title")}</div>
            <div className="text-xs text-[var(--muted)]">
              {t("cash.filters.help")}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-white/5"
            aria-label={t("close")}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("cash.filters.from")}
            </label>
            <input
              type="date"
              value={draft.date_from || ""}
              onChange={(e) => update("date_from", e.target.value)}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("cash.filters.to")}
            </label>
            <input
              type="date"
              value={draft.date_to || ""}
              onChange={(e) => update("date_to", e.target.value)}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("cash.filters.pageSize")}
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={draft.limit ?? 50}
              onChange={(e) => update("limit", Number(e.target.value || 50))}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => applyPreset("THIS_MONTH")}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            {t("cash.filters.thisMonth")}
          </button>
          <button
            onClick={() => applyPreset("LAST_7")}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            {t("cash.filters.last7")}
          </button>
          <button
            onClick={() => applyPreset("ALL")}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            {t("cash.filters.allTime")}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => onApply(draft)}
            className="rounded-lg px-3 py-2 text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-600)]"
          >
            {t("cash.filters.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================== PAGE =============================== */
export default function CashDrawer() {
  const { user, loading: authLoading } = useAuth();
  const { t, dir } = useI18n();

  // ==== Resolve building (like Payments) ====
  const [buildings, setBuildings] = useState([]);

  const [buildingId, setBuildingId] = useState(
    user?.building_id || localStorage.getItem("cash.selectedBuilding") || ""
  );

  useEffect(() => {
    if (user?.building_id) {
      setBuildingId(user.building_id);
      localStorage.setItem("cash.selectedBuilding", String(user.building_id));
      return;
    }
    (async () => {
      if (authLoading) return;
      try {
        const idToken = await getStableIdToken();
        if (!idToken) return;
        const res = await api.buildings.list({ idToken });
        const list = Array.isArray(res?.items) ? res.items : [];
        setBuildings(list);
        const saved = localStorage.getItem("cash.selectedBuilding");
        if (saved && list.some((b) => String(b.ID) === String(saved))) {
          setBuildingId(saved);
        } else if (!user?.building_id && list.length === 1) {
          setBuildingId(list[0].ID);
          localStorage.setItem("cash.selectedBuilding", String(list[0].ID));
        }
      } catch {}
    })();
  }, [user, authLoading]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // action-level busy state so buttons can show "Adjusting…", "Collecting…", etc.
  const [action, setAction] = useState(""); // "adjust" | "collect" | "spend" | "export" | ""
  const isActing = !!action;
  // Drawer meta + ledger
  const [drawer, setDrawer] = useState(null); // {balance, currency, ...}
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);

  // Filters / page
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [limit, setLimit] = useState(50);

  // Popup
  const [showFilters, setShowFilters] = useState(false);

  // Forms
  const [collect, setCollect] = useState({
    amount: "",
    entry_date: "",
    note: "",
  });
  const [spend, setSpend] = useState({
    amount: "",
    entry_date: "",
    category: "MGMT_EXPENSE",
    note: "",
  });
  const [adjust, setAdjust] = useState({
    amount: "",
    entry_date: "",
    note: "",
  });

  const canQuery = !authLoading && !!buildingId;

  const loadDrawer = useCallback(async () => {
    if (!canQuery) return;
    const idToken = await getStableIdToken();
    if (!idToken) return;

    // 1) sheet
    try {
      const d = await fetchCashDrawerFromSheet({
        idToken,
        building_id: buildingId,
      });
      if (d && typeof d.balance !== "undefined") {
        setDrawer(d);
        return;
      }
    } catch {}

    // 2) ledger peek
    try {
      const d2 = await fetchDrawerFromLedgerPeek({
        idToken,
        building_id: buildingId,
      });
      if (d2) {
        setDrawer(d2);
        return;
      }
    } catch {}

    // 3) legacy drawer endpoint
    try {
      const d3 = await fetchCashDrawer({ idToken, building_id: buildingId });
      if (d3) {
        setDrawer(d3);
        return;
      }
    } catch {}

    setDrawer(null);
  }, [buildingId, canQuery]);

  // make date_to exclusive (API expects an exclusive upper bound)
  function addDaysISO(dateStr, days) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
    return dt.toISOString().slice(0, 10);
  }

  // === flicker-safe: stable callback + functional state updates + stale-response guard
  const fetchSeq = useRef(0);
  const loadLedger = useCallback(
    async (reset = true) => {
      if (!canQuery) return;
      const idToken = await getStableIdToken();
      if (!idToken) return;
      const mySeq = ++fetchSeq.current; // bump sequence for this request

      try {
        setLoading(true);
        setError("");

        // IMPORTANT: make "to" exclusive so the selected end-date is included
        const date_to_exclusive = dateTo ? addDaysISO(dateTo, 1) : "";

        const res = await fetchCashLedger({
          idToken,
          building_id: buildingId,
          date_from: dateFrom,
          date_to: date_to_exclusive,
          limit,
          cursor: reset ? "" : (typeof nextCursor === "string" ? nextCursor : ""),
        });

        // ignore if a newer request started after this one
        if (mySeq !== fetchSeq.current) return;

        setItems((prev) => {
          const merged = reset ? (res.items || []) : [...prev, ...(res.items || [])];
          return sortLedgerDescByDate(merged);
        });
        setNextCursor(res.next_cursor ?? null);
      } catch (e) {
        // ignore stale errors too
        if (mySeq !== fetchSeq.current) return;
        setError(e.message || t("cash.errors.loadFailed"));
      } finally {
        if (mySeq === fetchSeq.current) setLoading(false);
      }
    },
    // NOTE: do NOT depend on `items` or `nextCursor` here—functional set handles it to prevent re-fetch loops
    [buildingId, canQuery, dateFrom, dateTo, limit, nextCursor, t]
  );

  // initial load / when building changes -> only load the drawer meta
  useEffect(() => {
    if (!canQuery) return;
    loadDrawer();
  }, [canQuery, buildingId, loadDrawer]);

  // reload ledger when filters/building change (do not include loadLedger in deps to keep it stable)
  useEffect(() => {
    if (!canQuery) return;
    loadLedger(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canQuery, buildingId, dateFrom, dateTo, limit]);

  // Helper wrapper for actions
  async function handle(fn, payload, onDone, actionName = "") {
    if (!canQuery) return;
    const idToken = await getStableIdToken();
    if (!idToken) return;
    try {
      setError("");
      setAction(actionName);
      await fn({ idToken, building_id: buildingId, ...payload });
      await Promise.all([loadDrawer(), loadLedger(true)]);
      onDone && onDone();
    } catch (e) {
      setError(e.message || t("cash.errors.actionFailed"));
    } finally {
      setAction("");
    }
  }

  // Export ALL rows under current filters to CSV (all pages)
  async function exportCSVAll() {
    if (!canQuery) return;
    const idToken = await getStableIdToken();
    if (!idToken) return;
    try {
      setError("");
      setAction("export");

      const date_to_exclusive = dateTo ? addDaysISO(dateTo, 1) : "";
      let cursor = "";
      let all = [];

      do {
        const res = await fetchCashLedger({
          idToken,
          building_id: buildingId,
          date_from: dateFrom,
          date_to: date_to_exclusive,
          limit: 200, // bigger pages for export speed
          cursor,
        });
        all = all.concat(res.items || []);
        cursor = res.next_cursor ?? "";
      } while (cursor);

      const rows = sortLedgerDescByDate(all);

      const header = [
        "ID",
        "entry_date",
        "entry_type",
        "category",
        "note",
        "amount",
        "balance_after",
        "currency",
        "building_id",
      ];
      const esc = (v) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv =
        header.join(",") +
        "\n" +
        rows
          .map((r) =>
            [
              r.ID,
              r.entry_date,
              r.entry_type,
              r.category ?? "",
              r.note ?? "",
              r.amount,
              r.balance_after,
              drawer?.currency || "USD",
              buildingId,
            ]
              .map(esc)
              .join(",")
          )
          .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `cash-ledger-${buildingId || "all"}-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || t("cash.errors.actionFailed"));
    } finally {
      setAction("");
    }
  }

  const pageBalance = useMemo(() => {
    if (!items.length) return null;
    const last = items[items.length - 1];
    return last.balance_after ?? null;
  }, [items]);
  const currentBalance = useMemo(() => {
    if (drawer && typeof drawer.balance === "number") return drawer.balance;
    if (pageBalance != null) return pageBalance;
    return null;
  }, [drawer, pageBalance]);

  // building picker visibility
  const hasFixedBuilding = !!user?.building_id;
  const showPicker = !hasFixedBuilding && (buildings?.length || 0) > 1;

  // active filters count
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (dateFrom) c++;
    if (dateTo) c++;
    if (limit !== 50) c++;
    return c;
  }, [dateFrom, dateTo, limit]);

  const filterShape = useMemo(
    () => ({ date_from: dateFrom, date_to: dateTo, limit }),
    [dateFrom, dateTo, limit]
  );

  function applyFilters(next) {
    startTransition(() => {
      setDateFrom(next.date_from ?? "");
      setDateTo(next.date_to ?? "");
      setLimit(Number(next.limit ?? 50));
      setShowFilters(false);
    });
  }

  /* ============================== RENDER ============================== */
  return (
    <div className="space-y-4" dir={dir}>
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-[var(--muted)]">
            {t("cash.header.finance")}
          </div>
          <h1 className="text-2xl font-semibold">{t("cash.title")}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Building chip or selector */}
          {showPicker ? (
            <Toolbar
              buildingId={buildingId}
              buildings={buildings}
              onChangeBuilding={(v) => {
                setBuildingId(v);
                localStorage.setItem("cash.selectedBuilding", String(v));
              }}
              onOpenFilters={() => setShowFilters(true)}
              activeCount={activeFiltersCount}
              t={t}
            />
          ) : (
            <>
              <Badge tone="green" className="rounded-full">
                {t("cash.labels.buildingWith", { id: buildingId || "—" })}
              </Badge>
              <button
                onClick={() => setShowFilters(true)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
              >
                {t("cash.filters.title")}
                {activeFiltersCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center text-[11px] rounded-full px-2 py-[2px] bg-[var(--accent)] text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-sm text-[var(--muted)]">
            {t("cash.summaries.current")}
          </div>
          <div className="text-xl font-semibold mt-1">
            {currentBalance != null
              ? money(currentBalance, drawer?.currency || "USD")
              : "—"}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-[var(--muted)]">
            {t("cash.summaries.pageBalance")}
          </div>
          <div className="text-xl font-semibold mt-1">
            {pageBalance !== null
              ? money(pageBalance, drawer?.currency || "USD")
              : "—"}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-[var(--muted)]">
            {t("cash.summaries.rows")}
          </div>
          <div className="text-xl font-semibold mt-1">
            {loading ? "…" : items.length}
            {nextCursor ? " +" : ""}
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="grid md:grid-cols-3 gap-3">
        {/* Adjust */}
        <Section title={t("cash.actions.adjust.title")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("cash.actions.adjust.amountLabel")} hint={t("cash.actions.adjust.amountHint")}>
              <input
                type="number"
                step="0.01"
                value={adjust.amount}
                onChange={(e) =>
                  setAdjust((s) => ({ ...s, amount: e.target.value }))
                }
                className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
              />
            </Field>
            <Field label={t("cash.actions.entryDate")}>
              <input
                type="date"
                value={adjust.entry_date}
                onChange={(e) =>
                  setAdjust((s) => ({ ...s, entry_date: e.target.value }))
                }
                className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
              />
            </Field>
            <div className="col-span-2">
              <Field label={t("cash.actions.noteOpt")}>
                <input
                  value={adjust.note}
                  onChange={(e) =>
                    setAdjust((s) => ({ ...s, note: e.target.value }))
                  }
                  className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
                />
              </Field>
            </div>
          </div>
          <button
            disabled={authLoading || !buildingId || isActing || !adjust.amount}
            onClick={() =>
              handle(
                adjustCash,
                adjust,
                () => setAdjust({ amount: "", entry_date: "", note: "" }),
                "adjust"
              )
            }
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-50"
          >
            {action === "adjust" ? t("cash.actions.adjusting") : t("cash.actions.adjust.cta")}
          </button>
        </Section>

        {/* Collect */}
        <Section title={t("cash.actions.collect.title")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("cash.actions.amount")}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={collect.amount}
                onChange={(e) =>
                  setCollect((s) => ({ ...s, amount: e.target.value }))
                }
                className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
              />
            </Field>
            <Field label={t("cash.actions.entryDate")}>
              <input
                type="date"
                value={collect.entry_date}
                onChange={(e) =>
                  setCollect((s) => ({ ...s, entry_date: e.target.value }))
                }
                className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
              />
            </Field>
            <div className="col-span-2">
              <Field label={t("cash.actions.noteOpt")}>
                <input
                  value={collect.note}
                  onChange={(e) =>
                    setCollect((s) => ({ ...s, note: e.target.value }))
                  }
                  className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
                />
              </Field>
            </div>
          </div>
          <button
            disabled={authLoading || !buildingId || isActing || !collect.amount}
            onClick={() =>
              handle(
                collectCash,
                collect,
                () => setCollect({ amount: "", entry_date: "", note: "" }),
                "collect"
              )
            }
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-50"
          >
            {action === "collect" ? t("cash.actions.collecting") : t("cash.actions.collect.cta")}
          </button>
        </Section>

        {/* Spend */}
        <Section title={t("cash.actions.spend.title")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("cash.actions.amount")}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={spend.amount}
                onChange={(e) =>
                  setSpend((s) => ({ ...s, amount: e.target.value }))
                }
                className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
              />
            </Field>
            <Field label={t("cash.actions.entryDate")}>
              <input
                type="date"
                value={spend.entry_date}
                onChange={(e) =>
                  setSpend((s) => ({ ...s, entry_date: e.target.value }))
                }
                className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
              />
            </Field>
            <Field label={t("cash.actions.category")}>
              <input
                value={spend.category}
                onChange={(e) =>
                  setSpend((s) => ({ ...s, category: e.target.value }))
                }
                className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
              />
            </Field>
            <div className="col-span-2">
              <Field label={t("cash.actions.noteOpt")}>
                <input
                  value={spend.note}
                  onChange={(e) =>
                    setSpend((s) => ({ ...s, note: e.target.value }))
                  }
                  className="rounded-lg border border-[var(--border)] px-3 py-2 bg-transparent"
                />
                </Field>
            </div>
          </div>
          <button
            disabled={authLoading || !buildingId || isActing || !spend.amount}
            onClick={() =>
              handle(
                spendCash,
                spend,
                () =>
                  setSpend({
                    amount: "",
                    entry_date: "",
                    category: "MGMT_EXPENSE",
                    note: "",
                  }),
                "spend"
              )
            }
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-50"
          >
            {action === "spend" ? t("cash.actions.spending") : t("cash.actions.spend.cta")}
          </button>
        </Section>
      </div>

      {/* active filter chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          {dateFrom && <Badge>{t("cash.filters.fromWith", { d: dateFmt(dateFrom) })}</Badge>}
          {dateTo && <Badge>{t("cash.filters.toWith", { d: dateFmt(dateTo) })}</Badge>}
          {limit !== 50 && <Badge>{t("cash.filters.pageWith", { n: limit })}</Badge>}
          <button
            onClick={() =>
              applyFilters({ date_from: "", date_to: "", limit: 50 })
            }
            className="ml-1 text-xs text-[var(--muted)] underline hover:no-underline"
          >
            {t("cash.filters.clear")}
          </button>
        </div>
      )}

      {/* Ledger */}
      <Section
        title={t("cash.ledger.title")}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(true)}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
            >
              {t("cash.ledger.refine")}
            </button>
            <button
              disabled={authLoading || !buildingId || loading}
              onClick={() => loadLedger(true)}
              className="rounded-lg border border-[var(--border)] px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-50 text-sm"
            >
              {t("cash.ledger.apply")}
            </button>
            {/* Export CSV button (all rows under current filters) */}
            <button
              disabled={authLoading || !buildingId || isActing}
              onClick={exportCSVAll}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
              aria-label={t("cash.ledger.export") || "Export CSV"}
              title={t("cash.ledger.export") || "Export CSV"}
            >
              {action === "export"
                ? t("cash.ledger.exporting") || "Exporting…"
                : t("cash.ledger.export") || "Export CSV"}
            </button>
          </div>
        }
      >
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 p-3 mb-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="card p-0 overflow-hidden">
            <div className="hidden md:block">
              <div className="h-10 bg-white/5" />
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 border-t border-[var(--border)] animate-pulse"
                />
              ))}
            </div>
            <div className="md:hidden">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 border-b border-[var(--border)] animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto border border-[var(--border)] rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 sticky top-0 z-[1]">
                  <tr className="text-left">
                    <th className="px-3 py-2">{t("cash.ledger.date")}</th>
                    <th className="px-3 py-2">{t("cash.ledger.type")}</th>
                    <th className="px-3 py-2">{t("cash.ledger.category")}</th>
                    <th className="px-3 py-2">{t("cash.ledger.note")}</th>
                    <th className="px-3 py-2 text-right">{t("cash.ledger.amount")}</th>
                    <th className="px-3 py-2 text-right">{t("cash.ledger.balanceAfter")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.ID} className="border-t border-[var(--border)] align-top">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {dateFmt(r.entry_date)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          tone={
                            r.entry_type === "TENANT_CASH_IN"
                              ? "green"
                              : r.entry_type === "MGMT_CASH_OUT"
                              ? "red"
                              : r.entry_type === "ADJUSTMENT"
                              ? "amber"
                              : "gray"
                          }
                        >
                          {t(`cash.entryType.${r.entry_type}`, r.entry_type)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{r.category || "—"}</td>
                      <td className="px-3 py-2 break-words max-w-[28rem]">
                        {r.note || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {money(r.amount, drawer?.currency || "USD")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {money(r.balance_after, drawer?.currency || "USD")}
                      </td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-[var(--muted)]"
                        colSpan={6}
                      >
                        {t("cash.ledger.empty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {items.length === 0 ? (
                <div className="rounded-lg border border-[var(--border)] p-4 text-center text-[var(--muted)]">
                  {t("cash.ledger.empty")}
                </div>
              ) : (
                items.map((r) => (
                  <div
                    key={r.ID}
                    className="rounded-lg border border-[var(--border)] p-3 bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">
                          {dateFmt(r.entry_date)}
                        </div>
                        <div className="mt-1">
                          <Badge
                            tone={
                              r.entry_type === "TENANT_CASH_IN"
                                ? "green"
                                : r.entry_type === "MGMT_CASH_OUT"
                                ? "red"
                                : r.entry_type === "ADJUSTMENT"
                                ? "amber"
                                : "gray"
                            }
                          >
                            {t(`cash.entryType.${r.entry_type}`, r.entry_type)}
                          </Badge>
                          {r.category && <Badge className="ml-1">{r.category}</Badge>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {money(r.amount, drawer?.currency || "USD")}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {t("cash.ledger.balanceShort", {
                            v: money(r.balance_after, drawer?.currency || "USD"),
                          })}
                        </div>
                      </div>
                    </div>

                    {r.note && <div className="text-sm mt-2">{r.note}</div>}
                  </div>
                ))
              )}

              {nextCursor && (
                <button
                  disabled={authLoading || !buildingId || loading}
                  onClick={() => loadLedger(false)}
                  className="w-full rounded-lg border border-[var(--border)] px-4 py-2 bg-white hover:bg-white/50 disabled:opacity-50"
                >
                  {t("cash.ledger.loadMore")}
                </button>
              )}
            </div>

            {/* Desktop load more */}
            {nextCursor && (
              <div className="mt-3 hidden md:block">
                <button
                  disabled={authLoading || !buildingId || loading}
                  onClick={() => loadLedger(false)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 bg-white hover:bg-white/50 disabled:opacity-50"
                >
                  {t("cash.ledger.loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </Section>

      {/* Filters popup */}
      <FilterPopup
        open={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
        initial={filterShape}
      />
    </div>
  ); 
}
