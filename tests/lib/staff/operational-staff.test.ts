import { describe, expect, it } from "vitest";
import { isOperationalStaff } from "@/lib/staff/operational-staff";

const activeStaff = {
  is_active: true,
  archived_at: null,
  merged_into_staff_id: null,
  metadata: {},
};

describe("isOperationalStaff", () => {
  it("allows active unarchived staff without requiring an auth account", () => {
    expect(isOperationalStaff(activeStaff)).toBe(true);
  });

  it("excludes inactive, archived, and merged source profiles", () => {
    expect(isOperationalStaff({ ...activeStaff, is_active: false })).toBe(false);
    expect(isOperationalStaff({ ...activeStaff, archived_at: "2026-07-12T00:00:00Z" })).toBe(false);
    expect(
      isOperationalStaff({
        ...activeStaff,
        merged_into_staff_id: "16add1a6-1843-4b34-ac00-d98c64f09dd0",
      })
    ).toBe(false);
  });

  it("excludes explicit test and non-schedulable metadata flags", () => {
    expect(isOperationalStaff({ ...activeStaff, metadata: { is_test: true } })).toBe(false);
    expect(isOperationalStaff({ ...activeStaff, metadata: { test: "yes" } })).toBe(false);
    expect(isOperationalStaff({ ...activeStaff, metadata: { is_schedulable: false } })).toBe(false);
    expect(isOperationalStaff({ ...activeStaff, metadata: { schedulable: "no" } })).toBe(false);
    expect(isOperationalStaff({ ...activeStaff, metadata: { non_schedulable: "true" } })).toBe(false);
  });
});
