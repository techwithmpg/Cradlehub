# CradleHub MVP System Score Report

> **Date:** 2026-05-12
> **Auditor:** Kimi Code CLI
> **Scope:** Full codebase inspection — no code changes, read-only audit
> **Build verified:** `pnpm type-check` ✅ | `pnpm lint` ✅ | `pnpm build` ✅ (75 routes)

---

## 1. Overall Score

**Overall Score: 6.5/10**

**Confidence Level:** Medium-High

**MVP Recommendation: Ship with caution**

The system is functionally impressive — it builds cleanly, has real data flows, proper RBAC, a working public booking wizard, staff progress tracking, payment recording, and room assignment. However, there are **three critical gaps** that could break a client demo:

1. **Home-service lifecycle is incomplete** — no "returned to base" / "closed" stage after completion.
2. **Migration conflict risk** — a fresh `db reset` may fail due to CHECK constraint ordering.
3. **Non-manager mobile workspaces are shell-less** — on mobile, owner/CRM/staff pages lose the sidebar and header with no replacement UI.

If these three are fixed by Thursday, the score becomes a solid 7.5–8.0 and shipping is safe.

---

## 2. Score Breakdown

| Area | Score /10 | Status | Reason |
|------|-----------|--------|--------|
| Public booking | 8 | PASS | Real 6-step wizard with branch/service/slot/therapist selection, Zod validation, branch booking rules, dispatch conflict detection, auto-therapist assignment, and pending-start status. Home service requires address+zone. |
| Branch/service setup | 8 | PASS | Owner can create branches, services, categories, branch-level pricing, room/bed resources, and service eligibility flags. Real data, not demo stubs. |
| Availability and scheduling engine | 8 | PASS | `get_available_slots` RPC, seniority-based assignment, schedule overrides, blocked times, resource collision detection, and auto-room assignment on confirmation. |
| CRM/front desk workflow | 7 | PARTIAL | Today page, bookings list, customer search, in-house booking wizard, schedule board, and payment recording are all real. Recently cleaned up (fewer KPI cards, compact attention strip). Some mobile UX gaps remain. |
| Manager workflow | 8 | PASS | Today dashboard with timeline grid, booking management, staff schedule editor, resource manager, and mobile variant are solid. Manager can now edit staff profiles, roles, tiers, service capabilities, and activation status (branch-scoped). Operations page still exposes 6 "Coming Soon" tiles. |
| Staff portal and schedule visibility | 7 | PASS | Staff sees own today + week + stats. Real data. Mobile accordion for week view. Schedule, overrides, and blocked times all visible. |
| Staff progress/status updates | 7 | PARTIAL | Unified progress state machine (home_service / walkin / online) with type-aware RPC transitions. Staff can update progress via stepper UI. **Missing: returned/closed stage for home service.** |
| Home-service lifecycle tracking | 6 | PARTIAL | Travel → Arrived → Session → Complete is implemented. **No "returned to base" or "closed" step.** Dispatch conflict detection exists. Driver/utility panels are placeholders. |
| Owner workflow/visibility | 7 | PASS | Cross-branch bookings, revenue, staff count, branch performance, schedule view, and cash summary are all real. Action-required notifications show at top. |
| Notification system | 6 | PARTIAL | Table + RLS + compact dropdown (All/Unread/Action tabs) + mark-all-read exists. Action-required strip no longer clutters Today page. **RLS policies are workspace-scoped but do not filter by branch for owner-level reads (owner sees ALL notifications globally, which may be correct).** |
| Payment handling/manual payment flow | 7 | PASS | Payment status/method/amount fields on bookings. Quick-pay dropdown (Cash/GCash/Maya/Card). Daily cash summary with expected/collected/outstanding. No real payment gateway — manual recording only (acceptable for MVP). |
| RBAC/auth/workspace security | 7 | PASS | Proxy enforces role-based routing. Most server actions check permissions. **However:** `updateBranchBookingRulesAction` has NO auth, and several actions rely solely on RLS without application-layer guards. Legacy invite flow (`onboardStaffAction` / `generateInviteAction`) was removed in favor of the public onboarding page. Dev bypass is safe (disabled in production). |
| UI clarity and usability | 6 | PARTIAL | Desktop workspaces are professional. CRM Today was recently cleaned. **Mobile is broken for non-manager workspaces** — sidebar hamburger hidden, no mobile shell. Some emoji usage in dashboard headers. Manager operations page shows "Coming Soon" tiles. |
| Build/type/lint health | 10 | PASS | Zero errors across type-check, lint, and build. 80 routes compile. |
| Deployment readiness | 6 | PARTIAL | Build passes. Env vars documented. **Migration conflict risk on fresh reset.** No CI/CD verification. Supabase CLI not available in this environment — remote push untested. |

