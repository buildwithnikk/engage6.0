"use client";

// MODULE 4 — Civic complaint with auto-classification, ward routing, escalation.
// Owner: Person C (routing/DB) + Person B (drafts).

import { useEffect, useState } from "react";
import { MapPin, Send, ShieldQuestion } from "lucide-react";
import CameraInput from "@/components/voice/CameraInput";
import SpeakButton from "@/components/voice/SpeakButton";
import { Owner, Section } from "@/components/ui/Section";
import { postOrQueue } from "@/lib/offline";
import type { CivicClass, Complaint } from "@/lib/types";

export default function ComplaintPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [klass, setKlass] = useState<CivicClass | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [filed, setFiled] = useState<Complaint | null>(null);
  const [queued, setQueued] = useState(false);
  const [list, setList] = useState<Complaint[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      // Sitapur fallback so the demo works indoors with location denied.
      () => setCoords({ lat: 27.5705, lng: 80.6823 }),
      { timeout: 6000 },
    );
    fetch("/api/complaints")
      .then((r) => r.json())
      .then((d) => setList(d.complaints ?? []))
      .catch(() => {});
  }, []);

  const onImage = async (base64: string, mimeType: string) => {
    setImage(base64);
    setBusy(true);
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType, ...coords }),
      });
      setKlass(await res.json());
    } catch {
      setKlass(null);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!coords || !klass) return;
    setBusy(true);
    const result = await postOrQueue<Complaint>("/api/complaint", {
      imageUrl: image ? "inline" : undefined,
      lat: coords.lat,
      lng: coords.lng,
      category: klass.category,
      description: klass.description,
      anonymous,
    });
    setBusy(false);
    if (result.ok) {
      setFiled(result.data);
      setList((l) => [result.data, ...l]);
    } else {
      setQueued(true);
    }
  };

  return (
    <Section title="शिकायत दर्ज करें" subtitle="फ़ोटो लीजिए — विभाग और वार्ड अपने आप तय होगा">
      <Owner who="Person C + Person B" module="Module 4" />

      <p className="muted flex items-center gap-1 text-xs">
        <MapPin className="h-3.5 w-3.5" />
        {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "स्थान खोजा जा रहा है…"}
      </p>

      <CameraInput onImage={onImage} label="समस्या की फ़ोटो लें" />
      {busy && <p className="muted text-sm">जाँच हो रही है…</p>}

      {klass && !filed && !queued && (
        <div className="card space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <strong>{klass.suggestedTitle}</strong>
              <p className="muted text-xs">
                {klass.category} · गंभीरता {klass.severity}
              </p>
            </div>
            <SpeakButton text={klass.suggestedTitle} />
          </div>
          <p className="text-sm">{klass.description}</p>
          <p className="rounded-lg bg-[var(--bg)] p-2 text-xs">
            विभाग: <strong>{klass.department}</strong>
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            <ShieldQuestion className="h-4 w-4" /> गुमनाम रहें (नाम अधिकारी को नहीं दिखेगा)
          </label>
          <button onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-white">
            <Send className="h-4 w-4" /> दर्ज करें
          </button>
        </div>
      )}

      {queued && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <strong>ऑफ़लाइन सेव हो गया ✈️</strong>
          <p className="text-sm">नेट आते ही अपने आप भेज दिया जाएगा। ऊपर का बैज देखिए।</p>
        </div>
      )}

      {filed && (
        <div className="rounded-xl border border-leaf bg-emerald-50 p-4 text-emerald-900">
          <strong>दर्ज हो गई: {filed.id}</strong>
          <p className="text-sm">
            {filed.ward} · {filed.department}
          </p>
          <a href={`/complaint/${filed.id}`} className="mt-1 inline-block text-sm underline">
            स्थिति देखें
          </a>
        </div>
      )}

      <h2 className="pt-3 font-semibold">आपके इलाक़े की शिकायतें</h2>
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
            <div>
              <strong>{c.id}</strong> · {c.category}
              <p className="muted text-xs">{c.ward}</p>
            </div>
            <a href={`/complaint/${c.id}`} className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs">
              {c.status}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
