// MODULE 3/5 · Owner: Person B
// POST { text, lang } -> { simplified, glossary[] }

import { NextResponse } from "next/server";
import { callModel } from "@/lib/gemini";

export async function POST(req: Request) {
  const { text, lang = "hi" } = await req.json();

  const prompt = `Rewrite this Indian government text so a person with class-5 reading
ability understands it. Keep every fact, drop the legalese. Answer in ${lang}.
Also list the jargon terms with one-line meanings.
Return JSON: { "simplified": string, "glossary": [{"term": string, "meaning": string}] }

TEXT:
${text}`;

  const { data } = await callModel<{ simplified: string; glossary: { term: string; meaning: string }[] }>(
    { prompt, json: true },
    {
      simplified: "यह सूचना सरल भाषा में उपलब्ध नहीं हो सकी। कृपया नेटवर्क आने पर फिर कोशिश करें।",
      glossary: [
        { term: "अटेस्टेड कॉपी", meaning: "किसी राजपत्रित अधिकारी से प्रमाणित फ़ोटोकॉपी" },
        { term: "सीडिंग", meaning: "आधार को बैंक खाते से जोड़ना" },
      ],
    },
  );

  return NextResponse.json(data);
}
