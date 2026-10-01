-- P1-A production parity: remove direct RPC execution from trigger-only functions.
--
-- Production authority:
-- This correction was applied directly to the live database after the
-- post-P1 security advisor identified direct anon/authenticated execution.
--
-- This repository migration records the exact forward correction.
-- Do not use it to replay, repair, rename, or rewrite historical migrations.

REVOKE ALL ON FUNCTION public.p1a_reconcile_booking_on_close() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.p1a_reconcile_booking_on_close() FROM anon;
REVOKE ALL ON FUNCTION public.p1a_reconcile_booking_on_close() FROM authenticated;

REVOKE ALL ON FUNCTION public.p1a_reject_closed_service_payable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.p1a_reject_closed_service_payable() FROM anon;
REVOKE ALL ON FUNCTION public.p1a_reject_closed_service_payable() FROM authenticated;
