# Master Sheet Stage 1C — read-only CRM projection contract

**Evidence class:** repository-recorded working evidence. **Target:** CradleHub Web. **Stage:** inspection and contract/design freeze only. **Branch:** `stage/master-sheet-readonly-projection`. **Accepted main/base:** `6a310021df66679d71daf753434e6c328e3181b4`. **Starting HEAD and remote:** `a678a3f7b540de869c4f9a9b2b349c6e67655ecb`. **Inspection date:** 2026-10-04. No application behavior, database target, migration, deployment, or production state was inspected or changed.

Labels below distinguish repository evidence from proposed behavior. A **RECOMMENDATION** is not an accepted product decision. Stage 1D requires separate owner authorization.

## 1. Current CRM consumers inspected

**VERIFIED FACT:** Today obtains a branch-scoped context, loads canonical schedule/pending bookings, payment state and other operational snapshots in its server page, then passes booking-shaped `queueData` and mutation actions to Cradle Flow ([Today page](../../src/app/(dashboard)/crm/today/page.tsx#L69), [Cradle Flow model](../../src/lib/crm/cradle-flow.ts#L3), [dashboard](../../src/components/features/crm/today/cradle-flow-dashboard.tsx#L41)). Cradle Flow computes stage/count/search from booking status and payment fields; its selected booking opens assignment, completion and checkout dialogs. A Sheet visit cannot enter `queueData` safely.

**VERIFIED FACT:** Bookings loads canonical rows and a daily payment summary in the server page; the client view refreshes from `/api/crm/bookings`, uses SWR, and feeds `WorkspaceBookingRow[]` to an actionable workspace ([page](../../src/app/(dashboard)/crm/bookings/page.tsx#L42), [API](../../src/app/api/crm/bookings/route.ts#L9), [view](../../src/components/features/bookings/crm-bookings-view.tsx#L79), [selected command pane](../../src/components/features/bookings/bookings-desktop-workspace.tsx#L141)). The booking model has an `id`, canonical status, payment and branch fields ([model](../../src/components/features/bookings/booking-workspace-types.ts#L5)).

**VERIFIED FACT:** Schedule loads `getDailySchedule`, availability, rules and resources by active branch/date and passes canonical staff rows into its interactive shell; `getDailySchedule` reads bookings, blocked times, overrides and check-ins ([page](../../src/app/(dashboard)/crm/schedule/page.tsx#L30), [query](../../src/lib/queries/schedule.ts#L309), [API refresh](../../src/app/api/crm/schedule/route.ts#L10)).

**VERIFIED FACT:** Customers loads canonical customer segments, search, stats and waitlist records; detail requires a UUID, retrieves a canonical profile and booking history, and offers customer notes/administrative booking controls ([list](../../src/app/(dashboard)/crm/customers/page.tsx#L25), [detail](../../src/app/(dashboard)/crm/[customerId]/page.tsx#L127), [customer actions](../../src/app/(dashboard)/crm/actions.ts#L68)).

**VERIFIED FACT:** Home Service Operations (`/crm/dispatch`) loads `getDispatchData` for the active branch; that query selects canonical `home_service` bookings and dispatch/tracking data. Its client workspace refreshes and computes operational status metrics from `DispatchData.items` ([page](../../src/app/(dashboard)/crm/dispatch/page.tsx#L13), [query](../../src/lib/queries/dispatch-queries.ts#L270), [workspace](../../src/components/features/dispatch/dispatch-workspace.tsx#L83)).

**VERIFIED FACT:** Cash Flow loads `getCashFlowData` for branch/date/filter and gives `CashFlowWorkspace` canonical financial summaries, ledger and sessions ([page](../../src/app/(dashboard)/crm/cash-flow/page.tsx#L10), [query](../../src/lib/cash-flow/cash-flow-queries.ts#L113), [workspace](../../src/components/features/cash-flow/cash-flow-workspace.tsx#L16)).

## 2. Existing source-of-truth boundaries

**VERIFIED FACT:** CRM page/API context derives user, role and branch server-side ([context](../../src/lib/queries/crm-context.ts#L134), [API context use](../../src/app/api/crm/bookings/route.ts#L10)). Canonical queries read Supabase `bookings`, `customers`, `staff`, `staff_schedules`-related schedule tables and financial tables. Booking operations, customer mutations, schedule mutations and financial posting use server actions/RPCs ([booking actions](../../src/app/(dashboard)/crm/bookings/actions.ts#L154), [customer actions](../../src/app/(dashboard)/crm/actions.ts#L81), [schedule actions](../../src/app/(dashboard)/crm/schedule/actions.ts#L86), [cash actions](../../src/lib/cash-flow/cash-flow-actions.ts#L105)). CRM permission helpers authorize canonical actions by role; their existence does not authorize applying those actions to external rows ([permissions](../../src/lib/auth/crm-permissions.ts#L65)).

**VERIFIED FACT:** The Sheet reader is `server-only`, uses GET with `no-store` and a read-scoped token, returns `available` or a bounded `unavailable` reason, and parses current/previous tabs ([reader](../../src/lib/integrations/google-sheets/sheet-reader.ts#L1)). The parsed `SheetVisit`/`SheetDuty` types carry `sourceType: MASTER_SHEET`, `readOnly: true`, raw values and review state; they carry no canonical booking, customer, staff, branch or transaction IDs ([types](../../src/lib/integrations/google-sheets/sheet-types.ts#L11)). Stage 1B live-read evidence is in [the prior validation report](master-sheet-stage1b-live-adc-validation.md); Stage 1C did not repeat a live read.

**RECOMMENDATION:** Maintain the one-way path: Sheet reader → parser → normalized Sheet model → distinct projection adapter → presentation. Never convert a Sheet row to `WorkspaceBookingRow`, `CradleFlowBooking`, `DailyScheduleBooking`, `DispatchData.items`, `LedgerRecordItem` or a customer row. Never add Sheet amounts to canonical aggregates.

## 3. Proposed insertion points

**RECOMMENDATION:** The smallest safe first consumer is an independent, visibly labeled Master Sheet reference panel within the existing CRM Today and Bookings presentation, with optional Schedule duty reference in a later Stage 1D slice. It receives a distinct discriminated `SheetReferenceState`, alongside existing canonical props, after CRM authorization. It must not be an item in interactive booking lists, stage counts, selected booking command panes, payment summaries, schedule staffing grids or dispatch status metrics. The panel may link between existing CRM surfaces using Sheet-specific location/date filters, never `bookingId` or canonical detail URLs.

**RECOMMENDATION:** Keep Sheet loading outside canonical `Promise.all` dependencies and outside `getCrmBookingsCommandCenterRows`, `getDailySchedule`, `getDispatchData` and `getCashFlowData`. The server-side projection adapter should accept only `SheetProjection` and authorized context, return a compact safe read model, and expose no mutation handler. If an authenticated refresh is later necessary, it must recheck CRM access/branch on each request; Stage 1C creates no route.

**PROJECT DECISION REQUIRED:** Confirm the first display placement and whether Schedule duty references are included in the initial Stage 1D slice. The recommendation is Today + Bookings reference panels first; Schedule after its branch rule is proven.

## 4. SheetVisit projection contract

**RECOMMENDATION:** A `SheetVisitReference` is a discriminated external object, not a booking. Its minimum fields are `kind: "sheet_visit"`, `sourceType: "MASTER_SHEET"`, `readOnly: true`, `sourceKey`, `contentFingerprint`, `sheetName`, `startRow`, `endRow`, `observedAt` (read time), `businessDate` in `Asia/Manila`, `timeRaw` (parsed display time only if unambiguous), `customer: { rawDisplayName, canonicalCustomerId: null }`, `staff: { rawDisplayNames, canonicalStaffIds: [] }`, `services` with raw name/hours/rate evidence, `locationRawValue`, `paymentEvidence`, `fuelEvidence`, `commissionEvidence`, `ambiguities`, `confidence`, `reviewReasons`, `branchState`, and `canonicalLink: { state: "UNLINKED" | "POSSIBLE_MATCH", canonicalId: null }`. Retain all raw evidence without inferring customer identity, payment settlement, staff assignment, booking status or visit completion. Missing date/time/customer remains visible only in review, not a dated operational item.

**VERIFIED FACT:** The parser already supplies source row spans, business date, raw customer/staff/location/service/payment fields, confidence and ambiguities ([types](../../src/lib/integrations/google-sheets/sheet-types.ts#L41), [parser](../../src/lib/integrations/google-sheets/sheet-parser.ts#L360)). `observedAt`, branch state and link state are proposed adapter metadata, not existing parser fields.

## 5. SheetDuty projection contract

**RECOMMENDATION:** `SheetDutyReference` has `kind: "sheet_duty"`, `sourceType`, `readOnly`, the same source identity/version fields, `businessDate`, `staff: { rawDisplayName, canonicalStaffId: null }`, `dutyRawValue`, `timeEvidence: null | { raw, certainty }`, `confidence`, `ambiguities`, `reviewReasons`, `branchState`, and `canonicalLink: UNLINKED` (or review-only `POSSIBLE_MATCH`). The parser does not currently provide duty time; do not imply a shift start/end or availability. Display in a separate Schedule reference area, never a `staff_schedules` cell, attendance presence, staffing count or availability rule.

**VERIFIED FACT:** `SheetDuty` currently exposes raw staff and duty values but no time or canonical staff ID ([types](../../src/lib/integrations/google-sheets/sheet-types.ts#L58)).

## 6. Customer reference recommendation

**RECOMMENDATION:** Defer a Customers list/detail projection at Stage 1. Names alone are inadequate identity evidence, while existing customer list/stat/detail surfaces assume real customer IDs and expose notes, history, segmentation and creation/edit actions. Customer text remains a raw reference within Sheet visit cards and Review. No Sheet-only customer receives a `/crm/[customerId]` link; no Sheet history enters `total_bookings`, loyalty, membership or customer payment flows.

**PROJECT DECISION REQUIRED:** A future external customer reference surface requires an explicit user value case, identity evidence threshold and privacy review before scope approval. No automatic create/merge.

## 7. Home Service reference recommendation

**RECOMMENDATION:** Preserve `locationRawValue` as evidence on the visit reference. Only an explicit, documented, unambiguous workbook marker may classify a visit as `HOME_SERVICE_EVIDENCE`; otherwise use `LOCATION_UNRESOLVED` and Needs Review. No address/geocode/route/fuel computation. Defer insertion in dispatch queue/map until reliable branch and home-service semantics are validated. No dispatch, route, driver, booking or tracking-session mutation.

**VERIFIED FACT:** The parser maps LOCATION/ADDRESS to a raw location field; the dispatch query only selects canonical bookings with `delivery_type = home_service` ([parser](../../src/lib/integrations/google-sheets/sheet-parser.ts#L47), [dispatch query](../../src/lib/queries/dispatch-queries.ts#L288)).

## 8. Financial evidence projection contract

**VERIFIED FACT:** Cash Flow builds from `financial_transactions`, `financial_account_movements`, booking orders and cash sessions. Expected physical cash is opening float plus posted drawer movements; transaction probes fail closed rather than display a plausible zero day ([query](../../src/lib/cash-flow/cash-flow-queries.ts#L87), [transactions](../../src/lib/cash-flow/cash-flow-queries.ts#L182), [sessions](../../src/lib/cash-flow/cash-flow-queries.ts#L267)). Cash Flow workspace uses these typed `today`, `ledger`, and `dayClose` values ([workspace](../../src/components/features/cash-flow/cash-flow-workspace.tsx#L381)).

**RECOMMENDATION:** `SheetFinancialEvidence` is embedded in a Sheet visit/reference review card: source identity/version/date, raw channel cell, parsed numeric amount *if reliable*, marker/ambiguity, and the explicit text “Sheet evidence only — not a recorded payment.” A standalone financial note remains a Review entry, not a transaction. Do not feed this type to `CashFlowWorkspaceData`, `LedgerRecordItem`, daily summary, coverage, payment mix, balances, expenses, tips, commissions, reconciliation or expected cash. A separate read-only Master Sheet financial/reference panel is safer than mixing evidence into Cash Flow tabs. If later displayed within Cash Flow, place it after the canonical workspace as a physically separate panel with no shared selectors, records or totals.

## 9. Read-only action matrix

**RECOMMENDATION:** `D` means denied and absent from the projected record UI. Server action authorization remains independently enforced for canonical IDs; hiding controls alone is insufficient.

| Projected type | Edit | Delete | Cancel | Confirm | Reschedule | Assign therapist | Assign driver | Start service | Complete service | Record payment | Refund | Add expense | Close cash session | Handover cash session | Modify customer | Modify schedule |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sheet visit | D | D | D | D | D | D | D | D | D | D | D | D | D | D | D | D |
| Sheet duty | D | D | D | D | D | D | D | D | D | D | D | D | D | D | D | D |
| Customer reference | D | D | D | D | D | D | D | D | D | D | D | D | D | D | D | D |
| Home-service evidence | D | D | D | D | D | D | D | D | D | D | D | D | D | D | D | D |
| Financial/review evidence | D | D | D | D | D | D | D | D | D | D | D | D | D | D | D | D |

**RECOMMENDATION:** A future operator could open an *independently verified canonical record* through its normal canonical route, with normal authorization, only after deterministic linking is explicitly designed and approved. The Sheet reference itself never acquires those actions; Stage 1 creates no link.

## 10. Source and provenance UX rule

**RECOMMENDATION:** Every Sheet card and detail repeats two text labels: **Master Sheet** and **Read only**. Use existing neutral/info badge styling ([badge](../../src/components/features/crm/premium/crm-status-badge.tsx#L1)); do not use canonical booking/payment status colors as the sole source cue. Show business date, tab, row span and “Observed [timestamp]” in a compact provenance line. Show `Needs review` or `Possible match` as separate evidence states. Do not display the spreadsheet ID/token or raw row payload in URLs. A Sheet key is not displayed as a booking reference.

## 11. Duplicate and possible-match contract

**RECOMMENDATION:** Default `UNLINKED`. `POSSIBLE_MATCH` is an advisory review state with reason/evidence and no hidden suppression. `CANONICAL_LINKED` is reserved for a future explicit, auditable mechanism; the Stage 1 adapter must never emit it. Do not merge/dedupe or hide either side by name, staff, time, service or phone fragment. A possible match must not affect counts or financial results. Even sourceKey matches only a Sheet location, not a real-world person or visit.

**RECOMMENDATION:** Future deterministic linkage would need an approved shared external identifier or human-reviewed canonical ID backed by branch, business date, customer identity and visit/service evidence, with collision handling and a durable audit trail. That is outside Stage 1.

## 12. Filtering and search behavior

**VERIFIED FACT:** Existing Bookings filtering compares canonical status/source/delivery/payment/assignment/branch fields and text search uses canonical booking values ([filters](../../src/lib/bookings/booking-list-exact-filters.ts#L17), [workspace](../../src/components/features/bookings/bookings-desktop-workspace.tsx#L19)). Today stage counts derive canonical booking states ([flow](../../src/lib/crm/cradle-flow.ts#L76)). Customers uses a separate `q`/segment search ([page](../../src/app/(dashboard)/crm/customers/page.tsx#L27)).

**RECOMMENDATION:** Sheet panels may obey a valid business-date filter and locally search raw customer/staff/service text, with a visible “Master Sheet references” scope. A staff/service filter may compare only normalized display text and label it unverified; no canonical ID/assignment inference. Canonical booking status, payment, assignment, customer segments and dispatch filters do not apply. Use separate `reviewState` and `sourceType` controls if needed. Do not map `recognized` to confirmed/completed/paid or blank location to in-spa.

## 13. Branch context behavior

**VERIFIED FACT:** `getFrontDeskContext` returns a concrete branch after server authorization; Today, Bookings, Schedule, Dispatch and Cash Flow use it ([context](../../src/lib/queries/crm-context.ts#L134)). The Sheet types/parser have no branch ID or verified branch mapping ([types](../../src/lib/integrations/google-sheets/sheet-types.ts#L41), [parser columns](../../src/lib/integrations/google-sheets/sheet-parser.ts#L20)). A workbook tab/name or prevalent Main Branch usage is not proof of row branch.

**RECOMMENDATION:** Adapter branch state is `PROVEN_BRANCH { branchId, evidence } | BRANCH_UNKNOWN`. Until an owner-approved mapping is established and validated against actual row evidence, all records are `BRANCH_UNKNOWN` and enter Needs Review; they must not appear in a branch's operational Today/Bookings/Schedule panel. Never default unknown to Main. Even owner cross-branch access is not permission to assign an unknown record to a branch. This gate may leave the initial reference panels empty; Review can show only data that the viewer is authorized to see under a separately approved scope. Without such scope, do not expose unknown-branch row details to ordinary branch users.

**PROJECT DECISION REQUIRED:** Define and evidence the workbook-to-branch authority and who may inspect unknown-branch Review records. This decision blocks operational branch projection.

## 14. Live Sheet volatility and fingerprint behavior

**VERIFIED FACT:** `sourceKey` hashes spreadsheet/tab/row coordinates; `contentFingerprint` hashes observed raw rows ([identity](../../src/lib/integrations/google-sheets/sheet-source-identity.ts#L10)). The reader fetches current and previous tab values independently, with no workbook snapshot transaction ([reader](../../src/lib/integrations/google-sheets/sheet-reader.ts#L91)). Stage 1B recorded live-read volatility.

**RECOMMENDATION:** On a later read, same sourceKey + new fingerprint means “source changed since last observation,” not a new canonical booking or proof of correction. Replace the currently displayed observation atomically; if a view still holds the previous observation, label it stale until refreshed. If location changes because rows are inserted/reordered, do not claim equality from fingerprint alone. Do not persist prior fingerprints or claim durable change history in Stage 1. Keep `observedAt` per response and avoid mixing two read generations in one panel.

## 15. Failure isolation contract

**RECOMMENDATION:** Sheet loading is optional, server-side, and separately caught after CRM authorization. Map reader `AUTH_NOT_CONFIGURED`, `AUTH_UNAVAILABLE`, `SHEETS_UNAVAILABLE`, `INVALID_RESPONSE`, `TAB_AMBIGUITY`, a missing current tab, parser failure and unexpected exceptions to a sanitized `unavailable` state. Canonical CRM page/API responses and actions still load and work. Do not pass an empty Sheet result as “zero visits.” Distinguish `available with review items`, `available empty`, `unavailable`, and `stale previous observation`; never reuse stale content without a timestamp/banner. A malformed row should become a safe Review item where parser classification can isolate it; if parsing the projection fails as a whole, fail the Sheet panel only. No auth error text, token or Sheet data in client error details.

**VERIFIED FACT:** The reader already maps authentication, API, response and tab ambiguity failures to bounded reasons; it does not throw provider errors to callers ([reader](../../src/lib/integrations/google-sheets/sheet-reader.ts#L12)). CRM schedule has its own canonical timeline fallback; that is not a Sheet failure boundary ([page](../../src/app/(dashboard)/crm/schedule/page.tsx#L37)).

## 16. Performance measurement plan

**VERIFIED FACT:** One Sheet read performs metadata GET plus two tab GETs in parallel after selection, each with a 15-second timeout and `no-store` ([reader](../../src/lib/integrations/google-sheets/sheet-reader.ts#L74)). Today already has a multi-source `Promise.all`; Bookings has SSR plus SWR API refresh; Schedule and Dispatch also refresh data ([Today](../../src/app/(dashboard)/crm/today/page.tsx#L80), [Bookings view](../../src/components/features/bookings/crm-bookings-view.tsx#L101), [Schedule API](../../src/app/api/crm/schedule/route.ts#L10), [Dispatch workspace](../../src/components/features/dispatch/dispatch-workspace.tsx#L83)). An eager Sheet request on each entry/reactivation risks extra latency/quota and two generations of data.

**RECOMMENDATION:** Before Stage 1D chooses an eager or opt-in panel, measure auth latency, metadata GET, each tab GET, parse/classify, adapter, payload bytes, total Sheet panel time, error rate, Sheet call count per CRM session, and canonical page TTFB with Sheet enabled/disabled. Capture p50/p95 under normal and unavailable Google conditions; log sanitized reason codes and counts, never row contents or credentials. Set a separately measured timeout budget and acceptance threshold. No cache or persistence is approved by this contract.

## 17. Security boundary

**RECOMMENDATION:** ADC impersonation and the read-only Sheets scope remain inside server-only modules. Browser receives only an authorized, minimized projection, never token, ADC file, service-account credentials, spreadsheet ID or raw full-row arrays. No public unauthenticated Sheet endpoint. Every future request rechecks the active user/role/branch; server actions must still validate canonical UUID/ownership independently. The projection adapter should not import canonical mutation modules. Sanitized display text is untrusted external input and should be rendered as text, not HTML. Unknown-branch records remain withheld until a viewer policy is approved.

**VERIFIED FACT:** The reader imports `server-only` and uses bearer token only on server GET; the CRM layout/context and existing CRM APIs require authenticated workspace context ([reader](../../src/lib/integrations/google-sheets/sheet-reader.ts#L1), [layout](../../src/app/(dashboard)/crm/layout.tsx#L32), [API](../../src/app/api/crm/bookings/route.ts#L10)). No Stage 1C endpoint was created.

## 18. Needs Review experience

**VERIFIED FACT:** The parser emits `needsReview` rows and visit/duty ambiguities; `buildSheetReviewEntries` already categorizes missing date/time/customer/staff, ambiguous payment/service markers, orphan/conflicting continuations, unassigned financial notes, out-of-week dates and unknown rows ([review model](../../src/lib/integrations/google-sheets/sheet-review.ts#L1)). `BRANCH_UNKNOWN` and possible-match are proposed projection-level reasons, not parser classifications.

**RECOMMENDATION:** Use one small, clearly titled **Master Sheet Review** area attached to the reference panel, with reason, date (or “Unknown”), tab/row span, raw safe summary, observed time and read-only state. Affected references may show a compact “Needs review” badge but should not duplicate full diagnostics in each module. Group unresolved branch and identity issues above harmless raw-value ambiguities. No “resolve” control, mutation or auto-correction in Stage 1D's first slice. If unknown-branch visibility is not approved, show only an authorized aggregate/unavailable state, not row details.

## 19. Exact proposed Stage 1D scope — not yet authorized

**RECOMMENDATION:** After owner decisions on branch authority, unknown-branch reviewer policy and placement: (1) implement pure discriminated projection types/adapter and unit tests for no canonical IDs/actions, branch gating, review mapping, duplicate states and fingerprint change; (2) add an optional server-only reader invocation behind existing CRM authorization with independent error state; (3) add a visually distinct Master Sheet reference panel to Today and Bookings, plus one compact Review area, with date/local text filtering and provenance; (4) keep all canonical query payloads, counts, selected booking panes and actions unchanged; (5) measure the performance/failure points above and verify authorized/unauthorized branch behavior; (6) add Schedule duty references only after a separate branch-evidence check within the approved Stage 1D slice. This is a proposed implementation boundary, not permission to implement now.

**PROJECT DECISION REQUIRED:** Owner must approve Stage 1D scope, branch evidence, placement, Review visibility, and measurable latency/error acceptance criteria before implementation. The first slice may need to be Review-only if branch remains unproven.

## 20. Explicitly deferred work, severity, and rollback

**RECOMMENDATION:** Defer Customers list/detail projection, dispatch queue/map integration, Cash Flow tab/ledger integration, any source-to-canonical matching/linking, customer creation/merge, booking/shift/payment/expense writes, financial reconciliation, import/sync, Sheet writes, persistence/cache, schema/migrations, new public routes, automated home-service classification without evidence, and cross-branch data exposure. No Stage 1D approval is inferred from this contract.

**VERIFIED FACT:** This inspection found no new P0/P1 canonical behavior issue. It did not execute user flows, database reads, Google reads or performance tests, so it cannot certify their runtime state. The known online-booking CRM-confirmation P1 is outside this stage. Stage 1C changes only this document. Rollback is a normal revert of the documentation commit on the stage branch; no data or runtime rollback is needed. No Supabase mutation, Google Sheet mutation, migration, CRM UI implementation, production operation, merge or deployment occurred.
