# Production discount checkout database execution

**Verdict: PASS — production SQL installation and required read-only database verification succeeded.** Application release/enablement is separate and was not performed.

## Authorization and actual target

- Owner authorization: attached “EXECUTE DISCOUNT CHECKOUT MIGRATION ON LIVE SUPABASE”, approved for this exact production database package only.
- Project: **Creadlehub**, reference **`lsrbwqhvzjfpiabeolkv`**, region `ap-northeast-1`, confirmed `ACTIVE_HEALTHY`.
- Target classification: **PRODUCTION**; database `postgres`, PostgreSQL `17.6` (project engine 17).
- Authorized Supabase connection: **Primary**; actual SQL `current_user` and `session_user`: `postgres`. Database CREATE, public-schema CREATE and prerequisite-table REFERENCES privileges all confirmed.

## Exact package and execution

- Approved file: `E:\cradlehub\docs\releases\2026-11-03-discount-checkout-production.sql`.
- Read completely from disk; submitted **once, unchanged**, 33,404 UTF-8 bytes.
- Package SHA-256, verified before and after execution: `3149c979d1bdc06fec3fa330b87e0df4f660b3ee06c8668778490325ee08f897`.
- Package matches reviewed repository commit `c320018fe95be4b2f4c185153c78e10f01c147c8`; the earlier LOCAL/TEST file was not substituted.
- Source migration `20261102114848_recipient_discount_checkout` SHA-256: `048e938b1a49aef7d6820820d35176688ad55163c3c27a64a2b4ea3c2060c9ee`. This is distinct from the guarded package checksum.
- Mechanism: official connected Supabase **`execute_sql`**, administrative session. The migration-registration API was deliberately not used because the owner prohibited new/repair migration-history entries.
- Start: **2026-11-03 01:16:06 Asia/Singapore** (`2026-11-02 17:16:06 UTC`).
- Completion: **2026-11-03 01:16:10 Asia/Singapore** (`2026-11-02 17:16:10 UTC`).
- Execution returned `isError=false`, with the exact final SQL response:

```json
[{"status":"Discount database objects installed; application server release flag and restart still required"}]
```

The unchanged package's BEGIN, timeouts, preflight, installation, postchecks, NOTIFY and COMMIT were all submitted together. The final response was reached after COMMIT, and subsequent separate-session catalog queries confirmed persistence. No retry, alternative execution mechanism or safeguard bypass was used.

## Live preflight

The read-only preflight before submission confirmed:

- All **81** required typed columns matched; no missing/type-mismatch rows.
- All **34** financial constraints matched; no mismatches.
- All three expected canonical function hashes matched exactly.
- The audit table, private schema and four public discount RPCs were absent.
- Required administrative privileges were present.

The approved package repeated its own checks inside the installation transaction. No preflight or permission checks were weakened.

## Installed objects and verification SQL results

The complete approved `2026-11-03-discount-checkout-verify.sql` file was executed after installation. Supabase returns only the last result set for a multi-SELECT call; its first SELECT was therefore also run separately, read-only, to collect the four RPC rows. Every returned Boolean was `true`.

| Public RPC | Installed | Authenticated EXECUTE | Anonymous blocked |
| --- | --- | --- | --- |
| `quote_order_discounts(uuid,jsonb)` | true | true | true |
| `post_order_payment_with_discounts_atomic(uuid,text,jsonb,jsonb,text,jsonb,date,text,text)` | true | true | true |
| `customer_discount_history(uuid)` | true | true | true |
| `discount_payment_receipt(text)` | true | true | true |

| Audit-table check | Result |
| --- | --- |
| `public.order_discount_audits` installed | true |
| Audit RLS enabled | true |
| Direct authenticated SELECT/INSERT/UPDATE/DELETE/TRUNCATE blocked | true |
| Direct anonymous SELECT/INSERT/UPDATE/DELETE/TRUNCATE blocked | true |

Additional read-only verification confirmed `discount_private` exists; anonymous and authenticated roles have neither USAGE nor CREATE on it and cannot execute `discount_private.authorized_actor(uuid)`. All five new functions are owned by `postgres`, use SECURITY DEFINER with an empty search path, and retain the approved actor/role/branch authorization checks.

The four authenticated public RPCs are the intended entry points for this feature; the internal helper and direct audit-table access remain inaccessible to unprivileged roles.

