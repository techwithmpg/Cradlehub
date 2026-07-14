import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260714180000_attendance_crm_closing_policy.sql"),
  "utf8"
);
const vercelConfig = readFileSync(resolve("vercel.json"), "utf8");
const route = readFileSync(
  resolve("src/app/api/attendance/closing-interventions/route.ts"),
  "utf8"
);
const worker = readFileSync(
  resolve("src/lib/attendance/closing-interventions.ts"),
  "utf8"
);
const actions = readFileSync(
  resolve("src/app/(dashboard)/owner/branches/[branchId]/attendance-rule-actions.ts"),
  "utf8"
);
const scanEngine = readFileSync(resolve("src/lib/attendance/scan-engine.ts"), "utf8");

describe("CRM closing policy database contract", () => {
  it("keeps raw schedule fields and adds a separate immutable policy snapshot", () => {
    expect(migration).toContain("attendance_policy_snapshot jsonb not null");
    expect(migration).toContain("attendance_expected_end_at timestamptz");
    expect(migration).toContain("Raw assigned schedule end");
    expect(migration).toContain("before insert on public.staff_shift_checkins");
  });

  it("uses effective-dated branch and non-overlapping category histories", () => {
    expect(migration).toContain("create table if not exists public.attendance_rule_versions");
    expect(migration).toContain("create table if not exists public.attendance_staff_category_rules");
    expect(migration).toContain("effective_until = p_effective_from");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("keeps drivers and utility distinct and skips inactive branches", () => {
    expect(migration).toContain("'drivers', 'utility'");
    expect(migration).toContain("branch.is_active = true");
  });

  it("enables RLS and denies anonymous table access", () => {
    expect(migration).toContain("attendance_rule_versions enable row level security");
    expect(migration).toContain("attendance_staff_category_rules enable row level security");
    expect(migration).toContain("attendance_closing_interventions enable row level security");
    expect(migration).toContain("revoke all on public.attendance_closing_interventions from anon");
    expect(migration).toContain("'manager', 'assistant_manager', 'store_manager'");
    expect(migration).toContain("revoke all on function public.save_attendance_branch_rule_version");
  });

  it("auto-closes provisionally without creating a synthetic QR event", () => {
    const processor = migration.split(
      "create or replace function public.reconcile_provisional_attendance_clock_out"
    )[0];
    expect(processor).toContain("clock_out_method = 'system_auto_close'");
    expect(processor).toContain("clock_out_scan_event_id = null");
    expect(processor).toContain("'internalExceptionType', 'missing_clock_out'");
    expect(processor).not.toContain("insert into public.qr_scan_events");
  });

  it("creates one stable reminder and escalation stage across worker retries", () => {
    expect(migration).toContain("'reminder'");
    expect(migration).toContain("'manager_escalation'");
    expect(migration).toContain("on conflict (checkin_id, stage) do nothing");
    expect(migration).toContain("concat_ws(':', 'crm-closing'");
  });

  it("processes only open, real CRM-closing snapshots on active branches", () => {
    expect(migration).toContain("checkin.attendance_policy_source = 'crm_closing'");
    expect(migration).toContain("checkin.status = 'checked_in'");
    expect(migration).toContain("checkin.checked_out_at is null");
    expect(migration).toContain("checkin.is_test = false");
    expect(migration).toContain("branch.is_active = true");
  });

  it("keeps active-service rows open and creates deduplicated review evidence", () => {
    expect(migration).toContain("'active_service_blocked'");
    expect(migration).toContain("booking.booking_progress_status = 'session_started'");
    expect(migration).toContain("Active service prevented the CRM closing attendance auto-close.");
  });

  it("uses the snapshotted latest-normal time rather than hard-cutoff execution time", () => {
    expect(migration).toContain("set checked_out_at = provisional_clock_out_at");
    expect(migration).toContain("provisional_auto_closed_at = p_now");
    expect(migration).toContain("clock_out_confirmation_required = true");
  });

  it("reconciles a late real scan against the same locked Attendance row", () => {
    expect(migration).toContain("reconcile_provisional_attendance_clock_out");
    expect(migration).toContain("where id = p_checkin_id and branch_id = p_branch_id and staff_id = p_staff_id");
    expect(migration).toContain("clock_out_scan_event_id = v_event_id");
    expect(migration).toContain("'reconcile_provisional_clock_out'");
  });

  it("rejects reconciliation outside the snapshotted Attendance business day", () => {
    expect(migration).toContain("'attendanceDayBoundary'");
    expect(migration).toContain("'outside_attendance_business_day'");
  });

  it("resolves missing-clock-out review and retains provisional-to-real audit", () => {
    expect(migration).toContain("resolution_action = 'actual_qr_reconciliation'");
    expect(migration).toContain("A real QR scan replaced the provisional system auto-close.");
    expect(migration).toContain("'provisionalClockOutAt', v_checkin.checked_out_at");
    expect(migration).toContain("'actualClockOutAt', p_actual_clock_out_at");
  });
});

describe("Owner branch Attendance rule action contract", () => {
  it("enforces owner auth, branch existence, shared input validation, and revalidation", () => {
    expect(actions).toContain("requireOwnerContext");
    expect(actions).toContain("branchExists(input.branchId)");
    expect(actions).toContain("validateBranchAttendanceRulesInput(input)");
    expect(actions).toContain("validateCategoryAttendanceRuleInput(input)");
    expect(actions).toContain("revalidatePath(`/owner/branches/${input.branchId}`)");
  });
});

describe("late real QR scan routing contract", () => {
  it("reconciles a single same-business-day provisional row before clock-in intent", () => {
    expect(scanEngine.indexOf("if (provisionalClockOuts.length === 1)")).toBeLessThan(
      scanEngine.indexOf("if (scanIntent.requiresRecovery")
    );
    expect(scanEngine).toContain("reconcileProvisionalClockOut({");
    expect(scanEngine).toContain("no second check-in was created");
  });

  it("captures multiple or out-of-business-day provisional candidates without guessing", () => {
    expect(scanEngine).toContain("conflicting_provisional_clock_outs");
    expect(scanEngine).toContain("provisional_clock_out_outside_business_day");
    expect(scanEngine).toContain("No Attendance row was changed and no new clock-in was created.");
  });
});

describe("CRM closing scheduler and signal contract", () => {
  it("configures the existing Vercel scheduler surface every five minutes", () => {
    expect(vercelConfig).toContain('"/api/attendance/closing-interventions"');
    expect(vercelConfig).toContain('"*/5 * * * *"');
  });

  it("uses the existing CRON_SECRET bearer convention", () => {
    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain("authorization");
    expect(route).toContain("Bearer");
  });

  it("uses existing notification and workflow-task stores with stable stage keys", () => {
    expect(worker).toContain("createOrUpdateNotification");
    expect(worker).toContain("createOrUpdateWorkflowTask");
    expect(worker).toContain("`${row.dedupe_key}:notification`");
    expect(worker).toContain("`${row.dedupe_key}:task`");
  });
});
