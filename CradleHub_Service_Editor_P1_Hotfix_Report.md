# Service Editor P1 Hotfix Evidence

## Authorization and scope

- Owner request: service editor save hotfix, local verification, review, then merge and push only on PASS.
- Isolated branch: `fix/service-editor-save` from fetched `origin/main` `03242a0bfbcfe6c4b1b03ba624510004cae7cc6a`.
- The initial `E:\cradlehub` checkout was `main` at `f8977cce5c1286402eed2e6805ba0428c38dc660` with an existing deletion of `STAGE_08A_EVIDENCE.md`; it was not altered for this hotfix.
- The separate Cash Flow worktree was initially `stage/cf-financial-foundation` at `54f17e4fdc574a2aa8c603aa69cab1e40071b68f` with two uncommitted changes. It was not altered by this hotfix; a later observation found it independently advanced to `d0d7f105521abf17b90fd0c542c753b7362c0ae4` with a clean tree.
- Scope: Marketing service save, Owner service editor, shared canonical `services` mutation and media picker, targeted tests.
- No SQL, migration, Auth, RLS, Storage-policy, booking-price, or service-ID changes.

## Diagnosis

- **Confirmed code defect:** Services Studio submitted `metadata`, while `saveMarketingDraftAction` reads `metadataJson`. The action silently received `{}`, so short description, badges, and inclusions were lost on draft save. The submitted image and alt fields use separate inputs.
- Marketing live edits and Owner catalog edits used separate `services` updates with different cache invalidation. The Owner editor had no image control and ignored an unsuccessful save result.
- A UI regression test found that React reset uncontrolled Owner form fields after an action returned an error. The form now submits without clearing values on failure.
- The reported route crash has not been captured from browser/server logs. The available `.env.local` Supabase URL is a remote project; this hotfix did not send it a mutation. The LOCAL Supabase stack was absent at the start of QA.

## Implementation

- Both Owner and Marketing live update actions call `updateCanonicalService`, which validates the same service ID, updates the same `services` row, preserves unrelated metadata, confirms the row was updated, and invalidates Marketing, Owner, public, booking, and branch caches.
- Marketing draft saves submit the expected metadata field and show a failed-save message while retaining form state.
- Owner editor uses the existing Marketing `SERVICE_PHOTO` media picker and upload flow, stores `image_url` and `image_alt` on the canonical service, and shows save failures while retaining entered values.
- The existing public catalog and booking readers remain unchanged.

## Verification to date

- Final selected service editor, shared mutation, Marketing draft/publication, media, and booking tests: 173/173 PASS across 26 files.
- Booking regression suite `pnpm vitest run tests/lib/bookings/`: 111/111 PASS.
- `pnpm type-check`: PASS.
- Targeted ESLint: 0 errors; one pre-existing `_revisions` unused warning in the touched Services Studio file.
- `pnpm lint`: FAIL on 88 errors and 26 warnings outside this hotfix scope (including Staff UI, scanner, and PWA tests).
- `pnpm build` with LOCAL placeholder Supabase URL and keys: PASS. Without any Supabase URL, the build failed during `/marketing` prerender with `supabaseUrl is required`.
- `git diff --check`: PASS.
- Broad `tests/lib/services/` run: 2 unchanged migration-text tests failed on CRLF-sensitive string expectations; 181 other tests passed. The failed test and migration files are unchanged by this hotfix.

## Local and production state

- LOCAL Supabase startup was attempted twice (full, then only required services). Docker image pulls remained in progress and `supabase status` still found no LOCAL database container. The startup attempt was stopped. The LOCAL Next.js server reached Ready on port 3001, but `/marketing` redirected to login with no LOCAL Auth service; it was then stopped. Browser save/reload and cross-editor persistence remain **UNVERIFIED**.
- No production service was mutated. **PRODUCTION MUTATION VERIFICATION NOT PERFORMED.**
- Merge, push, and deployment remain pending the required PASS gate.
- Latest fetch left `origin/main` at the hotfix base SHA; no reconciliation conflict is known at this point.

## Next permitted action

Complete LOCAL or identified TEST database browser QA for Marketing description/image save, Owner description/image save, reload persistence, and cross-editor consistency. Review the exact hotfix diff and reconcile with current `origin/main`; merge and push only if the owner-requested gate is PASS.
