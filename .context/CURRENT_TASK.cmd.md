# CURRENT TASK: STAFF-UI-001 — Staff Management Workspace Layout Redesign (Complete)

## Overview
Rebuilt the owner Staff Management workspace UI to match the approved dashboard layout direction while preserving existing staff data, invite/edit actions, active/pending logic, and branch grouping.

## Completed
- Replaced the previous inline owner staff list with a focused staff management component set under `src/components/features/staff/`.
- Kept `/owner/staff` as the staff management route and left `/manager/staff` as the staff schedule management route.
- Added premium dashboard layout pieces: title/subtitle, Invite Link and Direct Invite actions, KPI cards, search and filters, Active/Pending tabs, branch-grouped dense staff tables, selected-row state, and right-side profile/quick-action rail.
- Preserved existing action entry points by linking Invite Link, Direct Invite, row profile review/edit, and preview quick actions to the existing `/owner/staff/*` routes.
- Fixed position/tier display so non-service/admin roles no longer show therapist tier text; therapist tier only appears for eligible therapist rows.

## Verification
- `pnpm type-check`: passing
- `pnpm lint`: passing
- `pnpm build`: passing, 68 app routes

## Status
Complete. Ready to commit.
