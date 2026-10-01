-- Read-only catalog verification for the approved project, before/after an
-- independently authorized deployment. No business rows or mutating SQL.

SELECT current_database() AS database_name, current_user AS catalog_reader;

WITH expected(name) AS (
  VALUES ('booking_orders'), ('booking_attendees'), ('bookings'),
    ('financial_accounts'), ('financial_transactions'),
    ('financial_account_movements'), ('order_payable_items'),
    ('financial_order_allocations'), ('financial_expense_categories'),
    ('financial_expense_details'), ('financial_tip_details'),
    ('financial_commercial_details'), ('cash_sessions')
)
SELECT name, to_regclass(format('public.%I', name)) IS NOT NULL AS present
FROM expected ORDER BY name;

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'staff' AND column_name IN ('role', 'system_role'))
    OR (table_name = 'bookings' AND column_name IN
      ('order_id', 'attendee_id', 'line_sequence', 'payment_method', 'payment_status', 'amount_paid'))
    OR (table_name = 'booking_orders' AND column_name = 'organizer_customer_id'))
ORDER BY table_name, column_name;

SELECT c.relname, c.relkind, c.relrowsecurity, c.reloptions
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN
  ('booking_orders', 'booking_attendees', 'bookings', 'financial_accounts',
   'financial_transactions', 'financial_account_movements', 'order_payable_items',
   'financial_order_allocations', 'financial_expense_categories',
   'financial_expense_details', 'financial_tip_details',
   'financial_commercial_details', 'cash_sessions',
   'v_booking_orders', 'v_financial_accounts', 'v_booking_order_financial_summaries')
ORDER BY c.relname;

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer, p.proconfig AS function_config, p.proacl AS grants
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN
  ('create_booking_order_atomic', 'record_booking_payment_change',
   'post_order_payment_atomic', 'post_booking_payment_atomic',
   'create_inhouse_order_with_payment_atomic', 'open_cash_session_atomic',
   'post_expense_atomic', 'post_tip_atomic', 'post_misc_income_atomic',
   'post_cash_adjustment_atomic', 'post_transfer_atomic')
ORDER BY p.proname, args;

SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename IN
  ('booking_orders', 'booking_attendees', 'financial_accounts',
   'financial_transactions', 'financial_account_movements',
   'order_payable_items', 'financial_order_allocations',
   'financial_expense_details', 'financial_tip_details',
   'financial_commercial_details', 'cash_sessions')
ORDER BY tablename, policyname;

SELECT c.relname AS table_name, t.tgname, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'bookings' AND NOT t.tgisinternal
ORDER BY t.tgname;

SELECT schemaname, tablename, pubname FROM pg_publication_tables
WHERE schemaname = 'public' AND tablename IN
  ('bookings', 'booking_orders', 'booking_attendees', 'financial_transactions', 'cash_sessions')
ORDER BY tablename, pubname;
