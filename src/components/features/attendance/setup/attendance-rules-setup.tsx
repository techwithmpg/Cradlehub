"use client";

import { useState, useTransition } from "react";
import { Clock3, ShieldCheck, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { updateAttendanceRulesAction } from "@/app/(dashboard)/crm/attendance/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AttendanceSettings, AttendanceWorkspaceData } from "@/lib/attendance/types";

type EditableRules = Pick<
  AttendanceSettings,
  | "late_grace_minutes"
  | "early_clock_in_allowed_minutes"
  | "duplicate_scan_debounce_minutes"
  | "active_service_blocks_clock_out"
  | "require_registered_device_for_attendance"
>;

export function AttendanceRulesSetup({
  data,
  onRefresh,
}: {
  data: AttendanceWorkspaceData;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<EditableRules>({
    late_grace_minutes: data.settings.late_grace_minutes,
    early_clock_in_allowed_minutes: data.settings.early_clock_in_allowed_minutes,
    duplicate_scan_debounce_minutes: data.settings.duplicate_scan_debounce_minutes,
    active_service_blocks_clock_out: data.settings.active_service_blocks_clock_out,
    require_registered_device_for_attendance:
      data.settings.require_registered_device_for_attendance,
  });
  const [reason, setReason] = useState("Updated Attendance rules");
  const [pending, startTransition] = useTransition();
  function save() {
    startTransition(async () => {
      const result = await updateAttendanceRulesAction({
        branchId: data.branchId,
        settings: rules,
        reason,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      onRefresh();
    });
  }
  return (
    <>
      <section className="rounded-xl border border-[var(--cs-border)] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-sand-dark)]">
              Current policy
            </p>
            <h2 className="mt-1 text-lg font-bold">Attendance rules</h2>
            <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
              Plain-language rules applied to clock-in, clock-out, and phone scans.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>Edit rules</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Rule
            icon={Clock3}
            title="Arrival window"
            detail={`Clock in up to ${data.settings.early_clock_in_allowed_minutes} minutes early. Late after ${data.settings.late_grace_minutes} minutes.`}
          />
          <Rule
            icon={TimerReset}
            title="Duplicate scans"
            detail={`Repeated scans inside ${data.settings.duplicate_scan_debounce_minutes} minutes are treated as one action.`}
          />
          <Rule
            icon={ShieldCheck}
            title="Clock-out safety"
            detail={
              data.settings.active_service_blocks_clock_out
                ? "Active service sessions must finish before clock-out."
                : "Active service sessions do not block clock-out."
            }
          />
        </div>
        <details className="mt-4 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-4">
          <summary className="cursor-pointer text-sm font-bold">Advanced policy details</summary>
          <dl className="mt-3 grid gap-2 text-xs text-[var(--cs-text-muted)] sm:grid-cols-2">
            <div>Timezone: {data.settings.timezone}</div>
            <div>Attendance day boundary: {data.settings.attendance_day_boundary}</div>
            <div>Early-leave threshold: {data.settings.early_leave_threshold_minutes} minutes</div>
            <div>Overtime threshold: {data.settings.overtime_threshold_minutes} minutes</div>
            <div>
              Missing schedule: {data.settings.missing_schedule_behavior.replaceAll("_", " ")}
            </div>
            <div>Off-day scan: {data.settings.off_day_scan_behavior.replaceAll("_", " ")}</div>
          </dl>
        </details>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Attendance rules</DialogTitle>
            <DialogDescription>
              Changes take effect for future scans and are recorded in the rules audit.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberRule
              id="early-minutes"
              label="Early clock-in"
              value={rules.early_clock_in_allowed_minutes}
              onChange={(value) => setRules({ ...rules, early_clock_in_allowed_minutes: value })}
            />
            <NumberRule
              id="late-minutes"
              label="Late grace"
              value={rules.late_grace_minutes}
              onChange={(value) => setRules({ ...rules, late_grace_minutes: value })}
            />
            <NumberRule
              id="duplicate-minutes"
              label="Duplicate window"
              value={rules.duplicate_scan_debounce_minutes}
              onChange={(value) => setRules({ ...rules, duplicate_scan_debounce_minutes: value })}
            />
          </div>
          <Toggle
            label="Block clock-out during service"
            checked={rules.active_service_blocks_clock_out}
            onChange={(checked) => setRules({ ...rules, active_service_blocks_clock_out: checked })}
          />
          <Toggle
            label="Require a registered phone"
            checked={rules.require_registered_device_for_attendance}
            onChange={(checked) =>
              setRules({ ...rules, require_registered_device_for_attendance: checked })
            }
          />
          <div>
            <Label htmlFor="rules-reason">Reason for change</Label>
            <Input
              id="rules-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || reason.trim().length < 3}>
              {pending ? "Saving…" : "Save rules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Rule({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Clock3;
  title: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-[var(--cs-border-soft)] p-4">
      <span className="flex size-9 items-center justify-center rounded-full bg-[var(--cs-surface-warm)] text-[var(--cs-crm-text)]">
        <Icon className="size-4" />
      </span>
      <h3 className="mt-3 text-sm font-bold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[var(--cs-text-muted)]">{detail}</p>
    </article>
  );
}
function NumberRule({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label} (min)</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={240}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border p-3 text-sm font-semibold">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
