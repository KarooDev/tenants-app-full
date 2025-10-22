// src/pages/Units.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "../providers/AuthProvider";
import { getStableIdToken } from "../lib/token";
import { getCached, setCached } from "../lib/warmCache";
import { api } from "../api";
import { ROLES } from "../constants/roles";
import { useI18n } from "../providers/I18nProvider";

/* -------------------- cache freshness -------------------- */
function hasFresh(key) {
  const v = getCached(key);
  return v !== undefined && v !== null; // TTL is handled inside warmCache
}

/* -------------------- tiny icons -------------------- */
const IconTrash = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path
      d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h12Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* -------------------- smooth collapsible -------------------- */
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
        opacity: open ? 1 : 0,
        overflow: "hidden",
        transition: `max-height ${duration}ms cubic-bezier(.22,.61,.36,1), opacity ${duration}ms ease`,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/* -------------------- confirm toast -------------------- */
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
    <div className="fixed inset-0 h-[100dvh] bottom-[-1px] z-[60] flex items-end md:items-center justify-center pointer-events-none">
      <div
        className="absolute left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm pointer-events-auto"
        onClick={onCancel}
      />
      <div className="relative pointer-events-auto w-[92vw] md:w-[520px] card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4 mb-4 md:mb-0">
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

/* -------------------- tiny UI bits -------------------- */
function StatusBadge({ status, t }) {
  const st = String(status || "").toUpperCase();
  const on = st === "AVAILABLE" || st === "OCCUPIED";
  const label =
    st === "AVAILABLE"
      ? t("units.status.available")
      : st === "OCCUPIED"
      ? t("units.status.occupied")
      : t("units.status.inactive");
  return (
    <span
      className="px-2 py-[2px] rounded-full text-[11px] border"
      style={{
        background: on ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.04)",
        color: on ? "#7dd3a7" : "var(--muted)",
        borderColor: "var(--border)",
      }}
    >
      {label}
    </span>
  );
}
function RowSkeleton() {
  const bar = "rounded bg-[color-mix(in_oklab,var(--text)_12%,transparent)]";
  return (
    <div className="p-3 border border-[var(--border)] rounded-xl animate-pulse">
      <div className={`h-4 w-[60%] ${bar} mb-2`} />
      <div className={`h-3 w-[40%] ${bar}`} />
    </div>
  );
}
function UnitsSkeleton(props) {
  const {
    rows = 8,
    showToolbar = true,
    showHeader = true,
  } = props || {};

  const Bar = ({ w, h = 12, r = 8, className = "" }) => (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "var(--skeleton, rgba(16,24,40,.08))",
      }}
    />
  );

  const Chip = ({ w = 70 }) => (
    <div
      className="animate-pulse h-[20px] rounded-full border"
      style={{
        width: w,
        borderColor: "var(--border)",
        background: "var(--skeleton-strong, rgba(16,24,40,.12))",
      }}
    />
  );

  return (
    <div className="space-y-3" aria-busy="true" role="status">
      {/* Top toolbar (search + filters + Add) */}
      {showToolbar && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bar w={360} h={36} r={10} />
            <Bar w={96} h={36} r={10} />
          </div>
          <Bar w={110} h={36} r={10} />
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {/* Header row (select all + counts) */}
        {showHeader && (
          <div className="px-3 py-2 text-xs text-[var(--muted)] flex items-center gap-2 border-b border-[var(--border)]">
            <Bar w={16} h={16} r={4} />
            <Bar w={160} h={12} r={6} />
          </div>
        )}

        {/* Rows */}
        <div className="p-3 grid gap-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="px-2 py-3 rounded-xl border border-[var(--border)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Bar w={16} h={16} r={4} className="mt-1" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bar w={80} h={16} />
                      <Chip w={92} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <Bar w={180} h={12} />
                      <Bar w={140} h={12} />
                      <Bar w={100} h={12} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Chip w={90} />
                      <Chip w={110} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Bar w={72} h={30} r={10} />
                  <Bar w={110} h={30} r={10} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span
      className="px-2 py-[3px] rounded-full text-xs"
      style={{
        background: "rgba(255,255,255,.05)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </span>
  );
}
/* ---------------- number sanitizers ---------------- */
function onlyInt(v) {
  return String(v || "").replace(/\D+/g, "");
}
function onlyDec(v) {
  const r = String(v || "").replace(/[^0-9.]/g, "");
  const [a, b = ""] = r.split(".");
  return b ? `${a}.${b.replace(/\./g, "")}` : a;
}

/* ---------------- compact search + trigger ---------------- */
function SearchBar({ q, setQ, onOpenFilters, activeCount, t, dir }) {
  const rtl = dir === "rtl";
  return (
    <div className={`mb-2 ${rtl ? "text-right" : ""}`}>
      <div
        className={`flex items-center gap-2 ${rtl ? "flex-row-reverse" : ""}`}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("units.toolbar.search")}
          className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full md:w-[360px]"
        />
        <button
          onClick={onOpenFilters}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5 relative"
          aria-label="Open filters"
        >
          {t("filters") || "Filters"}
          {activeCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center text-[11px] rounded-full px-2 py-[2px] bg-[var(--accent)] text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Filters popup ---------------- */
function FilterPopup({
  open,
  onClose,
  onApply,
  initial,
  buildings,
  blocks,
  t,
  dir,
}) {
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial, open]);

  // lock body scroll + compensate scrollbar
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

  const rtl = dir === "rtl";
  const update = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const visibleBlocks = (Array.isArray(blocks) ? blocks : []).filter(
    (b) =>
      draft.buildingId !== "ALL" &&
      String(b.building_id) === String(draft.buildingId)
  );

  return (
    <div
      className="fixed inset-0 h-[100dvh] z-[60] flex items-end md:items-center justify-center overscroll-contain"
      dir={dir}
    >
      <div
        className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-[96vw] md:w-[640px] max-h-[90vh] overflow-auto card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4">
        <div
          className={`flex items-start justify-between ${
            rtl ? "flex-row-reverse" : ""
          }`}
        >
          <div>
            <div className="text-base font-semibold">{t("filters")}</div>
            <div className="text-xs text-[var(--muted)]">
              {t("units.manage")}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-white/5"
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>

        <div
          className={`mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 ${
            rtl ? "text-right" : ""
          }`}
        >
          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("units.fields.status")}
            </label>
            <select
              value={draft.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="ALL">{t("units.status.all")}</option>
              <option value="AVAILABLE">
                {t("units.status.availableOnly")}
              </option>
              <option value="OCCUPIED">{t("units.status.occupiedOnly")}</option>
              <option value="INACTIVE">{t("units.status.inactiveOnly")}</option>
            </select>
          </div>

          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("units.fields.building")}
            </label>
            <select
              value={draft.buildingId}
              onChange={(e) => update("buildingId", e.target.value)}
            >
              <option value="ALL">{t("units.filters.allBuildings")}</option>
              {(Array.isArray(buildings) ? buildings : []).map((b) => (
                <option key={b.ID} value={b.ID}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-select-wrap sm:col-span-2">
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("units.fields.block")}
            </label>
            <select
              value={draft.blockId}
              onChange={(e) => update("blockId", e.target.value)}
              disabled={draft.buildingId === "ALL"}
            >
              <option value="ALL">{t("units.filters.allBlocks")}</option>
              {visibleBlocks.map((bl) => (
                <option key={bl.ID} value={bl.ID}>
                  {bl.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          className={`mt-4 flex items-center justify-between ${
            rtl ? "flex-row-reverse" : ""
          }`}
        >
          <button
            onClick={() =>
              onApply({ status: "ALL", buildingId: "ALL", blockId: "ALL" })
            }
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            {t("clearAll") || "Clear all"}
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
              {t("applyFilters") || "Apply filters"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Add Unit modal -------------------- */
function AddUnitModal({
  open,
  onClose,
  onSave,
  buildings,
  blocks,
  defaultBuildingId,
  t,
  dir,
}) {
  const [form, setForm] = useState({
    building_id: defaultBuildingId || "",
    block_id: "",
    block_name: "",
    unit_code: "",
    floor: "",
    bedrooms: "",
    bathrooms: "",
    sqm: "",
    status: "AVAILABLE",
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open)
      setForm((f) => ({
        ...f,
        building_id: defaultBuildingId || f.building_id || "",
      }));
  }, [open, defaultBuildingId]);

  if (!open) return null;

  const filteredBlocks = (Array.isArray(blocks) ? blocks : []).filter(
    (b) => String(b.building_id) === String(form.building_id)
  );

  const rtl = dir === "rtl";

  return (
    <div className="card p-4 mb-4" dir={dir}>
      <div className="text-lg font-semibold mb-2">{t("units.add.title")}</div>
      <div
        className={`grid gap-3 sm:grid-cols-2 md:grid-cols-3 ${
          rtl ? "text-right" : ""
        }`}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm">{t("units.fields.building")}</span>
          <select
            value={form.building_id}
            onChange={(e) =>
              setForm({
                ...form,
                building_id: e.target.value,
                block_id: "",
                block_name: "",
              })
            }
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
          >
            <option value="" disabled>
              {t("units.add.selectBuilding")}
            </option>
            {(Array.isArray(buildings) ? buildings : []).map((b) => (
              <option key={b.ID} value={b.ID}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">{t("units.fields.block")}</span>
          <select
            value={form.block_id}
            onChange={(e) =>
              setForm({ ...form, block_id: e.target.value, block_name: "" })
            }
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            disabled={!form.building_id}
          >
            <option value="">—</option>
            {filteredBlocks.map((bl) => (
              <option key={bl.ID} value={bl.ID}>
                {bl.name}
              </option>
            ))}
          </select>
          <input
            value={form.block_name}
            onChange={(e) =>
              setForm({ ...form, block_name: e.target.value, block_id: "" })
            }
            placeholder={t("units.add.orTypeNewBlock")}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            disabled={!form.building_id}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">{t("units.fields.unitCode")}</span>
          <input
            value={form.unit_code}
            onChange={(e) => setForm({ ...form, unit_code: e.target.value })}
            placeholder={t("units.add.codePlaceholder")}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
          />
        </label>

        {["floor", "bedrooms", "bathrooms", "sqm"].map((k) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="text-sm">{t(`units.fields.${k}`)}</span>
            <input
              value={form[k]}
              onChange={(e) =>
                setForm({
                  ...form,
                  [k]:
                    k === "sqm"
                      ? onlyDec(e.target.value)
                      : onlyInt(e.target.value),
                })
              }
              inputMode="numeric"
              pattern={k === "sqm" ? "[0-9]*[.]?[0-9]*" : "[0-9]*"}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            />
          </label>
        ))}

        <label className="flex flex-col gap-1">
          <span className="text-sm">{t("units.fields.status")}</span>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
          >
            <option value="AVAILABLE">{t("units.status.available")}</option>
            <option value="OCCUPIED">{t("units.status.occupied")}</option>
            <option value="INACTIVE">{t("units.status.inactive")}</option>
          </select>
        </label>
      </div>

      <div className={`mt-3 flex gap-2 ${rtl ? "flex-row-reverse" : ""}`}>
        <button
          onClick={async () => {
            try {
              setCreating(true);
              await onSave(form);
            } finally {
              setCreating(false);
            }
          }}
          className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-60"
          disabled={creating}
          aria-busy={creating ? "true" : "false"}
        >
          {creating ? t("saving") || "Saving…" : t("save")}
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-[var(--border)] px-3 py-2 disabled:opacity-60"
          disabled={creating}
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

/* -------------------- page -------------------- */
export default function Units() {
  const LAST_BID_KEY = "units:lastBuilding";
  const { t, dir } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const canManage = [ROLES.ADMIN, ROLES.BUILDING_MGMT, ROLES.STAFF].includes(
    String(user?.role).toUpperCase()
  );
  const rtl = dir === "rtl";

  // TTLs
  const TTL_BUILDINGS = 120_000; // 2m
  const TTL_UNITS = 300_000;     // 5m
  const TTL_BLOCKS = 120_000;    // 2m
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  // cache keys
  const keyUnits = (bid) => `units/list?bid=${bid}`;
  const keyBlocks = (bid) => `blocks/list?bid=${bid}`;

  // seed caches
  const cachedBuildings = getCached("buildings/list");
  const [buildings, setBuildings] = useState(
    Array.isArray(cachedBuildings) ? cachedBuildings : []
  );
  const [buildingId, setBuildingId] = useState(() => {
    try {
      return localStorage.getItem(LAST_BID_KEY) || "ALL";
    } catch {
      return "ALL";
    }
  });
  const [blockId, setBlockId] = useState("ALL");

  const cachedUnitsAll = getCached(keyUnits("ALL"));
  const cachedBlocksAll = getCached(keyBlocks("ALL"));

  const [units, setUnits] = useState(
    Array.isArray(cachedUnitsAll) ? cachedUnitsAll : []
  );
  const [blocks, setBlocks] = useState(
    Array.isArray(cachedBlocksAll) ? cachedBlocksAll : []
  );
  const [loading, setLoading] = useState(
    !(Array.isArray(cachedBuildings) && Array.isArray(cachedUnitsAll))
  );
  const [savingId, setSavingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  // filters/search
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);

  // add & delete
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState({ open: false, unit: null });

  // edit state
  const [drafts, setDrafts] = useState({});
  const [openRowId, setOpenRowId] = useState("");

  // bulk-select
  const [selected, setSelected] = useState(() => new Set());
  const selectedCount = selected.size;

  /* ---------- persist last used building ---------- */
  useEffect(() => {
    try {
      localStorage.setItem(LAST_BID_KEY, String(buildingId));
    } catch {}
  }, [buildingId]);

  /* ---------- loader (with auth-race retry) ---------- */
  const loadAll = useCallback(
    async (activeBuildingId) => {
      setError("");
      try {
        // first attempt
        let idToken = await getStableIdToken();
        if (!idToken) return;

        // 1) UNITS FIRST (critical path)
        let uRes = await api.units.list({
          idToken,
          building_id: activeBuildingId !== "ALL" ? activeBuildingId : undefined,
        });

        // retry once if token was not yet accepted
        if (!uRes?.ok && String(uRes?.error || "") === "not_authenticated") {
          idToken = await getStableIdToken();
          if (!idToken) return;
          uRes = await api.units.list({
            idToken,
            building_id:
              activeBuildingId !== "ALL" ? activeBuildingId : undefined,
          });
        }

        if (!uRes?.ok) throw new Error(uRes?.error || "units_load_failed");

        const uList = Array.isArray(uRes.items) ? uRes.items : [];
        setUnits(uList);
        setCached(keyUnits(activeBuildingId), uList, TTL_UNITS);
        setLoading(false); // don't wait for buildings/blocks

        // 2) BUILDINGS in background (use cache if fresh)
        const needBuildings = !hasFresh("buildings/list");
        if (needBuildings) {
          api.buildings
            .list({ idToken })
            .then((bRes) => {
              if (bRes?.ok) {
                const bList = Array.isArray(bRes.items) ? bRes.items : [];
                setBuildings(bList);
                setCached("buildings/list", bList, TTL_BUILDINGS);
                if (activeBuildingId === "ALL" && bList.length === 1) {
                  setBuildingId(bList[0].ID);
                }
              }
            })
            .catch(() => {});
        }

        // 3) BLOCKS in background (skip when ALL)
        const blocksKey = keyBlocks(activeBuildingId);
        if (activeBuildingId !== "ALL" && !hasFresh(blocksKey)) {
          api.blocks
            .list({ idToken, building_id: activeBuildingId })
            .then((blRes) => {
              if (blRes?.ok) {
                const blList = Array.isArray(blRes.items) ? blRes.items : [];
                setBlocks(blList);
                setCached(blocksKey, blList, TTL_BLOCKS);
              }
            })
            .catch(() => {});
        }
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg !== "not_authenticated") setError(msg);
        setLoading(false);
      }
    },
    [] // stable; we pass activeBuildingId
  );

  // First render (auth ready) — show skeleton only if nothing to paint
  useEffect(() => {
    if (authLoading || !user) return;

    // always paint cache instantly
    const cachedU = getCached(keyUnits(buildingId));
    if (Array.isArray(cachedU)) setUnits(cachedU);

    // only show skeleton if *nothing* to paint
    const freshU = hasFresh(keyUnits(buildingId));
    if (!freshU && !(Array.isArray(cachedU) && cachedU.length > 0)) {
      setLoading(true);
    } else {
      setLoading(false);
    }

    // then refresh network in background
    loadAll(buildingId);
  }, [authLoading, user, buildingId, loadAll]);

  // When building filter changes, seed from cache and refresh
  useEffect(() => {
    if (authLoading || !user) return;

    const seededUnits = getCached(keyUnits(buildingId));
    const seededBlocks = getCached(keyBlocks(buildingId));
    if (Array.isArray(seededUnits)) setUnits(seededUnits);
    if (Array.isArray(seededBlocks)) setBlocks(seededBlocks);

    const freshU = hasFresh(keyUnits(buildingId));
    setLoading(!freshU && !(Array.isArray(seededUnits) && seededUnits.length > 0));

    loadAll(buildingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  // If ALL scope has no cache but a specific building does, jump to it (one-time)
  useEffect(() => {
    if (buildingId !== "ALL") return;
    const allCached = getCached(keyUnits("ALL"));
    if (Array.isArray(allCached) && allCached.length > 0) return;

    const bList = Array.isArray(cachedBuildings) ? cachedBuildings : [];
    for (const b of bList) {
      const cu = getCached(keyUnits(b.ID));
      if (Array.isArray(cu) && cu.length) {
        setBuildingId(b.ID);
        setUnits(cu); // instant paint
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the open editor row with Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setOpenRowId("");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // maps
  const buildingById = useMemo(() => {
    const m = new Map();
    (Array.isArray(buildings) ? buildings : []).forEach((b) =>
      m.set(String(b.ID), b)
    );
    return m;
  }, [buildings]);
  const blockById = useMemo(() => {
    const m = new Map();
    (Array.isArray(blocks) ? blocks : []).forEach((b) =>
      m.set(String(b.ID), b)
    );
    return m;
  }, [blocks]);

  // filter
  const safeUnits = Array.isArray(units) ? units : [];
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return safeUnits.filter((u) => {
      if (status !== "ALL" && String(u.status).toUpperCase() !== status)
        return false;
      if (buildingId !== "ALL" && String(u.building_id) !== String(buildingId))
        return false;
      if (blockId !== "ALL" && String(u.block_id || "") !== String(blockId))
        return false;
      if (!needle) return true;
      const bName = buildingById.get(String(u.building_id))?.name || "";
      const blName = blockById.get(String(u.block_id || ""))?.name || "";
      const hay =
        `${u.unit_code} ${u.floor} ${u.bedrooms} ${u.bathrooms} ${u.sqm} ${bName} ${blName}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [safeUnits, status, buildingId, blockId, q, buildingById, blockById]);

  // edit helpers
  function setDraft(id, patch) {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }
/* -------------------- Edit Unit modal -------------------- */
/* -------------------- Edit Unit modal -------------------- */
/* -------------------- Edit Unit modal -------------------- */
function EditUnitModal({
  open,
  onClose,
  onSave,
  unit,
  blocks,
  t,
  dir,
  saving = false,
}) {
  // guard
  if (!open || !unit) return null;

  const rtl = dir === "rtl";

  // local form state seeded from the unit
  const [form, setForm] = useState(() => ({
    block_id: unit.block_id || "",
    block_name: "",
    floor: unit.floor ?? "",
    bedrooms: unit.bedrooms ?? "",
    bathrooms: unit.bathrooms ?? "",
    sqm: unit.sqm ?? "",
    status: String(unit.status || "AVAILABLE").toUpperCase(),
  }));

  // reset when opening or when target unit changes
  useEffect(() => {
    if (!open || !unit) return;
    setForm({
      block_id: unit.block_id || "",
      block_name: "",
      floor: unit.floor ?? "",
      bedrooms: unit.bedrooms ?? "",
      bathrooms: unit.bathrooms ?? "",
      sqm: unit.sqm ?? "",
      status: String(unit.status || "AVAILABLE").toUpperCase(),
    });
  }, [open, unit]);

  const filteredBlocks = (Array.isArray(blocks) ? blocks : []).filter(
    (b) => String(b.building_id) === String(unit.building_id)
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative pointer-events-auto w-[96vw] md:w-[720px] max-h-[90vh] overflow-auto card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4"
        dir={dir}
        aria-busy={saving ? "true" : "false"}
      >
        <div className={`flex items-start justify-between ${rtl ? "flex-row-reverse" : ""}`}>
          <div>
            <div className="text-base font-semibold">
              {t("units.edit.title") || t("buildings.actions.edit") || "Edit unit"}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {t("units.add.unit")} {unit.unit_code}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-white/5"
            aria-label="Close edit"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className={`mt-3 grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${rtl ? "text-right" : ""}`}>
          {/* Block select + new block */}
          <label className="flex flex-col gap-1 md:col-span-3">
            <span className="text-sm">{t("units.fields.block")}</span>
            <div className={`grid gap-2 ${rtl ? "text-right" : ""} md:grid-cols-2`}>
              <select
                value={form.block_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, block_id: e.target.value, block_name: "" }))
                }
                className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
                disabled={saving}
              >
                <option value="">{t("dash.none") || "—"}</option>
                {filteredBlocks.map((bl) => (
                  <option key={bl.ID} value={bl.ID}>
                    {bl.name}
                  </option>
                ))}
              </select>
              <input
                value={form.block_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, block_name: e.target.value, block_id: "" }))
                }
                placeholder={t("units.add.orTypeNewBlock")}
                className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
                disabled={saving}
              />
            </div>
          </label>

          {["floor", "bedrooms", "bathrooms", "sqm"].map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-sm">{t(`units.fields.${k}`)}</span>
              <input
                value={form[k]}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    [k]: k === "sqm" ? onlyDec(e.target.value) : onlyInt(e.target.value),
                  }))
                }
                inputMode="numeric"
                pattern={k === "sqm" ? "[0-9]*[.]?[0-9]*" : "[0-9]*"}
                className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
                disabled={saving}
              />
            </label>
          ))}

          <label className="flex flex-col gap-1">
            <span className="text-sm">{t("units.fields.status")}</span>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
              disabled={saving}
            >
              <option value="AVAILABLE">{t("units.status.available")}</option>
              <option value="OCCUPIED">{t("units.status.occupied")}</option>
              <option value="INACTIVE">{t("units.status.inactive")}</option>
            </select>
          </label>
        </div>

        <div className={`mt-4 flex items-center justify-end gap-2 ${rtl ? "flex-row-reverse" : ""}`}>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-2"
            disabled={saving}
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => onSave(unit, form)}
            className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? (t("saving") || "Saving…") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

async function saveRowFromModal(u, form) {
  try {
    setSavingId(u.ID);
    let idToken = await getStableIdToken();
    if (!idToken) return;

    // resolve/create block when user typed a new one
    let block_id = form.block_id || u.block_id || "";
    const typedBlockName = (form.block_name || "").trim();
    if (typedBlockName) {
      let x = await api.blocks.save({
        idToken,
        block: {
          building_id: u.building_id,
          name: typedBlockName,
          floors: "",
        },
      });
      if (!x?.ok && String(x?.error || "") === "not_authenticated") {
        idToken = await getStableIdToken();
        if (!idToken) return;
        x = await api.blocks.save({
          idToken,
          block: {
            building_id: u.building_id,
            name: typedBlockName,
            floors: "",
          },
        });
      }
      if (x?.ok) {
        block_id = x.item.ID;
        // refresh blocks cache for this building
        api.blocks
          .list({ idToken, building_id: u.building_id })
          .then((r) => {
            if (r?.ok) {
              const arr = Array.isArray(r.items) ? r.items : [];
              setBlocks(arr);
              setCached(keyBlocks(u.building_id), arr, TTL_BLOCKS);
            }
          })
          .catch(() => {});
      }
    }

    const payload = {
      ...u,
      block_id,
      floor: String(form.floor ?? u.floor ?? ""),
      bedrooms: String(form.bedrooms ?? u.bedrooms ?? ""),
      bathrooms: String(form.bathrooms ?? u.bathrooms ?? ""),
      sqm: String(form.sqm ?? u.sqm ?? ""),
      status: String(form.status ?? u.status ?? "AVAILABLE").toUpperCase(),
    };

    let res = await api.units.save({ idToken, unit: payload });
    if (!res?.ok && String(res?.error || "") === "not_authenticated") {
      idToken = await getStableIdToken();
      if (!idToken) return;
      res = await api.units.save({ idToken, unit: payload });
    }
    if (!res?.ok) throw new Error(res?.error || "save_failed");

    setUnits((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const next = base.map((x) => (x.ID === u.ID ? { ...x, ...res.item } : x));
      setCached(keyUnits(buildingId), next, TTL_UNITS);
      const bKey = keyUnits(u.building_id);
      const bCached = getCached(bKey);
      if (Array.isArray(bCached)) {
        const bNext = bCached.map((x) => (x.ID === u.ID ? { ...x, ...res.item } : x));
        setCached(bKey, bNext, TTL_UNITS);
      }
      return next;
    });

    setEditOpen(false);
    setEditTarget(null);
  } catch (e) {
    alert(e.message || String(e));
  } finally {
    setSavingId("");
  }
}

  async function saveRow(u) {
    try {
      setSavingId(u.ID);
      let idToken = await getStableIdToken();
      if (!idToken) return; // guard

      const d = drafts[u.ID] || {};

      // create block if needed
      let block_id = d.block_id ?? u.block_id ?? "";
      const typedBlockName = (d.block_name || "").trim();
      if (typedBlockName) {
        let x = await api.blocks.save({
          idToken,
          block: {
            building_id: u.building_id,
            name: typedBlockName,
            floors: "",
          },
        });
        if (!x?.ok && String(x?.error || "") === "not_authenticated") {
          idToken = await getStableIdToken();
          if (!idToken) return;
          x = await api.blocks.save({
            idToken,
            block: {
              building_id: u.building_id,
              name: typedBlockName,
              floors: "",
            },
          });
        }
        if (x?.ok) {
          block_id = x.item.ID;
          api.blocks
            .list({ idToken, building_id: u.building_id })
            .then((r) => {
              if (r?.ok) {
                const arr = Array.isArray(r.items) ? r.items : [];
                setBlocks(arr);
                setCached(keyBlocks(u.building_id), arr, TTL_BLOCKS);
              }
            })
            .catch(() => {});
        }
      }

      const payload = {
        ...u,
        ...d,
        block_id,
        floor: String(d.floor ?? u.floor ?? ""),
        bedrooms: String(d.bedrooms ?? u.bedrooms ?? ""),
        bathrooms: String(d.bathrooms ?? u.bathrooms ?? ""),
        sqm: String(d.sqm ?? u.sqm ?? ""),
        status: String(d.status ?? u.status ?? "AVAILABLE").toUpperCase(),
      };

      let res = await api.units.save({ idToken, unit: payload });
      if (!res?.ok && String(res?.error || "") === "not_authenticated") {
        idToken = await getStableIdToken();
        if (!idToken) return;
        res = await api.units.save({ idToken, unit: payload });
      }
      if (!res?.ok) throw new Error(res?.error || "save_failed");

      setUnits((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const next = base.map((x) =>
          x.ID === u.ID ? { ...x, ...res.item } : x
        );
        setCached(keyUnits(buildingId), next, TTL_UNITS); // current scope
        // also update building-scoped cache to keep things consistent
        const bKey = keyUnits(u.building_id);
        const bCached = getCached(bKey);
        if (Array.isArray(bCached)) {
          const bNext = bCached.map((x) =>
            x.ID === u.ID ? { ...x, ...res.item } : x
          );
          setCached(bKey, bNext, TTL_UNITS);
        }
        return next;
      });

      setDrafts((prev) => {
        const n = { ...prev };
        delete n[u.ID];
        return n;
      });
      setOpenRowId("");
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSavingId("");
    }
  }

  function promptDeleteUnit(u) {
    setConfirmDel({ open: true, unit: u });
  }
  async function actuallyDeleteUnit(u) {
    const prevUnits = Array.isArray(units) ? units : [];
    try {
      setBusyId(u.ID);
      setUnits((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const next = base.filter((x) => x.ID !== u.ID);
        setCached(keyUnits(buildingId), next, TTL_UNITS); // current scope
        // also update building-scoped cache
        const bKey = keyUnits(u.building_id);
        const bCached = getCached(bKey);
        if (Array.isArray(bCached)) {
          setCached(
            bKey,
            bCached.filter((x) => x.ID !== u.ID),
            TTL_UNITS
          );
        }
        return next;
      });
      setDrafts((prev) => {
        const n = { ...prev };
        delete n[u.ID];
        return n;
      });

      let idToken = await getStableIdToken();
      if (!idToken) return; // guard
      let res = await api.units.remove({ idToken, id: u.ID });
      if (!res?.ok && String(res?.error || "") === "not_authenticated") {
        idToken = await getStableIdToken();
        if (!idToken) return;
        res = await api.units.remove({ idToken, id: u.ID });
      }
      if (!res?.ok) throw new Error(res?.error || "delete_failed");
    } catch (e) {
      setUnits(prevUnits);
      alert(e.message || String(e));
    } finally {
      setBusyId("");
    }
  }

  // bulk
  function toggleSelect(id, checked) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function toggleSelectAll(checked) {
    if (!checked) return setSelected(new Set());
    const ids = list.map((u) => u.ID);
    setSelected(new Set(ids));
  }

  // filter controls
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (status !== "ALL") c++;
    if (buildingId !== "ALL") c++;
    if (blockId !== "ALL") c++;
    return c;
  }, [status, buildingId, blockId]);

  const filterShape = useMemo(
    () => ({ status, buildingId, blockId }),
    [status, buildingId, blockId]
  );

  function applyFilters(next) {
    const nextBuilding = next.buildingId ?? "ALL";
    setStatus(next.status ?? "ALL");
    setBuildingId(nextBuilding);
    setBlockId(nextBuilding === "ALL" ? "ALL" : next.blockId ?? "ALL");
    setSelected(new Set());
    setShowFilters(false);
  }

  // add unit (inside component)
  async function addUnit(form) {
    try {
      if (!form.building_id || !form.unit_code) {
        alert(t("units.add.required"));
        return;
      }
      let idToken = await getStableIdToken();
      if (!idToken) return; // guard
      let block_id = form.block_id || "";

      // create block if user typed a new one
      if (!block_id && form.block_name?.trim()) {
        let r = await api.blocks.save({
          idToken,
          block: {
            building_id: form.building_id,
            name: form.block_name.trim(),
            floors: "",
          },
        });
        if (!r?.ok && String(r?.error || "") === "not_authenticated") {
          idToken = await getStableIdToken();
          if (!idToken) return;
          r = await api.blocks.save({
            idToken,
            block: {
              building_id: form.building_id,
              name: form.block_name.trim(),
              floors: "",
            },
          });
        }
        if (r?.ok) {
          block_id = r.item.ID;
          // refresh blocks cache for that building
          api.blocks
            .list({ idToken, building_id: form.building_id })
            .then((b) => {
              if (b?.ok) {
                const arr = Array.isArray(b.items) ? b.items : [];
                setBlocks(arr);
                setCached(keyBlocks(form.building_id), arr, TTL_BLOCKS);
              }
            })
            .catch(() => {});
        }
      }

      // create unit
      let res = await api.units.save({
        idToken,
        unit: {
          building_id: form.building_id,
          block_id,
          unit_code: form.unit_code,
          floor: String(form.floor || ""),
          bedrooms: String(form.bedrooms || ""),
          bathrooms: String(form.bathrooms || ""),
          sqm: String(form.sqm || ""),
          status: String(form.status || "AVAILABLE").toUpperCase(),
        },
      });
      if (!res?.ok && String(res?.error || "") === "not_authenticated") {
        idToken = await getStableIdToken();
        if (!idToken) return;
        res = await api.units.save({
          idToken,
          unit: {
            building_id: form.building_id,
            block_id,
            unit_code: form.unit_code,
            floor: String(form.floor || ""),
            bedrooms: String(form.bedrooms || ""),
            bathrooms: String(form.bathrooms || ""),
            sqm: String(form.sqm || ""),
            status: String(form.status || "AVAILABLE").toUpperCase(),
          },
        });
      }
      if (!res?.ok) throw new Error(res?.error || "save_failed");

      const u = res.item;

      // paint in current scope if it matches active filters
      const matchesFilter =
        (status === "ALL" || String(u.status).toUpperCase() === status) &&
        (buildingId === "ALL" ||
          String(u.building_id) === String(buildingId)) &&
        (blockId === "ALL" || String(u.block_id || "") === String(blockId));

      if (matchesFilter) {
        setUnits((prev) => {
          const base = Array.isArray(prev) ? prev : [];
          const next = [u, ...base];
          setCached(keyUnits(buildingId), next, TTL_UNITS);
          return next;
        });
      } else {
        const scopeKey = keyUnits(buildingId);
        const cachedScope = getCached(scopeKey);
        const arr = Array.isArray(cachedScope) ? cachedScope : [];
        setCached(scopeKey, [u, ...arr], TTL_UNITS);
      }

      // also update the building-scoped cache for the created unit
      const bKey = keyUnits(u.building_id);
      const bCached = getCached(bKey);
      setCached(bKey, Array.isArray(bCached) ? [u, ...bCached] : [u], TTL_UNITS);

      setShowAdd(false);
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  /* =================== RENDER =================== */
  return (
    <div className="space-y-4" dir={dir}>
      {/* Title & top actions */}
      <div
        className={`flex items-center justify-between ${
          rtl ? "flex-row-reverse text-right" : ""
        }`}
      >
        <div>
          <div className="text-sm text-[var(--muted)]">{t("units.manage")}</div>
          <h1 className="text-2xl font-semibold">{t("units.title")}</h1>
        </div>
        <div
          className={`flex items-center gap-2 ${rtl ? "flex-row-reverse" : ""}`}
        >
          {canManage && (
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white"
            >
              {t("units.actions.add")}
            </button>
          )}
        </div>
      </div>

      {/* Search & filters */}
      <SearchBar
        q={q}
        setQ={setQ}
        onOpenFilters={() => setShowFilters(true)}
        activeCount={activeFiltersCount}
        t={t}
        dir={dir}
      />
      {activeFiltersCount > 0 && (
        <div
          className={`flex flex-wrap items-center gap-2 -mt-1 ${
            rtl ? "justify-end" : ""
          }`}
        >
          {status !== "ALL" && (
            <Chip>
              {status === "AVAILABLE"
                ? t("units.status.availableOnly")
                : status === "OCCUPIED"
                ? t("units.status.occupiedOnly")
                : t("units.status.inactiveOnly")}
            </Chip>
          )}
          {buildingId !== "ALL" && (
            <Chip>
              {(buildings || []).find(
                (b) => String(b.ID) === String(buildingId)
              )?.name || t("units.fields.building")}
            </Chip>
          )}
          {blockId !== "ALL" && (
            <Chip>
              {(blocks || []).find((b) => String(b.ID) === String(blockId))
                ?.name || t("units.fields.block")}
            </Chip>
          )}
          <button
            onClick={() =>
              applyFilters({ status: "ALL", buildingId: "ALL", blockId: "ALL" })
            }
            className="ml-1 text-xs text-[var(--muted)] underline hover:no-underline"
          >
            {t("clear") || "Clear"}
          </button>
        </div>
      )}

      {/* Add Unit modal */}
      {canManage && (
        <AddUnitModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSave={addUnit}
          buildings={buildings}
          blocks={blocks}
          defaultBuildingId={
            buildingId !== "ALL"
              ? buildingId
              : Array.isArray(buildings) && buildings.length === 1
              ? buildings[0].ID
              : ""
          }
          t={t}
          dir={dir}
        />
      )}

      {/* Main list */}
      <div className="card p-0 overflow-hidden">
      {loading ? (
          <div className="p-4 text-sm text-red-300">{error}</div>
        ) : (
          <>
            {/* select-all header */}
            <div
              className={`px-3 py-2 text-xs text-[var(--muted)] flex items-center gap-2 border-b border-[var(--border)] ${
                rtl ? "flex-row-reverse" : ""
              }`}
            >
              {canManage && (
                <input
                  type="checkbox"
                  className="ui-checkbox"
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  checked={selectedCount > 0 && selectedCount === list.length}
                  aria-label={t("units.actions.selectAll")}
                />
              )}
              <span>
                {selectedCount > 0
                  ? t("units.actions.selectedN").replace(
                      "{{n}}",
                      String(selectedCount)
                    )
                  : t("units.actions.totalUnitsN").replace(
                      "{{n}}",
                      String(list.length)
                    )}
              </span>
            </div>

            {/* rows */}
            <div className="divide-y divide-[var(--border)]">
              {list.map((u) => {
                const d = drafts[u.ID] || {};
                const bName =
                  buildingById.get(String(u.building_id))?.name || "—";
                const blName =
                  blockById.get(String(u.block_id || ""))?.name ||
                  d.block_name ||
                  "—";
                const rowBusy = savingId === u.ID || busyId === u.ID;
                const isOpen = openRowId === u.ID;

                return (
                  <div
                    key={u.ID}
                    className={`px-3 py-3 ${
                      rowBusy ? "opacity-60 pointer-events-none" : ""
                    } ${isOpen ? "bg-black/3" : ""}`}
                  >
                    {/* summary + actions */}
                    <div
                      className={`flex items-start justify-between gap-3 ${
                        rtl ? "flex-row-reverse" : ""
                      }`}
                    >
                      <div
                        className={`flex items-start gap-3 min-w-0 ${
                          rtl ? "flex-row-reverse" : ""
                        }`}
                      >
                        {canManage && (
                          <input
                            type="checkbox"
                            className="ui-checkbox mt-1"
                            checked={selected.has(u.ID)}
                            onChange={(e) =>
                              toggleSelect(u.ID, e.target.checked)
                            }
                            aria-label={t("units.actions.selectUnit")}
                          />
                        )}
                        <div className="min-w-0">
                          <div
                            className={`flex items-center gap-2 ${
                              rtl ? "flex-row-reverse" : ""
                            }`}
                          >
                            <div className="font-medium truncate">
                              {u.unit_code || "—"}
                            </div>
                            <StatusBadge status={d.status ?? u.status} t={t} />
                          </div>
                          <div
                            className={`text-sm text-[var(--muted)] truncate ${
                              rtl ? "text-right" : ""
                            }`}
                          >
                            {bName} • {t("units.fields.block")} {blName}
                            {u.floor ? (
                              <>
                                {" "}
                                • {t("units.fields.floor")} {u.floor}
                              </>
                            ) : null}
                            {u.sqm ? (
                              <>
                                {" "}
                                • {u.sqm} {t("units.fields.m2")}
                              </>
                            ) : null}
                          </div>
                          <div
                            className={`mt-1 flex items-center gap-2 text-xs text-[var(--muted)] ${
                              rtl ? "flex-row-reverse" : ""
                            }`}
                          >
                            {u.bedrooms ? (
                              <Chip>
                                {u.bedrooms} {t("units.fields.bedroomsShort")}
                              </Chip>
                            ) : null}
                            {u.bathrooms ? (
                              <Chip>
                                {u.bathrooms} {t("units.fields.bathroomsShort")}
                              </Chip>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* actions */}
                      <div
                        className={`flex flex-wrap items-center gap-2 shrink-0 ${
                          rtl ? "flex-row-reverse justify-start" : "justify-end"
                        }`}
                      >
                        {isOpen ? (
                          <>
                            <button
                              onClick={() => saveRow(u)}
                              className="rounded-lg px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-60"
                              disabled={rowBusy}
                            >
                              {savingId === u.ID ? t("saving") : t("save")}
                            </button>
                            <button
                              onClick={() => {
                                setDrafts((p) => {
                                  const n = { ...p };
                                  delete n[u.ID];
                                  return n;
                                });
                                setOpenRowId("");
                              }}
                              className="rounded-lg border border-[var(--border)] px-3 py-1.5 disabled:opacity-60"
                              disabled={rowBusy}
                            >
                              {t("cancel")}
                            </button>
                            <button
                              onClick={() => promptDeleteUnit(u)}
                              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-white/5 text-red-300 disabled:opacity-60"
                              disabled={rowBusy}
                              title={t("units.actions.delete")}
                            >
                              <IconTrash /> {t("units.actions.delete")}
                            </button>
                          </>
                        ) : (
                          <>
                         {canManage && (
  <button
    onClick={() => {
      setEditTarget(u);
      setEditOpen(true);
    }}
    className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:bg-white/5"
  >
    {t("buildings.actions.edit") || t("issues.actions.edit") || "Edit"}
  </button>
)}

                            {canManage && (
                              <button
                                onClick={() => promptDeleteUnit(u)}
                                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-white/5 text-red-300"
                                title={t("units.actions.delete")}
                              >
                                <IconTrash /> {t("units.actions.delete")}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* animated editor */}
                    {canManage && (
                      <Collapsible open={isOpen}>
                        <div
                          className={`mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-6 ${
                            rtl ? "text-right" : ""
                          }`}
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-sm text-[var(--muted)]">
                              {t("units.fields.block")}
                            </span>
                            <select
                              value={String(d.block_id ?? u.block_id ?? "")}
                              onChange={(e) =>
                                setDraft(u.ID, {
                                  block_id: e.target.value || "",
                                  block_name: "",
                                })
                              }
                              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
                            >
                              <option value="">—</option>
                              {(Array.isArray(blocks) ? blocks : [])
                                .filter(
                                  (b) =>
                                    String(b.building_id) ===
                                    String(u.building_id)
                                )
                                .map((b) => (
                                  <option key={b.ID} value={b.ID}>
                                    {b.name}
                                  </option>
                                ))}
                            </select>
                            <input
                              value={d.block_name ?? ""}
                              onChange={(e) =>
                                setDraft(u.ID, {
                                  block_name: e.target.value,
                                  block_id: "",
                                })
                              }
                              placeholder={t("units.add.orTypeNewBlock")}
                              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
                            />
                          </div>

                          {["floor", "bedrooms", "bathrooms", "sqm"].map(
                            (k) => (
                              <label key={k} className="flex flex-col gap-1">
                                <span className="text-sm text-[var(--muted)]">
                                  {t(`units.fields.${k}`)}
                                </span>
                                <input
                                  value={d[k] ?? u[k] ?? ""}
                                  onChange={(e) =>
                                    setDraft(u.ID, {
                                      [k]:
                                        k === "sqm"
                                          ? onlyDec(e.target.value)
                                          : onlyInt(e.target.value),
                                    })
                                  }
                                  inputMode="numeric"
                                  pattern={
                                    k === "sqm" ? "[0-9]*[.]?[0-9]*" : "[0-9]*"
                                  }
                                  className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
                                />
                              </label>
                            )
                          )}

                          <label className="flex flex-col gap-1">
                            <span className="text-sm text-[var(--muted)]">
                              {t("units.fields.status")}
                            </span>
                            <select
                              value={String(
                                d.status ?? u.status ?? "AVAILABLE"
                              )}
                              onChange={(e) =>
                                setDraft(u.ID, { status: e.target.value })
                              }
                              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
                            >
                              <option value="AVAILABLE">
                                {t("units.status.available")}
                              </option>
                              <option value="OCCUPIED">
                                {t("units.status.occupied")}
                              </option>
                              <option value="INACTIVE">
                                {t("units.status.inactive")}
                              </option>
                            </select>
                          </label>
                        </div>
                      </Collapsible>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* overlays */}
      <FilterPopup
        open={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
        initial={filterShape}
        buildings={buildings}
        blocks={blocks}
        t={t}
        dir={dir}
      />
<EditUnitModal
  open={editOpen}
  onClose={() => { setEditOpen(false); setEditTarget(null); }}
  onSave={saveRowFromModal}
  unit={editTarget}
  blocks={blocks}
  t={t}
  dir={dir}
  saving={savingId === editTarget?.ID}
/>



      <ConfirmToast
        open={confirmDel.open}
        title={t("units.confirm.deleteTitle")}
        message={
          confirmDel.unit
            ? t("units.confirm.deleteMsg").replace(
                "{{code}}",
                confirmDel.unit.unit_code || t("units.add.unit")
              )
            : ""
        }
        confirmText={t("units.confirm.delete")}
        cancelText={t("cancel")}
        danger
        onCancel={() => setConfirmDel({ open: false, unit: null })}
        onConfirm={() => {
          const u = confirmDel.unit;
          setConfirmDel({ open: false, unit: null });
          if (u) actuallyDeleteUnit(u);
        }}
      />
    </div>
  );
}
