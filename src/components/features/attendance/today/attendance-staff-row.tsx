import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  StaffAvatar,
  formatAttendanceDateTime,
} from "@/components/features/attendance/attendance-ui";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import { cn } from "@/lib/utils";

function tone(row: AttendanceStaffDiagnostic): string {
  if (row.needsHelp) return "border-red-200 bg-red-50 text-red-700";
  if (row.working) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (row.checkedOut) return "border-blue-200 bg-blue-50 text-blue-700";
  if (row.notScannedIn) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)]";
}

function shortTime(value: string | null, timezone: string): string {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
}

function schedule(row: AttendanceStaffDiagnostic): string {
  const window =
    row.staff.currentShiftWindow ?? row.staff.nextShiftWindow ?? row.staff.shiftWindows[0];
  return window
    ? `${shortTime(window.scheduledStartAt, row.staff.timezone)}–${shortTime(window.scheduledEndAt, row.staff.timezone)}`
    : "—";
}

export function AttendanceStaffRow({
  row,
  onOpen,
  onOpenHistory,
  onOpenPhone,
}: {
  row: AttendanceStaffDiagnostic;
  onOpen: (row: AttendanceStaffDiagnostic) => void;
  onOpenHistory: (row: AttendanceStaffDiagnostic) => void;
  onOpenPhone: (row: AttendanceStaffDiagnostic) => void;
}) {
  const actionLabel = row.needsHelp ? "Fix Now" : "View";
  return (
    <div
      role="row"
      className="grid grid-cols-[minmax(190px,1.25fr)_minmax(135px,.85fr)_minmax(125px,.8fr)_100px_100px_minmax(130px,.8fr)_100px_40px] items-center gap-3 border-t border-[var(--cs-border-soft)] px-4 py-3 first:border-t-0"
    >
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <StaffAvatar name={row.staff.staffName} />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-[var(--cs-text)]">
            {row.staff.staffName}
          </div>
          <div className="truncate text-xs capitalize text-[var(--cs-text-muted)]">
            {row.staff.staffType ?? "Staff member"}
          </div>
        </div>
      </div>
      <div role="cell" className="text-sm font-semibold text-[var(--cs-text-secondary)]">
        {schedule(row)}
      </div>
      <div role="cell">
        <span
          className={cn("inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold", tone(row))}
        >
          {row.statusLabel}
        </span>
      </div>
      <div role="cell" className="text-sm font-semibold">
        {shortTime(row.staff.clockInAt, row.staff.timezone)}
      </div>
      <div role="cell" className="text-sm font-semibold">
        {shortTime(row.staff.clockOutAt, row.staff.timezone)}
      </div>
      <div role="cell" className="text-sm">
        <div className="font-semibold text-[var(--cs-text)]">
          {row.latestScan
            ? formatAttendanceDateTime(row.latestScan.created_at, row.staff.timezone)
            : "—"}
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--cs-text-muted)]">
          {row.latestScan?.point_label ?? "No scan today"}
        </div>
      </div>
      <div role="cell">
        <Button
          type="button"
          size="sm"
          variant={row.needsHelp ? "default" : "outline"}
          onClick={() => onOpen(row)}
          aria-label={`${actionLabel} for ${row.staff.staffName}`}
          className="min-h-9 w-full"
        >
          {actionLabel}
        </Button>
      </div>
      <div role="cell">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`More Attendance actions for ${row.staff.staffName}`}
              />
            }
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => onOpen(row)}>View today’s details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenHistory(row)}>
              Attendance history
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenPhone(row)}>Manage phone</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
