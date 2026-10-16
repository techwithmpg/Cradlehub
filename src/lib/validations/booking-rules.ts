import { z } from "zod";
import {
  DEFAULT_BRANCH_BOOKING_RULES,
  type BranchBookingRules,
} from "@/lib/bookings/booking-rules-config";
export { DEFAULT_BRANCH_BOOKING_RULES, type BranchBookingRules };

const uuid = z.guid("Invalid branch ID");
const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be HH:MM")
  .transform((value) => value.slice(0, 5));

function timeToMinutes(time: string): number {
  const [hourRaw, minuteRaw] = time.split(":");
  return Number(hourRaw) * 60 + Number(minuteRaw);
}

export const branchBookingRulesSchema = z
  .object({
    branchId: uuid,
    inSpaStartTime: timeString,
    inSpaEndTime: timeString,
    homeServiceEnabled: z.boolean(),
    homeServiceStartTime: timeString,
    homeServiceEndTime: timeString,
    travelBufferMins: z.coerce
      .number()
      .int()
      .min(0, "Travel buffer cannot be negative")
      .max(240, "Travel buffer cannot exceed 240 minutes"),
    maxAdvanceBookingDays: z.coerce
      .number()
      .int()
      .min(1, "Max advance booking must be at least 1 day")
      .max(365, "Max advance booking cannot exceed 365 days"),
    homeServiceDriverCapacity: z.coerce
      .number()
      .int()
      .min(0, "Driver capacity cannot be negative")
      .max(20, "Driver capacity cannot exceed 20"),
    homeServiceBaseFee: z.coerce
      .number()
      .min(0, "Base transportation fee cannot be negative")
      .max(50000, "Base transportation fee cannot exceed 50,000")
      .default(DEFAULT_BRANCH_BOOKING_RULES.homeServiceBaseFee),
    homeServiceFreeKm: z.coerce
      .number()
      .min(0, "Included distance cannot be negative")
      .max(100, "Included distance cannot exceed 100 km")
      .default(DEFAULT_BRANCH_BOOKING_RULES.homeServiceFreeKm),
    homeServiceExtraKmFee: z.coerce
      .number()
      .min(0, "Additional fee per kilometer cannot be negative")
      .max(10000, "Additional fee per kilometer cannot exceed 10,000")
      .default(DEFAULT_BRANCH_BOOKING_RULES.homeServiceExtraKmFee),
  })
  .superRefine((value, ctx) => {
    if (timeToMinutes(value.inSpaStartTime) >= timeToMinutes(value.inSpaEndTime)) {
      ctx.addIssue({
        code: "custom",
        path: ["inSpaEndTime"],
        message: "In-spa end time must be after start time",
      });
    }

    if (
      timeToMinutes(value.homeServiceStartTime) >=
      timeToMinutes(value.homeServiceEndTime)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["homeServiceEndTime"],
        message: "Home service end time must be after start time",
      });
    }
  });

export type UpdateBranchBookingRulesInput = z.infer<
  typeof branchBookingRulesSchema
>;
