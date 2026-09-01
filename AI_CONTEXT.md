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
- Last governance closeout verification: 2026-09-01
- Current stage: **C3 — Scope Freeze (Digital Marketing Workspace)**
- C3 status: **SCOPE CORRECTED / AWAITING INDEPENDENT REVIEW**
- Next stage: **C4 — NOT AUTHORIZED**

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

C0B, C1, and C2 are closed and accepted. C2 diagnostics was merged into main at `694873dfe9b9572a56620951bb69024492fe04c0`. C3 Scope Freeze for the Digital Marketing Workspace delivered `docs/audits/C3_MARKETING_SCOPE_FREEZE.md` defining the five-module structure (Website, Brand, Branches, Services, Media Library), secondary navigation (Drafts, Settings), contextual SEO, universal subsystem contracts, and strict field-level authorization boundaries. C3 is documentation and scope freeze only. C4 design implementation and C5+ coding are NOT AUTHORIZED pending owner review of the C3 scope freeze.

## Historical context policy

`.context/` and older duplicated task, handoff, decision, error, roadmap, and status material remain historical evidence. They are not active governance after C0B.
