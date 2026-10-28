/**
 * Typed client for the Sahayak FastAPI backend.
 *
 * The only place in the frontend that knows the backend's URL or response shapes.
 * It never falls back to mock data: if the backend is unreachable, the caller gets
 * an ApiError and the UI must say so. A fake success here would make the whole
 * health indicator worthless.
 */

import { ApiError, type HealthResponse } from "@/types/api";

/** Trailing slashes are stripped so `${base}/api/v1/health` is always well formed. */
function baseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!raw || !raw.trim()) {
    throw new ApiError(
      "config",
      "NEXT_PUBLIC_API_BASE_URL is not set. Copy frontend/.env.example to frontend/.env.local.",
    );
  }
  return raw.trim().replace(/\/+$/, "");
}

const DEFAULT_TIMEOUT_MS = 5000;

async function request<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // Health is a liveness probe: a cached answer would be a lie.
      cache: "no-store",
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(
      "network",
      aborted
        ? `The backend did not respond within ${timeoutMs / 1000}s.`
        : "Could not reach the backend. Is FastAPI running?",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new ApiError("http", `The backend returned HTTP ${res.status}.`, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError("invalid", "The backend returned a response that was not JSON.");
  }
}

/** Narrow the parsed JSON before the UI trusts it. */
function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.status === "ok" &&
    typeof v.version === "string" &&
    (v.database === "ok" || v.database === "unconfigured" || v.database === "unavailable") &&
    (v.detail === null || typeof v.detail === "string" || v.detail === undefined)
  );
}

export async function getHealth(): Promise<HealthResponse> {
  const body = await request<unknown>("/api/v1/health");
  if (!isHealthResponse(body)) {
    throw new ApiError("invalid", "The backend's health response did not match the contract.");
  }
  return { ...body, detail: body.detail ?? null };
}
