"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock3, History, RotateCcw, Settings2, TableProperties, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  Panel,
  StatusPill,
  formatAttendanceDate,
  formatAttendanceDateTime,
  formatMinutesCompact,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import {
  applyAttendanceCorrectionAction,
  resolveAttendanceExceptionAction,
  updateAttendanceRulesAction,
  type AttendanceActionResult,
} from "@/app/(dashboard)/crm/attendance/actions";
import type {
  AttendanceException,
  AttendanceRecord,
  AttendanceSettings,
  AttendanceTab,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

type RecoveryView = "today" | "records" | "rules" | "audit";

const VIEWS: Array<{ key: RecoveryView; label: string }> = [
  { key: "today", label: "Today Recovery" },
  { key: "records", label: "Staff Records" },
  { key: "rules", label: "Rules" },
  { key: "audit", label: "Audit Log" },
];

const RECOVERY_EXCEPTION_TYPES = new Set([
  "likely_closing_scan_without_clock_in",
  "missing_schedule",
  "off_day_exception",
  "ambiguous_scan",
  "early_clock_in",
  "late_clock_in",
  "early_clock_out",
  "overtime_clock_out",
]);

function isRecoveryException(exception: AttendanceException): boolean {
  return exception.status === "open" && RECOVERY_EXCEPTION_TYPES.has(exception.exception_type);
}

function isRecordNeedingAttention(record: AttendanceRecord): boolean {
  return (
    record.status === "checked_in" ||
    record.exception_state === "open" ||
    record.attendance_status !== "present"
  );
}

function numericInputValue(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function updateNumberSetting(
  settings: AttendanceSettings,
  key: keyof AttendanceSettings,
  value: string
): AttendanceSettings {
  const parsed = Number(value);
  return {
    ...settings,
    [key]: Number.isFinite(parsed) ? parsed : 0,
  };
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

export function AttendanceRecoveryTab({
  data,
  onActionResult,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  onActionResult: (result: AttendanceActionResult) => void;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const [view, setView] = useState<RecoveryView>("today");
  const [rules, setRules] = useState<AttendanceSettings>(data.settings);
  const [reason, setReason] = useState("Attendance recovery correction.");
  const [isPending, startTransition] = useTransition();

  const recoveryExceptions = useMemo(
    () => data.exceptions.filter(isRecoveryException),
    [data.exceptions]
  );
  const openExceptions = useMemo(
    () => data.exceptions.filter((exception) => exception.status === "open"),
    [data.exceptions]
  );
  const recordsNeedingAttention = useMemo(
    () => data.records.filter(isRecordNeedingAttention).slice(0, 40),
    [data.records]
  );
  const closingRecoveryCount = recoveryExceptions.filter(
    (exception) => exception.exception_type === "likely_closing_scan_without_clock_in"
  ).length;

  function resolveException(exception: AttendanceException) {
    const formData = new FormData();
    formData.set("exceptionId", exception.id);
    formData.set("resolutionNote", reason);
    startTransition(async () => {
      onActionResult(await resolveAttendanceExceptionAction(formData));
    });
  }

  function applyLaunchRecovery(exception: AttendanceException) {
    startTransition(async () => {
      onActionResult(
        await applyAttendanceCorrectionAction({
          branchId: data.branchId,
          actionType: "apply_launch_recovery",
          exceptionId: exception.id,
          reason,
        })
      );
    });
  }

  function applyManualClockOut(record: AttendanceRecord) {
    startTransition(async () => {
      onActionResult(
        await applyAttendanceCorrectionAction({
          branchId: data.branchId,
          actionType: "set_manual_clock_out",
          checkinId: record.id,
          reason,
        })
      );
    });
  }

  function resetStaffDay(record: AttendanceRecord) {
    startTransition(async () => {
      onActionResult(
        await applyAttendanceCorrectionAction({
          branchId: data.branchId,
          actionType: "reset_staff_day",
          staffId: record.staff_id,
          attendanceDate: record.shift_date,
          reason,
        })
      );
    });
  }

  function saveRules() {
    startTransition(async () => {
      const result = await updateAttendanceRulesAction({
        branchId: data.branchId,
        settings: rules,
        reason: rules.launch_recovery_reason || "Attendance rules updated.",
      });
      onActionResult(result);
      if (result.ok && result.kind === "attendance_rules") {
        setRules(result.settings);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <Panel title="Recovery Center">
        <div className="grid gap-3 lg:grid-cols-4">
          <SummaryTile label="Open Recovery" value={recoveryExceptions.length} />
          <SummaryTile label="Closing Suspects" value={closingRecoveryCount} />
          <SummaryTile label="Open Exceptions" value={openExceptions.length} />
          <SummaryTile label="Audit Entries" value={data.corrections.length} />
        </div>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((item) => (
            <Button
              key={item.key}
              type="button"
              variant={view === item.key ? "default" : "outline"}
              size="sm"
              onClick={() => setView(item.key)}
            >
              {item.key === "today" ? <Wrench data-icon="inline-start" /> : null}
              {item.key === "records" ? <TableProperties data-icon="inline-start" /> : null}
              {item.key === "rules" ? <Settings2 data-icon="inline-start" /> : null}
              {item.key === "audit" ? <History data-icon="inline-start" /> : null}
              {item.label}
            </Button>
          ))}
        </div>
      </Panel>

      {view === "today" ? (
        <Panel title={`Today Recovery (${recoveryExceptions.length})`}>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-semibold">
              Correction reason
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            {recoveryExceptions.length === 0 ? (
              <EmptyState title="No recovery items are open." detail="Closing scans, missing schedules, and ambiguous scans will appear here." />
            ) : (
              recoveryExceptions.map((exception) => (
                <div key={exception.id} className="grid gap-3 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold">{exception.staff_name ?? "Unassigned staff"}</div>
                      <div className="text-xs text-muted-foreground">
                        {humanizeAttendanceValue(exception.exception_type)} · {formatAttendanceDateTime(exception.detected_at)}
                      </div>
                    </div>
                    <StatusPill value={exception.severity} tone={exception.severity === "critical" ? "bad" : "warn"} />
                  </div>
                  <p className="m-0 text-sm text-muted-foreground">{exception.message}</p>
                  <div className="flex flex-wrap gap-2">
                    {exception.exception_type === "likely_closing_scan_without_clock_in" ? (
                      <Button type="button" size="sm" disabled={isPending} onClick={() => applyLaunchRecovery(exception)}>
                        <CheckCircle2 data-icon="inline-start" />
                        Apply Recovery
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => resolveException(exception)}>
                      <CheckCircle2 data-icon="inline-start" />
                      Mark Reviewed
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("records")}>
                      <TableProperties data-icon="inline-start" />
                      Records
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      ) : null}

      {view === "records" ? (
        <Panel title={`Staff Records (${recordsNeedingAttention.length})`}>
          {recordsNeedingAttention.length === 0 ? (
            <EmptyState title="No staff records need recovery." detail="Records with open exceptions, active check-ins, or non-present status appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-sm">
                <thead>
                  <tr className="border-b bg-stone-50 text-left text-xs text-muted-foreground">
                    {["Date", "Staff", "Schedule", "In", "Out", "Worked", "Status", "Actions"].map((heading) => (
                      <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recordsNeedingAttention.map((record) => (
                    <tr key={record.id} className="border-b last:border-b-0">
                      <td className="px-3 py-3">{formatAttendanceDate(record.shift_date)}</td>
                      <td className="px-3 py-3 font-semibold">{record.staff_name}</td>
                      <td className="px-3 py-3 capitalize">{record.shift_type}</td>
                      <td className="px-3 py-3">{formatAttendanceDateTime(record.checked_in_at)}</td>
                      <td className="px-3 py-3">{formatAttendanceDateTime(record.checked_out_at)}</td>
                      <td className="px-3 py-3">{formatMinutesCompact(record.worked_minutes)}</td>
                      <td className="px-3 py-3"><StatusPill value={record.attendance_status} /></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {record.status === "checked_in" ? (
                            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => applyManualClockOut(record)}>
                              <Clock3 data-icon="inline-start" />
                              Clock Out
                            </Button>
                          ) : null}
                          <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => resetStaffDay(record)}>
                            <RotateCcw data-icon="inline-start" />
                            Reset Day
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {view === "rules" ? (
        <Panel title="Attendance Rules">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Late grace minutes
              <input
                type="number"
                min="0"
                value={numericInputValue(rules.late_grace_minutes)}
                onChange={(event) => setRules((current) => updateNumberSetting(current, "late_grace_minutes", event.target.value))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Duplicate debounce minutes
              <input
                type="number"
                min="1"
                value={numericInputValue(rules.duplicate_scan_debounce_minutes)}
                onChange={(event) => setRules((current) => updateNumberSetting(current, "duplicate_scan_debounce_minutes", event.target.value))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Clock-in window before shift
              <input
                type="number"
                min="0"
                value={numericInputValue(rules.clock_in_window_before_shift_minutes)}
                onChange={(event) => setRules((current) => updateNumberSetting(current, "clock_in_window_before_shift_minutes", event.target.value))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Clock-in window after start
              <input
                type="number"
                min="0"
                value={numericInputValue(rules.clock_in_window_after_shift_start_minutes)}
                onChange={(event) => setRules((current) => updateNumberSetting(current, "clock_in_window_after_shift_start_minutes", event.target.value))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Clock-out window before end
              <input
                type="number"
                min="0"
                value={numericInputValue(rules.clock_out_window_before_shift_end_minutes)}
                onChange={(event) => setRules((current) => updateNumberSetting(current, "clock_out_window_before_shift_end_minutes", event.target.value))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Clock-out window after end
              <input
                type="number"
                min="0"
                value={numericInputValue(rules.clock_out_window_after_shift_end_minutes)}
                onChange={(event) => setRules((current) => updateNumberSetting(current, "clock_out_window_after_shift_end_minutes", event.target.value))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              First closing scan behavior
              <select
                value={rules.first_scan_closing_behavior}
                onChange={(event) => setRules((current) => ({ ...current, first_scan_closing_behavior: event.target.value as AttendanceSettings["first_scan_closing_behavior"] }))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              >
                <option value="flag_for_recovery">Flag for recovery</option>
                <option value="treat_as_clock_out_launch_only">Treat as clock-out during launch</option>
                <option value="require_manager_confirmation">Require manager confirmation</option>
                <option value="never_auto_clock_in">Never auto clock-in</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={rules.launch_recovery_enabled}
                onChange={(event) => setRules((current) => ({ ...current, launch_recovery_enabled: event.target.checked }))}
                className="size-4"
              />
              Launch recovery mode
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Launch start date
              <input
                type="date"
                value={rules.launch_recovery_start_date ?? ""}
                onChange={(event) => setRules((current) => ({ ...current, launch_recovery_start_date: event.target.value || null }))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Launch end date
              <input
                type="date"
                value={rules.launch_recovery_end_date ?? ""}
                onChange={(event) => setRules((current) => ({ ...current, launch_recovery_end_date: event.target.value || null }))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Closing start time
              <input
                type="time"
                value={rules.launch_recovery_closing_start_time.slice(0, 5)}
                onChange={(event) => setRules((current) => ({ ...current, launch_recovery_closing_start_time: `${event.target.value}:00` }))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Closing end time
              <input
                type="time"
                value={rules.launch_recovery_closing_end_time.slice(0, 5)}
                onChange={(event) => setRules((current) => ({ ...current, launch_recovery_closing_end_time: `${event.target.value}:00` }))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold lg:col-span-2">
              Rule change reason
              <textarea
                value={rules.launch_recovery_reason ?? ""}
                onChange={(event) => setRules((current) => ({ ...current, launch_recovery_reason: event.target.value }))}
                className="min-h-20 rounded-lg border border-border bg-background p-3 text-sm font-normal outline-none"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <Button type="button" disabled={isPending} onClick={saveRules}>
              <Settings2 data-icon="inline-start" />
              Save Rules
            </Button>
          </div>
        </Panel>
      ) : null}

      {view === "audit" ? (
        <Panel title={`Audit Log (${data.corrections.length})`}>
          {data.corrections.length === 0 ? (
            <EmptyState title="No attendance corrections yet." detail="Applied corrections and rule changes will appear here." />
          ) : (
            <div className="grid gap-3">
              {data.corrections.map((correction) => (
                <div key={correction.id} className="grid gap-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold">{humanizeAttendanceValue(correction.action_type)}</div>
                      <div className="text-xs text-muted-foreground">
                        {correction.staff_name ?? data.branchName} · {formatAttendanceDateTime(correction.corrected_at ?? correction.created_at)}
                      </div>
                    </div>
                    <StatusPill value={correction.status} />
                  </div>
                  <p className="m-0 text-sm text-muted-foreground">{correction.reason}</p>
                  {correction.attendance_date ? (
                    <div className="text-xs font-semibold text-muted-foreground">{formatAttendanceDate(correction.attendance_date)}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
