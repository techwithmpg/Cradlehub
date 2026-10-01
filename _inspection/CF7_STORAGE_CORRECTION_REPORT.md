# CF7 storage ownership correction — 2026-09-29

> Historical checkpoint before the CF8 syntax correction. The later full rollback-only validation result is recorded in [CF8_PAYMENT_SYNTAX_CURRENCY_REVALIDATION.md](CF8_PAYMENT_SYNTAX_CURRENCY_REVALIDATION.md).

## Verdict

**CORRECTION REQUIRED.** The authorized CF7 correction and application changes are implemented and focused checks pass. The full seven-migration rollback-only validation reaches CF8 and stops at SQLSTATE `42601` in the booking payment command. No persistent apply is authorized or attempted.

## A. Baseline

- Repository: `E:\cradlehub-booking-simplification`, branch `stage/cf-financial-foundation`.
- Owner checkpoint: `20afec933f830a3a2a6670bb5c13b53a1e04e411`.
- Target: **PRODUCTION** Supabase project `lsrbwqhvzjfpiabeolkv`, execution role `postgres`.
- The 84 historical local-only migration versions remain untouched.

## B. Confirmed storage ownership root cause

Live read-only catalog inspection established that `storage.objects` and `storage.buckets` are owned by `supabase_storage_admin`; `postgres` cannot assume that role. Storage RLS is already enabled. The prior CF7 `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` failed with SQLSTATE `42501`; managed-table policy DDL is also ownership-sensitive.

## C. CF7 migration changes

- Removed the managed `storage.objects` RLS alteration and all managed-table policy drops/creates.
- Kept private bucket provisioning and `post_expense_atomic` intact. The RPC still requires `auth.uid()`, active staff, approved role, branch/account checks, a negative signed financial account movement, idempotency, strict `search_path`, and intended grants.

## D. Server receipt flow

`recordExpenseAction` receives an optional FormData file, authenticates through the user-session client, resolves active staff, enforces role and branch authority, verifies branch/account, validates 5 MB and JPEG/PNG/WebP/PDF extension, MIME and signature, generates the path server-side, then uploads to the private bucket using the canonical server-only admin client. It calls `post_expense_atomic` using the user-session client. On RPC failure it attempts server-side orphan removal and reports cleanup failure separately. A replay removes the newly uploaded duplicate.

## E. Client changes

The modal selects and previews a file, performs basic UX checks, and sends it as FormData to the server action. It no longer imports the browser Supabase client or uploads/deletes Storage objects. It preserves an idempotency key for retries of the same form.

## F. Security review

The admin helper imports `server-only`. `SUPABASE_SERVICE_ROLE_KEY` is referenced only in that helper; the client component has no service-role reference or Storage mutation call. The caller cannot provide the receipt path or staff identity. The privileged upload occurs only after user/staff/branch/account checks. No service credential is returned or logged.

## G. Bucket provisioning result

The rollback-only execution passed the CF7 private bucket `INSERT ... ON CONFLICT DO UPDATE` under the PRODUCTION `postgres` execution role and reached CF8. It retained `public=false`, `file_size_limit=5242880`, and the four specified MIME types. The bucket was rolled back and remains absent.

## H. Full seven-migration rollback validation

The SQL bodies were run in approved order in one explicit `BEGIN` transaction with their outer `BEGIN/COMMIT` wrappers removed for validation, `lock_timeout='5s'`, `statement_timeout='120s'`, and a final `ROLLBACK`. No migration-history insert was included. The transaction stopped in migration 7, `20260929140000_cf8_booking_payment_command.sql`, at the statement beginning at line 733:

```sql
IF v_existing.source_type <> CASE WHEN v_booking.order_id IS NULL THEN 'legacy_booking' ELSE 'booking_order' END
   OR v_existing.source_id <> COALESCE(v_booking.order_id, v_booking.id)::text
   OR v_delta <> 0
   OR v_booking.payment_method IS DISTINCT FROM p_payment_method
   OR v_booking.payment_status IS DISTINCT FROM p_payment_status
   OR v_booking.payment_reference IS DISTINCT FROM p_payment_reference THEN
```

