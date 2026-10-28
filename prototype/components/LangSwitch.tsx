"use client";

import { LANGS } from "@/lib/i18n";
import { useLang } from "./LangProvider";
import type { Lang } from "@/lib/types";

export default function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <select
      aria-label="Language"
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-sm"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
