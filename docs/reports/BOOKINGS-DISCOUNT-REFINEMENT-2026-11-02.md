# Bookings and discount checkout refinement — local review

Closeout continued on 2026-11-03 (Asia/Singapore). The owner separately approved the financial backend scope below and subsequently approved **all service charges at checkout** for Senior/PWD, including home service. The earlier pending-approval wording below is superseded by this recorded authorization. Transport, tips and retail remain outside eligible service charges. No VAT calculations, fields or additional staff workflow were added.

## Scope and baseline

- Repository: `E:\cradlehub`.
- Branch: `fix/bookings-refinement-discount-checkout-20261102`.
- Base/HEAD before this uncommitted refinement: `d2205694f3f2f3fb826fe3d062d6b3e1b6391018` (owner-authorized local main integration).
- Inspected remote baseline: `9a232f9e13bde5eca8c9ec714e05116781d3c689`.
- Current task forbids merge, push, deployment, production writes and remote migrations. Other Bookings/payment worktrees remain preserved.
- Root development environment is **PRODUCTION**, authorized only for read-only local preview. Synthetic browser fixtures are isolated **TEST**. Booking mutations are mocked; payment quote/post calls use real SQL in the isolated TEST database. Thermal HTML is captured instead of dispatching a physical print job.

## Frozen UI scope

Bookings: compact existing rows, full recipient names, Grouped/Individual presentation, per-session filtering and lifecycle actions, independent persisted-timestamp timers, reduced-motion support, and separate Booking Details. No new scheduling or financial mutation contract.

Discounts: reuse the existing three single-selection buttons and existing payment modal. Owner clarified non-VAT pricing: introduce no VAT calculations, fields or staff workflow. Clicking Senior/PWD represents staff's physical ID attestation; no forms, uploads, extra confirmation or manager step. VIP covers regular spa services, excluding transportation, tips and retail. Historical statutory eligibility must never auto-apply.

## Approved separate financial backend scope

Part 7 of the owner brief requires separate approval and isolated LOCAL/TEST validation for missing financial contracts. The accepted writer `post_order_payment_atomic` currently accepts tenders/allocations, not a recipient discount command. Browser-only percentage calculations cannot reconcile ledger, audit and receipt.

Proposed narrow implementation:

1. Extend the existing Cash Flow path with a server-authorized quote for explicit recipient/service-charge selections. One category per eligible charge; selection toggles/removal request a fresh quote. Rates: Senior/PWD 20%, VIP 10%; no VAT model.
2. Implement the owner's explicit policy: Senior/PWD 20% on all canonical service charges at checkout, including home service; VIP 10% on regular in-spa services for the actual recipient's VIP profile. Transport, tips and retail are excluded. No eligibility is inferred from notes, browser storage or past usage.
3. Extend the existing atomic writer with locked revalidation, versioned quote inputs, idempotency and a discount adjustment tied to actual recipient charges. Commit discount, payment allocation and minimal audit together. Reject stale, unauthorized, duplicate or over-discounted requests. Preserve split/partial tender semantics and purchased-service snapshots.
4. Store minimal category/actor/recipient/charge/calculation/attestation/payment references in durable audit records. Derive profile history from committed records, without ID numbers/documents or automatic future Senior/PWD selection.
5. Print only committed receipt/ledger facts through the existing printer. Verify partial-payment, refund/reconciliation and retry behavior against the existing contracts.
6. Author/test only the narrowly required database contract against a classified isolated LOCAL/TEST database. Do not apply it to production, replay historical migrations, deploy, push or merge.

The scope and service policy are now approved for LOCAL/TEST implementation. The server-only `CRADLEHUB_DISCOUNTS_ENABLED` release gate remains off for the production-connected application preview, because no remote migration or release is authorized. Discount controls explain this limitation and ordinary undiscounted checkout remains available. Every discount selection first requires an authoritative catalog identifying the actual recipient, including single-attendee orders whose organizer is somebody else.

## Extension boundary

The inspected lifecycle extension RPC moves the due time but does not atomically validate the complete scheduling/pricing requirements in Part 4. Extension duration selection is a request preview only; confirmation stays disabled. No fabricated therapist alternatives, availability, charges or successful extension evidence.

## Implementation and independent verdicts

- **Bookings UI: PASS for local review.** Compact existing rows, full recipient names, default Grouped/alternate Individual presentation, independent member actions and timers, parent links, same-session filters, stable booking/guest/session counts, separate Booking Details and responsive layout are implemented. Timers use persisted start/due/completion timestamps, clockwise SVG depletion, 220ms number transitions, final-five-minute amber/slow overtime red pulse, reduced motion, visibility pausing and focus resync. No new timer polling or page-wide second-by-second state.
- **Bookings extension acceptance: CORRECTION REQUIRED.** The existing extension RPC lacks the combined scheduling/pricing guarantees. Apply Extension remains disabled; no successful extension, price, availability or safe alternative is fabricated. Group extension is not enabled. A unit test of a new persisted due timestamp is not evidence of a successful extension transaction.
- **Discount financial path: PASS as a LOCAL/TEST candidate; CORRECTION REQUIRED for release.** The transaction wrapper inserts signed per-recipient service discounts, calls the existing `post_order_payment_atomic` writer in the same transaction, and stores durable audit/immutable receipt facts. It preserves existing rails, cash drawer validation, split/partial payment, idempotency and authorization. Failed payment rolls back charges, discount and audit together.
- Independent read-only review found no remaining actionable P0/P1/P2 defects after fixing actual-attendee membership/name resolution, recipient catalog gating, quote locks/versioning, normal checkout totals and attempt-bound timeout receipt recovery. This is not production-release approval.

