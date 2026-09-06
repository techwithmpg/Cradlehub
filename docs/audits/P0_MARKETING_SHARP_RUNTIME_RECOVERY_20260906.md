# P0 Marketing Studio Sharp Runtime Recovery Evidence

Date: 2026-09-06 (Asia/Singapore)

## Target and status

- Target: CradleHub Web
- Incident: authenticated Marketing Studio requests return HTTP 500 in production
- Production baseline and base SHA: `feda4600f37e93084fdb672bd0c2612e9872bb43`
- Fix branch: `fix/p0-marketing-sharp-vercel-runtime`
- Runtime/test head verified locally and deployed to Preview: `624b4d3ca3dc0831e905447bcc1360de26afc032`
- Affected URLs: `/marketing` and `/marketing/media`
- Result at this evidence checkpoint: CORRECTION REQUIRED because Vercel Deployment Protection and the absence of an authorized Marketing browser session prevented the required authenticated Preview runtime and log verification.
- Production status: fix pending review and an approved merge/deployment; production was not changed.

## Incident evidence and root cause

Owner-supplied production runtime-log evidence for deployment
`feda4600f37e93084fdb672bd0c2612e9872bb43` records:

```text
GET /marketing -> HTTP 500
Failed to load external module sharp
Could not load the "sharp" module using the linux-x64 runtime
ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.6: cannot open shared object file
```

The repository import chain on that baseline was:

```text
/marketing server render
  -> src/app/(dashboard)/marketing/page.tsx
  -> src/lib/queries/marketing-media.ts
  -> eager media-contracts-server import
  -> top-level sharp import
  -> missing Linux libvips runtime
  -> HTTP 500
```

`pnpm-workspace.yaml` also listed Sharp as an ignored built dependency, so the
native package lifecycle was not accepted by the repository package-manager
configuration.

## Existing fix review

### `c38b573a2be99ed9102d2f1c9bd342acaff7b9a1`

Accepted:

- allows the Sharp native build and removes Sharp from ignored build dependencies;
- preserves the existing Next.js configuration while declaring Sharp server-only;
- removes the eager media validation import from the read-query module;
- dynamically imports server validation only for an intent-bound upload;
- retains server-side validation before database reservation and Storage upload.

No rejected runtime behavior was found.

### `4c207fa17a23fb8da36cf7ec55b94ddccebfe51d`

Accepted:

- adds precise pnpm trace globs for Linux x64 Sharp and libvips;
- covers the direct Sharp 0.35.4 package and Next.js' Sharp 0.34.5 dependency;
- avoids speculative non-Linux packages.

Correction required:

- the added test proved the mocked validator was not called by reads, but it
  would still pass if the Sharp-bearing module were eagerly imported again.

### `624b4d3ca3dc0831e905447bcc1360de26afc032`

- records mocked module initialization separately from validator invocation;
- proves both Marketing read functions leave the Sharp-bearing module unloaded;
- proves valid intent-bound uploads dynamically initialize validation and follow
  the existing database/Storage pipeline;
- proves invalid media stops before database reservation or Storage upload.

## Changed files and exact solution

Runtime branch changes relative to the production base:

- `pnpm-workspace.yaml`: allow the Sharp build and stop ignoring it;
- `next.config.ts`: keep Sharp server-external and include the two precise pnpm
  Linux x64 Sharp/libvips package trees in output tracing;
- `src/lib/queries/marketing-media.ts`: remove the eager validator import and
  dynamically load it only inside the intent-bound upload path;
- `tests/lib/marketing/media-queries.test.ts`: cover the module-load boundary,
  valid upload persistence, and invalid pre-persistence rejection.

This evidence file is the only scope addition and is required by the P0 brief.

## Runtime packaging evidence

The clean Node 24 / pnpm 10.33.2 install completed successfully. The Next.js
16.2.4 production build emitted both Marketing route trace manifests with:

- `@img/sharp-linux-x64@0.35.4/.../sharp-linux-x64-0.35.4.node` (415,112 bytes);
- `@img/sharp-libvips-linux-x64@1.3.3/.../libvips-cpp.so.8.18.6`
  (18,621,496 bytes).

Both files exist in the installed pnpm tree. The `/marketing` and
`/marketing/media` NFT manifests include both package trees. No
`media-contracts-server`, Linux Sharp, or libvips reference was found in
`.next/static`.

## Security, database, and Storage impact

- Authorization: unchanged. Server queries/actions continue to derive the user
  from Supabase auth and the active staff role. Only `owner` and
  `digital_marketer` can reach Marketing operations.
- Unauthorized behavior: verified fail-closed with a real Front Desk browser
  session; direct loads and refreshes of `/marketing` redirect to
  `/select-workspace`.
- RLS: unchanged and not disabled.
- Client boundary: no privileged module, service-role credential, Sharp import,
  or trusted browser-supplied role was introduced.
- Validation: remains authoritative and server-side before persistence.
- Database: no migration, schema change, database write, or production-data
  mutation was performed.
- Storage: no production or Preview object was uploaded, deleted, or changed.
  Database reservation remains before Storage, and existing failure tracking is
  preserved.
