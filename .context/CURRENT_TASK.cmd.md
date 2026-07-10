# Current Task - SCHEDULE-CONFLICT-RESOLUTION-CENTER-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Optimize the Schedule Conflict Center into a professional conflict resolution center with business-impact classification, safer exception handling, search/filtering, and a three-zone desktop layout.

## Scope

- Keep existing live conflict detection, counts, timeline indicators, staff-row indicators, and safe action routing.
- Add impact groups: Must Fix, Needs Approval, Cleanup Warning, Informational, Accepted.
- Improve modal scanability with summary chips, impact groups, issue list, and resolution panel.
- Add safe-preview and accept-exception UI without introducing blind writes.
- Preserve public/online booking, CRM booking availability, QR attendance, attendance-as-live-status, and schedule setup write flows.

## Completed

- Removed the stale unused severity-count memo from the dialog wiring.
- Updated conflict tab/category typing so coverage gaps no longer point at the removed `coverage` tab.
- Narrowed accepted/active issue status typing in the impact model.
- Updated the legacy summary-list helper to compile against the new impact-group model.
- Added explicit `ReactNode` / `LucideIcon` typing in the resolution panel.
- Refreshed dialog tests to cover the reasoned accept-exception flow and accepted-tab transition.

## Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- Focused schedule tests: PASS, 12 files / 49 tests.
- Booking/availability safety tests: PASS, 8 files / 172 tests.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- Must Fix issues still cannot be accepted.
- Accepted exceptions remain local to the review-session UI/audit view; no blind schedule writes were introduced.
- Authenticated CRM browser QA against live branch data remains the final recommended operator check.

---

# Current Task - ATTENDANCE-RECOVERY-RULES-001

Status: COMPLETED
Started: 2026-07-10
Last updated: 2026-07-10

## Description

Upgrade Attendance into a schedule-aware recovery workflow so QR first scans near closing are no longer written as normal clock-ins when no earlier clock-in exists.

## Scope

- Keep the existing Attendance tab key `exceptions` for URL/backward compatibility while relabeling it as Recovery.
- Add a Smart Attendance Intent Engine that classifies clock-in, clock-out, duplicate, missing schedule, day-off, ambiguous, and likely closing-without-clock-in scans.
- Route recovery-grade scans to immutable raw scan events plus attendance exceptions instead of creating incorrect check-in records.
- Add Recovery Center views for Today Recovery, Staff Records, Rules, and Audit Log.
- Add attendance rules/corrections migration and server actions for corrections/rule updates.
- Preserve existing QR/device registration, branch validation, room scan, service session, and raw scan event flows.

## Completed

- Added `src/lib/attendance/attendance-intent-engine.ts` with pure schedule-aware scan intent classification.
- Updated `src/lib/attendance/scan-engine.ts` so first scans in clock-out/closing windows are recorded as `exception` / `likely_closing_scan_without_clock_in` and sent to Recovery instead of inserting `staff_shift_checkins`.
- Added `src/lib/attendance/attendance-correction-service.ts` plus server actions for applying launch recovery, manual clock-out, staff-day reset, ignored/reviewed scans, and rule updates.
- Added migration `supabase/migrations/20260710040835_attendance_recovery_rules.sql` for attendance rules/correction audit fields.
- Replaced the old Exceptions tab surface with `AttendanceRecoveryTab` while keeping internal key `exceptions`.
- Updated Attendance header, overview attention panel, quick actions, tabs, records entry point, workspace realtime refresh, and workspace data DTOs.
- Added focused intent-engine tests covering normal clock-in/out, duplicate scans, missing schedule, day off, first closing scan recovery, launch recovery, ambiguous scans, and overnight clock-out.

## Verification

- `npx vitest run tests/lib/attendance/attendance-intent-engine.test.ts`: PASS, 10 tests.
- `npx vitest run tests/lib/attendance`: PASS, 8 files / 41 tests.
- `npx tsc --noEmit`: PASS.
- Targeted `npx eslint` on touched Attendance files/tests: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.
- `git diff --check`: PASS, line-ending notices only.

## Notes

- The new migration has been created locally but was not pushed/applied during this pass.
- Authenticated CRM browser QA remains recommended after the migration is applied, especially for the Recovery Rules and Apply Recovery flows.

---

# Current Task - AGENT-COACH-IDLE-LOOP-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Fix the runtime `Maximum update depth exceeded` error in `AgentCoachProvider` caused by repeated idle-reset state updates from activity/scroll events.

## Scope

- CRM/Owner Agent Coach context provider idle detection.
- Preserve coach context, inline tips, chat bubble, and 45-second idle behavior.
- Do not change agent API routes or booking/schedule flows.

## Completed

- Replaced unconditional activity-event `setIsIdle(false)` calls with a ref-backed state guard.
- Moved the idle timeout handle into a ref so activity events only reschedule the timer and only trigger React state when the idle boolean actually changes.
- Added a regression test proving repeated mouse/scroll/click events while active do not re-render the provider, while the idle timeout and first follow-up activity still update correctly.

## Files Changed

- `src/components/agent/agent-context-provider.tsx`
- `tests/components/agent/agent-context-provider.test.tsx`

## Verification

- `pnpm test --run tests/components/agent/agent-context-provider.test.tsx`: PASS, 1 file / 1 test.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- Root cause was not the schedule conflict modal itself; it exposed a brittle global idle listener path because scroll/activity events could repeatedly request the same React state.

---

# Current Task - SCHEDULE-CONFLICT-CENTER-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Redesign the live Schedule conflict details UI so Coverage Overview is the single entry point and all detailed review happens inside a centered Schedule Conflict Center modal instead of a separate right-rail card.

## Scope

- Remove the independent right-rail Conflict Details card.
- Keep conflict detection, counts, timeline indicators, staff-row indicators, quick actions, and schedule-first guardrails.
- Add a modal with category tabs, grouped summary, issue cards, empty states, and safe action preview.
- Preserve public/online booking, CRM booking availability, QR attendance, and schedule setup write flows.

## Completed

- Replaced the Coverage Overview conflicts row with a compact issue summary card showing All clear / warning / critical states and a `Review Issues` entry point.
- Removed the old right-rail `Conflict Details` render path and deleted the obsolete panel/test files from the working tree.
- Added `Schedule Conflict Center` as a centered wide modal on desktop and full-height sheet on small screens.
- Added category tabs for All, Critical, Staff, Rooms, Coverage, Travel, Blocked Time, and Schedule with counts.
- Added grouped category summary navigation and filtered compact issue cards with human-friendly conflict labels.
- Added an in-modal safe action preview panel that delegates to the existing conflict action routing.
- Kept the live conflict model, SWR/realtime data path, timeline warning indicators, staff-row indicators, and booking/attendance guardrails intact.

## Files Changed

- `src/components/features/schedule/tabs/daily-timeline-coverage-card.tsx`
- `src/components/features/schedule/tabs/daily-timeline-operations-rail.tsx`
- `src/components/features/schedule/tabs/daily-timeline-tab.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-center-dialog.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-category-tabs.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-summary-list.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-issue-card.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-action-panel.tsx`
- `src/components/features/schedule/tabs/schedule-conflict-center-model.ts`
- `src/components/shared/overlays/admin-dialog.tsx`
- `tests/lib/schedule/schedule-conflict-center-dialog.test.tsx`
- `tests/lib/schedule/daily-timeline-coverage-card.test.tsx`

## Verification

- `pnpm test --run tests/lib/schedule/live-schedule-conflicts.test.ts tests/lib/schedule/schedule-conflict-center-dialog.test.tsx tests/lib/schedule/daily-timeline-coverage-card.test.tsx tests/lib/schedule/daily-timeline-operations.test.ts`: PASS, 4 files / 17 tests.
- `pnpm test --run tests/lib/assignments/recommendation-engine.test.ts tests/lib/home-service/distance-fee.test.ts tests/lib/bookings/crm-booking-status.test.ts tests/components/crm/availability-staff-shift-cell.test.tsx`: PASS, 4 files / 22 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- No Supabase migration was added.
- Authenticated CRM browser QA remains recommended for final visual/operator confirmation against live branch data.

---

# Current Task - SCHEDULE-CONFLICT-CLARITY-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Audit and improve the scheduling conflict logic connected to the live Schedule page so the Daily Timeline / Coverage Overview conflict count is clear, clickable/expandable, and every counted conflict explains who/what/time/rule/fix for non-technical front desk staff.

## Scope

- Live Schedule page Daily Timeline / Coverage Overview conflict calculation and display.
- Central conflict model for schedule-page conflicts.
- Timeline indicators for affected staff/booking/resource rows.
- Safe guided conflict actions that link to existing booking/schedule flows where direct writes are not safe.
- Preserve booking, attendance, online booking, CRM booking, QR attendance, and schedule setup behavior.

## Pre-flight Notes

