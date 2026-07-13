import { describe, expect, it } from "vitest";
import {
  buildTherapistPickerOptions,
  getSelectedTherapistOption,
} from "@/components/features/booking/therapist-picker/therapist-picker-utils";

const staff = [
  {
    staff_id: "00000000-0000-4000-8000-000000000021",
    staff_name: "Maria Santos",
    staff_tier: "senior",
    staff_schedule_available: true,
  },
  {
    staff_id: "00000000-0000-4000-8000-000000000022",
    staff_name: "Lina Reyes",
    staff_tier: "mid",
    staff_schedule_available: false,
  },
];

describe("online therapist preference options", () => {
  it("keeps Any available provider selected even when a staff recommendation exists", () => {
    const options = buildTherapistPickerOptions(staff, "10:00 AM");

    expect(options[0]?.isRecommended).toBe(true);
    expect(getSelectedTherapistOption(options, "auto")).toMatchObject({
      id: null,
      isAnyProvider: true,
      displayName: "Any available provider",
    });
  });

  it("keeps a manually selected qualified staff value", () => {
    const options = buildTherapistPickerOptions(staff, "10:00 AM");

    expect(getSelectedTherapistOption(options, staff[1]!.staff_id)).toMatchObject({
      id: staff[1]!.staff_id,
      displayName: "Lina Reyes",
    });
  });

  it("allows schedule-incompatible staff to be selected without exposing the reason", () => {
    const options = buildTherapistPickerOptions(staff, "10:00 AM");
    const option = options[1]!;

    expect(option.isAvailable).toBe(true);
    expect(option.availabilityLabel).toBe("Preference request");
    expect(option.availabilityLabel).not.toMatch(/off|shift|blocked|conflict|schedule/i);
  });
});