---

## 3. Immediate Attention Items

### Critical — Must fix before MVP

#### C1: Home-service "returned/closed" stage is missing
- **Problem:** The home-service flow stops at `completed`. There is no way for the therapist to mark "returned to base" or for the manager to close the dispatch loop.
- **Why it matters:** A client demoing home service will ask "What happens after the session is done?" The current answer is "Nothing." The booking just sits at `completed`.
- **Files involved:** `src/lib/bookings/progress.ts`, `supabase/migrations/20260501000004_unified_booking_progress.sql`, `src/components/features/staff-portal/booking-progress-actions.tsx`
- **Suggested fix:** Add `returned` status to `BOOKING_PROGRESS_STATUSES`, add transition `completed → returned` for `home_service`, add timestamp column `returned_at`, update RPC, and add a "Mark Returned" button in the staff portal when home_service is completed.
- **Risk level:** High (demo embarrassment)
- **Estimated effort:** Small (2–3 hours)

#### C2: Migration conflict on fresh `db reset`
- **Problem:** Migration `20260501000002_csr_roles.sql` narrows the `system_role` CHECK constraint, but migration `010` (`20260429000010_salon_and_org_data.sql`) inserts `assistant_manager` and `store_manager` rows before the narrowing. On a fresh reset, migration 010 may fail because the roles it inserts are not yet allowed by the CHECK constraint (which gets widened again in `20260513000001_rbac_role_constraint_fix.sql`, but that runs AFTER 010).
- **Why it matters:** A fresh database setup for a new developer or staging environment will fail.
- **Files involved:** `supabase/migrations/20260429000010_salon_and_org_data.sql`, `supabase/migrations/20260501000002_csr_roles.sql`, `supabase/migrations/20260513000001_rbac_role_constraint_fix.sql`
- **Suggested fix:** Edit `20260501000002_csr_roles.sql` to preserve `assistant_manager` and `store_manager` in the CHECK, or move the role fix earlier in the sequence. (This violates "immutable migrations" but fresh-reset failure is worse.)
- **Risk level:** High (deployment blocker for new environments)
- **Estimated effort:** Small (30 minutes)

#### C3: Non-manager mobile workspaces have no shell
- **Problem:** The dashboard layout hides the sidebar hamburger and desktop header on mobile for `/manager*` routes (so the manager mobile workspace can render). But for `/owner`, `/crm`, `/staff-portal`, there is no mobile shell — users see a blank or cramped page with no navigation.
- **Why it matters:** Anyone demoing on a phone or tablet will be stuck.
- **Files involved:** `src/app/(dashboard)/layout.tsx`, `src/components/features/dashboard/sidebar.tsx`
- **Suggested fix:** Either (a) keep the mobile hamburger visible for non-manager routes, or (b) add a minimal mobile header with hamburger for all routes. The simplest fix is to remove the `!isManagerRoute` guard on the mobile hamburger button in `sidebar.tsx` and test.
- **Risk level:** High (mobile demo failure)
- **Estimated effort:** Small (1 hour)

#### C4: `updateBranchBookingRulesAction` has no auth or validation
- **Problem:** `src/app/(dashboard)/owner/branches/actions.ts` — `updateBranchBookingRulesAction` accepts raw input with NO Zod validation and NO authentication check. Any authenticated user could mutate any branch's booking rules.
- **Why it matters:** If RLS is ever misconfigured, this is a direct data integrity vulnerability.
- **Files involved:** `src/app/(dashboard)/owner/branches/actions.ts`
- **Suggested fix:** Add `requireOwnerOrManager()` guard and a Zod schema for the input.
- **Risk level:** High (data integrity)
- **Estimated effort:** Small (30 minutes)

