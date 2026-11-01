# PR #58 — QR integration verification and release preparation

**Date:** 2026-11-01
**Repository:** `techwithmpg/Cradlehub`
**Branch:** `fix/attendance-qr-flow-20261101`
**Pre-integration application HEAD:** `f4d4491d1c575bf70bf19022b4b2dd80935dc66c`
**Integrated application merge commit:** `239bce34b692c86475f5245b87a2b72ed8c9cbf6`
**Verdict:** CORRECTION REQUIRED for release verification; local code/security review PASS.

## Authority and repository state

- **VERIFIED FACT:** The initial `git fetch origin main` resolved `aa30aa732351e9e81e567d189562f4ca815d5bd2`. During this audit, accepted `origin/main` advanced to `f3291826a1fb1a61107e5ce87591cd9e0b7524ef` through merged PR #59. Its six CRM booking files do not overlap the 23-file QR delta; the pre-reconciliation merge base is `aa30aa7`. Both original QR correction commits are preserved.
- **VERIFIED FACT:** The owner then authorized local-only reconciliation. Safety branch `safety/pr58-pre-main-integration-20261101` points to `addec7974a6066c584fbaa7f68e3cea38850020d`. Merge commit `239bce34b692c86475f5245b87a2b72ed8c9cbf6` has that SHA as first parent and accepted `f3291826a1fb1a61107e5ce87591cd9e0b7524ef` as second parent. There were no conflicts or history rewrites. The new merge base with `origin/main` is `f3291826a1fb1a61107e5ce87591cd9e0b7524ef`.
- **VERIFIED FACT:** GitHub reports draft, open PR #58 at remote head `a6967c7a14f5a38ea9d690eea3c4609da6aba946`. The local branch preserves `9ffabc6` and `f4d4491` beyond that head. No branch push, PR merge, preview update, or deployment was performed.
- **PROJECT DECISION:** `ATT-GOV-001/002` authorize only this QR correction and LOCAL/TEST execution of the proposed ledger migration. The latest owner instruction additionally authorizes this local-only reconciliation and verification; production SQL, Cron, live attendance, publication, and deployment remain unauthorized.
- **VERIFIED FACT:** At reviewed application HEAD `f4d4491`, the QR delta against its accepted-main merge base is 23 files: `AI_CONTEXT.md`, `docs/11-DECISION-LOG.md`, `docs/reports/ATTENDANCE-QR-FLOW-CORRECTION-2026-11-01.md`, `src/app/(dashboard)/staff/scan/actions.ts`, `src/app/(dashboard)/staff/scan/process/[publicCode]/page.tsx`, `src/app/scan/[publicCode]/page.tsx`, `src/components/features/attendance/public-scan-processor.tsx`, `src/components/features/attendance/public-scan-stage.tsx`, `src/components/features/scanner/staff-qr-scanner.tsx`, `src/lib/scanner/__tests__/classify-public-qr.test.ts`, `src/lib/scanner/__tests__/resolve-scan-target.test.ts`, `src/lib/scanner/__tests__/staff-scan-boundary.test.ts`, `src/lib/scanner/__tests__/staff-scan-grant.test.ts`, `src/lib/scanner/__tests__/staff-scan-retry.test.tsx`, `src/lib/scanner/classify-public-qr.ts`, `src/lib/scanner/resolve-scan-target.ts`, `src/lib/scanner/staff-scan-grant.ts`, `src/types/supabase.ts`, `supabase/migrations/20261101043000_staff_scan_grant_ledger.sql`, `tests/components/attendance/public-scan-processor.test.tsx`, `tests/components/attendance/staff-scan-location-readiness.test.tsx`, `tests/database/staff-scan-grants-concurrency.mjs`, and `tests/database/staff-scan-grants-integration.sql`. The two unpublished local corrections touch 18 of these files.
- **VERIFIED FACT:** The integrated branch diff against current `origin/main` is exactly those 23 QR/governance files plus this release-readiness report: 24 files. The merge itself added only six accepted-main CRM paths relative to its first parent: `src/components/features/bookings/quick-booking-form.tsx`, `src/lib/bookings/inhouse-booking-engine.ts`, `tests/components/crm/quick-booking-customer-autocomplete.test.tsx`, `tests/components/crm/quick-booking-multi-guest-save.test.tsx`, `tests/components/crm/quick-booking-unified-modes.test.tsx`, and `tests/lib/bookings/crm-multi-guest-save-lifecycle.test.ts`. None overlaps the 24-file PR delta.

