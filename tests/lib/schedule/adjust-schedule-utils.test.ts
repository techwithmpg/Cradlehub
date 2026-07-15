import { describe, expect, it } from "vitest";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-types";
import type { AdjustScheduleDraft } from "@/components/features/schedule-adjustment/adjust-schedule-types";
import {
  createDraftFromScheduleItem,
  databaseShiftToUi,
  formatDuration,
  getAllowedShiftKinds,
  getOpenCloseNormalizationCandidates,
  getWeeklyDurationMinutes,
  hasBlockingIssues,
  normalizeOpenCloseCoverage,
  serializeDraftForSave,
  uiShiftToDatabase,
  validateAdjustScheduleDraft,
} from "@/components/features/schedule-adjustment/adjust-schedule-utils";

function item(overrides: Partial<StaffScheduleItem> = {}): StaffScheduleItem {
  return {
    staff: {
      id: "staff-1",
      full_name: "Adieva Villahermosa Selda",
      nickname: null,
      avatar_url: null,
      tier: "junior",
      staff_type: "therapist",
      system_role: "staff",
      is_head: false,
      is_active: true,
    },
    schedules: [],
    overrides: [],
    blockedTimes: [],
    ...overrides,
  };
}

function blankDraft(overrides: Partial<AdjustScheduleDraft> = {}): AdjustScheduleDraft {
  return {
    staffId: "staff-1",
    branchId: "branch-1",
    days: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      mode: "unconfigured" as const,
      windows: [],
    })),
    ...overrides,
  };
}

