# Saturday Front Desk stabilization handoff — 2026-10-15

## Status and authority

**CORRECTION REQUIRED for release verification; ready for independent code review.** The owner authorized a bounded Web CRM stabilization on the existing branch, with Phase 1 branch scope first. This handoff covers repository implementation and local tests. Authenticated TEST/STAGING operation and performance were not verified. No merge, deployment, production migration, Desktop work, or production data mutation was authorized or performed.

- Repository: `techwithmpg/Cradlehub` at `E:\cradlehub`.
- Accepted base: fetched `origin/main` at `f60793d205ef9599c891e763a22a7ecd3008561f`.
- Implementation branch: `stage/crm-performance-stabilization`.
- Implementation HEAD before this report: `99b9d88cd59464b3bd6a1057a8ed1a78bfde2902`. The report commit becomes the final HEAD; its SHA is in the task response.
- Push: not performed. Merge: not performed.
- Branch commits after the base: `d2c5d352` Today/layout request ordering; `4010433b` Today request-order test; `e0c199e6` Owner search and prefill scope; `38c120a2` Front Desk loading, feedback, alerts; `99b9d88c` phone lookup scope. The first two were made in the prior stabilization turn.

## Corrections and decisions

| Area | Change | Evidence and limit |
| --- | --- | --- |
| P1 branch scope | Direct `/api/customers/search` and `/api/customers/lookup` resolve the Owner's selected Front Desk branch server-side; other CRM roles use their assigned branch. Browser branch IDs do not grant scope. Customer search filters through branch booking membership; phone lookup verifies it before returning details. Quick Booking customer prefill checks branch booking membership before its privileged customer read. | Direct API, query, branch-switch, and prefill tests pass. A customer with no booking in the selected branch is not returned or prefilled. No live branch-switch test was available. |
| CRM entry | CRM layout no longer waits for branch booking options/rules. Its modal provider loads them through a server-authorized action after the layout renders and shows loading/error/retry states. Availability shows option-loading status. | Source-traced removal of one layout-blocking await; deferred-load UI tests pass. No authenticated timing or request-count measurement. |
| Today requests | Earlier branch commits overlap independent duty and Today reads, and overlap resource/tracking/driver enrichment reads. | Mocked scheduling test and build pass. No measured latency claim. |
| Interaction feedback | Confirm/check-in/start show pending labels; therapist and room assignment, legacy checkout and Cash Flow payment, and service completion show pending feedback. Synchronous guards prevent rapid duplicate submissions. Final paid/completed/confirmed states are shown only after server success. | Focused deferred-action UI tests pass for payment and completion. Server actions remain authoritative. |
| Alerts and clutter | Ordinary unpaid Pay-on-Site and active in-service balances do not create warning triangles. `Payment Overdue` requires started/completed service, elapsed recorded session deadline (or scheduled end), and a known positive balance. Actual assignment, staff schedule, and dispatch exceptions remain. Ready-to-Pay styling is neutral, the healthy header uses a check icon, and the duplicate Cash Flow rail link is removed. | Pure and rendered alert tests pass. A missing or invalid price/deadline does not invent an overdue alert. |
| Refresh | Booking-change events still refresh Today server props and invalidate retained workspace modules. | Kept for correctness because Today queue and finance summaries are server-derived; no narrower server reconciliation path exists in this pass. |

## Changed files

