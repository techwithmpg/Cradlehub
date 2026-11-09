# Web P1 Driver PWA: in-shell navigation, assigned alerts, and live CRM GPS

## Scope and governance
- **Target:** CradleHub Web; canonical installed Staff Driver PWA and existing CRM Home Service live map.
- **Owner report:** On 2026-11-09, the installed PWA's "Open in Maps" and "Start travel" still launch external Google Maps; tested assigned driver received no OS push or visible in-app booking alert; CRM needs accurate driver position/status during travel. Low-technical-skill driver workflow must be straightforward.
- **Base:** accepted Web `main` at `22e430eb41b4030a4047b13e7c61080350d441e9` (PR #95 was already merged).
- **Working branch:** `fix/web-p1-driver-pwa-single-shell-20261109`.
- **Head:** see this PR's current HEAD; no direct `main` modifications. Current disposition: **CORRECTION REQUIRED until CI, preview build, authenticated device/browser acceptance, independent reviewer and owner approval**.

## Observed facts
- **Verified Vercel deployment record:** Web production deployment `dpl_BQmvVtPKeiDgXUa1BKEJyfSmHJ9U` reports READY for `22e430eb`. This verifies deployed commit/build status only, **not** functioning customer navigation, mobile UI, push or GPS.
- **LIVE READ-ONLY DATABASE EVIDENCE (Nov 9):** `web_push_subscriptions` has **zero active driver** subscriptions, one active CRM subscription. New driver notice does exist as an unread `home_service_assigned` row for an assigned confirmed test booking. That booking belongs to a different driver staff profile from Danilo Depaloma Jr.; Danilo has zero new bookings/notices in the 24-hour comparison. Driver-specific RLS/recipient targeting must not be bypassed.
- **LIVE READ-ONLY DATABASE EVIDENCE:** zero `staff_location_snapshots` in previous 24 hours. Existing `sls_staff_insert_own` / `sls_staff_read_own` RLS and CRM branch-read policies are present; CRM's map already reads these snapshots. Database evidence does not establish the exact mobile failure or individual permissions.
- **REPOSITORY-RECORDED PRODUCTION EVIDENCE:** `DriverNativeDetail`, legacy `DriverJobDetailsPage`, `DriverStartTravelButton`, legacy map and combined route contained external Maps links or `window.location.assign`, while the combined route's `watchPosition` updated local marker but did not call the existing authorized `recordStaffLocationSnapshotAction`. Existing staff notice page was static server-rendered; push enrollment was hidden inside a settings dialog.
- **Vercel project configuration names only:** maps browser/server keys, VAPID public/private/subject, and Supabase public URLs are defined for production. Values were not retrieved, and configuration names alone do not prove keys work.

## Correction implementation
1. Canonical driver trip details: **View route in CradleHub** and server-authorized **Start travel** both route internally to `/staff/driver/map?bookingId=...`; old `/driver` and legacy map call paths also no longer force Maps when starting. Existing booking progress action and authorization remain server-side.
2. Combined driver map provides current in-app trip action (Start travel / Mark arrived) after the existing progress RPC succeeds; route display is an in-app Google Maps JS polyline. No new booking, payment, or attendance mutation.
3. Driver home gets visible **Enable trip alerts** once per phone with a direct user-gesture browser permission grant; uses the existing Web Push worker, VAPID key, subscription API and RLS/ownership. Driver sees readiness/errors and a current unread Home Service assignment alert even if phone push is not enabled, refreshed while visible and on reconnection. Opening the alert marks only that driver's notice read and routes into the PWA.
4. Existing `recordStaffLocationSnapshotAction` is reused through a new authenticated server guard which checks the driver still owns the booking, it is confirmed/active and its progress is **travel_started**, GPS accuracy at most 150m, and RLS-visible last location at least 20 seconds ago. Browser sends at most about once per 30 seconds when screen is visible. It never records the location before travel or after arrival, and never assumes local SQLite/cache authority.
5. Existing CRM dispatch query now refreshes while visible every 20 seconds and displays a **recent** GPS marker only when the latest stored snapshot is less than 2 minutes old. Older records are explicitly labelled *not live*. This is bounded polling of the existing authorized source of truth, not a new location database or privilege change.

## Changed files (review actual PR diff)
- `src/components/features/staff-pwa/driver/driver-native-detail.tsx`
- `src/components/features/staff-pwa/driver/driver-native-home.tsx`
- `src/components/features/staff-pwa/driver/driver-native-map.tsx`
- `src/components/features/staff-pwa/driver/driver-combined-dispatch-map.tsx`
- `src/components/features/staff-pwa/driver/driver-trip-alerts.tsx` (new)
- `src/components/features/staff-portal/driver/driver-job-details-page.tsx`
- `src/components/features/staff-portal/driver/map/driver-start-travel-button.tsx`
- `src/components/features/staff-portal/driver/map/driver-route-action-buttons.tsx`
- `src/app/(dashboard)/staff/driver/map/live-location-action.ts` (new)
- `src/app/(dashboard)/staff/driver/map/actions.ts`
- `src/app/(dashboard)/staff/driver/trip-alert-action.ts` (new)
- `src/components/features/dispatch/dispatch-live-map-tab.tsx`
- `src/components/features/dispatch/use-live-crm-dispatch-data.ts`
- targeted `tests/lib/pwa` and driver QA workflow
- this report

## Required validation / release gates
- GitHub Actions exact branch head: `pnpm type-check`, targeted Vitest (PWA navigation contract, GPS server guard, unread notice server filter, existing driver progress, combined-route and SW push tests), targeted ESLint, environment-qualified `pnpm build`. Historical GitHub Actions `next build` failed due missing `NEXT_PUBLIC_SUPABASE_URL` in isolated runner, unrelated to real Vercel env; this needs an explicit TEST-only build evidence path. Do not claim GitHub build PASS on missing env.
- Local/preview authenticated testing with staff and CRM sessions: assigned vs unassigned driver, same/new day, pending vs confirmed, late assignment, duplicate confirm, cancellation/reassignment, no GPS, stale GPS and inaccurate GPS, denied push, failure and offline reconnect. User click **Start travel** persists progress and opens internal map; **Mark arrived** stops server GPS posting; CRM accurately displays location age and status.
- Real installed Android/iOS Staff PWA end-to-end: explicit enable once, real targeted push from real test booking, tap push, map route inside standalone PWA, minimize/reopen, no silent forced background launch (browser OS restriction). Test Google Maps JS/Routes API and billing enabled/quotas, independent device GPS accuracy, CRM 2-session updates, route directions.
- **No DB migration, no RLS/Auth changes, no service secrets to client**, no production DB write, no production deploy, no merge. Backward-compat legacy navigation paths preserved, no deletion of uncertain old code.
- Limitations: Google Maps JS map + route line, not a replacement for full native background turn-by-turn spoken navigation. Browser GPS and screen wake only operate while PWA remains foreground. CRM should not display stale location as live.

## Rollback
- Before merge: close unmerged PR, leaving accepted Web main/production unaffected.
- After an authorized release: reviewed revert PR of these scoped changes and redeploy last accepted Web build; no schema rollback. Existing old notices and snapshots remain governed by current database policies; do not delete historical records as cleanup.
