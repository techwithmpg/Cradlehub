"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveAttendanceExceptionAction } from "@/app/(dashboard)/crm/attendance/actions";
import { upsertCrmScheduleOverrideAction } from "@/lib/actions/crm-schedule-availability";
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

function minutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

export function AttendanceScheduleDialog({
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
  const suggestedWindow = dayState?.shiftWindows[0] ?? null;
  const [startTime, setStartTime] = useState(suggestedWindow?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(suggestedWindow?.endTime ?? "18:00");
  const [reason, setReason] = useState("One-day schedule created during Attendance review");
  const [pending, startTransition] = useTransition();
  const staffName = item.exception.staff_name ?? "staff member";
  const hasSavedScan = Boolean(scanEvent || item.exception.scan_event_id);
  const endsNextDay = useMemo(() => minutes(endTime) <= minutes(startTime), [endTime, startTime]);

  function save() {
    const staffId = item.exception.staff_id;
    if (!staffId || reason.trim().length < 3) return;

    startTransition(async () => {
      const schedule = await upsertCrmScheduleOverrideAction({
        branchId: data.branchId,
        staffId,
        overrideDate: data.businessDate,
        isDayOff: false,
        shiftType: "single",
        startTime,
        endTime,
        reason: reason.trim(),
      });

      if (!schedule.ok) {
        toast.error(schedule.message);
        return;
      }

      if (hasSavedScan) {
        toast.success(
          "Today’s schedule was saved. The saved scan remains safely in Review until the database resolver is approved."
        );
      } else {
        const form = new FormData();
        form.set("exceptionId", item.exception.id);
        form.set("resolutionNote", reason.trim());
        const resolved = await resolveAttendanceExceptionAction(form);
        if (!resolved.ok) {
          toast.error(`Schedule saved, but the issue remains open: ${resolved.message}`);
          onOpenChange(false);
          onSaved();
          return;
        }
        toast.success("Today’s schedule was created and the issue was resolved.");
      }

      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[min(100%-1rem,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-[var(--cs-border-soft)] p-5 pr-12">
          <DialogTitle>Add today’s schedule</DialogTitle>
          <DialogDescription>
            Create a one-day shift for {staffName}. The regular weekly schedule remains unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 overflow-y-auto p-5">
          <AttendanceIssueSummary
            data={data}
            item={item}
            record={null}
            scanEvent={scanEvent}
            instruction={attendanceReviewInstruction("schedule")}
          />

          <div className="grid gap-4 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="schedule-start">Shift starts</Label>
              <Input
                id="schedule-start"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schedule-end">Shift ends</Label>
              <Input
                id="schedule-end"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
              {endsNextDay ? (
                <span className="text-xs text-[var(--cs-text-muted)]">Ends the next day</span>
              ) : null}
            </div>
          </div>

          {hasSavedScan ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              The saved scan will remain attached to this issue. Do not enter a clock time from
              memory and do not ask the staff member to scan repeatedly.
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="schedule-reason">Required reason</Label>
            <Input
              id="schedule-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-[var(--cs-border-soft)] bg-white p-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={pending || !item.exception.staff_id || reason.trim().length < 3}
          >
            {pending ? "Saving…" : "Save one-day schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
