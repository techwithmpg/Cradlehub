# Website Images release handoff — 2026-10-20

## Status and authorization

**BLOCKED — do not push, merge, or deploy.** The Owner approved a bounded Website Images release only after all quality, isolated authenticated workflow, independent review, and final approval gates pass. The Owner identified `E:\cradlehub\.env.local` as usable, but it targets **PRODUCTION**. No TEST/STAGING target or test sessions were identified. Production records were not changed.

- Accepted remote main: `dc15c5349751b2c5f852b81d9ade57a52bc75d09`.
- Original feature branch `fix/website-studio-public-image-management`: `a6b3612d3ca83cf066bb014f7aba18b37c64fa3f`, clean after committing the revision insert fix and regression.
- Isolated release branch `stage/website-images-release-20261019`: corrected implementation head `748419672cf4b13094a1ae3b16797f1b29bd0665`, clean before this handoff update. The branch has not been pushed.

## Scope and decisions

The release branch starts at accepted main and contains seven bounded implementation commits: `8ede0bab` (category covers), `18e0e866` (category test), `c8b3b976` (media upload and responsive hero dependency), `414ba3fb` (Website Images and public consumers), `d41b545b` (revision insert fix), `1a618134` (draft and publishing corrections), and `74841967` (independent review corrections). `git diff --name-only origin/main` is the exact changed-file inventory. Only the public read-error helper and its test were transferred from local integration commit `2b98fc3c`; that commit's other changes were excluded. Driver dispatch, provider eligibility, booking, attendance, payment, CRM, and migrations were excluded.

The correction chains the Supabase revision insert before awaiting, saves the mobile hero to the metadata field consumed by the public site, keeps `site_images` draft slots as a delta and merges them with current published slots at publish time, ignores closed drafts when resolving image state, prevents edits to closed draft IDs, and removes the advertised booking banner slot that had no public consumer. The Website Images save action retains a pending selection until the server confirms success. Public pages continue to read published sections and retain default images.

Independent review of exact SHA `00a705c2abfe2742b25242a40e522674061d4765` returned **CORRECTION REQUIRED**. Commit `74841967` addresses its four findings: the mobile final CTA now consumes its advertised override, the latest workflow action controls feedback, managed slot keys and renderable URLs are validated at save/publish and filtered on public reads, and whole-draft archiving is Owner-only with a clear label and confirmation. The configured TEST/STAGING Supabase image host is added to Next Image remote patterns at build time. An independent re-review of the corrected final SHA is still required.

## Verification performed

| Gate | Exact command and result |
| --- | --- |
| Focused image regressions | `pnpm exec vitest run tests/lib/marketing/managed-site-image-validation.test.ts tests/lib/marketing/website-images-workspace.test.tsx tests/lib/marketing/website-images-save-payload.test.tsx tests/lib/marketing/draft-publication-pipelines.test.ts tests/lib/marketing/public-consumer-parity.test.tsx --maxWorkers=2` — 5 files, 49/49 passed on corrected code. |
| Marketing Studio | `pnpm exec vitest run tests/lib/marketing --maxWorkers=2` — 19 files, 192/192 tests passed on corrected code. |
| TypeScript | `pnpm type-check` — passed on implementation head. |
| ESLint | `pnpm lint` — exit 0, 22 warnings, no errors. |
| Production build | `pnpm build` — exit 0 on corrected implementation head using process-local nonproduction placeholder Supabase values; static generation logged expected `fetch failed` warnings because no service was attached. |
| Whitespace | `git diff origin/main --check` — passed. Corrected release files were formatted individually. |
| Repository format check | `pnpm format:check` — failed on numerous existing unrelated files as well as pre-format release files. No unrelated files were rewritten. This is not a listed mandatory release gate. |
| Full Vitest | **Failed on the preceding candidate; not repeated after review fixes.** `pnpm exec vitest run`: 3,162 passed, two unrelated test timeouts. `pnpm exec vitest run --maxWorkers=4`: 3,160 passed, one unrelated CRM timeout and one fork-worker startup timeout. `pnpm exec vitest run --pool=threads --maxWorkers=8 --testTimeout=15000`: 3,123 passed and five thread-worker startup timeouts. The timed-out attendance, media, and CRM files passed when run alone. A clean full-suite result on the corrected candidate is still required. |
| Authenticated Owner/Marketer workflow | **Not run.** No isolated TEST/STAGING Supabase target or authorized sessions were available. No save, submit, approve, publish, revert, RLS, or database mutation was attempted on PRODUCTION. |
| Public desktop/mobile runtime | Code and build verified; browser rendering against an isolated target was not verified. |

The read-only PRODUCTION Auth health request failed with `HttpRequestException`; this does not establish a database or Auth outage, because outbound network access from this executor may be restricted.

## Remaining gates and next action

Provide a classified TEST/STAGING Supabase target and authorized Owner/Digital Marketer test sessions, then verify save → submit → approve → publish → revert plus desktop/mobile public rendering without touching production data. Obtain a clean full Vitest result, resolve any independent review corrections, reconcile accepted main, repeat affected checks, then obtain an explicit recorded independent PASS and final Owner approval for the exact reviewed SHA. Only then may the branch be pushed, opened as a PR, merged under the accepted process, and the production deployment verified. No production migration or manual record insertion is authorized by this handoff.
