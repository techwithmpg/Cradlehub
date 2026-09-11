import { z } from "zod";
import { getBookingById } from "@/lib/queries/bookings";
import {
  withDesktopBookingContext,
  checkDesktopBooking,
  desktopFailure,
  desktopJson,
} from "@/lib/bookings/desktop-booking-contract";
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function relation(value: unknown) {
  return record(Array.isArray(value) ? value[0] : value);
}
function text(value: unknown) {
  return typeof value === "string" ? value : null;
}
function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export async function GET(request: Request, route: { params: Promise<{ bookingId: string }> }) {
  return withDesktopBookingContext(request, async (ctx) => {
    const id = z.guid().safeParse((await route.params).bookingId);
    if (!id.success)
      return desktopFailure("VALIDATION_ERROR", "A valid bookingId is required.", 400);
    const rejected = await checkDesktopBooking(ctx, id.data);
    if (rejected) return rejected;
    const loaded = await getBookingById(id.data, {
      client: ctx.supabase,
      branchId: ctx.me.branch_id,
    });
    if (!loaded) return desktopFailure("BOOKING_NOT_FOUND", "Booking not found.", 404);
    const b = record(loaded),
      metadata = record(b.metadata),
      address = record(metadata.home_service_address);
    const customer = relation(b.customers),
      service = relation(b.services),
      therapist = relation(b.staff),
      driver = relation(b.driver);
    // Explicit allowlist: never return raw customer records or arbitrary booking metadata.
    return desktopJson({
      ok: true,
      data: {
        id: b.id,
        branchId: b.branch_id,
        date: b.booking_date,
        startTime: b.start_time,
        endTime: b.end_time,
        customer: {
          id: text(customer.id),
          name: text(customer.full_name),
          phone: text(customer.phone),
          email: text(customer.email),
        },
        service: {
          id: text(service.id),
          name: text(service.name),
          durationMinutes: number(service.duration_minutes),
        },
        therapist: { id: text(therapist.id), name: text(therapist.full_name) },
        driver: { id: text(driver.id), name: text(driver.full_name) },
        status: b.status,
        progressStatus: b.booking_progress_status,
        paymentStatus: b.payment_status,
        type: b.type,
        deliveryType: b.delivery_type,
        bookingMode: text(metadata.crm_booking_mode),
        homeServiceAddress: {
          fullAddress: text(address.full_address),
          accessNote: text(address.access_note),
          barangay: text(address.barangay),
          city: text(address.city),
          landmark: text(address.landmark),
          lat: number(address.lat),
          lng: number(address.lng),
        },
        lifecycle: {
          checkedInAt: b.checked_in_at,
          travelStartedAt: b.travel_started_at,
          arrivedAt: b.arrived_at,
          sessionStartedAt: b.session_started_at,
          sessionCompletedAt: b.session_completed_at,
          completedAt: b.completed_at,
        },
        events: Array.isArray(b.booking_events)
          ? b.booking_events.map((event) => {
              const row = record(event);
              return {
                id: text(row.id),
                fromStatus: text(row.from_status),
                toStatus: text(row.to_status),
                notes: text(row.notes),
                createdAt: text(row.created_at),
              };
            })
          : [],
      },
    });
  });
}
