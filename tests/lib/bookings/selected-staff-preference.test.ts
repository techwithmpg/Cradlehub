import { describe, expect, it } from "vitest";
import { resolveScheduleForStaffDay } from "@/lib/schedule/resolve-staff-schedule";
import {
  assessSelectedStaffPreference,
  type SelectedStaffPreferenceInput,
} from "@/lib/bookings/selected-staff-preference";

const SERVICE_ID = "00000000-0000-4000-8000-000000000011";
const STAFF_ID = "00000000-0000-4000-8000-000000000021";
const BRANCH_ID = "00000000-0000-4000-8000-000000000031";

function workingSchedule(startTime = "09:00:00", endTime = "18:00:00") {
  return resolveScheduleForStaffDay({
    individualRows: [
      {
        id: "schedule-1",
        shift_type: "single",
        start_time: startTime,
        end_time: endTime,
        is_active: true,
      },
    ],
  });
}

function input(
  overrides: Partial<SelectedStaffPreferenceInput> = {}
): SelectedStaffPreferenceInput {
  return {
    branchId: BRANCH_ID,
    serviceIds: [SERVICE_ID],
    startTime: "10:00:00",
    endTime: "11:00:00",
    staff: {
      id: STAFF_ID,
      branchId: BRANCH_ID,
      isActive: true,
      archivedAt: null,
      mergedIntoStaffId: null,
      isServiceProvider: true,
      qualifiedServiceIds: [SERVICE_ID],
    },
    schedule: workingSchedule(),
    blockedPeriods: [],
    bookings: [],
    now: new Date("2026-07-13T01:00:00.000Z"),
    ...overrides,
  };
}

describe("assessSelectedStaffPreference", () => {
  it("allows active, qualified, schedule-compatible selected staff without an exception", () => {
    expect(assessSelectedStaffPreference(input())).toEqual({
      kind: "allowed",
      exceptionReason: null,
    });
  });

  it("treats adjacent schedule windows as continuous booking coverage", () => {
    const schedule = resolveScheduleForStaffDay({
      individualRows: [
        { shift_type: "opening", start_time: "10:00", end_time: "17:00", is_active: true },
        {
          shift_type: "closing",
          start_time: "17:00",
          end_time: "01:30",
          is_active: true,
          ends_next_day: true,
        },
      ],
    });

    expect(
      assessSelectedStaffPreference(
        input({
          startTime: "16:00:00",
          endTime: "18:00:00",
          schedule,
        })
      )
    ).toEqual({ kind: "allowed", exceptionReason: null });
  });

  it.each([
    ["selected_staff_not_found", { staff: null }],
    ["selected_staff_inactive", { staff: { ...input().staff!, isActive: false } }],
    [
      "selected_staff_archived",
      { staff: { ...input().staff!, archivedAt: "2026-07-01T00:00:00.000Z" } },
    ],
    [
      "selected_staff_wrong_branch",
      { staff: { ...input().staff!, branchId: "00000000-0000-4000-8000-000000000099" } },
    ],
    ["selected_staff_not_qualified", { staff: { ...input().staff!, qualifiedServiceIds: [] } }],
    ["selected_staff_not_qualified", { staff: { ...input().staff!, isServiceProvider: false } }],
  ])("keeps %s as a hard blocker", (code, overrides) => {
    const result = assessSelectedStaffPreference(input(overrides));
    expect(result.kind).toBe("hard_block");
    if (result.kind === "hard_block") {
      expect(result.code).toBe(code);
      expect(result.message).not.toMatch(/schedule|inactive|archived|branch|qualified/i);
    }
  });

  it.each([
    [
      "selected_staff_off_day",
      {
        schedule: resolveScheduleForStaffDay({
          individualRows: [
            {
              shift_type: "single",
              start_time: null,
              end_time: null,
              is_active: false,
            },
          ],
        }),
      },
    ],
    [
      "selected_staff_missing_schedule",
      { schedule: resolveScheduleForStaffDay({ individualRows: [] }) },
    ],
    ["selected_staff_outside_shift", { schedule: workingSchedule("12:00:00", "18:00:00") }],
    [
      "selected_staff_blocked",
      {
        blockedPeriods: [{ startTime: "10:30:00", endTime: "11:30:00", reason: "training" }],
      },
    ],
    [
      "selected_staff_on_leave",
      {
        blockedPeriods: [{ startTime: "09:00:00", endTime: "17:00:00", reason: "leave" }],
      },
    ],
    [
      "selected_staff_booking_overlap",
      {
        bookings: [
          {
            startTime: "10:30:00",
            endTime: "11:30:00",
            status: "confirmed",
            holdExpiresAt: null,
          },
        ],
      },
    ],
    [
      "selected_staff_schedule_override",
      {
        schedule: resolveScheduleForStaffDay({
          override: {
            id: "override-1",
            shift_type: "single",
            is_day_off: false,
            start_time: "09:00:00",
            end_time: "18:00:00",
          },
          individualRows: [],
        }),
      },
    ],
  ])("allows booking creation with %s as a soft exception", (reason, overrides) => {
    expect(assessSelectedStaffPreference(input(overrides))).toEqual({
      kind: "allowed",
      exceptionReason: reason,
    });
  });

  it("does not treat an expired pending-payment hold as a booking overlap", () => {
    expect(
      assessSelectedStaffPreference(
        input({
          bookings: [
            {
              startTime: "10:00:00",
              endTime: "11:00:00",
              status: "pending_payment",
              holdExpiresAt: "2026-07-13T00:00:00.000Z",
            },
          ],
        })
      )
    ).toEqual({ kind: "allowed", exceptionReason: null });
  });
});
