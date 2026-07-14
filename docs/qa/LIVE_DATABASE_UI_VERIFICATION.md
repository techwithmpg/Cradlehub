# Live Database and UI Verification

This workflow verifies the intended hosted Supabase project without printing
credentials or modifying live records. It is read-only by default.

## Required local environment

Keep these values in ignored `.env.local` or `.env.database.local` files:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_DB_POOLER_URL`

Only the URL and anon/publishable key may use a `NEXT_PUBLIC_` name. Never place
the service-role key, database password, access token, or pooler URL in browser
code. Confirm local files remain ignored with `git check-ignore .env.local
.env.database.local`.

## Confirm and test the connection

Run:

```powershell
pnpm db:doctor
pnpm db:verify-live
pnpm db:status
```

`db:verify-live` verifies that the configured, linked, and URL-derived project
references agree. It uses the official linked CLI Management API SQL path for
read-only PostgreSQL metadata and the server-side Supabase client for bounded REST
table checks. It also checks that anonymous REST can read public branches but
cannot see staff rows. Results are sanitized and use 15-second timeouts.

`db:status` tries the direct linked session connection, then safely falls back to
read-only migration metadata through the Management API. The transaction pooler
on port 6543 supports ordinary read-only SQL but the CLI migration-list command
uses prepared statements that are incompatible with transaction pooling. None of
these fallback paths are permission to repair migration history.

## Read-only verification helpers

Import helpers from `scripts/database/live-verification.mjs` in local QA scripts:

- `verifyLiveDatabaseConnection()`
- `queryLiveDatabaseReadOnly()`
- `verifyTableExists()`
- `waitForDatabaseCondition()`
- `compareUiAndDatabaseState()`
- `createQaRunId()`
- `identifyQaRecord()`
- `produceSanitizedVerificationReport()`

The SQL helper rejects statements that do not begin with `SELECT`, `WITH`,
`SHOW`, or `EXPLAIN`. This is a QA layer, not an application data-access layer.

## Authenticated browser sessions

Use dedicated QA accounts for CRM, ordinary staff, driver, manager, and owner.
Create one local storage state per role only after a manual approved sign-in.
Store states under `.playwright/.auth/` or `playwright/.auth/`; both paths are
ignored. Never inspect, print, commit, or share their cookies or refresh tokens.
Use the configured `http://localhost:3000` origin consistently to prevent stale
cross-port cookie reuse. Verify each role's expected and denied workspaces.

## UI-to-database comparison

For read-only checks, record the UI branch/date and aggregate values, then run a
bounded aggregate query through `queryLiveDatabaseReadOnly()`. Report only counts,
statuses, timestamps, and masked identifiers. Never include phone numbers, health
notes, private notes, tokens, or unnecessary names.

For future writes, first create a `createQaRunId()` value and prepare exact-ID
cleanup. Label every QA record with `QA_RUN:<id>` or `metadata.qa_run_id`. Obtain
explicit user approval before the first live mutation. Cleanup may target only
records positively identified by `identifyQaRecord()` and exact created IDs.

## Migration reconciliation

Treat migration drift as a planning exercise. Do not run `db push`, migration
repair, history inserts, resets, or schema changes during verification. Compare
local versions with the read-only `supabase_migrations.schema_migrations` query,
map remote-only versions to actual schema effects, identify duplicate local
version prefixes, and produce a reviewed reconciliation plan before requesting
approval for any correction.
