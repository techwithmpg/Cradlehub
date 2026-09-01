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
- Last governance closeout verification: 2026-09-01
- Current stage: **C2 — Structured Diagnostics (Digital Marketing Workspace)**
- C2 status: **REPORT CORRECTED / AWAITING INDEPENDENT REVIEW**
- Next stage: **C3 — NOT AUTHORIZED**

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

C0B and C1 are closed and accepted. C1 merge was accepted into main at `3f402e033e1d1ca05b8cc8a4f2764823f7aaa622`. C2 Structured Diagnostics for the Digital Marketing Workspace has completed and delivered `docs/audits/C2_MARKETING_STRUCTURED_DIAGNOSTICS_REPORT.md`. C2 is read-only diagnostics: zero product implementation, database/schema mutation, migration reconciliation, production mutation, or unrelated Web work occurred. C3 and later stages remain not authorized pending owner review of the C2 report.

## Historical context policy

`.context/` and older duplicated task, handoff, decision, error, roadmap, and status material remain historical evidence. They are not active governance after C0B.
