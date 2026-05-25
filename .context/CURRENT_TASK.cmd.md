# CURRENT TASK: HYDRATION-FIX-001

## Status
COMPLETE

## Task ID
HYDRATION-FIX-001

## Description
Fix hydration error: `In HTML, <a> cannot be a descendant of <a>` in
`crm-booking-queue-panel.tsx`.

BookingCard wraps in `<Link>` (renders as `<a>`). The home-service footer
"Map ↗" link was also an `<a>`, producing a nested-anchor HTML violation
and React hydration mismatch.

Fix: replaced the inner anchor with `<button type="button">` calling
`window.open()` with `noopener,noreferrer` — same UX, valid HTML.

## Files Changed
- `src/components/features/crm/today/crm-booking-queue-panel.tsx`

## Commit
25ac12f

## Agent
Claude Code (main branch, E:/cradlehub)

## Branch
main
