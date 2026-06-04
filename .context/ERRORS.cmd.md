## 2026-05-28 - CRM-MODAL-002 scroll bug diagnosis

- **Symptom:** Edit Service Capabilities modal footer visible, but services continued below viewport with no usable scroll. Expanded category content was cut off behind footer.
- **Root causes identified:**
  1. `AdminDialog` used `top-1/2 left-1/2 translate-x/y-1/2` centering. For tall content, the centered fixed element could push against viewport edges, making the inner scrollbar clipped or unreachable.
  2. Stacked accordion layout rendered all categories into one scroll column. When a category with 50+ services expanded, the single `overflow-y-auto` body had to contain all of it. The flex parent (`DialogPrimitive.Popup`) had `max-h` but the flex algorithm didn't reliably establish a definite height for the `flex-1` body in all browsers.
  3. `pb-24` padding-bottom hack on the body was an attempt to clear the footer, but padding-bottom in `overflow-y-auto` containers is inconsistently respected by browsers during overflow.
  4. Inline styles throughout the component made layout debugging fragile.
- **Resolution:**
  - Changed `AdminDialog` to `top-6` top-anchored positioning with explicit `h-auto max-h-[calc(100dvh-3rem)]`.
  - Rewrote `staff-service-editor-sheet.tsx` with split-pane layout: category rail + independently scrollable service list panel.
  - `AdminOverlayBody` uses `overflow-hidden p-0 flex flex-col`; inner wrapper is `flex flex-1 min-h-0 flex-col sm:grid sm:grid-cols-[220px_1fr]`.
  - Only active category services render in the right panel.
  - Removed all inline styles; everything uses Tailwind utilities.
  - Replaced `baselineRef` (read in `useMemo`) with `baselineIds` state to avoid React ref-in-render errors.

---

## 2026-05-29 - CRM-SCHEDULE-AVAILABILITY-001 verification notes

- **Lint issue found and fixed:** Initial `pnpm lint` failed on `react-hooks/set-state-in-effect` in the new modal tabs and modal shell. Refactored prop-derived state into mount-time state with keyed modal content, removing synchronous state resets from effects.
- **Browser verification blocked:** `/crm/schedule` and `/crm/schedule?tab=staff` both redirected to `/login` on the currently running local dev server. Authenticated modal click-through still needs a valid local CRM session.
- **Pre-flight file note:** Root `ROADMAP.md`, `PROJECT_CONTEXT.md`, and `AGENT_RULES.md` were not present at the repository root. Read available equivalents in `docs/` / `.claude/worktrees/.../docs/` plus `CLAUDE.md` and `AGENTS.md`.

---

## 2026-05-29 - CRM-SCHEDULE-AVAILABILITY-002 RLS and permission diagnosis

- **Symptom:** CRM Edit Availability modal appeared to work visually but saving schedule edits was blocked for CRM/CSR users.
- **Root causes identified:**
  1. `staff` table RLS had no branch-read policy for CRM/CSR roles. `getStaffWithAvailability` (regular Supabase client) returned only the logged-in CRM user's own record, so the Staff Schedule tab showed only 1 staff member.
  2. `staff_schedules`, `schedule_overrides`, and `blocked_times` RLS policies were manager/owner-only. CRM/CSR could not write schedule data through the regular client.
  3. The Day Overrides and Block Time tabs call `manager/staff/actions.ts`, which uses the regular client. These tabs failed silently for CRM because RLS blocked the writes.
  4. The Weekly Hours tab used `createAdminClient()` (service role) in its server action, which bypassed RLS. This masked the real problem and created inconsistency.
  5. `SCHEDULE_EDIT_ROLES` in both action files excluded `csr_staff` and `csr`.
  6. `canAdjustStaffSchedule()` in `permissions.ts` excluded `csr_staff` and `csr`.
- **Resolution:**
  - Created migration `20260529000002_crm_csr_schedule_rls.sql` adding branch-scoped RLS policies for all operational roles on `staff`, `staff_schedules`, `schedule_overrides`, and `blocked_times`.
  - Replaced manager-only schedule policies with operational-role policies covering `manager`, `assistant_manager`, `store_manager`, `crm`, `csr_head`, `csr_staff`, `csr`.
  - Expanded `SCHEDULE_EDIT_ROLES` in `crm-schedule-availability.ts` and `manager/staff/actions.ts`.
  - Switched CRM weekly action from `createAdminClient()` to `createClient()` for defense-in-depth.
  - Updated `canAdjustStaffSchedule()` to include CSR staff.
- **Verification:** `pnpm type-check` ✅, `pnpm lint` ✅, `pnpm build` ✅ (89 routes).

