"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EditAvailabilityModal } from "@/components/features/crm/schedule/edit-availability-modal";
import { getStaffNeedingWeeklySchedule } from "@/lib/operations-center/missing-schedules";
import type { StaffAvailabilityItem } from "@/lib/queries/staff";
import type { OperationalStaffMember } from "@/lib/operations-center/issue-model";

export function OperationsScheduleSetup({
  open,
  branchId,
  branchName,
  available,
  items,
  verifiedStaff,
  dayOfWeek,
  onClose,
  onSaved,
}: {
  open: boolean;
  branchId: string;
  branchName: string;
  available: boolean;
  items: StaffAvailabilityItem[];
  verifiedStaff: OperationalStaffMember[];
  dayOfWeek: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [editing, setEditing] = useState(false);
  const candidates = available
    ? getStaffNeedingWeeklySchedule(items, verifiedStaff, branchId, dayOfWeek)
    : [];
  const selected = candidates.find((item) => item.staff.id === staffId) ?? null;

  if (editing && selected) {
    return (
      <EditAvailabilityModal
        open={open}
        item={selected}
        branchId={branchId}
        branchName={branchName}
        initialTab="weekly"
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditing(false);
            onClose();
          }
        }}
        onSaved={() => {
          onSaved();
          onClose();
        }}
      />
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b p-5">
          <DialogTitle>Set Up Staff Schedule</DialogTitle>
          <DialogDescription>Choose a team member who needs a weekly schedule.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4">
          {!available ? (
            <p role="alert" className="text-sm text-amber-800">
              Verified staff or schedules could not be loaded. Refresh Operations Center and try again.
            </p>
          ) : null}
          {available && candidates.length === 0 ? (
            <p className="text-sm">
              All eligible active service staff have a schedule for this business day.
            </p>
          ) : null}
          {available && candidates.length > 0 ? (
            <>
              <label htmlFor="ops-unscheduled-staff" className="block text-xs font-semibold">
                Staff without a schedule today ({candidates.length})
              </label>
              <select
                id="ops-unscheduled-staff"
                className="min-h-11 w-full rounded-lg border px-3 text-sm"
                value={staffId}
                onChange={(event) => setStaffId(event.target.value)}
              >
                <option value="">Choose a staff member</option>
                {candidates.map((item) => (
                  <option key={item.staff.id} value={item.staff.id}>
                    {item.staff.full_name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
        <DialogFooter className="border-t px-5 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!available || !selected} onClick={() => setEditing(true)}>
            Assign Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
