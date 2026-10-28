"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createGovernmentSource,
  listGovernmentSources,
  listImportCandidates,
  promoteImportCandidate,
  rejectImportCandidate,
  triggerSourceSync,
} from "@/lib/api-client";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import {
  ApiError,
  type GovernmentSourceCreate,
  type GovernmentSourceDetail,
  type ImportCandidateDetail,
} from "@/types/api";

export function SourcesView() {
  const { csrfToken, user } = useAdminAuth();
  const [sources, setSources] = useState<GovernmentSourceDetail[]>([]);
  const [candidates, setCandidates] = useState<ImportCandidateDetail[]>([]);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // New source form state
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState<GovernmentSourceCreate>({
    name: "",
    official_url: "",
    source_type: "portal",
    jurisdiction: "central",
    state_code: "",
    notes: "",
  });

  const loadAll = useCallback(async () => {
    setActionMsg(null);
    try {
      const [srcRes, candRes] = await Promise.all([
        listGovernmentSources(),
        listImportCandidates(),
      ]);
      setSources(srcRes.items);
      setCandidates(candRes.items);
    } catch (err) {
      setActionMsg({
        type: "error",
        text: err instanceof ApiError ? err.message : "Failed to load sources or candidates.",
      });
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSync = async (key: string) => {
    if (!csrfToken) return;
    setSyncingKey(key);
    setActionMsg(null);
    try {
      const res = await triggerSourceSync(key, csrfToken);
      setActionMsg({
        type: "success",
        text: `Successfully synced adapter '${key}': staged ${res.total} candidate(s).`,
      });
      await loadAll();
    } catch (err) {
      setActionMsg({
        type: "error",
        text: err instanceof ApiError ? err.message : `Failed to sync adapter ${key}.`,
      });
    } finally {
      setSyncingKey(null);
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csrfToken) return;
    try {
      await createGovernmentSource(
        {
          ...newSource,
          state_code: newSource.jurisdiction === "state" ? newSource.state_code : null,
        },
        csrfToken
      );
      setActionMsg({ type: "success", text: `Source '${newSource.name}' registered successfully.` });
      setShowAddSource(false);
      setNewSource({
        name: "",
        official_url: "",
        source_type: "portal",
        jurisdiction: "central",
        state_code: "",
        notes: "",
      });
      await loadAll();
    } catch (err) {
      setActionMsg({
        type: "error",
        text: err instanceof ApiError ? err.message : "Failed to create source.",
      });
    }
  };

  const handlePromote = async (candidateId: string) => {
    if (!csrfToken) return;
    try {
      const res = await promoteImportCandidate(candidateId, csrfToken);
      setActionMsg({
        type: "success",
        text: `Candidate promoted to scheme draft '${res.scheme_slug}'. Ready for review.`,
      });
      await loadAll();
    } catch (err) {
      setActionMsg({
        type: "error",
        text: err instanceof ApiError ? err.message : "Failed to promote candidate.",
      });
    }
  };

  const handleReject = async (candidateId: string) => {
    if (!csrfToken) return;
    try {
      await rejectImportCandidate(candidateId, csrfToken);
      setActionMsg({ type: "success", text: "Candidate marked as rejected." });
      await loadAll();
    } catch (err) {
      setActionMsg({
        type: "error",
        text: err instanceof ApiError ? err.message : "Failed to reject candidate.",
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            Government Source Registry & Import Pipeline
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Register official department portals, stage candidate scheme data, and promote them into the review pipeline.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSync("nsp_central")}
            disabled={syncingKey !== null}
            className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
          >
            {syncingKey === "nsp_central" ? "Syncing..." : "📥 Sync NSP Central"}
          </button>
          <button
            type="button"
            onClick={() => void handleSync("haryana_saral")}
            disabled={syncingKey !== null}
            className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
          >
            {syncingKey === "haryana_saral" ? "Syncing..." : "📥 Sync Haryana Saral"}
          </button>
          {user?.role !== "reviewer" && (
            <button
              type="button"
              onClick={() => setShowAddSource(!showAddSource)}
              className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              {showAddSource ? "Close Form" : "＋ Register Source"}
            </button>
          )}
        </div>
      </div>

      {actionMsg && (
        <div
          className={`rounded-xl p-3.5 text-sm ${
            actionMsg.type === "success"
              ? "bg-green-50 text-green-900 border border-green-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      {/* Add Source Form */}
      {showAddSource && (
        <form
          onSubmit={handleCreateSource}
          className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-4 shadow-sm"
        >
          <h2 className="text-base font-bold text-indigo-950">Register Official Government Source</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold">Source Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. National Scholarship Portal"
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold">Official URL *</label>
              <input
                required
                type="url"
                placeholder="https://scholarships.gov.in"
                value={newSource.official_url}
                onChange={(e) => setNewSource({ ...newSource, official_url: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold">Jurisdiction</label>
              <select
                value={newSource.jurisdiction}
                onChange={(e) =>
                  setNewSource({ ...newSource, jurisdiction: e.target.value as "central" | "state" })
                }
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
              >
                <option value="central">Central (Union)</option>
                <option value="state">State</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold">State Code (if State)</label>
              <input
                type="text"
                placeholder="e.g. HR, UP, DL"
                maxLength={5}
                disabled={newSource.jurisdiction !== "state"}
                value={newSource.state_code || ""}
                onChange={(e) => setNewSource({ ...newSource, state_code: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold">Notes / Verification Guidelines</label>
            <input
              type="text"
              placeholder="Official portal notes, gazette notification ref, etc."
              value={newSource.notes || ""}
              onChange={(e) => setNewSource({ ...newSource, notes: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddSource(false)}
              className="rounded-lg border border-[var(--line)] px-3.5 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Save Source
            </button>
          </div>
        </form>
      )}

      {/* 1. REGISTERED SOURCES */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Registered Government Sources ({sources.length})</h2>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg)] text-xs uppercase text-[var(--muted)] border-b border-[var(--line)]">
              <tr>
                <th className="p-3">Source Name</th>
                <th className="p-3">Jurisdiction</th>
                <th className="p-3">Type</th>
                <th className="p-3">Official URL</th>
                <th className="p-3">Last Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-xs text-[var(--muted)]">
                    No sources registered yet. Click &quot;Register Source&quot; or sync a pilot adapter.
                  </td>
                </tr>
              ) : (
                sources.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--bg)]/50 transition">
                    <td className="p-3 font-semibold">{s.name}</td>
                    <td className="p-3 text-xs">
                      <span className="capitalize">{s.jurisdiction}</span>
                      {s.state_code ? ` (${s.state_code})` : ""}
                    </td>
                    <td className="p-3 text-xs text-[var(--muted)] capitalize">{s.source_type}</td>
                    <td className="p-3 text-xs font-mono">
                      <a
                        href={s.official_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 underline"
                      >
                        {s.official_url}
                      </a>
                    </td>
                    <td className="p-3 text-xs text-[var(--muted)]">
                      {s.last_checked_at
                        ? new Date(s.last_checked_at).toLocaleDateString()
                        : "Not synced"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. STAGED IMPORT CANDIDATES */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Staged Import Candidates ({candidates.length})</h2>
          <span className="text-xs text-[var(--muted)]">
            Candidates remain unverified until an admin reviewer promotes and verifies them.
          </span>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg)] text-xs uppercase text-[var(--muted)] border-b border-[var(--line)]">
              <tr>
                <th className="p-3">Scheme Name</th>
                <th className="p-3">Level</th>
                <th className="p-3">Status</th>
                <th className="p-3">Source URL</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-xs text-[var(--muted)]">
                    No candidates staged. Click &quot;Sync NSP Central&quot; or &quot;Sync Haryana Saral&quot; above to import pilot candidates.
                  </td>
                </tr>
              ) : (
                candidates.map((c) => {
                  const data = c.extracted_data as {
                    official_name?: string;
                    department?: string;
                    jurisdiction?: string;
                    state_code?: string;
                    slug?: string;
                  };
                  return (
                    <tr key={c.id} className="hover:bg-[var(--bg)]/50 transition">
                      <td className="p-3">
                        <span className="font-semibold block">{data.official_name || c.external_reference}</span>
                        <span className="text-xs text-[var(--muted)]">{data.department}</span>
                      </td>
                      <td className="p-3 text-xs">
                        <span className="capitalize">{data.jurisdiction || "central"}</span>
                        {data.state_code ? ` (${data.state_code})` : ""}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${
                            c.status === "promoted"
                              ? "bg-green-100 text-green-800"
                              : c.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-mono">
                        <a
                          href={c.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 underline truncate max-w-xs block"
                        >
                          {c.source_url}
                        </a>
                      </td>
                      <td className="p-3 text-right">
                        {c.status === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handlePromote(c.id)}
                              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                            >
                              Promote to Draft
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReject(c.id)}
                              className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : c.status === "promoted" && c.promoted_scheme_id ? (
                          <Link
                            href={`/admin/schemes/${c.promoted_scheme_id}`}
                            className="text-xs text-indigo-600 underline font-semibold"
                          >
                            Review Scheme →
                          </Link>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">Rejected</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
