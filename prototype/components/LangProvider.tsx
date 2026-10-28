"use client";

// PERSON A OWNS THIS FILE. Wraps the app; every screen reads language from here.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LANGS, STRINGS, ensureLanguage } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  speechCode: string;
};

const LangContext = createContext<Ctx>({
  lang: "hi",
  setLang: () => {},
  t: (k) => k,
  speechCode: "hi-IN",
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("hi");
  const [map, setMap] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(STRINGS).map(([k, v]) => [k, v.hi])),
  );

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("lang", lang);
    } catch {
      /* private window */
    }
    ensureLanguage(lang).then(setMap);
  }, [lang]);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (key: string) => map[key] ?? STRINGS[key]?.hi ?? key,
      speechCode: LANGS.find((l) => l.code === lang)?.speech ?? "hi-IN",
    }),
    [lang, map],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
