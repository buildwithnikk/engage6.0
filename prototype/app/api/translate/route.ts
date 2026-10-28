// MODULE 5 · Owner: Person B
// POST { strings[], targetLang } -> { translations[] }
// Called once per language; the client then caches it in Dexie forever.

import { NextResponse } from "next/server";
import { callModel } from "@/lib/gemini";

const NAMES: Record<string, string> = {
  hi: "Hindi", ta: "Tamil", bn: "Bengali", mr: "Marathi",
  te: "Telugu", kn: "Kannada", or: "Odia", en: "English",
};

export async function POST(req: Request) {
  const { strings, targetLang } = await req.json();
  const language = NAMES[targetLang] ?? "Hindi";

  const prompt = `Translate each string into ${language}, for a government services app
used by people with little formal schooling. Keep it short enough for a mobile button.
Return JSON: { "translations": string[] } in the same order, same length.

${JSON.stringify(strings)}`;

  const { data } = await callModel<{ translations: string[] }>(
    { prompt, json: true },
    { translations: strings },
  );

  return NextResponse.json(data);
}
