# CradleHub MVP Smoke Test Script

> **When to run:** Before every client demo or production deploy.
> **Estimated time:** 20–30 minutes
> **Prerequisites:** Two active branches, at least 2 active services per branch, at least 2 active staff with schedules, dev bypass OFF.

---

## Pre-Test Checklist

- [ ] App builds: `pnpm build` passes
- [ ] Database migrations are applied and seeded
- [ ] Both branches have active services and staff schedules
- [ ] Supabase Auth is configured
- [ ] Environment variables are set (no `DEV_AUTH_BYPASS=true` in production)

---

## Test 1: Public Branch A In-Spa Booking

**Actor:** Unauthenticated customer
**Path:** `/book`

1. Navigate to `/book`.
2. Select **Branch A** (e.g., SM City Bacolod).
3. Select **In-Spa** visit type.
4. Select any service.
5. Pick a future date and an available time slot.
6. Select a therapist (or accept auto-assignment).
7. Fill in name, phone, and email.
8. Submit booking.

**Expected:**
- Success message says "Booking request received" (not "Confirmed").
- Booking appears in CRM `/crm/today` and Manager `/manager` with status `pending`.
- Booking has `type = walkin` or `type = online` depending on path.
- No payment is collected.

**Pass / Fail:** ___

---

## Test 2: Public Branch A Home-Service Booking

**Actor:** Unauthenticated customer
**Path:** `/book`

1. Navigate to `/book`.
2. Select **Branch A**.
3. Select **Home Service** visit type.
4. Select any service available for home service.
5. Pick a future date and an available time slot.
6. Enter a Bacolod address and select a zone.
7. Fill in name, phone, and email.
8. Submit booking.

**Expected:**
- Success message says "Booking request received".
- Booking appears in CRM with `type = home_service`.
- Booking metadata includes `home_service_address` with zone and map URL.
- No dispatch conflict warning appears (unless another HS booking overlaps).

**Pass / Fail:** ___

---

## Test 3: Public Branch B In-Spa Booking

**Actor:** Unauthenticated customer
**Path:** `/book`

Repeat Test 1 for **Branch B** (e.g., La Luz).

**Expected:** Same as Test 1, but scoped to Branch B.

**Pass / Fail:** ___

---

## Test 4: Public Branch B Home-Service Booking

**Actor:** Unauthenticated customer
**Path:** `/book`

Repeat Test 2 for **Branch B**.

**Expected:** Same as Test 2, but scoped to Branch B.

**Pass / Fail:** ___

---

## Test 5: CRM Creates In-House Booking

**Actor:** CSR or CSR Head
**Path:** `/crm/bookings/new`

1. Log in as a CSR Head.
2. Go to `/crm/bookings/new`.
3. Select an existing customer (or create a new one).
4. Select Branch A, service, date, time.
5. Assign a room/bed if available.
6. Submit booking.

**Expected:**
- Booking created with status `confirmed`.
- Booking appears in Manager `/manager` and Staff Portal for assigned therapist.
- If no room selected and type is in-spa, a room is auto-assigned.

**Pass / Fail:** ___

---

## Test 6: CRM Marks Payment Collected

**Actor:** CSR Head
**Path:** `/crm/bookings`

1. Go to `/crm/bookings`.
2. Find a booking with status `completed` or `in_progress`.
3. Click the payment action menu.
4. Select **Cash** and enter an amount.
5. Save.

**Expected:**
- Payment status updates to `paid`.
- Payment method shows `cash`.
- Daily cash summary on `/crm/today` reflects the new total.

**Pass / Fail:** ___

---

## Test 7: Manager Approves Staff

**Actor:** Manager or Owner
**Path:** `/manager/staff/onboarding` or `/owner/staff/onboarding`

1. Go to onboarding requests page.
2. Find a pending staff request.
3. Click **Review & Approve**.
4. Activate the staff record and assign a branch.

**Expected:**
- Staff status changes to `is_active = true`.
- Staff appears in staff list and schedule grid.
- Staff can now be assigned to bookings.

**Pass / Fail:** ___

---

## Test 8: Manager Assigns Services to Staff

**Actor:** Owner
**Path:** `/owner/staff/[staffId]`

1. Go to a staff member's detail page.
2. Check/uncheck service capabilities.
3. Save.

**Expected:**
- `staff_services` junction table updates.
- Staff now appears (or no longer appears) in therapist selection for those services.

**Pass / Fail:** ___

---

## Test 9: Staff Logs In and Sees Schedule

