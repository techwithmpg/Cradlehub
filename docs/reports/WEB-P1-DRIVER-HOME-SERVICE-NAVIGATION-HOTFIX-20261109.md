# Web P1 — Home Service Driver Tap-to-Route Hotfix (review handoff)

## Governance
- **Target:** CradleHub Web Staff PWA and CRM booking/driver dispatch notification path.
- **Owner request:** Nov 9, 2026: after CRM confirms Home Service, alert the assigned driver; tapping notification opens live-route map inside installed Web PWA.
- **Stage/task:** Controlled Stabilization, P1 existing operational notification / navigation reliability correction.
- **Branch:** `fix/web-p1-driver-home-service-navigation-20261109`.
- **Verified branch creation base:** `36b74b185c425dcce5e98e1e9b0a5b0d25ca863c` (Web main at inspection).
- **Head:** See PR / GitHub branch head after final commit.
- **Current review disposition:** CORRECTION REQUIRED / DRAFT until CI, isolated TEST, authenticated device acceptance, independent review, and owner release authorization.
- **Scope containment:** No SQL migrations, no RLS or auth changes, no service secrets, no production DB writes, no Vercel deployment, no merge. Other active Web branches/PRs (including P1 booking operations) remain unmerged and untouched.

## Inspect / current behavior
**REPOSITORY-RECORDED PRODUCTION EVIDENCE (not actual device verification):**
- Canonical CRM booking confirmation is in `src/lib/bookings/crm-booking-operations.ts`; online order confirmation uses atomic RPC.
- Driver assignment is handled by `src/lib/home-service/dispatch-operations.ts`. It generated a driver notification on assignment, including pending bookings; CRM confirmation did not consistently emit a driver-specific notification if driver was preassigned.
- Existing `web_push_subscriptions` + `workspace_notifications` delivery system has server-side recipient/branch targeting and `/cradlehub-push-sw.js` root worker; `/staff/` uses a separate installation-only worker.
- `src/components/features/staff-pwa/driver/driver-native-map.tsx` is explicitly a placeholder with external map link.
- `getMyDriverJobByIdAction` server action revalidates current authenticated driver identity, current branch and assignment before returning sanitized booking route metadata.

**LIVE READ-ONLY SUPABASE INSPECTION (Nov 9, 2026):** 1 active CRM Web Push subscription and **0 active driver subscriptions**; 1 driver-target `home_service_assigned` notification in prior 14 days. This is a database count, not a successful phone push or route verification.

## Implemented on isolated branch
1. New server-only `notifyConfirmedHomeServiceDriver` reads *committed* confirmed Home Service booking/assigned active driver and emits immutable per-booking/driver notification, using existing notification store/dedupe. Invoked after CRM single-line and atomic online multi-line confirmations. Never alerts unassigned/pending booking and does not change booking on delivery failure.
2. Driver assignment notice only when booking status is confirmed/in-progress; CRM handoff/release and assignment route alerts use `/staff/driver/routes/{bookingId}`. Existing regular booking/driver cancellation surfaces untouched.
3. Existing shared staff notice policy resolves Home Service assigned notification directly to Staff PWA route. Web Push payload carries only notification type (no customer address or private GPS) to allow OS push even with an unrelated visible tab; clicking targets Staff PWA window rather than CRM tab.
4. Canonical Staff PWA home exposes existing opt-in browser push settings; user activation, provider VAPID and device permission remain required.
5. New authenticated route page and server-only Google Routes fetch: assigned driver and branch checked anew; verified destination read server-side; server-only key; route polyline/ETA/distance returned, GPS origin supplied by device (no DB location writes). Client uses existing `@vis.gl/react-google-maps` to render moving driver marker and road polyline. Route calculation is once on first GPS fix + manual refresh to limit billed API calls; external Maps remains fallback for voice guidance/turn-by-turn.
6. Targeted regression tests plus branch-only GitHub Action quality gate added.

