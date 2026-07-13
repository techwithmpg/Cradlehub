# 🏗️ DECISIONS

### DEC-001: pnpm as package manager
**Status:** ACCEPTED — faster, disk-efficient, strict dep resolution.

### DEC-002: Next.js 15 App Router
**Status:** ACCEPTED — Server Components, Server Actions, no client state for routing.

### DEC-003: Supabase
**Status:** ACCEPTED — Auth + PostgreSQL + RLS + Edge Functions in one platform.

### DEC-004: TEXT + CHECK instead of ENUM for status columns
**Status:** ACCEPTED — CHECK constraints are simpler to extend. ENUM ALTER TYPE can block under load.

### DEC-005: JSONB metadata on bookings
**Status:** ACCEPTED — Extension point for future fields without migrations.

### DEC-006: Role-aware middleware routing
**Status:** ACCEPTED — Middleware reads staff.system_role and redirects: owner→/owner, manager→/manager, crm→/crm, staff→/staff-portal.

### DEC-007: Separate admin Supabase client
**Status:** ACCEPTED — Service role client in admin.ts for server-only RLS-bypass operations. Never imported client-side.

### DEC-008: Separate system_role from staff_type
**Status:** ACCEPTED — 2026-04-30

**Decision:**
- `system_role` remains the access-control role (`owner | manager | crm | staff`).
- `staff_type` models the real-world job function (`therapist | nail_tech | aesthetician | csr | driver | utility | salon_head | managerial`).
- `is_head` marks department heads and supervisors.
- `staff_services` junction records which services each staff member can perform.

**Rationale:**
- Avoids breaking existing RLS policies, auth redirects, and dashboard guards.
- Allows Cradle’s real org chart to be represented without a risky migration of `system_role`.
- Supports future modules (driver dispatch, utility tasks, department hierarchy) without redesigning access control.
- Availability engine falls back to legacy behavior when `staff_services` is empty, enabling gradual rollout.

### DEC-009: Demo seed data ships as idempotent migration with explicit markers
**Status:** ACCEPTED — 2026-04-30

**Decision:**
- Add demo org/workflow seed data in a dedicated migration:
  `20260430000002_demo_org_workflow_seed.sql`
- Use deterministic UUIDs and `ON CONFLICT` upserts for rerunnable behavior.
- Mark demo rows clearly:
  - `bookings.metadata.seed = "demo"`
  - `bookings.metadata.source = "cradlehub_seed"`
  - test emails under `@example.test`

**Rationale:**
- Gives immediate test coverage for owner/manager/CRM/staff portal flows with realistic records.
- Avoids destructive table resets and avoids production-logic changes.
- Enables safe cleanup of demo bookings by metadata marker instead of broad deletes.

### DEC-010: Workflow signals split notifications from action-required tasks
**Status:** ACCEPTED - 2026-05-14

**Decision:**
- Keep `workspace_notifications` as the status/update layer.
- Add `workflow_tasks` as the action-required layer.
- Route new workflow-producing modules through `emitWorkflowEvent()` instead of direct ad hoc notification inserts.
- Use dedupe keys built from entity, event/task type, recipient staff or role, workspace scope, and branch.

**Rationale:**
- Prevents one operational event from creating multiple urgent notifications.
- Keeps work discovery inside the relevant workspace/module instead of pushing users toward a notification page.
- Preserves existing notification UI and RLS while giving future booking, dispatch, payment, and room-assignment workflows a safer central entry point.

### DEC-CRM-001: Use existing route paths in CRM nav (not spec-suggested aliases)
**Status:** ACCEPTED — 2026-05-21

**Decision:**
CRM nav items use existing route paths (`/crm/live-operations`, `/crm/staff-availability`, `/crm/spaces-rules`) with new display labels ("Live Map", "Availability", "Spaces") rather than creating `/crm/live-map`, `/crm/availability`, `/crm/spaces` redirect pages.

**Rationale:**
- All required pages already exist; no need for redirect indirection.
- Fewer files, less routing complexity, same result for users.
- Active route highlighting works correctly against existing routes.

### DEC-SCHEDULE-007: Individual schedules are the only runtime schedule source
**Status:** ACCEPTED — 2026-07-13

**Decision:**
- Runtime schedule resolution starts from operational staff and uses only
  `staff_schedules`, `schedule_overrides`, `blocked_times`,
  `staff_shift_checkins`, `bookings`, and `branch_resources`.
- UI shift language is `regular | opening | closing`; DB shift storage remains
  `single | opening | closing`, with conversion centralized in
  `src/lib/schedule/schedule-domain.ts`.
- Missing schedule, configured day off, conflict/needs-review, valid split, and
  valid overnight are separate states. Missing schedule is not a conflict.
- Schedule Setup and Adjust Schedule share the same weekly draft/editor/save
  path and write through `replace_staff_weekly_schedule`.
- Group schedules, duty assignments, paper imports, attendance history, and
  booking history may remain as historical/dormant data but must not generate
  effective runtime schedules.

**Rationale:**
- Prevents silent fallback behavior from masking CRM schedule configuration
  gaps.
- Keeps Daily Timeline, booking, attendance, dispatch, readiness, coverage, and
  staff portal behavior aligned around one resolver contract.
- Avoids leaking database terminology (`single`) into operator-facing UI.

### DEC-SCHEDULE-008: Schedule warnings must be contract-backed
**Status:** ACCEPTED — 2026-07-13

**Decision:**
- Runtime schedule warnings must carry exact issue type, resolver/state code,
  source ids, and a stable fingerprint when they come from schedule data.
- Missing room/resource warnings require an explicit service/resource contract
  in service metadata, such as `requires_room` or `required_resource_type`.
  A missing `resource_id` alone is not a warning.
- Coverage-gap warnings require an explicit `coverageRequirement` with a time
  window, category, actual count, and minimum. Roster-total comparison against
  broad `scheduling_rules.min_daily_staff` is not a live conflict source.

**Rationale:**
- Prevents old health checks from rebranding valid operational data as urgent
  warnings after the individual schedule unification.
- Keeps genuine schedule data issues actionable; for example, a 20-hour staff
  window should display `INVALID_TIME_WINDOW` with the exact window instead of
  "Conflicting staff schedule" / "All day".
- Avoids customer booking/resource false positives where the service does not
  actually require a room assignment.

### DEC-CRM-002: Keep owner/manager/staff nav flat, group only CRM roles
**Status:** ACCEPTED — 2026-05-21

**Decision:**
`WorkspaceNav` supports both `items` (flat) and `groups` (categorized). Only `crm`, `csr_head`, and `csr_staff` use grouped nav. All other workspaces remain flat.

**Rationale:**
- CRM has 15 items across 5 operational domains — grouping is essential for usability.
- Owner/Manager/Staff have fewer, homogeneous items where grouping adds no value.
- Backward-compatible: no changes to owner, manager, or staff sidebar behavior.

### DEC-CRM-003: /crm root redirects to /crm/control (not /crm/today)
**Status:** ACCEPTED — 2026-05-21

**Decision:**
`/crm` now redirects to `/crm/control` (the live operations console) instead of `/crm/today`.

