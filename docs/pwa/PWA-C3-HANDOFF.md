# PWA-C3 Final Scope Freeze — Handoff

## Status

- Workstream: CradleHub Staff PWA
- Stage: **PWA-C3 — Final Scope Freeze**
- Status: **DOCUMENTATION-ONLY SCOPE FREEZE — OWNER REVIEW REQUIRED**
- Branch: `stage/pwa-c3-final-scope-freeze`
- Accepted C2/main baseline: `2b927303d2d6bc10b09a15f2542fdcfa6c066194`
- Next stage: **PWA-C4 — NOT AUTHORIZED**

## A — Stage and authorization

PWA-C3 is limited to product scope, source-of-truth boundaries, authorization rules, conceptual navigation, and later verification gates. No runtime implementation, UI redesign, database/schema change, migration, Auth/RLS/Storage change, deployment, production mutation, merge, or PWA-C4+ work is included.

## B — Accepted evidence

The freeze uses the accepted PWA-C1 truth map, PWA-C1 handoff, PWA-C2 diagnostic report, PWA-C2 handoff, `docs/pwa/PROJECT.md`, and active governance documents. Historical material remains evidence only.

## C — Frozen V1 result

V1 is one online-first CradleHub Staff PWA using the existing backend. It includes role-aware Therapist/service-provider, CRM/general, Utility, and Driver workspaces; one server-resolved Scan action; server-authoritative Attendance; service progress reuse; controlled Remote End Shift; explicit trip-scoped Driver location/map work; existing push reuse; and minimum customer-data boundaries. It excludes a second authority database, broad offline mutation, hidden tracking, native architecture selection, full admin recreation, service-end QR, and an invented Utility backend.

## D — Required artifacts

- [PWA-C3 Final Scope Freeze](PWA-C3-FINAL-SCOPE-FREEZE.md)
- [PWA-C1 Truth Map](PWA-C1-TRUTH-MAP.md)
- [PWA-C2 Structured Diagnostics](PWA-C2-STRUCTURED-DIAGNOSTICS.md)

The final scope document contains the required master matrix, all twelve C2 dispositions, business-date freeze, authorization/capability matrix, conceptual navigation freeze, scanner contract, attendance and Remote End Shift boundaries, driver/device gates, online-first rules, privacy/security limits, explicit exclusions, and C4 inputs.

## E — C2 dispositions

PWA-C2-001 is frozen for V1; 002, 003, 004, 007 and 008 require a C4 design contract; 005 and 010 are frozen V1 behavior; 006 and 009 are security/reliability gates; 011 is a device-test gate; and 012 is blocked/out of scope. No finding was fixed during C3.

## F — Source-of-truth and authorization

Existing attendance, booking/service-progress, trip, location-snapshot, notification, Auth, server action/RPC and deployed RLS boundaries remain authoritative. UI mode, workspace visibility, QR content, device registration, direct URL navigation and local state cannot grant capability.

## G — Navigation and workspace decisions

The conceptual destinations are frozen as service provider `Today · Schedule · Scan · Progress · More`, CRM/general `Today · Work · Scan · Messages/Notices · More`, Utility `Today · Work · Scan · Messages/Notices · More`, and Driver `Today · Trips · Scan · Map · More`. Dedicated `/driver` owns Driver V1. Staff Portal access must not be broadened to preserve conflicting Driver links. Utility remains a role-aware shell with only proven existing capabilities; no task backend is invented.

## H — Scanner and attendance decisions

The scanner contract is camera decode → public identifier → existing server scan contract → server intent/auth/state validation → authoritative mutation → confirmed result. Attendance remains separate from service progress and server-time/device-trust backed. Remote End Shift is a separately audited, server-authorized exception with eligibility rules frozen for later C14 implementation; no schema details are invented.

## I — Driver decision

Driver is first-class and map-centered. V1 reuses assigned-trip actions and location snapshots, with later explicit trip-scoped lifecycle and freshness. Continuous/background delivery is **UNPROVEN — REAL DEVICE TEST REQUIRED**. If pure PWA reliability is insufficient, **ARCHITECTURE DECISION REQUIRED LATER**; C3 selects no native architecture.

## J — Connectivity and data decision

Operational mutations remain online-first. Failed mutations must state that they were not recorded. Minimum customer fields are frozen per role/surface; broad offline caches, hidden tracking and unbounded customer/location retention are out of scope pending security review.

## K — Verification limits

The repository evidence does not verify production, database state, deployed RLS/RPC behavior, browser install, Android/iPhone behavior, camera operation, Google Maps provider behavior, push delivery, background location, or live driver synchronization. These remain later release/security/device gates and must not be described as working.

## L — Starting-state verification

The requested branch, `HEAD`, and `origin/main` matched the accepted baseline `2b927303d2d6bc10b09a15f2542fdcfa6c066194`, and the working tree was clean before edits. `git fetch origin --prune` was attempted but could not write `.git/FETCH_HEAD` in the sandbox; no ref differed.

## M — Changed scope

Expected changes are documentation and active governance pointers only: the PWA-C3 scope freeze, C3 handoff, PWA project authorization/status, decision log, known-issues register, project status, and AI context manifest. Runtime source, tests, dependencies, assets, SQL, migrations, environment settings, Auth/RLS/Storage policy, deployment configuration and production data remain unchanged.

## N — Review request

Review the frozen V1 boundary, the matrix statuses, server authority, Driver/Utility ownership, scanner and Attendance contracts, online-first semantics, and later gates. Review does not authorize implementation by itself.

## O — Owner gate

PWA-C3 becomes closed only after owner review and accepted merge. PWA-C4 remains **NOT AUTHORIZED** until separately and explicitly approved.

## P — Stop gate

Stop after the documentation-only C3 artifacts are committed, pushed and presented for review. Do not implement, redesign, migrate, mutate data, access an unknown database, merge, deploy, or start PWA-C4.
