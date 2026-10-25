# Operations Center — Foundation handoff (2026-10-25)

**Workstream:** CradleHub operations / CRM  
**Status:** IMPLEMENTED ON REVIEW BRANCH — NOT VERIFIED FOR RELEASE  
**Branch:** `stage/operations-center-foundation-20261025`  
**Baseline:** accepted `main` at `2b3bab3c9e71274c25d747daf37d7928ee670e2c`

## Owner direction

- **ACCEPTED:** Build an Operations Center to make operational incidents diagnosable, show the responsible correction workflow, and route to the existing authorized module. It replaces operational standalone Settings *navigation*, not the persisted configuration editors or their direct routes.
- **ACCEPTED:** Prioritize Operations Center implementation before module-level Settings consolidation. Settings work is deferred to the last UI development pass.
- No owner authorization to change database schema, active staff identities, account history, attendance events, device credentials, production data, deployment, or `main`.

## Implemented foundation

1. CRM route `/crm/operations-center`, authorized using `getFrontDeskContext()` and its server-resolved branch; the client cannot supply a branch.
2. Read-only load of existing Attendance Workspace and CRM Setup Health; separate failures are marked `Unavailable` and must not appear as `0 issues`.
3. Unified branch-scoped issue inbox using existing `buildAttendanceReviewItems` and `getCrmSetupHealth` outputs. Provides severity, guidance, diagnostic code where available, and links to existing attendance/phone/service/schedule/resource correction workflows.
4. Search inside loaded issues and recent unsuccessful scan events (case-insensitive names, codes, available scan-ID suffix). This is **not a database-wide receipt lookup**: the existing Attendance snapshot fetches only the most recent 100 scan events starting at the business-day boundary.
5. Entry shortcuts for Attendance, Staff/identity review, and setup health, with no unsafe reset/merge/delete controls.
6. Operations Center in CRM and Owner navigation; Manager Settings *navigation item* replaced while `/manager/settings` remains intact for existing deep links.
7. Focused Vitest tests added for fallbacks, link mapping, device limits and scan search.

## Known limitations and follow-ups

- **Not a live-verified fix** to user-reported incidents. No authenticated TEST/STAGING check was possible in this tool environment.
- Existing setup-health detection is aggregate and heuristic. The configuration link opens a module, not always the exact failing service or staff record. Record-specific deep links and verifiable post-correction checks are a future contract.
- Duplicate-account identification and merge are deliberately not auto-performed; a separate identity provenance, retention, authorization and historical-reference contract is mandatory.
- Device-limit receipt search may miss older incidents; historical receipt search should be an authorized new read API with indexed identity/operation references.
- Attendance snapshot uses existing potentially expensive cross-module queries. Assess load/performance before enabling frequent polling or desktop prefetch.
- Operation Center does **not** alter the accepted digital Marketing workspace scope, sidebar, or Settings design.
- Release remains blocked on independent source review, full lint/type-check/test/build, authorized authenticated browser/device verification, and owner merge/deployment approval.

## Verification checklist

- [ ] `pnpm type-check`
- [ ] `pnpm lint`
- [ ] `pnpm exec vitest run tests/lib/operations-center/issue-model.test.ts`
- [ ] `pnpm build`
- [ ] Authenticated CRM/front desk and Owner branch scope testing
- [ ] Failure injection for each feed, verifying `Unavailable` rather than false zero
- [ ] Browser responsive/a11y and refresh/search/back navigation checks
- [ ] Confirm approved Attendance device recovery screens open for the correct staff
- [ ] Confirm no issues / scan data from another branch leaks
- [ ] Owner acceptance before merge/deploy

**Tools limit:** Connector can write branch files but cannot run a repository-local Node/Next toolchain in this environment. Tests were authored, not executed. Do not represent this as a passing verification.
