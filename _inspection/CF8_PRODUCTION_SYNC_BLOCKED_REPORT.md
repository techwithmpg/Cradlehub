# CF8 controlled production synchronization — blocked pre-apply

Captured 2026-09-29 11:44 UTC. Target: CradleHub Web, **PRODUCTION** project `lsrbwqhvzjfpiabeolkv`. Branch `stage/cf-financial-foundation` started this pass at HEAD `431db1f8e779adca017cbcf66d678c4265f8f298`. A concurrent process changed HEAD during final review to `20afec933f830a3a2a6670bb5c13b53a1e04e411` with commit subject `wip(cf8): reconcile cash flow and booking contracts`; this assistant did not commit, push, merge, or deploy. All seven approved SQL file SHA-256 hashes remained unchanged across that HEAD change. The remaining inspection files are untracked and preserved.

## LIVE READ-ONLY VERIFIED FACT — starting state

- Supabase project list identifies `lsrbwqhvzjfpiabeolkv` as the active healthy `Creadlehub` project.
- Latest migration history entry is `20260927080000_bkg3_booking_order_atomic`. None of the seven approved CF migration versions is recorded.
- `booking_orders`, `booking_attendees`, `bookings`, `staff.system_role`, and `create_booking_order_atomic` are present. `staff.role` and a separate `booking_service_lines` table are absent, consistent with the reviewed BKG3 booking-row design.
- CF2–CF8 financial tables and payment RPCs are absent. The old `record_booking_payment_change` remains executable by `authenticated` and `service_role`.
- `storage.objects` is owned by `supabase_storage_admin`; the SQL executor role is `postgres`. RLS is already enabled on `storage.objects`. The `expense-receipts` bucket is absent.
- Catalog definitions, constraints, indexes, triggers, policies, and function definitions are saved in the companion pre-apply JSON snapshots. These contain schema metadata, not customer/staff business rows.

Approved SQL SHA-256 at validation and after the concurrent HEAD change:

| Version | SHA-256 |
| --- | --- |
| `20260927120000` | `A9B59107D7727BF0F089E52E1986327E7AFD7CA46B06F245B2045BE3C6FAEDDB` |
| `20260927130000` | `1E908E6D587C2955800D18C896F30302E8F0B753AD5F209A1D0D034CBD6994DF` |
| `20260927140000` | `9B2FF0AA5F95959252CEB5EC90A6DDA209E542FC6EEDA7EB82682A84282BC5C8` |
| `20260928120000` | `349F3C4F648BB30C27000B7955D7336147A54B3E6E02EC1BAFEE3EF0D46366A3` |
| `20260929120000` | `8CB4D1AA833C1A006B5450D0FB445691BEB5A2C66AC057A7A53FB4EA42F4D304` |
| `20260929130000` | `BBCF0CF2403AD1513FC8D79AED7381F0A5FA9E9B3EC9C45174B89F5297ECBE72` |
| `20260929140000` | `3C89A6A9488A7E11DAAC4B687EF226FFAE224ACB5A3467EDB8160CF96E588F85` |

## Rollback-only validation and exact failure

The seven reviewed SQL bodies were submitted in approved order inside one explicit `BEGIN ... ROLLBACK` validation transaction, with the files' outer `BEGIN/COMMIT` wrappers removed for validation only. A five-second lock timeout and 120-second statement timeout were set locally. No migration-history insert was included.

Validation reached **migration 5, `20260929120000_cf7_expense_receipt_storage.sql`**, then failed:

```text
ERROR: 42501: must be owner of table objects
```

The first ownership-requiring CF7 statement is `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` at line 29. The target's owner is `supabase_storage_admin`, while the available execution role is `postgres`. CF7 also contains storage-object policy changes whose ownership requirements must be reviewed before any persistent apply. This is a material live prerequisite mismatch; the owner instruction requires a stop. No repair was improvised.

**LIVE READ-ONLY VERIFIED FACT — post-failure state:** `financial_accounts`, `order_payable_items`, `financial_expense_categories`, and `cash_sessions` remain absent; all seven approved migration-history versions still have zero rows; the receipt bucket and new payment RPCs remain absent; storage RLS and the old snapshot-RPC grant are unchanged. The validation transaction left no verified persistent schema effect.

## Apply-path limitation

The direct Supabase CLI `migration list --linked` could not connect from this host: TCP timeout to the project's pooler on port 5432, including an escalated attempt. Supabase MCP `apply_migration` exposes a migration name and SQL body but no explicit version field, so it cannot guarantee the seven approved filename versions in migration history. No substitute history repair or generic `db push` was attempted.

## Migration and runtime results

| Approved migration | Persistent apply | Expected objects verified after apply |
| --- | --- | --- |
| `20260927120000_cf2_financial_foundation.sql` | Not attempted | Not applicable |
| `20260927130000_cf3_order_payables_allocations.sql` | Not attempted | Not applicable |
| `20260927140000_cf4_atomic_payment_writer.sql` | Not attempted | Not applicable |
| `20260928120000_cf6_operational_cash_flow_writers.sql` | Not attempted | Not applicable |
| `20260929120000_cf7_expense_receipt_storage.sql` | Validation failed before apply | Not applicable |
| `20260929130000_cf8_cash_sessions_foundation.sql` | Not attempted | Not applicable |
| `20260929140000_cf8_booking_payment_command.sql` | Not attempted | Not applicable |

No controlled payment, partial-payment, idempotency, no-payment, Cash Flow UI, Cradle Flow UI, cash-session, or post-apply security runtime test was performed. They require all seven migrations to pass validation and be applied.

## Data impact and rollback

No historical booking/payment rows were inspected or changed, and no backfill, receipt, allocation, or QA row was created. There are no successfully applied CF migrations to roll back. The old application/database contract remains live. Do not delete evidence or change migration history to address this block.

## Required correction before another apply attempt

Review CF7's `storage.objects` ownership-sensitive DDL and policy operations against the production catalog; produce and review a corrected version of the still-unapplied approved migration, then revalidate the full sequence. Establish an apply path that records exactly the seven authorized versions without replaying the 84 historical local-only migrations. A new explicit owner instruction is needed before changing the approved migration SQL or resuming production apply.
