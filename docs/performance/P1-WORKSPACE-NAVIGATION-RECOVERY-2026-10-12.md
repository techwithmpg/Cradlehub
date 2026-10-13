# P1 workspace navigation recovery and review handoff

Date: 2026-10-12 (Asia/Singapore)
Status: **CORRECTION REQUIRED before acceptance**; draft PR #17 is ready for independent source review, with authenticated browser and performance certification outstanding.

## Authority and branch state

- Latest owner instruction: recover and finish only the interrupted P1 Workspace Navigation Performance + Smart Retention Correction. No merge, main push, production deployment, migration, or production mutation is authorized.
- Authorized base and verified GitHub `main`: `0f157657f78b13f1752ea89f9812c3df9cbd975f`.
- Starting local branch `fix/p1-workspace-navigation-retention`: HEAD at the base, 16 modified tracked files, no staged files, and two untracked files. It had no P1 commits.
- Starting remote branch: `88c3aaef92754a9eb0339d45d19c69d9b19ba0f5`, 32 commits ahead of the base, with draft [PR #17](https://github.com/techwithmpg/Cradlehub/pull/17). The remote and local drafts overlap but differ materially.
- The original local checkout and all its uncommitted files remain untouched. Recovery continued from the remote branch in isolated local branch `fix/p1-workspace-navigation-retention-reconcile`. Code/test correction commit: `5fb564d7e5866785a84050b66f227866f7663a6b`.
- No production database target was identified or contacted. The build used inert `build-only.invalid` Supabase values. **Production impact: none from this recovery.**

## Interruption checkpoint

- **Previous agent last verified completed step:** no recorded P1 test or browser result was found for the local draft. The latest locally created P1 artifact was `tests/lib/navigation/workspace-retention-coverage.test.ts` at 06:50 local file time.
- **Previous agent last local commit:** none after the authorized base. Remote work separately reached `88c3aaef`.
- **Uncommitted work:** yes, 16 tracked files and two untracked files; the production operations audit is outside P1 and remains untouched.
- **First unfinished original requirement:** a current-base cold/warm navigation baseline and authenticated before/after measurements. The local draft also had an outdated rollout test.
- **Known failed check at recovery:** local focused Vitest: 3 failures/64 tests, including `src/lib/config/mvp-flags.test.ts` expecting CRM-only while the local draft returned `all`; two duplicate failures came from a nested `.claude` worktree discovered by Vitest. Local typecheck passed.
- **Known unverified checks:** authenticated CRM/Owner browser flow, prefetch contribution, RSC/server timing, memory, cold/fresh/stale/dirty usable timing, Back/Forward, deep link/reload, and production behavior.

## Recovered local work classification

| Local change | Classification | Decision |
| --- | --- | --- |
| CRM Cash Flow and Dispatch page wrappers | COMPLETE in remote | Remote already contains equivalent wrappers. |
| Owner Attendance, Bookings, Cash Flow, and Schedule page wrappers | COMPLETE in remote | Remote also retains Owner Dispatch. |
| CRM Staff and Owner Staff wrappers | PARTIAL / UNVERIFIED | No measured memory or stale refresh evidence; not carried into the bounded remote rollout. |
| Bookings viewport and loader change | PARTIAL / UNVERIFIED | No browser comparison; preserved in original local checkout. |
| Retained provider state labels, bootstrap suppression, and 180 ms feedback | PARTIAL | Remote already delays feedback and suppresses normal retained bootstrap; local module-only suppression could hide the first loader for a different Owner branch. Not carried over. |
| Retention policy 6 CRM / 5 Owner limit and generic branch key | INCORRECT for this review | Raised memory bounds without measurement and replaced per-route Owner scope parameters. Remote retains 4/3 and route-specific branch scope. |
| Prefetch policy edits | UNVERIFIED | No prefetch contribution measurements; not carried over. |
| Rollout default change | PARTIAL / INCORRECT | Remote already defaults to `all` and keeps invalid values CRM-only. Local invalid values also enabled Owner and failed the existing test. |
| Quick Booking request cache | UNVERIFIED | Remote removes a duplicate CRM layout context lookup; the additional local cache was not proven necessary. Modal behavior needs authenticated QA. |
| Local provider and route coverage tests | PARTIAL | Recovered the missing stale-return, Owner branch switch, and primary module coverage assertions into the remote-based test suite. |
| Untracked production operations audit | NOT APPLICABLE | Separate earlier evidence; preserved untouched in the original checkout. No production claim from it is adopted here. |

## Requirement matrix on the reviewed branch

| Original area | State | Evidence and limit |
| --- | --- | --- |
| A. Baseline and measurement | **UNVERIFIED** | No valid before/after data for the authorized base. Historical CRM performance reports are older baselines. |
| B. CRM retention | **PARTIAL** | Today, Bookings, Schedule, Attendance, Customers, Cash Flow, and Dispatch have descriptors and wrappers. Retained instance/eviction tests pass. Authenticated runtime, per-module refresh and memory remain unverified. |
| C. Owner retention | **PARTIAL** | Overview, Bookings, Schedule, Attendance, Cash Flow, Reports, and Dispatch have descriptors/wrappers. Owner branch scope is keyed by the route's branch parameter. Owner browser flow remains unverified. |
| D. Retention state machine | **PARTIAL** | Registry has cold registration, retained activation, dirty, refreshing, and stale checks. Explicit state labels are not required for behavior and were not carried over. |
| E. Loading feedback | **PARTIAL** | Structural bootstrap, delayed `Updating…`, and delayed sidebar feedback are in source and focused tests. Browser flash/usable timing is unmeasured. |
| F. Server/query work | **PARTIAL** | Remote branch overlaps dashboard access/readiness, CRM and Owner layout contexts, dedupes CRM staff context, and reuses cached Owner access in two pages. Exact RSC/query timing is unmeasured. |
| G. Quick Booking | **UNVERIFIED** | Permanent CRM modal provider remains in layout; authenticated booking modal interaction was not run. |
| H. Prefetch | **UNVERIFIED** | Existing route prefetcher remains. No measured prefetched versus non-prefetched contribution; local policy edits were not applied. |
| I. URL contract | **PARTIAL** | Unit tests cover canonical query restoration and branch switching. Back, Forward, deep links, reload and new-tab behavior require browser QA. |
| J. Authorization | **PARTIAL** | Server layouts and actions retain identity/role/branch checks; no Auth/RLS/schema change in PR. Direct forbidden-role and cross-branch browser/API checks were not run. |

## Work completed during this recovery

- Verified live GitHub `main` matches the authorized base; fetched and compared the 32-commit remote branch without replacing the dirty local checkout.
- Fixed two task-scoped React lint errors in delayed retained-refresh and sidebar-feedback effects. Visible feedback remains conditional on an active refresh/navigation, and timer cleanup resets delayed state.
- Added stale retained-return and Owner branch-switch regression tests, plus a route-to-wrapper test for the seven primary CRM and seven primary Owner modules.
- Formatted only the P1 changed code and tests; did not format the other historical files flagged by the broad Windows format gate.
- Preserved the draft PR, local uncommitted work, branch isolation, and all production state.

## Verification ledger

| Evidence class | Command/result |
| --- | --- |
| LOCAL RUNTIME EVIDENCE | Local draft `pnpm type-check`: PASS. Local focused Vitest: FAIL, 61/64 tests passing; duplicate nested-worktree discovery contributed two failures. |
| LOCAL RUNTIME EVIDENCE | Remote baseline focused Vitest: 27/27 PASS; broader navigation/auth/CRM/Owner subset: 66/66 PASS; typecheck PASS. |
| LOCAL RUNTIME EVIDENCE | Final `pnpm exec vitest run` with navigation, auth, CRM, attendance, booking, Owner page, and retention tests: **12 files, 87 tests PASS**. |
| LOCAL RUNTIME EVIDENCE | Final `pnpm type-check`: PASS. Scoped ESLint for all P1 changed TypeScript files: PASS. Scoped Prettier check: PASS. `git diff --check`: PASS. |
| LOCAL RUNTIME EVIDENCE | `pnpm build`: PASS after installing the locked dependencies and setting inert `build-only.invalid` Supabase placeholders. No database target was contacted. |
| LOCAL RUNTIME EVIDENCE | Broad `pnpm lint`: FAIL with 82 errors and 38 warnings before the two P1 scoped fixes; most findings are outside this task. Broad `pnpm format:check`: FAIL across 829 historical incremental files in the Windows CRLF checkout. Both broad gates remain unpassed. |
| MEASURED BROWSER EVIDENCE | **NOT VERIFIED.** No authenticated before/after run was made on the authorized base and P1 preview. |
| PRODUCTION EVIDENCE | **NONE collected for this recovery.** No production mutation, deployment, or merge. |

## Performance and review limits

The requested CRM and Owner route sequences have **no comparable before/after usable-time measurements**. Cold, fresh-retained, stale-retained, dirty-retained, prefetched, and non-prefetched navigation timing; loader visibility; request waterfall; heap; and hidden work were not measured in an authenticated browser. Unit tests do not substitute for those measurements.

The source-level root causes addressed by the remote branch are incomplete retained coverage, immediate navigation/refresh feedback, and serial context work. Their user-visible performance effect is **not verified**. Newly wrapped Cash Flow, Attendance, Dispatch, and Owner modules have less direct client reactivation coverage than Bookings and Schedule; confirm stale/dirty data behavior in the authenticated browser before acceptance. High-cost Dispatch/map retention and Owner default rollout especially need memory and branch-isolation review.

**Rollback:** `NEXT_PUBLIC_RETAINED_WORKSPACES=crm` limits retention to CRM; `off` disables retained workspaces. These flags control client interaction only and do not authorize data access. No schema rollback is involved.

**Next permitted action:** independent source review of draft PR #17, then authenticated TEST/STAGING browser measurement on known targets and separately authorized merge gate. **Not authorized:** production data mutation, migration, main push, merge, or deployment. No P0/P1 production defect is asserted from repository-only evidence. Browser certification and broad lint/format gates remain unresolved review findings.
