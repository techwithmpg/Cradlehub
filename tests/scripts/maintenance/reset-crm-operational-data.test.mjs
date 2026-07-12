import { describe, expect, it } from "vitest";
import {
  assertNoProtectedDeletes,
  buildApplySql,
  buildDryRunSql,
  expectedConfirmationToken,
  hasSqlMutation,
  shouldDeleteActivationToken,
  shouldDeleteStaffDevice,
  shouldPreserveStaffDevice,
  validateApplyRequest,
} from "../../../scripts/maintenance/reset-crm-operational-data.mjs";

describe("CRM operational reset maintenance safety", () => {
  it("preserves active attendance devices and excludes invalid devices from preservation", () => {
    expect(
      shouldPreserveStaffDevice({
        status: "active",
        revoked_at: null,
      })
    ).toBe(true);
    expect(
      shouldDeleteStaffDevice({
        status: "active",
        revoked_at: null,
      })
    ).toBe(false);

    expect(
      shouldPreserveStaffDevice({
        status: "revoked",
        revoked_at: "2026-07-10T01:00:00.000Z",
      })
    ).toBe(false);
    expect(
      shouldDeleteStaffDevice({
        status: "revoked",
        revoked_at: "2026-07-10T01:00:00.000Z",
      })
    ).toBe(true);
  });

  it("classifies only expired, used, or revoked activation tokens for deletion", () => {
    const now = new Date("2026-07-11T00:00:00.000Z");

    expect(
      shouldDeleteActivationToken(
        {
          expires_at: "2026-07-10T23:59:59.000Z",
          used_at: null,
          revoked_at: null,
        },
        now
      )
    ).toBe(true);
    expect(
      shouldDeleteActivationToken(
        {
          expires_at: "2026-07-12T00:00:00.000Z",
          used_at: "2026-07-10T01:00:00.000Z",
          revoked_at: null,
        },
        now
      )
    ).toBe(true);
    expect(
      shouldDeleteActivationToken(
        {
          expires_at: "2026-07-12T00:00:00.000Z",
          used_at: null,
          revoked_at: null,
        },
        now
      )
    ).toBe(false);
  });

  it("keeps dry-run SQL read-only", () => {
    expect(hasSqlMutation(buildDryRunSql({ branch: "all" }))).toBe(false);
    expect(hasSqlMutation(buildDryRunSql({ branch: "branch-a" }))).toBe(false);
  });

  it("requires the exact confirmation token for apply mode", () => {
    const expectedToken = expectedConfirmationToken({
      projectRef: "projectref",
      branch: "all",
      date: new Date("2026-07-11T00:00:00.000Z"),
    });

    expect(expectedToken).toBe("RESET-CRM-projectref-all-20260711");
    expect(() =>
      validateApplyRequest({
        mode: "apply",
        confirmation: "wrong-token",
        expectedToken,
      })
    ).toThrow(/requires --confirmation/);
    expect(() =>
      validateApplyRequest({
        mode: "apply",
        confirmation: expectedToken,
        expectedToken,
      })
    ).not.toThrow();
  });

  it("never deletes weekly staff schedules in the apply SQL", () => {
    const sql = buildApplySql({ branch: "branch-a" });

    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.staff_schedules\b/i);
    expect(sql).not.toMatch(/\btruncate\s+table\s+public\.staff_schedules\b/i);
    expect(() => assertNoProtectedDeletes(sql)).not.toThrow();
  });

  it("scopes branch apply SQL to the requested branch", () => {
    const sql = buildApplySql({ branch: "branch-a" });

    expect(sql).toContain("where id = 'branch-a'");
    expect(sql).not.toContain("branch-b");
    expect(sql).toContain("status <> 'active' or revoked_at is not null");
  });
});
