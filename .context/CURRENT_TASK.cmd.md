# 🎯 CURRENT TASK

| Field | Value |
|-------|-------|
| **Task ID** | `UI-002` |
| **Description** | `Redesign new service builder page with live preview` |
| **Agent** | `Kimi DevCoder` |
| **Status** | `COMPLETE` |

## Changes Summary

### New Service Builder Redesign
- Replaced two stacked plain forms with a premium service builder layout
- Left side: guided form sections, right side: live card preview (sticky)
- Form sections:
  1. Category — tabbed: use existing category (dropdown) or create new category (name + display order + create button)
  2. Service Details — name (required), description (textarea with improved placeholder)
  3. Pricing & Duration — duration, price, buffer before/after with helper text
  4. Visibility — active/inactive toggle with status description
  5. Service Image — placeholder area (upload coming soon)
- Live preview card updates in real-time as user types
- Preview uses same visual style as Services page cards
- Clear form errors (not generic)
- Cancel returns to /owner/services
- Create Service validates and submits via existing server actions
- Category creation integrated inline with success feedback
- isActive field added to createServiceSchema and createServiceAction

## Files Created
- `src/components/features/services/service-card-preview.tsx` — live preview card
- `src/app/(dashboard)/owner/services/new/service-builder-client.tsx` — client form builder

## Files Changed
- `src/app/(dashboard)/owner/services/new/page.tsx` — pure server wrapper
- `src/lib/validations/service.ts` — added `isActive` to `createServiceSchema`
- `src/app/(dashboard)/owner/services/actions.ts` — `createServiceAction` now passes `is_active`

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm build`: ✅ Passing (46 routes)
- `pnpm lint`: ⚠️ 5 pre-existing errors only
