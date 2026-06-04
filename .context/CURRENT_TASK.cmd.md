Task ID: DRIVER-MAP-001
Description: Build premium mobile Route Map page for driver portal
Agent: Codex
Status: DONE

Summary:
- Added a dedicated driver Route Map component set under `src/components/features/staff-portal/driver/map/`.
- Rewired `/staff-portal/map` to the new Route Map UI and added `/driver/map` for the standalone Driver portal.
- Updated the driver mobile bottom nav so the standalone Driver portal now has a real `Map` tab instead of the old `Schedule` placeholder.
- Removed the old inline-styled route map/card components.

Verification:
- pnpm type-check: PASS
- pnpm lint: PASS (0 errors, 2 existing warnings in scripts/generate-service-image-assets.mjs)
- pnpm build: PASS (97 routes)
- git diff --check: PASS with LF/CRLF warnings only
- route smoke: `/staff-portal/map`, `/driver/map`, and `/driver/dispatch` redirect unauthenticated traffic to `/login` as expected

Notes:
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were requested for preflight but are not present in this workspace.
- Tool discovery did not expose an in-app browser screenshot tool in this turn, so authenticated mobile visual QA still needs a valid local driver session.
