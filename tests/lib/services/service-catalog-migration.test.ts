import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260806132402_service_catalog_unification_repair.sql"
);

describe("service catalogue repair migration contract", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("repairs SM from Main active in-spa services without overwriting existing SM rows", () => {
    expect(sql).toContain("c1000000-0000-0000-0000-000000000001");
    expect(sql).toContain("c1000000-0000-0000-0000-000000000002");
    expect(sql).toContain("main_branch_service.available_in_spa = true");
    expect(sql).toContain("ON CONFLICT (branch_id, service_id) DO NOTHING");
    expect(sql).toContain("custom_price,\n    is_active");
    expect(sql).toContain("NULL,\n    true,\n    true,\n    false");
  });

  it("forces SM Home Service off without deleting services, bookings, or staff assignments", () => {
    const repairBlock = sql.slice(sql.indexOf("DO $$"));

    expect(sql).toContain("home_service_enabled = false");
    expect(sql).toContain("SET available_home_service = false");
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.(bookings|services)\b/i);
    expect(repairBlock).not.toMatch(/\bdelete\s+from\s+public\.staff_services\b/i);
  });

  it("centralizes capability eligibility and validates before replacement", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.is_branch_service_assignable");
    expect(sql).toContain("public.is_branch_service_assignable(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.replace_staff_service_capabilities");
    expect(sql).toContain("current_setting('request.jwt.claim.role', true)");
    expect(sql).toContain("current_setting('request.jwt.claims', true)");
    expect(sql).toContain("v_request_role <> 'service_role'");
    expect(sql.indexOf("SELECT coalesce(array_agg(requested.service_id)"))
      .toBeLessThan(sql.indexOf("DELETE FROM public.staff_services existing_assignment"));
  });

  it("prevents future service creation drift with an idempotent in-spa-only trigger", () => {
    expect(sql).toContain("CREATE TRIGGER ensure_branch_service_rows_after_service_insert");
    expect(sql).toContain("AFTER INSERT ON public.services");
    expect(sql).toContain("available_home_service");
    expect(sql).toContain("false,\n    'public',\n    'public'");
    expect(sql).toContain("ON CONFLICT (branch_id, service_id) DO NOTHING");
  });
});