- User requested work from attached pasted text on 2026-07-09.
- Read required project context files under `.context/` plus `docs/ROADMAP.md`, `docs/PROJECT_CONTEXT.md`, and `docs/AGENT_RULES.md`; root roadmap/context/rules files are absent in this checkout.
- Read local Next.js 16 docs for Server/Client Components and Route Handlers before source edits.
- Read Supabase and React/Next best-practice skill guidance because this task touches Supabase-backed schedule data and React/Next UI.
- Attendance/check-in must remain live status only and must not create schedule conflicts by itself.
- Online/public booking and CRM booking availability must remain separate and schedule-first.
- Resumed on 2026-07-09 after a prior interruption. The pure model files already exist; remaining work is to wire them into Daily Timeline/Coverage UI, indicators, tests, verification, and final context updates.

## Initial Plan

1. Identify where the visible `Conflicts` count is calculated and where daily timeline rows/cards receive conflict information.
2. Audit existing conflict/rule detectors across schedule, coverage, availability, CRM availability, and assignment logic.
3. Create or extend one typed conflict model for live schedule conflicts with plain-language messages, affected entities, safe actions, and admin-only debug metadata.
4. Feed the model into Daily Timeline / Coverage Overview so count and visible cards agree.
5. Add timeline/staff-row indicators for affected bookings/resources without changing public booking behavior.
6. Add focused tests for core conflict types, attendance non-conflict behavior, UI details, and quick actions.
7. Run `pnpm type-check`, `pnpm lint`, `pnpm build`, and relevant tests; update context files afterward.

## Completed

- Confirmed the previous visible Daily Timeline `Conflicts` count came from `DailyTimelineAlert` filtering in `src/components/features/schedule/tabs/daily-timeline-coverage-card.tsx`.
- Wired the central live schedule conflict model into the CRM Schedule page API payload, workspace shell, Daily Timeline tab, coverage card, summary metrics, operations rail, timeline board, and staff rows.
- Added a front-desk-friendly `Conflict Details` panel with plain-language conflict cards, severity, who/what/time/resource context, rule/fix copy, safe quick actions, and dev-only debug details.
- Added safe guided quick actions that select affected staff/bookings or open existing setup/full-schedule/availability flows instead of performing risky direct writes.
- Added timeline/staff-row indicators and booking highlighting for warning/critical conflicts.
- Preserved schedule-first booking behavior: attendance/check-in remains live status only and does not create schedule conflicts by itself.
- Preserved public/online booking, CRM booking availability, QR attendance, and schedule setup write flows.

## Files Changed

- `src/lib/schedule/live-schedule-conflict-types.ts`
- `src/lib/schedule/live-schedule-conflicts.ts`
- `src/app/(dashboard)/crm/schedule/page.tsx`
- `src/app/api/crm/schedule/route.ts`
- `src/components/features/schedule/hooks/use-live-daily-schedule.ts`
- `src/components/features/schedule/workspace/schedule-workspace-shell.tsx`
- `src/components/features/schedule/tabs/daily-timeline-tab.tsx`
- `src/components/features/schedule/tabs/daily-timeline-operations-rail.tsx`
- `src/components/features/schedule/tabs/daily-timeline-coverage-card.tsx`
- `src/components/features/schedule/tabs/daily-timeline-summary.tsx`
- `src/components/features/schedule/tabs/daily-timeline-board.tsx`
- `src/components/features/schedule/tabs/daily-timeline-staff-row.tsx`
- `src/components/features/schedule/tabs/daily-timeline-conflict-details-panel.tsx`
- `src/components/features/schedule/tabs/daily-timeline-conflict-actions.ts`
- `tests/lib/schedule/live-schedule-conflicts.test.ts`
- `tests/lib/schedule/daily-timeline-conflict-details-panel.test.tsx`
- `tests/lib/schedule/daily-timeline-coverage-card.test.tsx`

## Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.
- `pnpm test --run tests/lib/schedule/live-schedule-conflicts.test.ts tests/lib/schedule/daily-timeline-conflict-details-panel.test.tsx tests/lib/schedule/daily-timeline-coverage-card.test.tsx tests/lib/schedule/daily-timeline-operations.test.ts`: PASS, 4 files / 15 tests.
- `pnpm test --run tests/lib/assignments/recommendation-engine.test.ts tests/lib/home-service/distance-fee.test.ts tests/lib/bookings/crm-booking-status.test.ts tests/components/crm/availability-staff-shift-cell.test.tsx`: PASS, 4 files / 22 tests.

## Notes

- Authenticated CRM browser QA is still recommended to confirm the exact operator flow against live branch data.
- No Supabase migration was added for this task.

---

# Current Task - BRANCH-LOCATION-HOME-SERVICE-ORIGIN-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Add editable branch location settings so CRM Home Service distance calculation can use the selected branch latitude/longitude as the origin and the selected customer Google Places coordinates as the destination.

## Scope

- Branch location/settings UI.
- CRM Home Service booking distance integration.
- Reuse the existing Google Places/address picker where possible.
- Do not change public booking wizard behavior.
- Do not expose server-only Google or Supabase service-role keys to client code.

## Discovery

- Branch editing lives at `/owner/branches/[branchId]`, rendered by `src/app/(dashboard)/owner/branches/[branchId]/branch-edit-form.tsx`.
- Branch create/update actions live in `src/app/(dashboard)/owner/branches/actions.ts`.
- Branch data queries live in `src/lib/queries/branches.ts`.
- `public.branches` already had `address`, `maps_embed_url`, `latitude`, and `longitude`; it did not have `place_id`, `city`, `barangay`, or `location_metadata`.
- `public.branch_booking_rules` already had `home_service_free_km` and `home_service_extra_km_fee` from `20260709103000_home_service_distance_fee.sql`.
- CRM Home Service distance already used `branches.latitude`/`branches.longitude` as origin via `src/lib/home-service/distance-service.ts`.
- The reusable Google Places picker is `src/components/public/places-autocomplete.tsx`, with address-component helpers in `src/lib/location/google-address-components.ts`.

## Completed

- Added migration `supabase/migrations/20260709114038_branch_location_settings.sql` for `branches.place_id`, `branches.city`, `branches.barangay`, and `branches.location_metadata`.
- Updated local Supabase types for the new branch columns.
- Extended branch validation to accept selected Google Places origin data and to require latitude/longitude as a pair.
- Replaced the plain owner branch edit address field with a `Branch service address` editor using the shared `PlacesAutocomplete` component.
- Branch service address selection now stores formatted address, place id, latitude, longitude, derived city/barangay, map URL, and address components.
- The branch editor shows saved origin coordinates and derived city/barangay, or a warning when coordinates are missing.
- `updateBranchAction` now persists the new branch origin fields and revalidates the branch detail page.
- CRM Home Service distance missing-origin copy now points staff to update the selected branch service address.
- Public booking wizard behavior was not changed.

## Files Changed

- `supabase/migrations/20260709114038_branch_location_settings.sql`
- `src/app/(dashboard)/owner/branches/[branchId]/branch-edit-form.tsx`
- `src/app/(dashboard)/owner/branches/actions.ts`
- `src/lib/validations/branch.ts`
- `src/lib/home-service/distance-service.ts`
- `src/types/supabase.ts`
- `tests/lib/validations/branch-location.test.ts`

## Verification

- `pnpm test --run tests/lib/validations/branch-location.test.ts tests/lib/home-service/distance-fee.test.ts`: PASS, 2 files / 16 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- Apply pending Supabase migrations before relying on the new branch origin fields in a deployed environment.
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is required for the branch service address picker.
- `GOOGLE_MAPS_SERVER_API_KEY` is still optional for driving distance; without it, Home Service quotes fall back to Haversine estimates.

---

# Previous Task - CRM-HOME-SERVICE-LOCATION-FIELD-CLEANUP-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Clean up the CRM Home Service booking form so the selected Google Places service address is the single location source of truth, removing redundant manual city/barangay/landmark/location-note fields.

## Completed

- Removed the visible CRM Home Service `City`, `Barangay / area`, `Landmark`, and `Location notes` inputs from quick booking.
- Kept one required `Service address` field backed only by the shared Google Places autocomplete component.
- Removed the CRM plain text fallback for missing Google browser key; staff must select a real Places result before submit/distance calculation.
- Kept city and barangay as internal derived values from Google address components when available.
- Added one optional compact `Access note / special direction` field with placeholder `Example: blue gate, 2nd floor, near Puregold`.
- Submitted the access note as `homeServiceAccessNote` and stored it in booking metadata as `home_service_access_note`.
- Persisted selected address components and mirrored distance/source/travel fee details in the internal Home Service address metadata.
- Updated the CRM summary to show service address, distance from branch, free allowance, additional charged km, travel fee, and total.
- Public booking wizard behavior was not changed.

## Files Changed

- `src/components/features/bookings/quick-booking-form.tsx`
- `src/lib/actions/inhouse-booking.ts`
- `src/lib/validations/booking.ts`

## Verification

- `pnpm test --run tests/lib/home-service/distance-fee.test.ts`: PASS, 1 file / 14 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.

## Notes

- Removed stale generated `.next/dev/types/validator.ts` after it was found corrupted during the first `pnpm type-check`; source type-check passed after deleting the generated artifact.
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is still required for the CRM Places field to load.

---

# Previous Task - CRM-BOOKING-HOME-SERVICE-DISTANCE-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Fix CRM/internal booking therapist availability so saved schedules are the source of truth and attendance/check-in is only live-status metadata. Add CRM Home Service live address selection, branch-to-customer distance calculation, and the travel fee policy: first 5 km free, then PHP 100 per started extra km.

