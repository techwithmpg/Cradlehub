# Supabase Migration History Runbook

Migration filenames and live `supabase_migrations.schema_migrations` history are both evidence. Neither may be rewritten casually.

1. Run `supabase/operations/inspect-supabase-migration-history.sql` against the explicitly verified project and export the result as CSV or text.
2. Run `pwsh scripts/audit-supabase-migration-history.ps1 -ProjectRoot . -LiveHistoryPath <export> -ReportPath <report>`.
3. Review every duplicate prefix. Versions `20260521000001`, `20260522000001`, and `20260716090000` are known repository duplicates until evidence resolves them.
4. If either file under a duplicate version is live, do not rename it. Determine the exact statements applied and follow Supabase CLI migration-repair documentation with a backup and peer review.
5. Only a conclusively unapplied duplicate may receive a new version, and only after checking every environment and deployment artifact. This audit script never renames files.

For repair, export history before and after, use the installed CLI's `migration repair --help` rather than guessed flags, and verify schema effects separately. A history repair changes bookkeeping; it does not execute or roll back SQL. Rollback requires a domain-specific compensating migration and backup plan. Already-applied files retain their historical names because renaming them creates false drift and can cause a later deploy to execute old statements again.
