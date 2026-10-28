// Shared shapes. These mirror sheet "7. API Contracts" in Sahayak_Hackathon_Plan.xlsx.
// Frozen at 0:20 — change these only with all three people in the room.

export type Lang = "hi" | "en" | "ta" | "bn" | "mr" | "te" | "kn" | "or";

export type Profile = {
  name?: string;
  dob?: string;
  gender?: "male" | "female" | "other";
  income?: number;
  category?: "GEN" | "OBC" | "SC" | "ST" | "EWS";
  state?: string;
  district?: string;
  occupation?: string;
  disability?: boolean;
  docs?: string[]; // ids of documents the citizen already holds
};

export type Mismatch = {
  field: string;
  values: string[];
  sources: string[];
  risk: "high" | "medium" | "low";
  advice: string;
};

export type ExtractResult = {
  name?: string;
  dob?: string;
  gender?: Profile["gender"];
  income?: number;
  category?: Profile["category"];
  state?: string;
  district?: string;
  docType: string;
  expiryDate?: string | null;
  confidence: number;
  mismatch: Mismatch[];
};

export type Scheme = {
  id: string;
  name: string;
  nameHi?: string;
  dept: string;
  benefitAmount: number; // rupees per year; 0 when the benefit is non-monetary
  benefitNote?: string;
  docsRequired: string[];
  applyUrl: string;
  officeType: string;
  rule: unknown; // json-logic applied to a Profile
};

export type MatchResult = {
  eligible: Scheme[];
  nearMiss: { schemeId: string; name: string; missingDoc: string; benefitAmount: number }[];
  totalUnclaimed: number;
};

export type CivicClass = {
  category: "pothole" | "garbage" | "streetlight" | "waterlogging" | "drainage" | "other";
  severity: "low" | "medium" | "high";
  department: string;
  suggestedTitle: string;
  description: string;
};

export type Complaint = {
  id: string;
  imageUrl?: string;
  lat: number;
  lng: number;
  ward: string;
  department: string;
  category: string;
  description: string;
  status: "open" | "acknowledged" | "escalated" | "rti" | "resolved";
  anonymous: boolean;
  createdAt: string;
  resolvedAt?: string | null;
};

export type ComplaintEvent = {
  stage: string;
  at: string;
  note: string;
};

export type RouteResult = {
  distanceKm: number;
  durationMin: number;
  fareApprox: number;
  steps: string[];
  geometry: [number, number][];
  source: "osrm" | "fallback";
};

export type Pass = {
  qrDataUrl: string;
  payload: string;
  signature: string;
  publicKey: string;
};

export type Stats = {
  perWard: { ward: string; open: number; resolved: number }[];
  medianResolveDays: number;
  categorySplit: { category: string; count: number }[];
  hotspots: { ward: string; category: string; repeats: number }[];
};
