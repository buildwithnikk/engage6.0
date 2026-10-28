"use client";

/**
 * Phase 5 Main Scheme Discovery Screen.
 *
 * Displays three distinct sections:
 * 1. "Schemes for your State" (scoped to visitor's selected state in session)
 * 2. "Central Government Schemes" (nationwide initiatives)
 * 3. "Scholarships" (educational grants and student support)
 *
 * Full bilingual support (English & Hindi) without changing underlying IDs or URLs.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listSchemes } from "@/lib/api-client";
import { usePreferences } from "@/features/preferences/PreferencesContext";
import { ApiError, type SchemeSummary } from "@/types/api";
import { ReviewBadge } from "./SchemeBadges";

type SchemesState =
  | { phase: "loading" }
  | { phase: "ready"; all: SchemeSummary[] }
  | { phase: "error"; error: ApiError };

export function SchemeList() {
  const { preferences, states, openModal, resetPreferences, t } = usePreferences();
  const [q, setQ] = useState("");
  const [state, setState] = useState<SchemesState>({ phase: "loading" });

  const loadAll = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      // Fetch verified catalogue items
      const res = await listSchemes({
        q: q.trim() || undefined,
        page_size: 100,
      });
      setState({ phase: "ready", all: res.items });
    } catch (err) {
      setState({
        phase: "error",
        error: err instanceof ApiError ? err : new ApiError("network", "Unexpected error."),
      });
    }
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => void loadAll(), 250);
    return () => clearTimeout(timer);
  }, [loadAll]);

  const currentStateObj = states.find((s) => s.code === preferences.state_code);
  const stateDisplay = currentStateObj
    ? preferences.language === "hi"
      ? `${currentStateObj.name_hi} (${currentStateObj.name})`
      : currentStateObj.name
    : preferences.state_code;

  return (
    <div className="space-y-8">
      {/* 1. Preferences Bar / Filter Header */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
              📍 {stateDisplay ? stateDisplay : t("no_state_selected")}
            </span>
            {preferences.district && (
              <span className="rounded-lg bg-[var(--bg)] border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)]">
                {preferences.district}
              </span>
            )}
            {preferences.area_type && preferences.area_type !== "skip" && (
              <span className="rounded-lg bg-[var(--bg)] border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)] capitalize">
                {preferences.area_type === "rural" ? t("area_rural") : t("area_urban")}
              </span>
            )}
            <span className="rounded-lg bg-[var(--bg)] border border-[var(--line)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
              {preferences.language === "hi" ? "हिन्दी" : "English"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openModal}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              ⚙️ {t("change_preferences")}
            </button>
            {preferences.state_code && (
              <button
                type="button"
                onClick={() => void resetPreferences()}
                className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--bg)]"
              >
                {t("reset_preferences")}
              </button>
            )}
          </div>
        </div>

        {/* Domicile Disclaimer */}
        <p className="text-[11px] text-[var(--muted)] border-t border-[var(--line)] pt-2 leading-relaxed">
          ℹ️ {t("domicile_disclaimer")}
        </p>

        {/* Search input */}
        <div className="pt-1">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search_placeholder")}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Loading State */}
      {state.phase === "loading" && (
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--line)] p-5 space-y-3">
              <div className="h-6 w-1/3 animate-pulse rounded bg-[var(--line)]" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--line)]" />
              <div className="h-24 w-full animate-pulse rounded bg-[var(--line)]" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {state.phase === "error" && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-900">
          <strong className="block text-sm">Could not load scheme catalogue</strong>
          <p className="mt-1 text-sm">{state.error.message}</p>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="mt-3 rounded-lg bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Ready State: 3 Sections */}
      {state.phase === "ready" && (
        <div className="space-y-10">
          {/* SECTION 1: SCHEMES FOR YOUR STATE */}
          <section aria-labelledby="state-schemes-heading" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] pb-2">
              <div>
                <h2 id="state-schemes-heading" className="text-xl font-bold flex items-center gap-2">
                  <span>🏛️</span> {t("state_schemes_heading")}
                  {preferences.state_code && (
                    <span className="text-sm font-normal text-indigo-700">
                      ({stateDisplay})
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {t("state_schemes_subheading")}
                </p>
              </div>
            </div>

            {!preferences.state_code ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--card)] p-6 text-center space-y-3">
                <span className="text-2xl">📍</span>
                <p className="text-sm font-semibold">{t("no_state_selected")}</p>
                <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
                  {t("domicile_disclaimer")}
                </p>
                <button
                  type="button"
                  onClick={openModal}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  {t("choose_state_btn")}
                </button>
              </div>
            ) : (
              (() => {
                const stateSchemes = state.all.filter(
                  (s) =>
                    s.jurisdiction === "state" &&
                    s.state_code?.toUpperCase() === preferences.state_code?.toUpperCase()
                );

                if (stateSchemes.length === 0) {
                  return (
                    <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted)]">
                      <p>{t("no_state_schemes")}</p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {stateSchemes.map((scheme) => (
                      <SchemeCard key={scheme.id} scheme={scheme} t={t} />
                    ))}
                  </div>
                );
              })()
            )}
          </section>

          {/* SECTION 2: CENTRAL GOVERNMENT SCHEMES */}
          <section aria-labelledby="central-schemes-heading" className="space-y-4">
            <div className="border-b border-[var(--line)] pb-2">
              <h2 id="central-schemes-heading" className="text-xl font-bold flex items-center gap-2">
                <span>🇮🇳</span> {t("central_schemes_heading")}
              </h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {t("central_schemes_subheading")}
              </p>
            </div>

            {(() => {
              const centralSchemes = state.all.filter((s) => s.jurisdiction === "central");
              if (centralSchemes.length === 0) {
                return (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted)]">
                    <p>{t("no_central_schemes")}</p>
                  </div>
                );
              }
              return (
                <div className="grid gap-3 sm:grid-cols-2">
                  {centralSchemes.map((scheme) => (
                    <SchemeCard key={scheme.id} scheme={scheme} t={t} />
                  ))}
                </div>
              );
            })()}
          </section>

          {/* SECTION 3: SCHOLARSHIPS & STUDENT AID */}
          <section aria-labelledby="scholarships-heading" className="space-y-4">
            <div className="border-b border-[var(--line)] pb-2">
              <h2 id="scholarships-heading" className="text-xl font-bold flex items-center gap-2">
                <span>🎓</span> {t("scholarships_heading")}
              </h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {t("scholarships_subheading")}
              </p>
            </div>

            {(() => {
              const scholarshipKeywords = [
                "scholarship",
                "study",
                "student",
                "allowance",
                "education",
                "विद्या",
                "छात्र",
                "शिक्षा",
              ];
              const scholarships = state.all.filter((s) => {
                const combined = `${s.official_name} ${s.benefit_summary} ${s.department}`.toLowerCase();
                return scholarshipKeywords.some((kw) => combined.includes(kw));
              });

              if (scholarships.length === 0) {
                return (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted)]">
                    <p>{t("no_scholarships")}</p>
                  </div>
                );
              }
              return (
                <div className="grid gap-3 sm:grid-cols-2">
                  {scholarships.map((scheme) => (
                    <SchemeCard key={scheme.id} scheme={scheme} t={t} />
                  ))}
                </div>
              );
            })()}
          </section>
        </div>
      )}
    </div>
  );
}

