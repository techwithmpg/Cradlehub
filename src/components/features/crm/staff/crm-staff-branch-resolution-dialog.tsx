"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { resolveBranchAssignmentIssueAction } from "@/app/(dashboard)/crm/staff/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type {
  BranchAssignmentIssue,
  BranchAssignmentResolutionResult,
} from "@/lib/staff/branch-correction-types";
import {
  branchAssignmentResolutionForDecision,
  formatBranchAssignmentDate,
  temporaryBranchWindow,
  type BranchAssignmentDecision,
} from "./branch-assignment-ui";

type Props = {
  issue: BranchAssignmentIssue | null;
  mode: "resolve" | "wrong_qr";
  onClose: () => void;
  onResolved: (result: Extract<BranchAssignmentResolutionResult, { ok: true }>) => void;
};

const DECISIONS: Array<{
  value: BranchAssignmentDecision;
  label: string;
  description: string;
  icon: typeof Clock3;
}> = [
  {
    value: "temporary_shift",
    label: "Allow for this shift",
    description: "Keep the primary branch unchanged. Access expires after 12 hours or when the shift closes.",
    icon: Clock3,
  },
  {
    value: "temporary_day",
    label: "Allow for today",
    description: "Keep the primary branch unchanged. Access expires at the next Attendance boundary.",
    icon: CalendarDays,
  },
  {
    value: "permanent_transfer",
    label: "Move permanently",
    description: "Change the primary branch. Historical records remain where they were recorded.",
    icon: ArrowRightLeft,
  },
];

export function CrmStaffBranchResolutionDialog({ issue, mode, onClose, onResolved }: Props) {
  const [decision, setDecision] = useState<BranchAssignmentDecision>("temporary_shift");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function close() {
    if (!isPending) onClose();
  }

  function submit() {
    if (!issue) return;
    const trimmedReason = reason.trim();
    if (mode === "wrong_qr" && trimmedReason.length < 3) {
      toast.error("Enter a short reason for confirming the wrong QR scan.");
      return;
    }
    if (mode === "resolve" && decision === "permanent_transfer" && !trimmedReason) {
      toast.error("Enter a short transfer reason.");
      return;
    }

    const temporary = mode === "resolve" && decision !== "permanent_transfer"
      ? temporaryBranchWindow(decision)
      : null;

    startTransition(async () => {
      const result = await resolveBranchAssignmentIssueAction({
        issueId: issue.id,
        resolutionType: mode === "wrong_qr"
          ? "confirm_wrong_qr_scan"
          : branchAssignmentResolutionForDecision(decision),
        reason: trimmedReason || undefined,
        effectiveDate: temporary?.effectiveDate,
        validFrom: temporary?.validFrom,
        validUntil: temporary?.validUntil,
        temporaryScope: temporary?.temporaryScope,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onResolved(result);
      onClose();
    });
  }

  const permanent = mode === "resolve" && decision === "permanent_transfer";
  const confirmation = issue
    ? mode === "wrong_qr"
      ? `${issue.staffName}'s primary branch will remain ${issue.profileBranchName}. No Attendance will be created from the original scan.`
      : permanent
        ? `${issue.staffName}'s primary branch will change from ${issue.profileBranchName} to ${issue.affectedBranchName ?? "the scanned branch"}. Historical records remain unchanged.`
        : `${issue.staffName} will receive temporary access to ${issue.affectedBranchName ?? "the scanned branch"}. Their primary branch remains ${issue.profileBranchName}.`
    : "";

  return (
    <Dialog open={issue !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{mode === "wrong_qr" ? "Confirm wrong QR scan" : "Resolve Branch Assignment"}</DialogTitle>
          <DialogDescription>
            {issue
              ? `${issue.staffName} scanned at ${issue.affectedBranchName ?? "another branch"}, while their current profile branch is ${issue.profileBranchName}.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {issue ? (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-lg bg-[var(--cs-surface-warm)] p-3 text-sm sm:grid-cols-2">
              <p><span className="text-[var(--cs-text-muted)]">Staff:</span> <strong>{issue.staffName}</strong> · {issue.staffType ?? "Staff"}</p>
              <p><span className="text-[var(--cs-text-muted)]">Detected:</span> {formatBranchAssignmentDate(issue.createdAt)}</p>
              <p><span className="text-[var(--cs-text-muted)]">Source:</span> {issue.source.replaceAll("_", " ")}</p>
              <p><span className="text-[var(--cs-text-muted)]">Open Attendance:</span> {issue.openAttendanceCount}</p>
            </div>

            {issue.openAttendanceCount > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                An open Attendance record exists. The resolver may send this case to manager review instead of changing branch data immediately.
              </div>
            ) : null}

            {mode === "resolve" ? (
              <div className="grid gap-2">
                {DECISIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = decision === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={issue.isTest && option.value === "permanent_transfer"}
                      onClick={() => setDecision(option.value)}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-[#2f7040] bg-emerald-50" : "border-[var(--cs-border)]"}`}
                    >
                      <Icon size={18} className="mt-0.5 shrink-0" />
                      <span>
                        <strong className="block text-sm">{option.label}{option.value === "permanent_transfer" ? ` to ${issue.affectedBranchName ?? "scanned branch"}` : ""}</strong>
                        <span className="mt-0.5 block text-xs text-[var(--cs-text-muted)]">{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div>
              <label htmlFor="branch-assignment-reason" className="text-sm font-semibold">
                {mode === "wrong_qr" ? "Reason" : permanent ? "Transfer reason" : "Coverage note (optional)"}
              </label>
              <Textarea
                id="branch-assignment-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                className="mt-1"
                placeholder={mode === "wrong_qr" ? "Why was this the wrong QR?" : permanent ? "Why is the primary branch changing?" : "Optional note for the audit trail"}
              />
            </div>

            <div className={`rounded-lg p-3 text-sm ${mode === "wrong_qr" ? "bg-red-50 text-red-900" : permanent ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950"}`}>
              {confirmation} The original scan will not be replayed; the staff member must scan again after resolution.
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <button type="button" className="rounded-md border border-[var(--cs-border)] px-4 py-2 text-sm font-semibold" disabled={isPending} onClick={close}>Cancel</button>
          <button type="button" className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${mode === "wrong_qr" ? "bg-red-700" : "bg-[#2f7040]"}`} disabled={isPending} onClick={submit}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : mode === "wrong_qr" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
            {mode === "wrong_qr" ? "Confirm wrong QR" : "Confirm resolution"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
