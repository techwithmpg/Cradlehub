"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomBytes } from "crypto";

const getOrCreateSchema = z.object({
  bookingId: z.guid("Invalid booking ID"),
});

const deactivateSchema = z.object({
  bookingId: z.guid("Invalid booking ID"),
});

function generateToken(): string {
  return randomBytes(12).toString("base64url");
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim() || "https://your-domain.com";
}

// ── Get or create a tracking link for an active home-service booking ──────────
// Idempotent: if an active, non-expired token already exists, returns it.
// Token expires 24h from creation.
export async function getOrCreateCustomerTrackingLinkAction(rawInput: unknown): Promise<{
  ok: boolean;
  token?: string;
  url?: string;
  message?: string;
  error?: string;
}> {
  const parsed = getOrCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid input" };
  }

  const { bookingId } = parsed.data;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isDevAuthBypassEnabled()) {
    return { ok: false, error: "Not authenticated" };
  }

  let staffId: string;
  let branchId: string;

  if (isDevAuthBypassEnabled() && !user) {
    staffId = "00000000-0000-0000-0000-000000000000";
    branchId = "00000000-0000-0000-0000-000000000000";
  } else {
    const { data: me } = await supabase
      .from("staff")
      .select("id, branch_id, system_role")
      .eq("auth_user_id", user!.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!me) return { ok: false, error: "No active staff record" };
    staffId = me.id;
    branchId = me.branch_id ?? "";
  }

  // Validate the booking
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, branch_id, type, delivery_type, status, customer_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return { ok: false, error: "Booking not found" };

  const isHomeService =
    booking.type === "home_service" ||
    (booking as { delivery_type?: string }).delivery_type === "home_service";

  if (!isHomeService) {
    return { ok: false, error: "Tracking links are only available for home-service bookings" };
  }

  const terminalStatuses = ["completed", "cancelled", "no_show"];
  if (terminalStatuses.includes(booking.status)) {
    return { ok: false, error: "Cannot create a tracking link for a completed or cancelled booking" };
  }

  const effectiveBranchId = booking.branch_id ?? branchId;
  const now = new Date();

  // Check for existing active, non-expired token
  const { data: existing } = await supabase
    .from("customer_tracking_links")
    .select("token, expires_at")
    .eq("booking_id", bookingId)
    .eq("is_active", true)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const url = `${siteUrl()}/track/${existing.token}`;
    return { ok: true, token: existing.token, url, message: buildTrackingMessage(url) };
  }

  // Create a new token
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const { error: insertErr } = await supabase
    .from("customer_tracking_links")
    .insert({
      booking_id: bookingId,
      branch_id: effectiveBranchId,
      customer_id: (booking as { customer_id?: string | null }).customer_id ?? null,
      token,
      expires_at: expiresAt,
      is_active: true,
      created_by: staffId,
    });

  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath("/manager/control");
  revalidatePath("/crm/control");
  revalidatePath("/crm/today");

  const url = `${siteUrl()}/track/${token}`;
  return { ok: true, token, url, message: buildTrackingMessage(url) };
}

// ── Deactivate all tracking links for a booking ───────────────────────────────
export async function deactivateCustomerTrackingLinksAction(rawInput: unknown): Promise<{
  ok: boolean;
  error?: string;
}> {
  const parsed = deactivateSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid input" };
  }

  const { bookingId } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("customer_tracking_links")
    .update({ is_active: false })
    .eq("booking_id", bookingId)
    .eq("is_active", true);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/manager/control");
  revalidatePath("/crm/control");
  revalidatePath("/crm/today");

  return { ok: true };
}

// ── Fetch the active tracking token for a booking (for control console display) ─
export async function getActiveTrackingTokenForBooking(
  bookingId: string
): Promise<{ token: string; url: string; message: string } | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customer_tracking_links")
      .select("token")
      .eq("booking_id", bookingId)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const url = `${siteUrl()}/track/${data.token}`;
    return { token: data.token, url, message: buildTrackingMessage(url) };
  } catch {
    return null;
  }
}

// ── Batch fetch active tracking tokens for a set of booking IDs ───────────────
export async function getActiveTrackingTokensForBookings(
  bookingIds: string[]
): Promise<Record<string, { token: string; url: string; message: string }>> {
  if (bookingIds.length === 0) return {};
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customer_tracking_links")
      .select("booking_id, token")
      .in("booking_id", bookingIds)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (!data) return {};

    const result: Record<string, { token: string; url: string; message: string }> = {};
    for (const row of data) {
      if (row.booking_id && !result[row.booking_id]) {
        const url = `${siteUrl()}/track/${row.token}`;
        result[row.booking_id] = { token: row.token, url, message: buildTrackingMessage(url) };
      }
    }
    return result;
  } catch {
    return {};
  }
}

// ── Customer message template ─────────────────────────────────────────────────
function buildTrackingMessage(trackingUrl: string): string {
  return `Hi! Your Cradle therapist is on the way. You can track their location here:\n${trackingUrl}\n\nThis link is active for 24 hours. See you soon! 💆`;
}
