// Deterministic eligibility. The LLM NEVER decides who qualifies — it only helps
// draft the json-logic rules offline, which a human then checks by hand.
// A hallucinated "you are eligible" is the one bug judges will catch.

import jsonLogic from "json-logic-js";
import schemes from "@/data/schemes.json";
import type { MatchResult, Profile, Scheme } from "./types";

const ALL = schemes as unknown as Scheme[];

export function allSchemes(): Scheme[] {
  return ALL;
}

function passesRule(scheme: Scheme, profile: Profile): boolean {
  try {
    return Boolean(jsonLogic.apply(scheme.rule as any, profile as any));
  } catch {
    return false;
  }
}

function missingDocs(scheme: Scheme, profile: Profile): string[] {
  const held = new Set(profile.docs ?? []);
  return scheme.docsRequired.filter((d) => !held.has(d));
}

/**
 * eligible  — rule passes AND the citizen holds every required document
 * nearMiss  — rule passes but exactly ONE document is missing ("1 document away")
 */
export function matchSchemes(profile: Profile): MatchResult {
  const eligible: Scheme[] = [];
  const nearMiss: MatchResult["nearMiss"] = [];

  for (const scheme of ALL) {
    if (!passesRule(scheme, profile)) continue;
    const missing = missingDocs(scheme, profile);
    if (missing.length === 0) {
      eligible.push(scheme);
    } else if (missing.length === 1) {
      nearMiss.push({
        schemeId: scheme.id,
        name: scheme.name,
        missingDoc: missing[0],
        benefitAmount: scheme.benefitAmount,
      });
    }
  }

  const totalUnclaimed = eligible.reduce((sum, s) => sum + (s.benefitAmount || 0), 0);
  return { eligible, nearMiss, totalUnclaimed };
}

/** Which single document unlocks the most money? Drives the "get this next" nudge. */
export function bestNextDocument(profile: Profile) {
  const { nearMiss } = matchSchemes(profile);
  const byDoc = new Map<string, { doc: string; value: number; schemes: string[] }>();

  for (const m of nearMiss) {
    const entry = byDoc.get(m.missingDoc) ?? { doc: m.missingDoc, value: 0, schemes: [] };
    entry.value += m.benefitAmount || 0;
    entry.schemes.push(m.name);
    byDoc.set(m.missingDoc, entry);
  }

  return [...byDoc.values()].sort((a, b) => b.value - a.value)[0] ?? null;
}

export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}
