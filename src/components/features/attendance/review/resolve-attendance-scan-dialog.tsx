"use client";

import { useMemo, useState, useTransition } from "react";
import { MessageCircleQuestion, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  applyAttendanceCorrectionAction,
  askStaffAboutAttendanceIssueAction,
  escalateAttendanceIssueAction,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { attendanceReviewInstruction } from "@/lib/attendance/review-resolution";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type { AttendanceScanEvent, AttendanceWorkspaceData } from "@/lib/attendance/types";

function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ResolveAttendanceScanDialog({
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
  const dayState = data.dailyStaffStates.find((row) => row.staffId === item.exception.staff_id);
  const scanOccurredAt = scanEvent?.created_at ?? item.exception.detected_at;
  const likelyMeaning = useMemo<"clock-in" | "clock-out">(() => {
    const action = scanEvent?.action.toLowerCase() ?? "";
    if (action.includes("clock_out")) return "clock-out";
    if (dayState?.clockInAt && !dayState.clockOutAt) return "clock-out";
    return "clock-in";
  }, [dayState?.clockInAt, dayState?.clockOutAt, scanEvent?.action]);
  const [reason, setReason] = useState("Saved Attendance scan reviewed by CRM");
  const [pending, startTransition] = useTransition();
  const staffName = item.exception.staff_name ?? "Staff member";
  const scanTime = formatTime(scanOccurredAt, data.timezone);

  function finish(message: string) {
    toast.success(message);
    onOpenChange(false);
    onSaved();
  }

  function askStaff() {
    startTransition(async () => {
      const result = await askStaffAboutAttendanceIssueAction({
        exceptionId: item.exception.id,
        message: `Please confirm whether your ${scanTime} Attendance scan was a clock-in or clock-out.`,
        responseChoices: ["Clock in", "Clock out", "Not my scan"],
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      finish(result.message);
    });
  }

  function ignoreScan() {
    if (reason.trim().length < 3) return;
    startTransition(async () => {
      const result = await applyAttendanceCorrectionAction({
        branchId: data.branchId,
        actionType: "ignore_scan",
        exceptionId: item.exception.id,
        staffId: item.exception.staff_id,
        attendanceDate: data.businessDate,
        reason: reason.trim(),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      finish("The saved scan was marked invalid and removed from Review.");
    });
  }

  function escalate() {
    startTransition(async () => {
      const result = await escalateAttendanceIssueAction(item.exception.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      finish("The saved scan was sent for technical Attendance repair with its evidence attached.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[min(100%-1rem,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-[var(--cs-border-soft)] p-5 pr-12">
          <DialogTitle>Resolve saved scan</DialogTitle>
          <DialogDescription>
            {staffName} · The scan is safe, but no Attendance record was created.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 overflow-y-auto p-5">
          <AttendanceIssueSummary
            data={data}
            item={item}
            record={null}
            scanEvent={scanEvent}
            instruction={attendanceReviewInstruction("resolve_scan")}
          />

          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-bold text-emerald-950">What the system recommends</p>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              The {scanTime} scan most likely means <strong>{likelyMeaning}</strong>. The scan time
              is preserved and must not be entered from memory.
            </p>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-amber-950">
                  Database resolver is being verified
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  CRM cannot safely create Attendance from this scan until the live database audit
                  confirms the required transaction. Choose one of the safe actions below; do not
                  ask the staff member to scan repeatedly.
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" onClick={askStaff} disabled={pending}>
              <MessageCircleQuestion data-icon="inline-start" />
              Ask staff to confirm
            </Button>
            <Button type="button" variant="outline" onClick={escalate} disabled={pending}>
              <ShieldAlert data-icon="inline-start" />
              Send for safe repair
            </Button>
          </div>

          <div className="grid gap-2 border-t border-[var(--cs-border-soft)] pt-4">
            <Label htmlFor="ignore-scan-reason">Only when the scan is invalid</Label>
            <Textarea
              id="ignore-scan-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this scan should be ignored."
            />
            <Button
              type="button"
              variant="outline"
              onClick={ignoreScan}
              disabled={pending || reason.trim().length < 3}
              className="justify-self-start text-red-700"
            >
              <Trash2 data-icon="inline-start" />
              Ignore invalid scan
            </Button>
          </div>
        </div>

        <DialogFooter className="border-t border-[var(--cs-border-soft)] bg-white p-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