The existing customer profile now reads committed discount history through a branch-authorized RPC, without granting future Senior/PWD eligibility. An attendee without a linked customer profile retains transaction audit evidence but cannot gain profile history automatically. No customer profile is invented. Closed-group charges, existing negative adjustments, explicit item allocations with discounts, or reductions below prior payments fail closed for reconciliation. A broader discounted refund lifecycle is not certified.

## Exact checks and outcomes

| Check | Result |
| --- | --- |
| Targeted Vitest regression gate | **PASS: 15 files, 216 tests**, final run 23:56:54, duration 33.68s; `.tmp/refinement-regression-final.log` |
| Final modal recipient correction suite | **PASS: 30 tests**; `.tmp/refinement-modal-final.log` |
| Scoped ESLint over changed application TS/TSX and tests | **PASS**, exit 0, no diagnostics |
| `git diff --check` | **PASS** |
| Standalone `pnpm type-check` | **PASS** before final build; final build checks TypeScript again |
| Final production-equivalent local build | `.tmp/refinement-build-final.log`; final result appended below |
| `node tests/database/run-discount-checkout-test.cjs` | **PASS**; `.tmp/discount-db-test-final.log` |

The regression command explicitly selected the horizontal Bookings workspace, session workspace, source routing, timer, operational eligibility, group-by-order, exact lifecycle, immutable purchased snapshot, payment modal, canonical payment writer, thermal receipt, ledger concurrency guards, order-payment eligibility, tender-retarget and discount-writer suites. It used `--exclude '**/.tmp/**'` to avoid collecting preserved worktrees.

Initial runs hit sandbox cache rename/realpath EPERM errors and collected preserved worktrees. Root-only runs outside the sandbox resolved these infrastructure failures. Intentional presentation changes required selectors to distinguish page filters, Manage items and Booking Details. All assertion failures were corrected before the final green gate. One verification attempt was interrupted by automatic approval review's usage limit; the resumed attempt completed. These are not production failures.

## LOCAL/TEST database evidence

Dedicated PostgreSQL 17.11 cluster: **TEST**, `127.0.0.1:55439`, `.tmp/refinement-discount-pgdata`; newly named `discount_test_*` databases contain synthetic records only. The harness never loads `.env` or accepts remote database URLs. It extracts exact accepted CF2/CF3 financial tables and accepted canonical payment/reconciliation functions. Identity, booking, attendee and cash-session schema are synthetic stand-ins; full production triggers, Auth and RLS equivalence are **not verified**.

SQL assertions cover actual attendee versus organizer membership, empty attendee display name resolving to the actual customer, service/home-service Senior/PWD coverage, excluded fee/retail charges, cent rounding, staff attestation, no stacking, read-only quotes, stale rejection, cash-drawer failure rollback, split partial payment, immutable receipt recovery, profile history, anonymous/direct-audit-write denial and branch authorization. Real parallel psql sessions verify same-key replay and different-key stale rejection, each leaving exactly one audit, one discount and one 200.00 allocation.

The new migration was authored through the Supabase CLI and executed only in these isolated TEST databases. No historical migration chain was replayed. Senior/PWD coverage and non-VAT treatment implement the owner's stated pricing policy; these checks are not independent regulatory certification of statutory applicability to every service.

## Browser evidence

Browser plugin unavailable; Playwright used at **1440×1000** and **390×844**. The isolated fixture renders actual repository components, application styles and local DM Sans. Booking actions and Next navigation/overlay boundaries are stubbed; payment quote/post requests reach actual SQL through a TEST adapter. This does not exercise full authenticated Next/Supabase transport.

Observed Bookings: group/member expansion, independent timer, no automatic Quick Edit, Grouped/Individual parent links, stable `3 bookings · 5 guests · 5 sessions`, therapist-filtered `1 of 3` members, moving SVG stroke, final-five-minute `ending` state, reduced-motion animation `none`, and no horizontal overflow at 390px. Extension confirmation stays disabled.

Observed payment: Senior/PWD changes 2200.00 to **2000.00** on the selected recipient's 1000.00 service; replacement stays single-selection, removal restores 2200.00, VIP changes payable to **2100.00**. All five rails retain the authoritative amount. An actual regular recipient is rejected for VIP. A TEST commit produces a **2100.00** paid/zero remaining receipt with **400.00** change from **2500.00** cash, with signed items summing to the ledger. Real thermal HTML is captured; no physical printer/device certification. Mobile footer clipping was found and fixed; Record Payment is fully within the 390px viewport.

