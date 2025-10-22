// src/pages/Profile.jsx
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../providers/AuthProvider";
import { getStableIdToken } from "../lib/token";
import { api } from "../api";
import { useI18n } from "../providers/I18nProvider";
import { getCached, withCache } from "../lib/warmCache";

/* ---------- small field layout ---------- */
function Field({ label, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 items-center">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function RolePill({ role }) {
  if (!role) return null;
  return (
    <span
      className="px-2 py-[2px] rounded-full text-[11px] border"
      style={{
        background: "rgba(34,197,94,.12)",
        color: "#7dd3a7",
        borderColor: "var(--border)",
      }}
    >
      {String(role).toUpperCase()}
    </span>
  );
}

export default function Profile() {
  const { t, dir, locale } = useI18n();
  const { user, refresh } = useAuth();

  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");

  // localize date helper
  const fmtDate = useMemo(
    () => (d) => {
      const date = new Date(d);
      return isNaN(+date) ? "—" : date.toLocaleString(locale);
    },
    [locale]
  );

  useEffect(() => {
    setForm({
      full_name: user?.full_name || "",
      phone: user?.phone || "",
    });
  }, [user]);

  // Load display names for building & unit (cache-first)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user) return;

        const LOADING =
          typeof t === "function" ? t("loading") || "Loading…" : "Loading…";

        // show tiny placeholders only if we actually have ids
        if (user.building_id) setBuildingName(LOADING);
        if (user.unit_id) setUnitLabel(LOADING);

        // 1) BUILDING NAME — try cache first
        if (user.building_id) {
          const bKey = "buildings/list";
          let buildings = getCached(bKey);

          if (!Array.isArray(buildings)) {
            const idToken = await getStableIdToken();
            const bRes = await withCache(
              bKey,
              { idToken },
              () => api.buildings.list({ idToken }),
              120_000
            );
            buildings = Array.isArray(bRes?.items) ? bRes.items : [];
          }

          if (!cancelled) {
            const b = (buildings || []).find(
              (x) => String(x.ID) === String(user.building_id)
            );
            setBuildingName(b?.name || String(user.building_id));
          }
        } else {
          setBuildingName("");
        }

        // 2) UNIT LABEL — prefer cached units/list scoped by building
        if (user.unit_id && user.building_id) {
          const idToken = await getStableIdToken();
          const uRes = await withCache(
            "units/list", // withCache should key with params internally
            { idToken, building_id: user.building_id, limit: 500 },
            () =>
              api.units.list({
                idToken,
                building_id: user.building_id,
                limit: 500,
              }),
            120_000
          );
          const units = Array.isArray(uRes?.items) ? uRes.items : [];
          if (!cancelled) {
            const u = units.find((x) => String(x.ID) === String(user.unit_id));
            setUnitLabel(u?.unit_code || String(user.unit_id));
          }
        } else if (user?.unit_id && !user?.building_id) {
          // Fallback: single-unit lookup when building is unknown
          const idToken = await getStableIdToken();
          const ures = await api.units.list({
            idToken,
            unit_id: user.unit_id,
            limit: 1,
          });
          const u = (ures?.items || [])[0];
          if (!cancelled) setUnitLabel(u?.unit_code || String(user.unit_id));
        } else {
          setUnitLabel("");
        }
      } catch {
        // best-effort only; show raw ids if available
        if (!cancelled) {
          if (user?.building_id) setBuildingName(String(user.building_id));
          if (user?.unit_id) setUnitLabel(String(user.unit_id));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, t]);

  async function onSave() {
    setMsg("");
    setSaving(true);
    try {
      const idToken = await getStableIdToken();
      const res = await api.users.update({
        idToken,
        full_name: form.full_name,
        phone: form.phone,
        // user_id optional; omit to update the caller themselves
      });
      if (!res?.ok) throw new Error(res?.error || "save_failed");
      setMsg(t("profile.saved"));
      refresh?.(); // re-pull session if supported
    } catch (e) {
      setMsg(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  const approved =
    String(user?.email_verified ?? "").toLowerCase() === "true" ||
    user?.email_verified === true;

  return (
    <div className="space-y-4" dir={dir}>
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-[var(--muted)]">
            {t("profile.header.account")}
          </div>
          <h1 className="text-2xl font-semibold">{t("profile.title")}</h1>
        </div>
        <RolePill role={user?.role} />
      </div>

      {/* identity card */}
      <div className="card p-4 space-y-3">
        <Field label={t("profile.fields.fullName")}>
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
            placeholder={t("profile.fields.yourNamePH")}
          />
        </Field>

        <Field label={t("profile.fields.phone")}>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
            placeholder={t("profile.fields.phonePH")}
          />
        </Field>

        <div className="pt-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-60"
          >
            {saving ? t("saving") : t("profile.actions.saveChanges")}
          </button>
          {msg && (
            <span className="ml-3 text-sm text-[var(--muted)]">{msg}</span>
          )}
        </div>
      </div>

      {/* meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card p-4 space-y-2">
          <div className="font-medium">{t("profile.header.account")}</div>
          <Field label={t("profile.fields.username")}>
            <div>{user?.username || "—"}</div>
          </Field>
          <Field label={t("profile.fields.email")}>
            <div>{user?.email || "—"}</div>
          </Field>
          <Field label={t("profile.fields.status")}>
            <span
              className="px-2 py-[2px] rounded-full text-[11px] border"
              style={{
                background:
                  String(user?.status).toUpperCase() === "ACTIVE"
                    ? "rgba(34,197,94,.12)"
                    : "rgba(255,255,255,.05)",
                color:
                  String(user?.status).toUpperCase() === "ACTIVE"
                    ? "#7dd3a7"
                    : "var(--muted)",
                borderColor: "var(--border)",
              }}
            >
              {String(user?.status || "—").toUpperCase()}
            </span>
          </Field>
          <Field label={t("profile.fields.approval")}>
            <span className="text-sm">
              {approved
                ? t("profile.approvalStates.approved")
                : t("profile.approvalStates.pending")}
            </span>
          </Field>
        </div>

        <div className="card p-4 space-y-2">
          <div className="font-medium">{t("profile.fields.building")}</div>
          <Field label={t("profile.fields.building")}>
            <div>
              {buildingName ||
                (user?.building_id ? String(user.building_id) : "—")}
            </div>
          </Field>
          <Field label={t("profile.fields.unit")}>
            <div>{unitLabel || "—"}</div>
          </Field>
          <Field label={t("profile.fields.lastLogin")}>
            <div>{user?.last_login_at ? fmtDate(user.last_login_at) : "—"}</div>
          </Field>
          <Field label={t("profile.fields.createdAt")}>
            <div>{user?.created_at ? fmtDate(user.created_at) : "—"}</div>
          </Field>
        </div>
      </div>
    </div>
  );
}