function SchemeCard({
  scheme,
  t,
}: {
  scheme: SchemeSummary;
  t: (k: import("@/lib/locale").TranslationKey) => string;
}) {
  return (
    <article className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm hover:border-indigo-300 transition">
      <div>
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/schemes/${scheme.slug}`}
            className="font-bold text-sm text-[var(--text)] hover:text-indigo-600 line-clamp-2"
          >
            {scheme.official_name}
          </Link>
          <ReviewBadge status={scheme.review_status} />
        </div>

        <p className="mt-1 text-[11px] text-[var(--muted)]">
          {scheme.department} ·{" "}
          <span className="font-medium">
            {scheme.jurisdiction === "state"
              ? `${t("jurisdiction_state")}${scheme.state_code ? ` (${scheme.state_code})` : ""}`
              : t("jurisdiction_central")}
          </span>
        </p>

        <p className="mt-2 text-xs text-[var(--muted)] line-clamp-3 leading-relaxed">
          {scheme.benefit_summary}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
        <Link
          href={`/schemes/${scheme.slug}`}
          className="text-xs font-semibold text-indigo-600 hover:underline"
        >
          {t("view_details")}
        </Link>
        <Link
          href={`/schemes/${scheme.slug}/prepare`}
          className="rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 text-xs font-semibold"
        >
          📝 {t("prepare_application")}
        </Link>
      </div>
    </article>
  );
}
