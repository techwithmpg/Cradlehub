# 🤝 HANDOFF — CRM Schedule Edit Availability Modal

## What Was Done

Built a centered, in-place Edit Availability modal for CRM schedule workflows.

The modal now opens from:
- `/crm/schedule` Daily Timeline right-side staff details panel
- `/crm/schedule?tab=staff` Staff Schedule list

CRM stays on the Schedule page; the action no longer redirects to `/crm/staff-availability`.

## Files Changed

| File | What changed |
|------|-------------|
| `src/components/shared/overlays/admin-dialog.tsx` | Added `placement="center"` support while keeping top placement as the default. |
| `src/components/features/crm/schedule/*` | Added focused modal, header, summary, weekly table, override tab, block-time tab, footer, types, and utils. |
| `src/lib/actions/crm-schedule-availability.ts` | Added CRM weekly availability save action with auth, branch scope, Zod validation, `staff_schedules` upsert, and revalidation. |
| `src/app/(dashboard)/crm/schedule/page.tsx` | Loads staff availability data alongside daily schedule data. |
| `src/components/features/schedule/workspace/schedule-workspace-shell.tsx` | Passes availability data into Daily Timeline and Staff Schedule tabs. |
| `src/components/features/schedule/tabs/daily-timeline-tab.tsx` | Passes availability data into the schedule workspace. |
| `src/components/features/schedule/schedule-workspace.tsx` | Owns selected availability staff state, opens modal, refreshes after save, shows success toast. |
| `src/components/features/schedule/crm-schedule-details-panel.tsx` | Replaced Edit Availability navigation link with modal trigger button. |
| `src/components/features/schedule/tabs/staff-schedule-tab.tsx` | Passes branch context and SWR refresh callback into the staff schedule client. |
| `src/components/features/staff-schedule/staff-schedule-page-client.tsx` | Replaced side sheet with the centralized centered modal. |
| `src/components/features/staff-schedule/schedule-setup-workspace.tsx` | Supplies branch context to the reused staff schedule client. |
| `src/app/(dashboard)/manager/staff/actions.ts` | Added CRM/manager schedule revalidation for existing schedule, override, and block-time actions. |

## Behavior Notes

- Weekly Hours uses a direct editable table for Sunday through Saturday.
- Break column is intentionally omitted because the existing weekly schedule schema/data model has no break field.
- Day Overrides and Block Time reuse the existing manager/staff schedule actions; no new schema or business rules were added.
- Unsaved weekly/form changes are protected with `ConfirmUnsavedChangesDialog`.
- Save closes the modal after successful weekly-hours save and refreshes schedule data.
- Day override and block-time add/remove actions keep the modal open and refresh schedule data.

## Verification

`pnpm type-check` ✅

`pnpm lint` ✅  
Known warnings remain in `scripts/generate-service-image-assets.mjs` for unused script variables.

`pnpm build` ✅  
Next.js build completed successfully, 89/89 routes generated.

## Browser Verification

Attempted:
- `http://localhost:3000/crm/schedule`
- `http://localhost:3000/crm/schedule?tab=staff`

Both redirected to `/login` in the currently running local dev server. Full authenticated click-through verification still needs a valid local session.

## Remaining Notes

- No database schema changes.
- No RBAC/auth changes.
- No new dependencies.
- Public booking wizard was not touched.
