import { describe, expect, it } from "vitest";
import {
  databaseShiftToUi,
  getDatabaseShiftLabel,
  getScheduleShiftLabel,
  uiShiftToDatabase,
} from "@/lib/schedule/schedule-domain";

describe("schedule-domain shift adapters", () => {
  it("keeps database single mapped to the Regular Shift UI label", () => {
    expect(databaseShiftToUi("single")).toBe("regular");
    expect(databaseShiftToUi(null)).toBe("regular");
    expect(uiShiftToDatabase("regular")).toBe("single");
    expect(getDatabaseShiftLabel("single")).toBe("Regular Shift");
    expect(getScheduleShiftLabel("regular")).toBe("Regular Shift");
  });

  it("passes opening and closing through without relabeling", () => {
    expect(databaseShiftToUi("opening")).toBe("opening");
    expect(databaseShiftToUi("closing")).toBe("closing");
    expect(uiShiftToDatabase("opening")).toBe("opening");
    expect(uiShiftToDatabase("closing")).toBe("closing");
  });
});
