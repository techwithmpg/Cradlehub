# CradleHub Web — Customer SMS Foundation Handoff (2026-11-08)

## Stage and authorization

- Target: Web repo techwithmpg/Cradlehub. Desktop out of scope.
- Owner authorized implementation after approving three transactional SMS events using Twilio.
- Isolated branch: stage/customer-sms-foundation-20261108.
- Verified accepted main baseline SHA: c263ebf835339948d0e4d47f368eb527e1d51313.
- Web remains CONTROLLED STABILIZATION. Boutique B1 branch remains untouched, unmerged and parked rather than discarded; this is an isolated SMS slice.
- No merge, deployment, live Twilio contact, database SQL execution, migration replay or Vercel Cron activation.

## Implementation and source of truth

| Event | Authority | Trigger |
| --- | --- | --- |
| Confirmation | booking_events and current bookings | Recent recorded transition into confirmed (including initial confirmed booking) |
| Morning batch | bookings.booking_date (Asia/Manila) | Today after 08:00, before noon, at least two hours before appointment |
| One hour | bookings booked start | 60–50 minutes before visit, only if unstarted and eligible |

- Group order_id service lines into one organizer contact/visit. Fail closed if any line is pending, cancelled, started or inconsistent in customer, branch or date.
- Contact and phone come from customers; branch and service names come from branches and services. Do not promise an unverified driver ETA for Home Service.
- Philippine numbers only at this stage; foreign/invalid destinations are skipped without guessing.
- Consent is required from customer_sms_preferences with matching normalized phone, recorded opt-in and no opt-out. An existing phone number does not imply consent.
- Unique delivery claim before the Twilio POST; an unknown provider outcome is never automatically retried.
- No message body or phone number stored in booking_sms_messages; delivery state fetched by authenticated Twilio Messages GET instead of public callbacks.
- Authenticated GET /api/customer-sms/dispatch requires CRON_SECRET and CRADLE_SMS_ENABLED=true, returns counts without customer information.
- Existing vercel.json intentionally unchanged and no outbound sending activated.

## Files changed

- src/lib/sms/policy.ts
- src/lib/sms/policy.test.ts
- src/lib/sms/twilio-provider.ts
- src/lib/sms/dispatch.ts
- src/app/api/customer-sms/dispatch/route.ts
- supabase/operations/customer-sms-foundation-DRAFT.sql (NOT a migration; DO NOT execute in production)
- Related review handoff and stage governance changes.

## Required environment values — not configured

- CRADLE_SMS_ENABLED=false until owner release approval.
- CRADLE_SMS_LAUNCH_AT: valid ISO timestamp at release, to block historical backfill.
- CRADLE_SMS_DAILY_CAP: integer 1 through 500.
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID: server only, using a registered Philippine alphanumeric sender.
- CRON_SECRET: strict Bearer authorization on the dispatch endpoint.
- Official Philippines sender and compliance guidelines: https://www.twilio.com/en-us/guidelines/ph/sms

## Verification evidence

- Connected GitHub reads resolved accepted main SHA and inspected booking-events audit trigger, booking-group schema, public booking, customer phone, statuses and Vercel schedule.
- Authored and committed isolated branch source.
- Executable source-policy smoke check: 9/9 checks passed (PH phone, foreign rejection, invalid date, morning eligibility, one-hour eligibility, late suppression, confirmation, grouped dedupe, home-service message).
- Wrote Vitest regression tests, but Vitest was NOT RUN.
- Full repository checks (pnpm type-check, pnpm lint, pnpm format:check, pnpm test -- --run and pnpm build) NOT RUN: GitHub clone network unavailable in the present container and project dependencies unavailable.
- Isolated Supabase/Postgres, actual browser, Vercel plan, full booking submission, CRM auth, real device, carrier delivery and production state NOT VERIFIED.
- Verdict: CORRECTION REQUIRED / NOT MERGE-READY.

## Remaining release gates

1. Explicit SMS opt-in and opt-out capture in public booking and authorized CRM scheduled/phone/home-service forms, including server-side consent provenance. No anonymous customer-consent mutation endpoint.
2. Review consent and ledger SQL, then generate a NEW forward-only migration via authorized Supabase CLI workflow. Verify in a classified LOCAL/TEST database, including RLS/grants, concurrency and rollback. No bulk migration history replay.
3. Generate schema types, type-check, lint, format, Vitest, build; add processor integration tests with mocked Twilio including parallel cron calls, cancellation/reschedule races, and uncertain provider responses.
4. Confirm Vercel project plan and cron execution limits. Register suitable scheduler only with owner release authorization; confirm CRON_SECRET and daily SMS cost caps.
5. Add compact authorized CRM/Owner delivery visibility and a way to resolve failed/unknown statuses without creating another notification page.
6. Register Philippine sender, verify compliant SMS templates and delivery, test each of the three events across both branches and Home Service on isolated TEST data.
7. Independent review, correction, owner approval, then controlled merge/deployment and activation.

## Safety and limitations

- Morning bulk reminders are one-to-one transactional SMS, not a marketing broadcast. Promotional mass messaging is deferred.
- Confirmation lookback is two hours; downtime longer than this may miss a confirmation. No historical backfill.
- One-hour reminder is suppressed if more than ten minutes late; no automatic resend for provider outcome uncertainty.
- Database and provider credentials must never be exposed in client code.
- Existing workstreams, accepted main, historical migrations, existing notifications, booking/payment/attendance and deployed production are unchanged.

## Rollback

Disable CRADLE_SMS_ENABLED, suspend only the SMS schedule (if later approved), revoke sender credentials if necessary and retain the ledger for audit. No history deletion or forced main changes.
