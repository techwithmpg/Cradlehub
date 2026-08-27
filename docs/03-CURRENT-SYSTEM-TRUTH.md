# Current-System Truth

## Evidence labels

- **VERIFIED REPOSITORY FACT** — directly reproduced from accepted source, Git, or local commands.
- **INDEPENDENTLY VERIFIED LIVE FACT** — verified read-only against a current external endpoint during C1.
- **REPOSITORY-RECORDED PRODUCTION EVIDENCE** — an accepted repository record of earlier production work, not independently repeated in C1.
- **UNKNOWN / REQUIRES C2** — not established by C1 and not safe to infer.

## 1. Baseline

**VERIFIED REPOSITORY FACT**

- Canonical repository: `https://github.com/techwithmpg/Cradlehub.git`.
- `git fetch --all --prune` completed on 2026-08-27.
- Owner-authorized accepted `main`: `4f9291c7d457ec49b071e766df4c23ca1e4f1558`.
- Resolved `origin/main` and initial `HEAD` both matched that SHA with `0/0` divergence.
- C1 branch: `stage/c1-truth-consolidation`, created from that exact commit.
- C0B governance anchor `03dbd57ed4be6f9b1f0bd30c7fd22a225e68ec2a` remains recorded and accepted.
- C2 and all later stages are not authorized.

## 2. Repository and toolchain

**VERIFIED REPOSITORY FACT**

| Item | Accepted/local fact |
| --- | --- |
| Framework | Next.js 16.2.4, React/React DOM 19.2.4 |
| Language/tooling | TypeScript 5.9.3, ESLint 9.39.4, Vitest 4.1.5 |
| Node contract | `.node-version` is `24.14.0`; `package.json` requires `>=24.0.0 <25.0.0` |
| Package manager | `pnpm@10.33.2`, lockfile format 9.0 |
| Supabase client/SSR | `@supabase/supabase-js` 2.106.2, `@supabase/ssr` 0.10.3 |
| Supabase CLI | Repository dependency 2.95.6 |
| Local Supabase config | project id `cradlehub`, PostgreSQL major 17, API/Auth/Realtime/Storage enabled |

The shell initially resolved system Node `25.2.0`, which was outside the accepted engine range. Node `24.14.0` was installed locally and every C1 install/validation command was run through that exact runtime. The global/default shell runtime was not changed.

## 3. Local reproducibility

**VERIFIED REPOSITORY FACT**

- The root `node_modules` was a normal ignored directory, but all 3,079 package reparse points targeted missing `F:\cradlehub\...` paths; `F:\cradlehub` did not exist.
- Only `E:\cradlehub\node_modules` was removed. No external target directory was removed.
- `pnpm install --frozen-lockfile` under Node 24.14.0 / pnpm 10.33.2 succeeded: the lockfile resolution was skipped and 944 packages were installed.
- `package.json` and `pnpm-lock.yaml` remained unchanged.
- The rebuilt tree contained 2,880 reparse points, zero `F:\cradlehub` targets, and zero missing absolute targets.

Command context used for reproducibility and validation:

```text
fnm exec --using=24.14.0 C:\Users\eleur\AppData\Roaming\npm\pnpm.cmd <command>
```

## 4. Working-tree reconciliation

**VERIFIED REPOSITORY FACT**

- Initial tracked state on `main`: only `.env.example` was deleted locally; there were no non-ignored untracked files.
- `.env.example` is tracked on accepted main, has a continuous Git history, is referenced by the database runbook/tooling documentation, and contains public literals, empty values, or explicit placeholders in credential-bearing fields.
- No evidence supported removing the template from repository policy. The exact accepted blob (`3bda4226fa38cca1d22a1822088d979738b097b4`) was restored locally; it has no C1 content diff.
- Ignored top-level local artifacts included `.env.local`, `.env.database.local`, `.next`, `node_modules`, `.codex-artifacts`, `.codex-backups`, `deliverables`, `supabase.zip`, and `tsconfig.tsbuildinfo`. Their contents were not added to C1.
- Five local directories existed under `.claude/worktrees`; only `hungry-mestorf-170c68` was registered as a detached Git worktree. They were left untouched.
- Remote `origin` is the canonical HTTPS repository. No unrelated work was staged.

