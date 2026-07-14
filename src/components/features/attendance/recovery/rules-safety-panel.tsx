"use client";

import { AlertTriangle, Clock3, FlaskConical, QrCode, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/features/attendance/attendance-ui";
import type { AttendanceSettings, AttendanceWorkspaceData } from "@/lib/attendance/types";

export function RulesSafetyPanel({
  isPending,
  onArchiveTestData,
  onSaveRules,
  rules,
  rulesReason,
  setRules,
  setRulesReason,
}: {
  data: AttendanceWorkspaceData;
  isPending: boolean;
  onArchiveTestData: () => void;
  onSaveRules: () => void;
  rules: AttendanceSettings;
  rulesReason: string;
  setRules: (settings: AttendanceSettings) => void;
  setRulesReason: (value: string) => void;
}) {
  return (
    <section className="grid gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-foreground">Rules & Safety</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage training data safety and inspect the fixed operational policy.
        </p>
      </div>

      {rules.test_mode_enabled ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-4" />
            Test / Training Mode Enabled
          </div>
          <p className="mt-1 text-sm">
            New scans should be treated as training data and excluded from live operational reports.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SafetyCard icon={<ShieldCheck className="size-5" />} title="System Mode">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusPill value={rules.test_mode_enabled ? "test mode" : "live mode"} tone={rules.test_mode_enabled ? "warn" : "good"} />
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={rules.test_mode_enabled}
                onChange={(event) =>
                  setRules({
                    ...rules,
                    test_mode_enabled: event.target.checked,
                  })
                }
                className="size-4"
              />
              Test / Training Mode
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            Live mode affects attendance records, room countdowns, reports, payroll, and owner summaries.
          </p>
        </SafetyCard>

        <SafetyCard icon={<QrCode className="size-5" />} title="QR Routing">
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p className="m-0">Attendance QR = clock-in / clock-out only.</p>
            <p className="m-0">Room QR = service countdown only.</p>
            <p className="m-0">Room QR requires the staff member to already be clocked in.</p>
          </div>
        </SafetyCard>

        <SafetyCard icon={<Clock3 className="size-5" />} title="Scan Timing Rules">
          <div className="grid gap-2 sm:grid-cols-2">
            <RuleMini label="Late grace" value={`${rules.late_grace_minutes} min`} />
            <RuleMini label="Duplicate protection" value={`${rules.duplicate_scan_debounce_minutes} min`} />
            <RuleMini label="Clock-in before shift" value={`${rules.clock_in_window_before_shift_minutes} min`} />
            <RuleMini label="Clock-out after end" value={`${rules.clock_out_window_after_shift_end_minutes} min`} />
          </div>
        </SafetyCard>

        <SafetyCard icon={<Wrench className="size-5" />} title="Fixed Scan Policy">
          <p className="text-sm text-muted-foreground">
            Valid ordinary scans record attendance and flag uncertainty. A sole open record is always closed by the next valid scan. First scans near expected closing are captured for review without inventing time.
          </p>
          <StatusPill value="Record first · Review uncertainty" tone="good" />
        </SafetyCard>
      </div>

      <label className="grid gap-1 text-sm font-semibold">
        Reason for mode or rule change
        <textarea
          value={rulesReason}
          onChange={(event) => {
            const value = event.target.value;
            setRulesReason(value);
            setRules({
              ...rules,
              test_mode_reason: value,
              launch_recovery_reason: value,
            });
          }}
          className="min-h-20 rounded-2xl border border-border bg-card p-3 text-sm font-normal outline-none focus:border-primary"
          placeholder="Example: Staff training before live launch."
        />
      </label>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" disabled={isPending} onClick={onArchiveTestData}>
          <FlaskConical className="mr-2 size-4" />
          Archive Test Data
        </Button>
        <Button type="button" disabled={isPending} onClick={onSaveRules}>
          Save Rules
        </Button>
      </div>
    </section>
  );
}

function SafetyCard({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-3 rounded-3xl border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function RuleMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-bold text-foreground">{value}</div>
    </div>
  );
}
