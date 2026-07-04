## 2026-07-02 - ATTENDANCE-REFIT-005 NEXT_REDIRECT and browser QA notes

- **Symptom:** Routine Attendance mutations such as QR generation could expose `NEXT_REDIRECT`-style behavior in the UI and made tab/action flows feel like route work instead of local workspace updates.
- **Root cause:** Attendance server actions used redirect/status-query patterns for normal success/error feedback. Under Server Actions, redirects are control-flow exceptions; surfacing them from routine mutations created confusing UX and could show framework internals.
- **Resolution:** `src/app/(dashboard)/crm/attendance/actions.ts` now returns typed `AttendanceActionResult` payloads. The client workspace handles toasts, inline notices, and local state updates without `redirect()`, `router.refresh()`, or status query params for routine actions.
- **Related performance root cause:** Tab switches were URL/route driven. The refit keeps one mounted client workspace and mirrors tab state with `window.history.replaceState()`, so switching Overview/Records/Sessions/QR Codes/Devices/Exceptions/Reports does not tear down local state.
- **Browser verification limitation:** Existing local dev server reached `http://localhost:3000/crm/attendance`, but unauthenticated browser traffic redirected to `/login`. `agent-browser` verified the login page has content and no Next/Vite overlay. Authenticated Attendance browser QA still needs a valid CRM/front-desk session.

---

## 2026-06-17 - AUTH-RESET-SUPABASE-CONNECTION-001 verification/config note

- Password-reset implementation validation passed: `pnpm type-check`, `pnpm lint` (0 errors, 4 existing warnings), `pnpm test` (49 files / 513 tests), `pnpm build` (100 routes), and requested unsafe scans.
- Production configuration still matters outside the repo: set Vercel/host `NEXT_PUBLIC_APP_URL` to the deployed CradleHub origin and configure Supabase Auth Site URL/Redirect URLs for `https://cradlewellnessliving.com` and `/reset-password`.
- The service-role scan still finds `src/lib/supabase/admin.ts`, which is expected and server-only; no client service-role exposure was introduced.
- Authenticated manual QA should still click a real Supabase recovery email in local/prod to confirm the provider email template uses the configured `/reset-password` redirect.

---

## 2026-06-17 - AUTH-STAFF-RECOVERY-001 verification note

- `pnpm test` still reports the known unrelated booking progress failures in `tests/lib/bookings/progress.test.ts`:
  1. `blocks not_started -> session_started (must check in first)`
  2. `returns correct actions for walkin not_started`
- Auth recovery focused tests, type-check, lint, build, credential/token scan, and client service-role scan passed.
- No new auth-specific blocker was found.

---

## 2026-06-17 - CRM-INDIVIDUAL-SCHEDULE-LIVE-SYNC-001 findings and QA note

- **Silent schedule save risk found and fixed:** Both CRM individual schedule save paths could report success without selecting saved `staff_schedules` rows back. The fixed actions now use the verified `staff_id,day_of_week,shift_type` conflict target, chain `.select(...)`, verify returned row count, and return safe CRM-facing errors.
- **Live Staff source mismatch found and fixed:** Live Staff combined `get_daily_schedule` work spans with a separate raw active `staff_schedules` query for shift labels. It now uses resolved `schedule_windows` from the shared resolver.
- **Group fallback mismatch found and fixed in app resolver:** Inactive individual rows now mean individual day off and do not fall through to group fallback in Live Staff or booking availability post-filter.
- **RLS finding:** Existing migrations cover authenticated table grants plus branch-scoped SELECT/INSERT/UPDATE for operational CRM/CSR roles on `staff_schedules`; no new RLS migration was needed for the upsert flow. Operational DELETE remains not broadened.
- **Authenticated visual QA limitation:** Code-level validation passed, but a real CRM-authorized browser session is still needed for manual modal/table confirmation.

---

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

---

## 2026-06-05 - BOOKING-THERAPIST-DROPDOWN-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, local Next.js docs in `node_modules/next/dist/docs/`, and the Next.js App Router skill guidance.
- **Resolution:** No code change required.

## 2026-06-05 - BOOKING-THERAPIST-DROPDOWN-001 lint fix

