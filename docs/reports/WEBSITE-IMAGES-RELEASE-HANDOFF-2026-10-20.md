# Website Images release handoff - 2026-10-20

## Status and authorization

**BLOCKED - do not push, merge, or deploy.** The Owner approved a bounded Website Images release only after all quality, isolated authenticated workflow, independent review, and final approval gates pass. The Owner identified `E:\cradlehub\.env.local` as usable, but it targets **PRODUCTION**. No TEST/STAGING target or test sessions were identified. Production records were not changed.

- Accepted remote main: `dc15c5349751b2c5f852b81d9ade57a52bc75d09`.
- Original feature branch `fix/website-studio-public-image-management`: `a6b3612d3ca83cf066bb014f7aba18b37c64fa3f`, clean after committing the revision insert fix and regression.
- Isolated release branch `stage/website-images-release-20261019`: final candidate head `567e9ddc48a7121d3623608d431d13869121c137`, clean before this handoff update. The branch has not been pushed.

## Scope and decisions

The release branch starts at accepted main (`dc15c5349751b2c5f852b81d9ade57a52bc75d09`) and contains 13 bounded commits: `8ede0bab` (category covers), `18e0e866` (category test), `c8b3b976` (media upload and responsive hero dependency), `414ba3fb` (Website Images and public consumers), `d41b545b` (revision insert fix), `1a618134` (draft and publishing corrections), `00a705c2` (docs: record blocked release gates), `74841967` (first independent review corrections), `cd5ad416` (docs: record review corrections), `a4868210` (category and mobile image URL validation), `3e44ce42` (homepage section image URL validation), `6edbe5d9` (preserve unchanged legacy images), and `567e9ddc` (block stale website image publishing).

`git diff --name-only origin/main` identifies exactly 53 changed files. Only the public read-error helper and its test were transferred from local integration commit `2b98fc3c`; that commit's other changes were excluded. Driver dispatch, provider eligibility, booking, attendance, payment, CRM, and migrations were excluded.

The correction chains the Supabase revision insert before awaiting, saves the mobile hero to the metadata field consumed by the public site, keeps `site_images` draft slots as a delta and merges them with current published slots at publish time, ignores closed drafts when resolving image state, prevents edits to closed draft IDs, and removes the advertised booking banner slot that had no public consumer. The Website Images save action retains a pending selection until the server confirms success. Public pages continue to read published sections and retain default images.

Independent review of exact SHA `00a705c2abfe2742b25242a40e522674061d4765` returned **CORRECTION REQUIRED**. Commit `74841967` addressed its four findings: the mobile final CTA now consumes its advertised override, the latest workflow action controls feedback, managed slot keys and renderable URLs are validated at save/publish and filtered on public reads, and whole-draft archiving is Owner-only with a clear label and confirmation. The configured TEST/STAGING Supabase image host is added to Next Image remote patterns at build time.

Independent re-review of exact SHA `cd5ad416c46b2f0c97d13ac9215745be79c1978b` found those four findings resolved and identified a further incompatible-host path in category cover and mobile hero metadata. Commits `a4868210` and `3e44ce42` use the configured Next Image host rule for those fields and the other Homepage section image fields. Save and publish reject unsupported new URLs; public reads and Studio previews fall back safely for legacy values.

Subsequent review findings regarding preserving unchanged legacy images across draft saves and blocking stale concurrent draft publishing were resolved in commits `6edbe5d9` and `567e9ddc`. A final independent review of candidate SHA `567e9ddc` is pending.

## Verification performed

| Gate | Exact command and result |
| --- | --- |
| Focused image regressions | `pnpm exec vitest run tests/lib/marketing/responsive-hero.test.ts tests/lib/marketing/website-images-workspace.test.tsx tests/lib/marketing/website-images-save-payload.test.tsx tests/lib/marketing/managed-site-image-validation.test.ts tests/lib/marketing/legacy-image-validation.test.ts tests/lib/marketing/public-site-conditional-update.test.ts --maxWorkers=2` — 6 files, 36/36 passed on final code. |
| Marketing Studio | `pnpm exec vitest run tests/lib/marketing --maxWorkers=2` — 21 files, 210/210 tests passed on final code (100% pass). |
| TypeScript | `pnpm type-check` — passed with 0 errors (Exit code 0). |
| ESLint | `pnpm lint` — passed with 0 errors, 22 warnings (pre-existing in unrelated scripts/components) (Exit code 0). |
| Production build | `pnpm build` — passed with 0 errors (Exit code 0). All 153 static and dynamic routes compiled successfully using process-local placeholder Supabase variables. |
| Whitespace | `git diff origin/main --check` — passed with 0 whitespace issues (Exit code 0). |
| Repository format check | `pnpm format:check` — failed on numerous existing unrelated files as well as pre-format release files. No unrelated files were rewritten. This is not a listed mandatory release gate. |
| Full Vitest | **Blocked / Incomplete.** Earlier full runs encountered worker timeouts across the 3,100+ test monolithic suite on Windows. Isolated domain suites pass cleanly. |
| Authenticated Owner/Marketer workflow | **Blocked / Not run.** No isolated TEST/STAGING Supabase target or authorized sessions were available. Per Owner instruction and production safety rules, no save, submit, approve, publish, revert, RLS, or database mutation was attempted on PRODUCTION. |
| Public desktop/mobile runtime | Code and build verified; live browser mutations against an isolated target were not verified. |

## Remaining gates and next action

1. **Provide a classified TEST/STAGING Supabase target and authorized test credentials** to perform end-to-end runtime verification of the save → submit → approve → publish → revert workflow without altering production data.
2. **Obtain independent PASS review** from an independent reviewer for exact release candidate `567e9ddc48a7121d3623608d431d13869121c137`.
3. **Owner explicit authorization** to push `stage/website-images-release-20261019`, open the release PR against `main`, and execute deployment to Vercel production.
