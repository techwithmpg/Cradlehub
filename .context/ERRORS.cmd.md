# 🚨 ERRORS

_No errors logged yet._

## 2026-04-30 — ORG-002 seed verification environment blocker

- `pnpm db:push` failed because `supabase` binary is not installed globally in this shell.
- `npx -y supabase@latest db push --linked` reached the CLI but failed DNS/IPv6 resolution for the remote Supabase host in this environment.
- Result: migration/seed SQL is authored and ready, but remote apply must be run from a network-enabled environment.

## CradleHub-Specific Gotchas

| Gotcha | Solution |
|--------|----------|
| `supabase db push` re-applies old migrations | Run `supabase migration repair --status applied <version>` for each |
| `supabase.ts` shows empty Database type | Run `pnpm db:types` to pull types from live schema |
| Middleware sends all users to /login | Check staff.auth_user_id matches the Supabase Auth UUID |
| `get_available_slots` returns empty array | Verify: branch is_active=true, service is_active=true, staff has schedule for that day_of_week |
| Build error on sonner import | Ensure `@/components/ui/sonner` was added via `pnpm dlx shadcn@latest add sonner` |

## 2026-05-01 — CSR-001 execution notes

- `pnpm test` initially failed inside sandbox with Vitest worker `spawn EPERM` (`[vitest-pool]: Failed to start forks worker`).
  - Resolution: rerun `pnpm test` with elevated permissions; tests passed.
- `rg` command could not run in this environment (`Access is denied` from packaged `rg.exe` path).
  - Resolution: used PowerShell-native file search (`Get-ChildItem` + `Select-String`) for repo inspection.

## 2026-05-01 — STAFF-005 context/doc workflow notes

- Initial reads for `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` at repo root failed with `Cannot find path` because these files are located under `docs/` in this repository.
  - Resolution: located and read `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, and `docs/AGENT_RULES.md` before coding.
- `apply_patch` failed on `.context/CHANGELOG.cmd.md` due invalid UTF-8 bytes in the existing file.
  - Resolution: appended the new changelog entry using `Add-Content` via PowerShell instead of `apply_patch`.
