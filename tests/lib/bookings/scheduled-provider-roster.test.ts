import { describe, expect, it } from "vitest";
import {
  canScheduledProviderPerformServices,
  findScheduledProviderConflict,
} from "@/lib/bookings/scheduled-provider-roster";

describe("scheduled provider roster", () => {
  it("keeps a therapist eligible through staff type fallback when service assignments are incomplete", () => {
    expect(
      canScheduledProviderPerformServices({
        staffType: "therapist",
        explicitlyAssignedServiceIds: new Set(),
        selectedServices: [
          { id: "massage", name: "Cradle Swedish Massage", categoryName: "Massage" },
        ],
      })
    ).toBe(true);
  });

  it("keeps explicit assignments authoritative for a configured provider", () => {
    expect(
      canScheduledProviderPerformServices({
        staffType: null,
        explicitlyAssignedServiceIds: new Set(["special"]),
        selectedServices: [{ id: "special", name: "Special Service" }],
      })
    ).toBe(true);
  });

  it("does not treat a driver as a massage provider through staff type fallback", () => {
    expect(
      canScheduledProviderPerformServices({
        staffType: "driver",
        explicitlyAssignedServiceIds: new Set(),
        selectedServices: [{ id: "massage", name: "Swedish Massage", categoryName: "Massage" }],
      })
    ).toBe(false);
  });

  it("allows a booking after an earlier appointment has ended", () => {
    expect(
      findScheduledProviderConflict({
        requestedStartTime: "15:00:00",
        requestedDurationMinutes: 60,
        bookings: [
          {
            start_time: "13:30:00",
            end_time: "14:30:00",
            status: "confirmed",
            hold_expires_at: null,
          },
        ],
        now: new Date("2026-07-22T00:00:00.000Z"),
      })
    ).toBeNull();
  });

  it("blocks only when the complete requested service window overlaps", () => {
    expect(
      findScheduledProviderConflict({
        requestedStartTime: "14:00:00",
        requestedDurationMinutes: 60,
        bookings: [
          {
            start_time: "13:30:00",
            end_time: "14:30:00",
            status: "confirmed",
            hold_expires_at: null,
          },
        ],
        now: new Date("2026-07-22T00:00:00.000Z"),
      })
    ).toEqual({
      startMinutes: 810,
      endMinutes: 870,
      nextAvailableAt: "2:30 PM",
    });
  });
});