**Rationale:**
- `/crm/control` is the main action-oriented operations center — the natural landing page for front-desk staff starting a shift.
- `/crm/today` remains accessible via the previous bookmark or direct navigation; it's not removed.

### DEC-PHASE2-001: Schedule and Availability are separate concepts
**Status:** ACCEPTED — 2026-05-21

**Decision:**
Phase 2 treats Schedule and Availability as distinct concepts:
- **Schedule** = planned staff work pattern (shift times, day-off, opening/closing assignment)
- **Availability** = live operational truth (who can be assigned right now)

**Rationale:**
Audit confirmed the current system conflates both under one table/page, which produces a page labeled "Availability" that actually shows schedule setup. Separating them enables both a proper schedule management workflow and a real-time CRM operations view.

### DEC-PHASE2-002: Phase 2B builds Live Availability from existing data only
**Status:** ACCEPTED — 2026-05-21

**Decision:**
Phase 2B creates the `/crm/availability` live view using existing tables only (`getDailySchedule`, `bookings`, `staff`). No new schema is introduced in Phase 2B.

**Rationale:**
The audit found enough existing data to produce a meaningful live availability view without schema changes. Keeping Phase 2B schema-free reduces risk and lets CRM staff get value immediately. Schema changes (shift_type, check-in) are deferred to Phase 2C/2D with dedicated migration prompts.

### DEC-PHASE2-003: opening/closing shift schema change deferred to Phase 2C
**Status:** SUPERSEDED by DEC-PHASE2-004 — implemented in Phase 2C (2026-05-21)

**Decision:**
Adding `shift_type` to `staff_schedules` and changing the UNIQUE constraint is deferred to Phase 2C. Phase 2C also requires updating `get_available_slots` RPC.

**Rationale:**
The RPC is the heart of the public booking engine. Any change must be backward-compatible (default `shift_type = 'single'` must behave identically to today). Rushing this risks breaking the booking wizard.

### DEC-PHASE2-005: staff_shift_checkins as the source of truth for staff presence
**Status:** ACCEPTED — 2026-05-21

**Decision:**
Phase 2D introduces a `staff_shift_checkins` table as the physical presence layer. Schedule remains the plan; check-ins represent actual attendance. Available Now requires: scheduled + checked in + not checked out + not busy.

**Rationale:**
- Cleanest separation of concerns: schedule = intent, check-in = truth.
- Minimal schema impact — one new table, no changes to booking engine or `get_available_slots`.
- RLS enforces branch scope and self-check-in safety without exposing cross-branch data.
- Drivers Ready now requires checked-in drivers, not just scheduled ones.
- Staff self-check-in allowed via staff portal; CRM/manager can also record check-ins on behalf of staff.

### DEC-PHASE2-004: shift_type stored directly on staff_schedules (not shift_templates)
**Status:** ACCEPTED — 2026-05-21

**Decision:**
For MVP, `shift_type` is stored as a TEXT column on `staff_schedules` (values: `single`, `opening`, `closing`; default `single`) rather than introducing a `shift_templates` table. The UNIQUE constraint was changed from `(staff_id, day_of_week)` to `(staff_id, day_of_week, shift_type)` to allow one opening and one closing row per staff per weekday.

**Rationale:**
- Smallest possible schema change that unlocks opening/closing split shifts.
- All existing single-shift schedules remain intact (default `'single'` is backward-compatible).
- `get_available_slots` RPC deduplicated with `SELECT DISTINCT` to handle overlap slots when opening and closing windows share times.
- `get_daily_schedule` RPC aggregated with `GROUP BY sid` + `MIN`/`MAX` to return a single full-span row per staff.
- Shift templates can be introduced later if scheduling becomes more complex (e.g., rotating rotations, copy-paste week).
- `pnpm db:types` was NOT run (local Supabase unavailable) — `src/types/supabase.ts` was manually updated. Whoever applies the migration should run `pnpm db:types` afterward.

### DEC-PHASE2-006: Schedule Setup uses a layered model with deferred universal persistence
**Status:** ACCEPTED — 2026-05-21

**Decision:**
Schedule Setup uses a layered mental model and UI architecture:
1. **Universal group schedules** — default rules applied by `staff_type` group (UI shell ready, persistence deferred).
2. **Individual adjustments** — staff-specific weekly schedules, shift types, overrides, blocked times (fully functional today).
3. **Overrides** — date-specific exceptions (fully functional today).
4. **Live Availability** — check-in + bookings + schedule result (fully functional today).

Universal schedule persistence is deferred to Phase 2F. The UI clearly labels preview/default state and does not claim data is saved.

**Rationale:**
- Separates the UX redesign (this task) from the schema migration risk.
- Existing `staff_schedules` table continues to serve all operational needs.
- CRM/manager users get immediate visual clarity on the group-first scheduling model.
- No risk to public booking engine, check-in system, or live availability.

### DEC-PHASE2-007: Recommendation-first assignment (no auto-assign)
**Status:** ACCEPTED — 2026-05-21

**Decision:**
Phase 2I introduces a recommendation-first assignment model. The system scores and ranks therapist/driver candidates with transparent reasons, but CRM/Manager remains responsible for confirming assignment. Auto-assignment is deferred until recommendations are proven reliable in production.

**Rationale:**
- Prevents wrong-staff assignments that damage customer experience.
- Gives operators full visibility into why a candidate is recommended (checked in, no conflicts, service-capable, etc.).
- Existing auto-assign by seniority still runs during public/in-house booking creation when no staff is selected.
- Recommendation engine uses real data: staff_schedules, check-ins, conflicts, overrides, blocked times, staff_services.
- No changes to `get_available_slots` RPC or public booking wizard.

### DEC-PHASE2X-001: Group schedule rules are fallback schedule source only
**Status:** ACCEPTED — 2026-05-21

**Decision:**
Individual `staff_schedules` override group `staff_group_schedule_rules` per day.
Priority: schedule_override > individual staff_schedule > group rule > no schedule.
Group day-off only applies when no individual schedule row exists for that day.
Overrides, blocked times, check-ins, and bookings still apply on top.

**Rationale:**
- Preserves existing individual customization power.
- Allows universal schedules to serve as true defaults without requiring every staff member to have individual rows.
- Applies consistently to: `get_available_slots` RPC, `get_daily_schedule` RPC, TypeScript `filterSlotsToWorkingWindows`, and recommendation context builder.

### DEC-CRM-004: /crm root redirects to /crm/today (supersedes DEC-CRM-003)
**Status:** ACCEPTED — 2026-05-25

**Decision:**
`/crm` now redirects to `/crm/today` (the Daily Operations page) instead of `/crm/control`.
DEC-CRM-003 is superseded.

**Rationale:**
- `/crm/today` is the natural landing page for front-desk CRM staff starting their shift.
- It shows staff readiness, today's bookings, and quick actions for walk-ins and home service.
- `/crm/control` remains fully accessible from the sidebar under "Main Operations".
- This is Phase 1 of CRM improvement — the redirect change is the safest first step.

### DEC-MVP-001: Owner and Manager workspaces soft-paused for MVP
**Status:** PARTIALLY SUPERSEDED — 2026-06-15

