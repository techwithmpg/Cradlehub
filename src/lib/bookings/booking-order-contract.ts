import type { Json } from "@/types/supabase";

/**
 * TRANSITIONAL COMPATIBILITY CONTRACT
 *
 * Notice: The `booking_order` JSON metadata model defined here is an additive,
 * intermediate compatibility abstraction for local feature development.
 *
 * Governance & Authority Rules:
 * 1. Groups new service-line rows for UI and local feature development.
 * 2. Preserves existing `bookings.id` primary keys and deep links.
 * 3. Is NOT yet the final authoritative parent order table in Postgres.
 * 4. Does NOT authorize historical order reconstruction from old records.
 * 5. Will later migrate to the approved additive BKG3 database order schema
 *    once transactional DDL and RPC mechanisms are formally approved.
 * 6. Never fabricate group/order metadata for historical rows without authorization.
 */

export type BookingForChoice = "me" | "me_and_others" | "someone_else";
export type BookingPaymentChoice = "pay_later" | "pay_now";

export type BookingOrderAttendeeInput = {
  id: string;
  name?: string;
  isOrganizer?: boolean;
  serviceIds: string[];
  notes?: string;
};

export type BookingOrderAttendee = {
  id: string;
  index: number;
  name: string;
  isOrganizer: boolean;
  serviceIds: string[];
  serviceNames?: string[];
  notes?: string | null;
};

export type BookingOrderOrganizer = {
  fullName: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
};

export type BookingOrderSummary = {
  orderId: string;
  orderNumber: string;
  branchId: string;
  branchName?: string;
  bookingDate: string;
  startTime: string;
  deliveryType: "in_spa" | "home_service";
  bookingFor: BookingForChoice;
  organizer: BookingOrderOrganizer;
  recipientName?: string | null;
  attendees: BookingOrderAttendee[];
  totalAttendees: number;
  totalServices: number;
  totalDurationMinutes: number;
  subtotalAmount: number;
  homeServiceFee: number;
  totalAmount: number;
  paymentChoice: BookingPaymentChoice;
  paymentStatus: "unpaid" | "pending" | "paid";
  bookingIds: string[];
  createdAt: string;
};

export type BookingServiceLineMetadata = {
  serviceId: string;
  serviceName: string;
  price: number;
  durationMinutes: number;
  attendeeIndex: number;
  attendeeId: string;
  attendeeName: string;
  serviceLineIndex: number;
  totalServicesForAttendee: number;
};

/**
 * Generates a human-friendly short order reference:
 * e.g. CRD-2609-A8B2
 */
