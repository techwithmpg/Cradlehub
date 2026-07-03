import { z } from "zod";
import { STAFF_TYPES, SYSTEM_ROLES, canonicalizeSystemRole } from "@/constants/staff";
import { isValidShiftRange } from "@/lib/utils/time-format";

// z.string().uuid() is stricter in Zod v4 and can reject some existing IDs.
const uuid = z.guid("Invalid ID");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");
const systemRoleInputSchema = z
  .string()
  .refine(
    (role) => SYSTEM_ROLES.includes(role as (typeof SYSTEM_ROLES)[number]),
    "Invalid system role"
  )
  .transform((role) => canonicalizeSystemRole(role));
const optionalNickname = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.string().max(80, "Nickname must be 80 characters or fewer").nullable().optional()
);

export const createStaffSchema = z.object({
  branchId:   uuid,
  fullName:   z.string().min(2, "Name required").max(100),
  nickname:   optionalNickname,
  phone:      z.string().min(7).max(20).optional(),
  tier:       z.enum(["senior", "mid", "junior", "head", "n/a"]),
  systemRole: systemRoleInputSchema,
  staffType:  z.enum(STAFF_TYPES).default("therapist"),
  isHead:     z.boolean().default(false),
  email:      z.string().email("Valid email required for system access"),
  serviceIds: z.array(uuid).optional(),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  staffId:    uuid,
  fullName:   z.string().min(2).max(100).optional(),
  nickname:   optionalNickname,
  phone:      z.string().min(7).max(20).optional(),
  tier:       z.enum(["senior", "mid", "junior", "head", "n/a"]).optional(),
  systemRole: systemRoleInputSchema.optional(),
  staffType:  z.enum(STAFF_TYPES).optional(),
  isHead:     z.boolean().optional(),
  branchId:   uuid.optional(),
  isActive:   z.boolean().optional(),
  serviceIds: z.array(uuid).optional(),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const setScheduleSchema = z
  .object({
    staffId:   uuid,
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeStr,
    endTime:   timeStr,
    isActive:  z.boolean().default(true),
    shiftType: z.enum(["single", "opening", "closing"]).default("single"),
  })
  .refine(
    (d) => isValidShiftRange(d.startTime, d.endTime),
    "Shift must be between 1 minute and 16 hours"
  );
export type SetScheduleInput = z.infer<typeof setScheduleSchema>;

export const createOverrideSchema = z
  .object({
    staffId:      uuid,
    overrideDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isDayOff:     z.boolean(),
    shiftType:    z.enum(["single", "opening", "closing"]).optional(),
    startTime:    timeStr.optional(),
    endTime:      timeStr.optional(),
    reason:       z.string().max(200).optional(),
  })
  .refine(
    (d) =>
      d.isDayOff
        ? !d.startTime && !d.endTime
        : !!d.startTime && !!d.endTime && d.startTime < d.endTime,
    "Day off requires no times; working override requires start < end"
  );
export type CreateOverrideInput = z.infer<typeof createOverrideSchema>;

export const createBlockedTimeSchema = z
  .object({
    staffId:   uuid,
    blockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: timeStr,
    endTime:   timeStr,
    reason:    z.enum(["break", "leave", "training", "other"]),
  })
  .refine((d) => d.startTime < d.endTime, "Start time must be before end time");
export type CreateBlockedTimeInput = z.infer<typeof createBlockedTimeSchema>;
