Task ID: MOBILE-NAV-001
Description: Build persistent floating glass mobile bottom navbar for staff, therapist, and driver portals
Agent: Codex
Status: DONE

Summary:
- Added a shared floating glass mobile bottom nav component.
- Moved Staff, Therapist, Driver Staff Portal, and standalone Driver mobile nav ownership into layout shells.
- Removed duplicate fixed nav renders and page-level bottom padding from mobile pages.

Verification:
- pnpm type-check: PASS
- pnpm lint: PASS (0 errors, 2 existing warnings in scripts/generate-service-image-assets.mjs)
- pnpm build: PASS (96 routes)
