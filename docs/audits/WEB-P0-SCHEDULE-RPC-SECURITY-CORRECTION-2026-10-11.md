# Web P0 Schedule RPC security correction — review handoff

## Authority and scope

The owner authorized a narrow correction after the controlled P0 release stopped on the production `get_daily_schedule(uuid,date)` ACL. The accepted base is `origin/main` at `130060a0f8b6b877fab79a7945df706aabee3d5c`. The implementation is on `fix/p0-schedule-rpc-security`, based on the combined Slice B head `8f414149bfe31e39a9bcfc050514e334bc5e8d74`. Implementation commit: `9b4129de56f4b44b0aefb3ca2db245f06c3af666`.

Only the forward P0 SQL artifact and focused Schedule contract tests changed. No production mutation, migration application, deployment, merge, or CRM simulation was authorized or performed.

## Consumer and authorization finding

No current application source calls `supabase.rpc("get_daily_schedule", ...)`. `src/lib/queries/schedule.ts` builds the Schedule from authenticated Supabase table queries. CRM and manager server pages and APIs, the Owner Schedule page, and the Desktop Schedule API consume that query. CRM and manager contexts resolve the branch before querying; the Owner page verifies an active Owner and permits selecting an existing branch; Desktop bearer authentication requires an active CRM-capable staff record and uses its assigned branch. The Staff PWA and public booking paths do not call this RPC. The generated database type retains the RPC signature; historical audit documents describe older callers.

Schedule output still needs booking ID, service, customer, start/end time, resource, status, and type. The correction preserves those fields for the authenticated Schedule query and the SQL function body. It changes direct RPC execution rights instead of removing Schedule data.

Live **PRODUCTION** read-only inspection of project `lsrbwqhvzjfpiabeolkv` found `get_daily_schedule(uuid,date)` owned by `postgres`, `SECURITY DEFINER`, with `search_path=public`. Effective `EXECUTE` was true for `PUBLIC`, `anon`, `authenticated`, and `service_role`. The function contains no `auth.uid()` caller check or caller branch check. Its `is_active` condition filters returned staff; it does not validate the caller. The function joins customers and returns names. No anonymous customer-data retrieval test was performed.

The repository's older `20260712190359_individual_schedule_runtime_only.sql` grants direct execution to `authenticated` and `service_role`. The current application no longer needs either browser or authenticated direct execution, so the corrected contract is `PUBLIC=NO`, `anon=NO`, `authenticated=NO`, `service_role=YES`. An authenticated CRM, manager, or Owner user continues through the existing server/API query and its user-scoped Supabase client. The database runtime behavior of those RLS policies was not retested here.

## Forward migration and truthful ledger

`20261011020713_p0_booking_security_forward.sql` was created with `supabase migration new`. It contains the exact SQL from `20261005043621_p1_booking_confirmation_origin.sql`, preceded and followed by explicit ACL lockdown for `get_daily_schedule(uuid,date)` and `update_booking_progress(uuid,text)`. The original B and A migration files remain unchanged. SHA-256 of the forward artifact: `DF5A620D6E6B86CF645D4A92A06EBFA0F8B069603AD1397D740021D44527EA06`.

Proposed production delivery is one version-scoped Supabase `apply_migration` call with that exact reviewed SQL text and the name `p0_booking_security_forward`, after independent review and a separate owner release gate. The tool records the migration it actually executes and assigns its ledger version; record that returned version and the frozen SQL hash. If the tool cannot guarantee one migration and a truthful ledger record, stop. Do not use ordinary `db push`, `--include-all`, migration repair, or manual ledger edits. The two earlier unapplied P0 file versions must remain recorded as unapplied, with this forward migration documented as their production supersession. The live ledger has 61 versions; 14 applied versions have no matching local filename, while 104 local SQL filenames are absent from the live ledger, so ordinary local-versus-remote filename reconciliation is unsafe.

## Verification and open gates

- Node 24 type-check: passed.
- Focused P0 and Schedule tests: 135 passed; the final added source-inventory assertion passed separately (7 tests in its file).
- Full Vitest run before that final assertion: 2,489 passed, 2 skipped.
- Changed-file ESLint: 0 errors. Build and `git diff --check`: passed.
- SQL tests verify exact booking-origin provenance, final direct-role revocations and service-role grants, pending/confirmed SQL inclusion, and absence of an application caller of the legacy RPC. Schedule query tests preserve pending and confirmed rows with customer identity. Existing auth and Desktop tests remain in the passing full suite.
- **DATABASE RUNTIME AUTHORIZATION TEST NOT VERIFIED.** Docker/local Supabase was unavailable; production was read only. Static and mocked tests are not database or production authorization proof.

The corrected combined P0 release needs independent review, a resolved version-scoped execution method, a fresh production preflight, and explicit owner authorization before any production write. Broad CRM simulation, Owner workspace certification, P1 work, deployment, and merge remain outside this handoff.
