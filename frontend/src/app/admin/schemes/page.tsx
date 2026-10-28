"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { listAdminSchemes } from "@/lib/api-client";
import { AdminStatusBadge } from "@/features/admin/components/StatusBadge";
import type { AdminSchemeSummary, ReviewStatus, Jurisdiction } from "@/types/api";

export default function AdminSchemesListPage() {
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get("review_status") as ReviewStatus) || "";

  const [schemes, setSchemes] = useState<AdminSchemeSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "">(initialStatus);
  const [jurisdictionFilter, setJurisdictionFilter] = useState<Jurisdiction | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminSchemes({
        q: search.trim() || undefined,
        review_status: statusFilter || undefined,
        jurisdiction: jurisdictionFilter || undefined,
        page,
        page_size: 15,
      });
      setSchemes(data.items);
      setTotal(data.total);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load schemes.");
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, jurisdictionFilter, page]);

  useEffect(() => {
    fetchSchemes();
  }, [fetchSchemes]);

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Scheme Catalogue
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Review, verify and publish government schemes ({total} total records).
          </p>
        </div>

        <Link
          href="/admin/schemes/new"
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          + New Scheme Draft
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm">
        <div>
          <label htmlFor="search" className="block text-xs font-medium text-[var(--muted)] mb-1">
            Search
          </label>
          <input
            id="search"
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, slug, department..."
            className="w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-xs font-medium text-[var(--muted)] mb-1">
            Review Status
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ReviewStatus | "");
              setPage(1);
            }}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="needs_review">Needs Review</option>
            <option value="verified">Verified (Public)</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="jurisdiction"
            className="block text-xs font-medium text-[var(--muted)] mb-1"
          >
            Jurisdiction
          </label>
          <select
            id="jurisdiction"
            value={jurisdictionFilter}
            onChange={(e) => {
              setJurisdictionFilter(e.target.value as Jurisdiction | "");
              setPage(1);
            }}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Jurisdictions</option>
            <option value="central">Central</option>
            <option value="state">State</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-6 py-3">
                  Scheme
                </th>
                <th scope="col" className="px-6 py-3">
                  Department
                </th>
                <th scope="col" className="px-6 py-3">
                  Jurisdiction
                </th>
                <th scope="col" className="px-6 py-3">
                  Status
                </th>
                <th scope="col" className="px-6 py-3">
                  Verified Date
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--muted)]">
                    Loading schemes...
                  </td>
                </tr>
              ) : schemes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--muted)]">
                    No schemes match the current filters.
                  </td>
                </tr>
              ) : (
                schemes.map((scheme) => (
                  <tr key={scheme.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[var(--text)]">
                        {scheme.official_name}
                      </div>
                      <div className="text-xs text-[var(--muted)] font-mono">{scheme.slug}</div>
                    </td>
                    <td className="px-6 py-4 text-[var(--muted)]">{scheme.department}</td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-[var(--text)] font-medium">
                        {scheme.jurisdiction}
                      </span>
                      {scheme.state_code && (
                        <span className="ml-1 text-xs text-[var(--muted)]">
                          ({scheme.state_code})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <AdminStatusBadge status={scheme.review_status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-[var(--muted)]">
                      {scheme.verified_at
                        ? new Date(scheme.verified_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/schemes/${scheme.id}`}
                        className="rounded-md border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm hover:bg-slate-50 transition-colors"
                      >
                        Inspect / Edit →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--line)] px-6 py-3">
            <span className="text-xs text-[var(--muted)]">
              Showing page {page} of {totalPages} ({total} schemes)
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
