export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-[var(--line)] py-6">
      <div className="mx-auto max-w-3xl px-4 text-xs text-[var(--muted)]">
        <p>
          Phase 1. Scheme catalogue and eligibility checks are live; document processing,
          complaints and accounts are not built yet — see <code>docs/phase-plan.md</code>.
        </p>
        <p className="mt-1">
          Eligibility results are informational estimates based on recorded rules. Nothing shown
          here is an official government determination.
        </p>
      </div>
    </footer>
  );
}
