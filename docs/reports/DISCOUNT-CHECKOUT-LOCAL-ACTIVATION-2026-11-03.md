# Discount checkout local activation — 2026-11-03

Owner request: fix the backend-release warning and disabled discount buttons, remove Advanced Cash Flow options from the payment summary, and verify connectivity.

## Scope and cause

- Branch: `fix/bookings-refinement-discount-checkout-20261102`; starting HEAD `54dd7fbc32cbcc017014cbfd4d3fd3e54021dc31`.
- Local main remains `d2205694f3f2f3fb826fe3d062d6b3e1b6391018`; recorded origin/main remains `9a232f9e13bde5eca8c9ec714e05116781d3c689`.
- Database target: **PRODUCTION**, Supabase `lsrbwqhvzjfpiabeolkv`. The backend was already installed in the separately authorized database stage; this task did not replay SQL or change schema/history.
- `.env.local` already contained the enabled flag, but the running Next process had an explicit false override from the earlier preview stage. The server-side gate therefore rejected requests before reaching the installed backend.
- Removed only the Advanced Cash Flow summary link from `cradle-flow-quick-payment-modal.tsx`. The separate View Ledger recovery link and financial safeguards remain.

## Server handover

Confirmed root-worktree Next parent PID19076 and sole listener child PID48796 before stopping those two processes. Cleared only the verified, non-reparse root generated `.next` cache. Other worktrees and unrelated processes were preserved.

Started `pnpm dev --port 3000` in `E:\cradlehub`, retained exec session15709, with `CRADLEHUB_DISCOUNTS_ENABLED=true`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `DEV_AUTH_BYPASS=false`, and `DEV_ALLOW_ALL_MODULES=false`. Existing production credentials remained private and unchanged. Ready in 4.5s; final listener PID48212. Log: `.tmp/discount-enabled-dev.log`.

## Checks and exact outcomes

- Targeted Vitest: PASS, 3 files / 37 tests, exit0, duration27.69s. Modal, discount writer and tender retargeting tests. Log `.tmp/discount-activation-tests.log`.
- `pnpm type-check`: PASS, exit0. Log `.tmp/discount-activation-typecheck.log`.
- Scoped ESLint for the modified modal: PASS, exit0. Log `.tmp/discount-activation-lint.log`.
- `git diff --check`: PASS.
- Full build was not repeated for the six-line link removal; the previous implementation build passed as recorded in the refinement report.

Actual authenticated browser at `http://localhost:3000/crm/cash-flow` returned HTTP200. Browser plugin not available; regular Playwright used. Meaningful Cash Flow content and payment modal rendered; no framework overlay. Console: zero errors and zero warnings at the checked navigation.

At desktop 1440x1000, all discount buttons enabled; backend-release warning and Advanced Cash Flow link counts both zero. Initial Senior quote reduced a 400.00 service to320.00; cash500 produced180.00 change and enabled Record Payment. A later quote on that order returned `EXISTING_ADJUSTMENT_REQUIRES_REVIEW`; the browser expectation for a fresh discounted quote timed out. The existing-adjustment guard was preserved; no workaround or financial data edit was performed.

On a separate group order, both Senior and PWD produced the authoritative quote: subtotal3200.00, recipient-specific discount160.00, payable3040.00. This is a discount on the selected recipient's eligible service charges, not on everyone in the group. Switching to PWD cleared Senior; clicking PWD again restored3200.00. Cash5000 yielded1960.00 change. Record Payment was enabled, but was never clicked. No claim of a real physical ID check is made by this preview; selections are temporary and cleared after QA.

At mobile390x844, the same quote rendered, Record Payment remained fully within the viewport, and document horizontal overflow was false. Screenshots were inspected and customer/order/recipient fields masked:

- `C:/Users/eleur/.codex/visualizations/2026/11/02/01a19b9f-392b-7003-8a36-e1f5e5c272d5/discount-enabled-desktop.png`
- `C:/Users/eleur/.codex/visualizations/2026/11/02/01a19b9f-392b-7003-8a36-e1f5e5c272d5/discount-enabled-mobile.png`

Actual browser method selection also passed for Cash, GCash, Maya, bank transfer and card: the first tender's method value matched each button. Split added a second tender, and removing it worked. An initial QA script incorrectly expected the first tender alone to equal the whole balance after removing a discount from an existing split; it timed out because the two tender amounts correctly summed to3200.00 (3040.00 +160.00). The corrected check inspected both tenders and passed. Final browser state: desktop, no discount selected, one cash tender at3200.00, cash-received field empty, no payment submitted. Final console had zero errors and warnings.

## Release limits and rollback

Local app activation is complete. Hosted application flag/restart/deployment is not verified or changed. No live payment, receipt print, profile update, schema operation, migration-history repair, merge or push was performed. Existing cash, electronic methods, split tenders, validation and receipt paths are covered by the targeted tests; physical printer and live payment posting are not certified by these read-only browser checks. VIP eligibility remains server-checked; no customer membership was changed for testing.

The earlier independent review of the backend/release package remains recorded with that work. This activation/link-removal follow-up has targeted automated and browser checks; no new independent review is claimed.

Rollback: restore the removed summary link from the parent commit if desired; restart only this root-worktree Next process with `CRADLEHUB_DISCOUNTS_ENABLED=false`. Do not drop the installed financial audit objects or replay migrations as an application rollback.