**Decision:**
Owner and Manager workspaces were soft-paused for MVP. OWNER-RECONNECT-001 supersedes the Owner portion only; Manager remains soft-paused. CRM remains the main operations command center.
- owner → routed to /owner when Owner workspace access is present
- manager, assistant_manager, store_manager → routed to /crm on login and on direct URL visit
- /owner/* uses an Owner workspace guard; /manager/* routes still redirect to /crm via layout.tsx
- Owner and Manager page files remain intact for later restoration
- Active workspaces after OWNER-RECONNECT-001: Owner, CRM, Staff Portal, Driver, Utility, Public Booking

**Rationale:**
- CRM already has all the operational tools needed to run the business (bookings, schedule, dispatch, customers, services, availability, staff management).
- Owner and Manager workspaces overlap heavily with CRM but are less polished and need dedicated attention.
- Soft-pausing Manager avoids confusion from near-identical workspaces during early operations.
- Files are preserved — re-activation is a small routing change, not a rebuild.
- All CRM permission helpers (`src/lib/auth/crm-permissions.ts`) are typed and ready for granular feature gates.

### DEC-CRM-PREMIUM-001: CRM premium component layer — CSS-only animations, no external motion library
**Status:** ACCEPTED — 2026-05-30

**Decision:**
The CRM premium work-area component layer uses CSS-only animations (custom keyframes in `globals.css`) rather than `motion` or `framer-motion`. The premium component folder lives at `src/components/features/crm/premium/` and exports 12 reusable components via `index.ts`.

**Rationale:**
- The project has no `motion` or `framer-motion` installed. Adding them requires user approval.
- CSS keyframes (`crm-fade-up`, `crm-row-enter`, `crm-shimmer-sweep`) are sufficient for the required entrance/stagger/shimmer effects.
- `prefers-reduced-motion` is respected via `@media` rule in globals.css — no runtime hook needed.
- Selected table row left border is implemented via `inset box-shadow` on `td:first-child` using the `.crm-row-selected` global CSS class, because `border-l` does not work on `<tr>` elements in standard table layout.
- The pattern is proven on Customers and can be applied to other CRM workspaces (Staff, Services, Schedule, Today, Bookings).

### DEC-CRM-MOTION-001: Use motion (Framer Motion) for CRM premium animations
**Status:** ACCEPTED — 2026-05-30

**Decision:**
`motion` 12 is the approved animation library for CRM premium work-area components. Import path: `motion/react`. All motion code calls `useReducedMotion()` and renders plain HTML fallbacks when `prefers-reduced-motion: reduce` is set.

**Approved motion targets:**
KPI card entrance (stagger), KPI card hover lift (y:-2), tab indicator slide (spring layoutId), preview rail slide-in (spring AnimatePresence), empty state entrance, table row stagger entrance.

**Not animated:**
global sidebar/header, large backgrounds, table cell content, every row field, page transitions, shimmer loaders.

**Motion settings:**
duration 0.22–0.26 s, stagger 0.05 s, spring stiffness 340, damping 30, mass 0.8.

**Rationale:**
CSS-only animations lack stagger coordination and spring physics. `motion` provides both without adding weight to the bundle beyond what it tree-shakes. The `motion/react` entry point is React-19 compatible.

**@number-flow/react decision:** Deferred. CountUpNumber is adequate for static server-fetched KPIs. Install only if KPIs become live-updating or decimal animation becomes noticeably rough.

### DEC-CRM-LOADER-001: Kokonut loader used only for CRM full-section / heavy loading states
**Status:** ACCEPTED — 2026-05-30

**Decision:**
The Kokonut loader (wrapped as CrmPremiumLoader) is used exclusively for:
- Full CRM route loading (route-level loading.tsx)
- Setup readiness scans
- Heavy section loading where data preparation takes noticeable time

It is NOT used for:
- Button/row save actions → CrmInlineActionButton with spinner
- Toggle / modal save → local spinner
- Any small inline action that must feel fast

**Rationale:**
Big waits feel premium with the animated ring loader. Small actions must feel fast — showing a full loader for a 200ms save is disorienting and makes the app feel slow. The skeleton shimmer system handles structural layout loading; the premium loader adds the "actively working" signal on top of it.

### DEC-CRM-TABS-001: CRM high-use operational tabs should become in-page workspace tabs where shared data can be safely loaded once
**Status:** PROPOSED — 2026-05-30

**Decision:**
- Pages where all tab data is already preloaded server-side (**Services**, **Staff**) should convert to internal tabs immediately.
- Pages where tabs have mutually exclusive heavy queries (**Customers**) should implement lazy-loading first, then convert.
- Pages already using internal tabs (**Today**, **Schedule**) require no changes.
- Pages that are not true tab pages (**Bookings**, **Setup**) should remain route-based.
- Deep links with `?tab=` must be preserved by reading `searchParams` on server render and passing `initialTab` to the workspace.
- `router.refresh()` remains acceptable during transition; replace with SWR revalidation or optimistic updates as follow-up.
- Modals must be lifted to workspace level before tab content is allowed to unmount on switch.

**Rationale:**
- Services and Staff already fetch all tab data on every page load, yet the user only sees one tab. Route-based switching causes unnecessary full-page reloads.
- The existing `CrmServicesWorkspace` and `CrmStaffWorkspace` components are structurally ready — they just need tab navigation changed from Links to buttons.
- Customers has 4 distinct queries (paginated customers, repeat customers, lapsed customers, waitlist). Preloading all four would hurt initial load time. A hybrid approach (preload default + lazy-load others) is safer.
- Today and Schedule prove the internal-tab pattern works well in this codebase.

**2026-05-31 audit refinement:**
- Treat Schedule as **partial conversion**, not already complete. `/crm/schedule` uses internal panels, but tab URL sync still uses `router.replace()` and the page awaits `searchParams`, so tab-only changes can still route-navigate and refetch server data.
- Treat Staff as **partial conversion first** if including the Applications tab. Management, Assignments, and Status can share preloaded data; Applications should stay lazy-loaded until onboarding review reload behavior is cleaned up.
- Keep `/crm/control`, `/crm/dispatch`, `/crm/live-operations`, `/crm/spaces-rules`, and `/crm/reconciliation` route-based until explicit lazy panel designs exist.

### DEC-CRM-TABS-001: CRM in-page workspace tabs for high-use operational pages
**Status:** ACCEPTED — 2026-05-31

**Decision:**
CRM pages with multiple tabs and pre-loaded shared data should use true in-page workspace tabs (client state + window.history.replaceState) rather than route-link tabs (CrmTabNav with Next.js Links). Services is the first approved implementation.

**Pattern:**
- Server page reads `searchParams.tab` → passes validated `initialTab` to workspace
- Workspace uses `useState<TabId>(initialTab)` for instant tab switching
- `handleTabChange` calls `window.history.replaceState` to keep URL in sync (NOT `router.replace` — that triggers data refetch)
- `TAB_URL_PARAM` map converts internal TabId to canonical `?tab=` value

**Why NOT router.replace:**
Next.js `router.replace` triggers soft-navigation, which re-renders server components and refetches data. For tab switching where all data is already loaded, this causes unnecessary loading states. `window.history.replaceState` updates the URL without any Next.js involvement.

**Approved pages for this pattern (in priority order):**
1. ✅ /crm/services — implemented (all data pre-loaded, safest conversion)
2. /crm/staff — low risk, management/assignments/status data preloaded
3. /crm/customers — needs lazy-loading strategy first (each tab has different heavy query)

**Not applicable for:**
- /crm/bookings — `date` and `bookingId` are URL-driven; deep links need normalization first
- /crm/schedule — already uses `useSearchParams` + `router.replace` with correct pattern
- /crm/today — already uses internal panels correctly

### DEC-CRM-SETUP-001: /crm/setup is the unified configuration workspace
**Status:** ACCEPTED — 2026-05-31

**Decision:**
/crm/setup is now the single unified Setup Center with 7 instant internal tabs:
1. Setup Health — readiness overview
2. Services — service list & customization
3. Providers — provider/staff assignment
4. Spaces & Rules — rooms & resources
5. Booking Rules — branch booking configuration
6. Staff Readiness — staff schedule & service assignment status
7. Public Booking — public booking readiness check

Old routes /crm/services and /crm/spaces-rules are preserved as compatibility redirects (not deleted) so existing deep links, action hrefs, and bookmarks continue to work.

**Pattern:** Same window.history.replaceState URL sync as DEC-CRM-TABS-001. Data loaded server-side in parallel (health + services + spaces in a single server render). SetupHealthContent passed as RSC slot to avoid Server Component import restrictions in the client workspace.

**revalidatePath:** Existing actions revalidate /crm/services and /crm/setup — both paths remain valid routes (one redirects, one is the unified page). No action changes needed.

### DEC-CRM-STAFF-TABS-001: Staff uses in-page workspace tabs for shared staff data
**Status:** ACCEPTED — 2026-05-31

**Decision:**
CRM Staff Management, Service Assignments, Applications, and Status now use true in-page workspace tabs. Deep links are preserved through `?tab=`, but tab switching no longer uses route-link navigation.

**Pattern:**
- Server page reads `searchParams.tab` and passes a validated `initialTab` to `CrmStaffWorkspace`.
- `CrmStaffWorkspace` owns local tab state with `useState`.
- Tab clicks use `CrmSegmentTabs` button tabs and `window.history.replaceState`.
- Core Staff panels stay mounted and hidden when inactive so tab switching preserves local state.

**Rationale:**
The Staff page already preloads the shared staff/service assignment data required by Management, Assignments, and Status. Keeping tab switching client-side removes route loading while preserving existing server actions and refresh behavior.

### DEC-NOTIF-BELL-001: Notification bell popover uses one business-readable list
**Status:** ACCEPTED — 2026-05-31

**Decision:**
Notification bell popover now uses one simple business-readable list instead of categorized tabs. Categories may remain for the full notification center later, but the bell must prioritize immediate clarity and action.

**Pattern:**
- Bell popover shows newest notifications first.
- Each bell row maps raw notification data through `getNotificationDisplay()` before rendering.
- The mapper uses `notification.type` first, metadata when present, and existing title/body/action href as safe fallbacks.
- The full notification center can keep category/section components; the bell no longer imports or renders `NotificationTabs`.

**Rationale:**
CRM staff need the bell to answer what happened, who/what is affected, when it happened, and what to do next without deciding between Action Required, Updates, Resolved, and Activity categories.

### DEC-CRM-BOOKINGS-WORKFLOW-001: Bookings uses operational in-page workflow tabs and centralized action modals
**Status:** ACCEPTED - 2026-06-03

**Decision:**
`/crm/bookings` now uses CRM workflow tabs for the front-desk lifecycle: Needs Confirmation, Confirmed, Waiting / Arrived, In Service, Completed, and Callback Follow-up. Deep links use canonical `?tab=` values, and tab switching uses client state plus `window.history.replaceState` so the booking workspace does not soft-navigate just to change workflow buckets.

Booking operational actions are centralized into modal components:
- Booking Follow-up for confirmation, no-answer, reschedule, confirm-later, and cancellation notes.
- Customer Arrived for in-spa check-in.
- Assign Room / Change Room for branch resource assignment.

**Rationale:**
CRM staff need to move bookings through the real front-desk flow, not just filter a flat status table. Keeping the actions in lifted modal components prevents row-level duplication and lets the detail panel, deep links, and future queue cards reuse the same behavior. Room assignment intentionally uses the existing resource availability engine instead of introducing a second availability rule path.

**Supporting choices:**
- Pending/incoming booking statuses are centralized in `src/lib/bookings/crm-booking-status.ts`.
- Room assignment uses `isResourceAvailable()` and `autoAssignBookingResource()` from the existing resource engine.
- Customer arrival updates `booking_progress_status = "checked_in"` and leaves home-service bookings out of room assignment.
- Callback follow-up embeds the existing waitlist follow-up table into the Bookings workspace instead of duplicating waitlist UI.
- Booking mutations call shared booking surface revalidation so CRM Today, CRM Bookings, CRM Control, Manager bookings, and workspace cache tags stay fresher after status/payment/create changes.

### DEC-MOBILE-NAV-001: Mobile staff/driver nav is shell-owned
**Status:** ACCEPTED - 2026-06-04

**Decision:**
Staff, Therapist, Driver Staff Portal, and standalone Driver mobile navigation should be owned by layout-level mobile shells, not by individual page components. Each role-specific bottom-nav file is now a thin route configuration wrapper around `FloatingMobileBottomNav`.

**Rationale:**
- Prevents duplicate fixed nav bars when pages compose nested mobile flows.
- Keeps bottom safe-area spacing consistent across home, schedule, week, progress, dispatch, and driver routes.
- Preserves desktop layouts through `md:hidden` nav rendering and `md:contents` shells.
- Allows Basic, Therapist, and Driver route sets to share the same glass nav behavior while keeping their labels and primary action routes role-specific.

### DEC-PUBLIC-LOADING-001: Public mobile loading has one intro and one scoped route line
**Status:** ACCEPTED - 2026-06-06

**Decision:**
Public mobile loading is split into two narrow experiences:
- The custom Cradle intro lives only in the homepage mobile component and is session-scoped with `cradle_public_intro_seen`.
- Public route progress is a root-mounted client component, but it is inert unless the current and target paths are top-level public routes: `/`, `/services`, `/book`, `/branches`, `/about`, and `/contact`.

Root `src/app/loading.tsx` renders only a non-branded dark mobile paint guard so it cannot show a second full-screen loading shell before the homepage intro and does not flash light/white while content streams. The `(public)` route group owns a thin warm-gold fallback line for streamed public segment transitions.

**Rationale:**
The homepage lives at `src/app/page.tsx`, while the rest of the public pages live under `src/app/(public)`. A root-mounted but allow-listed route line is the smallest way to persist across `/` and `(public)` transitions without touching booking logic or protected workspaces. The intro emits an active-state event so route progress does not start while the intro is playing.

### DEC-CRM-STAFF-SERVICES-001: Staff service capability replacement is database-atomic
**Status:** ACCEPTED - 2026-06-17

**Decision:**
CRM Staff service capability replacement uses the `replace_staff_service_capabilities` PostgreSQL RPC instead of a Server Action performing separate `delete()` and `insert()` calls.

**Pattern:**
- The Server Action still performs session/user, CRM-role, branch, and protected-target checks for friendly errors.
- The RPC is SECURITY INVOKER, so authenticated table grants and RLS remain the row-level enforcement layer.
- The RPC validates actor, target staff, branch scope, active branch services, duplicate service IDs, and privileged target protection before deleting anything.
- The RPC returns the final authoritative service IDs; the client updates local assignment rows from that return value before calling `router.refresh()`.

**Rationale:**
A delete-then-insert sequence can lose previous assignments if insert fails. A SECURITY INVOKER RPC gives one database transaction without using the service-role key or disabling RLS, while the returned rows prevent the current UI session from showing stale assignment data.

---

## 2026-06-20 — Kimi: Agent Swarm Architecture Decision

**Decision:** Start the CradleHub agent swarm with a single CRM Coach before expanding to owner/manager/staff-portal.

**Rationale:**
- CRM users are struggling the most with the system; highest ROI target.
- A narrow scope (guide + suggest-only actions + proactive tips) lets us validate LLM integration, audit logging, and UX before adding auto-actions.
- Using the existing `ai` SDK + Anthropic provider integrates cleanly with Next.js App Router.
- All agent interactions are logged to `agent_audit_logs` for trust and iterative improvement.

**Trade-offs:**
- Suggest-only initially means no automated data changes; users must click suggested links.
- Proactive tips fire after 45s of inactivity; may need tuning based on user feedback.
- Owner review UI not included in MVP; audit logs must be queried via Supabase Studio.

**Consequences:**
- New dependency on Anthropic API key.
- New table `agent_audit_logs` requires migration.
- Future agents can reuse `src/lib/agents/` core and `/api/agent/coach` route pattern.

---

### DEC-CRM-STABILIZATION-001: Latest CRM visible navigation direction supersedes older Front Desk labels
**Status:** ACCEPTED - 2026-06-30

**Decision:**
For the next CRM stabilization/refactor pass, visible navigation should reconcile toward the latest prompt:
- Daily operations: `Work Queue`, `Bookings`, `Schedule`, `Customers`, `Home Service`
- Secondary system tools: collapsed `System Management`

Older route names and internal identifiers may remain during stabilization. In particular, helpers like `getFrontDeskContext()` and existing `/crm/*` routes do not need a risky global rename just because user-facing copy is changing.

**Rationale:**
- The latest prompt explicitly prioritizes production usability by tomorrow and warns against broad redesign or uncontrolled internal renames.
- Route compatibility and live workflow preservation are more important than perfect internal naming.
- Existing checkpoint work used `Front Desk`, `Dispatch`, and `Admin & Setup`; future agents need a documented bridge so they do not fight the existing code or undo working changes.

**Consequences:**
- Update user-facing labels deliberately and keep redirects/deep links until old links are migrated.
- Treat Work Queue/Home Service/System Management as product copy, not an instruction to rename all internal `crm` or `frontDesk` identifiers.
- Continue to verify CRM actions through server auth/RLS/database behavior before declaring completion.

---

### DEC-ATTENDANCE-REFIT-001: Attendance tabs are local client state; actions return typed results
**Status:** ACCEPTED - 2026-07-02

**Decision:**
The CRM Attendance workspace stays on one route, `/crm/attendance`, with a single mounted client workspace. Tabs are local client state mirrored into the URL with `window.history.replaceState()` through shared tab helpers. Routine Attendance mutations return typed `AttendanceActionResult` payloads instead of redirecting to status query params.

**Rationale:**
- Front-desk users need Attendance tabs to feel instant and preserve local filters, selected QR point, selected print format, activation links, and dialogs.
- URL-driven tab switches caused unnecessary route work and made the page feel slow.
- Server Action redirects are control-flow exceptions; using them for normal QR/device/exception/session feedback can surface `NEXT_REDIRECT` and framework internals.
- Typed action results let the client show toasts/notices and update local data without changing the route or reloading the workspace.

**Consequences:**
- Future Attendance tabs should plug into the existing local-state tab helper instead of adding route-level tab pages or router refreshes.
- Use `redirect()` only for true navigation boundaries, not routine in-place mutations.
- Keep backend/scan/RLS behavior authoritative; client local updates are optimistic display synchronization around server-returned results.

---

### DEC-ATTENDANCE-VERIFY-002: Do not fabricate authenticated QR visual QA without a real CRM session
**Status:** ACCEPTED - 2026-07-02

**Decision:**
Final Attendance QR verification may report automated checks as passing, but authenticated visual QA, export interactions, phone scans, and QR identity preservation must remain open until a valid Supabase CRM/front-desk browser session is available. Do not add temporary production-route bypasses or claim QR layout approval from the unauthenticated login redirect.

**Rationale:**
`src/proxy.ts` requires a real Supabase user for protected CRM routes before dev bypass skips staff-record checks. Starting `pnpm dev` with process-local `DEV_AUTH_BYPASS=true` still redirected `/crm/attendance?tab=qr` to `/login`. The task is visual/export verification, so approving it without seeing the protected QR UI would be misleading.

**Consequences:**
- It is acceptable to document the auth blocker with screenshots and console evidence.
- Future QA should reuse a real CRM/front-desk browser session or explicit test credentials, then rerun the requested viewport, interaction, export, scan, and identity checks.
- Avoid app-logic changes whose only purpose is to bypass the protected route for verification.

## DECISION - ATTENDANCE-SCHEDULE-REPAIR-002

**Decision:** Daily Schedule data loading should fail loudly with scoped diagnostics and safe UI/API messages rather than masking query failures as empty schedules.

**Rationale:** The production Daily Timeline console error originally serialized as `{}`, which hid schema/query drift. Carrying `schedule_overrides.shift_type` through the typed query and surfacing query stage errors makes missing columns, RLS issues, or Supabase client failures observable without exposing sensitive details to operators.

**Consequences:**
- Empty daily schedules should only mean no data, not a swallowed query failure.
- API responses stay private/no-store and return a generic error string to the browser.
- Developer diagnostics should include branch/date/query-stage context, with full stacks limited to development.
- `pnpm db:push` and `pnpm db:types` still need to succeed after the local Supabase CLI/pnpm environment is repaired so migration history matches the live schema.

## DECISION - ATTENDANCE-FEED-002

**Decision:** Recent attendance dashboards should read from existing `qr_scan_events` plus linked `staff_shift_checkins`, not from a new attendance-events table or duplicated module.

**Rationale:** `qr_scan_events` is already the append-only audit trail for public QR scan decisions, and `staff_shift_checkins` is the current attendance truth. Reusing those tables preserves existing QR public codes, device activation, scan history, and RLS assumptions while giving CRM/Owner surfaces a live operational feed.

**Consequences:**
- Feed rows deep-link into the existing `/crm/attendance` Records tab.
- `/owner/attendance` is a redirect compatibility route for now, not a separate Owner Attendance module.
- The card must degrade to an unavailable state if the join/API refresh fails rather than taking down Work Queue or Owner overview.

## DECISION - DATABASE-CONNECTION-STABILIZATION-001

**Decision:** Linked Supabase CLI remains the primary database-management path, with project-local CLI wrappers in `scripts/database/` and the transaction pooler kept as a controlled diagnostic/emergency fallback only.

**Rationale:** The project has repeatedly hit stale CLI flags, pnpm execution issues, direct-host connectivity failures, migration-history drift, and pasted DB credentials. A small wrapper layer keeps secrets in git-ignored env files, masks output, avoids global CLI drift, preserves checked-in types on generation failure, and gives future agents consistent doctor/status/verify commands.

**Consequences:**
- Every database change should start with `pnpm db:doctor` and `pnpm db:status`.
- Every migration should end with `pnpm db:types`, `pnpm db:verify`, and normal app checks.
- `SUPABASE_DB_POOLER_URL` is never application runtime config and must not be exposed through `NEXT_PUBLIC_*`.
- Emergency direct SQL requires an approved path such as `psql` with one transaction; ad-hoc SQL executors are not the default workflow.
- Migration history must be reconciled with supported Supabase repair commands after verifying live schema.

## DECISION - ATTENDANCE-DEVICE-REGISTRY-005

**Decision:** Device registry/recovery extends the existing Attendance QR schema instead of introducing parallel attendance/device tables, and recovery token consumption is isolated behind a service-role RPC.

**Rationale:** The live schema already uses `staff_devices`, `device_activation_tokens`, `qr_scan_events`, `staff_shift_checkins`, and `qr_points`; the prompt's older table names are not present. Extending the current model preserves existing QR codes, first-scan registration, service-session scans, RLS assumptions, and device cookies while adding only the missing metadata/recovery fields. A service-role-only RPC keeps one-time recovery consumption atomic and prevents client-side token table access.

**Consequences:**
- Future Attendance device work should reuse `staff_devices` and `device_activation_tokens` with `purpose`/`registration_source` rather than creating new device tables.
- Recovery token previews must not consume tokens on page load.
- Attendance clock-in/out and service scans remain separate from recovery consumption; recovery completion logs an activation audit event only.
- CRM/Owner device registry reads should go through `getAttendanceDeviceRegistry()` so staff without devices and pending recovery links stay visible.

## DECISION - BOOKING-ATTENDANCE-BRANCH-SAFETY-001

**Decision:** Booking availability remains schedule-first; attendance check-ins are an assignment preference only for walk-ins happening today. Attendance QR branch validation uses the scanned QR branch plus the current staff branch as authoritative, while `staff_devices.branch_id` is repairable cached metadata.

**Rationale:** Future, phone, and home-service bookings need planned schedule availability, not live attendance readiness. Same-day walk-ins benefit from preferring checked-in staff, but absence of check-ins should not hide scheduled therapists; the correct operator action is a presence warning. For QR scans, a stale device row can lag behind staff branch changes, so branch blocking must be based on the current staff record and scanned QR UUID, not the cached device branch.

**Consequences:**
- Do not add check-in requirements to `getAvailableSlots*`, public booking, phone booking, future booking, or home-service booking flows.
- Same-day walk-in surfaces may rank checked-in staff first and must fall back to scheduled availability with the explicit warning when no eligible checked-in staff exists.
- Returning QR scans should repair stale active `staff_devices.branch_id` values when current staff branch matches the scanned QR branch.
- True cross-branch scan support needs an explicit staff membership/cross-branch model; absent that model, current `staff.branch_id` remains the authority.

## DECISION - BRANCH-CORRECTION-REQUESTS-001

**Decision:** QR wrong-branch recovery is modeled as requested/scanned-branch correction requests reviewed through a service-role server action/RPC, not as direct staff self-edit or normal cross-branch staff browsing.

**Rationale:** The staff requesting correction may currently belong to the wrong branch, so the front desk of the scanned/requested branch must be able to see the request without getting normal access to all staff in the staff member's current branch. Keeping review authorization keyed to `requested_branch_id` solves that without weakening staff-list access. The RPC remains the only approval path that updates `staff.branch_id`, writes the audit row, and lets the existing device-sync trigger repair active device branch metadata.

**Consequences:**
- Staff can create/cancel their own pending correction request only from a verified staff session or trusted attendance-device scan context.
- CRM/front-desk aliases can review only requests where `requested_branch_id` equals their branch; owner/manager roles can review all.
- Approval must continue to validate that the requested branch is active before changing `staff.branch_id`.
- `staff_devices.branch_id` remains cached metadata repaired by `trg_staff_branch_sync_devices`; it should not become the source of truth for branch authorization.

## DECISION - CRM-BOOKING-HOME-SERVICE-DISTANCE-001

**Decision:** CRM booking availability must use the CRM schedule-first endpoint, and CRM Home Service bookings must use a selected geocoded place plus a server-side distance quote before submit.

**Rationale:** Front desk bookings need planned staff schedule and service assignment availability, not live attendance state or the public booking wizard's generic availability copy. Home Service travel fees require coordinates, so accepting plain text addresses would let bookings bypass distance calculation or store unverifiable pricing data.

**Consequences:**
- Do not route CRM quick-booking availability checks through `/api/booking/available-slots`.
- Attendance/check-in can influence same-day walk-in messaging or ranking, but it must not hide scheduled staff from CRM availability.
- CRM Home Service submissions should require a selected Places result with latitude/longitude.
- Public booking wizard behavior remains separate; shared address-picker code may be reused only without changing the public flow.
- Travel fee remains first 5 km free, then PHP 100 per started extra km, calculated server-side and stored in booking metadata/pricing breakdown.
- `GOOGLE_MAPS_SERVER_API_KEY` enables driving distance; Haversine fallback is acceptable only when surfaced as an estimated quote.

## DECISION - CRM-HOME-SERVICE-LOCATION-FIELD-CLEANUP-001

**Decision:** CRM Home Service should not collect manual city/barangay/landmark/location-note fields when a selected Google Places result is required.

**Rationale:** The Google Places result already provides the address text, place id, coordinates, address components, and map link needed for distance calculation and reporting. Keeping separate manual location fields invites conflicting data and makes it unclear which value is authoritative.

**Consequences:**
- `Service address` is the only required CRM Home Service location field.
- City and barangay are stored only when derived from Google address components.
- Distance calculation must use selected Places coordinates only.
- Access details belong in the optional `home_service_access_note` metadata field and must not affect distance or travel fee.
- Public booking wizard fields remain independent unless a separate public-flow cleanup is explicitly requested.

## DECISION - BRANCH-LOCATION-HOME-SERVICE-ORIGIN-001

**Decision:** Store editable branch Home Service origins on `public.branches`, not in a separate branch settings table.

**Rationale:** The branch row already owns the operational/public address and already had `latitude`/`longitude` from the CRM Home Service distance work. Extending it with Google Places metadata keeps origin lookup simple for distance quotes and avoids introducing a new exposed table/API surface.

**Consequences:**
- Branch service origin fields are `branches.address`, `branches.place_id`, `branches.latitude`, `branches.longitude`, `branches.city`, `branches.barangay`, `branches.maps_embed_url`, and `branches.location_metadata`.
- `branch_booking_rules` remains responsible for Home Service policy values such as free km and extra-km fee.
- CRM Home Service distance should continue resolving origin from selected branch coordinates and destination from customer Places coordinates.
- Public booking wizard behavior remains independent; the shared Places picker can be reused without changing the public flow.

## DECISION - CRM-BOOKING-FOLLOWUP-STABILIZATION-001

**Decision:** CRM booking follow-up, cancel, reschedule, and staff reassignment audit writes use branch-checked server actions with the service-role client instead of granting authenticated INSERT/UPDATE on `booking_events`.

**Rationale:** `booking_events` is the immutable booking history surface and existing migrations intentionally grant authenticated roles SELECT only. Operational CRM users can update bookings through branch-scoped policies, but trigger/audit writes to `booking_events` must not depend on broadening authenticated table grants. Keeping the write path server-side preserves least privilege while allowing CRM actions to annotate status transitions and write same-status operational audit entries.

**Consequences:**
- Do not add authenticated INSERT/UPDATE grants or broad RLS write policies to `booking_events` for front-desk follow-up convenience.
- Status-changing actions should annotate the latest trigger-created event after the booking update.
- Same-status operational actions such as no-answer follow-up, reschedule notes, and staff reassignment may insert a service-role audit row with equal `from_status`/`to_status`.
- Client UI should sanitize raw RLS/policy errors and show operator-safe messages.
- Change Staff preserves the appointment time; Reschedule is the explicit flow that moves date/time.

## DECISION - CRM-PERFORMANCE-OPTIMIZATION-001

**Decision:** During the frozen CRM UI performance pass, prefer measured render/effect optimizations inside existing client workspaces over broad bundle splitting or data-contract rewrites.

**Rationale:** The CRM UI had just completed a freeze sweep, and Bookings still has a known authenticated browser certification blocker. Next.js/Turbopack build artifacts showed broadly similar CRM client-reference manifests, while source audits found clear repeated render/effect work in Today, Bookings, and Dispatch. Render/effect fixes preserve operator behavior with far lower risk than moving modal/tab boundaries or changing live CRM query/cache semantics.

**Consequences:**
- Bundle analyzer setup, dynamic-import refactors, and deeper client/server boundary changes require a separately scoped certification phase.
- Live CRM route caching and Supabase query semantics stay unchanged unless future profiling proves a safe change.
- Frozen UI certification takes priority over payload micro-optimizations when they could disturb mounted modal/tab state.

## DECISION - ATTENDANCE-TODAY-ALIGNMENT-RESET-001

**Decision:** Attendance QR scan intent must be resolved from branch-local time and the current staff schedule before any open `staff_shift_checkins` row is allowed to become a clock-out target.

**Rationale:** Launch-day scans created stale evening clock-ins that caused the old "any open row means clock-out" shortcut to reverse staff attendance across days. Open rows are operational evidence, not sufficient intent. The only safe clock-out target is an open row matching the resolved current shift by staff/branch/test mode plus shift date and shift identity, with legacy generic rows matched only by scheduled-window/actual-clock-in overlap.

**Consequences:**
- Do not reintroduce a scan path that clocks out just because a staff member has any open attendance row.
- Stale or conflicting open rows must create/update Recovery exceptions and then let the current scan continue through the schedule-aware intent engine.
- Resetting next scan state must void only selected interpreted attendance records, preserve raw QR scan events, resolve related exceptions, and write `attendance_corrections` audit history.
- The new `reset_attendance_state` action requires migration `20260712000100_attendance_state_reset.sql` before production use.

## DECISION - ATTENDANCE-AUTONOMY-HARDENING-001

**Decision:** Attendance now has one local authoritative service chain for scan interpretation: QR/device/identity checks remain in `scan-engine.ts`, schedule intent remains in `attendance-intent-engine.ts`, branch-local time and immutable shift identity live in `shift-instance.ts`, next expected action lives in `attendance-state-machine.ts`, device registry reads staff first through `device-registry.ts`, and corrections remain in `attendance-correction-service.ts` until they are moved into transactional RPCs.

**Rationale:** The repository already had a working Attendance engine. A large rewrite into many new files would risk regressing QR scans, room scans, service starts, Recovery, and Owner/CRM Attendance parity. The safer architecture is to extract the missing pure responsibilities first: stable shift instance, branch time/business date, current state machine, deduped Recovery, and staff-first device registry.

**Consequences:**
- `shift_date` plus `shift_type` is no longer sufficient identity for live scans; new writes must capture `shift_instance_key`, `schedule_source`, `schedule_source_id`, `branch_timezone`, `attendance_business_date`, and scheduled start/end.
- Branch timezone and attendance day boundary must come from effective Attendance settings, with `Asia/Manila` only as the default.
- Device Registry must load staff assigned to the branch first, then devices by `staff_id`; stale device branch metadata must not make a staff member appear disconnected.
- Production must not silently hash Attendance device cookies without `ATTENDANCE_DEVICE_SECRET`.
- `qr_scan_events.operation_id` and `operation_result` support app-level same-request replay, but this is not a substitute for the required PostgreSQL transactional scan RPC.
- Multi-step corrections now fail loudly on failed substeps, but all correction mutations still need transactional RPCs before final production closeout.
- Account claim, canonical scan host redirects, rotating challenge, scheduled reconciliation, and real-device QA remain mandatory follow-up before Attendance can be declared closed.

## DECISION - ATTENDANCE-TRANSACTIONAL-COMMIT-001

**Decision:** Keep QR/device/auth/schedule/intent interpretation in TypeScript, but move the final interpreted Attendance scan commit into `public.commit_attendance_scan_transaction(...)`; move selected-record Attendance State Reset into `public.reset_attendance_state_transaction(...)`.

**Rationale:** The TypeScript scan engine already owns public QR routing, trusted-device cookies, branch authorization, schedule resolution, and operator-facing result copy. The risk was the multi-step persistence boundary after intent resolution. A PostgreSQL commit function can lock by request/staff/branch/test mode, replay same-request public results, update/insert the interpreted check-in, write the raw scan event, update/insert a deduped Recovery case, update device seen metadata, and store the public operation result atomically. The reset RPC similarly makes the selected interpreted-row void, linked Recovery resolution, and correction audit a single unit.

**Consequences:**
- New interpreted scan mutation branches should call `commit_attendance_scan_transaction` instead of sequencing check-in, scan-event, exception, and device updates in application code.
- Event-only/noop scan branches can remain lightweight, but retry/concurrency QA must confirm they do not create misleading public results.
- New selected-record reset behavior must call `reset_attendance_state_transaction`; do not reintroduce broad staff-day wipes.
- Manual clock-out, launch recovery, ignore-scan, rule updates, archive-test-data, and future rebuild/manual-attendance actions remain app-level multi-step workflows until their own transactional RPCs exist.
- Supabase migration history is still unreconciled even though linked schema functions/columns are present; production closure must wait for migration-history repair.

## DECISION - CRADLE-BACKEND-STABILIZATION-AND-SCHEDULE-REPAIR-001

**Decision:** Schedule replacement semantics belong in PostgreSQL RPCs, while Schedule Setup keeps the existing `single` / `opening` / `closing` model and explicit UI Split Shift behavior.

**Rationale:** The current app already resolves individual schedules, group fallback, overrides, and booking/availability post-filters around the existing schedule tables. Adding parallel tables or a new shift taxonomy would widen risk. The unsafe boundary was the multi-step save/cleanup path: old active rows could survive after a UI save, and group templates could be partially replaced. Transactional replacement RPCs can lock, authorize, validate the complete 7-day x 3-shift matrix, back up prior active rows, deactivate stale rows, and insert the requested state atomically.

**Consequences:**
- New weekly schedule save paths should prefer `replace_staff_weekly_schedule(...)` or `replace_group_weekly_schedule(...)` over ad hoc table upserts.
- UI ordinary shift toggles remain mutually exclusive; multiple active windows are allowed only through explicit Split Shift intent and must not overlap.
- Conflict-state schedules remain operationally empty for availability, online booking, and recommendations until corrected.
- Manual import and group apply-to-staff remain follow-up work until they use transactional replacement paths.
- Do not auto-resolve ambiguous same-timestamp active schedule overlaps without business confirmation.

**Decision:** Operational staff filtering uses existing live fields (`is_active`, `archived_at`, `merged_into_staff_id`, and `metadata`) instead of adding new `is_test` or `is_schedulable` columns in this repair.

**Rationale:** The linked schema already contains archive/merge columns and JSON metadata, while proposed `is_test` / `is_schedulable` columns do not exist live. Reusing existing fields lets availability exclude archived, merged, test, and explicitly non-schedulable records without forcing a wider staff schema migration during the schedule repair.

**Consequences:**
- Availability provider queries must select archive/merge/metadata fields before applying operational filtering.
- Future duplicate cleanup can set `merged_into_staff_id` and metadata flags without changing the filter contract.
- A future explicit staff status migration can replace the metadata convention only after a broader identity/merge plan is approved.

**Decision:** Do not run a blind Supabase `db push` from this environment until migration-history drift is reconciled.

**Rationale:** Linked schema probes show some local migration effects are already live while `schema_migrations` is behind. Current `pnpm db:doctor` and `pnpm db:status` time out while reading migration history over port 5432. A blind push could replay old SQL into a partially applied schema.

**Consequences:**
- New migration SQL may be rollback dry-run verified through `supabase db query`, but production apply must happen from a working migration-history path.
- After applying the schedule repair migration, regenerate Supabase types and rerun type-check, lint, tests, and build.

## DECISION - CRADLE-INDIVIDUAL-SCHEDULING-SIMPLIFICATION-005

**Decision:** Runtime scheduling must not include group schedule fallback, even as an opt-in resolver compatibility branch.

**Rationale:** The product contract is CRM-entered individual staff schedules. Keeping a group fallback branch in the resolver makes it too easy for a future consumer to accidentally revive automatic effective schedules. Dormant group tables may remain as historical data, but no callable runtime path should produce a group-sourced schedule.

**Consequences:**
- `resolveScheduleForStaffDay` now returns only `override`, `individual`, or `none` sources.
- Group schedule UI, actions, query helpers, and realtime subscriptions were removed.
- Future template support must be a separately scoped explicit workflow that writes reviewed rows into `staff_schedules`; it must not feed runtime availability directly.
- Generated Supabase types may still describe group tables until a safe schema deprecation/drop plan exists.

## DECISION - CRADLE-ADJUST-SCHEDULE-MODAL-003

**Decision:** The Adjust Schedule modal owns one canonical UI draft model and serializes only at the persistence boundary, where UI `regular` maps to database `single`.

**Rationale:** The product needs CRM operators to reason in domain terms while preserving the existing database contract. Keeping the mapping in adapter utilities prevents legacy `single` naming from leaking through the modal and keeps tests focused on the boundary.

**Consequences:**
- Modal components use `opening | regular | closing`; server-action payloads map `regular` to `single`.
- Split shifts are multiple ordered windows, not another shift type.
- Day Off and Not Configured remain distinct states.

**Decision:** Reuse the existing override and blocked-time mutation components inside the new modal, and show an honest empty state for Approved Exceptions.

**Rationale:** The current schema/actions support single-date schedule overrides and blocked time. They do not yet support durable approved exceptions, date-range bulk overrides with weekday filtering, expanded blocked-time reason taxonomy, or override `ends_next_day`. Adding fake UI or a new migration just to match the reference image would create a misleading operational system.

**Consequences:**
- The modal is functional for real weekly saves, single-date overrides, and blocked-time mutations.
- Group controls stay excluded.
- Date range, expanded reasons, durable exceptions, and server-calculated booking-impact acknowledgement are documented follow-ups.

## DECISION - CRADLE-SCHEDULE-UPDATE-INTEGRATION-REPAIR-006

**Decision:** Repair the live `staff_schedules` write contract with a narrow idempotent corrective migration and apply it through `supabase db query --linked --file` when the normal direct Postgres migration-history path times out.

**Rationale:** The production-facing bug was caused by a missing app-called RPC and stale table constraint in the live schema. `pnpm db:push --dry-run` and `pnpm db:status` both timed out on the pooler path, including escalated retries, while the Supabase Management API query path was able to reach and verify the linked database. Applying a single audited migration file through that supported path fixed the live contract without replaying unrelated pending migrations.

**Consequences:**
- Live schedule saves can use `replace_staff_weekly_schedule` immediately.
- The local migration file remains the durable source for the corrective SQL.
- Migration history is still not certified from this environment; future DB work must reconcile `pnpm db:status` before blind pushes.
- App actions classify missing-RPC/stale-constraint/RLS/validation failures with safe structured codes instead of exposing SQL details to operators.

## DECISION - CRADLE-ATTENDANCE-DIAGNOSTICS-AND-SCAN-REPAIR-009

**Decision:** Keep `attendance_exceptions.exception_type` constrained to stable database values and map internal scan/recovery reason codes into those values before persistence.

**Rationale:** The live CHECK constraint correctly prevents arbitrary Recovery categories from leaking into durable attendance data. The scan engine can still preserve operator-specific context by storing the original internal code in JSON metadata, while reports and Recovery queries keep a small stable set of exception classes.

**Consequences:**
- Internal codes such as `missing_schedule`, `off_day_exception`, `ambiguous_scan`, `late_clock_in`, `early_clock_out`, `overtime_clock_out`, `stale_open_checkin`, and `likely_closing_scan_without_clock_in` are not stored directly in `exception_type`.
- Recovery UI reads `metadata.internalExceptionType` when it needs the precise manager-facing label/action.
- Constraint/RLS/RPC failures now surface through safe public scan codes and operation IDs instead of generic Scan Interrupted.
- `staff_shift_checkins.schedule_source` now stores `weekly`, `override`, `recovery`, or `none` for new scans; legacy `weekly_schedule` rows were migrated to `weekly`.
## 2026-07-13 - Failed Attendance attempts remain in `qr_scan_events`

- Keep the existing server-only `qr_scan_events` write path as the failed-scan
  audit source; do not add a duplicate attempt table while it already safely
  records blocked, exception, noop, and error outcomes with operation IDs.
- Attendance Activity must read those safe outcomes without treating them as
  check-ins, and it must retain rows whose staff/device link is intentionally
  null (for example, `unknown_device`).
- Branch-specific Activity day ranges come from
  `attendance_settings.timezone`; browser timezone and UTC midnight are not
  authoritative.
- Device replacement recovery revokes the selected old primary before inserting
  the new primary, inside one transaction, so the one-active-primary invariant
  remains enforced without leaving a staff member device-less on rollback.
