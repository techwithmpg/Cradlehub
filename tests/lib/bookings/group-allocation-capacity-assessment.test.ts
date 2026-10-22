import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { findDistinctStaffAssignment } from "@/lib/engine/availability";

describe("bounded group allocation source assessment", () => {
  it.each([5, 10, 20])("finds distinct staff for %i concurrent guests with overlapping candidates", (size) => {
    const candidates = Array.from({ length: size }, (_, index) =>
      index === 0 ? ["staff-0"] : ["staff-0", `staff-${index}`]
    );
    const samples: number[] = [];
    for (let repetition = 0; repetition < 100; repetition += 1) {
      const started = performance.now();
      const assignment = findDistinctStaffAssignment(candidates);
      samples.push(performance.now() - started);
      expect(assignment).toHaveLength(size);
      expect(new Set(assignment).size).toBe(size);
    }
    const ordered = samples.sort((a, b) => a - b);
    console.info(
      `Pure staff matcher ${size}: p50=${ordered[49]!.toFixed(3)}ms p95=${ordered[94]!.toFixed(3)}ms over 100 runs`
    );
  });
});
