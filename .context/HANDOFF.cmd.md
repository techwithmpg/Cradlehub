# HANDOFF — Next Agent Session

## Current Task

CRM-SCHEDULE-WORKSPACE-COMPLETION-2026-07-01 - active CRM Schedule workspace is locally complete; authenticated CRM Schedule QA remains pending.

## Latest User Intent

The user explicitly asked to keep progress logged so another AI agent can resume if Codex credit runs out.

The focused stabilization prompt is the operational guardrail: production-safe small checkpoints, no broad rebuilds, preserve working behavior, and do not claim CRM workflows work until UI actions are traced through server actions/API, auth, Supabase/RLS, constraints, invalidation, and feedback.

## What Was Done Most Recently

- Added explicit staff selection shared between Daily Timeline and Full Schedule; Schedule no longer silently falls back to the first visible staff row.
- Updated the Selected Staff card no-selection state and added Edit Profile, Edit Capabilities, and View Full Schedule actions.
- Reused existing modal/sheet surfaces instead of rebuilding them:
  - shared administrative booking modal
  - check availability modal
  - staff profile modal
  - staff service-capabilities sheet
  - staff full schedule calendar modal
  - availability/block-time editor
- Added in-place Edit Capabilities from both Schedule views through `StaffServiceEditorSheet` and `updateStaffServicesFromCrmAction`.
- Added timeline lane assignment in `src/lib/utils/schedule-timeline.ts`; overlapping booking blocks now render in separate vertical lanes in Daily Timeline and Full Schedule.
- Added a Schedule header view toggle for `Daily Timeline` and `Full Schedule + Live Bookings`, driven by the `view` query param.
- Added the Full Schedule + Live Bookings master-detail view with staff list, Day/Week mode, layer toggles, shifts, live bookings, blocks, overrides, no-shift states, and booking conflict flags.
- Full Schedule booking clicks open the in-Schedule booking detail panel using the real booking id.
- Audited Schedule/staff-service permissions and existing migrations; no new migration was added. Relevant existing migrations:
  - `supabase/migrations/20260529000002_crm_csr_schedule_rls.sql`
  - `supabase/migrations/20260529000003_crm_csr_staff_update_rls.sql`
  - `supabase/migrations/20260617141348_crm_staff_service_capabilities_rpc.sql`

## Previous Checkpoint

- Added shared quick-booking option loaders and a customer prefill server action.
- Mounted the shared administrative booking modal provider in the CRM layout.
- Extended `QuickBookingForm` for modal use while preserving `/crm/bookings/new` as a direct route.
- Converted major internal CRM New Booking triggers to modal buttons across Bookings, Today/Work Queue, Customers, Waitlist, Setup flow cards, direct customer profile, and Schedule header.
- Wired active CRM Schedule Daily Timeline actions:
  - Add Booking -> shared booking modal.
  - Check Availability -> in-context availability modal with slot-to-booking handoff.
  - Edit Staff Profile -> existing CRM staff profile modal with branch-authorized data load.
  - View Full Schedule -> existing staff schedule calendar modal.
  - Adjust Staff / Block Staff Time -> existing availability editor, including direct block-time tab/date prefill.
- Kept the existing booking server action; no duplicate booking action was introduced.

## Validation

- `npm run type-check`: PASS
- `npm run lint`: PASS with 4 unrelated existing warnings:
  - `scripts/generate-service-image-assets.mjs`: unused `FALLBACK_IMAGE_URL`, unused `generationPrompt`
  - `tests/components/payroll/employee-payroll-table.test.tsx`: two unused `_staffId` warnings
- `npm run build`: PASS, 103 app routes
- `git diff --check`: PASS, line-ending notices only
- Browser smoke via `agent-browser` on existing `http://localhost:3000`: unauthenticated `/crm/schedule` redirects to `/login`, which loads with content and no Next.js error overlay.
- Browser console/errors on the unauthenticated smoke route: no page errors; only normal dev/HMR/Speed Insights messages.
- Authenticated CRM Schedule modal/browser QA: NOT RUN in this checkpoint because no authenticated CRM browser state was available.
- `npm run test`: not run for this checkpoint.

## Current Worktree

There are uncommitted changes. Do not revert user/previous-agent work.

Run:

```bash
git status --short --branch
```

Known changed areas:

- Schedule workspace completion:
  - `src/components/features/schedule/workspace/schedule-workspace-shell.tsx`
  - `src/components/features/schedule/workspace/schedule-workspace-header.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-tab.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-selection-card.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-staff-row.tsx`
  - `src/components/features/schedule/tabs/full-schedule-live-bookings-view.tsx`
  - `src/lib/utils/schedule-timeline.ts`
  - `src/lib/actions/crm-staff-services.ts`
- `src/lib/queries/crm-context.ts`
- `src/components/features/dashboard/nav-config.ts`
- `src/components/features/dashboard/sidebar.tsx`
- `src/components/features/workspace/workspace-prefetch-config.ts`
- `src/app/(dashboard)/crm/today/page.tsx`
- `src/app/(dashboard)/crm/bookings/page.tsx`
- `src/app/(dashboard)/crm/control/page.tsx`
- `src/app/(dashboard)/crm/live-operations/page.tsx`
- CRM setup/staff/staff-availability route gating files
- Dashboard header/sidebar/nav/readiness/workspace-access files
- `.context/*`, `docs/*` handoff files
- `docs/FRONT_DESK_REFACTOR_PROGRESS.md`

## Important Direction Reconciliation

Checkpoint 1 reconciled the visible sidebar labels toward:

- `Work Queue`
- `Bookings`
- `Schedule`
- `Customers`
- `Home Service`
- collapsed `System Management`

However, System Management follows the current management-authorized route gates. The latest prompt's broader statement that ordinary CRM users may occasionally edit system tools still needs an explicit permission/page-gate review before exposing setup pages to all CRM/CSR roles.

## Next Logical Steps

1. Read `docs/FRONT_DESK_REFACTOR_PROGRESS.md` first.
2. Inspect current diffs before editing.
3. Do not restart the booking-modal, Schedule modal wiring, or Full Schedule view checkpoint; it has passing type-check, lint, build, and unauthenticated smoke verification.
4. Run an authenticated CRM browser pass if credentials/session are available:
   - `/crm/schedule` Daily Timeline selection and no-selection disabled actions.
   - Add Booking, Check Availability, Edit Staff Profile, Edit Capabilities, View Full Schedule, Adjust Staff, and Block Staff Time.
   - `Full Schedule + Live Bookings` Day/Week mode, layer toggles, staff selection, live booking detail panel, and conflict/lane rendering.
   - Confirm internal CRM triggers do not navigate to `/crm/bookings/new`.
5. Keep `/crm/bookings/new` alive as compatibility for direct links and agent fallback.
6. Continue remaining Work Queue / Today / Control Center simplification without deleting working routes.
7. Trace each additional CRM action end-to-end before claiming readiness.
