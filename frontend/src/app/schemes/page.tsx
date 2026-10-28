import type { Metadata } from "next";
import { SchemeList } from "@/features/schemes/SchemeList";

export const metadata: Metadata = {
  title: "Schemes — Sahayak",
  description: "Search verified government schemes and check your eligibility.",
};

export default function SchemesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schemes · सरकारी योजनाएं</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Search the catalogue and check your eligibility against the rules recorded for each
          scheme. Results are informational estimates, not official decisions.
        </p>
      </div>
      <SchemeList />
    </div>
  );
}
