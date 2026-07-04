"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renameAttendanceDeviceAction } from "@/app/(dashboard)/crm/attendance/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AttendanceDeviceRegistryEntry } from "@/lib/attendance/types";

export function RenameDeviceDialog({
  open,
  onOpenChange,
  entry,
  onRenamed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: AttendanceDeviceRegistryEntry | null;
  onRenamed: (deviceId: string, label: string) => void;
}) {
  const [label, setLabel] = useState(entry?.device?.label ?? "");
  const [isPending, startTransition] = useTransition();
  const trimmed = label.trim();

  function save() {
    const device = entry?.device;
    if (!device || trimmed.length < 2 || trimmed.length > 60) return;
    startTransition(async () => {
      const result = await renameAttendanceDeviceAction({
        branchId: entry.homeBranchId,
        deviceId: device.id,
        label: trimmed,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onRenamed(result.data.deviceId, result.data.label);
      toast.success("Device renamed.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename device</DialogTitle>
          <DialogDescription>Device name for {entry?.staffName ?? "selected staff"}.</DialogDescription>
        </DialogHeader>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={60}
          className="h-9 rounded-lg border border-stone-200 px-3 text-sm"
          placeholder="Device name"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={isPending || trimmed.length < 2 || trimmed.length > 60} onClick={save}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
