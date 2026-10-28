"use client";

// PERSON A OWNS THIS FILE. B and C: import it, never edit it.
// Web Speech API — free, built into Chrome, supports hi-IN / ta-IN / bn-IN etc.
// No API key, no network cost. Chrome only; show the hint if unsupported.

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useLang } from "../LangProvider";

type Props = {
  onResult: (transcript: string) => void;
  label?: string;
};

export default function VoiceInput({ onResult, label }: Props) {
  const { t, speechCode } = useLang();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript as string;
      onResult(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [onResult]);

  useEffect(() => {
    if (recRef.current) recRef.current.lang = speechCode;
  }, [speechCode]);

  if (!supported) {
    return (
      <p className="muted text-sm">
        <MicOff className="inline h-4 w-4" /> Voice needs Chrome. Type instead.
      </p>
    );
  }

  const toggle = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch {
        /* already started */
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={`flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-lg font-semibold text-white transition ${
        listening ? "animate-pulse bg-red-600" : "bg-brand"
      }`}
    >
      <Mic className="h-6 w-6" />
      {listening ? t("listening") : label || t("speak")}
    </button>
  );
}
