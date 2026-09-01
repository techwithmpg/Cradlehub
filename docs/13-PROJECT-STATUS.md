# Project Status

## Current program

- **Program:** Controlled Stabilization
- **Current stage:** C5 — Implementation (Digital Marketing Workspace)
- **C5 status:** PASS 2 ACTIVE (Central Media Library & Universal Media Picker)
- **C5 Pass 3+:** NOT AUTHORIZED
- **C5 Pass 1 status:** CLOSED / ACCEPTED
- **Accepted C5 Pass 1 parity merge:** `1f5d71ce3472684c9a94ad83d6c2e36a9d1b1971`
- **Independent review:** PASS
- **C4 status:** CLOSED / ACCEPTED
- **Accepted C4 UI/UX plan merge:** `b90b2d70d05b8d6082f707babed8995799c2ab2d`
- **C4 report:** `docs/audits/C4_MARKETING_UIUX_WORKFLOW_PLAN.md`
- **C3 status:** CLOSED / ACCEPTED
- **Accepted C3 scope freeze merge:** `d19ce34753e09244b8aad0e1d10c964302a33e7c`
- **C3 report:** `docs/audits/C3_MARKETING_SCOPE_FREEZE.md`
- **C2 status:** CLOSED / ACCEPTED
- **Accepted C2 diagnostics merge:** `694873dfe9b9572a56620951bb69024492fe04c0`
- **C2 report:** `docs/audits/C2_MARKETING_STRUCTURED_DIAGNOSTICS_REPORT.md`
- **C1 status:** CLOSED / ACCEPTED
- **Accepted C1 truth consolidation merge:** `3f402e033e1d1ca05b8cc8a4f2764823f7aaa622`
- **C1 accepted-main baseline:** `4f9291c7d457ec49b071e766df4c23ca1e4f1558`
- **C0B status:** CLOSED / ACCEPTED
- **Accepted C0B governance merge:** `03dbd57ed4be6f9b1f0bd30c7fd22a225e68ec2a`
- **External review:** PASS
- **Merge verification:** PASS
- **Next stage:** C5 Pass 3+ NOT AUTHORIZED

## Current safety state

- `main` is production-connected.
- No product implementation, database/schema mutation, migration action, or production mutation was performed in C2 diagnostics, C3 scope freeze, or C4 planning.
- Historical migration reconciliation is constrained: 84 local-only versions remain intentionally unmarked.
- Attendance operational enforcement remains not training-ready until its recorded gates pass.

## C3 Marketing Scope Freeze summary

- Five core modules frozen: (1) Website, (2) Brand, (3) Branches, (4) Services, (5) Media Library.
- Secondary navigation frozen: Drafts and Settings.
- Contextual SEO frozen across page and service levels.
- Shared subsystem contracts frozen: Universal Media Picker, High-Fidelity Draft Preview, Viewport Toggles (Desktop/Tablet/Mobile), Live vs Draft Diff, Unsaved Changes Guard, and Asset Usage Tracking.
- Five acceptance missions frozen for non-technical digital marketer operations.
- Strict operational isolation preserved: Zero marketer access to prices, durations, operational branch activations, travel fees, attendance, payroll, or database RLS.

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
- Product/database/production mutation in C1/C2/C3/C4: NONE.

## Verified repository summary

CradleHub is a Next.js 16.2.4 / React 19.2.4 web application using Supabase PostgreSQL, Auth, RLS, RPCs, Realtime, and Storage where applicable. It has no separate Tauri/Rust/SQLite desktop application in this repository.

## Open facts and candidates carried forward

- historical migration-history limitation and unavailable live database verification;
- Attendance operational gates;
- formatting baseline failure;
- privileged service-role/super-admin boundaries requiring review;
- GitHub protection/ruleset and Vercel linkage/deployed-commit unknowns; and
- production-connected `main` release safety.

C0B, C1, C2, C3, C4, and C5 Pass 1 are CLOSED and ACCEPTED. C5 Pass 1 was merged into main at `1f5d71ce3472684c9a94ad83d6c2e36a9d1b1971`. C5 Pass 2 (Central Media Library & Universal Media Picker) is ACTIVE. C5 Pass 2 does NOT authorize schema/database mutation, migrations, RLS/Auth/Storage policy changes, production data mutation, or C5 Pass 3+. C5 Pass 3+ remains strictly NOT AUTHORIZED.
