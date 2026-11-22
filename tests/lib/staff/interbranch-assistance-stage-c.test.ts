import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const createNotification = vi.fn();
  const updateCalls: Array<{ table: string; payload: Record<string, unknown>; eqs: Record<string, unknown> }> = [];
  let scanAssignmentRow: Record<string, unknown> | null = null;
  let activeReceivingRows: Array<Record<string, unknown>> = [];

  const mockDb = {
    from: vi.fn((table: string) => {
      const eqs: Record<string, unknown> = {};
      const ins: Record<string, unknown[]> = {};
      let mode: "select" | "update" = "select";
      let updatePayload: Record<string, unknown> = {};

      const chain = {
        select: vi.fn(() => {
          mode = "select";
          return chain;
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          mode = "update";
          updatePayload = payload;
          return chain;
        }),
        eq: vi.fn((col: string, val: unknown) => {
          eqs[col] = val;
          if (
            mode === "update" &&
            ((table === "staff_assistance_assignments" && col === "status" && val === "arrived_clocked_in") ||
              (table === "staff_assistance_assignments" && col === "id"))
          ) {
            updateCalls.push({ table, payload: updatePayload, eqs: { ...eqs } });
          }
          return chain;
        }),
        in: vi.fn((col: string, vals: unknown[]) => {
          ins[col] = vals;
          if (mode === "update") {
            updateCalls.push({ table, payload: updatePayload, eqs: { ...eqs, [col]: vals } });
            return Promise.resolve({ error: null });
          }
          return chain;
        }),
        gte: vi.fn(() => {
          if (mode === "update") {
            updateCalls.push({ table, payload: updatePayload, eqs: { ...eqs } });
            return Promise.resolve({ error: null });
          }
          return chain;
        }),
        order: vi.fn(async () => ({
          data: scanAssignmentRow ? [scanAssignmentRow] : [],
          error: null,
        })),
        then: (resolve: (val: unknown) => void) =>
          resolve({
            data: table === "staff_assistance_assignments" ? activeReceivingRows : [],
            error: null,
          }),
      };
      return chain;
    }),
  };

  return {
    createNotification,
    updateCalls,
    mockDb,
    setScanAssignmentRow: (row: Record<string, unknown> | null) => {
      scanAssignmentRow = row;
    },
    setActiveReceivingRows: (rows: Array<Record<string, unknown>>) => {
      activeReceivingRows = rows;
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.mockDb,
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: mocks.createNotification,
}));

import {
  assistanceAssignmentScheduleForWindow,
  syncAssistanceAssignmentsOnScan,
} from "@/lib/staff/interbranch-assistance-eligibility";
import { assessSelectedStaffHardEligibility } from "@/lib/bookings/selected-staff-preference";

const migrationSql = readFileSync(
  "supabase/migrations/20261122120000_interbranch_assistance_stage_c.sql",
  "utf8"
);
const scanEngineSource = readFileSync("src/lib/attendance/scan-engine.ts", "utf8");
const availabilitySource = readFileSync("src/lib/engine/availability.ts", "utf8");
const exactCrmSource = readFileSync("src/lib/engine/exact-crm-booking-time.ts", "utf8");