PRODUCTION returned **SQLSTATE 42601, syntax error at end of input**, pointing at this conditional. The full seven-migration sequence therefore **did not pass**. No additional migration correction or persistent apply was attempted. A post-failure live read-only query confirmed `financial_accounts=false`, `cash_sessions=false`, `post_expense_atomic=false`, `expense-receipts` bucket absent, and zero rows for all seven pending versions in `supabase_migrations.schema_migrations`.

## I. Migration-history deployment strategy

The available Supabase `apply_migration` API accepts `name` and SQL `query` but no explicit version. A direct Supabase CLI database connection from this host previously timed out. Therefore, after a separate owner authorization and successful complete validation:

1. For each of the seven new/unapplied migrations in approved order, record its source filename and SHA-256 hash.
2. Submit **only that SQL body** using `apply_migration`; read the one new authoritative remote version from `list_migrations`.
3. Record the exact mapping `original filename → generated remote version`; rename **only the corresponding new/unapplied local file** to that version and verify the SQL hash is unchanged.
4. Verify the seven new remote history entries and expected objects after each apply. Do not use `db push`, migration repair, or any replay/marking of the 84 historical local-only migrations.

Actual remote versions cannot be supplied until application, so the seven mappings remain pending. No synchronization was performed.

## J. Cash Flow error handling

Required financial accounts, transactions, movements, payable items, and order financial summary query failures now throw explicit server errors instead of producing zero activity. Optional/staged categories and cash sessions retain their existing behavior.

## K. History empty state

When `history.selectedClose` is null, History shows “No day close selected” and no selected-close reviewed banner, reviewer, or fake zero summary. Full CF8 Day Close was not implemented.

## L. Tests

- Focused Cash Flow Vitest: **11 files, 159 tests passed**.
- Targeted ESLint: passed.
- `pnpm type-check`: passed.
- `git diff --check`: passed (line-ending warnings only).
- Focused tests cover CF7-01 through CF7-18, including server action authorization, validation, path, upload/RPC cleanup, SQL movement/idempotency, required read errors, and History empty state.

## M. Changed files

`supabase/migrations/20260929120000_cf7_expense_receipt_storage.sql`; `src/lib/cash-flow/{cash-flow-actions,cash-flow-queries,cash-flow-types,expense-receipt}.ts`; `src/lib/supabase/admin.ts`; `src/components/features/cash-flow/{record-financial-entry-modal,history-tab}.tsx`; `tests/lib/cash-flow/{cf7-receipt-correction,cash-flow-ui,cash-flow-mixed-read-model}.test.ts[x]`.

## N. Production impact

NO PERSISTENT PRODUCTION MIGRATION APPLIED

NO PRODUCTION BUSINESS DATA MUTATED

NO HISTORICAL MIGRATION REPLAY

NEW CF8 BEHAVIOR NOT YET PRODUCTION VERIFIED

No commit, push, merge, or deploy was performed.

## O. Exact next owner authorization required

Authorize a narrowly scoped correction of `supabase/migrations/20260929140000_cf8_booking_payment_command.sql` for the SQLSTATE `42601` conditional, focused tests, and a repeat full seven-migration rollback-only validation. Persistent PRODUCTION application and migration-history synchronization require a **separate later authorization** after that validation passes and the exact apply plan is reviewed.

## Follow-up: Cash Flow route availability

The local `.env.local` public Supabase URL points to `lsrbwqhvzjfpiabeolkv.supabase.co`. A fresh PRODUCTION read-only check confirmed that `public.financial_accounts` is absent and none of the seven pending CF versions has a migration-history row. The reported Next.js development error is therefore the expected required-query failure while migrations remain unapplied.

The Cash Flow page now catches only the typed required-financial-data error and shows an explicit unavailable state. It does not render zero totals or intercept unrelated exceptions. Added two page tests. Focused Cash Flow Vitest now passes **161 tests in 11 files**; targeted ESLint, `pnpm type-check`, and `git diff --check` pass. Additional changed files: `src/lib/cash-flow/cash-flow-errors.ts`, `src/app/(dashboard)/crm/cash-flow/page.tsx`, and `tests/lib/cash-flow/cash-flow-page-tabs.test.tsx`. No database change or deployment was made.
