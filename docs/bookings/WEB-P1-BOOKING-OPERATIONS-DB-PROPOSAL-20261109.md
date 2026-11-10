# Web Booking Operations — Database correction proposal (REVIEW ONLY)

**2026-11-09 / Web P1 / DDL NOT AUTHORIZED FOR LIVE EXECUTION**

This is a SQL **review artifact**, not a migration, not a production command and not an applied change.
The production database was inspected using SELECT only. The repository's local Supabase CLI
was not available to generate a canonical migration. An isolated Postgres test target,
attendance-trigger regression tests and owner release approval are required **before**
creating a real migration with the repository's current migration tool. Never replay
historical migrations or mark local-only migrations applied to enable this change.

## Policy decisions proposed for review

1. A new public booking is a **request** pending CSR confirmation; its capacity hold lasts
   120 minutes from creation (matching `PUBLIC_BOOKING_HOLD_MINUTES`). No guaranteed
   appointment is communicated before confirmation. Expired requests remain visible for
   CSR follow-up but no longer reserve a slot; the existing
   `confirm_online_booking_order_atomic` must fail expired requests and recheck
   room/staff capacity. The 120-minute policy requires owner acceptance, especially for
   overnight submissions. Do not assume this is production policy until approved.
2. Historical `pending_crm_confirmation` with NULL `hold_expires_at` remain blocking
   and must be reviewed explicitly; never bulk-backfill, auto-cancel, or expire them.
3. `booking_orders.booking_date` means the **earliest active scheduled service date**
   for the order. Each `bookings.booking_date` is its line's authoritative current date;
   rescheduling one line may split a group across dates. An original appointment date
   remains in `booking_events` and `metadata.crm_reschedule_history`.
4. No historical order-date backfill in this proposal. Report existing mismatches to
   CSR for case review before considering any targeted correction.

## Release-blocking conflict with overnight confirmation policy

**CORRECTION REQUIRED (2026-11-09):** The draft 120-minute hold starts at
creation time, but the separately authorized N4 notification policy queues
after-hours public booking requests silently until the next responsible CSR
duty session. A booking entered at 23:00 would therefore release its capacity
at 01:00 without the CSR having been offered a reasonable chance to confirm.
An after-hours queue and a fixed 120-minute hold cannot both be active under
the present contract.

This document's 120-minute trigger is **not approved**, even for new
bookings, until the owner explicitly approves a single unified capacity and
confirmation policy. Do not publish public wording promising reserved slots
for the entire unattended period unless server-side capacity actually remains
reserved. Do not silently auto-confirm or cancel overnight requests.

**Required policy review across PRs #91 and #92:**
- Decide whether an unattended overnight request reserves capacity until
  duty opening, or is only a request with availability rechecked at CSR action;
  preserve customer-facing wording and fairness for the chosen model.
- Define when an operational response SLA starts (request receipt versus
  responsible shift start), who owns grouped backlog, and how the CRM
  confirms/reschedules/declines without duplicate handling.
- Define a **server-authoritative** expiration function that is consistent
  across database slot predicates, room/staff allocation, public checkout,
  existing order confirmation and CRM visibility. Browser timers are not
  authorization or availability authority.
- Acceptance matrix: 20:59 and 21:01 submissions; 23:00 request with 10:00
  next-day duty; weekends/split shifts/no available CSR; 119/120/121-minute
  boundaries; simultaneous customer requests; newly reassigned therapist;
  public and CRM bookings on two devices with reconnect; expired reservation
  still visible for action; customer communication reflects actual status.
- Preserve all preexisting NULL-hold rows and audit history. No bulk expiry,
  cleanup, automatic cancellations or unattended financial changes.

**Important:** The SQL below is retained only for independent review; it is
not a migration and does not resolve this conflict. Do not execute it against
any environment until the policy is settled and rewritten accordingly.

## Proposed DDL — DO NOT APPLY to production

