import { useI18n } from "../providers/I18nProvider";

export default function LanguageToggle({ className = "" }) {
  const { locale, setLocale, t, dir } = useI18n();
  const next = locale === "ar" ? "en" : "ar";
  const label = locale === "ar" ? t("en") : t("ar");
  return (
    <button
      onClick={() => setLocale(next)}
      className={`px-3 py-1 text-sm rounded-full border border-[var(--border)] hover:bg-black/5 ${className}`}
      aria-label={t("lang")}
      title={t("lang")}
      dir={dir}
    >
      {label}
    </button>
  );
}
