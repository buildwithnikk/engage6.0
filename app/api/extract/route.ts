// MODULE 2 · Owner: Person B
// POST { imageBase64, mimeType } -> ExtractResult

import { NextResponse } from "next/server";
import { callModel } from "@/lib/gemini";
import { DEMO_EXTRACT, DEMO_PROFILE } from "@/lib/demo";
import type { ExtractResult } from "@/lib/types";

const PROMPT = `You are reading a photograph of an Indian government document
(Aadhaar, PAN, ration card, income certificate, caste certificate, marksheet or bank passbook).

Extract what is actually visible. Never invent a value — use null when unsure.

Also compare against this saved profile and report any mismatch that would cause an
application to be rejected (name spelling, date of birth, father's name):
${JSON.stringify(DEMO_PROFILE)}

Return JSON exactly in this shape:
{
  "name": string|null, "dob": "YYYY-MM-DD"|null, "gender": "male"|"female"|"other"|null,
  "income": number|null, "category": "GEN"|"OBC"|"SC"|"ST"|"EWS"|null,
  "state": string|null, "district": string|null,
  "docType": string, "expiryDate": "YYYY-MM-DD"|null, "confidence": number,
  "mismatch": [{ "field": string, "values": string[], "sources": string[],
                 "risk": "high"|"medium"|"low", "advice": string }]
}
Write every "advice" in simple Hindi a person with little schooling can follow.`;

export async function POST(req: Request) {
  const { imageBase64, mimeType } = await req.json();

  const { data, source } = await callModel<ExtractResult>(
    { prompt: PROMPT, imageBase64, mimeType, json: true },
    DEMO_EXTRACT,
  );

  return NextResponse.json({ ...data, _source: source });
}
