"use client";

import Link from "next/link";
import { ArrowUpRight, CircleHelp, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OperationsIssue, OperationsScan } from "@/lib/operations-center/issue-model";

/**
 * A guided fallback for checks that do not yet have a safe, reusable in-place
 * mutation UI. Do not claim a fix is complete merely because this dialog closes.
 */
export function OperationsGuidanceModal({
  issue,
  scan,
  onClose,
}: {
  issue: OperationsIssue | null;
  scan: OperationsScan | null;
  onClose: () => void;
}) {
  if (!issue && !scan) return null;

  const isIssue = Boolean(issue);
  const title = issue?.title ?? (scan ? scan.staffName + " — scan needs review" : "Issue review");
  const description = issue?.description ?? scan?.message ?? "Review the recorded problem.";
  const code = issue?.code ?? scan?.reasonCode ?? null;
  const target = issue?.actionHref ?? "/crm/attendance?view=review";
  const label = issue?.actionLabel ?? "Open Attendance Review";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-[min(100%-2rem,560px)] overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-[var(--cs-border-soft)] p-5 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 p-5 text-sm">
          {code ? (
            <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 py-2 text-xs">
              <span className="font-semibold">Problem code: </span>{code.toUpperCase()}
              {issue?.scanIdSuffix || scan?.scanIdSuffix ? (
                <span className="ml-2">· Scan ID suffix: {issue?.scanIdSuffix ?? scan?.scanIdSuffix}</span>
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-3">
            <CircleHelp size={19} className="mt-0.5 shrink-0 text-[var(--cs-text-muted)]" aria-hidden />
            <div>
              <p className="font-semibold">What needs correcting</p>
              <p className="mt-1 text-[var(--cs-text-secondary)]">
                {issue?.guidance ??
                  "This attempt did not complete successfully. Inspect the related Attendance records before deciding whether to retry, correct, or escalate."}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border border-[var(--cs-border)] p-3">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[var(--cs-text-muted)]" aria-hidden />
            <div>
              <p className="font-semibold">Review required</p>
              <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">
                {isIssue
                  ? "This issue does not yet have an approved inline correction dialog. Open its existing editor to make a controlled change, then return here and refresh to verify."
                  : "A failed scan is not always an open incident. The existing Attendance Review workflow is authoritative for any correction."}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 gap-2 p-4">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button asChild>
            <Link href={target}>{label} <ArrowUpRight size={15} aria-hidden /></Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
