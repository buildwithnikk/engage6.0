// PERSON A OWNS THIS FILE.
// Strings ship in Hindi + English. Any other language is fetched once from
// /api/translate and then served from the Dexie cache forever.

import { cacheGet, cacheSet } from "./db";
import type { Lang } from "./types";

export const LANGS: { code: Lang; label: string; speech: string }[] = [
  { code: "hi", label: "हिन्दी", speech: "hi-IN" },
  { code: "en", label: "English", speech: "en-IN" },
  { code: "ta", label: "தமிழ்", speech: "ta-IN" },
  { code: "bn", label: "বাংলা", speech: "bn-IN" },
  { code: "mr", label: "मराठी", speech: "mr-IN" },
  { code: "te", label: "తెలుగు", speech: "te-IN" },
  { code: "kn", label: "ಕನ್ನಡ", speech: "kn-IN" },
  { code: "or", label: "ଓଡ଼ିଆ", speech: "or-IN" },
];

export const STRINGS: Record<string, { hi: string; en: string }> = {
  appName: { hi: "सहायक", en: "Sahayak" },
  tagline: { hi: "आपके हक़, आपकी भाषा में", en: "Your entitlements, in your language" },
  home: { hi: "होम", en: "Home" },
  schemes: { hi: "योजनाएँ", en: "Schemes" },
  scan: { hi: "स्कैन", en: "Scan" },
  form: { hi: "फ़ॉर्म", en: "Form" },
  complaint: { hi: "शिकायत", en: "Complaint" },
  transport: { hi: "यातायात", en: "Transport" },
  dashboard: { hi: "डैशबोर्ड", en: "Dashboard" },
  settings: { hi: "सेटिंग", en: "Settings" },
  unclaimed: { hi: "बिना दावा राशि", en: "Unclaimed every year" },
  eligibleNow: { hi: "आप अभी पात्र हैं", en: "You are eligible now" },
  oneDocAway: { hi: "एक दस्तावेज़ दूर", en: "One document away" },
  speak: { hi: "बोलिए", en: "Speak" },
  listening: { hi: "सुन रहे हैं…", en: "Listening…" },
  offlineSaved: { hi: "ऑफ़लाइन सेव हो गया — नेट आने पर भेज देंगे", en: "Saved offline — will send when you are back online" },
  takePhoto: { hi: "दस्तावेज़ की फ़ोटो लें", en: "Photograph your document" },
  fileComplaint: { hi: "शिकायत दर्ज करें", en: "File a complaint" },
};

export function t(key: string, lang: Lang): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  if (lang === "hi" || lang === "en") return entry[lang];
  return entry.hi; // until /api/translate fills the cache
}

/** Bulk-translate the UI into a non-bundled language and cache the result. */
export async function ensureLanguage(lang: Lang): Promise<Record<string, string>> {
  if (lang === "hi" || lang === "en") {
    return Object.fromEntries(Object.entries(STRINGS).map(([k, v]) => [k, v[lang]]));
  }

  const cacheKey = `i18n:${lang}`;
  const hit = await cacheGet<Record<string, string>>(cacheKey);
  if (hit) return hit;

  const keys = Object.keys(STRINGS);
  const strings = keys.map((k) => STRINGS[k].en);

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strings, targetLang: lang }),
    });
    const { translations } = await res.json();
    const map = Object.fromEntries(keys.map((k, i) => [k, translations[i] ?? STRINGS[k].hi]));
    await cacheSet(cacheKey, map);
    return map;
  } catch {
    return Object.fromEntries(keys.map((k) => [k, STRINGS[k].hi]));
  }
}
