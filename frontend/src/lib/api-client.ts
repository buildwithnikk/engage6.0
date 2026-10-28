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
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type AdminOverviewResponse,
  type AdminSchemeDetail,
  type AdminSchemeListResponse,
  type AdminSchemeQuery,
  type AdminSchemeCreate,
  type AdminSchemeUpdate,
  type AuditEventsResponse,
  type DocumentSessionResponse,
  type DocumentExtractionResponse,
  type PreparationDraftResponse,
  type PreparationDraftCreateRequest,
  type PreparationDraftUpdateRequest,
  type PreferencesResponse,
  type UserPreferences,
  type LocationMetadataResponse,
  type GovernmentSourceDetail,
  type GovernmentSourceListResponse,
  type GovernmentSourceCreate,
  type ImportCandidateListResponse,
  type PromoteCandidateResponse,
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

type RequestInitLite = {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
};

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
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: init.credentials ?? "same-origin",
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

/* ------------------------------------------------------------------ Phase 2 Admin */

export async function adminLogin(payload: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/api/v1/admin/auth/login", {
    method: "POST",
    body: payload,
    credentials: "include",
  });
}

export async function adminLogout(csrfToken?: string): Promise<{ status: string }> {
  return request<{ status: string }>("/api/v1/admin/auth/logout", {
    method: "POST",
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
    credentials: "include",
  });
}

export async function getAdminMe(): Promise<MeResponse> {
  return request<MeResponse>("/api/v1/admin/me", {
    method: "GET",
    credentials: "include",
  });
}

export async function getAdminOverview(): Promise<AdminOverviewResponse> {
  return request<AdminOverviewResponse>("/api/v1/admin/overview", {
    method: "GET",
    credentials: "include",
  });
}

export async function listAdminSchemes(
  query: AdminSchemeQuery = {},
): Promise<AdminSchemeListResponse> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.review_status) params.set("review_status", query.review_status);
  if (query.jurisdiction) params.set("jurisdiction", query.jurisdiction);
  if (query.state_code?.trim()) params.set("state_code", query.state_code.trim().toUpperCase());
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));

  const suffix = params.toString() ? `?${params}` : "";
  return request<AdminSchemeListResponse>(`/api/v1/admin/schemes${suffix}`, {
    method: "GET",
    credentials: "include",
  });
}

export async function getAdminScheme(id: string): Promise<AdminSchemeDetail> {
  return request<AdminSchemeDetail>(`/api/v1/admin/schemes/${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
  });
}

export async function createAdminScheme(
  payload: AdminSchemeCreate,
  csrfToken: string,
): Promise<AdminSchemeDetail> {
  return request<AdminSchemeDetail>("/api/v1/admin/schemes", {
    method: "POST",
    body: payload,
    headers: { "X-CSRF-Token": csrfToken },
    credentials: "include",
  });
}

export async function updateAdminScheme(
  id: string,
  payload: AdminSchemeUpdate,
  csrfToken: string,
): Promise<AdminSchemeDetail> {
  return request<AdminSchemeDetail>(`/api/v1/admin/schemes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
    headers: { "X-CSRF-Token": csrfToken },
    credentials: "include",
  });
}

export async function submitSchemeReview(
  id: string,
  csrfToken: string,
): Promise<AdminSchemeDetail> {
  return request<AdminSchemeDetail>(
    `/api/v1/admin/schemes/${encodeURIComponent(id)}/submit-review`,
    {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      credentials: "include",
    },
  );
}

export async function verifyScheme(id: string, csrfToken: string): Promise<AdminSchemeDetail> {
  return request<AdminSchemeDetail>(`/api/v1/admin/schemes/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
    credentials: "include",
  });
}

export async function requestSchemeChanges(
  id: string,
  reason: string,
  csrfToken: string,
): Promise<AdminSchemeDetail> {
  return request<AdminSchemeDetail>(
    `/api/v1/admin/schemes/${encodeURIComponent(id)}/request-changes`,
    {
      method: "POST",
      body: { reason },
      headers: { "X-CSRF-Token": csrfToken },
      credentials: "include",
    },
  );
}

export async function archiveScheme(id: string, csrfToken: string): Promise<AdminSchemeDetail> {
  return request<AdminSchemeDetail>(`/api/v1/admin/schemes/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
    credentials: "include",
  });
}

export async function listAuditEvents(
  page = 1,
  pageSize = 20,
  resourceId?: string,
): Promise<AuditEventsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (resourceId) params.set("resource_id", resourceId);

  return request<AuditEventsResponse>(`/api/v1/admin/audit-events?${params}`, {
    method: "GET",
    credentials: "include",
  });
}

/* ------------------------------------------------------------------ Phase 3 & 4: Sessions & Preparations */