## Scope

- CRM/internal booking only.
- Preserve public booking wizard behavior; public booking code may only be inspected or safely reused without visual/functional changes.
- Do not expose server-only Google or Supabase service-role keys to client components.

## Required Discovery

- Identify which CRM component displays the generic "No therapist is available" message and which query/API supplies CRM therapist availability.
- Check whether attendance/check-ins/device registration are hard filters.
- Check staff service capability, schedules/group rules/overrides, blocked times, existing booking overlap, booking mode windows, and timezone parsing.
- Inspect existing public booking live address/location picker logic for safe reuse.
- Check branch location and home-service pricing settings before adding schema.

## Completed

- Confirmed the CRM quick-booking form was still using the generic public availability pre-check/copy while the CRM-specific schedule-first API already existed.
- Wired CRM quick booking pre-submit checks to `/api/booking/crm-availability`, preserving schedule-first availability and avoiding attendance/check-in as a hard blocker.
- Reused the public Google Places autocomplete component for CRM Home Service address selection without changing the public booking wizard.
- Required a selected/geocoded Home Service place in CRM before submit, then sent place id, formatted address, latitude/longitude, city/barangay hints, components, and map URL to the server action.
- Added live CRM distance quote UI for Home Service bookings through `/api/home-service/distance`, including distance, free allowance, charged extra km, travel fee, final total, and estimated-distance warnings.
- Preserved the existing server-side distance quote path: Google driving distance when `GOOGLE_MAPS_SERVER_API_KEY` is configured, Haversine fallback otherwise.
- Confirmed the travel-fee formula is first 5 km free, then PHP 100 per started extra km.
- Stored Home Service distance/fee/address metadata through the internal booking server action pricing breakdown/booking metadata path.
- Replaced remaining old generic no-therapist copy with the schedule-specific CRM message.
- Fixed owner spaces/rules fallback defaults for the new Home Service distance-fee fields.
- Added focused pure tests for Home Service distance and fee boundary behavior.

## Files Changed

- `src/components/features/bookings/quick-booking-form.tsx`
- `src/lib/actions/inhouse-booking.ts`
- `src/app/(dashboard)/owner/spaces-rules/page.tsx`
- `tests/lib/home-service/distance-fee.test.ts`

## Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 108 routes.
- `pnpm test --run tests/lib/assignments/recommendation-engine.test.ts tests/lib/home-service/distance-fee.test.ts`: PASS, 2 files / 18 tests.

## Notes

- Public booking wizard behavior was preserved; the CRM form only imports and reuses the public Places component.
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is required for the CRM browser autocomplete UI.
- `GOOGLE_MAPS_SERVER_API_KEY` enables driving-distance quotes; without it, quotes fall back to Haversine and the CRM UI marks them estimated.
- Apply pending Supabase migrations and regenerate database types if the deployment workflow requires it.
- Authenticated CRM browser QA with real Google Places and server distance credentials is still recommended after environment configuration.

---

# Previous Task - BRANCH-CORRECTION-REQUESTS-001

Status: COMPLETED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Implement the QR Attendance "Wrong Branch Correction Request" flow if the full flow does not already exist.

Staff blocked by a real scanned-QR/staff-branch mismatch should be able to submit a correction request to the scanned branch. CRM/front desk for the requested/scanned branch should be able to review and approve/reject the request without gaining broad access to staff in other branches. Approval updates `staff.branch_id`, keeps active attendance devices in sync or relies on the existing sync trigger, and writes an audit trail.

## Required Discovery

- Search for existing branch correction, wrong-branch, staff branch change, scan-engine, staff device branch mismatch, CRM inbox, and audit-log code before implementing.
- Inspect Attendance QR scan engine/UI/actions, CRM Attendance/Staff Management tabs, staff branch edit actions, and Supabase migrations.
- If the full flow exists, verify it end-to-end and patch only gaps; otherwise build the missing flow.

## Completed

- Found a partial branch correction implementation already present: request table/types/helpers, scan action entry point, wrong-branch payload types, and part of the public wrong-branch card existed, but the flow was incomplete.
- Added follow-up migration `supabase/migrations/20260709083908_staff_branch_audit_logs.sql` for `staff_branch_audit_logs`, missing request indexes, active requested-branch validation, and approval audit logging.
- Completed secure branch-correction helpers/actions for create, approve, reject, reviewer cancel, and staff-owned pending cancel.
- QR wrong-branch results now include staff/branch/QR/device/pending-request data, richer scan-event metadata, duplicate-pending detection, and clear wrong-branch copy.
- Public wrong-branch UI now shows current profile branch, scanned/requested branch, request button, pending-request state, front-desk approval reminder, and a "Try another account" path that clears scan auth/device context.
- Added CRM Staff Management "Branch Corrections" tab showing pending requested-branch correction requests with staff details, QR details, approve/reject actions, and confirmation copy.
- Central permission helper enforces owner/manager all-branch review, CRM/CSR requested-branch-only review, and no staff self-approval.
- Approval updates `staff.branch_id` through the RPC and relies on the existing `trg_staff_branch_sync_devices` trigger to keep active `staff_devices.branch_id` aligned.

## Files Changed

- `src/lib/attendance/scan-engine.ts`
- `src/lib/attendance/types.ts`
- `src/app/scan/actions.ts`
- `src/app/api/attendance/public-scan/route.ts`
- `src/components/features/attendance/public-scan-processor.tsx`
- `src/components/features/attendance/public-scan-result.tsx`
- `src/components/features/attendance/public-scan-processor.module.css`
- `src/lib/staff/branch-correction.ts`
- `src/lib/staff/branch-correction-policy.ts`
- `src/lib/staff/branch-correction-types.ts`
- `src/app/(dashboard)/crm/staff/actions.ts`
- `src/app/(dashboard)/crm/staff/page.tsx`
- `src/components/features/crm/staff/crm-staff-workspace.tsx`
- `src/components/features/crm/staff/crm-staff-branch-corrections-tab.tsx`
- `supabase/migrations/20260709064020_branch_correction_requests.sql`
- `supabase/migrations/20260709083908_staff_branch_audit_logs.sql`
- `tests/lib/staff/branch-correction-policy.test.ts`
- `tests/lib/staff/branch-correction-migrations.test.ts`
- `tests/components/attendance/public-scan-branch-correction.test.tsx`
- `tests/components/crm/crm-staff-branch-corrections-tab.test.tsx`

## Verification

- `pnpm test --run tests/lib/staff/branch-correction-policy.test.ts tests/lib/staff/branch-correction-migrations.test.ts tests/components/attendance/public-scan-branch-correction.test.tsx tests/components/crm/crm-staff-branch-corrections-tab.test.tsx tests/lib/attendance/branch-validation.test.ts`: PASS, 5 files / 16 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 106 routes.

## Notes

- Manual DB step still required: apply pending migrations, especially `20260709064020_branch_correction_requests.sql`, `20260709054954_attendance_device_branch_sync.sql` if not already applied, and `20260709083908_staff_branch_audit_logs.sql`; then regenerate Supabase types if the project standard requires checked-in generated types for new tables.
- Authenticated browser QA on a real CRM/front-desk session and physical QR phone scan QA are still recommended after migration deployment.

---

# Previous Task - STAFF-ONBOARDING-BRANCH-SAFETY-001

Status: COMPLETED
Started: 2026-07-08
Last updated: 2026-07-09

## Description

Harden the staff onboarding/registration flow so applicants cannot register under the wrong branch and approvers cannot silently move them to a different branch.

## Completed

- Branch selection is now required; the "No preference" option was removed.
- Single-branch setups auto-select and clearly display the only active branch.
- Multi-branch setups show selectable branch cards for the two active branches.
- Added a required confirmation checkbox: "I confirm this is the branch where I normally work."
- The Review step now shows the selected branch name.
- Backend no longer falls back to the first branch; missing/inactive branches are rejected.
- Branch confirmation metadata is stored in `staff_onboarding_requests.metadata`.
- `staff.branch_id` and `staff_onboarding_requests.requested_branch_id` are kept identical on submission and approval.
- Duplicate checks run before auth/staff creation for email (auth.users + submitted requests) and phone (active staff + submitted requests), including full-name + phone duplicates.
- Staff-friendly error messages added for duplicate email/phone and missing branch.
- CRM/CSR reviewers cannot change the approval branch; the branch selector is disabled for them.
- Owner/manager branch changes are allowed but clearly warned and recorded in metadata.
- Added password-save reminder and updated success copy.

## Files Changed

- `src/app/staff-onboarding/onboarding-form.tsx`
- `src/app/staff-onboarding/actions.ts`
- `src/components/features/staff-onboarding/onboarding-review-list.tsx`
- `src/lib/staff/onboarding-validation.ts` (new)
- `tests/lib/staff/onboarding-branch-validation.test.ts` (new)
- `tests/lib/staff/onboarding-duplicate-check.test.ts` (new)
- `tests/lib/staff/approval-branch-safety.test.ts` (new)
- `tests/components/staff-onboarding/onboarding-review-branch.test.tsx` (new)

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS
- `pnpm build`: PASS, 107 routes
- `pnpm test --run`: PASS, 73 files / 623 tests

