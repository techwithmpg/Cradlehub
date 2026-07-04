# 🤝 HANDOFF — Notes for the Next Agent

> **This file is a letter to the future.**
> **Every agent MUST update this before ending their session.**
> **The next agent reads this FIRST to understand the current state.**

---

## Latest Session Summary

| Field              | Value                                                      |
|--------------------|------------------------------------------------------------|
| **Agent**          | Codex                                                     |
| **Date**           | 2026-07-03                                                |
| **Tasks Completed**| Attendance Device Registry and Recovery Center backend/UI completed and live DB verified |
| **Tasks Remaining**| Authenticated Devices tab QA, real phone recovery scan QA, DB password rotation, and migration-history connectivity repair |
| **Build Status**   | `pnpm db:types`, type-check, lint, full tests, build, and diff check passed |
| **Mood**           | The registry has a real spine now; the last mile is authenticated field testing |

---

## What I Did

**Attendance Device Registry:**
- Added and applied `supabase/migrations/20260703151111_attendance_device_registry_recovery.sql`.
- Verified live migration row, new `staff_devices` / `device_activation_tokens` columns, `consume_attendance_device_recovery`, and `service_role` execute grant.
- Verified earlier local migration versions `20260703130922`, `20260703144603`, and `20260703145113` are also present in remote migration history.
- Added typed registry and recovery backend helpers.
- Added CRM actions for recovery link generation, device rename, device revoke, and pending-link revoke.
- Reworked `/scan/activate/[token]` so recovery links are previewed without page-load consumption and consumed only after staff confirmation.
- Replaced the Attendance Devices tab with the Device Registry and Recovery Center UI.
- Regenerated `src/types/supabase.ts`.