---

## 2026-05-29 - CRM-STAFF-PROFILE-SAVE-001 RLS and permission diagnosis

- **Symptom:** CRM/CSR user `86ce597a-2e35-4741-8394-fa84fc21c00e` could not save staff profile edits from the CRM Edit Staff Profile drawer. Owner/dev accounts could save successfully.
- **Root causes identified:**
  1. `staff` table had no UPDATE RLS policy for operational roles. The only UPDATE policy was `staff_owner_all` (owner only). CRM/CSR users could SELECT via `staff_operational_read_branch` but could not UPDATE.
  2. `staff_services` table had no WRITE policy for operational roles. Only `staff_services_manager_all` (manager only) and `staff_services_owner_all` allowed writes.
  3. `MANAGER_SAFE_ROLES` in `updateStaffAction` was missing `driver` and `utility`, blocking role assignment to those valid staff types.
  4. `updateStaffAction` had no defensive check for 0 rows affected. If RLS silently blocked the UPDATE, `updateResult.error` would be null and the action would return `{ success: true }`, masking the failure.
- **Resolution:**
  - Extended migration `20260529000002_crm_csr_schedule_rls.sql` with:
    - `staff_operational_update_branch` policy (UPDATE) for operational roles on staff in their branch.
    - `staff_services_operational_all` policy (ALL) for operational roles on `staff_services` in their branch, replacing `staff_services_manager_all`.
  - Added `driver` and `utility` to `MANAGER_SAFE_ROLES` in `src/app/(dashboard)/owner/staff/actions.ts`.
  - Added defensive 0-row check after `staff` UPDATE in `updateStaffAction`.

---

## 2026-05-29 - CRM-STAFF-PROFILE-SAVE-002 Final fix and silent failure elimination

- **Symptom:** CRM/CSR user `86ce597a-2e35-4741-8394-fa84fc21c00e` still could not save staff profile edits after the 001 fix.
- **Root causes identified:**
  1. **Migration never applied:** `supabase db push` could not connect (timeout at "Initialising login role..."), so the `staff_operational_update_branch` policy never reached production. The SQL execution attempt failed with `42501: must be owner of table staff` because it was run through a non-owner connection.
  2. **Silent failure pattern in Supabase client:** `.update().eq("id", ...)` without `.select()` returns `error: null, status: 204` even when RLS blocks the update. The server action returned `{ success: true }` because both `error` and `count` were null.
  3. **Missing `nickname` field:** `updatePayload` in `updateStaffAction` did not include `nickname`, so nickname edits were silently dropped even when the update succeeded.
  4. **Same pattern in `toggleStaffActiveAction`:** Also vulnerable to silent RLS failures.
- **Resolution:**
  - Created new idempotent migration `20260529000003_crm_csr_staff_update_rls.sql` to reliably add the policies.
  - Fixed `updateStaffAction` to chain `.select("id")` after `.update()` and verify `data.length > 0`. RLS blocks now surface as `"No rows were updated..."`.
  - Fixed `toggleStaffActiveAction` with the same `.select("id")` + 0-row detection.
  - Added `nickname` to `updatePayload`.
  - Added `driver` and `utility` to `MANAGER_SAFE_ROLES`.
- **Verification:** `pnpm type-check` ✅, `pnpm lint` ✅, `pnpm build` ✅.

---

## 2026-05-30 - CRM-BACKEND-STABILIZATION-001 root causes and resolutions

### Silent failure pattern (Supabase .update() without .select())
- **Symptom:** Server actions returned `{success:true}` or `{ok:true}` even when RLS blocked the DB write.
- **Root cause:** Supabase client `.update().eq(...)` without `.select()` returns `error:null, status:204` on RLS block — indistinguishable from a successful 0-row update.
- **Resolution:** All CRM mutation actions now chain `.select("id")` and check `data.length === 0`.
- **Files fixed:** `crm/actions.ts`, `crm/bookings/actions.ts`, `crm/waitlist/actions.ts`, `crm/reconciliation/actions.ts`, `owner/staff/actions.ts`

### "Unauthorized" from schedule weekly save — case-insensitive UUID mismatch
- **Symptom:** `updateCrmStaffWeeklyAvailabilityAction` returned `{ok:false,error:"Unauthorized"}` for csr_staff even though the role was in `SCHEDULE_EDIT_ROLES`.
- **Root cause:** `getScheduleEditContext` compared `me.branch_id !== branchId` using JavaScript `!==` which is case-sensitive. Zod v4's `z.guid()` preserves input case without normalising to lowercase, while PostgreSQL UUIDs from the DB are lowercase. Any case difference in the branch ID string caused the branch-scope check to fail.
- **Resolution:** Changed comparison to `.toLowerCase()` on both sides. Also changed generic null → "Unauthorized" return to specific typed error messages per failure path.
- **File:** `src/lib/actions/crm-schedule-availability.ts`