- Cache/revalidation: existing Marketing and public-site revalidation behavior is
  unchanged.

## Automated verification

Environment:

```text
Node 24.14.0
pnpm 10.33.2
Next.js 16.2.4
Sharp 0.35.4
```

Commands and results:

```text
$taskNode = C:\Users\eleur\AppData\Roaming\fnm\node-versions\v24.14.0\installation\node.exe
$taskPnpm = C:\Users\eleur\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs

& $taskNode $taskPnpm install --frozen-lockfile --force
PASS — completed in 18m 32.2s; Sharp install check completed.

& $taskNode .\node_modules\vitest\vitest.mjs run tests/lib/marketing/media-queries.test.ts
PASS — 1 file, 19 tests.

& $taskNode .\node_modules\vitest\vitest.mjs run tests/lib/marketing/media-queries.test.ts tests/lib/marketing/media-contracts.test.ts tests/lib/marketing/marketing-studio-foundation-migration.test.ts tests/lib/marketing/public-consumer-parity.test.tsx tests/lib/marketing/brand-server-actions.test.ts
PASS — 5 files, 48 tests before the corrective test; the corrected focused file
then passed with 19 tests.

& $taskNode .\node_modules\typescript\bin\tsc --noEmit
PASS after deleting stale generated .next types from another branch.

& $taskNode .\node_modules\eslint\bin\eslint.js .
PASS — 0 errors, 9 existing warnings.

& $taskNode .\node_modules\vitest\vitest.mjs run
PASS — 212 files, 1,518 tests.

& $taskNode .\node_modules\next\dist\bin\next build
PASS — Next.js production build; 114 static pages generated and both Marketing
routes emitted as dynamic server-rendered routes.

& $taskNode .\scripts\check-format.mjs --check
BASELINE FAILURE — 74 unrelated existing files remain unformatted. None is one
of the four P0 runtime/test files. A focused Prettier check over all four P0 files
passes.
```

No docs verifier, preflight, or stage-verifier script is declared in
`package.json` or present under `scripts/` for this repository.

## Local runtime and public-site evidence

The production build was served at `http://localhost:3010`.

- `/login`: direct HTTP 200 and browser-rendered sign-in UI.
- `/marketing`: unauthenticated request redirects to `/login`; authenticated
  Front Desk request redirects to `/select-workspace`; direct refresh behaves the
  same; no HTTP 500 or Sharp initialization error appeared.
- `/marketing/media`: unauthenticated request redirects to `/login`; no HTTP 500
  or Sharp initialization error appeared.
- `/`, `/services`, `/book`, `/branches`: direct HTTP 200.

Positive-path rendering of all Marketing sections and local upload UI were not
executed because the available saved account has only Front Desk and Staff Portal
workspace access, not Marketing access.

## Vercel Preview evidence

- Deployment ID: `BsdmD6mABSC18NqWLLsfG8G98d8Q`
- Deployment URL:
  `https://cradlehub-git-fix-p0-marketin-c5d6eb-techwithmpg-6128s-projects.vercel.app`
- Deployed Git SHA: `624b4d3ca3dc0831e905447bcc1360de26afc032`
- GitHub/Vercel status: READY/success at `2026-09-06T01:57:46Z`.

Runtime QA limitation:

- the Preview has Vercel Deployment Protection enabled;
- direct `/marketing` requests return HTTP 302 to Vercel SSO before invoking the
  application;
- the machine has no Vercel CLI session, Vercel browser session, or configured
  deployment-bypass secret;
- GitHub OAuth reached the GitHub sign-in screen but no saved GitHub browser
  session was available;
- therefore authenticated direct-load, hard-refresh, safe upload, and Vercel
  runtime-log searches for `sharp`, `libvips`, `ERR_DLOPEN_FAILED`, and HTTP 500
  could not be completed.

READY deployment status is recorded only as build/deployment evidence. It is not
claimed as Preview runtime verification.

## Production impact and verification status

No commit was merged to `main`, no production deployment was initiated, and no
production content or data was changed. The production incident must not be
reported resolved until the reviewed fix is approved, deployed, and the two
authenticated production routes and runtime logs are verified.

Current status:

```text
PREVIEW DEPLOYED — AUTHENTICATED PREVIEW RUNTIME VERIFICATION BLOCKED
PRODUCTION FIX PENDING APPROVED MERGE/DEPLOYMENT
```

## Remaining required evidence

With a Vercel team session and an `owner` or `digital_marketer` test account:

1. directly load and hard-refresh `/marketing` and `/marketing/media` on the
   Preview;
2. verify all Marketing panels and media inventory render;
3. validate one safe valid and one invalid media upload only if Preview points to
   an explicitly non-production data target;
4. inspect runtime logs for both paths and the known Sharp/libvips error strings;
5. only after owner review, merge/deploy through the accepted production process
   and repeat authenticated route and log verification in production.

## Rollback

Revert only the three P0 branch commits (and this evidence-only commit if desired)
in reverse order. No schema rollback or data restoration is required because the
fix contains no migration and this verification performed no database or Storage
mutation.