- **Symptom:** Initial `pnpm lint` found two `react/no-unescaped-entities` errors in newly added therapist picker copy.
- **Impact:** Lint failed until the apostrophes were escaped.
- **Resolution:** Replaced the offending apostrophes with `&apos;`, then re-ran `pnpm type-check`, `pnpm lint`, and `pnpm build` successfully.

## 2026-06-05 - BOOKING-THERAPIST-DROPDOWN-001 browser verification limitation

- **Symptom:** Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** `/book` returned HTTP 200 from the local dev server, but visual browser QA of the public booking therapist dropdown was limited to code review and route smoke testing.
- **Resolution:** No code change required. Run manual browser QA through the public booking flow to confirm final spacing with real service, location, slot, and provider data.

## 2026-06-05 - BOOKING-THERAPIST-DROPDOWN-001 availability API network timeout

- **Symptom:** During local dev-server smoke testing, `/book` loaded with HTTP 200, but one `/api/booking/available-slots` request returned 500 because the underlying availability RPC fetch timed out while connecting to the remote service.
- **Impact:** The page route and production build passed, but full slot-loading verification was limited by the remote fetch timeout in the local environment.
- **Resolution:** No code change made because the therapist picker did not change slot-fetching logic. Re-test the full booking flow when the remote backend is reachable.

---

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, local Next.js docs in `node_modules/next/dist/docs/`, and the Next.js App Router skill guidance.
- **Resolution:** No code change required.

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-001 lint fix

- **Symptom:** Initial `pnpm lint` found one `react-hooks/set-state-in-effect` error in `CradleBreathReveal`.
- **Impact:** Lint failed until immediate dismiss state updates were moved into browser callbacks.
- **Resolution:** Changed synchronous effect dismissals to zero-delay timeout callbacks, then re-ran `pnpm type-check`, `pnpm lint`, and `pnpm build` successfully.

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-001 headless browser sandbox limitation

- **Symptom:** Initial non-escalated Chrome/Edge headless screenshot attempts failed with Windows crashpad/mojo access errors.
- **Impact:** Visual mobile verification needed an escalated one-time headless Chrome run and a temporary dev server on port 3001.
- **Resolution:** Captured mobile screenshots successfully after starting the temporary dev server in the same elevated context, then stopped the server.

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-001 existing image sizes warnings

- **Symptom:** During screenshot verification, the dev server emitted existing Next/Image warnings for older `/images/spa/hero.jpg` and `/images/spa/cta-banner.jpg` usage.
- **Impact:** No blocker for this scoped mobile hero change; the warnings come from unchanged desktop/lower-section public image surfaces.
- **Resolution:** No code change made because the task explicitly did not redesign desktop or sections below the mobile hero.

---

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-FIX-001 root loading shell mismatch

- **Symptom:** Public mobile homepage could show the old generic gray skeleton before the Cradle Breath Reveal.
- **Impact:** The first-load experience felt disconnected from the new branded reveal/hero.
- **Root cause:** Root `src/app/loading.tsx` still rendered generic `Skeleton` blocks. Because root `loading.tsx` is the streamed Suspense fallback for the root segment, it can appear before public route content is ready.
- **Resolution:** Replaced the root fallback with a Cradle-branded deep-green loading bridge. Existing dashboard/staff/driver/CRM route-specific loading files remain in place.

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-FIX-001 browser tool fallback

- **Symptom:** Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** Visual QA could not use the Browser plugin directly.
- **Resolution:** Captured mobile screenshots successfully with local headless Chrome against the already running `http://localhost:3000` dev server.

---

## 2026-06-05 - PUBLIC-MOBILE-HOME-DARK-SECTIONS-001 headless browser verification blocked

- **Symptom:** Non-escalated headless Chrome failed with Windows crashpad/mojo access denied errors while attempting mobile homepage screenshot capture.
- **Impact:** Automated screenshot verification of the dark mobile homepage sections could not be completed in this turn.
- **Resolution:** Requested escalation for the headless Chrome verification run, but the request was declined. Completed non-browser verification instead: `GET /` HTTP 200, rendered heading checks, targeted source scan for light card classes, `pnpm type-check`, `pnpm lint`, `pnpm build`, and `git diff --check`.

