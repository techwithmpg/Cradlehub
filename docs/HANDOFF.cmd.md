# 🤝 HANDOFF — Notes for the Next Agent

> **This file is a letter to the future.**
> **Every agent MUST update this before ending their session.**
> **The next agent reads this FIRST to understand the current state.**

---

## Last Session Summary

| Field              | Value                                                      |
|--------------------|------------------------------------------------------------|
| **Agent**          | Codex                                                     |
| **Date**           | 2026-06-30                                                |
| **Tasks Completed**| CRM stabilization Checkpoint 1 sidebar/nav shell           |
| **Tasks Remaining**| Work Queue simplification, CRM header, Bookings tabs, Schedule split, Customers/Home Service/System Management pages |
| **Build Status**   | `npm run type-check`, `npm run lint`, `npm run build`, and `git diff --check` passed |
| **Mood**           | Sidebar is aligned; the bigger workflow simplification still needs careful steps |

---

## What I Did

**CRM Checkpoint 1:**
- Changed CRM sidebar primary nav to `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`.
- Removed visible primary `Admin & Setup` competition from the CRM nav.
- Added a collapsed bottom `SYSTEM / System Management` section for management-authorized CRM workspace users.
- Linked System Management to the current routes/deep links:
  - Staff & Access: `/crm/staff`
  - Services & Providers: `/crm/setup?tab=services`
  - Rooms & Resources: `/crm/setup?tab=spaces`
  - Booking Rules: `/crm/setup?tab=booking_rules`
  - Schedule Management: `/crm/staff-availability`
  - System Health: `/crm/setup?tab=health`
  - Close Day: `/crm/reconciliation`
- Adjusted CRM background prefetching so only primary daily routes are warmed automatically.

**Preserved:**
- Existing CRM routes and compatibility redirects.
- Existing server actions, mutations, Supabase queries, RLS behavior, and route files.
- Previous shared `getFrontDeskContext()` work.

---

## What's Next

1. Continue with Checkpoint 2: simplify Work Queue by merging the useful Today/Control concepts without deleting `/crm/control`.
2. Keep route compatibility while moving visible labels from Front Desk/Dispatch toward Work Queue/Home Service.
3. Handle CRM header requirements in a dedicated pass: current page title, branch, search, notifications, persistent New Booking, user menu.
4. Before exposing System Management to ordinary CRM/CSR roles, review page gates and action/RLS permissions deliberately.
5. Trace at least one critical CRM action end-to-end before claiming action readiness.

---

## Watch Out For

- The latest prompt says production usable by tomorrow. Favor small, safe, verifiable fixes.
- Do not use service-role from browser code.
- Do not hide controls as a substitute for server-side authorization.
- Do not leave visible buttons that do nothing.
- Do not add a global CRM New Booking button until page-level duplicate buttons are addressed.
- Authenticated CRM browser QA is still missing unless the next agent has a real CRM/front-desk session.
- Package scripts in this repo are `npm run type-check`, `npm run lint`, `npm run build`, and `npm run test`; older docs mention pnpm, but use scripts that actually exist.

---

## Files That Matter Right Now

| File | Why It Matters |
|------|----------------|
| `docs/FRONT_DESK_REFACTOR_PROGRESS.md` | Detailed CRM/front-desk refactor checkpoint and next-pickup log |
| `.context/CURRENT_TASK.cmd.md` | Current active task for repo-standard agent memory |
| `.context/HANDOFF.cmd.md` | Short next-agent pickup note |
| `src/lib/queries/crm-context.ts` | New shared Front Desk/CRM context helper |
| `src/components/features/dashboard/nav-config.ts` | Current sidebar destinations and labels |
| `src/components/features/dashboard/sidebar.tsx` | Collapsed System Management renderer |
| `src/components/features/workspace/workspace-prefetch-config.ts` | CRM automatic route warm-up behavior |
| `src/components/features/crm/crm-tab-nav.tsx` | Still contains overlapping legacy secondary CRM tab routes |

---

## Environment / Setup Notes

- Latest checkpoint used `npm run type-check`, `npm run lint`, `npm run build`, and `git diff --check`; all passed.
- Lint currently has 4 unrelated warnings recorded in `docs/FRONT_DESK_REFACTOR_PROGRESS.md`.

---

## Previous Handoffs (Archive)

_No previous handoffs to archive._
