-- CUSTOMER SMS FOUNDATION — DRAFT FOR REVIEW, NOT AN APPLIED MIGRATION.
-- DO NOT execute on production or run bulk migration-history repair.
-- When this passes isolated LOCAL/TEST review, use the installed Supabase CLI
-- migration-new workflow to create a forward-only migration from this draft.
-- Required prerequisites: customers, bookings, booking_orders, booking_events.
--
-- Consent is explicit and scoped to the current verified phone number.
-- The SQL intentionally does not backfill or infer consent from past bookings.
CREATE TABLE IF NOT EXISTS public.customer_sms_preferences (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  consented_phone_e164 text,
  transactional_opt_in_at timestamptz,
  consent_source text,
  opted_out_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_sms_preferences_phone_ck CHECK (
    consented_phone_e164 IS NULL OR consented_phone_e164 ~ '^\+639[0-9]{9}$'
  ),
  CONSTRAINT customer_sms_preferences_consent_ck CHECK (
    transactional_opt_in_at IS NULL OR
      (consented_phone_e164 IS NOT NULL AND nullif(trim(consent_source), '') IS NOT NULL)
  )
);
ALTER TABLE public.customer_sms_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_sms_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customer_sms_preferences TO service_role;

-- A unique delivery claim exists before any HTTP request to Twilio.
-- Rows with unknown provider outcomes must NOT be retried automatically.
-- No message bodies or full phone numbers are stored in this ledger.
CREATE TABLE IF NOT EXISTS public.booking_sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.booking_orders(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('confirmation', 'morning', 'one_hour')),
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  state text NOT NULL DEFAULT 'claimed'
    CHECK (state IN ('claimed', 'accepted', 'sent', 'delivered', 'failed', 'undelivered', 'unknown')),
  provider_sid text,
  provider_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_sms_messages_dedupe_nonempty CHECK (length(dedupe_key) > 10)
);
CREATE INDEX IF NOT EXISTS booking_sms_messages_created_idx
  ON public.booking_sms_messages(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS booking_sms_messages_provider_sid_idx
  ON public.booking_sms_messages(provider_sid) WHERE provider_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_sms_messages_booking_idx
  ON public.booking_sms_messages(booking_id, created_at DESC);
ALTER TABLE public.booking_sms_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_sms_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.booking_sms_messages TO service_role;

COMMENT ON TABLE public.customer_sms_preferences IS
  'Recorded consent for operational appointment SMS. Never infer consent from stored phone alone.';
COMMENT ON TABLE public.booking_sms_messages IS
  'Idempotent, PII-minimized customer SMS send log; only privileged server workers may access.';
