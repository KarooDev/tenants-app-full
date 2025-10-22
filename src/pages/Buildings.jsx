// src/pages/Buildings.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../providers/AuthProvider";
import { getStableIdToken } from "../lib/token";
import { getCached, setCached } from "../lib/warmCache";
import { api } from "../api";
import { ROLES } from "../constants/roles";
import ManagerSwapModal from "../components/admin/ManagerSwapModal";
import { useI18n } from "../providers/I18nProvider";

/* -------------------- tiny helper: cache freshness -------------------- */
function hasFresh(key, ttlMs) {
  // getCached already enforces TTL; return truthy if still fresh
  const val = getCached(key, {}, ttlMs);
  return Array.isArray(val) ? val.length >= 0 : !!val;
}

/* ---------- tiny inline icons ---------- */
const IconTrash = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h12Z"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconEdit = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path d="M4 21h4l10.5-10.5a2.121 2.121 0 0 0-3-3L5 18v3zM14.5 6.5l3 3"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconPower = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
    <path d="M12 3v9m7.07-4.07a8 8 0 1 1-14.14 0" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ---------- toast confirm (seam fix) ---------- */
function ConfirmToast({
  open, title, message,
  confirmText, cancelText,
  onConfirm, onCancel, danger
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 h-[100dvh] bottom-[-1px] z-[60] flex items-end md:items-center justify-center pointer-events-none">
      <div className="absolute left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onCancel} />
      <div className="relative pointer-events-auto w-[92vw] md:w-[520px] card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4 mb-4 md:mb-0">
        <div className="text-base font-semibold">{title}</div>
        {message && <div className="text-sm text-[var(--muted)] mt-1">{message}</div>}
        <div className="mt-3 flex items-center gap-2 justify-end">
          <button onClick={onCancel} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-3 py-2 text-white ${danger ? "bg-red-600 hover:bg-red-700" : "bg-[var(--accent)] hover:bg-[var(--accent-600)]"}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- small UI helpers ---------- */
function Chip({ children }) {
  return (
    <span className="px-2 py-[3px] rounded-full text-xs"
      style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--border)" }}>
      {children}
    </span>
  );
}
function StatusBadge({ status, t }) {
  const on = String(status).toUpperCase() === "ACTIVE";
  return (
    <span className="px-2 py-[2px] rounded-full text-[11px] border"
      style={{
        background: on ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.04)",
        color: on ? "#7dd3a7" : "var(--muted)",
        borderColor: "var(--border)",
      }}>
      {on ? t("buildings.status.active") : t("buildings.status.inactive")}
    </span>
  );
}
function Notice({ kind = "info", title, children, onClose, t }) {
  const tone =
    kind === "warn"
      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
      : kind === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-200"
      : "border-[var(--border)] bg-white/5 text-[var(--muted)]";
  return (
    <div className={`card p-3 border ${tone} relative`}>
      {title && <div className="font-medium mb-1">{title}</div>}
      <div className="text-sm">{children}</div>
      {onClose && (
        <button onClick={onClose} className="absolute right-2 top-2 text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-white/5">
          {t("close")}
        </button>
      )}
    </div>
  );
}

/* ---------- pro toolbar: compact search + popup trigger ---------- */
function SearchBar({ q, setQ, onOpenFilters, activeCount, onRefresh, refreshing, t, dir }) {
  const rtl = dir === "rtl";
  return (
    <div className={`mb-4 ${rtl ? "text-right" : ""}`}>
      <div className={`flex items-center gap-2 ${rtl ? "flex-row-reverse" : ""}`}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("buildings.toolbar.search")}
          className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full md:w-[360px]"
        />
        <button
          onClick={onOpenFilters}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5 relative"
        >
          {t("filters")}
          {activeCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center text-[11px] rounded-full px-2 py-[2px] bg-[var(--accent)] text-white">
              {activeCount}
            </span>
          )}
        </button>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
          disabled={refreshing}
        >
          {refreshing ? t("buildings.toolbar.refreshing") : t("buildings.toolbar.refresh")}
        </button>
      </div>
    </div>
  );
}

