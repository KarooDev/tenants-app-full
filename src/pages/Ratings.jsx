// src/pages/Ratings.jsx
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Card from "../components/ui/Card";
import { useAuth } from "../providers/AuthProvider";
import { ROLES } from "../constants/roles";
import { api } from "../api";
import { getStableIdToken } from "../lib/token";
import { getCached, setCached } from "../lib/warmCache";
import { useI18n } from "../providers/I18nProvider";

/* ========= constants ========= */
const CRITERIA = ["Management", "Maintenance", "Cleanliness", "Security", "Amenities"];
const TTL_BUILDINGS = 120_000;
const TTL_RATINGS =120_000;
const KEY_BUILDINGS = "buildings/list";
const keyRatings = (b, c, q = "") => `ratings/list?b=${b}&c=${c}&q=${encodeURIComponent(q || "")}`;

// cache returns undefined on miss/expired → treat non-nullish as fresh
const hasFresh = (key) => getCached(key) !== undefined && getCached(key) !== null;

/* ========= helpers ========= */
const safeT = (t, key, fallback) => {
  const v = t?.(key);
  return !v || v === key ? fallback : v;
};

function Stars({ value = 0, size = "md" }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const cls = size === "sm" ? "tracking-[.5px] text-[13px]" : "tracking-[1px]";
  return (
    <span className={cls}>
      {"★★★★★".slice(0, v)}
      <span className="opacity-30">{"★★★★★".slice(v)}</span>
    </span>
  );
}
function StarInput({ value, onChange, t }) {
  return (
    <div className="flex gap-1 items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="text-xl leading-none"
          aria-label={safeT(t, "ratings.nStars", `${n} stars`).replace("{n}", n)}
          title={safeT(t, "ratings.nStars", `${n} stars`).replace("{n}", n)}
        >
          <span className={n <= (value || 0) ? "" : "opacity-30"}>★</span>
        </button>
      ))}
    </div>
  );
}
function Badge({ children }) {
  return (
    <span
      className="px-2 py-[2px] rounded-full text-[11px] border"
      style={{ background: "rgba(255,255,255,.05)", color: "var(--muted)", borderColor: "var(--border)" }}
    >
      {children}
    </span>
  );
}

/* ========= tiny shimmer ========= */
function Shimmer({ className = "" }) {
  if (typeof document !== "undefined" && !document.getElementById("ratingsPulseKF")) {
    const style = document.createElement("style");
    style.id = "ratingsPulseKF";
    style.textContent = `
@keyframes ratingsPulse { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
`;
    document.head.appendChild(style);
  }
  return (
    <div
      className={className}
      style={{
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%)",
        backgroundSize: "400% 100%",
        animation: "ratingsPulse 1.2s ease-in-out infinite",
        borderRadius: "1rem",
      }}
    />
  );
}

/* ========= toolbar ========= */
function Toolbar({ q, setQ, onOpenFilters, activeCount, canRate, onAdd, t }) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={safeT(t, "ratings.toolbar.search", "Search comment, rater…")}
        className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full md:w-[360px]"
      />
      <button
        onClick={onOpenFilters}
        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5 relative"
      >
        {safeT(t, "filters", "Filters")}
        {activeCount > 0 && (
          <span className="ml-2 inline-flex items-center justify-center text-[11px] rounded-full px-2 py-[2px] bg-[var(--accent)] text-white">
            {activeCount}
          </span>
        )}
      </button>
      {canRate && (
        <button onClick={onAdd} className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white">
          {safeT(t, "ratings.actions.addRating", "Add rating")}
        </button>
      )}
    </div>
  );
}

