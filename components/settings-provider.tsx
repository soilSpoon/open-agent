"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { type Language, SettingsContext } from "@/lib/settings-context";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("open-agent-language");
    if (saved === "en" || saved === "ko") {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("open-agent-language", lang);
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage: handleSetLanguage }),
    [language, handleSetLanguage],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
