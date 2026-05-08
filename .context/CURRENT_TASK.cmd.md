# CURRENT TASK: STABILITY-001 — Workspace Stabilization Audit & Fix Pass

## Overview
Run a workspace-by-workspace stabilization pass for CradleHub / Cradle Massage & Wellness Spa.

This is a stabilization task, not a feature-building task.

## Scope
- Public workflows:
  - `/`
  - `/services`
  - `/branches`
  - `/about`
  - `/contact`
  - `/book`
  - `/staff-onboarding`
- Admin workspaces:
  - `/owner`
  - `/manager`
  - `/crm`
  - `/staff-portal`
- Specialized existing routes:
  - `/driver`
  - `/utility`
  - `/dev`

## Guardrails
- Do not add new features.
- Do not redesign UI unless a layout bug blocks workflow usage.
- Do not change database schema unless absolutely required to fix a broken workflow.
- Do not change auth/routing unless a workspace cannot be accessed correctly.
- Do not create new modules or dependencies.
- Do not rewrite working logic.
- Preserve booking, CRM, staff portal, owner, manager, public flows, RLS, and Supabase booking rules.

## Discovery Completed Before Implementation
- Read required `.context` files and project docs.
- Read local Next.js 16 guidance for App Router, Server/Client Components, Route Handlers, and Proxy.
- Inventoried public, owner, manager, CRM, staff, specialized, auth, and API routes.
- Created workflow inventory and stabilization test checklist in the active thread.

## Initial Route Inventory Risks
- `/manager/today` was not a concrete route; `/manager` serves Manager Today. Fixed with a redirect alias.
- `/staff-portal/today` was not a concrete route; `/staff-portal` serves Staff Today. Fixed with a redirect alias.
- `/driver` and `/utility` exist as owner-only placeholder panels.
- Notification bell mapped driver/utility notification hrefs to missing routes. Fixed to point to the existing panels.
- `docs/ARCHITECTURE.md` referenced `src/middleware.ts`, while this Next.js 16 repo uses `src/proxy.ts`. Fixed.

## Implementation Plan
1. Run baseline static checks:
   - `pnpm lint`
   - `pnpm type-check`
   - `pnpm build`
2. Stabilize blockers in priority order:
   - build/type/lint blockers
   - auth/routing blockers
   - public booking blockers
   - CRM booking blockers
   - owner/manager permission blockers
   - staff visibility blockers
   - notification lifecycle bugs
   - workflow-blocking UI bugs only
3. Run focused static/browser/manual checks for the stabilized workflows.
4. Update context files and commit with a conventional stabilization message.

## Progress
- [x] Read required context and docs.
- [x] Complete no-edit route discovery.
- [x] Produce route inventory, workflow inventory, and stabilization test plan.
- [x] Run baseline lint/type-check/build.
- [x] Fix stabilization blockers only.
- [x] Run final regression checks.
- [x] Update `.context` files and docs.
- [ ] Commit stabilization pass.

## Bugs Fixed
- Public booking success copy now matches the current online-booking behavior: public bookings are received for front-desk review instead of presented as immediately confirmed.
- Notification bell now refreshes the unread badge from the full unread-count query instead of only the limited popover results.
- Driver and utility notification "View all" links now point to existing routes instead of missing `/driver/notifications` and `/utility/notifications` pages.
- Added lightweight redirect aliases for `/manager/today` and `/staff-portal/today` to the existing Today pages.

## Verification
- `pnpm lint`: passing.
- `pnpm type-check`: passing.
- `pnpm test`: passing, 70 tests. Normal sandbox hit the known Vitest `spawn EPERM`; elevated run passed.
- `pnpm build`: passing, 68 app routes.
- Public HTTP route checks on local server: `/`, `/services`, `/branches`, `/about`, `/contact`, `/book`, `/book/confirm`, `/book/success`, `/products`, `/staff-onboarding`, `/login` returned 200.
- Unauthenticated protected route checks returned redirects for owner, manager, CRM, staff, driver, utility, and dev routes.
- `/api/public/booking-context` returned branch/service context and booking rules.
