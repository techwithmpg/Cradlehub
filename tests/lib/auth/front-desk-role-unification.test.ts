import { describe, expect, it } from "vitest";

import {
  FRONT_DESK_ROLE_ALIASES,
  SYSTEM_ROLE_OPTIONS,
  canonicalizeSystemRole,
  isFrontDeskRole,
} from "@/constants/staff";
import {
  canCancelBooking,
  canReassignBooking,
  canAdjustStaffSchedule,
  canReviewStaffOnboarding,
} from "@/lib/permissions";
import {
  canConfirmPayments,
  canManageCrmSetup,
  canManageOperationalStaff,
  canManageResources,
  canManageStaffAssignments,
  canManageStaffServices,
  canUpdateServiceVisibility,
} from "@/lib/auth/crm-permissions";

describe("Front Desk role unification", () => {
  it("canonicalizes every legacy Front Desk system role to crm", () => {
    for (const role of FRONT_DESK_ROLE_ALIASES) {
      expect(isFrontDeskRole(role)).toBe(true);
      expect(canonicalizeSystemRole(role)).toBe("crm");
    }
  });

  it("removes legacy Front Desk aliases from selectable system roles", () => {
    const optionValues = SYSTEM_ROLE_OPTIONS.map((option) => option.value);

    expect(optionValues).toContain("crm");
    expect(optionValues).not.toContain("csr");
    expect(optionValues).not.toContain("csr_head");
    expect(optionValues).not.toContain("csr_staff");
  });

  it("grants equal CRM workspace capabilities to all Front Desk aliases", () => {
    for (const role of FRONT_DESK_ROLE_ALIASES) {
      expect(canConfirmPayments(role)).toBe(true);
      expect(canManageCrmSetup(role)).toBe(true);
      expect(canManageOperationalStaff(role)).toBe(true);
      expect(canManageStaffAssignments(role)).toBe(true);
      expect(canManageStaffServices(role)).toBe(true);
      expect(canUpdateServiceVisibility(role)).toBe(true);
      expect(canManageResources(role)).toBe(true);
    }
  });

  it("grants equal booking and schedule permissions to all Front Desk aliases", () => {
    for (const role of FRONT_DESK_ROLE_ALIASES) {
      expect(canCancelBooking(role)).toBe(true);
      expect(canReassignBooking(role)).toBe(true);
      expect(canAdjustStaffSchedule(role)).toBe(true);
      expect(canReviewStaffOnboarding(role)).toBe(true);
    }
  });
});
