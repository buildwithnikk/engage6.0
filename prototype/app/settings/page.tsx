"use client";

// MODULE 5 + 8 — Language, offline OCR, kiosk mode, data deletion. Owner: Person A.

import { useEffect, useState } from "react";
import { Trash2, Tv, WifiOff } from "lucide-react";
import CameraInput from "@/components/voice/CameraInput";
import LangSwitch from "@/components/LangSwitch";
import { Owner, Section } from "@/components/ui/Section";
import { db } from "@/lib/db";
import { flushQueue, pendingCount } from "@/lib/offline";

export default function SettingsPage() {
  const [pending, setPending] = useState(0);
  const [ocr, setOcr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kiosk, setKiosk] = useState(false);

  useEffect(() => {
    pendingCount().then(setPending);
    const k = new URLSearchParams(location.search).get("kiosk") === "1";
    setKiosk(k);
    document.body.dataset.kiosk = k ? "1" : "0";
  }, []);

  // Offline OCR: Tesseract runs entirely in the browser, so this works in
  // airplane mode when /api/extract cannot be reached.
  const runOfflineOcr = async (base64: string) => {
    setBusy(true);
    setOcr(null);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(`data:image/jpeg;base64,${base64}`, "eng");
      setOcr(data.text.trim() || "कुछ पढ़ा नहीं जा सका।");
    } catch {
      setOcr("ऑफ़लाइन OCR लोड नहीं हो सका।");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="सेटिंग" subtitle="भाषा, ऑफ़लाइन और आपका डेटा">
      <Owner who="Person A" module="Module 5 + 8" />

      <div className="card flex items-center justify-between p-4">
        <span>भाषा</span>
        <LangSwitch />
      </div>

      <div className="card space-y-2 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <WifiOff className="h-5 w-5 text-brand" /> ऑफ़लाइन कतार
        </h2>
        <p className="muted text-sm">{pending} काम भेजने के लिए बाक़ी हैं।</p>
        <button
          onClick={async () => {
            const r = await flushQueue();
            setPending(await pendingCount());
            alert(`भेजे: ${r.sent}, बाक़ी: ${r.failed}`);
          }}
          className="rounded-xl bg-brand px-4 py-2 text-white"
        >
          अभी सिंक करें
        </button>
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">ऑफ़लाइन OCR (बिना इंटरनेट)</h2>
        <p className="muted text-sm">नेट न हो तो दस्तावेज़ फ़ोन पर ही पढ़ा जाएगा।</p>
        <CameraInput onImage={(b64) => runOfflineOcr(b64)} label="फ़ोटो लें (ऑफ़लाइन)" />
        {busy && <p className="muted text-sm">फ़ोन पर पढ़ा जा रहा है… (पहली बार 10-15 सेकंड)</p>}
        {ocr && <pre className="whitespace-pre-wrap rounded-xl bg-[var(--bg)] p-3 text-xs">{ocr}</pre>}
      </div>

      <div className="card space-y-2 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Tv className="h-5 w-5 text-brand" /> कियोस्क मोड
        </h2>
        <p className="muted text-sm">पंचायत या CSC की टैबलेट के लिए बड़े बटन। {kiosk ? "चालू है।" : ""}</p>
        <a href={kiosk ? "/settings" : "/settings?kiosk=1"} className="inline-block rounded-xl border border-[var(--line)] px-4 py-2">
          {kiosk ? "बंद करें" : "चालू करें"}
        </a>
      </div>

      <div className="card space-y-2 p-4">
        <h2 className="flex items-center gap-2 font-semibold text-red-600">
          <Trash2 className="h-5 w-5" /> मेरा डेटा मिटाएँ
        </h2>
        <p className="muted text-sm">प्रोफ़ाइल, दस्तावेज़ और कैश — सब इस फ़ोन से हट जाएगा।</p>
        <button
          onClick={async () => {
            if (!confirm("सारा डेटा मिटाना है?")) return;
            await db?.profile.clear();
            await db?.cache.clear();
            await db?.queue.clear();
            alert("मिट गया।");
          }}
          className="rounded-xl bg-red-600 px-4 py-2 text-white"
        >
          सब मिटाएँ
        </button>
      </div>
    </Section>
  );
}
