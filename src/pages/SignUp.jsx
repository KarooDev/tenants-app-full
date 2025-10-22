// src/pages/SignUp.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { auth } from "../lib/firebase";
import api from "../api";
import { useI18n } from "../providers/I18nProvider";

/* tiny i18n helper */
const L = (locale, en, ar) => (locale === "ar" ? ar : en);

const ERR_MAP = {
  "auth/email-already-in-use": "This email is already registered.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/weak-password": "Password should be at least 6 characters.",
  user_not_seeded_by_management:
    "Not found in system. Ask building management/admin to pre-add you (or use the invite link).",
  user_already_linked: "This account is already linked. Try signing in instead.",
  invite_not_found: "This invite code is invalid or was revoked.",
  invite_inactive: "This invite is no longer active.",
  invite_expired: "This invite has expired. Request a new one.",
  invite_required:
    "An invite is required to create a new account. Ask building management to send you one.",
  invite_already_used:
    "This invite has already been used. Request a fresh invite.",
  no_linked_user:
    "We couldn't find your profile yet. Use your invite link or contact management.",
  default: "Could not sign up. Please try again.",
};

function normInvite(s = "") {
  const t = s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!t) return "";
  return t.length > 4 ? `${t.slice(0, 4)}-${t.slice(4, 8)}` : t;
}

