# 📋 PROJECT CONTEXT — Single Source of Truth

> **⚠️ MANDATORY: Every AI agent MUST read this entire file before doing ANY work.**
> **⚠️ MANDATORY: Every AI agent MUST update this file after completing ANY task.**

---

## 🏗️ Project Identity

| Field              | Value                                      |
|--------------------|---------------------------------------------|
| **Project Name**   | `[PROJECT_NAME]`                           |
| **Codename**       | `[CODENAME]`                               |
| **Version**        | `0.1.0`                                    |
| **Stack**          | Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase |
| **Package Manager**| pnpm                                       |
| **Node Version**   | ≥ 18.17                                    |
| **Author**         | Malcom P. Gwanmesia (MPG Technologies)     |
| **Repo**           | `[REPO_URL]`                               |
| **License**        | Proprietary                                |

---

## 🧭 Project Vision

> **One-liner:** _[Describe what this project does in one sentence]_

> **Problem:** _[What problem does it solve?]_

> **Target Users:** _[Who uses this?]_

> **Success Metric:** _[How do we know it works?]_

---

## 📁 Directory Structure

```
root/
├── .context/                    # 🧠 AI Agent Memory (NEVER delete)
│   ├── CHANGELOG.cmd.md         # What has been done (append-only log)
│   ├── CURRENT_TASK.cmd.md      # What is being worked on RIGHT NOW
│   ├── DECISIONS.cmd.md         # Architecture decisions & rationale
│   ├── ERRORS.cmd.md            # Known bugs, errors, dead-ends
│   └── HANDOFF.cmd.md           # Context for the next agent session
├── docs/                        # Human-readable documentation
│   ├── ARCHITECTURE.md          # System design & data flow
│   ├── API_REFERENCE.md         # API endpoints & contracts
│   └── DB_SCHEMA.md             # Database schema documentation
├── src/
│   ├── app/                     # Next.js App Router pages
│   ├── components/              # Reusable UI components
│   │   ├── ui/                  # shadcn/ui primitives
│   │   └── features/            # Domain-specific components
│   ├── lib/                     # Utilities, helpers, configs
│   │   ├── supabase/            # Supabase client & helpers
│   │   ├── utils/               # Pure utility functions
│   │   └── validations/         # Zod schemas
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   └── constants/               # App-wide constants
├── supabase/
│   └── migrations/              # SQL migrations (sequential)
├── public/                      # Static assets
├── tests/                       # Test files
├── PROJECT_CONTEXT.md           # ← YOU ARE HERE
├── AGENT_RULES.md               # Rules every AI agent must follow
├── ROADMAP.md                   # Development roadmap with progress
├── .env.local                   # Environment variables (git-ignored)
├── .env.example                 # Template for env vars
└── CLAUDE.md                    # Claude Code-specific instructions
```

---

## 🔧 Tech Stack Details

### Frontend
- **Framework:** Next.js 15 (App Router, Server Components by default)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v3 + CSS variables for theming
- **Components:** shadcn/ui (New York style, neutral palette)
- **Forms:** React Hook Form + Zod validation
- **State:** React Server Components first → Zustand only when needed
- **Icons:** Lucide React

### Backend
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email + magic link)
- **Storage:** Supabase Storage (for file uploads)
- **API:** Next.js Route Handlers + Supabase RPC
- **Realtime:** Supabase Realtime (when needed)

### Dev Tools
- **Linting:** ESLint + Prettier
- **Testing:** Vitest + React Testing Library
- **Deployment:** Vercel
- **CI/CD:** GitHub Actions

---

## 📊 Current Status

| Metric              | Value       |
|----------------------|-------------|
| **Phase**           | `Stabilization` |
| **Sprint**          | `OWNER-DASHBOARD-REDESIGN-001`  |
| **Completion**      | `Owner Overview dashboard rebuilt with real data, executive layout, and section-level partial error states`        |
| **Last Agent**      | `Codex` |
| **Last Updated**    | `2026-06-15` |
| **Blockers**        | `No build/type blockers; full Vitest has 2 unrelated booking progress failures in tests/lib/bookings/progress.test.ts`      |

---

## ⚡ Quick Commands

```bash
# Development
pnpm dev                    # Start dev server (localhost:3000)
pnpm build                  # Production build
pnpm lint                   # Run linter
pnpm type-check             # TypeScript check
pnpm test                   # Run tests

# Database
pnpm db:migrate             # Run pending migrations
pnpm db:reset               # Reset database
pnpm db:seed                # Seed with test data
pnpm db:types               # Generate TypeScript types from Supabase

# Codegen
pnpm ui:add [component]     # Add shadcn/ui component
```

