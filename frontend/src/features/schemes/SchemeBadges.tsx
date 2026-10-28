import type { ReviewStatus } from "@/types/api";

/**
 * A record that is not `verified` has NOT been checked against a government
 * source. Saying so loudly is the point: an unchecked row presented as fact is
 * the worst thing this product could ship.
 */
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  if (status === "verified") {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900">
        Verified against official source
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
      {status === "needs_review" ? "Awaiting review" : "Demo / unverified"} — not official
    </span>
  );
}

export function DemoNotice({ status }: { status: ReviewStatus }) {
  if (status === "verified") return null;
  return (
    <p
      role="note"
      className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <strong>This is a synthetic demo record.</strong> It was invented to exercise the
      system. The department, benefit and source link are fictional, and nothing here
      describes a real government scheme.
    </p>
  );
}

export function Disclaimer({ text }: { text?: string }) {
  return (
    <p className="text-xs text-[var(--muted)]">
      {text ??
        "Informational estimate based on the rules recorded in this catalogue. Not an official decision."}
    </p>
  );
}