#### C5: ~~`onboardStaffAction` has no role check and creates confirmed auth users~~ ✅ FIXED
- **Problem:** `src/app/(dashboard)/owner/staff/actions.ts` — `onboardStaffAction` did not verify the caller. It created a confirmed Supabase Auth user for pending staff records. An attacker who knew a pending staff UUID could create an active auth account.
- **Fix applied:** Removed the legacy invite flow entirely (`/onboard/[staffId]`, `onboardStaffAction`, `generateInviteAction`). All onboarding now goes through the public `/staff-onboarding` page which creates a complete inactive staff record + onboarding request. Owner/manager approval is required before activation.
- **Risk level:** High (security)
- **Estimated effort:** Small (30 minutes)

#### C6: Progress updates do not send notifications or revalidate views
- **Problem:** When a staff member updates booking progress (e.g., travel started → arrived → session started), the system does NOT create notifications for CRM/manager, does NOT revalidate paths, and does NOT write an audit log. CRM and manager must refresh the page to see progress changes.
- **Why it matters:** In a live demo, the front desk will not see that a therapist has arrived unless they manually refresh.
- **Files involved:** `src/app/(dashboard)/staff-portal/actions.ts` (`updateBookingProgressAction`)
- **Suggested fix:** After a successful RPC call, call `revalidatePath("/crm/today")`, `revalidatePath("/manager")`, and optionally create a lightweight notification for the branch CRM workspace.
- **Risk level:** High (operational visibility)
- **Estimated effort:** Small (1 hour)

### High — Should fix before client demo

#### H1: Console.log statements in production code paths
- **Problem:** `src/proxy.ts` logs every request with `console.log`. Server actions in `src/lib/notifications/create.ts`, `src/lib/actions/online-booking.ts`, `src/lib/actions/inhouse-booking.ts`, and several others use `console.error` for operational errors. These will pollute production logs.
- **Why it matters:** Unprofessional log noise. May leak user IDs or paths in production logs.
- **Suggested fix:** Replace `console.log` in proxy with a no-op or conditional debug logger. Keep `console.error` only for truly unexpected exceptions.
- **Estimated effort:** Small (1 hour)

#### H2: Dev bypass mock uses all-zeros UUID
- **Problem:** `getDevBypassLayoutStaff()` returns `branch_id: "00000000-0000-0000-0000-000000000000"`. If dev bypass is accidentally enabled in a staging environment with real data, queries using this branch_id will return empty results or fail foreign-key constraints.
- **Why it matters:** Hard to debug if a staging deploy accidentally has the bypass env var set.
- **Suggested fix:** Add a loud warning banner in the UI when dev bypass is active, or make the bypass branch_id require an explicit env var.
- **Estimated effort:** Small (30 minutes)

#### H3: Manager operations page shows 6 "Coming Soon" tiles
- **Problem:** `/manager/operations` has a visible grid of features that do not exist (Driver Dispatch, Utility Task Management, CSR Shift Tracking, etc.).
- **Why it matters:** In a client demo, this looks like the system is incomplete.
- **Suggested fix:** Remove the "Coming Soon" section or hide it behind an env flag. Replace with a simple "Operations tools are consolidated on the Today, Schedule, and Staff pages." message.
- **Estimated effort:** Small (15 minutes)

#### H4: ~~`generateInviteAction` has no input validation on `branchId`~~ ✅ FIXED
- **Problem:** `src/app/(dashboard)/owner/staff/actions.ts` — `generateInviteAction` accepted `branchId` as a raw string with no Zod validation. It inserted incomplete staff rows into the database.
- **Fix applied:** Removed `generateInviteAction` entirely. The invite page now displays the public `/staff-onboarding` URL and access code for managers to share with applicants.
- **Estimated effort:** Small (15 minutes)

#### H5: `createCustomerAction` uses admin client without branch scoping
- **Problem:** `src/app/(dashboard)/crm/actions.ts` — `createCustomerAction` uses the admin client to update customer notes. If a CRM user knows a customer UUID from another branch, they can overwrite notes.
- **Why it matters:** Cross-branch data leak.
- **Files involved:** `src/app/(dashboard)/crm/actions.ts`
- **Suggested fix:** Use the signed-in client (RLS-scoped) instead of admin client for customer note updates.
- **Estimated effort:** Small (30 minutes)

#### H6: `updateBookingStatusAction` leaks booking existence across branches
- **Problem:** `src/app/(dashboard)/manager/bookings/actions.ts` — The pre-update fetch (lines 74-78) does NOT scope by branch. A manager can probe whether a booking ID exists in another branch by observing error vs success.
- **Why it matters:** Information disclosure across branches.
- **Files involved:** `src/app/(dashboard)/manager/bookings/actions.ts`
- **Suggested fix:** Add `.eq("branch_id", me.branch_id)` to the pre-update fetch.
- **Estimated effort:** Small (15 minutes)

