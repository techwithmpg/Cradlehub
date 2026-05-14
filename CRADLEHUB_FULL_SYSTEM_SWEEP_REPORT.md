# CradleHub — Full System Sweep Report

> **Date:** 2026-05-13  
> **Scope:** Analysis-only. No code, migrations, or UI changes.  
> **Goal:** Identify readiness, gaps, and recommended implementation order for the operational upgrade.

---

## Executive Summary

CradleHub has a mature core (branching, scheduling, bookings, unified progress, home-service dispatch, payments, notifications, cash reconciliation) but significant gaps remain before it can support live operations at scale. The highest-impact, lowest-risk wins are:

1. **Unify public branch data** (eliminate hardcoded addresses/phones).
2. **Enable manual payment recording** from CSR/manager workspace (backend ready; UI wiring needed).
3. **Build the Booking Control Console** (manager real-time view) using existing `getTodaysSchedule` + notification infra.
4. **Add `in_spa` as a first-class booking type** (currently mapped to `online`/`walkin` at DB level).
5. **Implement driver trip UI + live ETA** (Google Maps Routes API ready; need location storage).

Deep features (live tracking, payroll, leaderboards) require new tables and should follow after the above.

---

## 1. Public Branch Address Source-of-Truth Cleanup

### Current State — Dual Sourcing

| Source | Location | Content |
|--------|----------|---------|
| **Database** (`branches` table) | `supabase/migrations/001` | `name`, `address`, `phone`, `email`, `maps_embed_url`, `fb_page`, `messenger_link`, `slot_interval_minutes`, `is_active` |
| **Hardcoded TS** | `src/lib/public/public-site-data.ts` | `publicPhones`, `publicBranches`, `businessInfo`, `heroProofPoints`, `planningNotes` |
| **Hardcoded in components** | Contact, Branches, Footer, Header, Mobile pages | Phones, hours, addresses, branch names duplicated inline |

### Hardcoded Data Inventory

- `src/app/(public)/contact/page.tsx`  
  Phones: `0917 707 7070`, `0909 008 7815`  
  Addresses: SM City Bacolod, La Luz Branch  
  Hours: `10:00 AM – 10:00 PM`

- `src/app/(public)/branches/page.tsx`  
  Hours: `Daily · 9:00 AM – 9:00 PM`

- `src/lib/public/public-site-data.ts`  
  `publicPhones`, `publicBranches` (SM City / La Luz), `businessInfo`  
  `heroProofPoints`: "Two Bacolod branches"

- `src/components/public/site-footer.tsx`  
  "Open daily · Book online"

- `src/components/public/site-header.tsx`  
  Primary phone from `publicPhones[0]`

- `src/components/public/home-page-sections.tsx`  
  Consumes `publicPhones`, `publicBranches`

- `src/components/public/mobile/public-mobile-home.tsx`  
  FAQ answers hardcode branch names/addresses

- `src/components/public/mobile/public-mobile-contact.tsx`  
  Hours: `10:00 AM - 10:00 PM`

- `src/components/public/mobile/public-mobile-branches.tsx`  
  "Daily availability through booking"

### `public_site_sections` / `public_site_assets` Tables

Migration `20260510000001_public_site_content.sql` created CMS-like tables for marketing copy and image assets. **These are currently unused for branch/contact data.** They store section-level copy (`section_key`, `title`, `body`, `cta_label`, `image_url`) and image assets. RLS allows public read of enabled rows; owner-only management.

### Recommendations

1. **Enrich `branches` table** with columns needed for public display but missing:
   - `opening_hours` (TEXT or JSONB for per-day hours)
   - `secondary_phone` (TEXT)
   - `description` / `short_name` (TEXT, for hero copy)
   - `sort_order` (INT, for display ordering)
   - `is_featured` (BOOLEAN, for homepage highlights)

2. **Create `branch_public_content` view or query helper** that returns branch + public-site-enriched data in a single call, replacing `publicBranches` and `publicPhones` arrays.

3. **Refactor public pages** to call `getAllBranches()` (already exists in `src/lib/queries/branches.ts`) instead of importing `public-site-data.ts`. Keep `public-site-data.ts` as a temporary fallback with a `@deprecated` marker until all consumers are migrated.

4. **Use `public_site_sections` for marketing narrative** (hero text, CTA banners) but **not** for operational branch data — that must remain in `branches`.

5. **Update `DB_SCHEMA.md`** — it is stale (created at migration 007 level; missing 28+ subsequent migrations including payments, resources, rules, progress, reconciliations, notifications, public site content, etc.).

---

## 2. Manual Payment Recording Capability

### Current State

**Database:**
- `bookings` table has flat payment columns (migration `20260502000002_payment_fields.sql`):
  - `payment_method` (TEXT, default `pay_on_site`)
  - `payment_status` (TEXT, default `unpaid`)
  - `payment_reference` (TEXT)
  - `amount_paid` (NUMERIC, default 0)
- CHECK constraints on `payment_method`: `cash`, `gcash`, `maya`, `card`, `pay_on_site`, `other`
- CHECK constraints on `payment_status`: `unpaid`, `pending`, `paid`, `refunded`
- Indexes for daily cash summary queries exist.