export async function initDocumentSession(): Promise<DocumentSessionResponse> {
  return request<DocumentSessionResponse>("/api/v1/document-sessions", {
    method: "POST",
    credentials: "include",
  });
}

export async function getCurrentDocumentSession(): Promise<DocumentSessionResponse> {
  return request<DocumentSessionResponse>("/api/v1/document-sessions/current", {
    method: "GET",
    credentials: "include",
  });
}

export async function deleteDocumentSession(csrfToken?: string): Promise<void> {
  await request<void>("/api/v1/document-sessions/current", {
    method: "DELETE",
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
    credentials: "include",
  });
}

export async function getDocumentExtraction(documentId: string): Promise<DocumentExtractionResponse> {
  return request<DocumentExtractionResponse>(`/api/v1/documents/${encodeURIComponent(documentId)}/extraction`, {
    method: "GET",
    credentials: "include",
  });
}

export async function createPreparationDraft(
  payload: PreparationDraftCreateRequest,
  csrfToken?: string,
): Promise<PreparationDraftResponse> {
  return request<PreparationDraftResponse>("/api/v1/preparations", {
    method: "POST",
    body: payload,
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
    credentials: "include",
  });
}

export async function getPreparationDraft(draftId: string): Promise<PreparationDraftResponse> {
  return request<PreparationDraftResponse>(`/api/v1/preparations/${encodeURIComponent(draftId)}`, {
    method: "GET",
    credentials: "include",
  });
}

export async function updatePreparationDraft(
  draftId: string,
  payload: PreparationDraftUpdateRequest,
  csrfToken?: string,
): Promise<PreparationDraftResponse> {
  return request<PreparationDraftResponse>(`/api/v1/preparations/${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    body: payload,
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
    credentials: "include",
  });
}

export async function deletePreparationDraft(draftId: string, csrfToken?: string): Promise<void> {
  await request<void>(`/api/v1/preparations/${encodeURIComponent(draftId)}`, {
    method: "DELETE",
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
    credentials: "include",
  });
}

/* ------------------------------------------------------------------ Phase 5: Preferences */

export async function getLocationMetadata(): Promise<LocationMetadataResponse> {
  return request<LocationMetadataResponse>("/api/v1/preferences/metadata", {
    method: "GET",
    credentials: "include",
  });
}

export async function getUserPreferences(): Promise<PreferencesResponse> {
  return request<PreferencesResponse>("/api/v1/preferences", {
    method: "GET",
    credentials: "include",
  });
}

export async function updateUserPreferences(
  payload: Partial<UserPreferences>,
): Promise<PreferencesResponse> {
  return request<PreferencesResponse>("/api/v1/preferences", {
    method: "PUT",
    body: payload,
    credentials: "include",
  });
}

export async function resetUserPreferences(): Promise<PreferencesResponse> {
  return request<PreferencesResponse>("/api/v1/preferences", {
    method: "DELETE",
    credentials: "include",
  });
}

/* ------------------------------------------------------------------ Phase 6: Sources & Import */

export async function listGovernmentSources(): Promise<GovernmentSourceListResponse> {
  return request<GovernmentSourceListResponse>("/api/v1/admin/sources", {
    method: "GET",
    credentials: "include",
  });
}

export async function createGovernmentSource(
  payload: GovernmentSourceCreate,
  csrfToken: string,
): Promise<GovernmentSourceDetail> {
  return request<GovernmentSourceDetail>("/api/v1/admin/sources", {
    method: "POST",
    body: payload,
    headers: { "X-CSRF-Token": csrfToken },
    credentials: "include",
  });
}

export async function triggerSourceSync(
  sourceKey: string,
  csrfToken: string,
): Promise<ImportCandidateListResponse> {
  return request<ImportCandidateListResponse>("/api/v1/admin/sources/sync", {
    method: "POST",
    body: { source_key: sourceKey },
    headers: { "X-CSRF-Token": csrfToken },
    credentials: "include",
  });
}

export async function listImportCandidates(
  statusFilter?: string,
): Promise<ImportCandidateListResponse> {
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
  return request<ImportCandidateListResponse>(`/api/v1/admin/import-candidates${query}`, {
    method: "GET",
    credentials: "include",
  });
}

export async function promoteImportCandidate(
  candidateId: string,
  csrfToken: string,
): Promise<PromoteCandidateResponse> {
  return request<PromoteCandidateResponse>(
    `/api/v1/admin/import-candidates/${encodeURIComponent(candidateId)}/promote`,
    {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      credentials: "include",
    },
  );
}

export async function rejectImportCandidate(
  candidateId: string,
  csrfToken: string,
): Promise<{ status: string; id: string }> {
  return request<{ status: string; id: string }>(
    `/api/v1/admin/import-candidates/${encodeURIComponent(candidateId)}/reject`,
    {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      credentials: "include",
    },
  );
}




