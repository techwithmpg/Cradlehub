import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260714050554_attendance_staff_self_service.sql"),
  "utf8"
);

describe("staff attendance phone registration migration", () => {
  it("stores a hashed same-phone identity with an audited lifecycle", () => {
    expect(sql).toContain("device_fingerprint_hash text not null");
    expect(sql).toContain("status in ('pending', 'approved', 'rejected', 'completed', 'cancelled', 'expired')");
    expect(sql).not.toContain("raw_device_credential");
  });

  it("keeps reads self-only or branch-scoped and mutations server-only", () => {
    expect(sql).toContain('create policy "staff_device_registration_requests_select_own"');
    expect(sql).toContain("staff_id = (select public.get_auth_staff_id())");
    expect(sql).toContain('create policy "staff_device_registration_requests_select_branch_crm"');
    expect(sql).toContain("grant select on table public.staff_device_registration_requests to authenticated");
    expect(sql).toContain("grant select, insert, update, delete on table public.staff_device_registration_requests to service_role");
  });

  it("uses single-use expiring approval and revokes replacements before insertion", () => {
    expect(sql).toContain("v_token.used_at is not null");
    expect(sql).toContain("v_token.expires_at <= v_now");
    const revoke = sql.indexOf("update public.staff_devices\n      set status = 'revoked'");
    const insert = sql.indexOf("insert into public.staff_devices (", revoke);
    expect(revoke).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(revoke);
    expect(sql).toContain("p_active_device_limit integer default 2");
  });

  it("exposes both review and completion RPCs only to service_role", () => {
    expect(sql).toContain("review_staff_device_registration_request");
    expect(sql).toContain("complete_staff_device_registration_request");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