---

## 🚨 Critical Rules (Summary)

> Full rules in `AGENT_RULES.md` — these are the non-negotiables:

1. **READ `.context/` files BEFORE any work**
2. **UPDATE `.context/` files AFTER any work**
3. **Never skip the checklist** — see AGENT_RULES.md § Pre-Flight
4. **One task at a time** — finish or document why you stopped
5. **No God components** — if a file exceeds 200 lines, refactor
6. **Server Components by default** — only `'use client'` when you need interactivity
7. **Type everything** — no `any`, no implicit types
8. **Test what matters** — business logic, data transforms, edge cases

---

## Latest Agent Update (2026-05-11)

- Completed `MGR-MOB-001`: added a mobile-first Manager Workspace variant that activates only on mobile breakpoints.
- Desktop `/manager` page preserves the existing `ManagerTodayWorkspace` exactly via responsive `hidden md:block` / `block md:hidden` wrapper.
- Mobile experience includes 5 bottom-nav tabs (Today, Schedule, Bookings, Staff, More) with simplified card-based screens, large touch targets, and spa design tokens.
- Reuses existing data queries (`getTodaysSchedule`, `getDailySchedule`, `getStaffByBranch`, `getPendingStaffByBranch`) without new auth, RLS, or schema changes.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing.

## Latest Agent Update (2026-05-14)

- Completed `NOTIF-001`: added a premium workflow signal foundation with deduped notifications and a new `workflow_tasks` action layer.
- Staff onboarding submission now creates one manager review task and one applicant status update.
- Routine onboarding no longer creates urgent owner notification noise, and CRM receives no HR onboarding notification.
- Manager onboarding review tasks resolve on approval/rejection, and applicant approval/rejection updates are deduped by entity and recipient.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; lint still reports the two pre-existing onboarding-form warnings.

## Latest Agent Update (2026-05-14)

- Completed `BOOKING-WIZARD-UX-10.2`: public booking wizard service selection is now compact and category-based.
- Active `/book` source path uses the modern Places API (New) widget via `google.maps.importLibrary("places")` and `PlaceAutocompleteElement`; no legacy Places Autocomplete usage remains under `src`.
- Public staff selection now filters to real service-provider staff and respects selected service eligibility mappings; drivers, utility, and non-service staff are hidden from specific provider selection.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; `/book` returned `200 OK` from the existing local dev server.

## Latest Agent Update (2026-05-15)

- Completed `STAFF-NICKNAME-001`: added nullable `staff.nickname` via migration and updated local Supabase types.
- Owner/manager staff edit forms and staff onboarding now capture optional nicknames without requiring them.
- Public booking and tracking display nickname first for customer recognition; internal manager/CRM/owner/dispatch surfaces show full name plus nickname.
- Staff search now includes nickname in staff management and related schedule/booking filtering.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; lint still reports the two pre-existing onboarding-form warnings.

## Latest Agent Update (2026-05-15)

- Completed `DISPATCH-LIVE-001`: `/manager/dispatch` now validates the selected date and loads real branch-scoped dispatch data through `getDispatchData()`.
- Active dispatch tabs now render live items, stats, alerts, locations, ETA/location snapshots, and completed/cancelled records instead of mock arrays.
- Removed production dispatch mock data and fake map components, including the unused duplicate prototype dispatch folder.
- Assignment and notification controls are disabled with clear copy until a real selector/action UI is intentionally connected.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; lint still reports the two pre-existing onboarding-form warnings.

## Latest Agent Update (2026-05-20)

- Completed `BOOKING-MOBILE-SERVICE-GRID-001`: patched the public booking wizard service selection step for compact mobile card grids.
- Mobile service cards now stay inside bounded 2/3/4-column responsive grids with compact image, name, duration, price, and selected state.
- Category chips remain horizontally scrollable only inside their own row, and the public booking shell now clips accidental horizontal overflow.
- Booking data loading, category filtering, selected service logic, provider/date/details flow, desktop layout, and the floating circular widget were preserved.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; browser smoke checks covered 360px, 390px, 430px, 520px, 768px, and desktop widths with no document-level horizontal overflow.

## Latest Agent Update (2026-05-20)