### Local reconciliation verification at `239bce34`

- **Node 24.19.0:** The focused QR/attendance command below passed **19 files / 197 tests** with `--maxWorkers=2`. The four accepted-main CRM booking test files passed **4 files / 41 tests** with the same worker cap. Initial Node 25 runs also passed both suites; the supported-Node reruns are the acceptance evidence. A sandboxed Node 24 Vitest attempt could not load tests because Windows denied temporary cache renames; the authorized local rerun passed outside that sandbox.
- `pnpm type-check` passed under Node 24.19.0. Scoped ESLint passed with no findings on all **23 TS/TSX files** in the union of the 24-file PR delta and six merged CRM paths. `git diff --check origin/main...HEAD` passed. The prior full-repository ESLint baseline failure recorded below was not rerun for this integration.
- `pnpm exec next build --webpack` passed under Node 24.19.0 with isolated dummy `test.invalid` Supabase URL/keys and the local font-response fixture. Compilation, build TypeScript, **153/153** static pages, and trace collection completed. Unrelated marketing prerender fallbacks logged expected failed fetches to the dummy host. The first sandboxed build could not canonicalize the Windows worktree path; the authorized local rerun passed outside that sandbox. This is build evidence, not authenticated runtime or production verification.
- **Independent read-only integration review: CODE PASS.** No P0/P1 regression or data-contract conflict was found. The reviewer checked the two merge parents, non-overlapping file scopes, authoritative active `qr_points` classification, direct attendance confirmation, room/resource automatic handling, atomic grant claim, fresh GPS, and server-side geofence/device boundaries. No database target was contacted in this reconciliation.
- **Local rollback:** The safety branch retains the exact pre-merge tree at `addec797`. If the integration must be abandoned before publication, restart a local fix branch from that checkpoint and retain the merge commit as evidence; do not rewrite or force-push the remote PR. No production rollback action arises from this local-only merge. The later production rollback plan below still requires separate release authorization.

## Database target classification and execution boundary

- **VERIFIED FACT:** The connected Supabase project list includes `Creadlehub`, ref `lsrbwqhvzjfpiabeolkv`, in `ap-northeast-1`. The other connected account lists unrelated projects; neither account exposes an isolated CradleHub TEST/STAGING project. No authenticated TEST URL or therapist/driver test accounts were supplied.
- **REPOSITORY-RECORDED PRODUCTION EVIDENCE:** `docs/03-CURRENT-SYSTEM-TRUTH.md` and later production audit reports identify `lsrbwqhvzjfpiabeolkv` as **PRODUCTION**. No SQL was sent to that project.
- **VERIFIED FACT:** No Supabase database query, migration, attendance request, or production data access was made in this verification pass. The separate authenticated Supabase TEST integration gate is **NOT VERIFIED**. Production was not used as a substitute.
- **REPOSITORY-RECORDED LOCAL EVIDENCE:** The earlier native PostgreSQL 17.11 LOCAL TEST fixture applied the dedicated ledger migration to synthetic tables/users, checked role privileges, wrong-user/code/operation/expired claims, one winning concurrent claim, replay rejection, and one committed check-in plus one scan event. That fixture is not a complete authenticated Supabase scan, and it was not rerun in this pass because the requested authenticated TEST target is absent.

## Trust boundary and local verification

- **VERIFIED FACT:** `classifyPublicQr` reads only `point_type` and `is_active` from the authoritative `qr_points` row through the server-only client. Missing, inactive, invalid, or unavailable classification returns no type. Both direct and Staff processing routes are dynamically rendered and pass that server result to the processor. A code prefix or client-provided type is not an authorization input.
- **SOURCE AND LOCAL TEST EVIDENCE:** A direct attendance URL, including a legacy or misleading code, starts with an explicit **Record attendance** action. A verified room/resource QR continues automatically. Staff camera attendance requires the existing signed, user/code/operation-bound ledger grant and atomic claim before automatic GPS and scan processing. Unknown classification renders an inert state. Full printed same-origin `/scan/{code}` URLs accept opaque historical codes for server classification; foreign origins, unsupported paths, and redirect parameters remain rejected. Authenticated TEST and physical-device behavior remain unverified.
- **SOURCE AND LOCAL TEST EVIDENCE:** The ledger stores a token hash, not the browser secret. Its `SECURITY INVOKER` function uses an empty search path and qualified table, conditional `UPDATE ... RETURNING`, database-clock expiry, and client-role revocation; `service_role` is explicitly granted table access and RPC execute, while the table owner retains its inherent privileges. The browser cookie is path-scoped, HttpOnly, and expired before claim. The service-role key remains in a `server-only` module. PostgreSQL serializes competing row updates, so only one claim can return the operation ID.
- **LIMITATION:** A grant proves a server-issued one-use navigation intent, not a physical camera scan. Fresh GPS, device, assignment, geofence, and attendance idempotency remain independent server controls. Claim and attendance commit are separate transactions: a consumed grant cannot auto-retry after an interrupted downstream operation; the user must take the explicit manual path.