---

## 2026-06-06 - PUBLIC-MOBILE-LOADING-TRANSITIONS-001 browser verification limitation

- **Symptom:** Tool discovery did not expose the in-app Browser/agent-browser navigation or screenshot controller during this turn.
- **Impact:** Visual confirmation of the intro animation, route-line timing, and back-navigation behavior was limited to code review, local HTTP route checks, rendered markup checks, and build/lint/type verification.
- **Resolution:** No code change required. Run manual mobile browser QA at a 390px viewport: clear `sessionStorage`, open `/`, confirm one short intro, navigate among `/services`, `/book`, `/branches`, `/about`, `/contact`, return to `/`, and confirm booking wizard step changes do not trigger the public route line.

---

## 2026-06-06 - PUBLIC-BOOKING-MOBILE-VIEWPORT-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; docs equivalents and `.context/*` files were available and read.
- **Resolution:** Used `.context/*`, `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, local Next.js docs in `node_modules/next/dist/docs/`, and the Next.js App Router skill guidance.

## 2026-06-06 - PUBLIC-BOOKING-MOBILE-VIEWPORT-001 browser verification limitation

- **Symptom:** Tool discovery did not expose the in-app Browser/agent-browser navigation or screenshot controller during this turn.
- **Impact:** Full mobile tap-through of branch -> visit -> service -> date -> time bottom sheet could not be automated in the in-app browser. Code-level checks, production build, route smoke check, and headless Chrome mobile screenshots passed.
- **Resolution:** No code change required. Run manual mobile QA at 390px width on `/book`, select a branch, visit type, service, date, confirm the time bottom sheet opens, select a time, and confirm the selected date/time summary appears while the bottom action bar stays visible.

---

## 2026-06-07 - PUBLIC-PAGES-DARK-THEME-001 verification notes

- **Symptom:** Tool discovery did not expose the in-app Browser/agent-browser navigation or screenshot controller during this turn.
- **Impact:** Visual QA used local headless Chrome screenshots instead of the in-app Browser plugin.
- **Resolution:** Captured final production screenshots from a temporary `next start` server on `http://localhost:3011` and stopped that server after verification.

- **Symptom:** A pre-existing Next dev server was already running for `E:\cradlehub`, so starting a second `next dev` server on another port failed with Next's "Another next dev server is already running" guard.
- **Impact:** The existing `localhost:3000` server was not used as the final authoritative visual baseline.
- **Resolution:** Ran `pnpm build`, started temporary production server `next start --port 3011`, verified `/services`, `/contact`, `/about`, and `/branches` HTTP 200 plus screenshots, then stopped the temporary server.

---

## 2026-06-11 - UI-MOBILE-PRELOAD-001 headless Chrome sandbox retry

- **Symptom:** The first non-escalated headless Chrome runtime verification did not expose a DevTools endpoint from inside the sandbox.
- **Impact:** Browser-level checks could not run until Chrome was relaunched outside the sandbox.
- **Resolution:** Re-ran the same local headless Chrome verification with approved escalation. Mobile first-visit, repeat-session, desktop, protected route, and reduced-motion checks all passed.

## 2026-06-11 - UI-MOBILE-PRELOAD-002 headless Chrome verification notes

- **Symptom:** Non-escalated headless Chrome again did not expose a DevTools endpoint from inside the sandbox. The first escalated CDP helper also leaked a PowerShell task result into the WebSocket variable, and one `--dump-dom` attempt returned no DOM output.
- **Impact:** Browser-level verification needed one corrected escalated CDP rerun and a longer mobile wait because the dev server loaded slowly enough that a short wait caught the overlay mid-fade.
- **Resolution:** Corrected the CDP helper, reran Chrome with approved escalation, and confirmed mobile first-paint overlay, cookie/storage marking, final fade removal, repeat-cookie skip, desktop no-cookie skip, and protected-route isolation.

## 2026-06-11 - CRM-SCHEDULE-UI-001 authenticated visual QA limitation

