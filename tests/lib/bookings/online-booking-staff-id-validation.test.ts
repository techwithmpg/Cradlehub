import { describe, expect, it } from "vitest";
import { createOnlineBookingMultiSchema } from "@/lib/validations/booking";

function futureDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

describe("online booking selected staff ID validation", () => {
  it("rejects a malformed or tampered staff ID before booking logic runs", () => {
    const result = createOnlineBookingMultiSchema.safeParse({
      branchId: "00000000-0000-4000-8000-000000000031",
      serviceIds: ["00000000-0000-4000-8000-000000000011"],
      staffId: "../../another-tenant/staff",
      date: futureDate(),
      startTime: "10:00:00",
      type: "online",
      fullName: "Ana Cruz",
      phone: "09171234567",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "staffId")).toBe(
        true
      );
    }
  });
});