### Pre-integration quality gates at `f4d4491`

1. `pnpm exec vitest run src/lib/scanner/__tests__ tests/app/attendance/public-scan-route.test.ts tests/components/attendance/public-scan-processor.test.tsx tests/components/attendance/public-scan-result.test.tsx tests/components/attendance/staff-scan-location-readiness.test.tsx tests/components/attendance/public-scan-branch-correction.test.tsx tests/lib/attendance/qr-url.test.ts tests/lib/attendance/qr-code.test.ts tests/lib/attendance/qr-print-poster.test.tsx tests/lib/attendance/attendance-scan-identity-contract.test.ts tests/lib/attendance/public-scan-simplification-contract.test.ts tests/lib/pwa/staff-scanner-shell.test.tsx --maxWorkers=2`: **19 files / 197 tests passed**. An initial unrestricted parallel run timed out two otherwise passing tests (195/197); both passed in isolation (20/20), then the complete 197 passed with two workers. No assertion or authorization failure remained.
2. `pnpm type-check`: **passed**. The default sandbox denied pnpm access to the worktree's `node_modules`; the authorized local check succeeded with filesystem access.
3. `pnpm exec eslint @paths`, where `@paths` is the 17 changed TS/TSX files in the PR delta: **passed**, zero warnings/errors.
4. `pnpm exec eslint .`: **failed only on the unchanged baseline** `tests/components/cash-flow/cash-flow-today-operations.test.tsx:162` (`no-explicit-any`), plus 24 unrelated warnings. No changed QR file produced a lint error.
5. `git diff --check origin/main...HEAD`: **passed**.
6. Production-mode `pnpm exec next build --webpack` with Node 24, dummy `test.invalid` Supabase URL/keys, and an isolated local Next font-response fixture: **passed** compilation, TypeScript, static generation (153/153), and route tracing. The fixture avoids the repository's Google Fonts network-loader failure; it does not verify live font delivery or an authenticated runtime. Unrelated prerender paths logged expected fetch failures against the dummy host.

## TEST and installed-PWA acceptance — NOT VERIFIED

**Prerequisites:** Owner supplies a positively classified isolated Supabase TEST project, its migration-history/schema and Auth configuration, a TEST deployment of the exact reviewed commit, approved synthetic attendance/QR/device fixtures, and therapist/driver accounts. Record the TEST project ref and URL before any connection. Do not replay or mark the 84 historical local-only migrations.

1. In TEST, inspect existing `qr_points`, attendance and device tables, `auth.users`, roles, migration history, and the absence or exact shape of `staff_scan_grants`. Apply only the approved ledger migration if needed. Verify RLS, grants, RPC signature/search path and PostgREST availability before testing the app.
2. On Android and iPhone installed Staff PWA, sign in as therapist and driver. At Main Spa and SM Branch, confirm the camera opens before GPS readiness, each printed code decodes once, the grant is issued/claimed once, a new GPS fix is obtained after decode, server authorization runs, and the result matches the single committed attendance action.
3. Use the native camera on existing printed attendance QR codes. Confirm one **Record attendance** tap is required for standard and legacy/misleading codes. Refresh, history, bookmark and reopen must remain inert until a new explicit action. Verify room/resource service starts remain automatic when the database classifies them active.
4. Exercise permission granted/first-time/denied, Precise Location disabled, inaccurate or stale indoor GPS, outside geofence, network interruption, and retry after recovery. Verify retry uses a new fix and normal server authorization; failures must not display success.
5. Replay and race the same grant, switch users, claim with a different QR, wait past expiry, invalidate the device, and interrupt requests. Expect one claim winner, no unauthorized attendance mutation, and manual fallback where appropriate.
6. Record each operation ID and reconcile TEST `qr_scan_events.request_id` and attendance rows. Require exactly one expected successful scan event and attendance mutation per authorized operation, with no mutation on geofence/device rejection. Retain screenshots and device/browser versions for the owner.

## Scanner-grant retention proposal — separate approval item

