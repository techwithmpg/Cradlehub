"use client";

import { CalendarDays, History, Link2, Pencil, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StaffAvatar, formatAttendanceDateTime } from "@/components/features/attendance/attendance-ui";
import type { AttendanceDeviceRegistryEntry } from "@/lib/attendance/types";

function infoRows(entry: AttendanceDeviceRegistryEntry, timezone: string) {
  const device = entry.device;
  if (!device) {
    return [
      ["Device", "No registered device"],
      ["Branch", entry.homeBranchName],
    ] as const;
  }

  return [
    ["Device", device.label],
    ["Browser", [device.browserName, device.browserVersion].filter(Boolean).join(" ") || null],
    ["Platform", device.platformName],
    ["Registered", formatAttendanceDateTime(device.registeredAt, timezone)],
    ["Registered through", device.registrationSource?.replaceAll("_", " ") ?? null],
    ["Last used", formatAttendanceDateTime(device.lastSeenAt, timezone)],
    ["Last attendance scan", formatAttendanceDateTime(device.lastAttendanceScanAt, timezone)],
    ["Last service scan", formatAttendanceDateTime(device.lastServiceScanAt, timezone)],
    ["Total successful scans", String(device.totalSuccessfulScans)],
    ["Last branch", device.registeredBranchName],
  ] as const;
}

function branchDate(nowMs: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function SelectedDevicePanel({
  entry,
  nowMs,
  timezone,
  routeBasePath,
  routeBranchId,
  onGenerateRecovery,
  onRename,
  onRevoke,
}: {
  entry: AttendanceDeviceRegistryEntry | null;
  nowMs: number;
  timezone: string;
  routeBasePath?: string;
  routeBranchId?: string | null;
  onGenerateRecovery: (entry: AttendanceDeviceRegistryEntry) => void;
  onRename: (entry: AttendanceDeviceRegistryEntry) => void;
  onRevoke: (entry: AttendanceDeviceRegistryEntry) => void;
}) {
  if (!entry) {
    return (
      <aside className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-500">
        Select a staff member or device to view details.
      </aside>
    );
  }

  const recordsHref = `${routeBasePath ?? "/crm/attendance"}?tab=records&staffId=${entry.staffId}&date=${branchDate(nowMs, timezone)}${
    routeBranchId ? `&branchId=${routeBranchId}` : ""
  }`;

  return (
    <aside className="sticky top-4 overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <StaffAvatar name={entry.staffName} />
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-stone-950">{entry.staffName}</h2>
            <p className="truncate text-xs text-stone-500">{entry.staffType.replaceAll("_", " ")} - {entry.homeBranchName}</p>
          </div>
        </div>
        <Badge variant="outline" className="capitalize">{entry.status.replaceAll("_", " ")}</Badge>
      </div>

      <div className="grid gap-4 p-5">
        <section>
          <h3 className="mb-3 text-sm font-bold text-stone-950">Device Information</h3>
          <div className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {infoRows(entry, timezone).map(([label, value]) => (
              value ? (
                <div key={label} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm">
                  <span className="text-stone-500">{label}</span>
                  <span className="max-w-44 truncate text-right font-semibold text-stone-950">{value}</span>
                </div>
              ) : null
            ))}
          </div>
        </section>

        <details className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-stone-950">Technical Details</summary>
          <div className="mt-2 grid gap-1 text-xs text-stone-500">
            <span>Device ID: {entry.device?.id ?? "Not registered"}</span>
            <span>Staff ID: {entry.staffId}</span>
          </div>
        </details>
      </div>

      <div className="grid gap-3 border-t border-stone-200 p-5">
        <Button type="button" className="bg-[#9A6A3A] text-white hover:bg-[#82572F]" onClick={() => onGenerateRecovery(entry)}>
          <Link2 data-icon="inline-start" />
          Generate recovery link
        </Button>
        <Button type="button" variant="outline" disabled={!entry.device} onClick={() => onRename(entry)}>
          <Pencil data-icon="inline-start" />
          Rename device
        </Button>
        <Button type="button" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={!entry.device} onClick={() => onRevoke(entry)}>
          <Trash2 data-icon="inline-start" />
          Revoke device
        </Button>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" asChild>
            <a href={recordsHref}>
              <CalendarDays data-icon="inline-start" />
              Attendance record
            </a>
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={recordsHref}>
              <History data-icon="inline-start" />
              Scan history
            </a>
          </Button>
        </div>
        {!entry.device ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            <Smartphone className="mt-0.5 size-4" />
            Generate a recovery link to register this staff member&apos;s phone.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
