# Current Task

## 2026-05-01 — STAFF-005: My Week Mobile Accordion + Day-Card Refinement

### Objective
Improve the staff portal `My Week` page mobile behavior and exact day-card UI:
- Mobile-first single-column accordion list (no 7-column board on phone)
- Compact/sticky mobile header + week navigation controls
- Compact mobile stats strip (`Total`, `Home`, `In-Spa`, `Hours`)
- Accessible accordion rows with clear labels and `aria-expanded`
- Today highlighted and expanded by default (with fallback behavior)
- Compact appointment items with time, customer, service, booking type, status
- Empty-day compact behavior with clean expanded empty state
- Keep desktop 7-day planner board intact and polished

### Scope
- `src/app/(dashboard)/staff-portal/week/page.tsx`
- `src/components/features/staff-portal/*my-week*`
- `src/components/features/staff-portal/*week*`
- `src/lib/staff-portal/week.ts` (and helpers if needed)

### Validation
- `pnpm type-check`
- `pnpm lint`
- `pnpm build`
- `pnpm test`

### Status
Completed.

### Completion Notes
- Mobile My Week now renders as a single-column accessible accordion with compact tappable day rows.
- Today highlighting/default expansion logic implemented with fallback to next day containing appointments.
- Compact mobile stats strip and sticky compact header/week navigation implemented.
- Appointment rows now include booking type and status badges without overloading content.
- Desktop 7-day board behavior preserved.
