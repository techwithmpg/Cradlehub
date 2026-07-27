# Attendance maintenance mode

The intended mode pauses only Attendance writes. It does not remove Attendance, alter historical data, or disable booking and service operations.

> **Production blocker:** the application-layer implementation is complete, but the current database architecture also has four Supabase `pg_cron` jobs that call `public.process_due_attendance_closing_interventions` directly and booking/schedule triggers that call Attendance policy recalculation directly. These paths never reach Vercel and cannot read `ATTENDANCE_MAINTENANCE_MODE`. Do not treat the Vercel variable alone as a complete production freeze. No database migration or live database change was made because the implementation brief requires approval before database work.

## Before enabling

1. Confirm the release containing the maintenance guard is deployed and healthy.
2. Run the required Node 24 validation gates and review the final diff.
3. Create the external rollback bundle:

   ```powershell
   pwsh -File .\scripts\maintenance\attendance-maintenance.ps1 -Mode Backup
   ```

4. Confirm the front desk understands that arrivals and departures must be recorded temporarily through the agreed manual procedure. The manual record should include staff member, branch, arrival/departure, timestamp, and recorder.
5. Agree on the maintenance start time, owner, expected end time, and staff communication channel.
6. Confirm an approved database-level design or operational control prevents the four direct closing jobs and the direct booking/schedule Attendance recalculation triggers from writing during the window. Until this is verified, stop here.

## Enable in Vercel

In the Vercel project dashboard:

Only proceed after the database-native blocker above has been resolved and verified.

1. Open **Settings → Environment Variables**.
2. Add or update `ATTENDANCE_MAINTENANCE_MODE` for **Production** with the value `true`.
3. Keep the variable server-only. Do not create a `NEXT_PUBLIC_` copy.
4. Optionally set `ATTENDANCE_MAINTENANCE_TITLE` and `ATTENDANCE_MAINTENANCE_MESSAGE` for Production. Never put secrets or internal error details in this copy.
5. Save the environment variables.
6. Redeploy the current production release so the server receives the new value.

The exact required setting is:

```text
ATTENDANCE_MAINTENANCE_MODE=true
```

The PowerShell helper prints the same procedure and requires an explicit front-desk confirmation:

```powershell
pwsh -File .\scripts\maintenance\attendance-maintenance.ps1 -Mode EnableInstructions -FrontDeskConfirmed -DatabaseGuardVerified
```

The helper does not call Vercel, push Git, change a database, or deploy. `-DatabaseGuardVerified` is an operator attestation, not a database control.

## Live maintenance checklist

### CRM and owner

- Attendance remains in navigation and existing records, reports, incidents, audit history, schedules, and devices remain readable.
- The maintenance banner is visible.
- Correction, saved-scan resolution, Attendance confirmation, duplicate resolution, rebuild, device, recovery, approval, revocation, auto-close, and closing-policy write controls are unavailable.
- Refresh and Attendance history navigation still work.

### Staff

- An Attendance QR scan shows “Attendance is temporarily under maintenance.”
- The result says “Attendance changed: No” and directs the staff member to the front desk.
- The scan does not show a sign-in or phone connection form and does not ask the staff member to scan repeatedly.
- My Attendance history remains visible.
- The Attendance Phone profile section remains visible and read-only.

### Operations continuity

- A scheduled staff member without a live clock-in remains eligible when schedule, branch, service eligibility, leave/override, and conflict rules allow it.
- Real schedule conflicts, leave, branch restrictions, service eligibility, overlapping bookings, and active service conflicts remain enforced.
- Booking, Customers, Work Queue, Schedule, Home Service, Dispatch, payments, room/service QR progress, and service completion still operate.
- No fake clock-ins, automatic clock-outs, payroll changes, Attendance incidents, or device registrations are created for maintenance scans.
- The four direct Attendance closing jobs and direct booking/schedule Attendance recalculation triggers are verified not to write during the window.

## Restore normal Attendance

In **Vercel → Project → Settings → Environment Variables**:

1. Set the Production value to:

   ```text
   ATTENDANCE_MAINTENANCE_MODE=false
   ```

2. Save the value.
3. Redeploy the current production release.
4. Perform one controlled Attendance QR scan with an already registered test staff phone.
5. Confirm normal clock-in/clock-out behavior, device recognition, CRM visibility, and Attendance-aware availability have resumed.
6. Reconcile the front-desk manual log through the normal approved operational process. Do not bulk rewrite, reset, or fabricate Attendance records.

To print the restore steps without changing Vercel:

```powershell
pwsh -File .\scripts\maintenance\attendance-maintenance.ps1 -Mode DisableInstructions
```

## Rollback

The fastest operational rollback is setting `ATTENDANCE_MAINTENANCE_MODE=false` and redeploying Production. No source change or database migration is required.

If a separately approved database-native guard or operational pause was used, restore its normal state through its reviewed rollback procedure as well. The Vercel variable cannot restore a database-native control it does not own.

If the source implementation itself must be removed, use the external backup bundle created before rollout:

1. Stop and preserve any work made after the bundle was created.
2. Read `manifest.txt` and `ROLLBACK.md` in the bundle.
3. Reverse `attendance-maintenance.patch` only against the same reviewed source state.
4. Review the listed files that were new at backup time before removing them.
5. Run the full Node 24 validation gates again.
6. Do not modify Supabase migration history and do not run database reset, push, or migration repair commands.

The bundle also contains a ZIP of the pre-change tracked files from `HEAD` and a snapshot of the current changed files for manual recovery.
