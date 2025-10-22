// src/pages/Issues.jsx
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../providers/AuthProvider";
import { getStableIdToken } from "../lib/token";
import { getCached, setCached, keyOf } from "../lib/warmCache";
import { api } from "../api";
import { ROLES } from "../constants/roles";
import { useI18n } from "../providers/I18nProvider";

/* ---------------- freshness helper ---------------- */
function hasFresh(key) {
  const v = getCached(key); // TTL handled inside warmCache
  return v !== undefined && v !== null;
}

/* ---------------- enums ---------------- */
const CATEGORIES = [
  "PLUMBING",
  "ELECTRICAL",
  "LIFT",
  "SECURITY",
  "NOISE",
  "CLEANING",
  "OTHER",
];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"];

/* ---------------- tiny helpers ---------------- */
function Badge({ children, tone = "default" }) {
  const tones = {
    default: { bg: "rgba(255,255,255,.05)", fg: "var(--muted)" },
    green: { bg: "rgba(34,197,94,.12)", fg: "#7dd3a7" },
    amber: { bg: "rgba(245,158,11,.12)", fg: "#f5c16b" },
    red: { bg: "rgba(239,68,68,.12)", fg: "#f39aa0" },
    blue: { bg: "rgba(59,130,246,.12)", fg: "#9ec5ff" },
  };
  const t = tones[tone] || tones.default;
  return (
    <span
      className="px-2 py-[2px] rounded-full text-[11px] border"
      style={{ background: t.bg, color: t.fg, borderColor: "var(--border)" }}
    >
      {children}
    </span>
  );
}
const toneForPriority = (p) =>
  p === "URGENT"
    ? "red"
    : p === "HIGH"
    ? "amber"
    : p === "MEDIUM"
    ? "blue"
    : "default";
const toneForStatus = (s) =>
  s === "OPEN"
    ? "red"
    : s === "IN_PROGRESS"
    ? "amber"
    : s === "ON_HOLD"
    ? "blue"
    : "green";

