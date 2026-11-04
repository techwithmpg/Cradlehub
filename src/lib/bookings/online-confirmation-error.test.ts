import { describe, expect, it } from "vitest";
import { onlineConfirmationErrorMessage } from "./online-confirmation-error";

describe("online confirmation capacity errors", () => {
  it("explains the room count without exposing SQL", () => {
    expect(
      onlineConfirmationErrorMessage({
        message: "BOOKING_ROOM_CAPACITY_UNAVAILABLE",
        details: "available=8;required=12",
      })
    ).toBe(
      "Only 8 treatment spaces remain available at the requested time. Your group requires 12. Please choose another time."
    );
  });

  it("reports changed therapist capability and schedule", () => {
    expect(onlineConfirmationErrorMessage({ message: "BOOKING_STAFF_NOT_QUALIFIED" })).toContain(
      "no longer qualified"
    );
    expect(
      onlineConfirmationErrorMessage({ message: "BOOKING_STAFF_SCHEDULE_UNAVAILABLE" })
    ).toContain("no longer scheduled");
  });

  it("does not expose unexpected database diagnostics", () => {
    expect(onlineConfirmationErrorMessage({ message: "private SQL detail" })).not.toContain(
      "private SQL detail"
    );
  });
});
