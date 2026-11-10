-- CradleHub Web P1 booking operational release audit: READ ONLY.
-- Run against authorized target (LOCAL/TEST first; production read-only only).
-- Never execute DML/DDL or infer browser/receipt delivery from these results.

-- 1. Per-branch open booking review backlog; no customer PII.
SELECT br.name AS branch,
       b.status,
       COUNT(*) FILTER (
         WHERE b.booking_date < (now() AT TIME ZONE 'Asia/Manila')::date
       ) AS overdue_lines,
       COUNT(DISTINCT b.order_id) FILTER (
         WHERE b.booking_date < (now() AT TIME ZONE 'Asia/Manila')::date
       ) AS overdue_orders,
       COUNT(*) FILTER (
         WHERE b.hold_expires_at IS NULL
       ) AS null_hold_lines
FROM public.bookings b
JOIN public.branches br ON br.id = b.branch_id
WHERE b.status IN ('pending_crm_confirmation','pending_payment','pending')
GROUP BY br.name, b.status ORDER BY br.name, b.status;

-- 2. Current service-line vs parent date drift, by status.
-- NOT proof of a defect until original-date semantics are reviewed.
SELECT b.status, COUNT(*) AS lines,
       COUNT(DISTINCT b.order_id) AS orders
FROM public.bookings b
JOIN public.booking_orders o ON o.id = b.order_id
WHERE b.booking_date IS DISTINCT FROM o.booking_date
GROUP BY b.status ORDER BY b.status;

-- 3. Canonical order payment arithmetic.
-- Does not verify a physical receipt, payment device, or a cash drawer.
SELECT COUNT(*) AS recent_orders,
       COUNT(*) FILTER (WHERE s.order_id IS NULL) AS missing_summaries,
       COUNT(*) FILTER (WHERE s.total_payable < 0) AS negative_payable,
       COUNT(*) FILTER (WHERE s.net_allocated < 0) AS negative_allocated,
       COUNT(*) FILTER (WHERE s.remaining_balance < -0.01) AS negative_remaining,
       COUNT(*) FILTER (
         WHERE ABS(COALESCE(s.total_payable,0)-COALESCE(s.net_allocated,0)
                   -COALESCE(s.remaining_balance,0)) > 0.01
       ) AS arithmetic_mismatches
FROM public.booking_orders o
LEFT JOIN public.v_booking_order_financial_summaries s ON s.order_id=o.id
WHERE o.created_at >= now()-interval '90 days';

-- 4. Booking-related posted financial transactions with missing order or
-- cross-branch source. Do not confuse unmatched legacy bookings with orders.
SELECT COUNT(*) AS recent_posted_booking_order_payments,
       COUNT(*) FILTER (WHERE o.id IS NULL) AS missing_order,
       COUNT(*) FILTER (
          WHERE o.id IS NOT NULL AND o.branch_id IS DISTINCT FROM t.branch_id
       ) AS branch_mismatch,
       COUNT(*) FILTER (WHERE NOT EXISTS (
         SELECT 1 FROM public.financial_account_movements m
         WHERE m.transaction_id=t.id
       )) AS no_financial_movement
FROM public.financial_transactions t
LEFT JOIN public.booking_orders o
  ON t.source_type='booking_order' AND t.source_id=o.id::text
WHERE t.created_at >= now()-interval '90 days'
  AND t.source_type='booking_order'
  AND t.transaction_type IN ('customer_payment','customer_deposit')
  AND t.status='posted';

-- 5. Notifications are in-app records; this does not verify push delivery,
-- SMS, voice calls, email delivery or staff acknowledgment.
SELECT target_workspace, type, status,
       COUNT(*) AS notifications
FROM public.workspace_notifications
WHERE created_at >= now()-interval '90 days'
  AND type IN (
    'booking_created','booking_assigned','home_service_assigned',
    'booking_reassigned','booking_rescheduled','booking_cancelled'
  )
GROUP BY target_workspace,type,status
ORDER BY target_workspace,type,status;

-- 6. Presence is not permission to send; provider approvals still required.
SELECT to_regclass('public.booking_sms_messages') AS sms_outbox_table,
       to_regclass('public.workspace_notifications') AS in_app_notifications_table;
