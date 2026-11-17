import "server-only";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import { createClient } from "@/lib/supabase/server";
import { journeySchema, driverEventSchema } from "./journey";
export class DriverApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
export async function requireDriver() {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new DriverApiError(401, "sign_in_required", "Sign in to the Driver app.");
  const result = await db
    .from("staff")
    .select("id,branch_id,system_role,staff_type,is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  const s = result.data;
  if (
    result.error ||
    !s ||
    !s.branch_id ||
    resolveStaffPwaOperationalGroup(s.system_role, s.staff_type) !== "driver"
  )
    throw new DriverApiError(
      403,
      "driver_required",
      "An active assigned Driver account is required."
    );
  return { db, staff: s, user };
}
function requireInstalled() {
  if (process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED !== "true")
    throw new DriverApiError(
      503,
      "journeys_inactive",
      "The unified journey service is not enabled. Existing trips remain available."
    );
}
export async function readDriverJourneys(bookingId?: string) {
  requireInstalled();
  const { db } = await requireDriver();
  const { data, error } = await db.rpc(
    "driver_unified_snapshot" as never,
    { p_booking_id: bookingId ?? null } as never
  );
  if (error)
    throw new DriverApiError(
      503,
      "journeys_unavailable",
      "Journey status could not be verified. Refresh before acting."
    );
  const parsed = journeySchema.array().safeParse(data);
  if (!parsed.success)
    throw new DriverApiError(503, "invalid_journey_reply", "Journey status could not be verified.");
  return parsed.data;
}
export async function applyDriverEvent(raw: unknown) {
  requireInstalled();
  const event = driverEventSchema.safeParse(raw);
  if (!event.success)
    throw new DriverApiError(400, "invalid_event", "The journey event is invalid.");
  if (["gps_arrival", "location"].includes(event.data.action) && !event.data.point)
    throw new DriverApiError(
      400,
      "location_required",
      "A fresh accurate GPS observation is required."
    );
  const { db } = await requireDriver();
  const { data, error } = await db.rpc(
    "driver_unified_event" as never,
    { p_event: event.data } as never
  );
  if (error)
    throw new DriverApiError(
      409,
      "journey_changed",
      "The journey changed or could not be confirmed. Refresh before retrying."
    );
  const parsed = journeySchema.safeParse(data);
  if (!parsed.success)
    throw new DriverApiError(
      503,
      "invalid_journey_reply",
      "No successful journey update was confirmed."
    );
  return parsed.data;
}

/** Existing in-flight trips may finish; an enrolled transport cannot fall back
 * to a customer-only itinerary and bypass pickup, review or collection. */
export async function legacyDriverRouteAllowed(bookingId: string) {
  if (process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED !== "true") return true;
  const { db } = await requireDriver();
  const { data, error } = await db.rpc(
    "driver_unified_legacy_allowed" as never,
    { p_booking_id: bookingId } as never
  );
  if (error)
    throw new DriverApiError(503, "journeys_unavailable", "Journey status could not be verified.");
  return data === true;
}
