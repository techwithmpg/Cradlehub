import { describe, expect, it } from "vitest";
import { getWorkQueueNextAction } from "@/lib/crm/work-queue-next-actions";

describe("CRM work queue staff schedule exception", () => {
  it("prioritizes staff review without changing the booking lifecycle status", () => {
    const action = getWorkQueueNextAction({
      status: "confirmed",
      type: "online",
      paymentStatus: "paid",
      staffName: "Maria Santos",
      resourceName: "Room 1",
      needsStaffScheduleReview: true,
      staffScheduleExceptionLabel: "Outside scheduled shift",
    });

    expect(action).toMatchObject({
      category: "exception",
      instruction: "Review the customer-selected staff preference.",
      primaryKind: "booking",
      primaryLabel: "Review booking",
    });
    expect(action.detail).toContain("Outside scheduled shift");
  });
});
