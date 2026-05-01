# 🏆 CRADLEHUB — IN PROGRESS

## Recent Work
- ORG-001: Real spa org structure integrated (staff_type, is_head, staff_services)
- ORG-002: Demo seed data created for testing
- Sprint 9: Warm spa design system overhaul complete
- SCHED-001: Daily staff schedule grid (column-based) built
- SCHED-002: Row-based resource timeline board + CRM booking error improvements
- SCHED-003: Compact staff schedule list with detail panel for scalable team management
- UI-001: Premium service card grid with image thumbnails, active toggle, and edit flow
- UI-002: Premium new service builder with live card preview
- CSR-001: CSR Head and CSR Staff roles added with centralized RBAC and CRM operational pages
- DEV-001: Dev auth bypass fixed — centralized helper works across middleware, layout, pages, and actions
- STAFF-001: Staff portal redesigned into live Today dashboard with greeting, stats, next appointment, schedule list, and Supabase Realtime updates
- STAFF-002: Home service tracking flow added — staff can tap Start Travel → Arrived → Start Session → Complete with server-side timestamps and live elapsed timer
- STAFF-003: Home service tracking refined with explicit `home_service_tracking_status` column, CHECK constraint, typed server actions with specific error codes, state machine helpers + 18 tests, compact progress stepper UI, status-specific timer labels
- STAFF-004: Unified booking progress tracking — merged home-service-only tracking into a single model supporting home_service, walkin (in-spa), and online bookings with type-aware transitions, role-aware permissions, and adaptive UI steppers

## Design System
- `--cs-*` tokens: warm-white (#F9F6F0), sand (#A67B5B), clay (#C7A27C), sage (#8A9A8B), charcoal sidebar (#2C2A29)
- CSR Head accent: `--cs-csr-head-accent: #7A6A4A` (darker gold)
- CSR Staff accent: `--cs-csr-staff-accent: #9A8A6A` (lighter sand)
- Fonts: Playfair Display (headings/brand), DM Sans (body)
- Cards: floating shadows, no harsh borders

## Dev Auth Bypass
- **Helper:** `src/lib/dev-bypass.ts` with `isDevAuthBypassEnabled()`
- **Env vars:** `DEV_AUTH_BYPASS=true` (canonical) or `DEV_ALLOW_ALL_MODULES=true` (legacy)
- **Requirement:** `NODE_ENV !== "production"` — production is NEVER bypassed
- **Usage:** Set in `.env.local` for local development
- **Behavior:** When active, authenticated users without staff records can access all dashboard pages using mock profiles

## Navigation Structure

### CSR Staff Sidebar
- Today → `/crm/today`
- Bookings → `/crm/bookings`
- Customers → `/crm/customers`
- Schedule → `/crm/schedule`

### CSR Head Sidebar
- Same as CSR Staff + Reports Lite → `/crm/repeats`

### Staff Portal Sidebar
- Today → `/staff-portal`
- My Week → `/staff-portal/week`
- My Stats → `/staff-portal/stats`

## Staff Portal Today Dashboard
- Greeting card with name, role, tier, date, appointment count, next time, live indicator
- Stats row: Total Today, Completed, Remaining, Home Service
- Next Appointment highlight card
- Full Today's Schedule list with mobile-first card layout
- Supabase Realtime subscription on `bookings` filtered by `staff_id`
- Empty state with icon and helpful message

## Unified Booking Progress Tracking
- Single source of truth: `booking_progress_status` (CHECK constraint: not_started | checked_in | travel_started | arrived | session_started | completed | no_show)
- Timestamps: `travel_started_at`, `arrived_at`, `session_started_at`, `session_completed_at`, `checked_in_at`, `no_show_at`
- Old columns (`home_service_tracking_status`, `completed_at`) preserved but no longer written by new code
- RPC `update_booking_progress()` enforces type-aware transitions at DB level
- Server action `updateBookingProgressAction({ bookingId, nextStatus })` with role-aware permissions:
  - Therapist actions (travel/arrived/session/complete): assigned staff or manager only
  - CSR actions (check-in/no-show): CSR, manager, or assigned staff
- State machine helpers in `src/lib/bookings/progress.ts` with 28 tests
- Flows by booking type:
  - Home service: not_started → travel_started → arrived → session_started → completed
  - Walk-in / in-spa: not_started → checked_in → session_started → completed (or no_show)
  - Online: not_started → session_started → completed
- Live elapsed timer from server timestamp; status-specific labels
- Adaptive stepper UI: 4 stages for home service, 3 for walk-in, 2 for online
- Session start updates booking `status` to `in_progress`; completion updates to `completed`; no_show updates to `no_show`

## Next Steps
1. Apply pending Supabase migrations in production (`20260501000002_csr_roles.sql`, `20260501000003_home_service_tracking.sql`, `20260501000004_unified_booking_progress.sql`)
2. Test CSR pages visually at `/crm/today`, `/crm/bookings`, `/crm/customers`, `/crm/schedule`
3. Test staff portal with dev bypass: set `DEV_AUTH_BYPASS=true` in `.env.local`
4. Test all role workspaces in dev mode without staff records
5. Test unified progress flows: home service (travel→arrived→session→complete), walk-in (check-in→session→complete), online (session→complete)
6. Continue with feature sprints as needed

## Go-Live Checklist
- Owner account setup
- Branch/service configuration
- Staff invites with new job functions (CSR Head, CSR Staff)
- Online booking flow test
- CSR front-desk workflow test
- Apply DB migration for expanded system_role CHECK constraint
- Apply DB migration for home service tracking timestamps (`20260501000003_home_service_tracking.sql`)
- Apply DB migration for unified booking progress (`20260501000004_unified_booking_progress.sql`)
- Test staff portal on mobile device
- Test home service tracking flow end-to-end
- Test walk-in check-in → session → complete flow
- Test online session → complete flow
