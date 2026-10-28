// MODULE 3 · Owner: Person B
// POST { fieldLabel, formName, lang } -> { why, commonMistake, example }

import { NextResponse } from "next/server";
import { callModel } from "@/lib/gemini";

export async function POST(req: Request) {
  const { fieldLabel, formName, lang = "hi" } = await req.json();

  const prompt = `On the Indian government form "${formName}", the field is "${fieldLabel}".
In ${lang}, in one short sentence each, explain:
- why the government asks for it
- the single most common mistake that gets applications rejected here
- a correctly formatted example
Return JSON: { "why": string, "commonMistake": string, "example": string }`;

  const { data } = await callModel<{ why: string; commonMistake: string; example: string }>(
    { prompt, json: true },
    {
      why: "यह जानकारी आपकी पहचान मिलाने के लिए ज़रूरी है।",
      commonMistake: "आधार कार्ड से हटकर स्पेलिंग लिखना — इसी वजह से सबसे ज़्यादा आवेदन रद्द होते हैं।",
      example: "जैसा आधार पर लिखा है, अक्षर-दर-अक्षर वही लिखें।",
    },
  );

  return NextResponse.json(data);
}