**No `booking_payments` table exists.** This means:
- No audit trail for payment edits (who changed what, when).
- No support for partial payments or split payments.
- No void/reversal record.

**Server Actions:**
- `src/app/(dashboard)/owner/bookings/actions.ts` — `ownerUpdateBookingPaymentAction()` (cross-branch)
- `src/app/(dashboard)/manager/bookings/actions.ts` — `updateBookingPaymentAction()` (branch-scoped)
- Both use `updateBookingPaymentSchema` from `src/lib/validations/booking.ts`.

**UI Components:**
- `src/components/features/dashboard/payment-action-menu.tsx` — reusable payment editing UI.
  - Quick pay: Cash, GCash, Maya, Card → marks paid with full price.
  - Mark unpaid: resets to `pay_on_site`/`unpaid`/0.
  - Edit form: method, status, amount, reference number.
- Currently wired into `BookingsWorkspace` (`bookings-workspace.tsx`) used by owner, manager, and CRM.

**CRM Today Page:**
- `src/app/(dashboard)/crm/today/page.tsx` shows payment status badges and an "Unpaid / Outstanding" KPI.
- CSR can see payments but the quick-edit may not be exposed depending on workspaceContext prop.

### Gaps

1. **Audit/void table missing.** For operational trust, every payment mutation should write a row to a `booking_payment_logs` table (or future `booking_payments`).
2. **Partial payment support.** Current UI assumes single-shot full payment. The schema supports partial (`amount_paid` < price), but UX does not guide the user.
3. **Cash reconciliation link.** `daily_cash_reconciliations` table exists (migration `20260509000001`) but is not yet wired to booking payments. The expected_* columns should ideally auto-aggregate from `bookings`.

### Recommendations

1. **Phase 1 (immediate):** Ensure `PaymentActionMenu` is passed the correct `paymentAction` prop in all workspace contexts (owner, manager, CRM). Verify CSR roles can record payments.
2. **Phase 2:** Create `booking_payment_logs` table (append-only) with `booking_id`, `changed_by`, `old_method`, `new_method`, `old_status`, `new_status`, `old_amount`, `new_amount`, `reason`, `created_at`. No need to change the flat `bookings` columns yet.
3. **Phase 3:** Consider `booking_payments` child table if split payments or multi-method transactions become common.

---

## 3. Booking Control Console Planning

### Definition

A real-time, manager-facing dashboard showing:
- Today's timeline view (all bookings, all staff, all rooms)
- Live status of each booking (progress stepper + timestamps)
- Overbookings, gaps, and resource conflicts
- Home-service dispatch board (driver assignments, ETAs, zones)
- Quick actions: confirm, cancel, reassign, mark payment, send message

### Current Building Blocks

| Component | Status | Location |
|-----------|--------|----------|
| `getTodaysSchedule(branchId, date)` | ✅ Ready | `src/lib/queries/bookings.ts` |
| `getDailyPaymentSummary(branchId, date)` | ✅ Ready | `src/lib/queries/bookings.ts` |
| `BookingsWorkspace` | ✅ Ready | `src/components/features/bookings/bookings-workspace.tsx` |
| `CrmBookingQueuePanel` | ✅ Ready | `src/components/features/crm/today/crm-booking-queue-panel.tsx` |
| `BookingProgressActions` | ✅ Ready | `src/components/features/staff-portal/booking-progress-actions.tsx` |
| `PaymentActionMenu` | ✅ Ready | `src/components/features/dashboard/payment-action-menu.tsx` |
| `workspace_notifications` | ✅ Ready | `supabase/migrations/20260512000001_workspace_notifications.sql` |
| Notification create/resolve | ✅ Ready | `src/lib/notifications/create.ts` |
| Realtime (Supabase) | ⚠️ Not configured | No `supabase.realtime` channel subscriptions found in dashboard code |

### What Exists Today

- **Manager Today** (`src/app/(dashboard)/manager/today/page.tsx`) — minimal placeholder (121 bytes); likely just a redirect or skeleton.
- **CRM Today** (`src/app/(dashboard)/crm/today/page.tsx`) — rich today view with queue, KPIs, attention strip, side rail. Uses `getTodaysSchedule`.
- **Owner Overview** — cross-branch KPIs + booking list + branch performance.
- **Staff Portal** — individual staff view of today's bookings with progress actions.

### Gaps

1. **No manager "live board" page.** The manager workspace has `/manager/bookings` (list view) and `/manager/schedule` (calendar), but no consolidated control console.
2. **No real-time updates.** All dashboard pages are server-rendered at request time. No WebSocket/Realtime subscriptions for booking status changes.
3. **No resource conflict visualization.** `branch_resources` exist, but conflicts (double-booked room) are not surfaced in UI.
4. **No unified timeline.** `getTodaysSchedule` returns data; no timeline component renders it horizontally.

### Recommendations

1. **Create `/manager/control` page** (or enhance `/manager/today`) using CRM Today as the template. Add:
   - Horizontal timeline component (time on X-axis, staff/resources on Y-axis).
   - Drag-to-reassign (leverages existing `editBookingAction` which already handles slot availability + resource checks).
   - Conflict highlighting using existing `resource_conflict_warning` notification type.