### Zod v4 z.string().uuid("msg") compatibility
- **Symptom:** `updateStaffServicesFromCrmAction` returned `{ok:false,message:"Invalid service ID"}` for all inputs including valid UUIDs.
- **Root cause:** Zod v4 changed how `z.string().uuid("rawString")` interprets the raw string argument vs `z.guid("msg")` which is Zod v4 native.
- **Resolution:** Changed `z.array(z.string().uuid("Invalid service ID"))` to `z.array(z.guid("Invalid service ID"))`.
- **File:** `src/lib/actions/crm-staff-services.ts`

---

## 2026-05-30 - CRM-EDIT-STAFF-PROFILE-TABBED browser verification limitation

- **Symptom:** Browser verification for `/crm/staff?tab=management` could not complete in the in-app browser.
- **Observed behavior:** PowerShell `Invoke-WebRequest` returned HTTP 200 for the route, but the in-app browser reported `ERR_CONNECTION_REFUSED` after the route redirected toward `/login`.
- **Impact:** Type-check, lint, and production build passed, but authenticated visual click-through of the modal still needs a reachable local browser session and valid CRM/CSR login.
- **Resolution:** No code change required for this limitation. Re-run browser verification once the local browser can reach `localhost:3000` and a CRM/CSR session is available.

---

## 2026-05-31 - CRM route-tab audit fragile dependencies

- **Bookings deep-link mismatch:** Multiple CRM components link to `/crm/bookings?highlight=<bookingId>`, but the Bookings workspace currently selects/open rows from `bookingId`, not `highlight`. Impact: deep links from Today/action queues may land on Bookings without selecting the intended booking. Mitigation: normalize links to `bookingId` or teach Bookings to consume `highlight` before converting booking filters.
- **Staff availability tab param ignored:** Links to `/crm/staff-availability?tab=coverage|individual|overrides` exist, but `/crm/staff-availability` does not read `tab`. Impact: deep links from Schedule right rails can land on the wrong default panel. Mitigation: preserve and implement initial tab support or redirect those links to the future canonical Schedule tab.
- **Waitlist stale followup risk:** Waitlist followup is reached through `/crm/customers?tab=followup`, while waitlist status updates revalidate `/crm/waitlist`. Impact: after status changes, the Customers followup tab can show stale rows. Mitigation: revalidate `/crm/customers` and/or apply local optimistic removal when this tab is converted.

---

## 2026-05-31 - CRM-STAFF-TABS-001 browser verification limitation

- **Symptom:** Browser route checks for `/crm/staff` and each Staff `?tab=` deep link redirected to `/login` in the in-app browser.
- **Impact:** Authenticated click-through could not verify Staff Management rendering, Service Assignments rendering, Status rendering, Applications review behavior, edit profile save, service capabilities save, activate/deactivate, or green success toasts.
- **Resolution:** Code-level verification, type-check, lint, and production build passed. Re-run browser verification with a valid local CRM/CSR session.

---

## 2026-06-03 - CRM-BOOKINGS-WORKFLOW-001 browser/auth verification limitation

- **Symptom:** Shell route checks for `/crm/bookings?tab=needs-confirmation`, `/crm/bookings?tab=confirmed`, and `/crm/bookings?tab=callback-followup` returned HTTP 200, but full visual click-through could not be completed because a valid local CRM/CSR browser session was not available. Tool discovery also did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** Code-level checks, production build, and unauthenticated route/API smoke checks passed, but manual modal flows still need authenticated verification: Booking Follow-up, Customer Arrived, Assign Room / Change Room, and Callback Follow-up actions.
- **Resolution:** No code change required for this limitation. Re-run authenticated browser verification on `http://localhost:3000/crm/bookings?tab=needs-confirmation` after logging in as a CRM/CSR user.

---

## 2026-06-03 - CRM-BOOKINGS-COMMAND-CENTER-001 browser/auth verification limitation

- **Symptom:** The in-app browser reached the existing local dev server at `http://localhost:3000`, but `/crm/bookings` redirected to `/login`.
- **Impact:** The command-center redesign passed type-check, lint, and build, but the authenticated visual check of the Bookings Command Center, selected-booking panel, and modals still needs a valid local CRM/CSR browser session.
- **Resolution:** No code change required for this limitation. Re-run browser verification after logging in locally as a CRM/CSR user.

---

