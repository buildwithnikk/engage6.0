"use client";

// MODULE 7 — Route to the office, one-day trip planner, signed QR pass.
// Owner: Person C (routing) + Person A (QR UI).

import { useEffect, useState } from "react";
import { Bus, QrCode, Route as RouteIcon } from "lucide-react";
import SpeakButton from "@/components/voice/SpeakButton";
import { Owner, Section } from "@/components/ui/Section";
import { DEMO_OFFICES } from "@/lib/demo";
import type { Pass, RouteResult } from "@/lib/types";

export default function TransportPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 27.5705, lng: 80.6823 });
  const [officeId, setOfficeId] = useState(DEMO_OFFICES[0].id);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [plan, setPlan] = useState<any | null>(null);
  const [pass, setPass] = useState<Pass | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 6000 },
    );
  }, []);

  const getRoute = async () => {
    setBusy(true);
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromLat: coords.lat, fromLng: coords.lng, officeId }),
    });
    setRoute(await res.json());
    setBusy(false);
  };

  const getPlan = async () => {
    setBusy(true);
    const res = await fetch("/api/day-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tasks: ["आय प्रमाण पत्र नवीनीकरण", "बैंक में आधार लिंक", "राशन कार्ड में नाम जोड़ना"],
        userLocation: coords,
      }),
    });
    setPlan(await res.json());
    setBusy(false);
  };

  const getPass = async () => {
    setBusy(true);
    const res = await fetch("/api/pass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sunita Devi", scheme: "Mahila Free Bus Pass", validTill: "2027-03-31" }),
    });
    setPass(await res.json());
    setBusy(false);
  };

  return (
    <Section title="कैसे पहुँचें" subtitle="बस, समय, किराया — और ऑफ़लाइन चलने वाला पास">
      <Owner who="Person C + Person A" module="Module 7" />

      <div className="card space-y-3 p-4">
        <label className="muted block text-sm">कहाँ जाना है?</label>
        <select
          value={officeId}
          onChange={(e) => setOfficeId(e.target.value)}
          className="w-full rounded-xl border border-[var(--line)] bg-transparent p-3"
        >
          {DEMO_OFFICES.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button onClick={getRoute} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-white">
          <RouteIcon className="h-4 w-4" /> रास्ता बताइए
        </button>
      </div>

      {busy && <p className="muted text-sm">हिसाब लगाया जा रहा है…</p>}

      {route && (
        <div className="card space-y-2 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-brand" />
              <strong>
                {route.distanceKm} km · {route.durationMin} मिनट · ₹{route.fareApprox}
              </strong>
            </div>
            <SpeakButton text={`${route.distanceKm} किलोमीटर, ${route.durationMin} मिनट, किराया ${route.fareApprox} रुपये`} />
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {route.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="muted text-xs">स्रोत: {route.source === "osrm" ? "OSRM live" : "कैश्ड रूट"}</p>
        </div>
      )}

      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">एक दिन, सारे काम</h2>
        <p className="muted text-sm">बाक़ी सब काम एक ही ट्रिप में — दिहाड़ी बचेगी।</p>
        <button onClick={getPlan} className="rounded-xl bg-ink px-4 py-2 text-white">
          दिन का प्लान बनाइए
        </button>
        {plan && (
          <div className="rounded-xl bg-[var(--bg)] p-3 text-sm">
            <p className="font-medium">
              कुल {plan.totalHours} घंटे · किराया ₹{plan.totalFare}
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {plan.ordered?.map((o: any, i: number) => (
                <li key={i}>
                  <strong>{o.task}</strong> — {o.office} ({o.arriveBy}) · {o.travel}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <QrCode className="h-5 w-5 text-brand" /> हस्ताक्षरित पास / पात्रता पर्ची
        </h2>
        <p className="muted text-sm">कंडक्टर बिना इंटरनेट स्कैन करके जाँच सकता है।</p>
        <button onClick={getPass} className="rounded-xl bg-leaf px-4 py-2 text-white">
          पास बनाइए
        </button>
        {pass && (
          <div className="space-y-2">
            <img src={pass.qrDataUrl} alt="Signed pass QR" className="mx-auto w-56 rounded-xl border border-[var(--line)] bg-white p-2" />
            <p className="muted break-all text-xs">signature: {pass.signature.slice(0, 32)}…</p>
            <a href="/verify" className="text-sm text-brand underline">
              दूसरे फ़ोन पर जाँचें (ऑफ़लाइन) →
            </a>
          </div>
        )}
      </div>
    </Section>
  );
}