Validation:
- `pnpm db:types`: PASS.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm vitest run tests/lib/attendance/device-recovery.test.ts`: PASS.
- `pnpm test`: PASS, 67 files / 595 tests.
- `pnpm build`: PASS, 105 app routes.
- `git diff --check`: PASS, line-ending notices only.

Remaining Attendance QA:
- Authenticated browser QA for `/crm/attendance?tab=devices`.
- Real recovery-link copy/open/consume flow on a staff phone/browser.
- Confirm recovery consumption does not clock in/out in live user testing; code path only logs activation audit.

**Database Tooling:**
- Added `scripts/database/_shared.mjs`.
- Added `pnpm db:doctor`, `db:status`, `db:verify`, `db:link`, `db:push`, `db:types`, and `db:migration` wrappers.
- Replaced stale hardcoded Supabase CLI package scripts.
- Added `.env.example` placeholders for Supabase app/runtime and local database tooling variables.
- Unignored `.env.example` while keeping `.env.local`, `.env.database.local`, and `supabase/.temp` ignored.
- Added `docs/DATABASE_CONNECTION_RUNBOOK.md`.
- Documented `pnpm exec supabase` failure and direct project-local shim success.

---

## What's Next

1. Rotate the Supabase database password before trusting local DB tooling again.
2. Put rotated database tooling values into `.env.local` or `.env.database.local`; never paste them into chat.
3. Re-run `pnpm db:doctor`, `pnpm db:status`, and `pnpm db:verify`.
4. Inspect migration-history drift before any repair/push; latest registry migration `20260703151111` is already present in live history.
5. Re-run `pnpm db:push` from a network/path that can reach the Supabase migration-history connection.
6. Use a real CRM/front-desk browser session to QA `/crm/attendance?tab=devices`.
7. Test a real recovery link on a staff phone/browser.

Current verification:
- `pnpm db:doctor`: runs, but exits nonzero because password rotation is unconfirmed, `SUPABASE_DB_POOLER_URL` is missing, and linked migration history times out.
- `pnpm db:status`: local migration count 83; remote read times out; remote schema changed no.
- `pnpm db:verify`: linked SQL probe and critical tables pass; pooler fallback warns because env is missing.
- `pnpm db:push -- --dry-run`: no remote schema change; remote connection timed out.
- `pnpm db:types`, `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build`, and `git diff --check` pass after the Attendance device registry work.

---

## Watch Out For

- The worktree is dirty from prior scheduling work; do not revert unrelated schedule source changes.
- A Supabase DB password was pasted in chat and must be rotated.
- `pnpm exec supabase` is unreliable here, but `.\node_modules\.bin\supabase.CMD` works.
- `psql` is not installed, so emergency pooler migration application is not currently executable.
- Migration history has known drift from previous direct SQL application; do not use `--include-all` blindly.
- `tmp-attendance-device-registry-verify.sql` may remain untracked. It was a read-only live DB verification probe; sandbox deletion was denied and elevated delete was blocked by the environment usage limit.

---

## Files That Matter Right Now

| File | Why It Matters |
|------|----------------|
| `supabase/migrations/20260702075213_attendance_qr_system.sql` | Attendance QR schema, grants, RLS, RPC, optional cron block |
| `supabase/migrations/20260703151111_attendance_device_registry_recovery.sql` | Attendance device registry/recovery schema extension and atomic recovery RPC |
| `src/app/(dashboard)/crm/attendance/page.tsx` | Protected CRM Attendance page loader |
| `src/app/(dashboard)/crm/attendance/actions.ts` | CRM Attendance server actions |
| `src/app/scan/actions.ts` | Public scan/activation server actions |
| `src/app/scan/[publicCode]/page.tsx` | Public QR scan route |
| `src/app/scan/activate/[token]/page.tsx` | One-time device activation/recovery route |
| `src/components/features/attendance/attendance-workspace.tsx` | CRM Attendance UI |
| `src/components/features/attendance/attendance-header.tsx` | Compact Attendance page header/actions |
| `src/components/features/attendance/attendance-tabs.tsx` | Local instant-tab controls |
| `src/components/features/attendance/overview/*` | Overview live staff/scans/sessions/exceptions/quick actions |
| `src/components/features/attendance/records/attendance-records-tab.tsx` | Attendance Records tab |
| `src/components/features/attendance/sessions/service-sessions-tab.tsx` | Service Sessions tab |
| `src/components/features/attendance/devices/registered-devices-tab.tsx` | Device Registry and Recovery Center tab |
| `src/components/features/attendance/exceptions/attendance-exceptions-tab.tsx` | Exceptions tab |
| `src/components/features/attendance/reports/attendance-reports-tab.tsx` | Reports tab |
| `src/components/features/attendance/qr-codes/*` | QR list, preview, export, print, and info components |
| `src/components/features/attendance/public-scan-processor.tsx` | Client scan processor/countdown view |
| `src/lib/attendance/*` | QR, credential, timing, query, and scan-engine logic |
| `src/types/supabase.ts` | Manually augmented attendance Supabase types |

---

## Previous Handoff - CRM Stabilization

## Last Session Summary

| Field              | Value                                                      |
|--------------------|------------------------------------------------------------|
| **Agent**          | Codex                                                     |
| **Date**           | 2026-06-30                                                |
| **Tasks Completed**| CRM stabilization Checkpoint 1 sidebar/nav shell           |
| **Tasks Remaining**| Work Queue simplification, CRM header, Bookings tabs, Schedule split, Customers/Home Service/System Management pages |
| **Build Status**   | `npm run type-check`, `npm run lint`, `npm run build`, and `git diff --check` passed |
| **Mood**           | Sidebar is aligned; the bigger workflow simplification still needs careful steps |

---

## What I Did

**CRM Checkpoint 1:**
- Changed CRM sidebar primary nav to `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`.
- Removed visible primary `Admin & Setup` competition from the CRM nav.
- Added a collapsed bottom `SYSTEM / System Management` section for management-authorized CRM workspace users.
- Linked System Management to the current routes/deep links:
  - Staff & Access: `/crm/staff`
  - Services & Providers: `/crm/setup?tab=services`
  - Rooms & Resources: `/crm/setup?tab=spaces`
  - Booking Rules: `/crm/setup?tab=booking_rules`
  - Schedule Management: `/crm/staff-availability`
  - System Health: `/crm/setup?tab=health`
  - Close Day: `/crm/reconciliation`
- Adjusted CRM background prefetching so only primary daily routes are warmed automatically.

**Preserved:**
- Existing CRM routes and compatibility redirects.
- Existing server actions, mutations, Supabase queries, RLS behavior, and route files.
- Previous shared `getFrontDeskContext()` work.

---

## What's Next

1. Continue with Checkpoint 2: simplify Work Queue by merging the useful Today/Control concepts without deleting `/crm/control`.
2. Keep route compatibility while moving visible labels from Front Desk/Dispatch toward Work Queue/Home Service.
3. Handle CRM header requirements in a dedicated pass: current page title, branch, search, notifications, persistent New Booking, user menu.
4. Before exposing System Management to ordinary CRM/CSR roles, review page gates and action/RLS permissions deliberately.
5. Trace at least one critical CRM action end-to-end before claiming action readiness.

---

## Watch Out For

- The latest prompt says production usable by tomorrow. Favor small, safe, verifiable fixes.
- Do not use service-role from browser code.
- Do not hide controls as a substitute for server-side authorization.
- Do not leave visible buttons that do nothing.
- Do not add a global CRM New Booking button until page-level duplicate buttons are addressed.
- Authenticated CRM browser QA is still missing unless the next agent has a real CRM/front-desk session.
- Repository-standard final verification should use `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

---

## Files That Matter Right Now

| File | Why It Matters |
|------|----------------|
| `docs/FRONT_DESK_REFACTOR_PROGRESS.md` | Detailed CRM/front-desk refactor checkpoint and next-pickup log |
| `.context/CURRENT_TASK.cmd.md` | Current active task for repo-standard agent memory |
| `.context/HANDOFF.cmd.md` | Short next-agent pickup note |
| `src/lib/queries/crm-context.ts` | New shared Front Desk/CRM context helper |
| `src/components/features/dashboard/nav-config.ts` | Current sidebar destinations and labels |
| `src/components/features/dashboard/sidebar.tsx` | Collapsed System Management renderer |
| `src/components/features/workspace/workspace-prefetch-config.ts` | CRM automatic route warm-up behavior |
| `src/components/features/crm/crm-tab-nav.tsx` | Still contains overlapping legacy secondary CRM tab routes |

---

## Environment / Setup Notes

- Latest Attendance verification used `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build`; all passed.
- Lint is currently clean with 0 warnings after the Attendance final verification cleanup.

---

## Previous Handoffs (Archive)

_No previous handoffs to archive._

---

## 2026-07-02 - ATTENDANCE-REFIT-005 Final Verification Continuation

### Completed

- Resolved all four lint warnings in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`.
- Final pnpm verification:
  - `pnpm type-check`: PASS.
  - `pnpm lint`: PASS, 0 warnings.
  - `pnpm test`: PASS, 60 files / 564 tests.
  - `pnpm build`: PASS, 104 app routes.
- Attempted browser QA for `/crm/attendance?tab=qr` at 1440, 1280, 1024, 768, and 375 px.
- Captured auth-blocker screenshots in `.codex-artifacts/attendance-qr-qa/`.

### Still Blocked

- The QR tab redirects to `/login` at every requested viewport because no authenticated Supabase CRM/front-desk browser session is available.
- `DEV_AUTH_BYPASS=true` is not enough for this route because `src/proxy.ts` still requires a real Supabase user before dev-bypass staff handling.
- Real QR visual parity, interactions, exported artifact scans, print/PDF preview scan, and QR identity preservation checks remain pending.
- `pnpm exec supabase --version` currently hits a Windows file-lock error after dependency restoration; retry after the lock clears before Supabase CLI work.

### Next Pickup

1. Authenticate the browser as a CRM/front-desk user.
2. Reopen `http://localhost:3000/crm/attendance?tab=qr`.
3. Complete the viewport, interaction, export, phone-scan, and QR identity checklist before marking the QR refit fully complete.
