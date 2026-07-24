"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { applyAttendanceCorrectionAction } from "@/app/(dashboard)/crm/attendance/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { buildAttendanceTimeCorrectionPreview } from "@/lib/attendance/crm-correction";
import { branchDateTimeToIsoInTimezone } from "@/lib/attendance/shift-instance";
import type { AttendanceException, AttendanceRecord } from "@/lib/attendance/types";

function localInput(iso: string | null, timezone: string): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function toIso(value: string, timezone: string): string {
  const [date = "", time = ""] = value.split("T");
  return branchDateTimeToIsoInTimezone({
    date,
    time: `${time}:00`,
    timezone,
  });
}

export function AttendanceCorrectionDialog({
  open,
  onOpenChange,
  branchId,
  timezone,
  record,
  exception,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  timezone: string;
  record: AttendanceRecord | null;
  exception: AttendanceException | null;
  onSaved: () => void;
}) {
  const [clockIn, setClockIn] = useState(() => localInput(record?.checked_in_at ?? null, timezone));
  const [clockOut, setClockOut] = useState(() =>
    localInput(record?.checked_out_at ?? null, timezone)
  );
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const preview = useMemo(
    () =>
      record && clockIn
        ? buildAttendanceTimeCorrectionPreview({
            record,
            clockIn: toIso(clockIn, timezone),
            clockOut: clockOut ? toIso(clockOut, timezone) : null,
          })
        : null,
    [clockIn, clockOut, record, timezone]
  );

  function save() {
    if (!record || !preview?.changed || reason.trim().length < 3) return;
    startTransition(async () => {
      const result = await applyAttendanceCorrectionAction({
        branchId,
        actionType: preview.actionType,
        exceptionId: exception?.id,
        checkinId: record.id,
        staffId: record.staff_id,
        attendanceDate: record.shift_date,
        manualClockInAt: preview.after.clockIn,
        manualClockOutAt: preview.after.clockOut,
        reason: reason.trim(),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[min(100%-1rem,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[var(--cs-border-soft)] p-5 pr-12">
          <DialogTitle>Correct attendance</DialogTitle>
          <DialogDescription>
            Review the current record and the proposed result. Every change is saved in the audit
            trail.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 overflow-y-auto p-5">
          {record ? (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <strong>What you need to do:</strong> Enter the correct clock-in and clock-out, then
                explain why the record is changing.
              </div>

              <div className="grid gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="attendance-clock-in">Clock-in</Label>
                  <Input
                    id="attendance-clock-in"
                    type="datetime-local"
                    value={clockIn}
                    onChange={(event) => setClockIn(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="attendance-clock-out">Clock-out</Label>
                  <Input
                    id="attendance-clock-out"
                    type="datetime-local"
                    value={clockOut}
                    onChange={(event) => setClockOut(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-[var(--cs-border)] p-4">
                  <div className="text-xs font-bold uppercase text-[var(--cs-text-muted)]">
                    Before
                  </div>
                  <p className="mt-2 font-semibold">
                    {localInput(record.checked_in_at, timezone)} →{" "}
                    {localInput(record.checked_out_at, timezone) || "Open"}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-bold uppercase text-emerald-700">After</div>
                  <p className="mt-2 font-semibold text-emerald-950">
                    {clockIn || "Missing"} → {clockOut || "Open"}
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="attendance-correction-reason">Required reason</Label>
                <Textarea
                  id="attendance-correction-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Why is this correction needed?"
                />
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              This incident does not have an attendance record to edit. Close this dialog and use
              <strong> Resolve saved scan</strong> from the Review queue.
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-[var(--cs-border-soft)] bg-white p-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {record ? "Cancel" : "Close"}
          </Button>
          {record ? (
            <Button
              onClick={save}
              disabled={pending || !preview?.changed || reason.trim().length < 3}
            >
              {pending ? "Saving…" : "Save correction"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
