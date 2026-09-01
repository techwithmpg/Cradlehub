# CradleHub AI Context

## Identity

- Project: CradleHub
- Canonical repository: `https://github.com/techwithmpg/Cradlehub.git`
- Accepted branch: `main`

## Accepted governance anchor

- C0B accepted governance merge SHA: `03dbd57ed4be6f9b1f0bd30c7fd22a225e68ec2a`
- C0B status: **CLOSED / ACCEPTED**
- Last governance closeout verification: 2026-08-26
- C1 accepted-main baseline at authorization: `4f9291c7d457ec49b071e766df4c23ca1e4f1558`
- C1 evidence verification: 2026-08-27
- Current stage: **C1 — OWNER ACCEPTED / MERGE GATE IN PROGRESS**

The recorded SHA is the stable C0B closeout anchor, not a declaration of the current `main` head. At the start of every session, fetch and re-resolve `origin/main`; inspect newer accepted work rather than recreating an older state.

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

C0B is closed and accepted. C1 current-system truth consolidation was owner-accepted on 2026-09-01. `stage/c1-closeout` exists only to complete the C1 merge gate against the current accepted `main`. Upon successful C1 merge acceptance, C2 Structured Diagnostics is authorized only for the Digital Marketing Workspace. C2 is read-only diagnostics: no product implementation, database/schema mutation, migration reconciliation, production mutation, or unrelated Web work is authorized. C3 and later stages remain not authorized.

## Historical context policy

`.context/` and older duplicated task, handoff, decision, error, roadmap, and status material remain historical evidence. They are not active governance after C0B.
