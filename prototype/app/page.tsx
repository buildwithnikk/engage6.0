"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScanLine, IndianRupee, Megaphone, Bus, ShieldCheck } from "lucide-react";
import SpeakButton from "@/components/voice/SpeakButton";
import { useLang } from "@/components/LangProvider";
import { loadProfile } from "@/lib/db";
import { formatINR } from "@/lib/eligibility";
import type { MatchResult, Profile } from "@/lib/types";

export default function Home() {
  const { t } = useLang();
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [forward, setForward] = useState("");

  useEffect(() => {
    (async () => {
      const profile = (await loadProfile<Profile>()) ?? null;
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      setMatch(await res.json());
    })().catch(() => setMatch(null));
  }, []);

  const checkMessage = async () => {
    setVerdict("जाँच हो रही है…");
    const res = await fetch("/api/verify-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: forward }),
    });
    const data = await res.json();
    setVerdict(`${data.verdict === "real" ? "✅ असली" : data.verdict === "fake" ? "❌ फ़र्ज़ी" : "⚠️ अस्पष्ट"} — ${data.reason}`);
  };

  const headline = match ? `${formatINR(match.totalUnclaimed)} हर साल, बिना दावा` : "…";

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <p className="muted text-sm">{t("unclaimed")}</p>
        <div className="flex items-start justify-between gap-3">
          <strong className="text-3xl text-leaf">{match ? formatINR(match.totalUnclaimed) : "—"}</strong>
          <SpeakButton text={headline} />
        </div>
        <p className="muted mt-1 text-sm">
          {match ? `${match.eligible.length} योजनाओं के लिए आप पात्र हैं · ${match.nearMiss.length} एक दस्तावेज़ दूर` : "प्रोफ़ाइल लोड हो रही है…"}
        </p>
        <Link href="/schemes" className="mt-3 inline-block rounded-xl bg-brand px-4 py-2 text-white">
          सूची देखें
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/scan" Icon={ScanLine} title="दस्तावेज़ स्कैन" note="फ़ोटो से प्रोफ़ाइल" />
        <Tile href="/schemes" Icon={IndianRupee} title="योजनाएँ" note="पात्रता जाँच" />
        <Tile href="/complaint" Icon={Megaphone} title="शिकायत" note="फ़ोटो + GPS" />
        <Tile href="/transport" Icon={Bus} title="कैसे पहुँचें" note="बस, किराया, समय" />
      </div>

      <div className="card space-y-3 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand" />
          <h2 className="font-semibold">WhatsApp संदेश की जाँच करें</h2>
        </div>
        <p className="muted text-sm">कोई योजना का मैसेज आया है? यहाँ पेस्ट करें — असली है या फ़र्ज़ी, बताएँगे।</p>
        <textarea
          value={forward}
          onChange={(e) => setForward(e.target.value)}
          rows={3}
          placeholder="मैसेज यहाँ पेस्ट करें…"
          className="w-full rounded-xl border border-[var(--line)] bg-transparent p-3 text-sm"
        />
        <button onClick={checkMessage} disabled={!forward.trim()} className="rounded-xl bg-ink px-4 py-2 text-white disabled:opacity-40">
          जाँचें
        </button>
        {verdict && <p className="text-sm font-medium">{verdict}</p>}
      </div>
    </div>
  );
}

function Tile({ href, Icon, title, note }: { href: string; Icon: any; title: string; note: string }) {
  return (
    <Link href={href} className="card flex flex-col gap-1 p-4">
      <Icon className="h-6 w-6 text-brand" />
      <strong className="text-sm">{title}</strong>
      <span className="muted text-xs">{note}</span>
    </Link>
  );
}
