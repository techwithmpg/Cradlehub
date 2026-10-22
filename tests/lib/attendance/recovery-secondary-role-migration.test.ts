import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateAttendanceDeviceRegistration } from "@/lib/attendance/device-policy";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261022120000_attendance_recovery_preserve_primary_role.sql"
  ),
  "utf8"
);

describe("attendance recovery preserves one active primary", () => {
  it("chooses the recovered device role from still-active devices after revoking the selected device", () => {
    const revoke = migration.indexOf("update public.staff_devices\n    set status = 'revoked'");
    const role = migration.indexOf("select case when exists (\n    select 1 from public.staff_devices as primary_device");
    const insert = migration.indexOf("insert into public.staff_devices (");
    expect(revoke).toBeGreaterThan(0);
    expect(role).toBeGreaterThan(revoke);
    expect(insert).toBeGreaterThan(role);
    expect(migration).toContain("primary_device.staff_id = v_token.staff_id");
    expect(migration).toContain("primary_device.status = 'active'");
    expect(migration).toContain("primary_device.device_role = 'primary'");
    expect(migration).toContain("then 'secondary' else 'primary' end");
    expect(migration).toMatch(/status,\s*device_role,\s*trusted_after,/);
    expect(migration).toMatch(/'active',\s*v_device_role,\s*v_now,/);
  });

  it("replaces a selected secondary without revoking the surviving primary", () => {
    const surviving = evaluateAttendanceDeviceRegistration({
      activeDevices: [
        { id: "primary", device_role: "primary" },
        { id: "secondary", device_role: "secondary" },
      ],
      replacementDeviceId: "secondary",
    });
    expect(surviving).toEqual({ allowed: true, role: "secondary", effectiveActiveCount: 1 });
    expect(migration).toContain("where id = v_token.revoke_previous_device_id");
    expect(migration).toContain("v_effective_active_count + 1 > v_limit");
  });

  it("preserves transaction safety, server-only RPC privilege and unique index", () => {
    expect(migration).toContain("where token_row.token_hash = v_token_hash");
    expect(migration).toContain("v_token.expires_at <= v_now");
    expect(migration).toContain("for update");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("insert into public.qr_scan_events");
    expect(migration).not.toMatch(/drop\s+(unique\s+)?index/i);
    expect(migration).not.toMatch(/alter\s+table\s+public\.staff_shift_checkins/i);
  });
});