2. **Enable Supabase Realtime** on `bookings` table for `booking_progress_status` and `status` changes. Use a lightweight client-side polling fallback if Realtime is not yet stable.
3. **Add `manager_control` notification target** to `NotificationWorkspace` enum if manager-specific alerts are needed.

---

## 4. Booking Delivery Types (`in_spa` / `home_service` / `walk_in`)

### Current State

**Database:**
```sql
bookings.type CHECK ('online', 'walkin', 'home_service')
```

**Public UI:**
- Booking wizard uses `VisitType`: `"in_spa"` | `"home_service"`.
- `in_spa` is mapped to:
  - `online` when created via public wizard (`createOnlineBookingSchema`)
  - `walkin` when created via in-house multi-step wizard (`createWalkinBookingSchema`, `createInhouseBookingMultiSchema`)

**Progress Flows:**
- `home_service`: not_started → travel_started → arrived → session_started → completed
- `walkin`: not_started → checked_in → session_started → completed (or no_show)
- `online`: not_started → session_started → completed

### Problem

`in_spa` is not a database type. This creates ambiguity:
- An online booking for in-spa service is stored as `type = 'online'`.
- A walk-in booking for in-spa service is stored as `type = 'walkin'`.
- There is no way to distinguish "customer booked online for in-spa" from "customer booked online for home_service" without looking at `home_service_address` metadata.

### Recommendations

1. **Option A (recommended):** Add `delivery_type` column to `bookings` with CHECK `('in_spa', 'home_service')`. Keep `type` as the channel (`online`, `walkin`, `home_service`), but clarify that `home_service` implies both channel and delivery.
   - Migration: add `delivery_type` TEXT default `'in_spa'`.
   - Update validation schemas to include `delivery_type`.
   - Update wizard to set `delivery_type` explicitly.

2. **Option B:** Rename `type` to `channel` and add `delivery_type`. Larger refactor; breaks existing queries.

3. **Option C (minimal):** Keep schema as-is but ensure all queries and reports treat `home_service_address` presence as the source of truth for delivery mode. Document this convention.

---

## 5. Home-Service Trip Workflow

### Current State

**Database:**
- `home_service_tracking_status` (legacy, backfilled into `booking_progress_status`)
- `travel_started_at`, `arrived_at`, `session_started_at`, `completed_at`
- `travel_buffer_mins` on bookings
- `home_service_address` JSONB in `metadata` (address, barangay, city, landmark, parking, zone, lat, lng, placeId, map_url)
- `dispatch` JSONB in `metadata` (needs_location_review, travel_minutes_estimate, driver_capacity_checked, dispatch_warning)

**RPC:**
- `update_booking_progress(p_booking_id, p_next_status)` — SECURITY DEFINER, type-aware transitions, validates staff ownership.

**Conflict Detection:**
- `src/lib/bookings/dispatch-conflict.ts` — zone-based + Google Maps travel time.
- Zones: `central_bacolod`, `north_bacolod_talisay`, `south_bacolod_alijis`, `east_bacolod`, `outside_bacolod`, `unknown`.
- Hard conflict: driver capacity exceeded OR travel > 30 mins between locations.
- Warning: unknown zone, unconfirmed location.

**Driver Assignment:**
- `staff_id` on booking is the **therapist**, not the driver.
- No `driver_id` column exists on bookings.
- `branch_booking_rules.home_service_driver_capacity` exists (default 1).

**Driver Workspace:**
- `/driver` route exists (`src/app/(dashboard)/driver/page.tsx`) but is a "Coming Soon" placeholder.
- It lists planned modules: Assigned Trips, Customer Location, Therapist Assignment, Travel Buffer, Open in Maps, Trip Status.

### Gaps

1. **No driver assignment.** There is no way to assign a driver to a home-service booking.
2. **No driver-specific progress actions.** The driver needs to mark "picked up therapist", "en route", "arrived", but the current progress model assumes the therapist does everything.
3. **No live ETA updates.** `travel_minutes_estimate` is computed once at booking creation; not updated based on real traffic.

### Recommendations

1. **Add `driver_id` UUID FK → staff to `bookings`.** Nullable. Only populated for `home_service` bookings.
2. **Extend progress model for driver sub-states** OR keep driver states separate:
   - Option: add `driver_progress_status` column with states: `not_started`, `picked_up_therapist`, `en_route`, `arrived`, `returning`.
   - Option: store driver states in `metadata` as a lightweight stopgap.
3. **Build driver mobile-optimized page** (`/driver/today`) showing assigned trips with:
   - Map link to customer address (already have `hs_map_url`)
   - Therapist pickup info
   - One-tap status updates
4. **Re-compute ETA** when driver marks `travel_started` using `estimateTravelTime()` from `src/lib/maps/google-maps.ts`. Store updated ETA in `metadata` and display to CSR/manager.

---

## 6. Staff / Driver Live Tracking

### Current State

**No live location infrastructure exists.**

No tables:
- `staff_locations`
- `live_locations`
- `driver_locations`

No Supabase Realtime channels configured for location streaming.

