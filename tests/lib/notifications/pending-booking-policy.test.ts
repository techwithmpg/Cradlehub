import { describe, expect, it } from "vitest";
import {
  PENDING_CRM_REMINDER_MS,
  pendingBookingPresentation,
  scheduleCoversLocalMinute,
} from "@/lib/notifications/pending-booking-policy";

const single = {
  ok: true,
  onDuty: true,
  pendingCount: 1,
  first: {
    id: "booking-1",
    bookingDate: "2026-11-10",
    startTime: "10:30",
    createdAt: "2026-11-09T16:15:00Z",
    customerName: "Customer",
    serviceName: "Service",
  },
};
const options = { now: 1_000_000, lastPresentedAt: null, safeToInterrupt: true };

describe("P1 pending CRM booking alert policy", () => {
  it("queues silently when no CSR is scheduled", () => {
    expect(pendingBookingPresentation({ ...single, onDuty: false }, options)).toBe("none");
  });
  it("opens a single request on duty or after the repeat interval", () => {
    expect(pendingBookingPresentation(single, options)).toBe("single");
    expect(pendingBookingPresentation(single, { ...options, lastPresentedAt: options.now - PENDING_CRM_REMINDER_MS + 1 })).toBe("none");
    expect(pendingBookingPresentation(single, { ...options, lastPresentedAt: options.now - PENDING_CRM_REMINDER_MS })).toBe("single");
  });
  it("groups multiple requests without popup floods", () => {
    expect(pendingBookingPresentation({ ...single, pendingCount: 2 }, options)).toBe("group");
    expect(pendingBookingPresentation({ ...single, pendingCount: 10 }, options)).toBe("group");
  });
  it("respects critical dialogs and failed snapshots", () => {
    expect(pendingBookingPresentation(single, { ...options, safeToInterrupt: false })).toBe("none");
    expect(pendingBookingPresentation({ ...single, ok: false }, options)).toBe("none");
    expect(pendingBookingPresentation({ ...single, pendingCount: 0 }, options)).toBe("none");
  });
  it("handles split, overnight, missing and day-off shifts", () => {
    const overnight = { status: "resolved" as const, windows: [{ shiftType: "closing" as const, startTime: "17:00", endTime: "01:00", endsNextDay: true }] };
    expect(scheduleCoversLocalMinute(overnight, 0, true)).toBe(true);
    expect(scheduleCoversLocalMinute(overnight, 60, true)).toBe(false);
    expect(scheduleCoversLocalMinute(overnight, 23 * 60)).toBe(true);
    expect(scheduleCoversLocalMinute({ ...overnight, status: "day_off" }, 23 * 60)).toBe(false);
    expect(scheduleCoversLocalMinute(undefined, 10 * 60)).toBe(false);
    const split = { status: "resolved" as const, windows: [
      { shiftType: "opening" as const, startTime: "10:00", endTime: "13:00" },
      { shiftType: "closing" as const, startTime: "17:00", endTime: "23:00" },
    ] };
    expect(scheduleCoversLocalMinute(split, 11 * 60)).toBe(true);
    expect(scheduleCoversLocalMinute(split, 14 * 60)).toBe(false);
  });
});
