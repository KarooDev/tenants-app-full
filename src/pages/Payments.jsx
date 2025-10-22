// src/pages/Payments.jsx
import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  startTransition,
} from "react";
import { useAuth } from "../providers/AuthProvider";
import { ROLES } from "../constants/roles";
import { api } from "../api";
import { getStableIdToken } from "../lib/token";
import { getBase } from "../api/core";
import { useI18n } from "../providers/I18nProvider";
import { getCached, setCached } from "../lib/warmCache";

/* ================= utilities ================ */
function useDebounce(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/* -------- enums (mirrors Sheets) -------- */
const CHARGE_STATUS = ["PENDING", "PAID", "OVERDUE", "CANCELLED"];
const METHODS = ["CASH", "CARD", "BANK_TRANSFER", "ONLINE"];

/* -------- small UI helpers -------- */
function Badge({ children, tone = "default", className = "" }) {
  const tones = {
    default: { bg: "rgba(16,24,40,.06)", fg: "#344054" },
    green: { bg: "rgba(34,197,94,.12)", fg: "#7dd3a7" },
    red: { bg: "rgba(239,68,68,.12)", fg: "#f39aa0" },
    amber: { bg: "rgba(245,158,11,.12)", fg: "#f5c16b" },
    blue: { bg: "rgba(59,130,246,.12)", fg: "#9ec5ff" },
    gray: { bg: "rgba(16,24,40,.06)", fg: "var(--muted)" },
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
const toneForStatus = (s) =>
  s === "PAID"
    ? "green"
    : s === "OVERDUE"
    ? "red"
    : s === "PENDING"
    ? "amber"
    : "gray";

/* ---------- icons (inline) ---------- */
function IconChevron({ open }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      className={`${open ? "rotate-90" : ""} transition-transform`}
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconReceipt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 3h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
      />
      <path
        d="M9 8h6M9 12h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------- toast confirm ---------- */
function ConfirmToast({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
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

const money = (n, cur = "USD") =>
  (n ?? 0).toLocaleString(undefined, { style: "currency", currency: cur });
const dateFmt = (v) => {
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleDateString();
};
// date-only in UTC, e.g. "2025-10-17"
const isoDateOnly = (v) => {
  const d = v ? new Date(v) : new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
};
/* Resolve a friendly unit label for a charge */
const unitLabelOf = (c, unitsCache) => {
  const direct =
    c.unit_code ?? c.unit?.unit_code ?? c.occupancy_unit_code ?? "";
  if (direct) return direct;

  const bid =
    c.building_id ??
    c.assignment_building_id ??
    c.occupancy_building_id ??
    c.unit?.building_id ??
    null;
  const cached = bid ? unitsCache.get(String(bid)) : null;
  const match = cached?.find?.((u) => String(u.ID) === String(c.unit_id));
  if (match?.unit_code) return match.unit_code;

  return "—";
};

/* ---------------- compact search + trigger ---------------- */
function SearchBar({
  q,
  setQ,
  onOpenFilters,
  activeCount,
  canAdd,
  onAddCharge,
  t,
  selectedCount = 0,
  onBulkRecord,
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        {/* existing search + filters … */}
        {selectedCount > 0 && (
          <button
            onClick={onBulkRecord}
            className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white"
          >
            {t("payments.bulk.cta", { n: selectedCount }) ||
              `Record ${selectedCount}`}
          </button>
        )}
        {canAdd && (
          <button
            onClick={onAddCharge}
            className="ml-auto rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white"
          >
            {t("payments.actions.addCharge")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- filters popup ---------------- */
function FilterPopup({ open, onClose, onApply, initial, buildings, t }) {
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

  return (
    <div className="fixed inset-0 h-[100dvh] z-[60] flex items-end md:items-center justify-center overscroll-contain">
      <div
        className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm"
        style={{ willChange: "transform" }}
        onClick={onClose}
      />
      <div className="relative w-[96vw] md:w-[640px] max-h-[90vh] overflow-auto card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-semibold">{t("filters")}</div>
            <div className="text-xs text-[var(--muted)]">
              {t("payments.toolbar.search")}
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

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Building */}
          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("payments.toolbar.allBuildings")}
            </label>
            <select
              value={draft.building}
              onChange={(e) => update("building", e.target.value)}
            >
              <option value="ALL">{t("payments.toolbar.allBuildings")}</option>
              {(Array.isArray(buildings) ? buildings : []).map((b) => (
                <option key={b.ID} value={b.ID}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("payments.toolbar.allStatuses")}
            </label>
            <select
              value={draft.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="ALL">{t("payments.toolbar.allStatuses")}</option>
              {CHARGE_STATUS.map((s) => (
                <option key={s} value={s}>
                  {t(`payments.status.${s}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">
              {t("month") || "Month"}
            </label>
            <input
              type="month"
              value={draft.month}
              onChange={(e) => update("month", e.target.value)}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-[170px]"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() =>
              onApply({
                building: "ALL",
                status: "ALL",
                month: new Date().toISOString().slice(0, 7),
              })
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

/* ============================================================= */
/* ============ GROUPING + PURE HELPERS (for caching) =========== */
/* ============================================================= */

function groupKeyOf(c) {
  return (
    c.group_id ||
    c.batch_id ||
    c.parent_id ||
    c.reference ||
    `${c.title || ""}|${c.building_id || ""}|${(c.due_date || "").slice(
      0,
      10
    )}|${c.currency || "USD"}`
  );
}
function rollupStatus(list) {
  let hasOverdue = false,
    hasPending = false,
    hasPaid = false,
    allCancelled = true;
  for (const c of list) {
    const s = String(c.status || "").toUpperCase();
    if (s !== "CANCELLED") allCancelled = false;
    if (s === "OVERDUE") hasOverdue = true;
    else if (s === "PENDING") hasPending = true;
    else if (s === "PAID") hasPaid = true;
  }
  if (hasOverdue) return "OVERDUE";
  if (hasPending) return "PENDING";
  if (hasPaid && !allCancelled) return "PAID";
  return "CANCELLED";
}

function buildGroups(list) {
  const map = new Map();
  for (const c of list) {
    const k = groupKeyOf(c);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(c);
  }
  const groups = [];
  map.forEach((items, k) => {
    const first = items[0] || {};
    const total = items.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const status = rollupStatus(items);
    groups.push({
      key: k,
      title: first.title || "—",
      building_id: first.building_id ?? first.unit?.building_id ?? null,
      due_date: first.due_date || null,
      currency: first.currency || "USD",
      total,
      status,
      items,
      reference: first.reference || "",
    });
  });
  groups.sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
  return groups;
}

function computeTotals(list) {
  const totals = { pending: 0, overdue: 0, paid: 0 };
  (Array.isArray(list) ? list : []).forEach((c) => {
    const amt = Number(c.amount) || 0;
    const s = String(c.status || "").toUpperCase();
    if (s === "PENDING") totals.pending += amt;
    else if (s === "OVERDUE") totals.overdue += amt;
    else if (s === "PAID") totals.paid += amt;
  });
  return totals;
}

/** Single hook used everywhere for grouping */
function useGrouped(list) {
  return useMemo(() => buildGroups(list), [list]);
}

/* ============================================================= */
/* ============ GROUPED TABLE ================================== */
/* ============================================================= */

function GroupedCharges({
  groups,
  buildingNameOf,
  unitLabelOfWrapped,
  canManage,
  onRecord,
  onEdit,
  onCancelRequest,
  t,
  onToggleGroup,
  // NEW
  selectable = false,
  isSelected,
  onToggleSelect,
  onToggleSelectGroup,
}) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (g) =>
    setOpen((prev) => {
      const next = new Set(prev);
      const willOpen = !next.has(g.key);
      willOpen ? next.add(g.key) : next.delete(g.key);
      if (willOpen) onToggleGroup?.(g);
      return next;
    });

  return (
    <div className="card overflow-hidden">
      {/* Desktop */}
      <div className="hidden md:block overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 sticky top-0 z-[1]">
            <tr>
              {selectable && <th className="px-3 py-3 w-[32px]"></th>}

              <th className="text-left font-semibold px-4 py-3 w-[36%]">
                {t("payments.charge")}
              </th>
              <th className="text-left font-semibold px-4 py-3 w-[22%]">
                {t("payments.labels.location") || "Location"}
              </th>
              <th className="text-left font-semibold px-4 py-3 w-[14%]">
                {t("payments.labels.due")}
              </th>
              <th className="text-left font-semibold px-4 py-3 w-[14%]">
                {t("payments.labels.amount") || "Amount"}
              </th>
              <th className="text-left font-semibold px-4 py-3 w-[10%]">
                {t("payments.labels.statusTitle")}
              </th>
              <th className="text-right font-semibold px-4 py-3 w-[4%]"></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const isOpen = open.has(g.key);
              const buildingName = buildingNameOf(g.building_id, g.items[0]);
              return (
                <FragmentRow key={g.key}>
                  <tr className="border-t border-[var(--border)] hover:bg-white/3">
                    {selectable && (
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          className="ui-checkbox"
                          aria-label={
                            t("payments.bulk.selectGroup") || "Select group"
                          }
                          onChange={() => onToggleSelectGroup?.(g)}
                          checked={g.items.every(
                            (c) =>
                              isSelected(String(c.ID)) ||
                              c.status === "PAID" ||
                              c.status === "CANCELLED"
                          )}
                          ref={(el) => {
                            if (!el) return;
                            const active = g.items.filter(
                              (c) =>
                                c.status !== "PAID" && c.status !== "CANCELLED"
                            );
                            const sel = active.filter((c) =>
                              isSelected(String(c.ID))
                            ).length;
                            el.indeterminate = sel > 0 && sel < active.length;
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}

                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => toggle(g)}
                          className="rounded-md border border-transparent hover:bg-white/5 p-1 -ml-1"
                          aria-expanded={isOpen}
                          aria-label="Toggle details"
                          title="Toggle details"
                        >
                          <IconChevron open={isOpen} />
                        </button>
                        <div className="font-medium truncate">{g.title}</div>
                        <Badge tone={toneForStatus(g.status)}>
                          {t(`payments.status.${g.status}`)}
                        </Badge>
                        <Badge tone="blue">
                          {g.reference
                            ? t("payments.labels.refWith", { ref: g.reference })
                            : "—"}
                        </Badge>
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="truncate">{buildingName}</div>
                      <div className="text-[12px] text-[var(--muted)]">
                        {g.items.length} {t("payments.labels.units") || "units"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {dateFmt(g.due_date)}
                    </td>
                    <td className="px-4 py-3 align-top font-medium">
                      {money(g.total, g.currency)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge tone={toneForStatus(g.status)}>
                        {t(`payments.status.${g.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        onClick={() => toggle(g)}
                        className="text-xs underline text-[var(--muted)] hover:no-underline"
                      >
                        {isOpen
                          ? t("payments.actions.hide") || "Hide"
                          : t("payments.actions.viewUnits") || "View units"}
                      </button>
                    </td>
                  </tr>

                  {isOpen &&
                    g.items.map((c) => {
                      const ulabel = unitLabelOfWrapped(c);
                      const isSettled =
                        c.status === "PAID" || c.status === "CANCELLED";
                      const showInvoice =
                        c.status !== "CANCELLED" && c.invoice_image_url;
                      return (
                        <tr
                          key={c.ID}
                          className="border-t border-[var(--border)] bg-white/[.02]"
                        >
                          {selectable && (
                            <td className="px-3 py-3 align-top">
                              {!(
                                c.status === "PAID" || c.status === "CANCELLED"
                              ) ? (
                                <input
                                  type="checkbox"
                                  className="ui-checkbox"
                                  aria-label={
                                    t("payments.bulk.selectCharge") ||
                                    "Select charge"
                                  }
                                  checked={isSelected(String(c.ID))}
                                  onChange={() => onToggleSelect(c.ID)}
                                />
                              ) : (
                                <span className="text-[11px] text-[var(--muted)]">
                                  —
                                </span>
                              )}
                            </td>
                          )}

                          <td className="px-4 py-3 align-top">
                            <div className="text-[12px] text-[var(--muted)]">
                              {t("payments.labels.unit")} {ulabel}
                            </div>
                            {c.notes && (
                              <div className="text-[12px] opacity-80 mt-1 line-clamp-1">
                                {c.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            {c.reference ? (
                              <Badge tone="blue">
                                {t("payments.labels.refWith", {
                                  ref: c.reference,
                                })}
                              </Badge>
                            ) : (
                              <span className="text-[12px] text-[var(--muted)]">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            {dateFmt(c.due_date)}
                          </td>
                          <td className="px-4 py-3 align-top font-medium">
                            {money(c.amount, c.currency)}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <Badge tone={toneForStatus(c.status)}>
                              {t(`payments.status.${c.status}`)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center justify-end gap-1">
                              {showInvoice && (
                                <a
                                  href={c.invoice_image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg border border-[var(--border)] p-1.5 hover:bg-white/5"
                                  title={t("payments.actions.invoice")}
                                  aria-label={t("payments.actions.invoice")}
                                >
                                  <IconReceipt />
                                </a>
                              )}
                              {canManage && !isSettled && (
                                <>
                                  <button
                                    onClick={() => onRecord(c)}
                                    className="rounded-lg border border-[var(--border)] px-2 py-1 hover:bg-white/5"
                                  >
                                    {t("payments.actions.recordShort") ||
                                      "Record"}
                                  </button>
                                  <button
                                    onClick={() => onEdit(c)}
                                    className="rounded-lg border border-[var(--border)] px-2 py-1 hover:bg-white/5"
                                  >
                                    {t("payments.actions.edit")}
                                  </button>
                                  <button
                                    onClick={() => onCancelRequest(c)}
                                    className="rounded-lg border border-[var(--border)] px-2 py-1 hover:bg-white/5 text-red-300"
                                  >
                                    {t("payments.actions.cancel")}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile (NO hooks inside map; reuse `open` state) */}
      <div className="md:hidden divide-y divide-[var(--border)]">
        {groups.map((g) => {
          const isOpen = open.has(g.key);
          const buildingName = buildingNameOf(g.building_id, g.items[0]);
          return (
            <div key={g.key} className="px-3 py-2">
              <button
                onClick={() => toggle(g)}
                className="w-full text-left flex items-start justify-between gap-3"
                aria-expanded={isOpen}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <IconChevron open={isOpen} />
                    {selectable && (
                      <input
                        type="checkbox"
                        className="ui-checkbox mr-1"
                        onChange={() => onToggleSelectGroup?.(g)}
                        checked={g.items.every(
                          (c) =>
                            isSelected(String(c.ID)) ||
                            c.status === "PAID" ||
                            c.status === "CANCELLED"
                        )}
                        ref={(el) => {
                          if (!el) return;
                          const active = g.items.filter(
                            (c) =>
                              c.status !== "PAID" && c.status !== "CANCELLED"
                          );
                          const sel = active.filter((c) =>
                            isSelected(String(c.ID))
                          ).length;
                          el.indeterminate = sel > 0 && sel < active.length;
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}

                    <div className="font-medium truncate">{g.title}</div>
                    <Badge tone={toneForStatus(g.status)}>
                      {t(`payments.status.${g.status}`)}
                    </Badge>
                  </div>
                  <div className="text-[12px] text-[var(--muted)] mt-0.5 line-clamp-2">
                    {buildingName} • {dateFmt(g.due_date)} •{" "}
                    {money(g.total, g.currency)} • {g.items.length}{" "}
                    {t("payments.labels.units") || "units"}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="mt-2 space-y-2">
                  {g.items.map((c) => {
                    const ulabel = unitLabelOfWrapped(c);
                    const isSettled =
                      c.status === "PAID" || c.status === "CANCELLED";
                    const showInvoice =
                      c.status !== "CANCELLED" && c.invoice_image_url;
                    return (
                      <div
                        key={c.ID}
                        className="rounded-lg border border-[var(--border)] p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            {selectable && !isSettled && (
                              <input
                                type="checkbox"
                                className="ui-checkbox mr-2"
                                checked={isSelected(String(c.ID))}
                                onChange={() => onToggleSelect(c.ID)}
                              />
                            )}

                            <div className="text-[12px] text-[var(--muted)]">
                              {t("payments.labels.unit")} {ulabel}
                            </div>
                            <div className="text-[12px] mt-0.5">
                              {dateFmt(c.due_date)} •{" "}
                              {money(c.amount, c.currency)}
                            </div>
                            <div className="mt-1">
                              <Badge tone={toneForStatus(c.status)}>
                                {t(`payments.status.${c.status}`)}
                              </Badge>
                              {c.reference && (
                                <Badge tone="blue" className="ml-1">
                                  {t("payments.labels.refWith", {
                                    ref: c.reference,
                                  })}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {showInvoice && (
                              <a
                                href={c.invoice_image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-[var(--border)] p-1.5 hover:bg-white/5"
                                title={t("payments.actions.invoice")}
                                aria-label={t("payments.actions.invoice")}
                              >
                                <IconReceipt />
                              </a>
                            )}
                            {canManage && !isSettled && (
                              <>
                                <button
                                  onClick={() => onRecord(c)}
                                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-white/5"
                                >
                                  {t("payments.actions.recordShort") ||
                                    "Record"}
                                </button>
                                <button
                                  onClick={() => onEdit(c)}
                                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-white/5"
                                >
                                  {t("payments.actions.edit")}
                                </button>
                                <button
                                  onClick={() => onCancelRequest(c)}
                                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-white/5 text-red-300"
                                >
                                  {t("payments.actions.cancel")}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {c.notes && (
                          <div className="text-[12px] opacity-80 mt-2">
                            {c.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FragmentRow({ children }) {
  return <>{children}</>;
}

/* -------- editors -------- */
/* -------- editors (modal) -------- */
function ChargeEditor({
  open,
  initial,
  onCancel,
  onSave,
  buildings,
  units,
  blocks,
  onBuildingChange,
  onBlockChange,
  canChooseBuilding,
  blockId,
  t,
}) {
  const [form, setForm] = useState(initial || {});
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [applyMode, setApplyMode] = useState(initial?.apply_mode || "UNIT");
  const [excludeIds, setExcludeIds] = useState(initial?.exclude_ids || []);
  const titleRef = useRef(null);

  // cleanup preview URL
  useEffect(
    () => () => {
      if (invoicePreview) URL.revokeObjectURL(invoicePreview);
    },
    [invoicePreview]
  );

  // seed on open/change
  useEffect(() => {
    setForm(initial || {});
    setApplyMode(initial?.apply_mode || "UNIT");
    setExcludeIds(initial?.exclude_ids || []);
    setInvoiceFile(null);
    setInvoicePreview(null);
  }, [initial, open]);

  // modal: lock scroll, focus first field, Esc to close
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tId = setTimeout(() => titleRef.current?.focus(), 0);
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(tId);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  const excludeToggle = (id) =>
    setExcludeIds((prev) => {
      const key = String(id);
      return prev.map(String).includes(key)
        ? prev.filter((x) => String(x) !== key)
        : [...prev.map(String), key];
    });

  return (
    <div className="fixed inset-0 h-[100dvh] z-[70] flex items-end md:items-center justify-center overscroll-contain">
      <div
        className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        className="relative w-[96vw] md:w-[760px] max-h-[92vh] overflow-auto card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4 mb-4 md:mb-0"
        aria-busy={saving ? "true" : "false"}
      >
        <div className="text-lg font-semibold mb-2">
          {initial?.ID
            ? t("payments.editor.editTitle")
            : t("payments.editor.addTitle")}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {canChooseBuilding && (
            <select
              value={form.building_id || ""}
              onChange={(e) => {
                const v = e.target.value;
                setForm({ ...form, building_id: v, unit_id: "" });
                onBuildingChange?.(v);
              }}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            >
              <option value="">{t("payments.editor.selectBuilding")}</option>
              {buildings.map((b) => (
                <option key={b.ID} value={b.ID}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <div className="ui-select-wrap">
            <select
              value={applyMode}
              onChange={(e) => setApplyMode(e.target.value)}
            >
              <option value="UNIT">{t("payments.editor.apply.single")}</option>
              <option value="SPLIT">{t("payments.editor.apply.split")}</option>
            </select>
          </div>

          {applyMode === "SPLIT" && (
            <div className="ui-select-wrap">
              <select
                value={blockId || ""}
                onChange={(e) => onBlockChange?.(e.target.value)}
              >
                <option value="">{t("payments.editor.selectBlock")}</option>
                {(blocks || []).map((bl) => (
                  <option key={bl.ID} value={bl.ID}>
                    {bl.name || bl.ID}
                  </option>
                ))}
              </select>
            </div>
          )}

          {applyMode === "SPLIT" && blockId && (
            <div className="md:col-span-3 border border-[var(--border)] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">
                  Units in this block ({(units || []).length})
                </div>
                <div className="text-xs text-[var(--muted)]">
                  Excluding {excludeIds.length}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setExcludeIds([])}
                  className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-white/5"
                >
                  Include all
                </button>
                <button
                  type="button"
                  onClick={() => setExcludeIds((units || []).map((u) => u.ID))}
                  className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-white/5"
                >
                  Exclude all
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-56 overflow-auto pr-1">
                {(units || []).map((u) => {
                  const id = String(u.ID);
                  const checked =
                    excludeIds.includes(id) || excludeIds.includes(u.ID);
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!!checked}
                        onChange={() => excludeToggle(id)}
                      />
                      <span className="truncate">{u.unit_code || "—"}</span>
                    </label>
                  );
                })}
              </div>

              {(units || []).length === 0 && (
                <div className="text-xs text-[var(--muted)]">
                  No units found for this block.
                </div>
              )}
            </div>
          )}

          {applyMode === "UNIT" && (
            <div className="ui-select-wrap">
              <select
                value={form.unit_id || ""}
                onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
              >
                <option value="">{t("payments.editor.selectUnit")}</option>
                {units.map((u) => (
                  <option key={u.ID} value={u.ID}>
                    {u.unit_code || "—"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            type="date"
            value={
              form.due_date
                ? new Date(form.due_date).toISOString().slice(0, 10)
                : ""
            }
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
          />

          <input
            ref={titleRef}
            value={form.title || ""}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t("payments.editor.titlePH")}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 md:col-span-2"
          />

          <input
            type="number"
            step="0.01"
            value={form.amount ?? ""}
            onChange={(e) =>
              setForm({ ...form, amount: parseFloat(e.target.value || 0) })
            }
            placeholder={
              applyMode === "SPLIT"
                ? t("payments.editor.amountTotalPH")
                : t("payments.editor.amountPH")
            }
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
          />

          <input
            value={form.currency || "USD"}
            onChange={(e) =>
              setForm({ ...form, currency: e.target.value.toUpperCase() })
            }
            placeholder={t("payments.editor.currencyPH")}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
          />

          <textarea
            value={form.notes || ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={t("payments.editor.notesPH")}
            rows={3}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 md:col-span-3"
          />

          {/* Invoice image */}
      {/* Invoice image */}
<div className="md:col-span-3">
  <div className="flex items-start gap-3">
    {/* Upload button */}
    <label className="rounded-lg border border-[var(--border)] px-3 py-2 cursor-pointer">
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          if (f) {
            const okType =
              /^image\//.test(f.type) || f.type === "application/pdf";
            const okSize = f.size <= 8 * 1024 * 1024;
            if (!okType) return alert(t("payments.editor.fileTypeErr"));
            if (!okSize) return alert(t("payments.editor.fileTooLargeErr"));
          }
          setInvoiceFile(f);
          if (invoicePreview) URL.revokeObjectURL(invoicePreview);
          setInvoicePreview(f ? URL.createObjectURL(f) : null);
        }}
      />
    </label>

    {/* Preview / current / hint */}
    <div className="flex-1">
      {/* If a new file is selected */}
      {invoiceFile && invoicePreview ? (
        <div className="relative inline-block">
          {/* Remove (×) */}
          <button
            type="button"
            onClick={() => {
              try {
                if (invoicePreview) URL.revokeObjectURL(invoicePreview);
              } catch {}
              setInvoiceFile(null);
              setInvoicePreview(null);
            }}
            className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center text-sm"
            aria-label={t("cancel")}
            title={t("cancel")}
          >
            ×
          </button>

          {/* Render image or a compact PDF preview */}
          {/^image\//.test(invoiceFile.type) ? (
            <a
              href={invoicePreview}
              target="_blank"
              rel="noreferrer"
              title="Open preview"
            >
              <img
                src={invoicePreview}
                alt="Invoice preview"
                className="h-24 rounded border border-[var(--border)]"
              />
            </a>
          ) : (
            <a
              href={invoicePreview}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded border border-[var(--border)] px-3 py-2"
              title="Open preview"
            >
              <span className="text-sm">PDF preview</span>
              <span className="text-xs text-[var(--muted)] truncate max-w-[220px]">
                {invoiceFile.name}
              </span>
            </a>
          )}
        </div>
      ) : initial?.invoice_image_url ? (
        // Existing invoice on the charge (view-only link)
        <a
          href={initial.invoice_image_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm underline"
        >
          {t("payments.editor.viewCurrentInvoice")}
        </a>
      ) : (
        // Hint when nothing is selected (new charge requires invoice)
        <span className="text-sm text-[var(--muted)]">
          {t("payments.editor.invoiceRequired")}
        </span>
      )}
    </div>
  </div>
</div>

        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-[var(--border)] px-3 py-2"
          >
            {t("cancel")}
          </button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  ...form,
                  apply_mode: applyMode,
                  exclude_ids: excludeIds,
                  __invoice_file: invoiceFile || null,
                });
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] disabled:opacity-50 text-white"
          >
            {saving ? t("saving") || "Saving…" : t("save") || "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- skeleton primitives ---------------- */
function Skel({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: "var(--skeleton, rgba(16,24,40,.08))" }}
    />
  );
}

function SkelBadge({ w = 64 }) {
  return (
    <div
      className="h-[18px] rounded-full border"
      style={{
        width: w,
        borderColor: "var(--border)",
        background: "var(--skeleton-strong, rgba(16,24,40,.12))",
      }}
    />
  );
}

/* ---------------- page-specific skeleton ---------------- */
function PaymentsSkeleton({
     selectable = false,
     rows = 5,
     showExpandedHint = false,
     innerRows = 0,
   }) {
  return (
    <div
      className="card overflow-hidden"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      {/* Desktop */}
      <div className="hidden md:block overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-[var(--panel)]/85 backdrop-blur">
            <tr>
              {selectable && <th className="px-3 py-3 w-[32px]"></th>}
              <th className="text-left font-semibold px-4 py-3 w-[36%]">
                <div className="flex items-center gap-2">
                  <Skel className="h-4 w-28" />
                </div>
              </th>
              <th className="text-left font-semibold px-4 py-3 w-[22%]">
                <Skel className="h-4 w-20" />
              </th>
              <th className="text-left font-semibold px-4 py-3 w-[14%]">
                <Skel className="h-4 w-12" />
              </th>
              <th className="text-left font-semibold px-4 py-3 w-[14%]">
                <Skel className="h-4 w-14" />
              </th>
              <th className="text-left font-semibold px-4 py-3 w-[10%]">
                <Skel className="h-4 w-12" />
              </th>
              <th className="text-right font-semibold px-4 py-3 w-[4%]"></th>
            </tr>
          </thead>
          <tbody>
          {Array.from({ length: rows }).map((_, i) => {
             const expanded = showExpandedHint && i === 1;
              return (
                <FragmentRow key={i}>
                  <tr className="border-t border-[var(--border)]">
                    {selectable && (
                      <td className="px-3 py-3 align-top">
                        <Skel className="h-4 w-4 rounded-sm" />
                      </td>
                    )}
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2 min-w-0">
                        <Skel className="h-5 w-5 rounded-md" />
                        <Skel className="h-4 w-40 flex-shrink-0" />
                        <SkelBadge w={64} />
                        <SkelBadge w={74} />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Skel className="h-4 w-32" />
                      <div className="mt-1">
                        <Skel className="h-3 w-20 rounded" />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Skel className="h-4 w-20" />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Skel className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <SkelBadge w={70} />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <Skel className="h-3 w-14 ml-auto rounded" />
                    </td>
                  </tr>

                  {expanded &&
                    Array.from({ length: innerRows }).map((_, k) => (
                      <tr
                        key={k}
                        className="border-t border-[var(--border)] bg-[rgba(16,24,40,.03)]"
                      >
                        {selectable && (
                          <td className="px-3 py-3 align-top">
                            <Skel className="h-4 w-4 rounded-sm" />
                          </td>
                        )}
                        <td className="px-4 py-3 align-top">
                          <Skel className="h-3 w-28 rounded" />
                          <div className="mt-1">
                            <Skel className="h-3 w-44 rounded" />
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <SkelBadge w={80} />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Skel className="h-3 w-16 rounded" />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Skel className="h-3 w-20 rounded" />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <SkelBadge w={64} />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center justify-end gap-1">
                            <Skel className="h-8 w-8 rounded-lg" />
                            <Skel className="h-7 w-16 rounded-lg" />
                            <Skel className="h-7 w-12 rounded-lg" />
                            <Skel className="h-7 w-16 rounded-lg" />
                          </div>
                        </td>
                      </tr>
                    ))}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-[var(--border)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-3 py-2">
            <div className="w-full text-left flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Skel className="h-5 w-5 rounded-md" />
                  <Skel className="h-4 w-40 rounded" />
                  <SkelBadge w={60} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[12px]">
                  <Skel className="h-3 w-28 rounded" />
                  <Skel className="h-3 w-16 rounded" />
                  <Skel className="h-3 w-24 rounded" />
                </div>
              </div>
            </div>

        {/* expanded hint */}
            {showExpandedHint && i === 1 && (
              <div className="mt-2 space-y-2">
{Array.from({ length: innerRows }).map((_, k) => (
                  <div
                    key={k}
                    className="rounded-lg border border-[var(--border)] p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Skel className="h-3 w-28 rounded" />
                        <div className="mt-1 flex items-center gap-2">
                          <Skel className="h-3 w-16 rounded" />
                          <Skel className="h-3 w-20 rounded" />
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <SkelBadge w={60} />
                          <SkelBadge w={54} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Skel className="h-8 w-8 rounded-lg" />
                        <Skel className="h-7 w-14 rounded-lg" />
                        <Skel className="h-7 w-12 rounded-lg" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Modal: Payment editor */
function PaymentModal({ open, charge, onCancel, onSave, t, saving }) {
  const [form, setForm] = useState({
    amount: charge?.amount,
    method: METHODS[0],
    reference: "",
  });
  const amountRef = useRef(null);

  // seed on charge change
  useEffect(() => {
    setForm({
      amount: charge?.amount,
      method: METHODS[0],
      reference: "",
    });
  }, [charge]);

  // lock body scroll + focus amount + Esc to close
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const tId = setTimeout(() => amountRef.current?.focus(), 0);

    function onKey(e) {
      if (e.key === "Escape") onCancel?.();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(tId);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open || !charge) return null;

  return (
    <div className="fixed inset-0 h-[100dvh] z-[70] flex items-end md:items-center justify-center overscroll-contain">
      <div
        className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-[92vw] md:w-[560px] card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4 mb-4 md:mb-0">
        <div className="text-lg font-semibold">
          {t("payments.paymentEditor.title", { title: charge.title })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <input
            ref={amountRef}
            type="number"
            step="0.01"
            value={form.amount ?? ""}
            onChange={(e) =>
              setForm({ ...form, amount: parseFloat(e.target.value || 0) })
            }
            placeholder={t("payments.paymentEditor.amount")}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
          />
          <select
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`payments.methods.${m}`)}
              </option>
            ))}
          </select>
          <input
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder={t("payments.paymentEditor.referencePH")}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-3 py-2"
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving}
            aria-busy={saving ? "true" : "false"}
            className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-50"
          >
            {saving
              ? t("saving") || "Saving…"
              : t("payments.actions.savePayment")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================== PAGE =============================== */
export default function Payments() {
  const { t, dir } = useI18n();
  const unitsCacheRef = useRef(new Map()); // building_id -> units[]
  const blocksCacheRef = useRef(new Map()); // building_id -> blocks[]
  const { user, loading: authLoading } = useAuth();
  // bulk selection + modal
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({
    done: 0,
    total: 0,
    errors: [],
  });
  const isSelected = useCallback(
    (id) => selectedIds.has(String(id)),
    [selectedIds]
  );
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelectGroup = useCallback((group) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const ids = group.items
        .filter((c) => c.status !== "PAID" && c.status !== "CANCELLED")
        .map((c) => String(c.ID));
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const role = String(user?.role || "").toUpperCase();

  const isTenantView = [ROLES.TENANT, ROLES.OWNER].includes(role);
  const canManage = [ROLES.ADMIN, ROLES.BUILDING_MGMT, ROLES.STAFF].includes(
    role
  );
  const canAdd = canManage;

  // ---- TTLs & cache keys ----
  const TTL_BUILDINGS = 5 * 60_000; // 5 min
  const TTL_CHARGES = 5 * 60_000; // 5 min
  const refreshKeyRef = useRef(0);
  const keyCharges = useCallback(
    (b, s, m) =>
      `charges/list?b=${b}&s=${s}&m=${m || ""}&rk=${refreshKeyRef.current}`,
    []
  );

  // filters
  const defaultMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [qRaw, setQRaw] = useState("");
  const q = useDebounce(qRaw, 250);
  const [building, setBuilding] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [month, setMonth] = useState(defaultMonth); // YYYY-MM

  // data (seed from persistent cache)
  const cachedBuildings = getCached("buildings/list");
  const scopedKey = keyCharges("ALL", "ALL", defaultMonth);
  const cachedScoped = getCached(scopedKey);

  const [buildings, setBuildings] = useState(
    Array.isArray(cachedBuildings) ? cachedBuildings : []
  );
  const [charges, setCharges] = useState(
    Array.isArray(cachedScoped?.list) ? cachedScoped.list : []
  );
  const [preGroups, setPreGroups] = useState(cachedScoped?.groups || null);
  const [preTotals, setPreTotals] = useState(cachedScoped?.totals || null);

  const buildingNameById = useMemo(() => {
    const m = new Map();
    (buildings || []).forEach((b) => m.set(String(b.ID), b.name || "—"));
    return m;
  }, [buildings]);

  // ui
  const [loading, setLoading] = useState(
    !(Array.isArray(cachedBuildings) && Array.isArray(cachedScoped?.list))
  );
  const [confirmCancel, setConfirmCancel] = useState({
    open: false,
    charge: null,
  });
  const [busyId, setBusyId] = useState("");
  const [savingPayment, setSavingPayment] = useState(false); // ← add here
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    refreshKeyRef.current = refreshKey;
  }, [refreshKey]);
  const [error, setError] = useState("");

  // popup state
  const [showFilters, setShowFilters] = useState(false);

  // editor-level state
  const [editorBlocks, setEditorBlocks] = useState([]);
  const [editorUnits, setEditorUnits] = useState([]);

  /* ----- loader (SWR: always soft refresh for instant paint) ----- */
  const loadAll = useCallback(async () => {
    setError("");
    try {
      const idToken1 = await getStableIdToken();
      if (!idToken1) return; // auth not ready; effect is gated by authLoading/user anyway

      // month → pass start/end
      let from = "",
        to = "";
      if (month) {
        const [y, m] = month.split("-").map(Number);
        const start = new Date(Date.UTC(y, m - 1, 1));
        const end = new Date(Date.UTC(y, m, 1));
        from = start.toISOString().slice(0, 10);
        to = end.toISOString().slice(0, 10);
      }

      // Parallel fetch
      const [bRes, cRes] = await Promise.all([
        api.buildings.list({ idToken: idToken1 }),
        api.charges.list({
          idToken: idToken1,
          building_id: building !== "ALL" ? building : undefined,
          status: status !== "ALL" ? status : undefined,
          due_from: from || undefined,
          due_to: to || undefined,
        }),
      ]);

      // Retry once on not_authenticated (token race on reload)
      let chargesRes = cRes;
      if (
        !chargesRes?.ok &&
        String(chargesRes?.error || "") === "not_authenticated"
      ) {
        const idToken2 = await getStableIdToken(); // refresh
        chargesRes = await api.charges.list({
          idToken: idToken2,
          building_id: building !== "ALL" ? building : undefined,
          status: status !== "ALL" ? status : undefined,
          due_from: from || undefined,
          due_to: to || undefined,
        });
      }

      if (bRes?.ok) {
        const bList = Array.isArray(bRes.items) ? bRes.items : [];
        setBuildings(bList);
        setCached("buildings/list", bList, TTL_BUILDINGS);
        if (building === "ALL" && bList.length === 1) {
          setBuilding(bList[0].ID);
        }
      }

      const rawList = Array.isArray(chargesRes?.items) ? chargesRes.items : [];
      const list = applyStickyPaid(rawList); // ← overlay optimistic PAID
      const derived = {
        list,
        groups: buildGroups(list),
        totals: computeTotals(list),
      };
      setCharges(list);
      setPreGroups(derived.groups);
      setPreTotals(derived.totals);
      setCached(keyCharges(building, status, month), derived, TTL_CHARGES);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [building, status, month, keyCharges, refreshKey]);
  // keep new Paid states sticky for a short window to avoid flicker
  const recentlyPaidRef = useRef(new Map()); // id -> timestamp (ms)
  const STICKY_MS = 8000; // keep optimistic PAID for 8s

  function markRecentlyPaid(id) {
    recentlyPaidRef.current.set(String(id), Date.now());
  }

  function applyStickyPaid(list) {
    const now = Date.now();
    // drop expired
    for (const [k, ts] of recentlyPaidRef.current) {
      if (now - ts > STICKY_MS) recentlyPaidRef.current.delete(k);
    }
    // overlay paid status
    return (list || []).map((c) =>
      recentlyPaidRef.current.has(String(c.ID)) ? { ...c, status: "PAID" } : c
    );
  }

  // Seed from cache then always soft-refresh
  useEffect(() => {
    if (authLoading || !user) return;

    const scopedKey2 = keyCharges(building, status, month);
    const seeded = getCached(scopedKey2);
    if (Array.isArray(seeded?.list)) {
      setCharges(seeded.list);
      setPreGroups(seeded.groups || null);
      setPreTotals(seeded.totals || null);
      setLoading(false);
    } else {
      setLoading(true);
    }
    // soft refresh (non-blocking)
    loadAll();
  }, [
    authLoading,
    user,
    building,
    status,
    month,
    keyCharges,
    loadAll,
    refreshKey,
  ]);

  // tenant/owner visibility guard
  const isMine = (c) => {
    const byUnitId =
      user?.unit_id && String(c.unit_id) === String(user.unit_id);
    const byUnitCode =
      user?.unit_code &&
      String(c.unit_code || "").toUpperCase() ===
        String(user.unit_code).toUpperCase();
    const byBuilding =
      !c.building_id ||
      !user?.building_id ||
      String(c.building_id) === String(user.building_id);
    return (byUnitId || byUnitCode) && byBuilding;
  };

  // helper: fetch blocks (editor)
  async function loadBlocksFor(buildingId) {
    if (!buildingId) {
      setEditorBlocks([]);
      return;
    }
    if (blocksCacheRef.current.has(String(buildingId))) {
      setEditorBlocks(blocksCacheRef.current.get(String(buildingId)) || []);
      return;
    }
    try {
      const idToken = await getStableIdToken();
      if (!idToken) return;
      const params = new URLSearchParams({ path: "blocks/list" });
      params.set("idToken", idToken);
      if (buildingId) params.set("building_id", buildingId);
      const r = await fetch(`${getBase()}?${params.toString()}`, {
        method: "GET",
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "blocks_list_failed");
      const items = j.items || [];
      blocksCacheRef.current.set(String(buildingId), items);
      setEditorBlocks(items);
    } catch {
      setEditorBlocks([]);
    }
  }
  function openBulkModal() {
    if (!canManage) return;
    if (selectedIds.size === 0) return;
    setShowBulkModal(true);
  }
  async function saveBulkPayments({ method, reference }) {
    if (!canManage || bulkSaving) return;
    const pick = (charges || []).filter(
      (c) =>
        selectedIds.has(String(c.ID)) &&
        c.status !== "PAID" &&
        c.status !== "CANCELLED"
    );
    if (pick.length === 0) {
      setShowBulkModal(false);
      return;
    }

    try {
      setBulkSaving(true);
      setBulkProgress({ done: 0, total: pick.length, errors: [] });

      const idToken = await getStableIdToken();
      if (!idToken) throw new Error("not_authenticated");

      // chunk to avoid hammering
      const CHUNK = 8;
      let done = 0;
      const errs = [];

      for (let i = 0; i < pick.length; i += CHUNK) {
        const slice = pick.slice(i, i + CHUNK);

        const results = await Promise.allSettled(
          slice.map((c) =>
            api.payments.record({
              idToken,
              payment: {
                charge_id: c.ID,
                amount: Number(c.amount || 0), // full amount
                currency: c.currency || "USD",
                method,
                reference: reference || "",
                paid_on: isoDateOnly(),
              },
            })
          )
        );

        results.forEach((r, idx) => {
          if (r.status === "rejected" || r.value?.ok === false) {
            const msg = (r.reason?.message || r.value?.error || "failed") + "";
            errs.push({ id: slice[idx].ID, error: msg });
          }
        });

        done += slice.length;
        setBulkProgress({
          done,
          total: pick.length,
          errors: errs.slice(0, 20),
        });
      }

      // optimistic flip for successes
      const successIds = new Set(
        pick
          .filter((c) => !errs.find((e) => String(e.id) === String(c.ID)))
          .map((c) => String(c.ID))
      );
      // mark them sticky to prevent any flicker on refresh
      successIds.forEach((id) => markRecentlyPaid(id));

      setCharges((prev) => {
        const next = (prev || []).map((c) =>
          successIds.has(String(c.ID)) ? { ...c, status: "PAID" } : c
        );
        const derived = {
          list: next,
          groups: buildGroups(next),
          totals: computeTotals(next),
        };
        setCached(keyCharges(building, status, month), derived, TTL_CHARGES);
        setPreGroups(derived.groups);
        setPreTotals(derived.totals);
        return next;
      });
      setShowBulkModal(false);
      clearSelection();

      // hard refresh to sync totals & caches
      await loadAll();

      if (errs.length > 0) {
        alert(
          `${t("payments.bulk.someFailed") || "Some payments failed"} (${
            errs.length
          })`
        );
      }
    } catch (e) {
      alert(e?.message || "Bulk payment failed");
    } finally {
      setBulkSaving(false);
      setBulkProgress({ done: 0, total: 0, errors: [] });
    }
  }
  function BulkPaymentModal({
    open,
    count,
    onCancel,
    onSave,
    t,
    saving,
    progress,
  }) {
    const [method, setMethod] = useState(METHODS[0]);
    const [reference, setReference] = useState("");

    useEffect(() => {
      if (!open) {
        setMethod(METHODS[0]);
        setReference("");
      }
    }, [open]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 h-[100dvh] z-[70] flex items-end md:items-center justify-center overscroll-contain">
        <div
          className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm"
          onClick={onCancel}
        />
        <div className="relative w-[92vw] md:w-[560px] card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4 mb-4 md:mb-0">
          <div className="text-lg font-semibold">
            {t("payments.bulk.title") || "Record payments in bulk"}
          </div>
          <div className="text-sm text-[var(--muted)] mt-1">
            {t("payments.bulk.count", { n: count }) ||
              `${count} selected charges will be marked Paid (full amount).`}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="ui-select-wrap">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`payments.methods.${m}`)}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("payments.paymentEditor.referencePH")}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            />
          </div>

          {saving && (
            <div className="mt-3 text-sm">
              <div className="flex items-center justify-between">
                <span>{t("payments.bulk.progress") || "Processing…"}</span>
                <span>
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="h-2 rounded bg-white/10 mt-1 overflow-hidden">
                <div
                  className="h-2 bg-[var(--accent)]"
                  style={{
                    width: progress.total
                      ? `${(progress.done / progress.total) * 100}%`
                      : "0%",
                  }}
                />
              </div>
              {progress.errors?.length > 0 && (
                <div className="mt-2 text-xs text-red-300">
                  {t("payments.bulk.errors") || "Errors:"}{" "}
                  {progress.errors.length}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-[var(--border)] px-3 py-2"
            >
              {t("cancel")}
            </button>
            <button
              onClick={() => onSave({ method, reference })}
              disabled={saving}
              className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-50"
            >
              {saving
                ? t("saving") || "Saving…"
                : t("payments.bulk.save") || "Record all"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // helper: fetch units (editor + label resolution)
  async function loadUnitsFor({ buildingId, blockId }) {
    if (!buildingId) {
      setEditorUnits([]);
      return;
    }
    try {
      const idToken = await getStableIdToken();
      if (!idToken) return;
      const params = new URLSearchParams({ path: "units/list" });
      params.set("idToken", idToken);
      params.set("building_id", buildingId);
      params.set("limit", "500");
      if (blockId) params.set("block_id", blockId);
      const r = await fetch(`${getBase()}?${params.toString()}`, {
        method: "GET",
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "units_list_failed");
      const items = (j?.items || []).map((u) => ({
        ...u,
        assignment_id:
          u.assignment_id ??
          u.occupancy_id ??
          u.current_assignment_id ??
          u.current_occupancy_id ??
          null,
      }));
      if (!blockId) unitsCacheRef.current.set(String(buildingId), items);
      setEditorUnits(items);
    } catch {
      setEditorUnits([]);
    }
  }

  // Filtered client-side (search/building/status/month)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (charges || [])
      .filter((c) => {
        if (
          isTenantView &&
          [ROLES.TENANT, ROLES.OWNER].includes(
            String(user?.role || "").toUpperCase()
          )
        ) {
          if (!isMine(c)) return false;
        }
        const cBuildingId =
          c.building_id ??
          c.assignment_building_id ??
          c.occupancy_building_id ??
          c.unit?.building_id ??
          null;

        if (
          building !== "ALL" &&
          cBuildingId &&
          String(cBuildingId) !== String(building)
        )
          return false;
        if (status !== "ALL" && c.status && String(c.status) !== status)
          return false;

        if (month) {
          const m =
            (c.due_date && String(c.due_date).slice(0, 7)) ||
            (() => {
              try {
                return new Date(c.due_date).toISOString().slice(0, 7);
              } catch {
                return "";
              }
            })();
          if (m !== month) return false;
        }

        if (!needle) return true;
        const bIdForName = cBuildingId ?? c.building_id;
        const bName = buildingNameById.get(String(bIdForName)) || "";
        const unitCode =
          c.unit_code ?? c.unit?.unit_code ?? c.occupancy_unit_code ?? "";
        const hay = `${c.reference || ""} ${unitCode} ${
          c.title || ""
        } ${bName}`.toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
  }, [
    charges,
    building,
    status,
    month,
    q,
    buildingNameById,
    user,
    isTenantView,
  ]);

  // Prefer precomputed groups/totals when filters align with the cached scope.
  const isScopeUnchanged =
    building === "ALL" &&
    status === "ALL" &&
    month === defaultMonth &&
    q.trim() === "";

  // Always call the hook to keep hook order stable
  const groupedComputed = useGrouped(filtered);

  const groups = isScopeUnchanged && preGroups ? preGroups : groupedComputed;
  const totals =
    isScopeUnchanged && preTotals ? preTotals : computeTotals(filtered);

  // editors
  const [editingCharge, setEditingCharge] = useState(null);
  const [showChargeEditor, setShowChargeEditor] = useState(false);
  const [recordFor, setRecordFor] = useState(null);

  const buildingNameOf = (idOrUndefined, c) => {
    const cBuildingId =
      idOrUndefined ??
      c?.assignment_building_id ??
      c?.occupancy_building_id ??
      c?.unit?.building_id ??
      null;
    return buildingNameById.get(String(cBuildingId)) || "—";
  };

  function openAddCharge() {
    if (!canAdd) return;
    setEditingCharge(null);
    setShowChargeEditor(true);
    setSelectedBlockId("");
    if (building && building !== "ALL") {
      loadBlocksFor(building);
      loadUnitsFor({ buildingId: building });
    } else {
      setEditorBlocks([]);
      setEditorUnits([]);
    }
  }
  function openEditCharge(c) {
    if (c && (c.status === "PAID" || c.status === "CANCELLED")) return;
    if (!canManage) return;
    setEditingCharge(c);
    setShowChargeEditor(true);
    setSelectedBlockId("");
    const b = c?.building_id || building;
    if (b) {
      loadBlocksFor(b);
      loadUnitsFor({ buildingId: b });
    }
  }
  function cancelChargeEdit() {
    setEditingCharge(null);
    setShowChargeEditor(false);
    setSelectedBlockId("");
  }

  async function saveCharge(data) {
    if (!canManage) return;
    if (!data.building_id)
      return alert(t("payments.validation.selectBuilding"));
    if (!data.title?.trim()) return alert(t("payments.validation.enterTitle"));
    if (!data.amount || data.amount <= 0)
      return alert(t("payments.validation.enterAmount"));

    const isEdit = !!editingCharge?.ID;
    if (!isEdit && !data.__invoice_file) {
      return alert(t("payments.validation.attachInvoice"));
    }

    try {
      const idToken = await getStableIdToken();
      if (!idToken) return;

      // Upload file if present → get URL
      let invoiceUrl = editingCharge?.invoice_image_url || "";
      if (data.__invoice_file) {
        const up = await api.files.uploadInvoice({
          idToken,
          file: data.__invoice_file,
          building_id: data.building_id,
        });
        invoiceUrl = up?.file_url || up?.web_view_link || "";
        if (!invoiceUrl) throw new Error("Upload failed: no URL returned");
      }

      if (data.apply_mode === "SPLIT") {
        if (!selectedBlockId)
          return alert(t("payments.validation.selectBlock"));
        await api.charges.createBlock({
          idToken,
          building_id: data.building_id,
          block_id: selectedBlockId,
          title: data.title,
          total_amount: Number(data.amount),
          currency: data.currency || "USD",
          due_date: data.due_date || new Date().toISOString(),
          notes: data.notes || "",
          exclude_unit_ids: (data.exclude_ids || []).map(String),
          invoice_image_url: invoiceUrl,
        });
      } else {
        if (!data.unit_id) return alert(t("payments.validation.selectUnit"));
        const picked = editorUnits.find(
          (u) => String(u.ID) === String(data.unit_id)
        );
        const payload = {
          ...(editingCharge ? { ID: editingCharge.ID } : {}),
          building_id: data.building_id,
          unit_id: data.unit_id,
          assignment_id: picked?.assignment_id || undefined,
          unit_code: picked?.unit_code ?? undefined,
          title: data.title,
          amount: Number(data.amount),
          currency: data.currency || "USD",
          due_date: data.due_date || new Date().toISOString(),
          notes: data.notes || "",
          status: editingCharge?.status || "PENDING",
          invoice_image_url: invoiceUrl,
        };
        await api.charges.save({ idToken, charge: payload });
      }

      cancelChargeEdit();
      setRefreshKey((k) => k + 1); // client cache bust only
    } catch (e) {
      alert(e?.message || "Save failed");
    }
  }

  // payments
  function recordPayment(c) {
    if (!(Number(c?.amount) > 0)) {
      alert(t("payments.validation.enterAmount"));
      return;
    }
    const st = String(c?.status || "").toUpperCase();
    if (st === "PAID" || st === "CANCELLED") {
      alert(
        t("payments.errors.invalidChargeStatus") ||
          "This charge can't be paid (already settled or cancelled)."
      );
      return;
    }
    if (!canManage) return;
    setRecordFor(c);
  }
  function cancelRecord() {
    setRecordFor(null);
  }
  async function savePayment(form) {
    if (savingPayment) return;

    const amt = Number(form.amount || recordFor?.amount || 0);
    if (!(amt > 0)) {
      alert(t("payments.validation.enterAmount"));
      return;
    }
    try {
      setSavingPayment(true);
      const idToken = await getStableIdToken();
      if (!idToken) return;

      await api.payments.record({
        idToken,
        payment: {
          charge_id: recordFor.ID,
          amount: amt,
          currency: recordFor.currency || "USD",
          method: form.method,
          reference: form.reference || "",
          paid_on: isoDateOnly(),
        },
      });

      // sticky-optimistic update
      const paidId = String(recordFor.ID);
      markRecentlyPaid(paidId);
      setCharges((prev) => {
        const next = (prev || []).map((c) =>
          String(c.ID) === paidId ? { ...c, status: "PAID" } : c
        );
        const derived = {
          list: next,
          groups: buildGroups(next),
          totals: computeTotals(next),
        };
        // write-through to cache for current scope so any seed uses the updated list
        setCached(keyCharges(building, status, month), derived, TTL_CHARGES);
        setPreGroups(derived.groups);
        setPreTotals(derived.totals);
        return next;
      });

      setRecordFor(null);

      // 🔸 hard refresh from server to keep cache + totals in sync
      await loadAll();
    } catch (e) {
      alert(e?.message || "Payment failed");
    } finally {
      setSavingPayment(false);
    }
  }

  function promptCancel(c) {
    if (!canManage) return;
    if (!c || c.status === "PAID" || c.status === "CANCELLED") return;
    setConfirmCancel({ open: true, charge: c });
  }

  async function cancelCharge(c) {
    if (!c || c.status === "PAID" || c.status === "CANCELLED") return;
    if (!canManage) return;
    try {
      setBusyId(c.ID);
      const idToken = await getStableIdToken();
      if (!idToken) return;
      (await api.charges.cancel?.({ idToken, id: c.ID })) ??
        api.charges.save({ idToken, charge: { ...c, status: "CANCELLED" } });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      alert(e?.message || "Cancel failed");
    } finally {
      setBusyId("");
    }
  }

  // callbacks passed to editor
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const handleBuildingChange = async (buildingId) => {
    setSelectedBlockId("");
    await loadBlocksFor(buildingId);
    await loadUnitsFor({ buildingId });
  };
  const handleBlockChange = async (blockId) => {
    setSelectedBlockId(blockId);
    const currentBuilding =
      building !== "ALL" ? building : buildings[0]?.ID || "";
    const b = currentBuilding;
    if (b) await loadUnitsFor({ buildingId: b, blockId });
  };

  // On-demand units fetch when expanding a group
  const handleToggleGroup = useCallback(async (g) => {
    const bid = String(g.building_id || g.items?.[0]?.unit?.building_id || "");
    if (!bid) return;
    if (!unitsCacheRef.current.has(bid)) {
      await loadUnitsFor({ buildingId: bid });
    }
  }, []);

  // ----- Idle-time prefetch likely next scopes (same month, first few buildings) -----
  useEffect(() => {
    let cancel = false;
    const handle =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(prefetch, { timeout: 1200 })
        : setTimeout(prefetch, 300);

    async function prefetch() {
      try {
        const idToken = await getStableIdToken();
        if (!idToken || cancel) return;

        let from = "",
          to = "";
        if (month) {
          const [y, m] = month.split("-").map(Number);
          const start = new Date(Date.UTC(y, m - 1, 1));
          const end = new Date(Date.UTC(y, m, 1));
          from = start.toISOString().slice(0, 10);
          to = end.toISOString().slice(0, 10);
        }

        (buildings || []).slice(0, 5).forEach(async (b) => {
          const k = keyCharges(b.ID, "ALL", month);
          if (getCached(k)) return;
          try {
            const r = await api.charges.list({
              idToken,
              building_id: b.ID,
              due_from: from,
              due_to: to,
            });
            const list = Array.isArray(r?.items) ? r.items : [];
            const derived = {
              list,
              groups: buildGroups(list),
              totals: computeTotals(list),
            };
            setCached(k, derived, TTL_CHARGES);
          } catch {}
        });
      } catch {}
    }

    return () => {
      cancel = true;
      if ("cancelIdleCallback" in window && typeof handle === "number") {
        // noop – environment handles cancellation
      } else if (typeof handle === "number") {
        clearTimeout(handle);
      }
    };
  }, [buildings, month, keyCharges, refreshKey]);

  // ----- active filters count & shape for popup -----
  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (building !== "ALL") c++;
    if (status !== "ALL") c++;
    if (month !== defaultMonth) c++;
    return c;
  }, [building, status, month, defaultMonth]);

  const filterShape = useMemo(
    () => ({ building, status, month }),
    [building, status, month]
  );

  function applyFilters(next) {
    startTransition(() => {
      setBuilding(next.building ?? "ALL");
      setStatus(next.status ?? "ALL");
      setMonth(next.month ?? defaultMonth);
      setShowFilters(false);
    });
  }

  const unitLabelOfWrapped = (c) => unitLabelOf(c, unitsCacheRef.current);

  return (
    <div className="space-y-4" dir={dir}>
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-[var(--muted)]">
            {t("payments.header.finance")}
          </div>
          <h1 className="text-2xl font-semibold">{t("payments.title")}</h1>
        </div>
      </div>

      {/* summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-sm text-[var(--muted)]">
            {t("payments.summaries.pending")}
          </div>
          <div className="text-xl font-semibold mt-1">
            {money(totals.pending, "USD")}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-[var(--muted)]">
            {t("payments.summaries.overdue")}
          </div>
          <div className="text-xl font-semibold mt-1">
            {money(totals.overdue, "USD")}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-[var(--muted)]">
            {t("payments.summaries.visible")}
          </div>
          <div className="text-xl font-semibold mt-1">
            {loading ? "…" : filtered.length}
          </div>
        </div>
      </div>

      {/* editors */}
      {canManage && (
        <ChargeEditor
          open={showChargeEditor}
          initial={editingCharge}
          onCancel={cancelChargeEdit}
          onSave={saveCharge}
          buildings={buildings}
          units={editorUnits}
          blocks={editorBlocks}
          onBuildingChange={handleBuildingChange}
          onBlockChange={handleBlockChange}
          canChooseBuilding
          blockId={selectedBlockId}
          t={t}
        />
      )}

      <PaymentModal
        open={canManage && !!recordFor}
        charge={recordFor}
        onCancel={cancelRecord}
        onSave={savePayment}
        t={t}
        saving={savingPayment}
      />
      {/* Bulk modal */}
      <BulkPaymentModal
        open={canManage && showBulkModal}
        count={[...selectedIds].length}
        onCancel={() => setShowBulkModal(false)}
        onSave={saveBulkPayments}
        t={t}
        saving={bulkSaving}
        progress={bulkProgress}
      />

      {/* compact top bar + popup */}
      <SearchBar
        q={qRaw}
        setQ={setQRaw}
        onOpenFilters={() => setShowFilters(true)}
        activeCount={activeFiltersCount}
        canAdd={canAdd}
        onAddCharge={openAddCharge}
        t={t}
        // NEW
        selectedCount={selectedIds.size}
        onBulkRecord={openBulkModal}
      />

      <FilterPopup
        open={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
        initial={filterShape}
        buildings={buildings}
        t={t}
      />

      {/* active filter chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          {building !== "ALL" && (
            <Badge tone="blue">
              {buildingNameById.get(String(building)) ||
                t("payments.toolbar.allBuildings")}
            </Badge>
          )}
          {status !== "ALL" && (
            <Badge tone={toneForStatus(status)}>
              {t(`payments.status.${status}`)}
            </Badge>
          )}
          {month !== defaultMonth && (
            <Badge>{(t("month") || "Month") + ": " + month}</Badge>
          )}
          <button
            onClick={() =>
              applyFilters({
                building: "ALL",
                status: "ALL",
                month: defaultMonth,
              })
            }
            className="ml-1 text-xs text-[var(--muted)] underline hover:no-underline"
          >
            {t("clear") || "Clear"}
          </button>
        </div>
      )}

      {/* list / states */}
      {loading ? (
  <PaymentsSkeleton selectable={canManage} /* showExpandedHint={false} */ />
      ) : error ? (
        <div className="card p-6 text-red-300 text-sm">{error}</div>
      ) : groups.length === 0 ? (
        <div className="card p-6 text-center text-[var(--muted)]">
          {t("payments.empty")}
        </div>
      ) : (
        <GroupedCharges
          groups={groups}
          buildingNameOf={buildingNameOf}
          unitLabelOfWrapped={unitLabelOfWrapped}
          canManage={canManage}
          onRecord={recordPayment}
          onEdit={canManage ? openEditCharge : () => {}}
          onCancelRequest={canManage ? promptCancel : () => {}}
          t={t}
          onToggleGroup={handleToggleGroup}
          // NEW
          selectable={canManage}
          isSelected={isSelected}
          onToggleSelect={toggleSelect}
          onToggleSelectGroup={toggleSelectGroup}
        />
      )}

      <ConfirmToast
        open={confirmCancel.open}
        title={t("payments.confirm.cancelChargeTitle") || "Cancel charge?"}
        message={
          confirmCancel.charge
            ? t("payments.confirm.cancelChargeMsg", {
                title: confirmCancel.charge.title,
              }) ||
              `“${
                confirmCancel.charge.title || t("payments.charge")
              }” will be marked as Cancelled.`
            : ""
        }
        confirmText={t("payments.actions.cancelNow") || "Cancel now"}
        cancelText={t("cancel")}
        danger
        onCancel={() => setConfirmCancel({ open: false, charge: null })}
        onConfirm={() => {
          const c = confirmCancel.charge;
          setConfirmCancel({ open: false, charge: null });
          if (c) cancelCharge(c);
        }}
      />
    </div>
  );
}
