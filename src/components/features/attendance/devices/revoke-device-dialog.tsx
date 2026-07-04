"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { revokeAttendanceDeviceAction } from "@/app/(dashboard)/crm/attendance/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AttendanceDeviceRegistryEntry, DeviceRevocationReason } from "@/lib/attendance/types";

const REASONS: Array<{ value: DeviceRevocationReason; label: string }> = [
  { value: "lost_phone", label: "Lost phone" },
  { value: "replacement_phone", label: "Replacement phone" },
  { value: "shared_device", label: "Shared device" },
  { value: "security_concern", label: "Security concern" },
  { value: "staff_request", label: "Staff request" },
  { value: "browser_reset", label: "Browser reset" },
  { value: "other", label: "Other" },
];

export function RevokeDeviceDialog({
  open,
  onOpenChange,
  entry,
  onRevoked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: AttendanceDeviceRegistryEntry | null;
  onRevoked: (deviceId: string, reason: DeviceRevocationReason) => void;
}) {
  const [reason, setReason] = useState<DeviceRevocationReason>("staff_request");
  const [isPending, startTransition] = useTransition();

  function revoke() {
    if (!entry?.device) return;
    const formData = new FormData();
    formData.set("branchId", entry.homeBranchId);
    formData.set("deviceId", entry.device.id);
    formData.set("reason", reason);
    startTransition(async () => {
      const result = await revokeAttendanceDeviceAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onRevoked(entry.device!.id, reason);
      toast.success("Device revoked.");
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke device?</AlertDialogTitle>
          <AlertDialogDescription>
            Future scans from {entry?.device?.label ?? "this device"} will be blocked. Attendance history stays preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <select value={reason} onChange={(event) => setReason(event.target.value as DeviceRevocationReason)} className="h-9 rounded-lg border border-stone-200 px-3 text-sm">
          {REASONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={revoke}>
            {isPending ? "Revoking..." : "Revoke device"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
