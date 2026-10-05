# P1 Home Service customer location correction handoff

**Verdict: CORRECTION REQUIRED before merge.** The repository correction is implemented and focused checks pass. The specific observed booking was not inspected through an authenticated session, and no LOCAL, TEST, or STAGING database was available for the requested mutating operational flow. This is repository evidence, not production certification.

## Authority and Git state

- Owner task: the 2026-10-06 P1 Home Service customer location brief. Boss Tour certification remains paused.
- Branch: `fix/p1-home-service-location-review`.
- Accepted `origin/main` merge base after fetch: `6a310021df66679d71daf753434e6c328e3181b4`.
- Starting branch SHA and implementation base: `7dc09d26573ddd2674a05bfad2e6cee842d09a69`, the previously pushed Front Desk refinement head. This fix branch includes those prior commits; review the P1 implementation at `55ae7171582e23e54b9e089d8b82d17d8c64e521` separately.
- The implementation commit changed 14 booking, Dispatch, legacy entry, and focused test files. No migration, Auth, RLS, payment, or customer profile files changed.
- Concurrent, unrelated edits to `src/app/(dashboard)/crm/dispatch/page.tsx` and `tests/components/dispatch/home-service-nav-cleanup.test.tsx` appeared after the clean starting state. They were excluded from the implementation commit and are not P1 evidence.

## Root cause and source of truth

The authoritative destination is `bookings.metadata.home_service_address` on each Home Service booking service line. The atomic CRM and online creators put the selected place in each line's metadata, which the order RPC copies to the booking rows. A customer can legitimately use a service address different from the saved profile; the profile is not the operational destination.

Four repository defects could produce the reported symptom:

1. CRM and online booking paths commonly saved `zone: "unknown"` even with a precise Google place. Dispatch displayed `zone` before the street address, so it could label a valid destination `unknown`. The dispatch conflict check also marked an unknown optional zone as `needs_location_review` despite coordinates.
2. The older manager walk-in action could create a Home Service booking without any destination fields. The older single-service online action guarded `type: home_service` but could accept `deliveryType: home_service` without a destination.
3. The general manager editor could convert an in-spa booking to Home Service without a destination.
4. CRM rescheduling accepted plain address text and preserved old coordinates, so an address edit could point travel to the previous location or fail to repair an existing booking with no coordinates.

The observed booking's actual stored metadata was **not** read. Its exact creation path and whether an address was originally entered remain unverified. No claim is made that one specific defect caused that individual record.

## Correction

- CRM and online multi-service creation continue to require selected place ID, formatted address, and finite in-range coordinates at the server boundary. Both now write that selected address as `full_address` on every Home Service line. In-spa bookings remain exempt.
- The legacy manager form routes Home Service selection to CRM Bookings; its server action rejects Home Service requests without a destination. The legacy online single action and general manager mode conversion reject destinationless Home Service paths.
- Dispatch resolves the booking's full or formatted service address before optional area text. `"unknown"` is not a destination. It flags an address or coordinate that is actually missing. A precise place no longer receives a location-review flag merely because its optional zone is unclassified.
- The existing CRM booking editor now uses the shared Places control. Its server action requires a complete selected place when changing or repairing the destination, replaces address and coordinates together, recalculates distance when the branch origin is available, clears stale ETA, and keeps the booked travel fee unchanged. If branch distance is unavailable, the destination can still be saved with an explicit fee-review warning. Address-only repair does not revalidate an unchanged therapist schedule.
- Dispatch's existing booking link says **View / Fix Booking** when destination data is missing. No duplicate Dispatch editor or customer profile write was added.

## Verification

- Focused booking, Dispatch conflict, CRM reschedule, atomic and public contracts: `pnpm exec vitest run --dir tests --maxWorkers 1 tests/lib/bookings/home-service-destination-contract.test.ts tests/lib/bookings/dispatch-conflict-location.test.ts tests/lib/bookings/reschedule-booking-service.test.ts tests/lib/bookings/inhouse-atomic-boundary.test.ts tests/lib/bookings/booking-simplification-safety.test.ts tests/lib/bookings/release-readiness-public-contract.test.ts` — **6 files, 36 tests passed**.
- Driver, tracking, desktop Home Service reads, and booking surfaces: `pnpm exec vitest run --dir tests --maxWorkers 1 tests/lib/home-service-tracking.test.ts tests/api/desktop-v1-home-service-reads.test.ts tests/lib/pwa/driver-dispatch-query.test.ts tests/components/bookings/home-service-driver-surfaces.test.tsx` — **4 files, 80 tests passed**.
- Distance fee plus destination and correction regression: `pnpm exec vitest run --dir tests --maxWorkers 1 tests/lib/home-service/distance-fee.test.ts tests/lib/bookings/reschedule-booking-service.test.ts tests/lib/bookings/home-service-destination-contract.test.ts` — **3 files, 27 tests passed**; this overlaps the first group and is not an additional unique-test total.
- `pnpm type-check` — passed on the final implementation.
- Targeted ESLint on the 14 implementation files — passed with 0 errors and 0 warnings after removing an unused import. Targeted Prettier `--check` on the same files — passed.
- `pnpm build` — passed twice, including a final repeat after the implementation commit with TypeScript and 151 static pages. The final repeat ran in the shared checkout while the unrelated navigation edits were present; those edits are not part of the P1 commit.
- `git diff --cached --check` — passed before the implementation commit.
- A broad test command accidentally matched an unrelated nested `.claude/worktrees` checkout and hit one failure there plus a worker startup timeout. The exact checkout rerun above passed. No nested checkout files were changed.

## Environment and release boundary

- Configured local Supabase target: **PRODUCTION**. No production booking, customer location, payment, schema, or migration was mutated. **RUNTIME MUTATION TEST BLOCKED — PRODUCTION SAFETY.**
- CRM and online creation were verified at schema/action contract and metadata tests, not by creating live bookings. In-spa regression passed at the schema boundary. Dispatch resolution passed in focused tests; the reported production booking was not read.
- The existing distance quote path is reused. Live ETA requires valid destination coordinates, a current driver or therapist location snapshot, and Routes API availability. No ETA was fabricated. Browser console and network requests were not verified because the local CRM browser route was inaccessible and no authenticated test session was available.
- The Start Travel → Arrived → Start Service → Complete flow was not exercised against a mutable safe environment. Repository inspection confirms the existing travel RPC requires a confirmed booking, therapist, driver, and valid destination coordinates, but this is not runtime proof.
- The desktop reschedule endpoint shares the corrected server contract. A separate desktop client that still sends only free-text Home Service address edits will receive a validation error until it sends a selected place and coordinates; desktop client UI behavior was not verified here.
- Production impact if later released: new Home Service bookings must carry precise per-booking destinations, and old bookings can be corrected through CRM. Historical bookings are not bulk-modified. Existing booked travel fees are preserved and may require manual review after an address correction.
- Rollback: revert the application implementation commit before release or via a reviewed follow-up after release. No database rollback is needed. Do not rewrite historical booking rows.
- Next permitted action: independent review and a positively classified LOCAL, TEST, or STAGING end-to-end booking and travel run. **No merge, deployment, or push to `main` is authorized by this handoff.**
