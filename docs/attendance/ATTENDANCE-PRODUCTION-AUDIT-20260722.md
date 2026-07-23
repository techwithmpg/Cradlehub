# Production Attendance Audit — 2026-07-22

- Task: `ATTENDANCE-PRODUCTION-AUDIT-20260722`
- Branch: `c1000000-0000-0000-0000-000000000001`
- Stored branch name: `Cradle Wellness living  Main Spa`
- Business timezone: `Asia/Manila`
- Business-day boundary: `06:00` Manila (`2026-07-21 22:00Z` through `2026-07-22 22:00Z`)
- Investigation time: approximately 22:41–23:10 Manila
- Production project ref: `lsrbwqhvzjfpiabeolkv`

## Executive result

The missing prompt table was recovered from the authenticated CRM Attendance
workspace. It contained 55 active, unarchived, unmerged Main Spa profiles. One
was conclusively a QA profile and has been backed up and marked non-operational,
leaving 54 production-monitoring profiles.

No Attendance record, scan event, exception, schedule, booking, device, payroll
row, or staff identity was invented, deleted, merged, or rewritten. The one live
repair changed only metadata on the exact QA staff profile after saving its full
original row.

| Metric | Before | Corrected local workspace against live data |
|---|---:|---:|
| Visible staff | 55 | 54 |
| Working | 1 | 2 |
| Not in yet, including late | 0 | 30 |
| Needs review staff | 29 | 2 |
| Checked out | 0 | 3 |
| Raw open exception rows | 81 | 81 (unchanged) |
| Canonical Review items | 43 | 36 |
| Attendance records for the day | 7 | 7 (unchanged) |
| Scan events for the business day | 15 | 15 (unchanged) |
| Corrections for the day | 0 | 0 |

The corrected code is local and production-build verified; it has not been
deployed by this audit. The narrowly bounded QA metadata repair was applied to
the linked production database and independently verified.

## Authoritative model traced

1. Operational staff begins with an active, unarchived, unmerged profile and
   excludes metadata-marked test/non-schedulable profiles.
2. Effective branch precedence is temporary approved access, duty assignment,
   approved cross-branch assignment, staff cross-branch authority, then home
   branch. Device metadata is not branch authority.
3. Schedule precedence is date override, then individual weekly schedule.
   Group schedule tables remain dormant and are not a runtime source.
4. Manila time and the configured 06:00 boundary determine the business date.
   Overnight end times roll into the following calendar date.
5. CRM opening-plus-closing coverage is one Attendance window: Opening start to
   Closing end. The scan intent and Today model now use the same shared helper.
6. A successful scan creates or closes `staff_shift_checkins` and stores the
   schedule/rule snapshot. The saved Attendance row is authoritative history.
7. Timing metrics such as late, early leave, and overtime remain visible but do
   not become repair incidents. Today uses only exceptions linked to the current
   business-day check-in/scan or detected inside its exact boundary.
8. The Review workspace remains the all-time open, actionable, deduplicated
   queue. Today staff status is not contaminated by that historical queue.
9. Active service sessions take operational precedence without fabricating a
   clock state. The CRM UI is a projection of these canonical inputs.

## Proven defects and fixes

| Defect | Evidence | Repair |
|---|---|---|
| Historical open exceptions leaked into Today | Staff with no July 22 incident were shown as Needs review | Scope Today exceptions by linked current check-in/scan or exact business boundary; bind Today incidents by exception ID |
| Legacy timing exceptions were actionable | Rows stored as `manual` carried `metadata.internalExceptionType=early_clock_in` | Resolve the effective subtype before timing/actionability/category logic |
| Scheduled no-shows became Not expected after shift end | 30 scheduled profiles had no scan but were hidden after their window ended | Keep a no-show Late after start plus grace through the business-day boundary |
| Open/close display disagreed with scan intent | Nikki Jumiller's valid 10:48 clock-in had a stored 10:00–01:30 snapshot while Today displayed only 17:00–01:30 | Share one opening-start/closing-end Attendance coverage helper |
| Confirmed QA profile polluted monitoring | `.test` auth email, test phone, zero check-ins/scans/bookings/services, two QA devices | Back up the exact row; mark it test and non-schedulable; filter monitoring to operational staff |

## July 22 Attendance and scan evidence

The seven saved Attendance rows are internally consistent with their linked
successful scans and stored schedule snapshots:

| Staff | Saved state | Clock in | Clock out | Diagnosis |
|---|---|---:|---:|---|
| Riza Tumbocon | Open | 10:03 | — | Working; historical exception was unrelated to July 22 |
| Janice Johannah L. San Juan | Completed | 10:04 | 19:37 | Valid; overtime 68 minutes is timing information |
| Renalyn Tiangson | Completed | 10:13 | 12:20 | Early leave 305 minutes; later 19:08 scan needs human review |
| Nikki Jumiller | Open | 10:48 | — | Valid against stored composite 10:00–01:30 open/close coverage |
| malcom patem | Open | 10:59 | — | Current ambiguous-scan exception; human review required |
| Nikki joy B. Villarias | Completed | 14:11 | 19:52 | Valid; early leave 27 minutes is timing information |
| Charilyn abellar | Completed | 14:52 | 22:19 | Valid; overtime 20 minutes is timing information |

