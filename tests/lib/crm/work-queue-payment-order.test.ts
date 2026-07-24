import { describe, expect, it } from "vitest";
import { getWorkQueueNextAction } from "@/lib/crm/work-queue-next-actions";

describe("legacy work queue payment ordering", () => {
  it("does not offer payment for a confirmed service", () => {
    const action = getWorkQueueNextAction({
      status: "confirmed",
      type: "walkin",
      paymentStatus: "pending",
      staffName: "Melrose",
      resourceName: "Room 1",
    });
    expect(action.primaryKind).toBe("status");
    expect(action.primaryLabel).toBe("Start service");
  });

  it("offers payment only after service completion", () => {
    const action = getWorkQueueNextAction({
      status: "completed",
      type: "walkin",
      paymentStatus: "pending",
      staffName: "Melrose",
      resourceName: "Room 1",
      bookingProgressStatus: "completed",
    });
    expect(action.primaryKind).toBe("payment");
    expect(action.primaryLabel).toBe("Collect payment");
  });
});
