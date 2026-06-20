import { describe, expect, it } from "vitest";
import { replaceStaffServiceAssignmentRows } from "@/lib/staff/service-assignment-state";

describe("replaceStaffServiceAssignmentRows", () => {
  it("replaces one staff member's assignments without touching other staff", () => {
    const result = replaceStaffServiceAssignmentRows(
      [
        { staff_id: "staff-a", service_id: "service-old" },
        { staff_id: "staff-b", service_id: "service-b" },
      ],
      "staff-a",
      ["service-new", "service-extra"]
    );

    expect(result).toEqual([
      { staff_id: "staff-b", service_id: "service-b" },
      { staff_id: "staff-a", service_id: "service-new" },
      { staff_id: "staff-a", service_id: "service-extra" },
    ]);
  });

  it("deduplicates returned service IDs before updating local state", () => {
    const result = replaceStaffServiceAssignmentRows(
      [{ staff_id: "staff-a", service_id: "service-old" }],
      "staff-a",
      ["service-new", "service-new"]
    );

    expect(result).toEqual([{ staff_id: "staff-a", service_id: "service-new" }]);
  });

  it("clears only the edited staff member when the saved service list is empty", () => {
    const result = replaceStaffServiceAssignmentRows(
      [
        { staff_id: "staff-a", service_id: "service-old" },
        { staff_id: "staff-b", service_id: "service-b" },
      ],
      "staff-a",
      []
    );

    expect(result).toEqual([{ staff_id: "staff-b", service_id: "service-b" }]);
  });
});