- **Symptom:** Tool discovery did not expose the in-app Browser/agent-browser controller, and local `/crm/schedule` requests redirect unauthenticated users to `/login`.
- **Impact:** Full visual inspection of the authenticated CRM Daily Timeline with live schedule data could not be completed from this thread.
- **Resolution:** Verified with `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, and a local route probe returning `307 /login`. Authenticated CRM browser QA should confirm Fit Day, Expand/Collapse, right-rail behavior, and block alignment with real branch data.

## 2026-06-17 - RLS-GROUP-SCHEDULE-RULES-001 production RLS failure

- **Symptom:** Saving a new weekly group rule returned `new row violates row-level security policy for table "staff_group_schedule_rules"`.
- **Impact:** Active front-desk users carrying the legacy `csr` system role could read same-branch groups but could not create missing opening/closing rule rows.
- **Root cause:** The live CRM/CSR ALL policy omitted `csr` from its role array. The INSERT `WITH CHECK` therefore evaluated false even though actor and target group belonged to the same branch.
- **Resolution:** Applied forward migration `20260617123431_fix_staff_group_schedule_rules_rls.sql` with explicit command policies, complete approved role coverage, branch checks through the existing auth helpers, Owner-wide access, update old/new-row checks, and least-privilege grants. Added matching server-action checks and focused tests.

## 2026-06-17 - RLS-GROUP-SCHEDULE-RULES-001 verification limitations

- **Symptom:** Supabase MCP SQL/advisor calls returned permission errors or timeouts, and linked CLI SQL required an unavailable database-password connection path.
- **Impact:** Migration deployment and catalog verification could not use those two preferred interfaces.
- **Resolution:** Used the already-authorized Supabase Management API path to inspect catalog state, apply the exact migration atomically, record migration history, and run rollback-only live policy tests. Manual policy/grant/index/helper audits passed; the Supabase advisor endpoint itself could not be run.
- **Symptom:** No authenticated CRM/front-desk browser tab or test credentials were available.
- **Impact:** The final UI click-through save could not be performed.
- **Resolution:** Verified production RLS with real active production auth identities under `authenticated` role in rollback-only transactions, plus six server-action tests. Interactive browser save remains a named manual follow-up.

## 2026-06-15 - OWNER-RECONNECT-001 old Owner soft-pause blockers

- **Symptom:** Owner users could not reach `/owner` even though Owner routes, actions, constants, RLS policies, and workspace resolver support still existed.
- **Impact:** Owners were forced into CRM, Owner nav was hidden, and stale Owner warm-up/nav config could expose `/dev` or prefetch a nonexistent `/owner/settings` route once reactivated.
- **Root cause:** DEC-MVP-001 soft-paused Owner and Manager by hard-redirecting `/owner/*` and `/manager/*` layouts to `/crm`, hiding Owner nav, and mapping owner role fallback to CRM.
- **Resolution:** Replaced only the Owner layout redirect with an Owner workspace guard, restored Owner nav/default role resolution, removed stale Owner `/dev` and `/owner/settings` entries, and left Manager soft-paused.

## 2026-06-15 - OWNER-RECONNECT-001 full Vitest residual failure

- **Symptom:** `pnpm test` reports two failures in `tests/lib/bookings/progress.test.ts`: walk-in `not_started -> session_started` is currently allowed, while the tests expect check-in first.
- **Impact:** Full test suite is not green, but the failing area is booking progress state-machine behavior outside the Owner reconnect files.
- **Resolution:** No Owner reconnect code changed booking progress logic. Focused Owner workspace tests pass, and `pnpm type-check`, `pnpm lint`, and `pnpm build` pass. Follow-up should reconcile the booking progress implementation and tests separately.

## 2026-06-15 - OWNER-DASHBOARD-REDESIGN-001 full Vitest residual failure

- **Symptom:** `pnpm test` still reports the same two failures in `tests/lib/bookings/progress.test.ts`: walk-in `not_started -> session_started` is allowed by implementation while tests expect check-in first.
- **Impact:** Full Vitest remains partial, but the failing state-machine area is outside the Owner dashboard redesign. The new owner dashboard tests pass.
- **Resolution:** No dashboard code changed booking progress transitions. Verified `pnpm test tests/lib/owner/dashboard.test.ts`, `pnpm type-check`, `pnpm lint`, and `pnpm build` successfully. Resolve booking progress implementation/test expectations separately.

## 2026-06-15 - OWNER-DASHBOARD-REDESIGN-001 authenticated browser QA limitation

- **Symptom:** Local browser smoke for `http://localhost:3000/owner` redirected to `/login` because the in-app browser did not have an authenticated Owner session.
- **Impact:** The protected route/auth guard was verified, but the full dashboard visual with real Owner data could not be inspected in-browser from this unauthenticated session.
- **Resolution:** Production build and route generation passed; unauthenticated browser smoke captured no local app console errors. Run authenticated Owner QA with a logged-in Owner account to visually confirm spacing, responsive layout, filters, and live data.

## 2026-06-17 - CRM-DAILY-TIMELINE-REPLACEMENT-001 authenticated browser limitation

- **Symptom:** The local in-app browser redirected `/crm/schedule` to `/login` because it had no authenticated CRM session.
- **Impact:** The final board could not be inspected through the protected route with live branch data.
- **Resolution:** Rendered the real `ScheduleWorkspaceShell` and new `DailyTimelineTab` component tree through a temporary fixture-backed QA route, verified desktop/mobile layout and interactions, then deleted that route before the production build. The real protected route, authorization, queries, and route count remain unchanged; an authenticated live-data visual pass remains manual.

## 2026-06-17 - CRM-AUTHORIZATION-CONSISTENCY-001 Supabase linked-project CLI hang

- **Symptom:** `supabase db query --linked` hung for both the policy query and a minimal `select current_database(), current_user;` probe. The minimal probe timed out after 124 seconds with no result.
- **Impact:** Live `pg_policies`, grants, and helper function definitions could not be inspected from this thread.
- **Follow-up:** Re-run the policy/grant inspection from an environment with working Supabase Management API access or direct DB credentials before declaring the live DB portion complete.

- **Symptom:** `supabase db push --linked --dry-run` also hung and was manually terminated.
- **Impact:** Migration `20260617141348_crm_staff_service_capabilities_rpc.sql` was created locally but not dry-run or applied against the linked project from this thread.
- **Follow-up:** Apply the migration separately, then run an authenticated CRM/front-desk save test on `/crm/staff?tab=assignments`.

- **Symptom:** `supabase db lint --local --schema public` failed because local Postgres `127.0.0.1:54322` is not running.
- **Impact:** Local database lint for the new migration could not run.
- **Follow-up:** Start the local Supabase stack or lint against a reachable database.

## 2026-06-30 - CRM-STABILIZATION-HANDOFF-2026-06-30 pre-flight / stale-handoff risk

- **Symptom:** The latest focused stabilization prompt asks agents to read root `PROJECT_CONTEXT.md`, `AGENT_RULES.md`, and `ROADMAP.md`, but those files are not present at the repository root in this checkout. Equivalent files exist under `docs/`, and root `AGENTS.md` plus `CLAUDE.md` exist.
- **Impact:** A future agent following the prompt literally may think required governance files are missing and stop, or may read stale `.context`/`docs` records that point to old CRM Coach / observability work.
- **Resolution:** Updated `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/CURRENT_TASK.cmd.md`, `docs/HANDOFF.cmd.md`, and `docs/FRONT_DESK_REFACTOR_PROGRESS.md` to point to the active CRM stabilization/refactor. Future agents should read the `docs/` equivalents when root files are absent.
- **Follow-up:** Keep both `.context/*.cmd.md` and `docs/*.cmd.md` synchronized until the project chooses one canonical agent-memory location.

## 2026-06-30 - CRM-STABILIZATION-CHECKPOINT-1-NAV-SHELL-2026-06-30 remaining access/header gap

- **Symptom:** Checkpoint 1 implements the approved sidebar labels and a collapsed System Management section, but the latest prompt also asks for broader CRM user access to occasional system editing and a compact CRM header with current page title, branch, search, notifications, persistent New Booking, and user menu.
- **Impact:** The sidebar checkpoint is verified, but the full CRM shell objective is not complete. Ordinary CRM/CSR users may still be redirected away from current setup/staff/schedule-management pages because those page gates were intentionally preserved in this nav-only pass. Adding a global New Booking button now would also duplicate existing page-level New Booking buttons.
- **Resolution:** No permission or header code was changed in this checkpoint. System Management follows the existing management-authorized route model. The next agent should review page gates/action permissions/RLS before broadening setup access, and handle header New Booking only while removing duplicate page-level buttons.
- **Follow-up:** Continue with Checkpoint 2 Work Queue simplification, then schedule a dedicated CRM header/access review before claiming the complete CRM shell is done.

## 2026-07-02 - ATTENDANCE-QR-001 Supabase type generation / scheduling notes

- **Symptom:** `npm run db:types` failed because the script still passes removed Supabase CLI option `--project-ref`.
- **Impact:** The automated type-generation script cannot currently refresh `src/types/supabase.ts`.
- **Resolution:** Generated linked types manually with the current CLI syntax, but the linked production schema omitted unrelated local surfaces needed by existing code. Restored the baseline `src/types/supabase.ts` and manually augmented it for the new attendance tables, booking/check-in columns, and RPC.
- **Follow-up:** Fix the package `db:types` script and reconcile unrelated live/local schema drift separately from Attendance.

- **Symptom:** `pg_cron` is not installed on the linked Supabase project.
- **Impact:** Migration `20260702075213_attendance_qr_system.sql` created `complete_due_service_sessions`, but the optional cron scheduling block did not create an automatic job.
- **Resolution:** Verified the RPC exists and can be called manually/server-side.
- **Follow-up:** Decide whether to enable/install `pg_cron` or invoke the RPC from app/server infrastructure.

- **Symptom:** Two zero-byte `_tmp_14412_*` files in the repo root could not be removed with scoped `Remove-Item -LiteralPath`; PowerShell returned Access denied.
- **Impact:** They remain as untracked files in `git status`.
- **Resolution:** No broad cleanup was attempted to avoid touching unrelated worktree state.
- **Follow-up:** Remove them manually after closing any process lock, or leave them ignored until a safe cleanup window.

## 2026-07-02 - ATTENDANCE-QR-001 qr_points branch FK failure

- **Symptom:** Creating the Attendance QR returned `insert or update on table "qr_points" violates foreign key constraint "qr_points_branch_id_fkey"`.
- **Impact:** QR generation failed because the insert used a branch id that does not exist in `public.branches`.
- **Root cause:** `getAttendanceActionContext()` returned the dev-bypass mock branch id `00000000-0000-0000-0000-000000000000` whenever dev bypass was enabled, even when the authenticated user had a real staff branch. The linked DB check confirmed no zero UUID branch exists.
- **Resolution:** Added a server-only dev-bypass branch resolver that uses `DEV_BYPASS_BRANCH_ID` when valid or the first active real branch. Attendance actions now prefer real staff branch context and validate branch existence before inserts.
- **Verification:** `npx tsc --noEmit --pretty false` passed, `npm run lint` passed with the same four unrelated warnings, and linked DB verification resolved fallback branch `c1000000-0000-0000-0000-000000000002`.

## 2026-07-02 - ATTENDANCE-REFIT-005 final verification blockers

- **Symptom:** Sandboxed `pnpm type-check` failed before the script started with Windows `EPERM` unlinking `_tmp_*` files.
- **Impact:** Final script results could not be trusted from the restricted sandbox.
- **Resolution:** Ran final checks outside the restricted sandbox with `CI=true`. Results: `pnpm type-check` PASS, `pnpm lint` PASS with 0 warnings, `pnpm test` PASS (60 files / 564 tests), and `pnpm build` PASS (104 app routes).

- **Symptom:** `pnpm lint` originally reported four `@typescript-eslint/no-unused-vars` warnings.
- **Resolution:** Fixed all four without eslint suppressions, `any`, or `@ts-ignore`:
  - `scripts/generate-service-image-assets.mjs:26`: removed unused `FALLBACK_IMAGE_URL`.
  - `scripts/generate-service-image-assets.mjs:523`: replaced unused `generationPrompt` destructuring with explicit `appManifestEntry()`.
  - `tests/components/payroll/employee-payroll-table.test.tsx:17`: kept typed mock argument and used `void staffId`.
  - `tests/components/payroll/employee-payroll-table.test.tsx:18`: kept typed mock argument and used `void staffId`.

- **Symptom:** Browser visual QA for `/crm/attendance?tab=qr` redirected to `/login` at 1440, 1280, 1024, 768, and 375 px.
- **Impact:** The QR list/preview layout, real interactions, export buttons, print/PDF flow, public-link truncation, Deactivate confirmation, and mobile stacking could not be approved in-browser.
- **Root cause:** The local browser has no authenticated Supabase CRM/front-desk session. `DEV_AUTH_BYPASS=true` does not create a user session; `src/proxy.ts` checks `supabase.auth.getUser()` before the dev bypass path.
- **Evidence:** Blocker screenshots saved at `E:\cradlehub\.codex-artifacts\attendance-qr-qa\blocked-login-1440.png`, `...\blocked-login-1024.png`, and `...\blocked-login-375.png`. Browser errors were empty; console showed only normal dev/HMR/Speed Insights messages.
- **Follow-up:** Rerun authenticated browser QA with a valid CRM/front-desk session and complete the requested viewport, interaction, export, phone-scan, and QR identity checks.

- **Symptom:** After dependency restoration, `pnpm exec supabase --version` reports `The process cannot access the file because it is being used by another process.`
- **Impact:** App verification is not affected, but local Supabase CLI commands may need a retry after the Windows file lock clears.
- **Resolution:** Restored the Supabase package binary and top-level shim; do not stop unrelated Node processes just to clear the lock.

- **Symptom:** CRM Schedule Daily Timeline logged `[crm/schedule] daily timeline load failed {}` in production.
- **Impact:** Operators saw a vague console error while the query failure cause was hidden.
- **Resolution:** Updated `src/app/(dashboard)/crm/schedule/page.tsx` to log branch/date/message and development-only stack details, and updated the API/query layer to return safe no-store errors while failing loudly by query stage.

- **Symptom:** Daily schedule query could fail when `schedule_overrides.shift_type` was missing or hidden by schema drift.
- **Impact:** Timed overrides could not be labeled as opening/closing/single, and the failure was previously hard to diagnose.
- **Resolution:** Added `shift_type` to the override query/type, propagated it into schedule views, and added a regression test that verifies a missing column surfaces as `Schedule-overrides query failed`.

- **Symptom:** Supabase MCP for project `lsrbwqhvzjfpiabeolkv` still returned permission errors for SQL/type generation, and the direct DB host resolved to IPv6 without a usable route.
- **Impact:** MCP could not be used to apply SQL or generate types from this environment.
- **Resolution:** Used the Supabase transaction pooler for read-only verification. Confirmed `schedule_overrides.shift_type` exists and no invalid values are present.

- **Symptom:** `pnpm db:push` and `pnpm db:types` are blocked locally by Supabase CLI/pnpm issues: ignored build scripts plus EPERM unlink/rename failures around pnpm temporary files and `pnpm-workspace.yaml`.
- **Impact:** Migration history is not synchronized, and generated Supabase types were not refreshed by CLI in this pass.
- **Resolution:** App code and existing types were verified locally; defer `pnpm db:push` and `pnpm db:types` until the local pnpm/Supabase CLI environment is repaired.

- **Symptom:** A live Supabase database password was pasted into chat during troubleshooting.
- **Impact:** Treat the credential as exposed.
- **Resolution:** Rotate the Supabase database password before production deployment and update deployment/local secrets.

## 2026-07-03 - ATTENDANCE-FULL-INTEGRATION-002 feed/deep-link notes

- **Symptom:** A large patch attempt partially applied CRM Today feed props before the shell/dashboard props were present, causing `pnpm type-check` to fail on `attendanceScanFeed`.
- **Impact:** The tree was briefly inconsistent during implementation.
- **Resolution:** Added the matching `CrmTodayShell` and `WorkQueueDashboard` props; current `npx tsc --noEmit --pretty false` passes.

- **Symptom:** `pnpm lint` reported React Compiler `preserve-manual-memoization` errors in `AttendanceRecordsTab`.
- **Impact:** The new date/staff filter memo dependencies were too narrow for the compiler's inferred `initialFilters` dependency.
- **Resolution:** Normalized `initialStaffId` and `initialDate` before the memos and depended on those stable values. Current `npm run lint` passes.

- **Symptom:** The full pasted prompt includes first-scan trusted-device sign-in/linking, Staff Portal My Attendance, and staff-profile attendance history.
- **Impact:** Those flows are still not implemented in this slice.
- **Resolution:** Completed only the dashboard feed/realtime/deep-link slice and documented the remaining work explicitly.

## 2026-07-03 - DATABASE-CONNECTION-STABILIZATION-001 tooling audit

- **Symptom:** `pnpm exec supabase --version` returned `'supabase' is not recognized as an internal or external command` in the managed shell, while `.\node_modules\.bin\supabase.CMD --version` returned `2.95.6`.
- **Impact:** Package scripts that rely on direct `supabase` command resolution or `pnpm exec supabase` are unreliable in this environment.
- **Resolution:** Added project-local database wrappers under `scripts/database/` that call the checked-out `node_modules/.bin/supabase.CMD` shim when present and avoid global CLI drift.

- **Symptom:** `pnpm list supabase --depth 0` failed with `ERR_SQLITE_ERROR unable to open database file`.
- **Impact:** Some pnpm store/index inspection commands are unreliable from the managed sandbox even though `pnpm --version` and direct project binaries can run.
- **Resolution:** Documented the failure and avoided package-manager repair that would mutate dependencies without a clear need.

- **Symptom:** `psql` is not installed locally.
- **Impact:** The documented transaction-pooler emergency fallback cannot be executed from this environment until `psql` is installed through an approved toolchain.
- **Resolution:** The runbook gates emergency pooler application on `psql --version` and warns against ad-hoc SQL executors.

- **Symptom:** A live Supabase database password was pasted in chat before this stabilization task.
- **Impact:** The old database password must be treated as compromised.
- **Resolution:** Rotation cannot be confirmed from the repo. The final workflow requires the user to rotate the DB password and update only git-ignored local/deployment secrets before trusting DB tooling.

## 2026-07-03 - ATTENDANCE-DEVICE-REGISTRY-005 verification notes

- **Symptom:** `pnpm db:status` and `pnpm db:push` timed out against `aws-1-ap-northeast-1.pooler.supabase.com:5432`.
- **Impact:** The project wrapper scripts still cannot read remote migration history or run the normal migration push path from this network.
- **Resolution:** Applied `20260703151111_attendance_device_registry_recovery.sql` through the linked Supabase SQL path, inserted the migration-history row, regenerated types, and verified the live migration row, columns, RPC, and grant with a read-only SQL probe.
- **Follow-up:** Re-run `pnpm db:status` and `pnpm db:push` from a network/path that can reach the required migration-history connection, or repair the wrapper to use a supported IPv4 shared-pooler migration path if Supabase CLI supports it.

- **Symptom:** `tmp-attendance-device-registry-verify.sql` could not be deleted after verification.
- **Impact:** The temporary read-only probe remains untracked in the repo root.
- **Resolution:** `apply_patch` delete and scoped `Remove-Item -LiteralPath tmp-attendance-device-registry-verify.sql` both failed with access denied; a narrow elevated delete request was blocked by the environment usage limit. No broader cleanup workaround was attempted.
- **Follow-up:** Delete that one temporary file manually after the file lock/sandbox condition clears.

## 2026-07-04 - ATTENDANCE-FIRST-SCAN-LOGIN-007 audit-event duplicate edge

- **Symptom:** The first implementation of the scan-login device registration helper wrote the successful `first_scan_device_registered` audit row with both `qr_point_id` and the new `device_id`.
- **Impact:** `findRecentDuplicate()` checks recent successful `qr_scan_events` by QR point and device. The activation audit row could have made the immediately resumed attendance scan look like a duplicate, returning the noop result instead of the intended first clock-in/out.
- **Resolution:** Kept the registration audit row as `scan_type = 'activation'` but removed `qr_point_id` from the row; the scanned QR point remains in event metadata for audit context. The resumed attendance scan now writes its own success/noop/block event through the normal scan engine path.
- **Validation:** `pnpm type-check`, `pnpm lint`, and `pnpm build` all pass after the fix.