- Branch scope: `src/app/api/customers/search/route.ts`, `src/app/api/customers/lookup/route.ts`, `src/lib/queries/customers.ts`, `src/lib/queries/quick-booking-options.ts`, `src/lib/actions/administrative-booking.ts`, `src/app/(dashboard)/crm/bookings/new/page.tsx`.
- Loading: `src/app/(dashboard)/crm/layout.tsx`, `src/components/features/bookings/administrative-booking-modal-provider.tsx`, `src/components/features/crm/schedule/check-availability-modal.tsx`.
- Actions/alerts: `src/components/features/bookings/room-assignment-modal.tsx`, `src/components/features/bookings/selected-booking-warnings.tsx`, `src/components/features/cash-flow/record-financial-entry-modal.tsx`, `src/lib/crm/cradle-flow.ts`, and the touched `src/components/features/crm/today/cradle-flow-*` components.
- Tests: `tests/api/crm-customer-search-scope.test.ts`, `tests/app/crm/quick-booking-customer-callers.test.tsx`, `tests/lib/crm/customer-search-branch-filter.test.ts`, `tests/lib/crm/customer-phone-lookup-scope.test.ts`, `tests/lib/crm/quick-booking-customer-prefill-scope.test.ts`, `tests/lib/crm/cradle-flow-display.test.ts`, and three new `tests/components/crm/*` files for deferred options, action feedback, and payment warnings.
- Prior branch commits also changed CRM layout/Today page and `tests/app/crm/today-parallel-reads.test.tsx`; see the earlier performance handoff.

## Verification

- Phase 1 and Front Desk focused tests: **PASS**. Final selected group before phone-lookup follow-up: 8 files, 22 tests. Phone search/lookup follow-up: 3 files, 8 tests. Earlier Owner context tests: 5 files, 14 tests. UI feedback and alert tests also passed individually.
- `pnpm type-check`: **PASS** after removing one corrupted ignored generated `.next/dev/types/validator.ts` file. Next's `typegen` command failed under Windows path access, but a clean TypeScript rerun and two production builds succeeded.
- Targeted lint over changed source and test files: **PASS**.
- `pnpm build` with Next.js 16.2.4: **PASS** after the final API change.
- Main-checkout `pnpm exec vitest run --exclude '**/.claude/**'`: **2,600 passed, 4 failed, 2 skipped**. Three failures in untouched `tests/app/crm/booking-actions.test.ts` match the prior baseline's stale exact-result assertions. One attendance reader timed out under full-suite load, then its file passed alone (24 tests). These failures are not presented as an all-green suite.
- `git diff --check`: **PASS** before implementation commits; staged diffs also passed.
- Saturday authenticated workflow steps (enter CRM through branch switching, booking, assignments, payment, completion, and return to Today): **NOT PERFORMED**. No classified authenticated TEST/STAGING target was available for this task. Local mocked tests verify components and authorization boundaries, not the full operational sequence.

## Security, database, and production

Customer detail reads now require the server-selected/assigned branch and booking membership. The privileged prefill read is gated before customer data is fetched. No browser branch parameter authorizes either endpoint. Existing RLS policies, migrations, schema, and payment writers were not changed. Database target is **UNKNOWN**; no live database command was run. **Production verification: NOT PERFORMED.** Production impact is unverified, with no push or deployment.

## Remaining issues and next gate

- **P0:** None identified in repository review; production is unverified.
- **P1 release gate:** Authenticated TEST/STAGING Saturday workflow, Owner branch switch, and payment/alert behavior still need evidence. Review must confirm the intentionally strict customer membership rule fits cross-branch customer reuse at the front desk. There is no measured before/after latency.
- **P2:** Today booking-change events retain broad `router.refresh()` for server-derived correctness. Customer search/list branch membership queries can scan booking IDs; optimize only with measured workload and a classified target. Secondary Today metrics remain in the initial read group. The Cash Flow modal itself is large; its remaining bundle impact is unmeasured.
- **P3:** The three accepted-main booking-action tests expect `{ success: true }` while actions return additional fields. The full-suite attendance timeout passed in isolation.

Rollback: revert the five branch commits after `origin/main` in reverse order, then rerun focused tests, type-check, lint, and build. No database or production rollback is needed from this unpushed branch.

Next permitted action: independent code review and a target-classified authenticated TEST/STAGING operational simulation with branch-switch and timing evidence. Any merge or deployment requires a separate owner gate.
