import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260713120237_attendance_recovery_rpc_and_scan_realtime_repair.sql"
  ),
  "utf8"
);

describe("attendance recovery RPC and Realtime repair migration", () => {
  it("qualifies the active-device count so RETURNS TABLE fields are not ambiguous", () => {
    expect(migrationSql).toContain("from public.staff_devices as active_device");
    expect(migrationSql).toContain(
      "where active_device.staff_id = v_token.staff_id"
    );
  });

  it("revokes a selected primary before inserting its replacement", () => {
    const revokePosition = migrationSql.indexOf(
      "update public.staff_devices\n    set status = 'revoked'"
    );
    const insertPosition = migrationSql.indexOf(
      "insert into public.staff_devices ("
    );

    expect(revokePosition).toBeGreaterThan(-1);
    expect(insertPosition).toBeGreaterThan(revokePosition);
  });

  it("keeps recovery execution server-only and publishes scan audit inserts", () => {
    expect(migrationSql).toContain("security invoker");
    expect(migrationSql).toContain("from public, anon, authenticated");
    expect(migrationSql).toContain("to service_role");
    expect(migrationSql).toContain(
      "alter publication supabase_realtime add table public.qr_scan_events"
    );
  });
});
