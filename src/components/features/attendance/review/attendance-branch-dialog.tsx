"use client";

import { useState, useTransition } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { toast } from "sonner";
import {
  applyAttendanceCorrectionAction,
  askStaffAboutAttendanceIssueAction,
} from "@/app/(dashboard)/crm/attendance/actions";
import { AttendanceIssueSummary } from "@/components/features/attendance/review/attendance-issue-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { attendanceReviewInstruction } from "@/lib/attendance/review-resolution";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type { AttendanceScanEvent, AttendanceWorkspaceData } from "@/lib/attendance/types";

function metadataText(metadata: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function AttendanceBranchDialog({
  open,
  onOpenChange,
  data,
  item,
  scanEvent,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AttendanceWorkspaceData;
  item: AttendanceReviewItem;
  scanEvent: AttendanceScanEvent | null;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("Approved scanned branch for today");
  const [pending, startTransition] = useTransition();
  const currentBranch =
    metadataText(
      item.exception.metadata,
      "currentBranchName",
      "profileBranchName",
      "homeBranchName"
    ) ?? "Current profile branch";
  const scannedBranch =
    metadataText(
      item.exception.metadata,
      "requestedBranchName",
      "scannedBranchName",
      "qrBranchName"
    ) ?? data.branchName;

  function finish(message: string) {
    toast.success(message);
    onOpenChange(false);
    onSaved();
  }

  function approveToday() {
    if (!item.exception.staff_id || reason.trim().length < 3) return;
    startTransition(async () => {
      const result = await applyAttendanceCorrectionAction({
        branchId: data.branchId,
        actionType: "allow_branch_today",
        exceptionId: item.exception.id,
        checkinId: item.exception.checkin_id,
        staffId: item.exception.staff_id,
        attendanceDate: data.businessDate,
        targetBranchId: data.branchId,
        reason: reason.trim(),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      finish("Branch approved for today. Ask the staff member to scan once again.");
    });
  }

  function askStaff() {
    startTransition(async () => {
      const result = await askStaffAboutAttendanceIssueAction({
        exceptionId: item.exception.id,
        message: `Please confirm where you worked today. Your profile shows ${currentBranch}, but the Attendance QR was for ${scannedBranch}.`,
        responseChoices: [currentBranch, scannedBranch, "Another branch"],
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      finish(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[min(100%-1rem,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-[var(--cs-border-soft)] p-5 pr-12">
          <DialogTitle>Resolve branch issue</DialogTitle>
          <DialogDescription>
            Approve the scanned branch for today without changing the staff member’s permanent
            branch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 overflow-y-auto p-5">
          <AttendanceIssueSummary
            data={data}
            item={item}
            record={null}
            scanEvent={scanEvent}
            instruction={attendanceReviewInstruction("branch")}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--cs-border)] p-4">
              <div className="text-xs font-bold uppercase text-[var(--cs-text-muted)]">
                Profile branch
              </div>
              <div className="mt-2 font-semibold">{currentBranch}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-bold uppercase text-emerald-700">Scanned branch</div>
              <div className="mt-2 font-semibold text-emerald-950">{scannedBranch}</div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch-resolution-reason">Required reason</Label>
            <Input
              id="branch-resolution-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          <Button type="button" variant="outline" onClick={askStaff} disabled={pending}>
            <MessageCircleQuestion data-icon="inline-start" />
            Ask staff to confirm branch
          </Button>
        </div>

        <DialogFooter className="border-t border-[var(--cs-border-soft)] bg-white p-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={approveToday}
            disabled={pending || !item.exception.staff_id || reason.trim().length < 3}
          >
            {pending ? "Approving…" : "Approve branch for today"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