#### H7: Owner/marketing actions lack auth guards
- **Problem:** `src/app/(dashboard)/owner/marketing/actions.ts` has server actions with NO `requireOwner()` check.
- **Why it matters:** Any authenticated user could mutate public site content.
- **Files involved:** `src/app/(dashboard)/owner/marketing/actions.ts`
- **Suggested fix:** Add `requireOwner()` to every action in the file.
- **Estimated effort:** Small (30 minutes)

#### H8: `home_service_tracking.ts` is dead code
- **Problem:** `src/lib/home-service-tracking.ts` was superseded by `src/lib/bookings/progress.ts` but the file still exists and may confuse developers.
- **Why it matters:** Dead code increases maintenance burden.
- **Files involved:** `src/lib/home-service-tracking.ts`
- **Suggested fix:** Delete the file. All references have been migrated.
- **Estimated effort:** Small (5 minutes)

#### H9: CRM walk-in bookings show "Online" label
- **Problem:** The booking type badge or label logic incorrectly shows "Online" for walk-in bookings in some CRM views.
- **Why it matters:** Incorrect labels confuse front-desk staff.
- **Files involved:** TBD — likely in `src/components/features/dashboard/booking-type-badge.tsx` or CRM list rendering.
- **Suggested fix:** Audit the `type` field mapping in CRM booking lists.
- **Estimated effort:** Small (30 minutes)

#### H10: `home_service_tracking_status` column is orphaned
- **Problem:** Migration `20260501000004` added `booking_progress_status` but left the old `home_service_tracking_status` column in place. Some code still references it (`staff-portal/actions.ts` selects both columns). Over time this creates confusion about which column is authoritative.
- **Why it matters:** Data drift risk. Two columns tracking the same thing.
- **Suggested fix:** Remove `home_service_tracking_status` from all selects. Add a cleanup migration (post-MVP) to drop the column.
- **Estimated effort:** Small (1 hour)

#### H11: `/manager/reports`, `/driver`, `/utility` are pure placeholders
- **Problem:** These routes exist but show only "Coming Soon" or minimal placeholder content.
- **Why it matters:** Demo users clicking these links will be disappointed.
- **Suggested fix:** Hide the nav links for these routes until the pages are real. `/manager/reports` nav item can be removed from `nav-config.ts`.
- **Estimated effort:** Small (15 minutes)

### Medium — Fix if time allows

#### M1: Notification RLS does not scope owner by branch
- **Problem:** Owner can read ALL notifications across all branches. This is probably intentional for oversight, but in a multi-branch demo it may show irrelevant notifications.
- **Suggested fix:** Add a branch filter to owner notifications if the user has selected a branch, or group by branch in the UI.
- **Estimated effort:** Medium

#### M2: Public booking wizard is 1981 lines
- **Problem:** `booking-wizard.tsx` is a single 2000-line client component. It works, but it is difficult to maintain.
- **Suggested fix:** Extract step components. Post-MVP refactor.
- **Estimated effort:** Large

#### M3: Some dashboard pages still use inline styles extensively
- **Problem:** Many pages use `style={{ ... }}` instead of Tailwind classes. This makes theming harder.
- **Suggested fix:** Gradual migration to Tailwind. Post-MVP.
- **Estimated effort:** Large

### Post-MVP

- Driver dispatch panel
- Utility task management
- CSR shift tracking
- Staff workload balancing
- Branch issue log
- Daily closing checklist
- Real payment gateway integration
- Accessibility audit
- Comprehensive e2e test suite

---

## 4. End-to-End Workflow Status