export function generateOrderNumber(dateStr: string): string {
  const parts = dateStr.replace(/-/g, "").slice(2, 6); // YYMM
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CRD-${parts}-${randomChars}`;
}

/**
 * Builds the canonical order metadata object stored in bookings.metadata
 */
export function buildBookingOrderMetadata(params: {
  orderSummary: BookingOrderSummary;
  attendee: BookingOrderAttendee;
  serviceLine: BookingServiceLineMetadata;
  groupBookingIds: string[];
}): Record<string, Json | undefined> {
  const { orderSummary, attendee, serviceLine, groupBookingIds } = params;

  return {
    order_id: orderSummary.orderId,
    order_number: orderSummary.orderNumber,
    booking_order: {
      order_id: orderSummary.orderId,
      order_number: orderSummary.orderNumber,
      branch_id: orderSummary.branchId,
      branch_name: orderSummary.branchName ?? null,
      booking_date: orderSummary.bookingDate,
      start_time: orderSummary.startTime,
      delivery_type: orderSummary.deliveryType,
      booking_for: orderSummary.bookingFor,
      organizer: {
        full_name: orderSummary.organizer.fullName,
        phone: orderSummary.organizer.phone,
        email: orderSummary.organizer.email ?? null,
        notes: orderSummary.organizer.notes ?? null,
      },
      recipient_name: orderSummary.recipientName ?? null,
      total_attendees: orderSummary.totalAttendees,
      total_services: orderSummary.totalServices,
      total_duration_minutes: orderSummary.totalDurationMinutes,
      subtotal_amount: orderSummary.subtotalAmount,
      home_service_fee: orderSummary.homeServiceFee,
      total_amount: orderSummary.totalAmount,
      payment_choice: orderSummary.paymentChoice,
      payment_status: orderSummary.paymentStatus,
      booking_ids: groupBookingIds,
      attendees: orderSummary.attendees.map((a) => ({
        id: a.id,
        index: a.index,
        name: a.name,
        is_organizer: a.isOrganizer,
        service_ids: a.serviceIds,
        notes: a.notes ?? null,
      })),
      created_at: orderSummary.createdAt,
    } as unknown as Json,
    attendee: {
      id: attendee.id,
      index: attendee.index,
      name: attendee.name,
      is_organizer: attendee.isOrganizer,
    } as unknown as Json,
    service_line: {
      service_id: serviceLine.serviceId,
      service_name: serviceLine.serviceName,
      price: serviceLine.price,
      duration_minutes: serviceLine.durationMinutes,
      attendee_index: serviceLine.attendeeIndex,
      service_line_index: serviceLine.serviceLineIndex,
      total_services_for_attendee: serviceLine.totalServicesForAttendee,
    } as unknown as Json,
    // Preserve group_booking_ids for seamless CRM and Staff PWA compatibility
    group_booking_ids: groupBookingIds,
  };
}

/**
 * Safely extracts booking order details from a booking row's metadata
 */
export function extractBookingOrderFromMetadata(
  metadata: unknown
): BookingOrderSummary | null {
  if (!metadata || typeof metadata !== "object") return null;

  const raw = metadata as Record<string, unknown>;
  const order = raw.booking_order;
  if (!order || typeof order !== "object") return null;

  const o = order as Record<string, unknown>;
  if (!o.order_id || !o.order_number) return null;

  const organizer = (o.organizer && typeof o.organizer === "object" ? o.organizer : {}) as Record<
    string,
    unknown
  >;

  const attendeesList = Array.isArray(o.attendees)
    ? (o.attendees as Array<Record<string, unknown>>).map((a, idx) => ({
        id: String(a.id ?? `att-${idx + 1}`),
        index: typeof a.index === "number" ? a.index : idx,
        name: String(a.name ?? `Guest ${idx + 1}`),
        isOrganizer: Boolean(a.is_organizer),
        serviceIds: Array.isArray(a.service_ids) ? (a.service_ids as string[]) : [],
        notes: typeof a.notes === "string" ? a.notes : null,
      }))
    : [];

  return {
    orderId: String(o.order_id),
    orderNumber: String(o.order_number),
    branchId: String(o.branch_id ?? ""),
    branchName: typeof o.branch_name === "string" ? o.branch_name : undefined,
    bookingDate: String(o.booking_date ?? ""),
    startTime: String(o.start_time ?? ""),
    deliveryType: o.delivery_type === "home_service" ? "home_service" : "in_spa",
    bookingFor:
      o.booking_for === "me_and_others" || o.booking_for === "someone_else"
        ? o.booking_for
        : "me",
    organizer: {
      fullName: String(organizer.full_name ?? ""),
      phone: String(organizer.phone ?? ""),
      email: typeof organizer.email === "string" ? organizer.email : null,
      notes: typeof organizer.notes === "string" ? organizer.notes : null,
    },
    recipientName: typeof o.recipient_name === "string" ? o.recipient_name : null,
    attendees: attendeesList,
    totalAttendees: typeof o.total_attendees === "number" ? o.total_attendees : attendeesList.length,
    totalServices: typeof o.total_services === "number" ? o.total_services : 1,
    totalDurationMinutes: typeof o.total_duration_minutes === "number" ? o.total_duration_minutes : 0,
    subtotalAmount: typeof o.subtotal_amount === "number" ? o.subtotal_amount : 0,
    homeServiceFee: typeof o.home_service_fee === "number" ? o.home_service_fee : 0,
    totalAmount: typeof o.total_amount === "number" ? o.total_amount : 0,
    paymentChoice: o.payment_choice === "pay_now" ? "pay_now" : "pay_later",
    paymentStatus:
      o.payment_status === "paid"
        ? "paid"
        : o.payment_status === "pending"
          ? "pending"
          : "unpaid",
    bookingIds: Array.isArray(o.booking_ids) ? (o.booking_ids as string[]) : [],
    createdAt: String(o.created_at ?? ""),
  };
}
