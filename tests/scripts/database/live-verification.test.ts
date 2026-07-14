import { describe, expect, it, vi } from "vitest";

import {
  compareUiAndDatabaseState,
  identifyQaRecord,
  sanitizeVerificationError,
  verifyTableExists,
  waitForDatabaseCondition,
} from "../../../scripts/database/live-verification.mjs";

describe("live database verification helpers", () => {
  it("recognizes only records belonging to the exact QA run", () => {
    expect(identifyQaRecord({ metadata: { qa_run_id: "qa-1" } }, "qa-1")).toBe(true);
    expect(identifyQaRecord({ notes: "QA_RUN:qa-2" }, "qa-1")).toBe(false);
  });

  it("reports table readability and exact UI/database comparisons", () => {
    expect(verifyTableExists([{ table: "bookings", readable: true }], "bookings")).toBe(true);
    expect(compareUiAndDatabaseState(3, 3)).toEqual({ matches: true, uiValue: 3, databaseValue: 3 });
  });

  it("sanitizes connection failure categories", () => {
    expect(sanitizeVerificationError({ stderr: "connection timeout", stdout: "", error: "" })).toBe(
      "Live database connection timed out.",
    );
    expect(sanitizeVerificationError({ stderr: "password authentication failed", stdout: "", error: "" })).toBe(
      "Live database authentication failed.",
    );
  });

  it("waits for a bounded database condition", async () => {
    vi.useFakeTimers();
    let ready = false;
    const pending = waitForDatabaseCondition(() => ready, { timeoutMs: 1_000, intervalMs: 100 });
    ready = true;
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe(true);
    vi.useRealTimers();
  });
});
