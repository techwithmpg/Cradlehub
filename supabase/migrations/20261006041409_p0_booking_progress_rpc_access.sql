-- The staff portal validates the caller and booking before invoking this
-- SECURITY DEFINER function with the server-only service-role client.
-- Direct Data API callers must not be able to advance any booking by UUID.
REVOKE ALL ON FUNCTION public.update_booking_progress(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_booking_progress(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_booking_progress(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking_progress(uuid, text) TO service_role;
