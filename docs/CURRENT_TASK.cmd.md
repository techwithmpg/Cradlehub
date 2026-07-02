# 🎯 CURRENT TASK — What Is Being Worked On RIGHT NOW

> **Rule: Before starting work, write your task here.**
> **Rule: When done, clear the "Active Task" and move details to CHANGELOG.**
> **Rule: Only ONE active task at a time. Finish or document why you stopped.**

---

## Active Task

| Field            | Value                                            |
|------------------|--------------------------------------------------|
| **Task ID**      | `ATTENDANCE-REFIT-005` |
| **Description**  | Refit the CRM Attendance workspace UI/actions while preserving existing Attendance QR, scan, device, service-session, and Supabase logic |
| **Agent**        | Codex                                           |
| **Started**      | 2026-07-02                                      |
| **Status**       | `BLOCKED`                                      |
| **Branch**       | `main`                                          |
| **Blocked By**   | Authenticated CRM/browser Attendance QA remains pending because the local browser session redirects to `/login` |

---

## Task Status Values

| Status        | Meaning                                                |
|---------------|--------------------------------------------------------|
| `IDLE`        | No work in progress                                    |
| `IN_PROGRESS` | Agent is actively working                              |
| `BLOCKED`     | Cannot proceed — reason documented in "Blocked By"     |
| `REVIEW`      | Work done, needs verification (`pnpm build && lint`)   |
| `DONE`        | Verified complete — ready to move to CHANGELOG         |
| `ABANDONED`   | Stopped mid-task — reason in notes, picked up later    |

---

## Notes

ATTENDANCE-REFIT-005 status:

- Refit `/crm/attendance` into one client-owned workspace with local state tabs for Overview, Records, Sessions, QR Codes, Devices, Exceptions, and Reports.
- Tab changes now use `window.history.replaceState()` through shared helpers instead of Next router navigation/refresh or route links.
- Removed KPI-card rows and rebuilt Overview around live staff status, recent scans, active service sessions, exceptions, and compact quick actions.
- Rebuilt QR Codes around a compact selectable QR list, branded preview, reusable print layouts, SVG/PNG/print/copy helpers, QR info, generation actions, and deactivate flow.
- Records, Sessions, Devices, Exceptions, and Reports now render compact operational tables/filters/dialogs while preserving the existing data/action paths.
- Attendance server actions now return typed `AttendanceActionResult` values instead of redirecting to status query params, preventing `NEXT_REDIRECT` surfacing in the UI.
- Fixed CRM Attendance sidebar icon by changing the nav icon to supported `ClipboardCheck`.
- Validation passed: `npx tsc --noEmit --pretty false`, targeted Attendance Vitest helpers, `npm run lint` (4 unrelated existing warnings), `npm run build`, and full `npm test -- --run` outside sandbox (60 files / 564 tests).
- Browser smoke reached the existing local dev server; unauthenticated `/crm/attendance` redirects to `/login`, login renders, and no Next/Vite error overlay is present.
- Authenticated CRM/browser QA for tabs, actions, activation, and scan flows remains pending.
- Final pnpm continuation completed: `pnpm type-check` PASS, `pnpm lint` PASS with 0 warnings, `pnpm test` PASS (60 files / 564 tests), and `pnpm build` PASS (104 app routes).
- The four prior lint warnings were fixed in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`; no eslint suppressions, `any`, or `@ts-ignore` were used.
- Browser visual QA at 1440, 1280, 1024, 768, and 375 px is still blocked by login redirect because no authenticated Supabase CRM/front-desk browser session is available. Blocker screenshots are in `.codex-artifacts/attendance-qr-qa/`.
- Phone scan verification and QR identity preservation checks remain pending until authenticated export/print flows can be exercised.

---

## Previously Active (Quick Reference)

| Task ID | Description | Outcome | Date |
|---------|-------------|---------|------|
| `PHASE-4` | Offline resilience (useNetworkStatus, OfflineBanner, action guards) | ✅ Done | 2026-05-15 |
| `PHASE-5` | Production observability (structured logger, business events, console cleanup) | ✅ Done | 2026-05-15 |
