# Web customer SMS — consent/ledger review handoff (2026-11-12)

## Target, governance and evidence
- Target: Web only (techwithmpg/Cradlehub); Desktop untouched.
- Base accepted main: 4e32046cfff1970519217dcba004edceb8d24f09.
- Branch: stage/web-customer-sms-consent-20261112.
- Phase: SMS 1 (booking consent) and 2 (unapplied SQL candidate). Phases 3–5 remain gated.
- REPOSITORY-RECORDED PRODUCTION EVIDENCE: the existing Web SMS worker in merged main is gated; the repository vercel.json does not schedule customer SMS.
- LIVE read-only data: connected Supabase has no SMS tables. No SQL applied.

## Implementation
- Existing shared public/CRM booking wizard gains optional, initially unselected YES/NO appointment-SMS choice.
- Public-single, public-multi and CRM-multi booking input schemas accept only opt_in/opt_out when provided.
- Server-only post-success capture verifies the new booking, its customer and stored phone before inserting a visit-scoped preference.
- An explicit NO can revoke an existing visit opt-in; idempotent replay cannot silently restore opt-in.
- Dispatcher now requires the exact visit/customer/phone opt-in at candidate collection and immediately before sending, and also checks global opt-out.
- No separate customer-facing SMS settings page, no anonymous global customer-consent update, no browser credentials.
- Historical draft SQL preserved. New consolidated candidate and read-only structural checks added under supabase/operations and supabase/tests.

## Dependencies and release blockers
1. A canonical forward-only migration must be generated using installed Supabase CLI after isolated TEST review; never replay historic local-only migrations.
2. Isolated Postgres: run DDL, RLS/grants, SQL schema checks, unique ledger claims, opt-out races and booking/cancellation/reschedule behavior. All NOT RUN.
3. Regenerate Supabase schema types and remove temporary untyped SMS-table access.
4. Run full repository typecheck, targeted ESLint/format, Vitest and build. NOT RUN in this tool environment.
5. Exercise public and signed-in CRM booking flows in local/TEST browser; confirm all CSR entry paths, idempotency replays and group service lines. NOT VERIFIED.
6. The post-booking consent write is best-effort: booking success is not SMS subscription success. Before activation, verify failure/replay policy and atomicity expectations.
7. The NO choice is per-visit only. Global STOP for future bookings requires verified CSR/customer support handling; do not permit anonymous mutation of other customer records.
8. Add owner/CRM delivery visibility and tests for overlapping dispatcher runs, carrier uncertain outcomes, cancellations and reschedules. Stage 3 not yet completed.
9. Confirm paid Twilio account, registered Philippine alphanumeric sender, approved transactional templates, and practical opt-out procedure. No live sends.
10. Confirm Vercel cron cadence/plan and daily cap. Never activate by merging alone. Independent review and owner release authorization required.

## Status
CORRECTION REQUIRED — DO NOT MERGE, DEPLOY, EXECUTE SQL OR ENABLE MESSAGING.
No customer communications, production database writes, Vercel settings changes or merges were made.
Rollback: keep SMS disabled; revert unmerged Web branch if rejected. Retain historical data and migrations.

## Source boundaries
- Web booking status, payment, capacity, therapist and customer ownership remain controlled by existing server actions.
- Consent tied to visit key, booking ID, resolved customer ID and normalized Philippine contact.
- Unverified phone possession means public booking checkbox alone does not prove recipient ownership; confirm compliance before live rollout.