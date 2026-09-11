# PWA-C1 — Status and Handoff

Date: 2026-09-11. **DELIVERED FOR REVIEW — STOPPED AT C1.** Owner acceptance, independent review and merge have not occurred.

## Authorization and baseline

- Task: initialize the OWNER APPROVED CradleHub Staff PWA program and deliver **PWA-C1 — Current-System Truth only**, per explicit owner instruction.
- Canonical repository: `techwithmpg/Cradlehub`.
- Working branch: `stage/pwa-c1-current-system-truth`.
- Accepted source baseline and HEAD before artifact commit: `b2b9b6ec7579bbd9b519841cadf612ed133cbfcc`.
- Owner follow-up authorizes **commit + push review artifacts only** (PWA-GOV-002). This handoff accompanies the eight-file documentation commit; its exact revision is the containing Git commit, reported with remote-ref verification in the delivery response. No PR creation, merge, deployment or new stage is part of this delivery.
- Branch was created from fetched `origin/main`; initial working tree was clean. Final ref reconciliation is part of the documentation verification below.

## Deliverables and file scope

| File | Change |
| --- | --- |
| [AI context](../../AI_CONTEXT.md) | Registers scoped PWA authorization, baseline and active manifest links; preserves inherited Marketing records |
| [Development stages](../08-DEVELOPMENT-STAGES.md) | Links the distinct approved PWA stage sequence |
| [Decision log](../11-DECISION-LOG.md) | Records PWA-GOV-001 stage scope and PWA-GOV-002 commit/push authorization |
| [Known issues](../12-KNOWN-ISSUES-REGISTER.md) | Records unranked PWA evidence gaps and investigation seams |
| [Project status](../13-PROJECT-STATUS.md) | Reports C1 delivery for review and the stop gate |
| [PWA project](PROJECT.md) | Program scope, all 20 roadmap stages, authority, preservation and evidence contracts |
| [Truth map](PWA-C1-TRUTH-MAP.md) | Current routes, roles, consumers, authority, side effects, dependencies, tests, limits and safe future replacement seams |
| This handoff | Exact delivery state, evidence, limitations and next permitted action |

Runtime source, tests, SQL/migrations, dependencies, assets, environment files and deployment configuration are unchanged. No uncertain files or records were removed. No Supabase target was connected or mutated; no second database or client persistence system was created.

## Decisions and findings

PWA-GOV-001 registers PWA-C1 only. Program/roadmap approval is not permission to start PWA-C2, code features or merge. PWA role/model details stated as approved by the owner were not expanded into invented specifications.

The truth map establishes existing staff role modes/mobile shells, server attendance/room/resource scan routing, controlled portal clock-out, driver and operations map seams, and push plumbing. It distinguishes missing source from unverified behavior: no install manifest or in-app camera decoder was found; driver Route Map is a placeholder; utility is Coming Soon. A separate driver component offers explicit single-shot location capture. Attendance reads may invoke a write-capable policy RPC. Existing shift actions and QR/portal actions coexist. No fixes or diagnostics severity ranking were performed.

## Evidence actually run

**VERIFIED REPOSITORY FACT**

- Read the active governance manifest and relevant source/test/migration files at the accepted baseline.
- Ran the requested Git baseline commands; fetch succeeded after filesystem permission escalation. HEAD and `origin/main` matched, with no initial local changes.
- Confirmed package contract and installed Next 16.2.4; local Next guides exist. No Next.js code was changed.
- Default Node is 25.2.0, outside the repository contract; selected tests ran through available Node 24.14.0 with pnpm 10.33.2. No runtime installation, dependency repair or frozen-lockfile reinstall was performed in this task.

**LOCAL TEST EVIDENCE — PASS: 5 files, 96 tests**

```text
fnm exec --using=24.14.0 C:/Users/eleur/AppData/Roaming/npm/pnpm.cmd exec vitest run tests/lib/auth/workspace-access.test.ts tests/lib/staff-portal/attendance.test.ts tests/lib/attendance/smart-dynamic-clock-out.test.ts tests/lib/notifications/cradlehub-push-service-worker.test.ts tests/lib/home-service-tracking.test.ts --exclude '**/.claude/**'
```

Vitest 4.1.5 reported 5 passed files / 96 passed tests, duration 2.09 seconds. These are local unit, simulated-worker and source-contract checks; they do not execute database migrations or certify Auth/RLS, a real service worker, provider delivery, live attendance or a device. No tests were written or changed.

Execution limitations were resolved explicitly: `fnm` could not resolve the bare pnpm command, so the existing `.cmd` shim was used. Sandboxed Vitest startup failed with `spawn EPERM`; rerun with subprocess permission succeeded. The first successful unfiltered run reported 10 files / 186 tests because five historical `.claude/worktrees/` copies of the home-service test matched the filter. `vitest list ... --filesOnly` identified those copies; the authoritative result above excludes them. Historical worktrees were not edited or removed.

**Original inspection documentation gate — PASS (before artifact commit)**

- Final inspection `git fetch --all --prune` succeeded; HEAD and `origin/main` both matched `b2b9b6ec7579bbd9b519841cadf612ed133cbfcc`; `git rev-list --left-right --count HEAD...origin/main` reported `0 0`.
- `git diff --check` passed for tracked edits; a supplemental whitespace check included all three new untracked PWA documents and found zero violations.
- 77 local Markdown links across the eight delivery documents resolve; zero broken paths.
- At inspection handoff, tracked diff plus untracked-file inventory contained exactly the eight authorized documentation files; zero unexpected changed paths. The three new PWA documents were then untracked and absent from ordinary `git diff --stat` until staging.
- Reviewed new content for secrets/private data and evidence wording: no credentials, cookies, private staff/customer data or unsupported live-verification claims introduced.

Full application type-check/lint/build, full test suite, browser/device QA, provider calls, database queries and production verification were **not run**. Docs-only changes do not require those broader runtime gates under the active testing contract.

The commit/push follow-up preserves the original test evidence above; it does not represent a new test run. Follow-up edits only reconcile delivery/authorization wording. Git scope, staged whitespace, document links and the pushed remote revision are verified for publication; the final delivery response records the resulting commit and remote state.

## Unresolved limitations and production impact

No live/deployed behavior is certified. Current schema/migration history, RLS, Auth, Storage, Realtime, cron, provider configuration, installed-device behavior, camera, continuous GPS and cross-client synchronization remain unknown. All cited historical production claims are **REPOSITORY-RECORDED PRODUCTION EVIDENCE**, not live evidence produced here.

Inherited Marketing authorization text conflicts; PWA-specific entry points make this task's scope explicit without asserting a Marketing closeout. Detailed approved PWA models need their original specification artifacts before future scope/design work. Historical local-only migration restrictions remain in force.

Production impact from this task: no deployment or production access/mutation; repository changes are documentation only. Source availability and local tests cannot establish zero pre-existing production defects.

## Next permitted action

Commit and push the completed documentation to the named PWA-C1 branch for external review, under PWA-GOV-002, then stop. Obtain applicable independent review and owner acceptance/merge authorization before an accepted merge. This delivery has not supplied an independent review.

**STOP:** PWA-C2 and every later PWA stage, new C1 research except correction of obvious evidence inconsistencies, feature implementation, opportunistic cleanup, database/migration actions, production access/mutation, merge and release certification remain outside this authorization. Only the completed documentation artifact commit and branch push are authorized by the follow-up.
