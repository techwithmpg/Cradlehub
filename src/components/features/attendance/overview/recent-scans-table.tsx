import { AlertCircle, CheckCircle2, Clock3, LogIn, LogOut, ScanLine } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  Panel,
  StaffAvatar,
  StatusPill,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import type {
  AttendanceScanEvent,
  AttendanceTab,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function scanIcon(event: AttendanceScanEvent): ComponentType<{ className?: string }> {
  if (event.action.includes("clock_out")) return LogOut;
  if (event.action.includes("clock_in")) return LogIn;
  if (event.outcome === "success") return CheckCircle2;
  if (event.outcome === "exception" || event.outcome === "noop") return Clock3;
  return AlertCircle;
}

function scanResult(event: AttendanceScanEvent): {
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
} {
  if (event.outcome === "success") return { label: "Confirmed", tone: "good" };
  if (event.outcome === "exception" || event.outcome === "noop") {
    return { label: "Received", tone: "warn" };
  }
  if (event.outcome === "blocked" || event.outcome === "error") {
    return { label: "Needs review", tone: "bad" };
  }
  return { label: humanizeAttendanceValue(event.outcome), tone: "neutral" };
}

export function RecentScansTable({
  data,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const events = data.scanEvents.slice(0, 7);

  return (
    <Panel
      title="Recent scans"
      description="Latest attendance and operational scan activity"
      action={
        <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("records")}>
          View all
        </Button>
      }
      className="min-w-0"
    >
      {events.length === 0 ? (
        <EmptyState
          title="No scans yet"
          detail="Attendance scans will appear here as soon as staff use the branch QR."
          icon={<ScanLine className="size-5" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="bg-[var(--cs-surface-warm)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
              <tr>
                <th className="rounded-l-[var(--cs-r-sm)] px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Staff</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Result</th>
                <th className="rounded-r-[var(--cs-r-sm)] px-3 py-2.5">Point</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const Icon = scanIcon(event);
                const result = scanResult(event);
                const displayName = event.staff_name ?? "Unknown device";
                return (
                  <tr
                    key={event.id}
                    className="border-b border-[var(--cs-border-soft)] last:border-b-0"
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-[var(--cs-text-secondary)]">
                      {formatTime(event.created_at, data.timezone)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <StaffAvatar name={displayName} />
                        <span className="truncate font-semibold text-[var(--cs-text)]">
                          {displayName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 text-[var(--cs-text-secondary)]">
                        <Icon className="size-4 text-[var(--cs-text-muted)]" />
                        <span className="capitalize">{humanizeAttendanceValue(event.action)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill value={result.label} tone={result.tone} />
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-[var(--cs-text-secondary)]">
                      {event.point_label ?? data.branchName}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
