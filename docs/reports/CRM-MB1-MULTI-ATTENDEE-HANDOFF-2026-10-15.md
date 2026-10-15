# CRM-MB1 multi-attendee booking handoff

## Authorization and Git state

- Owner authorization: CRM-MB1 brief attached to the 2026-10-15 task.
- Source branch and SHA: `stage/service-catalog-consolidation` at `0f01999c247dc0037e0716291ca5686eedfe34fd`.
- Isolated branch and starting HEAD: `stage/crm-multi-attendee-booking` at the same SHA.
- Reviewed implementation commit: `7cdb3a8eb3934ed820468e7cdb8cec2fa2defc39`.
- Scope: CRM Quick Booking attendee disclosure, input validation, server allocation, function-only forward migration, focused tests. No other booking UI or table structure was changed.

## Decisions and evidence

- The existing single-attendee payload and exact CRM therapist/room path remain the default. `+ Add guest` reveals attendee sections, each with the existing service selector. Guest 1 remains the organizer and customer; added guests receive no customer profile.
- Group bookings use the distinct-therapist `assignTherapistsForOrder` primitive. Services within each attendee run sequentially; attendee chains run concurrently. The order elapsed duration is the longest chain including buffers. Group rooms reserve capacity per attendee; the single manual room is cleared and unavailable for groups.
- The server reloads service availability, price, duration, buffers and branch offerings. Group payable total sums every line and adds the existing one-time Home Service fee. One atomic wrapper call persists attendees, lines and payment context. Group retries use an input fingerprint to return the existing order without duplicating lines; a changed payload with the same key is rejected.
- The forward migration changes only `create_inhouse_order_with_payment_atomic`: inserted rows are identified by attendee sequence plus attendee-local line sequence, returned IDs are ordered the same way, and each line can carry a resource ID with the existing order-level fallback. The prior payment and authority body was compared in a test. Existing service-role-only execution is retained.
- CRM Bookings and Today remain line-oriented operational displays. Existing order-aware financial summaries use `order_id`; a consolidated group card is a separate display follow-up, outside CRM-MB1.

## Verification

- `pnpm exec vitest run --exclude '**/.claude/**' tests/lib/bookings tests/lib/engine/resource-availability-strict.test.ts tests/lib/cash-flow/payment-writer-contract.test.ts tests/lib/cash-flow/payment-evidence.test.ts tests/lib/cash-flow/order-payment-eligibility.test.ts tests/lib/cash-flow/cf8c-review-corrections.test.ts tests/lib/cash-flow/cf8c-cash-operations-integrity.test.ts tests/lib/cash-flow/cf8-database-reconciliation.test.ts tests/lib/cash-flow/cash-payment-session-guard.test.ts tests/components/crm/quick-booking-customer-autocomplete.test.tsx tests/components/crm/quick-booking-deferred-options.test.tsx tests/lib/services/service-eligibility.test.ts` — 49 files, 339 tests passed.
- `pnpm exec eslint` on the nine changed TypeScript/TSX files — passed.
- `pnpm type-check` — passed after the local Next build regenerated stale type artifacts.
- `pnpm exec next build` with inert localhost Supabase variables — compiled and completed successfully.
- `git diff --check` — passed.
- Tests cover single-person preservation, two guests, repeated attendee-local line sequences, mixed concurrent/sequential times and buffers, distinct therapist assignments, room capacity, payment failure, branch authorization, idempotent replay and the wrapper's bounded SQL changes.

## Database and release gate

- Current `.env.local` Supabase host identifies the configured production project; no secrets are recorded here. No LOCAL/TEST Postgres listener was found on the standard local port.
- Table changes: none. Forward migration: `20261015105000_crm_mb1_attendee_line_resources.sql`, function-only.
- The migration was not applied to any database. No live transactional migration test or production verification was performed.
- Before release, classify a LOCAL or TEST target, apply this forward migration there, and verify actual atomic creation, room conflicts, payment rollback and replay. Then obtain independent review and the applicable owner gate. Production migration, merge, push, deployment and duration-extension work are not authorized by this handoff.

## Approved multi-attendee visual correction

- The owner supplied `Modern Spa Booking Modal with Compact Guest Sessions.png` as the canonical multi-attendee composition. The group mode now places customer search and selection above a single-row Guest Sessions tab strip, renders one active guest editor, then Date/Time/Therapist, payment and optional details above the fixed footer. The primary guest retains a read-only Guest name field tied to the organizer/customer identity.
- Guest pills share the row and shrink as more guests are added, with horizontal overflow as the fallback. The group summary rail shows customer, guest count, service cards grouped by guest, service total, therapist and room assignment per guest, and payment. The modal widens only in group mode; the single-attendee layout keeps its previous dimensions and controls.
- The booking payload, server allocation, atomic wrapper, and payment path were not changed by this visual correction. Focused CRM caller and component tests passed (3 files, 14 tests), as did type-check, targeted ESLint, and `git diff --check`. A local desktop fixture render was visually checked with CRM availability stubbed; no live database or booking submission was exercised.