The 15 business-day scan events comprise: Riza in; Janice in/out; Renalyn
Tiangson in/out plus a later captured `already_checked_out` attempt; Nikki
Jumiller device registration plus in; malcom in with `ambiguous_scan`; Nikki
Villarias in/out; Charilyn in/out; and two blocked unknown-phone attempts. The
blocked unknown-phone attempts remain one deduplicated current incident. No
scan proves that Renalyn worked after 12:20, so no Attendance row was reopened or
created for her 19:08 attempt.

There are no July 22 correction rows. A missing scan is therefore represented
only as a derived Late state; it is not converted into fictional Attendance.

## Staff-by-staff disposition

Status below is the corrected July 22 result at approximately 23:07 Manila.
`Late` means scheduled, start plus grace elapsed, and no authoritative clock-in.

| Staff | Correct status | Diagnosis / next action |
|---|---|---|
| Adjeva Villahermosa Selda | Late | Code-only post-shift no-show correction; no Attendance mutation |
| Benjie valiente pabon | Not expected today | Day off; historical exception removed from Today |
| Charilyn abellar | Checked out | Completed row; timing-only overtime is not Review |
| Chenny Pancho | Not expected today | Day off; historical exception removed from Today |
| Codex QA Work Queue (`c336a150…`) | Excluded | Confirmed QA; backed up and marked test/non-schedulable |
| Danica rose R. Buscado | Late | Historical exception removed; scheduled no-show remains Late |
| Daniel Depaloma | Late | Code-only post-shift no-show correction |
| Dante Depaloma | Late | Code-only post-shift no-show correction |
| Divina Batislaon (`db0b1c53…`) | Not expected today | No schedule/activity; possible identity duplicate needs human confirmation |
| Divina TUPAS Batisla _ on (`1d2646ac…`) | Not expected today | Day off; conflicting auth/role with similar profile, no auto-merge |
| Frannie Lorecho | Late | Historical exception removed; scheduled no-show remains Late |
| Grovy Crypto | Late | Scheduled no-show; possible demo identity requires owner confirmation |
| Janet Dela Cruz | Not expected today | No schedule or Attendance activity |
| Janice Johannah L. San Juan | Checked out | Completed row; timing-only overtime is not Review |
| Johnny Air /Gwanmesia patem malcom | Late | Code-only post-shift no-show correction |
| Lordelyn Bacalangco | Not expected today | No schedule; historical exception removed from Today |
| Lorraine Eslabra | Not expected today | Day off; no Attendance activity |
| Louela Molina Romero (`b7578287…`) | Late | Scheduled no-show; duplicate identity needs human confirmation |
| Louela Molina Romero (`e2f93144…`) | Not expected today | No schedule; distinct auth account prevents auto-merge |
| Lyn Me N Tan (`8f8825bb…`) | Not expected today | Day off; duplicate identity/email typo needs human confirmation |
| Lyn Me N. Tan (`f313b467…`) | Not expected today | Day off; duplicate identity/email typo needs human confirmation |
| Ma. Mayrose B. Apostol | Late | Historical exception removed; scheduled no-show remains Late |
| Ma. Theresa Dela Cruz | Late | Historical exception removed; scheduled no-show remains Late |
| malcom patem | Needs review | Current ambiguous scan linked to open Attendance; human decision |
| Marenelle A. Semillano | Late | Historical exception removed; scheduled no-show remains Late |
| Maricar Gisselle Castro | Late | Historical exception removed; scheduled no-show remains Late |
| Marjoery A Magada (`ec0fde95…`) | Late | Active identity has attendance/device history; similar profile needs confirmation |
| Marjoery Alfaro Magada (`1c0a5538…`) | Late | Similar name and near-match phone; no auto-merge or deactivation |
| Marjorie Ortiz | Not expected today | Day off; historical exception removed from Today |
| Mary Jane Billones | Late | Historical exception removed; scheduled no-show remains Late |
| Mary Joy Dela Torre | Not expected today | No schedule; historical exception removed from Today |
| Meck Tan | Not expected today | Day off; no Attendance activity |
| Melrose Barot Sioco | Late | Historical exception removed; scheduled no-show remains Late |
| Melrose delina | Late | Historical exception removed; scheduled no-show remains Late |
| Mica A. Rull | Late | Historical exception removed; scheduled no-show remains Late |
| Michaella Panolino | Not expected today | Day off; historical exception removed from Today |
| Michelle G. Duqueza | Not expected today | No schedule or Attendance activity |
| Minorka Sedoriosa | Not expected today | Day off; no Attendance activity |
| Nikki joy B. Villarias | Checked out | Completed row; timing-only early leave is not Review |
| Nikki joy O. Billones | Late | Code-only post-shift no-show correction |
| Nikki Jumiller | Working | Valid 10:48 clock-in; display corrected to 10:00–01:30 |
| Owner Full Name | Not expected today | Bootstrap-looking owner profile; owner confirmation before any cleanup |
| Queen Rose Granada | Late | Code-only post-shift no-show correction |
| Renalyn M. Juanillo (`cd1b2b93…`) | Late | Same normalized phone/name as another profile; no auto-merge |
| Renalyn M. Juanillo (`48e0917a…`) | Late | Auth/device/Attendance-bearing profile; human identity confirmation required |
| Renalyn Tiangson | Needs review | Saved completed row plus later `already_checked_out` scan; do not invent work |
| Reynante Jacinto | Late | Code-only post-shift no-show correction |
| Richelle Magbanua | Late | Code-only post-shift no-show correction |
| Riza Tumbocon | Working | Valid open Attendance; historical exception removed from Today |
| Rodah Mae Borja | Late | Historical exception removed; scheduled no-show remains Late |
| Ronita dela Rosa | Late | Historical exception removed; scheduled no-show remains Late |
| Sheila Mae Cariño | Late | Historical exception removed; scheduled no-show remains Late |
| Shiela P. Caburnay | Late | Historical exception removed; scheduled no-show remains Late |
| Vibilyn Antojado (`a893c5d9…`) | Late | Same name/phone as another profile; no auto-merge |
| Vibilyn Antojado (`c38e36e8…`) | Late | Auth/device/Attendance-bearing profile; human identity confirmation required |

