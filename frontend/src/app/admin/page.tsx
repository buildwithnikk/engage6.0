"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminOverview } from "@/lib/api-client";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import type { AdminOverviewResponse } from "@/types/api";

export default function AdminOverviewPage() {
  const { user } = useAdminAuth();
  const [stats, setStats] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getAdminOverview();
        setStats(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load overview data.");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
          Catalogue Overview
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Signed in as <strong className="text-[var(--text)]">{user?.email}</strong> with role{" "}
          <span className="font-semibold uppercase text-indigo-600">{user?.role}</span>.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-[var(--line)] bg-[var(--card)]"
            />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/schemes?review_status=draft"
            className="group block rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm hover:border-slate-400 transition-colors"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Drafts
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-700">{stats.draft}</p>
            <p className="mt-2 text-xs text-[var(--muted)] group-hover:text-indigo-600">
              Unpublished edits & new entries →
            </p>
          </Link>

          <Link
            href="/admin/schemes?review_status=needs_review"
            className="group block rounded-xl border border-amber-300 bg-amber-50/50 p-6 shadow-sm hover:border-amber-500 transition-colors"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-amber-900">
              Needs Review
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-700">{stats.needs_review}</p>
            <p className="mt-2 text-xs text-amber-800 group-hover:underline">
              Awaiting verification against official source →
            </p>
          </Link>

          <Link
            href="/admin/schemes?review_status=verified"
            className="group block rounded-xl border border-emerald-300 bg-emerald-50/50 p-6 shadow-sm hover:border-emerald-500 transition-colors"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-900">
              Verified (Public)
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{stats.verified}</p>
            <p className="mt-2 text-xs text-emerald-800 group-hover:underline">
              Actively visible to citizens on public portal →
            </p>
          </Link>

          <Link
            href="/admin/schemes?review_status=archived"
            className="group block rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm hover:border-slate-400 transition-colors"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Archived
            </p>
            <p className="mt-2 text-3xl font-bold text-zinc-500">{stats.archived}</p>
            <p className="mt-2 text-xs text-[var(--muted)] group-hover:text-indigo-600">
              Retired from circulation →
            </p>
          </Link>
        </div>
      ) : null}

      <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/schemes/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            + Create New Scheme Draft
          </Link>
          <Link
            href="/admin/schemes"
            className="rounded-md border border-[var(--line)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-sm hover:bg-slate-50 transition-colors"
          >
            Browse All Schemes
          </Link>
          {user?.role === "admin" && (
            <Link
              href="/admin/audit"
              className="rounded-md border border-[var(--line)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-sm hover:bg-slate-50 transition-colors"
            >
              Inspect Audit Log
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-[var(--text)]">
          Verification & Publication Rules
        </h2>
        <ul className="list-disc pl-5 text-sm space-y-1 text-[var(--muted)]">
          <li>
            <strong>Public Visibility:</strong> Only schemes in <code className="text-emerald-700">verified</code> status are accessible by citizens and public APIs.
          </li>
          <li>
            <strong>Verification Checklist:</strong> A scheme can only be promoted to verified by a Reviewer or Admin after verifying facts against the responsible government department&apos;s own source page.
          </li>
          <li>
            <strong>Automatic Invalidation:</strong> Editing any verified scheme will immediately demote it to <code className="text-amber-700">needs_review</code> and remove it from public responses until re-verified.
          </li>
          <li>
            <strong>No Hard Deletes:</strong> Schemes are never permanently deleted via admin API; they are moved to <code className="text-zinc-600">archived</code>.
          </li>
        </ul>
      </div>
    </div>
  );
}