describe("adjust schedule utilities", () => {
  it("maps database single to UI regular and UI regular to database single", () => {
    expect(databaseShiftToUi("single")).toBe("regular");
    expect(uiShiftToDatabase("regular")).toBe("single");
    expect(databaseShiftToUi("opening")).toBe("opening");
    expect(uiShiftToDatabase("closing")).toBe("closing");
  });

  it("calculates weekly, split-shift, and overnight duration", () => {
    const draft = blankDraft({
      days: [
        {
          dayOfWeek: 0,
          mode: "working",
          windows: [
            {
              id: "sun-1",
              shiftKind: "regular",
              startTime: "10:00",
              endTime: "14:00",
              endsNextDay: false,
              order: 1,
            },
            {
              id: "sun-2",
              shiftKind: "regular",
              startTime: "17:00",
              endTime: "22:00",
              endsNextDay: false,
              order: 2,
            },
          ],
        },
        {
          dayOfWeek: 1,
          mode: "working",
          windows: [
            {
              id: "mon-1",
              shiftKind: "closing",
              startTime: "17:00",
              endTime: "01:30",
              endsNextDay: true,
              order: 1,
            },
          ],
        },
        ...Array.from({ length: 5 }, (_, index) => ({
          dayOfWeek: index + 2,
          mode: "unconfigured" as const,
          windows: [],
        })),
      ],
    });

    expect(getWeeklyDurationMinutes(draft)).toBe(17.5 * 60);
    expect(formatDuration(getWeeklyDurationMinutes(draft))).toBe("17h 30m");
  });

  it("detects overlapping windows and day-off windows", () => {
    const draft = blankDraft({
      days: [
        {
          dayOfWeek: 0,
          mode: "working",
          windows: [
            {
              id: "a",
              shiftKind: "regular",
              startTime: "10:00",
              endTime: "14:00",
              endsNextDay: false,
              order: 1,
            },
            {
              id: "b",
              shiftKind: "regular",
              startTime: "13:00",
              endTime: "17:00",
              endsNextDay: false,
              order: 2,
            },
          ],
        },
        {
          dayOfWeek: 1,
          mode: "day_off",
          windows: [
            {
              id: "bad",
              shiftKind: "regular",
              startTime: "09:00",
              endTime: "12:00",
              endsNextDay: false,
              order: 1,
            },
          ],
        },
        ...Array.from({ length: 5 }, (_, index) => ({
          dayOfWeek: index + 2,
          mode: "unconfigured" as const,
          windows: [],
        })),
      ],
    });

    const issues = validateAdjustScheduleDraft({ draft, allowedShiftKinds: ["regular"] });
    expect(hasBlockingIssues(issues)).toBe(true);
    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(["overlap-0-b", "inactive-windows-1"])
    );
  });

  it("keeps no schedule distinct from day off", () => {
    const draft = blankDraft();
    const issues = validateAdjustScheduleDraft({ draft, allowedShiftKinds: ["regular"] });

    expect(issues).toEqual([
      expect.objectContaining({
        id: "no-schedule",
        level: "info",
      }),
    ]);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("preserves ordered windows when creating a draft and serializing for save", () => {
    const draft = createDraftFromScheduleItem({
      branchId: "branch-1",
      item: item({
        schedules: [
          {
            id: "window-2",
            day_of_week: 2,
            start_time: "15:00:00",
            end_time: "23:00:00",
            shift_type: "closing",
            is_active: true,
            window_order: 2,
            ends_next_day: false,
          },
          {
            id: "window-1",
            day_of_week: 2,
            start_time: "06:00:00",
            end_time: "14:00:00",
            shift_type: "opening",
            is_active: true,
            window_order: 1,
            ends_next_day: false,
          },
        ],
      }),
    });

    const tuesday = draft.days.find((day) => day.dayOfWeek === 2);
    expect(tuesday?.windows.map((window) => window.id)).toEqual(["window-1", "window-2"]);
    expect(serializeDraftForSave(draft).days.find((day) => day.dayOfWeek === 2)?.windows).toEqual([
      expect.objectContaining({ id: "window-1", shiftKind: "opening", order: 1 }),
      expect.objectContaining({ id: "window-2", shiftKind: "closing", order: 2 }),
    ]);
  });

  it("uses role-aware shift eligibility", () => {
    expect(getAllowedShiftKinds(item().staff)).toEqual(["opening", "regular", "closing"]);
    expect(
      getAllowedShiftKinds({
        ...item().staff,
        staff_type: "driver",
        system_role: "staff",
      })
    ).toEqual(["regular"]);
    expect(
      getAllowedShiftKinds({
        ...item().staff,
        staff_type: "csr",
        system_role: "crm",
      })
    ).toEqual(["opening", "regular", "closing"]);
    expect(
      getAllowedShiftKinds({
        ...item().staff,
        staff_type: "csr",
        system_role: "staff",
      })
    ).toEqual(["opening", "regular", "closing"]);
  });

  it("detects and normalizes eligible CRM Open-Close coverage without duplicate hours", () => {
    const workingDays = new Set([3, 4, 5, 6]);
    const draft = blankDraft({
      days: Array.from({ length: 7 }, (_, dayOfWeek) =>
        workingDays.has(dayOfWeek)
          ? {
              dayOfWeek,
              mode: "working" as const,
              windows: [
                {
                  id: `opening-${dayOfWeek}`,
                  shiftKind: "opening" as const,
                  startTime: "10:00",
                  endTime: "19:30",
                  endsNextDay: false,
                  order: 1,
                },
                {
                  id: `closing-${dayOfWeek}`,
                  shiftKind: "closing" as const,
                  startTime: "17:00",
                  endTime: "01:30",
                  endsNextDay: true,
                  order: 2,
                },
              ],
            }
          : { dayOfWeek, mode: "unconfigured" as const, windows: [] }
      ),
    });

    const candidates = getOpenCloseNormalizationCandidates({ draft, eligible: true });
    const issues = validateAdjustScheduleDraft({
      draft,
      allowedShiftKinds: ["opening", "regular", "closing"],
      openCloseNormalizationEligible: true,
    });

    expect(candidates).toHaveLength(4);
    expect(issues.filter((issue) => issue.code === "open_close_overlap")).toHaveLength(4);
    expect(getWeeklyDurationMinutes(draft)).toBe(62 * 60);

    const normalized = normalizeOpenCloseCoverage({ draft, candidates });
    expect(getWeeklyDurationMinutes(normalized)).toBe(62 * 60);
    for (const dayOfWeek of workingDays) {
      const windows = normalized.days.find((day) => day.dayOfWeek === dayOfWeek)?.windows ?? [];
      expect(windows).toEqual([
        expect.objectContaining({
          shiftKind: "opening",
          startTime: "10:00",
          endTime: "17:00",
          endsNextDay: false,
        }),
        expect.objectContaining({
          shiftKind: "closing",
          startTime: "17:00",
          endTime: "01:30",
          endsNextDay: true,
        }),
      ]);
    }
    expect(
      hasBlockingIssues(
        validateAdjustScheduleDraft({
          draft: normalized,
          allowedShiftKinds: ["opening", "regular", "closing"],
          openCloseNormalizationEligible: true,
        })
      )
    ).toBe(false);
  });

  it("keeps non-eligible and third-window overlaps on the generic blocking path", () => {
    const overlappingDay = {
      dayOfWeek: 1,
      mode: "working" as const,
      windows: [
        {
          id: "opening",
          shiftKind: "opening" as const,
          startTime: "10:00",
          endTime: "19:30",
          endsNextDay: false,
          order: 1,
        },
        {
          id: "closing",
          shiftKind: "closing" as const,
          startTime: "17:00",
          endTime: "01:30",
          endsNextDay: true,
          order: 2,
        },
      ],
    };
    const draft = blankDraft({
      days: [
        { dayOfWeek: 0, mode: "unconfigured", windows: [] },
        overlappingDay,
        ...Array.from({ length: 5 }, (_, index) => ({
          dayOfWeek: index + 2,
          mode: "unconfigured" as const,
          windows: [],
        })),
      ],
    });

    expect(getOpenCloseNormalizationCandidates({ draft, eligible: false })).toEqual([]);
    expect(
      validateAdjustScheduleDraft({
        draft,
        allowedShiftKinds: ["opening", "regular", "closing"],
      }).find((issue) => issue.code === "overlap")
    ).toBeTruthy();

    const withThirdWindow = {
      ...draft,
      days: draft.days.map((day) =>
        day.dayOfWeek === 1
          ? {
              ...day,
              windows: [
                ...day.windows,
                {
                  id: "third",
                  shiftKind: "regular" as const,
                  startTime: "18:00",
                  endTime: "20:00",
                  endsNextDay: false,
                  order: 3,
                },
              ],
            }
          : day
      ),
    };
    expect(getOpenCloseNormalizationCandidates({ draft: withThirdWindow, eligible: true })).toEqual(
      []
    );
    expect(
      validateAdjustScheduleDraft({
        draft: withThirdWindow,
        allowedShiftKinds: ["opening", "regular", "closing"],
        openCloseNormalizationEligible: true,
      }).every((issue) => issue.code !== "open_close_overlap")
    ).toBe(true);
  });

  it.each(["opening", "closing"] as const)(
    "keeps two overlapping %s windows blocked without an auto-fix",
    (shiftKind) => {
      const draft = blankDraft({
        days: Array.from({ length: 7 }, (_, dayOfWeek) =>
          dayOfWeek === 2
            ? {
                dayOfWeek,
                mode: "working" as const,
                windows: [
                  {
                    id: "first",
                    shiftKind,
                    startTime: "10:00",
                    endTime: "18:00",
                    endsNextDay: false,
                    order: 1,
                  },
                  {
                    id: "second",
                    shiftKind,
                    startTime: "17:00",
                    endTime: "21:00",
                    endsNextDay: false,
                    order: 2,
                  },
                ],
              }
            : { dayOfWeek, mode: "unconfigured" as const, windows: [] }
        ),
      });

      expect(getOpenCloseNormalizationCandidates({ draft, eligible: true })).toEqual([]);
      expect(
        validateAdjustScheduleDraft({
          draft,
          allowedShiftKinds: ["opening", "regular", "closing"],
          openCloseNormalizationEligible: true,
        })
      ).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "overlap", level: "error" })])
      );
    }
  );
});
