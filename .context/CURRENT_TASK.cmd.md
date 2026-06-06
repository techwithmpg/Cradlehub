Task ID: PUBLIC-BOOKING-MOBILE-VIEWPORT-001
Description: Refine the public mobile booking wizard into a viewport-fitted app-like flow with mobile time-slot bottom sheet
Agent: Codex
Status: IN PROGRESS

Scope:
- Public `/book` mobile booking UX/layout only.
- Use a viewport-fitted mobile shell with compact header/progress, constrained internal step scrolling, and always-visible bottom actions.
- Make short steps fit with little or no body/page scrolling.
- Keep long steps internally scrollable inside the active content area.
- On mobile Date & Time, open a warm dark bottom sheet for available time slots after date selection.
- Preserve desktop booking layout where it already works.

Do not change:
- Booking logic, step order, validation, selection state semantics, submit payloads, available-slot API behavior, server actions, Supabase/database logic, public route behavior, protected workspaces, CRM/admin/staff/driver portals, or backend/API routes.

Primary files:
- `src/components/public/booking-wizard.tsx`
- `src/components/public/booking-service-picker.tsx`
- `src/components/public/places-autocomplete.tsx`
- `src/components/features/booking/therapist-picker/therapist-selection-step.tsx`
- `src/components/ui/calendar.tsx`

Required verification:
- `pnpm type-check`
- `pnpm lint`
- `pnpm build`

Notes:
- Required `.context/*`, `AGENTS.md`, docs equivalents, and local Next.js 16 docs were read before code edits.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent; docs equivalents were read where available.
- Existing uncommitted change present before this task: `.claude/settings.local.json`.
