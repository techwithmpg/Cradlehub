"use client";

import { CalendarClock, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  StaffAvatar,
  formatAttendanceDateTime,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import { presentAttendanceScanEvent } from "@/lib/attendance/scan-event-presentation";
import type { AttendanceIssueAction } from "@/lib/attendance/issue-presentation-types";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

const normalActions: AttendanceIssueAction[] = [
  { id: "view_attendance_history", label: "View Attendance History" },
  { id: "manage_phone", label: "Manage Phone" },
  { id: "correct_today_attendance", label: "Correct Today’s Attendance" },
];

function time(value: string | null, timezone: string): string {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function schedule(row: AttendanceStaffDiagnostic): string {
  const window =
    row.staff.currentShiftWindow ?? row.staff.nextShiftWindow ?? row.staff.shiftWindows[0];
  return window
    ? `${time(window.scheduledStartAt, row.staff.timezone)}–${time(window.scheduledEndAt, row.staff.timezone)}`
    : humanizeAttendanceValue(row.staff.scheduleState);
}

function phone(row: AttendanceStaffDiagnostic): string {
  if (row.device?.status === "active")
    return `Connected${row.device.device?.lastSeenAt ? ` · Last used ${formatAttendanceDateTime(row.device.device.lastSeenAt, row.staff.timezone)}` : ""}`;
  if (row.device?.status === "recovery_pending") return "Replacement connection pending";
  if (row.device?.status === "revoked") return "Disconnected";
  return "Not connected";
}

export function AttendanceStaffDrawer({
  data,
  row,
  onClose,
  onAction,
}: {
  data: AttendanceWorkspaceData;
  row: AttendanceStaffDiagnostic | null;
  onClose: () => void;
  onAction: (action: AttendanceIssueAction, row: AttendanceStaffDiagnostic) => void;
}) {
  const issue = row?.issue ?? null;
  const event = row?.latestScan ? presentAttendanceScanEvent(row.latestScan) : null;
  const actions = issue ? [issue.recommendedAction, ...issue.secondaryActions] : normalActions;
  return (
    <Sheet
      open={Boolean(row)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto bg-[var(--cs-surface)] p-0 sm:max-w-lg"
      >
        {row ? (
          <>
            <SheetHeader className="border-b border-[var(--cs-border-soft)] p-5 pr-14">
              <div className="flex items-center gap-3">
                <StaffAvatar name={row.staff.staffName} />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-lg font-bold">
                    {row.staff.staffName}
                  </SheetTitle>
                  <SheetDescription className="capitalize">
                    {row.staff.staffType ?? "Staff member"} · {data.branchName}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="grid gap-5 p-5">
              <div
                className={`rounded-2xl border p-4 ${issue ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
              >
                <div className="flex items-start gap-3">
                  {issue ? (
                    <Smartphone className="mt-0.5 size-5" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" />
                  )}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide">
                      {issue ? "Current problem" : "Today’s status"}
                    </div>
                    <div className="mt-1 text-lg font-bold">
                      {issue?.title ??
                        (row.staff.clockInAt
                          ? `Working since ${time(row.staff.clockInAt, row.staff.timezone)}`
                          : row.statusLabel)}
                    </div>
                    <p className="mt-1 text-sm">
                      {issue?.summary ?? "Attendance is operating normally for this staff member."}
                    </p>
                  </div>
                </div>
              </div>
              <dl className="grid gap-3">
                <Detail icon={CalendarClock} label="Schedule" value={schedule(row)} />
                <Detail icon={Smartphone} label="Phone" value={phone(row)} />
                <Detail
                  icon={CheckCircle2}
                  label="Recent scan"
                  value={
                    row.latestScan && event
                      ? `${formatAttendanceDateTime(row.latestScan.created_at, data.timezone)} — ${event.label}`
                      : "No recent scan"
                  }
                />
              </dl>
              {issue ? (
                <div>
                  <h3 className="text-sm font-bold">Recommended next step</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--cs-text-secondary)]">
                    {issue.steps[0]}
                  </p>
                  <ol className="mt-3 grid gap-2">
                    {issue.steps.map((step, index) => (
                      <li key={step} className="flex gap-2 text-sm">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--sp-forest)] text-[0.65rem] font-bold text-white">
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="grid gap-2">
                {actions.slice(0, 4).map((action, index) => (
                  <Button
                    key={`${action.id}-${index}`}
                    type="button"
                    variant={index === 0 ? "default" : "outline"}
                    onClick={() => onAction(action, row)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
              <details className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3 text-sm">
                <summary className="cursor-pointer font-bold">Technical details</summary>
                <div className="mt-2 grid gap-1 break-words text-xs text-[var(--cs-text-secondary)]">
                  <div>Status: {row.staff.operationalStatus}</div>
                  <div>Schedule: {row.staff.scheduleState}</div>
                  <div>Phone: {row.device?.status ?? "no_device"}</div>
                  <div>Reason: {issue?.technicalCode ?? "none"}</div>
                </div>
              </details>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Smartphone;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-xl border border-[var(--cs-border-soft)] p-3">
      <span className="flex size-8 items-center justify-center rounded-full bg-[var(--cs-surface-warm)]">
        <Icon className="size-4" />
      </span>
      <div>
        <dt className="text-xs font-bold text-[var(--cs-text-muted)]">{label}</dt>
        <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
      </div>
    </div>
  );
}
