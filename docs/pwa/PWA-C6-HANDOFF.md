# PWA-C6 — Scanner Final Correction Handoff

## Status and authority

**READY FOR EXPEDITED EXTERNAL RE-REVIEW — NOT ACCEPTED / NOT MERGED.**

Repository: `E:\cradlehub`. Branch: `stage/pwa-c6-scanner`.
Accepted C5/main baseline and merge-base: `a97e43eec9ce0c99ad5037212e75cd5226fe38fc`.
Starting reviewed C6 head: `5d99f1d5b7507850590dbd597dab27eebe8069ef`.
Corrected review head: the new commit containing this handoff (`git log -1 --format=%H -- docs/pwa/PWA-C6-HANDOFF.md`); the exact SHA is returned in the delivery report. A commit cannot embed its own hash. The starting reviewed commit is preserved, without amend or history rewrite.

Latest owner instruction authorizes final C6 mobile UX / camera-scope correction, isolated tests, and normal branch commit/push. C6 remains current until accepted/merged. **PWA-C7X — NOT YET AUTHORIZED FOR IMPLEMENTATION.** No merge or deployment is authorized.

## Starting gate — VERIFIED REPOSITORY FACT

Before editing, `git fetch origin --prune` succeeded; `git branch --show-current` returned `stage/pwa-c6-scanner`; `git status --short --branch` showed a clean tree. `git rev-parse HEAD` returned `5d99f1d5b7507850590dbd597dab27eebe8069ef`. `git rev-parse origin/main` returned `a97e43eec9ce0c99ad5037212e75cd5226fe38fc`. All required starting values matched.

## Final mobile UX & camera-scope corrections — VERIFIED REPOSITORY FACT

1. **Immediate camera opening on initial mount:** Entering `/staff/scan` immediately triggers `startScan()` automatically via `useStaffScanner({ onDecode: handleDecode, autoStart: true })`. There is no normal second "Start Scanning" tap. The scanner UI displays truthful state during acquisition ("Starting camera…", "Requesting camera access…") and active scanning ("Scanning in progress", "Hold steady over the QR code…").
2. **Deterministic recovery controls:** If camera access is denied or camera is unavailable, recovery controls are shown ("Try again" / "Scan again" + "Return to Workspace"). Permission denial does not auto-loop. When the tab or app is hidden, all media tracks are immediately stopped and capture transitions to `paused`; returning to visibility does not auto-resume, requiring an explicit "Scan again" tap. After invalid scan, an explicit "Scan again" button is presented.
3. **Force same-origin document navigation:** To ensure the destination document loads with its scanner-specific `Permissions-Policy`, central Staff SCAN navigation in `StaffBottomNav` now renders as a standard HTML anchor tag (`<a href={item.href}>`) rather than Next.js client navigation (`<Link>`). Standard non-scanner destinations (Today, Schedule, Work, Trips, Progress, Notices, Map, More) preserve normal Next.js client navigation.
4. **Narrow camera permission policy:** `next.config.ts` was corrected to narrow camera permission from `/staff/:path*` to `/staff/scan/:path*` (`camera=(self), microphone=(), geolocation=(self)`). The global rule continues to deny camera (`camera=()`) and microphone (`microphone=()`) for all non-scanner pages, including `/staff`, `/staff/schedule`, `/staff/progress`, `/staff/more`, `/staff/driver`, `/staff/utility`, `/crm`, `/owner`, `/staff-portal`, and historical `/scan/*`.
5. **Truthful scanner privacy copy:** Replaced overbroad claim "No data stored on device" with precise scanner-specific wording: "Camera active only while scanning · Camera images are not saved".
6. **Subsystem preservation:** Server-only QR target resolver, server action normalization, Staff-scoped processor adapters, no client mutation/business intent, track cleanup on pause/unmount, BarcodeDetector with jsQR fallback, and lack of DB lookup are strictly preserved.

## Subsystem preservation

Historical `/scan/[publicCode]` and `/scan/activate/[token]` pages, scan actions, Attendance API, recovery helper, trust/authorization/mutation logic, manifest identity and service workers are unchanged. No database/schema/migration/Auth/RLS/Storage changes occur.

## PWA-GOV-010

[Decision log](../11-DECISION-LOG.md#staff-pwa-decisions) and [project roadmap](PROJECT.md#prospective-compressed-roadmap--pwa-gov-010) record owner-approved prospective compression after C6 acceptance. Original C7–C19 rows remain as historical evidence.

AI_CONTEXT, development stages and project status now point to C6. Accepted product contracts remain binding. No C7X implementation has started.

## Verification — LOCAL TEST EVIDENCE

| Exact command | Result | Scope / Coverage |
| --- | --- | --- |
| `npm run type-check` | PASS, exit 0 | TypeScript strict check across repository |
| `npx vitest run tests/lib/pwa/` | PASS, 1 file / 27 tests, exit 0 | Staff PWA foundation, navigation profiles, role resolution, and document navigation anchor contract |
| `npx vitest run tests/lib/auth/` | PASS, 6 files / 50 tests, exit 0 | Auth redirects, front desk unification, desktop bearer auth, and workspace access |
| `npx vitest run src/lib/scanner/__tests__/` | PASS, 6 files / 68 tests, exit 0 | Resolver, boundary, recovery retries, camera lifecycle, narrow camera policy (18 path assertions), autoStart, no second start tap, recovery controls, and truthful privacy copy |
| `npm run build` | PASS, exit 0 | 147 static/dynamic pages compiled and generated successfully |
| `git diff --check` | PASS, exit 0 | Clean diff, no whitespace errors or merge markers |

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

Correction is one new branch commit. If rollback is requested, revert that correction commit with a new commit; do not reset, amend or force-push the reviewed history. No database rollback is involved.

Next permitted action: expedited external re-review of the pushed correction and its evidence. Acceptance/merge and any later implementation require the applicable owner gate. **C7X not started; NOT YET AUTHORIZED FOR IMPLEMENTATION.**
