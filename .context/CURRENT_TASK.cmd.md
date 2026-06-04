Task ID: DRIVER-TRIPS-MOBILE-001
Description: Build polished mobile-first Driver Trips page UI
Agent: Codex
Status: DONE

Summary:
- Added a dedicated Driver Trips component set under `src/components/features/staff-portal/driver/trips/`.
- Wired mobile `/driver/dispatch` and driver-mode `/staff-portal/dispatch` to show Trips UI while preserving existing desktop dispatch workspace.
- Replaced visible driver mobile page copy with Trips/Trip/Jobs naming and kept internal dispatch route/action names unchanged.

Verification:
- pnpm type-check: PASS
- pnpm lint: PASS (0 errors, 2 existing warnings in scripts/generate-service-image-assets.mjs)
- pnpm build: PASS (96 routes)
- route smoke: `/driver/dispatch` and `/staff-portal/dispatch` redirect unauthenticated traffic to `/login` as expected
