# ATTENDANCE-UX-001 — QA Runbook

> **Historical QA record (superseded 2026-07-22):** This matrix describes the
> earlier three-area prototype. Current release QA targets **Today, Review,
> History, Setup** and is recorded in `ATTENDANCE-PRODUCTION-AUDIT-20260722.md`.
> Do not treat the legacy Fix a Scan / Tools & History URLs below as the current
> production acceptance contract.

## Automated gates

Run from the repository root:

```text
pnpm type-check
pnpm lint
pnpm test
pnpm build
git diff --check
```

Focused coverage:

```text
pnpm test -- --run \
  tests/lib/attendance/workspace-navigation.test.ts \
  tests/lib/attendance/issue-presenter.test.ts \
  tests/lib/attendance/staff-diagnostics.test.ts \
  tests/lib/attendance/attendance-ux-preservation.test.ts \
  tests/components/attendance/attendance-primary-tabs.test.tsx \
  tests/components/attendance/attendance-today.test.tsx \
  tests/components/attendance/attendance-fix-scan.test.tsx
```

The preservation contract checks that all existing tool components remain
reachable, only one scoped Realtime channel is created, and no
`router.refresh()` was added.

## Authenticated CRM browser matrix

### 1. Normal day

1. Open `/crm/attendance`; confirm `?view=today` becomes canonical.
2. Confirm the four cards agree with the live roster.
3. Search a working staff member and open View.
4. Verify Attendance state, schedule, phone, recent scan, and actions.
5. Close the Sheet with its button and Escape; focus must return safely.

### 2. Phone not connected

1. Open a staff row showing Phone not connected, then Fix Now.
2. Verify the four connection steps and plain-language explanation.
3. Use Copy Instructions and confirm the success toast.
4. Use Connect Phone; Staff Phones must select the same staff member.
5. Complete the existing connection/recovery-link flow on a valid staff phone.

### 3. Disconnected/replacement phone

1. Select a staff member whose underlying device status is `revoked`.
2. Verify visible wording says Previous phone was disconnected.
3. Choose Connect Replacement Phone and complete the existing recovery flow.
4. Confirm the selected row changes through local state/Realtime without a full page reload.

### 4. Wrong branch

1. Open a `wrong_branch` item from Fix a Scan.
2. Verify assigned branch, scanned branch, scan time, and schedule state.
3. Open advanced recovery and choose Approve Temporary Assignment or Transfer Permanently.
4. Verify the audit reason is required and the result says to scan again.
5. Confirm the original expired scan is not described as automatically resumable.

### 5. Missing schedule

1. Open a `missing_schedule`/schedule-missing staff member.
2. Choose Open Staff Schedule; verify staff ID and business date in the URL.
3. Confirm no schedule is created until CRM explicitly saves a shift.

### 6. Stale and duplicate scans

1. For a stale open record, confirm original clock-in, expected shift, and recovery state.
2. Use Review Previous Record or the existing safe close/reset workflow.
3. For a duplicate scan, confirm latest scan and configured retry interval.
4. Confirm no second Attendance record is created.

### 7. Tools & History

Open each card and exercise its existing functions:

- Attendance History: filters, record detail, correction history, export.
- Service Sessions: active/completed session controls.
- Staff Phones: connect, replace, rename, disconnect, pending links, audit data.
- QR Codes: generate, preview, activate/deactivate, PNG/SVG/PDF/ZIP/A4.
- Reports: existing summaries, exceptions, filters, exports, and date logic.

### 8. Deep links and browser history

Open each URL directly and confirm the canonical destination:

```text
?tab=overview
?tab=records
?tab=sessions
?tab=qr-codes
?tab=devices
?tab=review-queue
?tab=reports
```

Then move Today → Fix a Scan → Tools & History → QR Codes. Use browser Back
and Forward through every step and verify the selected area/tool follows the URL.

### 9. Responsive and accessibility

1. Test desktop, tablet, and a 390px mobile viewport with no page overflow.
2. Use Tab and Arrow keys through primary tabs and filters.
3. Confirm hidden panels cannot receive focus.
4. Confirm status meaning remains clear with color disabled.
5. Confirm Sheet focus trap, close control, Escape, and focus return.
6. Enable reduced motion and confirm no required information depends on animation.

## Release evidence record

Record the date, branch, CRM account role, browser/device, fixture staff/issues,
screenshots, automated gate counts, production build route count, and any
environmental blocker. Do not use live corrective actions without an approved
test fixture and rollback plan.
