import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requestMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260709064020_branch_correction_requests.sql"),
  "utf8"
);

const auditMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260709083908_staff_branch_audit_logs.sql"),
  "utf8"
);

const deviceSyncMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260709054954_attendance_device_branch_sync.sql"),
  "utf8"
);

describe("branch correction migrations", () => {
  it("creates the request table with duplicate protection and review indexes", () => {
    expect(requestMigration).toContain("create table if not exists public.staff_branch_change_requests");
    expect(requestMigration).toContain("check (status in ('pending', 'approved', 'rejected', 'cancelled'))");
    expect(requestMigration).toContain("staff_branch_change_requests_requested_branch_status_idx");
    expect(requestMigration).toContain("where status = 'pending'");
    expect(auditMigration).toContain("staff_branch_change_requests_requested_branch_id_idx");
    expect(auditMigration).toContain("staff_branch_change_requests_status_idx");
    expect(auditMigration).toContain("staff_branch_change_requests_created_at_idx");
  });

  it("keeps CRM review scoped to requested branch and blocks staff self-approval", () => {
    expect(requestMigration).toContain("requested_branch_id = (select public.get_auth_branch_id())");
    expect(auditMigration).toContain("v_reviewer.branch_id = v_request.requested_branch_id");
    expect(auditMigration).toContain("v_reviewer.system_role not in ('owner', 'manager', 'assistant_manager', 'store_manager')");
    expect(auditMigration).toContain("branch_correction_not_authorized");
  });

  it("validates active requested branches and writes an approval audit log", () => {
    expect(auditMigration).toContain("from public.branches");
    expect(auditMigration).toContain("branch_correction_requested_branch_inactive");
    expect(auditMigration).toContain("insert into public.staff_branch_audit_logs");
    expect(auditMigration).toContain("old_branch_id");
    expect(auditMigration).toContain("new_branch_id");
  });

  it("syncs active staff_devices when staff.branch_id changes", () => {
    expect(deviceSyncMigration).toContain("trg_staff_branch_sync_devices");
    expect(deviceSyncMigration).toContain("update public.staff_devices");
    expect(deviceSyncMigration).toContain("status = 'active'");
    expect(deviceSyncMigration).toContain("new.branch_id");
  });
});
