Task ID: MOBILE-LOADING-001
Description: Add mobile route-change loading line paired with skeleton loading states
Agent: Codex
Status: DONE

Summary:
- Added a mobile navigation progress provider and top route-progress line for shell-owned mobile navigation.
- Wrapped shared floating mobile nav links with `MobileNavLink` so real route taps start progress while current-route taps do not.
- Preserved the driver Profile nav item as a button so opening/closing the Profile sheet does not trigger route progress.
- Mounted one provider/progress pair in each Basic Staff, Therapist, and Driver mobile shell.
- Added driver child-route skeletons for `/driver/dispatch`, `/driver/jobs`, and `/driver/map`.
- Removed an existing inline-styled desktop driver error banner in favor of Tailwind classes.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are not present in this workspace.

Verification:
- pnpm type-check: PASS
- pnpm lint: PASS (0 errors, 2 existing warnings in scripts/generate-service-image-assets.mjs)
- pnpm build: PASS (98 routes)
- git diff --check: PASS with LF/CRLF warnings only
- route smoke: `/driver`, `/driver/dispatch`, `/driver/jobs`, `/driver/map`, `/staff-portal`, `/staff-portal/dispatch`, `/staff-portal/jobs`, `/staff-portal/map`, `/staff-portal/schedule`, and `/staff-portal/service-progress` redirect unauthenticated traffic to `/login` as expected
- in-app browser smoke: tool discovery did not expose a browser navigation/screenshot tool in this turn; authenticated mobile click-through still needs a valid local staff/driver session.
