# 🗺️ ROADMAP — Development Progress Tracker

> **Rule: Agents check off items as they complete them. Never skip ahead.**
> **Rule: If a task is blocked, mark it `🔴 BLOCKED` with a reason.**
> **Rule: Each phase must be 100% complete before moving to the next.**

---

## Status Legend

| Icon | Meaning |
|------|---------|
| ⬜ | Not started |
| 🟡 | In progress |
| ✅ | Completed |
| 🔴 | Blocked |
| ⏭️ | Skipped (with documented reason) |

---

## Phase 0: Project Bootstrap `[STATUS: ⬜]`

> **Goal:** Repo exists, runs, and every developer/agent can start working immediately.

- [ ] `0.1` Initialize Next.js 15 project with TypeScript + pnpm
- [ ] `0.2` Configure Tailwind CSS + CSS variables for theming
- [ ] `0.3` Install and configure shadcn/ui (New York style)
- [ ] `0.4` Set up project directory structure (src/ organization)
- [ ] `0.5` Configure ESLint + Prettier with project rules
- [ ] `0.6` Set up path aliases (`@/` → `src/`)
- [ ] `0.7` Create `.env.example` with all required variables
- [ ] `0.8` Set up Supabase project + local dev (supabase init)
- [ ] `0.9` Create Supabase client utilities (server + client + middleware)
- [ ] `0.10` Create `.context/` directory with all .cmd.md template files
- [ ] `0.11` Create base layout (root layout + metadata)
- [ ] `0.12` Create error.tsx + loading.tsx + not-found.tsx at root
- [ ] `0.13` Verify `pnpm build` passes with zero errors
- [ ] `0.14` First git commit: "chore: initialize project with full scaffold"

**Phase 0 Completion:** `___/14 tasks` | **Date Completed:** `_________`

---

## Phase 1: Authentication & Core Layout `[STATUS: ⬜]`

> **Goal:** Users can sign up, log in, and see a responsive shell layout.

- [ ] `1.1` Design database schema for users/profiles (migration 001)
- [ ] `1.2` Implement Supabase Auth (email + password)
- [ ] `1.3` Create auth pages (login, register, forgot-password)
- [ ] `1.4` Set up middleware for route protection
- [ ] `1.5` Build app shell layout (sidebar + header + main content area)
- [ ] `1.6` Implement responsive sidebar (collapsible on mobile)
- [ ] `1.7` Create user profile dropdown (avatar, name, logout)
- [ ] `1.8` Add role-based route guards
- [ ] `1.9` Create onboarding flow for first-time users
- [ ] `1.10` Write tests for auth flow + middleware

**Phase 1 Completion:** `___/10 tasks` | **Date Completed:** `_________`

---

## Phase 2: Core Data Models & CRUD `[STATUS: ⬜]`

> **Goal:** Primary entities exist in the database with full CRUD operations.

- [ ] `2.1` Design core entity schemas (migrations 002-00x)
- [ ] `2.2` Generate TypeScript types from Supabase schema
- [ ] `2.3` Create Zod validation schemas for all entities
- [ ] `2.4` Build reusable data table component (sorting, filtering, pagination)
- [ ] `2.5` Implement create/edit forms with React Hook Form + Zod
- [ ] `2.6` Create Server Actions for all CRUD operations
- [ ] `2.7` Add optimistic UI updates for mutations
- [ ] `2.8` Implement soft delete pattern
- [ ] `2.9` Add search and filter functionality
- [ ] `2.10` Write tests for validations + server actions

**Phase 2 Completion:** `___/10 tasks` | **Date Completed:** `_________`

---

## Phase 3: Business Logic & Features `[STATUS: ⬜]`

> **Goal:** Domain-specific features that make the app valuable.

- [ ] `3.1` _[Define feature 1]_
- [ ] `3.2` _[Define feature 2]_
- [ ] `3.3` _[Define feature 3]_
- [ ] `3.4` _[Define feature 4]_
- [ ] `3.5` _[Define feature 5]_

**Phase 3 Completion:** `___/5 tasks` | **Date Completed:** `_________`

---

## Phase 4: Dashboard & Analytics `[STATUS: ⬜]`

> **Goal:** Users can see meaningful insights and summaries.

- [ ] `4.1` Design dashboard layout with stat cards
- [ ] `4.2` Implement data aggregation queries (RPC functions)
- [ ] `4.3` Build chart components (Recharts integration)
- [ ] `4.4` Add recent activity feed
- [ ] `4.5` Create role-specific dashboard views
- [ ] `4.6` Add date range filtering for analytics
- [ ] `4.7` Implement data export (CSV/PDF)

**Phase 4 Completion:** `___/7 tasks` | **Date Completed:** `_________`

---

## Phase 5: Polish & Production `[STATUS: ⬜]`

> **Goal:** Production-ready — performant, accessible, documented.

- [ ] `5.1` Accessibility audit (keyboard nav, ARIA labels, contrast)
- [ ] `5.2` Performance optimization (lazy loading, image optimization)
- [ ] `5.3` SEO metadata for all public pages
- [ ] `5.4` Error boundary coverage for all route segments
- [ ] `5.5` Loading state coverage for all route segments
- [ ] `5.6` Mobile responsiveness audit (all breakpoints)
- [ ] `5.7` API documentation
- [ ] `5.8` User-facing documentation / help pages
- [ ] `5.9` Set up Vercel deployment + environment variables
- [ ] `5.10` Final QA pass — test all user flows end-to-end

