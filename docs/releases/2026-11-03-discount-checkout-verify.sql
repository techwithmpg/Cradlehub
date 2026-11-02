-- READ ONLY: run after installing the production discount package.
-- These catalog checks do not post payments, create sample records or verify a real checkout.
SELECT
  signature AS function_name,
  to_regprocedure(signature) IS NOT NULL AS installed,
  coalesce(has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE'),false) AS authenticated_can_call,
  NOT coalesce(has_function_privilege('anon',to_regprocedure(signature),'EXECUTE'),false) AS anonymous_blocked
FROM (VALUES
 ('public.quote_order_discounts(uuid,jsonb)'),
 ('public.post_order_payment_with_discounts_atomic(uuid,text,jsonb,jsonb,text,jsonb,date,text,text)'),
 ('public.customer_discount_history(uuid)'),
 ('public.discount_payment_receipt(text)')
) AS functions(signature);

SELECT
  to_regclass('public.order_discount_audits') IS NOT NULL AS audit_table_installed,
  coalesce((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.order_discount_audits')),false) AS audit_rls_enabled,
  NOT coalesce(has_table_privilege('authenticated',to_regclass('public.order_discount_audits'),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),false) AS direct_staff_access_blocked,
  NOT coalesce(has_table_privilege('anon',to_regclass('public.order_discount_audits'),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),false) AS direct_anonymous_access_blocked;
