import { describe, expect, it } from "vitest";
import { findDistinctStaffAssignment } from "./staff-assignment";

describe("group therapist matching", () => {
  it("measures infeasible dense groups", () => {
    for (const guests of [7, 8, 9, 10, 25, 50]) {
      const candidates = Array.from({ length: guests }, () =>
        Array.from({ length: guests - 1 }, (_, index) => `staff-${index}`)
      );
      const started = performance.now();
      expect(findDistinctStaffAssignment(candidates)).toBeNull();
      console.info(`group-matching ${guests} guests: ${(performance.now() - started).toFixed(2)} ms`);
    }
  });

  it("assigns each guest a distinct qualified therapist for a large group", () => {
    const candidates = Array.from({ length: 50 }, (_, guest) =>
      guest === 49 ? ["staff-0"] : Array.from({ length: 50 }, (_, staff) => `staff-${staff}`)
    );
    const assignment = findDistinctStaffAssignment(candidates);
    expect(assignment).toHaveLength(50);
    expect(new Set(assignment).size).toBe(50);
    assignment?.forEach((staffId, guest) => expect(candidates[guest]).toContain(staffId));
  });
});
