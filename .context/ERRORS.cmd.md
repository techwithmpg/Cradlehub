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

## 2026-05-14 - NOTIF-001 audit findings

- Duplicate source confirmed in `src/app/staff-onboarding/actions.ts`.
  - Submission created an urgent owner notification and an urgent manager notification for the same onboarding request.
  - If the applicant selected no services, submission also created a second manager action notification (`staff_profile_incomplete`) for the same underlying review task.
  - Old dedupe only matched same workspace + same type + same entity, so different notification types for one workflow were not collapsed.
  - Resolution: staff onboarding now emits a central workflow event that creates one manager workflow task and stores missing-service detail in task metadata.
- Owner notification noise confirmed for routine onboarding.
  - Resolution: routine onboarding no longer emits owner urgent notifications; owner activity history remains a future connection point.

## 2026-05-14 - BOOKING-WIZARD-UX-10.2 verification notes

- First temporary `/book` smoke test attempted to start `pnpm dev -- --port 3012`, which Next interpreted as an invalid project directory (`E:\cradlehub\--port`).
  - Resolution: corrected the argument shape to `pnpm dev --port 3012`.
- Starting a second dev server on port 3012 was blocked because an existing Next dev server was already running for `E:\cradlehub` on port 3000.
  - Resolution: did not stop the existing server; used `http://localhost:3000/book` for a smoke test, which returned `200 OK`.

## 2026-05-20 - BOOKING-HOME-SERVICES-001 findings

- Public booking home-service availability was blocked by branch-service schema drift:
  - Admin service management read current `branch_services.visibility` and `available_home_service`.
  - Public booking first tried to filter on legacy `booking_visibility`, then fell back to a minimal select that omitted `available_home_service`.
  - Resolution: public booking now reads the current branch-service shape first, normalizes current/legacy visibility fields, and preserves visit-type eligibility flags.
- Next.js 16 `revalidateTag(tag, {})` did not express the immediate-expiry behavior needed after service setting updates.
  - Resolution: branch-service invalidation now calls `revalidateTag(tag, { expire: 0 })`.
- A rerun of `pnpm lint` scanned a temporary Chrome profile under `.codex-artifacts/chrome-home-services` and failed on bundled extension JavaScript.
  - Resolution: added `.codex-artifacts/**` to ESLint global ignores and `.codex-artifacts/` to `.gitignore`, matching the existing generated-output ignore pattern.

## 2026-05-20 - SCHEDULE-ADJUSTMENT-001 execution notes

- Root `ROADMAP.md` and `PROJECT_CONTEXT.md` requested by the prompt are absent in this repo.
  - Resolution: followed the repo's existing convention from prior error notes and read `docs/ROADMAP.md` and `docs/PROJECT_CONTEXT.md`.
- `pnpm type-check` initially failed inside the sandbox because TypeScript could not write `tsconfig.tsbuildinfo` (`EPERM`).
  - Resolution: reran `pnpm type-check` with approved permissions; it passed.
- The first post-change `pnpm build` attempt hit generated `.next` chunk load errors after earlier sandbox/permission-interrupted builds.
  - Resolution: verified `E:\cradlehub\.next`, deleted only that generated build output, reran the production build from a clean `.next`, and it passed.