## 5. Repository validation

**VERIFIED REPOSITORY FACT**

| Command | Result |
| --- | --- |
| `pnpm format:check` | **FAIL** — the repository helper checked 306 incremental code/config files since `b4192d81`; 93 existing files were not Prettier-compliant. `pnpm format` was not run. |
| `pnpm type-check` | **PASS** |
| `pnpm lint` | **PASS**, no diagnostics |
| `pnpm test` | **PASS** — 200 test files, 1,372 tests |
| `pnpm build` | **PASS** — Next.js 16.2.4/Turbopack compiled, TypeScript passed, and 114 static-generation entries completed |

Initial sandbox-only `spawn EPERM` failures in the formatting helper and Vitest were reproduced as environment restrictions and then rerun with subprocess permission. The results above are the repository results, not the sandbox failures.

## 6. System inventory

**VERIFIED REPOSITORY FACT**

Accepted source contains 109 App Router page entries and 25 route handlers. The successful build enumerated public, authenticated workspace, API, Auth callback, booking, scanning, tracking, onboarding, and utility routes.

| Surface | Source-backed entry and major dependencies |
| --- | --- |
| Public/marketing | `src/app/page.tsx` plus `(public)` pages; public branches/site queries, SEO modules, public-site configuration, and Supabase-backed content |
| Public booking | `src/components/public/booking-wizard.tsx`; online/in-house booking Server Actions; branch, booking-context, dispatch-slot, and availability APIs; service-catalog/eligibility modules |
| Tracking/waitlist/contact | `/track/[token]`, public tracking actions, customer tracking/location tables, `/api/public/waitlist`, public branch/site queries |
| CRM / Front Desk | `/crm/today` Work Queue; bookings, schedule, Attendance, customers, dispatch/live operations, notifications, reconciliation, setup, and staff; `getFrontDeskContext` supplies branch-scoped identity/capabilities |
| Owner | `/owner` overview and branches, bookings, Attendance, dispatch, marketing, notifications, payroll, reports, schedule, services, spaces/rules, and staff pages |
| Manager | `/manager` and related bookings/control/dispatch/live operations/reports/schedule/services/settings/spaces/staff routes with page-level role/branch checks |
| Staff portal | Staff-mode-dependent home, Attendance, schedule, dispatch/jobs/map, notifications, profile, service progress, stats, and week routes |
| Driver | Driver home, dispatch, jobs/detail, and map routes backed by driver/staff-portal actions and dispatch/location modules |
| Utility | Authenticated `/utility` root only; no deeper utility route tree |
| Marketing workspace | `/marketing` and `/owner/marketing`, public-site section/asset queries, studio actions, defaults, and marketing components |

Compatibility routes are part of the current architecture: CRM availability/services/spaces/waitlist/staff-availability redirect into Schedule, Setup, or Customers; Manager today redirects to Manager root; Manager resources redirects to spaces/rules.

Route presence and a successful build do not prove production availability, correct permissions, or workflow correctness.

## 7. Authentication and authorization architecture

**VERIFIED REPOSITORY FACT**

- `src/proxy.ts` refreshes Supabase sessions and protects `/owner`, `/marketing`, `/manager`, `/crm`, `/staff-portal`, `/driver`, `/utility`, `/dev`, and `/select-workspace`.
- Protected access requires `supabase.auth.getUser()`, an active `staff` row, and workspace access derived from canonicalized `system_role`, `staff_type`, and branch data.
- Owner, marketing, manager, CRM/front-desk, staff-portal, driver, and utility workspace grants are centralized in `src/lib/auth/workspace-access.ts`.
- CRM contexts and API contexts canonicalize legacy `csr*` aliases to `crm` and use branch-scoped staff data/capability helpers.
- The dashboard layout provides shared identity/navigation context only; its source explicitly requires page-level authorization for sensitive pages.
- API paths are skipped by the proxy and implement their own public, authenticated, role, branch, bearer-secret, or scheduled-job checks.
- Browser/server clients use the public Supabase URL and anon key with request cookies. `src/lib/supabase/admin.ts` creates a service-role client that bypasses RLS and is used by server-oriented pages, actions, route handlers, and scripts.
- `src/lib/auth/super-admin.ts` contains a source-coded user-ID allowlist that resolves owner-level context across workspaces.
- Storage use found in application source is the `staff-pictures` bucket for onboarding/profile uploads.

