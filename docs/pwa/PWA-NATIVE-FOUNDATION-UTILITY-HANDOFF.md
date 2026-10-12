# Staff PWA native Utility workspace handoff

**Status: implementation complete for the supported room-turnover workflow; independent review required. Release evidence remains incomplete.** This local branch is not merged or deployed.

## Authority and baseline

- Owner brief: “CRADLEHUB STAFF PWA — SHARED NATIVE FOUNDATION + UTILITY ROLE IMPLEMENTATION” and the supplied Utility / Housekeeping mobile concept image. It authorizes Utility only, building on the Provider-first native foundation.
- Accepted `origin/main`: `3f8f4067c4c9e0e3e2122b97d4d0694fac0dbb20` (fetched and checked 2026-10-12). Provider review parent: `2d5efae9ee1b3a8e323a53cd7556c85238a78b60`. Local branch: `stage/staff-pwa-native-foundation-utility`; implementation commit: `b922753`. The final branch HEAD includes this handoff.
- The branch descends from accepted main through the unmerged Provider branch. Review and acceptance of Provider PR #19 remain a dependency; this Utility branch is not an independent release candidate.
- Database target for build and local HTTP checks: **LOCAL** placeholders only, with no available database. **PRODUCTION** was not accessed or mutated. No deployment was made.

## Implemented surfaces and authority

| Surface                | Route and source                                                                                           | Result                                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home / Today           | `/staff/utility`; existing staff identity, branch-scoped room-turnover tasks, optional attendance snapshot | Native home with real waiting/in-progress counts, bounded recent-ready count, current rooms, task entry and clearly labeled attendance scan. Query failures are visible rather than false zeroes. |
| Tasks                  | `/staff/utility/work`; `workflow_tasks` room-turnover records                                              | All / Waiting / Active / Ready filters, task rows, recent completed items and safe remembered filter.                                                                                             |
| Task detail / progress | `/staff/utility/work/[taskId]`; existing `startRoomCleaningAction` and `markRoomReadyAction`               | Branch-scoped detail, start action, teammate ownership notice, explicit ready confirmation, server result feedback and refresh/invalidation.                                                      |
| Rooms                  | `/staff/utility/rooms`; same turnover data                                                                 | Room overview deduplicated by resource, active state preferred over older completion, with status filters and detail links.                                                                       |
| More / Profile         | `/staff/utility/more`; existing profile, attendance and notices routes                                     | Native More surface with supported links and in-scope sign-out redirect.                                                                                                                          |
| Scan                   | `/staff/scan`; existing Staff scanner                                                                      | Existing attendance/public-code behavior preserved and labeled as attendance. No room QR task-start claim.                                                                                        |

The existing `/staff/utility/notices` route remains available. Shared Staff canvas, bottom navigation and loading/safe-memory patterns now include Utility. Server role and branch checks remain authoritative. Only small count summaries and UI filter choices enter five-minute, identity-keyed in-memory state; no names, notes, QR payloads or mutation queue are persisted. Successful room mutations revalidate affected routes and invalidate Utility summaries.

## Repository-supported scope and concept gaps

The repository supports branch-scoped `room_turnover` tasks and the existing open → in-progress → completed actions. The task list describes all visible branch turnover work; it does not assert that every task is assigned to the signed-in worker. A task already claimed by another worker has no ready action in the detail UI; the server also enforces ownership.

The supplied concept's checklist item progress, task notes, manual room code, QR room-task start, facility-task execution, supply requests, laundry, common-area work and performance screens have no verified Utility contract here. They were not fabricated or wired to unrelated workflows. Completed history is bounded to the latest 30 tasks in the last seven days, so “Recent ready” is not an all-time total. Room/floor images and sample personnel in the concept are design references, not production data.

## Verification actually performed

- **251 tests / 22 files passed**, covering affected PWA, Utility queries/actions/UI, auth/role routing, scanner shell, attendance and safe-memory behavior. Historical `.claude` worktrees were excluded.
- Type-check: PASS. Scoped ESLint on changed files: PASS except the pre-existing `no-explicit-any` warnings in `utility-room-turnover.test.ts`; that test passes lint when only that legacy rule is disabled. Scoped Prettier: PASS. `git diff --check`: PASS.
- Optimized production build with **LOCAL** placeholder services: PASS. New Utility routes were generated.
- Read-only **LOCAL** HTTP: `/staff` 308 → `/staff/`; unauthenticated `/staff/` and Utility Home, Tasks, Rooms and More each 307 → `/staff/login`; `/staff/login` and `/manifest-staff.webmanifest` returned 200. No authenticated database-backed request was made.
- Manifest, `/staff/` start URL and scope, proxy, login actions, scanner implementation, service worker, schema/migrations, RLS, booking and payment logic were not changed in this Utility branch.

## Evidence limits, review and next action

- **Authenticated Utility browser and physical-device verification: NOT VERIFIED.** There is no authorized safe TEST/STAGING Utility identity or database for route-by-route visual, mutation, performance or installed-PWA checks. The local HTTP redirects prove unauthenticated guard behavior only. No no-overflow or native-feel result is claimed for authenticated Utility screens.
- **Scanner round trip memory on a device: NOT VERIFIED.** The scanner intentionally uses full-document navigation for camera permissions. Component tests show memory retention during an in-shell pathname change; a real scanner navigation can remount and clear in-memory summaries. Server data remains authoritative.
- Independent code review should check branch/role isolation, action ownership, the distinction between branch work and assigned work, identity reset, cache invalidation, narrow-screen UI and the existing scanner handoff. With an authorized TEST/STAGING account, then verify Home → Tasks → detail → Rooms → More, task transitions, sign-out, scan return, viewport fit and background refresh. Reconcile this branch with the accepted Provider result and current `origin/main` before any future merge proposal.
- Next permitted action: review this local branch and obtain safe non-production runtime evidence. No push, merge, production deployment, production database mutation, Member Portal, Driver or CRM implementation is authorized by this handoff. Since the branch is unmerged, rollback is simply to leave or discard it.
