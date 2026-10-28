"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getAdminScheme,
  updateAdminScheme,
  submitSchemeReview,
  verifyScheme,
  requestSchemeChanges,
  archiveScheme,
} from "@/lib/api-client";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import { AdminStatusBadge } from "@/features/admin/components/StatusBadge";
import type { AdminSchemeDetail, Jurisdiction } from "@/types/api";

export default function AdminSchemeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, csrfToken } = useAdminAuth();

  const [scheme, setScheme] = useState<AdminSchemeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [officialName, setOfficialName] = useState("");
  const [department, setDepartment] = useState("");
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("central");
  const [stateCode, setStateCode] = useState("");
  const [benefitSummary, setBenefitSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [officialApplyUrl, setOfficialApplyUrl] = useState("");
  const [documentsRaw, setDocumentsRaw] = useState("");
  const [rulesRaw, setRulesRaw] = useState("");

  // Modals / dialogs
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const loadScheme = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getAdminScheme(id);
      setScheme(data);
      setOfficialName(data.official_name);
      setDepartment(data.department);
      setJurisdiction(data.jurisdiction);
      setStateCode(data.state_code || "");
      setBenefitSummary(data.benefit_summary);
      setSourceUrl(data.source_url);
      setOfficialApplyUrl(data.official_apply_url || "");
      setDocumentsRaw(data.required_documents.join(", "));
      setRulesRaw(JSON.stringify(data.eligibility_rules, null, 2));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to load scheme details.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadScheme();
  }, [loadScheme]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheme || !csrfToken) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    let parsedRules: Record<string, unknown>;
    try {
      parsedRules = JSON.parse(rulesRaw);
    } catch {
      setErrorMsg("Eligibility rules must be valid JSON.");
      return;
    }

    const docs = documentsRaw
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);

    setActionLoading(true);
    try {
      const updated = await updateAdminScheme(
        scheme.id,
        {
          expected_updated_at: scheme.updated_at,
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

      setScheme(updated);
      setSuccessMsg("Scheme updated successfully.");
      if (scheme.review_status === "verified" && updated.review_status === "needs_review") {
        setSuccessMsg(
          "Scheme updated. Verification was invalidated and the scheme was moved to 'Needs Review'.",
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to update scheme.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!scheme || !csrfToken) return;
    if (!confirm("Submit this draft scheme for reviewer inspection?")) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await submitSchemeReview(scheme.id, csrfToken);
      setScheme(updated);
      setSuccessMsg("Submitted for review successfully.");
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!scheme || !csrfToken) return;
    const ok = confirm(
      "Confirm official source verification: Have you verified all criteria against the responsible department's official publication? This will publish the scheme to the citizen portal.",
    );
    if (!ok) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await verifyScheme(scheme.id, csrfToken);
      setScheme(updated);
      setSuccessMsg("Scheme verified and published to public portal.");
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheme || !csrfToken) return;
    if (!rejectReason.trim()) {
      alert("Please provide a reason for requesting changes.");
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await requestSchemeChanges(scheme.id, rejectReason.trim(), csrfToken);
      setScheme(updated);
      setShowRejectModal(false);
      setRejectReason("");
      setSuccessMsg("Changes requested. Scheme returned to draft status.");
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!scheme || !csrfToken) return;
    if (
      !confirm(
        "Archive this scheme? Archived schemes are delisted from citizen search and eligibility checking.",
      )
    )
      return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await archiveScheme(scheme.id, csrfToken);
      setScheme(updated);
      setSuccessMsg("Scheme archived.");
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-[var(--muted)]">Loading scheme details...</p>
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-700">Scheme not found.</p>
        <Link href="/admin/schemes" className="mt-4 inline-block text-indigo-600 underline">
          Return to Scheme List
        </Link>
      </div>
    );
  }

  const isReviewerOrAdmin = user?.role === "reviewer" || user?.role === "admin";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <Link href="/admin/schemes" className="hover:underline">
          ← Back to Schemes
        </Link>
        <span className="font-mono text-xs">ID: {scheme.id}</span>
      </div>

      {/* Header Info */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
                {scheme.official_name}
              </h1>
              <AdminStatusBadge status={scheme.review_status} />
            </div>
            <p className="mt-1 font-mono text-xs text-[var(--muted)]">slug: {scheme.slug}</p>
          </div>

          <div className="text-right text-xs text-[var(--muted)] space-y-1">
            <p>Rules Version: <strong className="text-[var(--text)]">{scheme.rules_version}</strong></p>
            {scheme.verified_at && (
              <p>Verified: <strong className="text-emerald-700">{new Date(scheme.verified_at).toLocaleDateString()}</strong></p>
            )}
            <p>Last Updated: {new Date(scheme.updated_at).toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Prominent warning if scheme is verified */}
        {scheme.review_status === "verified" && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <strong>⚠️ Live Publication Notice:</strong> This scheme is currently marked{" "}
            <span className="font-semibold uppercase text-emerald-800">Verified</span> and is publicly
            accessible to citizens. If you save changes to this scheme, its verification will be{" "}
            <strong>automatically invalidated</strong> and it will disappear from public endpoints
            until a reviewer approves it again.
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {successMsg}
        </div>
      )}

      {/* Workflow Action Bar */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Workflow Controls
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {scheme.review_status === "draft" && (
            <button
              onClick={handleSubmitForReview}
              disabled={actionLoading}
              className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              Submit for Review
            </button>
          )}

          {scheme.review_status === "needs_review" && isReviewerOrAdmin && (
            <>
              <button
                onClick={handleVerify}
                disabled={actionLoading}
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                ✓ Approve & Verify
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="rounded-md border border-amber-300 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-100 disabled:opacity-50 transition-colors"
              >
                Request Changes
              </button>
            </>
          )}

          {scheme.review_status !== "archived" && isReviewerOrAdmin && (
            <button
              onClick={handleArchive}
              disabled={actionLoading}
              className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-100 disabled:opacity-50 transition-colors"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <form
        onSubmit={handleUpdate}
        className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm space-y-6"
      >
        <h2 className="text-lg font-semibold text-[var(--text)]">Scheme Information</h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[var(--text)]">
              Official Scheme Name
            </label>
            <input
              type="text"
              required
              value={officialName}
              onChange={(e) => setOfficialName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)]">
              Department
            </label>
            <input
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-[var(--text)]">
              Jurisdiction
            </label>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            >
              <option value="central">Central</option>
              <option value="state">State</option>
            </select>
          </div>

          {jurisdiction === "state" && (
            <div>
              <label className="block text-sm font-medium text-[var(--text)]">
                State Code
              </label>
              <input
                type="text"
                required
                maxLength={2}
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-mono text-[var(--text)] focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text)]">
            Benefit Summary
          </label>
          <textarea
            rows={3}
            required
            value={benefitSummary}
            onChange={(e) => setBenefitSummary(e.target.value)}
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[var(--text)]">
              Official Department Source URL
            </label>
            <input
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)]">
              Official Application Portal URL
            </label>
            <input
              type="url"
              value={officialApplyUrl}
              onChange={(e) => setOfficialApplyUrl(e.target.value)}
              className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text)]">
            Required Documents (comma-separated)
          </label>
          <input
            type="text"
            value={documentsRaw}
            onChange={(e) => setDocumentsRaw(e.target.value)}
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text)]">
            Eligibility Rules (JSON Document)
          </label>
          <textarea
            rows={8}
            required
            value={rulesRaw}
            onChange={(e) => setRulesRaw(e.target.value)}
            className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--text)] focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end space-x-3 border-t border-[var(--line)] pt-4">
          <button
            type="submit"
            disabled={actionLoading}
            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {actionLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Reject / Request Changes Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-[var(--card)] p-6 shadow-xl border border-[var(--line)] space-y-4">
            <h3 className="text-lg font-bold text-[var(--text)]">Request Scheme Changes</h3>
            <p className="text-sm text-[var(--muted)]">
              Explain why this submission cannot be verified. This reason will be recorded in
              the audit trail and the scheme will return to draft status.
            </p>

            <form onSubmit={handleRequestChanges} className="space-y-4">
              <textarea
                required
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Official source does not confirm income limit; please reverify section 3."
                className="w-full rounded-md border border-[var(--line)] bg-[var(--bg)] p-3 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
              />

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? "Submitting..." : "Submit Reason"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
