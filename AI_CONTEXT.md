# CradleHub AI Context

## Identity

- Project: CradleHub
- Canonical repository: `https://github.com/techwithmpg/Cradlehub.git`
- Accepted branch: `main`

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
- Last governance closeout verification: 2026-09-01
- Current stage: **C5 — Implementation (Digital Marketing Workspace)**
- C5 status: **PASS 1 OWNER ACCEPTED / MERGE GATE IN PROGRESS**
- Next stage: **C5 PASS 2 — CONDITIONALLY AUTHORIZED AFTER C5.1 CLOSEOUT (C5 PASS 3+: NOT AUTHORIZED)**

> [!NOTE]
> C5 Pass 1 authorizes frontend component grounding and public consumer parity only. It does NOT authorize schema/database changes, migrations, RLS, Storage policy changes, Auth changes, security-policy mutation, or production data mutation. Later C5 passes remain strictly not authorized.

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

C0B, C1, C2, C3, and C4 are closed and accepted. C5 Pass 1 (Public Consumer Parity & Component Grounding) is OWNER ACCEPTED with independent review PASS, and its merge gate into main is active. Conditioned on successful accepted C5.1 closeout, C5 Pass 2 (Central Media Library & Universal Media Picker) is conditionally authorized. C5 Pass 2 does NOT authorize schema/database mutation, migrations, RLS/Auth/Storage policy changes, production data mutation, or C5 Pass 3+. C5 Pass 3+ remains strictly NOT AUTHORIZED.

## Historical context policy

`.context/` and older duplicated task, handoff, decision, error, roadmap, and status material remain historical evidence. They are not active governance after C0B.
