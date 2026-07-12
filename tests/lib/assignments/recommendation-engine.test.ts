import { describe, expect, it } from "vitest";

import {
  NO_CHECKED_IN_STAFF_WARNING,
} from "@/lib/engine/availability";
import {
  type CheckinForScoring,
  type RecommendationContext,
  scoreTherapistCandidates,
} from "@/lib/assignments/recommendation-engine";
import { addDaysToYmd, getBranchBusinessDate } from "@/lib/engine/slot-time";

const BRANCH_ID = "branch-main";
const SERVICE_ID = "service-massage";

function dayOfWeekFromYmd(date: string): number {
  const [y = "0", m = "1", d = "1"] = date.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).getDay();
}

function checkin(staffId: string, date: string, checkedInAt = "2026-07-09T01:00:00.000Z"): CheckinForScoring {
  return {
    staff_id: staffId,
    shift_date: date,
    status: "checked_in",
    checked_in_at: checkedInAt,
    checked_out_at: null,
    attendance_status: "on_time",
    shift_type: "regular",
    branch_id: BRANCH_ID,
  };
}

function makeContext(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  const bookingDate = overrides.bookingDate ?? getBranchBusinessDate();
  return {
    bookingDate,
    bookingStartTime: "10:00:00",
    bookingEndTime: "11:00:00",
    bookingMode: "walkin",
    isHomeService: false,
    service: {
      id: SERVICE_ID,
      name: "Massage",
      duration_minutes: 60,
      categoryName: "Massage",
    },
    staffList: [
      {
        id: "senior-not-checked-in",
        full_name: "Senior Therapist",
        staff_type: "therapist",
        system_role: null,
        tier: "senior",
        is_active: true,
        branch_id: BRANCH_ID,
      },
      {
        id: "junior-checked-in",
        full_name: "Junior Therapist",
        staff_type: "therapist",
        system_role: null,
        tier: "junior",
        is_active: true,
        branch_id: BRANCH_ID,
      },
    ],
    staffServices: [
      { staff_id: "senior-not-checked-in", service_id: SERVICE_ID },
      { staff_id: "junior-checked-in", service_id: SERVICE_ID },
    ],
    schedules: [
      {
        staff_id: "senior-not-checked-in",
        day_of_week: dayOfWeekFromYmd(bookingDate),
        start_time: "09:00:00",
        end_time: "18:00:00",
        is_active: true,
        shift_type: "regular",
      },
      {
        staff_id: "junior-checked-in",
        day_of_week: dayOfWeekFromYmd(bookingDate),
        start_time: "09:00:00",
        end_time: "18:00:00",
        is_active: true,
        shift_type: "regular",
      },
    ],
    overrides: [],
    blockedTimes: [],
    checkins: [],
    existingBookings: [],
    preferences: [],
    ...overrides,
  };
}