**RECOMMENDATION:** Retain claimed and unclaimed grants until `expires_at + 24 hours`. The ledger is short-lived operational evidence; durable attendance audit remains in its existing tables. The current partial expiry index excludes claimed rows, so an all-row `expires_at` index is needed for cleanup and backlog measurement. Do not add it to the approved ledger migration without separate review.

**Draft only; do not execute or schedule:** In a separately approved migration/maintenance change, create `staff_scan_grants_expiry_all_idx` on `public.staff_scan_grants(expires_at)` (choose concurrent creation outside a transaction if table size warrants). Execute cleanup only as the confirmed table owner through controlled database maintenance. Preflight must verify ownership and that `FORCE ROW LEVEL SECURITY` is not enabled; otherwise stop and review a separate RLS/role design. An ordinary new role with SELECT/UPDATE/DELETE grants would still be blocked by the table's enabled RLS and absent policies. Do not give DELETE to the application service role or a browser client. In short transactions, delete at most 500 rows per batch and cap each run at 20 batches or one minute:

```sql
with due as (
  select token_hash
  from public.staff_scan_grants
  where expires_at < transaction_timestamp() - interval '24 hours'
  order by expires_at, token_hash
  limit 500
  for update skip locked
)
delete from public.staff_scan_grants as grants
using due
where grants.token_hash = due.token_hash
returning grants.token_hash;
```

The stable transaction timestamp gives the index a fixed cutoff and never selects an unexpired grant. Row locking skips competing maintenance work; valid grant claims are outside the deletion window. Monitor eligible backlog count and oldest age, claimed/unclaimed counts, table/index bytes, cleanup rows/time/errors, claim failures/replays, and manual fallback rate. Alert on a rising backlog or failed run. Stop cleanup before application rollback; retain the table until no deployed version issues or claims grants. Production cleanup, its index/migration, identity, and schedule require separate owner approval.

## Production release sequence — plan only

1. **Separate owner approval:** Authorize publication/preview, production metadata inspection, the exact migration, application rollout, controlled smoke tests, and any live attendance pilot independently. No authorization is inferred from local PASS.
2. **Classify and inspect PRODUCTION read-only:** Reconfirm project ref, backup/restore readiness, catalog shape, `qr_points`, `auth.users`, roles/RLS, function namespace, existing ledger objects, API exposure, and migration history. Do not assume `CREATE IF NOT EXISTS` proves compatibility. The migration depends on standard Supabase auth/roles and not on the four Closing jobs; the application additionally depends on the already established `qr_points` contract.
3. **Target only `20261101043000_staff_scan_grant_ledger.sql`:** Review the exact SQL and approved application method. Do not run broad `db push --include-all`, replay or mark the 84 historical local-only versions. Record only the new version after its effects are verified through the approved history procedure.
4. **Database before application:** Verify table constraints, RLS, client-role denial, service-role privileges, RPC `SECURITY INVOKER` and empty search path, conditional single-use claim, and API schema-cache visibility. The old app does not use the ledger. If the table or RPC is unavailable, the new app falls back to manual attendance, but rollout must stop rather than accept a silent Staff PWA usability regression.
5. **Deploy exact reviewed application SHA only after approval:** Verify hosting deployment SHA/build ID. `staff-sw.js` has no fetch cache; still reopen installed PWAs and refresh loaded sessions so old JavaScript does not mask the new behavior. Run non-mutating route/unknown-QR checks first, then only owner-authorized controlled attendance/device/geofence smoke tests. Reconcile request IDs and records.
6. **Monitor and hold:** Watch grant issuance/claim error and fallback rates, replay/expiry rejection, duplicate attendance and scan events, geofence/device denials, room/resource service starts, application 5xx, and client error reports. Stop promotion if any integrity or authorization regression appears.

**Rollback:** Halt new rollout and grant issuance by returning to the last accepted application release through its normal reviewed deployment process. Preserve existing attendance records and scan events. In-flight grants expire after two minutes and may remain unused; do not drop the ledger or reverse its migration while any application instance might claim one. Review ledger retention/removal separately after traffic and version checks. The accepted app baseline has its own QR behavior; rollback is an incident decision, not proof that the baseline has the new direct-link guard.

## Decision

**CORRECTION REQUIRED for release verification.** Local code/security and isolated build/test gates can pass, but authenticated Supabase TEST, native-camera and installed-PWA therapist/driver acceptance, the retention decision, production migration approval, and owner rollout approval are still outstanding. No production state or live attendance outcome is claimed.