## 8. Domain/source ownership

**VERIFIED REPOSITORY FACT**

| Domain | Primary application ownership | Database/RPC/Realtime representation |
| --- | --- | --- |
| Bookings | `src/lib/queries/bookings.ts`, `src/lib/actions/{online-booking,inhouse-booking,administrative-booking}.ts`, `src/lib/bookings`, availability/time engines, CRM/Owner/Manager actions and booking APIs | `bookings`, events/payment logs, branch rules/resources; availability, end-time, payment, service-session and progress RPCs |
| Customers | `src/lib/queries/customers.ts`, CRM customer/waitlist surfaces, lookup/search APIs, online/in-house booking actions | `customers`, `waitlist_requests`; `upsert_customer` |
| Staff | `src/lib/queries/staff.ts`, `src/lib/staff`, onboarding, Owner/Manager/CRM/staff-portal actions | `staff`, staff services/schedules/preferences, branch assignment/change/device/onboarding records; capability and branch-resolution RPCs; `staff-pictures` Storage |
| Scheduling | `src/lib/queries/schedule.ts`, `src/lib/schedule`, `src/lib/scheduling`, schedule actions/APIs/components | staff schedules/overrides, blocked times, duty assignments, rules/health/suggestions; weekly-schedule RPC; schedule Realtime channel |
| Attendance | `src/lib/attendance`, scan/recent-scan/closing APIs, CRM/Owner/staff-portal/scan actions and components | QR points/events, check-ins, exceptions, rules/settings/devices/corrections/interventions; transactional scan/correction/recovery/closing RPCs; Attendance Realtime channels |
| Services | `src/lib/services`, service queries, CRM/Owner service actions and setup components | master `services`, `service_categories`, branch overlay `branch_services`, staff capability `staff_services`; capability RPC |
| Home service/dispatch | dispatch queries, distance service/fee, driver/location/ETA/tracking actions, dispatch/control/map pages and APIs | bookings/resources, customer tracking links, location snapshots; service-session/progress RPCs |
| Payroll | payroll queries/actions/calculation modules and Owner payroll page | payroll periods/items/adjustments/settings and staff pay profiles |
| Notifications | `src/lib/notifications`, notification/push route handlers, workspace notification components | workspace notifications, delivery preferences, push subscriptions, workflow tasks; notification Realtime channel |
| Marketing/public config | public-site and marketing queries, `src/lib/public`, marketing actions/workspaces, public-section defaults | public-site sections/assets and marketing foundation migration |

Source references 55 distinct table/view/bucket names and 30 named RPCs. Important triggers/functions are represented in migrations, but migration files alone do not prove live deployment.

## 9. Supabase and migration truth

**VERIFIED REPOSITORY FACT**

- `supabase/migrations` contains 130 SQL files.
- Every filename has one unique 14-digit version; there are no duplicate versions or unparsed filenames.
- Ordering runs from `20260429000001_core_tables.sql` through `20260821160939_attendance_transfer_business_date.sql`.
- Commit `40e24ddc` renamed five migration versions to match authoritative live version records without changing SQL content and added two reconciliation migrations.
- The latest accepted migration commits add live-schema/security reconciliation, Attendance function disambiguation, branch authority, and transfer-business-date SQL.
- Database wrappers exist for doctor, status/list, verification, live verification, link, push, type generation, and migration creation. Push/type/link wrappers can mutate local or remote state and were not run in C1.
- Active governance and accepted repository context record 84 older local-only versions that must not be replayed, marked applied, repaired, or pushed merely to normalize history.

**LIVE DATABASE VERIFICATION NOT AVAILABLE**

The linked ref, configured ref, and Supabase URL all matched `lsrbwqhvzjfpiabeolkv`, but the active Supabase CLI account did not expose that ref in its read-only project list. C1 stopped before migration-list, SQL, REST, Auth, RLS, Storage, or data inspection and did not substitute the unrelated accessible project.

