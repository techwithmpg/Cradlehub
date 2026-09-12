# CradleHub Staff PWA — Project Governance

## Authorization

- Program: **OWNER APPROVED**, by explicit owner instruction on 2026-09-11.
- Repository: `techwithmpg/Cradlehub`; target: the existing Web application / Staff Portal.
- Authorized stage: **PWA-C4 — UI/UX Specification only**.
- PWA-C1 was accepted and merged into `main` at `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`.
- PWA-C2 was accepted at the C2/main baseline `2b927303d2d6bc10b09a15f2542fdcfa6c066194`.
- PWA-C3 is closed / accepted / merged at `3c069f198db8a6341b6bf27758cdbec24d344089`; its product contracts remain binding.
- PWA-C4 deliverable: design/specification only on `stage/pwa-c4-uiux-specification`, authorized by PWA-GOV-006.
- Delivery status: [C4 specification](PWA-C4-UIUX-SPECIFICATION.md) and [C4 handoff](PWA-C4-HANDOFF.md); accepted input: [C3 scope freeze](PWA-C3-FINAL-SCOPE-FREEZE.md).
- No runtime implementation/UI changes, schema/database change, migration, Auth/RLS/Storage changes, production access/mutation, merge or deployment is authorized. PWA-C5+ remains NOT AUTHORIZED.

The owner-approved product direction is supplied and recorded below. PWA-C3 freezes the V1 boundary, source-of-truth rules, authorization rules, conceptual navigation, and later verification gates. UI layout and interaction detail remain for PWA-C4. Product approval and a C3 freeze are not evidence that the current implementation satisfies these constraints.

This is a distinct workstream within controlled Web stabilization. `PWA-C1` is not the earlier Web/Marketing `C1`. Existing Marketing decisions remain recorded; this task does not continue, close, or expand that workstream. Apply the authority order in [AI context](../../AI_CONTEXT.md) and [decision log](../11-DECISION-LOG.md), with the latest explicit owner instruction first.

## Approved product constraints

**PROJECT DECISION — OWNER APPROVED DIRECTION**

All constraints in this section are supplied product decisions, not claims of current implementation, frozen C3 engineering contracts, or permission to implement. The [feature matrix](PWA-C1-TRUTH-MAP.md#11-owner-approved-pwa-feature-matrix) separately maps them to current repository evidence.

### Product model

- One CradleHub Staff PWA, using the existing authoritative CradleHub backend.
- No separate PWA operational database or second source of operational authority.
- Role/capability-aware UI for Therapist, service-provider / salon staff, CRM / General Staff, Utility and Driver operational groups.

### Intelligent scanner

- One primary Scan action; staff do not choose Attendance versus Service Start.
- The camera reads the QR; the server resolves its purpose.
- A QR does not grant authorization. The protected action remains server-authorized.
- No fake local success; success requires server confirmation.

### Attendance

- Preserve the existing attendance/server/device model.
- The server determines the valid next attendance action; the server timestamp is authoritative.
- Attendance and service progress remain separate.

### Service providers

- Therapist, Nail Tech, Aesthetician/Facialist and Salon Head share the service-provider direction.
- The existing booking/service state machine remains authoritative.
- Service Start scanning adapts the existing service-start contract.
- V1 has no service-end QR requirement.
- Service completion must not automatically clock out the staff member.

### Remote End Shift

- Legitimate off-site staff may be eligible.
- End Shift is a separate server-authorized and audited action, not a fake branch scan.
- Eligibility must consider clock-in state, active work, remaining work and approved capability. Exact rules and capability mapping remain for the authorized engineering contract stages.

### Driver

- Driver is a first-class critical PWA role, with map-centered active-trip UX.
- PWA location is intended to communicate with the existing CRM Live Map.
- No hidden 24/7 tracking; the active-trip tracking lifecycle must be explicit.
- Continuous/background location reliability is not assumed and must later be proven on real devices.
- If pure PWA cannot satisfy the requirement, stop for an architecture decision rather than fabricate success.

### Connectivity

- V1 is online-first.
- No authoritative offline Attendance, Service Start, service completion, trip transitions or remote checkout.
- Server confirmation is required before success UI.

### V1 exclusions

- No separate native Android/iOS applications in initial scope.
- No second authority database.
- No broad offline mutation queue.
- No GPS-based automatic attendance.
- No hidden background surveillance.
- No full Owner/Finance/Payroll/Marketing/Staff/Customer administration.
- No speculative Utility-task backend.

## Approved roadmap and stage gates

| Stage | Name | Execution authorization |
| --- | --- | --- |
| PWA-C1 | Current-System Truth | Closed / accepted at `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99` |
| PWA-C2 | Structured Diagnostics | Closed / accepted at `2b927303d2d6bc10b09a15f2542fdcfa6c066194` |
| PWA-C3 | Final Scope Freeze | Closed / accepted / merged at `3c069f198db8a6341b6bf27758cdbec24d344089` |
| PWA-C4 | UI/UX Specification | Active on `stage/pwa-c4-uiux-specification`; design/specification only; not accepted/merged |
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
- [PWA-C2 structured diagnostics](PWA-C2-STRUCTURED-DIAGNOSTICS.md)
- [PWA-C2 status and handoff](PWA-C2-HANDOFF.md)
- [PWA-C3 final scope freeze](PWA-C3-FINAL-SCOPE-FREEZE.md)
- [PWA-C3 status and handoff](PWA-C3-HANDOFF.md)

- [PWA-C4 UI/UX specification](PWA-C4-UIUX-SPECIFICATION.md)
- [PWA-C4 handoff and status](PWA-C4-HANDOFF.md)
