# 🧾 HANDOFF — 2026-05-01 (CSR-002 Complete)

## What Was Delivered
- CSR operational CRM routes were implemented without creating a new workspace:
  - `/crm/today`
  - `/crm/bookings`
  - `/crm/customers`
  - `/crm/schedule`
  - `/crm` now redirects to `/crm/today`
- Existing in-house booking flow remains at `/crm/bookings/new`, now with optional customer prefill (`?customerId=...`).

## Key UX Changes
- **Today page** now acts as front-desk queue:
  - quick actions (new booking, search customer, view schedule)
  - daily stats
  - next appointment
  - booking queue
  - home-service queue
  - recent notes/updated customers
- **Bookings page** includes filters for date, status, type, therapist.
- **Customers page** supports:
  - fast search
  - quick customer create
  - edit contact details in customer profile
  - “Book again” deep-link into in-house wizard
- **Schedule page** is exposed in CRM path as availability view.

## Security / RBAC Notes
- No separate CSR workspace was created.
- Server-side permission enforcement remains authoritative for booking status changes:
  - CSR Staff cannot cancel/reassign
  - CSR Head can cancel (and reassign where action exists)
- Owner/manager flows remain intact.

## Main Files Touched
- `src/app/(dashboard)/crm/today/page.tsx`
- `src/app/(dashboard)/crm/bookings/page.tsx`
- `src/app/(dashboard)/crm/customers/page.tsx`
- `src/app/(dashboard)/crm/schedule/page.tsx`
- `src/app/(dashboard)/crm/page.tsx`
- `src/app/(dashboard)/crm/actions.ts`
- `src/app/(dashboard)/crm/[customerId]/page.tsx`
- `src/app/(dashboard)/crm/bookings/new/page.tsx`
- `src/components/public/booking-wizard.tsx`
- `src/components/features/dashboard/customer-create-form.tsx`
- `src/components/features/dashboard/customer-notes-form.tsx`
- `src/components/features/dashboard/nav-config.ts`
- `src/lib/queries/bookings.ts`
- `src/lib/validations/customer.ts`

## Validation
- `pnpm type-check` ✅
- `pnpm lint` ✅
- `pnpm build` ✅
- `pnpm test` ✅

## Suggested Manual QA
1. Log in as `csr_staff` and verify sidebar routes: Today, Bookings, Customers, Schedule only.
2. In `/crm/bookings`, confirm CSR Staff cannot cancel booking status.
3. In `/crm/bookings`, confirm CSR Head can cancel bookings.
4. In `/crm/customers`, create customer, open profile, edit contact details, then Book again.
5. In `/crm/bookings/new?customerId=...`, verify customer fields prefill.
