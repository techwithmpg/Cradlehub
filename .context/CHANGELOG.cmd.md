# 📜 CHANGELOG — What Has Been Done

> APPEND ONLY. Never delete entries. Every agent adds to the bottom.

---

### 2026-04-29 — Codex (Phase 0 initialization)

**Task:** Full CradleHub project scaffold
**Files Changed:**
- `src/` — entire source tree created from scratch
- `supabase/migrations/` — 7 migration files ready for linking
- `.env.local` — environment variables configured
- All config files: tsconfig, prettier, eslint, package.json scripts

**Roadmap Items Completed:** 0.1 → 0.14
**Notes:** Supabase link + type generation happens after this commit (needs keys).
**Build Status:** ✅ Passing
### 2026-04-29 — Codex/Kimi (Sprint 1 — Server Engine)

**Task:** Complete server engine — validations, queries, engine utilities, server actions, API route
**Files Created:**
- `src/lib/validations/booking.ts` — all booking Zod schemas
- `src/lib/validations/staff.ts` — staff, schedule, override, blocked time schemas
- `src/lib/validations/service.ts` — service category, service, branch_service schemas
- `src/lib/validations/branch.ts` — branch schemas
- `src/lib/validations/customer.ts` — customer update + search schemas
- `src/lib/queries/branches.ts` — branch read functions
- `src/lib/queries/services.ts` — service read functions
- `src/lib/queries/staff.ts` — staff read functions
- `src/lib/queries/bookings.ts` — booking read functions
- `src/lib/queries/customers.ts` — customer read functions
- `src/lib/engine/availability.ts` — slot query + seniority assignment + validation
- `src/lib/engine/snapshot.ts` — price + service metadata snapshot
- `src/lib/engine/booking-time.ts` — end_time computation
- `src/app/api/booking/available-slots/route.ts` — public slots API
- `src/app/(public)/book/actions.ts` — online booking server action
- `src/app/(dashboard)/manager/walkin/actions.ts` — walk-in creation
- `src/app/(dashboard)/manager/bookings/actions.ts` — status + edit
- `src/app/(dashboard)/manager/staff/actions.ts` — schedule management
- `src/app/(dashboard)/owner/branches/actions.ts` — branch CRUD
- `src/app/(dashboard)/owner/staff/actions.ts` — staff CRUD + invite
- `src/app/(dashboard)/owner/services/actions.ts` — service + category CRUD
- `src/app/(dashboard)/staff-portal/actions.ts` — read-only own data

**Business rules encoded:**
  RULE 1  Auto-confirm: all bookings created with status='confirmed'
  RULE 2  Any-therapist: seniority assignment (Senior→Mid→Junior, then alpha)
  RULE 3  Cross-branch therapists: no branch filter on therapist pool
  RULE 4  Price snapshot: price_paid + service_name + duration_minutes in metadata
  RULE 5  30-day booking window on online bookings
  RULE 6  Phone required on all booking paths
  RULE 7  Staff-only cancellation: no public cancel route
  RULE 8  All slots returned from API (available + unavailable)
  RULE 9  Home service travel buffer defaults to 30 min
  RULE 10 Manager can edit any booking field, availability re-checked on time/staff/service change

**Build status:** ✅ Passing

### 2026-04-29 — Kimi/Codex (Sprint 2 — Auth + Dashboard Shell)

**Files Created:**
- src/proxy.ts (renamed from middleware.ts)
- src/app/(auth)/layout.tsx
- src/app/(auth)/login/page.tsx
- src/app/(auth)/login/actions.ts
- src/app/(dashboard)/layout.tsx
- src/components/features/dashboard/nav-config.ts
- src/components/features/dashboard/sidebar.tsx
- src/components/features/dashboard/header.tsx
- src/components/features/dashboard/role-badge.tsx
- src/components/features/dashboard/page-header.tsx
- 16 placeholder dashboard pages

**Design system established:**
- Warm charcoal sidebar (#1C1917) + amber accent (#D97706)
- DM Sans typography
- Role badge colors: owner=violet, manager=amber, crm=sky, staff=green

**Build:** ✅ Passing | **Middleware warning:** ✅ Resolved

### 2026-04-29 — Kimi/Codex (Sprint 3 — Owner Workspace)

**Files Created:**
- src/app/(dashboard)/owner/page.tsx (overview dashboard)
- src/app/(dashboard)/owner/branches/page.tsx + new/page.tsx + [branchId]/page.tsx + branch-edit-form.tsx
- src/app/(dashboard)/owner/staff/page.tsx + new/page.tsx
- src/app/(dashboard)/owner/services/page.tsx
- src/app/(dashboard)/owner/bookings/page.tsx
- src/app/api/branches/route.ts
- src/components/features/dashboard/stat-card.tsx
- src/components/features/dashboard/booking-status-badge.tsx
- src/components/features/dashboard/booking-type-badge.tsx
- src/components/features/dashboard/empty-state.tsx

**Build:** ✅ Passing

### 2026-04-29 — Kimi/Codex (Sprint 4 — Manager Workspace)

**Files Created:**
- src/app/(dashboard)/manager/page.tsx (schedule timeline)
- src/app/(dashboard)/manager/walkin/page.tsx
- src/app/(dashboard)/manager/bookings/page.tsx
- src/app/(dashboard)/manager/staff/page.tsx
- src/components/features/dashboard/schedule-timeline.tsx
- src/components/features/dashboard/booking-action-menu.tsx
- src/components/features/dashboard/walkin-form.tsx
- src/components/features/dashboard/schedule-manager.tsx
- src/components/features/dashboard/time-slot-grid.tsx
- src/app/api/manager/context/route.ts
- src/app/api/customers/lookup/route.ts

**Build:** ✅ Passing

### 2026-04-29 — Kimi/Codex (Sprint 5 — CRM Workspace)

**Files Created:**
- src/app/(dashboard)/crm/page.tsx
- src/app/(dashboard)/crm/repeats/page.tsx
- src/app/(dashboard)/crm/lapsed/page.tsx
- src/app/(dashboard)/crm/[customerId]/page.tsx
- src/components/features/dashboard/customer-search.tsx
- src/components/features/dashboard/customer-notes-form.tsx
- src/app/api/customers/search/route.ts

**Build:** ✅ Passing

### 2026-04-29 — Kimi/Codex (Sprint 6 — Staff Portal)

**Files Created:**
- src/app/(dashboard)/staff-portal/page.tsx
- src/app/(dashboard)/staff-portal/week/page.tsx
- src/app/(dashboard)/staff-portal/stats/page.tsx

**Build:** ✅ Passing