/* ---------- filters popup (status only for now) ---------- */
import { useState as useStateReact, useEffect as useEffectReact } from "react";
function FilterPopup({ open, onClose, onApply, initial, t, dir }) {
  const [draft, setDraft] = useStateReact(initial);

  // keep in sync
  useEffectReact(() => setDraft(initial), [initial, open]);

  // scroll lock
  useEffectReact(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    if (sw > 0) document.body.style.paddingRight = `${sw}px`;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  if (!open) return null;
  const rtl = dir === "rtl";
  const update = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="fixed inset-0 h-[100dvh] z-[60] flex items-end md:items-center justify-center overscroll-contain" dir={dir}>
      <div className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[96vw] md:w-[520px] max-h-[90vh] overflow-auto card border border-[var(--border)] bg-[var(--panel)] shadow-xl rounded-xl p-4">
        <div className={`flex items-start justify-between ${rtl ? "flex-row-reverse" : ""}`}>
          <div>
            <div className="text-base font-semibold">{t("filters")}</div>
            <div className="text-xs text-[var(--muted)]">{t("buildings.manage")}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className={`mt-4 grid grid-cols-1 gap-3 ${rtl ? "text-right" : ""}`}>
          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">{t("buildings.status.all")}</label>
            <select
              value={draft.status}
              onChange={(e)=>update("status", e.target.value)}
            >
              <option value="ALL">{t("buildings.status.all")}</option>
              <option value="ACTIVE">{t("buildings.status.activeOnly")}</option>
              <option value="INACTIVE">{t("buildings.status.inactiveOnly")}</option>
            </select>
          </div>
        </div>

        <div className={`mt-4 flex items-center justify-between ${rtl ? "flex-row-reverse" : ""}`}>
          <button
            onClick={()=>onApply({ status: "ALL" })}
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
              onClick={()=>onApply(draft)}
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

/* ---------- list rows (now support inline editor like Units) ---------- */
function BuildingRow({
  b, onToggle, onDelete, onEdit, onReassign, canReassign, busy,
  isOpen, rowBusy, draft, setDraft, onSave, onCancel, t, dir
}) {
  const rtl = dir === "rtl";
  return (
    <div className={`card px-4 py-3 ${busy ? "opacity-60 pointer-events-none" : ""} ${isOpen ? "bg-black/5" : ""}`}>
      {/* Summary line */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className={`flex items-center gap-2 ${rtl ? "flex-row-reverse" : ""}`}>
            <div className="font-medium truncate">{b.name}</div>
            <StatusBadge status={b.status} t={t} />
          </div>
          <div className={`text-sm text-[var(--muted)] truncate ${rtl ? "text-right" : ""}`}>
            {b.address} • {b.city}{b.country ? `, ${b.country}` : ""}
          </div>
          <div className={`mt-1 flex items-center gap-2 text-xs text-[var(--muted)] ${rtl ? "flex-row-reverse" : ""}`}>
            {(b.units ?? 0)} {t("buildings.units")}
            {typeof b.units_active === "number" && (
              <>
                <span>•</span>
                <Chip>{b.units_active} {t("buildings.activeUnits")}</Chip>
              </>
            )}
            {b.management_user_id && (
              <>
                <span>•</span>
                <Chip>{t("buildings.mgrId")}: {b.management_user_id}</Chip>
              </>
            )}
          </div>
        </div>

        {/* Actions (switch to Save/Cancel when open) */}
        <div className={`flex items-center gap-2 self-start md:self-auto ${rtl ? "flex-row-reverse" : ""}`}>
          {isOpen ? (
            <>
              <button
                onClick={onSave}
                className="rounded-lg px-3 py-1 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-60"
                disabled={rowBusy}
              >
                {rowBusy ? t("saving") : t("save")}
              </button>
              <button
                onClick={onCancel}
                className="rounded-lg border border-[var(--border)] px-3 py-1 disabled:opacity-60"
                disabled={rowBusy}
              >
                {t("cancel")}
              </button>
            </>
          ) : (
            <>
              {canReassign && (
                <button
                  onClick={() => onReassign?.(b)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1 text-sm hover:bg-white/5"
                  title={t("buildings.actions.reassign")}
                >
                  {t("buildings.actions.reassign")}
                </button>
              )}
              <button onClick={() => onEdit(b)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1 text-sm hover:bg-white/5">
                <IconEdit /> {t("buildings.actions.edit")}
              </button>
              <button onClick={() => onToggle(b)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1 text-sm hover:bg-white/5">
                <IconPower />
                {String(b.status).toUpperCase() === "ACTIVE" ? t("buildings.actions.deactivate") : t("buildings.actions.activate")}
              </button>
              <button onClick={() => onDelete(b)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1 text-sm hover:bg-white/5 text-red-300">
                <IconTrash /> {t("buildings.actions.delete")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline editor */}
      {isOpen && (
        <div className={`mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 ${rtl ? "text-right" : ""}`}>
          {["name", "address", "city", "country"].map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-sm text-[var(--muted)]">{t(`common.${k}`)}</span>
              <input
                value={draft[k] ?? b[k] ?? (k === "country" ? "Lebanon" : "")}
                onChange={(e) => setDraft({ [k]: e.target.value })}
                className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
              />
            </label>
          ))}

          <label className="flex flex-col gap-1">
            <span className="text-sm text-[var(--muted)]">{t("buildings.status.label") || "Status"}</span>
            <select
              value={String(draft.status ?? b.status ?? "ACTIVE")}
              onChange={(e) => setDraft({ status: e.target.value })}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            >
              <option value="ACTIVE">{t("buildings.status.active")}</option>
              <option value="INACTIVE">{t("buildings.status.inactive")}</option>
            </select>
          </label>

          {/* Optional: link back to Advanced editor */}
          <div className={`${rtl ? "text-left" : "text-right"} md:col-span-2`}>
            <button
              type="button"
              onClick={() => onEdit(b)} // consumer can wire this to open modal if needed
              className="text-xs text-[var(--muted)] underline hover:no-underline"
              title={t("buildings.actions.edit")}
            >
              {t("buildings.editor.advanced") || "Advanced…"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- editor (unchanged UI) ---------- */
function EditPanel({ open, initial, onCancel, onSave, saving }) {
  const { t, dir } = useI18n();
  const rtl = dir === "rtl";
  const isNew = !initial?.ID;
  const [form, setForm] = useState(initial || {});
  useEffect(() => setForm(initial || {}), [initial]);

  // quick generator (create)
  const [blocks, setBlocks] = useState(1);
  const [perBlock, setPerBlock] = useState(["4"]);
  const [perBlockFloors, setPerBlockFloors] = useState([""]);
  useEffect(() => {
    const len = Math.max(1, Number(blocks || 1));
    setPerBlock((cur) => Array.from({ length: len }, (_, i) => cur[i] ?? "4"));
    setPerBlockFloors((cur) => Array.from({ length: len }, (_, i) => cur[i] ?? ""));
  }, [blocks]);

  // blocks editor (edit)
  const [blkLoading, setBlkLoading] = useState(false);
  const [blkItems, setBlkItems] = useState([]);
  const [blkDeletes, setBlkDeletes] = useState([]);
  const [blkError, setBlkError] = useState("");
  const [confirm, setConfirm] = useState({ open: false, idx: -1, id: "" });

  // units-to-add per block (edit)
  const [blkUnitsAdd, setBlkUnitsAdd] = useState([]); // strings
  const [blkMaxSeq, setBlkMaxSeq] = useState({});     // {blockNameUpper: maxNumber}

  // load blocks + units when panel opens for existing building
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!open || !initial?.ID || isNew) return;
      setBlkLoading(true); setBlkError("");
      try {
        const idToken = await getStableIdToken();

        // 1) blocks
        const res = await api.blocks.list({ idToken, building_id: initial.ID });
        if (!mounted) return;
        if (!res?.ok) throw new Error(res?.error || "blocks_load_failed");
        const rows = (res.items || []).map((b) => ({
          ID: b.ID, name: b.name || "", floors: String(b.floors || ""),
        }));
        setBlkItems(rows);
        setBlkUnitsAdd(rows.map(() => "")); // initialize

        // 2) units
        const unitsRes = await api.units.list({ idToken, building_id: initial.ID, limit: 2000 });
        if (!unitsRes?.ok) throw new Error(unitsRes?.error || "units_load_failed");
        const units = Array.isArray(unitsRes.items) ? unitsRes.items : [];

        const maxByBlock = {};
        for (const u of units) {
          const code = String(u.unit_code || "").trim();
          const m = code.match(/^([A-Za-z]+)-(\d{1,})$/);
          if (!m) continue;
          const blk = m[1].toUpperCase();
          const num = parseInt(m[2], 10);
          if (!Number.isFinite(num)) continue;
          maxByBlock[blk] = Math.max(maxByBlock[blk] || 0, num);
        }
        if (mounted) setBlkMaxSeq(maxByBlock);
      } catch (e) {
        if (!mounted) return;
        setBlkError(e.message || String(e));
      } finally {
        mounted && setBlkLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [open, initial?.ID, isNew]);

  if (!open) return null;

  return (
    <div className="card p-4 mb-4">
      <div className="text-lg font-semibold mb-2">
        {isNew ? t("buildings.editor.addTitle") : t("buildings.editor.editTitle")}
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${rtl ? "text-right" : ""}`}>
        {["name", "address", "city", "country"].map((k) => (
          <input
            key={k}
            value={form[k] ?? (k === "country" ? "Lebanon" : "")}
            onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            placeholder={t(`common.${k}`) || k[0].toUpperCase() + k.slice(1)}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
          />
        ))}
      </div>

      {/* EDIT mode: blocks */}
      {!isNew && (
        <div className="mt-4 space-y-3">
          <div className="text-sm font-medium">{t("buildings.editor.blocks")}</div>
          {blkLoading ? (
            <div className="text-sm text-[var(--muted)]">{t("buildings.loadingBlocks")}</div>
          ) : blkError ? (
            <div className="text-sm text-red-300">{blkError}</div>
          ) : (
            <>
              {blkItems.length > 1 && (
                <div className="text-xs text-[var(--muted)]">{t("buildings.editor.tipUnique")}</div>
              )}

              <div className="grid gap-2">
                {blkItems.map((b, i) => {
                  const name = (b.name || "").trim();
                  const dup = name && blkItems.some((x, idx) => idx !== i && (x.name || "").trim().toUpperCase() === name.toUpperCase());
                  const upName = (name || "").toUpperCase();
                  const nextStart = (blkMaxSeq[upName] || 0) + 1;

                  return (
                    <div key={b.ID || `new-${i}`} className="grid items-center gap-2"
                         style={{ gridTemplateColumns: "1fr 0.7fr 0.8fr auto" }}>
                      {/* Block name */}
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--muted)]">{t("buildings.editor.blockName")}</span>
                        <input
                          value={b.name}
                          onChange={(e) => {
                            const v = e.target.value;
                            setBlkItems((prev) => {
                              const next = [...prev]; next[i] = { ...next[i], name: v }; return next;
                            });
                          }}
                          className={`bg-transparent border rounded-lg px-3 py-2 ${dup ? "border-red-500/60" : "border-[var(--border)]"}`}
                          placeholder="A"
                        />
                        {dup && <span className="text-xs text-red-300 mt-1">{t("buildings.editor.nameUnique")}</span>}
                      </label>

                      {/* Floors */}
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--muted)]">{t("buildings.editor.floors")}</span>
                        <input
                          inputMode="numeric"
                          value={b.floors}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            setBlkItems((prev) => {
                              const next = [...prev]; next[i] = { ...next[i], floors: v }; return next;
                            });
                          }}
                          className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
                          placeholder="10"
                        />
                      </label>

                      {/* Add units */}
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--muted)]">
                          {t("buildings.editor.addUnitsPrefix")} {String(nextStart).padStart(2, "0")}
                        </span>
                        <input
                          inputMode="numeric"
                          value={blkUnitsAdd[i] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            setBlkUnitsAdd((prev) => {
                              const next = [...prev]; next[i] = v; return next;
                            });
                          }}
                          className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
                          placeholder="5"
                        />
                      </label>

                      <div className="flex items-end justify-end h-full">
                        <button
                          type="button"
                          onClick={() => setConfirm({ open: true, idx: i, id: b.ID || "" })}
                          className="opacity-60 hover:opacity-100 rounded-lg border border-[var(--border)] px-2 py-2"
                          title={t("buildings.editor.removeBlock")}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setBlkItems((prev) => [...prev, { ID: "", name: "", floors: "" }]);
                  setBlkUnitsAdd((prev) => [...prev, ""]);
                }}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
              >
                {t("buildings.editor.addBlock")}
              </button>
              <div className="text-xs text-[var(--muted)]">{t("buildings.editor.blocksOptional")}</div>
            </>
          )}
        </div>
      )}

      {/* CREATE mode quick gen */}
      {isNew && (
        <div className="mt-4 space-y-3">
          <div className="text-sm text-[var(--muted)]">{t("buildings.editor.quick")}</div>
          <label className="flex flex-col gap-1 max-w-[220px]">
            <span className="text-sm">{t("buildings.editor.howManyBlocks")}</span>
            <input
              type="number" min={1} value={blocks}
              onChange={(e) => setBlocks(Math.max(1, Number(e.target.value || 1)))}
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: Number(blocks || 1) }).map((_, i) => (
              <div key={i} className="grid gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm">{t("buildings.editor.unitsInBlock").replace("{{b}}", String.fromCharCode(65 + i))}</span>
                  <input
                    type="number" min={0} value={perBlock[i] ?? "0"}
                    onChange={(e) => {
                      const val = String(Math.max(0, Number(e.target.value || 0)));
                      setPerBlock((cur) => { const next = [...cur]; next[i] = val; return next; });
                    }}
                    className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">{t("buildings.editor.floorsInBlock").replace("{{b}}", String.fromCharCode(65 + i))}</span>
                  <input
                    type="number" min={0} value={perBlockFloors[i] ?? ""}
                    onChange={(e) => {
                      const val = String(Math.max(0, Number(e.target.value || 0) || ""));
                      setPerBlockFloors((cur) => { const next = [...cur]; next[i] = val; return next; });
                    }}
                    className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
                    placeholder="10"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="text-xs text-[var(--muted)]">
            {t("buildings.editor.patternTip")}
          </div>
        </div>
      )}

      <div className={`mt-3 flex items-center gap-2 ${rtl ? "flex-row-reverse" : ""}`}>
        <button
          onClick={() =>
            onSave(
              form,
              !initial?.ID ? { perBlock, perBlockFloors } : null,
              initial?.ID
                ? {
                    blocks: blkItems,
                    deletes: blkDeletes,
                    lookup: Object.fromEntries(blkItems.filter((b) => b.ID).map((b) => [b.ID, b.name || ""])),
                    _unitsAddCounts: blkUnitsAdd,
                    _maxSeqByBlock: blkMaxSeq,
                  }
                : null
            )
          }
          disabled={saving || !String(form.name ?? "").trim()}
          className={`rounded-lg px-3 py-2 ${saving ? "opacity-60" : ""} bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-60`}
        >
          {saving ? t("saving") : t("save")}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-[var(--border)] px-3 py-2">
          {t("cancel")}
        </button>
      </div>

      <ConfirmToast
        open={confirm.open}
        title={t("buildings.confirm.removeTitle")}
        message={t("buildings.confirm.removeMsg")}
        confirmText={t("buildings.confirm.remove")}
        cancelText={t("cancel")}
        danger
        onCancel={() => setConfirm({ open: false, idx: -1, id: "" })}
        onConfirm={() => {
          if (confirm.idx >= 0) {
            const item = blkItems[confirm.idx];
            setBlkItems((prev) => prev.filter((_, i) => i !== confirm.idx));
            setBlkUnitsAdd((prev) => prev.filter((_, i) => i !== confirm.idx));
            if (item?.ID) setBlkDeletes((prev) => (prev.includes(item.ID) ? prev : [...prev, item.ID]));
          }
          setConfirm({ open: false, idx: -1, id: "" });
        }}
      />
    </div>
  );
}

/* ---------- shimmering skeletons ---------- */
function RowSkeleton() {
  const bar = "rounded bg-[color-mix(in_oklab,var(--text)_12%,transparent)]";
  return (
    <div className="p-3 border border-[var(--border)] rounded-xl animate-pulse">
      <div className={`h-4 w-[60%] ${bar} mb-2`} />
      <div className={`h-3 w-[40%] ${bar}`} />
    </div>
  );
}
function BuildingsSkeleton({ rows = 6, showToolbar = true }) {
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
      {/* Toolbar skeleton */}
      {showToolbar && (
        <div className="mb-1 flex items-center gap-2">
          <Bar w={320} h={36} r={10} /> {/* search */}
          <Bar w={96}  h={36} r={10} /> {/* filters */}
          <Bar w={110} h={36} r={10} /> {/* refresh */}
        </div>
      )}

      {/* Cards list */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card px-4 py-3 border border-[var(--border)] rounded-xl">
          {/* Top line: title + status + actions */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Bar w={220} h={16} />
                <Chip w={78} />
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-[var(--muted)]">
                <Bar w={180} h={12} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Chip w={90} />
                <Chip w={110} />
                <Chip w={140} />
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <Bar w={88}  h={32} r={10} />
              <Bar w={112} h={32} r={10} />
              <Bar w={120} h={32} r={10} />
              <Bar w={104} h={32} r={10} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- main ---------- */
export default function Buildings() {
  const { t, dir } = useI18n();
  const { user, loading: authLoading } = useAuth();

  const canManage = [ROLES.ADMIN, ROLES.BUILDING_MGMT, ROLES.STAFF].includes(String(user?.role).toUpperCase());
  const isAdmin = String(user?.role).toUpperCase() === ROLES.ADMIN;

  const CACHE_KEY = "buildings/list";
  const TTL_MS = 120_000;

  // seed from cache (warm, paint instantly if present)
  const cachedInitial = Array.isArray(getCached(CACHE_KEY, {}, TTL_MS)) ? getCached(CACHE_KEY, {}, TTL_MS) : [];

  const [items, setItems] = useState(cachedInitial);
  const [loading, setLoading] = useState(cachedInitial.length === 0);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  // modal editor (kept for Add and advanced)
  const [editing, setEditing] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  const [saving, setSaving] = useState(false);
  const [creatingUnits, setCreatingUnits] = useState(false);
  const [creatingUnitsCount, setCreatingUnitsCount] = useState(0);

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapBuilding, setSwapBuilding] = useState(null);

  // filters popup
  const [showFilters, setShowFilters] = useState(false);

  // INLINE row edit state (like Units)
  const [rowSavingId, setRowSavingId] = useState("");
  const [openRowId, setOpenRowId] = useState("");
  const [drafts, setDrafts] = useState({});
  function setDraft(id, patch) {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }

  useEffect(() => { api.get?.("auth/health", { _t: Date.now() }).catch(()=>{}); }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const idToken = await getStableIdToken();
      if (!idToken) return;
      const res = await api.buildings.list({ idToken });
      if (!res?.ok) throw new Error(res?.error || "load_failed");
      const fresh = Array.isArray(res.items) ? res.items : [];
      setItems(fresh);
      // FIX: correct order (key, value, ttl)
      setCached(CACHE_KEY, fresh, TTL_MS);
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg !== "not_authenticated") setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // SOFT vs HARD load based on freshness
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    const fresh = hasFresh(CACHE_KEY, TTL_MS);

    if (!fresh && items.length === 0) {
      setLoading(true);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, load]);

  /* ---------- helpers ---------- */
  const safeItems = Array.isArray(items) ? items : [];
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return safeItems.filter((b) => {
      if (status !== "ALL" && String(b.status).toUpperCase() !== status) return false;
      if (!needle) return true;
      const hay = `${b.name} ${b.address} ${b.city} ${b.country}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [safeItems, q, status]);

  // filters meta
  const activeFiltersCount = useMemo(() => (status !== "ALL" ? 1 : 0), [status]);
  const filterShape = useMemo(() => ({ status }), [status]);
  function applyFilters(next) {
    setStatus(next.status ?? "ALL");
    setShowFilters(false);
  }

  function openAdd() { setEditing(null); setShowEditor(true); }
  function openEdit(b) { setEditing(b); setShowEditor(true); }
  function cancelEdit() { setEditing(null); setShowEditor(false); }
  function openSwap(b) { setSwapBuilding(b); setSwapOpen(true); }
  const newIdLocal = () => "BLD_" + Math.random().toString(16).slice(2, 8);

  /* ---------- INLINE save (like Units.saveRow) ---------- */
  async function saveRow(b) {
    try {
      setRowSavingId(b.ID);
      const idToken = await getStableIdToken();
      const d = drafts[b.ID] || {};

      const payload = {
        ...b,
        ...d,
        status: String(d.status ?? b.status ?? "ACTIVE").toUpperCase(),
        name: String(d.name ?? b.name ?? ""),
        address: String(d.address ?? b.address ?? ""),
        city: String(d.city ?? b.city ?? ""),
        country: String(d.country ?? b.country ?? ""),
      };

      const res = await api.buildings.save({ idToken, building: payload });
      if (!res?.ok) throw new Error(res?.error || "save_failed");

      setItems((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const next = base.map((x) => (x.ID === b.ID ? { ...x, ...res.item } : x));
        // FIX: correct order (key, value, ttl)
        setCached(CACHE_KEY, next, TTL_MS);
        return next;
      });

      setDrafts((prev) => { const n = { ...prev }; delete n[b.ID]; return n; });
      setOpenRowId("");
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setRowSavingId("");
    }
  }

  /* ---------- mutations (existing) ---------- */
  async function saveBuilding(data, generator, blockEdits) {
    try {
      setSaving(true);
      setBusyId(data.ID || "new");
      const idToken = await getStableIdToken();

      const payload = { ...data, ID: editing?.ID || data.ID || newIdLocal(), status: (editing?.status || data.status || "ACTIVE").toUpperCase() };
      const res = await api.buildings.save({ idToken, building: payload });
      if (!res?.ok) throw new Error(res?.error || "save_failed");
      const savedB = res.item;

      setItems((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const idx = base.findIndex((x) => x.ID === savedB.ID);
        if (idx >= 0) { 
          const next = [...base]; 
          next[idx] = { ...base[idx], ...savedB }; 
          // FIX
          setCached(CACHE_KEY, next, TTL_MS); 
          return next; 
        }
        const next = [savedB, ...base]; 
        // FIX
        setCached(CACHE_KEY, next, TTL_MS); 
        return next;
      });

      if (blockEdits) {
        const toDelete = Array.isArray(blockEdits.deletes) ? blockEdits.deletes : [];
        const seen = new Set();
        const upserts = (Array.isArray(blockEdits.blocks) ? blockEdits.blocks : [])
          .filter((b) => !b.ID || !toDelete.includes(b.ID))
          .map((b) => ({ ID: b.ID || undefined, name: String(b.name || "").trim(), floors: String(parseInt(b.floors || 0, 10) || "") }))
          .filter((b) => b.name)
          .filter((b) => { const k = b.name.toUpperCase(); if (seen.has(k)) return false; seen.add(k); return true; });

        const res2 = await api.buildings.editBlocks({ idToken, building_id: savedB.ID, upserts, deletes: toDelete });
        if (!res2?.ok) throw new Error(res2?.error || "edit_blocks_failed");

        const failed = res2.failed_deletes || [];
        if (failed.length) {
          const names = blockEdits.lookup || {};
          setNotice({
            kind: "warn",
            title: t("buildings.notices.someBlocks"),
            lines: failed.map((f) => (names[f.id] ? `${t("block")} “${names[f.id]}”` : t("aBlock"))),
          });
        }

        const counts = Array.isArray(blockEdits._unitsAddCounts) ? blockEdits._unitsAddCounts : [];
        const maxSeq = blockEdits._maxSeqByBlock || {};
        const unitsOut = [];

        upserts.forEach((blk, idx) => {
          const name = (blk.name || "").trim();
          const add = Math.max(0, Number(counts[idx] || 0));
          if (!name || add <= 0) return;
          const key = name.toUpperCase();
          let start = (maxSeq[key] || 0) + 1;
          for (let n = 0; n < add; n++) {
            const code = `${name}-${String(start++).padStart(2, "0")}`;
            unitsOut.push({ unit_code: code, block_name: name, status: "AVAILABLE" });
          }
        });

        (Array.isArray(blockEdits.blocks) ? blockEdits.blocks : []).forEach((blk, idx) => {
          if (blk.ID) {
            const name = String(blk.name || "").trim();
            const add = Math.max(0, Number(counts[idx] || 0));
            if (!name || add <= 0) return;
            const key = name.toUpperCase();
            let start = (maxSeq[key] || 0) + 1;
            for (let n = 0; n < add; n++) {
              const code = `${name}-${String(start++).padStart(2, "0")}`;
              unitsOut.push({ unit_code: code, block_name: name, status: "AVAILABLE" });
            }
          }
        });

        if (unitsOut.length) {
          setCreatingUnits(true); setCreatingUnitsCount(unitsOut.length);
          const batch = await api.units.batchSave({ idToken, building_id: savedB.ID, units: unitsOut });
          setCreatingUnits(false); setCreatingUnitsCount(0);
          if (!batch?.ok) throw new Error(batch?.error || "batch_failed");
        }

        try {
          const refreshed = await api.buildings.list({ idToken });
          if (refreshed?.ok) { 
            const next = Array.isArray(refreshed.items) ? refreshed.items : []; 
            setItems(next); 
            // FIX
            setCached(CACHE_KEY, next, TTL_MS); 
          }
        } catch {}
      }

      if (generator) {
        const perBlock = (generator.perBlock || []).map((x) => Math.max(0, Number(x || 0)));
        const perFloors = (generator.perBlockFloors || []).map((x) => String(x || "").trim());

        const upserts = perBlock.map((_, idx) => ({ name: String.fromCharCode(65 + idx), floors: perFloors[idx] || "" }));
        const resBlocks = await api.buildings.editBlocks({ idToken, building_id: savedB.ID, upserts, deletes: [] });
        if (!resBlocks?.ok) throw new Error(resBlocks?.error || "edit_blocks_failed");

        if (!perBlock.every((c) => c === 0)) {
          const unitsOut = [];
          perBlock.forEach((count, idx) => {
            const blk = String.fromCharCode(65 + idx);
            for (let i = 1; i <= count; i++) {
              unitsOut.push({ unit_code: `${blk}-${String(i).padStart(2, "0")}`, block_name: blk, status: "AVAILABLE" });
            }
          });
          if (unitsOut.length) {
            setCreatingUnits(true); setCreatingUnitsCount(unitsOut.length);
            const batch = await api.units.batchSave({ idToken, building_id: savedB.ID, units: unitsOut });
            setCreatingUnits(false); setCreatingUnitsCount(0);
            if (!batch?.ok) throw new Error(batch?.error || "batch_failed");
            const refreshed = await api.buildings.list({ idToken });
            if (refreshed?.ok) { 
              const next = Array.isArray(refreshed.items) ? refreshed.items : []; 
              setItems(next); 
              // FIX
              setCached(CACHE_KEY, next, TTL_MS); 
            }
            alert(`Created ${batch.created_units} unit(s).`);
          }
        }
      }

      cancelEdit();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSaving(false);
      setBusyId("");
    }
  }

  async function toggleStatus(b) {
    try {
      setBusyId(b.ID);
      setItems(prev => {
        const base = Array.isArray(prev) ? prev : [];
        const next = base.map(x =>
          x.ID === b.ID ? { ...x, status: String(x.status).toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE" } : x
        );
        // FIX
        setCached(CACHE_KEY, next, TTL_MS);
        return next;
      });

      const idToken = await getStableIdToken();
      const res = await api.buildings.toggle({ idToken, id: b.ID });
      if (!res?.ok) throw new Error(res?.error || "toggle_failed");

      setItems(prev => {
        const base = Array.isArray(prev) ? prev : [];
        const next = base.map(x => x.ID === b.ID ? { ...x, status: res.item.status } : x);
        // FIX
        setCached(CACHE_KEY, next, TTL_MS);
        return next;
      });
    } catch (e) {
      await load();
      alert(e.message || String(e));
    } finally {
      setBusyId("");
    }
  }

  const [confirmDelete, setConfirmDelete] = useState({ open: false, building: null });
  function promptDelete(b) { setConfirmDelete({ open: true, building: b }); }
  async function actuallyDeleteBuilding(b) {
    try {
      setBusyId(b.ID);
      setItems(prev => {
        const base = Array.isArray(prev) ? prev : [];
        const next = base.filter(x => x.ID !== b.ID);
        // FIX
        setCached(CACHE_KEY, next, TTL_MS);
        return next;
      });

      const idToken = await getStableIdToken();
      const res = await api.buildings.remove({ idToken, id: b.ID });
      if (!res?.ok) throw new Error(res?.error || "delete_failed");
    } catch (e) {
      await load();
      alert(e.message || String(e));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-4" dir={dir}>
      {/* Title */}
      <div className={`flex items-center justify-between ${dir === "rtl" ? "flex-row-reverse text-right" : ""}`}>
        <div>
          <div className="text-sm text-[var(--muted)]">{t("buildings.manage")}</div>
          <h1 className="text-2xl font-semibold">{t("buildings.title")}</h1>
        </div>
        {canManage && (
          <button onClick={openAdd} className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white">
            {t("buildings.add")}
          </button>
        )}
      </div>

      {notice && (
        <Notice kind={notice.kind} title={notice.title} onClose={() => setNotice(null)} t={t}>
          <div className="space-y-1">
            {(notice.lines || []).map((l, i) => (
              <div key={i}>
                {l} {t("buildings.notices.pleaseFix")}
              </div>
            ))}
          </div>
        </Notice>
      )}

      {/* Keep modal editor for Add / advanced editing */}
      {canManage && (
        <EditPanel open={showEditor} initial={editing} onCancel={cancelEdit} onSave={saveBuilding} saving={saving} />
      )}

      {creatingUnits && (
        <div className="card p-3 text-sm text-[var(--muted)]">
          {t("buildings.creating").replace("{{count}}", String(creatingUnitsCount))}
        </div>
      )}

      {/* pro toolbar: search + popup trigger */}
      <SearchBar
        q={q}
        setQ={setQ}
        onOpenFilters={() => setShowFilters(true)}
        activeCount={activeFiltersCount}
        onRefresh={() => { setRefreshing(true); Promise.resolve(load()).finally(() => setRefreshing(false)); }}
        refreshing={refreshing}
        t={t}
        dir={dir}
      />
      <FilterPopup
        open={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
        initial={filterShape}
        t={t}
        dir={dir}
      />
      {/* active chips */}
      {activeFiltersCount > 0 && (
        <div className={`-mt-2 ${dir === "rtl" ? "text-right" : ""}`}>
          {status !== "ALL" && (
            <Chip>
              {status === "ACTIVE" ? t("buildings.status.activeOnly") : t("buildings.status.inactiveOnly")}
            </Chip>
          )}
          <button
            onClick={() => applyFilters({ status: "ALL" })}
            className="ml-2 text-xs text-[var(--muted)] underline hover:no-underline"
          >
            {t("clear")}
          </button>
        </div>
      )}

{loading ? (
  <BuildingsSkeleton rows={6} />
) : error ? (
        <div className="card p-6 text-red-300 text-sm">{error}</div>
      ) : list.length === 0 ? (
        <div className="card p-6 text-center text-[var(--muted)]">
          {t("buildings.empty").replace("{{hint}}", canManage ? t("buildings.emptyHint") : "")}
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((b) => (
            <BuildingRow
              key={b.ID}
              b={b}
              busy={busyId === b.ID}
              // INLINE edit props
              isOpen={openRowId === b.ID}
              rowBusy={rowSavingId === b.ID || busyId === b.ID}
              draft={drafts[b.ID] || {}}
              setDraft={(patch) => setDraft(b.ID, patch)}
              onSave={() => saveRow(b)}
              onCancel={() => { setDrafts((p) => { const n = { ...p }; delete n[b.ID]; return n; }); setOpenRowId(""); }}

              // Click edit → open inline row (toggle). For Advanced, BuildingRow renders a small link that calls onEdit again; wire it to open the modal there:
              onEdit={(x) => {
                if (openRowId === b.ID) {
                  setOpenRowId("");
                } else {
                  setOpenRowId(b.ID);
                }
              }}

              onToggle={canManage ? toggleStatus : () => {}}
              onDelete={canManage ? promptDelete : () => {}}
              canReassign={isAdmin}
              onReassign={isAdmin ? (x) => openSwap(x) : undefined}
              t={t}
              dir={dir}
            />
          ))}
        </div>
      )}

      <ConfirmToast
        open={confirmDelete.open}
        title={t("buildings.confirm.deleteTitle")}
        message={
          confirmDelete.building
            ? t("buildings.confirm.deleteMsg").replace("{{name}}", confirmDelete.building.name)
            : ""
        }
        confirmText={t("buildings.confirm.delete")}
        cancelText={t("cancel")}
        danger
        onCancel={() => setConfirmDelete({ open: false, building: null })}
        onConfirm={() => {
          const b = confirmDelete.building;
          setConfirmDelete({ open: false, building: null });
          if (b) actuallyDeleteBuilding(b);
        }}
      />

      <ManagerSwapModal
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        idToken={undefined}
        building={swapBuilding}
        onTransferred={async (count) => {
          setNotice({ kind: "info", title: count === 1 ? t("buildings.reassigned1") : t("buildings.reassignedN").replace("{{n}}", String(count)) });
          try {
            const idToken = await getStableIdToken();
            const refreshed = await api.buildings.list({ idToken });
            if (refreshed?.ok) {
              const next = Array.isArray(refreshed.items) ? refreshed.items : [];
              setItems(next);
              // FIX
              setCached(CACHE_KEY, next, TTL_MS);
            }
          } catch {}
        }}
      />
    </div>
  );
}
