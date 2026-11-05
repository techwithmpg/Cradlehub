import { describe, expect, it } from "vitest";
import { isServiceStartReminderEligible, serviceStartReminderQueue } from "@/lib/bookings/service-start-reminders";

const due = Date.parse("2026-11-03T14:00:00+08:00");
const candidate = {
  id: "booking-1",
  booking_date: "2026-11-03",
  start_time: "14:00:00",
  status: "confirmed",
  booking_progress_status: "not_started",
  session_started_at: null,
  staff_id: "therapist-1",
  resource_id: "room-1",
  delivery_type: "in_spa",
};

describe("server-time service start reminder eligibility", () => {
  it("waits until two minutes before the appointment", () => {
    expect(isServiceStartReminderEligible(candidate, due - 5 * 60_000)).toBe(false);
    expect(isServiceStartReminderEligible(candidate, due - 2 * 60_000)).toBe(true);
  });

  it("includes bookings created inside the window and limits old reminders", () => {
    expect(isServiceStartReminderEligible(candidate, due + 60_000)).toBe(true);
    expect(isServiceStartReminderEligible(candidate, due + 16 * 60_000)).toBe(false);
  });

  it("excludes unstartable and already transitioned sessions", () => {
    for (const change of [
      { status: "cancelled" }, { status: "completed" }, { session_started_at: "2026-11-03T06:00:00Z" },
      { booking_progress_status: "session_started" }, { staff_id: null }, { resource_id: null },
      { delivery_type: "home_service" },
    ]) expect(isServiceStartReminderEligible({ ...candidate, ...change }, due)).toBe(false);
  });

  it("prioritizes independent group service lines by start time", () => {
    const second = { ...candidate, id: "booking-2", start_time: "14:02:00" };
    expect(serviceStartReminderQueue([second, candidate], due).map((entry) => entry.id))
      .toEqual(["booking-1", "booking-2"]);
  });
});
