export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-[var(--line)] py-6">
      <div className="mx-auto max-w-3xl px-4 text-xs text-[var(--muted)]">
        <p>
          Phase 0 foundation. No scheme data, eligibility results or document processing exist
          yet — see <code>docs/phase-plan.md</code>.
        </p>
        <p className="mt-1">
          Nothing shown here is an official government determination.
        </p>
      </div>
    </footer>
  );
}