describe("Inter-branch Staff Assistance Stage C", () => {
  beforeEach(() => {
    mocks.createNotification.mockReset();
    mocks.updateCalls.length = 0;
    mocks.setScanAssignmentRow(null);
    mocks.setActiveReceivingRows([]);
  });

  it("defines Stage C schema, approval trigger, QR branch guard, and bookable slot RPC", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.staff_assistance_assignments");
    expect(migrationSql).toContain("seed_assistance_assignments_on_approval()");
    expect(migrationSql).toContain("'assistance_home_clock_out_required'::text");
    expect(migrationSql).toContain("'interbranch_assistance'::text");
    expect(migrationSql).toContain("aa.status = 'arrived_clocked_in'");
    expect(migrationSql).toContain("borrowed_staff_hours AS");
  });

  it("maps Manila shift windows accurately including cross-midnight bounds", () => {
    const dayShift = assistanceAssignmentScheduleForWindow({
      id: "assign-1",
      startAt: "2026-11-22T14:00:00+08:00",
      endAt: "2026-11-22T22:00:00+08:00",
    });
    expect(dayShift.startTime).toBe("14:00:00");
    expect(dayShift.endTime).toBe("22:00:00");
    expect(dayShift.endsNextDay).toBe(false);
    expect(dayShift.schedule.isWorking).toBe(true);

    const overnight = assistanceAssignmentScheduleForWindow({
      id: "assign-2",
      startAt: "2026-11-22T20:00:00+08:00",
      endAt: "2026-11-23T02:00:00+08:00",
    });
    expect(overnight.startTime).toBe("20:00:00");
    expect(overnight.endTime).toBe("02:00:00");
    expect(overnight.endsNextDay).toBe(true);
    expect(overnight.schedule.state).toBe("VALID_OVERNIGHT_SHIFT");
  });

  it("transitions borrowed staff on receiving clock-in and notifies receiving CRM", async () => {
    mocks.setScanAssignmentRow({
      id: "assign-1",
      request_id: "req-1",
      staff_id: "staff-1",
      home_branch_id: "main-branch",
      receiving_branch_id: "sm-branch",
      requested_role: "therapist",
      visit_type: "in_spa",
      start_at: "2026-11-22T14:00:00+08:00",
      end_at: "2026-11-22T22:00:00+08:00",
      assistance_date: "2026-11-22",
      status: "home_clocked_out",
      home_clocked_out_at: "2026-11-22T13:30:00+08:00",
      receiving_checkin_id: null,
      arrived_clocked_in_at: null,
      completed_at: null,
    });

    await syncAssistanceAssignmentsOnScan({
      staffId: "staff-1",
      scannedBranchId: "sm-branch",
      action: "clock_in",
      checkinId: "checkin-sm-1",
      isTest: false,
      staffName: "Alice",
      receivingBranchName: "SM Branch",
      nowIso: "2026-11-22T13:50:00+08:00",
      supabase: mocks.mockDb as never,
    });

    expect(mocks.updateCalls[0]?.payload).toMatchObject({
      status: "arrived_clocked_in",
      receiving_checkin_id: "checkin-sm-1",
    });
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "sm-branch",
        targetWorkspace: "crm",
        entityType: "staff_assistance_request",
        entityId: "req-1",
      })
    );
  });

  it("marks receiving-branch assignment completed on receiving clock-out and updates home clock-out", async () => {
    mocks.setActiveReceivingRows([{ id: "assign-1" }]);
    await syncAssistanceAssignmentsOnScan({
      staffId: "staff-1",
      scannedBranchId: "sm-branch",
      action: "clock_out",
      checkinId: "checkin-sm-1",
      isTest: false,
      staffName: "Alice",
      receivingBranchName: "SM Branch",
      nowIso: "2026-11-22T22:05:00+08:00",
      supabase: mocks.mockDb as never,
    });
    expect(mocks.updateCalls[0]?.payload).toMatchObject({
      status: "completed",
    });

    mocks.updateCalls.length = 0;
    mocks.setActiveReceivingRows([]);
    await syncAssistanceAssignmentsOnScan({
      staffId: "staff-1",
      scannedBranchId: "main-branch",
      action: "clock_out",
      checkinId: "checkin-main-1",
      isTest: false,
      staffName: "Alice",
      receivingBranchName: "Main Spa",
      nowIso: "2026-11-22T13:00:00+08:00",
      supabase: mocks.mockDb as never,
    });
    expect(mocks.updateCalls[0]?.payload).toMatchObject({
      status: "home_clocked_out",
    });
  });

  it("allows selected borrowed therapist only when hasActiveBranchAssistance is true", () => {
    const baseStaff = {
      id: "staff-1",
      branchId: "main-branch",
      isActive: true,
      archivedAt: null,
      mergedIntoStaffId: null,
      isServiceProvider: true,
      qualifiedServiceIds: ["srv-1"],
    };

    expect(
      assessSelectedStaffHardEligibility({
        branchId: "sm-branch",
        serviceIds: ["srv-1"],
        staff: baseStaff,
      })
    ).toMatchObject({ kind: "hard_block", code: "selected_staff_wrong_branch" });

    expect(
      assessSelectedStaffHardEligibility({
        branchId: "sm-branch",
        serviceIds: ["srv-1"],
        staff: { ...baseStaff, hasActiveBranchAssistance: true },
      })
    ).toBeNull();
  });

  it("enforces home clock-out guard in scan-engine and arrived-only bookability in availability engines", () => {
    expect(scanEngineSource).toContain("assistance_home_clock_out_required");
    expect(scanEngineSource).toContain("Clock out from your home branch first");
    expect(availabilitySource).toContain('statuses: ["arrived_clocked_in"]');
    expect(exactCrmSource).toContain('statuses: ["arrived_clocked_in"]');
    // Exact availability bookings query must not scope only to params.branchId so cross-branch double-bookings are caught
    expect(exactCrmSource).not.toContain(
      `.from("bookings")\n      .select(\n        "staff_id, start_time, end_time, status, hold_expires_at, delivery_type, travel_buffer_mins"\n      )\n      .eq("branch_id", params.branchId)`
    );
  });
});
