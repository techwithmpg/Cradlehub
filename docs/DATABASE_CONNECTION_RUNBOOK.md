# Database Connection Runbook

This runbook is the reusable CradleHub workflow for Supabase migrations, status checks, type generation, and read-only verification. It intentionally keeps secrets local and out of Git.

## Security Rules

- Treat any database password pasted into chat as compromised.
- Rotate the Supabase database password in the Supabase dashboard before trusting local database tooling again.
- Store local database tooling secrets only in `.env.local` or `.env.database.local`; both are git-ignored.
- Never commit database passwords, pooler URLs, access tokens, service-role keys, JWT secrets, or complete connection strings.
- Do not put database tooling variables under `NEXT_PUBLIC_*`.
- Application browser code uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server-only app code may use `SUPABASE_SERVICE_ROLE_KEY`.
- Migration tooling uses the linked Supabase CLI project first.
- The transaction pooler is only for diagnostics and approved emergency fallback.

## Initial Setup

```powershell
Copy-Item .env.example .env.local
# Fill secrets locally. Never commit .env.local.

pnpm install
pnpm db:doctor
pnpm db:link
pnpm db:status
```

Required local tooling variables:

```env
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_ACCESS_TOKEN=your-personal-access-token
SUPABASE_DB_PASSWORD=your-rotated-database-password
SUPABASE_DB_POOLER_URL=postgresql://user:password@host:6543/postgres?sslmode=require
```

The pooler URL must be URL-encoded, require TLS, and remain local tooling only.

## Before Database Work

```powershell
pnpm db:doctor
pnpm db:status
```

`db:doctor` checks the project-local Supabase CLI, linked project identity, local env shape, pooler URL format, migration-list access, and type-generation support. It masks sensitive values.

`db:status` compares local migration files with linked remote migration history and reports pending local or remote-only versions.

## Apply Migrations

```powershell
pnpm db:push
pnpm db:status
```

`db:push` uses the linked Supabase CLI path. Do not use `--include-all` or migration repair until every mismatch has been inspected.

## Generate Types

```powershell
pnpm db:types
pnpm type-check
```

`db:types` writes to a temporary file first and replaces `src/types/supabase.ts` only after successful linked type generation.

## Verify

```powershell
pnpm db:verify
```

`db:verify` runs a linked read-only SQL probe where the CLI has permission, checks whether `psql` is available for the pooler fallback, and verifies critical CradleHub tables through the server-side Supabase client when service-role credentials are present.

## Full Database-Change Sequence

```powershell
pnpm db:doctor
pnpm db:status
pnpm db:push
pnpm db:types
pnpm db:verify
pnpm type-check
pnpm lint
pnpm test
pnpm build
git diff --check
```

## Migration-History Reconciliation

1. Run `pnpm db:status`.
2. Inspect each pending local and remote-only version.
3. Confirm whether the migration SQL is already reflected in the live schema.
4. Never rerun a non-idempotent migration blindly.
5. Prefer supported Supabase repair commands when schema is correct but history is missing.
6. Record every repaired version and reason in `.context/CHANGELOG.cmd.md` and `.context/ERRORS.cmd.md`.
7. Re-run `pnpm db:status`.

Known versions that require inspection from recent handoffs:

- `20260703022600` may already be reflected in the live schema while missing from migration history.
- Remote-only versions previously reported by CLI drift checks must be inspected before repair.

## Controlled Emergency Fallback

Use this only when urgent schema work is explicitly approved and `pnpm db:push` is unavailable.

1. Verify the migration file and confirm it is safe/idempotent.
2. Confirm `SUPABASE_DB_POOLER_URL` is set locally with TLS.
3. Confirm `psql` is installed:

```powershell
psql --version
```

4. Apply through one transaction:

```powershell
psql $env:SUPABASE_DB_POOLER_URL `
  --set ON_ERROR_STOP=1 `
  --single-transaction `
  --file supabase\migrations\<migration>.sql
```

5. Verify the resulting schema.
6. Reconcile migration history afterward.
7. Record that the migration was manually applied.

If `psql` is unavailable, do not install random tooling or write an ad-hoc SQL executor without documenting the decision and risk.

## Troubleshooting

**EPERM file locks**
- Inspect `Get-Process node`, `Get-Process supabase`, and `Get-Process postgres`.
- Stop only stale CradleHub dev/Supabase CLI processes.
- Document the locked file, holding process, and failed operation in `.context/ERRORS.cmd.md`.

**Blocked pnpm build scripts**
- Run `pnpm ignored-builds`.
- Approve only expected Supabase CLI build scripts.
- Reinstall with `pnpm install` and verify `pnpm db:doctor`.

**Incorrect project link**
- Check `.env.local` `SUPABASE_PROJECT_REF`.
- Run `pnpm db:link`.
- Confirm `pnpm db:doctor` reports matching app/CLI/pooler identity.

**Invalid database password**
- Rotate the DB password in Supabase.
- Update only local git-ignored env files and deployment secrets that intentionally store DB tooling URLs.
- Do not rotate anon/service-role keys unless separately exposed.

**Expired access token**
- Refresh `SUPABASE_ACCESS_TOKEN` locally or run interactive Supabase login.
- Never paste the token in chat or documentation.

**Pooler authentication failure**
- Confirm the pooler username format, host, port `6543`, URL encoding, and `sslmode=require`.
- Do not move the pooler URL into application/client code.

**IPv6 direct-host failure**
- Prefer linked CLI and the transaction pooler. Direct host connectivity may fail in environments without IPv6 routing or IPv4 add-on access.

**Migration already present but missing from history**
- Verify live schema first.
- Use supported Supabase migration repair rather than manually editing `supabase_migrations.schema_migrations`.

**Type-generation failure**
- `pnpm db:types` leaves the checked-in type file untouched on failure.
- Fix CLI auth/link/schema drift, then rerun `pnpm db:types`.

## Production Guardrails

- Do not add production scripts for `db reset`, `drop schema`, `truncate`, or destructive seed data.
- Do not test destructive commands against the linked project.
- Every database change begins with `pnpm db:doctor` and `pnpm db:status`.
- Every migration ends with `pnpm db:types`, `pnpm db:verify`, and normal app verification.
