// PERSON C OWNS THIS FILE.
// OSRM's public demo server is free but unmetered-unfriendly; treat a failure as
// normal and serve the cached demo route.

import { DEMO_ROUTE } from "./demo";
import type { RouteResult } from "./types";

const BUS_BASE_FARE = 10;
const BUS_PER_KM = 0.45;

export function estimateFare(distanceKm: number): number {
  return Math.max(BUS_BASE_FARE, Math.round(BUS_BASE_FARE + distanceKm * BUS_PER_KM));
}

export async function routeBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteResult> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=simplified&geometries=geojson&steps=true`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error("no route");

    const distanceKm = +(route.distance / 1000).toFixed(1);
    const steps: string[] = (route.legs?.[0]?.steps ?? [])
      .map((s: any) => {
        const road = s.name || "the road";
        const metres = Math.round(s.distance);
        return `${s.maneuver?.type ?? "continue"} on ${road} — ${metres} m`;
      })
      .slice(0, 6);

    return {
      distanceKm,
      durationMin: Math.round(route.duration / 60),
      fareApprox: estimateFare(distanceKm),
      steps: steps.length ? steps : DEMO_ROUTE.steps,
      geometry: route.geometry?.coordinates ?? DEMO_ROUTE.geometry,
      source: "osrm",
    };
  } catch {
    return DEMO_ROUTE;
  }
}