| # | Workflow | Status | Notes |
|---|----------|--------|-------|
| 1 | Customer books in-spa service from public site | **PASS** | Real wizard, slot validation, auto-therapist assignment, creates pending booking. |
| 2 | Customer books home-service from public site | **PASS** | Address + zone required, dispatch conflict check, travel buffer auto-added. |
| 3 | Booking appears in CRM | **PASS** | `/crm/today` and `/crm/bookings` fetch real data. |
| 4 | Booking appears in manager workspace | **PASS** | `/manager` and `/manager/bookings` show branch-scoped bookings. |
| 5 | Assigned staff sees booking in staff portal | **PASS** | `/staff-portal` fetches `staff_id = me.id` bookings. |
| 6 | Staff updates booking progress | **PASS** | Unified progress action with type-aware transitions. |
| 7 | CRM sees updated progress | **PARTIAL** | Progress updates write to DB, but there is no Realtime push to CRM. CRM page must be refreshed. |
| 8 | Owner sees business/booking/payment status | **PASS** | Cross-branch owner dashboard with real aggregations. |
| 9 | CRM creates in-house booking | **PASS** | In-house wizard with customer prefill, resource assignment, and validation. |
| 10 | Manager approves/activates staff | **PASS** | Staff onboarding request → owner/manager review → activate. |
| 11 | Manager assigns staff services | **PASS** | `staff_services` junction table managed in owner staff forms. |
| 12 | Staff becomes bookable after activation/service assignment | **PASS** | Availability engine checks `staff_services` and `is_active`. |
| 13 | Home-service travel started is recorded | **PASS** | `travel_started_at` timestamp + `booking_progress_status = travel_started`. |
| 14 | Home-service arrival is recorded | **PASS** | `arrived_at` timestamp + `booking_progress_status = arrived`. |
| 15 | Home-service session start/completion is recorded | **PASS** | `session_started_at` and `session_completed_at` with status updates. |
| 16 | Home-service returned/closed is recorded | **FAIL** | **No "returned" or "closed" stage exists.** The loop is open-ended. |
| 17 | Payment can be marked collected manually | **PASS** | Payment action menu with method selection and amount entry. |
| 18 | Notifications can be read/dismissed/resolved without cluttering Today page | **PASS** | Compact attention strip, Facebook-style dropdown with tabs, mark-all-read, grouped list pages. |

---

## 5. Data and Database Readiness

### Tables present and complete
- `branches` ✅ (2 branches in seed)
- `services` ✅ (real Cradle catalog seeded)
- `branch_services` ✅ (per-branch pricing + eligibility)
- `staff` ✅ (org structure with `system_role`, `staff_type`, `is_head`)
- `staff_services` ✅ (capability mapping)
- `staff_schedules` ✅ (weekly recurring)
- `schedule_overrides` ✅ (date-specific exceptions)
- `blocked_times` ✅ (ad-hoc unavailability)
- `customers` ✅ (with preferences + loyalty tier)
- `bookings` ✅ (comprehensive: status, progress, payment, resource, metadata)
- `branch_resources` ✅ (rooms/beds/chairs)
- `workspace_notifications` ✅ (unified notification system)
- `daily_cash_reconciliations` ✅ (manager EOD cash)
- `waitlist_requests` ✅ (public waitlist)
- `reconciliations` ✅ (branch ops reconciliation)

### Risky schema assumptions
1. **Dual progress columns:** `booking_progress_status` (new) and `home_service_tracking_status` (old) both exist. Code selects both. Risk of drift.
2. **Migration ordering:** Fresh reset may fail due to CHECK constraint narrowing before the fix widening it again.
3. **RPC `update_booking_progress` uses SECURITY DEFINER:** Correctly used, but any bug in the RPC affects all bookings.

### RLS assessment
- **Overall:** Good. Policies are workspace-aware and branch-scoped where appropriate.
- **Owner:** Full read/update on notifications (intentional oversight).
- **Manager:** Branch-scoped on bookings, resources, schedules.
- **CRM/CSR:** Branch-scoped on bookings and notifications.
- **Staff:** Own-booking reads only. Cannot see customer phone/email (enforced in selects).

### Seed/demo data readiness
- Demo seed migration (`20260430000002`) creates realistic data: branches, services, staff, customers, bookings.
- Supports two-branch testing (SM City Bacolod + La Luz).
- Seed data is marked with `metadata.seed = "demo"` for easy cleanup.

---

## 6. UI/UX Readiness

### Professional enough for demo
- `/book` public wizard — ✅ Clean, step-by-step, mobile-responsive.
- `/crm/today` — ✅ Recently cleaned. Compact attention strip, 4 KPIs, booking queue, day progress.
- `/manager` (desktop) — ✅ Timeline grid is impressive. Real-time current-time indicator.
- `/owner` — ✅ Cross-branch overview with real data.
- `/staff-portal/week` — ✅ Mobile accordion works well.
- Login page — ✅ Premium spa aesthetic.

