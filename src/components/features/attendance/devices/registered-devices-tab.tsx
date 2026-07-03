"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Copy, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, StatusPill, formatAttendanceDateTime } from "@/components/features/attendance/attendance-ui";
import { createDeviceActivationTokenAction, revokeAttendanceDeviceAction, type AttendanceActionResult } from "@/app/(dashboard)/crm/attendance/actions";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

export function RegisteredDevicesTab({
  data,
  activation,
  onActionResult,
}: {
  data: AttendanceWorkspaceData;
  activation?: { activationUrl: string; expiresAt: string } | null;
  onActionResult: (result: AttendanceActionResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [staffId, setStaffId] = useState("");
  const [status, setStatus] = useState("all");
  const [isPending, startTransition] = useTransition();
  const activationUnavailable = !data.qrConfiguration.isConfigured;

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.devices.filter((device) => {
      const matchesQuery = !normalizedQuery || `${device.staff_name} ${device.device_label ?? ""}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "all" || device.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [data.devices, query, status]);

  function activatePhone() {
    if (activationUnavailable) {
      onActionResult({
        ok: false,
        tab: "devices",
        message: "Configure APP_URL or NEXT_PUBLIC_APP_URL before creating device activation links.",
      });
      return;
    }
    const formData = new FormData();
    formData.set("staffId", staffId);
    startTransition(async () => {
      onActionResult(await createDeviceActivationTokenAction(formData));
    });
  }

  function revokeDevice(deviceId: string) {
    const formData = new FormData();
    formData.set("deviceId", deviceId);
    startTransition(async () => {
      onActionResult(await revokeAttendanceDeviceAction(formData));
    });
  }

  async function copyActivationLink() {
    if (!activation?.activationUrl) return;
    await navigator.clipboard.writeText(activation.activationUrl);
    toast.success("Activation link copied.");
  }

  return (
    <div className="grid gap-4">
      <Panel
        title="Device Activation"
        action={
          <Button type="button" disabled={isPending || activationUnavailable} onClick={activatePhone}>
            <ShieldCheck data-icon="inline-start" />
            {isPending ? "Creating..." : "Activate Phone"}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
            className="h-8 min-w-60 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
          >
            <option value="">Select staff</option>
            {data.staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>{staff.full_name}</option>
            ))}
          </select>
          <Button type="button" variant="outline" disabled={isPending || activationUnavailable} onClick={activatePhone}>
            Activate and Clock In
          </Button>
        </div>
        {activationUnavailable ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-700/25 bg-[#FFF7E8] px-3 py-2 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <span>Activation links require APP_URL or NEXT_PUBLIC_APP_URL in the Production environment.</span>
          </div>
        ) : null}
        {activation ? (
          <div className="grid gap-2 rounded-lg border border-emerald-800/20 bg-emerald-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Temporary activation link</div>
            <div className="flex flex-wrap items-center gap-2">
              <input readOnly value={activation.activationUrl} className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 text-sm" />
              <Button type="button" variant="outline" onClick={copyActivationLink}>
                <Copy data-icon="inline-start" />
                Copy
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">Expires {formatAttendanceDateTime(activation.expiresAt)}. Activation QRs are temporary and are not printable signs.</div>
          </div>
        ) : null}
      </Panel>

      <Panel title={`Registered Devices (${rows.length})`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
          <label className="flex h-8 min-w-64 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Search className="size-4 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff or device..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No registered devices found." detail="Create a temporary activation link to register a staff phone." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b bg-stone-50 text-left text-xs text-muted-foreground">
                  {["Staff", "Device", "Platform", "Activated", "Last Used", "Last QR", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((device) => (
                  <tr key={device.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3 font-semibold">{device.staff_name}</td>
                    <td className="px-3 py-3">{device.device_label ?? "Staff mobile device"}</td>
                    <td className="px-3 py-3 text-muted-foreground">Mobile browser</td>
                    <td className="px-3 py-3">{formatAttendanceDateTime(device.created_at)}</td>
                    <td className="px-3 py-3">{formatAttendanceDateTime(device.last_seen_at)}</td>
                    <td className="px-3 py-3 text-muted-foreground">Attendance QR</td>
                    <td className="px-3 py-3"><StatusPill value={device.status} /></td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm">View Activity</Button>
                        {device.status === "active" ? (
                          <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={() => revokeDevice(device.id)}>
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
