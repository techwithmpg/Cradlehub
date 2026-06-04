Task ID: DRIVER-JOBS-001
Description: Build premium mobile Jobs page and wire it to the driver floating navbar center button
Agent: Codex
Status: DONE

Summary:
- Added a dedicated Driver Jobs component set under `src/components/features/staff-portal/driver/jobs/`.
- Rewired `/staff-portal/jobs` to the new premium Jobs page.
- Added `/driver/jobs` and `/driver/jobs/[bookingId]` for the standalone Driver portal.
- Updated the driver floating nav center action to label `Jobs` and route to `/staff-portal/jobs` or `/driver/jobs` depending on context.
- Updated standalone driver Trips/Map details links to use `/driver/jobs`.
- Removed the old inline-styled driver jobs list/card implementation.

Verification:
- pnpm type-check: PASS
- pnpm lint: PASS (0 errors, 2 existing warnings in scripts/generate-service-image-assets.mjs)
- pnpm build: PASS (98 routes)
- git diff --check: PASS with LF/CRLF warnings only
- route smoke: `/driver/jobs`, `/staff-portal/jobs`, and `/driver/dispatch` redirect unauthenticated traffic to `/login` as expected

Notes:
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were requested for preflight but are not present in this workspace.
- Authenticated mobile visual QA still needs a valid local driver session.
