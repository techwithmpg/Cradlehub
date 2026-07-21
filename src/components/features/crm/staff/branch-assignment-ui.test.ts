import { describe, expect, it } from "vitest";
import {
  branchAssignmentResolutionForDecision,
  localIsoDate,
  temporaryBranchWindow,
} from "./branch-assignment-ui";

describe("branch assignment UI decisions", () => {
  it("maps permanent transfer to the authoritative resolver", () => {
    expect(branchAssignmentResolutionForDecision("permanent_transfer")).toBe(
      "correct_permanent_primary_branch"
    );
  });

  it("maps temporary decisions to temporary branch access", () => {
    expect(branchAssignmentResolutionForDecision("temporary_shift")).toBe(
      "grant_temporary_branch_access"
    );
    expect(branchAssignmentResolutionForDecision("temporary_day")).toBe(
      "grant_temporary_branch_access"
    );
  });

  it("creates a bounded shift window", () => {
    const now = new Date("2026-07-16T08:00:00.000Z");
    const window = temporaryBranchWindow("temporary_shift", now);

    expect(window.validFrom).toBe(now.toISOString());
    expect(new Date(window.validUntil).getTime() - now.getTime()).toBe(
      12 * 60 * 60 * 1000
    );
    expect(window.temporaryScope).toBe("shift");
  });

  it("formats local effective dates without UTC truncation", () => {
    const localDate = new Date(2026, 6, 16, 23, 30, 0);
    expect(localIsoDate(localDate)).toBe("2026-07-16");
  });
});
