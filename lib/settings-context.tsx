"use client";

import { createContext, useContext } from "react";

export type Language = "en" | "ko";

interface SettingsContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
