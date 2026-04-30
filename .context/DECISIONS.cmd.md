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
