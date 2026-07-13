import { describe, expect, it } from "vitest";
import { classifyScheduleMutationError } from "../../../src/lib/actions/schedule-mutation-errors";

describe("schedule mutation error classifier", () => {
  it("maps missing weekly replacement RPC errors to migration required", () => {
    expect(
      classifyScheduleMutationError({
        code: "PGRST202",
        message:
          "Could not find the function public.replace_staff_weekly_schedule(p_branch_id, p_rows, p_staff_id)",
      })
    ).toMatchObject({
      code: "MIGRATION_REQUIRED",
    });

    expect(
      classifyScheduleMutationError({
        code: "42883",
        message:
          "function public.replace_staff_weekly_schedule(uuid, uuid, jsonb) does not exist",
      })
    ).toMatchObject({
      code: "MIGRATION_REQUIRED",
    });
  });

  it("maps the stale shift-type uniqueness contract to migration required", () => {
    expect(
      classifyScheduleMutationError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "staff_schedules_staff_day_shift_unique"',
      })
    ).toMatchObject({
      code: "MIGRATION_REQUIRED",
    });
  });

  it("keeps RLS and overlap failures distinct", () => {
    expect(
      classifyScheduleMutationError({
        code: "42501",
        message: "permission denied for table staff_schedules",
      })
    ).toMatchObject({
      code: "RLS_DENIED",
    });

    expect(
      classifyScheduleMutationError({
        code: "23P01",
        message: "Active staff schedule windows cannot overlap for the same weekday.",
      })
    ).toMatchObject({
      code: "OVERLAPPING_WINDOWS",
    });
  });
});