## Notes

- No database migration was required; changes use existing `staff_onboarding_requests.metadata` (JSONB) and the existing `requested_branch_id` column.
- Authenticated browser QA of the onboarding form and CRM review list still needs a real session.

---

# Previous Task - BRANCH-CORRECTION-REQUESTS-001

Status: IN_PROGRESS
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Build Branch Correction Requests for QR Attendance wrong-branch recovery.

The new flow must let a staff member who is blocked by a real scanned-QR/staff-branch mismatch request correction to the scanned branch without changing their own branch directly. CRM users for the requested/scanned branch can review the request from Staff Management, approve or reject it, and approval updates `staff.branch_id` while preserving normal branch-limited Staff Management browsing.

## Pre-flight Notes

- Required prompt read from the current user message and attached pasted text references.
- Read `.context/CHANGELOG.cmd.md`, `.context/CURRENT_TASK.cmd.md`, `.context/DECISIONS.cmd.md`, `.context/ERRORS.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/ROADMAP.md`, `docs/PROJECT_CONTEXT.md`, and `docs/AGENT_RULES.md`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; documented equivalents under `docs/` are being used.
- Supabase and Supabase Postgres best-practice skill guidance read. Supabase changelog checked on 2026-07-09; relevant current note is that new public tables may not be exposed to the Data API automatically, so the new table must be RLS-protected and access must be intentionally granted/mediated.
- Local Next.js 16 docs under `node_modules/next/dist/docs/` were consulted for Server Actions, Route Handlers, authentication, and data security before code edits. Server Actions are treated as public POST endpoints and must re-auth/re-authorize internally.

## Initial Plan

1. Inspect Attendance QR scan result/action/UI code and CRM Staff Management data/action/UI code.
2. Add a new migration for `staff_branch_change_requests` with RLS, status constraints, FK indexes, and a safe atomic review RPC if needed.
3. Add server-only branch correction query/mutation helpers and thin Server Actions with explicit auth and branch-scope authorization.
4. Add wrong-branch request UI to the public scan recovery screen and a branch correction inbox to CRM Staff Management.
5. Add focused tests for permission/request helper behavior.
6. Run `pnpm type-check`, `pnpm lint`, and `pnpm build`; update context/handoff/changelog and document any errors.

---

# Current Task - BOOKING-ATTENDANCE-BRANCH-SAFETY-001

Status: COMPLETED_DB_VERIFIED
Started: 2026-07-09
Last updated: 2026-07-09

## Description

Fix the CRM Quick Booking availability/recommendation behavior so future, phone, and home-service bookings use scheduled availability instead of requiring checked-in staff, while walk-in-today falls back to scheduled staff with a warning when no eligible staff has checked in.

Fix Attendance QR branch validation so the scanned QR point branch is the source of truth, stale `staff_devices.branch_id` values do not create false wrong-branch blocks, first-scan login/register sets the cookie expected by the scan engine, and returning scans validate the current staff profile against the scanned branch using UUIDs.

## Pre-flight Notes

- Required prompt read from `C:\Users\eleur\.codex\attachments\7d57b7e4-c91e-426d-8e04-a7d45b07d3c2\pasted-text.txt`.
- Read `.context/CHANGELOG.cmd.md`, `.context/CURRENT_TASK.cmd.md`, `.context/DECISIONS.cmd.md`, `.context/ERRORS.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/ROADMAP.md`, `docs/PROJECT_CONTEXT.md`, and `docs/AGENT_RULES.md`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; documented equivalents under `docs/` are being used.
- Supabase and Supabase Postgres best-practice skill guidance read. Local Next.js 16 docs under `node_modules/next/dist/docs/` were consulted for Server Actions, Route Handlers, authentication, and data security before code edits.
- Existing local edits were present before this task in `src/components/features/bookings/quick-booking-form.tsx`, `src/lib/actions/inhouse-booking.ts`, and `scripts/diagnose-attendance-qr.ts`; inspect and preserve them.

## Initial Plan

1. Run safe read-only diagnostics for branches, QR points/devices/staff relationships, and booking availability schema/code assumptions.
2. Inspect the existing booking availability, recommendation, in-house booking, and quick-booking UI flow.
3. Inspect the Attendance scan engine, public scan API/actions, device cookie helpers, first-scan login path, and current database constraints/indexes.
4. Make the smallest code and migration changes that separate booking availability from attendance readiness and harden QR branch validation.
5. Add focused tests for booking fallback/warnings and QR stale-device branch handling.
6. Run `pnpm type-check`, `pnpm lint`, and `pnpm build`; update context/handoff/changelog with exact results.

## Completion Checkpoint - 2026-07-09

Completed:
- Booking auto-assignment now prefers checked-in therapists only for same-day walk-ins. If no eligible checked-in therapist exists, it falls back to scheduled availability and returns the exact warning: `No staff has checked in yet. Showing scheduled availability. Confirm staff presence before starting service.`
- Phone, future, and home-service booking recommendation paths now ignore attendance/check-in status and use schedule/conflict/service capability scoring only.
- Quick Booking surfaces the fallback warning in the success toast while preserving scheduled-slot validation.
- Attendance QR returning scans now validate the current staff branch against the scanned QR branch. A stale `staff_devices.branch_id` is repaired when the staff branch matches the scanned QR branch, instead of blocking as wrong branch.
- Attendance QR first-scan registration now checks authenticated staff ownership before branch validation and repairs stale existing-device branch ids when safe.
- Added migration `supabase/migrations/20260709054954_attendance_device_branch_sync.sql` with a staff-branch update trigger and one-time active-device repair.
- Applied the migration SQL through linked Supabase `db query --file` because `db push` timed out before SQL execution; recorded migration version `20260709054954` in `supabase_migrations.schema_migrations`.

Live DB verification:
- Migration row `20260709054954 / attendance_device_branch_sync / codex`: present.
- Trigger `trg_staff_branch_sync_devices` on `public.staff`: present.
- Active `staff_devices` rows with branch mismatch vs current `staff.branch_id`: `0`.

Verification:
- `pnpm test --run tests/lib/attendance/branch-validation.test.ts tests/lib/assignments/recommendation-engine.test.ts`: PASS, 8 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 106 app routes.

Notes:
- Safe diagnostics showed the current live wrong-branch scan events for the Main Spa attendance QR involved staff records whose current `staff.branch_id` is Living SM. This patch prevents stale device branch rows from causing false blocks, but staff whose actual current branch is SM will still be blocked by the Main QR unless their staff branch/membership is corrected or cross-branch membership is added.
- `pnpm db:push` and direct `supabase db push` still timed out to the Supabase Postgres pooler from this environment; linked `supabase db query` succeeded and was used for the migration fallback.

---

# Previous Task - ATTENDANCE-DEVICE-REGISTRY-005

Status: COMPLETED_DB_VERIFIED
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Build the Device Registry and Recovery Center backend first, then replace the Attendance Devices tab.

Scope:
- Reuse the existing Attendance tables and scan/device architecture.
- Audit current `staff_devices`, `device_activation_tokens`, attendance events/sessions, activation route, token hashing, device cookie, RLS, and permissions before changing schema.
- Add only the missing database columns/indexes/constraints/RPC needed for one-time device recovery links, device metadata, rename, revocation, pending links, and atomic recovery consumption.
- Implement typed registry queries, server actions, permission checks, and recovery consumption before final UI work.
- Replace only the Attendance Devices tab content with the approved Device Registry and Recovery Center UI.
- Add the staff recovery confirmation screen at `/scan/activate/<token>` without consuming tokens on page load.
- Preserve permanent Attendance QR clock-in/out behavior and service QR behavior.

## Pre-flight Notes

- Required prompt read from `C:\Users\eleur\.codex\attachments\c5b7a049-06d2-49d3-a790-060b34f4ee33\pasted-text.txt`.
- Supabase skill guidance read; Supabase changelog checked on 2026-07-03 for the public-table explicit grant change.
- Local Next.js 16 docs consulted under `node_modules/next/dist/docs/` for Server Actions, Route Handlers, Server/Client Components, and async cookies before editing app code.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; documented equivalents under `docs/` are being used.
- The prior database connection task remains below for handoff context. The Supabase DB password pasted earlier must still be rotated outside the repo/session.

## Mandatory Sequence

1. Audit existing Attendance schema and code.
2. Repair or extend the database.
3. Implement backend queries, actions, permissions, and atomic recovery.
4. Test and verify the backend.
5. Replace the Devices tab UI.
6. Implement the staff recovery-link screen.
7. Wire realtime refresh and deep links.
8. Run full verification and update project context.

## Completion Checkpoint - 2026-07-03

Completed:
- Added migration `supabase/migrations/20260703151111_attendance_device_registry_recovery.sql` and applied it to the linked Supabase database.
- Extended the existing `staff_devices` and `device_activation_tokens` model instead of creating duplicate attendance/device tables.
- Added atomic recovery consumption RPC `public.consume_attendance_device_recovery`, granted only to `service_role`.
- Added typed device registry/recovery backend helpers, CRM actions, scan recovery consumption, and generated Supabase types.
- Replaced the Attendance Devices tab with the Device Registry and Recovery Center UI, including filters, selected-device panel, pending recovery links, rename, revoke, recovery-link generation, and staff confirmation screen.

