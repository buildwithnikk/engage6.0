"use client";

// PERSON A OWNS THIS FILE.
// SpeechSynthesis — browser-native text to speech, free. This is what makes the
// app usable for someone who cannot read.

import { useState } from "react";
import { Volume2, Square } from "lucide-react";
import { useLang } from "../LangProvider";

export default function SpeakButton({ text, className = "" }: { text: string; className?: string }) {
  const { speechCode } = useLang();
  const [speaking, setSpeaking] = useState(false);

  const speak = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechCode;
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={speaking ? "Stop reading" : "Read aloud"}
      className={`inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1 text-sm ${className}`}
    >
      {speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {speaking ? "रोकें" : "सुनें"}
    </button>
  );
}
