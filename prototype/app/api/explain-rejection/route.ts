// MODULE 3 · Owner: Person B
// POST { text | imageBase64, lang } -> { cause, steps[], docsNeeded[] }
// Rejections are where most people give up. This is the highest-empathy route in the app.

import { NextResponse } from "next/server";
import { callModel } from "@/lib/gemini";

export async function POST(req: Request) {
  const { text, imageBase64, mimeType, lang = "hi" } = await req.json();

  const prompt = `An Indian citizen's government application was rejected. Here is the
message or status they received:

"${text ?? "(see the attached screenshot)"}"

Work out what actually went wrong — portal codes like "PFMS: account not seeded",
"e-KYC failed", "Invalid data" or "Name mismatch" hide a simple real cause.

In ${lang}, return JSON:
{ "cause": string, "steps": string[], "docsNeeded": string[] }
Steps must be things the person can physically do this week, in order, naming where to go.`;

  const { data } = await callModel<{ cause: string; steps: string[]; docsNeeded: string[] }>(
    { prompt, imageBase64, mimeType, json: true },
    {
      cause: "आपका आधार बैंक खाते से जुड़ा (सीडेड) नहीं है, इसलिए सरकारी भुगतान आपके खाते तक नहीं पहुँच पाया।",
      steps: [
        "अपनी बैंक शाखा जाएँ और 'आधार सीडिंग फ़ॉर्म' मांगें — यह मुफ़्त है।",
        "आधार कार्ड की फ़ोटोकॉपी और पासबुक साथ ले जाएँ।",
        "फ़ॉर्म जमा करने की रसीद ज़रूर लें।",
        "3 कार्य दिवस बाद बैंक से सीडिंग की पुष्टि कराएँ।",
        "पुष्टि के बाद पोर्टल पर दोबारा आवेदन करें — नया फ़ॉर्म भरने की ज़रूरत नहीं।",
      ],
      docsNeeded: ["आधार कार्ड", "बैंक पासबुक", "आवेदन संख्या"],
    },
  );

  return NextResponse.json(data);
}