/* ========= filters popup ========= */
function FilterPopup({ open, onClose, onApply, initial, buildings, t }) {
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial, open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const hasScrollbar = window.innerWidth > document.documentElement.clientWidth;
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
      <div className="fixed left-0 right-0 top-0 bottom-[-1px] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-[96vw] md:w-[640px] max-h-[90vh] overflow-auto p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-semibold">{safeT(t, "filters", "Filters")}</div>
            <div className="text-xs text-[var(--muted)]">{safeT(t, "ratings.toolbar.search", "Search")}</div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-white/5" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">{safeT(t, "ratings.toolbar.allBuildings", "All buildings")}</label>
            <select value={draft.building} onChange={(e) => update("building", e.target.value)}>
              <option value="ALL">{safeT(t, "ratings.toolbar.allBuildings", "All buildings")}</option>
              {(Array.isArray(buildings) ? buildings : []).map((b) => (
                <option key={b.ID} value={b.ID}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-select-wrap">
            <label className="block text-xs text-[var(--muted)] mb-1">{safeT(t, "ratings.toolbar.allCriteria", "All criteria")}</label>
            <select value={draft.criteria} onChange={(e) => update("criteria", e.target.value)}>
              <option value="ALL">{safeT(t, "ratings.toolbar.allCriteria", "All criteria")}</option>
              {CRITERIA.map((c) => (
                <option key={c} value={c}>
                  {safeT(t, `ratings.criteria.${c}`, c)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => onApply({ building: "ALL", criteria: "ALL" })}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            {safeT(t, "clearAll", "Clear all")}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5">
              {safeT(t, "cancel", "Cancel")}
            </button>
            <button onClick={() => onApply(draft)} className="rounded-lg px-3 py-2 text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-600)]">
              {safeT(t, "apply", "Apply")}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ========= compact editor ========= */
function RatingEditor({ open, initial, onCancel, onSave, buildings, user, t }) {
  const [form, setForm] = useState(initial || { criteria: CRITERIA[0], score: 0, comment: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(initial || { criteria: CRITERIA[0], score: 0, comment: "" }), [initial, open]);
  if (!open) return null;

  return (
    <Card className="p-4">
      <div className="text-base font-semibold mb-2">
        {initial?.ID ? safeT(t, "ratings.editor.editTitle", "Edit rating") : safeT(t, "ratings.editor.addTitle", "Add rating")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <select
          value={form.building_id || ""}
          onChange={(e) => setForm({ ...form, building_id: e.target.value })}
          className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
        >
          <option value="">{safeT(t, "ratings.editor.selectBuilding", "Select building")}</option>
          {buildings.map((b) => (
            <option key={b.ID} value={b.ID}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={form.criteria || CRITERIA[0]}
          onChange={(e) => setForm({ ...form, criteria: e.target.value })}
          className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2"
        >
          {CRITERIA.map((c) => (
            <option key={c} value={c}>
              {safeT(t, `ratings.criteria.${c}`, c)}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 border border-[var(--border)] rounded-lg px-3 py-2">
          <StarInput value={form.score || 0} onChange={(n) => setForm({ ...form, score: n })} t={t} />
          <span className="text-sm text-[var(--muted)]">{form.score || 0}/5</span>
        </div>

        <textarea
          value={form.comment || ""}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          placeholder={safeT(t, "ratings.editor.commentPH", "Write a short comment (optional)…")}
          rows={3}
          className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 md:col-span-3"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({
                ...form,
                criteria: form.criteria || CRITERIA[0],
                rater_user_id: user?.ID,
                rater_name: user?.full_name || user?.username || user?.email || safeT(t, "ratings.anonymous", "Anonymous"),
              });
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] disabled:opacity-50 text-white"
        >
          {safeT(t, saving ? "saving" : "save", saving ? "Saving…" : "Save")}
        </button>
        <button disabled={saving} onClick={onCancel} className="rounded-lg border border-[var(--border)] px-3 py-2">
          {safeT(t, "cancel", "Cancel")}
        </button>
      </div>
    </Card>
  );
}

/* ========= compact list row ========= */
function RatingRow({ r, buildingName, canEdit, onEdit, onDelete, isOwner, t }) {
  const dateStr = (() => {
    const d = new Date(r.created_at);
    return isNaN(d) ? "—" : d.toLocaleDateString();
  })();
  return (
    <Card className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium text-[14px]">{safeT(t, `ratings.criteria.${r.criteria}`, r.criteria)}</div>
            <Badge>{buildingName}</Badge>
            <Badge>{dateStr}</Badge>
          </div>
          <div className="mt-1">
            <Stars value={r.score} size="sm" />
          </div>
          {r.comment && (
            <div className="mt-1.5 text-[13px] opacity-90 line-clamp-2 break-words">
              {r.comment}
            </div>
          )}
          {(r.rater_name || r.rater_username) && (
            <div className="mt-1 text-[11px] text-[var(--muted)]">
              {safeT(t, "ratings.by", "by")} {r.rater_name || r.rater_username}
            </div>
          )}
        </div>

        {(canEdit || isOwner) && (
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => onEdit(r)} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-white/5">
              {safeT(t, "ratings.actions.edit", "Edit")}
            </button>
            <button onClick={() => onDelete(r)} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-white/5 text-red-300">
              {safeT(t, "ratings.actions.delete", "Delete")}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ========= page ========= */
export default function Ratings() {
  const { t, dir } = useI18n();
  const { user } = useAuth();
  const role = String(user?.role || "").toUpperCase();

  const canRate = [ROLES.TENANT, ROLES.OWNER, ROLES.ADMIN, ROLES.BUILDING_MGMT].includes(role);
  const canModerate = [ROLES.ADMIN, ROLES.BUILDING_MGMT].includes(role);

  const [q, setQ] = useState("");
  const [building, setBuilding] = useState("ALL");
  const [criteria, setCriteria] = useState("ALL");

  const scopedRatingsKey = keyRatings(building, criteria, q);

  // seed from cache to paint instantly
  const cachedBuildings = getCached(KEY_BUILDINGS);
  const cachedRatings = getCached(scopedRatingsKey);

  const [buildings, setBuildings] = useState(Array.isArray(cachedBuildings) ? cachedBuildings : []);
  const [items, setItems] = useState(Array.isArray(cachedRatings) ? cachedRatings : []);
  const [loading, setLoading] = useState(!hasFresh(scopedRatingsKey));
  const [error, setError] = useState("");
  const loadingRef = useRef(false);

  const [showFilters, setShowFilters] = useState(false);

  const loadAll = useCallback(
    async ({ soft = false } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setError("");
      if (!soft) setLoading(true);
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
            const bList = Array.isArray(bRes.items) ? bRes.items : [];
            setBuildings(bList);
            setCached(KEY_BUILDINGS, bList, TTL_BUILDINGS);
          }
        } catch {}

        // ratings
        let rRes;
        const params = {
          idToken,
          building_id: building !== "ALL" ? building : undefined,
          criteria: criteria !== "ALL" ? criteria : undefined,
          q: q || undefined,
          _t: Date.now(),
        };
        rRes = api.ratings?.list ? await api.ratings.list(params) : await api.get?.("ratings/list", params);

        if (!rRes?.ok && String(rRes?.error || "") === "not_authenticated") {
          idToken = await getStableIdToken();
          if (idToken) {
            rRes = api.ratings?.list ? await api.ratings.list({ ...params, idToken }) : await api.get?.("ratings/list", { ...params, idToken });
          }
        }

        if (!rRes?.ok) throw new Error(rRes?.error || "ratings_load_failed");
        const list = Array.isArray(rRes?.items) ? rRes.items : [];
        setItems(list);
        setCached(scopedRatingsKey, list, TTL_RATINGS);
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg !== "not_authenticated") setError(msg);
      } finally {
        if (!soft) setLoading(false);
        loadingRef.current = false;
      }
    },
    [building, criteria, q, scopedRatingsKey]
  );

  // initial + whenever filters/search change
  useEffect(() => {
    const fresh = hasFresh(scopedRatingsKey);
    const seeded = Array.isArray(cachedRatings) && cachedRatings.length > 0;
    setLoading(!fresh && !seeded);
    loadAll({ soft: fresh });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, criteria, q]);

  // client-side filter view (in addition to server filters)
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items || []).filter((r) => {
      if (building !== "ALL" && String(r.building_id) !== String(building)) return false;
      if (criteria !== "ALL" && r.criteria !== criteria) return false;
      if (!needle) return true;
      const bName = buildings.find((b) => String(b.ID) === String(r.building_id))?.name || "";
      const hay = `${r.comment || ""} ${r.rater_name || r.rater_username || ""} ${r.criteria} ${bName}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, building, criteria, buildings]);

  // summaries
  const averages = useMemo(() => {
    const byBld = new Map();
    (items || []).forEach((r) => {
      const k = String(r.building_id);
      const o = byBld.get(k) || { sum: 0, n: 0 };
      o.sum += Number(r.score || 0);
      o.n += 1;
      byBld.set(k, o);
    });
    return (buildings || []).map((b) => {
      const o = byBld.get(String(b.ID));
      const avg = o ? o.sum / o.n : 0;
      return { building: b, avg: Number.isFinite(avg) ? avg : 0, count: o?.n || 0 };
    });
  }, [items, buildings]);

  const myBuildingId = String(user?.building_id || "");
  const myBuildingAvg = useMemo(() => {
    if (!myBuildingId) return null;
    const relevant = (items || []).filter((r) => String(r.building_id) === myBuildingId);
    if (!relevant.length) return null;
    const s = relevant.reduce((a, r) => a + (Number(r.score) || 0), 0);
    return s / relevant.length;
  }, [items, myBuildingId]);

  const overallAvg = useMemo(() => {
    const n = (items || []).length;
    if (!n) return 0;
    const s = (items || []).reduce((a, r) => a + (Number(r.score) || 0), 0);
    return s / n;
  }, [items]);

  // editor state
  const [editing, setEditing] = useState(null);
  const [openEditor, setOpenEditor] = useState(false);
  const openAdd = () => {
    if (!canRate) return;
    setEditing(null);
    setOpenEditor(true);
  };
  const openEdit = (r) => {
    const isOwner = user?.ID && String(r.rater_user_id) === String(user.ID);
    if (!(canModerate || isOwner)) return;
    setEditing(r);
    setOpenEditor(true);
  };
  const cancelEdit = () => {
    setEditing(null);
    setOpenEditor(false);
  };

  async function saveRating(data) {
    if (!canRate && !canModerate) return;
    if (!data.building_id) return alert(safeT(t, "ratings.validation.selectBuilding", "Choose a building."));
    if (!data.criteria) return alert(safeT(t, "ratings.validation.selectCriterion", "Choose a criterion."));
    if (!data.score || data.score < 1) return alert(safeT(t, "ratings.validation.pickScore", "Pick a score (1–5)."));

    try {
      let idToken = await getStableIdToken();
      if (!idToken) return;

      const payload = {
        ...(editing ? { ID: editing.ID } : {}),
        building_id: data.building_id,
        criteria: data.criteria || CRITERIA[0],
        score: Number(data.score),
        comment: data.comment || "",
        rater_user_id: data.rater_user_id || user?.ID,
        rater_name:
          data.rater_name || user?.full_name || user?.username || user?.email || safeT(t, "ratings.anonymous", "Anonymous"),
        created_at: editing?.created_at || new Date().toISOString(),
      };

      let res = api.ratings?.save
        ? await api.ratings.save({ idToken, rating: payload })
        : await api.post?.("ratings/save", { idToken, rating: payload });

      if (!res?.ok && String(res?.error || "") === "not_authenticated") {
        idToken = await getStableIdToken();
        if (idToken) {
          res = api.ratings?.save
            ? await api.ratings.save({ idToken, rating: payload })
            : await api.post?.("ratings/save", { idToken, rating: payload });
        }
      }
      if (!res?.ok) throw new Error(res?.error || "save_failed");

      cancelEdit();
      // refresh current scope; keep instant feel by leaving cache as-is until load
      loadAll({ soft: true });
    } catch (e) {
      alert(e?.message || "Save failed");
    }
  }

  async function deleteRating(r) {
    const isOwner = user?.ID && String(r.rater_user_id) === String(user.ID);
    if (!(canModerate || isOwner)) return;
    if (!confirm(safeT(t, "ratings.confirm.delete", "Delete this rating?"))) return;
    try {
      let idToken = await getStableIdToken();
      if (!idToken) return;

      let res = api.ratings?.remove
        ? await api.ratings.remove({ idToken, id: r.ID })
        : await api.post?.("ratings/delete", { idToken, id: r.ID });

      if (!res?.ok && String(res?.error || "") === "not_authenticated") {
        idToken = await getStableIdToken();
        if (idToken) {
          res = api.ratings?.remove
            ? await api.ratings.remove({ idToken, id: r.ID })
            : await api.post?.("ratings/delete", { idToken, id: r.ID });
        }
      }
      if (!res?.ok) throw new Error(res?.error || "delete_failed");

      loadAll({ soft: true });
    } catch (e) {
      alert(e?.message || "Delete failed");
    }
  }

  const nameOf = (bid) => buildings.find((b) => String(b.ID) === String(bid))?.name || "—";
  const activeFiltersCount = (building !== "ALL") + (criteria !== "ALL");
  const filterShape = { building, criteria };
  const applyFilters = (next) => {
    setBuilding(next.building ?? "ALL");
    setCriteria(next.criteria ?? "ALL");
    setShowFilters(false);
  };

  return (
    <div className="space-y-6 md:space-y-7" dir={dir}>
      {/* header */}
      <div>
        <div className="text-sm text-[var(--muted)]">{safeT(t, "ratings.header.feedback", "Feedback")}</div>
        <h1 className="text-2xl font-semibold">{safeT(t, "ratings.title", "Ratings")}</h1>
      </div>

      {/* small KPI tiles */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 p-4">
          <div className="text-sm opacity-70">{safeT(t, "ratings.overall", "Overall rating")}</div>
          <div className="mt-1 flex items-center gap-2">
            <Stars value={Math.round(overallAvg)} size="sm" />
            <div className="text-xl font-semibold leading-tight">{items.length ? overallAvg.toFixed(2) : "—"} / 5</div>
          </div>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 p-4">
          <div className="text-sm opacity-70">{safeT(t, "ratings.myBuilding", "My building")} </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="text-xl font-semibold leading-tight">
              {myBuildingAvg != null ? `${myBuildingAvg.toFixed(2)} / 5` : "—"}
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 p-4 hidden md:block">
          <div className="text-sm opacity-70">{safeT(t, "ratings.reviews.label", "Reviews")}</div>
          <div className="mt-1 text-xl font-semibold leading-tight">{items.length}</div>
        </Card>
      </section>

      {/* toolbar */}
      <Toolbar
        q={q}
        setQ={setQ}
        onOpenFilters={() => setShowFilters(true)}
        activeCount={activeFiltersCount}
        canRate={canRate}
        onAdd={openAdd}
        t={t}
      />

      {/* active filter chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 -mt-1">
          {building !== "ALL" && <Badge>{safeT(t, "building", "Building")}: {nameOf(building)}</Badge>}
          {criteria !== "ALL" && <Badge>{safeT(t, "criterion", "Criterion")}: {safeT(t, `ratings.criteria.${criteria}`, criteria)}</Badge>}
          <button
            onClick={() => applyFilters({ building: "ALL", criteria: "ALL" })}
            className="ml-1 text-xs text-[var(--muted)] underline hover:no-underline"
          >
            {safeT(t, "clear", "Clear")}
          </button>
        </div>
      )}

      {/* per-building summary cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {loading ? (
          <>
            <Shimmer className="h-20 border border-[var(--border)]" />
            <Shimmer className="h-20 border border-[var(--border)]" />
            <Shimmer className="h-20 border border-[var(--border)] hidden md:block" />
          </>
        ) : averages.length ? (
          averages.map(({ building, avg, count }) => (
            <Card key={building.ID} className="p-3">
              <div className="text-sm text-[var(--muted)] truncate">{building.name}</div>
              <div className="mt-1 flex items-center gap-2">
                <Stars value={Math.round(avg)} size="sm" />
                <span className="text-sm opacity-80">{avg ? avg.toFixed(1) : "—"} / 5</span>
                <Badge>{count} {safeT(t, "ratings.reviews.label", "reviews")}</Badge>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-3">
            <div className="text-sm text-[var(--muted)]">{safeT(t, "ratings.empty", "No ratings yet.")}</div>
          </Card>
        )}
      </section>

      {/* editor */}
      <RatingEditor
        open={openEditor}
        initial={editing}
        onCancel={cancelEdit}
        onSave={saveRating}
        buildings={buildings}
        user={user}
        t={t}
      />

      {/* list */}
      {loading ? (
        <Card className="p-0 overflow-hidden">
          <div className="h-[2px] w-full bg-[var(--accent)]/70 animate-pulse" />
          <div className="p-3 space-y-2">
            <Shimmer className="h-14 border border-[var(--border)]" />
            <Shimmer className="h-14 border border-[var(--border)]" />
            <Shimmer className="h-14 border border-[var(--border)]" />
          </div>
        </Card>
      ) : error ? (
        <Card className="p-4 text-sm text-red-300">{error}</Card>
      ) : list.length === 0 ? (
        <Card className="p-6 text-center text-[var(--muted)]">{safeT(t, "ratings.empty", "No ratings match your filters.")}</Card>
      ) : (
        <div className="grid gap-2.5">
          {list.map((r) => (
            <RatingRow
              key={r.ID}
              r={r}
              buildingName={nameOf(r.building_id)}
              canEdit={canModerate}
              isOwner={user?.ID && String(r.rater_user_id) === String(user.ID)}
              onEdit={openEdit}
              onDelete={deleteRating}
              t={t}
            />
          ))}
        </div>
      )}

      {/* filters popup */}
      <FilterPopup
        open={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
        initial={{ building, criteria }}
        buildings={buildings}
        t={t}
      />
    </div>
  );
}
