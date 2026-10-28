"use client";

/**
 * Live backend + database status.
 *
 * Calls the real FastAPI health endpoint. There is no mock path: every state below
 * reflects something the backend actually said, or the fact that it said nothing.
 *
 * Backend state and database state are reported separately on purpose — a reachable
 * API with an unconfigured database is the normal Phase 0 condition, and showing it
 * as one combined "healthy/unhealthy" light would hide that.
 */

import { useCallback, useEffect, useState } from "react";
import { getHealth } from "@/lib/api-client";
import { ApiError, type DatabaseStatus, type HealthResponse } from "@/types/api";

type State =
  | { phase: "loading" }
  | { phase: "ready"; data: HealthResponse }
  | { phase: "error"; error: ApiError };

const DB_COPY: Record<DatabaseStatus, { label: string; tone: string; note: string }> = {
  ok: {
    label: "Connected",
    tone: "bg-emerald-100 text-emerald-900",
    note: "The backend opened a connection and ran a test query.",
  },
  unconfigured: {
    label: "Not configured",
    tone: "bg-slate-200 text-slate-800",
    note: "No DATABASE_URL is set, so nothing was attempted. This is expected in Phase 0.",
  },
  unavailable: {
    label: "Unavailable",
    tone: "bg-amber-100 text-amber-900",
    note: "A DATABASE_URL is set but the connection or test query failed.",
  },
};

function errorCopy(error: ApiError): { title: string; body: string } {
  switch (error.kind) {
    case "config":
      return { title: "Frontend not configured", body: error.message };
    case "network":
      return {
        title: "Backend unreachable",
        body: `${error.message} Start it with: uvicorn app.main:app --reload --port 8000`,
      };
    case "http":
      return { title: "Backend error", body: error.message };
    case "invalid":
      return { title: "Unexpected response", body: error.message };
  }
}

export function BackendStatus() {
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      setState({ phase: "ready", data: await getHealth() });
    } catch (err) {
      const error =
        err instanceof ApiError ? err : new ApiError("network", "An unexpected error occurred.");
      setState({ phase: "error", error });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      id="status"
      aria-labelledby="status-heading"
      className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="status-heading" className="font-semibold">
          System status
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={state.phase === "loading"}
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {state.phase === "loading" ? "Checking…" : "Re-check"}
        </button>
      </div>

      {/* aria-live so a screen reader hears the result change after a re-check. */}
      <div aria-live="polite" aria-busy={state.phase === "loading"} className="mt-4">
        {state.phase === "loading" && (
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-5 w-56 animate-pulse rounded bg-[var(--line)]" />
            <p className="text-sm text-[var(--muted)]">Contacting the API…</p>
          </div>
        )}

        {state.phase === "ready" && (
          <dl className="space-y-3">
            <Row label="API (FastAPI)">
              <Badge tone="bg-emerald-100 text-emerald-900">Reachable</Badge>
              <span className="text-sm text-[var(--muted)]">v{state.data.version}</span>
            </Row>
            {/* Deliberately not "Supabase Postgres": development runs on local
                PostgreSQL and only deployment uses Supabase. Naming the vendor
                here would be wrong half the time. */}
            <Row label="Database (PostgreSQL)">
              <Badge tone={DB_COPY[state.data.database].tone}>
                {DB_COPY[state.data.database].label}
              </Badge>
            </Row>
            <p className="text-sm text-[var(--muted)]">
              {state.data.detail ?? DB_COPY[state.data.database].note}
            </p>
          </dl>
        )}

        {state.phase === "error" && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
            <div className="flex items-center gap-2">
              <Badge tone="bg-red-200 text-red-900">
                {state.error.kind === "config" ? "Misconfigured" : "Unreachable"}
              </Badge>
              <strong className="text-sm">{errorCopy(state.error).title}</strong>
            </div>
            <p className="mt-2 text-sm">{errorCopy(state.error).body}</p>
            <p className="mt-2 text-sm">
              Database status is unknown, because the API could not be asked.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="flex items-center gap-2">{children}</dd>
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{children}</span>
  );
}
