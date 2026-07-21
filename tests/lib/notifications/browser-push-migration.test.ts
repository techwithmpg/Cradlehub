import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260721174547_browser_push_notifications.sql",
  "utf8"
).toLowerCase();

describe("browser push migration", () => {
  it("adds delivery state without creating a second notification history", () => {
    expect(sql).toContain("create table public.web_push_subscriptions");
    expect(sql).toContain("create table public.notification_delivery_preferences");
    expect(sql).not.toContain("create table public.push_notifications");
    expect(sql).not.toContain("create table public.notification_history");
  });

  it("enforces own-row RLS and server-derived workspace/branch scope", () => {
    expect(sql).toContain("alter table public.web_push_subscriptions enable row level security");
    expect(sql).toContain("(select auth.uid()) = auth_user_id");
    expect(sql).toContain("branch_id = get_auth_branch_id()");
    expect(sql).toContain("staff_id is not distinct from get_auth_staff_id()");
    expect(sql).toContain("revoke all on table public.web_push_subscriptions from anon");
    expect(sql).toContain("grant select, insert, update on table public.web_push_subscriptions to authenticated");
  });

  it("indexes active recipient lookups and enables Realtime idempotently", () => {
    expect(sql).toContain("web_push_subscriptions_branch_workspace_active_idx");
    expect(sql).toContain("web_push_subscriptions_staff_active_idx");
    expect(sql).toContain("where is_active = true");
    expect(sql).toContain("alter publication supabase_realtime");
    expect(sql).toContain("add table public.workspace_notifications");
  });
});