- Completed `BOOKING-HOME-SERVICES-001`: public booking home-service services now read the same branch-service source of truth used by admin service management.
- Public booking now preserves branch-scoped `available_home_service`, `available_in_spa`, `visibility`, custom price, and custom duration fields, while dropping inactive base services.
- Visibility updates write to the current `branch_services.visibility` column with legacy fallback, and branch-service cache invalidation expires immediately.
- ESLint and Git now ignore `.codex-artifacts/**` so temporary verification artifacts are not scanned or listed as source files.
- No booking UI, step order, provider/date/payment/confirmation behavior, floating widget, hardcoded services, or dummy data was changed.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; API smoke confirmed 6 Home-eligible public services and 3 non-Home services for the Cradle branch.

## Latest Agent Update (2026-05-20)

- Completed `SCHEDULE-ADJUSTMENT-001`: added manual individual staff availability adjustments inside the existing `/manager/schedule` and `/crm/schedule` Staff view.
- Added shared `adjustStaffScheduleAction` with RBAC, branch-scope checks, target-staff branch validation, date override upsert/delete, blocked-time insert/delete, and route revalidation.
- Added a compact Manual Adjustment section for custom hours, day off, blocked time, clearing overrides, and removing blocks without redesigning the schedule page.
- Daily schedule rows now expose the current date override and real blocked-time IDs so remove actions are precise.
- Existing booking availability/assignment engine was left intact because it already respects `schedule_overrides`, `blocked_times`, weekly `staff_schedules`, and bookings.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; build renders 83 app routes.

## Latest Agent Update (2026-06-06)

- Completed `PUBLIC-MOBILE-LOADING-TRANSITIONS-001`: public mobile loading now has one short first-homepage intro and one thin warm-gold route-loading line for top-level public page navigation.
- Homepage intro uses `sessionStorage` key `cradle_public_intro_seen`, skips desktop/reduced-motion/repeat sessions, and no longer has a full-screen branded root loading bridge before it.
- Root-mounted route progress is allow-listed to `/`, `/services`, `/book`, `/branches`, `/about`, and `/contact`; booking subroutes/steps, external links, hashes, phone/email links, and protected workspaces are ignored.
- Booking logic, APIs, Supabase/database logic, server actions, protected portals, auth/RBAC, and middleware were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, and local public route smoke checks are passing; lint still reports two pre-existing warnings in `scripts/generate-service-image-assets.mjs`.

## Latest Agent Update (2026-06-06)

- Completed `PUBLIC-BOOKING-MOBILE-VIEWPORT-001`: public mobile `/book` now uses a viewport-fitted wizard shell with compact header/progress, internal active-step scrolling, and fixed bottom actions.
- Mobile Date & Time opens a warm dark bottom sheet for available slots after date selection; selecting a time still updates the existing `selectedSlot` state through the current callback path.
- Services now work inside the constrained mobile shell, with category chips and selected summary compact while the service grid scrolls internally.
- Booking logic, step order, validation, slot fetching/API behavior, submit payloads, Supabase/database logic, server actions, protected portals, auth/RBAC, and desktop layout behavior were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, `/book` HTTP 200, and headless Chrome mobile screenshots; lint still reports two pre-existing warnings in `scripts/generate-service-image-assets.mjs`.

## Latest Agent Update (2026-06-07)

- Completed `PUBLIC-PAGES-DARK-THEME-001`: `/services`, `/contact`, `/about`, and `/branches` now use the dark warm Cradle visual system across mobile page components and desktop public sections.
- Shared `ServiceCatalogClient` now uses dark page surfaces, dark glass category/service cards, muted gold borders/actions, and cream text.
- Shared public `SiteHeader` now stays dark in desktop scrolled mode instead of switching to a cream header.
- Mobile Contact/Branches branch data rows now wrap long names/addresses and keep action labels inside the viewport.
- Booking logic, service/branch data behavior, Supabase/database logic, server actions, protected portals, auth/RBAC, APIs, and backend behavior were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, scoped light-surface source scan, production HTTP 200 checks for `/services`, `/contact`, `/about`, `/branches`, and headless Chrome production screenshots; lint still reports two pre-existing warnings in `scripts/generate-service-image-assets.mjs`.

## Latest Agent Update (2026-06-11)

