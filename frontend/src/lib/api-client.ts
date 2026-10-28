/**
 * Typed client for the Sahayak FastAPI backend.
 *
 * The only place in the frontend that knows the backend's URL or response shapes.
 * It never falls back to mock data: if the backend is unreachable, the caller gets
 * an ApiError and the UI must say so. A fake success here would make the whole
 * health indicator worthless.
 */

import {
  ApiError,
  type EligibilityResponse,
  type HealthResponse,
  type SchemeDetail,
  type SchemeListResponse,
  type SchemeQuery,
  type AnswerValue,
} from "@/types/api";

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

type RequestInitLite = { method?: "GET" | "POST"; body?: unknown };

async function request<T>(
  path: string,
  init: RequestInitLite = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // These are live reads; a cached answer would misreport the real state.
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
    // FastAPI puts a human-readable reason in `detail`; surface it rather than
    // a bare status code, because 503 "database not configured" is actionable
    // and "HTTP 503" is not.
    let detail: string | null = null;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(
      "http",
      detail ?? `The backend returned HTTP ${res.status}.`,
      res.status,
    );
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

/* ------------------------------------------------------------------ Phase 1 */

export async function listSchemes(query: SchemeQuery = {}): Promise<SchemeListResponse> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.jurisdiction) params.set("jurisdiction", query.jurisdiction);
  if (query.state_code?.trim()) params.set("state_code", query.state_code.trim().toUpperCase());
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));

  const suffix = params.toString() ? `?${params}` : "";
  const body = await request<unknown>(`/api/v1/schemes${suffix}`);

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as SchemeListResponse).items)
  ) {
    throw new ApiError("invalid", "The scheme list response did not match the contract.");
  }
  return body as SchemeListResponse;
}

/** `reference` is a UUID or a slug — the backend accepts either. */
export async function getScheme(reference: string): Promise<SchemeDetail> {
  const body = await request<unknown>(`/api/v1/schemes/${encodeURIComponent(reference)}`);
  if (typeof body !== "object" || body === null || typeof (body as SchemeDetail).slug !== "string") {
    throw new ApiError("invalid", "The scheme response did not match the contract.");
  }
  return body as SchemeDetail;
}

export async function checkEligibility(
  schemeId: string,
  answers: Record<string, AnswerValue>,
): Promise<EligibilityResponse> {
  const body = await request<unknown>("/api/v1/eligibility/check", {
    method: "POST",
    body: { scheme_id: schemeId, answers },
  });

  const outcome = (body as EligibilityResponse | null)?.outcome;
  if (
    outcome !== "eligible" &&
    outcome !== "ineligible" &&
    outcome !== "needs_more_information"
  ) {
    throw new ApiError("invalid", "The eligibility response did not match the contract.");
  }
  return body as EligibilityResponse;
}
