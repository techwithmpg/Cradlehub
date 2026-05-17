"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Coffee,
  Save,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { upsertSchedulingRulesAction } from "@/app/(dashboard)/manager/scheduling/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SchedulingRulesUpsertInput } from "@/lib/scheduling/schemas";
import type { SchedulingRules } from "@/lib/scheduling/types";
import { InlineSwitch } from "./setting-controls";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SchedulingAutomationTab({ rules }: { rules: SchedulingRules }) {
  const router = useRouter();
  const [form, setForm] = useState<SchedulingRulesUpsertInput>({
    min_daily_staff: rules.min_daily_staff,
    min_daily_therapists: rules.min_daily_therapists,
    min_daily_csr: rules.min_daily_csr,
    min_daily_drivers: rules.min_daily_drivers,
    min_daily_utility: rules.min_daily_utility,
    default_days_off_per_week: rules.default_days_off_per_week,
    max_same_role_off_per_day: rules.max_same_role_off_per_day,
    max_therapists_off_per_day: rules.max_therapists_off_per_day,
    protect_weekends: rules.protect_weekends,
    default_break_minutes: rules.default_break_minutes,
    auto_breaks_enabled: rules.auto_breaks_enabled,
    max_working_hours_per_day: rules.max_working_hours_per_day,
    max_services_per_staff_per_day: rules.max_services_per_staff_per_day,
    auto_generate_breaks: rules.auto_generate_breaks,
    auto_generate_travel_buffers: rules.auto_generate_travel_buffers,
    auto_generate_room_reset_buffers: rules.auto_generate_room_reset_buffers,
    room_reset_buffer_minutes: rules.room_reset_buffer_minutes,
    home_service_travel_buffer_minutes:
      rules.home_service_travel_buffer_minutes,
    suggestions_require_manager_approval:
      rules.suggestions_require_manager_approval,
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function patch<K extends keyof SchedulingRulesUpsertInput>(
    key: K,
    value: SchedulingRulesUpsertInput[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    setStatus("saving");
    setErrorMsg(null);
    startTransition(() => {
      void (async () => {
        const result = await upsertSchedulingRulesAction(form);
        if (result.success) {
          setStatus("saved");
          router.refresh();
          window.setTimeout(() => setStatus("idle"), 2200);
          return;
        }

        setStatus("error");
        setErrorMsg(result.error ?? "Save failed");
      })();
    });
  }

  const autoBlockingCount = [
    form.auto_generate_breaks,
    form.auto_generate_travel_buffers,
    form.auto_generate_room_reset_buffers,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--cs-text)]">
            Scheduling Automation
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--cs-text-secondary)]">
            Group the automation rules by the way managers think about daily
            staffing, time off, breaks, and safety buffers.
          </p>
        </div>
        <Button
          type="button"
          disabled={isPending}
          className="w-full bg-[var(--cs-sand)] text-white hover:bg-[var(--cs-sand-dark)] md:w-auto"
          onClick={handleSave}
        >
          <Save className="size-4" aria-hidden="true" />
          {status === "saving" ? "Saving..." : "Save Scheduling Rules"}
        </Button>
      </div>

      {errorMsg ? (
        <Alert
          variant="destructive"
          className="border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)]"
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>Could not save scheduling rules</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      ) : null}

      {status === "saved" ? (
        <Alert className="border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <AlertTitle>Scheduling rules saved</AlertTitle>
          <AlertDescription className="text-[var(--cs-success-text)]/80">
            The manager dashboard and settings page have been refreshed.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        <RuleGroup
          icon={UsersRound}
          title="Daily Coverage"
          summary={`Total ${form.min_daily_staff} staff`}
          description="Set minimum staff levels the system tries to maintain each day."
        >
          <RuleGrid>
            <NumberField
              label="Total staff"
              value={form.min_daily_staff}
              min={0}
              max={50}
              onChange={(value) => patch("min_daily_staff", value ?? 0)}
            />
            <NumberField
              label="Therapists"
              value={form.min_daily_therapists}
              min={0}
              max={50}
              onChange={(value) =>
                patch("min_daily_therapists", value ?? 0)
              }
            />
            <NumberField
              label="CSR / front desk"
              value={form.min_daily_csr}
              min={0}
              max={20}
              onChange={(value) => patch("min_daily_csr", value ?? 0)}
            />
            <NumberField
              label="Drivers"
              value={form.min_daily_drivers}
              min={0}
              max={20}
              onChange={(value) => patch("min_daily_drivers", value ?? 0)}
            />
            <NumberField
              label="Utility staff"
              value={form.min_daily_utility}
              min={0}
              max={20}
              onChange={(value) => patch("min_daily_utility", value ?? 0)}
            />
          </RuleGrid>
        </RuleGroup>

        <RuleGroup
          icon={CalendarOff}
          title="Day-Off Limits"
          summary={form.protect_weekends ? "Protect weekends" : "Weekends flexible"}
          description="Control how many people can be off at the same time."
        >
          <RuleGrid>
            <NumberField
              label="Default days off per week"
              value={form.default_days_off_per_week}
              min={0}
              max={7}
              onChange={(value) =>
                patch("default_days_off_per_week", value ?? 1)
              }
            />
            <NumberField
              label="Max same-role off per day"
              value={form.max_same_role_off_per_day}
              min={0}
              max={20}
              onChange={(value) =>
                patch("max_same_role_off_per_day", value ?? 2)
              }
            />
            <NumberField
              label="Max therapists off per day"
              value={form.max_therapists_off_per_day}
              min={0}
              max={20}
              onChange={(value) =>
                patch("max_therapists_off_per_day", value ?? 1)
              }
            />
            <ToggleField
              label="Protect weekends"
              checked={form.protect_weekends}
              onChange={(checked) => patch("protect_weekends", checked)}
            />
          </RuleGrid>
        </RuleGroup>

        <RuleGroup
          icon={Coffee}
          title="Break & Workload Rules"
          summary={`Break ${form.default_break_minutes} min`}
          description="Configure breaks and workload limits to prevent overworking."
        >
          <RuleGrid>
            <NumberField
              label="Default break minutes"
              value={form.default_break_minutes}
              min={0}
              max={240}
              onChange={(value) => patch("default_break_minutes", value ?? 60)}
            />
            <ToggleField
              label="Auto-schedule breaks"
              checked={form.auto_breaks_enabled}
              onChange={(checked) => patch("auto_breaks_enabled", checked)}
            />
            <NumberField
              label="Max working hours per day"
              value={form.max_working_hours_per_day}
              min={1}
              max={24}
              step={0.5}
              onChange={(value) =>
                patch("max_working_hours_per_day", value ?? 8)
              }
            />
            <NumberField
              label="Max services per staff per day"
              value={form.max_services_per_staff_per_day}
              min={1}
              max={50}
              onChange={(value) =>
                patch("max_services_per_staff_per_day", value)
              }
              nullable
            />
          </RuleGrid>
        </RuleGroup>

        <RuleGroup
          icon={Sparkles}
          title="Auto-Blocking"
          summary={`${autoBlockingCount} active`}
          description="Automatically generate buffers and blocking time around bookings."
        >
          <RuleGrid>
            <ToggleField
              label="Generate break blocks"
              checked={form.auto_generate_breaks}
              onChange={(checked) => patch("auto_generate_breaks", checked)}
            />
            <ToggleField
              label="Generate travel buffers"
              checked={form.auto_generate_travel_buffers}
              onChange={(checked) =>
                patch("auto_generate_travel_buffers", checked)
              }
            />
            <ToggleField
              label="Generate room-reset buffers"
              checked={form.auto_generate_room_reset_buffers}
              onChange={(checked) =>
                patch("auto_generate_room_reset_buffers", checked)
              }
            />
            <NumberField
              label="Room-reset buffer minutes"
              value={form.room_reset_buffer_minutes}
              min={0}
              max={120}
              onChange={(value) =>
                patch("room_reset_buffer_minutes", value ?? 15)
              }
            />
            <NumberField
              label="Travel buffer - home service minutes"
              value={form.home_service_travel_buffer_minutes}
              min={0}
              max={120}
              onChange={(value) =>
                patch("home_service_travel_buffer_minutes", value ?? 30)
              }
            />
          </RuleGrid>
        </RuleGroup>

        <RuleGroup
          icon={ShieldCheck}
          title="Approval Flow"
          summary={
            form.suggestions_require_manager_approval
              ? "Manager approval required"
              : "Approval not required"
          }
          description="Control how schedule suggestions are applied."
        >
          <ToggleField
            label="Suggestions require manager approval"
            checked={form.suggestions_require_manager_approval}
            onChange={(checked) =>
              patch("suggestions_require_manager_approval", checked)
            }
          />
        </RuleGroup>
      </div>

      <div className="rounded-[var(--cs-r-lg)] border border-[var(--cs-info-bg)] bg-[var(--cs-info-bg)] p-4 text-[var(--cs-info-text)]">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-sm leading-6">
            Changes here affect schedule suggestions and today&apos;s schedule
            health. Saved rules refresh the dashboard, and approved suggestions
            continue to notify affected staff through the existing workflow.
          </p>
        </div>
      </div>
    </div>
  );
}

function RuleGroup({
  icon: Icon,
  title,
  summary,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  summary: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <details
      open
      className="group rounded-[var(--cs-r-lg)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--cs-r-md)] bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--cs-text)]">
              {title}
            </span>
            <span className="rounded-[var(--cs-r-pill)] bg-[var(--cs-surface-warm)] px-2 py-0.5 text-xs font-semibold text-[var(--cs-text-muted)]">
              {summary}
            </span>
          </span>
          <span className="mt-1 block text-sm leading-5 text-[var(--cs-text-secondary)]">
            {description}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-[var(--cs-text-muted)] transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--cs-border-soft)] px-4 py-4">
        {children}
      </div>
    </details>
  );
}

function RuleGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  nullable = false,
  onChange,
}: {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  nullable?: boolean;
  onChange: (value: number | null) => void;
}) {
  const id = `scheduling-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-[var(--cs-text)]">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        placeholder={nullable ? "No limit" : undefined}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "" ? null : Number(next));
        }}
        className="h-10 border-[var(--cs-border)] bg-[var(--cs-surface)] text-sm"
      />
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
      <span className="text-sm font-semibold text-[var(--cs-text)]">
        {label}
      </span>
      <InlineSwitch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}
