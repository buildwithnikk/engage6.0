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

/* ------------------------------------------------------------------ Phase 2 */

export type AdminRole = "admin" | "reviewer" | "editor";

export type AdminUserSummary = {
  id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: AdminUserSummary;
  csrf_token: string;
};

export type MeResponse = {
  user: AdminUserSummary;
  csrf_token: string;
};

export type AdminOverviewResponse = {
  total: number;
  draft: number;
  needs_review: number;
  verified: number;
  archived: number;
};

export type AdminSchemeSummary = {
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
  created_at: string;
  updated_at: string;
};

export type AdminSchemeDetail = AdminSchemeSummary & {
  eligibility_rules: Record<string, unknown>;
};

export type AdminSchemeListResponse = {
  items: AdminSchemeSummary[];
  total: number;
  page: number;
  page_size: number;
};

export type AdminSchemeQuery = {
  q?: string;
  review_status?: ReviewStatus | "";
  jurisdiction?: Jurisdiction | "";
  state_code?: string;
  page?: number;
  page_size?: number;
};

export type AdminSchemeCreate = {
  slug: string;
  official_name: string;
  department: string;
  jurisdiction: Jurisdiction;
  state_code?: string | null;
  benefit_summary: string;
  eligibility_rules: Record<string, unknown>;
  required_documents: string[];
  official_apply_url?: string | null;
  source_url: string;
};

export type AdminSchemeUpdate = {
  expected_updated_at?: string;
  slug?: string;
  official_name?: string;
  department?: string;
  jurisdiction?: Jurisdiction;
  state_code?: string | null;
  benefit_summary?: string;
  eligibility_rules?: Record<string, unknown>;
  required_documents?: string[];
  official_apply_url?: string | null;
  source_url?: string;
};

export type RequestChangesRequest = {
  reason: string;
};

export type AuditEventSummary = {
  id: string;
  actor_admin_id: string | null;
  actor_email?: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AuditEventsResponse = {
  items: AuditEventSummary[];
  total: number;
  page: number;
  page_size: number;
};

/* ------------------------------------------------------------------ Phase 3 */

export type DocumentStatus = "uploaded" | "processing" | "extracted" | "failed";

export type DocumentSessionResponse = {
  session_id: string;
  csrf_token: string;
  expires_at: string;
  max_file_size: number;
  allowed_media_types: string[];
  max_pages: number;
  max_active_documents: number;
};

export type DocumentUploadResponse = {
  id: string;
  status: DocumentStatus;
  media_type: string;
  file_size: number;
  page_count: number;
  expires_at: string;
  created_at: string;
};

export type DocumentStatusResponse = {
  id: string;
  status: DocumentStatus;
  media_type: string;
  file_size: number;
  page_count: number;
  expires_at: string;
  created_at: string;
  error_code: string | null;
  warnings: string[];
};

export type ExtractionCandidate = {
  field: string;
  value: unknown;
  raw_text: string;
  page: number;
  method: string;
  confidence: number | null;
};

export type PageTextItem = {
  page: number;
  text: string;
  method: string;
};

export type DocumentExtractionResponse = {
  document_id: string;
  status: DocumentStatus;
  extractor_version: string;
  pages: PageTextItem[];
  candidates: ExtractionCandidate[];
  warnings: string[];
  confirmed_answers: Record<string, unknown>;
};

export type ConfirmAnswersRequest = {
  answers: Record<string, unknown>;
};

export type ConfirmAnswersResponse = {
  document_id: string;
  confirmed_answers: Record<string, unknown>;
  status: string;
};

/* ------------------------------------------------------------------ Phase 4 */

export type RequiredDocument = {
  id?: string;
  name: string;
  description?: string;
  mandatory?: boolean;
};

export type PreparationConditionSummary = {
  fact: string;
  requirement: string;
  explanation: string;
  status: string;
};

export type PreparationEligibilitySummary = {
  outcome: EligibilityOutcome;
  summary: string;
  missing_fields: string[];
  met: PreparationConditionSummary[];
  failed: PreparationConditionSummary[];
  unknown: PreparationConditionSummary[];
};

export type PreparationDraftResponse = {
  id: string;
  scheme_id: string;
  scheme_slug: string;
  scheme_name: string;
  department: string;
  official_apply_url: string | null;
  source_url: string;
  required_documents: RequiredDocument[];
  answers: Record<string, AnswerValue>;
  checklist_state: Record<string, boolean>;
  eligibility_summary: PreparationEligibilitySummary;
  disclaimer: string;
  expires_at: string;
  updated_at: string;
};

export type PreparationDraftCreateRequest = {
  scheme_id: string;
  answers?: Record<string, AnswerValue>;
  checklist_state?: Record<string, boolean>;
};

export type PreparationDraftUpdateRequest = {
  answers?: Record<string, AnswerValue>;
  checklist_state?: Record<string, boolean>;
};

/* ------------------------------------------------------------------ Phase 5 */

export type AreaType = "rural" | "urban" | "skip";

export type UserPreferences = {
  language: string;
  state_code?: string | null;
  district?: string | null;
  area_type: AreaType;
};

export type PreferencesResponse = {
  preferences: UserPreferences;
  has_set_preferences: boolean;
  csrf_token?: string | null;
};

export type StateItem = {
  code: string;
  name: string;
  name_hi: string;
  districts: string[];
};

export type LocaleItem = {
  code: string;
  name: string;
  native_name: string;
  is_supported: boolean;
};

export type LocationMetadataResponse = {
  states: StateItem[];
  locales: LocaleItem[];
};

/* ------------------------------------------------------------------ Phase 6 */

export type GovernmentSourceDetail = {
  id: string;
  name: string;
  official_url: string;
  source_type: string;
  jurisdiction: Jurisdiction;
  state_code: string | null;
  last_checked_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type GovernmentSourceListResponse = {
  items: GovernmentSourceDetail[];
  total: number;
};

export type GovernmentSourceCreate = {
  name: string;
  official_url: string;
  source_type?: string;
  jurisdiction: Jurisdiction;
  state_code?: string | null;
  notes?: string | null;
};

export type ImportCandidateDetail = {
  id: string;
  source_id: string;
  source_url: string;
  external_reference: string | null;
  extracted_data: Record<string, unknown>;
  status: "pending" | "promoted" | "rejected";
  promoted_scheme_id: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportCandidateListResponse = {
  items: ImportCandidateDetail[];
  total: number;
};

export type PromoteCandidateResponse = {
  candidate_id: string;
  scheme_id: string;
  scheme_slug: string;
  review_status: string;
};