No geolocation API usage in staff/driver portals.

**Google Maps API:**
- Server-side Geocoding + Routes API ready (`src/lib/maps/google-maps.ts`).
- Browser-side Places Autocomplete ready (`src/components/public/places-autocomplete.tsx`).
- Keys properly isolated (`GOOGLE_MAPS_SERVER_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`).

### Recommendations

1. **Create `staff_location_snapshots` table:**
   ```sql
   id UUID PK
   staff_id UUID FK → staff
   booking_id UUID FK → bookings (nullable, for trip linkage)
   lat NUMERIC
   lng NUMERIC
   accuracy_meters INT
   recorded_at TIMESTAMPTZ
   source TEXT ('gps', 'manual', 'geofence')
   ```
   - **No RLS on this table** — or use very permissive INSERT for authenticated staff, SELECT for managers/owner only.
   - **Retention policy:** TTL 7 days (or move to cold storage) to prevent table bloat.

2. **Browser geolocation polling:**
   - Driver portal uses `navigator.geolocation.watchPosition()` at 30-second intervals while `travel_started` or `en_route`.
   - Posts to a server action `recordLocationSnapshotAction()`.
   - Falls back to manual "Mark Location" button if GPS denied.

3. **Manager live map:**
   - Read latest snapshot per driver from `staff_location_snapshots`.
   - Render on Google Maps using browser key (static map or JS map).
   - Show driver → destination route using Directions API.

4. **Privacy & compliance:**
   - Only record location during active trips.
   - Show staff consent notice on first driver portal login.
   - Retain snapshots only for operational duration + short audit window.

---

## 7. Customer Tracking Links

### Current State

No customer-facing tracking page or link generation exists.

Home-service customers receive no ETA or driver location after booking.

### Recommendations

1. **Create `customer_tracking_links` table:**
   ```sql
   id UUID PK
   booking_id UUID FK → bookings UNIQUE
   token TEXT UNIQUE (URL-safe random, e.g., nanoid)
   expires_at TIMESTAMPTZ
   access_count INT DEFAULT 0
   last_accessed_at TIMESTAMPTZ
   is_active BOOLEAN DEFAULT TRUE
   ```

2. **Public tracking page:**
   - Route: `/track/[token]` (outside auth, no login required).
   - Displays: booking status, driver name (optional), ETA, therapist name, service name.
   - **Does NOT display exact driver location** for privacy; shows zone or "En route — ETA 12:45 PM".

3. **Auto-generate token** when home-service booking is confirmed.
   - Send token via SMS (future) or include in confirmation email.
   - For now, display link in CSR console for copy/paste to customer.

4. **Token security:**
   - Single-booking scoped (no customer ID leakage).
   - Expires 24h after booking completion.
   - Rate-limit access by IP (middleware or edge function).

---

## 8. Internal Live Operations Map

### Current State

No internal map view exists.

### Recommendations

1. **Build `/manager/map` or `/owner/map` page:**
   - Display all active home-service bookings as pins.
   - Display driver current locations (from `staff_location_snapshots`).
   - Color-code pins by status: confirmed (gray), travel_started (blue), arrived (green), session_started (purple), completed (black).
   - Click pin → booking detail popup with customer name, address, therapist, ETA.

2. **Map component:**
   - Use `@react-google-maps/api` or vanilla Google Maps JS API with `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`.
   - Load dynamically (`next/dynamic` with `ssr: false`) to avoid server-render issues.

3. **Data refresh:**
   - Polling every 30 seconds (server action) OR Supabase Realtime on `staff_location_snapshots`.
   - For MVP, polling is simpler and avoids Realtime configuration.

---

## 9. Traffic / ETA / Conflict Warnings

### Current State

**Dispatch Conflict Detection:**
- `checkHomeServiceDispatchConflict()` in `src/lib/bookings/dispatch-conflict.ts`.
- Checks: driver capacity, overlapping bookings, far zone pairs.
- Uses `estimateTravelTime()` (Google Maps Routes API v2) when lat/lng available.
- Warnings stored in `metadata.dispatch.dispatch_warning`.
- `needs_location_review` flag for unconfirmed addresses.

**Notification Types:**
- `home_service_dispatch_conflict` ✅ exists in `NotificationType`.
- `home_service_location_review` ✅ exists.
- `resource_conflict_warning` ✅ exists.

### Gaps

1. **No live traffic ETA.** `travel_minutes_estimate` is static from booking creation time.
2. **No proactive conflict alert in UI.** Warnings are stored in metadata but not prominently shown to manager/CSR except in CRM queue panel as a small badge.
3. **No ETA update after driver starts travel.**

### Recommendations

1. **Re-compute ETA on `travel_started`** using current driver location (if available) or branch origin → destination via `estimateTravelTime()`.
2. **Surface warnings prominently:**
   - Manager control console: red/yellow banner on booking card.
   - CRM today: sort conflict bookings to top of queue.
   - Notification bell: auto-create `home_service_dispatch_conflict` notification when conflict detected.
3. **Add `eta_updated_at` and `eta_minutes` columns** to `bookings` (or store in metadata) for quick display without re-querying Maps API on every render.

