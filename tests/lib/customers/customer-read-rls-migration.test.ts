import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260906150500_stage03_customer_read_rls_reconciliation.sql",
  "utf8"
).toLowerCase();

describe("Stage 03 Customer Read RLS Reconciliation Migration", () => {
  it("drops legacy global CRM read-all policies", () => {
    expect(sql).toContain('drop policy if exists "bookings_crm_read_all" on public.bookings');
    expect(sql).toContain('drop policy if exists "customers_crm_read_all" on public.customers');
  });

  it("creates branch-scoped bookings read policy for crm, assistant_manager, and store_manager", () => {
    expect(sql).toContain('create policy "bookings_crm_management_read_branch"');
    expect(sql).toContain("on public.bookings");
    expect(sql).toContain("for select");
    expect(sql).toContain("to authenticated");
    expect(sql).toContain(
      "public.get_auth_role() in ('crm', 'assistant_manager', 'store_manager')"
    );
    expect(sql).toContain("branch_id = public.get_auth_branch_id()");
  });

  it("creates booking-derived branch-scoped customers read policy for crm, assistant_manager, and store_manager", () => {
    expect(sql).toContain('create policy "customers_crm_management_read_branch"');
    expect(sql).toContain("on public.customers");
    expect(sql).toContain("for select");
    expect(sql).toContain("to authenticated");
    expect(sql).toContain(
      "public.get_auth_role() in ('crm', 'assistant_manager', 'store_manager')"
    );
    expect(sql).toContain("where branch_id = public.get_auth_branch_id()");
  });

  it("creates branch-scoped waitlist read policy for assistant_manager and store_manager", () => {
    expect(sql).toContain('create policy "waitlist_management_read_branch"');
    expect(sql).toContain("on public.waitlist_requests");
    expect(sql).toContain("for select");
    expect(sql).toContain("to authenticated");
    expect(sql).toContain("public.get_auth_role() in ('assistant_manager', 'store_manager')");
    expect(sql).toContain("branch_id = public.get_auth_branch_id()");
  });

  it("is strictly read-only (zero write policy expansion)", () => {
    expect(sql).not.toContain("for insert");
    expect(sql).not.toContain("for update");
    expect(sql).not.toContain("for delete");
    expect(sql).not.toContain("for all");
  });
});
