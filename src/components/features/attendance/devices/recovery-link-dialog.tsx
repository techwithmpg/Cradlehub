"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { generateDeviceRecoveryLinkAction } from "@/app/(dashboard)/crm/attendance/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAttendanceDateTime } from "@/components/features/attendance/attendance-ui";
import { formatDeviceReason } from "@/lib/attendance/device-display";
import type {
  AttendanceDeviceRegistryData,
  AttendanceDeviceRegistryEntry,
  DeviceRecoveryReason,
  PendingDeviceRecoveryLink,
  RecoveryLinkResult,
} from "@/lib/attendance/types";

const RECOVERY_REASONS: Array<{ value: DeviceRecoveryReason; label: string; revoke: boolean }> = [
  { value: "browser_data_cleared", label: "Browser data cleared", revoke: false },
  { value: "replacement_phone", label: "Replacement phone", revoke: false },
  { value: "lost_phone", label: "Lost phone", revoke: true },
  { value: "device_cookie_expired", label: "Device cookie expired", revoke: false },
  { value: "support_recovery", label: "Support recovery", revoke: false },
  { value: "security_concern", label: "Security concern", revoke: true },
  { value: "other", label: "Other", revoke: false },
];

const TTL_OPTIONS = [15, 30, 60] as const;

export function RecoveryLinkDialog({
  open,
  onOpenChange,
  registry,
  entry,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registry: AttendanceDeviceRegistryData;
  entry: AttendanceDeviceRegistryEntry | null;
  onGenerated: (link: PendingDeviceRecoveryLink, result: RecoveryLinkResult) => void;
}) {
  const [staffId, setStaffId] = useState(entry?.staffId ?? registry.staffOptions[0]?.id ?? "");
  const [reason, setReason] = useState<DeviceRecoveryReason>("browser_data_cleared");
  const [ttl, setTtl] = useState<15 | 30 | 60>(30);
  const [revokePrevious, setRevokePrevious] = useState(false);
  const [previousDeviceId, setPreviousDeviceId] = useState(
    entry?.device?.isActive ? entry.device.id : ""
  );
  const [result, setResult] = useState<RecoveryLinkResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const idPrefix = useId();

  const selectedStaff = registry.staffOptions.find((staff) => staff.id === staffId) ?? null;
  const activeDevices = useMemo(
    () => registry.activeDevices.filter((device) => device.staffId === staffId),
    [registry.activeDevices, staffId]
  );
  const requiresPreviousSelection = revokePrevious && activeDevices.length > 1 && !previousDeviceId;

  function changeReason(nextReason: DeviceRecoveryReason) {
    const config = RECOVERY_REASONS.find((item) => item.value === nextReason);
    setReason(nextReason);
    setRevokePrevious(Boolean(config?.revoke));
    if (config?.revoke && activeDevices.length === 1)
      setPreviousDeviceId(activeDevices[0]?.id ?? "");
  }

  function generate() {
    if (!staffId || requiresPreviousSelection) return;
    startTransition(async () => {
      const response = await generateDeviceRecoveryLinkAction({
        staffId,
        branchId: registry.branchId,
        reason,
        expiresInMinutes: ttl,
        revokePreviousDeviceId: revokePrevious ? previousDeviceId || undefined : undefined,
      });

      if (!response.success) {
        toast.error(response.error);
        return;
      }

      const pendingLink: PendingDeviceRecoveryLink = {
        id: response.data.tokenId,
        staffId,
        staffName: response.data.staffName,
        staffNickname: null,
        branchId: registry.branchId,
        branchName: response.data.branchName,
        reason,
        createdAt: new Date().toISOString(),
        expiresAt: response.data.expiresAt,
        revokePreviousDeviceId: revokePrevious ? previousDeviceId || null : null,
      };
      setResult(response.data);
      onGenerated(pendingLink, response.data);
      toast.success("Recovery link ready.");
    });
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(100%-1rem,560px)] gap-0 p-0 sm:max-w-xl">
        {!result ? (
          <>
            <DialogHeader className="border-b border-stone-200 p-5">
              <DialogTitle>Connect Replacement Phone</DialogTitle>
              <DialogDescription>
                Create a secure, one-time link to restore attendance access.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 p-5">
              <div className="grid gap-1">
                <label
                  htmlFor={`${idPrefix}-staff`}
                  className="text-xs font-bold uppercase text-stone-500"
                >
                  Staff
                </label>
                <select
                  id={`${idPrefix}-staff`}
                  value={staffId}
                  onChange={(event) => setStaffId(event.target.value)}
                  className="h-9 rounded-lg border border-stone-200 px-3 text-sm"
                >
                  {registry.staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} - {formatDeviceReason(staff.staffType)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <label
                  htmlFor={`${idPrefix}-branch`}
                  className="text-xs font-bold uppercase text-stone-500"
                >
                  Branch
                </label>
                <input
                  id={`${idPrefix}-branch`}
                  readOnly
                  value={selectedStaff?.branchName ?? registry.branchName}
                  className="h-9 rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label
                    htmlFor={`${idPrefix}-reason`}
                    className="text-xs font-bold uppercase text-stone-500"
                  >
                    Reason
                  </label>
                  <select
                    id={`${idPrefix}-reason`}
                    value={reason}
                    onChange={(event) => changeReason(event.target.value as DeviceRecoveryReason)}
                    className="h-9 rounded-lg border border-stone-200 px-3 text-sm"
                  >
                    {RECOVERY_REASONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <label
                    htmlFor={`${idPrefix}-ttl`}
                    className="text-xs font-bold uppercase text-stone-500"
                  >
                    Link expires in
                  </label>
                  <select
                    id={`${idPrefix}-ttl`}
                    value={ttl}
                    onChange={(event) => setTtl(Number(event.target.value) as 15 | 30 | 60)}
                    className="h-9 rounded-lg border border-stone-200 px-3 text-sm"
                  >
                    {TTL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option} minutes
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
                <input
                  type="checkbox"
                  checked={revokePrevious}
                  onChange={(event) => setRevokePrevious(event.target.checked)}
                />
                Disconnect previous phone after connection
              </label>
              {revokePrevious ? (
                <select
                  aria-label="Previous phone to disconnect"
                  value={previousDeviceId}
                  onChange={(event) => setPreviousDeviceId(event.target.value)}
                  className="h-9 rounded-lg border border-stone-200 px-3 text-sm"
                >
                  <option value="">Select previous device</option>
                  {activeDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label}
                    </option>
                  ))}
                </select>
              ) : null}
              {requiresPreviousSelection ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Select the exact previous device before generating this link.
                </div>
              ) : null}
              <p className="text-xs leading-5 text-stone-500">
                The link works once and registers the browser where it is opened.
              </p>
            </div>
            <DialogFooter className="p-5">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[#9A6A3A] text-white hover:bg-[#82572F]"
                disabled={isPending || !staffId || requiresPreviousSelection}
                onClick={generate}
              >
                <Link2 data-icon="inline-start" />
                {isPending ? "Generating..." : "Generate secure link"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="grid gap-4 p-5">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-5" />
              <DialogTitle>Recovery link ready</DialogTitle>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
              <div className="font-semibold text-stone-950">{result.staffName}</div>
              <div className="text-stone-500">
                {result.branchName} - {formatDeviceReason(result.reason)}
              </div>
              <div className="mt-2 text-xs text-stone-500">
                Expires {formatAttendanceDateTime(result.expiresAt)}
              </div>
            </div>
            <input
              aria-label="Recovery URL"
              readOnly
              value={result.recoveryUrl}
              className="h-9 rounded-lg border border-stone-200 px-3 text-sm"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(result.recoveryUrl, "Recovery link")}
              >
                <Copy data-icon="inline-start" />
                Copy link
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  copy(
                    `Open this secure recovery link on your phone: ${result.recoveryUrl}`,
                    "Instructions"
                  )
                }
              >
                <Copy data-icon="inline-start" />
                Copy instructions
              </Button>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
              Send this only to the staff member. It cannot be reconstructed after this dialog
              closes.
            </div>
            <DialogFooter className="-mx-5 -mb-5 p-5">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
