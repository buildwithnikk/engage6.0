"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAdminScheme } from "@/lib/api-client";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import type { Jurisdiction } from "@/types/api";

const DEFAULT_RULES = JSON.stringify(
  {
    version: "1",
    all: [
      {
        type: "age_min",
        fact: "age",
        value: 18,
      },
    ],
  },
  null,
  2,
);

export default function AdminNewSchemePage() {
  const { csrfToken } = useAdminAuth();
  const router = useRouter();

  const [slug, setSlug] = useState("");
  const [officialName, setOfficialName] = useState("");
  const [department, setDepartment] = useState("");
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("central");
  const [stateCode, setStateCode] = useState("");
  const [benefitSummary, setBenefitSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [officialApplyUrl, setOfficialApplyUrl] = useState("");
  const [documentsRaw, setDocumentsRaw] = useState("aadhaar, income_certificate");
  const [rulesRaw, setRulesRaw] = useState(DEFAULT_RULES);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate rules JSON
    let parsedRules: Record<string, unknown>;
    try {
      parsedRules = JSON.parse(rulesRaw);
      if (typeof parsedRules !== "object" || parsedRules === null) {
        throw new Error("Rules must be an object.");
      }
    } catch {
      setErrorMsg("Eligibility Rules must be valid JSON matching the rule format.");
      return;
    }

    const docs = documentsRaw
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      if (!csrfToken) {
        throw new Error("Session is missing a CSRF token. Please refresh the page.");
      }

      const created = await createAdminScheme(
        {
          slug: slug.trim().toLowerCase(),
          official_name: officialName.trim(),
          department: department.trim(),
          jurisdiction,
          state_code: jurisdiction === "state" ? stateCode.trim().toUpperCase() : null,
          benefit_summary: benefitSummary.trim(),
          source_url: sourceUrl.trim(),
          official_apply_url: officialApplyUrl.trim() || null,
          required_documents: docs,
          eligibility_rules: parsedRules,
        },
        csrfToken,
      );

      router.push(`/admin/schemes/${created.id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to create scheme draft.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-2 text-sm text-[var(--muted)]">
        <Link href="/admin/schemes" className="hover:underline">
          ← Back to Schemes
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
          Create Scheme Draft
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Drafts are saved locally in <code className="text-slate-700">draft</code> status and
          are completely hidden from citizens until reviewed and verified against official sources.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm space-y-6"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-[var(--text)]">
              Slug Identifier <span className="text-red-500">*</span>
            </label>
            <input
              id="slug"
              type="text"
              required
              pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. pm-kisan-aid"
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-mono text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Lowercase letters, digits, and single hyphens.
            </p>
          </div>

          <div>
            <label
              htmlFor="officialName"
              className="block text-sm font-medium text-[var(--text)]"
            >
              Official Scheme Name <span className="text-red-500">*</span>
            </label>
            <input
              id="officialName"
              type="text"
              required
              value={officialName}
              onChange={(e) => setOfficialName(e.target.value)}
              placeholder="Full official government title"
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="department"
              className="block text-sm font-medium text-[var(--text)]"
            >
              Responsible Department <span className="text-red-500">*</span>
            </label>
            <input
              id="department"
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Ministry of Agriculture & Farmers Welfare"
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="jurisdiction"
              className="block text-sm font-medium text-[var(--text)]"
            >
              Jurisdiction <span className="text-red-500">*</span>
            </label>
            <select
              id="jurisdiction"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            >
              <option value="central">Central</option>
              <option value="state">State</option>
            </select>
          </div>
        </div>

        {jurisdiction === "state" && (
          <div>
            <label
              htmlFor="stateCode"
              className="block text-sm font-medium text-[var(--text)]"
            >
              State Code (2 letters) <span className="text-red-500">*</span>
            </label>
            <input
              id="stateCode"
              type="text"
              required
              maxLength={2}
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value.toUpperCase())}
              placeholder="e.g. UP, MH, KA"
              className="mt-1 block w-32 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-mono text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="benefitSummary"
            className="block text-sm font-medium text-[var(--text)]"
          >
            Benefit Summary <span className="text-red-500">*</span>
          </label>
          <textarea
            id="benefitSummary"
            rows={3}
            required
            value={benefitSummary}
            onChange={(e) => setBenefitSummary(e.target.value)}
            placeholder="Plain language description of benefits provided to qualified citizens."
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="sourceUrl"
              className="block text-sm font-medium text-[var(--text)]"
            >
              Official Department Source URL <span className="text-red-500">*</span>
            </label>
            <input
              id="sourceUrl"
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://official-dept.gov.in/scheme"
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Must be official department source, not a generic aggregator.
            </p>
          </div>

          <div>
            <label
              htmlFor="officialApplyUrl"
              className="block text-sm font-medium text-[var(--text)]"
            >
              Official Application Portal URL (Optional)
            </label>
            <input
              id="officialApplyUrl"
              type="url"
              value={officialApplyUrl}
              onChange={(e) => setOfficialApplyUrl(e.target.value)}
              placeholder="https://apply.gov.in/scheme"
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="documents"
            className="block text-sm font-medium text-[var(--text)]"
          >
            Required Documents (comma-separated identifiers)
          </label>
          <input
            id="documents"
            type="text"
            value={documentsRaw}
            onChange={(e) => setDocumentsRaw(e.target.value)}
            placeholder="aadhaar, bank_passbook, ration_card"
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="rules"
            className="block text-sm font-medium text-[var(--text)]"
          >
            Eligibility Rules (JSON Document) <span className="text-red-500">*</span>
          </label>
          <textarea
            id="rules"
            rows={8}
            required
            value={rulesRaw}
            onChange={(e) => setRulesRaw(e.target.value)}
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--text)] focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Format: {`{"version": "1", "all": [ {"type": "age_min", "fact": "age", "value": 18} ]}`}
          </p>
        </div>

        <div className="flex items-center justify-end space-x-3 border-t border-[var(--line)] pt-4">
          <Link
            href="/admin/schemes"
            className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving Draft..." : "Save Scheme Draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