## 10. Delivery/deployment truth

**VERIFIED REPOSITORY FACT**

- Accepted main contains zero files under `.github/workflows`; C0B-005 is confirmed as absence of repository-native GitHub Actions, not absence of all CI/CD.
- Local `origin/HEAD` points to `origin/main`.
- `vercel.json` defines one daily `0 0 * * *` cron for `/api/agent/follow-up`.
- No local `.vercel/project.json` exists; `.vercel` is intentionally ignored.
- `next.config.ts` contains the build root, Turbopack SVG rule, headers, image hosts, and one Manager redirect; runtime versions are controlled by `.node-version` and `package.json`.
- GitHub CLI authentication was invalid, so branch protection and rulesets were not inspected.

**INDEPENDENTLY VERIFIED LIVE FACT**

- A read-only `git ls-remote --symref origin HEAD` returned `refs/heads/main` at `4f9291c7d457ec49b071e766df4c23ca1e4f1558` on 2026-08-27.
- A read-only production-web `HEAD` request returned HTTP 200 at `https://www.cradlewellnessliving.com/` after redirect and identified Vercel and Next.js response headers.

These facts do not identify the Vercel project, prove the production branch/deployed commit, or certify application behavior.

## 11. Repository-recorded production evidence

**REPOSITORY-RECORDED PRODUCTION EVIDENCE**

- Active governance records `main` as production-connected and C0B as closed/accepted.
- `docs/PROJECT_CONTEXT.md` records the 2026-08-21 live schema reconciliation, five filename matches, eight recorded applied migrations, no remote-only versions at that time, and 84 intentionally unmarked older local versions.
- The same repository context records the accepted Attendance transaction/branch-authority verification and separates monitored scanning from operational enforcement.
- Service-catalog context records `services` as master catalogue, `branch_services` as branch overlay, and `staff_services` as capability.

These records were not promoted to independently verified live facts in C1.

## 12. Independently verified live evidence

**INDEPENDENTLY VERIFIED LIVE FACT**

- Git remote HEAD/default branch and SHA, as stated above.
- Public production domain HTTP/platform response, as stated above.
- No CradleHub live database fact was independently verified.

## 13. Unknown / requires C2

**UNKNOWN / REQUIRES C2**

- Current live schema, migration history, data effects, Auth settings, RLS/policies, Storage configuration, Realtime publications, and cron state.
- Operational correctness and permission behavior for booking, Attendance, schedule, dispatch, payroll, notifications, and every workspace.
- GitHub branch protection/rulesets and external CI gates.
- Vercel project linkage, configured production branch, environment settings, and deployed commit SHA.
- Authenticated browser/device/Realtime behavior and Attendance operational enforcement readiness.
- Backup/restore readiness and production recovery evidence.

## 14. Issues promoted to C2 candidates

- The configured formatting gate fails on 93 accepted-baseline incremental files.
- `src/lib/supabase/admin.ts` has no `server-only` import even though it creates a service-role RLS-bypassing client; all C1-discovered imports were server-oriented, but the module boundary is not enforced in the module itself.
- A source-coded super-admin user-ID allowlist grants owner-level workspace context outside normal active-staff role derivation; its operational ownership, revocation model, and production necessity require review.
- Live CradleHub database verification is unavailable with the active Supabase CLI account.
- Delivery protection/ruleset and Vercel linkage/commit facts remain unavailable.

These are candidates/evidence, not authorized fixes or project decisions.

## 15. C1 gate status

**Recommendation: PASS — awaiting owner review.**

- Accepted baseline verified: yes.
- Exact accepted runtime and frozen-lockfile dependency reproduction: yes.
- Repository validation results recorded without hiding failures: yes.
- System, auth/workspace, domain, migration, and delivery inventories: yes.
- Live/repository/unknown evidence separated: yes.
- Product behavior changed: no.
- Database or production mutation: no.

The formatting failure and unknown live controls remain recorded work candidates; they do not prevent C1 from establishing a reproducible current-system baseline.

**C2 IS NOT AUTHORIZED.**
