# CradleHub discount checkout — production SQL package

Prepared 2026-11-03 for the **PRODUCTION** project `lsrbwqhvzjfpiabeolkv` (Creadlehub), PostgreSQL 17. No production DDL, payment/booking writes, release-flag change, deployment, push or merge was performed while preparing this package.

## Files and run order

1. Open `2026-11-03-discount-checkout-production.sql` in this directory. Run the **entire file once**, in the intended production project's SQL Editor with database-admin authority. This is a single explicit package for migration `20261102114848_recipient_discount_checkout`; do not also run the old file or replay the migrations folder.
2. The package checks the inspected payment prerequisites before creating anything. Any missing/changed function, column, financial constraint or existing discount object stops the transaction. If it reports an error, leave the feature off, run `ROLLBACK;` if the editor session is still in an aborted transaction, and investigate the exact error. Do not remove these checks or drop audit data to force a rerun.
3. Run `2026-11-03-discount-checkout-verify.sql`. Every Boolean result should be `true`. This checks installation and permissions, not a live payment outcome.
4. The application must include the reviewed discount implementation (`f19a336c989ef8521a8020e1a3f2498e8b8c7720`, on the local review branch). SQL does not deploy that code. Set the **server-side** environment variable below, then restart/redeploy the application in which checkout should be enabled.

Manual SQL Editor execution does not register this version in `supabase_migrations` history. Before any later CLI migration operation, reconcile that version through a separately authorized release process. This package intentionally does not edit migration history; do not replay the source migration against installed discount objects.

```env
CRADLEHUB_DISCOUNTS_ENABLED=true
```

The currently running localhost:3000 preview explicitly starts with this process variable set to `false`; editing `.env.local` alone does not override that running process. Start its replacement with the variable `true` after installation is verified. Keep the existing production Supabase configuration. Do not enable auth bypass.

For a local restart, after stopping only the existing root preview server:

```powershell
Set-Location E:\cradlehub
$env:CRADLEHUB_DISCOUNTS_ENABLED = 'true'
pnpm dev --port 3000
```

For a hosted production deployment, configure the same server variable on that deployment and release the reviewed application build. The existing accepted main branch does not yet include these review-branch changes. This package does not itself authorize or perform that merge/deployment.

## What the package installs

- One RLS-protected discount audit table; authenticated clients cannot directly read or modify it.
- A private authorization helper and four authenticated RPCs: quote, atomic discount/payment posting, profile history, committed receipt recovery.
- Senior/PWD 20% on the owner's approved service-charge scope at checkout, including home service. Staff button selection records physical-ID attestation. No VAT workflow or ID documents/numbers are added.
- VIP 10% on regular in-spa service charges with actual-recipient VIP membership. Transportation, tips and retail are excluded from service discounts.
- Signed discount payable adjustments and payment/audit/receipt writes in one transaction through the existing canonical payment writer. No replacement financial engine or modification of existing bookings/payments occurs during installation.
- Permission verification and a PostgREST schema-cache refresh delivered on commit.

This build needs **no other new migration** for compact Bookings, Grouped/Individual display or timers. Session extension confirmation remains disabled: the complete scheduling/pricing contract is not part of this release.

## Production inspection and isolated validation

Read-only production catalog inspection confirmed all 81 required typed columns, 34 checked financial constraints, the three canonical baseline function definitions and the absence of the new discount objects. The live canonical payment writer and closed-service reconciliation bodies match the accepted repository definitions. No customer/staff/booking/payment rows were read for this inspection.

The package was executed only against fresh **TEST** databases at `127.0.0.1:55439`. Tests used the inspected live canonical functions, financial CHECK constraints and relevant payable/allocation validation and immutability triggers. Identity, booking, attendee and cash-session tables remain synthetic fixtures; this is not a full production clone, installed-app Auth test or hardware printer certification.

Passed cases include recipient membership/name resolution, all-service Senior/PWD and home-service coverage, fee/retail exclusion, rounding, attestation, no stacking, stale quotes, atomic rollback after drawer failure, split partial payment, receipt recovery, profile history, anonymous/direct-audit-write denial and branch authorization. Real parallel psql sessions passed same-key replay and different-key stale rejection with one audit/discount/payment allocation. A second installation stopped without erasing data, and a changed canonical writer stopped before creating discount objects.

Evidence: `.tmp/discount-production-package-test.log`. The package preserves the exact reviewed migration implementation and adds deployment guards; it does not certify broader statutory applicability, refund lifecycle or every production integration.

Independent read-only review: **PASS for the owner-executed guarded SQL artifact**, with no concrete P0/P1/P2 blocker found. This review covered the SQL, verification script, runbook and isolated test logs. It does not execute the package or authorize application deployment.

## Rollback

Set the server release variable to `false` and restart/redeploy first. Preserve committed audit, payment and discount rows; do not drop the audit table or delete adjustments after real transactions. Existing undiscounted payment posting remains on its original writer. Any financial correction to committed transactions must use the established reconciliation/refund process.

Source migration: `supabase/migrations/20261102114848_recipient_discount_checkout.sql` (SHA256 `048e938b1a49aef7d6820820d35176688ad55163c3c27a64a2b4ea3c2060c9ee`).

Reference for function execution privileges and qualified security-definer SQL: https://supabase.com/docs/guides/database/functions
