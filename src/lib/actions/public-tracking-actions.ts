"use server";

// Public token-gated location polling.
// Uses service key because public tracking pages have no auth session.
// Token is the authorization mechanism — all data returned is customer-safe.

import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const tokenSchema = z.string().min(1).max(200);

export type PublicTrackingLocation = {
  lat: number;
  lng: number;
  recorded_at: string;
};

// Validate token and return the latest driver/therapist location.
// Returns null if token is invalid, expired, or no location has been shared yet.
export async function getPublicTrackingLocationAction(rawToken: unknown): Promise<PublicTrackingLocation | null> {
  const parsed = tokenSchema.safeParse(rawToken);
  if (!parsed.success) return null;
  const token = parsed.data;

  try {
    const supabase = createAdminClient();

    const { data: link } = await supabase
      .from("customer_tracking_links")
      .select("booking_id, is_active, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!link || !link.is_active || new Date(link.expires_at) <= new Date()) return null;

    const { data: booking } = await supabase
      .from("bookings")
      .select("status")
      .eq("id", link.booking_id)
      .maybeSingle();

    if (!booking || booking.status === "cancelled" || booking.status === "no_show") return null;

    const { data: snap } = await supabase
      .from("staff_location_snapshots")
      .select("lat, lng, recorded_at")
      .eq("booking_id", link.booking_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!snap) return null;
    return { lat: Number(snap.lat), lng: Number(snap.lng), recorded_at: snap.recorded_at };
  } catch {
    return null;
  }
}
