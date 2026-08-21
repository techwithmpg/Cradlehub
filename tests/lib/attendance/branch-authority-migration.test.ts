import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260821034409_repair_attendance_branch_authority.sql"),
  "utf8"
);
const businessDateMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260821160939_attendance_transfer_business_date.sql"),
  "utf8"
);
const diagnostic = readFileSync(
  join(process.cwd(), "supabase/diagnostics/20260821_attendance_branch_authority.sql"),
  "utf8"
);
const resolverService = readFileSync(
  join(process.cwd(), "src/lib/staff/branch-assignment-resolver.ts"),
  "utf8"
);
const resolutionDialog = readFileSync(
  join(process.cwd(), "src/components/features/crm/staff/crm-staff-branch-resolution-dialog.tsx"),
  "utf8"
);

describe("Attendance branch authority migration", () => {
  it("keeps temporary shift/day authority ahead of duty, cross-branch, transfer, and home", () => {
    const temporary = migration.indexOf("assignment.assignment_type = 'temporary'");
    const duty = migration.indexOf("count(distinct duty.branch_id)");
    const crossBranch = migration.indexOf("v_staff.is_cross_branch is true");
    const transfer = migration.indexOf("from public.staff_permanent_branch_transfers");
    const home = migration.lastIndexOf("v_effective_branch_id := v_staff.branch_id");
    expect(temporary).toBeGreaterThan(0);
    expect(duty).toBeGreaterThan(temporary);
    expect(crossBranch).toBeGreaterThan(duty);
    expect(transfer).toBeGreaterThan(crossBranch);
    expect(home).toBeGreaterThan(transfer);
  });

  it("prefers the duty row matching the scanned branch and fails contradictory duties closed", () => {
    expect(migration).toContain("and duty.branch_id = p_qr_branch_id");
    expect(migration).toContain("if v_duty_branch_count > 1 then");
    expect(migration).toContain("'duty_assignment_conflict'::text");
  });

  it("stores future permanent transfers without changing the profile early", () => {
    expect(migration).toContain("case when v_effective_now then 'effective' else 'scheduled' end");
    expect(migration).toContain("if v_effective_now then\n    update public.staff");
    expect(migration).toContain("profileBranchPreservedUntilEffectiveDate");
    expect(migration).toContain("transfer_row.effective_date <= p_attendance_date");
  });

  it("decides immediate permanent transfers from the target branch Attendance business date", () => {
    expect(businessDateMigration).toContain("settings.timezone");
    expect(businessDateMigration).toContain("settings.attendance_day_boundary");
    expect(businessDateMigration).toContain("now() at time zone v_target_timezone");
    expect(businessDateMigration).toContain("p_effective_date <= v_current_business_date");
    expect(businessDateMigration).toContain(
      "'  v_effective_now boolean := p_effective_date <= current_date;'"
    );
  });

  it("routes permanent decisions through the effective-dated transaction", () => {
    expect(resolverService).toContain(
      'params.input.resolutionType === "correct_permanent_primary_branch"'
    );
    expect(resolverService).toContain('rpc("resolve_staff_permanent_branch_transfer_issue"');
    expect(resolutionDialog).toContain('type="date"');
    expect(resolutionDialog).toContain("effectiveDate: permanent ? effectiveDate");
  });

  it("keeps temporary and cross-branch assignments bounded without changing home branch", () => {
    expect(migration).toContain("assignment.valid_until > now()");
    expect(migration).toContain("assignment.assignment_type = 'approved_cross_branch'");
    expect(migration).toContain("v_staff.is_cross_branch is true");
  });

  it("restricts transfer writes and resolver execution to existing authorized surfaces", () => {
    expect(migration).toContain(
      "alter table public.staff_permanent_branch_transfers enable row level security"
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("v_actor.id = v_issue.staff_id");
  });

  it("diagnoses every requested live branch-integrity anomaly", () => {
    [
      "future_transfer_applied_early",
      "duplicate_active_duty_assignments",
      "contradictory_active_duty_assignments",
      "expired_temporary_assignment_still_approved",
      "device_branch_disagrees_with_effective_branch",
      "resolved_branch_issue_not_effective",
    ].forEach((code) => expect(diagnostic).toContain(code));
  });
});
