"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertCrmScheduleOverrideAction } from "@/lib/actions/crm-schedule-availability";
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

export function AttendanceScheduleDialog({
  open,
  onOpenChange,
  branchId,
  staffId,
  staffName,
  date,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  staffId: string | null;
  staffName: string;
  date: string;
  onSaved: () => void;
}) {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("Attendance review correction");
  const [pending, startTransition] = useTransition();
  function save() {
    if (!staffId) return;
    startTransition(async () => {
      const result = await upsertCrmScheduleOverrideAction({
        branchId,
        staffId,
        overrideDate: date,
        isDayOff: false,
        shiftType: "single",
        startTime,
        endTime,
        reason,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Today’s schedule saved.");
      onOpenChange(false);
      onSaved();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set today’s schedule</DialogTitle>
          <DialogDescription>
            Create a one-day schedule for {staffName}. The regular weekly schedule stays unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="schedule-start">Start</Label>
            <Input
              id="schedule-start"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="schedule-end">End</Label>
            <Input
              id="schedule-end"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="schedule-reason">Reason</Label>
          <Input
            id="schedule-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !staffId}>
            {pending ? "Saving…" : "Save one-day schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
