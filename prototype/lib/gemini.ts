// PERSON B OWNS THIS FILE. Every model call in the app goes through callModel().
// Nobody else talks to Gemini directly — that way rate limits, retries and the
// demo fallback are fixed in one place.
//
// Order of attempts: Gemini 2.0 Flash -> Groq (Llama 3.3) -> the caller's fallback.
// A route must ALWAYS return the documented shape, even with no network.

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL = "gemini-2.0-flash";
const TIMEOUT_MS = 12_000;

export type ModelInput = {
  prompt: string;
  /** Raw base64 (no data: prefix) for vision calls. */
  imageBase64?: string;
  mimeType?: string;
  /** Ask for JSON back. Gemini then guarantees parseable JSON. */
  json?: boolean;
};

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("model timeout")), ms)),
  ]);
}

async function callGemini({ prompt, imageBase64, mimeType, json }: ModelInput): Promise<string> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY missing");
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: json ? { responseMimeType: "application/json" } : undefined,
  });

  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } });
  }

  const res = await withTimeout(model.generateContent(parts));
  return res.response.text();
}

async function callGroq({ prompt, json }: ModelInput): Promise<string> {
  if (!GROQ_KEY) throw new Error("GROQ_API_KEY missing");
  const res = await withTimeout(
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    }),
  );
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Strips ```json fences that models sometimes add despite JSON mode. */
function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

/**
 * The only model entry point. `fallback` is returned if every provider fails,
 * so a dead wifi connection on stage degrades the answer instead of the app.
 */
export async function callModel<T>(input: ModelInput, fallback: T): Promise<{ data: T; source: "gemini" | "groq" | "fallback" }> {
  try {
    const raw = await callGemini(input);
    return { data: input.json ? parseJson<T>(raw) : (raw as unknown as T), source: "gemini" };
  } catch (err) {
    console.warn("[gemini] failed:", (err as Error).message);
  }

  // Groq has no vision — only worth trying for text-only calls.
  if (!input.imageBase64) {
    try {
      const raw = await callGroq(input);
      return { data: input.json ? parseJson<T>(raw) : (raw as unknown as T), source: "groq" };
    } catch (err) {
      console.warn("[groq] failed:", (err as Error).message);
    }
  }

  return { data: fallback, source: "fallback" };
}

/** Shorthand for text-in / text-out calls. */
export async function callText(prompt: string, fallback: string) {
  const { data } = await callModel<string>({ prompt }, fallback);
  return data;
}
