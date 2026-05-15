# Production Observability Plan

**Phase:** 5 — Production Observability
**Status:** Implemented
**Date:** 2026-05-15

---

## What Was Done

### A. Structured Logger (`src/lib/logger.ts`)

Replaced ad-hoc `console.*` calls with a single structured logger:

| Export | Level | Use |
|---|---|---|
| `logInfo` | `info` | Informational milestones |
| `logWarn` | `warn` | Non-fatal degraded conditions |
| `logError` | `error` | Exceptions and database errors |
| `logBusinessEvent` | `event` | Immutable domain audit trail |

All output is newline-delimited JSON: `{ level, message, ...context, timestamp }`. This format is parseable by Vercel log drain, Datadog, or any JSON log aggregator without additional transformation.

**Rules:**
- No PII (no email, phone, full_name in log context)
- No tokens or secrets
- Stack traces only in `NODE_ENV=development`
- No per-request noise for expected paths (e.g. unauthenticated redirects)

### B. Booking Workflow Logging

Business events emitted for all booking mutations:

| Event | File |
|---|---|
| `booking.online.submitted` | `src/lib/actions/online-booking.ts` |
| `booking.crm.created` | `src/lib/actions/inhouse-booking.ts` |
| `booking.walkin.created` | `src/app/(dashboard)/manager/walkin/actions.ts` |
| `booking.status.changed` | `src/app/(dashboard)/manager/bookings/actions.ts` |
| `staff_progress.updated` | `src/app/(dashboard)/staff-portal/actions.ts` |

### C. Staff & Onboarding Logging

| Event | File |
|---|---|
| `staff.onboarding.submitted` | `src/app/staff-onboarding/actions.ts` |
| `staff.onboarding.approved` | `src/app/staff-onboarding/actions.ts` |
| `staff.onboarding.rejected` | `src/app/staff-onboarding/actions.ts` |

### D. Settings & Config Logging

| Event | File |
|---|---|
| `branch.created` / `branch.updated` / `branch.toggled` | `src/app/(dashboard)/owner/branches/actions.ts` |
| `branch_service.*` (added, removed, price/eligibility/visibility) | `src/app/(dashboard)/owner/branches/actions.ts` |
| `scheduling.rules_updated` | `src/app/(dashboard)/manager/scheduling/actions.ts` |
| `scheduling.suggestion_approved` / `rejected` | `src/app/(dashboard)/manager/scheduling/actions.ts` |

### E. Notification & Dispatch Observability

All `console.*` calls in the notification layer replaced with structured `logError`:

- `src/lib/notifications/create.ts`
- `src/lib/notifications/workflow-signals.ts`
- `src/lib/notifications/workflow-notifications-store.ts`
- `src/lib/notifications/workflow-task-store.ts`
- `src/lib/notifications/queries.ts`
- `src/lib/notifications/workflow-queries.ts`

### F. Error Boundary Audit

All error boundaries assessed for safe production logging:

- `src/app/error.tsx` — Fixed: now guards `console.error` behind `NODE_ENV=development`, logs `error.digest` comment for correlation with Next.js server-side error logs
- Workspace error boundaries (`crm`, `manager`, `owner`, `staff-portal`) — already dev-only guarded, no change needed

**Gap:** Client-side error boundaries cannot reach production log drains without a dedicated error-tracking SDK (e.g. Sentry). `error.digest` from Next.js correlates the client boundary with server logs. **Recommendation:** Integrate Sentry or Vercel Log Drain SDK in a future phase.

### G. Vercel Speed Insights

`<SpeedInsights />` from `@vercel/speed-insights/next` was already present in `src/app/layout.tsx`. No change needed. Web Vitals are captured automatically in production.

### I. Console.* Cleanup

Remaining raw `console.*` calls replaced or guarded:

| File | Change |
|---|---|
| `src/proxy.ts` | `logError` for DB errors; removed noisy redirect logs |
| `src/app/(auth)/login/actions.ts` | `logError` (removed PII email field) |
| `src/lib/queries/staff-context.ts` | `logError` |
| `src/app/api/booking/available-slots/route.ts` | `logError` |
| `src/components/features/services/service-card.tsx` | dev-only guard |
| `src/components/features/services/service-status-toggle.tsx` | dev-only guard |

---

## What Was Intentionally Excluded

| Item | Reason |
|---|---|
| Payment logging | Payment audit is handled by `booking_payment_logs` (append-only DB table); no server action logging needed |
| Auth event logging | Supabase Auth captures all sign-in/sign-out events natively; double-logging adds noise |
| Per-request slot query logs | Would be extremely noisy; errors are now logged via `logError` |
| RLS failure logging | RLS errors surface as Postgres errors and are captured by `logError` at the action layer |
| New paid packages | No new packages installed (Sentry, Datadog, etc.) |

---

## Existing Audit Infrastructure (Not Changed)

| Layer | Mechanism |
|---|---|
| Booking mutations | `booking_events` table (immutable, trigger-driven, row-level) |
| Payment mutations | `booking_payment_logs` table (append-only) |
| Auth events | Supabase Auth Logs |
| Web Vitals | Vercel Speed Insights |

---

## Recommended Next Steps (Future Phases)

1. **Error Tracking SDK** — Integrate Sentry (`@sentry/nextjs`) for client-side error capture, source maps, and alerting. Wire into error boundaries.
2. **Vercel Log Drain** — Connect a log drain to route structured JSON logs to Datadog, Axiom, or Logtail for search and alerting.
3. **Alert Rules** — Define alert thresholds on `booking.*.failed` and `proxy.staff_lookup_failed` event rates.
4. **Staff Update Logging** — Add `logBusinessEvent` to owner/manager staff update actions (`system_role` changes, `is_active` toggles).
5. **Payment Observability** — Add application-layer `logBusinessEvent` for payment mutations alongside the existing DB audit table.
