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

## 2026-05-30 - CRM-EDIT-STAFF-PROFILE-TABBED browser verification limitation

- **Symptom:** Browser verification for `/crm/staff?tab=management` could not complete in the in-app browser.
- **Observed behavior:** PowerShell `Invoke-WebRequest` returned HTTP 200 for the route, but the in-app browser reported `ERR_CONNECTION_REFUSED` after the route redirected toward `/login`.
- **Impact:** Type-check, lint, and production build passed, but authenticated visual click-through of the modal still needs a reachable local browser session and valid CRM/CSR login.
- **Resolution:** No code change required for this limitation. Re-run browser verification once the local browser can reach `localhost:3000` and a CRM/CSR session is available.
