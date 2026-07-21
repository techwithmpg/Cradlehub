import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260715113000_attendance_branch_correction_resolution.sql"),
  "utf8"
);
const transactionFixMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260715113001_attendance_branch_resolution_transaction_fix.sql"),
  "utf8"
);
const scanEngine = readFileSync(resolve(process.cwd(), "src/lib/attendance/scan-engine.ts"), "utf8");
const branchService = readFileSync(resolve(process.cwd(), "src/lib/staff/branch-correction.ts"), "utf8");
const branchErrors = readFileSync(resolve(process.cwd(), "src/lib/staff/branch-correction-errors.ts"), "utf8");
const actions = readFileSync(resolve(process.cwd(), "src/app/(dashboard)/crm/staff/actions.ts"), "utf8");

describe("Attendance branch-correction resolution contract", () => {
  it("stores branch-specific temporary validity and source links", () => {
    expect(migration).toContain("source_branch_correction_id uuid references public.staff_branch_change_requests");
    expect(migration).toContain("source_scan_event_id uuid references public.qr_scan_events");
    expect(migration).toContain("valid_from timestamptz");
    expect(migration).toContain("valid_until timestamptz");
    expect(migration).toContain("scope text");
    expect(migration).toContain("branch_id = p_qr_branch_id");
    expect(migration).toContain("assignment.is_test = coalesce(p_is_test, false)");
  });

  it("supports shift and business-day access but intentionally excludes date ranges", () => {
    expect(migration).toContain("'temporary_branch_access_shift'");
    expect(migration).toContain("'temporary_branch_access_day'");
    expect(migration).toContain("scope in ('shift', 'business_day')");
    expect(migration).not.toContain("temporary_branch_access_range");
  });

  it("expires shift permission after clock-out and retains a maximum cutoff", () => {
    expect(migration).toContain("expire_shift_branch_authorization_on_clock_out");
    expect(migration).toContain("Attendance shift closed.");
    expect(branchService).toContain("36 * 60 * 60_000");
    expect(migration).toContain("assignment.valid_until > now()");
  });

  it("locks the request and invokes the authoritative Attendance transaction", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("where id = p_request_id\n  for update");
    expect(migration).toContain("from public.commit_attendance_scan_transaction(");
    expect(migration).toContain("from public.reconcile_provisional_attendance_clock_out(");
    expect(migration).toContain("branch_correction_scan_commit_failed");
  });

  it("qualifies the exception predicates that caused live SQLSTATE 42702", () => {
    expect(transactionFixMigration).toContain("update public.attendance_exceptions as exception_row");
    expect(transactionFixMigration).toContain("exception_row.scan_event_id = v_source_event.id");
    expect(transactionFixMigration).toContain("exception_row.latest_scan_event_id = v_source_event.id");
    expect(transactionFixMigration).toContain("exception_row.exception_type = ''wrong_branch''");
    expect(transactionFixMigration).toContain("branch_resolution_fix_ambiguous_scan_predicate_remains");
    expect(transactionFixMigration).toContain("from public, anon, authenticated");
    expect(transactionFixMigration).toContain("to service_role");
    expect(transactionFixMigration.toLowerCase()).not.toContain("security definer");
  });

  it("reuses the scan engine and excludes only the stored source from debounce", () => {
    expect(scanEngine).toContain("resumeAttendanceScanFromStoredSource");
    expect(scanEngine).toContain("excludeDuplicateScanEventId: source.id");
    expect(scanEngine).toContain("const commit = options.commit ?? commitAttendanceScanTransaction");
    expect(branchService).toContain("continuationRequestId: `branch-correction:${request.id}`");
    expect(scanEngine).toContain('stage: "resume_source_identity"');
    expect(branchService).toContain('stage: "resume_stored_source"');
  });

  it("preserves home and actual working branch snapshots on Attendance", () => {
    expect(migration).toContain("home_branch_id uuid references public.branches");
    expect(migration).toContain("branch_authorization_id uuid references public.staff_attendance_branch_assignments");
    expect(migration).toContain("branch_correction_request_id uuid references public.staff_branch_change_requests");
    expect(migration).toContain("home_branch_id = coalesce(home_branch_id, v_request.current_branch_id)");
  });

  it("permanently changes only the current profile and writes an append-only audit", () => {
    expect(migration).toContain("update public.staff\n       set branch_id = v_request.requested_branch_id");
    expect(migration).toContain("insert into public.staff_branch_audit_logs");
    expect(migration).not.toContain("update public.bookings");
    expect(migration).not.toContain("update public.staff_schedules");
    expect(migration).not.toContain("update public.payroll");
  });

  it("rejects safely without writing Attendance and prevents later approval", () => {
    expect(migration).toContain("p_decision_type = 'rejected_wrong_branch'");
    expect(migration).toContain("'reasonCode', 'wrong_branch_rejected'");
    expect(migration).toContain("set status = 'rejected'");
    expect(migration).toContain("if v_request.status <> 'pending'");
  });

  it("enforces active actor, branch scope, self-approval, and Test Mode controls", () => {
    expect(migration).toContain("v_actor.id = v_request.staff_id");
    expect(migration).toContain("v_actor.branch_id = v_request.requested_branch_id");
    expect(migration).toContain("and is_active = true");
    expect(migration).toContain("test_mode_permanent_transfer_blocked");
    expect(migration).toContain("v_authorization.is_test <> v_is_test");
  });

  it("loads a compact transfer impact and refreshes operational surfaces", () => {
    expect(branchService).toContain("futureBookingsAtCurrentBranch");
    expect(branchService).toContain("servicesUnavailableAtScannedBranch");
    expect(branchService).toContain("staff.branch_transfer.schedule_review");
    expect(branchService).toContain("staff.branch_transfer.booking_review");
    expect(actions).toContain('"/crm/availability"');
    expect(actions).toContain('"/manager/staff-availability"');
    expect(actions).toContain('"/book"');
    expect(actions).toContain("includeOperationalReadiness: true");
  });

  it("maps known failures and sanitizes unknown transaction errors", () => {
    expect(branchErrors).toContain('case "source_scan_unavailable"');
    expect(branchErrors).toContain("Ask the staff member to scan again.");
    expect(branchErrors).toContain('case "attendance_already_completed"');
    expect(branchErrors).toContain('case "open_attendance_conflict"');
    expect(branchErrors).toContain("No changes were made.");
    expect(branchService).toContain("BranchResolutionTransactionError");
    expect(branchService).toContain("branch_correction_scan_commit_failed:");
  });
});