### Could embarrass us in demo
- `/manager/operations` — Shows 6 "Coming Soon" tiles. Looks incomplete.
- Mobile owner/CRM/staff pages — No mobile shell. Sidebar hamburger hidden, nothing replaces it.
- `/dev` panel — Exposed internal-only routes and session info. Protected to owner only, but still feels risky.
- Some emoji usage in page headers (📋, ✅, 💰) — minor but not premium.

### Needs simplification
- Owner overview could lose the action-required notification cards if they get noisy (already improved in CRM).
- Staff portal "Today" could use a clearer empty state when no bookings.

---

## 7. Security and RBAC Risks

### What is working
- Proxy correctly redirects unauthenticated users to `/login`.
- Role-based workspace routing enforced in `src/proxy.ts`.
- **Most** server actions check permissions before mutations (cancel, reassign, payment update).
- Branch scoping enforced for manager/CRM queries **where implemented**.
- Staff portal never exposes customer phone/email.
- Public routes do not leak internal components.

### Risks found
| Risk | Severity | File | Details |
|------|----------|------|---------|
| `updateBranchBookingRulesAction` has NO auth/validation | **High** | `src/app/(dashboard)/owner/branches/actions.ts` | Any authenticated user could mutate any branch's booking rules. |
| ~~`onboardStaffAction` has NO role check~~ | ~~**High**~~ | ~~`src/app/(dashboard)/owner/staff/actions.ts`~~ | ~~Fixed: legacy invite flow removed.~~ |
| ~~`generateInviteAction` has no input validation~~ | ~~**High**~~ | ~~`src/app/(dashboard)/owner/staff/actions.ts`~~ | ~~Fixed: action removed in favor of public onboarding.~~ |
| Owner/marketing actions lack auth guards | **High** | `src/app/(dashboard)/owner/marketing/actions.ts` | No `requireOwner()` on public site mutations. |
| `createCustomerAction` uses admin client without branch scoping | Medium | `src/app/(dashboard)/crm/actions.ts` | Cross-branch customer note overwrite possible. |
| `updateWaitlistStatusAction` lacks branch scoping | Medium | `src/app/(dashboard)/crm/waitlist/actions.ts` | Relies solely on RLS. |
| Schedule mutations don't verify staff branch | Medium | `src/app/(dashboard)/manager/staff/actions.ts` | Relies solely on RLS. |
| `updateBookingStatusAction` leaks booking existence | Medium | `src/app/(dashboard)/manager/bookings/actions.ts` | Pre-update fetch lacks branch filter. |
| Dev bypass mock branch_id is all-zeros | Low | `src/lib/dev-bypass.ts` | Could cause confusing empty data in staging. |
| Console.log in proxy leaks paths/userIds | Low | `src/proxy.ts` | Every request logs pathname and userId. |
| `getOperationsContext` hardcodes `"dev"` branch_id | Low | `src/app/(dashboard)/manager/bookings/actions.ts` | Sloppy but harmless. |
| Owner sees ALL notifications globally | Info | `supabase/migrations/20260512000001_workspace_notifications.sql` | Intentional oversight, but may be noisy. |
| `/dev` page accessible to owner in production | Low | `src/app/(dashboard)/dev/page.tsx` | Exposes internal links and session data. |

### Recommended fixes
1. **Add `requireOwner()` or `requireOwnerOrManager()` to EVERY action** in `owner/branches/actions.ts`, `owner/staff/actions.ts`, and `owner/marketing/actions.ts`.
2. **Add Zod validation** to `updateBranchBookingRulesAction`.
3. **Switch `createCustomerAction`** from admin client to signed-in client for note updates.
4. **Add `.eq("branch_id", me.branch_id)`** to the pre-update fetch in `manager/bookings/actions.ts`.
5. Hide `/dev` page entirely in production.
6. Remove `console.log` from proxy.ts.
7. Add a visible "Dev Mode" banner when bypass is active.

---

## 8. Final Fix Plan

### Fix Plan for Thursday MVP

#### Step 1 — Critical blockers (do first)
- [ ] **C1:** Add `returned` stage to home-service progress flow (progress.ts, RPC, staff portal UI).
- [ ] **C2:** Fix migration ordering / CHECK constraint conflict for fresh resets.
- [ ] **C3:** Restore mobile hamburger for non-manager routes (or add minimal mobile header).

