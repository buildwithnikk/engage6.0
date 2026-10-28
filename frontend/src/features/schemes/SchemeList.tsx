"use client";

/**
 * Scheme discovery: search, filter, paginate.
 *
 * Calls the real API. There is no fallback list — an empty result means the
 * catalogue is empty for that query, and the empty state explains the most
 * likely reason rather than looking like a bug.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listSchemes } from "@/lib/api-client";
import { ApiError, type Jurisdiction, type SchemeListResponse } from "@/types/api";
import { ReviewBadge } from "./SchemeBadges";

type State =
  | { phase: "loading" }
  | { phase: "ready"; data: SchemeListResponse }
  | { phase: "error"; error: ApiError };

const PAGE_SIZE = 10;

export function SchemeList() {
  const [q, setQ] = useState("");
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | "">("");
  const [stateCode, setStateCode] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const data = await listSchemes({
        q,
        jurisdiction,
        state_code: stateCode,
        page,
        page_size: PAGE_SIZE,
      });
      setState({ phase: "ready", data });
    } catch (err) {
      setState({
        phase: "error",
        error: err instanceof ApiError ? err : new ApiError("network", "Unexpected error."),
      });
    }
  }, [q, jurisdiction, stateCode, page]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const totalPages =
    state.phase === "ready" ? Math.max(1, Math.ceil(state.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <div>
          <label htmlFor="scheme-q" className="mb-1 block text-sm text-[var(--muted)]">
            Search
          </label>
          <input
            id="scheme-q"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Name, benefit or department"
            className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="scheme-jurisdiction" className="mb-1 block text-sm text-[var(--muted)]">
            Jurisdiction
          </label>
          <select
            id="scheme-jurisdiction"
            value={jurisdiction}
            onChange={(e) => {
              setPage(1);
              setJurisdiction(e.target.value as Jurisdiction | "");
            }}
            className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2"
          >
            <option value="">Any</option>
            <option value="central">Central</option>
            <option value="state">State</option>
          </select>
        </div>

        <div>
          <label htmlFor="scheme-state" className="mb-1 block text-sm text-[var(--muted)]">
            State code
          </label>
          <input
            id="scheme-state"
            value={stateCode}
            onChange={(e) => {
              setPage(1);
              setStateCode(e.target.value);
            }}
            placeholder="UP"
            maxLength={10}
            className="w-24 rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 uppercase"
          />
        </div>
      </form>

      <div aria-live="polite" aria-busy={state.phase === "loading"}>
        {state.phase === "loading" && (
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="rounded-xl border border-[var(--line)] p-4">
                <div className="h-5 w-2/3 animate-pulse rounded bg-[var(--line)]" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-[var(--line)]" />
              </li>
            ))}
          </ul>
        )}

        {state.phase === "error" && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
            <strong className="block text-sm">Could not load schemes</strong>
            <p className="mt-1 text-sm">{state.error.message}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white"
            >
              Retry
            </button>
          </div>
        )}

        {state.phase === "ready" && state.data.items.length === 0 && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
            <strong className="block">No schemes match</strong>
            <p className="mt-1 text-sm text-[var(--muted)]">
              The catalogue only serves records that have been <em>verified</em> against an
              official government source. Seeded demo records are deliberately unverified, so
              they do not appear here.
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              To see them while developing, set <code>ALLOW_UNVERIFIED_SCHEMES=true</code> in{" "}
              <code>backend/.env</code> and restart the API.
            </p>
          </div>
        )}

        {state.phase === "ready" && state.data.items.length > 0 && (
          <>
            <p className="mb-3 text-sm text-[var(--muted)]">
              {state.data.total} scheme{state.data.total === 1 ? "" : "s"} found
            </p>
            <ul className="space-y-3">
              {state.data.items.map((scheme) => (
                <li
                  key={scheme.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`/schemes/${scheme.slug}`}
                      className="font-semibold text-brand underline-offset-2 hover:underline"
                    >
                      {scheme.official_name}
                    </Link>
                    <ReviewBadge status={scheme.review_status} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {scheme.department} ·{" "}
                    {scheme.jurisdiction === "state"
                      ? `State${scheme.state_code ? ` (${scheme.state_code})` : ""}`
                      : "Central"}
                  </p>
                  <p className="mt-2 text-sm">{scheme.benefit_summary}</p>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <nav className="mt-4 flex items-center gap-3" aria-label="Pagination">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-[var(--muted)]">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
