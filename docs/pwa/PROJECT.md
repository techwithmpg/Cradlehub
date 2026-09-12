# CradleHub Staff PWA — Project Governance

## Authorization

- Program: **OWNER APPROVED**. Current stage: **PWA-C6 — Scanner correction / external re-review**, on `stage/pwa-c6-scanner`.
- Accepted C5/main baseline: `a97e43eec9ce0c99ad5037212e75cd5226fe38fc`; reviewed C6 head: `bc20ee15cd987364b7acdeea0886d7c649ee1a5e`. C6 remains current until accepted/merged; correction work is a new commit, with no history rewrite.
- Latest owner instruction authorizes only the four C6 scanner corrections, focused verification, governance updates, and normal branch commit/push. No deployment, merge, schema/migration/Auth/RLS/Storage changes, or production access/mutation is authorized. Configured remote Supabase target: **UNKNOWN**; no authenticated/mutating runtime verification against it.
- **PWA-GOV-010 — OWNER APPROVED ROADMAP COMPRESSION** prospectively supersedes original remaining C7–C19 after C6 acceptance: C7X Staff Operations Core → C8X Driver & Off-Site Operations → C9X Stabilization & Release Hardening → C10X Training & Release Candidate → separate FINAL Release Certification. Historical stage records remain evidence.
- **PWA-C7X — NOT YET AUTHORIZED FOR IMPLEMENTATION.** Roadmap approval and completion of C6 do not authorize later implementation or deployment.
- Current delivery: [C6 handoff](PWA-C6-HANDOFF.md). Accepted C3 scope, C4 UI/UX specification and C5 shared foundation remain binding; latest owner authority supersedes older stage-active wording only.

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

## Original roadmap and stage gates — historical record

The following table is retained as its historical C4-stage snapshot; its execution-status cells are not current authority. Original remaining C7–C19 stages are **SUPERSEDED prospectively after C6 acceptance** by PWA-GOV-010 below. Existing C1–C6 evidence, accepted product contracts and earlier stage references are preserved.

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

## Prospective compressed roadmap — PWA-GOV-010

**OWNER APPROVED ROADMAP COMPRESSION.** This is the prospective successor roadmap after C6 acceptance. C6 remains current until accepted/merged. **C7X is NOT YET AUTHORIZED FOR IMPLEMENTATION.** Each future stage still needs explicit owner authorization. Historical references to C7–C19 map to the slices below without weakening their product, authority, safety or verification contracts.

| Macro-stage | Historical mapping | Ordered work and blocking gates |
| --- | --- | --- |
| **PWA-C7X — STAFF OPERATIONS CORE** | C7 Attendance; C8 Therapist / Salon; C9 General / CRM; C10 Utility | One branch/review cycle. A → B → C, sequential; earlier failure blocks later risky dependency work. |
| **PWA-C8X — DRIVER & OFF-SITE OPERATIONS** | C11 Driver Core; C12 Live Map; C13 Reliability; C14 Remote Off-Site Checkout | One branch/review cycle. A → B → C → D, sequential. D blocked until C proves required reliability AND server-side eligibility contract. |
| **PWA-C9X — STABILIZATION & RELEASE HARDENING** | C15 Notifications; C16 Performance; C17 Security; C18 UX / Accessibility | One branch/review cycle; explicit security review remains a blocking internal gate. |
| **PWA-C10X — TRAINING & RELEASE CANDIDATE** | C19 Training Readiness plus release-candidate preparation | Evidence and training preparation only within later authorization; completion never authorizes deployment. |
| **FINAL — RELEASE CERTIFICATION** | Separate FINAL certification gate retained | Explicit owner approval required; no automatic deployment. |

### C7X internal ordered slices

- **C7X-A Attendance:** canonical Attendance flow, device trust, clock-in/out, authoritative server timestamps, duplicate/idempotency handling, preserve existing writers; no GPS attendance.
- **C7X-B Provider / Salon:** Therapist, Nail Tech, Aesthetician / Facialist and Salon Head. Reuse exact authoritative booking/service transitions; no second state machine. C3 sequences remain `not_started → checked_in → session_started → completed` (in-spa) and `not_started → travel_started → arrived → session_started → completed` (home service). Service completion does not clock staff out; assignment validation remains server authoritative; service-end QR remains OUT OF V1.
- **C7X-C CRM General + Utility:** personal operational workspace; own work/schedule/notices only where authoritative. Utility Work remains unavailable unless a real backend exists; no fabricated task system.

### C8X internal ordered slices

- **C8X-A:** Driver Core / Trips.
- **C8X-B:** Map plus existing location snapshots.
- **C8X-C:** Driver Reliability / physical-device spike.
- **C8X-D:** Controlled Remote End Shift. May begin only if C8X-C establishes required reliability and the server-side eligibility contract. Preserve C3 eligibility constraints including active Driver trips and unresolved timing/policy ownership (PWA-C3-Q004); do not invent a formula.

No speculative background tracking, fabricated routes/ETAs or hidden 24/7 location. Trip-scoped consent only. If the reliability gate fails, stop the dependent work for the required architecture/owner decision.

### C9X internal requirements

Notifications use existing/proven contracts only. Measure performance before optimization and preserve before/after evidence. Explicit security review is a blocking internal gate and must inspect authorization, RLS and server privilege boundaries under later target-aware authorization. Correct accessibility/responsive/mobile issues without broad redesign or speculative features.

### C10X and FINAL

Role-by-role mobile walkthroughs, training workflow, error/recovery instructions, Android/iPhone evidence where required, install/PWA checks, final known limitations, release evidence package and rollback considerations are required. C10X completion does NOT authorize deployment. FINAL Release Certification remains separate and requires explicit owner approval; no automatic deployment.

## Historical PWA-C1 file and execution scope

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

- [PWA-C5 handoff](PWA-C5-HANDOFF.md)
- [PWA-C6 correction handoff](PWA-C6-HANDOFF.md)