---

## 10. Payroll System

### Current State

**No payroll tables exist.**

No `payroll_periods`, `payroll_items`, `commission_rules`, or `staff_performance_snapshots`.

**Revenue attribution:**
- `bookings.metadata.price_paid` used by `getMyMonthlyStats()` in staff portal.
- `amount_paid` on bookings used for cash summaries.

**Staff data:**
- `staff.tier` (`senior`, `mid`, `junior`) — label only, no pay effect.
- No hourly rate, commission %, or fixed salary stored.

### Recommendations

1. **Create `staff_pay_profiles` table:**
   ```sql
   staff_id UUID FK → staff PRIMARY KEY
   base_salary NUMERIC(10,2) -- monthly or daily
   commission_percent NUMERIC(5,2) -- e.g., 15.00 for 15%
   per_service_bonus NUMERIC(10,2)
   effective_from DATE
   effective_until DATE (nullable)
   ```

2. **Create `payroll_periods` table:**
   ```sql
   id UUID PK
   branch_id UUID FK → branches
   period_start DATE
   period_end DATE
   status TEXT CHECK ('draft', 'locked', 'paid')
   created_by UUID FK → staff
   ```

3. **Create `payroll_items` table:**
   ```sql
   id UUID PK
   payroll_period_id UUID FK
   staff_id UUID FK → staff
   base_pay NUMERIC
   commission_pay NUMERIC
   bonus_pay NUMERIC
   deductions NUMERIC
   total_pay NUMERIC
   metadata JSONB (breakdown by booking)
   ```

4. **Automated calculation:**
   - RPC or server action that aggregates completed bookings in period by staff.
   - Applies commission rules from `staff_pay_profiles`.
   - Generates `payroll_items` rows.

5. **UI:**
   - Owner/Manager "Payroll" page: list periods, lock, export CSV.
   - Staff portal: "My Earnings" tab showing estimated commission for current period.

---

## 11. Staff Performance / Leaderboard

### Current State

**Reports infrastructure:**
- Owner reports page exists (`/owner/reports`) with Revenue by Branch, Booking Trend, Staff Productivity cards.
- `src/lib/owner/reports.ts` defines `StaffProductivityData` interface: `staffId`, `name`, `tier`, `total`, `completed`, `revenue`.
- `getStaffProductivityAction()` in owner bookings actions returns this data.

**Staff Portal Stats:**
- `/staff-portal/stats` page exists (need to verify contents).
- `getMyStatsAction()` returns monthly stats from `getMyMonthlyStats()`.

### Gaps

1. **No leaderboard view.** No ranking of staff by revenue, completion rate, or customer rating.
2. **No customer ratings.** `bookings.metadata` has no rating key.
3. **No performance trends over time.** Staff productivity card shows aggregate; no month-over-month chart.

### Recommendations

1. **Add `staff_leaderboard_snapshots` table** (or generate on-the-fly from bookings):
   ```sql
   id UUID PK
   branch_id UUID
   snapshot_date DATE
   staff_id UUID
   metric TEXT CHECK ('revenue', 'completed_bookings', 'completion_rate', 'avg_rating')
   value NUMERIC
   rank INT
   ```
   - Daily snapshot job (pg_cron or edge function) populates this for fast leaderboard queries.

2. **Leaderboard UI:**
   - Manager dashboard: "This Week's Top Therapists" widget.
   - Staff portal: "My Rank" badge with peer comparison (anonymized).

3. **Customer ratings:**
   - Add `rating` (SMALLINT 1-5) and `review_text` to `bookings` or a new `booking_reviews` table.
   - Trigger notification on completion: "Please rate your session" (SMS/email future).

---

## 12. Security / RLS Audit

### Current State

**RLS Policies:**
- Defined in `20260429000005_rls_policies.sql` and subsequent patches (`20260510000002_reconciliations_rls.sql`, `20260510000004_csr_roles_rls.sql`, etc.).
- Branch-scoped for managers (`get_auth_branch_id()` = `branch_id`).
- Cross-branch for owner (`get_auth_role() = 'owner'`).
- CRM/CSR read access to customers and bookings (some write for CSR head).

**Auth Routing:**
- `src/proxy.ts` (NOT `src/middleware.ts`) handles role-based workspace routing.
- `DEV_AUTH_BYPASS=true` allows unauthenticated dashboard access in development only.

**Key Patterns:**
- Server actions use `createClient()` (RLS-enforced) for reads where possible.
- Admin client (`createAdminClient()`) used only for:
  - Notifications (`createNotification`)
  - Setup warnings
  - Any cross-branch write where RLS would block

**RLS Access Matrix (from DB_SCHEMA.md — stale but directionally correct):**

| Table | Public | Staff (own) | Manager (branch) | CRM/CSR | Owner |
|-------|--------|------------|------------------|---------|-------|
| branches | R | — | — | — | ALL |
| staff | — | R | R | — | ALL |
| bookings | — | R | ALL | R | ALL |
| customers | — | — | R/W | R/W | ALL |
| workspace_notifications | — | R (targeted) | R (targeted) | R (targeted) | ALL |

### Gaps & Risks

