// PERSON C OWNS THIS FILE.
// Nominatim allows 1 req/sec and requires a User-Agent. It WILL rate-limit during
// a demo, so every failure falls back to a ward guess.

const WARD_FALLBACK = "Ward 7 — Rampur";

const DEPARTMENTS: Record<string, string> = {
  pothole: "PWD — Road Maintenance",
  garbage: "Municipal — Sanitation",
  streetlight: "Electricity Board — Street Lighting",
  waterlogging: "Municipal — Drainage",
  drainage: "Municipal — Drainage",
  other: "District Collectorate — Public Grievance Cell",
};

export function departmentFor(category: string): string {
  return DEPARTMENTS[category] ?? DEPARTMENTS.other;
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ ward: string; district: string; source: "nominatim" | "fallback" }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Sahayak-Hackathon/0.1 (civic grievance prototype)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const a = data.address ?? {};
    const ward = a.city_district || a.suburb || a.neighbourhood || a.village || a.town || WARD_FALLBACK;
    const district = a.state_district || a.county || "Sitapur";
    return { ward, district, source: "nominatim" };
  } catch {
    return { ward: WARD_FALLBACK, district: "Sitapur", source: "fallback" };
  }
}
