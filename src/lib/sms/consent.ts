import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logger";
import { smsPhoneE164 } from "./policy";
import { phoneMatchesConsentContact, type SmsConsentChoice } from "./consent-policy";

type CaptureInput = {
  bookingId: string;
  orderId: string | null;
  customerId: string;
  phone: string;
  choice: SmsConsentChoice;
  source: "public_booking" | "crm_booking";
  actorAuthUserId?: string;
};

/**
 * Server-only post-booking consent capture. Never grants access to an arbitrary
 * customer through a public endpoint. Missing schema or conflicting identity
 * fails closed for SMS without undoing an otherwise valid booking.
 */
export async function captureBookingSmsConsent(input: CaptureInput): Promise<boolean> {
  const e164 = smsPhoneE164(input.phone);
  if (!e164) return false;
  const client = createAdminClient() as unknown as SupabaseClient;
  try {
    const booking = await client
      .from("bookings")
      .select("id,order_id,customer_id")
      .eq("id", input.bookingId)
      .maybeSingle();
    if (
      booking.error ||
      !booking.data ||
      booking.data.customer_id !== input.customerId ||
      (booking.data.order_id ?? null) !== input.orderId
    )
      return false;
    const customer = await client
      .from("customers")
      .select("phone")
      .eq("id", input.customerId)
      .maybeSingle();
    if (
      customer.error ||
      !customer.data ||
      !phoneMatchesConsentContact(input.phone, String(customer.data.phone ?? ""))
    )
      return false;

    const visitKey = input.orderId ?? input.bookingId;
    const row = {
      visit_key: visitKey,
      booking_id: input.bookingId,
      order_id: input.orderId,
      customer_id: input.customerId,
      phone_e164: e164,
      choice: input.choice,
      consent_source: input.source,
      actor_auth_user_id: input.source === "crm_booking" ? (input.actorAuthUserId ?? null) : null,
    };
    const inserted = await client.from("booking_sms_consents").insert(row);
    if (!inserted.error) return true;
    if (inserted.error.code === "23505") {
      const existing = await client
        .from("booking_sms_consents")
        .select("customer_id,phone_e164,choice")
        .eq("visit_key", visitKey)
        .maybeSingle();
      if (
        existing.error ||
        !existing.data ||
        existing.data.customer_id !== input.customerId ||
        existing.data.phone_e164 !== e164
      )
        return false;
      if (existing.data.choice === input.choice) return true;
      // Explicit "no" may revoke this visit's opt-in; never silently re-opt-in.
      if (input.choice !== "opt_out") return false;
      const revoked = await client
        .from("booking_sms_consents")
        .update({ choice: "opt_out", updated_at: new Date().toISOString() })
        .eq("visit_key", visitKey)
        .eq("customer_id", input.customerId)
        .eq("phone_e164", e164);
      return !revoked.error;
    }
    logError("booking.sms_consent_capture_failed", { code: inserted.error.code ?? "DB_ERROR" });
    return false;
  } catch {
    logError("booking.sms_consent_capture_failed", { code: "UNEXPECTED" });
    return false;
  }
}
