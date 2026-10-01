import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20261001015057_p1c_reconciliation_status_guard.sql",
), "utf8");

describe("P1-C persisted reconciliation status guard", () => {
  it("guards direct Data API writes to the existing reconciliation table", () => {
    expect(sql).toContain("BEFORE INSERT OR UPDATE OR DELETE");
    expect(sql).toContain("ON public.daily_cash_reconciliations");
    expect(sql).toContain("RECONCILIATION_APPROVED_LOCKED");
    expect(sql).toContain("OLD.status = 'approved'");
  });

  it("requires a submitted record and an active owner or manager for approval", () => {
    expect(sql).toContain("OLD.status IS DISTINCT FROM 'submitted'");
    expect(sql).toContain("s.auth_user_id = auth.uid()");
    expect(sql).toContain("s.is_active");
    expect(sql).toContain("v_actor_role IS DISTINCT FROM 'owner'");
    expect(sql).toContain("v_actor_role IS DISTINCT FROM 'manager'");
    expect(sql).toContain("RECONCILIATION_APPROVAL_UNAUTHORIZED");
  });

  it("uses a safe definer search path without altering reconciliation data", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.p1c_guard_reconciliation_state() FROM PUBLIC, anon, authenticated");
    expect(sql).not.toMatch(/\bUPDATE\s+public\.daily_cash_reconciliations\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+public\.daily_cash_reconciliations\b/i);
  });
});
