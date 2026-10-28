// MODULE 1/5 · Owner: Person B
// POST { text } -> { verdict, reason, officialUrl }
// Fake scheme forwards make people distrust the real schemes too.

import { NextResponse } from "next/server";
import { callModel } from "@/lib/gemini";
import { allSchemes } from "@/lib/eligibility";

export async function POST(req: Request) {
  const { text } = await req.json();
  const known = allSchemes().map((s) => ({ name: s.name, url: s.applyUrl }));

  const prompt = `A citizen forwarded this message claiming a government scheme:

"${text}"

Here are schemes we have verified: ${JSON.stringify(known)}

Decide whether the claim is real, fake or unclear. Treat these as fake signals:
a shortened or non-gov.in link, a joining fee, "forward to 10 people", urgency,
an amount that no real scheme pays, or a scheme name that does not exist.

Return JSON: { "verdict": "real"|"fake"|"unclear", "reason": string, "officialUrl": string }
Write "reason" in one short Hindi sentence.`;

  const { data } = await callModel<{ verdict: string; reason: string; officialUrl: string }>(
    { prompt, json: true },
    {
      verdict: "unclear",
      reason: "अभी जाँच नहीं हो सकी। किसी भी लिंक पर पैसे या OTP न दें — असली सरकारी योजना में शुल्क नहीं लगता।",
      officialUrl: "https://www.myscheme.gov.in/",
    },
  );

  return NextResponse.json(data);
}
