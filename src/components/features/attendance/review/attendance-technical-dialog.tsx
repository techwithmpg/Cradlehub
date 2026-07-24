"use client";

import { useTransition } from "react";
import { MessageCircleQuestion, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
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
import { attendanceReviewInstruction } from "@/lib/attendance/review-resolution";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type {
  AttendanceRecord,
  AttendanceScanEvent,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

export function AttendanceTechnicalDialog({
  open,
  onOpenChange,
  data,
  item,
  record,
  scanEvent,
  onSaved,
  onOpenPhoneSetup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AttendanceWorkspaceData;
  item: AttendanceReviewItem;
  record: AttendanceRecord | null;
  scanEvent: AttendanceScanEvent | null;
  onSaved: () => void;
  onOpenPhoneSetup?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function finish(message: string) {
    toast.success(message);
    onOpenChange(false);
    onSaved();
  }

  function escalate() {
    startTransition(async () => {
      const result = await escalateAttendanceIssueAction(item.exception.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      finish(result.message);
    });
  }

  function askStaff() {
    startTransition(async () => {
      const result = await askStaffAboutAttendanceIssueAction({
        exceptionId: item.exception.id,
        message:
          "CRM needs one detail to finish your Attendance review. Please describe what happened when you scanned.",
        responseChoices: ["I was clocking in", "I was clocking out", "The phone showed an error"],
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
          <DialogTitle>Review Attendance processing</DialogTitle>
          <DialogDescription>
            The system preserved the available evidence but cannot apply a safe automatic
            correction.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 overflow-y-auto p-5">
          <AttendanceIssueSummary
            data={data}
            item={item}
            record={record}
            scanEvent={scanEvent}
            instruction={attendanceReviewInstruction("technical")}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={askStaff} disabled={pending}>
              <MessageCircleQuestion data-icon="inline-start" />
              Ask staff for details
            </Button>
            {onOpenPhoneSetup ? (
              <Button type="button" variant="outline" onClick={onOpenPhoneSetup}>
                Open phone setup
              </Button>
            ) : null}
          </div>
        </div>

        <DialogFooter className="border-t border-[var(--cs-border-soft)] bg-white p-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={escalate} disabled={pending}>
            <Wrench data-icon="inline-start" />
            {pending ? "Escalating…" : "Escalate technical issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
