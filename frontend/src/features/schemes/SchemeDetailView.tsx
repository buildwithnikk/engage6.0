"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getScheme } from "@/lib/api-client";
import { ApiError, type SchemeDetail } from "@/types/api";
import { EligibilityForm } from "./EligibilityForm";
import { DemoNotice, ReviewBadge } from "./SchemeBadges";

type State =
  | { phase: "loading" }
  | { phase: "ready"; scheme: SchemeDetail }
  | { phase: "error"; error: ApiError };

export function SchemeDetailView({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      setState({ phase: "ready", scheme: await getScheme(slug) });
    } catch (err) {
      setState({
        phase: "error",
        error: err instanceof ApiError ? err : new ApiError("network", "Unexpected error."),
      });
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading") {
    return (
      <div aria-busy="true" className="space-y-3">
        <div className="h-7 w-2/3 animate-pulse rounded bg-[var(--line)]" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--line)]" />
        <div className="h-24 w-full animate-pulse rounded bg-[var(--line)]" />
      </div>
    );
  }

  if (state.phase === "error") {
    const notFound = state.error.status === 404;
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
        <strong className="block text-sm">
          {notFound ? "Scheme not found" : "Could not load this scheme"}
        </strong>
        <p className="mt-1 text-sm">
          {notFound
            ? "No verified scheme exists with this identifier. Unverified records are not served publicly."
            : state.error.message}
        </p>
        <div className="mt-3 flex gap-2">
          {!notFound && (
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white"
            >
              Retry
            </button>
          )}
          <Link
            href="/schemes"
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm"
          >
            Back to all schemes
          </Link>
        </div>
      </div>
    );
  }

  const { scheme } = state;

  return (
    <article className="space-y-6">
      <div>
        <Link href="/schemes" className="text-sm text-brand underline-offset-2 hover:underline">
          ← All schemes
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-bold">{scheme.official_name}</h1>
          <ReviewBadge status={scheme.review_status} />
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {scheme.department} ·{" "}
          {scheme.jurisdiction === "state"
            ? `State scheme${scheme.state_code ? ` (${scheme.state_code})` : ""}`
            : "Central scheme"}
        </p>
      </div>

      <DemoNotice status={scheme.review_status} />

      <section aria-labelledby="benefit-heading">
        <h2 id="benefit-heading" className="font-semibold">
          Benefit
        </h2>
        <p className="mt-1 text-sm">{scheme.benefit_summary}</p>
      </section>

      {scheme.required_documents.length > 0 && (
        <section aria-labelledby="docs-heading">
          <h2 id="docs-heading" className="font-semibold">
            Documents required
          </h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {scheme.required_documents.map((doc) => (
              <li key={doc}>{doc}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="source-heading" className="rounded-xl border border-[var(--line)] p-4">
        <h2 id="source-heading" className="font-semibold">
          Source
        </h2>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex flex-wrap gap-2">
            <dt className="text-[var(--muted)]">Official source:</dt>
            <dd>
              <a
                href={scheme.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-brand underline"
              >
                {scheme.source_url}
              </a>
            </dd>
          </div>
          {scheme.official_apply_url && (
            <div className="flex flex-wrap gap-2">
              <dt className="text-[var(--muted)]">Apply at:</dt>
              <dd>
                <a
                  href={scheme.official_apply_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline"
                >
                  {scheme.official_apply_url}
                </a>
              </dd>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <dt className="text-[var(--muted)]">Verified:</dt>
            <dd>
              {scheme.verified_at
                ? new Date(scheme.verified_at).toLocaleDateString()
                : "Not verified"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-[var(--muted)]">Rules version:</dt>
            <dd>{scheme.rules_version}</dd>
          </div>
        </dl>
      </section>

      <EligibilityForm scheme={scheme} />
    </article>
  );
}