```sql
-- Both DB availability and TypeScript bookingBlocksAvailability must agree.
CREATE OR REPLACE FUNCTION public.crm_booking_row_blocks_availability(
  p_status text, p_hold_expires_at timestamptz
) RETURNS boolean
LANGUAGE sql STABLE
SET search_path TO public, pg_temp
AS $$
  SELECT CASE
    WHEN p_status IN ('pending', 'confirmed', 'in_progress', 'completed') THEN true
    WHEN p_status = 'pending_crm_confirmation'
      THEN p_hold_expires_at IS NULL OR p_hold_expires_at > now()
    WHEN p_status = 'pending_payment'
      THEN p_hold_expires_at IS NOT NULL AND p_hold_expires_at > now()
    ELSE false
  END;
$$;

CREATE FUNCTION public.set_public_crm_review_hold_on_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'pending_crm_confirmation'
     AND NEW.hold_expires_at IS NULL THEN
    NEW.hold_expires_at := now() + interval '120 minutes';
  END IF;
  RETURN NEW;
END;
$$;

-- Ordered lexically BEFORE trg_guard_booking_assignment_overlap so the guard
-- validates the actual new hold interval. Confirm installed trigger ordering.
CREATE TRIGGER trg_a_new_crm_review_hold
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_public_crm_review_hold_on_insert();

-- A successful service-line reschedule must keep the parent order header in
-- sync within the same transaction. Function owns no externally callable API.
CREATE FUNCTION public.sync_booking_order_operational_date()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE v_operational_date date;
BEGIN
  IF NEW.order_id IS NULL
     OR (OLD.booking_date IS NOT DISTINCT FROM NEW.booking_date
         AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.booking_orders bo
    WHERE bo.id = NEW.order_id AND bo.branch_id = NEW.branch_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_PARENT_ORDER_UNAVAILABLE'
      USING ERRCODE = '23503';
  END IF;

  SELECT min(b.booking_date) INTO v_operational_date
  FROM public.bookings b
  WHERE b.order_id = NEW.order_id AND b.branch_id = NEW.branch_id
    AND b.status NOT IN ('cancelled', 'no_show', 'expired');

  -- Fully closed orders retain the minimum recorded service date, rather
  -- than having a NULL header.
  IF v_operational_date IS NULL THEN
    SELECT min(b.booking_date) INTO v_operational_date
    FROM public.bookings b
    WHERE b.order_id = NEW.order_id AND b.branch_id = NEW.branch_id;
  END IF;

  IF v_operational_date IS NOT NULL THEN
    UPDATE public.booking_orders bo
    SET booking_date = v_operational_date
    WHERE bo.id = NEW.order_id AND bo.branch_id = NEW.branch_id
      AND bo.booking_date IS DISTINCT FROM v_operational_date;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_booking_order_operational_date()
  FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_z_sync_booking_order_operational_date
AFTER UPDATE OF booking_date, status ON public.bookings
FOR EACH ROW
WHEN (
  OLD.booking_date IS DISTINCT FROM NEW.booking_date
  OR OLD.status IS DISTINCT FROM NEW.status
)
EXECUTE FUNCTION public.sync_booking_order_operational_date();
```

## Required isolated tests and blockers

- Test 0/119/120/121-minute pending request boundaries, including after-hours and
  clock skew; check null legacy rows remain blocking.
- Validate no silent cancellation, audit retention and real CSR review access.
- Inspect **all** resource/staff availability consumers and installed SQL functions
  for mismatched treatment of expired holds. Test the actual trigger
  `trg_guard_booking_assignment_overlap` at concurrent booking commits.
- Exercise `confirm_online_booking_order_atomic` on an expired request after the
  slot is reused; it **must reject without confirmation or payment writes**.
- Test reschedules of one-line and multi-line orders, mixed dates, cancelled lines,
  concurrent reschedules, repeated idempotent writes, and RLS/role rights.
- Inspect current production triggers
  `bookings_lock_attendance_clock_out`,
  `bookings_recalculate_attendance_clock_out`, customer stats, and resource
  guards; prove no attendance or cash-flow side effect.
- Test authorization and SECURITY DEFINER trigger ownership in an **isolated**
  database; do not use this draft directly in production. Verify no direct
  function execute permission and no privilege escalation.
- Review whether all financial, receipt, Desktop and public consumers interpret
  order header dates as current schedule. Desktop remains a **separate track**;
  this proposal does not authorize its implementation.
- Prove rollback for each function/trigger change and verify no data migrations are
  needed. Retain historical rows unchanged.