## Changed files
- `src/lib/home-service/confirmed-driver-notification.ts` (new)
- `src/lib/bookings/crm-booking-operations.ts`
- `src/lib/home-service/dispatch-operations.ts`
- `src/lib/staff-pwa/notice-policy.ts`
- `src/lib/notifications/push/delivery.ts`
- `public/cradlehub-push-sw.js`
- `src/components/features/staff-pwa/driver/driver-native-home.tsx`
- `src/components/features/staff-pwa/driver/driver-live-route.tsx` (new)
- `src/app/(dashboard)/staff/driver/routes/actions.ts` (new)
- `src/app/(dashboard)/staff/driver/routes/[bookingId]/page.tsx` (new)
- `tests/lib/notifications/cradlehub-push-service-worker.test.ts`
- `tests/lib/home-service/confirmed-driver-notification.test.ts` (new)
- `.github/workflows/driver-home-service-hotfix-qa.yml` (new)
- This report.

## Required quality checks
On clean branch using Node 24 / pnpm 10.33.2:
- `pnpm install --frozen-lockfile`
- `pnpm type-check`
- `pnpm exec vitest run tests/lib/home-service/confirmed-driver-notification.test.ts tests/lib/notifications/cradlehub-push-service-worker.test.ts tests/lib/notifications/push-delivery-targeting.test.ts tests/lib/pwa/driver-wiring.test.ts tests/lib/pwa/driver-native-ui.test.tsx`
- `pnpm exec eslint` on all changed TS/TSX files
- Repository's relevant build and regression gates; `git diff --check`.
- Authenticated LOCAL/TEST booking scenarios: preassigned driver then CRM confirm, driver assigned after confirmation, online order atomic multi-line, repeat confirmations/duplicate notice, wrong branch/unassigned/reassigned/cancelled/completed/no location, persistent push with foreground CRM tab, no notification for other drivers.
- Android installed Staff PWA and iOS supported installed PWA: grant permission via explicit tap, verify push delivery in background, tap opens exact booking and route on correct device; denied/offline states, browser tab vs standalone app, driver current GPS vs saved destination, external voice-navigation fallback.
- Confirm Google Cloud Maps JS and Routes APIs enabled, separate referrer/browser and server-key restrictions; measure quota/latency before tuning/caching.
- Browser review at staff mobile viewport and CRM two-device acceptance. This was **NOT** performed in connector-only session; no physical device/browser claim.
- Test source state is not proof: independent reviewer must inspect diff and CI results; owner must explicitly authorize any deployment/merge.

## Production safety / limitations
- Existing booking status, payments, driver progress transitions, attendance, dispatch and RLS remain untouched. Driver location is used in browser and authorized route computation; not persisted.
- This is a **live route preview**, not Grab's full continuously rerouted voice turn-by-turn navigation. "Open in Maps" handles that behavior; switching modes requires user action.
- Operating system push is not guaranteed without driver enrollment. Browser/OS support, push delivery and PWA focus under real install context remain UNVERIFIED.
- The existing notification delivery is best-effort and non-transactional with booking commit. The new immutable dedupe prevents duplicate notification INSERT on retry, but it does not guarantee at-least-once delivery if provider fails.
- Push/deep-link cannot substitute for server-side access control; route page and action both re-check current booking assignments.

## Rollback
- **Before merge:** close PR / delete branch after review, with no production impact.
- **If later deployed:** revert hotfix commits via reviewed revert PR and redeploy previous accepted Web release; no schema rollback.
- Persisted notifications from deployed period are not removed by code rollback; existing route links on old notifications should remain safe (auth denies or missing page), and should be assessed before rollback.

## Nov 9 follow-up: Persistent PWA + combined multi-stop route (review-only)

**Owner change request**: Driver PWA must behave like a persistent dispatch workspace. Confirmed Home Service notification should open the in-app map; multiple confirmed assigned bookings should appear as one road route, nearest reachable stop first unless an imminent booked time or already-started trip takes precedence.

