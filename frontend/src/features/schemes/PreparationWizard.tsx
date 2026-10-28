"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  createPreparationDraft,
  deletePreparationDraft,
  getDocumentExtraction,
  updatePreparationDraft,
} from "@/lib/api-client";
import {
  ApiError,
  type AnswerValue,
  type PreparationDraftResponse,
} from "@/types/api";

type Step = "overview" | "documents" | "answers" | "summary";

export function PreparationWizard({ slug }: { slug: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<PreparationDraftResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<Step>("overview");

  // Form answer fields
  const [age, setAge] = useState<string>("");
  const [income, setIncome] = useState<string>("");
  const [stateCode, setStateCode] = useState<string>("");
  const [otherAnswers, setOtherAnswers] = useState<Record<string, string>>({});

  // OCR Import modal/drawer state
  const [docIdInput, setDocIdInput] = useState("");
  const [ocrCandidates, setOcrCandidates] = useState<Record<string, unknown> | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showOcrBox, setShowOcrBox] = useState(false);

  // Load or create draft
  const loadDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createPreparationDraft({ scheme_id: slug });
      setDraft(res);
      // Populate local form fields from draft answers
      if (res.answers) {
        if (res.answers.age !== undefined && res.answers.age !== null) {
          setAge(String(res.answers.age));
        }
        if (res.answers.annual_income !== undefined && res.answers.annual_income !== null) {
          setIncome(String(res.answers.annual_income));
        }
        if (res.answers.state_code !== undefined && res.answers.state_code !== null) {
          setStateCode(String(res.answers.state_code));
        }
        const extra: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.answers)) {
          if (!["age", "annual_income", "state_code"].includes(k) && v !== null && v !== undefined) {
            extra[k] = String(v);
          }
        }
        setOtherAnswers(extra);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load preparation draft.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  // Sync answers with backend
  const handleSaveAnswers = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const payloadAnswers: Record<string, AnswerValue> = {};
      if (age.trim()) {
        const parsedAge = parseInt(age.trim(), 10);
        if (!isNaN(parsedAge)) payloadAnswers.age = parsedAge;
      }
      if (income.trim()) {
        const parsedIncome = parseFloat(income.trim());
        if (!isNaN(parsedIncome)) payloadAnswers.annual_income = parsedIncome;
      }
      if (stateCode.trim()) {
        payloadAnswers.state_code = stateCode.trim().toUpperCase();
      }
      for (const [k, v] of Object.entries(otherAnswers)) {
        if (v.trim()) payloadAnswers[k] = v.trim();
      }

      const updated = await updatePreparationDraft(draft.id, {
        answers: payloadAnswers,
      });
      setDraft(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save answers.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle checklist item
  const handleToggleDocument = async (docIdOrName: string) => {
    if (!draft) return;
    const current = !!draft.checklist_state[docIdOrName];
    const newChecklist = { ...draft.checklist_state, [docIdOrName]: !current };

    try {
      const updated = await updatePreparationDraft(draft.id, {
        checklist_state: newChecklist,
      });
      setDraft(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update checklist.");
    }
  };

  // Delete draft
  const handleDeleteDraft = async () => {
    if (!draft) return;
    if (!window.confirm("Are you sure you want to delete this temporary preparation draft?")) {
      return;
    }
    try {
      await deletePreparationDraft(draft.id);
      router.push(`/schemes/${slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete draft.");
    }
  };

  // Explicit OCR import fetch
  const handleFetchOcrCandidate = async () => {
    if (!docIdInput.trim()) return;
    setOcrLoading(true);
    setOcrError(null);
    try {
      const res = await getDocumentExtraction(docIdInput.trim());
      if (res.confirmed_answers && Object.keys(res.confirmed_answers).length > 0) {
        setOcrCandidates(res.confirmed_answers);
      } else {
        // Fall back to candidate fields if confirmed answers are empty
        const extracted: Record<string, unknown> = {};
        for (const c of res.candidates) {
          if (c.value !== undefined && c.value !== null) {
            extracted[c.field] = c.value;
          }
        }
        setOcrCandidates(extracted);
      }
    } catch (err) {
      setOcrError(err instanceof ApiError ? err.message : "Could not retrieve document extraction.");
    } finally {
      setOcrLoading(false);
    }
  };

  // User explicitly clicks "Import" to populate form
  const handleApplyOcrValues = () => {
    if (!ocrCandidates) return;
    if (ocrCandidates.age !== undefined && ocrCandidates.age !== null) {
      setAge(String(ocrCandidates.age));
    }
    if (ocrCandidates.annual_income !== undefined && ocrCandidates.annual_income !== null) {
      setIncome(String(ocrCandidates.annual_income));
    }
    if (ocrCandidates.state_code !== undefined && ocrCandidates.state_code !== null) {
      setStateCode(String(ocrCandidates.state_code));
    }
    setShowOcrBox(false);
    setOcrCandidates(null);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <div className="h-8 w-1/3 animate-pulse rounded bg-[var(--line)]" />
        <div className="h-24 w-full animate-pulse rounded bg-[var(--line)]" />
        <div className="h-48 w-full animate-pulse rounded bg-[var(--line)]" />
      </div>
    );
  }

  if (error && !draft) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-300 bg-red-50 p-6 text-red-900">
        <h2 className="text-lg font-bold">Could not start application preparation</h2>
        <p className="mt-2 text-sm">{error}</p>
        <Link
          href={`/schemes/${slug}`}
          className="mt-4 inline-block rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white"
        >
          Return to Scheme
        </Link>
      </div>
    );
  }

  if (!draft) return null;

  const totalDocs = draft.required_documents.length;
  const readyDocs = draft.required_documents.filter(
    (d) => draft.checklist_state[d.id || d.name]
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Top Header */}
      <div>
        <Link
          href={`/schemes/${slug}`}
          className="text-sm text-[var(--muted)] hover:underline"
        >
          ← Back to scheme overview
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-block rounded bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              Assisted Preparation Wizard
            </span>
            <h1 className="mt-1 text-2xl font-bold">{draft.scheme_name}</h1>
            <p className="text-sm text-[var(--muted)]">{draft.department}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleDeleteDraft()}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
          >
            Discard Draft
          </button>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
        <div className="flex items-start gap-2">
          <span className="text-lg">⚠️</span>
          <div>
            <strong className="block text-sm font-semibold">Important Notice</strong>
            <p className="mt-0.5 text-xs leading-relaxed">{draft.disclaimer}</p>
          </div>
        </div>
      </div>

      {/* Wizard Step Navigation */}
      <nav aria-label="Wizard Steps" className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-[var(--line)] pb-3">
        {[
          { key: "overview", label: "1. Overview & Source" },
          { key: "documents", label: `2. Documents (${readyDocs}/${totalDocs})` },
          { key: "answers", label: "3. Form & Eligibility" },
          { key: "summary", label: "4. Final Review" },
        ].map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveStep(s.key as Step)}
            className={`rounded-lg px-3 py-2 text-center text-xs font-semibold transition ${
              activeStep === s.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "border border-[var(--line)] text-[var(--text)] hover:bg-[var(--card)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* STEP 1: OVERVIEW & OFFICIAL APPLICATION LINK */}
      {activeStep === "overview" && (
        <section className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-bold">Scheme Overview & Verified Links</h2>
          <p className="text-sm text-[var(--muted)]">
            Review the official verified sources for this scheme. Sahayak does not collect fees or submit applications directly to government databases.
          </p>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--line)] p-3">
              <dt className="text-xs text-[var(--muted)]">Official Department Source</dt>
              <dd className="mt-1 font-medium">
                <a
                  href={draft.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 underline break-all"
                >
                  {draft.source_url}
                </a>
              </dd>
            </div>
            <div className="rounded-lg border border-[var(--line)] p-3">
              <dt className="text-xs text-[var(--muted)]">Official Application Portal</dt>
              <dd className="mt-1 font-medium">
                {draft.official_apply_url ? (
                  <a
                    href={draft.official_apply_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 underline break-all"
                  >
                    {draft.official_apply_url}
                  </a>
                ) : (
                  <span className="text-amber-700">Official apply link not provided; check main portal</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="pt-4 flex justify-between items-center">
            <span className="text-xs text-[var(--muted)]">
              Draft ID: <code className="text-xs">{draft.id.slice(0, 8)}...</code>
            </span>
            <button
              type="button"
              onClick={() => setActiveStep("documents")}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Continue to Document Checklist →
            </button>
          </div>
        </section>
      )}

      {/* STEP 2: REQUIRED DOCUMENTS CHECKLIST */}
      {activeStep === "documents" && (
        <section className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-6">
          <div>
            <h2 className="text-lg font-bold">Required Documents Checklist</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Make sure you have physical or scanned copies ready before accessing the official portal. Check off each document as you locate it.
            </p>
          </div>

          {draft.required_documents.length === 0 ? (
            <p className="text-sm italic text-[var(--muted)]">
              No specific documents listed for this scheme in official records.
            </p>
          ) : (
            <div className="space-y-2">
              {draft.required_documents.map((doc, idx) => {
                const docKey = doc.id || doc.name || `doc-${idx}`;
                const checked = !!draft.checklist_state[docKey];
                return (
                  <label
                    key={docKey}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                      checked
                        ? "border-green-300 bg-green-50/50"
                        : "border-[var(--line)] hover:bg-[var(--bg)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => void handleToggleDocument(docKey)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{doc.name}</span>
                        {doc.mandatory && (
                          <span className="rounded bg-red-100 px-1.5 py-0.2 text-[10px] font-medium text-red-800">
                            Required
                          </span>
                        )}
                      </div>
                      {doc.description && (
                        <p className="mt-0.5 text-xs text-[var(--muted)]">{doc.description}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <button
              type="button"
              onClick={() => setActiveStep("overview")}
              className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setActiveStep("answers")}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Continue to Application Form →
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: ANSWERS & ELIGIBILITY VERIFICATION */}
      {activeStep === "answers" && (
        <section className="space-y-6 rounded-xl border border-[var(--line)] bg-[var(--card)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Application Details & Eligibility</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Enter your details to test eligibility criteria. You can manually type all fields or import confirmed values from OCR.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowOcrBox(!showOcrBox)}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              📄 {showOcrBox ? "Close OCR Import" : "Import from Document OCR"}
            </button>
          </div>

          {/* OCR Import Box (Explicit User Confirmation Required) */}
          {showOcrBox && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                Explicit OCR Field Import
              </h3>
              <p className="text-xs text-indigo-800">
                Fields are never auto-copied without your permission. Enter your Document ID to inspect readable fields and explicitly import them:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Document UUID (from /documents)"
                  value={docIdInput}
                  onChange={(e) => setDocIdInput(e.target.value)}
                  className="flex-1 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => void handleFetchOcrCandidate()}
                  disabled={ocrLoading || !docIdInput.trim()}
                  className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {ocrLoading ? "Inspecting..." : "Inspect Values"}
                </button>
              </div>

              {ocrError && <p className="text-xs text-red-600">{ocrError}</p>}

              {ocrCandidates && (
                <div className="rounded-lg border border-indigo-300 bg-white p-3 space-y-2">
                  <span className="text-xs font-semibold text-gray-700">Found candidate values:</span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {Object.entries(ocrCandidates).map(([k, v]) => (
                      <div key={k} className="rounded bg-gray-50 p-1.5 border">
                        <span className="block text-[10px] text-gray-500 font-mono">{k}</span>
                        <strong className="font-semibold">{String(v)}</strong>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyOcrValues}
                    className="w-full rounded-lg bg-green-700 py-1.5 text-xs font-semibold text-white hover:bg-green-800"
                  >
                    ✓ Explicitly Import These Values Into Form
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold">Age</label>
                <input
                  type="number"
                  min="0"
                  max="130"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 24"
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold">Annual Income (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="e.g. 150000"
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold">State Code</label>
                <input
                  type="text"
                  maxLength={5}
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  placeholder="e.g. UP, DL, MH"
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm uppercase"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveAnswers()}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Evaluating..." : "Save Answers & Update Eligibility"}
              </button>
            </div>
          </div>

          {/* Eligibility Results Breakdown */}
          <div className="rounded-xl border border-[var(--line)] p-4 space-y-3">
            <h3 className="text-sm font-bold">Eligibility Check Summary</h3>
            <div
              className={`rounded-lg p-3 text-sm font-medium ${
                draft.eligibility_summary.outcome === "eligible"
                  ? "bg-green-100 text-green-900 border border-green-300"
                  : draft.eligibility_summary.outcome === "ineligible"
                  ? "bg-red-100 text-red-900 border border-red-300"
                  : "bg-amber-100 text-amber-900 border border-amber-300"
              }`}
            >
              {draft.eligibility_summary.summary}
            </div>

            {draft.eligibility_summary.missing_fields.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900">
                <strong>Missing information to complete check:</strong>
                <ul className="mt-1 list-disc pl-5">
                  {draft.eligibility_summary.missing_fields.map((f) => (
                    <li key={f} className="font-mono">{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {draft.eligibility_summary.failed.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs text-red-900">
                <strong>Unmet requirements:</strong>
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {draft.eligibility_summary.failed.map((c, i) => (
                    <li key={i}>{c.explanation}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4">
            <button
              type="button"
              onClick={() => setActiveStep("documents")}
              className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
            >
              ← Back to Documents
            </button>
            <button
              type="button"
              onClick={() => setActiveStep("summary")}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Continue to Final Review →
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: FINAL PREPARATION SUMMARY & SUBMISSION GATEWAY */}
      {activeStep === "summary" && (
        <section className="space-y-6 rounded-xl border border-[var(--line)] bg-[var(--card)] p-6">
          <div>
            <h2 className="text-xl font-bold">Preparation Summary & Portal Gateway</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Review your application readiness. When you are ready, use the verified official portal link below to submit your official application.
            </p>
          </div>

          {/* Readiness Dashboard */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--line)] p-4">
              <span className="text-xs uppercase text-[var(--muted)] font-semibold">Document Readiness</span>
              <p className="mt-1 text-2xl font-bold">
                {readyDocs} / {totalDocs}
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                {readyDocs === totalDocs
                  ? "All required documents marked as ready."
                  : `${totalDocs - readyDocs} document(s) still pending checklist.`}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--line)] p-4">
              <span className="text-xs uppercase text-[var(--muted)] font-semibold">Indicative Eligibility</span>
              <p className="mt-1 text-2xl font-bold capitalize">
                {draft.eligibility_summary.outcome.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                {draft.eligibility_summary.outcome === "eligible"
                  ? "Based on recorded rules, you appear to qualify."
                  : draft.eligibility_summary.summary}
              </p>
            </div>
          </div>

          {/* Form Answers Table */}
          <div className="rounded-xl border border-[var(--line)] overflow-hidden">
            <div className="bg-[var(--bg)] px-4 py-2 font-semibold text-xs text-[var(--muted)] uppercase">
              Recorded Answers
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--line)]">
                {Object.entries(draft.answers).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-4 text-center italic text-xs text-[var(--muted)]">
                      No answers entered yet.
                    </td>
                  </tr>
                ) : (
                  Object.entries(draft.answers).map(([k, v]) => (
                    <tr key={k}>
                      <td className="p-3 font-mono text-xs text-[var(--muted)] w-1/3">{k}</td>
                      <td className="p-3 font-medium">{String(v)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Official Portal Gateway */}
          <div className="rounded-xl border-2 border-indigo-600 bg-indigo-50/50 p-6 text-center space-y-3">
            <h3 className="text-lg font-bold text-indigo-950">Ready to Submit?</h3>
            <p className="text-xs text-indigo-800 max-w-lg mx-auto">
              Sahayak does not submit government applications. Please visit the official designated portal to formally complete and submit your application.
            </p>

            <div className="pt-2">
              {draft.official_apply_url ? (
                <a
                  href={draft.official_apply_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-md hover:bg-indigo-700 transition"
                >
                  🚀 Open Official Portal ({draft.official_apply_url.split("/")[2]}) →
                </a>
              ) : (
                <a
                  href={draft.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-md hover:bg-indigo-700 transition"
                >
                  🌐 Open Official Information Source →
                </a>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={() => setActiveStep("answers")}
              className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
            >
              ← Back to Edit Answers
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteDraft()}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Delete Draft & Exit
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
