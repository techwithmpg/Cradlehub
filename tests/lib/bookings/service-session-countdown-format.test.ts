import { describe, expect, it } from "vitest";
import { fmtServiceSecs } from "@/lib/bookings/service-session";

describe("staff service countdown format", () => {
  it("keeps hours visible for an hour-long session after less than an hour remains", () => {
    expect(fmtServiceSecs(3600, "", true)).toBe("01:00:00");
    expect(fmtServiceSecs(3599, "", true)).toBe("00:59:59");
    expect(fmtServiceSecs(45 * 60)).toBe("45:00");
  });
});
