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

## 2026-05-01 — BRAND-001 execution notes

- A repo-wide `Select-String` scan timed out and hit `.next/dev/lock` read contention while searching all files.
  - Resolution: narrowed searches to `src/**` only for source-safe, deterministic results.
- `rg` remains unavailable in this environment (`Access is denied` on packaged `rg.exe`).
  - Resolution: used PowerShell-native `Get-ChildItem` + `Select-String` for all code search operations.

## 2026-05-01 — BRAND-002 execution notes

- A PowerShell `Select-String` command failed due an unescaped quoted regex pattern while searching for additional brand placeholders.
  - Resolution: reran searches with simplified patterns and validated logo references using explicit path checks.
- `rg` remains unavailable in this environment (`Access is denied` on packaged `rg.exe`).
  - Resolution: continued using `Get-ChildItem` + `Select-String` for all repository searches.
- `git commit -m "fix(brand): replace old logo with new gold logo"` failed with `.git/index.lock` permission denied.
  - Resolution attempt: requested elevated commit permission; request was rejected, so commit could not be created in this session.

## 2026-05-02 — BRAND-003 execution notes

- `pnpm build` initially failed after adding `webpack` SVG loader:
  - Error: Next.js 16 with Turbopack default rejects custom `webpack` config without Turbopack config.
  - Resolution: moved SVG loader config to `next.config.ts -> turbopack.rules` using `@svgr/webpack`, removed `webpack` hook.
- Initial asset generator script (`scripts/generate-brand-logo-assets.cjs`) failed lint due repo rule banning `require()` imports.
  - Resolution: migrated script to ESM (`scripts/generate-brand-logo-assets.mjs`) with `import` syntax.
- `Remove-Item` on temporary trace files returned access denied in shell.
  - Resolution: removed files via `apply_patch` delete hunks instead.

## 2026-05-09 — STABILITY-001 execution notes

- `pnpm test` failed inside the sandbox because Vitest worker forks hit `spawn EPERM`.
  - Resolution: reran `pnpm test` with approved elevated permissions; 70 tests passed.
- A Next start process from an interrupted route-check command kept listening on port `3002`.
  - Resolution: stopped the port `3002` process before continuing.
- Stabilization audit found missing explicit Today aliases:
  - `/manager/today` did not exist even though `/manager` served Manager Today.
  - `/staff-portal/today` did not exist even though `/staff-portal` served Staff Today.
  - Resolution: added redirect aliases to the existing Today routes.
- Notification bell mapped driver/utility "View all" links to missing `/driver/notifications` and `/utility/notifications` routes.
  - Resolution: changed those hrefs to the existing `/driver` and `/utility` panels.
- Public booking success copy still said bookings were confirmed even though current online booking behavior starts public bookings as pending/front-desk-reviewed.
  - Resolution: changed the success copy to "request received" language.

## 2026-05-09 — STAFF-UI-001 execution notes

- Initial `pnpm lint` failed on `react-hooks/set-state-in-effect` because the selected staff row was being repaired inside an effect.
  - Resolution: replaced the effect with derived selected-staff fallback state and a deliberate empty-selection sentinel for the close action.
- A `git diff` command using an unquoted route-group path failed in PowerShell because `(dashboard)` was parsed as syntax.
  - Resolution: reran path-sensitive Git commands with quoted paths.

## 2026-05-09 — STAFF-UI-002 execution notes

- An `rg` inspection command using an unquoted route-group path failed in PowerShell because `(dashboard)` was parsed as syntax.
  - Resolution: reran the search with the route-group path quoted.
- Initial `pnpm type-check` failed after adding tier guards because nullable `staff_type` was passed directly into `Set.has`.
  - Resolution: normalized the nullable value before the non-tier staff type check and reran `pnpm type-check` successfully.

## 2026-05-13 - STAFF-ORG-001 execution notes

- Initial `pnpm lint` failed because ESLint scanned generated files under `.claude/worktrees/**/.next/**`.
  - Resolution: added `.claude/**` to `eslint.config.mjs` global ignores and reran `pnpm lint`; source lint passed with only two pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are still absent in this repo.
  - Resolution: used the existing `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, and `docs/AGENT_RULES.md` files.
- Browser runtime continued to report a stale client chunk requiring `@base-ui/react/button` from `src/components/ui/button.tsx`, even though current source imports Radix `Slot`.
  - Clue: dev logs also showed `GET /sw.js 404`, indicating a stale service worker registration on localhost.
  - Resolution: added a self-unregistering `public/sw.js` and no-store headers for `/sw.js` in `next.config.ts`; restart dev server and hard refresh the browser once.