Verification:
- Live SQL probe: migration row, new columns, RPC, and `service_role` execute grant all returned `ok`.
- Live migration-history query also found the earlier local versions `20260703130922`, `20260703144603`, and `20260703145113` present remotely.
- `pnpm db:types`: PASS.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm vitest run tests/lib/attendance/device-recovery.test.ts`: PASS, 3 tests.
- `pnpm test`: PASS, 67 files / 595 tests.
- `pnpm build`: PASS, 105 routes.
- `git diff --check`: PASS, line-ending notices only.

Known limitations:
- `pnpm db:status` and `pnpm db:push` still time out on `aws-1-ap-northeast-1.pooler.supabase.com:5432`; live schema was verified directly through linked SQL instead.
- Authenticated browser QA for `/crm/attendance?tab=devices` and the staff recovery confirmation flow still needs a real CRM/front-desk session and a real phone/browser scan.
- A temporary SQL probe file `tmp-attendance-device-registry-verify.sql` remains untracked because Windows denied deletion and the elevated delete request was blocked by the environment usage limit.

---

# Previous Task - DATABASE-CONNECTION-STABILIZATION-001

Status: BLOCKED_ON_ROTATED_SECRETS_AND_REMOTE_MIGRATION_CONNECTIVITY
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Reset and establish a secure reusable Supabase migration, SQL, and type-generation connection.

Scope:
- Stabilize the project-local Supabase CLI workflow through `pnpm`.
- Keep linked Supabase CLI as the primary migration/type-generation path.
- Keep the transaction-pooler URL only as a local, git-ignored diagnostic and emergency fallback.
- Add reusable database doctor/status/verify/types wrappers that do not contain or print secrets.
- Document database setup, migration, type-generation, verification, fallback, and migration-history reconciliation procedures.
- Do not modify application business logic, reset production data, delete production data, or hardcode credentials.

## Pre-flight Notes

- Read the attached database stabilization prompt, Supabase skill guidance, `.context/*.cmd.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, root `AGENTS.md`, and root `CLAUDE.md`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; documented equivalents under `docs/` are being used.
- Supabase changelog was checked on 2026-07-03. Current relevant risks include Data API exposure defaults for new tables, direct DB host IPv6/IPv4 limitations, and pooler/prepared-statement behavior.
- Previous active scheduling repair is preserved below as a handoff; those dirty scheduling files are not part of this database tooling task.
- A Supabase database password was previously pasted in chat and must be treated as compromised until rotated outside this repo/session.

## Initial Plan

1. Audit local Supabase CLI package/shims, pnpm build-script state, stale processes, and link metadata.
2. Add secure environment placeholders and git-ignored local-secret guidance without committing credentials.
3. Create focused `scripts/database/*` wrappers for doctor/status/verify/types.
4. Update package database scripts to use the wrappers and project-local `pnpm exec supabase` workflow.
5. Document the reusable database runbook and context decisions/errors.
6. Run safe verification and report any remaining external blockers.

## Implementation Checkpoint - 2026-07-03

Completed:
- Added secure project-local Supabase wrappers in `scripts/database/`.
- Replaced stale hardcoded database package scripts with reusable `pnpm db:*` commands.
- Added `.env.example` placeholders for Supabase runtime and local-only database tooling variables.
- Updated `.gitignore` so `.env.example` can be tracked while `.env.local`, `.env.database.local`, and `supabase/.temp` stay ignored.
- Added `docs/DATABASE_CONNECTION_RUNBOOK.md`.
- Updated context, decision, error, handoff, project context, and roadmap notes.

Verified:
- `node --check scripts/database/*.mjs`: PASS
- `pnpm db:doctor`: RUNS; exits nonzero because DB password rotation is unconfirmed, `SUPABASE_DB_POOLER_URL` is missing, and linked migration history times out through the Supabase pooler.
- `pnpm db:status`: RUNS; local migration count is 83, remote history read times out, and no remote schema change occurred.
- `pnpm db:verify`: RUNS; linked SQL probe passes and the listed critical tables verify through service-role REST, but pooler fallback warns because `SUPABASE_DB_POOLER_URL` is missing.
- `pnpm db:push -- --dry-run`: RUNS; no remote schema change occurred, but the dry-run cannot connect to the remote migration database path.
- `npx tsc --noEmit --pretty false`: PASS
- `pnpm type-check`: PASS
- `pnpm lint`: PASS
- `pnpm test`: PASS, 66 files / 592 tests
- `pnpm build`: PASS, 105 app routes
- `git diff --check`: PASS, line-ending notices only
- Secret scan: PASS for tracked files and reviewed project placeholders; only placeholder URLs/variable names were found.

Not run:
- `pnpm db:types` was intentionally not run because `db:push --dry-run` is still blocked and generated types should not be refreshed from unreconciled remote schema history.

Remaining blockers:
- Rotate the Supabase database password outside the repo/session; the previously pasted password must be treated as compromised.
- Add the rotated pooler URL to `.env.local` or `.env.database.local` as `SUPABASE_DB_POOLER_URL`.
- Re-run `pnpm db:doctor`, `pnpm db:status`, `pnpm db:push -- --dry-run`, `pnpm db:push`, `pnpm db:types`, and `pnpm db:verify`.
- Reconcile migration-history drift before applying pending migrations.

---

# Previous Task - SCHEDULING-BACKBONE-AUDIT-001

Status: REPAIRED_LOCALLY
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Audit and repair all schedule-dependent operational flows before daily-use simulations.

Scope:
- Produce a scheduling dependency map before broad refactoring.
- Verify canonical schedule precedence across TypeScript and SQL/RPC paths.
- Repair confirmed timezone, group-membership, duration, blocking-status, realtime/cache, resource, dispatch, attendance, and Staff Portal inconsistencies where safe.
- Inspect the full local `supabase/migrations` folder and actual `get_daily_schedule`, `get_available_slots`, and `compute_booking_end_time` SQL definitions before changing schema or RPC behavior.
- Do not create a second scheduling engine, reset production data, regenerate QR codes, or start the large daily-use simulation suite during this task.

## Pre-flight Notes

- Read the attached master prompt, root `AGENTS.md`, `CLAUDE.md`, `docs/AGENT_RULES.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, and the active `.context/*.cmd.md` files.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; the documented `docs/` equivalents are being used.
- Next.js 16.2.4 local docs under `node_modules/next/dist/docs/` were consulted for Server Components, Server Actions/mutations, Route Handlers, and caching before edits.
- Supabase skill guidance was read. Direct Supabase CLI/type-generation remains historically blocked in this environment, so database verification must report exact command results honestly.
- Latest `main` is clean and synced after Attendance feed commit `7cae28f5`.

## Initial Plan

1. Create `docs/SCHEDULING_BACKBONE_AUDIT.md` with the required source/consumer map.
2. Inspect schedule resolver, availability, group rules/memberships, schedule workspaces, timezone helpers, Staff Portal, Attendance, booking duration, resource, dispatch, and SQL/RPC definitions.
3. Repair confirmed high-risk inconsistencies in the lowest shared layer first.
4. Add focused invariant/helper tests before broad simulations.
5. Run available verification and update context/handoff with exact blockers.

## Implementation Checkpoint - 2026-07-03

Completed in this slice:
- Added branch-local `YYYY-MM-DD` helpers in `src/lib/engine/slot-time.ts` and rewired touched Schedule pages, week/full-schedule views, coverage cards, CRM availability, and live timeline status away from UTC/machine-date defaults.
- Repaired Manager and Owner Schedule default selected dates to use branch business date.
- Repaired Full Schedule and Staff Full Schedule modal date navigation/labels to avoid `Date` + `toISOString()` serialization drift.
- Repaired Daily Timeline live status and Schedule Staff Mode summaries for branch-local current time and overnight windows.
- Repaired group-rule fallback lookups in CRM full schedule and assignment recommendations to use mapped plus raw group keys.
- Made group schedule apply fail closed when no explicit staff IDs are supplied.
- Added migration `supabase/migrations/20260703130922_scheduling_rpc_group_overnight_parity.sql` to align `get_available_slots` and `get_daily_schedule` with TypeScript group-key mapping, active booking-hold status semantics, and overnight schedule windows.
- Completed `docs/SCHEDULING_BACKBONE_AUDIT.md` with source map, consumer map, confirmed defects, repairs, SQL/RPC parity, verification, and remaining follow-ups.

Verified:
- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run src/lib/engine/availability.test.ts tests/lib/schedule/resolve-staff-schedule.test.ts tests/lib/schedule/schedule-timeline.test.ts tests/lib/schedule/daily-timeline-operations.test.ts tests/lib/schedule/daily-schedule-query.test.ts tests/lib/actions/staff-schedule-groups.test.ts`: PASS, 11 files / 79 tests
- `git diff --check`: PASS, line-ending notices only

Remaining follow-ups:
- The new SQL migration has not been applied to the linked database in this pass.
- `compute_booking_end_time` and `get_available_slots` still need a separate schema/API decision for `branch_services.custom_duration_minutes`, because app code/generated types reference the column but local migrations do not define it.
- Overnight date-specific overrides/bookings/blocks remain a schema-level follow-up; this pass repaired overnight schedule windows and local UI/status math.
- Authenticated Schedule browser QA remains pending.

---

# Previous Task - ATTENDANCE-FULL-INTEGRATION-002

Status: IN_PROGRESS - dashboard feed/deep-link slice complete
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Upgrade and fully integrate the existing CradleHub Attendance system without creating a second attendance module.

Scope:
- Preserve existing QR public codes, scan URLs, activation links, device records, scan records, session/check-in rows, correction logic, permission helpers, realtime hooks, QR exports, and print behavior.
- Inspect the existing Attendance QR implementation before adding or changing schema/UI.
- Complete the trusted-device first-scan flow where a staff member signs in once, confirms device linking, receives an HttpOnly attendance-device cookie, and completes the first clock-in without a second scan.
- Keep future registered-device scans automatic while preserving duplicate-scan protection and safe revoked/unknown/wrong-branch handling.
- Add one reusable `AttendanceScanFeedCard` for the CRM Work Queue right rail and Owner overview/dashboard surfaces.
- Add or reuse focused attendance queries, deep links, realtime invalidation, staff profile attendance history, Staff Portal My Attendance, device management, and correction workflows where safely possible.
- Avoid destructive migrations, QR regeneration, production data resets, or edits to previously applied migrations.

## Pre-flight Notes

- Read `.context/CHANGELOG.cmd.md`, `.context/CURRENT_TASK.cmd.md`, `.context/DECISIONS.cmd.md`, `.context/ERRORS.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, root `AGENTS.md`, and root `CLAUDE.md`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; the documented `docs/` equivalents are being used.
- Supabase changelog was checked on 2026-07-03. Relevant current risk remains Data API exposure for new public tables and direct DB/CLI connectivity limitations.
- Existing local verification from the previous checkpoint is green, but `pnpm db:push`/`pnpm db:types` remain blocked by direct DB connectivity and local Supabase CLI path issues.
- The Supabase database password was pasted earlier and must be rotated before production closure.

## Implementation Checkpoint - 2026-07-03

Completed in this slice:
- Added a reusable live `AttendanceScanFeedCard` backed by `qr_scan_events` and `staff_shift_checkins`.
- Wired the card into CRM Work Queue (`/crm/today`) and Owner Overview (`/owner`).
- Added `/api/attendance/recent-scans` for authenticated SWR refresh and Supabase realtime invalidation.
- Added `/owner/attendance` as a branch-aware owner entry that reuses the existing `AttendanceWorkspace` instead of creating a duplicate Attendance module.
- Preserved `/owner/attendance` tab switching on the owner route with the selected `branchId`.
- Added `/crm/attendance?tab=records&staffId=<id>&date=<yyyy-mm-dd>` filter handling, server-side invalid staff/date rejection, row highlighting, and a staff profile link.
- Added focused helper tests for feed record links and badge labels.

Verified:
- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/lib/attendance/scan-feed.test.ts tests/lib/attendance/tabs.test.ts`: PASS, 2 files / 9 tests
- `npm run lint`: PASS
- `npm run build`: PASS, 105 app routes
- `git diff --check`: PASS, line-ending notices only

Still not complete from the full pasted prompt:
- First-scan trusted-device sign-in/linking flow was not rebuilt in this slice.
- Staff Portal "My Attendance" and staff-profile attendance history were not added.
- Authenticated browser QA still needs a valid CRM/front-desk session.
- `pnpm db:push`, `pnpm db:types`, migration-history repair, and database password rotation remain operational blockers before production closure.

---

# Previous Task - ATTENDANCE-SCHEDULE-LIVE-DATA-001

Status: IN_PROGRESS
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Fix the production Attendance public URL failure and wire CRM Schedule Daily Timeline coverage to fresh live schedule data.

Scope:
- Replace Attendance page-origin resolution from the unreliable browser `Origin` header with a server-only request-origin helper using forwarded host/protocol and host.
- Resolve QR public URLs through `APP_URL`, public URL fallbacks, Vercel production URL, safe request origin, and development-only localhost.
- Keep Attendance non-QR data loading even when QR URL configuration is unavailable.
- Scope QR unavailable state to QR actions only while preserving existing QR point IDs, public codes, versions, resource associations, and scan history.
- Add live SWR-backed Schedule daily data from the existing `/api/crm/schedule` endpoint with no-store responses.
- Centralize Schedule realtime invalidation and remove duplicate display-level subscriptions.
- Correct Coverage Overview scheduled-staff denominator and show regular/single schedule rows when present.
- Preserve timed override shift classification through a nullable `schedule_overrides.shift_type` migration and legacy fallback.

## Pre-flight Notes

- Read `.context/*`, root `CLAUDE.md`, root `AGENTS.md` via session instructions, and `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md` because root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout.
- Installed stack is Next.js 16.2.4 and React 19.2.4; local Next.js docs under `node_modules/next/dist/docs/` were consulted for async `headers()`, route handlers, and environment variable behavior.
- Supabase changelog and current Realtime/CLI docs were checked; no new-table Data API exposure work is needed for the nullable column migration, and Realtime Postgres Changes should use one channel with table-specific subscriptions.
- Worktree was already dirty with unrelated Bookings selected-card changes and locked temp files; do not revert or clean unrelated files.

---

# Previous In-Progress Task - BOOKINGS-SELECTED-CARD-REFIT-002

Status: IN_PROGRESS
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Refit only the selected booking right-hand panel in the Bookings module to match the approved compact Selected Booking card mockup.

Scope:
- Keep the booking list, filters, tabs, header, pagination, CRM shell, and workspace layout unchanged except for the selected-panel footprint if needed.
- Preserve existing booking workflow server actions, status transitions, payment controls, notes, service countdown, recommendation logic, permission checks, and modal flows.
- Consolidate duplicated selected-booking details into one compact customer/booking summary.
- Provide one next-best primary action, secondary actions, overflow actions, compact payment and note summaries, collapsed full details, and compact recommendation warnings.
- Use the active-service countdown state in place of normal next actions when a service is running.
- Add focused coverage for next-action selection, overflow action availability, payment/note/full-details behavior, handler invocation, and key booking states.

## Pre-flight Notes

- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; equivalents in `docs/` plus root `AGENTS.md`, `CLAUDE.md`, and `.context/*` were read.
- Installed stack is Next.js 16.2.4 and React 19.2.4; relevant local Next.js docs under `node_modules/next/dist/docs/` are being consulted before source edits.
- Current branch is `main`; prior Attendance work was committed and pushed. Four locked zero-byte `_tmp_*` files remain untracked and unrelated.

---

# Previous Task - ATTENDANCE-REFIT-005

Status: BLOCKED ON AUTHENTICATED QR VISUAL QA
Started: 2026-07-02
Last updated: 2026-07-02

## Description

Refit the existing CRM Attendance workspace without rebuilding its database, scan engine, service-session engine, device activation flow, or Supabase security model.

Scope:
- Keep `/crm/attendance` as the single Attendance route.
- Keep one client workspace with instant local tabs for Overview, Records, Sessions, QR Codes, Devices, Exceptions, and Reports.
- Remove KPI-card rows from Attendance tabs, especially Overview.
- Reorganize Overview around live staff, recent scans, active sessions, exceptions, and compact quick actions.
- Rework QR Codes toward the approved compact list + selected branded preview design.
- Make Records, Sessions, Devices, Exceptions, and Reports professional compact workspaces.
- Fix the Attendance sidebar icon with `ClipboardCheck`.
- Preserve existing QR public codes, registered devices, scan routes, clock-in/out, room service-start logic, exceptions, records, reports, RLS, and branch access.
- Avoid `router.push`, `router.replace`, `router.refresh`, route links, or redirects for routine tab switching.
- Ensure QR generation actions return typed results and do not surface `NEXT_REDIRECT`.

## Pre-flight Notes

- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; equivalents in `docs/` plus root `AGENTS.md` and `CLAUDE.md` were read.
- Installed stack is Next.js 16.2.4 and React 19.2.4; local Next docs under `node_modules/next/dist/docs/` were read for Server/Client Components, Server Actions, instant navigation, preserved UI state, and redirect behavior.
- The prior `ATTENDANCE-QR-001` implementation is present as untracked source files in this dirty worktree. Do not revert unrelated user/previous-agent changes.

## Implementation Complete - 2026-07-02

- Rebuilt the Attendance workspace shell into a client-owned instant tab surface.
- Tab switches now use local state plus `window.history.replaceState()` through shared tab helpers; routine tab changes no longer use Next router refresh/navigation or route links.
- Removed Attendance KPI-card rows and replaced Overview with live staff status, recent scan activity, active service sessions, exceptions requiring attention, and compact quick actions.
- Split Records, Sessions, QR Codes, Devices, Exceptions, and Reports into compact professional tab workspaces.
- Reworked QR Codes into a selected-list + branded preview flow with reusable print layouts, export filenames, SVG/PNG/print/copy helpers, QR info, generate missing, generate attendance QR, and deactivate QR.
- Converted Attendance server actions from redirect/status-query patterns to typed `AttendanceActionResult` returns so server-action errors do not surface as `NEXT_REDIRECT`.
- Fixed the CRM Attendance sidebar icon by switching the nav config from missing `QrCode` to supported `ClipboardCheck`.
- Added pure helpers and coverage for tab parsing, QR URL/base URL production guards, print SVG layouts, and export filenames.

## Validation - 2026-07-02

- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/lib/attendance/tabs.test.ts tests/lib/attendance/qr-url.test.ts tests/lib/attendance/qr-print-layout.test.ts tests/lib/attendance/qr-filenames.test.ts`: PASS, 4 files / 14 tests.
- `npm run lint`: PASS with 4 unrelated existing warnings in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`.
- `npm run build`: PASS, 104 app routes including `/crm/attendance`, `/scan/[publicCode]`, and `/scan/activate/[token]`.
- `npm test -- --run`: PASS outside sandbox after sandboxed Vite config load failed with Windows `spawn EPERM`; 60 files / 564 tests.
- `git diff --check`: PASS, line-ending notices only.
- Source scan found no Attendance `redirect()`, `NEXT_REDIRECT`, `useRouter`, `router.*`, route `<Link>`, or `window.location` usage in the refit surface.
- Attendance component files are all under 200 lines; largest is `qr-codes-tab.tsx` at 189 lines.
- Final pnpm continuation: `pnpm type-check` PASS, `pnpm lint` PASS with 0 warnings, `pnpm test` PASS (60 files / 564 tests), and `pnpm build` PASS (104 app routes).
- The four previous lint warnings were fixed in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`; no eslint suppressions, `any`, or `@ts-ignore` were used.

## Follow-up / Limitations

- Authenticated browser QA for `/crm/attendance` tabs and real scan/device flows is still needed; the existing local dev server redirects unauthenticated browser sessions to `/login`.
- Browser smoke via `agent-browser` confirmed `/crm/attendance` redirects to `/login`, the login page renders content, and no Next/Vite error overlay is present.
- Existing QR/database/scan engine caveats from `ATTENDANCE-QR-001` still apply: pg_cron was not installed, migration history may need reconciliation, and `npm run db:types` remains a separate Supabase CLI script repair.
- Final browser QA attempted `/crm/attendance?tab=qr` at 1440, 1280, 1024, 768, and 375 px; every viewport redirected to `/login` because no authenticated Supabase CRM/front-desk browser session is available.
- Blocker screenshots were captured under `.codex-artifacts/attendance-qr-qa/`.
- Real QR interaction checks, phone-camera scans of exported PNG/SVG/print output, and QR identity preservation checks remain pending.

---

# Previous Task - ATTENDANCE-QR-001

Status: COMPLETE LOCALLY; authenticated CRM/browser QR QA remains PENDING
Started: 2026-07-02
Last updated: 2026-07-02

## Description

Build and wire the CradleHub QR Attendance and Service Session system:

- CRM `/crm/attendance` workspace with Overview, Attendance Records, Service Sessions, QR Codes, Registered Devices, Exceptions, and Reports tabs.
- Permanent branch attendance QR and room/resource QR scan flows through public `/scan/*` routes.
- One-time CRM-controlled staff device activation with secure cookie credentials.
- Database schema/RLS/functions for QR points, devices, activation tokens, scan events, attendance exceptions, corrections/settings, and service session authority fields.
- Attendance automation for clock-in/clock-out, duplicate protection, wrong-branch/unknown-device/revoked-device handling, unscheduled exceptions, and active-service clock-out blocking.
- Service-session start flow that reuses existing booking progress/session fields and room/resource assignment rules.
- Server-driven due-session completion where supported.
- Context, architecture, schema, and roadmap documentation updates after implementation.

## Pre-flight Notes

- Root `AGENT_RULES.md`, `PROJECT_CONTEXT.md`, and `ROADMAP.md` are absent in this checkout; the available equivalents are `AGENTS.md`, `.context/*`, `docs/PROJECT_CONTEXT.md`, and `docs/ROADMAP.md`.
- Current branch: `main`.
- Worktree was already dirty before this task, including prior CRM role normalization changes and many schedule/UI files. Do not revert unrelated existing changes.
- Next.js local docs and the Next.js/Supabase skills are being used for route handlers, async cookies/search params, public scan routes, server mutations, Supabase schema/RLS, and security guidance.

## Implementation - 2026-07-02

- Added migration `supabase/migrations/20260702075213_attendance_qr_system.sql`.
- Added QR attendance tables for QR points, staff devices, one-time activation tokens, scan events, attendance exceptions, corrections, and settings.
- Extended `staff_shift_checkins` with schedule/method/scan/metric fields and `bookings` with service-session duration/due/source fields.
- Added RPC `public.complete_due_service_sessions(p_limit integer default 100)`.
- Added server-only attendance helpers under `src/lib/attendance/*` for QR SVG generation, device credentials, timing metrics, workspace queries, and scan processing.
- Added public scan routes `/scan/[publicCode]` and `/scan/activate/[token]`.
- Added CRM workspace `/crm/attendance` with Overview, Attendance Records, Service Sessions, QR Codes, Registered Devices, Exceptions, and Reports tabs.
- Added CRM server actions for creating attendance/room QR points, creating activation links, revoking devices, resolving exceptions, and manually completing due sessions.
- Added CRM navigation/prefetch/agent-prompt entries for Attendance.
- Added `qrcode` and `@types/qrcode`.

## Database Status

- Migration was applied to the linked Supabase project via `supabase db query --linked --file`, then rerun after grant tightening.
- Live catalog verification confirmed all new tables, new booking/check-in columns, the RPC, and RLS/select policies.
- Authenticated grants are SELECT-only on new read surfaces; `device_activation_tokens` has no authenticated grant; anon grants were not present in the checked results.
- `pg_cron` is not installed on the linked project, so the optional cron block did not schedule an automatic job. The RPC is available for manual/server-side execution.
- Because this was applied with `db query --file`, Supabase migration-history tracking may not show the migration as applied. Do not assume `db push` history is reconciled.

## Validation - 2026-07-02

- `npx tsc --noEmit --pretty false`: PASS
- `npm run lint`: PASS with 4 unrelated existing warnings in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`.
- `npx vitest run src/lib/attendance/time.test.ts`: PASS, 1 file / 3 tests.
- `npm run build`: PASS, 104 app routes including `/crm/attendance`, `/scan/[publicCode]`, and `/scan/activate/[token]`.

## Follow-up / Limitations

- Authenticated browser QA was not run for CRM Attendance or real device scan flows.
- The `db:types` npm script is stale for the current Supabase CLI because it uses removed `--project-ref`; production type generation also exposed unrelated live schema drift, so `src/types/supabase.ts` was restored from baseline and manually augmented for attendance.
- Two zero-byte `_tmp_14412_*` files remain because PowerShell returned Access denied when attempting scoped `Remove-Item -LiteralPath`.

## FK Fix - 2026-07-02

- Fixed `qr_points_branch_id_fkey` failures when dev bypass is enabled.
- Root cause: Attendance server actions preferred `getDevBypassLayoutStaff()` before checking the real staff record, which supplied the zero UUID branch id `00000000-0000-0000-0000-000000000000`.
- Added `src/lib/dev-bypass-server.ts` to resolve dev bypass to a real active branch from Supabase, with optional `DEV_BYPASS_BRANCH_ID` support.
- Updated `getAttendanceActionContext()` to prefer the authenticated staff branch first, then fall back to the resolved real dev branch.
- Updated `getFrontDeskContext()` dev fallback to use the same real branch resolver.
- Added branch existence validation before attendance settings and QR point inserts so future invalid branch ids fail with a clear app-level message instead of a raw FK error.
- Verification: `npx tsc --noEmit --pretty false` PASS; `npm run lint` PASS with the same 4 unrelated warnings.
- Linked DB check confirmed zero UUID branch does not exist and the dev fallback branch resolves to `c1000000-0000-0000-0000-000000000002`.
- `npm run build` was attempted after the fix but did not return before the tool timeout; no build result is available for this follow-up patch.

---

# Previous Task - CRM-SCHEDULE-WORKSPACE-COMPLETION-2026-07-01

Status: COMPLETE LOCALLY; authenticated CRM Schedule QA remains PENDING
Started: 2026-07-01
Last updated: 2026-07-01

## Description

Complete the active CRM Schedule workspace before authenticated QA while preserving the shared administrative booking modal and prior Schedule modal-action work.

Latest attached direction supersedes the older "Front Desk only" wording for visible navigation:

- Primary daily CRM nav target: `Work Queue`, `Bookings`, `Schedule`, `Customers`, `Home Service`.
- Secondary collapsed target: `System Management` with Staff & Access, Services & Providers, Rooms & Resources, Booking Rules, Schedule Management, System Health, and Close Day.
- Do not rebuild stable parts. Stabilization and action reliability are more important than visual polish.
- Keep old CRM routes and redirects alive; this checkpoint is a shell/navigation update, not a page or database rewrite.

## Latest Implementation - 2026-07-01

- Added explicit staff selection state shared by Daily Timeline and Full Schedule; no row is auto-selected from `visibleRows[0]`.
- Updated the Selected Staff card no-selection copy and added active actions for Edit Profile, Edit Capabilities, and View Full Schedule.
- Reused existing staff profile, staff service-capabilities, full schedule calendar, availability editor, block-time, check-availability, and administrative booking modal surfaces from inside `/crm/schedule`.
- Added in-place Edit Capabilities wiring through `StaffServiceEditorSheet` and `updateStaffServicesFromCrmAction`, with `/crm/schedule` revalidation after save.
- Added timeline lane assignment in `src/lib/utils/schedule-timeline.ts` and applied it to Daily Timeline booking blocks so overlapping bookings render as separate vertical lanes.
- Added the Schedule header view toggle:
  - `Daily Timeline`
  - `Full Schedule + Live Bookings`
- Added `src/components/features/schedule/tabs/full-schedule-live-bookings-view.tsx` as a master-detail view with staff list, Day/Week mode, layer toggles, live bookings, shifts, blocks, overrides, no-shift states, and conflict flags.
- Full Schedule booking clicks now open the in-Schedule booking detail panel using the real booking id; they do not navigate away from `/crm/schedule`.
- Permission/RLS audit did not require a new migration. Existing relevant coverage remains:
  - `supabase/migrations/20260529000002_crm_csr_schedule_rls.sql`
  - `supabase/migrations/20260529000003_crm_csr_staff_update_rls.sql`
  - `supabase/migrations/20260617141348_crm_staff_service_capabilities_rpc.sql`

## Previous Implementation - 2026-06-30

- Added shared quick-booking option loaders and customer prefill action:
  - `src/lib/queries/quick-booking-options.ts`
  - `src/lib/actions/administrative-booking.ts`
- Mounted `AdministrativeBookingModalProvider` in the CRM layout.
- Extended `QuickBookingForm` for modal use: prefilled service/staff/date/time, stay-vs-redirect success behavior, cancel/success callbacks, and dirty-state reporting.
- Converted major CRM New Booking triggers to modal buttons across Bookings, Today/Work Queue, Customers, Waitlist, Setup flow cards, direct customer profile, and Schedule header.
- Preserved `/crm/bookings/new` as the direct/legacy full-page route, now backed by the same shared option helpers.
- Added active Schedule modal actions:
  - Add Booking opens the shared booking modal with selected staff/date/time where available.
  - Check Availability opens an in-context availability modal and can hand off selected slots to booking creation.
  - Edit Staff Profile opens the existing CRM staff profile modal after loading full staff data.
  - View Full Schedule opens the existing staff schedule calendar modal.
  - Adjust Staff / Block Staff Time open the existing availability editor, with block-time opening directly on the block form and selected date.
- Converted Schedule quick actions away from old `/crm/staff-availability` deep links inside the Schedule workspace where practical.

## Earlier Implemented Checkpoints

- Completed the interrupted Bookings / Quick Booking checkpoint:
  - Replaced `/crm/bookings/new` with a CRM Quick Booking form for walk-in, phone, future, and home-service modes.
  - Aligned the form, Zod schema, action input, customer upsert, home-service payload, assignment fields, payment state, metadata, and booking insert payload.
  - Preserved the existing `createInhouseBookingMultiAction`; no second booking action was added.
  - Completed Bookings grouping into Needs Action, Upcoming, Active, and Completed while preserving the existing drawer and row actions.
  - Verified authenticated CRM creation for walk-in, phone, future, and home-service bookings against live Supabase data.
- Prior checkpoint simplified visible CRM navigation to `Front Desk`, `Schedule`, `Customers`, `Dispatch`, plus management-only `Admin & Setup`.
- Fixed several misleading Today shell controls: dead `View all`, fake clickable rows, non-functional End of Day tab exposure, Add Follow-up destination, and 24-hour day progress indicator.
- Added richer `getFrontDeskContext()` in `src/lib/queries/crm-context.ts` with user id, role, branch id/name, capabilities, and allowed destinations.
- Replaced duplicated local CRM user/staff/branch lookups in:
  - `src/app/(dashboard)/crm/today/page.tsx`
  - `src/app/(dashboard)/crm/bookings/page.tsx`
  - `src/app/(dashboard)/crm/control/page.tsx`
  - `src/app/(dashboard)/crm/live-operations/page.tsx`
- Dedicated progress log: `docs/FRONT_DESK_REFACTOR_PROGRESS.md`.

## Current Worktree State

Uncommitted changes are present. Do not revert them unless the user explicitly asks.

Changed areas include:

- Schedule workspace completion files:
  - `src/components/features/schedule/workspace/schedule-workspace-header.tsx`
  - `src/components/features/schedule/workspace/schedule-workspace-shell.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-tab.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-selection-card.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-staff-row.tsx`
  - `src/components/features/schedule/tabs/full-schedule-live-bookings-view.tsx`
  - `src/lib/actions/crm-staff-services.ts`
  - `src/lib/utils/schedule-timeline.ts`
- Checkpoint 1 sidebar/nav shell files:
  - `src/components/features/dashboard/nav-config.ts`
  - `src/components/features/dashboard/sidebar.tsx`
  - `src/components/features/workspace/workspace-prefetch-config.ts`
- CRM page/context consolidation files listed above.
- CRM setup/staff/staff-availability gating from the previous checkpoint.
- Dashboard header/sidebar/nav/readiness/workspace-access changes from the previous checkpoint.
- Bookings / Quick Booking files:
  - `src/app/(dashboard)/crm/bookings/new/page.tsx`
  - `src/app/(dashboard)/crm/bookings/page.tsx`
  - `src/components/features/bookings/quick-booking-form.tsx`
  - `src/components/features/bookings/bookings-workspace.tsx`
  - `src/lib/actions/inhouse-booking.ts`
  - `src/lib/validations/booking.ts`
- `docs/FRONT_DESK_REFACTOR_PROGRESS.md` handoff log.

Run `git status --short --branch` before continuing.

## Validation Last Run

- `npm run type-check`: PASS
- `npm run lint`: PASS with 4 unrelated existing warnings:
  - `scripts/generate-service-image-assets.mjs`: unused `FALLBACK_IMAGE_URL`, unused `generationPrompt`.
  - `tests/components/payroll/employee-payroll-table.test.tsx`: two unused `_staffId` warnings.
- `npm run build`: PASS, 103 app routes
- `git diff --check`: PASS, line-ending notices only
- Browser smoke via `agent-browser` on existing `http://localhost:3000`:
  - `/crm/schedule` redirects unauthenticated browser session to `/login`; login page loads with content and no Next.js error overlay.
- Browser console/errors on the unauthenticated smoke route: no page errors; only normal dev/HMR/Speed Insights messages.
- Authenticated CRM Schedule modal/browser flow: NOT RUN in this checkpoint because no authenticated CRM browser session was available.
- `npm run test`: NOT RUN for this checkpoint.

## Next Agent Pickup

1. Read `docs/FRONT_DESK_REFACTOR_PROGRESS.md` first.
2. Inspect current diffs before editing.
3. Do not rebuild the shared booking modal, Schedule modal wiring, or new Full Schedule view from scratch; type-check, lint, and build are passing.
4. Recommended next step is an authenticated CRM browser pass:
   - Open `/crm/schedule` and verify Daily Timeline selection, no-selection disabled actions, Add Booking, Check Availability, Edit Staff Profile, Edit Capabilities, View Full Schedule, Adjust Staff, and Block Staff Time.
   - Switch to `Full Schedule + Live Bookings`, select staff, toggle Day/Week and layers, open a live booking detail, and confirm conflicts/layers render correctly.
   - Save at least one safe staff capability edit only if using a disposable/test staff record.
   - Confirm internal CRM New Booking triggers still open the shared modal and do not navigate to `/crm/bookings/new`.
5. Keep `/crm/bookings/new` alive for direct links, agent fallback, and compatibility.
6. Continue broader Work Queue / Today simplification only after authenticated Schedule QA if possible.

## Current Continuation - ATTENDANCE-SCHEDULE-REPAIR-002

- Status: Code repair and local verification are complete for the Daily Timeline console error and live Schedule data stabilization.
- The prior production `{}` console log is now replaced by contextual logging with branch ID, selected date, message, and development-only stack details.
- The daily schedule query now includes `schedule_overrides.shift_type` and fails loudly on staff metadata, blocked-time, and override query failures instead of silently returning empty data.
- Live DB check succeeded through the transaction pooler; the direct Supabase DB host was unreachable from this environment because it resolved to IPv6 only.
- The live DB already has `schedule_overrides.shift_type` and its check constraint, but Supabase migration history does not show `20260703022600` as applied.
- Verification passed with `npx tsc --noEmit`, `npm run lint`, focused schedule tests, full `npx vitest run`, `npm run build`, and `git diff --check`.
- Remaining infrastructure blocker: fix local pnpm/Supabase CLI first, then rerun `pnpm db:push` and `pnpm db:types` to reconcile migration history and generated types.
- Remaining security task: rotate the Supabase database password because it was pasted into the chat.
