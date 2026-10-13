import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261012235226_staff_pwa_driver_progress_actor_guard.sql",
  "utf8"
).toLowerCase();

describe("Staff Driver progress database boundary", () => {
  it("checks active actor, branch, assignment and transition under the booking lock", () => {
    expect(migration).toContain("where id = p_actor_staff_id and is_active = true");
    expect(migration).toContain("for share");
    expect(migration).toContain("where id = p_booking_id");
    expect(migration).toContain("for update");
    expect(migration).toContain("v_booking.branch_id is distinct from v_actor.branch_id");
    expect(migration).toContain("v_booking.driver_id is distinct from v_actor.id");
    expect(migration).toContain("v_booking.delivery_type is distinct from 'home_service'");
    expect(migration).toContain("v_booking.booking_progress_status = 'not_started'");
    expect(migration).toContain("v_booking.booking_progress_status = 'travel_started'");
  });

  it("exposes only the service-role RPC and delegates final state validation", () => {
    expect(migration).toContain(
      "perform public.update_booking_progress(p_booking_id, p_next_status)"
    );
    expect(migration).toContain(
      "revoke all on function public.advance_staff_driver_trip(uuid, text, uuid) from public"
    );
    expect(migration).toContain(
      "revoke all on function public.advance_staff_driver_trip(uuid, text, uuid) from authenticated"
    );
    expect(migration).toContain(
      "grant execute on function public.advance_staff_driver_trip(uuid, text, uuid) to service_role"
    );
  });
});
