import { describe, expect, it } from "vitest";
import { getStaffNeedingWeeklySchedule } from "@/lib/operations-center/missing-schedules";
import type { OperationalStaffMember } from "@/lib/operations-center/issue-model";
import type { StaffAvailabilityItem } from "@/lib/queries/staff";

const branchId = "branch-main";
const monday = 1;
type VerifiedStaff = Pick<OperationalStaffMember, "id" | "staff_type" | "is_active" | "branch_id">;

function verified(id: string, type = "therapist", active = true, branch = branchId): VerifiedStaff {
  return { id, staff_type: type, is_active: active, branch_id: branch };
}

function makeItem(id: string, scheduledDay?: number): StaffAvailabilityItem {
  return {
    staff: {
      id,
      full_name: id,
      nickname: null,
      avatar_url: null,
      tier: null,
      staff_type: "therapist",
      system_role: "therapist",
      is_head: false,
      is_active: true,
    },
    schedules: scheduledDay === undefined ? [] : [{
      id: `sc-${id}`,
      day_of_week: scheduledDay,
      start_time: "09:00",
      end_time: "17:00",
      is_active: true,
      shift_type: "single",
      window_order: 0,
      ends_next_day: false,
      created_at: null,
    }],
    overrides: [],
    blockedTimes: [],
  };
}

describe("Operations Center missing schedules", () => {
  it("lists active branch service staff missing the current business-day row", () => {
    const items = [makeItem("missing"), makeItem("other-day", 2), makeItem("today", monday)];
    const roster = items.map((item) => verified(item.staff.id));
    expect(getStaffNeedingWeeklySchedule(items, roster, branchId, monday).map((item) => item.staff.id))
      .toEqual(["missing", "other-day"]);
  });

  it("fails closed when the availability fallback labels drivers as therapists", () => {
    const items = [makeItem("driver"), makeItem("inactive"), makeItem("other-branch")];
    const roster = [
      verified("driver", "driver"),
      verified("inactive", "therapist", false),
      verified("other-branch", "therapist", true, "branch-other"),
    ];
    expect(getStaffNeedingWeeklySchedule(items, roster, branchId, monday)).toEqual([]);
    expect(getStaffNeedingWeeklySchedule(items, [], branchId, monday)).toEqual([]);
  });
});
