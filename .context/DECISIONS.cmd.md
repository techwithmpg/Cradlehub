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
**Status:** ACCEPTED — 2026-05-28

**Decision:**
Owner and Manager workspaces are soft-paused for MVP. CRM is the main admin/operations command center.
- owner, manager, assistant_manager, store_manager → routed to /crm on login and on direct URL visit
- /owner/* and /manager/* routes all redirect to /crm via layout.tsx
- Owner and Manager page files remain intact for later restoration
- Active workspaces for MVP: CRM, Staff Portal, Driver, Public Booking

**Rationale:**
- CRM already has all the operational tools needed to run the business (bookings, schedule, dispatch, customers, services, availability, staff management).
- Owner and Manager workspaces overlap heavily with CRM but are less polished and need dedicated attention.
- Soft-pausing avoids confusion from two near-identical workspaces during early operations.
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
