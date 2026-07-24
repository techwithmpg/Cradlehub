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
export const PRECISE_HOME_SERVICE_LOCATION_MESSAGE =
  "Please select your address from the Google suggestions so our therapist and driver can find you accurately.";
export const CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE =
  "Please select a valid address from the search results so distance can be calculated.";

const googleAddressComponentSchema = z.object({
  long_name: z.string().max(200),
  short_name: z.string().max(100),
  types: z.array(z.string().max(80)).max(12),
});

function isPreciseHomeServiceLocation(input: {
  homeServicePlaceId?: string;
  homeServiceFormattedAddress?: string;
  homeServiceLat?: number | null;
  homeServiceLng?: number | null;
}): boolean {
  return (
    !!input.homeServicePlaceId?.trim() &&
    !!input.homeServiceFormattedAddress?.trim() &&
    typeof input.homeServiceLat === "number" &&
    Number.isFinite(input.homeServiceLat) &&
    typeof input.homeServiceLng === "number" &&
    Number.isFinite(input.homeServiceLng)
  );
}

// ── Public online booking ──────────────────────────────────────────────────
export const createOnlineBookingSchema = z
  .object({
    website: z.string().max(0, "Unable to submit this request").optional(),
    branchId: uuid,
    serviceId: uuid,
    staffId: uuid.optional(), // undefined = "any therapist"
    date: onlineBookingDate,
    startTime: timeStr,
    type: z.enum(["online", "home_service"]).default("online"),
    deliveryType: z.enum(["in_spa", "home_service"]).optional(),
    travelBufferMins: z.number().int().min(0).max(240).optional(),
    fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
    phone,
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    notes: z.string().max(500).optional(),
  })
  .strict();
export type CreateOnlineBookingInput = z.infer<typeof createOnlineBookingSchema>;

// ── Manager walk-in / home service at front desk ───────────────────────────
export const createWalkinBookingSchema = z.object({
  serviceId: uuid,
  staffId: uuid, // required — manager picks therapist
  resourceId: uuid.optional().nullable(),
  date: anyDate, // no 30-day limit for front desk
  startTime: timeStr,
  type: z.enum(["walkin", "home_service"]).default("walkin"),
  deliveryType: z.enum(["in_spa", "home_service"]).optional(),
  travelBufferMins: z.number().int().min(0).max(240).optional(),
  fullName: z.string().min(2).max(100),
  phone,
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});
export type CreateWalkinBookingInput = z.infer<typeof createWalkinBookingSchema>;

// ── In-house wizard booking (CRM/Manager): multi-service + optional therapist ──
export const createInhouseBookingMultiSchema = z
  .object({
    branchId: uuid.optional(), // defaults to operator's branch when omitted
    customerId: uuid.optional(),
    serviceIds: z.array(uuid).min(1, "Select a service.").max(5, "Maximum 5 services per booking"),
    staffId: uuid.optional(), // undefined = auto-assign by seniority
    resourceId: uuid.optional().nullable(),
    date: anyDate,
    startTime: timeStr,
    type: z.enum(["walkin", "home_service"]).default("walkin"),
    deliveryType: z.enum(["in_spa", "home_service"]).optional(),
    crmBookingMode: z.enum(["walkin", "phone", "home_service", "standard_future"]).optional(),
    markArrived: z.boolean().optional(),
    travelBufferMins: z.number().int().min(0).max(240).optional(),
    fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
    phone,
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    notes: z.string().max(500).optional(),
    // Home service address (required when type=home_service, validated in action)
    homeServiceAddress: z.string().max(500).optional(),
    homeServiceAddressDetails: z.string().max(300).optional(),
    homeServiceBarangay: z.string().max(100).optional(),
    homeServiceCity: z.string().max(100).optional(),
    homeServiceLandmark: z.string().max(200).optional(),
    homeServiceParkingNotes: z.string().max(300).optional(),
    homeServiceCustomerNotes: z.string().max(500).optional(),
    homeServiceAccessNote: z.string().max(300).optional(),
    homeServiceZone: z.string().max(50).optional(),
    // Captured client-side by Places Autocomplete — skip server geocoding when present
    homeServiceLat: z.number().optional().nullable(),
    homeServiceLng: z.number().optional().nullable(),
    homeServicePlaceId: z.string().max(300).optional(),
    homeServiceFormattedAddress: z.string().max(500).optional(),
    homeServiceAddressComponents: z.array(googleAddressComponentSchema).max(24).optional(),
    homeServiceMapUrl: z.string().url().max(1000).optional(),
    // Optional, explicitly authorized full advance payment at booking creation.
    paymentReceived: z.boolean().optional(),
    paymentMethod: z
      .enum(["cash", "gcash", "maya", "card", "other"], {
        message: "Please select a payment method.",
      })
      .optional(),
    paymentReference: z.string().max(100).optional(),
    paymentNote: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    const deliveryType =
      data.deliveryType ?? (data.type === "home_service" ? "home_service" : "in_spa");

    if (deliveryType === "home_service" && !isPreciseHomeServiceLocation(data)) {
      ctx.addIssue({
        code: "custom",
        message: CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
        path: ["homeServicePlaceId"],
      });
    }

    const paymentReceived = data.paymentReceived ?? false;
    if (paymentReceived && !data.paymentMethod) {
      ctx.addIssue({
        code: "custom",
        message: "Please select a payment method.",
        path: ["paymentMethod"],
      });
    }
  })
  .strict();
export type CreateInhouseBookingMultiInput = z.infer<typeof createInhouseBookingMultiSchema>;

