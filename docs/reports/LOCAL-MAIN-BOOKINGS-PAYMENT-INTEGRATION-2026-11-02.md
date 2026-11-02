# Local main integration — Bookings and Record Payment

## Authority and scope

The latest owner instruction explicitly authorizes merging the Bookings and payment UI work into **local `main` only**. This supersedes earlier no-local-merge stops for this integration. It does not authorize push, deployment, database changes, discounted posting, or active-session extension. Earlier worktree handoffs remain historical evidence; this handoff records the combined local result.

Accepted remote baseline: `9a232f9e13bde5eca8c9ec714e05116781d3c689`. Existing local main before integration: `4b25a60234603088a123b68c7997801e908f7003`, verified ancestor of accepted origin/main with no local-only commits. Combined review branch: `fix/local-bookings-payment-integration-20261102`, prepared in the existing payment integration worktree. The original root branch `fix/payment-modal-discounts` and its unsafe historical commit remain preserved; that implementation was not merged.

## Included behavior

- Compact responsive Bookings rows with recipient names/avatars, grouped recipient details, target-line scheduling/assignment display, persisted circular session timers, extension review controls and collapsed existing quick edit.
- Safe Senior/PWD/VIP choices in the accepted Record Payment modal, one selection at a time, on-file VIP suggestion, explicit disabled discounted-checkout notice, and the mobile overlap correction.
- Payment writer/actions/financial contract and receipt printer remain accepted-main code. No client discount amounts, statutory eligibility inference from notes/storage, or fabricated receipt rows were added.
- Both Apply Extension and discounted payment posting remain disabled pending their separately approved server contracts.

Changed source files: `src/components/features/bookings/{booking-session-workspace,bookings-desktop-workspace,bookings-workspace,horizontal-booking-row}.tsx`, `src/components/features/crm/today/cradle-flow-quick-payment-modal.tsx`, `src/lib/cash-flow/{payment-discounts,cash-flow-queries,cash-flow-types}.ts`. Tests: `tests/components/bookings/{booking-session-workspace,horizontal-bookings-workspace,bookings-workspace-source-routing}.test.tsx` and `tests/components/crm/cradle-flow-quick-payment-modal.test.tsx`. Associated handoffs and privacy-safe payment browser evidence are included.

## Review and corrections

Independent reviewer `/root/payment_integration_review` initially required three P2 corrections: target-recipient rows displayed the primary line's time; planned duration ignored prior persisted extensions; compact mobile routing hid Master Sheet references. Corrections now use the target line consistently, derive a valid planned duration from persisted start/due while retaining purchased duration separately, and retain the reference-capable workspace for Master Sheet/all-with-references. Focused tests cover these cases. Final independent verdict: **PASS for owner-authorized local-only integration**, conditional on combined quality gates; no remaining actionable blockers found. This is not production release certification.

## Verification

- **107/107 tests passed** in seven suites: booking timer, horizontal booking workspace, booking source routing, quick payment modal, receipt printer, payment writer contract and C02 payment safety.
- `pnpm type-check`, targeted ESLint and `git diff --check` passed.
- The first source-routing test run exposed a missing test navigation mock; corrected. A later timer test raced the initial display update; corrected to await the visible countdown. These were test-harness corrections; final suites pass.
- Full combined `pnpm build` passed with exit 0, including compilation, TypeScript and all 153 static pages. Build used synthetic LOCAL URL/key values and an unreachable endpoint; expected unrelated public-content fetch diagnostics are not proof of live integration.
- Payment desktop/mobile real-browser evidence and synthetic interaction tests are in `PAYMENT-MODAL-LOCAL-INTEGRATION-2026-11-02.md`. Combined read-only browser navigation loaded Bookings without horizontal overflow at 390px and found all three discount buttons in Cash Flow. That Bookings context returned zero rows, so no production booking lifecycle action was used. Isolated component tests cover expansion, recipients and timers.
- No operational mutation, migration, payment issuance, receipt print, push or deployment was performed by the agent.

## Preservation and rollback

Original Bookings and safe-discount worktrees retain their uncommitted source and original launchers. The root's previous original-discount branch remains available. Existing pre-integration status/diff evidence is under `.tmp/payment-modal-reconcile-evidence`. No worktree is deleted or reset.

The local-main result is intentionally ahead of origin/main. Do not push it without the separate owner release gate. To review accepted production-connected source again, use a separate worktree at the recorded accepted remote SHA and deliberately hand over port 3000; do not reset main or discard preserved work. Original Bookings preview can be restored with its saved launcher. Any rollback of the combined local commit should be a reviewed revert, not a force push or history rewrite.