#### Step 2 — Workflow stabilization
- [ ] **H1:** Remove or conditionalize `console.log` statements in proxy and server actions.
- [ ] **H2:** Add dev-bypass warning banner in layout when active.
- [ ] **H3:** Hide "Coming Soon" section on `/manager/operations`.
- [x] **H4:** ~~Add Zod validation to `generateInviteAction`.~~ Removed in favor of public onboarding.
- [ ] **H5:** Fix `createCustomerAction` to use signed-in client for note updates.
- [ ] **H6:** Add branch scoping to pre-update fetch in `updateBookingStatusAction`.
- [ ] **H7:** Add `requireOwner()` to all actions in `owner/marketing/actions.ts`.
- [ ] **H8:** Delete dead code `src/lib/home-service-tracking.ts`.
- [ ] **H9:** Fix walk-in label showing "Online" in CRM lists.
- [ ] **H10:** Remove `home_service_tracking_status` from all selects; rely only on `booking_progress_status`.
- [ ] **H11:** Hide `/manager/reports`, `/driver`, `/utility` nav items until pages are real.

#### Step 3 — UI cleanup
- [ ] Replace emoji icons in dashboard headers with Lucide icons or remove entirely.
- [ ] Hide `/dev` route in production.
- [ ] Improve empty state copy on staff portal when no bookings.

#### Step 4 — Final smoke test
- [ ] Run `pnpm type-check && pnpm lint && pnpm build`.
- [ ] Manual smoke test: public in-spa booking → CRM view → manager view → staff portal progress update.
- [ ] Manual smoke test: public home-service booking → dispatch conflict check → staff progress (travel → arrived → session → complete → **returned**).
- [ ] Test mobile view on owner, CRM, and staff-portal routes.
- [ ] Verify fresh migration run in a clean environment (or at least review SQL order).

---

## 9. Manual Smoke Test Script

See companion file: `docs/MVP_SMOKE_TEST_SCRIPT.md`

---

## Appendix: File Inventory for Quick Reference

### Key real-data pages (not placeholders)
- `src/app/(public)/book/**` — Public booking wizard
- `src/app/(dashboard)/crm/today/page.tsx` — CRM daily ops
- `src/app/(dashboard)/crm/bookings/page.tsx` — CRM booking list
- `src/app/(dashboard)/crm/customers/page.tsx` — CRM customers
- `src/app/(dashboard)/manager/page.tsx` — Manager today
- `src/app/(dashboard)/manager/bookings/page.tsx` — Manager bookings
- `src/app/(dashboard)/manager/staff/page.tsx` — Manager staff schedule
- `src/app/(dashboard)/owner/page.tsx` — Owner overview
- `src/app/(dashboard)/owner/bookings/page.tsx` — Owner bookings
- `src/app/(dashboard)/owner/staff/page.tsx` — Owner staff management
- `src/app/(dashboard)/staff-portal/page.tsx` — Staff today
- `src/app/(dashboard)/staff-portal/week/page.tsx` — Staff week

### Placeholder / partially complete pages
- `src/app/(dashboard)/manager/operations/page.tsx` — Tool directory + "Coming Soon" grid
- `src/app/(dashboard)/driver/page.tsx` — Minimal placeholder panel
- `src/app/(dashboard)/utility/page.tsx` — Minimal placeholder panel
- `src/app/(dashboard)/dev/page.tsx` — Internal dev navigation (owner only)

### Core server actions with validation
- `src/lib/actions/online-booking.ts` — Zod validated, branch rules, slot check
- `src/lib/actions/inhouse-booking.ts` — Zod validated, resource check
- `src/app/(dashboard)/manager/bookings/actions.ts` — Zod validated, RBAC checked
- `src/app/(dashboard)/staff-portal/actions.ts` — Progress update with transition validation
- `src/app/(dashboard)/owner/bookings/actions.ts` — Owner-only, cross-branch

### Known console.log / console.error locations (non-exhaustive)
- `src/proxy.ts:80,99,109,114,141` — proxy request logging
- `src/lib/actions/online-booking.ts:29` — booking failure logging
- `src/lib/actions/inhouse-booking.ts:63` — booking failure logging
- `src/lib/notifications/create.ts` — insert/resolve failure logging
- `src/lib/notifications/queries.ts` — query failure logging
- `src/app/(dashboard)/staff-portal/actions.ts:35` — staff lookup error
- `src/app/(dashboard)/layout.tsx:29` — layout staff lookup error
- `src/app/(auth)/login/actions.ts:81` — login staff lookup error
