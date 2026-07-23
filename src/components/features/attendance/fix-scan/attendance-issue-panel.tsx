import { AlertTriangle, CheckCircle2, ClipboardCheck, Smartphone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StaffAvatar,
  formatAttendanceDateTime,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import type { AttendanceIssueAction } from "@/lib/attendance/issue-presentation-types";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

function deviceLabel(row: AttendanceStaffDiagnostic): string {
  if (!row.device || row.device.status === "no_device" || row.device.status === "never_used")
    return "Not connected";
  if (row.device.status === "active")
    return `Connected${row.device.device?.lastSeenAt ? ` · Last used ${formatAttendanceDateTime(row.device.device.lastSeenAt, row.staff.timezone)}` : ""}`;
  if (row.device.status === "recovery_pending") return "Replacement connection pending";
  if (row.device.status === "revoked") return "Disconnected";
  return humanizeAttendanceValue(row.device.status);
}

function metadataText(row: AttendanceStaffDiagnostic, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row.openException?.metadata[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

export function AttendanceIssuePanel({
  data,
  row,
  onAction,
}: {
  data: AttendanceWorkspaceData;
  row: AttendanceStaffDiagnostic;
  onAction: (action: AttendanceIssueAction, row: AttendanceStaffDiagnostic) => void;
}) {
  const issue = row.issue;
  const correction = data.corrections.find((item) => item.staff_id === row.staff.staffId);
  const record =
    data.records.find(
      (item) =>
        item.id === row.staff.attendanceRecordId || item.id === row.openException?.checkin_id
    ) ?? null;
  return (
    <section
      className="overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-white shadow-sm"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--cs-border-soft)] p-4">
        <StaffAvatar name={row.staff.staffName} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{row.staff.staffName}</h2>
          <p className="text-xs capitalize text-[var(--cs-text-muted)]">
            {row.staff.staffType ?? "Staff member"} · {data.branchName}
          </p>
        </div>
        <span className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2.5 py-1 text-xs font-bold">
          {row.statusLabel}
        </span>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-3">
        <Info
          icon={ClipboardCheck}
          label="Attendance state"
          value={humanizeAttendanceValue(row.staff.currentAttendanceState)}
        />
        <Info icon={Smartphone} label="Phone" value={deviceLabel(row)} />
        <Info
          icon={UserRound}
          label="Schedule"
          value={humanizeAttendanceValue(row.staff.scheduleState)}
        />
      </div>
      {issue ? (
        <div className="grid gap-5 border-t border-[var(--cs-border-soft)] p-5">
          <div
            className={`rounded-2xl border p-4 ${issue.severity === "critical" ? "border-red-200 bg-red-50" : issue.severity === "warning" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wide">Current problem</div>
                <h3 className="mt-1 text-lg font-bold">{issue.title}</h3>
                <p className="mt-1 text-sm">{issue.summary}</p>
              </div>
            </div>
          </div>
          {issue.category === "wrong_branch" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Evidence
                label="Assigned branch"
                value={
                  metadataText(
                    row,
                    "assigned_branch_name",
                    "home_branch_name",
                    "expected_branch_name"
                  ) ?? "See branch history"
                }
              />
              <Evidence
                label="Scanned branch"
                value={metadataText(row, "scanned_branch_name") ?? data.branchName}
              />
              <Evidence
                label="Scan time"
                value={
                  row.latestScan
                    ? formatAttendanceDateTime(row.latestScan.created_at, data.timezone)
                    : "Not available"
                }
              />
            </div>
          ) : null}
          {issue.category === "stale_open_attendance" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Evidence
                label="Original clock-in"
                value={
                  record
                    ? formatAttendanceDateTime(record.checked_in_at, data.timezone)
                    : "Review previous record"
                }
              />
              <Evidence
                label="Expected shift"
                value={
                  record?.scheduled_end_at
                    ? `${formatAttendanceDateTime(record.scheduled_start_at, data.timezone)}–${formatAttendanceDateTime(record.scheduled_end_at, data.timezone)}`
                    : "Not available"
                }
              />
              <Evidence
                label="Automated recovery"
                value={
                  record?.provisional_auto_closed_at
                    ? "Already ran"
                    : "No completed recovery recorded"
                }
              />
            </div>
          ) : null}
          {issue.category === "duplicate_scan" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Evidence
                label="Latest scan"
                value={
                  row.latestScan
                    ? formatAttendanceDateTime(row.latestScan.created_at, data.timezone)
                    : "Not available"
                }
              />
              <Evidence
                label="Retry interval"
                value={`${data.settings.duplicate_scan_window_seconds} seconds`}
              />
            </div>
          ) : null}
          <div>
            <h3 className="text-sm font-bold">What happened</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--cs-text-secondary)]">
              {issue.explanation}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold">What to do next</h3>
            <ol className="mt-2 grid gap-2 text-sm text-[var(--cs-text-secondary)]">
              {issue.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--sp-forest)] text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-sm font-bold">Recommended action</h3>
            <Button
              type="button"
              className="mt-2"
              onClick={() => onAction(issue.recommendedAction, row)}
            >
              {issue.recommendedAction.label}
            </Button>
          </div>
          {issue.secondaryActions.length ? (
            <div>
              <h3 className="text-sm font-bold">Other safe actions</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {issue.secondaryActions.map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    variant="outline"
                    onClick={() => onAction(action, row)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <details className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3 text-sm">
            <summary className="cursor-pointer font-bold">Technical details</summary>
            <dl className="mt-3 grid gap-2 text-xs">
              <div>
                <dt className="font-bold">Reason code</dt>
                <dd>{issue.technicalCode ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="font-bold">Latest result</dt>
                <dd>
                  {row.latestScan
                    ? `${row.latestScan.action} · ${row.latestScan.outcome}`
                    : "No scan recorded"}
                </dd>
              </div>
              <div>
                <dt className="font-bold">Exception ID</dt>
                <dd className="break-all">{row.openException?.id ?? "None"}</dd>
              </div>
            </dl>
          </details>
          <details className="rounded-xl border border-[var(--cs-border)] p-3 text-sm">
            <summary className="cursor-pointer font-bold">Audit history</summary>
            <p className="mt-2 text-xs text-[var(--cs-text-secondary)]">
              {correction
                ? `${humanizeAttendanceValue(correction.action_type)} · ${formatAttendanceDateTime(correction.corrected_at, data.timezone)} · ${correction.reason}`
                : "No Attendance correction is recorded for this staff member."}
            </p>
          </details>
        </div>
      ) : (
        <div className="border-t border-[var(--cs-border-soft)] p-5">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 className="size-5" />
            <div>
              <h3 className="font-bold">No current scan problem</h3>
              <p className="text-sm">
                This staff member’s current Attendance state does not need CRM action.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Smartphone;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--cs-surface-warm)] p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-[var(--cs-text-muted)]">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="mt-2 text-sm font-bold capitalize">{value}</div>
    </div>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--cs-border-soft)] p-3">
      <div className="text-xs font-bold text-[var(--cs-text-muted)]">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
