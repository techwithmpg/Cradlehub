# CradleHub Staff PWA — Project Governance

## Authorization

- Program: **OWNER APPROVED**, by explicit owner instruction on 2026-09-11.
- Repository: `techwithmpg/Cradlehub`; target: the existing Web application / Staff Portal.
- Authorized stage: **PWA-C1 — Current-System Truth only**.
- PWA-C1 deliverables: accepted repository baseline, dedicated branch, project governance, source inspection, and truth map.
- Delivery status: see [PWA-C1 handoff](PWA-C1-HANDOFF.md). Review/acceptance and merge are separate gates.
- Owner follow-up authorizes **commit + push of the completed eight-file review artifact only** on `stage/pwa-c1-current-system-truth` (PWA-GOV-002). This adds no research, implementation, merge, deployment or PWA-C2 scope.

The owner states that the roadmap, feature scope, role concepts, intelligent scanner model, attendance model, remote off-site checkout direction, and driver live-map direction are approved. This instruction does not supply their detailed specifications. Preserve that approval without inventing permission matrices, scanner intent rules, geofences, tracking cadence, or acceptance criteria. Recover the approved detail before the relevant future scope/design gate; C1 can establish existing implementation without it.

This is a distinct workstream within controlled Web stabilization. `PWA-C1` is not the earlier Web/Marketing `C1`. Existing Marketing decisions remain recorded; this task does not continue, close, or expand that workstream. Apply the authority order in [AI context](../../AI_CONTEXT.md) and [decision log](../11-DECISION-LOG.md), with the latest explicit owner instruction first.

## Approved roadmap and stage gates

| Stage | Name | Execution authorization |
| --- | --- | --- |
| PWA-C1 | Current-System Truth | Authorized; deliver truth map and stop |
| PWA-C2 | Structured Diagnostics | Not authorized |
| PWA-C3 | Final Scope Freeze | Not authorized |
| PWA-C4 | UI/UX Specification | Not authorized |
| PWA-C5 | Shared Foundation | Not authorized |
| PWA-C6 | Intelligent Scanner | Not authorized |
| PWA-C7 | Attendance | Not authorized |
| PWA-C8 | Therapist / Salon | Not authorized |
| PWA-C9 | General / CRM Staff | Not authorized |
| PWA-C10 | Utility | Not authorized |
| PWA-C11 | Driver Core | Not authorized |
| PWA-C12 | Driver Live Map | Not authorized |
| PWA-C13 | Driver Reliability | Not authorized |
| PWA-C14 | Remote Off-Site Checkout | Not authorized |
| PWA-C15 | Notifications | Not authorized |
| PWA-C16 | Performance | Not authorized |
| PWA-C17 | Security | Not authorized |
| PWA-C18 | UX / Accessibility | Not authorized |
| PWA-C19 | Training Readiness | Not authorized |
| FINAL | Release Certification | Not authorized |

Program approval is not stage execution authorization. Completion of any stage does not authorize its successor. Require applicable review and owner gate before an accepted merge. `main` is production-connected; do not push or merge it as routine work.

## PWA-C1 file and execution scope

Allowed writes: this directory and the active governance entry points needed to register the workstream (`AI_CONTEXT.md`, development stages, decision log, known issues, project status). Inspect application code, tests, configuration, and migration files as evidence. Do not change runtime code, UI, dependencies, assets, tests, SQL, migrations, environment settings, Auth, RLS, Storage policies, or deployment configuration.

No feature implementation, new database, browser storage authority, database connection, production browsing, or production mutation is part of this C1 delivery. Local tests must be demonstrably isolated from live services. Identify any future database target as **LOCAL**, **TEST**, **STAGING**, or **PRODUCTION** before access; an unknown target is a stop condition, not permission to substitute another project.

Never bulk replay historical migrations, mark them applied to normalize history, push old local-only migrations, reset Supabase, disable RLS, or change production data. Existing CradleHub server/database state remains authoritative. The recorded 84 local-only versions are historical evidence, not a newly verified live count.

## Preservation and evidence contract

Before any future authorized replacement, identify consumers, source of truth, ownership, side effects, authorization boundary, production dependencies, existing tests, and safe replacement path. Follow **inspect → isolate → test → improve**. Preserve uncertain routes, components, migrations, scripts, assets, records, actions, utilities, and tooling.

Use these evidence classes:

- **VERIFIED REPOSITORY FACT**: directly inspected source/Git at the stated baseline; does not establish runtime correctness.
- **LOCAL TEST EVIDENCE**: exact local command, environment, scope, and result; mocks and source contracts do not certify a database or device.
- **REPOSITORY-RECORDED PRODUCTION EVIDENCE**: all repository claims about production behavior or earlier production verification, explicitly attributed to their source; never promote them to current live evidence.
- **UNKNOWN / NOT VERIFIED**: no appropriate environment verification in this task.

Do not claim production, deployment, Android, iPhone, real-device camera, Google Maps, live driver synchronization, database state, or production attendance works without verification of that exact environment. Do not expose secrets, service-role credentials, cookies, push subscription secrets, or private staff/customer data.

Substantial handoffs follow [the active handoff protocol](../10-HANDOFF-PROTOCOL.md). Historical `.context/`, old command/status files, and historical reports remain evidence only. Before future Next.js code changes, read the relevant installed guides under `node_modules/next/dist/docs/`; dependency absence must be reported rather than guessed around.

## Deliverables

- [PWA-C1 current-system truth map](PWA-C1-TRUTH-MAP.md)
- [PWA-C1 status and handoff](PWA-C1-HANDOFF.md)
