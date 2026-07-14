import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260714143000_attendance_fluid_operations.sql"),
  "utf8"
);
const scanEngine = readFileSync(join(process.cwd(), "src/lib/attendance/scan-engine.ts"), "utf8");
const reviewQueue = readFileSync(
  join(process.cwd(), "src/components/features/attendance/recovery/selected-recovery-issue-panel.tsx"),
  "utf8"
);

describe("Attendance fluid operations database contract", () => {
  it("resolves effective branch in the required precedence order", () => {
    const temporary = migration.indexOf("assignment.assignment_type = 'temporary'");
    const schedule = migration.indexOf("'schedule_assignment'");
    const crossBranch = migration.indexOf("v_staff.is_cross_branch is true");
    const home = migration.indexOf("v_staff.branch_id");
    expect(temporary).toBeGreaterThan(0);
    expect(schedule).toBeGreaterThan(temporary);
    expect(crossBranch).toBeGreaterThan(schedule);
    expect(home).toBeGreaterThan(crossBranch);
  });

  it("prevents a new second open row under a staff-wide transaction lock", () => {
    expect(migration).toContain("create or replace function public.enforce_single_open_attendance");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("existing.staff_id = new.staff_id");
    expect(migration).toContain("attendance_single_open_violation");
  });

  it("links atomic corrections to their review exception", () => {
    expect(migration).toContain("add column if not exists exception_id uuid references public.attendance_exceptions");
    expect(migration).toContain("create or replace function public.apply_attendance_review_correction");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into public.attendance_corrections");
    expect(migration).toContain("to service_role");
  });

  it("records device lifecycle and last-used branch changes durably", () => {
    expect(migration).toContain("create table if not exists public.attendance_device_audit_events");
    expect(migration).toContain("staff_devices_attendance_lifecycle_audit");
    expect(migration).toContain("last_used_branch_changed");
  });

  it("exposes temporary and permanent branch resolution in the Review Queue", () => {
    expect(reviewQueue).toContain("Allow This Branch Today");
    expect(reviewQueue).toContain("Correct Permanent Branch");
  });

  it("captures multiple opens and never invokes the legacy active-service attendance blocker", () => {
    expect(scanEngine).toContain("if (openCheckins.length > 1)");
    expect(scanEngine).toContain('reasonCode: "conflicting_open_checkin"');
    const attendanceStart = scanEngine.indexOf("async function processAttendanceScan");
    const roomStart = scanEngine.indexOf("async function processRoomScan");
    expect(scanEngine.slice(attendanceStart, roomStart)).not.toContain("active_service_blocks_clock_out");
  });
});
