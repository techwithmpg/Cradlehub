# PWA-C6 — Scanner Correction Handoff

## Status and authority

**READY FOR EXPEDITED EXTERNAL RE-REVIEW — NOT ACCEPTED / NOT MERGED.**

Repository: `E:\cradlehub`. Branch: `stage/pwa-c6-scanner`.
Accepted C5/main baseline and merge-base: `a97e43eec9ce0c99ad5037212e75cd5226fe38fc`.
Starting reviewed C6 head: `bc20ee15cd987364b7acdeea0886d7c649ee1a5e`.
Corrected review head: the new commit containing this handoff (`git log -1 --format=%H -- docs/pwa/PWA-C6-HANDOFF.md`); the exact SHA is returned in the delivery report. A commit cannot embed its own hash. The starting reviewed commit is preserved, without amend or history rewrite.

Latest owner instruction authorizes C6 corrections, isolated tests, PWA-GOV-010 documentation and normal branch commit/push. C6 remains current until accepted/merged. **PWA-C7X — NOT YET AUTHORIZED FOR IMPLEMENTATION.** No merge or deployment is authorized.

## Starting gate — VERIFIED REPOSITORY FACT

Before editing, `git fetch origin --prune` succeeded; `git branch --show-current` returned `stage/pwa-c6-scanner`; `git status --short --branch` showed a clean tree. `git rev-parse HEAD` returned the reviewed head above. `git rev-parse origin/main` and `git merge-base origin/main HEAD` both returned the accepted baseline above. All required starting values matched.

## Corrected contracts — VERIFIED REPOSITORY FACT

1. **Server ownership:** `resolve-scan-target.ts` is guarded by `import "server-only"`; the new `staff/scan/actions.ts` exports an async `"use server"` action that calls the existing pure resolver. The camera hook emits raw decoded text after locking. The component awaits the server action. Only `public_scan`, `activation` or `invalid` transport results cross this seam. No DB lookup, authorization grant, mutation or client business-intent selection is introduced. Existing malformed/foreign-origin/unsafe-scheme guards remain intact.
2. **Staff scope:** `/staff/scan/process/[publicCode]` renders the existing `PublicScanProcessor`; `/staff/scan/activate/[token]` calls the existing `getRecoveryTokenPreview` and renders `DeviceRecoveryScreen`. Neither adapter redirects to root `/scan`. Historical page files remain unchanged. Route params are passed through without double URL decoding. A narrow optional `scanBasePath` on the shared processor keeps account-switch/disconnect retries under Staff; its historical default remains `/scan`.
3. **No premature operation success:** scanning → code_detected → processing → Staff-scoped downstream processor. Normalization never sets confirmed or displays a green success check. Invalid normalization yields `invalid`; a rejected server-action promise yields `network_unknown`. Existing downstream systems own authoritative success/rejection/duplicate outcomes. Late responses after unmount are ignored.
4. **Camera lifecycle:** hide cancels animation, stops every track, clears stream/video references and invalidates pending permission/play/native-decoder promises. A previously active capture becomes `paused`; becoming visible does not reacquire. Explicit Scan again starts a new capture. Decode lock, unmount and explicit stop release tracks; stale callbacks cannot submit. Rear-camera preference, no audio, optional BarcodeDetector and jsQR fallback are retained.

The scope audit also found the existing global `Permissions-Policy: camera=()` would block capture. The narrow `next.config.ts` exception permits same-origin camera only for `/staff/:path*`; microphone denial remains. Staff documents need this policy because client navigation into Scan keeps the original document policy. Other workspaces and historical `/scan` retain their previous policy. This is a necessary scanner-enablement correction, not a browser/device verification claim.

The capture hook was reorganized around one per-capture generation guard to make asynchronous teardown consistent across both decoders. Scanner visual styling is preserved apart from removing premature success and adding the explicit paused/retry state.

## Subsystem preservation

Historical `/scan/[publicCode]` and `/scan/activate/[token]` pages, scan actions, Attendance API, recovery helper, trust/authorization/mutation logic, manifest identity and service workers are unchanged. The shared processor still calls its existing `/api/attendance/public-scan` transport; the camera hook and scanner component do not. No subsystem business logic is copied. No database/schema/migration/Auth/RLS/Storage changes occur.

## PWA-GOV-010

