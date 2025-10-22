// src/pages/SignIn.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../providers/AuthProvider";
import api from "../api";
import { writeSessionCache } from "../lib/sessionCache";
import { useI18n } from "../providers/I18nProvider";

/* tiny i18n helper */
const L = (locale, en, ar) => (locale === "ar" ? ar : en);

export default function SignIn() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const { locale, dir, setLocale } = useI18n();
  const rtl = dir === "rtl";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  /* redirect once session is hydrated */
  useEffect(() => {
    if (!loading && user) {
      nav("/", { replace: true });
    }
  }, [loading, user, nav]);

  function changeLang(next) {
    try {
      if (typeof setLocale === "function") setLocale(next);
      else {
        localStorage.setItem("i18n:locale", next);
        window.location.reload();
      }
    } catch {}
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      try {
        const idToken = await cred.user.getIdToken(true);
        const sess = await api.session({ idToken });
        if (sess?.ok && sess.user) writeSessionCache(sess.user);
      } catch {}
      // AuthProvider will redirect
    } catch (e2) {
      setErr(e2?.code || String(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (!email.trim()) {
      setErr(L(locale, "Enter your email first to receive a reset link.", "أدخل بريدك الإلكتروني أولاً للحصول على رابط إعادة التعيين."));
      return;
    }
    setErr("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setErr(L(locale, "Reset email sent. Check your inbox.", "تم إرسال رسالة إعادة التعيين. تحقق من بريدك."));
    } catch (e2) {
      setErr(e2?.code || String(e2));
    }
  }

  return (
    <div
      dir={dir}
      className="min-h-dvh w-full flex items-stretch"
      style={{
        /* full-page gradient, no dividers */
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--accent) 22%, transparent) 0%, transparent 70%)",
      }}
    >
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {/* top row: logo + language */}
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
              {L(locale, "Welcome back 👋", "مرحباً بك مجدداً 👋")}
            </h1>
            <div className="text-[13px] text-[var(--muted)] mt-1">
              {L(locale, "Sign in to continue.", "سجّل الدخول للمتابعة.")}
            </div>
          </div>
        </div>

        {/* form (mobile-friendly, no surrounding cards/tiles) */}
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="w-full max-w-sm mt-6 space-y-3"
        >
          {err ? <div className="text-red-400 text-sm">{err}</div> : null}

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={L(locale, "Email", "البريد الإلكتروني")}
            className="w-full p-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            autoComplete="username"
            inputMode="email"
            dir="ltr"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={L(locale, "Password", "كلمة المرور")}
            className="w-full p-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            autoComplete="current-password"
            dir="ltr"
          />

          <button
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-600)] rounded-xl p-3 font-medium active:scale-[.99] transition disabled:opacity-60"
            disabled={busy}
          >
            {busy ? L(locale, "Signing in…", "جاري تسجيل الدخول…") : L(locale, "Sign in", "تسجيل الدخول")}
          </button>

          <div className={`pt-1 text-xs text-[var(--muted)] ${rtl ? "text-right" : "text-left"}`}>
            <button type="button" onClick={onReset} className="underline hover:opacity-90">
              {L(locale, "Forgot password?", "هل نسيت كلمة المرور؟")}
            </button>
          </div>
        </form>

        {/* footer */}
        <div className="mt-8 text-[11px] text-[var(--muted)]">
          {L(locale, "Secure login powered by Firebase.", "تسجيل دخول آمن بواسطة Firebase.")}
        </div>
      </div>
    </div>
  );
}
