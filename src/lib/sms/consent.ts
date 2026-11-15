import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logger";
import { smsPhoneE164 } from "./policy";
import {
  phoneMatchesConsentContact,
  type PromotionalConsentSource,
  type SmsConsentChoice,
} from "./consent-policy";

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

type PromotionalCaptureInput = {
  bookingId: string;
  orderId: string | null;
  customerId: string;
  phone: string;
  explicitOptIn: boolean;
  source: PromotionalConsentSource;
};

/**
 * Server-only capture for explicit affirmative promotional/marketing SMS opt-in.
 * Strictly separated from transactional SMS eligibility (`booking_sms_consents`
 * and `transactional_opt_in_at`). Unchecked consent (`explicitOptIn !== true`)
 * never creates or enables marketing permission, and missing SMS schema or global
 * opt-out fails closed without undoing an otherwise valid booking.
 */
export async function capturePromotionalSmsConsent(
  input: PromotionalCaptureInput
): Promise<boolean> {
  if (input.explicitOptIn !== true) return false;
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

    const existingPref = await client
      .from("customer_sms_preferences")
      .select("customer_id,opted_out_at")
      .eq("customer_id", input.customerId)
      .maybeSingle();
    if (existingPref.error) {
      logError("booking.promotional_sms_consent_capture_failed", {
        code: existingPref.error.code ?? "DB_ERROR",
      });
      return false;
    }
    // Never silently re-opt in a globally opted-out customer.
    if (existingPref.data?.opted_out_at) return false;

    const nowIso = new Date().toISOString();
    const promoPayload = {
      consented_phone_e164: e164,
      promotional_opt_in_at: nowIso,
      promotional_consent_source: input.source,
      updated_at: nowIso,
    };

    const writeResult = existingPref.data
      ? await client
          .from("customer_sms_preferences")
          .update(promoPayload)
          .eq("customer_id", input.customerId)
          .is("opted_out_at", null)
      : await client.from("customer_sms_preferences").insert({
          customer_id: input.customerId,
          ...promoPayload,
        });

    if (!writeResult.error) return true;
    logError("booking.promotional_sms_consent_capture_failed", {
      code: writeResult.error.code ?? "DB_ERROR",
    });
    return false;
  } catch {
    logError("booking.promotional_sms_consent_capture_failed", { code: "UNEXPECTED" });
    return false;
  }
}
