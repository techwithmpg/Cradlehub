# C5 Smart Sheet ingestion dry run

## Authorization and starting state

Owner request of 2026-09-25 authorizes only inspection, isolated dry-run implementation, tests and evidence in `E:\cradlehub-sheet-bridge`, on existing `stage/c5-sheet-assimilation-bridge`. Starting HEAD: `2d4b0f9ab62c51b8e7eb953b9352f14d070a0e4d`. No canonical writer, database/Sheet mutations, notifications, migration, branch switch, commit, push, merge or deployment. The separate Home Service worktree is outside scope.

## Protected concurrent work

Initial dirty/untracked files, captured with SHA-256 before changes:

- `.env.example`
- `src/app/(dashboard)/crm/bookings/page.tsx`
- `src/app/(dashboard)/crm/bookings/sheet/page.tsx`
- `src/app/(dashboard)/crm/cash-flow/page.tsx`
- `src/components/features/dashboard/nav-config.ts`
- `src/components/features/workspace/workspace-prefetch-config.ts`
- `src/lib/integrations/google-sheets/sheet-projection.ts`
- `src/lib/queries/cash-flow.ts`
- `tests/lib/cash-flow/cash-flow-module.test.ts`
- `tests/lib/integrations/google-sheets/sheet-projection.live.test.ts`
- `tests/lib/integrations/google-sheets/sheet-projection.test.ts`

Cash Flow owns its route/query/test and shared navigation changes. Sheet projection owns its route/query/tests and environment example. None needs editing for the intelligence layer; dependency direction remains Sheet to neutral financial intent, with no UI imports.

## Inspection and safe reuse map

| Existing owner / consumers | Authority and effects | Dry-run reuse |
| --- | --- | --- |
| Sheet reader, parser, accounting, merge normalizer; existing Sheet CRM projection/tests | Google ADC with spreadsheets.readonly; pure parsing/accounting; merge restoration only at parser-identified B/C/D targets | Keep existing contracts; new orchestration invokes pure parser/normalizer/accounting and the read-only reader |
| Public `online-booking.ts`, CRM `inhouse-booking.ts` / `inhouse-booking-engine.ts`; booking UI and Desktop consumers | Authenticated server boundaries; creation can upsert customers, insert bookings/payments, notify, revalidate, and compensate failed writes | Never invoke or refactor creation actions; use independent read-only adapters around already pure rules |
| `staff/service-providers.ts`, `staff/operational-staff.ts`; availability and assignment consumers | Explicit staff_services membership, operational state, branch and role restrictions | Reuse pure eligibility functions after batch context loading; availability never substitutes a resolved identity |
| `services/service-eligibility.ts`; service catalog, Public and CRM booking flows | Canonical service/branch activity, audience visibility and delivery modes; pure checks | Reuse pure branch-service checks; preserve unresolved delivery instead of defaulting from fuel/location |
| `schedule/resolve-staff-schedule.ts`, `schedule/schedule-coverage.ts`; availability and schedule consumers | Overrides outrank weekly windows; gaps, day off, overnight and role restrictions | Reuse pure schedule resolution and duration coverage with batch-read schedules/overrides |
| `bookings/hold-status.ts`, `engine/slot-time.ts`; availability consumers | Booking statuses/hold expiry govern blocking; pure interval/date helpers | Reuse for canonical overlap validation; return evidence rather than selecting a free substitute |
| `queries/customers.ts`; CRM customer views | Customers have no branch_id; branch membership comes from bookings; reads use cookie client | Batch branch customer links and customer records under the same authenticated branch. Names alone do not merge identities; Contacts/approved mapping input requires provenance |
| Home Service booking validations and dispatch reads | Home Service is canonical booking delivery; location evidence and dispatch metadata remain booking-owned | Model delivery/location uncertainty only. No Home Service entity or write |
| `queries/cash-flow.ts`, reconciliation | Canonical booking financial fields and closeout evidence; existing Cash Flow reads | Preserve split Sheet payment evidence; totals remain evidence only, never duplicate transactions |
| `bookings/ops-warnings.ts`, `notifications/create.ts` | Pure warning calculation versus side-effecting notification delivery | Separate decision/severity and structured attention contract; never call notification creation |

Existing tests cover parser, summaries, accounting, merge restoration and projection; pure provider/schedule/booking helpers have their own tests. New fixture tests will exercise adapters without changing those consumers or security boundaries. No live Supabase target/session is assumed; unavailable canonical context must remain explicit, never clean validation.

## Implementation plan

1. Pure source/schema/projection and preflight layers, preserving primary row types and raw evidence; targeted tests and preservation check.
2. Batched authenticated context, deterministic identity indexes, pure validation, decisions and correction/alias contracts; targeted tests and preservation check.
3. Full read-only orchestration, privacy-safe counts/timings, active-tab live regression and final static gates.

## Live baseline observation before implementation

Read-only baseline command:

`$env:CRADLE_SHEET_LIVE_TEST='1'; node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/lib/integrations/google-sheets/sheet-merge-normalizer.live.test.ts`

The existing test failed its historical 701 assertion: live raw and normalized meaningful counts were both **702**, financial_or_note **138**. Other types remained header 7, aggregate_summary 14, staff_duty 38, service_candidate 414, informational 91, unknown 0. Restorations remained attendant 217, client 20, time 2 (239 total); unresolved time remained 30. A second read inspected only header labels/date blocks: all seven operational headers retain B:M semantics, with observed BANK TRANSFER/QR or BANK TRANSFER and CARD/ TERMINAL label variants. Daily operational dates remain September 18–24, 2026. Pre-header stale summary dates remain evidence and must not override block dates. Values read: 1010 rows.

This is measured content drift, not permission to alter parser classifications to force 701. Historical counts remain documented; live expectations may be updated only in the specific fixture tests, with this evidence. No customer names/phones/addresses were printed.

## Completion evidence

Implementation and final verification pending.
