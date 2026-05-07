"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, type Language, type Translations } from "@/lib/locales/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = "sama_language";
const DEFAULT_LANGUAGE: Language = "sv";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start with the default so server-rendered HTML matches the
  // client's first render. Reading localStorage in a lazy initializer would
  // diverge from SSR and trigger React hydration error #418 for any text
  // routed through `t.*`.
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored && stored in translations && stored !== language) {
        setLanguageState(stored);
      }
    } catch {
      /* private mode / storage disabled — keep default */
    }
    // Intentionally only run on mount; we just need to reconcile once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
