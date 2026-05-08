# HANDOFF — STABILITY-001 Workspace Stabilization Pass

## Date
2026-05-09

## Agent
Codex

## Summary
Completed a stabilization audit pass across the public layer and workspace route map. No new product features were added.

## Fixes Applied
- Added `/manager/today` as a redirect alias to `/manager`.
- Added `/staff-portal/today` as a redirect alias to `/staff-portal`.
- Corrected public booking success copy so public online bookings are described as received for front-desk review, matching the pending-online-booking behavior.
- Fixed notification unread count refresh in the header bell so opening the popover does not undercount unread items when more than the limited popover result set exists.
- Changed driver/utility notification "View all" links to existing `/driver` and `/utility` panels.
- Updated `docs/ARCHITECTURE.md` to reference `src/proxy.ts` for Next.js 16.

## Verification Status
- `pnpm lint`: passing.
- `pnpm type-check`: passing.
- `pnpm test`: passing, 70 tests. The sandbox run hit the known Vitest `spawn EPERM`; elevated run passed.
- `pnpm build`: passing, 68 app routes.
- Public HTTP routes checked on a local production server: `/`, `/services`, `/branches`, `/about`, `/contact`, `/book`, `/book/confirm`, `/book/success`, `/products`, `/staff-onboarding`, `/login`.
- Protected unauthenticated routes checked for redirects: owner, manager, CRM, staff portal, driver, utility, and dev routes.

## Remaining Risks
- Authenticated workspace workflows still need role-specific browser testing with real or seeded owner/manager/CRM/staff accounts.
- `/driver` and `/utility` remain placeholder panels by design.
- No database migrations or RLS changes were made during this stabilization pass.
