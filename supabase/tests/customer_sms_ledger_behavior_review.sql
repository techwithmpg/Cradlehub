-- ISOLATED PostgreSQL 17 fixture-based constraints test.
-- Does not prove compatibility with the full Cradle production schema.
BEGIN;
INSERT INTO public.customers(id,phone) VALUES
  ('11111111-1111-4111-8111-111111111111','09123456789');
INSERT INTO public.booking_orders(id) VALUES
  ('22222222-2222-4222-8222-222222222222'),
  ('22222222-2222-4222-8222-222222222223');
INSERT INTO public.bookings(id,customer_id,order_id) VALUES
  ('33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333334',
   '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222223');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.booking_sms_consents) <> 0 THEN
    RAISE EXCEPTION 'Consent was inferred or backfilled';
  END IF;
END $$;

INSERT INTO public.booking_sms_consents(
  visit_key,booking_id,order_id,customer_id,phone_e164,choice,consent_source)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '+639123456789','opt_in','public_booking'
);

-- Explicit opt-out wins for this visit.
UPDATE public.booking_sms_consents SET choice='opt_out'
WHERE visit_key='22222222-2222-4222-8222-222222222222';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.booking_sms_consents
     WHERE visit_key='22222222-2222-4222-8222-222222222222'
       AND choice='opt_out') THEN
    RAISE EXCEPTION 'Explicit opt-out not persisted';
  END IF;
  IF EXISTS (SELECT 1 FROM public.booking_sms_consents
     WHERE visit_key='22222222-2222-4222-8222-222222222223') THEN
    RAISE EXCEPTION 'Another visit received inferred consent';
  END IF;

  -- Wrong visit key cannot be recorded.
  BEGIN
    INSERT INTO public.booking_sms_consents(
      visit_key,booking_id,order_id,customer_id,phone_e164,choice,consent_source)
    VALUES (
      '22222222-2222-4222-8222-222222222223',
      '33333333-3333-4333-8333-333333333333',
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      '+639123456789','opt_in','public_booking'
    );
    RAISE EXCEPTION 'Mismatched visit accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Duplicate visit claim is rejected.
  BEGIN
    INSERT INTO public.booking_sms_consents(
      visit_key,booking_id,order_id,customer_id,phone_e164,choice,consent_source)
    VALUES (
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      '+639123456789','opt_in','public_booking'
    );
    RAISE EXCEPTION 'Duplicate visit consent accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

INSERT INTO public.booking_sms_messages (
  dedupe_key,booking_id,order_id,customer_id,kind,appointment_date,appointment_time,state
) VALUES (
  'confirmation:22222222:11111111:2026-11-30:14:00',
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'confirmation','2026-11-30','14:00:00','claimed'
);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.booking_sms_messages (
      dedupe_key,booking_id,order_id,customer_id,kind,appointment_date,appointment_time,state
    ) VALUES (
      'confirmation:22222222:11111111:2026-11-30:14:00',
      '33333333-3333-4333-8333-333333333333',
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'confirmation','2026-11-30','14:00:00','claimed'
    );
    RAISE EXCEPTION 'Duplicate SMS ledger claim accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='booking_sms_messages'
      AND column_name IN ('message_body','sms_text','phone_e164')
  ) THEN RAISE EXCEPTION 'SMS ledger contains unnecessary message/phone PII'; END IF;
END $$;
ROLLBACK;
