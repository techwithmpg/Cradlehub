# CURRENT TASK: Import 2026 spa day-off and opening schedule rules

## Status
PASS 1 COMPLETE — name matching UI live, awaiting manager review before import

## Task ID
schedule-import-2026

## Description
The spa's 2026 paper schedule (day-offs + opening duty) has been encoded as structured data
and wired to the Schedule Setup Center. Pass 1 (name matching review) is live.
Pass 2 (apply import) is available once the manager confirms name matches.

## What was done
- `src/lib/schedule/manual-schedule-2026.ts` — all schedule data already encoded (pre-existing)
- `src/components/features/staff-schedule/manual-schedule-import.tsx` — full interactive UI
  with preview → name matching → apply flow (pre-existing)
- `src/app/(dashboard)/crm/staff-availability/actions.ts` — `applyManualScheduleImportAction`
  server action with idempotent upsert (pre-existing, fixed unused `ApplyImportInput` type)
- `src/app/(dashboard)/crm/staff-availability/page.tsx` — **NEW**: wired `ManualScheduleImport`
  into the Schedule Setup Center page (previously not rendered)

## How to complete Pass 2
1. Open CradleHub → CRM → Schedule Setup Center
2. Expand "Current Manual Schedule Setup"
3. Go to "Name Matching" tab — review matched/ambiguous/unmatched names
4. Resolve ambiguous names using the dropdown selectors
5. Skip any names that don't exist in the branch yet
6. Go to "Times & Apply" tab — confirm shift times
7. Click "Apply Schedule"

## Schedule data summary
- Day-Off (regular): Mon–Fri rules for ~45 names
- Salon Day-Off: 6 names across Mon/Tue/Thu/Fri/Sun
- Opening Duty: 7-day rules for ~18 names
- Source: MANUAL_DAY_OFF_2026, MANUAL_SALON_DAY_OFF_2026, MANUAL_OPENING_2026

## Agent
Codex (E:/cradlehub)