1. **`staff_locations` table (future) RLS.** Must be carefully scoped: staff INSERT own location, manager/owner SELECT branch staff locations. No public access.
2. **`customer_tracking_links` table (future).** Must allow anonymous SELECT by token only. No relation to auth.
3. **`booking_payment_logs` table (future).** Manager/owner read; no staff read unless auditor role.
4. **`public_site_sections` / `public_site_assets`.** Currently owner-only manage. If marketing team needs access, a `marketing` role would be needed (does not exist).
5. **CSR role escalation.** `csr_head` can cancel/reassign bookings (`canCancelBooking`, `canReassignBooking` in `src/lib/permissions.ts`). Verify this is intentional and documented.
6. **Dev bypass leakage.** `isDevAuthBypassEnabled()` checks `DEV_AUTH_BYPASS=true`. Ensure this env var is never set in production (add validation in `src/lib/dev-bypass.ts` if not present).

### Recommendations

1. **Audit all server actions** for missing branch_id filters. Priority:
   - `ownerUpdateBookingPaymentAction` — cross-branch is correct for owner.
   - `updateBookingPaymentAction` — verify branch filter is present ✅ (it is).
   - `updateBookingProgressAction` — uses RPC, which enforces staff ownership ✅.
2. **Add `anon` RLS policy** to `customer_tracking_links` when created: SELECT where token matches, no auth required.
3. **Document RLS policy for new tables** as they are created. Maintain a living RLS matrix in `docs/SECURITY.md` (create if missing).
4. **Review `src/proxy.ts`** to ensure new routes (`/driver`, `/utility`, `/track/*`) are handled correctly.

---

## 13. Tool / API Readiness

### Google Maps APIs

