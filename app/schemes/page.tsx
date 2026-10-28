"use client";

// MODULE 1 — Scheme discovery, unclaimed value, "one document away".
// Owner: Person B (logic) + Person A (UI).

import { useEffect, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import SpeakButton from "@/components/voice/SpeakButton";
import { Owner, Section } from "@/components/ui/Section";
import { loadProfile } from "@/lib/db";
import { formatINR } from "@/lib/eligibility";
import type { MatchResult, Profile } from "@/lib/types";

export default function SchemesPage() {
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const p = await loadProfile<Profile>();
      setProfile(p);
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: p }),
      });
      setMatch(await res.json());
    })().catch(() => {});
  }, []);

  if (!match) return <p className="muted">लोड हो रहा है…</p>;

  const summary = `आप ${match.eligible.length} योजनाओं के लिए पात्र हैं। कुल ${formatINR(match.totalUnclaimed)} हर साल।`;

  return (
    <Section title="आपकी योजनाएँ" subtitle={profile?.name ? `${profile.name} · ${profile.district ?? ""}` : "डेमो प्रोफ़ाइल"}>
      <Owner who="Person B + Person A" module="Module 1" />

      <div className="card flex items-center justify-between p-4">
        <div>
          <p className="muted text-sm">बिना दावा, हर साल</p>
          <strong className="text-2xl text-leaf">{formatINR(match.totalUnclaimed)}</strong>
        </div>
        <SpeakButton text={summary} />
      </div>

      <h2 className="pt-2 font-semibold">आप अभी पात्र हैं ({match.eligible.length})</h2>
      <ul className="space-y-3">
        {match.eligible.map((s) => (
          <li key={s.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <strong>{s.nameHi || s.name}</strong>
                <p className="muted text-xs">{s.dept}</p>
              </div>
              <span className="whitespace-nowrap font-semibold text-leaf">
                {s.benefitAmount ? formatINR(s.benefitAmount) + "/वर्ष" : s.benefitNote || "लाभ"}
              </span>
            </div>
            <p className="muted mt-2 text-xs">दस्तावेज़: {s.docsRequired.join(", ")}</p>
            <div className="mt-3 flex items-center gap-2">
              <a
                href={s.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-sm text-white"
              >
                आवेदन करें <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <SpeakButton text={`${s.nameHi || s.name}. ${s.dept}. सालाना लाभ ${s.benefitAmount} रुपये.`} />
            </div>
          </li>
        ))}
      </ul>

      {match.nearMiss.length > 0 && (
        <>
          <h2 className="pt-4 font-semibold">एक दस्तावेज़ दूर ({match.nearMiss.length})</h2>
          <ul className="space-y-2">
            {match.nearMiss.map((n) => (
              <li key={n.schemeId} className="rounded-xl border border-dashed border-brand p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Plus className="mt-0.5 h-4 w-4 text-brand" />
                  <div>
                    <strong>{n.name}</strong>
                    <p className="muted">
                      चाहिए: <span className="font-medium text-brand">{n.missingDoc}</span>
                      {n.benefitAmount ? ` · इससे ${formatINR(n.benefitAmount)}/वर्ष खुलेगा` : ""}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
