// MODULE 4 · Owner: Person B
// POST { imageBase64, mimeType, lat, lng } -> CivicClass

import { NextResponse } from "next/server";
import { callModel } from "@/lib/gemini";
import { DEMO_CIVIC } from "@/lib/demo";
import { departmentFor } from "@/lib/geo";
import type { CivicClass } from "@/lib/types";

const PROMPT = `This is a photograph of a civic problem on an Indian street.
Classify it and write a complaint-ready description an officer would act on.

Return JSON:
{
  "category": "pothole"|"garbage"|"streetlight"|"waterlogging"|"drainage"|"other",
  "severity": "low"|"medium"|"high",
  "suggestedTitle": string,
  "description": string
}
Judge severity by danger to people, not by how ugly it looks.`;

export async function POST(req: Request) {
  const { imageBase64, mimeType } = await req.json();

  const { data, source } = await callModel<CivicClass>(
    { prompt: PROMPT, imageBase64, mimeType, json: true },
    DEMO_CIVIC,
  );

  // Department is a lookup, not a model guess — it decides who gets the complaint.
  return NextResponse.json({ ...data, department: departmentFor(data.category), _source: source });
}
