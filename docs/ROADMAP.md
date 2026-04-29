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
