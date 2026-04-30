import { z } from "zod";

// Accept canonical Postgres UUID/GUID format used by seeded and live records.
// z.string().uuid() is stricter in Zod v4 and can reject some existing IDs.
const uuid = z.guid("Invalid ID");
const phone = z
  .string()
  .min(7, "Phone number too short")
  .max(20, "Phone number too long")
  .regex(/^[0-9+\-\s()]+$/, "Invalid phone number");

// Online booking: today ≤ date ≤ today + 30 days
const onlineBookingDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((d) => {
    const date = new Date(d + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const max = new Date(today);
    max.setDate(max.getDate() + 30);
    return date >= today && date <= max;
  }, "You can book up to 30 days in advance");

const anyDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const timeStr = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be HH:MM");

// ── Public online booking ──────────────────────────────────────────────────
export const createOnlineBookingSchema = z.object({
  branchId:         uuid,
  serviceId:        uuid,
  staffId:          uuid.optional(),          // undefined = "any therapist"
  date:             onlineBookingDate,
  startTime:        timeStr,
  type:             z.enum(["online", "home_service"]).default("online"),
  travelBufferMins: z.number().int().min(0).max(300).optional(),
  fullName:         z.string().min(2, "Name must be at least 2 characters").max(100),
  phone,
  email:            z.string().email("Invalid email").optional().or(z.literal("")),
  notes:            z.string().max(500).optional(),
});
export type CreateOnlineBookingInput = z.infer<typeof createOnlineBookingSchema>;

// ── Manager walk-in / home service at front desk ───────────────────────────
export const createWalkinBookingSchema = z.object({
  serviceId:        uuid,
  staffId:          uuid,                     // required — manager picks therapist
  date:             anyDate,                  // no 30-day limit for front desk
  startTime:        timeStr,
  type:             z.enum(["walkin", "home_service"]).default("walkin"),
  travelBufferMins: z.number().int().min(0).max(300).optional(),
  fullName:         z.string().min(2).max(100),
  phone,
  email:            z.string().email().optional().or(z.literal("")),
  notes:            z.string().max(500).optional(),
});
export type CreateWalkinBookingInput = z.infer<typeof createWalkinBookingSchema>;

// ── Manager edit any booking field ────────────────────────────────────────
export const editBookingSchema = z
  .object({
    bookingId:        uuid,
    serviceId:        uuid.optional(),
    staffId:          uuid.optional(),
    date:             anyDate.optional(),
    startTime:        timeStr.optional(),
    type:             z.enum(["online", "walkin", "home_service"]).optional(),
    travelBufferMins: z.number().int().min(0).max(300).optional(),
    notes:            z.string().max(500).optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 1, // must change at least one field
    "At least one field must be updated"
  );
export type EditBookingInput = z.infer<typeof editBookingSchema>;

// ── Status transition ─────────────────────────────────────────────────────
export const updateBookingStatusSchema = z.object({
  bookingId: uuid,
  status:    z.enum(["in_progress", "completed", "cancelled", "no_show"]),
  notes:     z.string().max(500).optional(),
});
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

// ── Availability query ────────────────────────────────────────────────────
export const getAvailableSlotsSchema = z.object({
  branchId:  uuid,
  serviceId: uuid,
  staffId:   uuid.optional(),
  date:      anyDate,
});
export type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsSchema>;
