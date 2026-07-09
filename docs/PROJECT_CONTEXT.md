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
| **Sprint**          | `BRANCH-LOCATION-HOME-SERVICE-ORIGIN-001`  |
| **Completion**      | `Editable branch service origin completed locally; branch Places coordinates feed CRM Home Service distance and verification passes`        |
| **Last Agent**      | `Codex` |
| **Last Updated**    | `2026-07-09` |
| **Blockers**        | `Apply pending Supabase migrations, configure Google Places browser key, and run authenticated owner branch-detail plus CRM Home Service quote QA`      |

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

## Latest Agent Update (2026-06-17)

- Completed `CRM-INDIVIDUAL-SCHEDULE-LIVE-SYNC-001`: CRM individual staff schedule saves now verify Supabase returned rows from `staff_schedules` before reporting success.
- Added a shared effective schedule resolver using priority: date day-off override, date custom override, individual weekly schedule, staff-group fallback, then unscheduled.
- Live Staff now reads resolved `schedule_windows` from the daily schedule query instead of combining an aggregated daily span with a separate raw active `staff_schedules` query.
- Multiple shift windows now display in the Live Staff Staff List as `2 shifts` with each opening/closing time range.
- A saved inactive individual weekly row is treated as an individual day off and no longer falls through to group fallback in Live Staff or booking availability post-filter.
- `/api/crm/availability` and the CRM Live Availability SWR fetch no longer retain short stale cached responses after schedule saves.
- Existing RLS/grants were verified for CRM/CSR operational SELECT/INSERT/UPDATE on `staff_schedules`; no new migration was needed because this upsert flow does not require DELETE.
- Verified `pnpm type-check`, `pnpm test`, `pnpm lint`, `pnpm build`, and the requested swallowed-error scan; authenticated CRM click-through remains a manual QA step.

## Latest Agent Update (2026-06-17)

- Completed `AUTH-RESET-SUPABASE-CONNECTION-001`: self-service and Owner-triggered password recovery now build Supabase reset links from trusted `NEXT_PUBLIC_APP_URL` and land on `/reset-password`.
- Production reset links reject localhost app URLs; local development still falls back to `http://localhost:3000/reset-password`.
- `/reset-password` forwards Supabase recovery `code` or `token_hash` params to `/auth/callback`, which exchanges/verifies the recovery session, sanitizes the next path, and marks the recovery session before the password form renders.
- Password updates require the recovery marker and current Supabase user, apply shared password policy rules, call `auth.updateUser({ password })`, sign out, and return to `/login?passwordUpdated=true`.
- `/login` shows the reset affordance as `Forgot password?` beside the Password label and now displays a post-reset confirmation banner.
- Supabase dashboard follow-up: set Site URL to `https://cradlewellnessliving.com`, add redirect URLs for `http://localhost:3000/reset-password` and `https://cradlewellnessliving.com/reset-password`, and replace any Vercel placeholder with the real deployment URL.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build`, focused auth tests, and requested unsafe scans; only the existing server-only Supabase admin client references `SUPABASE_SERVICE_ROLE_KEY`.

## Latest Agent Update (2026-06-17)

- Deployed `RLS-GROUP-SCHEDULE-RULES-001` to production project `lsrbwqhvzjfpiabeolkv` as migration `20260617123431`.
- Root cause was the legacy `csr` system role missing from the live CRM/CSR group-rule write policy; its same-branch INSERT `WITH CHECK` failed with PostgreSQL `42501`.
- Group-rule RLS now uses explicit authenticated command policies: Owner-wide access, branch-scoped Manager/CRM/front-desk writes, update old/new-row checks, branch-readable staff SELECT, and no anonymous table grants.
- Server upsert/delete actions now independently verify Auth user, active staff role, centralized schedule permission, active target group, and branch ownership before using the normal session client.
- Live rollback-only authorization tests passed 14 cases. Schedule data remained intact at 58 group rules and 401 individual schedules, while daily schedule and booking availability RPCs continued returning data.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm test` (50 files / 519 tests), and `pnpm build` (100 routes). Authenticated browser save is still pending because no CRM/front-desk test session was available.

## Latest Agent Update (2026-06-17)

