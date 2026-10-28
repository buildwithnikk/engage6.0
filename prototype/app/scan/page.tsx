"use client";

// MODULE 2 — Document scan to auto-profile. Owner: Person A (UI) + Person B (/api/extract).

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import CameraInput from "@/components/voice/CameraInput";
import SpeakButton from "@/components/voice/SpeakButton";
import { Owner, Section } from "@/components/ui/Section";
import { saveProfile } from "@/lib/db";
import type { ExtractResult } from "@/lib/types";

export default function ScanPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const onImage = async (imageBase64: string, mimeType: string) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      const data: ExtractResult = await res.json();
      setResult(data);
      await saveProfile({
        name: data.name,
        dob: data.dob,
        gender: data.gender,
        income: data.income,
        category: data.category,
        state: data.state,
        district: data.district,
        docs: ["aadhaar", "income_certificate", "bank_passbook", "ration_card"],
      });
      setNote("प्रोफ़ाइल सेव हो गई।");
    } catch {
      setNote("नेटवर्क नहीं है — ऑफ़लाइन OCR आज़माएँ (Settings).");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="दस्तावेज़ स्कैन करें" subtitle="आधार, आय प्रमाण पत्र, राशन कार्ड या मार्कशीट की फ़ोटो लें">
      <Owner who="Person A + Person B" module="Module 2" />
      <CameraInput onImage={onImage} label="दस्तावेज़ की फ़ोटो लें" />
      {busy && <p className="muted text-sm">पढ़ा जा रहा है…</p>}
      {note && <p className="text-sm">{note}</p>}

      {result && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">निकाली गई जानकारी</h2>
              <span className="muted text-xs">भरोसा {Math.round(result.confidence * 100)}%</span>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <Field label="नाम" value={result.name} />
              <Field label="जन्म तिथि" value={result.dob} />
              <Field label="आय" value={result.income ? "₹" + result.income.toLocaleString("en-IN") : undefined} />
              <Field label="श्रेणी" value={result.category} />
              <Field label="राज्य" value={result.state} />
              <Field label="ज़िला" value={result.district} />
              <Field label="दस्तावेज़" value={result.docType} />
              <Field label="वैधता" value={result.expiryDate ?? "—"} />
            </dl>
          </div>

          {result.mismatch.length > 0 ? (
            result.mismatch.map((m, i) => (
              <div key={i} className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-5 w-5" />
                  {m.field} में अंतर — आवेदन रद्द हो सकता है
                </div>
                <p className="text-sm">
                  {m.values.join("  ≠  ")} ({m.sources.join(" vs ")})
                </p>
                <p className="mt-2 text-sm">{m.advice}</p>
                <SpeakButton text={m.advice} className="mt-2 bg-white" />
              </div>
            ))
          ) : (
            <p className="flex items-center gap-2 text-sm text-leaf">
              <CheckCircle2 className="h-4 w-4" /> कोई नाम/जानकारी का अंतर नहीं मिला।
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <dt className="muted">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </>
  );
}