**Verified browser limitation (MDN):** A background service worker cannot consistently force a new browser/PWA window without user activation. Notification click opens the installed app on supported OS/browser; a foreground, visible driver PWA can navigate internally from a trusted push-worker message. Timers/GPS cannot be promised when the OS suspends a background PWA. No assertion of background turn-by-turn parity with a native Grab app.

### Additional implementation
- Canonical `/staff/driver/map?bookingId=<uuid>` route. Its server action first authorizes the signed-in driver and booking assignment before fetching active confirmed jobs for the correct booking date.
- Existing single-trip `/staff/driver/routes/[bookingId]` deep link safely redirects to the combined route after checking assignment, preserving compatibility; no second driver map created.
- Foreground driver shell listener reacts only to validated push-worker dispatch messages and navigates to canonical map. The push worker sends only to visible same-origin `/staff/driver` clients, still displays the OS notification, and does not attempt background auto-open. Existing unrelated notification behavior retained.
- Map refreshes authorized booking snapshots on visible/online/focus events and at a 20-second visible-only interval, clearing stale geometry after assignment/status changes. Current GPS marker updates while screen is active; route is recomputed on new assignments or after 500m movement with a minimum 90-second interval (manual refresh available).
- Server-side Google Routes Matrix computes driving durations between up to eight validated assigned stops. Greedy road-time nearest next stop, with an actively started trip locked first and urgent appointments prioritized. The resulting ordered stops become one multi-waypoint Google Routes polyline. If matrix unavailable, fallback is explicitly *schedule order*, never falsely labelled nearest. Invalid customer coordinates are excluded with a visible CRM correction warning. More than eight active stops remain visible in Trips and are reported as excluded from the current bounded route; no infinite costly API fanout.
- A visible-app **opt-in** Screen Wake Lock control can keep the navigation screen awake where supported. It cannot defeat OS background restrictions, low battery policies, denied permissions or force-launch behavior.
- Booking times and assignments are not modified, driver progress is not auto-started, CRM/attendance/payment remain untouched, no DB migrations.
- New pure ordering tests, authenticated route-action mock tests (unauthorized/unknown booking cannot call Google Routes), and push-service-worker foreground/background tests included.

### Test findings / release gates
- Initial combined-route workflow on this follow-up: TypeScript found a `Map` JSX/native collection naming collision; corrected in review branch.
- Subsequent workflow TypeScript passed but unit regression found that route-matrix indices were reordered before reading the matrix, resulting in incorrect first-stop sequencing. Corrected by preserving input index positions before ordering.
- **Latest complete quality-gate result must be obtained from the PR's newest head**. Earlier CI success on the prior single-stop branch does not certify the follow-up.
- The Next.js production build has previously failed in GitHub CI because the isolated runner had no Supabase URL during unrelated page prerendering. This is an **environment/build evidence blocker**, not proof that the live app builds or deploys. Configure isolated TEST Supabase public environment before treating any build as PASS; never use production secrets in public logs or bypass authorization.
- Required acceptance: 0/1/2/8/+8 stops, no route on pending booking, booking date context, nearest road order (not raw straight-line), in-route stop pinned, imminent appointment precedence, booking reschedule/reassignment/cancellation, bad GPS, network loss/reconnect, no replays of dismissed notices, no duplicate background app launches, opt-in push and Screen Wake Lock, actual Android/iOS installed PWA tests, Google billing limits/Maps config, live device GPS tracking behavior with real permission.
- **DRAFT / CORRECTION REQUIRED** until the exact newest CI run passes type-check, tests, ESLint, and an environment-qualified build; independent human review and owner release approval still required. No production deployment or DB write was made in this task.

### Additional rollback considerations
- Revert the new PWA wake/snapshot/multi-waypoint files and routing to the accepted previous Web release through an approved revert PR. Old push deep links should remain safe under server-side authorization. No SQL rollback needed.