- Completed `CRM-DAILY-TIMELINE-REPLACEMENT-001`: replaced only the CRM Schedule Daily Timeline tab with the approved role-aware operations board.
- The existing `/crm/schedule` route, module header, URL-driven date/tab state, Live Availability, Schedule Setup, Coverage Issues, and Staff Schedule tabs remain.
- The board reuses resolved schedule windows, overrides, bookings, blocked periods, branch context, and realtime refresh; no database, schedule engine, availability, save, RLS, or authorization behavior changed.
- Added operational staff groups, filters, sticky timeline rows, current-time status, coverage, contextual selection, existing-workflow quick actions, available staff, and daily summary.
- Removed the Daily-only right rail and unreferenced legacy CRM SWR wrapper while retaining shared Owner/Manager schedule components.
- Verified type-check, lint, 51 test files / 525 tests, 100-route production build, and responsive browser QA at 1440x1000 and 390x844. Authenticated live-data visual QA remains a manual follow-up.

## Latest Agent Update (2026-06-17)

- Completed the local code portion of `CRM-AUTHORIZATION-CONSISTENCY-001`: CRM Staff service capability saves now use a transactional SECURITY INVOKER RPC instead of a non-atomic delete-then-insert Server Action sequence.
- Added migration `20260617141348_crm_staff_service_capabilities_rpc.sql` with `replace_staff_service_capabilities`, explicit branch-scoped `staff_services` operational policies, authenticated table grants, and locked-down function execute grants.
- Assignment reads now distinguish query/RLS failure from legitimate empty data and are scoped through active staff in the current branch.
- CRM Staff Management and Service Assignments update local state from the authoritative returned service IDs before route refresh, so the table/editor no longer depend on a timeout or stale props.
- Added `docs/CRM_AUTHORIZATION_INVENTORY.md` for the focused role/RLS/action inventory and documented remaining broader drift candidates.
- Verified `npx tsc --noEmit`, focused assignment-state test, `pnpm lint`, `pnpm test` (52 files / 528 tests), and `pnpm build` (100 routes).
- Live Supabase inspection/application is still pending because `supabase db query --linked` and `supabase db push --linked --dry-run` hung from this environment; apply and verify the migration from a working Supabase connection before marking the live DB work complete.

## Latest Agent Update (2026-06-30)

- Active task is now `CRM-STABILIZATION-HANDOFF-2026-06-30`.
- The latest CRM direction has been logged for future agents: primary daily navigation should move toward `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`; secondary configuration should live under collapsed `System Management`.
- The prior code checkpoint added richer `getFrontDeskContext()` in `src/lib/queries/crm-context.ts` and replaced duplicated CRM context lookups in Today, Bookings, Control, and Live Operations pages.
- The dedicated continuation log is `docs/FRONT_DESK_REFACTOR_PROGRESS.md`.
- `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/CURRENT_TASK.cmd.md`, and `docs/HANDOFF.cmd.md` were updated so agents do not resume stale CRM Coach / observability tasks.
- No source behavior changed in the handoff-only update; last code checkpoint passed `npm run type-check`, `npm run lint`, and `npm run build`.

## Latest Agent Update (2026-06-30)

- Completed `CRM-STABILIZATION-CHECKPOINT-1-NAV-SHELL-2026-06-30`: CRM sidebar primary navigation now shows `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`.
- Added a collapsed bottom `SYSTEM / System Management` section for current management-authorized CRM setup tools.
- System Management links reuse existing CRM routes/deep links and no routes, server actions, Supabase logic, RLS, or database behavior were changed.
- CRM workspace prefetching now warms only primary daily routes automatically; secondary/system routes wait for explicit navigation.
- Verified `npm run type-check`, `npm run lint` (4 unrelated existing warnings), `npm run build`, and `git diff --check`.
- Remaining work: Work Queue/Control consolidation, compact CRM header, duplicate New Booking cleanup, broader system-tool access review, and authenticated action/RLS workflow QA.

## Latest Agent Update (2026-07-02)

- Completed local implementation of `ATTENDANCE-QR-001`: CRM `/crm/attendance`, public `/scan/[publicCode]`, and public `/scan/activate/[token]` are wired.
- Added migration `20260702075213_attendance_qr_system.sql` with QR points, devices, activation tokens, scan events, exceptions, corrections/settings, booking/check-in extensions, RLS/grants, and `complete_due_service_sessions`.
- Applied the migration to the linked Supabase project via `db query --linked --file` and verified live tables, columns, RPC, grants, and policies; migration history may still need reconciliation because this was not a `db push`.
- `pg_cron` is not installed on the linked project, so automatic due-session completion was not scheduled.
- Added `qrcode`/`@types/qrcode`, server-only attendance helpers, CRM actions, QR SVG rendering, device activation cookies, scan engine logic, and focused timing tests.
- Verified `npx tsc --noEmit --pretty false`, `npm run lint` (same 4 unrelated existing warnings), `npx vitest run src/lib/attendance/time.test.ts`, and `npm run build` (104 routes).
- Remaining work: authenticated CRM/browser QA for activation, attendance scans, room/resource session scans, and blocked/revoked/wrong-branch duplicate flows; fix stale `db:types` script separately.

