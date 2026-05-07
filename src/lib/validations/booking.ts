import { z } from "zod";

// Accept canonical Postgres UUID/GUID format used by seeded and live records.
// z.string().uuid() is stricter in Zod v4 and can reject some existing IDs.
const uuid = z.guid("Invalid ID");
const phone = z
  .string()
  .min(7, "Phone number too short")
  .max(20, "Phone number too long")
  .regex(/^[0-9+\-\s()]+$/, "Invalid phone number");

// Online booking: today ≤ date ≤ today + 365 days.
// Branch-level max advance rules are enforced in the booking actions.
const onlineBookingDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((d) => {
    const date = new Date(d + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const max = new Date(today);
    max.setDate(max.getDate() + 365);
    return date >= today && date <= max;
  }, "You can book up to 365 days in advance");

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
  travelBufferMins: z.number().int().min(0).max(240).optional(),
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
  resourceId:       uuid.optional().nullable(),
  date:             anyDate,                  // no 30-day limit for front desk
  startTime:        timeStr,
  type:             z.enum(["walkin", "home_service"]).default("walkin"),
  travelBufferMins: z.number().int().min(0).max(240).optional(),
  fullName:         z.string().min(2).max(100),
  phone,
  email:            z.string().email().optional().or(z.literal("")),
  notes:            z.string().max(500).optional(),
});
export type CreateWalkinBookingInput = z.infer<typeof createWalkinBookingSchema>;

// ── In-house wizard booking (CRM/Manager): multi-service + optional therapist ──
export const createInhouseBookingMultiSchema = z.object({
  branchId:         uuid.optional(), // defaults to operator's branch when omitted
  serviceIds:       z.array(uuid).min(1, "Select at least one service").max(5, "Maximum 5 services per booking"),
  staffId:          uuid.optional(), // undefined = auto-assign by seniority
  resourceId:       uuid.optional().nullable(),
  date:             anyDate,
  startTime:        timeStr,
  type:             z.enum(["walkin", "home_service"]).default("walkin"),
  travelBufferMins: z.number().int().min(0).max(240).optional(),
  fullName:         z.string().min(2, "Name must be at least 2 characters").max(100),
  phone,
  email:            z.string().email("Invalid email").optional().or(z.literal("")),
  notes:            z.string().max(500).optional(),
  // Home service address (required when type=home_service, validated in action)
  homeServiceAddress:      z.string().max(500).optional(),
  homeServiceBarangay:     z.string().max(100).optional(),
  homeServiceCity:         z.string().max(100).optional(),
  homeServiceLandmark:     z.string().max(200).optional(),
  homeServiceParkingNotes: z.string().max(300).optional(),
});
export type CreateInhouseBookingMultiInput = z.infer<typeof createInhouseBookingMultiSchema>;

// ── Manager edit any booking field ────────────────────────────────────────
export const editBookingSchema = z
  .object({
    bookingId:        uuid,
    serviceId:        uuid.optional(),
    staffId:          uuid.optional(),
    resourceId:       uuid.optional().nullable(),
    date:             anyDate.optional(),
    startTime:        timeStr.optional(),
    type:             z.enum(["online", "walkin", "home_service"]).optional(),
    travelBufferMins: z.number().int().min(0).max(240).optional(),
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
  status:    z.enum(["confirmed", "in_progress", "completed", "cancelled", "no_show"]),
  notes:     z.string().max(500).optional(),
});
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

// ── Home-service address fields (shared by public + inhouse) ─────────────────
export const homeServiceAddressSchema = z.object({
  homeServiceAddress:      z.string().min(5, "Full address is required").max(500),
  homeServiceBarangay:     z.string().min(2, "Barangay is required").max(100),
  homeServiceCity:         z.string().min(2, "City is required").max(100),
  homeServiceLandmark:     z.string().max(200).optional(),
  homeServiceParkingNotes: z.string().max(300).optional(),
});
export type HomeServiceAddressInput = z.infer<typeof homeServiceAddressSchema>;

// ── Multi-service public online booking ───────────────────────────────────────
export const createOnlineBookingMultiSchema = z.object({
  branchId:         uuid,
  serviceIds:       z.array(uuid).min(1, "Select at least one service").max(5, "Maximum 5 services per booking"),
  staffId:          uuid.optional(),
  date:             onlineBookingDate,
  startTime:        timeStr,
  type:             z.enum(["online", "home_service"]).default("online"),
  travelBufferMins: z.number().int().min(0).max(240).optional(),
  fullName:         z.string().min(2, "Name must be at least 2 characters").max(100),
  phone,
  email:            z.string().email("Invalid email").optional().or(z.literal("")),
  notes:            z.string().max(500).optional(),
  // Home service address (required when type=home_service, validated in action)
  homeServiceAddress:      z.string().max(500).optional(),
  homeServiceBarangay:     z.string().max(100).optional(),
  homeServiceCity:         z.string().max(100).optional(),
  homeServiceLandmark:     z.string().max(200).optional(),
  homeServiceParkingNotes: z.string().max(300).optional(),
});
export type CreateOnlineBookingMultiInput = z.infer<typeof createOnlineBookingMultiSchema>;

// ── Availability query ────────────────────────────────────────────────────
export const getAvailableSlotsSchema = z.object({
  branchId:  uuid,
  serviceId: uuid,
  staffId:   uuid.optional(),
  date:      anyDate,
});
export type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsSchema>;

// ── Payment constants ─────────────────────────────────────────────────────
export const PAYMENT_METHODS = ["cash", "gcash", "maya", "card", "pay_on_site", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:        "Cash",
  gcash:       "GCash",
  maya:        "Maya",
  card:        "Card",
  pay_on_site: "Pay on Site",
  other:       "Other",
};

// ── Update booking payment ────────────────────────────────────────────────
export const updateBookingPaymentSchema = z.object({
  bookingId:        uuid,
  paymentMethod:    z.enum(PAYMENT_METHODS),
  paymentStatus:    z.enum(PAYMENT_STATUSES),
  amountPaid:       z.number().min(0, "Amount cannot be negative"),
  paymentReference: z.string().max(100).optional(),
});
export type UpdateBookingPaymentInput = z.infer<typeof updateBookingPaymentSchema>;