## Duplicate, demo, and identity review

No identity repair was automatic. Candidate pairs/groups are Marjoery A
Magada/Marjoery Alfaro Magada, both Divina profiles, both Louela profiles, both
Lyn profiles, both Renalyn M. Juanillo profiles, and both Vibilyn Antojado
profiles. Similar names alone are insufficient. Several candidates have distinct
auth accounts, roles, services, schedules, or history; all foreign-key movement
requires an operator-approved merge plan and its own backup.

`Grovy Crypto` and `Owner Full Name` look demo/bootstrap-like but are not proven
test records. They remain untouched. Only `Codex QA Work Queue` met the strict
test standard.

## Production repair, backup, and rollback

Applied live change:

- Staff ID: `c336a150-015d-467d-a400-b90cd8b21d76`
- Metadata added: `is_test=true`, `test=true`, `is_schedulable=false`,
  `non_schedulable=true`, and the audit task marker.
- Verification: `staff_is_operational(...) = false`; exactly one profile has the
  task marker; exactly one backup exists.

Backup location:

- Table: `public.schedule_repair_backups`
- Source: `staff`
- Source PK: `c336a150-015d-467d-a400-b90cd8b21d76`
- Reason: `attendance_20260722_confirmed_qa_profile_before_metadata_repair`
- Contents: complete original staff row plus exact auth email, verification time,
  zero-activity counts, and preserved device-row count.

Rollback is in
`supabase/diagnostics/20260722_qa_profile_metadata_rollback.sql`. It refuses to
run if the exact backup or staff row is absent and restores only the prior
metadata. It was not executed.

Because the repository has significant pre-existing migration drift (preflight:
118 local files, 35 remote versions, 88 local-only and 5 remote-only), no broad
`db push` was attempted. The isolated idempotent migration SQL was applied
directly after a forced-rollback dry run; its migration file remains safe to run
later through an explicitly reconciled deployment process.

## Validation

- Read-only production diagnostic completed with an explicit read-only
  transaction and rollback.
- Migration dry run completed inside a forced rollback before live execution.
- Targeted Attendance tests: 45 passed.
- Full suite: 176 files, 1,253 tests passed.
- TypeScript: passed.
- ESLint on all touched TypeScript/test files: passed.
- Next.js 16.2.4 production build: passed, 113 static pages generated.
- Authenticated local CRM render against live data: 54/54 staff, `2 / 30 / 2 / 3`
  summary, Review `36`, Nikki `10:00 AM–1:30 AM`, QA row absent.

## Remaining human actions

1. Decide malcom's ambiguous scan from its linked scan/check-in evidence.
2. Confirm whether Renalyn Tiangson intended to work again after her 12:20
   clock-out; the 19:08 attempt alone cannot create Attendance.
3. Resolve the unknown-phone incident through device registration, not an
   Attendance fabrication.
4. Confirm each duplicate identity group before any merge/deactivation.
5. Confirm whether `Grovy Crypto` and `Owner Full Name` are legitimate production
   profiles.
6. Reconcile migration history before any broad Supabase migration deployment.