/* ---------------- slim skeleton ---------------- */
function RowSkeleton() {
  const bar = "rounded bg-[color-mix(in_oklab,var(--text)_12%,transparent)]";
  return (
    <div className="px-3 py-3">
      <div className={`h-4 w-[50%] ${bar} mb-2`} />
      <div className={`h-3 w-[35%] ${bar}`} />
    </div>
  );
}
/* ---------------- payments-style skeleton ---------------- */
function IssuesSkeleton({ rows = 6, insideCard = false }) {
  const bar = "bg-[color-mix(in_oklab,var(--text)_12%,transparent)] rounded";
  const rowsEl = (
    <div className="divide-y divide-[var(--border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-3 py-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={`h-4 w-[45%] ${bar}`} />
                <div className={`h-4 w-14 ${bar} rounded-full`} />
                <div className={`h-4 w-16 ${bar} rounded-full`} />
                <div className={`h-4 w-20 ${bar} rounded-full`} />
              </div>
              <div className={`mt-2 h-3 w-[36%] ${bar}`} />
              <div className={`mt-2 h-3 w-[68%] ${bar}`} />
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <div className={`h-8 w-28 ${bar} rounded-lg`} />
              <div className={`h-8 w-20 ${bar} rounded-lg`} />
              <div className={`h-8 w-24 ${bar} rounded-lg`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  if (insideCard) return rowsEl; // use only rows when embedded
  // standalone version (rare)
  return (
    <div className="card p-0 overflow-x-hidden">
      <div className="h-[2px] w-full bg-[var(--accent)]/70 animate-pulse" />
      <div className="px-3 py-2 text-xs text-[var(--muted)] border-b border-[var(--border)]">
        <span className={`inline-block align-middle h-3 w-24 ${bar}`} />
      </div>
      {rowsEl}
    </div>
  );
}

/* ---------- toast confirm ---------- */
function ConfirmToast({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  danger,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 h-[100dvh] z-[60] flex items-end md:items-center justify-center overscroll-contain">
      <div
        className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-[92vw] md:w-[520px] card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4 mb-4 md:mb-0">
        <div className="text-base font-semibold">{title}</div>
        {message && (
          <div className="text-sm text-[var(--muted)] mt-1">{message}</div>
        )}
        <div className="mt-3 flex items-center gap-2 justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-3 py-2 text-sm text-white ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[var(--accent)] hover:bg-[var(--accent-600)]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- smooth collapsible ---------------- */
function Collapsible({ open, children, duration = 260 }) {
  const innerRef = useRef(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!innerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (open) setH(innerRef.current.scrollHeight);
    });
    ro.observe(innerRef.current);
    if (open) setH(innerRef.current.scrollHeight);
    return () => ro.disconnect();
  }, [open, children]);
  return (
    <div
      style={{
        maxHeight: open ? h : 0,
        opacity: open ? 1 : 0.9,
        overflow: "hidden",
        transition: `max-height ${duration}ms cubic-bezier(.22,.61,.36,1), opacity ${duration}ms ease`,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/* ---------------- compact search + trigger ---------------- */
function SearchBar({
  q,
  setQ,
  onOpenFilters,
  activeCount,
  refreshing,
  onRefresh,
  t,
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("issues.toolbar.search")}
          className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full md:w-[360px]"
        />
        <button
          onClick={onOpenFilters}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5 relative"
        >
          {t("issues.filters.title")}
          {activeCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center text-[11px] rounded-full px-2 py-[2px] bg-[var(--accent)] text-white">
              {activeCount}
            </span>
          )}
        </button>
        <button
          onClick={onRefresh}
          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
          disabled={refreshing}
        >
          {refreshing
            ? t("issues.toolbar.refreshing")
            : t("issues.toolbar.refresh")}
        </button>
      </div>
    </div>
  );
}

/* ---------------- filters popup ---------------- */
function FilterPopup({ open, onClose, onApply, initial, buildings, t }) {
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial, open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const hasScrollbar =
      window.innerWidth > document.documentElement.clientWidth;
    if (hasScrollbar) {
      const scrollBarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  if (!open) return null;
  const update = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="fixed inset-0 h-[100dvh] z-[60] flex items-end md:items-center justify-center overscroll-contain">
      <div
        className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-[96vw] md:w-[640px] max-h-[90vh] overflow-auto card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-semibold">
              {t("issues.filters.title")}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {t("issues.filters.refine")}
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

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("issues.toolbar.allBuildings")}
            </label>
            <select
              value={draft.building}
              onChange={(e) => update("building", e.target.value)}
            >
              <option value="ALL">{t("issues.toolbar.allBuildings")}</option>
              {(Array.isArray(buildings) ? buildings : []).map((b) => (
                <option key={b.ID} value={b.ID}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("issues.toolbar.allStatuses")}
            </label>
            <select
              value={draft.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="ALL">{t("issues.toolbar.allStatuses")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`issues.status.${s}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("issues.toolbar.allPriorities")}
            </label>
            <select
              value={draft.priority}
              onChange={(e) => update("priority", e.target.value)}
            >
              <option value="ALL">{t("issues.toolbar.allPriorities")}</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`issues.priority.${p}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("issues.toolbar.allCategories")}
            </label>
            <select
              value={draft.category}
              onChange={(e) => update("category", e.target.value)}
            >
              <option value="ALL">{t("issues.toolbar.allCategories")}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`issues.category.${c}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() =>
              onApply({
                ...initial,
                building: "ALL",
                status: "ALL",
                priority: "ALL",
                category: "ALL",
              })
            }
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            {t("issues.filters.clearAll")}
          </button>
          <div className="flex items-center gap-2">
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
              {t("issues.filters.apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- inline row ---------------- */
function IssueSummary({
  it,
  buildingName,
  canChangeStatus,
  onStatus,
  onEdit,
  onDelete,
  deleting,
  canDelete,
  t,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium truncate">{it.title || "—"}</div>
          <Badge tone={toneForStatus(it.status)}>
            {t(`issues.status.${it.status}`)}
          </Badge>
          <Badge tone={toneForPriority(it.priority)}>
            {t(`issues.priority.${it.priority}`)}
          </Badge>
          <Badge>{t(`issues.category.${it.category}`)}</Badge>
        </div>
        <div className="text-sm text-[var(--muted)] truncate">
          {buildingName} • {t("issues.unit")} {it.unit_code || "—"} •{" "}
          {new Date(it.created_at || Date.now()).toLocaleDateString()}
        </div>
        {it.description ? (
          <div className="text-sm opacity-80 mt-1 line-clamp-2 break-words">
            {it.description}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
        {canChangeStatus && (
          <div className="ui-select-wrap ui-inline">
            <select
              value={it.status}
              onChange={(e) => onStatus(it, e.target.value)}
              className="px-2 py-1 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`issues.status.${s}`)}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={() => onEdit(it)}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-white/5"
        >
          {t("issues.actions.edit")}
        </button>
        {canDelete && (
          <button
            onClick={() => onDelete(it)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-white/5 text-red-300 disabled:opacity-60"
            disabled={deleting}
          >
            {t("issues.actions.delete")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- inline editor ---------------- */
function InlineEditor({
  open,
  it,
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  t,
}) {
  return (
    <Collapsible open={open}>
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-black/[0.03] p-3 sm:p-3">
        <div className="flex flex-wrap items-center justify-end gap-2 mb-2">
          <button
            onClick={onSave}
            className="rounded-lg px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? t("saving") : t("save")}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 disabled:opacity-60"
            disabled={saving}
          >
            {t("cancel")}
          </button>
        </div>

        <div className="text-[15px] font-semibold">
          {draft.title || it.title || "—"}
        </div>
        <div className="text-sm text-[var(--muted)] mb-2">{it._meta}</div>
        {it.description && <div className="text-sm mb-2">{it.description}</div>}

        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <div className="ui-select-wrap">
            <label className="block text-sm text-[var(--muted)] mb-1">
              {t("issues.editor.categoryLabel")}
            </label>
            <select
              value={draft.category || it.category || CATEGORIES[0]}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`issues.category.${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-select-wrap">
            <label className="block text-sm text-[var(--muted)] mb-1">
              {t("issues.editor.priorityLabel")}
            </label>
            <select
              value={draft.priority || it.priority || "MEDIUM"}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`issues.priority.${p}`)}
                </option>
              ))}
            </select>
          </div>

          <label className="flex flex-col gap-1 md:col-span-1">
            <span className="text-sm text-[var(--muted)]">
              {t("issues.editor.titleLabel")}
            </span>
            <input
              value={draft.title ?? it.title ?? ""}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={t("issues.editor.titlePH")}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 md:col-span-3">
            <span className="text-sm text-[var(--muted)]">
              {t("issues.editor.descLabel")}
            </span>
            <textarea
              value={draft.description ?? it.description ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder={t("issues.editor.descPH")}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full min-h-[120px] resize-y"
              rows={6}
            />
          </label>
        </div>
        <div className="pt-1" />
      </div>
    </Collapsible>
  );
}

/* ---------------- page ---------------- */
export default function Issues() {
  const { t, dir } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const role = String(user?.role || "").toUpperCase();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // null => add, object => edit
  const canChangeStatus = [
    ROLES.ADMIN,
    ROLES.STAFF,
    ROLES.BUILDING_MGMT,
  ].includes(role);
  const canDelete = role === ROLES.ADMIN || role === ROLES.TENANT;
  const canAdd = true;

  // ---- TTLs ----
  const TTL_BUILDINGS = 120_000;
  const TTL_ISSUES = 120_000;

  // ---- filter state ----
  const [building, setBuilding] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [q, setQ] = useState("");

  // ---- cache keys ----
  const keyIssues = (bid) =>
    keyOf("issues/list", bid && bid !== "ALL" ? { building_id: bid } : {});

  // ---- seed from cache immediately ----
  const cachedBuildings = getCached("buildings/list");
  const cachedIssuesAll = getCached(keyIssues("ALL"));

  const [buildings, setBuildings] = useState(
    Array.isArray(cachedBuildings) ? cachedBuildings : []
  );
  const [items, setItems] = useState(
    Array.isArray(cachedIssuesAll) ? cachedIssuesAll : []
  );

  // UI state
  const [loading, setLoading] = useState(
    !(Array.isArray(cachedBuildings) && Array.isArray(cachedIssuesAll))
  );
  const [softLoading, setSoftLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [savingId, setSavingId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDel, setConfirmDel] = useState({ open: false, item: null });

  const inFlightRef = useRef(0);

  // ------------ loader (cache-first, soft/hard) ------------
  const loadAll = useCallback(
    async ({ hard = false } = {}) => {
      setError("");
      setSoftLoading(true);
      const ticket = ++inFlightRef.current;

      try {
        if (hard) setLoading(true);

        // token #1
        const idToken1 = await getStableIdToken();
        if (!idToken1) return;

        const needBuildings = !Array.isArray(getCached("buildings/list"));

        // parallel fetch
        let [bRes, iRes] = await Promise.all([
          needBuildings
            ? api.buildings.list({ idToken: idToken1 })
            : Promise.resolve({
                ok: true,
                items: getCached("buildings/list") || [],
              }),
          api.issues.list({
            idToken: idToken1,
            building_id: building !== "ALL" ? building : undefined,
          }),
        ]);

        // retry once on auth race
        if (!iRes?.ok && String(iRes?.error || "") === "not_authenticated") {
          const idToken2 = await getStableIdToken();
          if (idToken2) {
            iRes = await api.issues.list({
              idToken: idToken2,
              building_id: building !== "ALL" ? building : undefined,
            });
          }
        }

        if (bRes?.ok) {
          const bList = Array.isArray(bRes.items) ? bRes.items : [];
          setBuildings(bList);
          setCached("buildings/list", bList, TTL_BUILDINGS);
          if (building === "ALL" && bList.length === 1)
            setBuilding(bList[0].ID);
        }

        if (!iRes?.ok) throw new Error(iRes?.error || "issues_load_failed");
        const list = Array.isArray(iRes.items) ? iRes.items : [];
        setItems(list);
        setCached(keyIssues(building), list, TTL_ISSUES);
      } catch (e) {
        const msg = String(e?.message || e);
        // swallow not_authenticated (usually transient on reload)
        if (msg !== "not_authenticated") setError(msg);
      } finally {
        if (ticket === inFlightRef.current) {
          setSoftLoading(false);
          setRefreshing(false);
          if (hard) setLoading(false);
        }
      }
    },
    [building]
  );

  // Initial mount & when building changes
  useEffect(() => {
    if (authLoading || !user) return;
    const k = keyIssues(building);
    const seeded = getCached(k);
    const fresh = hasFresh(k);
    if (Array.isArray(seeded)) setItems(seeded);
    const needHard = !fresh && !(Array.isArray(seeded) && seeded.length > 0);
    loadAll({ hard: needHard });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, building]);

  // ------------- name lookup -------------
  const buildingNameOf = (id) =>
    (Array.isArray(buildings) ? buildings : []).find(
      (b) => String(b.ID) === String(id)
    )?.name || "—";

  // ------------- client filtering -------------
  const safeItems = Array.isArray(items) ? items : [];
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return safeItems.filter((it) => {
      if (status !== "ALL" && String(it.status) !== status) return false;
      if (priority !== "ALL" && String(it.priority) !== priority) return false;
      if (category !== "ALL" && String(it.category) !== category) return false;
      if (!needle) return true;
      const bName = buildingNameOf(it.building_id);
      const hay = `${it.title || ""} ${
        it.unit_code || ""
      } ${bName}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [safeItems, status, priority, category, q, buildings]);

  async function saveRow(it) {
    try {
      setSavingId(it.ID);
      const idToken = await getStableIdToken();
      if (!idToken) return;

      const d = drafts[it.ID] || {};
      const payload = {
        ...it,
        ...d,
        status: (d.status || it.status || "OPEN").toUpperCase(),
        priority: (d.priority || it.priority || "MEDIUM").toUpperCase(),
        category: (d.category || it.category || CATEGORIES[0]).toUpperCase(),
      };

      const res = await api.issues.save({ idToken, issue: payload });
      if (!res?.ok) throw new Error(res?.error || "save_failed");
      const saved = res.item;

      setItems((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const i = base.findIndex((x) => x.ID === saved.ID);
        if (i >= 0) {
          const next = [...base];
          next[i] = { ...base[i], ...saved };
          return next;
        }
        return [saved, ...base];
      });

      const k = keyIssues(building);
      const cached = getCached(k);
      const arr = Array.isArray(cached) ? cached : [];
      const nextCache = (() => {
        const i = arr.findIndex((x) => x.ID === saved.ID);
        if (i >= 0) {
          const n = [...arr];
          n[i] = { ...arr[i], ...saved };
          return n;
        }
        return [saved, ...arr];
      })();
      setCached(k, nextCache, TTL_ISSUES);

      setDrafts((prev) => {
        const n = { ...prev };
        delete n[it.ID];
        return n;
      });
      setOpenRowId("");
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSavingId("");
    }
  }

  async function saveFromModal(form, { isEdit }) {
    try {
      setSavingId(isEdit ? editing?.ID : "__modal__");
      const idToken = await getStableIdToken();
      if (!idToken) return;

      const payload = {
        ...(isEdit ? editing : {}),
        building_id: form.building_id,
        unit_code: form.unit_code || "",
        title: form.title || "",
        description: form.description || "",
        category: String(form.category || "PLUMBING").toUpperCase(),
        priority: String(form.priority || "MEDIUM").toUpperCase(),
        status: String(form.status || "OPEN").toUpperCase(),
        ...(isEdit ? {} : { ID: undefined }),
      };

      const res = await api.issues.save({ idToken, issue: payload });
      if (!res?.ok) throw new Error(res?.error || "save_failed");
      const saved = res.item;

      setItems((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        if (isEdit) {
          const i = base.findIndex((x) => x.ID === saved.ID);
          if (i >= 0) {
            const next = [...base];
            next[i] = { ...base[i], ...saved };
            return next;
          }
        }
        return [saved, ...base];
      });

      const k = keyIssues(building);
      const arr = Array.isArray(getCached(k)) ? getCached(k) : [];
      const nextCache = (() => {
        if (isEdit) {
          const i = arr.findIndex((x) => x.ID === saved.ID);
          if (i >= 0) {
            const n = [...arr];
            n[i] = { ...arr[i], ...saved };
            return n;
          }
        }
        return [saved, ...arr];
      })();
      setCached(k, nextCache, TTL_ISSUES);

      setEditing(null);
      setShowModal(false);
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSavingId("");
    }
  }

  async function setStatusOf(it, nextStatus) {
    if (!canChangeStatus) return;
    try {
      setBusyId(it.ID);
      const idToken = await getStableIdToken();
      if (!idToken) return;
      const res = await api.issues.save({
        idToken,
        issue: { ...it, status: String(nextStatus).toUpperCase() },
      });
      if (!res?.ok) throw new Error(res?.error || "status_update_failed");
      const saved = res.item;

      setItems((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) =>
          x.ID === saved.ID ? { ...x, status: saved.status } : x
        )
      );

      const k = keyIssues(building);
      const arr = Array.isArray(getCached(k)) ? getCached(k) : [];
      const updated = arr.map((x) =>
        x.ID === saved.ID ? { ...x, status: saved.status } : x
      );
      setCached(k, updated, TTL_ISSUES); // ← fixed (previously wrong argument order)
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setBusyId("");
    }
  }

  function promptDelete(it) {
    setConfirmDel({ open: true, item: it });
  }

  async function actuallyDelete(it) {
    try {
      setBusyId(it.ID);
      const prevSnapshot = Array.isArray(items) ? items : [];
      setItems((cur) =>
        (Array.isArray(cur) ? cur : []).filter((x) => x.ID !== it.ID)
      );

      const idToken = await getStableIdToken();
      if (!idToken) return;
      const res = await api.issues.remove({ idToken, id: it.ID });
      if (!res?.ok) throw new Error(res?.error || "delete_failed");

      const k = keyIssues(building);
      const cached = (
        Array.isArray(getCached(k)) ? getCached(k) : prevSnapshot
      ).filter((x) => x.ID !== it.ID);
      setCached(k, cached, TTL_ISSUES);
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setBusyId("");
    }
  }

  // -------- active filters count & shape for popup --------
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (building !== "ALL") c++;
    if (status !== "ALL") c++;
    if (priority !== "ALL") c++;
    if (category !== "ALL") c++;
    return c;
  }, [building, status, priority, category]);

  const filterShape = useMemo(
    () => ({ building, status, priority, category }),
    [building, status, priority, category]
  );

  function applyFilters(next) {
    setBuilding(next.building ?? "ALL");
    setStatus(next.status ?? "ALL");
    setPriority(next.priority ?? "ALL");
    setCategory(next.category ?? "ALL");
    setShowFilters(false);
  }

  // -------- add new inline --------
  function startAdd() {
    setEditing(null);
    setShowModal(true);
  }

  return (
    <div className="space-y-4" dir={dir}>
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-[var(--muted)]">
            {t("issues.manage")}
          </div>
          <h1 className="text-2xl font-semibold">{t("issues.title")}</h1>
        </div>
        {canAdd && (
          <button
            onClick={startAdd}
            className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white"
          >
            {t("issues.add")}
          </button>
        )}
      </div>

      {/* compact bar */}
      <SearchBar
        q={q}
        setQ={setQ}
        onOpenFilters={() => setShowFilters(true)}
        activeCount={activeFiltersCount}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadAll();
        }}
        t={t}
      />

      <FilterPopup
        open={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
        initial={filterShape}
        buildings={buildings}
        t={t}
      />

      {/* filter chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          {building !== "ALL" && (
            <Badge tone="blue">
              {t("issues.toolbar.allBuildings")}: {buildingNameOf(building)}
            </Badge>
          )}
          {status !== "ALL" && (
            <Badge tone={toneForStatus(status)}>
              {t("issues.status." + status)}
            </Badge>
          )}
          {priority !== "ALL" && (
            <Badge tone={toneForPriority(priority)}>
              {t("issues.priority." + priority)}
            </Badge>
          )}
          {category !== "ALL" && (
            <Badge>{t("issues.category." + category)}</Badge>
          )}
          <button
            onClick={() =>
              applyFilters({
                building: "ALL",
                status: "ALL",
                priority: "ALL",
                category: "ALL",
              })
            }
            className="ml-1 text-xs text-[var(--muted)] underline hover:no-underline"
          >
            {t("issues.filters.clearAll")}
          </button>
        </div>
      )}

      {/* main card list */}
      <div className="card p-0 overflow-x-hidden">
        {(softLoading || refreshing) && (
          <div className="h-[2px] w-full bg-[var(--accent)]/70 animate-pulse" />
        )}

        <div className="px-3 py-2 text-xs text-[var(--muted)] border-b border-[var(--border)]">
          {t("issues.toolbar.total", { n: list.length })}
        </div>

        {loading ? (
          <IssuesSkeleton rows={6} insideCard />
        ) : error ? (
          <div className="p-4 text-sm text-red-300">{error}</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-center text-[var(--muted)]">
            {t("issues.empty")}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {list.map((it) => {
              const isNew = false; // (no “new” inline rows anymore)

              const buildingName = buildingNameOf(it.building_id);
              const meta = `${buildingName} • ${t("issues.unit")} ${
                it.unit_code || "—"
              } • ${new Date(
                it.created_at || Date.now()
              ).toLocaleDateString()}`;

              return (
                <div
                  key={it.ID}
                  className={`px-3 py-3 ${
                    busyId === it.ID ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  <IssueSummary
                    it={{ ...it, _meta: meta }}
                    buildingName={buildingName}
                    canChangeStatus={canChangeStatus && !isNew}
                    onStatus={setStatusOf}
                    onEdit={() => {
                      setEditing(it);
                      setShowModal(true);
                    }}
                    onDelete={promptDelete}
                    deleting={busyId === it.ID}
                    canDelete={!isNew && canDelete}
                    t={t}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <IssueModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        onSave={saveFromModal}
        initial={
          editing || {
            building_id:
              building !== "ALL"
                ? building
                : (Array.isArray(buildings) && buildings[0]?.ID) || "",
            unit_code: "",
            title: "",
            description: "",
            category: CATEGORIES[0],
            priority: "MEDIUM",
            status: "OPEN",
          }
        }
        buildings={buildings}
        canEditStatus={canChangeStatus}
        t={t}
        dir={dir}
      />
      {/* Delete confirm toast */}
      <ConfirmToast
        open={confirmDel.open}
        title={t("issues.confirm.deleteTitle")}
        message={
          confirmDel.item
            ? t("issues.confirm.deleteMsg", {
                title: confirmDel.item.title || t("issues.issue"),
              })
            : ""
        }
        confirmText={t("issues.confirm.delete")}
        cancelText={t("cancel")}
        danger
        onCancel={() => setConfirmDel({ open: false, item: null })}
        onConfirm={() => {
          const it = confirmDel.item;
          setConfirmDel({ open: false, item: null });
          if (it) actuallyDelete(it);
        }}
      />
    </div>
  );
}
/* ---------------- Issue modal (Add/Edit) ---------------- */
function IssueModal({
  open,
  onClose,
  onSave,
  initial,
  buildings,
  canEditStatus = false,
  t,
  dir,
}) {
  const [form, setForm] = useState({
    // core
    building_id: initial?.building_id || "",
    unit_code: initial?.unit_code || "",
    title: initial?.title || "",
    description: initial?.description || "",
    // meta
    category: initial?.category || "PLUMBING",
    priority: initial?.priority || "MEDIUM",
    status: (initial?.status || "OPEN").toUpperCase(),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      building_id: initial?.building_id || "",
      unit_code: initial?.unit_code || "",
      title: initial?.title || "",
      description: initial?.description || "",
      category: initial?.category || "PLUMBING",
      priority: initial?.priority || "MEDIUM",
      status: (initial?.status || "OPEN").toUpperCase(),
    });
  }, [open, initial]);

  // lock body scroll like other popups
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

  const isEdit = Boolean(initial?.ID);
  const rtl = dir === "rtl";
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div
      className="fixed inset-0 h-[100dvh] z-[60] flex items-end md:items-center justify-center overscroll-contain"
      dir={dir}
    >
      <div
        className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-[96vw] md:w-[720px] max-h-[90vh] overflow-auto card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4">
        {/* header */}
        <div
          className={`flex items-start justify-between ${
            rtl ? "flex-row-reverse" : ""
          }`}
        >
          <div>
            <div className="text-base font-semibold">
              {isEdit
                ? t("issues.editor.editTitle") || "Edit issue"
                : t("issues.editor.addTitle") || "Add issue"}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {isEdit
                ? t("issues.editor.editSubtitle") || "Update fields and save"
                : t("issues.editor.addSubtitle") || "Fill the details and save"}
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

        {/* form */}
        <div
          className={`mt-4 grid gap-3 grid-cols-1 md:grid-cols-2 ${
            rtl ? "text-right" : ""
          }`}
        >
          {/* Building */}
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t("issues.toolbar.allBuildings")}</span>
            <select
              value={form.building_id}
              onChange={(e) => update("building_id", e.target.value)}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            >
              <option value="">
                {t("issues.editor.selectBuilding") || "Select building"}
              </option>
              {(Array.isArray(buildings) ? buildings : []).map((b) => (
                <option key={b.ID} value={b.ID}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          {/* Unit code */}
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t("issues.unit")}</span>
            <input
              value={form.unit_code}
              onChange={(e) => update("unit_code", e.target.value)}
              placeholder={t("issues.editor.unitPH") || "e.g. A-402"}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            />
          </label>

          {/* Category */}
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t("issues.editor.categoryLabel")}</span>
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`issues.category.${c}`)}
                </option>
              ))}
            </select>
          </label>

          {/* Priority */}
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t("issues.editor.priorityLabel")}</span>
            <select
              value={form.priority}
              onChange={(e) => update("priority", e.target.value)}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`issues.priority.${p}`)}
                </option>
              ))}
            </select>
          </label>

          {/* Status (show for edit or when role can change) */}
          {(isEdit || canEditStatus) && (
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-sm">
                {t("issues.editor.statusLabel") || "Status"}
              </span>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`issues.status.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Title */}
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm">{t("issues.editor.titleLabel")}</span>
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder={t("issues.editor.titlePH")}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            />
          </label>

          {/* Description */}
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm">{t("issues.editor.descLabel")}</span>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder={t("issues.editor.descPH")}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full min-h-[140px] resize-y"
              rows={7}
            />
          </label>
        </div>

        {/* actions */}
        <div
          className={`mt-4 flex items-center justify-end gap-2 ${
            rtl ? "flex-row-reverse" : ""
          }`}
        >
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
            disabled={saving}
          >
            {t("cancel")}
          </button>
          <button
            onClick={async () => {
              if (!form.building_id || !form.title) {
                alert(t("issues.validation.enterTitle"));
                return;
              }
              try {
                setSaving(true);
                await onSave(form, { isEdit });
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-lg px-3 py-2 text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-600)] disabled:opacity-60"
            disabled={saving}
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