[Decision log](../11-DECISION-LOG.md#staff-pwa-decisions) and [project roadmap](PROJECT.md#prospective-compressed-roadmap--pwa-gov-010) record owner-approved prospective compression after C6 acceptance. Original C7–C19 rows remain as historical evidence.

- C7X: Attendance → Provider/Salon → CRM General + Utility, sequential, one branch/review; earlier failure blocks later risky dependencies.
- C8X: Driver Core/Trips → Map/snapshots → physical-device reliability → Controlled Remote End Shift. Final slice blocked until reliability AND server-side eligibility contract are established. One branch/review; no speculative tracking, fabricated routes/ETAs or hidden 24/7 location; trip-scoped consent only.
- C9X: proven Notifications, measured Performance with before/after evidence, explicit blocking Security review (authorization/RLS/server privilege boundaries), UX/Accessibility/mobile corrections. One branch/review; no redesign or speculative features.
- C10X: role training, error/recovery, required Android/iPhone evidence, install/PWA, limitations, release evidence and rollback. Completion does not authorize deployment.
- FINAL: separate Release Certification requiring explicit owner approval; no automatic deployment.

AI_CONTEXT, development stages and project status now point to C6. Accepted product contracts remain binding. No C7X implementation has started.

## Verification — LOCAL TEST EVIDENCE

Exact captured command output is retained in [verification-output.json](evidence/PWA-C6-CORRECTION/verification-output.json). The JSON strings preserve the exact captured output and original line endings; the table names identify each capture. These are local compiler, source-contract and mocked behavioral tests, not browser or live service evidence. Vitest and build processes use `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9` plus nonfunctional placeholder anon/service-role keys. No environment files were changed. The build may report loading `.env.local`; process-local overrides take precedence for all three Supabase client configuration fields. Database target for this verification: LOCAL nonfunctional endpoint, not a running database; configured remote target remains UNKNOWN.

| Exact command | Result | Captured output |
| --- | --- | --- |
| `npm run type-check` | PASS, exit 0 | `type-check.txt` |
| `npx vitest run tests/lib/pwa/` | PASS, 1 file / 26 tests, exit 0 | `pwa-tests.txt` |
| `npx vitest run tests/lib/auth/` | PASS, 6 files / 50 tests, exit 0 | `auth-tests.txt` |
| `npx vitest run tests/lib/marketing/` | PASS, 13 files / 150 tests, exit 0 | `marketing-tests.txt` |
| `npx vitest run src/lib/scanner/__tests__/` | PASS, 6 files / 54 tests, exit 0 | `scanner-tests.txt` |
| `npx vitest run tests/components/attendance/public-scan-processor.test.tsx tests/components/attendance/public-scan-branch-correction.test.tsx tests/app/attendance/public-scan-route.test.ts tests/lib/attendance/device-recovery.test.ts` | PASS, 4 files / 20 tests, exit 0 | `downstream-tests.txt` |
| `npm run build` | PASS, exit 0; compiled and generated 147 static pages — LOCAL TEST EVIDENCE only | `build.txt` |
| `git diff --check` | PASS, exit 0; line-ending conversion warnings only | `diff-check.txt` |

Focused scanner coverage includes real action-to-resolver invocation, server-only/client import boundaries, both reused adapters, Staff/historical retry destinations, no early success, action failure/invalid input, unsafe URI guards, all-track hide/unmount teardown, late permission/play/native results, explicit retry, both decoder locks, and path-matched Staff-only camera policy.

Initial execution evidence is retained: sandbox Vitest startup failed with `spawn EPERM`, then ran with approved local subprocess execution. The first scanner run had 39 passes / 1 permission-denial classification failure; handling a DOMException by its name fixed this, and subsequent runs passed. Additional tests were added for camera-header scope and reused processor retries; intermediate successful outputs remain in the scanner log. Do not confuse an earlier run's count with final coverage.

## Environment evidence and limitations

- **LOCAL BROWSER EVIDENCE — NOT VERIFIED.** No real browser/camera or authenticated Staff route was exercised; jsdom tests are local test evidence only.
- **ANDROID DEVICE — NOT VERIFIED.**
- **IPHONE DEVICE — NOT VERIFIED.**
- **PHYSICAL DEVICE EVIDENCE — UNKNOWN / NOT VERIFIED.** Camera permission, actual decode quality, OS background behavior, installed PWA scope and real device usability still require authorized environment/device checks.
- Configured remote Supabase environment: **UNKNOWN / NOT VERIFIED**. No authenticated/mutating runtime verification against it was performed. Mocked preview/processor tests do not establish database or device-trust behavior.
- Local compilation and source/mocked assertions do not prove actual Next server-action transport, browser header application or live Attendance/recovery success. No production behavior is inferred.

**NO PRODUCTION DEPLOYMENT / ACCESS / MUTATION PERFORMED.**
**PRODUCTION BEHAVIOR AND IMPACT: UNKNOWN / NOT VERIFIED.**

## Rollback and next permitted action

Correction is one new branch commit. If rollback is requested, revert that correction commit with a new commit; do not reset, amend or force-push the reviewed history. No database rollback is involved. Reversion would restore the reviewed defects, so it is not a functional remediation recommendation.

Next permitted action: expedited external re-review of the pushed correction and its evidence. Acceptance/merge and any later implementation require the applicable owner gate. **C7X not started; NOT YET AUTHORIZED FOR IMPLEMENTATION.**