## 2026-06-03 - CRM-SCHEDULE-FULL-CALENDAR-001 browser/auth verification limitation

- **Symptom:** The in-app browser reached `http://localhost:3000/crm/schedule`, but the route redirected to `http://localhost:3000/login`.
- **Impact:** Type-check, lint, production build, and route reachability passed, but the authenticated visual check for selecting a staff member and opening the `View Full Schedule` modal still needs a valid local CRM/CSR session.
- **Resolution:** No code change required for this limitation. Re-run browser verification after logging in locally as a CRM/CSR user, then open `/crm/schedule`, select a staff member, and click `View Full Schedule`.

---

## 2026-06-03 - AUTH-WORKSPACE-SWITCHING-001 browser/auth verification limitation

- **Symptom:** The in-app browser reached `http://localhost:3000/select-workspace`, but unauthenticated traffic redirected to `http://localhost:3000/login`.
- **Impact:** Type-check, lint, production build, and unauthenticated proxy behavior passed, but full workspace-switch click-through still needs local authenticated users for CRM-only, Staff-only, CRM+Staff, Driver, Owner/Admin, and no-workspace cases.
- **Resolution:** No code change required for this limitation. Re-run authenticated browser verification with seeded users for each access combination.

---

## 2026-06-03 - STAFF-PORTAL-SHELL-NAV-001 browser/auth verification limitation

- **Symptom:** The in-app browser reached `http://localhost:3000/staff-portal/profile`, but unauthenticated traffic redirected to `http://localhost:3000/login`.
- **Impact:** Type-check, lint, production build, and route reachability passed, but visual confirmation of the authenticated Staff Portal sidebar still needs a valid local staff/CSR+staff session.
- **Resolution:** No code change required for this limitation. Re-run browser verification after logging in locally as a multi-access CSR/staff user and opening `/staff-portal/profile`.

---

## 2026-06-03 - STAFF-PORTAL-PROFILE-EDIT-001 browser/auth verification limitation

- **Symptom:** The in-app browser reached `http://localhost:3000/staff-portal/profile`, but unauthenticated traffic redirected to `http://localhost:3000/login`.
- **Impact:** Type-check, lint, production build, and protected-route reachability passed, but the authenticated Staff Portal profile edit/save flow still needs a valid local staff session.
- **Resolution:** No code change required for this limitation. Re-run browser verification after logging in locally as a staff or CSR+staff user, edit Full Name/Nickname, save, and confirm role/tier fields remain locked.

---

## 2026-06-03 - DRIVER-STAFF-PORTAL-MOBILE-001 browser/auth verification limitation

- **Symptom:** The existing local dev server at `http://localhost:3000` responded, but unauthenticated staff portal routes redirected to `/login`. Tool discovery did not expose an in-app browser navigation/screenshot tool in this thread.
- **Impact:** Code-level checks, production build, and protected-route smoke checks passed, but the authenticated mobile visual flow still needs a valid driver staff session to confirm the persistent bottom nav, Profile sheet save/photo controls, schedule cards, and driver job actions in-browser.
- **Resolution:** No code change required for this limitation. Re-run authenticated browser verification after logging in locally as a driver staff user, then check `/staff-portal`, `/staff-portal/dispatch`, `/staff-portal/map`, `/staff-portal/jobs`, `/staff-portal/schedule`, `/staff-portal/stats`, and the Profile bottom sheet.

---

## 2026-06-04 - MOBILE-NAV-001 browser/auth verification limitation

- **Symptom:** The local dev server at `http://localhost:3000` responded, but protected staff and driver mobile routes redirected unauthenticated traffic to `/login`. Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** `pnpm type-check`, `pnpm lint`, `pnpm build`, and unauthenticated route reachability passed, but visual mobile confirmation of the floating glass nav still needs valid local Basic Staff, Therapist, Driver Staff Portal, and standalone Driver sessions.
- **Resolution:** No code change required for this limitation. Re-run authenticated mobile browser verification at 390px width after logging in, checking `/staff-portal`, `/staff-portal/schedule`, `/staff-portal/service-progress`, `/staff-portal/dispatch`, `/driver`, and `/driver/dispatch`.

## 2026-06-04 - MOBILE-NAV-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, and local Next.js docs in `node_modules/next/dist/docs/`.
- **Resolution:** No code change required.

---

## 2026-06-04 - DRIVER-TRIPS-MOBILE-001 browser/auth verification limitation

