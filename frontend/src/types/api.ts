/**
 * Types mirroring the FastAPI contracts in docs/api-contracts.md.
 *
 * These are hand-written to match `backend/app/schemas/`. If a backend schema
 * changes, change this file in the same commit — the contract is shared, so it
 * is reviewed by all three people.
 *
 * Phase 0 covers the health endpoint only. Scheme and eligibility types arrive
 * in Phase 1 and are deliberately absent rather than stubbed.
 */

/** Real state of the backend's database connection. There is no "assumed ok". */
export type DatabaseStatus = "ok" | "unconfigured" | "unavailable";

/** GET /api/v1/health — 200 response body. */
export type HealthResponse = {
  status: "ok";
  version: string;
  database: DatabaseStatus;
  /** Short, non-sensitive reason when `database` is not "ok". */
  detail: string | null;
};

/**
 * Why the client could not produce a HealthResponse.
 *
 * `network` — the backend could not be reached at all (not running, wrong URL, CORS, DNS)
 * `http`    — the backend answered with a non-2xx status
 * `invalid` — the backend answered 2xx with a body that is not a HealthResponse
 * `config`  — NEXT_PUBLIC_API_BASE_URL is missing
 */
export type ApiErrorKind = "network" | "http" | "invalid" | "config";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}
