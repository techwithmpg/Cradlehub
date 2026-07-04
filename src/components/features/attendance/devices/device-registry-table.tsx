"use client";

import { MoreHorizontal, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StaffAvatar, formatAttendanceDateTime } from "@/components/features/attendance/attendance-ui";
import { cn } from "@/lib/utils";
import type { AttendanceDeviceRegistryEntry } from "@/lib/attendance/types";

const STATUS_TONES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  never_used: "bg-sky-50 text-sky-700 border-sky-200",
  recovery_pending: "bg-amber-50 text-amber-800 border-amber-200",
  revoked: "bg-red-50 text-red-700 border-red-200",
  no_device: "bg-stone-100 text-stone-600 border-stone-200",
  inactive_staff: "bg-slate-100 text-slate-600 border-slate-200",
};

function statusLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function DeviceRegistryTable({
  entries,
  selectedRowId,
  onSelect,
  onGenerateRecovery,
}: {
  entries: AttendanceDeviceRegistryEntry[];
  selectedRowId: string | null;
  onSelect: (entry: AttendanceDeviceRegistryEntry) => void;
  onGenerateRecovery: (entry: AttendanceDeviceRegistryEntry) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="text-base font-bold text-stone-950">Device Registry</h2>
        <p className="text-xs text-stone-500">Registered phones and browsers authorized for attendance and service scanning.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-stone-50 text-left text-xs font-semibold text-stone-500">
            <tr>
              {["Staff", "Device", "Registered", "Last Used", "Last Scan", "Status", "Actions"].map((heading) => (
                <th key={heading} className="px-4 py-2">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.rowId}
                tabIndex={0}
                className={cn(
                  "cursor-pointer border-t border-stone-100 outline-none transition hover:bg-[#FBF7EF] focus-visible:bg-[#FBF7EF]",
                  selectedRowId === entry.rowId && "bg-[#FBF3E6] shadow-[inset_3px_0_0_#A4743E]"
                )}
                onClick={() => onSelect(entry)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelect(entry);
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <StaffAvatar name={entry.staffName} />
                    <div>
                      <div className="font-semibold text-stone-950">{entry.staffName}</div>
                      <div className="text-xs text-stone-500">{entry.staffType.replaceAll("_", " ")} - {entry.homeBranchName}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {entry.device ? (
                    <div className="flex items-center gap-2">
                      <Smartphone className="size-4 text-stone-500" />
                      <div>
                        <div className="font-semibold text-stone-900">{entry.device.label}</div>
                        <div className="text-xs text-stone-500">
                          {[entry.device.browserName, entry.device.platformName].filter(Boolean).join(" - ") || "Browser device"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-stone-400">No registered device</span>
                  )}
                </td>
                <td className="px-4 py-3">{formatAttendanceDateTime(entry.device?.registeredAt)}</td>
                <td className="px-4 py-3">{formatAttendanceDateTime(entry.device?.lastSeenAt)}</td>
                <td className="px-4 py-3">{formatAttendanceDateTime(entry.device?.lastScanAt)}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn("capitalize", STATUS_TONES[entry.status])}>
                    {statusLabel(entry.status)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {entry.device ? (
                    <Button type="button" variant="outline" size="icon-sm" aria-label={`Open ${entry.staffName}'s device details`}>
                      <MoreHorizontal />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onGenerateRecovery(entry);
                      }}
                    >
                      Create link
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-stone-200 px-4 py-3 text-xs text-stone-500">
        Showing {entries.length} staff/device row{entries.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
