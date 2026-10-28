"use client";

// MODULE 4 — Status timeline, auto-escalation, RTI draft. Owner: Person C.

import { useEffect, useState } from "react";
import { FileWarning, Scale } from "lucide-react";
import SpeakButton from "@/components/voice/SpeakButton";
import { Owner, Section } from "@/components/ui/Section";
import type { Complaint, ComplaintEvent } from "@/lib/types";

export default function ComplaintDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<{ complaint: Complaint; events: ComplaintEvent[]; canEscalate: boolean } | null>(null);
  const [letter, setLetter] = useState<{ subject: string; body: string; sendTo: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/complaint/${params.id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [params.id]);

  const draft = async (stage: "escalation" | "rti") => {
    setBusy(true);
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaintId: params.id, stage, lang: "hi" }),
    });
    setLetter(await res.json());
    setBusy(false);
  };

  if (!data) return <p className="muted">लोड हो रहा है…</p>;

  const { complaint, events, canEscalate } = data;
  const days = Math.floor((Date.now() - new Date(complaint.createdAt).getTime()) / 86_400_000);

  return (
    <Section title={`शिकायत ${complaint.id}`} subtitle={`${complaint.ward} · ${complaint.department}`}>
      <Owner who="Person C" module="Module 4" />

      <div className="card p-4">
        <p className="text-sm">{complaint.description}</p>
        <p className="muted mt-2 text-xs">
          {days} दिन पुरानी · स्थिति: <strong>{complaint.status}</strong>
        </p>
      </div>

      <ol className="space-y-3 border-l-2 border-[var(--line)] pl-4">
        {events.map((e, i) => (
          <li key={i}>
            <strong className="text-sm">{e.stage}</strong>
            <p className="muted text-xs">{new Date(e.at).toLocaleString("en-IN")}</p>
            <p className="text-sm">{e.note}</p>
          </li>
        ))}
      </ol>

      {canEscalate && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <strong>{days} दिन से कोई कार्रवाई नहीं</strong>
          <p className="text-sm">अगला कदम अपने आप तैयार है।</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => draft("escalation")} className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-sm text-white">
              <FileWarning className="h-4 w-4" /> ऊपर के अधिकारी को पत्र
            </button>
            <button onClick={() => draft("rti")} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-sm text-white">
              <Scale className="h-4 w-4" /> RTI आवेदन बनाएँ
            </button>
          </div>
        </div>
      )}

      {busy && <p className="muted text-sm">पत्र तैयार हो रहा है…</p>}

      {letter && (
        <div className="card space-y-2 p-4">
          <p className="muted text-xs">भेजें: {letter.sendTo}</p>
          <strong>{letter.subject}</strong>
          <pre className="whitespace-pre-wrap text-sm">{letter.body}</pre>
          <div className="flex gap-2">
            <SpeakButton text={letter.body} />
            <button onClick={() => navigator.clipboard?.writeText(`${letter.subject}\n\n${letter.body}`)} className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm">
              कॉपी करें
            </button>
            <button onClick={() => window.print()} className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm">
              प्रिंट
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}
