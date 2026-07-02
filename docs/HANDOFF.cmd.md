# 🤝 HANDOFF — Notes for the Next Agent

> **This file is a letter to the future.**
> **Every agent MUST update this before ending their session.**
> **The next agent reads this FIRST to understand the current state.**

---

## Latest Session Summary

| Field              | Value                                                      |
|--------------------|------------------------------------------------------------|
| **Agent**          | Codex                                                     |
| **Date**           | 2026-07-02                                                |
| **Tasks Completed**| Attendance workspace refit on top of the existing QR Attendance and Service Session system |
| **Tasks Remaining**| Authenticated CRM/browser Attendance QA, real scan/device flow QA, pg_cron or external scheduler decision, db:types script repair, migration-history reconciliation |
| **Build Status**   | `npx tsc --noEmit --pretty false`, targeted Attendance Vitest, `npm run lint`, `npm run build`, and full `npm test -- --run` passed |
| **Mood**           | The workspace feels much calmer; the live authenticated click-through is the last honest gate |

---

## What I Did

**Attendance Workspace Refit:**
- Kept `/crm/attendance` as the single protected Attendance route.
- Refit the workspace into a client-owned instant-tab surface for Overview, Records, Sessions, QR Codes, Devices, Exceptions, and Reports.
- Tab switching now uses local state plus `window.history.replaceState()` through `src/lib/attendance/tabs.ts`; routine tab changes do not call router navigation/refresh, route links, or redirects.
- Kept all tab panels mounted so filters, selected QR, selected QR format, activation link, and dialogs survive tab switches.
- Removed Attendance KPI-card rows.
- Rebuilt Overview around live staff status, recent scan activity, active service sessions, exceptions requiring attention, and compact quick actions.
- Rebuilt QR Codes around a compact selectable QR list, selected branded preview, reusable print layouts, PNG/SVG/print/copy helpers, QR information, generation actions, and deactivate QR.
- Made Records, Sessions, Devices, Exceptions, and Reports compact operational tab workspaces while preserving the existing backend paths.
- Converted Attendance server actions to typed `AttendanceActionResult` returns instead of redirect/status-query flows, removing the `NEXT_REDIRECT` symptom.
- Fixed Attendance sidebar icon by switching to supported `ClipboardCheck`.

**Database:**
- Applied the migration to the linked Supabase project with `supabase db query --linked --file`.
- Reran it after grant tightening.
- Verified live tables, columns, RPC, SELECT-only authenticated grants on readable tables, no authenticated grant on `device_activation_tokens`, and service-role mutation authority.
- `pg_cron` is not installed, so automatic due-session completion was not scheduled.

---

## What's Next

1. Run authenticated browser QA for `/crm/attendance`.
2. Create a device activation link, activate a test device, then scan attendance and room/resource QR codes from that device.
3. Verify blocked flows: unknown device, revoked device, wrong branch, duplicate scan, and active-service clock-out block.
4. Decide whether to enable/install `pg_cron` or trigger `complete_due_service_sessions` from app/server infrastructure.
5. Fix `npm run db:types`; the current script uses removed Supabase CLI `--project-ref`.
6. Reconcile migration history if the team needs `supabase db push` to understand the applied migration.

---

## Watch Out For

- The worktree is very dirty from prior tasks; do not revert unrelated CRM/schedule/payment/auth changes.
- Migration was applied with `db query --file`, not a successful `db push`.
- Fresh linked type generation showed unrelated live schema drift, so `src/types/supabase.ts` was restored from baseline and manually augmented for attendance.
- Two zero-byte `_tmp_14412_*` files remain because scoped `Remove-Item -LiteralPath` returned Access denied.
- Lint passes with four unrelated existing warnings in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`.
- FK follow-up: Attendance QR creation previously failed under dev bypass because the action used zero UUID branch `00000000-0000-0000-0000-000000000000`. `src/lib/dev-bypass-server.ts` now resolves dev bypass to a real active branch, and Attendance inserts validate branch existence first.
- Browser smoke on the existing local dev server reaches `/login` from unauthenticated `/crm/attendance`; login renders content and no Next/Vite overlay is present. Authenticated UI QA still needs a valid CRM session.

---

## Files That Matter Right Now

| File | Why It Matters |
|------|----------------|
| `supabase/migrations/20260702075213_attendance_qr_system.sql` | Attendance QR schema, grants, RLS, RPC, optional cron block |
| `src/app/(dashboard)/crm/attendance/page.tsx` | Protected CRM Attendance page loader |
| `src/app/(dashboard)/crm/attendance/actions.ts` | CRM Attendance server actions |
| `src/app/scan/actions.ts` | Public scan/activation server actions |
| `src/app/scan/[publicCode]/page.tsx` | Public QR scan route |
| `src/app/scan/activate/[token]/page.tsx` | One-time device activation route |
| `src/components/features/attendance/attendance-workspace.tsx` | CRM Attendance UI |
| `src/components/features/attendance/attendance-header.tsx` | Compact Attendance page header/actions |
| `src/components/features/attendance/attendance-tabs.tsx` | Local instant-tab controls |
| `src/components/features/attendance/overview/*` | Overview live staff/scans/sessions/exceptions/quick actions |
| `src/components/features/attendance/records/attendance-records-tab.tsx` | Attendance Records tab |
| `src/components/features/attendance/sessions/service-sessions-tab.tsx` | Service Sessions tab |
| `src/components/features/attendance/devices/registered-devices-tab.tsx` | Registered Devices / activation tab |
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
