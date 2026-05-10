# CURRENT TASK: PUB-001 — Hide Therapist Tier from Public Booking

## Overview
Removed internal staff tier labels (Junior/Mid/Senior) from the public booking wizard. Public customers now see customer-friendly role labels (Therapist, Nail Tech, Aesthetician / Facialist, etc.) based on `staff_type`. Internal tier sorting and auto-assignment logic remain unchanged.

## Exact Files Changed

### File edited:
- `src/components/public/booking-wizard.tsx`

## Behavior After Change
- Public booking wizard `StepTherapist` displays role labels instead of tier badges.
- Auto-assign helper text no longer mentions seniority.
- Internal `TIER_ORDER` sorting still drives auto-assign priority (Senior → Mid → Junior).
- Owner/Manager/CRM staff management pages, schedule views, and internal tier display are untouched.

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 71 app routes.

## Commit Message
```
fix(booking): hide therapist tier from public booking
```