// ── Manager edit any booking field ────────────────────────────────────────
export const editBookingSchema = z
  .object({
    bookingId: uuid,
    serviceId: uuid.optional(),
    staffId: uuid.optional(),
    resourceId: uuid.optional().nullable(),
    date: anyDate.optional(),
    startTime: timeStr.optional(),
    type: z.enum(["online", "walkin", "home_service"]).optional(),
    deliveryType: z.enum(["in_spa", "home_service"]).optional(),
    travelBufferMins: z.number().int().min(0).max(240).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 1, // must change at least one field
    "At least one field must be updated"
  );
export type EditBookingInput = z.infer<typeof editBookingSchema>;

// ── Status transition ─────────────────────────────────────────────────────
export const updateBookingStatusSchema = z.object({
  bookingId: uuid,
  status: z.enum(["confirmed", "in_progress", "completed", "cancelled", "no_show"]),
  notes: z.string().max(500).optional(),
});
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

// ── Home-service address fields (shared by public + inhouse) ─────────────────
export const HOME_SERVICE_ZONES = [
  "central_bacolod",
  "north_bacolod_talisay",
  "south_bacolod_alijis",
  "east_bacolod",
  "outside_bacolod",
  "unknown",
] as const;
export type HomeServiceZone = (typeof HOME_SERVICE_ZONES)[number];

export const homeServiceAddressSchema = z.object({
  homeServiceAddress: z.string().min(5, "Full address is required").max(500),
  homeServiceBarangay: z.string().min(2, "Barangay is required").max(100),
  homeServiceCity: z.string().min(2, "City is required").max(100),
  homeServiceLandmark: z.string().max(200).optional(),
  homeServiceParkingNotes: z.string().max(300).optional(),
  homeServiceZone: z.string().max(50).optional(),
});
export type HomeServiceAddressInput = z.infer<typeof homeServiceAddressSchema>;

// ── Multi-service public online booking ───────────────────────────────────────
export const createOnlineBookingMultiSchema = z
  .object({
    website: z.string().max(0, "Unable to submit this request").optional(),
    branchId: uuid,
    serviceIds: z
      .array(uuid)
      .min(1, "Select at least one service")
      .max(5, "Maximum 5 services per booking"),
    staffId: uuid.optional(),
    date: onlineBookingDate,
    startTime: timeStr,
    type: z.enum(["online", "home_service"]).default("online"),
    deliveryType: z.enum(["in_spa", "home_service"]).optional(),
    travelBufferMins: z.number().int().min(0).max(240).optional(),
    fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
    phone,
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    notes: z.string().max(500).optional(),
    // Home service address (required when type=home_service, validated in action)
    homeServiceAddress: z.string().max(500).optional(),
    homeServiceAddressDetails: z.string().max(300).optional(),
    homeServiceBarangay: z.string().max(100).optional(),
    homeServiceCity: z.string().max(100).optional(),
    homeServiceLandmark: z.string().max(200).optional(),
    homeServiceParkingNotes: z.string().max(300).optional(),
    homeServiceCustomerNotes: z.string().max(500).optional(),
    homeServiceZone: z.string().max(50).optional(),
    // Captured client-side by Places Autocomplete — skip server geocoding when present
    homeServiceLat: z.number().optional().nullable(),
    homeServiceLng: z.number().optional().nullable(),
    homeServicePlaceId: z.string().max(300).optional(),
    homeServiceFormattedAddress: z.string().max(500).optional(),
    homeServiceAddressComponents: z.array(googleAddressComponentSchema).max(24).optional(),
    homeServiceMapUrl: z.string().url().max(1000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const deliveryType =
      data.deliveryType ?? (data.type === "home_service" ? "home_service" : "in_spa");

    if (deliveryType !== "home_service") return;

    if (!isPreciseHomeServiceLocation(data)) {
      ctx.addIssue({
        code: "custom",
        message: PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
        path: ["homeServicePlaceId"],
      });
    }
  });
export type CreateOnlineBookingMultiInput = z.infer<typeof createOnlineBookingMultiSchema>;

// ── Availability query ────────────────────────────────────────────────────
export const getAvailableSlotsSchema = z.object({
  branchId: uuid,
  serviceId: uuid,
  staffId: uuid.optional(),
  date: anyDate,
});
export type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsSchema>;

// ── Payment constants ─────────────────────────────────────────────────────
export const PAYMENT_METHODS = ["cash", "gcash", "maya", "card", "pay_on_site", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  pay_on_site: "Pay on Site",
  other: "Other",
};

// ── CRM confirm pending-payment booking ───────────────────────────────────
export const confirmBookingPaymentSchema = z.object({
  bookingId: uuid,
  paymentMethod: z.enum(["cash", "gcash", "maya", "card", "other"]),
  paymentReference: z.string().max(100).optional(),
  amountPaid: z.number().min(0).optional(),
  note: z.string().max(500).optional(),
});
export type ConfirmBookingPaymentInput = z.infer<typeof confirmBookingPaymentSchema>;

// ── Update booking payment ────────────────────────────────────────────────
export const updateBookingPaymentSchema = z.object({
  bookingId: uuid,
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  amountPaid: z.number().min(0, "Amount cannot be negative"),
  paymentReference: z.string().max(100).optional(),
  paymentPurpose: z.enum(["final_settlement", "deposit", "advance", "partial"]).optional(),
  reason: z.string().max(500).optional(),
});
export type UpdateBookingPaymentInput = z.infer<typeof updateBookingPaymentSchema>;
