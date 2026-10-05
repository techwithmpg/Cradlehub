import { describe, expect, it } from "vitest";
import { dutyWindowAt, shouldRemindHandover } from "./front-desk-duty-contract";
import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";

const closing = {
  status: "resolved",
  windows: [{ shiftType: "closing", startTime: "14:00", endTime: "22:00" }],
} as ResolvedStaffSchedule;

describe("Front Desk handover evidence", () => {
  it("requires a resolved duty window at the branch time", () => {
    expect(dutyWindowAt(closing, 15 * 60)?.shiftType).toBe("closing");
    expect(dutyWindowAt(closing, 9 * 60)).toBeNull();
    expect(dutyWindowAt(undefined, 15 * 60)).toBeNull();
  });

  it("reminds only incoming CRM staff in the same branch with another custodian", () => {
    const input = {
      role: "crm",
      staffId: "incoming",
      staffBranchId: "main",
      viewedBranchId: "main",
      scheduledNow: true,
      sessionBranchId: "main",
      custodianId: "outgoing",
    };
    expect(shouldRemindHandover(input)).toBe(true);
    expect(shouldRemindHandover({ ...input, role: "owner" })).toBe(false);
    expect(shouldRemindHandover({ ...input, scheduledNow: false })).toBe(false);
    expect(shouldRemindHandover({ ...input, sessionBranchId: "other" })).toBe(false);
    expect(shouldRemindHandover({ ...input, staffBranchId: "other" })).toBe(false);
    expect(shouldRemindHandover({ ...input, custodianId: "incoming" })).toBe(false);
  });
});
