"use client";

// MODULE 7 + 8 — Offline QR verification. Owner: Person A.
// Pure client-side Ed25519 check: no network, no server, works in airplane mode.

import { useState } from "react";
import { BadgeCheck, BadgeX } from "lucide-react";
import { Owner, Section } from "@/components/ui/Section";
import { verifyPayload } from "@/lib/sign";

export default function VerifyPage() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<null | { ok: boolean; payload?: any }>(null);

  const check = async () => {
    try {
      const parsed = JSON.parse(raw);
      const ok = await verifyPayload(parsed.payload, parsed.signature, parsed.publicKey);
      setResult({ ok, payload: ok ? JSON.parse(parsed.payload) : undefined });
    } catch {
      setResult({ ok: false });
    }
  };

  return (
    <Section title="पास की जाँच (ऑफ़लाइन)" subtitle="QR का टेक्स्ट पेस्ट कीजिए — इंटरनेट की ज़रूरत नहीं">
      <Owner who="Person A" module="Module 7 + 8" />
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={5}
        placeholder='{"payload":"...","signature":"...","publicKey":"..."}'
        className="w-full rounded-xl border border-[var(--line)] bg-transparent p-3 font-mono text-xs"
      />
      <button onClick={check} className="rounded-xl bg-brand px-4 py-2 text-white">
        जाँचें
      </button>

      {result && (
        <div
          className={`rounded-xl p-4 ${result.ok ? "border border-leaf bg-emerald-50 text-emerald-900" : "border border-red-300 bg-red-50 text-red-900"}`}
        >
          <strong className="flex items-center gap-2">
            {result.ok ? <BadgeCheck className="h-5 w-5" /> : <BadgeX className="h-5 w-5" />}
            {result.ok ? "असली पास ✅" : "जाँच फेल ❌"}
          </strong>
          {result.payload && (
            <pre className="mt-2 whitespace-pre-wrap text-sm">{JSON.stringify(result.payload, null, 2)}</pre>
          )}
        </div>
      )}
    </Section>
  );
}
