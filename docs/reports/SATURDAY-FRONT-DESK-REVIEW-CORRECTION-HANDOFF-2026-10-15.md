# Saturday Front Desk review and correction handoff — 2026-10-15

## Status and authority

**PASS for the authorized repository correction pass; ready for fresh independent review.** This is not release or production verification. Owner decision `CRM-GOV-001`: customer identity is global for authorized Front Desk identification and reuse, while branch operational records retain existing authorization. The branch remains unpushed and unmerged.

- Repository: `techwithmpg/Cradlehub`, `E:\cradlehub`.
- Accepted base: fetched `origin/main` at `f60793d205ef9599c891e763a22a7ecd3008561f`.
- Starting review HEAD: `b0596036d1e10a0229188084e2f9e20dcd07a043`.
- Correction implementation HEAD: `6a90e011` (`fix(crm): reuse global customer identity in quick booking`). This report commit is identified in the task response.
- Authorization: inspect the full branch diff, correct bounded Web Front Desk issues, test, report, then stop. No merge, deployment, push to main, database mutation, or Desktop implementation.

## Review and corrections

The complete implementation diff from the accepted base was inspected, including the earlier Today read scheduling, retained CRM layout, deferred booking options, customer search/prefill, interaction feedback, alert logic, and focused tests. One unrelated removal of the existing Cash Flow quick link was restored. The previous branch-membership identity restriction conflicted with the Owner's new decision and is superseded by this report and `CRM-GOV-001`.

| Area | Before | After and boundary |
| --- | --- | --- |
| Customer identity | Quick Booking search, exact phone lookup, and prefill required a booking at the selected branch. | Authorized CRM search now uses a server-side global identity query with a 10-result limit. Suggestions return only ID, name, and masked phone suffix. Exact phone lookup returns ID, name, phone, and email for a valid exact lookup. Selected-customer prefill returns only ID, name, phone, and email. No booking/history/payment query is used to establish identity. |
| Operational records | Customer list/profile and booking readers used existing branch filters and RLS. | Those operational readers and RLS remain unchanged. Migration `20260906150500_stage03_customer_read_rls_reconciliation.sql` shows branch-scoped CRM booking and customer reads; Owner's existing broader read policy remains. No cross-branch operational history is added to identity responses. |
| Booking branch | Hosted Owner booking creation accepted a browser branch ID through the shared engine. | The hosted Owner action resolves the selected Front Desk branch on the server and rejects a mismatched browser branch before calling the engine. Other Front Desk roles retain the engine's assigned-branch check. The selected customer ID does not supply or alter the booking branch. |
| Booking modal | Separate search and name inputs could diverge. | One Customer name combobox supports debounced search and free-text new customers. It shows loading, masked matches, no-results, retry, keyboard selection, and selected identity. Selecting a match loads permitted contact fields. Editing the selected name clears the customer ID and old contact details; submission then follows the existing new-customer flow. |
| Deferred options | Options load after CRM layout render. | The provider now tags options with the branch that loaded them, so a branch prop change cannot briefly expose or use the prior branch's options. Loading, error, and retry remain. |
| Actions and alerts | Existing branch commits supplied pending states and guarded repeated actions; ordinary Pay-on-Site balance could otherwise look like a warning. | Reviewed confirmation, check-in, start, assignment, payment, and completion paths. Existing focused tests verify pending feedback and server-success final state. Payment Overdue still requires an elapsed expected end and known positive balance. Genuine assignment, resource, staff-schedule, and dispatch exceptions remain. |

## Evidence

- Global Main customer found for SM: `tests/lib/crm/customer-identity-search.test.ts` verifies a one-table identity query, masked DTO, and no booking-membership read. `tests/lib/crm/quick-booking-customer-prefill-scope.test.ts` verifies global identity prefill with identity columns only. `tests/components/crm/quick-booking-customer-autocomplete.test.tsx` verifies that selecting the Main identity submits its ID with `branchId: "sm"`; the same suite verifies new-customer submission without an ID.
- Branch authority: `tests/lib/crm/owner-booking-action-branch.test.ts` verifies selected SM context, a rejected browser override to Main, and Owner switch to Main. Existing `tests/lib/bookings/inhouse-booking-engine-auth.test.ts` verifies non-Owner assigned-branch rejection. API tests verify authentication, CRM role, server-selected/assigned context, and ignored browser branch parameters.
- Operational data: search and prefill queries select only customer identity fields; tests assert they never query bookings. Customer profile/history code was not widened. No payment, assignment, or booking fields are returned by identity search or exact phone lookup.
- Interaction/performance: the combobox test verifies one debounced search request for a settled query, stale-response rejection, no navigation on selection, keyboard use, retry, and failure without losing input. Source inspection confirms CRM layout no longer awaits booking options, Today independent reads remain parallel, and booking-change refresh still reconciles server-derived Today data. No authenticated latency, query-plan, or render measurements were taken.

## Tests and limits

- `pnpm exec vitest run` with the 36 targeted CRM, Quick Booking, Owner, payment, alert, Today, authorization, and RLS test paths: **36 files / 121 tests passed**.
- Final focused correction and hosted/legacy booking compatibility command: **10 files / 64 tests passed**. Final autocomplete file: **5 tests passed**. `tests/lib/schedule/p0-schedule-rpc-security.test.ts` in isolation: **7 tests passed**.
- `pnpm type-check`: **PASS**. Targeted ESLint over changed source/tests: **PASS**. `pnpm build` on Next.js 16.2.4: **PASS**. `git diff --check`: **PASS**.
- Main checkout `pnpm exec vitest run --exclude '**/.claude/**'`: **336 files passed, 2 files failed, 2 skipped; 2,615 tests passed, 4 failed, 2 skipped**. Three failures are untouched `tests/app/crm/booking-actions.test.ts` assertions that expect exactly `{ success: true }` where the accepted action also returns booking details, as previously recorded. The fourth is a filesystem scan timeout in `tests/lib/schedule/p0-schedule-rpc-security.test.ts` under full-suite load; that file passed alone. An initial full run also exposed a newly introduced static-import problem in the hosted action's Manager test path; the correction uses an Owner-only import, and `tests/api/desktop-v1-bookings.test.ts` passed afterward without Desktop code changes.

## Security, database, production, and next gate

The privileged identity queries run only after authenticated CRM role and server Front Desk branch-context checks. RLS and schema were not changed. Database target: **UNKNOWN**. Migrations created: **none**; applied locally: **no**; applied remotely: **no**; production changed: **no**. Authenticated TEST/STAGING workflow and production verification: **NOT PERFORMED**. No latency claim is made.

- **P0:** None found in the repository correction review.
- **P1 release gate:** Fresh independent review and a target-classified authenticated TEST/STAGING workflow covering Owner Main → SM switch, cross-branch customer reuse, booking, assignments, payment, completion, and return to Today.
- **P2:** Today still performs a broad server refresh after booking changes. Global name substring search has no measured workload or query plan; no index was added.
- **P3:** Three stale accepted-main booking-action assertions and one full-suite filesystem-scan timeout, with the scan passing alone.

Rollback: revert `6a90e011` to remove this correction, or revert the six earlier branch commits as well for a full return to accepted `origin/main`; run focused tests, type-check, and build after any revert. This branch made no database or production change requiring data rollback. Next permitted action is independent review and classified TEST/STAGING verification. Merge, deployment, push to main, migrations, and production mutation remain outside this authorization.