## Latest Agent Update (2026-07-02 - FK Follow-up)

- Fixed Attendance QR creation failing with `qr_points_branch_id_fkey`.
- Root cause was dev bypass returning zero UUID branch `00000000-0000-0000-0000-000000000000` before the Attendance action checked the authenticated staff branch.
- Added `src/lib/dev-bypass-server.ts` to resolve dev bypass to `DEV_BYPASS_BRANCH_ID` when valid, otherwise the first active real branch.
- Attendance actions now prefer the real staff branch and validate branch existence before settings/QR inserts.
- Verified `npx tsc --noEmit --pretty false`, `npm run lint`, and linked DB branch checks; attempted `npm run build` after this fix timed out without a result.

## Latest Agent Update (2026-07-02 - Attendance Refit)

- Completed `ATTENDANCE-REFIT-005`: refit `/crm/attendance` into one compact client-owned operational workspace across Overview, Records, Sessions, QR Codes, Devices, Exceptions, and Reports.
- Tab switching now uses local state plus `window.history.replaceState()`; routine tab changes do not use route links, router refresh/navigation, or redirects.
- Attendance server actions now return typed `AttendanceActionResult` payloads instead of redirecting to status query params, resolving the `NEXT_REDIRECT` symptom for routine QR/device/exception/session mutations.
- Removed Attendance KPI-card rows and rebuilt Overview around live staff, recent scans, active sessions, exceptions requiring attention, and quick actions.
- Reworked QR Codes into a compact selectable QR list plus selected branded preview with print formats, PNG/SVG/print/copy helpers, QR information, generation, and deactivate actions.
- Fixed the CRM Attendance sidebar icon by switching to supported `ClipboardCheck`.
- Added focused helper tests for tab parsing, QR public URL/base URL guards, print SVG layout, and export filenames.
- Verified `npx tsc --noEmit --pretty false`, targeted Attendance Vitest helpers, `npm run lint` (4 unrelated existing warnings), `npm run build` (104 routes), full `npm test -- --run` outside sandbox (60 files / 564 tests), and `git diff --check` (line-ending notices only).
- Browser smoke on the existing local dev server confirmed unauthenticated `/crm/attendance` redirects to `/login`, the login page renders, and no Next/Vite overlay is present. Authenticated CRM Attendance browser QA remains pending.

## Latest Agent Update (2026-07-02 - Attendance Final Verification Continuation)

- Completed the requested final verification cleanup with `pnpm`.
- Fixed all four prior lint warnings:
  - Removed unused `FALLBACK_IMAGE_URL`.
  - Replaced unused `generationPrompt` rest destructuring with explicit app-manifest projection.
  - Preserved payroll mock staff-id signatures with `void staffId` instead of suppressing lint.
- Final checks pass:
  - `pnpm type-check`
  - `pnpm lint` with 0 warnings
  - `pnpm test` (60 files / 564 tests)
  - `pnpm build` (104 app routes)
- Browser QA for `/crm/attendance?tab=qr` remains blocked by missing authenticated Supabase CRM/front-desk session. The route redirects to `/login` at 1440, 1280, 1024, 768, and 375 px; process-local `DEV_AUTH_BYPASS=true` does not bypass `src/proxy.ts`'s real-user requirement.
- Blocker screenshots were captured in `.codex-artifacts/attendance-qr-qa/`.
- Still pending before marking the QR refit fully complete: authenticated QR layout visual QA, real QR interactions, PNG/SVG/print export scans with a phone camera, and QR identity preservation checks before/after preview/export.

## 2026-07-03 - Attendance + Schedule Repair Context

- CRM Schedule Daily Timeline repair is locally complete: contextual error logging, no-store API responses, loud query-stage failures, `schedule_overrides.shift_type` propagation, live SWR refresh wiring, and focused regression tests are in place.
- Live Supabase verification through the transaction pooler confirmed the `schedule_overrides.shift_type` column/check constraint and a successful `get_daily_schedule` call for the active SM branch/date.
- Local app verification passed through type check, lint, focused tests, full Vitest, production build, and diff whitespace checks.
- Deployment is still gated on repairing local pnpm/Supabase CLI behavior so `pnpm db:push` and `pnpm db:types` can reconcile migration history and generated types.
- Rotate the Supabase database password before production deployment because a live password was pasted during troubleshooting.

