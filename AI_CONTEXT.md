# CradleHub AI Context

## Identity

- Project: CradleHub
- Canonical repository: `https://github.com/techwithmpg/Cradlehub.git`
- Accepted branch: `main`

## CradleHub Staff PWA — current task authorization (2026-09-12)

- Program: **OWNER APPROVED**. Current stage: **PWA-C6 — Scanner correction / external re-review**, on `stage/pwa-c6-scanner`.
- Accepted C5/main baseline: `a97e43eec9ce0c99ad5037212e75cd5226fe38fc`; reviewed C6 head: `bc20ee15cd987364b7acdeea0886d7c649ee1a5e`. C6 remains current until accepted/merged; correction work is a new commit, with no history rewrite.
- Latest owner instruction authorizes only the four C6 scanner corrections, focused verification, governance updates, and normal branch commit/push. No deployment, merge, schema/migration/Auth/RLS/Storage changes, or production access/mutation is authorized. Configured remote Supabase target: **UNKNOWN**; no authenticated/mutating runtime verification against it.
- **PWA-GOV-010 — OWNER APPROVED ROADMAP COMPRESSION** prospectively supersedes original remaining C7–C19 after C6 acceptance: C7X Staff Operations Core → C8X Driver & Off-Site Operations → C9X Stabilization & Release Hardening → C10X Training & Release Candidate → separate FINAL Release Certification. Historical stage records remain evidence.
- **PWA-C7X — NOT YET AUTHORIZED FOR IMPLEMENTATION.** Roadmap approval and completion of C6 do not authorize later implementation or deployment.
- Authority: [PWA-GOV-009/010](docs/11-DECISION-LOG.md#staff-pwa-decisions), [project roadmap](docs/pwa/PROJECT.md#prospective-compressed-roadmap--pwa-gov-010), and [C6 handoff](docs/pwa/PWA-C6-HANDOFF.md).
- Accepted C3 product contracts, C4 design specifications and C5 foundation remain binding. The separate Web/Marketing workstream below is not activated or reconciled by this task. Older production statements remain REPOSITORY-RECORDED PRODUCTION EVIDENCE.

## Accepted governance anchor

- C0B accepted governance merge SHA: `03dbd57ed4be6f9b1f0bd30c7fd22a225e68ec2a`
- C0B status: **CLOSED / ACCEPTED**
- C1 accepted truth consolidation merge SHA: `3f402e033e1d1ca05b8cc8a4f2764823f7aaa622`
- C1 status: **CLOSED / ACCEPTED**
- C2 accepted diagnostics merge SHA: `694873dfe9b9572a56620951bb69024492fe04c0`
- C2 status: **CLOSED / ACCEPTED**
- C3 accepted scope freeze merge SHA: `d19ce34753e09244b8aad0e1d10c964302a33e7c`
- C3 status: **CLOSED / ACCEPTED**
- C4 accepted UI/UX plan merge SHA: `b90b2d70d05b8d6082f707babed8995799c2ab2d`
- C4 status: **CLOSED / ACCEPTED**
- C5 Pass 1 accepted parity merge SHA: `1f5d71ce3472684c9a94ad83d6c2e36a9d1b1971`
- C5 Pass 1 status: **CLOSED / ACCEPTED**
- C5 Pass 2 accepted media library merge SHA: `12ddaf44fe951e0f167084dafd51627d2836c70b`
- C5 Pass 2 status: **CLOSED / ACCEPTED**
- C5 Pass 3 accepted website studio merge SHA: `43e233280397751e9b64fb03bb46fe5b180bf56c` (PR #13, reviewed implementation head `fe4111ec43f738517a94f76e1c2d3ae763fbd5c8`)
- C5 Pass 3 status: **CLOSED / ACCEPTED / POST-MERGE INDEPENDENT PASS**
- Last governance closeout verification: 2026-09-01
- Current stage: **C5 — Implementation (Digital Marketing Workspace)**
- C5 status: **PASS 4 ACTIVE / AUTHORIZED (Brand, Branches, and Services Studios)**
- Next stage: **C5 PASS 5 — NOT AUTHORIZED**

> [!NOTE]
> C5 Pass 3 (Website Studio & High-Fidelity Preview) is closed and accepted with formal post-merge independent PASS. C5 Pass 4 is active and authorized for Brand, Branches, and Services Studios under owner-approved accelerated execution (targeted tests during development, with one comprehensive integrated C5.3+C5.4 verification including real responsive/browser QA at the end of C5.4). C5 Pass 5 (Atomic Review Queue) remains strictly not authorized. No schema/database mutation, migrations, Auth/RLS/Storage-policy changes, or production-data mutation are authorized.

The recorded SHAs are stable closeout anchors, not declarations of the current `main` head. At the start of every session, fetch and re-resolve `origin/main`; inspect newer accepted work rather than recreating an older state.

## Authority order

1. Latest explicit owner instruction
2. Active decisions in [docs/11-DECISION-LOG.md](docs/11-DECISION-LOG.md)
3. This file
4. Frozen stabilization/product scope
5. Current project/stage status
6. Relevant active architecture, safety, UI, and testing governance
7. Accepted implementation
8. Production state independently proven by authorized evidence

## Active governance manifest

- [Staff PWA C6 current handoff](docs/pwa/PWA-C6-HANDOFF.md)

- [Staff PWA project governance](docs/pwa/PROJECT.md)
- [Staff PWA current-system truth map](docs/pwa/PWA-C1-TRUTH-MAP.md)
- [Staff PWA handoff and status](docs/pwa/PWA-C1-HANDOFF.md)
- [Staff PWA structured diagnostics](docs/pwa/PWA-C2-STRUCTURED-DIAGNOSTICS.md)
- [Staff PWA C2 handoff and status](docs/pwa/PWA-C2-HANDOFF.md)
- [Staff PWA accepted C3 scope freeze](docs/pwa/PWA-C3-FINAL-SCOPE-FREEZE.md)
- [Staff PWA C4 UI/UX specification](docs/pwa/PWA-C4-UIUX-SPECIFICATION.md)
- [Staff PWA C4 handoff and status](docs/pwa/PWA-C4-HANDOFF.md)

- [Stabilization scope](docs/01-STABILIZATION-SCOPE.md)
- [Current system map](docs/02-CURRENT-SYSTEM-MAP.md)
- [Current-system truth](docs/03-CURRENT-SYSTEM-TRUTH.md)
- [Data and sync architecture](docs/04-DATA-SYNC-ARCHITECTURE.md)
- [Production safety](docs/05-PRODUCTION-SAFETY.md)
- [UI/UX contract](docs/06-UI-UX-CONTRACT.md)
- [Stabilization plan](docs/07-STABILIZATION-PLAN.md)
- [Development stages](docs/08-DEVELOPMENT-STAGES.md)
- [Testing and quality gates](docs/09-TESTING-QUALITY-GATES.md)
- [Handoff protocol](docs/10-HANDOFF-PROTOCOL.md)
- [Decision log](docs/11-DECISION-LOG.md)
- [Known issues register](docs/12-KNOWN-ISSUES-REGISTER.md)
- [Project status](docs/13-PROJECT-STATUS.md)
- [Branch strategy](docs/14-BRANCH-STRATEGY.md)
- [ChatGPT live context](docs/20-CHATGPT-LIVE-CONTEXT.md)

## Hard safety state

- `main` is production-connected; an accepted merge or push can deploy.
- Production data, schema, Auth, RLS, Storage, and secrets require explicit target-aware authorization.
- Eighty-four historical local-only migration versions must not be bulk replayed, marked applied, or pushed merely to normalize history.
- Attendance scanning and operational enforcement are separate controls. Operational enforcement remains not training-ready until its recorded gates pass.

## Current authorization

C0B, C1, C2, C3, C4, C5 Pass 1, and C5 Pass 2 are closed and accepted.

C5 Pass 3 — Website Studio & High-Fidelity Preview — is ACTIVE from accepted main SHA `f71f0b0c9d0de60a11386814cd23c200ca99496b`.

C5 Pass 4, Pass 5, and all later passes remain strictly NOT AUTHORIZED pending explicit future owner authorization.

No schema/database mutation, migrations, Auth/RLS/Storage-policy changes, or production-data mutation are authorized.

## Historical context policy

`.context/` and older duplicated task, handoff, decision, error, roadmap, and status material remain historical evidence. They are not active governance after C0B.
