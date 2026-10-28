"use client";

// MODULE 3 — Voice form-fill + jargon decoder + rejection decoder.
// Owner: Person A (voice flow) + Person B (prompts).

import { useEffect, useState } from "react";
import { Download, HelpCircle } from "lucide-react";
import VoiceInput from "@/components/voice/VoiceInput";
import SpeakButton from "@/components/voice/SpeakButton";
import { Owner, Section } from "@/components/ui/Section";
import { loadProfile } from "@/lib/db";
import type { Profile } from "@/lib/types";

type FormField = { id: string; labelHi: string; labelEn: string; prefill?: string };

const FIELDS: FormField[] = [
  { id: "name", labelHi: "आपका पूरा नाम", labelEn: "Full name" },
  { id: "father", labelHi: "पिता का नाम", labelEn: "Father's name" },
  { id: "dob", labelHi: "जन्म तिथि", labelEn: "Date of birth" },
  { id: "income", labelHi: "सालाना आय", labelEn: "Annual income" },
  { id: "address", labelHi: "पूरा पता", labelEn: "Full address" },
  { id: "bank", labelHi: "बैंक खाता संख्या", labelEn: "Bank account number" },
];

export default function FormPage() {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [why, setWhy] = useState<string | null>(null);
  const [rejection, setRejection] = useState("");
  const [diagnosis, setDiagnosis] = useState<{ cause: string; steps: string[] } | null>(null);

  useEffect(() => {
    loadProfile<Profile>().then((p) => {
      if (!p) return;
      setAnswers({
        name: p.name ?? "",
        dob: p.dob ?? "",
        income: p.income ? String(p.income) : "",
        address: [p.district, p.state].filter(Boolean).join(", "),
      });
    });
  }, []);

  const field = FIELDS[idx];
  const done = idx >= FIELDS.length;

  const explain = async () => {
    setWhy("पूछ रहे हैं…");
    const res = await fetch("/api/explain-field", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldLabel: field.labelEn, formName: "Post-Matric Scholarship", lang: "hi" }),
    });
    const data = await res.json();
    setWhy(`${data.why} ⚠️ ${data.commonMistake}`);
  };

  const download = async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    page.drawText("Application Form (auto-filled by Sahayak)", { x: 50, y: 790, size: 14, font: bold });
    page.drawText("Generated from a voice conversation in the applicant's own language.", { x: 50, y: 770, size: 9, font });

    let y = 730;
    for (const f of FIELDS) {
      page.drawText(`${f.labelEn}:`, { x: 50, y, size: 11, font: bold });
      page.drawText(answers[f.id] || "—", { x: 220, y, size: 11, font });
      y -= 34;
    }
    page.drawText("Attachments required: Aadhaar copy, income certificate, bank passbook first page.", {
      x: 50,
      y: y - 20,
      size: 9,
      font,
    });

    const bytes = await pdf.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sahayak-filled-form.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const diagnose = async () => {
    setDiagnosis(null);
    const res = await fetch("/api/explain-rejection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rejection, lang: "hi" }),
    });
    setDiagnosis(await res.json());
  };

  return (
    <Section title="बोलकर फ़ॉर्म भरें" subtitle="हर सवाल सुनिए, जवाब बोलिए — फ़ॉर्म अपने आप भर जाएगा">
      <Owner who="Person A + Person B" module="Module 3" />

      {!done ? (
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <span className="muted text-xs">
              सवाल {idx + 1} / {FIELDS.length}
            </span>
            <button onClick={explain} className="inline-flex items-center gap-1 text-xs text-brand">
              <HelpCircle className="h-4 w-4" /> यह क्यों पूछा जाता है?
            </button>
          </div>

          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold">{field.labelHi}</h2>
            <SpeakButton text={field.labelHi} />
          </div>

          {why && <p className="rounded-lg bg-[var(--bg)] p-3 text-sm">{why}</p>}

          <input
            value={answers[field.id] ?? ""}
            onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
            placeholder="बोलिए या टाइप करें"
            className="w-full rounded-xl border border-[var(--line)] bg-transparent p-3"
          />

          <VoiceInput onResult={(text) => setAnswers((a) => ({ ...a, [field.id]: text }))} />

          <div className="flex gap-2">
            {idx > 0 && (
              <button onClick={() => setIdx(idx - 1)} className="rounded-xl border border-[var(--line)] px-4 py-2">
                पीछे
              </button>
            )}
            <button
              onClick={() => {
                setWhy(null);
                setIdx(idx + 1);
              }}
              className="flex-1 rounded-xl bg-brand px-4 py-2 text-white"
            >
              आगे
            </button>
          </div>
        </div>
      ) : (
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">फ़ॉर्म तैयार है ✅</h2>
          <ul className="space-y-1 text-sm">
            {FIELDS.map((f) => (
              <li key={f.id} className="flex justify-between gap-3 border-b border-[var(--line)] py-1">
                <span className="muted">{f.labelHi}</span>
                <span className="font-medium">{answers[f.id] || "—"}</span>
              </li>
            ))}
          </ul>
          <button onClick={download} className="inline-flex items-center gap-2 rounded-xl bg-leaf px-4 py-2 text-white">
            <Download className="h-4 w-4" /> भरा हुआ PDF डाउनलोड करें
          </button>
          <button onClick={() => setIdx(0)} className="block text-sm text-brand">
            फिर से भरें
          </button>
        </div>
      )}

      <div className="card space-y-3 p-5">
        <h2 className="font-semibold">आवेदन रद्द क्यों हुआ?</h2>
        <p className="muted text-sm">रद्द होने का मैसेज यहाँ पेस्ट करें — जैसे &ldquo;PFMS: Account not seeded&rdquo;</p>
        <textarea
          value={rejection}
          onChange={(e) => setRejection(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-[var(--line)] bg-transparent p-3 text-sm"
          placeholder="रद्द होने का कारण पेस्ट करें…"
        />
        <button onClick={diagnose} disabled={!rejection.trim()} className="rounded-xl bg-ink px-4 py-2 text-white disabled:opacity-40">
          समझाइए
        </button>
        {diagnosis && (
          <div className="rounded-xl bg-[var(--bg)] p-4 text-sm">
            <p className="font-semibold">{diagnosis.cause}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {diagnosis.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <SpeakButton text={`${diagnosis.cause}. ${diagnosis.steps.join(". ")}`} className="mt-3" />
          </div>
        )}
      </div>
    </Section>
  );
}
