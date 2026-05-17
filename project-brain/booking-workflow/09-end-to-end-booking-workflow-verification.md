# Phase 9 — End-to-End Booking Workflow Verification

**Date:** 2026-05-17  
**Scope:** Phases 2–8 (online booking hold workflow, dev-bypass UUID fixes, notification sound, public wizard UI)

---

## 1. Summary of Phases Verified

| Phase | Feature | Status |
|-------|---------|--------|
| 2 | Online booking → `pending_payment` + hold | ✅ PASS |
| 3 | CRM bookings table confirmation panel | ✅ PASS |
| 4 | Offline resilience + observability | Not re-inspected (no changes in this pass) |
| 5 | CRM `confirmBookingPaymentAction` | ✅ PASS |
| 6 | CRM in-house booking creation | ✅ PASS |
| 7 | Notification sound (Web Audio API) | ✅ PASS |
| Dev UUID Fix | `changed_by` / `branch_id` "dev" string fix | ✅ PASS |
| 8 | Public booking wizard UI polish | ✅ PASS |

---

## 2. File-by-File Verification

### `src/lib/actions/online-booking.ts`
- Booking inserted with `status: "pending_payment"`, `payment_status: "pending"`, `hold_expires_at: holdExpiresAt` ✅
- One `payment_pending` CRM notification created after insert ✅
- `actionHref` uses `getNotificationTargetPath({ workspace: "crm", entityType: "booking", entityId })` → `/crm/bookings?bookingId=<id>` ✅
- No staff notification at creation (correct — staff isn't confirmed yet) ✅
- Multi-service bookings: notification uses `primaryBookingId` = `insertedIds[0]` ✅

### `src/lib/bookings/hold-status.ts`
- `PUBLIC_BOOKING_HOLD_MINUTES = 120` (2-hour hold window) ✅
- `bookingBlocksAvailability(booking, now)`:
  - `pending_payment` / `pending_crm_confirmation` → blocks ONLY if `hold_expires_at > now` ✅
  - `pending` / `confirmed` / `in_progress` / `completed` → always blocks ✅
  - `cancelled` / `no_show` / `expired` → never blocks ✅

### `src/lib/notifications/notification-targets.ts`
- `getBookingTargetPath("crm", id)` → `/crm/bookings?bookingId=<id>` ✅
- `getBookingTargetPath("staff-portal", id)` → `/staff-portal/schedule?bookingId=<id>` ✅
- `resolveNotificationHref()` explicitly guards against stale `/staff/bookings` and `/staff-portal/bookings` hrefs ✅
- No live code generates `/staff/bookings` (verified via grep — zero hits outside the guard) ✅

### `src/app/(dashboard)/crm/bookings/actions.ts` — `confirmBookingPaymentAction`
- Fetches booking with `hold_expires_at` fallback for `42703` error ✅
- Branch guard: owner bypasses, dev mode bypasses ✅
- Expired hold → checks for staff conflicts via `bookingBlocksAvailability()` ✅
- Payment audit log: `changed_by: me.id === "dev" ? null : me.id` ✅
- Update payload includes `hold_expires_at: null` to clear the hold ✅
- Retry without `hold_expires_at` on `42703` error ✅
- Staff notification after confirmation (`booking_assigned` or `home_service_assigned`) ✅
- Resolves `payment_pending` CRM notification ✅

### `src/app/(dashboard)/manager/bookings/actions.ts`
- `updateBookingStatusAction`: branch guard uses conditional `_statusBeforeQ`/`_statusUpdateQ` pattern ✅
- `editBookingAction`: branch guard uses conditional `_editCurrentQ`/`_editUpdateQ` pattern ✅
- `editBookingAction`: `assertSlotAvailable` now uses `current.branch_id` (real UUID, not "dev") ✅
- `editBookingAction`: notification calls now use `current.branch_id` ✅
- `updateBookingPaymentAction`: branch guard on payment fetch ✅
- `updateBookingPaymentAction`: `changed_by: me.id === "dev" ? null : me.id` ✅
- `updateBookingPaymentAction`: notification now uses `before?.branch_id ?? me.branch_id` ✅

### `src/lib/actions/inhouse-booking.ts`
- In-house bookings: `status: "confirmed"`, `hold_expires_at: null` ✅
- Payment audit log: `changed_by: staff?.id ?? null` (no "dev" string) ✅
- Staff notification: `booking_assigned` or `home_service_assigned` ✅
- No `payment_pending` CRM notification (payment already recorded at creation) ✅
- Home service dispatch notifications go to `/crm/today` (not bookings panel) ✅

### `src/lib/notifications/queries.ts`
- `getUnreadBookingNotificationIdsAction()` correctly filters: `status=unread`, `requires_action=true`, `entity_type="booking"` ✅
- Returns `string[]` of IDs, max 50 ✅

### `src/components/features/notifications/booking-notification-sound.tsx`
- Mount-time scan silently marks all current unread IDs as played (no chime on refresh) ✅
- 30s poll: plays chime only for IDs not in localStorage ✅
- AudioContext unlocked on first `click` or `keydown` ✅
- Two-tone chime: 880Hz + 1046Hz, sine, gain 0.1, ~0.5s total ✅
- localStorage cap at 200 entries ✅
- `isEnabled()` defaults to `true` when key absent ✅

### `src/components/features/notifications/notification-bell.tsx`
- `BookingNotificationSound` rendered only for: `crm`, `manager`, `csr`, `csr_head`, `csr_staff`, `owner` ✅
- Not rendered for: `staff`, `driver`, `utility` ✅

### `src/components/features/notifications/notification-row.tsx`
- Uses `resolveNotificationHref(n)` for navigation ✅
- No hardcoded `/staff/bookings` href ✅

### `src/components/features/notifications/notification-card.tsx`
- Uses `resolveNotificationHref(n)` for navigation ✅
- No hardcoded `/staff/bookings` href ✅

### `src/app/(dashboard)/crm/bookings/page.tsx`
- Handles `bookingId` query param from notification link ✅
- Auto-resolves booking date when `bookingId` is present but no `date` param ✅

### `src/components/public/booking-service-picker.tsx`
- `aria-pressed={isSelected}` on each service button ✅
- `line-clamp-2` on description ✅
- Availability badges (`In-spa`, `Home service`) with correct conditional rendering ✅
- Skeleton height updated to `h-[94px]` ✅

### `src/components/public/booking-wizard.tsx`
- `getInitials(name)` helper: splits on whitespace, takes first letter of first two words ✅
- `StepTherapist`: 2-column grid `sm:grid-cols-2` ✅
- Therapist cards: initials avatar, name, staff type label, check icon when selected ✅
- `aria-pressed` on therapist card buttons ✅
- `mode` prop removed (was only used for removed `secondaryName`) ✅
- No full legal name shown in public mode ✅

---

## 3. Migration Audit

### Missing migration written: `20260522000001_online_booking_holds.sql`

**Problem found:** The `bookings.status` CHECK constraint in `20260429000001_core_tables.sql` only contained the original 6 values. Neither `pending_payment` nor `pending_crm_confirmation` were present. The `hold_expires_at` column also had no migration, only TypeScript type coverage.

**Migration written adds:**
1. Drops and re-creates `bookings_status_check` with `pending_payment` and `pending_crm_confirmation` added
2. Drops and re-creates `booking_events.from_status` and `to_status` CHECK constraints in sync
3. `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ`
4. `idx_bookings_hold_expires_at` partial index (WHERE `hold_expires_at IS NOT NULL`)
5. `idx_bookings_pending_payment_branch_date` composite index for availability queries

### TypeScript types (`src/types/supabase.ts`)
- `hold_expires_at: string | null` already present in Row, Insert, Update types ✅

### All other migrations verified present:
- `20260517000001_booking_payment_logs.sql` — `booking_payment_logs` table with `changed_by UUID REFERENCES staff(id) ON DELETE SET NULL` ✅
- `20260518000001_booking_delivery_type.sql` — `delivery_type` column ✅
- `20260512000001_workspace_notifications.sql` — `requires_action`, `entity_type`, `entity_id` columns ✅

---

## 4. Bugs Found and Fixed

### Bug 1 — UUID "dev" in `changed_by` (already fixed in earlier session)
**Files:** `crm/bookings/actions.ts`, `manager/bookings/actions.ts`, `inhouse-booking.ts`
**Fix:** `changed_by: me.id === "dev" ? null : me.id` / `staff?.id ?? null`

### Bug 2 — UUID "dev" in `.eq("branch_id", me.branch_id)` (already fixed)
**File:** `manager/bookings/actions.ts`
**Fix:** Conditional query building with `_varQ` pattern

### Bug 3 — `assertSlotAvailable` passed `me.branch_id` ("dev") in dev mode (fixed in this pass)
**File:** `manager/bookings/actions.ts`, `editBookingAction` line ~224
**Fix:** Changed to `current.branch_id` (real UUID from the fetched booking)

### Bug 4 — Notification calls in `editBookingAction` used `me.branch_id` (fixed in this pass)
**File:** `manager/bookings/actions.ts`
**Fix:** Changed both notification calls to use `current.branch_id`

### Bug 5 — Notification in `updateBookingPaymentAction` used `me.branch_id` (fixed in this pass)
**File:** `manager/bookings/actions.ts`
**Fix:** Added `branch_id` to the payment fetch select; notification now uses `before?.branch_id ?? me.branch_id`

### Bug 6 — Missing `hold_expires_at` migration (fixed in this pass)
**Migration created:** `20260522000001_online_booking_holds.sql`

---

## 5. No Regressions Found

- No `/staff/bookings` hrefs generated anywhere (only guarded against in `resolveNotificationHref`)
- No duplicate notifications possible: `createNotification` inserts are idempotent by type+entity+status; `resolveNotificationsForEntity` clears old ones before new ones are created
- Hold expiry logic is non-destructive: expired holds don't block availability, they can still be confirmed (with conflict check)
- In-house bookings bypass the entire hold/payment-pending flow correctly

---

## 6. Remaining Notes

- `editBookingAction` passes `me.branch_id` to `assertSlotAvailable` — dev mode used to silently return "slot unavailable" (caught exception). Fixed to use `current.branch_id` in this pass.
- The sound component does NOT auto-chime if AudioContext hasn't been unlocked by a user gesture (browser autoplay policy). On first page load, the user must click or press a key first. This is expected browser behavior, not a bug.
- `pending_crm_confirmation` status exists in the codebase/types but is not actively assigned by any current action. It's reserved for a future "payment confirmed, awaiting manual CRM sign-off" flow.
