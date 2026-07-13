import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260712044527_attendance_transactional_scan_rpc.sql"),
  "utf8"
);
const correctionMigrationSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260712045429_attendance_transactional_corrections_rpc.sql"),
  "utf8"
);

describe("attendance transactional scan RPC migration", () => {
  it("defines one locked, idempotent scan persistence RPC", () => {
    expect(migrationSql).toContain("create or replace function public.commit_attendance_scan_transaction");
    expect(migrationSql).toContain("security invoker");
    expect(migrationSql).toContain("pg_advisory_xact_lock");
    expect(migrationSql).toContain("for update");
    expect(migrationSql).toContain("operation_result");
  });

  it("keeps the scan RPC signature aligned with the TypeScript scan engine", () => {
    [
      "p_request_id text",
      "p_branch_id uuid",
      "p_qr_point_id uuid",
      "p_staff_id uuid",
      "p_device_id uuid",
      "p_scan_type text",
      "p_action text",
      "p_outcome text",
      "p_public_result jsonb",
      "p_checkin_id uuid",
      "p_checkin_insert jsonb",
      "p_checkin_update jsonb",
      "p_exception jsonb",
      "p_device_scan_type text",
    ].forEach((parameter) => {
      expect(migrationSql).toContain(parameter);
    });

    [
      "shift_instance_key",
      "scheduled_start_at",
      "scheduled_end_at",
      "schedule_source",
      "schedule_source_id",
      "branch_timezone",
      "attendance_business_date",
    ].forEach((column) => {
      expect(migrationSql).toContain(column);
    });
  });

  it("keeps execution restricted to the server-owned service role", () => {
    expect(migrationSql).toContain("revoke all on function public.commit_attendance_scan_transaction");
    expect(migrationSql).toContain("from public");
    expect(migrationSql).toContain("from anon");
    expect(migrationSql).toContain("from authenticated");
    expect(migrationSql).toContain("to service_role");
  });

  it("defines a transactional selected-record reset correction RPC", () => {
    expect(correctionMigrationSql).toContain("create or replace function public.reset_attendance_state_transaction");
    expect(correctionMigrationSql).toContain("security invoker");
    expect(correctionMigrationSql).toContain("for update");
    expect(correctionMigrationSql).toContain("v_open_checkin_id");
    expect(correctionMigrationSql).toContain("insert into public.attendance_corrections");
    expect(correctionMigrationSql).toContain("revoke all on function public.reset_attendance_state_transaction");
    expect(correctionMigrationSql).toContain("to service_role");
  });
});
