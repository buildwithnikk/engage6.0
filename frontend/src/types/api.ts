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

/* ------------------------------------------------------------------ Phase 1 */

export type ReviewStatus = "draft" | "needs_review" | "verified" | "archived";
export type Jurisdiction = "central" | "state";

/**
 * Mirrors backend `SchemeSummary`.
 *
 * `eligibility_rules` is intentionally absent from the API: rules belong to the
 * evaluator, and a second implementation in the browser would eventually
 * disagree with it. The questionnaire is driven by `required_facts` instead.
 */
export type SchemeSummary = {
  id: string;
  slug: string;
  official_name: string;
  department: string;
  jurisdiction: Jurisdiction;
  state_code: string | null;
  benefit_summary: string;
  required_documents: string[];
  official_apply_url: string | null;
  source_url: string;
  review_status: ReviewStatus;
  verified_at: string | null;
  rules_version: string;
};

/** One question the eligibility form must ask, derived server-side from the rules. */
export type FactRequirement = {
  fact: string;
  kind: "integer" | "boolean" | "choice" | "text";
  requirements: string[];
  choices: string[];
};

export type SchemeDetail = SchemeSummary & {
  required_facts: FactRequirement[];
  /** False when the backend cannot parse the stored rules; no check is possible. */
  rules_readable: boolean;
};

export type SchemeListResponse = {
  items: SchemeSummary[];
  total: number;
  page: number;
  page_size: number;
};

export type SchemeQuery = {
  q?: string;
  jurisdiction?: Jurisdiction | "";
  state_code?: string;
  page?: number;
  page_size?: number;
};

export type EligibilityOutcome = "eligible" | "ineligible" | "needs_more_information";
export type ConditionStatus = "met" | "failed" | "unknown";

export type ConditionOutcome = {
  fact: string;
  type: string;
  status: ConditionStatus;
  requirement: string;
  explanation: string;
};

/** Answer values the questionnaire can produce. */
export type AnswerValue = string | number | boolean | null;

export type EligibilityResponse = {
  scheme_id: string;
  scheme_slug: string;
  official_name: string;
  outcome: EligibilityOutcome;
  summary: string;
  met: ConditionOutcome[];
  failed: ConditionOutcome[];
  unknown: ConditionOutcome[];
  missing_facts: string[];
  rules_version: string;
  source_url: string;
  official_apply_url: string | null;
  review_status: ReviewStatus;
  evaluated_at: string;
  disclaimer: string;
};
