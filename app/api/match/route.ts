// MODULE 1 · Owner: Person B
// POST { profile } -> MatchResult. Pure json-logic — no model call, no network.

import { NextResponse } from "next/server";
import { matchSchemes, bestNextDocument } from "@/lib/eligibility";
import { DEMO_PROFILE } from "@/lib/demo";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const profile = body?.profile ?? DEMO_PROFILE;
  const result = matchSchemes(profile);
  return NextResponse.json({ ...result, bestNextDocument: bestNextDocument(profile) });
}
