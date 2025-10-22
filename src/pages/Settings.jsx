// src/pages/Settings.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { getStableIdToken } from "../lib/token";
import { api } from "../api";
import { ROLES } from "../constants/roles";
import { useI18n } from "../providers/I18nProvider";

/* ---------- tiny UI ---------- */
function StatusPill({ children, on = true }) {
  return (
    <span
      className="px-2 py-[2px] rounded-full text-[11px] border"
      style={{
        background: on ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.04)",
        color: on ? "#7dd3a7" : "var(--muted)",
        borderColor: "var(--border)",
      }}
    >
      {children}
    </span>
  );
}

/* ---------- invite list row ---------- */
function InviteRow({ inv, onRevoke, busy, t }) {
  const link =
    inv.signup_url ||
    `${window.location.origin}/sign-up?invite=${encodeURIComponent(
      inv.invite_code
    )}`;

  const statusUp = String(inv.invite_status || "").toUpperCase();
  const statusLabel =
    {
      INVITED: t("settings.approvals.invited"),
      REGISTERED: t("settings.approvals.registered"),
    }[statusUp] || inv.invite_status;

  return (
    <div
      className={`card px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between ${
        busy ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium truncate">
            {inv.username || inv.email || inv.invite_code}
          </div>
          <StatusPill on={statusUp === "INVITED"}>{statusLabel}</StatusPill>
        </div>
        <div className="text-sm text-[var(--muted)] truncate">
          {inv.role} • {inv.building_id || "—"}
          {inv.unit_id ? ` • ${inv.unit_id}` : ""} •{" "}
          {t("settings.invite.expires")}: {inv.expires_at || "—"}
        </div>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              alert(t("settings.invite.copiedAlert", { link }));
            } catch {
              window.prompt(t("settings.copyManually"), link);
            }
          }}
          className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm hover:bg-white/5"
        >
          {t("settings.invite.copyLink")}
        </button>
        <button
          onClick={() => onRevoke(inv)}
          disabled={busy}
          className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm hover:bg-white/5 text-red-300"
        >
          {t("settings.invite.revoke")}
        </button>
      </div>
    </div>
  );
}

/* ---------- language card ---------- */
function LanguageCard() {
  const { locale, setLocale, dir, t } = useI18n();
  const options = [
    { id: "en", label: t("en"), hint: t("settings.language.ltr") },
    { id: "ar", label: t("ar"), hint: t("settings.language.rtl") },
  ];

  return (
    <section className="card p-4 space-y-3">
      <div>
        <div className="font-medium">{t("settings.language.title")}</div>
        <div className="text-sm text-[var(--muted)]">
          {t("settings.language.help")}
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t("settings.language.title")}
        className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--panel)]"
      >
        {options.map((opt, i) => {
          const active = locale === opt.id;
          return (
            <button
              key={opt.id}
              role="tab"
              aria-selected={active}
              onClick={() => setLocale(opt.id)}
              className={[
                "px-4 py-2 text-sm focus:outline-none transition",
                active
                  ? "bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-600)]"
                  : "hover:bg-white/5 text-[var(--text)]/80",
                i === 0 ? "border-r border-[var(--border)]" : "",
              ].join(" ")}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-[11px] text-[var(--muted)]">{opt.hint}</div>
            </button>
          );
        })}
      </div>

      <div className="text-xs text-[var(--muted)]">
        {t("settings.language.direction")}: {dir.toUpperCase()}
      </div>
    </section>
  );
}

/* ---------- small form field helper ---------- */
function Field({ id, label, required, hint, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-[var(--muted)]">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint ? (
        <div className="text-[11px] text-[var(--muted)]">{hint}</div>
      ) : null}
    </div>
  );
}

/* ---------- error map (fallback messages for backend codes) ---------- */
const ERR_MAP = {
  email_in_use: "Email already in use — choose another.",
  user_already_registered: "Email already in use — choose another.",
  unit_inactive: "This unit is inactive.",
  unit_already_assigned: "This unit already has an active user for this role.",
  unit_already_has_invite: "There is already a pending invite for this unit.",
  out_of_scope_building: "You cannot invite for this building.",
  unit_not_in_building: "Selected unit does not belong to the building.",
  duplicate_unit_code: "Duplicate unit code.",
  forbidden: "You don’t have permission for this action.",
  building_and_unit_required: "Please select a building and a unit.",
  invalid_role: "Invalid role.",
  create_failed: "Could not create invite. Try again.",
};

/* Helper: tolerant translation (try two keys, then fallback text) */
const tt = (t, k1, k2, fb) => {
  const a = t(k1);
  if (a && a !== k1) return a;
  if (k2) {
    const b = t(k2);
    if (b && b !== k2) return b;
  }
  return fb;
};

/* ---------- invite panel (form + list) ---------- */
function InvitePanel({ currentUser }) {
  const { t } = useI18n();
  const roleUp = String(currentUser?.role || "").toUpperCase();
  const isAdmin = roleUp === ROLES.ADMIN;

  const [form, setForm] = useState({
    role: isAdmin ? ROLES.BUILDING_MGMT : ROLES.TENANT,
    email: "", // local-part only; @domain is appended
    username: "",
    expires_in_days: 7,
    building_id: currentUser?.building_id || "",
    unit_id: "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invites, setInvites] = useState([]);
  const [busyCode, setBusyCode] = useState("");

  // Email availability UI state
  const [emailStatus, setEmailStatus] = useState("idle");
  // 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'
  const [emailFull, setEmailFull] = useState("");

  // reference data
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);

  const canInviteThisRole = (r) => {
    const R = String(r).toUpperCase();
    if (isAdmin) return true;
    return R === ROLES.TENANT || R === ROLES.OWNER;
  };
  const roleOptions = useMemo(
    () => [
      ROLES.TENANT,
      ROLES.OWNER,
      ...(isAdmin ? [ROLES.BUILDING_MGMT, ROLES.STAFF] : []),
    ],
    [isAdmin]
  );

  /* --- email helpers & constants --- */
  const EMAIL_DOMAIN = "bineytna.com";
  function sanitizeEmailLocal(v = "") {
    const raw = String(v || "")
      .trim()
      .toLowerCase();
    const beforeAt = raw.split("@")[0];
    return beforeAt.replace(/\s+/g, "");
  }
  function isValidLocal(v = "") {
    return /^[a-z0-9._%+-]+$/i.test(v);
  }

  // Debounced email availability check (must be unique)
  useEffect(() => {
    const local = sanitizeEmailLocal(form.email || "");
    const full = local ? `${local}@${EMAIL_DOMAIN}` : "";
    setEmailFull(full);

    if (!local) {
      setEmailStatus("idle");
      return;
    }
    if (!isValidLocal(local)) {
      setEmailStatus("invalid");
      return;
    }

    let cancelled = false;
    setEmailStatus("checking");
    const timeoutId = setTimeout(async () => {
      try {
        const idToken = await getStableIdToken();
        const res = await api.users?.emailAvailability?.({
          idToken,
          email: full,
        });
        if (cancelled) return;
        if (res?.ok && typeof res.exists === "boolean") {
          setEmailStatus(res.exists ? "taken" : "available");
        } else {
          setEmailStatus("error");
        }
      } catch {
        if (!cancelled) setEmailStatus("error");
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [form.email]);

  const emailOk = Boolean(emailFull) && emailStatus === "available";

  /* --- derived booleans --- */
  const needsUnit = useMemo(() => {
    const R = String(form.role || "").toUpperCase();
    return R === ROLES.TENANT || R === ROLES.OWNER;
  }, [form.role]);

  /* --- eligible units (UI filter) --- */
  const eligibleUnits = useMemo(() => {
    const R = String(form.role || "").toUpperCase();
    const wantTenant = R === ROLES.TENANT;
    const wantOwner = R === ROLES.OWNER;

    const blockedByPendingInvite = new Set(
      (invites || [])
        .filter(
          (i) =>
            String(i.invite_status).toUpperCase() === "INVITED" &&
            String(i.role || "").toUpperCase() === R
        )
        .map((i) => String(i.unit_id || ""))
    );

    return (units || []).filter((u) => {
      const stat = String(u.status ?? u.unit_status ?? "").toUpperCase();
      const hasTenant =
        Boolean(
          u.current_tenant_user_id ??
            u.tenant_user_id ??
            u.current_assignment_id ??
            u.current_occupancy_id ??
            u.occupancy_id
        ) || stat === "OCCUPIED";

      const hasOwner = Boolean(u.current_owner_user_id ?? u.owner_user_id);

      if (stat === "INACTIVE") return false;
      if (blockedByPendingInvite.has(String(u.ID))) return false;
      if (wantTenant && hasTenant) return false;
      if (wantOwner && hasOwner) return false;
      return true;
    });
  }, [units, form.role, invites]);

  /* --- load invites + buildings initially --- */
  useEffect(() => {
    (async () => {
      try {
        const idToken = await getStableIdToken();
        const [inv, bld] = await Promise.all([
          api.invitations.list({ idToken }),
          api.buildings.list({ idToken }),
        ]);
        if (inv?.ok) setInvites(inv.items || []);
        if (bld?.ok) {
          const vis = bld.items || [];
          setBuildings(vis);
          if (!isAdmin && !form.building_id && vis[0]) {
            setForm((f) => ({ ...f, building_id: vis[0].ID }));
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [isAdmin]);

  /* --- load units when role/building changes (TENANT/OWNER only) --- */
  useEffect(() => {
    (async () => {
      if (!needsUnit || !form.building_id) {
        setUnits([]);
        return;
      }
      try {
        const idToken = await getStableIdToken();
        const R = String(form.role || "").toUpperCase();
        const statusFilter = R === ROLES.TENANT ? "AVAILABLE" : undefined;

        const res = await api.units.list({
          idToken,
          building_id: form.building_id,
          limit: 200,
          ...(statusFilter ? { status: statusFilter } : {}),
        });

        setUnits(res?.items || []);
      } catch {
        setUnits([]);
      }
    })();
  }, [needsUnit, form.building_id, form.role]);

  /* --- helpers --- */
  async function loadInvites() {
    try {
      const idToken = await getStableIdToken();
      const res = await api.invitations.list({ idToken });
      if (res?.ok) setInvites(res.items || []);
    } catch {
      /* ignore */
    }
  }

  /* --- actions --- */
  async function onCreate() {
    setBusy(true);
    setError("");

    try {
      if (!emailFull) {
        throw new Error(
          tt(t, "settings.invite.errors.emailRequired", null, "Email required")
        );
      }
      if (emailStatus === "invalid") {
        throw new Error(
          tt(
            t,
            "settings.invalidEmailLocal",
            "settings.invite.invalidEmailLocal",
            "Use letters, numbers, and ._%+- only."
          )
        );
      }
      if (emailStatus === "taken") {
        throw new Error(
          tt(
            t,
            "settings.emailTakenChooseAnother",
            "settings.invite.emailTakenChooseAnother",
            "Email already in use — choose another."
          )
        );
      }
    } catch (e) {
      setError(e.message || String(e));
      setBusy(false);
      return;
    }

    try {
      if (!form.username)
        throw new Error(t("settings.invite.errors.usernameRequired"));
      if (!canInviteThisRole(form.role))
        throw new Error(t("settings.invite.errors.notAllowed"));

      if (Number(form.expires_in_days) < 1)
        throw new Error(t("settings.invite.expiresPH") || "Invalid expiry");

      if (needsUnit) {
        if (!form.building_id)
          throw new Error(t("settings.invite.errors.selectBuilding"));
        if (!form.unit_id)
          throw new Error(t("settings.invite.errors.selectUnit"));
      }

      const local = sanitizeEmailLocal(form.email || "");
      const email = `${local}@${EMAIL_DOMAIN}`;
      if (!isValidLocal(local)) {
        throw new Error(
          tt(
            t,
            "settings.invalidEmailLocal",
            "settings.invite.invalidEmailLocal",
            "Invalid email username."
          )
        );
      }

      const idToken = await getStableIdToken();
      const res = await api.invitations.create({
        idToken,
        role: form.role,
        email,
        username: form.username,
        expires_in_days: Number(form.expires_in_days || 7),
        building_id: needsUnit ? form.building_id : undefined,
        unit_id: needsUnit ? form.unit_id : undefined,
      });

      if (!res?.ok) {
        const code = res?.error || "create_failed";
        throw new Error(ERR_MAP[code] || code);
      }

      const link =
        res.signup_url || `${window.location.origin}${res.signup_path}`;
      await navigator.clipboard.writeText(link);
      alert(t("settings.invite.createdCopied", { link }));

      setForm((f) => ({ ...f, email: "", username: "", unit_id: "" }));
      setEmailStatus("idle");
      setEmailFull("");
      setError("");
      await loadInvites();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(inv) {
    if (!confirm(t("settings.invite.revokeConfirm", { code: inv.invite_code })))
      return;
    try {
      setBusyCode(inv.invite_code);
      const idToken = await getStableIdToken();
      const res = await api.invitations.revoke({
        idToken,
        invite_code: inv.invite_code,
      });
      if (!res?.ok) throw new Error(res?.error || "revoke_failed");
      await loadInvites();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setBusyCode("");
    }
  }

  const selectedUnitIsEligible = useMemo(() => {
    if (!needsUnit) return true;
    if (!form.unit_id) return false;
    return eligibleUnits.some((u) => String(u.ID) === String(form.unit_id));
  }, [needsUnit, form.unit_id, eligibleUnits]);

  const createDisabled =
    busy ||
    !form.username ||
    !emailOk ||
    Number(form.expires_in_days) < 1 ||
    (needsUnit &&
      (!form.building_id || !form.unit_id || !selectedUnitIsEligible));

  return (
    <section className="card p-4 space-y-3">
      <div className="font-medium">{t("settings.invite.title")}</div>
      <div className="text-sm text-[var(--muted)]">
        {t("settings.invite.tip")}
      </div>
      {error && <div className="text-red-300 text-sm">{error}</div>}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* Role */}
        <Field
          id="invite-role"
          label={t("settings.invite.labels.role")}
          required
        >
          <select
            id="invite-role"
            value={form.role}
            onChange={(e) =>
              setForm((f) => {
                const R = String(e.target.value).toUpperCase();
                const needU = R === ROLES.TENANT || R === ROLES.OWNER;
                return {
                  ...f,
                  role: e.target.value,
                  building_id: needU ? f.building_id : "",
                  unit_id: needU ? f.unit_id : "",
                };
              })
            }
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        {/* Email (local part only -> @domain) */}
        <Field
          id="invite-email"
          label={t("settings.invite.labels.email")}
          required
          hint={
            (t("settings.invite.hints.emailOptionalWithDomain") || "").replace(
              /^Optional\.?\s*—?\s*/i,
              ""
            ) || "We’ll append your company domain automatically."
          }
        >
          <div className="flex items-stretch rounded-lg border border-[var(--border)] overflow-hidden bg-transparent">
            <input
              id="invite-email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  email: sanitizeEmailLocal(e.target.value),
                }))
              }
              onBlur={(e) =>
                setForm((f) => ({
                  ...f,
                  email: sanitizeEmailLocal(e.target.value),
                }))
              }
              placeholder={
                t("settings.invite.emailLocalPH") ||
                "local-part (e.g. tenant001)"
              }
              className="bg-transparent px-3 py-2 w-full outline-none"
              inputMode="email"
              autoComplete="off"
              dir="ltr"
              aria-invalid={
                emailFull &&
                (emailStatus === "invalid" || emailStatus === "taken")
                  ? "true"
                  : "false"
              }
            />
            <span className="px-3 py-2 border-l border-[var(--border)] text-[var(--muted)] whitespace-nowrap">
              @{EMAIL_DOMAIN}
            </span>
          </div>

          {/* Email availability hint */}
          {emailFull ? (
            <div className="text-[11px] mt-1">
              {emailStatus === "checking" && (
                <span className="text-[var(--muted)]">
                  {tt(
                    t,
                    "settings.checkingEmail",
                    "settings.invite.checkingEmail",
                    "Checking…"
                  )}
                </span>
              )}
              {emailStatus === "available" && (
                <span className="text-[var(--muted)]">
                  {tt(
                    t,
                    "settings.emailAvailable",
                    "settings.invite.emailAvailable",
                    "Email not found — looks good."
                  )}
                </span>
              )}
              {emailStatus === "taken" && (
                <span className="text-red-300">
                  {tt(
                    t,
                    "settings.emailTakenChooseAnother",
                    "settings.invite.emailTakenChooseAnother",
                    "Email already in use — choose another."
                  )}
                </span>
              )}
              {emailStatus === "invalid" && (
                <span className="text-red-300">
                  {tt(
                    t,
                    "settings.invalidEmailLocal",
                    "settings.invite.invalidEmailLocal",
                    "Use letters, numbers, and ._%+- only."
                  )}
                </span>
              )}
              {emailStatus === "error" && (
                <span className="text-[var(--muted)]">
                  {tt(
                    t,
                    "settings.emailCheckFailed",
                    "settings.invite.emailCheckFailed",
                    "Couldn’t verify email right now."
                  )}
                </span>
              )}
            </div>
          ) : null}
        </Field>

        {/* Username (display only) */}
        <Field
          id="invite-username"
          label={t("settings.invite.labels.username")}
          required
          hint={
            t("settings.invite.hints.usernameDisplayOnly") ||
            "Shown to the user in messages."
          }
        >
          <input
            id="invite-username"
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value.trim() }))
            }
            placeholder={t("settings.invite.usernamePH")}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
            dir="ltr"
          />
        </Field>

        {/* Expires in days */}
        <Field
          id="invite-expires"
          label={t("settings.invite.labels.expiresDays")}
          required
          hint={t("settings.invite.hints.expiresHelp")}
        >
          <input
            id="invite-expires"
            type="number"
            value={form.expires_in_days}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                expires_in_days: Math.max(1, Number(e.target.value || 7)),
              }))
            }
            placeholder={t("settings.invite.expiresPH")}
            className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
            min={1}
          />
        </Field>

        {/* Building (TENANT/OWNER) */}
        {needsUnit && (
          <Field
            id="invite-building"
            label={t("settings.invite.labels.building")}
            required
          >
            <select
              id="invite-building"
              value={form.building_id || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  building_id: e.target.value,
                  unit_id: "",
                }))
              }
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
            >
              <option value="">{t("settings.invite.selectBuilding")}</option>
              {buildings.map((b) => (
                <option key={b.ID} value={b.ID}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {/* Unit (TENANT/OWNER) */}
        {needsUnit && (
          <Field
            id="invite-unit"
            label={t("settings.invite.labels.unit")}
            required
          >
            <select
              id="invite-unit"
              value={form.unit_id || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, unit_id: e.target.value }))
              }
              className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-2 w-full"
              disabled={!form.building_id}
            >
              <option value="">{t("settings.invite.selectUnit")}</option>
              {eligibleUnits.map((u) => (
                <option key={u.ID} value={u.ID}>
                  {u.unit_code}
                </option>
              ))}
            </select>

            {form.building_id && eligibleUnits.length === 0 && (
              <div className="text-[11px] text-[var(--muted)] mt-1">
                {t("settings.invite.noEligibleUnits") ||
                  "No available units for this role right now."}
              </div>
            )}
            {form.building_id && form.unit_id && !selectedUnitIsEligible && (
              <div className="text-[11px] text-red-300 mt-1">
                {t("settings.invite.unitAlreadyAssigned")}
              </div>
            )}
          </Field>
        )}
      </div>

      {/* Binding note */}
      <div className="text-xs text-[var(--muted)]">
        {t("settings.invite.hints.bindingNote")}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCreate}
          className="rounded-lg px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white disabled:opacity-60 disabled:pointer-events-none disabled:cursor-not-allowed"
          disabled={createDisabled}
        >
          {busy ? t("settings.invite.creating") : t("settings.invite.create")}
        </button>
        <button
          onClick={() => window.history.back?.()}
          className="rounded-lg border border-[var(--border)] px-3 py-2"
        >
          {t("cancel")}
        </button>
      </div>

      {invites.length > 0 && (
        <div className="pt-2 space-y-2">
          {invites.map((inv) => (
            <InviteRow
              key={inv.invite_code}
              inv={inv}
              onRevoke={onRevoke}
              busy={busyCode === inv.invite_code}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- page ---------- */
export default function Settings() {
  const { user } = useAuth();
  const { t, dir } = useI18n();

  const roleUp = String(user?.role || "").toUpperCase();
  const canInvite = [ROLES.ADMIN, ROLES.STAFF, ROLES.BUILDING_MGMT].includes(
    roleUp
  );

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <div className="text-sm text-[var(--muted)]">
          {t("settings.areaAdmin")}
        </div>
        <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
      </div>

      {/* Language */}
      <LanguageCard />

      {/* Invite panel – ONLY for Admin/Staff/Building Mgmt */}
      {canInvite && <InvitePanel currentUser={user} />}
    </div>
  );
}
