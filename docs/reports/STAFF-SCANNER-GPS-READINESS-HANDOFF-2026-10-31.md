# Staff scanner GPS readiness — release handoff

## Authority and branch

Owner-requested PR #55 correction on `fix/staff-scan-location-readiness-20261031`.
Verified accepted `origin/main` and merge base:
`ccf53b7654b3e5899a18f391a528c6dbbe3effcd`.
Original candidate: `7a1ade83fa8be85fbe94d67c4d7915c5d1b243b2`.
Reviewed implementation commit: `ca511b115605cc7d9cdd759cb23d96e220c6fcc3`.
The final evidence-only report commit and pushed PR head are recorded in PR #55.

## Scope and decision

The original five PR files prepare foreground GPS, gate camera startup, and
guide staff through permission, unavailable GPS, and inaccurate GPS states.
This correction adds valid coordinate checks, an explicit permission explanation,
bounded 20-second readiness and camera startup waits, a recoverable paused state
when camera startup is interrupted by backgrounding or renewed GPS preparation,
and focused regressions. The only additional implementation file is
`src/components/features/scanner/use-staff-scanner.ts`; the additional test file
is `tests/components/attendance/public-scan-processor.test.tsx`.

Readiness never authorizes Attendance. After QR decode, the processor obtains a
new high-accuracy location and sends it through the existing authenticated,
device-authorized server flow. The server geofence, branch radii (SM 150 m,
Main Spa 100 m), maximum uncertainty (75 m), freshness check, QR validation,
canonical transaction, scan intent, and idempotency code were not changed.
No database migration or new permission is required. GPS coordinates are not
stored by readiness and there is no background location tracking.

## Evidence

- Focused scanner/geofence/Staff PWA suites: 11 files, 89 tests passed.
- Scan intent, identity, and transactional RPC regression suites: 3 files,
  29 tests passed.
- TypeScript, scoped ESLint, and `git diff --check`: passed.
- Production-equivalent Next.js webpack build using isolated local placeholder
  Supabase configuration: exited 0. Static generation logged failed fetches to
  the unreachable placeholder URL; this is not production verification.
- Full repository lint: one unrelated accepted `no-explicit-any` error at
  `tests/components/cash-flow/cash-flow-today-operations.test.tsx:162` and
  26 warnings. Changed-file lint passed.
- Independent read-only scanner review: **PASS**, no remaining actionable P0/P1.

Automated browser tests use mocks and jsdom. Installed Android Chrome/Staff PWA,
physical SM Branch GPS, and live Attendance behavior are **NOT VERIFIED**.
The reported 27.6 m difference between the saved SM center and the Maps pin
was not changed or independently remeasured in this correction.

## SM Branch device acceptance procedure

Use an authorized test or supervised staff phone and the approved release window.
For each state below, record device/browser/PWA version, permission state,
reported GPS accuracy, UI result, scan receipt, and Attendance before/after.

1. With location already granted, open `/staff/scan`. GPS should prepare and
   the camera should open without a button; scan a valid QR and verify a fresh
   location is requested for the actual scan.
2. With location never granted, verify **Enable Location** appears. Tap it,
   grant precise location, and verify scanning continues without restarting.
3. With location denied, verify settings guidance and **Try Again**. Grant
   permission in app/browser settings, return, retry, and verify recovery.
4. With accuracy above 75 m inside the mall, verify **Improve location accuracy**
   shows the measured accuracy and blocks the camera. Improve reception and use
   **Try Location Again**; verify the camera starts on a valid fix.
5. Background while the camera is open. Verify the camera releases its stream
   and foreground return requires a deliberate **Scan again**.
6. For an authorized employee physically inside SM Branch, verify one valid
   clock-in and one valid clock-out. Outside the 150 m boundary, verify a useful
   rejection and no Attendance change. Check each failed scan against the
   authoritative record; repeat only under the existing scan-intent procedure.
7. Confirm authorized CRM Attendance Recovery remains available for genuine
   on-site failures. Diagnose any residual mall GPS rejection from measured
   coordinates and accuracy in a separate review; do not change the center or
   enlarge the radius as part of this UI correction.

## Release and rollback

**Code review: PASS. Release decision: CORRECTION REQUIRED** until real installed
PWA and SM Branch acceptance, then owner approval. Do not merge, deploy, alter
production SQL, or operate Cron from this PR. Revert the implementation commit
and the original PR candidate commit on the fix branch if the scanner correction
must be withdrawn. No Attendance data rollback or migration rollback is needed.

## P1 `location_outside` retry follow-up

The review of PR #55 at `dcd45178d8fa754cbc9a1ceaecd19f6ef8e69181`
found that the definite server `location_outside` rejection displayed
**On-site scan required** without the existing **Try location again** control.
The processor now includes that reason in its location-retry eligibility, and
the result explains how an on-site employee can improve GPS reception or ask
CRM for Attendance Recovery. The button uses the existing full-page retry to
the same QR route. That route obtains a new high-accuracy GPS reading and sends
a new request ID through normal server authorization. The rejected attempt
does not mutate Attendance; geofence validation remains before attendance
processing. No server, database, branch-coordinate, or radius file changed.

The new processor regression shows the outside rejection and guidance, then
models the browser navigation with a remount because jsdom cannot navigate to
another document. It verifies a second fresh GPS fix, a different request ID,
one request per attempt, and a successful authorized result. Follow-up gates:
6 relevant suites / 58 tests, TypeScript, scoped ESLint, and `git diff --check`
passed. Independent read-only review returned **PASS**, no actionable P0/P1.
The full-page click and installed PWA still need the controlled SM Branch
device acceptance above. Owner approval remains required before merge/deploy.
