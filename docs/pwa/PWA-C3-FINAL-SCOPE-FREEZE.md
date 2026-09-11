# CradleHub Staff PWA — PWA-C3 Final Scope Freeze

**Program:** CradleHub Staff PWA
**Stage:** PWA-C3 — Final Scope Freeze
**Branch:** `stage/pwa-c3-final-scope-freeze`
**Accepted C2/main baseline:** `2b927303d2d6bc10b09a15f2542fdcfa6c066194`
**Status:** **PROJECT DECISION — PWA-C3 FREEZE**
**Execution boundary:** Scope, source-of-truth, authorization, navigation, and verification contracts only. Runtime implementation, UI redesign, database work, migration work, deployment, merge, and PWA-C4+ execution are not authorized.

## A. Authority and evidence boundary

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

| Operational group | Required PWA surfaces | Allowed operational actions | Explicitly excluded admin actions | Server authority |
| --- | --- | --- | --- | --- |
| Therapist | Today, Schedule, Scan, Progress, More | View own assigned work; start/complete permitted service work; attendance actions where server-authorized | User/role administration, pricing/catalog, payroll, broad CRM, branch administration | Existing staff/service actions, assignment checks, attendance RPCs/RLS |
| Nail Tech | Therapist/service-provider surfaces | Same shared service-provider contract, subject to assignment/capability checks | Same admin exclusions | Server assignment and action checks |
| Aesthetician / Facialist | Therapist/service-provider surfaces | Same shared service-provider contract, subject to assignment/capability checks | Same admin exclusions | Server assignment and action checks |
| Salon Head | Therapist/service-provider surfaces plus any proven supervisory action | Assigned service and attendance actions; unresolved supervisory mapping stays for C4 | Owner/CRM/finance/payroll administration unless separately authorized | Existing action-specific server checks |
| CRM / CSR aliases | Today, Work, Scan, Messages/Notices, More | Existing CRM/staff self-service actions within server capability | Full Owner/Finance/Payroll/Marketing administration unless separately authorized | CRM/staff action helpers, route checks, RPC/RLS |
| General Staff | Today, Work, Scan where permitted, More | Own schedule, attendance and assigned operational actions already supported | CRM administration, catalog, payroll, branch and role administration | Staff portal actions and assignment checks |
| Utility | Today, Work, Scan, Messages/Notices, More where supported | Only existing server-authorized attendance/schedule/scan surfaces | Invented task-management backend and unrelated administration | Existing workspace/page/action checks; unresolved mapping goes to C4 |
| Driver | Today, Trips, Scan, Map, More | Assigned trip transitions, navigation handoff, explicit location snapshot and attendance where authorized | Hidden 24/7 tracking, arbitrary trip/customer access, CRM/owner administration | Driver workspace, assignment checks, location action, attendance policy |
| Manager | Existing manager/staff/CRM surfaces where granted | Existing manager and staff actions only | Owner-only administration not granted by presentation mode | Existing manager/CRM action checks |
| Owner | Existing owner and operational surfaces where granted | Owner-authorized operations subject to server checks | No client-side bypass; production/data actions remain separately governed | Owner routes/actions, Auth/RLS and server policy |

Capability labels remain intentionally broad where C2 did not establish exact permission mapping. PWA-C4/PWA-C5 or the relevant implementation stage must resolve the exact action matrix without broadening authority.

## G. Conceptual navigation freeze

This is a destination contract, not a visual design. PWA-C4 may specify layout, states, labels and accessibility without reopening these product destinations.

- **Therapist/service provider:** Today · Schedule · Scan · Progress · More
- **CRM/general staff:** Today · Work · Scan · Messages/Notices · More
- **Utility:** Today · Work · Scan · Messages/Notices · More, limited to proven capabilities
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

Attendance remains server-authoritative and separate from service progress. The source-of-truth chain is the existing attendance record, server timestamp, schedule/branch policy, device trust, QR event/audit records and restricted RPC/action contracts. Direct widget, QR, portal, correction, exception, activation, recovery and recalculation consumers are preserved until a later safe canonical command contract is proven.

