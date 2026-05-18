import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Language, getTranslation, Translations } from "@/lib/i18n";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "fr",
  setLang: () => {},
  t: getTranslation("fr"),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("opsdirector_lang");
    return (saved as Language) || "fr";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("opsdirector_lang", newLang);
  };

  const t = getTranslation(lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
