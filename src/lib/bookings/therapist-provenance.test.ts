import { describe, expect, it } from "vitest";
import { bookingCreationProvenance, therapistProvenanceBadge } from "./therapist-provenance";
import { createInhouseBookingMultiSchema } from "@/lib/validations/booking";

const maria = "6a7f8743-a9c4-4d0a-b6f1-6c43d9e40b35";
const anna = "e64740ad-40b6-45e5-bd0a-9a20d22e30cb";

describe("therapist provenance per service line", () => {
  it("records public and CRM first-available assignments as automatic", () => {
    for (const selectedBy of ["customer", "front_desk"] as const) {
      const line = bookingCreationProvenance({ assignedStaffId: anna, selectedBy });
      expect(line).toEqual({ requested_staff_id: null, therapist_selection_source: "system_assigned" });
      expect(therapistProvenanceBadge({ staff_id: anna, ...line })).toBe("auto_assigned");
    }
  });

  it("labels only an exact customer choice and retains a different requested therapist", () => {
    const exact = bookingCreationProvenance({ selectedStaffId: maria, assignedStaffId: maria, selectedBy: "customer" });
    expect(exact).toEqual({ requested_staff_id: maria, therapist_selection_source: "customer_selected" });
    expect(therapistProvenanceBadge({ staff_id: maria, ...exact })).toBe("customer_choice");

    const fallback = bookingCreationProvenance({ selectedStaffId: maria, assignedStaffId: anna, selectedBy: "customer" });
    expect(fallback).toEqual({ requested_staff_id: maria, therapist_selection_source: "system_assigned" });
    expect(therapistProvenanceBadge({ staff_id: anna, ...fallback })).toBe("auto_assigned");
    expect(therapistProvenanceBadge({ staff_id: anna, ...exact })).toBeNull();
  });

  it("does not label a front-desk choice as customer choice or auto assignment", () => {
    const line = bookingCreationProvenance({ selectedStaffId: maria, assignedStaffId: maria, selectedBy: "front_desk" });
    expect(line).toEqual({ requested_staff_id: null, therapist_selection_source: "front_desk_selected" });
    expect(therapistProvenanceBadge({ staff_id: maria, ...line })).toBeNull();
  });

  it("keeps mixed guests independent and leaves legacy rows unlabelled", () => {
    const first = bookingCreationProvenance({ selectedStaffId: maria, assignedStaffId: maria, selectedBy: "customer" });
    const second = bookingCreationProvenance({ assignedStaffId: anna, selectedBy: "customer" });
    expect(therapistProvenanceBadge({ staff_id: maria, ...first })).toBe("customer_choice");
    expect(therapistProvenanceBadge({ staff_id: anna, ...second })).toBe("auto_assigned");
    expect(therapistProvenanceBadge({ staff_id: maria, requested_staff_id: null, therapist_selection_source: "legacy_unknown" })).toBeNull();
  });

  it("rejects a CRM customer-request claim without an explicit therapist", () => {
    const result = createInhouseBookingMultiSchema.safeParse({
      serviceIds: [maria],
      customerRequestedTherapist: true,
      date: "2026-10-20",
      startTime: "10:00:00",
      fullName: "Ana Cruz",
      phone: "09171234567",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "staffId")).toBe(true);
    }
  });
});
