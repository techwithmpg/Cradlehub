import { describe, it, expect } from "vitest";
import {
  getBranchDateParts,
  minutesFromNow,
  hoursFromNow,
  bookingDateTimeToIso,
  runFollowUpRules,
  type FollowUpContext,
  type FollowUpRule,
} from "@/lib/agents/follow-up";

describe("follow-up helpers", () => {
  it("returns branch-local date parts for Asia/Manila", () => {
    const now = new Date("2026-06-20T06:30:00.000Z"); // 14:30 Manila
    const parts = getBranchDateParts(now, "Asia/Manila");
    expect(parts.ymd).toBe("2026-06-20");
    expect(parts.minutesIntoDay).toBeCloseTo(14 * 60 + 30, 0);
  });

  it("computes minutesFromNow", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");
    expect(minutesFromNow(now, 30)).toBe("2026-06-20T11:30:00.000Z");
  });

  it("computes hoursFromNow", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");
    expect(hoursFromNow(now, 2)).toBe("2026-06-20T10:00:00.000Z");
  });

  it("converts booking date + start time to ISO", () => {
    const iso = bookingDateTimeToIso("2026-06-20", "14:30");
    expect(iso).toBe("2026-06-20T06:30:00.000Z");
  });
});

describe("runFollowUpRules", () => {
  it("runs all rules and aggregates results", async () => {
    const ctx: FollowUpContext = {
      now: new Date("2026-06-20T12:00:00.000Z"),
      timezone: "Asia/Manila",
    };

    const rules: FollowUpRule[] = [
      { id: "rule_a", name: "Rule A", run: async () => ({ ruleId: "rule_a", triggered: 2, errors: 0 }) },
      { id: "rule_b", name: "Rule B", run: async () => ({ ruleId: "rule_b", triggered: 0, errors: 1 }) },
    ];

    const results = await runFollowUpRules(rules, ctx);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ ruleId: "rule_a", triggered: 2, errors: 0 });
    expect(results[1]).toEqual({ ruleId: "rule_b", triggered: 0, errors: 1 });
  });

  it("catches rule errors and reports them", async () => {
    const ctx: FollowUpContext = {
      now: new Date("2026-06-20T12:00:00.000Z"),
      timezone: "Asia/Manila",
    };

    const rules: FollowUpRule[] = [
      {
        id: "failing_rule",
        name: "Failing Rule",
        run: async () => {
          throw new Error("boom");
        },
      },
    ];

    const results = await runFollowUpRules(rules, ctx);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ ruleId: "failing_rule", triggered: 0, errors: 1 });
  });
});
