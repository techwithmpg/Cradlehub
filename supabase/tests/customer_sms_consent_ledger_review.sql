-- Read-only structural acceptance checks, isolated TEST only.
BEGIN;
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['customer_sms_preferences','booking_sms_consents','booking_sms_messages'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname=tbl AND c.relkind='r' AND c.relrowsecurity)
    THEN RAISE EXCEPTION 'SMS RLS missing: %', tbl; END IF;
    IF has_table_privilege('anon','public.' || tbl,'SELECT') OR
       has_table_privilege('anon','public.' || tbl,'INSERT') OR
       has_table_privilege('authenticated','public.' || tbl,'SELECT') OR
       has_table_privilege('authenticated','public.' || tbl,'INSERT')
    THEN RAISE EXCEPTION 'SMS client grant: %', tbl; END IF;
    IF NOT has_table_privilege('service_role','public.' || tbl,'SELECT') OR
       NOT has_table_privilege('service_role','public.' || tbl,'INSERT')
    THEN RAISE EXCEPTION 'SMS server grant absent: %', tbl; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='booking_sms_visit_id_ck')
  THEN RAISE EXCEPTION 'Missing visit id constraint'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='booking_sms_messages_dedupe_key_key')
  THEN RAISE EXCEPTION 'Missing unique ledger claim'; END IF;
END $$;
ROLLBACK;
