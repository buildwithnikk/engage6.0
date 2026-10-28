"use client";

import React, { useEffect, useState, useCallback } from "react";
import { listAuditEvents } from "@/lib/api-client";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import type { AuditEventSummary } from "@/types/api";

export default function AdminAuditPage() {
  const { user } = useAdminAuth();
  const [events, setEvents] = useState<AuditEventSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (user?.role !== "admin") return;
    setLoading(true);
    setError(null);
    try {
      const data = await listAuditEvents(page, 20);
      setEvents(data.items);
      setTotal(data.total);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load audit events.");
      }
    } finally {
      setLoading(false);
    }
  }, [user, page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (user?.role !== "admin") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="text-lg font-bold text-red-800">403 — Forbidden</h2>
        <p className="mt-2 text-sm text-red-700">
          Viewing security audit logs is restricted to users with the{" "}
          <strong className="uppercase">admin</strong> role. Your current role is{" "}
          <strong className="uppercase">{user?.role}</strong>.
        </p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
          Audit Trail
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Append-only security and catalogue mutation history ({total} total recorded events).
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-6 py-3">
                  Timestamp
                </th>
                <th scope="col" className="px-6 py-3">
                  Actor
                </th>
                <th scope="col" className="px-6 py-3">
                  Action
                </th>
                <th scope="col" className="px-6 py-3">
                  Target Resource
                </th>
                <th scope="col" className="px-6 py-3">
                  Details / Metadata
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--muted)] font-sans">
                    Loading audit trail...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--muted)] font-sans">
                    No audit events recorded yet.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 whitespace-nowrap text-[var(--muted)] font-sans">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-sans font-medium text-[var(--text)]">
                      {ev.actor_email || "System / CLI"}
                    </td>
                    <td className="px-6 py-3">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        {ev.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-[var(--muted)]">
                      {ev.resource_type}
                      {ev.resource_id && (
                        <span className="block text-[10px] text-slate-400">
                          {ev.resource_id}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 max-w-xs truncate text-[var(--muted)] font-mono text-[11px]">
                      {JSON.stringify(ev.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--line)] px-6 py-3">
            <span className="text-xs text-[var(--muted)]">
              Page {page} of {totalPages}
            </span>
            <div className="space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-[var(--line)] px-2.5 py-1 text-xs font-medium disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-[var(--line)] px-2.5 py-1 text-xs font-medium disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
