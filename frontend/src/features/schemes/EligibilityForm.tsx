"use client";

/**
 * Questionnaire generated from the scheme's `required_facts`.
 *
 * The browser does not know the rule vocabulary and does not evaluate anything —
 * it collects answers and asks the backend. A second evaluator here would
 * eventually disagree with the Python one, and the citizen would get two
 * different answers to the same question.
 *
 * Unanswered questions are omitted from the request rather than sent as empty
 * values, so the backend can distinguish "not answered" from "answered with
 * nothing" and return needs_more_information honestly.
 */

import { useState } from "react";
import { checkEligibility } from "@/lib/api-client";
import {
  ApiError,
  type AnswerValue,
  type ConditionOutcome,
  type EligibilityResponse,
  type SchemeDetail,
} from "@/types/api";
import { Disclaimer } from "./SchemeBadges";

type State =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "done"; result: EligibilityResponse }
  | { phase: "error"; error: ApiError };

function humanise(fact: string): string {
  const text = fact.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function EligibilityForm({ scheme }: { scheme: SchemeDetail }) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [state, setState] = useState<State>({ phase: "idle" });

  if (!scheme.rules_readable) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <strong className="block text-sm">Eligibility cannot be checked for this scheme</strong>
        <p className="mt-1 text-sm">
          Its recorded rules use a condition this version does not support. Rather than
          guess, we show nothing. Please read the official source.
        </p>
      </div>
    );
  }

  if (scheme.required_facts.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--line)] p-4">
        <p className="text-sm text-[var(--muted)]">
          No eligibility rules have been recorded for this scheme yet, so no check can be
          made. Please read the official source.
        </p>
      </div>
    );
  }

  const setAnswer = (fact: string, value: AnswerValue) =>
    setAnswers((prev) => ({ ...prev, [fact]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ phase: "checking" });

    // Drop blanks: an unanswered question must reach the backend as absent.
    const payload: Record<string, AnswerValue> = {};
    for (const [key, value] of Object.entries(answers)) {
      if (value === null || value === "") continue;
      payload[key] = value;
    }

    try {
      setState({ phase: "done", result: await checkEligibility(scheme.slug, payload) });
    } catch (err) {
      setState({
        phase: "error",
        error: err instanceof ApiError ? err : new ApiError("network", "Unexpected error."),
      });
    }
  };

  return (
    <section aria-labelledby="eligibility-heading" className="space-y-4">
      <h2 id="eligibility-heading" className="font-semibold">
        Check your eligibility
      </h2>

      <form onSubmit={submit} className="space-y-4">
        {scheme.required_facts.map((fact) => {
          const id = `fact-${fact.fact}`;
          const hintId = `${id}-hint`;
          return (
            <div key={fact.fact}>
              <label htmlFor={id} className="mb-1 block text-sm font-medium">
                {humanise(fact.fact)}
              </label>
              <p id={hintId} className="mb-1 text-xs text-[var(--muted)]">
                {fact.requirements.join(" · ")}
              </p>

              {fact.kind === "integer" && (
                <input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  aria-describedby={hintId}
                  value={(answers[fact.fact] as number | undefined) ?? ""}
                  onChange={(e) =>
                    setAnswer(fact.fact, e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2"
                />
              )}

              {fact.kind === "choice" && (
                <select
                  id={id}
                  aria-describedby={hintId}
                  value={(answers[fact.fact] as string | undefined) ?? ""}
                  onChange={(e) => setAnswer(fact.fact, e.target.value || null)}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2"
                >
                  <option value="">Not answered</option>
                  {fact.choices.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              )}

              {fact.kind === "boolean" && (
                <select
                  id={id}
                  aria-describedby={hintId}
                  value={
                    answers[fact.fact] === true
                      ? "yes"
                      : answers[fact.fact] === false
                        ? "no"
                        : ""
                  }
                  onChange={(e) =>
                    setAnswer(
                      fact.fact,
                      e.target.value === "" ? null : e.target.value === "yes",
                    )
                  }
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2"
                >
                  <option value="">Not answered</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              )}

              {fact.kind === "text" && (
                <input
                  id={id}
                  type="text"
                  aria-describedby={hintId}
                  value={(answers[fact.fact] as string | undefined) ?? ""}
                  onChange={(e) => setAnswer(fact.fact, e.target.value || null)}
                  className="w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2"
                />
              )}
            </div>
          );
        })}

        <button
          type="submit"
          disabled={state.phase === "checking"}
          className="rounded-lg bg-brand px-4 py-2 text-white disabled:opacity-50"
        >
          {state.phase === "checking" ? "Checking…" : "Check eligibility"}
        </button>

        <p className="text-xs text-[var(--muted)]">
          Your answers are used to calculate this result and are not stored.
        </p>
      </form>

      <div aria-live="polite">
        {state.phase === "error" && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
            <strong className="block text-sm">Could not check eligibility</strong>
            <p className="mt-1 text-sm">{state.error.message}</p>
          </div>
        )}

        {state.phase === "done" && <EligibilityResult result={state.result} />}
      </div>
    </section>
  );
}

const OUTCOME_STYLE: Record<EligibilityResponse["outcome"], { tone: string; title: string }> = {
  eligible: {
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
    title: "You appear to be eligible",
  },
  ineligible: {
    tone: "border-red-300 bg-red-50 text-red-900",
    title: "You do not appear to be eligible",
  },
  needs_more_information: {
    tone: "border-amber-300 bg-amber-50 text-amber-900",
    title: "More information needed",
  },
};

function EligibilityResult({ result }: { result: EligibilityResponse }) {
  const style = OUTCOME_STYLE[result.outcome];
  return (
    <div className={`space-y-4 rounded-xl border p-4 ${style.tone}`}>
      <div>
        <strong className="block">{style.title}</strong>
        <p className="mt-1 text-sm">{result.summary}</p>
      </div>

      <ConditionGroup label="Not met" items={result.failed} marker="✗" />
      <ConditionGroup label="Still unanswered" items={result.unknown} marker="?" />
      <ConditionGroup label="Met" items={result.met} marker="✓" />

      <div className="border-t border-current/20 pt-3 text-xs">
        <p>
          Rules version {result.rules_version} ·{" "}
          <a href={result.source_url} target="_blank" rel="noreferrer" className="underline">
            official source
          </a>
        </p>
        <p className="mt-1">{result.disclaimer}</p>
      </div>
      <Disclaimer text="Your answers were not saved." />
    </div>
  );
}

function ConditionGroup({
  label,
  items,
  marker,
}: {
  label: string;
  items: ConditionOutcome[];
  marker: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold">{label}</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {items.map((item) => (
          <li key={`${item.fact}-${item.type}`} className="flex gap-2">
            <span aria-hidden>{marker}</span>
            <span>
              <span className="font-medium">{item.requirement}</span>
              <span className="block text-xs opacity-80">{item.explanation}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
