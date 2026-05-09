# HANDOFF — STAFF-BRANCH-001 Group Staff by Branch

## Date
2026-05-09

## Agent
Codex

## Summary
Small UI enhancement to the owner staff management page. Active Staff and Pending Staff views now group staff under named branch section headings, each with a count badge. No schema, auth, RBAC, or booking logic was changed.

## Changes Applied
- `src/app/(dashboard)/owner/staff/page.tsx`:
  - Added `BranchGroup` type and `groupStaffByBranch` helper (alphabetical sort, "Unassigned Branch" last).
  - Fixed `readBranchName` null fallback from "Unknown branch" to "Unassigned Branch".
  - Active Staff: replaced inline groupsMap with `groupStaffByBranch`; branch headings now include a count badge.
  - Pending Staff: applied `groupStaffByBranch`; replaced flat "Awaiting Approval" / "Invites Sent" sections with branch-level sections; claimed rows show "Review & Approve", unclaimed rows show "Not claimed".

## Verification Status
- `pnpm lint`: passing.
- `pnpm type-check`: passing.
- `pnpm build`: passing, 68 app routes.

## Remaining Risks
- Manager staff page (`/manager/staff`) is a schedule management view scoped to the manager's own branch — no branch grouping needed there.
- RBAC audit findings (assistant_manager/store_manager migration conflict) remain unaddressed — separate task.
- No database migrations or RLS changes were made.