Screenshots, synthetic TEST data only, directory:
`C:\Users\eleur\.codex\visualizations\2026\11\02\01a19b9f-392b-7003-8a36-e1f5e5c272d5`

- `bookings-desktop-test.png`
- `bookings-mobile-test.png`
- `payment-desktop-test.png`
- `payment-mobile-test.png`
- `payment-committed-test.png`

## Production impact and rollback

No production booking, payment, attendance, schema or other records were modified. No merge, push, deployment or remote migration. Root preview uses existing PRODUCTION env for reads, auth bypass off and discount release gate off. Separate loopback4317 fixture uses only TEST data.

Only the task-owned root Next server was stopped for builds. Only the verified non-reparse-point `E:\cradlehub\.next` disposable cache was removed; environment files, dependencies, databases, Git/worktrees and unrelated processes remain intact.

Rollback: stop only this worktree's dev server and return to previously integrated local `main` at `d2205694`, preserving review changes on their branch or using a separate worktree. Do not reset/delete the older Bookings/payment worktrees. No production rollback is needed because nothing was released. Preserve task-owned TEST databases as evidence unless separately disposed of by exact target.

## Final repository/server closeout

Final build result, review HEAD, exact changed-file manifest and port3000 page/process evidence are appended below before handoff.

### Reviewed code commits

- Bookings: cb753baa5821c6c5f49d72dfa807eb017d8f2dbc.
- Discount checkout: f19a336c989ef8521a8020e1a3f2498e8b8c7720 (reviewed application HEAD).
- Local main remains d2205694f3f2f3fb826fe3d062d6b3e1b6391018; origin/main remains 9a232f9e13bde5eca8c9ec714e05116781d3c689.

### Exact changed files

- src/app/(dashboard)/crm/[customerId]/page.tsx
- src/components/features/bookings/animated-session-timer.module.css
- src/components/features/bookings/animated-session-timer.tsx
- src/components/features/bookings/booking-session-workspace.tsx
- src/components/features/bookings/bookings-desktop-workspace.tsx
- src/components/features/bookings/grouped-booking-card.tsx
- src/components/features/bookings/horizontal-booking-row.tsx
- src/components/features/crm/today/cradle-flow-quick-payment-modal.tsx
- src/components/features/crm/today/use-payment-discounts.ts
- src/lib/bookings/animated-session-timer.ts
- src/lib/bookings/bookings-presentation.ts
- src/lib/cash-flow/cash-flow-queries.ts
- src/lib/cash-flow/cash-flow-types.ts
- src/lib/cash-flow/discount-actions.ts
- src/lib/cash-flow/discount-contract.ts
- src/lib/cash-flow/financial-contract.ts
- src/lib/cash-flow/payment-discounts.ts
- src/lib/cash-flow/payment-writer.ts
- src/lib/cash-flow/retarget-tenders.ts
- supabase/migrations/20261102114848_recipient_discount_checkout.sql
- tests/components/bookings/horizontal-bookings-workspace.test.tsx
- tests/components/crm/cradle-flow-quick-payment-modal.test.tsx
- tests/database/discount-checkout-test.sql
- tests/database/run-discount-checkout-test.cjs
- tests/lib/bookings/animated-session-timer.test.ts
- tests/lib/cash-flow/discount-writer.test.ts
- tests/lib/cash-flow/retarget-tenders.test.ts
- docs/reports/BOOKINGS-DISCOUNT-REFINEMENT-2026-11-02.md

### Final build and server evidence

- Clean final build: PASS, exit 0; compiled in 49s, TypeScript finished in 56s, 153/153 static pages. Log: .tmp/refinement-build-clean.log. Expected public-content fetch-failed diagnostics occurred because this build deliberately used unreachable synthetic loopback Supabase values; no production data was used for build generation.
- An earlier final build failed in generated .next/dev/types/routes.d.ts at line249 ('semicolon expected'). Clearing only the root .next cache resolved it; no application route source was changed to hide the failure.
- Port3000 was occupied by a Next listener PID56936 while work was paused. Only its Node parent34812 and sole listener child56936 were stopped after ancestry/dependency inspection; its terminal and unrelated processes were left intact. The previous preview returned HTTP500 with missing root generated cache files.
- Restarted E:\cradlehub via pnpm dev --port3000 using existing PRODUCTION env for reads, DEV_AUTH_BYPASS=false, DEV_ALLOW_ALL_MODULES=false, CRADLEHUB_DISCOUNTS_ENABLED=false. Ready in7.6s; listener PID48796, retained exec session32222.
- Actual browser http://localhost:3000/crm/bookings: HTTP200, Bookings heading, Grouped/Individual controls present, no runtime overlay.


- Actual browser http://localhost:3000/crm/cash-flow: HTTP200; existing Record Payment modal opens; all three discount buttons are present; no runtime overlay. No real payment or print action was submitted. Production checkout functionality is not certified by this preview check.
- Browser screenshot localhost-payment-controls.png captures only the non-private discount controls. Final full workflow screenshots use synthetic TEST data exclusively.
- Both application pages respond from this review branch; the server is left running. The separate TEST fixture remains available at http://127.0.0.1:4317. No merge into main or production release was performed.