## Latest Agent Update (2026-07-03 - Attendance Feed/Deep Links)

- Added the reusable live Attendance scan feed to CRM Work Queue and Owner Overview.
- Feed rows use existing `qr_scan_events`/`staff_shift_checkins` data and deep-link into the existing `/crm/attendance` Records tab.
- Added `/api/attendance/recent-scans` for authenticated refresh and Supabase Realtime invalidation.
- Added `/owner/attendance` as a selected-branch owner entry that reuses the existing Attendance workspace to avoid a duplicate Attendance module.
- Owner Attendance tab changes stay on `/owner/attendance` with the selected branch id.
- Records now accepts server-validated `staffId` and `date` filters and highlights the matching row.
- Verified `npx tsc --noEmit --pretty false`, focused helper tests, `npm run lint`, `npm run build`, and `git diff --check`.
- Remaining: authenticated browser QA, first-scan trusted-device sign-in/linking, Staff Portal My Attendance, staff profile attendance history, Supabase CLI/migration-history repair, and database password rotation.

## Latest Agent Update (2026-07-03 - Database Connection Stabilization)

- Added secure reusable Supabase database wrappers under `scripts/database/`.
- Updated package database commands to use `pnpm db:doctor`, `pnpm db:status`, `pnpm db:verify`, `pnpm db:link`, `pnpm db:push`, `pnpm db:types`, and `pnpm db:migration`.
- Added placeholders to `.env.example` only and unignored `.env.example`; local secret files remain ignored.
- Added `docs/DATABASE_CONNECTION_RUNBOOK.md` covering setup, migration push, type generation, verification, troubleshooting, migration-history repair, and emergency pooler fallback.
- Confirmed the direct project-local Supabase CLI shim works at version `2.95.6`; `pnpm exec supabase` remains unreliable in this managed shell.
- Remaining: rotate the exposed database password, populate local git-ignored secrets, rerun DB verification/push/types, and reconcile migration history.

## Latest Agent Update (2026-07-03 - Attendance Device Registry)

- Completed `ATTENDANCE-DEVICE-REGISTRY-005`: extended the existing Attendance QR schema for device registry metadata and one-time recovery links, applied `20260703151111_attendance_device_registry_recovery.sql`, and verified the live migration row/columns/RPC/grant by linked SQL.
- Added typed backend registry/recovery helpers, CRM actions, staff recovery confirmation flow, new attendance-device cookie handling, and focused recovery tests.
- Replaced the Attendance Devices tab with the Device Registry and Recovery Center UI: filters, registry table, pending recovery links, selected-device panel, recovery-link generation, rename, and revoke.
- Recovery link consumption is explicit staff-confirmed behavior and does not clock attendance in/out or start service sessions.
- Verified `pnpm db:types`, `pnpm type-check`, `pnpm lint`, focused recovery tests, full `pnpm test`, `pnpm build`, and `git diff --check`.
- Remaining: authenticated browser QA, real phone recovery scan QA, DB password rotation, and repair of the `pnpm db:status`/`pnpm db:push` port-5432 timeout path.

## Latest Agent Update (2026-07-09 - QR Wrong Branch Correction Requests)

- Completed `BRANCH-CORRECTION-REQUESTS-001`: QR Attendance wrong-branch blocks now expose an actionable correction request path instead of a dead end.
- Found the flow was partially present, then completed missing pieces: returning-scan correction metadata, duplicate-pending UI, CRM Staff Management Branch Corrections tab, secure review/cancel actions, and a dedicated branch-change audit migration.
- Added `supabase/migrations/20260709083908_staff_branch_audit_logs.sql` to create `staff_branch_audit_logs`, add missing request indexes, validate active requested branches on approval, and write audit rows from the review RPC.
- CRM/front-desk users can review only correction requests for their own requested/scanned branch; owner/manager roles can review all. Staff can request/cancel own pending requests but cannot change or approve their own branch.
- Approval updates `staff.branch_id` through the secure RPC and relies on the existing `trg_staff_branch_sync_devices` trigger to sync active `staff_devices.branch_id`.
- Verified focused branch-correction tests (5 files / 16 tests), `pnpm type-check`, `pnpm lint`, and `pnpm build`.
- Remaining: apply pending Supabase migrations, regenerate generated Supabase types if required, and run authenticated CRM/front-desk plus physical QR phone scan QA after deployment.
