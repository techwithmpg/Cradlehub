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