- **Symptom:** The local dev server at `http://localhost:3000` responded, but protected `/driver/dispatch` and `/staff-portal/dispatch` routes redirected unauthenticated traffic to `/login`.
- **Impact:** Type-check, lint, production build, diff check, and route reachability passed, but the authenticated mobile visual check of the new Trips tabs/cards still needs a valid local driver staff session.
- **Resolution:** No code change required. Re-run authenticated mobile browser verification at 390px width after logging in as a driver staff user, checking Today, Upcoming, History, active trip, empty states, and bottom nav persistence.

---

## 2026-06-04 - DRIVER-MAP-001 browser/auth verification limitation

- **Symptom:** The local dev server at `http://localhost:3000` responded, but protected `/staff-portal/map`, `/driver/map`, and `/driver/dispatch` routes redirected unauthenticated traffic to `/login`. Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** Type-check, lint, production build, diff check, and protected-route reachability passed, but the authenticated mobile visual check of the new Route Map header, summary chips, map panel, bottom sheet, actions, stops strip, and persistent bottom nav still needs a valid local driver staff session.
- **Resolution:** No code change required. Re-run authenticated mobile browser verification at 390px width after logging in as a driver staff user, then check `/staff-portal/map` and `/driver/map`.

## 2026-06-04 - DRIVER-MAP-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, and local Next.js docs in `node_modules/next/dist/docs/`.
- **Resolution:** No code change required.

---

## 2026-06-04 - DRIVER-JOBS-001 browser/auth verification limitation

- **Symptom:** The local dev server at `http://localhost:3000` responded, but protected `/driver/jobs`, `/staff-portal/jobs`, and `/driver/dispatch` routes redirected unauthenticated traffic to `/login`.
- **Impact:** Type-check, lint, production build, diff check, and protected-route reachability passed, but the authenticated mobile visual check of the Jobs header, tabs, summary row, active job timer, cards, detail links, center nav button, and persistent bottom nav still needs a valid local driver staff session.
- **Resolution:** No code change required. Re-run authenticated mobile browser verification at 390px width after logging in as a driver staff user, then check `/driver/jobs` and `/staff-portal/jobs`.

## 2026-06-04 - DRIVER-JOBS-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, and local Next.js docs in `node_modules/next/dist/docs/`.
- **Resolution:** No code change required.

---

## 2026-06-04 - DRIVER-PROFILE-EDIT-001 browser/auth verification limitation

- **Symptom:** Shell route checks reached the existing local dev server at `http://localhost:3000` and returned the expected 307 redirects to `/login`, but the in-app browser stayed on a Chrome connection-refused interstitial for `localhost:3000/login`.
- **Impact:** Type-check, lint, production build, diff check, and protected-route reachability passed, but authenticated visual verification of the Profile bottom sheet still needs a valid local driver staff session and reachable in-app browser.
- **Resolution:** No code change required. Re-run authenticated mobile browser verification at 390px width after logging in as a driver staff user, then open Profile from Home, Trips, Map, and Jobs, test Edit Profile, Cancel, Save Changes, photo upload, and Logout.

## 2026-06-04 - DRIVER-PROFILE-EDIT-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, local Next.js docs in `node_modules/next/dist/docs/`, and the Supabase skill guidance.
- **Resolution:** No code change required.

---

## 2026-06-04 - MOBILE-LOADING-001 browser/auth verification limitation

- **Symptom:** The local dev server at `http://localhost:3000` responded, but protected driver and staff mobile routes redirected unauthenticated traffic to `/login`. Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** Type-check, lint, production build, diff check, and protected-route reachability passed, but authenticated mobile visual confirmation of the top route-progress line, no-progress Profile modal behavior, and skeleton pairing still needs valid local staff/driver sessions.
- **Resolution:** No code change required. Re-run authenticated mobile browser verification at 390px width after logging in as Basic Staff, Therapist, and Driver users.

## 2026-06-04 - MOBILE-LOADING-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, local Next.js docs in `node_modules/next/dist/docs/`, and the Next.js App Router skill guidance.
- **Resolution:** No code change required.

---

## 2026-06-04 - SCHEDULE-RULE-BUILDER-UI-001 browser/auth verification limitation

- **Symptom:** The local app routes for `/crm/staff-availability`, `/crm/staff-availability?tab=individual`, `/crm/staff-availability?tab=coverage`, and `/manager/staff-availability` redirected unauthenticated traffic to `/login`. Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** Type-check, lint, production build, diff check, targeted code scan, and protected-route reachability passed, but authenticated visual confirmation of the redesigned General Rules and Individual Adjustments screens still needs a valid CRM/manager session.
- **Resolution:** No code change required. Re-run authenticated browser verification after logging in locally as CRM/manager, checking group switching, individual staff switching, save/reset states, overnight badges, role-specific shift columns, and responsive spacing.