Remote End Shift is V1 scope as a controlled exception and is implemented only in PWA-C14 after C4 contract work. Eligibility must consider open shift, active service/work, remaining assignments, final assignment, capability, timing and return-to-branch expectation where applicable. It must be separately audited, server-authorized and clearly distinct from a branch QR. C3 freezes this behavior; it invents no tables, columns, RPC names or eligibility SQL.

## J. Driver and reliability freeze

Driver is a first-class, map-centered active-trip workspace. V1 reuses the existing assigned-trip actions and location snapshot foundation, adds a later explicit trip-scoped lifecycle, and communicates with the existing CRM Live Map contract. A snapshot is not continuous tracking. Background location remains **UNPROVEN — REAL DEVICE TEST REQUIRED**. If required reliability cannot be proven by a pure PWA, the work stops for **ARCHITECTURE DECISION REQUIRED LATER**; C3 does not select Capacitor or native code.

Continuous tracking, background tracking, stale thresholds, reconnect behavior, provider readiness, device permissions and cross-client convergence are gates for PWA-C12/PWA-C13 and later security/reliability review. No hidden 24/7 tracking is in scope.

## K. Connectivity, privacy, and security freeze

V1 is online-first. Attendance, Service Start, service completion, trip transitions and Remote End Shift have no authoritative offline queue. Previously loaded read-only information may remain visible. A failed mutation must identify that it was not recorded; offline UI must not imply eventual success.

The PWA sends only the minimum customer information needed by each role and surface. Therapist/service views generally need assigned service identity, timing and progress; drivers may need destination and navigation fields for an active assigned trip; CRM Live Map may need the minimum current-trip identity and coordinates. Full customer address/contact fields, broad cross-role payloads, durable operational caches and indefinite location retention are not assumed. PWA-C17 must verify field, retention, cache, access and logging boundaries against an authorized target.

Security is server-owned: no local capability grants, no service-role browser secrets, no QR authorization, no direct-URL bypass, no permission cache as authority, and no hidden tracking. Push subscription ownership, RLS and provider delivery remain security/reliability gates, not C3 fixes.

## L. Explicitly out of V1

- A second operational database or browser/local storage authority.
- Native Android/iOS applications or Capacitor selection.
- GPS-based automatic attendance or hidden/background surveillance.
- Broad offline mutation queue or fake queued success.
- Full Owner, Finance, Payroll, Marketing, Staff or Customer administration.
- Full CRM admin recreation inside the Staff PWA.
- Utility task-management backend without an approved source of truth.
- Service-end QR requirement.
- Client-selected QR intent or client-side authorization.
- Unbounded customer-data replication, broad operational cache or unreviewed location retention.
- Any migration, schema, Auth, RLS, Storage, production-data or deployment change during C3.

## M. C4 design inputs and later decision dependencies

PWA-C4 must design around this frozen scope: role destinations, server-confirmed scanner states, attendance/read-side side effects, Remote End Shift eligibility states, branch-business-date acceptance, Driver `/driver` ownership, Utility blocked capabilities, worker coexistence, online-first failure states, minimum customer fields, map freshness, camera permission recovery, touch targets, safe-area behavior and accessible error/retry states. C4 may resolve interaction and measurable acceptance details; it may not add a new product group, authority database, hidden tracking model, or admin surface.

The following remain gates rather than silent assumptions: deployed RLS and RPC behavior; push ownership; Google Maps/provider configuration; Android/iPhone camera and installed-mode behavior; background location; cross-client location convergence; exact capability mapping where C2 evidence is incomplete; and customer-data retention/cache policy.

## N. Verification and stop gate

Starting-state evidence for this stage was:

- branch `stage/pwa-c3-final-scope-freeze`;
- `HEAD` and `origin/main` at `2b927303d2d6bc10b09a15f2542fdcfa6c066194`;
- clean working tree before C3 documentation;
- `git fetch origin --prune` attempted, but the sandbox could not write `.git/FETCH_HEAD`; exact refs were still independently equal.

This document is a scope freeze, not runtime verification. PWA-C3 stops after review artifacts are committed and pushed to the authorized branch. PWA-C4 and all implementation stages remain **NOT AUTHORIZED** until the owner explicitly advances them.
