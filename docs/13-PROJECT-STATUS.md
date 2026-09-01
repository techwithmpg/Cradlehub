# Project Status

## Current program

- **Program:** Controlled Stabilization
- **Current stage:** C2 — Structured Diagnostics (Digital Marketing Workspace)
- **C2 status:** REPORT CORRECTED / AWAITING INDEPENDENT REVIEW
- **C2 report:** `docs/audits/C2_MARKETING_STRUCTURED_DIAGNOSTICS_REPORT.md`
- **C1 status:** CLOSED / ACCEPTED
- **Accepted C1 truth consolidation merge:** `3f402e033e1d1ca05b8cc8a4f2764823f7aaa622`
- **C1 accepted-main baseline:** `4f9291c7d457ec49b071e766df4c23ca1e4f1558`
- **C0B status:** CLOSED / ACCEPTED
- **Accepted C0B governance merge:** `03dbd57ed4be6f9b1f0bd30c7fd22a225e68ec2a`
- **External review:** PASS
- **Merge verification:** PASS
- **Next stage:** C3 — NOT AUTHORIZED (Awaiting owner review of C2 report and C3 scope freeze)

## Current safety state

- `main` is production-connected.
- No product implementation, database/schema mutation, migration action, or production mutation was performed in C2 diagnostics.
- Historical migration reconciliation is constrained: 84 local-only versions remain intentionally unmarked.
- Attendance operational enforcement remains not training-ready until its repository-recorded gates pass.

## C2 Marketing Diagnostics summary

- Full mapping of consumers, sources of truth, ownership boundaries, media/Storage, branding, branches, services, draft preview, and publishing workflows completed.
- P1 discovery: Public Mobile Home (`PublicMobileHome` / `MobileHomeHeroCarousel`) uses hardcoded copy and ignores `public_site_sections` (only desktop consumes published sections).
- P1 discovery: Owner marketing studio allows direct live mutation of `public_site_sections` without recording a revision in `marketing_content_revisions`.
- P1 discovery: `BrandLogo` component is statically bound to SVG assets and does not consume `marketing_brand_settings`.
- Strict authorization boundary confirmed: `digital_marketer` has draft/media rights only; operational prices, durations, schedules, attendance, staff, and RBAC are completely protected.

## C1 verification summary

- Exact Node 24.14.0 / pnpm 10.33.2 frozen-lockfile reproduction: PASS.
- TypeScript: PASS.
- ESLint: PASS.
- Vitest: PASS — 200 files / 1,372 tests.
- Next.js production build: PASS.
- Formatting gate: FAIL — 93 existing incremental files.
- Live CradleHub database verification: NOT AVAILABLE; no substitute project used.
- Production web read-only check: HTTP 200, served by Vercel/Next.js; deployed project/commit remains unverified.
- Product/database/production mutation in C1/C2: NONE.

## Verified repository summary

CradleHub is a Next.js 16.2.4 / React 19.2.4 web application using Supabase PostgreSQL, Auth, RLS, RPCs, Realtime, and Storage where applicable. It has no separate Tauri/Rust/SQLite desktop application in this repository.

## Open facts and candidates carried forward

- historical migration-history limitation and unavailable live database verification;
- Attendance operational gates;
- formatting baseline failure;
- privileged service-role/super-admin boundaries requiring review;
- GitHub protection/ruleset and Vercel linkage/deployed-commit unknowns; and
- production-connected `main` release safety.

C1 is CLOSED and ACCEPTED at merge SHA `3f402e033e1d1ca05b8cc8a4f2764823f7aaa622`. C2 Structured Diagnostics for the Digital Marketing Workspace report has been corrected and is awaiting independent review. Product fixes, UI implementation, database/Storage mutation, migration actions, and C3 or later work are NOT AUTHORIZED without explicit owner instruction.
