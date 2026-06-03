# HANDOFF - Staff full schedule calendar modal: COMPLETE

## Status

Build verified. The CRM schedule right-panel `View Full Schedule` action now opens a responsive in-page calendar modal instead of navigating away.

## What changed

### Server data loader

Added `src/app/(dashboard)/crm/schedule/actions.ts`.

- Loads the selected staff member with branch and role metadata.
- Enforces CRM/manager/owner/super-admin branch access before returning schedule data.
- Fetches staff schedules, schedule overrides, blocked times, assigned bookings, and matching staff-group schedule rules for the requested date window.
- Normalizes the payload into serializable typed data for the client modal.

### Calendar modal

Added `src/components/features/staff-schedule/staff-schedule-calendar-modal.tsx`.

- Premium calendar modal with staff summary, quick summary cards, date navigation, Today, Previous, Next, filters, and legend.
- Default view is Week, with Day and Month tabs.
- Week view is Monday through Sunday with a time rail and timed blocks.
- Renders individual staff schedules first, then falls back to group rules when no individual active schedule exists.
- Supports date overrides, day-off states, opening/closing/regular shifts, bookings, blocked time, and overnight ranges with next-day labeling.
- Uses existing modal/button primitives and Tailwind classes; inline styles are limited to dynamic timeline block positioning.

### Wiring

Changed `src/components/features/schedule/crm-schedule-details-panel.tsx`.

- Replaced the old schedule link with an `ActionButton` that opens the modal.
- Passes selected staff identity and schedule context into the modal.

Changed `src/components/features/schedule/schedule-workspace.tsx`.

- Passes the selected staff availability item and branch name into the details panel so the modal can combine daily row data with the richer availability data.

## Verification

- `npx tsc --noEmit --pretty false`: PASS
- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 pre-existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 89 routes
- `git diff --check`: PASS, with LF/CRLF working-copy warnings only
- Touched-file scan for `any`, `@ts-ignore`, and direct `console.`: PASS

## Browser note

The in-app browser reached `http://localhost:3000/crm/schedule`, but the route redirected to `http://localhost:3000/login`. Authenticated visual click-through of selecting a staff member and opening `View Full Schedule` still needs a local CRM/CSR session.
