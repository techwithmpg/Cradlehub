import { z } from "zod";
export {
  DEFAULT_BRANCH_BOOKING_RULES,
  type BranchBookingRules,
} from "@/lib/bookings/booking-rules-config";

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
