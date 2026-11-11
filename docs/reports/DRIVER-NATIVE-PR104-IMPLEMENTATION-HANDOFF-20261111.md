# CradleHub Driver PWA + Native Navigation — PR #104 Review Handoff
**Date:** 2026-11-11  
**Repository:** `techwithmpg/Cradlehub` (Web/Driver PWA and in-repository Android companion)  
**Stage:** Owner-authorized isolated driver integration / review, **not** a Web stabilization release or Desktop stage  
**Branch:** `stage/driver-native-seamless-pwa-20261111`  
**Verified base:** `d0b7db0f413d1fc79bfcd1de0121155c13ac679f`  
**PR:** https://github.com/techwithmpg/Cradlehub/pull/104  
**Recommendation:** **CORRECTION REQUIRED; DRAFT REVIEW ONLY**

## Purpose / design
Preserve all accepted `main` functionality and the latest workspace/PWA performance commit. Reuse the existing Android Google Navigation SDK foundation rather than create a second driver app or new navigation engine. Expose exactly **Trips / QR Scanner / Navigation / More** using the shared Staff PWA bottom nav. Avoid tutorials, KPI cards, duplicate Web maps, and second start buttons in the normal native flow.

## Repository-verified implementation
1. Canonical driver nav updated in `src/components/features/staff-portal/driver/driver-mobile-bottom-nav.tsx`; the existing Staff scanner at `/staff/scan` is reused.
2. Driver trip rows, primary trip and existing actionable alerts now hand off directly to `/staff/driver/map?bookingId=<uuid>&launch=native`. The Android WebView intercepts the authorized same-origin path and opens existing `NativeNavigationActivity`; ordinary browsers retain their prior route page fallback.
3. Native itinerary GET at `src/app/api/staff/driver/native-itinerary/route.ts` permits one confirmed/currently assigned, GPS-reviewed stop in either ready or travelling state. **The GET does not start travel or modify booking, service, attendance or payment state.**
4. `NativeNavigationActivity` now displays the route before guidance and exposes exactly one **Start Navigation** action. Its POST to `/api/staff/driver/native-start` calls the already existing server-side booking progress operation and locked database RPC. Revalidation also occurs for an already-started trip.
5. The Google SDK arrival callback detects native arrival and stops local guidance at the final stop, but **does not yet perform server-authorized arrival**, start a therapist service, dispatch pickups, or guarantee notification delivery.
6. Existing Web `/staff/driver/map` preview and existing manual trip progress fallback are preserved for browser users because there is not yet a verified native replacement for every lifecycle state.
7. Existing performance-critical global workspace components, shared CRM/Owner/Staff code, SQL migrations, RLS, secrets, build dependencies and payments are untouched.
8. The unrelated timestamp-sensitive driver-routing test was stabilized by freezing its scheduling clock to the fixture date, retaining the existing appointment-priority policy.

## CI and evidence
At original PR SHA `6afc9ba87a0415efcf3affbb262d094809d8305e`, GitHub Actions `43036994032` passed Web type-check, targeted Vitest/ESLint, and Android `:app:assembleDebug` **in CI**. The other workflow `43036993964` failed one pre-existing, time-dependent route-order test because a hard-coded November 10 fixture had elapsed. A narrow test-only correction was committed subsequently. **Latest-head CI must be consulted separately; earlier passes do not certify later commits.**

No authenticated browser journey, physical Android device, native GPS/voice guidance, QR scan, real push, TEST database lifecycle, Google API key/billing, deep-link restore or performance before/after measurement was executed or verified by this review. No production deployment or live booking mutation was performed or claimed. Repository statements about past production outcomes are **REPOSITORY-RECORDED PRODUCTION EVIDENCE**, not fresh verification.

## Outstanding P0/P1 correctness and release blockers
- **P0 booking integrity:** GPS arrival is still a client-side observation. Need a trusted server-authorized, idempotent arrival policy with accuracy/stability checks, driver/branch/trip ownership, race handling and isolated TEST database verification before removing the manual browser fallback.
- **P1 multi-stop dispatch:** Existing server-side Routes traffic-aware matrix can order up to eight drives in a read-only combined Web route; native itinerary still supplies **one current stop**. Real trip sequencing must distinguish therapist pickup from drop-off, boarding/occupancy constraints, shift, appointment commitments, completed stops, late services and authorized assignment changes.
- **P1 service & pickup:** Therapist's existing `Start Service` remains sole service-start authority. No native countdown/pickup readiness/within-shift alert has been delivered in this PR. Shift-ended therapists requiring transport need explicit CRM dispatch exception behavior.
- **P1 native notification:** Firebase receiver exists but the staff-bound registration/sender lifecycle, dismissal/acknowledgment across devices, permission-denied and offline semantics are not production-verified.
- **P1 platform lifecycle:** Android app package ID, Firebase config, Google SDK key/billing/licensing, WebView sign-in/OAuth, native navigation resumption, interrupted activities and real-device route/voice/background behavior need separate acceptance.
- **Performance:** No measured pre/post browser/Android performance results. No claim of improved, unchanged or production-grade performance.

## Review procedure / decision
Compare PR #104 against verified current `main`; inspect all changed files, route/browser fallback, new POST authorization and Android lifecycle. Run repository CI/targeted tests; then, only on an authorized isolated TEST environment, test CRM assignment → Driver native open → Start → GPS arrival → staff starts service → shift-aware pickup → next stop. Use fake/approved TEST bookings only. Measure cold/warm transition and CRM booking/payment performance before approval. Obtain independent reviewer PASS and owner approval; then a distinct release gate before any merge or deployment.

**Rollback:** Keep draft PR unmerged or close it. No production data, schema or migrations were changed.
