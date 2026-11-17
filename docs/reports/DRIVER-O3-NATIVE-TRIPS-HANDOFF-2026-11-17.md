# O3 native Android Trips handoff — 2026-11-17

## Authorization and baseline

The owner's attached O3 brief authorizes implementation of Drop-off / Pick-up inside the existing Kotlin/Compose Driver app, local build/tests and native emulator evidence. It explicitly stops before main merge, push, deployment, APK distribution or O4 integration. This supersedes earlier source-integration permission for this new slice.

- Repository: `https://github.com/techwithmpg/Cradlehub`, shared Web/Android repository.
- Worktree: `E:/cradlehub/.worktrees/driver-o3-trips-ui`.
- Branch: `stage/o3-native-driver-trips-ui-20261117`.
- Accepted base / fetched `origin/main`: `169f75400fdcfc9f5f7e41aa0cf2ebe981018392`.
- Accepted native implementation included in that base: `30218cde2f6795500e15272c164af68fe4753591`.
- Implementation head: `9483e963619074f149769c07279a94e43197ded1`. Evidence closeout is the subsequent local branch commit; resolve with `git rev-parse stage/o3-native-driver-trips-ui-20261117`.
- Exact changed files: [implementation manifest](driver-o3-trips-2026-11-17/implementation-files.txt), [complete change manifest](driver-o3-trips-2026-11-17/changed-files.txt).

## Implemented behavior

Trips has a forest/gold native brand header, cream segmented Drop-off / Pick-up controls, blue/green assignment summaries with counts derived from assigned vehicle journeys, and white therapist-focused cards. The cards show schedule, passenger count, origin/destination, travel estimate, authoritative progress and one Open Route action. Multiple explicit customer stops retain separate passenger/status rows and identify the next estimate target. There is no grouping by names, address or schedule heuristics.

The other four tabs and the raised Scan navigation remain. More → Trip History now opens the existing read-only history data in a native secondary view, preserving history access after removal of the three old Trips filters. Map only gains its required DROP-OFF / PICK-UP label, using current controller stage when available. No login, session storage, QR writer, attendance rule, booking authority, SDK version, route calculation destination list, Start/boarding/drop-off writer or arrival mechanism is replaced.

Open Route validates the presentation assignment's driver, mode, passenger membership, ordered next stop, coordinates and existing route authority, then calls the existing `selectTrip(bookingId)`. Map opens immediately. The server's itinerary still selects and validates its actual destination; presentation coordinates never override it. In-progress collection planning has no Open Route action. A previously authorized collection with unspecified service-readiness details remains available through existing server authority, with an explicit unavailable-readiness message.

## ETA and readiness truth

`TripsRoadEta` binds a road estimate to its booking, leg, target coordinates, read time and measured GPS fix. The existing Navigation SDK **8.1.0** supplies `Navigator.getCurrentTimeAndDistance()` through a read-only remaining-time/distance listener. Its methods were verified against the installed SDK AAR. The listener is removed on teardown; no new GPS subscription, HTTP route service, polling loop or arrival writer is added. The current location subscription starts under existing navigation behavior, so an unselected or unstarted route may have no usable GPS/ETA.

A displayable estimate requires GPS age 0–30 seconds, accuracy greater than zero and at most 50 m, estimate age 0–60 seconds, and exact booking/leg/target agreement. Stale/inaccurate GPS and expired route estimates are explicitly labeled. Distance is road-route distance. Missing values display **ETA unavailable**.

Time to Drop targets the next customer. A branch-only pickup leg is rejected as a full customer ETA. A complete plan must explicitly cover all remaining required stops through that customer before it can display a full estimate. Time to Pick targets the therapist collection point; a return-to-branch ETA is rejected. Production's single-active-leg DTO does not currently expose a complete branch→customer plan; no full drop estimate is fabricated for that case. A legacy delivery stage also does not confirm boarding: its direct customer estimate stays unavailable unless an explicit full route prefix or confirmed onboard state closes the missing-pickup gap.

Service deadline and travel estimate are separate values. Only explicit `COMPLETED` service readiness renders **Service completed · Ready for pickup**. A zero/late estimated deadline stays in progress. Missing participant deadlines do not predict all passengers ready. The current native DTO exposes `service_active`, but no authoritative deadline/completion event payload for collection cards; connected data therefore states service readiness unavailable where needed. No independent service timer/database is created.

