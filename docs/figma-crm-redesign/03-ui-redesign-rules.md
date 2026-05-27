# UI Redesign Rules

These rules are strict. The CRM redesign is presentation-layer work unless a real bug is discovered, documented, and explicitly approved for implementation.

## Do Not Change

- Booking logic
- Staff availability logic
- Check-in logic
- Schedule logic
- Dispatch logic
- Payment logic
- Supabase data model
- RBAC / permissions
- Existing workflows
- Route structure unless explicitly approved
- Server actions
- Database queries
- Supabase policies
- Public booking behavior
- Staff portal behavior

## Allowed

- New UI components
- Better layout
- Better spacing
- Drawers and side panels
- Compact tables
- KPI strips
- Tabs
- Status badges
- Empty states
- Responsive improvements
- Component extraction if it improves maintainability
- Better naming for visual sections
- Better visual hierarchy
- More consistent page headers and action rows
- More accessible controls and keyboard-friendly panels

## Redesign Principle

The redesign should make existing workflows easier to understand and operate. It should not create new operational rules.

## Figma AI Boundary

When using Figma AI:

- Do not invent new business processes.
- Do not remove existing page workflows.
- Do not add fictional automation.
- Do not change booking, payment, dispatch, schedule, or availability behavior.
- Do not assume data that the system does not currently show.
- Do not design destructive actions without an existing workflow and approval path.

## Implementation Boundary

When approved designs are implemented back into code:

- Preserve route paths.
- Preserve server-side data fetching.
- Preserve existing Server Actions.
- Preserve role guards.
- Preserve cache invalidation behavior.
- Preserve payment and booking audit behavior.
- Treat the design as a UI shell over current operational logic.

## Bug Exception

If the redesign process reveals a real bug, document it separately with:

- Where it appears
- Why it is a bug
- What workflow it affects
- Suggested fix
- Risk level

Do not silently fold bug fixes into a UI redesign.
