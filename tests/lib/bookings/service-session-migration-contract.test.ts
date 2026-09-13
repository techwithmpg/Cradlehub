import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("service-session repair migration contract", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase/migrations/20260913100000_repair_service_session_overload_and_actor_authority.sql"
  );
  const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");

  it("drops the obsolete 3-argument start_booking_service_session overload", () => {
    expect(sql).toContain(
      "drop function if exists public.start_booking_service_session(uuid, text, uuid);"
    );
  });

  it("defines canonical resolve_service_session_actor with auth.role() and auth.uid()", () => {
    expect(sql).toContain(
      "create or replace function public.resolve_service_session_actor("
    );
    expect(sql).toContain("coalesce(auth.role(), '')");
    expect(sql).toContain("staff.auth_user_id = auth.uid()");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, auth, pg_temp");
  });

  it("preserves active, not-archived, and not-merged staff checks", () => {
    expect(sql).toContain("and staff.is_active = true");
    expect(sql).toContain("and staff.archived_at is null");
    expect(sql).toContain("and staff.merged_into_staff_id is null");
  });

  it("grants execute to authenticated and service_role", () => {
    expect(sql).toContain(
      "grant execute on function public.resolve_service_session_actor(uuid)\n  to authenticated, service_role;"
    );
  });
});