| API | Key | Usage | Status |
|-----|-----|-------|--------|
| Geocoding API | `GOOGLE_MAPS_SERVER_API_KEY` | `geocodeAddress()` in `src/lib/maps/google-maps.ts` | ✅ Ready |
| Routes API (v2) | `GOOGLE_MAPS_SERVER_API_KEY` | `estimateTravelTime()` in `src/lib/maps/google-maps.ts` | ✅ Ready |
| Places Autocomplete | `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | `src/components/public/places-autocomplete.tsx` | ✅ Ready |
| Maps JavaScript API | `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Needed for live ops map | ⚠️ Key exists; component not built |
| Directions API | `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Needed for route rendering on map | ⚠️ Same as above |

**Cost control:**
- Geocode once per booking, store lat/lng in metadata. ✅ Already implemented.
- `estimateTravelTime()` used only during dispatch conflict check. ✅ Already implemented.

### Supabase Features

| Feature | Status | Notes |
|---------|--------|-------|
| Auth | ✅ Ready | Email/password + OTP |
| PostgREST (DB API) | ✅ Ready | All queries use this |
| Realtime | ⚠️ Not configured | Need to enable for `bookings` and location tables |
| Storage | ✅ Ready | Available but unused for public assets |
| Edge Functions | ✅ Ready | Can use for SMS, external webhooks |
| pg_cron | ⚠️ Unknown | Check if enabled for scheduled snapshot jobs |

### Missing External Integrations

| Integration | Needed For | Status |
|-------------|-----------|--------|
| SMS Gateway (Twilio / Semaphore) | Customer confirmations, tracking links | ❌ Not integrated |
| Email (Resend / SendGrid) | Booking confirmations, receipts | ❌ Not integrated |
| Push notifications | Real-time alerts to staff mobile | ❌ Not integrated |
| Calendar sync (Google/Outlook) | Staff schedule export | ❌ Not integrated |

---

## Appendices

### A. Database Table Inventory

| Table | Created By | Purpose |
|-------|-----------|---------|
| `branches` | 001 | Spa locations |
| `staff` | 001 | Personnel + auth linkage |
| `staff_schedules` | 001 | Recurring weekly shifts |
| `schedule_overrides` | 001 | Date-specific exceptions |
| `service_categories` | 001 | Service grouping |
| `services` | 001 | Global catalog |
| `branch_services` | 001 | Branch pricing overrides |
| `customers` | 001 | CRM guests |
| `bookings` | 001 + 003 + 004 + 005 + 007 | Central booking + progress + payments + resources |
| `booking_events` | 001 | Audit log (trigger-only) |
| `blocked_times` | 001 | Intra-day staff blocks |
| `branch_resources` | 005 | Rooms, beds, equipment |
| `branch_booking_rules` | 007 | Operational hours & capacity rules |
| `daily_cash_reconciliations` | 009 | End-of-day cash counts |
| `public_site_sections` | 010 | Marketing copy CMS |
| `public_site_assets` | 010 | Marketing image CMS |
| `waitlist_requests` | 009 | Waitlist for unavailable slots |
| `workspace_notifications` | 012 | In-app notifications |
| `staff_onboarding_requests` | 011 | Staff invite pipeline |
| `staff_services` | 001 + 008 | Staff-to-service eligibility |

### B. Migration File Index

| File | Summary |
|------|---------|
| `20260429000001_core_tables.sql` | 11 core tables |
| `20260429000002_indexes.sql` | Performance indexes |
| `20260429000003_helper_functions.sql` | Auth helpers, business logic functions |
| `20260429000004_triggers.sql` | `updated_at`, booking events, customer stats |
| `20260429000005_rls_policies.sql` | Row Level Security policies |
| `20260429000006_availability_rpc.sql` | `get_available_slots`, `create_online_booking` |
| `20260429000007_seed_data.sql` | Initial branches, categories, services |
| `20260429000008_departments.sql` | Department structure (salon/org) |
| `20260429000009_staff_expansion.sql` | Expanded `system_role` and `staff_type` enums |
| `20260429000010_salon_and_org_data.sql` | Salon org seed data |
| `20260430000001_staff_org_structure.sql` | Org chart fields (`staff_type`, `is_head`) |
| `20260430000002_demo_org_workflow_seed.sql` | Demo workflow seed |
| `20260430000003_fix_available_slots_staff_id_ambiguity.sql` | Slot engine fix |
| `20260501000001_get_daily_schedule.sql` | `get_daily_schedule` RPC |
| `20260501000002_csr_roles.sql` | CSR role expansion |
| `20260501000003_home_service_tracking.sql` | Home service timestamp columns |
| `20260501000004_unified_booking_progress.sql` | Unified progress status + `update_booking_progress` RPC |
| `20260502000001_staff_avatars.sql` | Avatar URLs |
| `20260502000002_payment_fields.sql` | Flat payment columns on bookings |
| `20260505000001_branch_resources.sql` | Physical resource tracking |
| `20260505000002_update_get_daily_schedule.sql` | Schedule RPC enhancements |
| `20260507000001_branch_booking_rules.sql` | Branch operational rules |
| `20260507000002_home_service_dispatch.sql` | Dispatch conflict logic |
| `20260508000001_service_eligibility.sql` | Staff-service eligibility rules |
| `20260509000001_daily_cash_reconciliations.sql` | EOD cash reconciliation table |
| `20260509000002_customer_preferences.sql` | Customer preference fields |
| `20260509000003_waitlist_requests.sql` | Waitlist table |
| `20260510000001_public_site_content.sql` | Marketing CMS tables |
| `20260510000002_reconciliations_rls.sql` | Reconciliation RLS |
| `20260510000003_waitlist_rls.sql` | Waitlist RLS |
| `20260510000004_csr_roles_rls.sql` | CSR role RLS patches |
| `20260510000005_missing_updated_at_triggers.sql` | Missing triggers |
| `20260510000006_security_definer_cleanup.sql` | Security definer cleanup |
| `20260510000007_driver_capacity.sql` | Driver capacity in branch rules |
| `20260510000008_service_visibility.sql` | Service visibility flags |
| `20260511000001_real_cradle_service_catalog.sql` | Real service catalog |
| `20260511000002_staff_onboarding_requests.sql` | Onboarding request table |
| `20260512000001_workspace_notifications.sql` | Notifications table + types |
| `20260513000001_rbac_role_constraint_fix.sql` | RBAC constraint fixes |
| `20260513000002_real_staff_rbac_seed.sql` | Real staff RBAC seed |
| `20260514000001_staff_profile_enhancements.sql` | Profile enhancements |
| `20260515000001_staff_onboarding_schema_guard.sql` | Onboarding schema guard |

### C. File References

| Topic | Key Files |
|-------|-----------|
| Branch queries | `src/lib/queries/branches.ts` |
| Booking queries | `src/lib/queries/bookings.ts` |
| Staff queries | `src/lib/queries/staff.ts` |
| Progress state machine | `src/lib/bookings/progress.ts` |
| Dispatch conflict | `src/lib/bookings/dispatch-conflict.ts` |
| Google Maps helpers | `src/lib/maps/google-maps.ts` |
| Places Autocomplete | `src/components/public/places-autocomplete.tsx` |
| Payment UI | `src/components/features/dashboard/payment-action-menu.tsx` |
| Booking workspace | `src/components/features/bookings/bookings-workspace.tsx` |
| CRM today | `src/app/(dashboard)/crm/today/page.tsx` |
| Manager today | `src/app/(dashboard)/manager/today/page.tsx` |
| Driver panel | `src/app/(dashboard)/driver/page.tsx` |
| Staff portal actions | `src/app/(dashboard)/staff-portal/actions.ts` |
| Owner reports | `src/app/(dashboard)/owner/reports/page.tsx` |
| Permissions | `src/lib/permissions.ts` |
| Notifications | `src/lib/notifications/create.ts`, `types.ts`, `queries.ts` |
| Validation schemas | `src/lib/validations/booking.ts` |
| Public site data | `src/lib/public/public-site-data.ts` |
| Proxy / auth routing | `src/proxy.ts` |
| DB schema reference | `supabase/migrations/DB_SCHEMA.md` (stale) |

---

*End of Report.*


---

## Implementation Log

### 2026-05-13 — Phase 1: Public Branch Address Source of Truth ✅ COMPLETE

**Migration:** `20260516000001_branch_public_fields.sql` added `opening_hours`, `secondary_phone`, `sort_order` to `branches`.

**Query helper:** `getPublicBranches()` in `src/lib/queries/branches.ts` returns active branches ordered by `sort_order` then `name`.

**Refactored components:**
- `site-header.tsx` — accepts `primaryPhone` prop
- `site-footer.tsx` — accepts `branches` prop, derives hours from first branch
- `home-page-sections.tsx` — accepts `branches` prop, replaces `publicPhones`/`publicBranches` in contact section
- `public-mobile-home.tsx` — accepts `branches` prop, dynamic FAQ branch names
- `public-mobile-contact.tsx` — branch-driven primary phone and opening hours
- `public-mobile-branches.tsx` — branch-driven `opening_hours`
- `contact/page.tsx` — dynamic phones, hours, branch cards, CTAs
- `branches/page.tsx` — dynamic per-branch hours

**Deprecated:** `publicPhones` and `publicBranches` in `src/lib/public/public-site-data.ts` marked with `@deprecated`.

**Build status:** type-check ✅ | lint ✅ (0 errors) | build ✅ (77 routes)

### 2026-05-13 — Phase 2: Manual Payment Recording Capability ✅ COMPLETE

**Migration:** `20260517000001_booking_payment_logs.sql` created append-only audit table.

**Schema:** `updateBookingPaymentSchema` extended with optional `reason` field.

**Server actions:** Both `ownerUpdateBookingPaymentAction` and `updateBookingPaymentAction` now:
- Fetch current payment state before updating
- Require `reason` for significant changes (paid→unpaid, amount reduction)
- Insert an audit row into `booking_payment_logs` with old→new snapshot
- Then update the `bookings` record

**UI:** `PaymentActionMenu` now shows:
- Reason textarea in edit form (required for voids/refunds/corrections)
- `confirmUnpaid` confirmation view with optional reason input
- All action calls include `reason` in payload

**Wiring:** PaymentActionMenu is now wired into:
- Owner bookings + schedule
- Manager bookings + schedule
- CRM bookings + schedule + today queue

**Build status:** type-check ✅ | lint ✅ (0 errors, 4 pre-existing warnings) | build ✅ (77 routes)

### 2026-05-13 — Phase 3: Booking Control Console MVP ✅ COMPLETE

**Routes:** `/manager/control` and `/crm/control` created.

**Components:**
- `ControlKpiStrip` — 7 operational KPIs (Total, Active, In Progress, Completed, Unpaid, Home Service, Issues)
- `ControlBookingCard` — Enhanced card with progress mini-stepper, payment/status/type badges, home-service warning banners, inline PaymentActionMenu + BookingActionMenu
- `ControlQueue` — Tabbed queue with 6 filters: All, Active, Home, In Spa, Unpaid, Issues
- `ControlConsolePage` — Main layout with left queue + right operational summary rail

**Query enhancements:** `getTodaysSchedule` select variants now include `booking_progress_status` and timestamp fields.

**Navigation:** "Control" added to Manager, CRM, CSR Head, and CSR Staff sidebars.

**Scope limits respected:**
- No live maps, no GPS tracking, no external APIs
- No payroll, no leaderboard, no performance metrics
- No delivery_type migration yet
- No major booking workflow rewrite
- No RLS changes

**Build status:** type-check ✅ | lint ✅ (0 errors, 4 pre-existing warnings) | build ✅ (79 routes)

**Follow-up:**
- Phase 3.1: Owner cross-branch control console
- Phase 4: Booking Delivery Type Cleanup (`in_spa` as first-class type)

### 2026-05-14 — Phase 10.1: Compact Precise Home-Service Location Input ✅ COMPLETE

**Scope:** Existing public booking wizard home-service location step only.

**UI:** The customer-facing step now uses one Google Places search field, a compact selected-location confirmation card with Change, and one optional Delivery notes textarea. Separate customer-facing zone, house/unit, landmark, and driver-note fields were removed/merged.

**Data captured:** `metadata.home_service_address` now stores Google-selected `formatted_address`, `place_id`, `lat`, `lng`, optional `address_components`, optional `map_url`, `source: "google_places"`, and `delivery_notes`, while preserving legacy address/notes/zone keys.

**Build status:** type-check ✅ | lint ✅ (0 errors, 2 pre-existing warnings) | build ✅ (79 routes)

### 2026-05-14 — Booking Wizard UX Patch 10.2 ✅ COMPLETE

**Scope:** Active public booking wizard optimization only.

**Places:** `/book` continues to use `src/components/public/places-autocomplete.tsx`, which loads Google Maps JS without `libraries=places`, calls `google.maps.importLibrary("places")`, and renders `PlaceAutocompleteElement`. Source search found no active legacy Places Autocomplete usage under `src`.

**Services:** The service step is now compact and category-based: mobile category chips, desktop category rail, compact service rows, selected summary, and no all-categories-expanded catalog inside the wizard.

**Staff:** Public provider selection is filtered to active service-provider staff who are available for the selected slot and eligible for the selected service set. Drivers, utility, CSR/front-desk, admin, and manager-only staff are hidden from specific provider selection. Auto-assign remains the default.

**Build status:** type-check ✅ | lint ✅ (0 errors, 2 pre-existing warnings) | build ✅ (80 routes)