- Completed `UI-MOBILE-PRELOAD-001`: added `MobileFirstVisitPreloader` for the public Cradle experience.
- The preloader is mounted on `/` through `src/app/page.tsx` and on public route-group pages through `src/app/(public)/layout.tsx`.
- It is mobile-only, session-only via `cradle_mobile_preloader_seen`, and uses scoped component keyframes/classes with reduced-motion support.
- The older mobile homepage `CradleBreathReveal` mount was removed so the new preloader is the only public first-visit splash.
- Route progress bars, workspace loaders, skeleton loaders, global loading files, protected portals, booking logic, Supabase/database logic, APIs, server actions, auth/RBAC, and middleware were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, and headless Chrome runtime checks for mobile first visit, repeat session, desktop skip, protected route skip, public navigation skip, and reduced motion.

## Latest Agent Update (2026-06-11)

- Completed `UI-MOBILE-PRELOAD-002`: fixed the public mobile preloader so no-cookie public responses render overlay markup before client hydration or landing-page animations.
- `/` and the public route-group layout now read `await cookies()` for `cradle_mobile_preloader_seen` and pass `initiallyVisible` to `MobileFirstVisitPreloader`.
- Mobile first visits set both the session cookie and sessionStorage fallback to `1`; repeat-cookie visits skip server markup, desktop visits remove the overlay without setting the cookie, and protected routes do not mount or mark it.
- The preloader now uses the approved dark forest, warm gold, and ivory visual treatment with scoped component CSS and a temporary `.sp-public` animation pause guard while visible.
- Route progress bars, workspace loaders, skeleton loaders, global loading files/CSS, protected portals, booking logic, Supabase/database logic, APIs, server actions, auth/RBAC, and middleware were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, raw HTML cookie/no-cookie behavior, and headless Chrome CDP checks for mobile first paint, fade removal, repeat-cookie skip, desktop no-cookie skip, and protected-route isolation.

## Latest Agent Update (2026-06-11)

- Completed `CRM-SCHEDULE-UI-001`: CRM Schedule Daily Timeline now defaults to Fit Day mode so the full active day fits inside the main schedule column while the right rail remains visible.
- Added an Expand/Collapse control beside the density controls; Expanded mode hides the CRM right rail and gives the timeline full page width with horizontal scrolling for detail inspection.
- Timeline range is calculated from staff work hours, current overrides, bookings, and blocked times, with an 8 AM to 11 PM fallback when no active data is available.
- Booking blocks, blocked-time blocks, off-duty overlays, grid lines, hour labels, and the current-time marker now share percent-based full-day positioning.
- Public mobile preloader, public landing page, booking logic, schedule generation logic, Supabase schema/database logic, workspace loaders, and skeleton loaders were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, and a local unauthenticated `/crm/schedule` route probe returning `307 /login`; authenticated visual QA still needs a logged-in CRM session.

## Latest Agent Update (2026-06-15)

- Completed `OWNER-RECONNECT-001`: restored the existing Owner workspace for authorized owner users.
- `/owner` now uses an Owner workspace guard instead of the old soft-pause redirect to `/crm`, while Manager remains soft-paused to CRM.
- Owner role/default navigation now resolves to `/owner`; Owner nav is visible again and no longer exposes `/dev`.
- Owner prefetch no longer warms stale `/owner/settings` or `/dev` routes.
- No Supabase schema, RLS, migration, CRM workflow, Staff Portal, Driver Portal, public booking, scheduling, dispatch, or payroll business logic changes were made.
- Verified `pnpm type-check`, `pnpm lint`, focused Owner workspace tests, production `pnpm build`, service-role/RLS/stale-route scans; full `pnpm test` still has two unrelated booking progress failures.

## Latest Agent Update (2026-06-15)

- Completed `OWNER-DASHBOARD-REDESIGN-001`: rebuilt `/owner` Overview to match the approved Owner Dashboard reference inside the existing Owner shell.
- Added a server-side Owner dashboard loader with real bookings, branches, staff, schedules/check-ins, notifications, workflow tasks, and fixed-monthly payroll data.
- Dashboard sections now show partial error states instead of silently converting failed queries to zero metrics.
- Added pure dashboard business-rule helpers and 13 focused Vitest tests for bookings, completed sessions, paid revenue, active branches/staff, action counts, branch normalization, payroll totals, staff on-shift, auth access, empty data, missing payroll setup, and partial failures.
- No Supabase schema, RLS, migration, global shell, CRM workflow, Staff Portal, Driver Portal, public booking, booking progress, or schedule engine changes were made for the dashboard.
- Verified `pnpm test tests/lib/owner/dashboard.test.ts`, `pnpm type-check`, `pnpm lint`, `pnpm build`, and unauthenticated `/owner -> /login` browser smoke; full `pnpm test` still has two unrelated booking progress failures.