The public SDK source used for the read-only API contract is [Google Navigation events](https://developers.google.com/maps/documentation/navigation/android-sdk/events) and [Navigator reference](https://developers.google.com/maps/documentation/navigation/android-sdk/reference/com/google/android/libraries/navigation/Navigator). These sources describe the API; they do not prove a connected route was exercised here.

## O4 dependencies, deliberately unimplemented

1. Dispatch must supply explicit stable vehicle-journey IDs, assigned driver per leg, participant IDs, ordered stop IDs/roles/booking linkage and accepted passenger boarding/drop-off events. Production snapshots currently represent one booking/therapist/active leg. Pooled/split/multi-stop presentation is verified with typed **debug-only synthetic fixtures**, not invented from production rows.
2. Dispatch/service contracts must expose actual collection requirement (`required`, `not_required`, `undecided`), authorized collection assignment, service-start/deadline and Complete Service events per therapist. No collection is created from service/shift end. Only existing collection/return legs become connected Pickup cards; independent departure never creates a fixture obligation.
3. Full route coverage through branch pickup and customer stops, per-assignment road estimates and fresh authorized GPS beyond the single selected route require integration. No straight-line estimate or service countdown substitutes for travel.
4. Connected service/push/CRM event acceptance remains unverified. Existing arrival/location machinery is preserved; GPS alone never confirms boarding or drop-off. No second notification/arrival system is introduced.
5. The previously observed Google native-key authorization failure is not resolved or re-tested as a live-navigation acceptance claim by this O3 UI stage. A usable approved connected target/key/device route remains necessary to verify actual one-Start guidance.

## Verification and actual native evidence

- Native Gradle tasks: `:app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug :app:compileReleaseKotlin :app:compileReleaseJavaWithJavac`; final results in [build log](driver-o3-trips-2026-11-17/build.txt) and [unit summary](driver-o3-trips-2026-11-17/unit-results.txt).
- LOCAL synthetic configuration: loopback `http://localhost:7100`, local-test + native-fixture flags, unconfigured backend, navigation key explicitly `LOCAL_TEST_NOT_CONFIGURED`. JBR 25.0.4, Gradle 9.6.0, existing AGP/Compose/SDK versions unchanged. Memory-bounded build uses one worker, 1536 MB JVM heap, two active processors and in-process Kotlin compilation.
- Native JVM: **64/64 pass (9 session + 31 existing native policies + 24 O3 policies)**. Existing Driver session/authorization/parser/compatibility coverage is retained alongside targeted ETA, GPS, readiness, ownership, conditional collection, passenger and ordered-stop tests.
- Native instrumentation: **10/10 pass on final APK after documented startup recovery**, [raw runner output](driver-o3-trips-2026-11-17/instrumentation.txt). LOCAL emulator `CradleDriverCompose`, `emulator-5580`, Android 17 / API 37, Google Play image, 864×1824 px, 352 dpi (about 393 dp wide), default 100% font. Separate manual 130% text rendering was inspected and its original 1.0 setting restored. Only the owned emulator was stopped afterward; physical phone installation was not changed.
- Existing focused Driver source/UI contract: **7/7 pass**, [output](driver-o3-trips-2026-11-17/native-contract.txt). Web source is unchanged. Full Web build/suite is not rerun for native-only O3.
- Lint: **0 errors / 30 warnings**, [full findings](driver-o3-trips-2026-11-17/lint.txt). Whitespace, touched-source scope and secret-pattern checks pass.
- Environment caveats: the first unconstrained build exhausted host memory; the bounded build passed. During manual capture Android **System UI** showed an ANR dialog; selecting Wait recovered it. The first exact-final-APK instrumentation attempt then aborted before its first test with Android reason 6 / **BIND APPLICATION ANR**, alongside QEMU thread-hang and System UI warnings. [Aborted runner](driver-o3-trips-2026-11-17/instrumentation-startup-failure.txt) and [Android exit record](driver-o3-trips-2026-11-17/startup-exit.txt) are retained. Normal launch completed in 4.6 seconds after recovery, with On duty observed and the warning absent; the retry completed **10/10 tests in 48.84 seconds**. These are emulator startup reliability limits, not an established Java exception or live-operation acceptance.

### Actual native screenshots and reference comparison

| Evidence | Capture |
| --- | --- |
| Drop-off mode / actual count / next pickup / full synthetic destination ETA | [Drop-off](driver-o3-trips-2026-11-17/drop-off.png) |
| Pick-up mode / completed readiness / distinct travel and service estimates | [Pick-up](driver-o3-trips-2026-11-17/pick-up.png) |
| 24-minute travel vs 28-minute service prediction / no premature route action | [Waiting collection](driver-o3-trips-2026-11-17/pick-up-scroll.png) |
| One pooled vehicle, two identifiable customer stops, next-customer ETA | [Pooled stops](driver-o3-trips-2026-11-17/pooled-stops.png) |
| Text wraps and scrolls at 130% font | [Scaled native UI](driver-o3-trips-2026-11-17/font130.png) |
| Actual Drop-off Open Route → existing native Map | [Drop-off Map](driver-o3-trips-2026-11-17/drop-off-map.png) |
| Actual Pick-up Open Route → collection Map | [Pick-up Map](driver-o3-trips-2026-11-17/pick-up-map.png) |

The captures use actual native Compose components. They precede the final policy-only legacy boarding/ETA guard; the Compose screens and displayed fixture cases are unchanged. The final APK hash and final runner output are recorded separately.  They match the supplied reference's forest/gold brand, two cream-selected modes, blue/green identity, therapist-first cards, ETA panel, readiness banner, progress and Open Route hierarchy. The existing raised Scan/five-tab bar is preserved. Cards expand for explicit pooled stops and larger text and remain vertically scrollable. The fixture Map intentionally shows **Unable to verify trip / Retry**: it proves direct Map selection and correct mode/destination labels, not a usable live road route or guidance start.

### Required scenario matrix

| # | Scenario | Evidence / practical limit |
| --- | --- | --- |
| 1–4 | Both modes, switching and accurate counts | Native emulator tests and captures; counts derived from explicit assigned journeys |
| 5 | Time to Drop targets correct customer and includes required pickup | JVM prefix/boarding/target tests; synthetic full-route display. Production full prefix is an O4 dependency |
| 6 | Time to Pick targets collection, not return destination | JVM target/leg checks; native 9-minute/24-minute fixture displays |
| 7 | Service countdown separate from travel | Native 24-minute travel / 28-minute service display and JVM test |
| 8–9 | Completed ready; in-progress/late countdown not ready | Native fixtures and JVM completion/zero/late/missing-deadline guards. Connected Complete Service events remain O4 |
| 10 | Independent departure creates no pickup | JVM required/not_required/undecided filtering; no inferred collection from delivery/shift state |
| 11–12 | Pooled therapists and distinct customer stops | Native pooled-card test/capture; typed shared vehicle ID and separate stop/passenger IDs |
| 13 | Correct next destination opens in native Map | Native Drop-off/Pick-up/pooled selections, map labels/captures and JVM ordered-stop tests. Fixture server refuses itinerary authority |
| 14 | One explicit Start begins actual guidance | Existing Start/SDK path retained and inspected. **Live guidance NOT VERIFIED** with this inactive fixture; connected SDK acceptance required |
| 15 | No unrelated intermediate screen | Native direct-trip-to-Map tests, no Back/details modal before Map |
| 16 | Today, Scan, Map, More still work | Native tab/profile/camera/map tests; history access retained |
| 17 | Authentication/driver authority retained | Existing 31 JVM policies, encrypted session instrumentation, owner/mode checks, no Auth/backend/writer diff. Real sign-in is not re-tested with fixtures |
| 18 | Android compiles | Debug app/test APK, release Kotlin/Java source compilation and lint above |


All displayed fixture names, coordinates, route distances, durations, readiness and assignments are synthetic LOCAL UI data. The fixture loader requires debug + explicit native fixture flag + `.localtest`; release sources cannot load the debug fixture object. Fixture transport refuses operational writes. No emulator result represents Supabase/production/device-route parity.

## Production impact and rollback

No main merge, remote push, Web/PWA/O1/O2 change, deployment, CradleHub production API request, database/schema/migration/configuration change, actual trip/attendance event or staff APK distribution occurs. The owner's physical phone is not updated for O3. Earlier one-scan, maximum 120-minute early arrival policy remains untouched.

Rollback before release is to leave/discard this isolated stage branch; main and the installed owner app are unchanged. If a later release is authorized, revert the O3 implementation/evidence commits as a unit; there is no database rollback. Preserve the accepted native baseline and do not replace backend authority with the typed fixtures.

## Review, verdict and stop boundary

**CORRECTION REQUIRED for connected operational acceptance.** The authorized O3 native UI implementation and LOCAL fixture verification are complete. Full production road-route coverage, authoritative service deadlines/completion/readiness, explicit conditional/pool/split dispatch contracts, live one-Start guidance and native-to-CRM/push acceptance remain unverified or absent and are explicitly deferred to the separately authorized O4 stage. This verdict does not request or imply permission to start O4.

Implementation review covers target/driver/mode matching, GPS/ETA freshness, readiness vs prediction, explicit pooled stop identity, debug-only fixture loading, unchanged server reauthorization and writer scope. It is implementation review, not a fabricated external reviewer acceptance. The next permitted action is owner review of this O3 package. O4 implementation, merge, push, deployment, phone/staff APK distribution and operational acceptance require a separately authorized next stage.
