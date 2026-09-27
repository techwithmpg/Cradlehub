# CradleHub Staff PWA — PWA-C3 Final Scope Freeze

**Program:** CradleHub Staff PWA
**Stage:** PWA-C3 — Final Scope Freeze
**Branch:** `stage/pwa-c3-final-scope-freeze`
**Accepted C2/main baseline:** `2b927303d2d6bc10b09a15f2542fdcfa6c066194`
**Status:** **PROJECT DECISION — PWA-C3 FREEZE**
**Execution boundary:** Scope, source-of-truth, authorization, navigation, and verification contracts only. Runtime implementation, UI redesign, database work, migration work, deployment, merge, and PWA-C4+ execution are not authorized.

## A. Authority and evidence boundary

### Authorization and baseline

The owner reaffirmed accepted C2/main at `2b927303d2d6bc10b09a15f2542fdcfa6c066194` and superseded the later recovery status that restored main to `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`. [PWA-GOV-005](../11-DECISION-LOG.md#staff-pwa-decisions) records the completed baseline reconciliation and preserved, unmerged C2 recovery history. C3 remains the active documentation-only stage; this correction is **READY FOR EXTERNAL RE-REVIEW — NOT ACCEPTED / NOT MERGED**. PWA-C4 remains **NOT AUTHORIZED**.

### Evidence boundary

PWA-C1 Current-System Truth and PWA-C2 Structured Diagnostics are accepted inputs. This freeze uses the evidence in [PWA-C1](PWA-C1-TRUTH-MAP.md), [PWA-C2](PWA-C2-STRUCTURED-DIAGNOSTICS.md), the two handoffs, [project governance](PROJECT.md), and the active repository governance files.

Evidence labels retain their original meaning:

- **VERIFIED REPOSITORY FACT** — directly inspected repository source or Git state; it does not establish runtime correctness.
- **LOCAL TEST EVIDENCE** — an isolated local command and result; it does not certify production, a database, a browser, or a device.
- **REPOSITORY-RECORDED PRODUCTION EVIDENCE** — a production statement preserved from repository records, not current live verification.
- **UNKNOWN / NOT VERIFIED** — the target or evidence needed to make the claim was unavailable.
- **PROJECT DECISION — OWNER APPROVED** — supplied product direction.
- **PROJECT DECISION — PWA-C3 FREEZE** — a scope or contract decision made in this document.

No database target was required or accessed. No migrations, schema, RLS, Auth, Storage policy, deployment, production data, browser session, or device environment was changed or queried.

## B. V1 product boundary

### Product goal

Provide one role-aware Staff PWA for the approved operational groups, with clear server-confirmed work, attendance and trip flows using the existing CradleHub authority.

### V1 definition

V1 is one CradleHub Staff PWA using the existing CradleHub backend as its operational authority. The PWA has role-aware shells for Therapist, Nail Tech, Aesthetician/Facialist, Salon Head, CRM/General Staff, Utility, and Driver. It does not create a second operational database, client-side authorization authority, hidden tracking system, or broad offline mutation queue.

The frozen operational principles are:

1. Server actions, RPCs, and deployed authorization remain authoritative.
2. QR content identifies a public code only; it never grants permission.
3. Scan resolves purpose on the server and shows success only after authoritative confirmation.
4. Attendance remains separate from service progress, uses server time, and retains device trust where the existing contract requires it.
5. Remote End Shift is a separately audited, server-authorized off-site exception, never a disguised branch QR.
6. Driver location is explicit and trip-scoped. Continuous or background reliability is **UNPROVEN — REAL DEVICE TEST REQUIRED**.
7. V1 is online-first. A failed operational mutation must say that it was not recorded.

## C. Master scope matrix

The matrix freezes product scope without claiming that any `IN — NEW` or `IN — MODIFY` item already exists. “Current foundation” is repository evidence; “verification gate” is the later proof required before release.

| Capability | V1 status | Current foundation | C3 disposition | Source of truth | Authorization owner | Implementation stage | Verification gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Installable PWA | IN — NEW | Responsive Staff shells; no manifest found | Freeze install contract | Browser install and existing app routes | Server session plus browser install rules | PWA-C5 | Install and update matrix on supported devices |
| Manifest | IN — NEW | No manifest found | Required foundation | Manifest owned by the PWA shell | No client capability grant | PWA-C5 | Manifest, scope, icons, display and update checks |
| Icons | IN — REUSE | Existing icon assets | Reuse after inventory | Existing asset files | Repository and release owner | PWA-C5 | Installed-launch icon checks |
| Standalone launch | IN — NEW | No verified standalone mode | Freeze as install behavior | Browser manifest and shell | Browser plus authenticated session | PWA-C5 | Android/iPhone installed-mode test |
| Service-worker ownership | IN — MODIFY | Push worker and legacy self-unregistering worker | Required design and reliability contract | Existing registrations and cache names | Release owner; server push remains authoritative | PWA-C5/C15 | Known-environment registration/cache audit |
| Push-worker coexistence | IN — MODIFY | `public/cradlehub-push-sw.js` and `public/sw.js` | Preserve until one compatible owner is proven | Existing push worker and browser lifecycle | Notification server and worker owner | PWA-C5/C15 | Push registration, update and cache regression checks |
| Session persistence | IN — REUSE | Existing authenticated session | Preserve; no local authority | Existing Auth/session implementation | Server Auth | PWA-C5 | Expiry, refresh and installed-mode checks |
| Role-aware shell | IN — MODIFY | Staff, CRM, driver and utility shells | Dedicated shell contract | Server workspace grants plus route checks | Server role/workspace authority | PWA-C5 | Role matrix and direct-route denial checks |
| Bottom navigation | IN — MODIFY | Role-specific mobile navigation | Conceptual destinations frozen below | Shell visibility only; actions remain server-authorized | Server action/RPC/database authorization | PWA-C5/C9/C11 | Role navigation and deep-link checks |
| Connectivity state | IN — MODIFY | `useNetworkStatus` and selected guards | Centralize state semantics | Browser network state plus server response | Server confirmation | PWA-C5/C16 | Offline/online transition checks |
| Safe error/recovery states | IN — NEW | Mixed action errors and empty states | Freeze explicit failure semantics | Server result and action state | Server action/RPC | PWA-C5/C16 | Failed mutation never presents success |
| Universal Scan | IN — NEW | `/scan/[publicCode]` server route; no camera entry | Freeze one prominent action | Existing scan processor | Server scan authorization | PWA-C6 | QR intent and confirmed-result tests |
| Camera decoder | IN — NEW | No decoder found | Capture-only adapter | Browser camera API produces public code | Server authorizes the resulting action | PWA-C6 | Permission, decode, retry and device tests |
| Public-code handling | IN — REUSE | Existing public scan route and code contracts | Preserve identifier boundary | Existing `/scan/[publicCode]` path | Server scan engine | PWA-C6 | Known QR fixture and malformed-code checks |
| Server QR intent | IN — REUSE | Attendance, room and resource point types | Preserve automatic intent resolution | Existing scan engine/RPCs | Server Auth, staff/device and state checks | PWA-C6 | Intent resolution and denial tests |
| Attendance QR | IN — REUSE | Transactional attendance scan path | Adapt without second authority | Attendance RPCs and check-in rows | Server attendance/device policy | PWA-C6/C7 | Operation-id and state-transition checks |
| Room/resource QR | IN — REUSE | Room/resource scan contracts | Adapt existing path | Existing room/resource service actions | Server assignment and state checks | PWA-C6/C8 | Resource and assignment checks |
| Service Start QR | IN — REUSE | Service-start transition and QR point types | Adapt existing transition | Booking/service-progress state | Server booking/service authorization | PWA-C6/C8 | No client-selected intent; confirmed transition |
| Scan retry | IN — NEW | Existing server operation IDs/dedupe seams | Freeze retry and cancel states | Server operation result | Server scan authorization | PWA-C6 | Retry cannot duplicate a committed operation |
| Duplicate/idempotent behavior | IN — MODIFY | Operation IDs, scan events and RPC dedupe seams | Preserve server idempotency | Transaction/RPC and event records | Server transaction boundary | PWA-C6/C7/C8 | Repeated operation-id tests |
| Camera permission failure | IN — NEW | No camera layer | Freeze explicit recovery to manual public-code path where allowed | Browser permission result plus server route | Server still authorizes any fallback | PWA-C6 | Denial, cancellation and recovery tests |
| Manager correction/fallback | IN — NEW | Existing reviewer/correction actions | Freeze as controlled fallback, not client override | Existing correction/review contracts | Restricted manager/CRM/owner actions | PWA-C6/C7 | Authorization and audit checks |
| Branch QR | IN — REUSE | Attendance QR points and branch policy | Preserve branch validation | Attendance scan engine and branch records | Server branch/device/staff policy | PWA-C7 | Branch and wrong-branch cases |
| Server clock | IN — REUSE | Server/RPC timestamps and policy fields | Server remains authoritative | Existing attendance RPCs/rows | Server/database | PWA-C7 | Clock skew and response timestamp checks |
| Clock-in | IN — REUSE | QR and StaffCheckinWidget paths | Coexist until canonical contract is implemented | Attendance records and scan events | Server attendance policy | PWA-C7 | Duplicate and source/audit checks |
| Clock-out | IN — REUSE | QR, portal, widget and policy paths | Preserve behavior while consolidating contract later | Attendance records and policy RPC | Server attendance policy | PWA-C7 | Open-shift, policy and duplicate checks |
| Device trust | IN — REUSE | Trusted device and HttpOnly credential paths | Preserve existing requirement | `staff_devices` and server checks | Server device/attendance authorization | PWA-C7 | Activation, expiry and denial checks |
| Device activation | IN — REUSE | Activation token and registration flows | Adapt existing recovery seams | Device/token records and server contracts | Server activation authority | PWA-C7 | Single-use token and audit checks |
| Device replacement/recovery | IN — REUSE | Recovery links, registry and replacement paths | Preserve controlled recovery | Device registration/recovery records | Restricted staff/CRM/owner actions | PWA-C7 | Recovery and revocation checks |
| Attendance corrections | IN — REUSE | Correction and reset services/RPCs | Use as manager fallback | Correction records and attendance rows | Restricted reviewer authority | PWA-C7 | Audit/source-link checks |
| Dynamic clock-out policy | IN — MODIFY | `getMyAttendanceData` can call recalculation RPC | Freeze side-effect boundary before implementation | Policy fields and attendance row | Server/RPC grants | PWA-C7 | Read-side write behavior and idempotency tests |
| Direct StaffCheckinWidget coexistence | IN — MODIFY | Direct insert/update actions | Preserve consumers; define canonical reconciliation | Attendance rows and action contracts | Server action checks | PWA-C7 | Cross-path consistency checks |
| Remote End Shift | IN — NEW | Portal clock-out and policy foundations | Freeze functional exception; do not invent schema | Server-authorized attendance/work state | Server capability and audit policy | PWA-C14 | Eligibility, audit, active-work and return-rule tests |
| Today | IN — REUSE | Staff/driver today and schedule consumers | Reuse with business-date contract | Branch business date and assignment data | Server role/assignment checks | PWA-C8/C9/C11 | Branch-date and assignment checks |
| Next service | IN — REUSE | Existing booking/service views | Preserve assigned-service authority | Booking/service state | Server assignment checks | PWA-C8 | Multi-provider assignment checks |
| Own schedule | IN — REUSE | Existing staff schedule paths | Reuse; no new schedule authority | Existing schedule/booking data | Server staff access | PWA-C8/C9 | Date/timezone and role checks |
| Service progress | IN — REUSE | Existing progress actions/state | Preserve state machine | Booking/service-progress records | Server transition authorization | PWA-C8 | Transition and completion checks |
| Service Start | IN — REUSE | Room/resource/service-start RPCs | Adapt through scanner | Existing service session contract | Server booking/resource authority | PWA-C8 | Confirmed start and duplicate checks |
| Active timer/status | IN — MODIFY | Existing progress/timer views | Reuse state; define stale/error display in C4 | Service-progress state and timestamps | Server state | PWA-C8 | Timer and reload consistency |
| Completion | IN — REUSE | Existing service completion actions | Preserve; never auto-clock-out | Service-progress state | Server assigned-provider authority | PWA-C8 | Completion/attendance separation |
| Multi-provider validation | IN — REUSE | Assignment checks in existing actions | Preserve server validation | Booking assignments | Server assignment authority | PWA-C8 | Positive and denial cases |
| Home-service provider workflow | IN — MODIFY | Home-service booking/trip data | Freeze role and minimum-data boundary | Booking, assignment and location snapshot contracts | Server assignment/location authority | PWA-C8/C11 | Customer-data and trip-state checks |
| Customer-data minimization | IN — MODIFY | Existing booking, dispatch and map payloads | Freeze minimum fields by surface | Canonical booking/customer records | Server query/action boundary | PWA-C8/C11/C17 | Field inventory and payload review |
| Personal Today | IN — REUSE | Staff/CRM personal surfaces | Reuse with role/date contract | Branch date and assigned work | Server staff access | PWA-C9 | Role and branch-date checks |
| Own schedule (CRM/general) | IN — REUSE | Schedule and staff portal consumers | Reuse | Existing schedule data | Server staff access | PWA-C9 | Staff scope checks |
| Attendance (CRM/general) | IN — REUSE | Attendance page/actions | Reuse authoritative paths | Attendance records/RPCs | Server attendance policy | PWA-C9 | Cross-surface attendance checks |
| Scan (CRM/general) | IN — MODIFY | Existing server scan route | Shared scanner entry with role checks | Server scan engine | Server role/action authorization | PWA-C6/C9 | Role and QR-intent checks |
| Notices/messages if existing | IN — REUSE | Existing notification/push seams only | Include only existing permitted notices | Existing notification source | Server notification authorization | PWA-C9/C15 | Delivery evidence gate |
| Permitted CRM shortcut | IN — MODIFY | CRM routes/actions | Freeze a narrow shortcut; no CRM recreation | Existing CRM action boundary | CRM/server capability checks | PWA-C9 | Direct-route and action checks |
| Full CRM admin recreation | OUT OF V1 | Existing CRM workspace | Explicitly excluded | Existing CRM remains separate | Existing CRM authorization | None | Scope review only |
| Role-aware Utility experience | IN — NEW | Role-gated Coming Soon page | Freeze shell and permitted existing surfaces | Server role/workspace checks | Server utility capability | PWA-C10 | Role/redirect checks |
| Utility Attendance | IN — REUSE | Existing attendance paths | Reuse; no new Utility authority | Attendance records/RPCs | Server attendance policy | PWA-C10 | Attendance authorization checks |
| Utility schedule | IN — REUSE | Existing schedule consumers where permitted | Reuse only proven data | Schedule/assignment source | Server staff access | PWA-C10 | Role/date checks |
| Utility Scan | IN — MODIFY | Shared scanner contract | Include only server-permitted intents | Server scan engine | Server action authorization | PWA-C6/C10 | Intent and capability checks |
| Utility basic work/home | BLOCKED | No Utility backend found | Hold pending approved capability contract | No new source of truth | Server authority must be established later | PWA-C10/C4 | Contract and backend proof |
| Utility task-management backend | OUT OF V1 | None | Do not invent | None | None | None | Scope gate |
| Driver Today | IN — REUSE | Driver trip list and booking data | Reuse with business-date contract | Assigned trip/booking state | Server driver assignment | PWA-C11 | Assignment/date checks |
| Driver own trips | IN — REUSE | Driver trip list/actions | Preserve assigned-trip boundary | Booking/trip records | Server driver authorization | PWA-C11 | Direct-route and assignment checks |
| Active trip | IN — MODIFY | Trip progress actions | Freeze explicit lifecycle | Booking/trip state | Server assigned-driver actions | PWA-C11 | State transition checks |
| Start Travel | IN — REUSE | Existing trip progress action | Reuse authoritative transition | Booking/trip state | Server assigned-driver authorization | PWA-C11 | Confirmed transition |
| Arrived | IN — REUSE | Existing trip progress action | Reuse authoritative transition | Booking/trip state | Server assigned-driver authorization | PWA-C11 | Confirmed transition |
| Return/Complete | IN — REUSE | Existing trip progress action | Reuse; preserve terminal-state rules | Booking/trip state | Server assigned-driver authorization | PWA-C11 | Completion and assignment checks |
| Navigation handoff | IN — REUSE | External Maps URL seam | Handoff only; no background guarantee | Google Maps URL and trip destination | Server supplies permitted destination | PWA-C11/C12 | URL/privacy and device checks |
| Current location snapshot | IN — REUSE | `recordStaffLocationSnapshotAction` | Preserve as snapshot foundation | `staff_location_snapshots` and assignment checks | Server driver/location authorization | PWA-C11 | Target-aware row and policy checks |
| Driver map | IN — MODIFY | Driver placeholder; CRM map consumer | Freeze map-centered active-trip surface | Location snapshots, trip and destination data | Server trip/location authorization | PWA-C12 | Provider/device/map checks |
| Freshness | IN — NEW | `recorded_at` and 30-second CRM polling | Freeze visible age/stale semantics in C4 | Snapshot timestamp and server query | Server data plus client display contract | PWA-C12/C13 | Stale/offline/reconnect checks |
| CRM Live Map communication | IN — MODIFY | CRM Live Operations polling latest snapshot | Freeze communication contract | Location snapshot query and CRM map | Server branch/trip authorization | PWA-C12/C13 | Cross-client synchronization checks |
| Continuous tracking | DEFERRED | No `watchPosition` path found | Do not claim or implement in C3 | Future trip-scoped location contract | Server and device authorization | PWA-C13 | **UNPROVEN — REAL DEVICE TEST REQUIRED** |
| Background tracking | DEFERRED | Platform docs do not guarantee it | Device/architecture gate only | Future platform contract | Explicit owner architecture decision | PWA-C13 or later | **UNPROVEN — REAL DEVICE TEST REQUIRED** |
| Driver end-shift interaction | IN — MODIFY | Attendance/driver surfaces exist | Freeze separate server-authorized action | Attendance and trip state | Server capability/audit policy | PWA-C11/C14 | Active-work and eligibility checks |
| Existing push infrastructure | IN — REUSE | Push worker, subscription API and settings | Preserve while ownership is hardened | Existing push subscription records/worker | Server Auth/RLS and provider | PWA-C15 | Target-aware ownership and delivery tests |
| Role-relevant notifications | IN — MODIFY | Existing notification/event seams | Scope to approved operational notices | Existing server notification sources | Server recipient/role authority | PWA-C15 | Device/provider delivery evidence |
| Subscription ownership hardening | IN — MODIFY | DELETE/POST route ownership seam | Security/reliability gate; no C3 fix | Authenticated user and deployed RLS | Server route/RLS authority | PWA-C15/C17 | Known-target route and RLS review |
| Delivery verification | DEFERRED | No device/provider proof | Device test gate | Provider delivery plus subscription state | Server/provider/device | PWA-C15 | Real Android/iPhone evidence |
| Minimum customer information | IN — MODIFY | Customer identity/address/coordinates cross map consumers | Freeze per-surface minimum fields | Canonical booking/customer data | Server query and role boundary | PWA-C17 | Payload/retention review |
| Server authorization | IN — REUSE | Server actions, RPCs, route and RLS seams | Preserve as sole authority | Existing server/database controls | Server/Auth/RLS | Every implementation stage | Direct URL, role, and denial tests |
| No local capability grants | IN — REUSE | No approved client authority | Freeze prohibition | Server role/action state | Server/Auth/RLS | Every implementation stage | Capability-change and expiry checks |
| No service-role browser secrets | IN — REUSE | Server admin client is source-only | Preserve server boundary | Server-only credentials | Server runtime | PWA-C5/C17 | Build/static inspection |
| No hidden tracking | IN — REUSE | No continuous/background path proven | Freeze explicit consent/trip scope | Server trip and location contract | Server plus user-visible lifecycle | PWA-C11/C13/C17 | Consent, start/stop and retention checks |
| No broad offline operational cache | IN — REUSE | No authoritative outbox found | Freeze online-first boundary | Server remains authority | Server confirmation | PWA-C5/C16/C17 | Offline mutation and cache inspection |

## D. C2 finding dispositions

| Finding | Disposition | Frozen decision |
| --- | --- | --- |
| PWA-C2-001 — Business date | FREEZE FOR V1 | Branch-day operational work uses the canonical CRM branch-business-date concept; no C3 date utility change. |
| PWA-C2-002 — Attendance paths/read-side recalculation | REQUIRED DESIGN CONTRACT IN C4 | Preserve all consumers and freeze the command, read-side effect, timestamp, audit and reconciliation boundaries before implementation. |
| PWA-C2-003 — Driver lifecycle | REQUIRED DESIGN CONTRACT IN C4 | Active-trip lifecycle, snapshot cadence, freshness and stop semantics must be specified before C11/C12/C13 work. |
| PWA-C2-004 — Driver workspace split | REQUIRED DESIGN CONTRACT IN C4 | Dedicated `/driver` owns Driver V1; do not broaden Staff Portal to preserve broken links. |
| PWA-C2-005 — Universal Scan | FREEZE FOR V1 | One prominent Scan action is in scope; camera implementation waits for C6 after the C4 interaction contract. |
| PWA-C2-006 — Push ownership | SECURITY / RELIABILITY GATE | Route ownership and deployed RLS remain unproven; no C3 route or policy change. |
| PWA-C2-007 — Live Operations freshness | REQUIRED DESIGN CONTRACT IN C4 | Empty, error, offline and stale states must be distinct in the design contract. |
| PWA-C2-008 — Manifest/worker ownership | REQUIRED DESIGN CONTRACT IN C4 | Preserve both worker artifacts while scope, registration, cache and update ownership is defined. |
| PWA-C2-009 — Customer minimization | SECURITY / RELIABILITY GATE | Freeze field-by-surface minimums and retention/cache limits before map and trip implementation. |
| PWA-C2-010 — Connectivity | FREEZE FOR V1 | V1 is online-first; failed operational mutations are explicitly unrecorded and never faked as queued success. |
| PWA-C2-011 — Maps/device/provider | DEVICE TEST GATE | Provider, permissions, map rendering and device behavior require target-aware evidence. |
| PWA-C2-012 — Utility boundary | BLOCKED / OUT OF SCOPE | Utility has a role-aware shell and permitted existing surfaces only; no invented task backend. |

## E. Business-date contract

**PROJECT DECISION — PWA-C3 FREEZE:** any Staff PWA workflow representing a branch business day uses the same authoritative branch-business-date concept as canonical CRM operational workflows. UTC date derivation is not a separate product authority.

- **Source of truth:** the existing canonical branch-business-date concept and its proven CRM consumers. Exact implementation ownership is not changed in C3.
- **Consumers:** Staff/CRM Today, schedules, attendance date selection, service-provider work, driver trips, Live Operations and any future branch-day operational query.
- **Affected stages:** PWA-C4 contract and acceptance design; PWA-C5 shared foundation; PWA-C7 Attendance; PWA-C8 service providers; PWA-C9 CRM/general; PWA-C11 Driver; PWA-C12 Live Map.
- **Acceptance requirement:** the same branch/date fixture must produce the same operational day across these surfaces around branch midnight, with no client-selected alternate authority.
- **C3 limit:** no date utility, query, migration, or runtime behavior is modified here.

## F. Authorization and role/capability contract

UI mode, workspace visibility, QR content, device registration, direct URL access and any local cache are not authorization. Server actions, RPCs, database policies and authenticated server state remain authoritative. A role change must invalidate or deny capabilities from server state; the PWA must not maintain a permission cache as authority.

| Operational group / existing authority context | Required PWA surfaces / context | Allowed operational actions | Explicitly excluded admin actions | Server authority |
| --- | --- | --- | --- | --- |
| Therapist | Today, Schedule, Scan, Progress, More | View own assigned work; start/complete permitted service work; attendance actions where server-authorized | User/role administration, pricing/catalog, payroll, broad CRM, branch administration | Existing staff/service actions, assignment checks, attendance RPCs/RLS |
| Nail Tech | Therapist/service-provider surfaces | Same shared service-provider contract, subject to assignment/capability checks | Same admin exclusions | Server assignment and action checks |
| Aesthetician / Facialist | Therapist/service-provider surfaces | Same shared service-provider contract, subject to assignment/capability checks | Same admin exclusions | Server assignment and action checks |
| Salon Head | Therapist/service-provider surfaces plus any proven supervisory action | Assigned service and attendance actions; unresolved supervisory mapping stays for C4 | Owner/CRM/finance/payroll administration unless separately authorized | Existing action-specific server checks |
| CRM / General Staff — CRM / CSR aliases | Today, Work, Scan, Messages/Notices, More | Existing CRM/staff self-service actions within server capability | Full Owner/Finance/Payroll/Marketing administration unless separately authorized | CRM/staff action helpers, route checks, RPC/RLS |
| CRM / General Staff — General Staff context | Today, Work, Scan where permitted, More | Own schedule, attendance and assigned operational actions already supported | CRM administration, catalog, payroll, branch and role administration | Staff portal actions and assignment checks |
| Utility | Today, Scan, Messages/Notices, More where supported; conceptual Work is BLOCKED pending existing-source proof | Only existing server-authorized attendance/schedule/scan surfaces | Invented task-management backend and unrelated administration | Existing workspace/page/action checks; unresolved mapping goes to C4 |
| Driver | Today, Trips, Scan, Map, More | Assigned trip transitions, navigation handoff, explicit location snapshot and attendance where authorized | Hidden 24/7 tracking, arbitrary trip/customer access, CRM/owner administration | Driver workspace, assignment checks, location action, attendance policy |
| Manager — existing authorization context / correction authority only | Existing surfaces where granted; no new V1 PWA workspace | Existing authorized actions/corrections only; this row grants no PWA capability | Owner-only administration not granted by presentation mode | Existing manager/CRM action checks |
| Owner — existing authorization context / correction authority only | Existing surfaces where granted; no new V1 PWA workspace | Existing authorized operations/corrections subject to server checks; this row grants no PWA capability | No client-side bypass; production/data actions remain separately governed | Owner routes/actions, Auth/RLS and server policy |

Capability labels remain intentionally broad where C2 did not establish exact permission mapping. PWA-C4/PWA-C5 or the relevant implementation stage must resolve the exact action matrix without broadening authority.

The seven approved operational groups are Therapist, Nail Tech, Aesthetician / Facialist, Salon Head, CRM / General Staff, Utility, and Driver. The two CRM/general rows describe contexts within one approved group. Manager and Owner are retained solely as existing authorization context / correction authority, not additional Staff-PWA V1 operational groups or workspaces.

## G. Conceptual navigation freeze

This is a destination contract, not a visual design. PWA-C4 may specify layout, states, labels and accessibility without reopening these product destinations.

- **Therapist/service provider:** Today · Schedule · Scan · Progress · More
- **CRM/general staff:** Today · Work · Scan · Messages/Notices · More
- **Utility:** Today · Work · Scan · Messages/Notices · More, limited to proven capabilities; Work remains conceptual and **BLOCKED** until existing authoritative information is established (PWA-C3-Q009)
- **Driver:** Today · Trips · Scan · Map · More

The dedicated `/driver` workspace owns Driver V1. Existing `/staff-portal/...` links in Driver navigation must be safely redirected or refactored later after consumer inspection; Staff Portal access must not be broadened. Utility owns `/utility` as a role-aware shell; the existing “Back to Staff Portal” seam must not be turned into a permission grant or redirect loop. If a named destination lacks a proven backend, it remains a C4 contract question or is blocked rather than inventing a service.

## H. Scanner contract freeze

```text
Camera
→ decode QR
→ extract approved public identifier
→ existing server-authoritative scan contract
→ server resolves QR type
→ server authenticates/authorizes
→ server validates current state
→ authoritative mutation
→ confirmed result
```

The client never chooses Attendance versus Service Start, grants capability from QR contents, writes a second scan authority, or shows success before the server confirms. Attendance, room/resource and Service Start remain existing server-resolved intents. Operation IDs, scan events, transaction dedupe and existing recovery/correction paths remain authoritative. Camera permission denial, malformed codes, retry, duplicate submission and manager fallback are C4/C6 interaction and reliability contracts.

## I. Attendance and Remote End Shift freeze

### Attendance contract

Attendance remains server-authoritative and separate from service progress. The source-of-truth chain is the existing attendance record, server timestamp, schedule/branch policy, device trust, QR event/audit records and restricted RPC/action contracts. Direct widget, QR, portal, correction, exception, activation, recovery and recalculation consumers are preserved until a later safe canonical command contract is proven.

### Remote End Shift contract

Remote End Shift is V1 scope as a controlled exception and is implemented only in PWA-C14 after C4 contract work. Server-authoritative eligibility must explicitly include:

- an open attendance shift;
- no active service/work;
- no active Driver trip where applicable;
- no remaining assignment;
- final-assignment state;
- capability;
- timing/policy; and
- return-to-branch expectation where applicable.

It must be separately audited, server-authorized and clearly distinct from a branch QR. C3 freezes these eligibility requirements, not the exact timing/policy formula; **PWA-C3-Q004** remains the owner of that unresolved detail. No tables, columns, RPC names or eligibility SQL are invented.

### Service-provider contract

Therapist, Nail Tech, Aesthetician / Facialist and Salon Head share the existing booking/service-progress state machines, assignment validation and Service Start contract. Today, next service, own schedule, active timer/status, completion and home-service work reuse the master-matrix authorities. These are the canonical existing V1 service-progress sequences:

**In-spa:**

```text
not_started → checked_in → session_started → completed
```

**Home service:**

```text
not_started → travel_started → arrived → session_started → completed
```

PWA-C4 may design presentation/interactions but may not invent or reorder states. PWA-C8 must reuse the existing server-authoritative transition contract. Multi-provider assignment validation remains server authoritative. Service completion does not automatically clock staff out. Service-end QR remains **OUT OF V1**. No new statuses are introduced, and both later stages remain subject to separate authorization.

## J. Driver and reliability freeze

### Driver core contract

Dedicated `/driver` owns Today, assigned trips, active-trip Start Travel / Arrived / Return / Complete transitions, and permitted navigation handoff. Existing server trip/assignment authority remains in control; a map or external navigation launch cannot confirm a trip transition. Attendance and end-shift eligibility remain separate from trip progress.

### Driver location/map contract

Driver is a first-class, map-centered active-trip workspace. V1 reuses the existing assigned-trip actions and location snapshot foundation, adds a later explicit trip-scoped lifecycle, and communicates with the existing CRM Live Map contract. A snapshot is not continuous tracking. Background location remains **UNPROVEN — REAL DEVICE TEST REQUIRED**. If required reliability cannot be proven by a pure PWA, the work stops for **ARCHITECTURE DECISION REQUIRED LATER**; C3 does not select Capacitor or native code.

Continuous tracking, background tracking, stale thresholds, reconnect behavior, provider readiness, device permissions and cross-client convergence are gates for PWA-C12/PWA-C13 and later security/reliability review. No hidden 24/7 tracking is in scope.

### CRM Live Map contract

Driver location communicates through the existing location-snapshot and CRM Live Operations query/map contracts, under server branch/trip authorization. The current 30-second CRM poll is repository evidence, not an approved Driver capture cadence or delivery guarantee. PWA-C4 must distinguish location age, stale, empty, error and offline states; PWA-C12/PWA-C13 must prove cross-client convergence, reconnect behavior and freshness against the agreed contract. Exact thresholds and capture cadence remain PWA-C3-Q001/Q002.

### PWA/service-worker foundation

The master matrix requires an install manifest, standalone launch, reused icons, session persistence and role-aware shared foundation in PWA-C5. Preserve `public/cradlehub-push-sw.js` and legacy `public/sw.js` until a compatible registration, scope, cache and update owner is defined and proven. The ownership requirement is frozen; the exact strategy remains PWA-C3-Q006. PWA-C5/PWA-C15 must verify installation, upgrades and push coexistence on known environments before release; no existing worker is changed in C3.

## K. Connectivity, privacy, and security freeze

### Connectivity/offline contract

V1 is online-first. Attendance, Service Start, service completion, trip transitions and Remote End Shift have no authoritative offline queue. Previously loaded read-only information may remain visible. A failed mutation must identify that it was not recorded; offline UI must not imply eventual success.

### Customer data/privacy

The PWA sends only the minimum customer information needed by each role and surface. Therapist/service views generally need assigned service identity, timing and progress; drivers may need destination and navigation fields for an active assigned trip; CRM Live Map may need the minimum current-trip identity and coordinates. The minimization rule is frozen; exact field allowlists and retention/cache policy remain PWA-C3-Q008. Full customer address/contact fields, broad cross-role payloads, durable operational caches and indefinite location retention are not assumed. PWA-C17 must verify field, retention, cache, access and logging boundaries against an authorized target.

Security is server-owned: no local capability grants, no service-role browser secrets, no QR authorization, no direct-URL bypass, no permission cache as authority, and no hidden tracking. Push subscription ownership, RLS and provider delivery remain security/reliability gates, not C3 fixes.

### Notifications

Reuse existing push infrastructure and permitted operational notices/messages only; recipient/role authority stays on the server. Subscription ownership hardening remains a PWA-C15/PWA-C17 gate because C2 recorded a route ownership seam without deployed-policy verification. Worker coexistence follows PWA-C3-Q006; provider/device delivery acceptance follows PWA-C3-Q007. No notification delivery, ownership fix or deployed policy correctness is claimed by C3.

### Utility boundary

Utility Attendance, schedule and Scan may proceed in later authorized stages only where existing authoritative capabilities are evidenced. Utility task-management backend is **OUT OF V1**. The conceptual Work destination is not evidence of a backend: if PWA-C4 retains it, C4 must establish what existing authoritative information can populate it and specify its labels/interactions; otherwise it remains **BLOCKED**. PWA-C3-Q009 owns that unresolved contract. Neither navigation visibility nor the `/utility` shell grants permission or authorizes new task services.

## L. Explicitly out of V1

- A second operational database or browser/local storage authority.
- Native Android/iOS applications or Capacitor selection.
- GPS-based automatic attendance or hidden/background surveillance.
- Broad offline mutation queue or fake queued success.
- Full Owner, Finance, Payroll, Marketing, Staff or Customer administration.
- Full CRM admin recreation inside the Staff PWA.
- Speculative reports or reporting surfaces not already approved.
- Fabricated route geometry.
- Fabricated ETA.
- Client-generated or guessed navigation/travel promises presented as authoritative.
- Utility task-management backend.
- Service-end QR requirement.
- Client-selected QR intent or client-side authorization.
- Unbounded customer-data replication, broad operational cache or unreviewed location retention.
- Any migration, schema, Auth, RLS, Storage, production-data or deployment change during C3.

Real route/ETA functionality may appear only in a later separately authorized stage when backed by an approved provider/server source and the required verification. This condition does not change the approved Driver scope or authorize route/ETA implementation in C3 or C4.

## C3 Decision Register

This is the **canonical C3 decision register**. `PWA-C3-Dxxx` identifies frozen product/contract decisions; the master matrix and contracts above supply their detail. Evidence is the accepted [C1 truth map](PWA-C1-TRUTH-MAP.md), [C2 diagnostics](PWA-C2-STRUCTURED-DIAGNOSTICS.md) and [owner-approved project direction](PROJECT.md#approved-product-constraints), not new live verification. Later-stage references allocate responsibility only; every stage after C3 remains **NOT AUTHORIZED**.

| Decision ID | Topic | Frozen decision | Evidence basis | Consequence | Later owner stage |
| --- | --- | --- | --- | --- | --- |
| PWA-C3-D001 | Single Staff PWA / backend | One Staff PWA uses the existing CradleHub operational backend; no second authority database. | PROJECT product model; C1 system truth; section B | Reuse existing operational contracts and consumers. | PWA-C4/C5; FINAL |
| PWA-C3-D002 | Server authorization | Authenticated server actions, RPCs and database policy remain authoritative; UI mode, QR, URL, device registration and local caches grant no capability. | C2 role/access evidence; section F | Preserve action-specific checks, role-change denial and server-only credential boundaries. | PWA-C5 and every implementation stage; PWA-C17 |
| PWA-C3-D003 | Business date | All branch-day operations share canonical CRM branch-business-date authority. | PWA-C2-001; section E | Cross-surface branch-midnight acceptance; no alternate UTC/client authority. | PWA-C4/C5/C7/C8/C9/C11/C12 |
| PWA-C3-D004 | Universal Scan | One prominent Scan action captures a public identifier; the server resolves Attendance/room/resource/Service Start intent and confirms the result. | PROJECT scanner direction; PWA-C2-005; section H | No client-selected purpose, QR permission or premature success. | PWA-C4/C6 |
| PWA-C3-D005 | Attendance authority | Preserve server timestamps, branch/policy checks, device trust and existing QR/widget/portal/correction/recovery consumers until safe command reconciliation is proven. | PWA-C2-002; section I | Specify read-side recalculation, idempotency and audit boundaries before replacement. | PWA-C4/C7; PWA-C17 |
| PWA-C3-D006 | Attendance/service separation | Service progress and attendance remain separate; service completion never automatically clocks out staff. | PROJECT Attendance/service-provider direction; section I | Test completion and attendance as independent transitions. | PWA-C4/C7/C8 |
| PWA-C3-D007 | Remote End Shift | Separate audited server-authorized off-site exception; require open attendance shift, no active service/work, no active Driver trip where applicable, no remaining assignment, final-assignment state, capability, timing/policy and return-to-branch expectation where applicable. | PROJECT Remote End Shift; C2 policy/portal evidence; section I; owner targeted correction | No fake branch scan; exact timing/policy formula remains PWA-C3-Q004. | PWA-C4/C14; PWA-C17 |
| PWA-C3-D008 | Service-provider state machines | Reuse the exact canonical existing V1 sequences frozen in the Service-provider contract: in-spa `not_started → checked_in → session_started → completed`; home service `not_started → travel_started → arrived → session_started → completed`. | PROJECT service-provider direction; C1/C2 service evidence; section I; owner targeted correction | C4 may design presentation/interactions, not invent or reorder states; C8 must reuse server-authoritative transitions and multi-provider assignment validation. Preserve home-service minimum data; completion never automatically clocks staff out; service-end QR is OUT OF V1. | PWA-C4/C8 |
| PWA-C3-D009 | Driver workspace/core | Dedicated `/driver` owns map-centered assigned-trip work and existing trip transitions/navigation handoff. | PROJECT Driver direction; PWA-C2-004; sections G/J | Repair conflicting links later without broadening Staff Portal access. | PWA-C4/C11/C12 |
| PWA-C3-D010 | Trip-scoped location | Explicit active-trip lifecycle reuses server-authorized location snapshots; no hidden 24/7 tracking. | PROJECT Driver direction; PWA-C2-003; section J | Snapshot evidence is not continuous delivery; lifecycle/stop/cadence require later contracts. | PWA-C4/C11/C12/C13; PWA-C17 |
| PWA-C3-D011 | Background reliability gate | Continuous/background reliability is UNPROVEN — REAL DEVICE TEST REQUIRED; insufficient pure-PWA reliability requires a later architecture decision. | C2 Driver/device findings; section J | Do not claim background success or select native/Capacitor architecture in C3. | PWA-C13; owner architecture gate; FINAL |
| PWA-C3-D012 | Online-first mutations | Attendance, Service Start/completion, trip transitions and Remote End Shift require server confirmation; no authoritative offline queue. | PROJECT connectivity; PWA-C2-010; section K | Failed mutations are explicitly unrecorded; previously loaded read-only data cannot become authority. | PWA-C4/C5/C16; every operational stage |
| PWA-C3-D013 | Utility boundary | Only proven attendance/schedule/Scan and role-aware surfaces; task-management backend is OUT OF V1 and Work stays blocked pending existing-source proof. | PWA-C2-012; sections F/G/K | C4 resolves Q009 if retaining Work; no fabricated backend or permission grant. | PWA-C4/C10 |
| PWA-C3-D014 | Customer minimization | Minimum permitted fields per role/surface only; no unbounded customer replication, broad operational cache or indefinite location retention. | PWA-C2-009; section K | Exact allowlists, retention and cache policy require Q008 and target-aware review. | PWA-C4/C8/C11/C12; PWA-C17 |
| PWA-C3-D015 | PWA/worker foundation ownership | Installability, manifest, standalone launch, reused icons and sessions require shared foundation; preserve both worker artifacts until compatible registration/cache/update ownership is proven. | PWA-C2-008; master matrix; section J | Q006 precedes worker changes; installed-mode/update and push regression gates remain. | PWA-C4/C5/C15 |
| PWA-C3-D016 | Notification ownership/security | Reuse existing push and permitted operational notices under server recipient authority; subscription ownership and device/provider delivery remain gates. | PWA-C2-006; master matrix; section K | No delivery or deployed-policy assurance; Q007 and ownership review required. | PWA-C15/C17 |
| PWA-C3-D017 | Explicit V1 exclusions | Section L's exclusions are binding, including native apps, second authority, GPS attendance, hidden tracking, offline queue, full admin recreation, Utility backend and service-end QR. | PROJECT V1 exclusions; section L | Later contract questions cannot silently expand product scope. | Every later owner stage; FINAL |
| PWA-C3-D018 | Role/navigation scope | Seven approved operational groups and section G's conceptual destinations; Manager/Owner are existing authorization/correction contexts only. | PROJECT operational groups; C2 role/access evidence; sections F/G | No new Manager/Owner V1 workspaces; unresolved capability mappings cannot broaden access. | PWA-C4/C5; relevant role stages; PWA-C17 |
| PWA-C3-D019 | CRM/general surfaces | Reuse personal Today, own schedule, attendance, shared Scan, existing notices and narrowly permitted CRM shortcuts. | Master matrix; C1/C2 staff/CRM evidence | No full CRM administration recreation. | PWA-C4/C9/C15 |
| PWA-C3-D020 | CRM Live Map/freshness | Communicate through existing authorized snapshot/CRM map contracts; distinguish age, stale, empty, error and offline states. | PWA-C2-003/007/011; section J | Exact thresholds/cadence remain Q001/Q002; provider and cross-client convergence require evidence. | PWA-C4/C12/C13 |
| PWA-C3-D021 | Scan retry and controlled recovery | Preserve operation IDs, server dedupe and existing correction/recovery authority; camera permission failures and retries need explicit recovery states. | C2 scanner/attendance evidence; section H; master matrix | Retry cannot duplicate committed work; fallback is never a client override or new Manager workspace. | PWA-C4/C6/C7/C8 |

## Open Contract Questions

These questions concern unresolved implementation, interaction or acceptance details within the frozen scope. They do not reopen product decisions or authorize execution. A target-stage entry means responsibility **if separately authorized**.

| Question ID | Topic | Why not frozen in C3 | Required evidence/decision | Target stage |
| --- | --- | --- | --- | --- |
| PWA-C3-Q001 | Location stale/recent threshold | C2 exposes timestamps and polling, not an accepted freshness bound. | Define exact age thresholds and stale/recent/error/offline labels; verify server timestamp age and cross-client/reconnect cases. D010/D020 remain fixed. | PWA-C4 specification; PWA-C12/C13 proof |
| PWA-C3-Q002 | Driver foreground snapshot cadence | One-shot capture and a 30-second CRM poll do not define Driver capture cadence. | Agree capture cadence and foreground/reconnect/stop behavior using device, battery/network and convergence evidence; retain explicit trip scope. | PWA-C4 contract; PWA-C11/C12; PWA-C13 measurement |
| PWA-C3-Q003 | Pure-PWA background reliability | No real-device background or sustained delivery proof exists. | Define measurable required reliability and test supported Android/iPhone lifecycle cases; stop for owner architecture decision if pure PWA cannot meet it. | PWA-C13; owner architecture gate; FINAL |
| PWA-C3-Q004 | Remote End Shift policy/timing formula | C3 freezes eligibility considerations, not exact windows, cutoffs or return-rule formula. | Reconcile existing policy/portal contracts with owner-approved timing/capability rules and active/remaining/final work, duplicate and audit cases. | PWA-C4 design; PWA-C14; PWA-C17 authorization review |
| PWA-C3-Q005 | Exact capability mapping | C2 did not establish every action mapping, including Salon Head supervision and Utility access. | Produce source-backed role/action/direct-route matrix and denial cases for the seven groups; retain Manager/Owner correction context only. | PWA-C4/C5 and relevant role stages; PWA-C17 |
| PWA-C3-Q006 | Worker registration/cache/update strategy | Legacy cache-clearing/self-unregistering worker and push worker coexist without a unified proven owner. | Inventory registrations, scope and caches in a known environment; define compatible lifecycle/update ownership and prove install/upgrade/push preservation. | PWA-C4 contract; PWA-C5/C15 implementation and verification |
| PWA-C3-Q007 | Notification provider/device delivery acceptance | Existing subscription and push code is not delivery evidence. | Agree permitted notice/recipient and supported-device acceptance cases; prove ownership, permission/revocation, subscription lifecycle and actual provider delivery. | PWA-C15; PWA-C17 ownership/security gate |
| PWA-C3-Q008 | Customer/location retention and cache policy | Minimization is fixed, but exact field allowlists, retention durations and safe read-only cache limits lack an approved contract. | Inventory fields by role/surface and approve access, retention/deletion, cache invalidation and logging boundaries; verify against an explicitly authorized target. | PWA-C4 contract; PWA-C8/C11/C12 consumers; PWA-C17 gate |
| PWA-C3-Q009 | Blocked Utility Work labels/interactions | Utility is a Coming Soon surface without a task-management backend; a conceptual destination is not data authority. | If C4 retains Work, identify existing authoritative information and capability checks that can populate it and specify labels/blocked interactions; otherwise keep it blocked. Task-management backend remains OUT OF V1. | PWA-C4 resolution; PWA-C10 only within proven capabilities |
| PWA-C3-Q010 | Google Maps/provider readiness | C2 has no device/provider/configuration acceptance evidence. | Establish permitted provider/key/readiness, loading/failure, geolocation-permission and navigation-handoff acceptance on supported devices without exposing credentials. | PWA-C4 states; PWA-C11/C12; PWA-C13 device gate |
| PWA-C3-Q011 | Attendance command/read-side reconciliation | QR, widget, portal and correction paths coexist; page reads may recalculate policy. | Map consumers and side effects; specify canonical commands, timestamps, audit/source links, retry/dedupe and preserved-path reconciliation before replacement. | PWA-C4 contract; PWA-C7 proof |

## Stage Ownership Map

This map assigns the already-frozen work to the approved roadmap. **PWA-C4 through FINAL are NOT AUTHORIZED.** Design ownership is not implementation permission; implementation ownership is not proof of reliability, security, training readiness or release acceptance. Each stage needs its separate owner gate.

| Frozen capability | Design stage | Implementation stage | Reliability/security gate |
| --- | --- | --- | --- |
| Frozen roles, navigation and contract states (D001–D021) | PWA-C4 UI/UX Specification | Relevant stages below, only after design acceptance | C4 must resolve or explicitly carry Q001–Q011; no scope expansion |
| Install/manifest/icons/session, worker ownership, role shell and shared connectivity/date contracts (D001/D002/D003/D012/D015/D018) | PWA-C4 UI/UX Specification | PWA-C5 Shared Foundation | Install/update/session/role/date checks; PWA-C15 worker coexistence; PWA-C17 security |
| Universal server-resolved Scan and retry/recovery (D004/D021) | PWA-C4 UI/UX Specification | PWA-C6 Intelligent Scanner | Camera/device, malformed/duplicate/denial cases; PWA-C17 authority review |
| Attendance/device/recovery and command reconciliation (D003/D005/D006/D021) | PWA-C4 UI/UX Specification | PWA-C7 Attendance | Server clock, branch, device, audit, idempotency and cross-path checks |
| Shared service-provider work and assigned progress (D003/D006/D008/D014) | PWA-C4 UI/UX Specification | PWA-C8 Therapist / Salon | Assignment/start/completion and attendance separation; PWA-C17 minimum-data review |
| Personal Today/schedule, attendance/Scan and narrow CRM shortcuts (D003/D018/D019) | PWA-C4 UI/UX Specification | PWA-C9 General / CRM | Role/date/direct-route checks; no full CRM recreation |
| Utility shell and proven attendance/schedule/Scan (D013/D018) | PWA-C4 UI/UX Specification; Q009 required for Work | PWA-C10 Utility | Existing-source/capability proof; Work otherwise blocked; no task backend |
| Dedicated Driver trips, transitions, snapshot foundation and navigation handoff (D003/D009/D010) | PWA-C4 UI/UX Specification | PWA-C11 Driver Core | Assigned-trip/server-confirmed transitions; lifecycle/stop/permission cases |
| Driver map, CRM Live Map communication and visible freshness (D010/D014/D020) | PWA-C4 UI/UX Specification | PWA-C12 Driver Live Map | Q001/Q002/Q010; provider, minimal fields and cross-client convergence |
| Driver foreground/reconnect/background reliability assessment (D010/D011/D020) | PWA-C4 acceptance contract; owner architecture decision if needed | PWA-C13 Driver Reliability, within authorized architecture only | Real-device matrix, lifecycle/stop, latency and background proof; stop if pure PWA fails requirements |
| Controlled Remote End Shift (D007) | PWA-C4 UI/UX Specification | PWA-C14 Remote Off-Site Checkout | Q004; eligibility/timing/return rules, active work, separate audit and server capability |
| Existing push/notices and subscription ownership (D015/D016/D019) | PWA-C4 UI/UX Specification | PWA-C15 Notifications | Q006/Q007; provider/device delivery, update coexistence, recipient ownership; PWA-C17 |
| Online-first responsiveness and recovery/freshness performance (D012/D020) | PWA-C4 states and acceptance criteria | PWA-C16 Performance | Measured workload/network/device evidence; failed mutations cannot imply success |
| Server authority, minimum data, retention/cache and push ownership (D002/D010/D014/D016/D018) | PWA-C4 contract inputs; exact mappings/limits remain gated | PWA-C17 Security | Explicitly identified and authorized targets; access/denial, payload, logs, cache, retention and deployed-policy evidence |
| Accessible navigation, camera permission, errors and retry states | PWA-C4 UI/UX Specification | PWA-C18 UX / Accessibility | Supported-device interaction/accessibility acceptance for the frozen flows |
| Operational training readiness for frozen flows | PWA-C4 flow/error specifications inform training | PWA-C19 Training Readiness | Completed applicable operational, reliability, security and UX gates; no readiness inferred from C3 |
| Certified release of frozen V1 only (D017) | Accepted C4 specifications plus resolved acceptance questions | FINAL Release Certification; release only with separate owner authorization | All applicable stage evidence, real-device/provider and target-specific checks; explicit accepted review/owner release gate |

## M. C4 design inputs and later decision dependencies

PWA-C4 must design around this frozen scope: role destinations, server-confirmed scanner states, attendance/read-side side effects, Remote End Shift eligibility states, branch-business-date acceptance, Driver `/driver` ownership, Utility blocked capabilities, worker coexistence, online-first failure states, minimum customer fields, map freshness, camera permission recovery, touch targets, safe-area behavior and accessible error/retry states. C4 may resolve interaction and measurable acceptance details; it may not add a new product group, authority database, hidden tracking model, or admin surface.

The following remain gates rather than silent assumptions: deployed RLS and RPC behavior; push ownership; Google Maps/provider configuration; Android/iPhone camera and installed-mode behavior; background location; cross-client location convergence; exact capability mapping where C2 evidence is incomplete; and customer-data retention/cache policy.

## N. Verification and stop gate

### Verification limitations

Production/device/database behavior remains **UNKNOWN / NOT VERIFIED**. No current deployed RPC/RLS, install, camera, Maps, push, background-location or cross-client behavior was tested. C3 makes documentation/governance corrections only. Repository production statements remain **REPOSITORY-RECORDED PRODUCTION EVIDENCE**.

Historical starting-state evidence for the original C3 artifact was:

- branch `stage/pwa-c3-final-scope-freeze`;
- `HEAD` and `origin/main` at `2b927303d2d6bc10b09a15f2542fdcfa6c066194`;
- clean working tree before C3 documentation;
- `git fetch origin --prune` attempted, but the sandbox could not write `.git/FETCH_HEAD`; exact refs were still independently equal.

The external-review correction pass separately verified a successful `git fetch origin --prune`, clean `stage/pwa-c3-final-scope-freeze` at previously reviewed head `1535f5e258190d0024ce50c87bb19f06f913a4e8`, `origin/main` and merge-base `2b927303d2d6bc10b09a15f2542fdcfa6c066194`, and relationship `0 2`. Remote main independently matches the accepted SHA. The original fetch limitation above is historical, not this correction pass's starting state. The [C3 handoff](PWA-C3-HANDOFF.md) records correction and publication evidence.

### Stop gate

This document is a scope freeze, not runtime verification. PWA-C3 stops after review artifacts are committed and pushed to the authorized branch. PWA-C4 and all implementation stages remain **NOT AUTHORIZED** until the owner explicitly advances them.
