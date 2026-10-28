import { BackendStatus } from "@/features/system/BackendStatus";

/**
 * Landing page. Deliberately plain: Phase 0 proves the Next.js → FastAPI path works
 * and states honestly what does not exist yet. No scheme lists, no sample eligibility
 * results, no placeholder AI output.
 */
export default function HomePage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Sahayak</h1>
        <p className="mt-2 text-[var(--muted)]">
          A multilingual citizen-assistance platform for discovering government schemes,
          checking eligibility, and understanding official documents and forms.
        </p>
        <p className="mt-3 inline-block rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)]">
          Phase 0 — foundation only. No citizen-facing feature is implemented yet.
        </p>
      </section>

      <BackendStatus />

      <section aria-labelledby="scope-heading">
        <h2 id="scope-heading" className="font-semibold">
          What exists today
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          <Item done>Next.js frontend with a typed client for the Python API</Item>
          <Item done>FastAPI service with a versioned <code>/api/v1</code> router</Item>
          <Item done>Health endpoint reporting the real database connection state</Item>
          <Item done>Architecture, API, schema, phase and privacy documentation</Item>
          <Item done>Scheme catalogue, searchable and filterable</Item>
          <Item done>Deterministic eligibility evaluator with explained results</Item>
          <Item>Document understanding and form preparation — later phase</Item>
          <Item>Civic complaint tracking — later phase</Item>
        </ul>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Phases are gated: a later phase starts only when the previous one is demonstrably
          complete.
        </p>
      </section>
    </div>
  );
}

function Item({ children, done = false }: { children: React.ReactNode; done?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className={done ? "text-emerald-600" : "text-[var(--muted)]"}>
        {done ? "✓" : "○"}
      </span>
      <span className={done ? undefined : "text-[var(--muted)]"}>
        {children}
        <span className="sr-only">{done ? " (implemented)" : " (not implemented)"}</span>
      </span>
    </li>
  );
}
