import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/i18n";

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: "fr", label: "FR", flag: "🇫🇷" },
  { code: "pt", label: "PT", flag: "🇧🇷" },
  { code: "en", label: "EN", flag: "🇬🇧" },
];

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-1">
      {LANGS.map(({ code, label, flag }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
            lang === code
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={
            lang === code
              ? {
                  background: "oklch(0.75 0.12 75 / 0.12)",
                  border: "1px solid oklch(0.75 0.12 75 / 0.25)",
                }
              : {
                  background: "transparent",
                  border: "1px solid transparent",
                }
          }
        >
          <span>{flag}</span>
          {!compact && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