export default function SignUp() {
  const nav = useNavigate();
  const loc = useLocation();
  const { locale, dir, setLocale } = useI18n();
  const rtl = dir === "rtl";
  const formRef = useRef(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    username: "",
    invite_code: "",
    password: "",
  });
  const [prefilled, setPrefilled] = useState({
    email: false,
    username: false,
    full_name: false,
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteValid, setInviteValid] = useState(true); // disable submit if known-bad

  // read ?invite= and prefill via server lookup
  useEffect(() => {
    const q = new URLSearchParams(loc.search);
    const raw = (q.get("invite") || "").trim();
    const code = normInvite(raw);
    if (!code) return;

    setForm((f) => ({ ...f, invite_code: code }));

    (async () => {
      try {
        const res = await api.invitations.lookup({ invite_code: code });
        if (!res?.ok) throw new Error(res?.error || "invite_not_found");
        const seeded = res.seeded_user || {};
        setForm((f) => ({
          ...f,
          email: seeded.email || f.email,
          username: seeded.username || f.username,
          full_name: seeded.full_name || f.full_name,
        }));
        setPrefilled({
          email: !!seeded.email,
          username: !!seeded.username,
          full_name: !!seeded.full_name,
        });
        setInviteValid(true);
        setErr("");
      } catch (e) {
        const code = e?.message || "default";
        setInviteValid(false);
        setErr(ERR_MAP[code] || ERR_MAP.default);
      }
    })();
  }, [loc.search]);

  const usingInvite = !!form.invite_code;
  const emailLocked = usingInvite && prefilled.email;
  const usernameLocked = usingInvite && prefilled.username;
  const usernameRequired = useMemo(() => !usingInvite, [usingInvite]);

  function onChange(e) {
    const { name, value } = e.target;

    // Ignore edits to locked fields (invite-driven)
    if ((name === "email" && emailLocked) || (name === "username" && usernameLocked)) {
      return;
    }

    setForm((f) => ({
      ...f,
      [name]: name === "invite_code" ? normInvite(value) : value,
    }));
    if (name === "invite_code") setInviteValid(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (usingInvite && !inviteValid) return;

    setErr("");
    setBusy(true);
    let cred = null;

    try {
      const email = form.email.trim();
      const password = form.password;
      const full_name = form.full_name.trim();
      const username = form.username.trim();
      const invite_code = form.invite_code.trim();

      // quick re-check if user typed/edited the invite
      if (invite_code) {
        const check = await api.invitations.lookup({ invite_code });
        if (!check?.ok) throw new Error(check?.error || "invite_not_found");
      }

      // 1) Firebase sign-up
      cred = await createUserWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdToken(true);

      // 2) Link on server (enforces single-use invite or seeded user)
      const link = await api.linkUser({
        idToken: token,
        // if username is invite-driven, don't send it (server matches by invite)
        username: usernameLocked ? undefined : (username || undefined),
        invite_code: invite_code || undefined,
        full_name: full_name || undefined,
      });
      if (!link?.ok) throw new Error(link?.error || "default");

      // 3) Go home
      const from = (loc.state && loc.state.from && loc.state.from.pathname) || "/";
      nav(from, { replace: true });
    } catch (e2) {
      const code = e2?.code || ("" + e2?.message) || "default";
      setErr(ERR_MAP[code] || `${code}`);

      // cleanup: remove the just-created Firebase account if link failed
      try {
        if (cred?.user && auth.currentUser?.uid === cred.user.uid) {
          await deleteUser(auth.currentUser);
        }
      } catch {}
    } finally {
      setBusy(false);
    }
  }

  function changeLang(next) {
    try {
      if (typeof setLocale === "function") setLocale(next);
      else {
        localStorage.setItem("i18n:locale", next);
        window.location.reload();
      }
      setLocale(next);
    } catch {}
  }

  return (
    <div
      dir={dir}
      className="min-h-dvh w-full flex items-stretch"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--accent) 22%, transparent) 0%, transparent 70%)",
      }}
    >
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {/* top row: logo + language (same as SignIn) */}
        <div className={`w-full max-w-sm ${rtl ? "text-right" : "text-left"}`}>
          <div className={`flex items-center justify-between ${rtl ? "flex-row-reverse" : ""}`}>
            <Link to="/" className="inline-flex items-center">
              <img
                src={`${import.meta.env.BASE_URL}bineytna.svg`}
                alt="Bineytna"
                className="block h-7 w-auto"
                draggable="false"
                decoding="async"
                loading="eager"
              />
            </Link>

            <div className={`flex items-center gap-1 ${rtl ? "flex-row-reverse" : ""}`}>
              <button
                onClick={() => changeLang("en")}
                className={[
                  "px-2 py-1 rounded-md text-xs border",
                  locale === "en"
                    ? "border-[var(--accent)]/60 text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:bg-white/5",
                ].join(" ")}
              >
                EN
              </button>
              <button
                onClick={() => changeLang("ar")}
                className={[
                  "px-2 py-1 rounded-md text-xs border",
                  locale === "ar"
                    ? "border-[var(--accent)]/60 text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:bg-white/5",
                ].join(" ")}
              >
                AR
              </button>
            </div>
          </div>

          <div className="mt-4">
            <h1 className="text-xl font-semibold">
              {L(locale, "Create your account ✨", "أنشئ حسابك ✨")}
            </h1>
            <div className="text-[13px] text-[var(--muted)] mt-1">
              {L(locale, "Use your invite for a quick start.", "استخدم الدعوة للبدء بسرعة.")}
            </div>
          </div>
        </div>

        {/* form (same styling as SignIn) */}
        <form ref={formRef} onSubmit={onSubmit} className="w-full max-w-sm mt-6 space-y-3">
          {err ? <div className="text-red-400 text-sm">{err}</div> : null}

          <input
            name="full_name"
            value={form.full_name}
            onChange={onChange}
            placeholder={L(locale, "Full name", "الاسم الكامل")}
            className="w-full p-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            required
            autoComplete="name"
          />

          <input
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            placeholder={L(locale, "Email", "البريد الإلكتروني")}
            className={[
              "w-full p-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 focus:outline-none",
              emailLocked ? "opacity-75 cursor-not-allowed" : "focus:ring-2 focus:ring-[var(--accent)]/40",
            ].join(" ")}
            required
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            readOnly={emailLocked}
            title={emailLocked ? L(locale, "Email comes from your invite", "البريد من الدعوة") : ""}
          />

          <input
            name="username"
            value={form.username}
            onChange={onChange}
            placeholder={L(locale, "Username", "اسم المستخدم")}
            className={[
              "w-full p-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 focus:outline-none",
              usernameLocked ? "opacity-75 cursor-not-allowed" : "focus:ring-2 focus:ring-[var(--accent)]/40",
            ].join(" ")}
            required={usernameRequired}
            readOnly={usernameLocked}
            autoComplete="username"
            dir="ltr"
            title={usernameLocked ? L(locale, "Username comes from your invite", "اسم المستخدم من الدعوة") : ""}
          />

          <input
            name="invite_code"
            value={form.invite_code}
            onChange={onChange}
            placeholder={L(locale, "Invite code (optional)", "رمز الدعوة (اختياري)")}
            className="w-full p-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            dir="ltr"
          />

          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder={L(locale, "Password (min 6 chars)", "كلمة المرور (6 أحرف على الأقل)")}
            className="w-full p-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            required
            minLength={6}
            autoComplete="new-password"
            dir="ltr"
          />

          <button
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-600)] rounded-xl p-3 font-medium active:scale-[.99] transition disabled:opacity-60"
            disabled={busy || (usingInvite && !inviteValid)}
          >
            {busy ? L(locale, "Creating…", "جاري الإنشاء…") : L(locale, "Sign up", "إنشاء حساب")}
          </button>

          <div className={`pt-1 text-xs text-[var(--muted)] ${rtl ? "text-right" : "text-left"}`}>
            {L(locale, "Already have an account?", "لديك حساب بالفعل؟")}{" "}
            <Link to="/sign-in" className="underline hover:opacity-90">
              {L(locale, "Sign in", "تسجيل الدخول")}
            </Link>
          </div>
        </form>

        {/* footer */}
        <div className="mt-8 text-[11px] text-[var(--muted)]">
          {L(locale, "Secure signup powered by Firebase.", "إنشاء حساب آمن بواسطة Firebase.")}
        </div>
      </div>
    </div>
  );
}