## Existing payment integrity and data impact

| Existing function | Before/after MD5 of `pg_get_functiondef` |
| --- | --- |
| `post_order_payment_atomic` | `167e73d79d14c66e73f4061f2adf07f6` — unchanged |
| `derive_order_payment_state` | `1bc296ef67ac554360b11f5831cb5a3c` — unchanged |
| `reconcile_closed_booking_service_charge` | `d28b686b3a72001def1f4e05bea35680` — unchanged |

The same 81 prerequisite columns and 34 financial constraints matched after installation. Existing financial writers, booking/payment tables, authorization and RLS safeguards were not replaced or weakened.

Installation performed no DML against existing business records. INSERT statements in the new RPC definitions were defined, not invoked. No live test payment, sample booking, authenticated financial quote or financial posting was performed. Verification read schema/function/permission metadata rather than exporting customer, staff, booking or payment records; a row-by-row business-data comparison was neither needed nor performed.

## PostgREST schema cache

The package's `NOTIFY pgrst, 'reload schema'` committed successfully. A subsequent anonymous request to the **read-only quote** endpoint, with a zero UUID and empty selection list, returned:

```json
{"httpStatus":401,"code":"42501","message":"permission denied for function quote_order_discounts","schemaCacheRecognizesRpc":true}
```

This confirms the API schema cache recognizes the new RPC and blocks anonymous EXECUTE. It was an expected negative authorization check: no quote body, real booking lookup or payment writer was executed. The other three RPCs were verified through catalog/permission checks and were not invoked on production.

## Security Advisor observations

The Security Advisor also ran successfully. Relevant notices describe the approved design, not failed verification results:

- INFO: `order_discount_audits` has RLS with no policies. Direct client access is intentionally denied; authorized history/receipt operations use guarded RPCs. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- WARN: the four intended authenticated public RPCs are SECURITY DEFINER functions. Their explicit identity, active-staff, role and branch checks, qualified objects and empty search paths are retained. Authenticated EXECUTE is intentional; anonymous access and private-helper access are blocked. No permissions were changed to silence this architectural notice. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Unrelated project advisories were not changed. This task is not a blanket security certification of the rest of the production project.

## Migration-history status

- Migration-version count **before: 75; after: 75**.
- Ordered version-list MD5 **before and after:** `95e11799f64439a915dd815aefa9385b`.
- Version `20261102114848` is **not recorded** in `supabase_migrations.schema_migrations`.
- No history row was inserted, repaired, renamed or marked applied. No new migration version or bulk push was performed.

This deliberate ledger limitation remains outstanding. Future migration-history reconciliation requires a separately authorized evidence-backed release action. Do not replay the source/package against the installed objects or run the historical migration folder to normalize history.

## Application flag and deployment — observed state

No feature flag, environment file, application process or Vercel deployment was changed by this task. No server was started/restarted, no application was deployed, and no branch was merged or pushed.

**Important actual finding:** the local `.env.local` already contains `CRADLEHUB_DISCOUNTS_ENABLED=true`. A direct TCP check found **no listener on localhost:3000** at closeout. The file value was not set by this execution and was left untouched under the database-only scope. It would be inaccurate to claim the local configuration is disabled. Hosted production's environment-variable value was not inspected or changed.

The owner instruction still prohibits enabling/restarting an application until the correct reviewed build is released and verified compatible. Reviewed application code is associated with `f19a336c989ef8521a8020e1a3f2498e8b8c7720`; local accepted main remains `d2205694f3f2f3fb826fe3d062d6b3e1b6391018`, and inspected `origin/main` remains `9a232f9e13bde5eca8c9ec714e05116781d3c689`. Application rollout/activation was not completed or certified by this database installation.

## Limitations and rollback

Database installation and all required read-only checks passed. No live discounted payment, hosted application/Auth flow, refund lifecycle or physical printer outcome was tested or certified. The new feature must not be treated as an application release merely because its database objects now exist.

The transaction is committed; do not rerun the package or drop audit/financial data to undo it. Keep application activation gated. Any later rollback or financial correction must preserve committed audit/payment evidence and use a separately reviewed change or established reconciliation/refund process. This task performed no rollback because installation succeeded.

Machine-readable evidence: `2026-11-03-discount-checkout-production-execution.json`. No credentials, access tokens or customer financial data are included.