**Actor:** Service Staff (therapist)
**Path:** `/staff-portal`

1. Log in as an active therapist.
2. Go to `/staff-portal`.
3. Verify today's assigned bookings are visible.
4. Go to `/staff-portal/week`.
5. Verify upcoming week's bookings are visible.

**Expected:**
- Only bookings assigned to this staff member are shown.
- Customer phone/email is NOT visible.
- Booking type and status badges are correct.

**Pass / Fail:** ___

---

## Test 10: Staff Updates In-Spa Progress

**Actor:** Service Staff
**Path:** `/staff-portal`

1. Find a walk-in or online booking for today.
2. Click **Check In**.
3. Verify status changes to `checked_in`.
4. Click **Start Session**.
5. Verify status changes to `session_started` and booking `status` changes to `in_progress`.
6. Click **Complete**.
7. Verify status changes to `completed` and booking `status` changes to `completed`.

**Expected:**
- Progress stepper updates visually.
- Timestamps are recorded (`checked_in_at`, `session_started_at`, `session_completed_at`).
- CRM and Manager pages reflect the new status after refresh.

**Pass / Fail:** ___

---

## Test 11: Staff Updates Home-Service Progress

**Actor:** Service Staff
**Path:** `/staff-portal`

1. Find a home-service booking for today.
2. Click **Start Travel**.
3. Verify `travel_started` status and timer starts.
4. Click **Arrived**.
5. Verify `arrived` status and timestamp.
6. Click **Start Session**.
7. Verify `session_started` status.
8. Click **Complete**.
9. Verify `completed` status.
10. **(If C1 fix is applied)** Click **Returned**.
11. Verify `returned` status and `returned_at` timestamp.

**Expected:**
- Each step has a valid transition.
- Invalid transitions are blocked with a clear error message.
- Timestamps are recorded at each stage.

**Pass / Fail:** ___

---

## Test 12: Owner Checks Overview

**Actor:** Owner
**Path:** `/owner`

1. Log in as owner.
2. Go to `/owner`.
3. Verify KPI cards show data across all branches.
4. Verify recent bookings list shows bookings from both branches.
5. Go to `/owner/bookings`.
6. Verify cross-branch booking list with filters.
7. Go to `/owner/reports`.
8. Verify daily cash summary and revenue trends.

**Expected:**
- Data is aggregated across all branches.
- Branch filter works.
- Payment summaries are accurate.

**Pass / Fail:** ___

---

## Test 13: Notification Read / Dismiss / Resolve

**Actor:** Any workspace user
**Path:** Notification bell + notification page

1. Trigger a notification (e.g., create a booking that auto-assigns a therapist).
2. Click the notification bell in the header.
3. Verify the dropdown opens with compact rows.
4. Switch tabs: All, Unread, Action required.
5. Click **Mark all read**.
6. Verify badge count goes to zero.
7. Go to workspace notifications page (e.g., `/crm/notifications`).
8. Verify notifications are grouped by Action Required / Unread / Earlier.
9. Dismiss a notification.
10. Verify it no longer appears in the list.

**Expected:**
- Bell badge shows only unread count.
- Dropdown uses compact rows (not giant cards).
- Action-required strip on Today page is compact and not overwhelming.
- Mark-all-read works across all unread notifications.

**Pass / Fail:** ___

---

## Regression Checks

Run these quickly after any code change:

- [ ] `/` homepage loads with no errors.
- [ ] `/services` shows active services.
- [ ] `/branches` shows both branches.
- [ ] `/login` form works.
- [ ] Unauthorized access to `/owner`, `/manager`, `/crm`, `/staff-portal` redirects to `/login`.
- [ ] CSR Staff cannot access `/owner` or `/manager/operations`.
- [ ] Staff cannot access `/crm` or `/manager`.
- [ ] `pnpm type-check && pnpm lint && pnpm build` all pass.

---

## Known Limitations (Acceptable for MVP)

| Limitation | Impact |
|------------|--------|
| No real payment gateway | Manual cash/GCash/Maya/Card recording only |
| No driver dispatch panel | Home service assignments are manual |
| No utility task panel | Room prep tracking is manual |
| No automated SMS/email notifications | Notifications are in-app only |
| Mobile non-manager workspaces lack shell | Demo on desktop only, or fix C3 first |
| "Returned" stage missing for home service | Demo home service up to "Complete" only |

---

## Sign-Off

| Role | Name | Date | Result |
|------|------|------|--------|
| Tester | | | Pass / Fail |
| Reviewer | | | Pass / Fail |
