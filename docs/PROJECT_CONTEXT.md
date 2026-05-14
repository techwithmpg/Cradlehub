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
| **Sprint**          | `BOOKING-WIZARD-UX-10.2`  |
| **Completion**      | `Public booking wizard service picker and staff eligibility optimized`        |
| **Last Agent**      | `Codex` |
| **Last Updated**    | `2026-05-14` |
| **Blockers**        | `No build/type blockers; lint has 2 pre-existing warnings in staff onboarding form`      |

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