describe("assignment recommendation attendance behavior", () => {
  it("warns but keeps scheduled candidates when a walk-in today has no checked-in staff", () => {
    const scored = scoreTherapistCandidates(makeContext());

    expect(scored).toHaveLength(2);
    expect(scored.every((candidate) => candidate.status !== "unavailable")).toBe(true);
    expect(
      scored.every((candidate) => candidate.warnings.includes(NO_CHECKED_IN_STAFF_WARNING))
    ).toBe(true);
    expect(
      scored.some((candidate) => candidate.warnings.includes("Not checked in for today"))
    ).toBe(false);
  });

  it("prefers checked-in staff for walk-ins today when someone is checked in", () => {
    const today = getBranchBusinessDate();
    const scored = scoreTherapistCandidates(
      makeContext({
        checkins: [checkin("junior-checked-in", today)],
      })
    );

    expect(scored[0]?.staffId).toBe("junior-checked-in");
    expect(scored[0]?.reasons).toContain("#1 in today's attendance queue");
    expect(scored[1]?.warnings).toContain("Not checked in for today");
  });

  it("ignores attendance for phone bookings even when the booking date is today", () => {
    const scored = scoreTherapistCandidates(
      makeContext({
        bookingMode: "phone",
        checkins: [],
      })
    );

    expect(
      scored.some((candidate) => candidate.warnings.includes(NO_CHECKED_IN_STAFF_WARNING))
    ).toBe(false);
    expect(
      scored.some((candidate) => candidate.warnings.includes("Not checked in for today"))
    ).toBe(false);
  });

  it("ignores attendance for future and home-service bookings", () => {
    const futureDate = addDaysToYmd(getBranchBusinessDate(), 1);
    const futureScored = scoreTherapistCandidates(
      makeContext({
        bookingDate: futureDate,
        bookingMode: "standard_future",
      })
    );
    const homeServiceScored = scoreTherapistCandidates(
      makeContext({
        bookingMode: "home_service",
        isHomeService: true,
      })
    );

    expect(
      futureScored.some((candidate) => candidate.warnings.includes(NO_CHECKED_IN_STAFF_WARNING))
    ).toBe(false);
    expect(
      homeServiceScored.some((candidate) => candidate.warnings.includes(NO_CHECKED_IN_STAFF_WARNING))
    ).toBe(false);
  });

  it("marks overlapping therapist bookings unavailable", () => {
    const scored = scoreTherapistCandidates(
      makeContext({
        existingBookings: [
          {
            booking_id: "existing-booking",
            staff_id: "junior-checked-in",
            start_time: "10:30:00",
            end_time: "11:30:00",
            status: "confirmed",
          },
        ],
      })
    );

    const candidate = scored.find((item) => item.staffId === "junior-checked-in");
    expect(candidate?.status).toBe("unavailable");
    expect(candidate?.warnings).toContain("Has overlapping booking");
  });

  it("marks therapists with conflicting schedule windows unavailable", () => {
    const bookingDate = getBranchBusinessDate();
    const scored = scoreTherapistCandidates(
      makeContext({
        schedules: [
          {
            staff_id: "junior-checked-in",
            day_of_week: dayOfWeekFromYmd(bookingDate),
            start_time: "09:00:00",
            end_time: "13:00:00",
            is_active: true,
            shift_type: "opening",
          },
          {
            staff_id: "junior-checked-in",
            day_of_week: dayOfWeekFromYmd(bookingDate),
            start_time: "12:00:00",
            end_time: "18:00:00",
            is_active: true,
            shift_type: "closing",
          },
          {
            staff_id: "senior-not-checked-in",
            day_of_week: dayOfWeekFromYmd(bookingDate),
            start_time: "09:00:00",
            end_time: "18:00:00",
            is_active: true,
            shift_type: "regular",
          },
        ],
      })
    );

    const candidate = scored.find((item) => item.staffId === "junior-checked-in");
    expect(candidate?.status).toBe("unavailable");
    expect(candidate?.warnings).toContain("Schedule has conflicting windows");
  });

  it("marks home-service-ineligible therapists unavailable", () => {
    const scored = scoreTherapistCandidates(
      makeContext({
        bookingMode: "home_service",
        isHomeService: true,
        preferences: [
          {
            staff_id: "senior-not-checked-in",
            can_do_home_service: false,
            can_drive: false,
            max_services_per_day: null,
            max_trips_per_day: null,
          },
          {
            staff_id: "junior-checked-in",
            can_do_home_service: true,
            can_drive: false,
            max_services_per_day: null,
            max_trips_per_day: null,
          },
        ],
      })
    );

    const ineligible = scored.find((item) => item.staffId === "senior-not-checked-in");
    const eligible = scored.find((item) => item.staffId === "junior-checked-in");
    expect(ineligible?.status).toBe("unavailable");
    expect(ineligible?.warnings).toContain("Not eligible for home service");
    expect(eligible?.warnings).not.toContain("Not eligible for home service");
  });
});
