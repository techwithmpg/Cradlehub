import { describe, expect, it } from "vitest";
import {
  doesSlotFitWithinWorkingHours,
  filterPastSlotsForDate,
  isPastSlot,
  rangesOverlap,
  timeToMinutes,
} from "./slot-time";

type Slot = {
  slot_time: string;
  available: boolean;
};

describe("same-day availability helpers", () => {
  it("past date returns no slots", () => {
    const slots: Slot[] = [
      { slot_time: "10:00:00", available: true },
      { slot_time: "11:30:00", available: true },
    ];

    const filtered = filterPastSlotsForDate({
      selectedDate: "2026-05-01",
      slots,
      now: new Date(2026, 4, 2, 11, 20, 0),
    });

    expect(filtered).toEqual([]);
  });

  it("today at 11:20 hides 10:00, 10:30, and 11:00", () => {
    const slots: Slot[] = [
      { slot_time: "10:00:00", available: true },
      { slot_time: "10:30:00", available: true },
      { slot_time: "11:00:00", available: true },
      { slot_time: "11:30:00", available: true },
      { slot_time: "12:00:00", available: true },
    ];

    const filtered = filterPastSlotsForDate({
      selectedDate: "2026-05-01",
      slots,
      now: new Date(2026, 4, 1, 11, 20, 0),
    });

    expect(filtered.map((slot) => slot.slot_time)).toEqual(["11:30:00", "12:00:00"]);
  });

  it("today at 11:20 keeps future slots", () => {
    expect(
      isPastSlot({
        selectedDate: "2026-05-01",
        slotStartTime: "11:30:00",
        now: new Date(2026, 4, 1, 11, 20, 0),
      })
    ).toBe(false);

    expect(
      isPastSlot({
        selectedDate: "2026-05-01",
        slotStartTime: "11:00:00",
        now: new Date(2026, 4, 1, 11, 20, 0),
      })
    ).toBe(true);
  });

  it("future date shows all valid working-hour slots", () => {
    const slots: Slot[] = [
      { slot_time: "10:00:00", available: true },
      { slot_time: "10:30:00", available: true },
      { slot_time: "11:00:00", available: true },
    ];

    const filtered = filterPastSlotsForDate({
      selectedDate: "2026-05-03",
      slots,
      now: new Date(2026, 4, 1, 11, 20, 0),
    });

    expect(filtered).toEqual(slots);
  });

  it("slot is hidden when service duration exceeds closing time", () => {
    expect(
      doesSlotFitWithinWorkingHours({
        slotStartTime: "19:30:00",
        serviceDurationMinutes: 90,
        workEndTime: "20:00:00",
      })
    ).toBe(false);

    expect(
      doesSlotFitWithinWorkingHours({
        slotStartTime: "18:30:00",
        serviceDurationMinutes: 90,
        workEndTime: "20:00:00",
      })
    ).toBe(true);
  });

  it("slot is hidden when it overlaps an existing booking", () => {
    const slotStart = timeToMinutes("11:30:00");
    const slotEnd = slotStart + 90;
    const existingStart = timeToMinutes("12:00:00");
    const existingEnd = timeToMinutes("12:30:00");

    expect(rangesOverlap(slotStart, slotEnd, existingStart, existingEnd)).toBe(true);
  });

  it("slot is hidden when it overlaps a manual block", () => {
    const slotStart = timeToMinutes("11:30:00");
    const slotEnd = slotStart + 60;
    const blockedStart = timeToMinutes("11:45:00");
    const blockedEnd = timeToMinutes("12:15:00");

    expect(rangesOverlap(slotStart, slotEnd, blockedStart, blockedEnd)).toBe(true);
  });

  it("same-day rule is shared for public and CRM in-house flows", () => {
    const slots: Slot[] = [
      { slot_time: "11:00:00", available: true },
      { slot_time: "11:30:00", available: true },
    ];

    const now = new Date(2026, 4, 1, 11, 20, 0);

    const publicFiltered = filterPastSlotsForDate({
      selectedDate: "2026-05-01",
      slots,
      now,
    });

    const inhouseFiltered = filterPastSlotsForDate({
      selectedDate: "2026-05-01",
      slots,
      now,
    });

    expect(publicFiltered).toEqual(inhouseFiltered);
    expect(publicFiltered.map((slot) => slot.slot_time)).toEqual(["11:30:00"]);
  });
});
