"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ScanLine, XCircle } from "lucide-react";
import { toast } from "sonner";
import { reviewBranchCorrectionRequestAction } from "@/app/(dashboard)/crm/staff/actions";
import type { BranchCorrectionInboxItem } from "@/lib/staff/branch-correction-types";

type Props = {
  requests: BranchCorrectionInboxItem[];
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sourceLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function CrmStaffBranchCorrectionsTab({ requests }: Props) {
  const router = useRouter();
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sortedRequests = useMemo(
    () =>
      [...requests].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [requests]
  );

  function submitReview(
    request: BranchCorrectionInboxItem,
    status: "approved" | "rejected",
    reviewerNote?: string | null
  ) {
    setPendingRequestId(request.id);
    startTransition(async () => {
      const result = await reviewBranchCorrectionRequestAction({
        requestId: request.id,
        status,
        reviewerNote,
      });

      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setPendingRequestId(null);
    });
  }

  function handleApprove(request: BranchCorrectionInboxItem) {
    const confirmed = window.confirm(
      `Approve branch correction for ${request.staffName} from ${request.currentBranchName} to ${request.requestedBranchName}?\n\nThis updates the staff profile branch and affects future attendance QR scans.`
    );
    if (!confirmed) return;
    submitReview(request, "approved");
  }

  function handleReject(request: BranchCorrectionInboxItem) {
    const note = window.prompt(
      `Reject branch correction for ${request.staffName}? Optional reviewer note:`,
      ""
    );
    if (note === null) return;
    submitReview(request, "rejected", note.trim() || null);
  }

  if (sortedRequests.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 text-center text-sm text-[var(--cs-text-muted)]">
        No pending branch correction requests.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedRequests.map((request) => {
        const busy = isPending && pendingRequestId === request.id;

        return (
          <article
            key={request.id}
            className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--cs-text-muted)]">
                  Branch correction
                </p>
                <h3 className="mt-1 text-base font-semibold text-[var(--cs-text)]">
                  {request.staffName}
                  {request.staffNickname ? (
                    <span className="font-normal text-[var(--cs-text-muted)]">
                      {" "}({request.staffNickname})
                    </span>
                  ) : null}
                </h3>
                <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                  {request.staffPhone ?? "No phone on file"} - {request.staffType ?? "Staff"} -{" "}
                  {sourceLabel(request.requestSource)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md bg-[#2f7040] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={busy}
                  onClick={() => handleApprove(request)}
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Approve
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--cs-border)] px-3 py-2 text-sm font-semibold text-[var(--cs-text)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={busy}
                  onClick={() => handleReject(request)}
                >
                  <XCircle size={16} />
                  Reject
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-[var(--cs-surface-warm)] p-3">
                <span className="text-xs font-semibold uppercase tracking-normal text-[var(--cs-text-muted)]">
                  Current profile branch
                </span>
                <strong className="mt-1 block text-sm text-[var(--cs-text)]">
                  {request.currentBranchName}
                </strong>
              </div>
              <div className="rounded-lg bg-[var(--cs-surface-warm)] p-3">
                <span className="text-xs font-semibold uppercase tracking-normal text-[var(--cs-text-muted)]">
                  Requested/scanned branch
                </span>
                <strong className="mt-1 block text-sm text-[var(--cs-text)]">
                  {request.requestedBranchName}
                </strong>
              </div>
            </div>

            <details className="mt-4 rounded-lg border border-[var(--cs-border-soft)] p-3 text-sm text-[var(--cs-text-muted)]">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold text-[var(--cs-text)]">
                <ScanLine size={16} />
                View scan details
              </summary>
              <dl className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-normal">Requested</dt>
                  <dd>{formatDate(request.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-normal">Status</dt>
                  <dd>{request.status}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-normal">QR point</dt>
                  <dd>{request.qrPointLabel ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-normal">QR code</dt>
                  <dd>{request.qrPublicCode ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-normal">Scan event</dt>
                  <dd>{request.scanEventId ?? "Not linked"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-normal">Reason</dt>
                  <dd>{request.reason ?? "Wrong-branch QR scan"}</dd>
                </div>
              </dl>
            </details>
          </article>
        );
      })}
    </div>
  );
}
