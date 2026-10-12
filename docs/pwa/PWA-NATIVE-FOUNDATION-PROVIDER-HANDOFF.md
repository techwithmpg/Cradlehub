# Staff PWA native foundation and Provider review handoff

**Status: CORRECTION REQUIRED for release evidence.** Implementation is ready for independent code review. Authenticated Provider browser timing and new-build physical standalone verification remain unproven. Do not merge or deploy from this handoff.

## Authority and scope

- Owner brief: “CRADLEHUB STAFF PWA — SHARED NATIVE FOUNDATION + THERAPIST FIRST IMPLEMENTATION,” with the approved Therapist mobile reference image and the owner's reported post-login Android address bar.
- Accepted baseline and fetched `origin/main`: `3f8f4067c4c9e0e3e2122b97d4d0694fac0dbb20` (rechecked 2026-10-12; unchanged).
- Isolated branch: `stage/staff-pwa-native-foundation-provider`.
- Implementation commit: `0f3a60b29a5999c8cc97b494502248f2621844b3`. The final branch HEAD also contains this handoff document.
- No Member Portal, role redesign for Driver/Utility/CRM, schema, migration, RLS, payment, booking contract, scanner validation, or service-worker cache change.
- Database target for local build/runtime: **LOCAL** placeholder `127.0.0.1:54321` (unavailable, no data access). **PRODUCTION** was not accessed or mutated.

## Inspected route and runtime map

| Surface | Existing route/data authority | Work in this branch |
| --- | --- | --- |
| Today | `/staff/`, `getProviderWorkspaceRuntime` and staff/attendance queries | Real business date, counts, primary work, next appointment, attendance and shift presentation |
| Schedule | `/staff/schedule`, existing `getMyWeekAction` planner | Compact day selector and rows, remembered selected date |
| Scan | `/staff/scan`, existing camera hook, QR resolver, processor routes | Darker viewfinder and in-scope return path; document navigation and validation retained |
| Progress | `/staff/progress`, existing `getMyServiceProgressAction` | Compact segments, summary, empty state and real completion timestamps |
| More | `/staff/more`, existing profile/attendance/schedule/progress links and logout | Native surfaces and in-scope logout destination |
| Attendance | `/staff/attendance`, existing attendance snapshot, device state and realtime reader | Provider mobile wrapper and mapped supported links; legacy Staff Portal route retained |
| Auth and launch | `/staff/` manifest start/scope, proxy, dashboard gate, login actions | Preserve `/staff/`, add public `/staff/login`, route verified operational staff back into scope |

The dashboard `workspace-main` remains the main scroll container. The Provider shell owns the persistent bottom navigation and safe-area padding; Provider Today, Schedule, Progress and More no longer claim nested full-height viewports. The scanner retains its deliberate full-document navigation so its camera Permissions-Policy loads.

## Shared foundation and cache

- Shared components and scoped tokens are in `src/components/features/staff-pwa/native-foundation.tsx` and `native-foundation.module.css`: canvas, screen/header, raised and inset surfaces, segmented control, stat tile, list/avatar rows, status chip, buttons, field, empty/feedback/loading patterns, timer and dialog. Forest `#163A2B`, cream `#F7F3EB`, and gold `#C8A96B`; 48px controls and reduced-motion handling.
- `safe-memory.tsx` holds **only** three possible screen summaries (`today`, `schedule`, `progress`) and two small presentation choices (schedule date, Progress tab). Each summary is limited to four count/label pairs. A representative Today snapshot serialized to 198 ASCII bytes. **Persistent storage: 0 bytes.** IndexedDB was evaluated and omitted because server-rendered authenticated routes and the small summary benefit do not justify durable operational data on a shared phone.
- Namespace: authenticated user ID, staff ID, system role, staff type and branch ID. The provider is mounted only after server profile resolution. A changed identity makes old entries inaccessible; logout unmounts the provider. No customer names, phone numbers, addresses, notes, QR results, tokens, payments, or authorization decisions enter this cache.
- Cache entries expire after five minutes; foreground return/reconnect refreshes after 30 seconds while current UI remains visible. Next's existing router cache is unchanged. Cold loading uses a compact structural state; warm loading can show validated safe counts marked Updating/Offline with last update time. Successful booking progress mutations invalidate Today+Progress, and terminal completion/no-show also invalidates Schedule. Attendance scans retain a document navigation and server-fresh state.
- All business transitions, access checks, QR validation and attendance approval remain server-authoritative; no offline mutation queue was added.

## Verification actually performed

- **245 tests / 21 files passed**: PWA, Provider runtime/query, navigation/role, login/auth redirect, scanner, attendance, memory isolation and launch tests, excluding an unrelated historical `.claude` worktree.
- Type-check: PASS. Scoped ESLint: PASS. Scoped Prettier: PASS. `git diff --check`: PASS.
- Optimized production build with **LOCAL placeholders**: PASS; `/staff/login` and all canonical routes generated.
- Read-only LOCAL HTTP: `/staff` 308 → `/staff/`; unauthenticated `/staff/` and `/staff/progress` 307 → `/staff/login`; `/staff/login` 200; existing `/login/` 308 → `/login`; Staff manifest 200. Manifest `start_url` and scope remain `/staff/`.
- LOCAL browser sign-in at 360×800, 390×844 and 412×915: no horizontal overflow; sign-in and input controls measured about 48px. The visual sign-in check covered the in-scope Staff login only. An additional browser reload was rejected by automatic approval review with `429 Too Many Requests` after its retry limit; it was not executed.

## Evidence limits and release gate

- **Authenticated Provider sequence timing — NOT VERIFIED.** Cold/warm/stale tap-to-meaningful, usable time, request count, repeated requests, payload size, background refresh, and on-device cache behavior require a safe authenticated TEST/STAGING identity. No improvement is claimed without those measurements.
- **Installed standalone PWA on this new build — NOT VERIFIED.** LOCAL browser routing proves the redirect chain only. The owner's earlier phone approval covered the previously deployed icon, not this branch's new login/navigation behavior.
- **PHYSICAL DEVICE VERIFICATION — NOT VERIFIED.** Test sign-in, Today→Schedule→Progress→More→Today, app background/foreground, reconnect, logout, user/branch switch, scan entry and post-login absence of address bars on a physical installed PWA before release review.
- Provider screens beyond the unauthenticated login could not be visually inspected in a browser without an authorized TEST/STAGING account. The approved image guided the implementation; no mockup customer data was copied into production UI.
- The source has no new provider-specific detail, booking, history or notes module. Unsupported design-mock destinations remain absent/disabled. Unknown attendance action links retain their original destinations rather than guessing a canonical route.

## Review, rollback and next stage

- Changed implementation files: `next.config.ts`; Staff public login, dashboard/Staff pages and proxy; Provider Today/Schedule/Scan/Progress/More/attendance components; scoped foundation/cache and route adapters; focused tests. `git show --name-only 0f3a60b29a5999c8cc97b494502248f2621844b3` lists all 38 implementation files.
- Review the proxy's preserved authorization checks, in-scope login after verified operational-group access, memory isolation, scanner document navigation and attendance link mapping. Independent review and an owner gate are required before an accepted merge.
- Rollback while unmerged: leave or discard this review branch; no production rollback is needed. If a future merge is separately authorized, revert the implementation commit through the normal reviewed branch process.
- Suggested next role **after a separate authorization**: Utility, because its smaller supported route set can adopt the shared surfaces without changing dispatch or Provider rules.
- **Not authorized:** merge, push to `main`, production deployment, production database mutation, or implementation of the next role.