**Phase 5 Completion:** `___/10 tasks` | **Date Completed:** `_________`

---

## 📈 Overall Progress

| Phase | Status | Tasks | Done | % |
|-------|--------|-------|------|---|
| Phase 0: Bootstrap | ⬜ | 14 | 0 | 0% |
| Phase 1: Auth & Layout | ⬜ | 10 | 0 | 0% |
| Phase 2: Core CRUD | ⬜ | 10 | 0 | 0% |
| Phase 3: Features | ⬜ | 5 | 0 | 0% |
| Phase 4: Dashboard | ⬜ | 7 | 0 | 0% |
| Phase 5: Polish | ⬜ | 10 | 0 | 0% |
| **TOTAL** | | **56** | **0** | **0%** |

---

## 📝 Roadmap Change Log

| Date | Change | Reason | Agent |
|------|--------|--------|-------|
| _[DATE]_ | Initial roadmap created | Project kickoff | Human |
| 2026-05-01 | Added CSR Head/CSR Staff RBAC completion note (CRM workspace only, no separate CSR workspace) | Align workspace access with front-desk org structure and server-side permission enforcement | Codex |
| 2026-05-01 | Logged STAFF-005 mobile accordion/day-card refinement for `/staff-portal/week` | Track focused mobile planner UX/accessibility improvements and verification run | Codex |
| 2026-05-09 | Logged STABILITY-001 workspace stabilization audit and blocker fixes | Stabilize route aliases, notification count behavior, public booking status copy, and Next.js 16 proxy documentation before broader client/staff testing | Codex |
| 2026-05-09 | Logged STAFF-UI-001 staff management workspace redesign | Track the owner staff dashboard rebuild with branch-grouped tables, filters, KPI cards, and selected staff preview rail | Codex |
| 2026-05-09 | Logged STAFF-UI-002 staff display normalization and compact profile panel | Track shared staff metadata helper usage, tier eligibility safeguards, branch-column removal, and profile panel compacting | Codex |
| 2026-05-10 | Logged BK-WS-002 shared bookings workspace polish | Track simplified booking detail actions, compact row action menu, table pagination, and fixed compact columns across Owner/Manager/CRM | Codex |
| 2026-05-11 | Logged MGR-MOB-001 mobile manager workspace | Track mobile-first manager variant with bottom nav, simplified card screens, and preserved desktop behavior | Kimi |
| 2026-05-13 | Logged STAFF-ORG-001 staff organization/access model fix | Track full staff edit role/function separation, driver/utility/service role exposure, manager-safe RBAC, and conditional service capability behavior | Codex |
| 2026-05-14 | Logged NOTIF-001 premium workflow signal foundation | Track deduped workflow task layer, staff onboarding routing cleanup, manager attention strip, and quiet bell grouping | Codex |
| 2026-05-14 | Logged BOOKING-WIZARD-UX-10.2 public booking wizard optimization | Track modern Places-only active booking path, compact category service picker, and qualified service-provider staff filtering | Codex |
| 2026-05-15 | Logged STAFF-NICKNAME-001 staff/therapist nicknames | Track optional `staff.nickname`, public nickname-first booking display, and internal full-name-plus-nickname manager/CRM/owner displays | Codex |
| 2026-05-15 | Logged DISPATCH-LIVE-001 manager dispatch live data wiring | Remove production mock dispatch data and connect `/manager/dispatch` to real branch-scoped Supabase dispatch query data | Codex |
| 2026-05-20 | Logged BOOKING-MOBILE-SERVICE-GRID-001 mobile service grid patch | Keep public booking service cards compact on mobile, preserve desktop, and verify no page-level horizontal overflow | Codex |
| 2026-05-20 | Logged BOOKING-HOME-SERVICES-001 public home-service availability fix | Align public booking service reads with admin branch-service Home/Public settings and preserve branch custom price/duration | Codex |
| 2026-05-21 | Logged CRM-OPS-002E Schedule Setup universal group UI redesign | Redesign `/crm/staff-availability` with tabbed workspace, group cards, universal rules panel, weekly pattern matrix, right rail, and preserved individual schedule editor | Claude Code |
| 2026-05-21 | Logged CRM-OPS-002E-A Individual Adjustments UI polish | Stat strip, filter pills, cleaner table, status chips, colored avatars, improved Manage button | Claude Code |
| 2026-05-21 | Logged CRM-OPS-002E-B Manage Individual Schedule modal redesign | Redesign sheet header, tabs, weekly hours editor, overrides editor, block time editor with warm cards, status chips, and cleaner forms | Claude Code |
| 2026-06-06 | Logged PUBLIC-MOBILE-LOADING-TRANSITIONS-001 public mobile loading transitions | Track one-session homepage intro, public top route line, and removal of the root full-screen loading bridge from public first load | Codex |
| 2026-06-06 | Logged PUBLIC-BOOKING-MOBILE-VIEWPORT-001 public booking mobile viewport wizard | Track viewport-fitted `/book` shell, internal step scrolling, fixed bottom actions, compact mobile steps, and mobile Date & Time bottom sheet | Codex |
