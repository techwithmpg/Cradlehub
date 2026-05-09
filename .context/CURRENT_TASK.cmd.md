# CURRENT TASK: STAFF-BRANCH-001 — Group Staff by Branch (Complete)

## Overview
Small UI/data enhancement to the owner staff management page: both Active Staff and Pending Staff views now group staff under named branch section headings with a count badge.

## Scope
- `src/app/(dashboard)/owner/staff/page.tsx` only.
- No RBAC changes, no auth changes, no schema changes, no booking logic changes.

## Changes Made
- Added `BranchGroup` type.
- Added `groupStaffByBranch(staff: StaffWithBranch[]): BranchGroup[]` helper.
  - Groups by `branch_id` (null → sentinel `"__unassigned__"`).
  - Sorts alphabetically by branch name; "Unassigned Branch" sorted last.
- Fixed `readBranchName` null fallback: "Unknown branch" → "Unassigned Branch".
- Active Staff: replaced inline `groupsMap` block with `groupStaffByBranch`; added count badge to each branch heading.
- Pending Staff: applied `groupStaffByBranch` to `typedPending`; replaced flat "Awaiting Approval" / "Invites Sent" sections with branch-level sections; each row retains "Review & Approve" (claimed) or "Not claimed" (unclaimed) badge.

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 68 app routes.

## Status
Complete. Ready to commit.
