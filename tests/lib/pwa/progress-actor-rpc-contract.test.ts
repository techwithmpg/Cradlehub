import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261012235226_staff_pwa_progress_actor_guard.sql",
  "utf8"
).toLowerCase();

describe("Staff non-session progress database boundary (source contract)", () => {
  it("locks the active actor and booking before authorization and the write", () => {
    expect(migration).toMatch(/where id = p_actor_staff_id and is_active = true\s+for share/);
    expect(migration).toMatch(/where id = p_booking_id\s+for update/);
    const actorLock = migration.indexOf("for share");
    const bookingLock = migration.indexOf("for update");
    const scopeCheck = migration.indexOf("v_booking.branch_id is distinct from v_actor.branch_id");
    const write = migration.indexOf("perform public.update_booking_progress");
    expect(actorLock).toBeLessThan(bookingLock);
    expect(bookingLock).toBeLessThan(scopeCheck);
    expect(scopeCheck).toBeLessThan(write);
  });

  it("limits Driver and assigned Provider travel to Home Service and exact stages", () => {
    expect(migration).toContain(
      "v_group = 'driver' and v_booking.driver_id is not distinct from v_actor.id"
    );
    expect(migration).toContain(
      "v_group = 'provider' and v_booking.staff_id is not distinct from v_actor.id"
    );
    expect(migration).toContain("v_booking.delivery_type is distinct from 'home_service'");
    expect(migration).toContain(
      "v_booking.booking_progress_status = 'not_started' and p_next_status = 'travel_started'"
    );
    expect(migration).toContain(
      "v_booking.booking_progress_status = 'travel_started' and p_next_status = 'arrived'"
    );
  });

  it("limits in-spa check-in and no-show to Provider assignment or branch CRM authority", () => {
    expect(migration).toContain("v_booking.delivery_type is distinct from 'in_spa'");
    expect(migration).toContain("v_group = 'crm'");
    expect(migration).toContain(
      "v_group = 'provider' and v_booking.staff_id is not distinct from v_actor.id"
    );
    expect(migration).toContain(
      "v_booking.booking_progress_status = 'not_started' and p_next_status = 'checked_in'"
    );
    expect(migration).toContain(
      "v_booking.booking_progress_status = 'not_started' and p_next_status = 'no_show'"
    );
    expect(migration).toContain(
      "v_booking.booking_progress_status = 'checked_in' and p_next_status = 'no_show'"
    );
    expect(migration).toContain("v_role = 'utility' or v_type = 'utility'");
  });

  it("rechecks branch and lifecycle after the locks, including races and terminal states", () => {
    expect(migration).toContain("v_actor.branch_id is null");
    expect(migration).toContain("v_booking.branch_id is distinct from v_actor.branch_id");
    expect(migration).toContain("v_booking.status not in ('confirmed', 'in_progress')");
    expect(migration).toContain("if not coalesce((");
    expect(migration).toContain("raise exception 'staff_progress_conflict'");
    expect(migration).toContain("v_role <> 'owner'");
  });

  it("uses a private service-role-only SECURITY DEFINER function", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    const signature = "function public.advance_staff_booking_progress(uuid, text, uuid)";
    for (const role of ["public", "anon", "authenticated"]) {
      expect(migration).toContain(`revoke all on ${signature} from ${role}`);
    }
    expect(migration).toContain(`grant execute on ${signature} to service_role`);
    expect(migration).not.toContain("advance_staff_driver_trip");
  });
});
