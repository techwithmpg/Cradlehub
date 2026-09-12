# Known Issues Register

| ID | Severity | Status | Area | Evidence | Impact | Next stage if authorized | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C0B-001 | P2 | RESOLVED / C1 VERIFIED | Local environment | Accepted main tracks a placeholder-only `.env.example`; C1 restored its exact blob and confirmed no content diff. | The local configuration template contract is restored. | None | The prior deletion was checkout drift, not repository policy. |
| C0B-002 | P1 | RESOLVED / C1 VERIFIED | Dependency reproducibility | C1 proved 3,079 junctions targeted missing `F:\cradlehub`, removed only local `node_modules`, and completed a frozen-lockfile install under Node 24.14.0 / pnpm 10.33.2. | Install, type-check, lint, tests, and build now run reproducibly. | None | Package and lock files were unchanged. |
| C0B-003 | P1 | CONFIRMED / OPEN | Schema/migration history | Repository has 130 unique ordered migrations and accepted context records 84 intentionally unmarked historical local-only versions; C1 live verification was unavailable. | Broad reconciliation could misrepresent or alter production history. | C2 | No bulk replay, marking applied, repair, or `--include-all`. |
| C0B-004 | P1 | CONFIRMED / OPEN | Attendance operations | Accepted repository context separates monitored scanning from operational enforcement and records enforcement gates as incomplete. | Training/production enforcement cannot be claimed ready. | C2 | Repository-recorded production evidence only; C1 performed no live Attendance test. |
| C0B-005 | P2 | CONFIRMED / OPEN | Delivery governance | Accepted main has zero GitHub Actions workflows; the production domain currently responds from Vercel, but GitHub rulesets and Vercel linkage/branch/commit are unverified. | No repository-native CI gate is evidenced and external release controls are only partially known. | C2 | Absence of GitHub Actions is not absence of all CI/CD. |
| C0B-006 | P1 | RESOLVED / ACCEPTED | Governance | External review accepted the active governance model at merge SHA `03dbd57ed4be6f9b1f0bd30c7fd22a225e68ec2a`. | The accepted source-of-truth hierarchy now governs; stale mirrors no longer have active authority. | None | The active manifest is accepted; `.context/` and older mirrors remain historical evidence. |
| C0B-007 | P1 | ONGOING | Release safety | `main` is production-connected. | An accepted main push/merge may deploy. | Every stage | Controlled by branch and review policy. |
| C1-001 | P2 | OPEN / C2 CANDIDATE | Quality tooling | `pnpm format:check` checks 306 incremental files and fails on 93 existing code/test files. | The configured formatting gate is red although type-check, lint, tests, and build pass. | C2 | C1 did not run the writing formatter. |
| C1-002 | P1 | OPEN / C2 CANDIDATE | Privileged server boundary | `src/lib/supabase/admin.ts` creates a service-role client without a module-level `server-only` guard; C1-discovered imports were server-oriented. | An accidental future client import would cross a privileged boundary that is currently enforced by convention. | C2 | No key was exposed and no Auth/RLS code was changed in C1. |
| C1-003 | P1 | OPEN / C2 CANDIDATE | Authorization exception | `src/lib/auth/super-admin.ts` contains a source-coded user-ID allowlist that grants owner-level workspace context. | The exception bypasses normal active-staff role derivation and needs ownership/revocation/necessity review. | C2 | Repository fact; operational correctness was not tested. |
| C1-004 | P1 | OPEN | Live evidence | The CradleHub ref matches linked/configured/URL metadata, but the active Supabase CLI account does not expose that project. | Live schema, migration, RLS, Auth, Storage, and data truth cannot be independently certified in C1. | C2 | `LIVE DATABASE VERIFICATION NOT AVAILABLE`; no substitute project was used. |

## Staff PWA current-system unknowns — 2026-09-11

These are source-backed investigation seams from [PWA-C1](pwa/PWA-C1-TRUTH-MAP.md), not severity-ranked defects or authorized fixes. The separate PWA-C2 diagnostic register follows below.

| ID | Status | Evidence and implication |
| --- | --- | --- |
| PWA-C1-001 | OPEN / EVIDENCE GAP | No installed-PWA/device/provider/live-database verification; repository production records remain **REPOSITORY-RECORDED PRODUCTION EVIDENCE**. |
| PWA-C1-002 | OPEN / FOUNDATION INVENTORY | No install manifest or camera decoder found in searched app/public source; existing push worker and legacy cache-clearing worker require preservation and lifecycle analysis. |
| PWA-C1-003 | OPEN / ATTENDANCE SEAM | QR, shift-widget and controlled portal clock-out paths coexist. `getMyAttendanceData` can invoke a write-capable recalculation RPC; page reads cannot be assumed mutation-free. |
| PWA-C1-004 | OPEN / DRIVER SEAM | Driver Route Map renders a placeholder; separate one-shot GPS and operations/customer map components exist. Mobile capture parity, background tracking and live convergence are unverified. |
| PWA-C1-005 | OPEN / ACCESS SEAM | Driver/utility page checks, workspace grants and links differ; Utility is a Coming Soon surface. No new role permissions or utility functionality are inferred. |
| PWA-C1-006 | OPEN / GOVERNANCE CONTEXT | Inherited Marketing authorization paragraphs conflict; PWA-C1 registers scoped authority without changing Marketing acceptance history. Supplied owner-approved PWA product direction is recorded in PROJECT.md; exact engineering contracts remain deferred to PWA-C3/C4. |

