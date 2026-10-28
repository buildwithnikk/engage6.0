// Every API route falls back to this data. Rule 3 from the plan: if an API dies
// on stage, the UI still works. Keep it realistic — it IS the demo.

import type { CivicClass, Complaint, ComplaintEvent, ExtractResult, Profile, RouteResult, Stats } from "./types";

export const DEMO_PROFILE: Profile = {
  name: "Sunita Devi",
  dob: "1989-06-14",
  gender: "female",
  income: 96000,
  category: "OBC",
  state: "Uttar Pradesh",
  district: "Sitapur",
  occupation: "daily wage labour",
  disability: false,
  docs: ["aadhaar", "income_certificate", "bank_passbook", "ration_card"],
};

export const DEMO_EXTRACT: ExtractResult = {
  name: "Sunita Devi",
  dob: "1989-06-14",
  gender: "female",
  income: 96000,
  category: "OBC",
  state: "Uttar Pradesh",
  district: "Sitapur",
  docType: "income_certificate",
  expiryDate: "2026-03-31",
  confidence: 0.92,
  mismatch: [
    {
      field: "name",
      values: ["Sunita Devi", "Sunita Kumari"],
      sources: ["Aadhaar", "Bank passbook"],
      risk: "high",
      advice:
        "Aadhaar और बैंक पासबुक में नाम अलग है। आवेदन से पहले बैंक में नाम ठीक कराएं, वरना DBT भुगतान रुक जाएगा।",
    },
  ],
};

export const DEMO_CIVIC: CivicClass = {
  category: "pothole",
  severity: "high",
  department: "Public Works Department (PWD) — Road Maintenance",
  suggestedTitle: "Large pothole on the main approach road near the bus stop",
  description:
    "A pothole roughly 1.2 m wide and 20 cm deep has formed on the carriageway. Two-wheelers are swerving into oncoming traffic to avoid it. Standing water indicates a drainage failure underneath.",
};

export const DEMO_ROUTE: RouteResult = {
  distanceKm: 11.4,
  durationMin: 38,
  fareApprox: 15,
  steps: [
    "Walk 400 m to Rampur Chauraha bus stop (6 min)",
    "Board bus 42 towards Sitapur Tehsil (departs 8:15 am, ₹15)",
    "Ride 9.8 km — about 26 min",
    "Get off at Tehsil Gate and walk 250 m to Counter 4 (4 min)",
  ],
  geometry: [
    [80.6823, 27.5705],
    [80.6901, 27.5748],
    [80.7042, 27.5811],
    [80.7188, 27.5872],
  ],
  source: "fallback",
};

export const DEMO_COMPLAINTS: Complaint[] = [
  {
    id: "CMP-1041",
    lat: 27.5705,
    lng: 80.6823,
    ward: "Ward 7 — Rampur",
    department: "PWD — Road Maintenance",
    category: "pothole",
    description: "Large pothole near the bus stop, water logged.",
    status: "escalated",
    anonymous: false,
    createdAt: "2026-10-06T09:12:00Z",
  },
  {
    id: "CMP-1038",
    lat: 27.5749,
    lng: 80.6901,
    ward: "Ward 7 — Rampur",
    department: "Municipal — Sanitation",
    category: "garbage",
    description: "Garbage not collected for 9 days behind the school.",
    status: "open",
    anonymous: true,
    createdAt: "2026-10-12T05:40:00Z",
  },
  {
    id: "CMP-1022",
    lat: 27.5811,
    lng: 80.7042,
    ward: "Ward 3 — Civil Lines",
    department: "Electricity Board",
    category: "streetlight",
    description: "Four streetlights dead on the stretch near the girls' hostel.",
    status: "resolved",
    anonymous: false,
    createdAt: "2026-09-28T17:05:00Z",
    resolvedAt: "2026-10-05T11:20:00Z",
  },
  {
    id: "CMP-1009",
    lat: 27.5872,
    lng: 80.7188,
    ward: "Ward 11 — Kashipur",
    department: "Municipal — Drainage",
    category: "waterlogging",
    description: "Drain overflows onto the road after every rain.",
    status: "open",
    anonymous: false,
    createdAt: "2026-10-18T13:30:00Z",
  },
];

export const DEMO_EVENTS: ComplaintEvent[] = [
  { stage: "Filed", at: "2026-10-06T09:12:00Z", note: "Complaint filed with photo and GPS location." },
  { stage: "Routed", at: "2026-10-06T09:12:40Z", note: "Auto-routed to PWD Road Maintenance, Ward 7." },
  { stage: "Acknowledged", at: "2026-10-08T10:02:00Z", note: "Junior Engineer acknowledged. No site visit recorded." },
  { stage: "Escalated", at: "2026-10-21T08:00:00Z", note: "15 days with no action — escalation letter drafted for the Executive Engineer." },
];

export const DEMO_STATS: Stats = {
  perWard: [
    { ward: "Ward 3", open: 4, resolved: 19 },
    { ward: "Ward 7", open: 14, resolved: 6 },
    { ward: "Ward 11", open: 9, resolved: 11 },
    { ward: "Ward 14", open: 3, resolved: 15 },
  ],
  medianResolveDays: 9,
  categorySplit: [
    { category: "pothole", count: 21 },
    { category: "garbage", count: 17 },
    { category: "streetlight", count: 12 },
    { category: "waterlogging", count: 8 },
    { category: "drainage", count: 5 },
  ],
  hotspots: [
    { ward: "Ward 7", category: "pothole", repeats: 5 },
    { ward: "Ward 11", category: "waterlogging", repeats: 4 },
    { ward: "Ward 7", category: "garbage", repeats: 3 },
  ],
};

export const DEMO_OFFICES = [
  { id: "tehsil-sitapur", name: "Tehsil Office, Sitapur", lat: 27.5872, lng: 80.7188, type: "tehsil" },
  { id: "bank-pnb-rampur", name: "Punjab National Bank, Rampur", lat: 27.5748, lng: 80.6901, type: "bank" },
  { id: "block-office", name: "Block Development Office", lat: 27.5811, lng: 80.7042, type: "block" },
  { id: "csc-rampur", name: "Common Service Centre, Rampur", lat: 27.571, lng: 80.6835, type: "csc" },
];
