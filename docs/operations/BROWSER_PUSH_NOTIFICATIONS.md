# Browser Push Notifications

## Status and scope

`NOTIFICATIONS-001` adds opt-in browser push as a delivery channel over the
existing `public.workspace_notifications` history. The database migration is
committed but intentionally **not applied** by this implementation task:

`supabase/migrations/20260721174547_browser_push_notifications.sql`

The migration adds only delivery state (`web_push_subscriptions`) and an Owner
delivery preference (`notification_delivery_preferences`). It also adds the
existing history table to `supabase_realtime` idempotently. It does not create a
second notification feed or history.

## Delivery architecture

1. Booking workflows persist through the existing central notification store.
2. An authenticated Supabase Realtime subscription reconciles RLS-visible
   `workspace_notifications` INSERT/UPDATE events into the bell immediately.
3. One visible tab claims a new notification for its Sonner toast and optional
   chime. Cross-tab messages contain notification IDs only, never titles or
   bodies. A five-minute and visibility/reconnect reconciliation covers missed
   events without route refresh or minute polling.
4. Only the process that wins a durable notification insert calls the Web Push
   dispatcher. Dedupe updates do not resend push.
5. The dispatcher finds active eligible subscriptions, revalidates their current
   user/staff/role/branch assignment, sends a bounded payload, and records
   endpoint health. Every push result is best effort and outside the booking
   transaction.
6. `/cradlehub-push-sw.js` displays background notifications, focuses or opens a
   same-origin allowlisted workspace route, and asks a visible tab to reconcile
   instead of showing a duplicate operating-system card.

`workspace_notifications` remains the authoritative read/unread/resolved and
dedupe system. The bell queries and Realtime stream remain protected by its
existing RLS.

## Recipient rules

| Notification target | Browser-push recipient |
| --- | --- |
| CRM | Active CRM subscriptions in the exact notification branch |
| Staff | Exact active `recipient_staff_id`, current Staff role and branch |
| Driver | Exact active `recipient_staff_id`, current Driver role and branch |
| Utility | Exact active `recipient_staff_id`, current Utility role and branch |
| Owner | Active Owner devices; booking delivery follows the account preference |
| Manager | Not enrolled by this feature |

Owner booking preferences are `all`, `home_service_and_urgent` (default),
`urgent_only`, or `disabled`. Critical non-booking Owner signals are still
eligible unless Owner browser notifications are disabled at the subscription or
browser level.

Pending online bookings notify CRM only. An assigned therapist or driver becomes
eligible after payment confirmation. Later paid booking assignment, reassignment,
reschedule, and cancellation events target only the exact affected staff member.

## Deployment

Generate one VAPID key pair and store it in the deployment secret manager:

```powershell
pnpm exec web-push generate-vapid-keys
```

Configure:

```text
NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=<public key>
WEB_PUSH_VAPID_PRIVATE_KEY=<server-only private key>
WEB_PUSH_VAPID_SUBJECT=mailto:operations@example.com
```

The private key must never use a `NEXT_PUBLIC_` prefix, appear in browser logs,
or be copied into the service worker. The public key is embedded into the client
bundle, so changing the pair requires a deploy and users must re-enable their
subscription.

Deployment order:

1. Review and apply `20260721174547_browser_push_notifications.sql` through the
   normal approved Supabase migration process.
2. Verify both new tables have RLS enabled, `anon` has no table access, the
   authenticated grants/policies are present, active-recipient indexes exist,
   and `workspace_notifications` belongs to the `supabase_realtime` publication.
3. Configure all three VAPID values in every application environment.
4. Deploy the application and service worker over HTTPS.
5. Run the production QA matrix below before broad enrollment.

## Permission and privacy behavior

- The application never requests notification permission on page load.
- A user opens the bell's **Notification settings** and selects **Enable browser
  notifications** before the browser prompt is requested.
- A denied browser permission is shown as blocked; the application cannot bypass
  that browser/OS decision.
- Subscription endpoint and key material are stored server-side under own-row
  RLS. The browser cannot choose its user, role, staff ID, workspace, or branch;
  the authenticated API derives those values.
- Requests are same-origin, JSON bodies are size limited and schema validated,
  and service-worker clicks accept only allowlisted same-origin workspace paths.

## Production QA matrix

For each supported target browser/device combination:

1. Confirm no permission prompt appears during login, workspace navigation, or
   opening the bell.
2. Explicitly enable notifications and confirm exactly one active own-row
   subscription with the expected server-derived workspace/branch/staff values.
3. Use **Send test notification** and confirm the operating-system card opens the
   safe workspace route.
4. With one visible CRM tab, create a pending online booking. Confirm the CRM
   bell count updates immediately, one toast appears, the chime plays at most
   once when enabled, and no duplicate OS card appears.
5. Repeat with two tabs and confirm only one toast/chime claim while both bells
   reconcile.
6. Confirm a different branch cannot see or receive the notification.
7. Confirm assigned Staff and Driver receive nothing while payment is pending,
   then receive their exact assignment after payment confirmation.
8. Verify paid reassignment, reschedule, and cancellation target the old/new
   exact assignees as applicable.
9. Exercise every Owner preference and verify branch-spanning Owner delivery
   matches it.
10. Disable browser notifications and confirm the local subscription and stored
    row are inactive while in-app bell/Realtime delivery continues.
11. Simulate a push-provider failure and confirm the booking still succeeds and
    its durable in-app notification remains available.

## Failure handling and operations

- HTTP `404`/`410` permanently deactivates a subscription.
- Five consecutive send failures deactivate an endpoint. A later explicit enable
  upserts it as active and resets its failure state.
- Delivery is parallel and has no application retry queue. Provider failures are
  logged without endpoint/key material and do not change notification history or
  booking success.
- If VAPID configuration is absent or invalid, the settings API reports browser
  push as unconfigured and the UI does not request permission. In-app Realtime,
  bell, toast, and sound remain available.

To roll back browser push without rolling back in-app notifications, clear or
invalidate the three VAPID settings and redeploy. Existing rows may remain
inactive delivery state; do not delete or replace `workspace_notifications`.
