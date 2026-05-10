# HANDOFF — PUB-001 Hide Therapist Tier from Public Booking

## Date
2026-05-10

## Agent
Kimi

## Summary
Removed internal staff tier labels from the public booking wizard. Public customers now see customer-friendly role labels based on `staff_type` instead of Junior/Mid/Senior badges.

## Files Changed

### Edited:
- `src/components/public/booking-wizard.tsx`

## Behavior After Change
- `StepTherapist` renders role labels (Therapist, Nail Tech, Aesthetician / Facialist) instead of tier badges.
- Auto-assign helper text: "We'll assign an available qualified therapist for your selected service."
- Internal seniority sorting (`TIER_ORDER`) still drives auto-assign priority.
- Owner/Manager/CRM staff pages and schedule views are unaffected.

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 71 app routes.

## Remaining Notes / Future Improvements
- The `staff_type` lookup depends on `/api/public/booking-context` returning `staffType` for each staff member. If the API changes its response shape, the role-label fallback will degrade to "Therapist".
- Consider adding `staff_type` directly to the `get_available_slots` RPC return to avoid the client-side cross-reference.