PWA-C2 structured diagnostics — 2026-09-12. These entries record source-backed seams and evidence limits; they do not authorize fixes.

| ID | Status | Evidence and implication |
| --- | --- | --- |
| PWA-C2-001 | OPEN / P1 | Business-date consumers mix UTC date derivation with `getBranchBusinessDate()` across Staff/Driver and CRM surfaces. Runtime branch-midnight impact is unknown. |
| PWA-C2-002 | OPEN / P1 | Attendance has multiple mutation paths and a page-load read that can invoke policy recalculation. Canonical command and side-effect boundaries require a later contract. |
| PWA-C2-003 | OPEN / P1 | Driver Route Map is a placeholder; one-shot GPS capture and 30-second Live Operations polling are separate. Continuous/background reliability and convergence are unverified. |
| PWA-C2-004 | OPEN / P1 | Dedicated driver workspace exclusion conflicts with hardcoded `/staff-portal/...` links in the driver More menu. Route ownership requires a later navigation contract. |
| PWA-C2-005 | OPEN / P1 | Existing role navigation has Today/Start/Jobs actions; no universal Scan action or camera decoder was found. |
| PWA-C2-006 | OPEN / P1-P2 | Push subscription DELETE is not explicitly scoped to the current user in the route, while deployed RLS/policy behavior was not verified. |
| PWA-C2-007 | OPEN / P2 | Live Operations catches errors as an empty list and polls without explicit visibility/offline freshness state. |
| PWA-C2-008 | OPEN / P2 | No manifest/install flow was found; legacy self-unregistering `sw.js` and push worker ownership require a foundation contract. |
| PWA-C2-009 | OPEN / P2 | Customer identity/address and destination coordinates cross live-trip/map consumers without a documented minimization or caching contract. |
| PWA-C2-010 | OPEN / P2 | No durable offline authoritative queue was found; this matches online-first direction but needs centralized acceptance behavior. |
| PWA-C2-011 | OPEN / P2 | Google Maps script/key/readiness and geolocation dependencies have no real-device/provider evidence. |
| PWA-C2-012 | BLOCKED BY APPROVED SCOPE | Utility remains a role-gated Coming Soon surface; no speculative Utility backend is authorized. |

## Staff PWA C3 unresolved gates and canonical references — 2026-09-12

The [C3 Decision Register](pwa/PWA-C3-FINAL-SCOPE-FREEZE.md#c3-decision-register) is the sole canonical C3 decision namespace (`PWA-C3-Dxxx`). Unresolved details are owned by its [Open Contract Questions](pwa/PWA-C3-FINAL-SCOPE-FREEZE.md#open-contract-questions). The table below retains the original issue references for historical traceability; they are not a second decision register, and their prior frozen wording remains in reviewed commit `1535f5e258190d0024ce50c87bb19f06f913a4e8`. No fixes or later stages are authorized by these references.

| Historical issue reference | Current risk/reference status | Canonical owner and unresolved implication |
| --- | --- | --- |
| PWA-C3-001 | REFERENCE ONLY | PWA-C3-D003 owns the freeze; the unresolved source-backed business-date risk remains PWA-C2-001. No duplicate decision here. |
| PWA-C3-002 | OPEN / CONTRACT GATE | PWA-C3-D005/D006 and PWA-C3-Q011 own authority/separation and unresolved command/read-side/audit/reconciliation details; no runtime fix evidenced. |
| PWA-C3-003 | OPEN / DEVICE GATE | PWA-C3-D009/D010/D011/D020 and PWA-C3-Q001/Q002/Q003/Q010 own Driver scope and unresolved freshness, cadence, provider and real-device reliability. |
| PWA-C3-004 | REFERENCE ONLY | PWA-C3-D009 owns workspace scope; conflicting links remain the unresolved PWA-C2-004 finding until a later authorized implementation. |
| PWA-C3-005 | REFERENCE ONLY | PWA-C3-D004/D021 own Scan and recovery decisions; the missing camera/entry seam remains PWA-C2-005. |
| PWA-C3-006 | OPEN / SECURITY GATE | PWA-C3-D016 and PWA-C3-Q007 own notification boundaries and delivery acceptance; subscription ownership and deployed-policy proof remain open under PWA-C2-006. |
| PWA-C3-007 | REFERENCE ONLY | PWA-C3-D012 owns online-first semantics; PWA-C2-010 retains the acceptance/centralization gap. |
| PWA-C3-008 | BLOCKED / CONTRACT GATE | PWA-C3-D013 and PWA-C3-Q009 own Utility scope and the unresolved existing-source/interaction contract for Work. Task-management backend is OUT OF V1. |

This register contains governance, repository, and stage-evidenced environment risks. Historical reports still require current evidence before promotion.
