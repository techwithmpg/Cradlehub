# CradleHub Staff PWA — PWA-C5 Handoff and Status

**Stage:** PWA-C5 — Shared Foundation  
**Status:** PASS — READY FOR EXTERNAL RE-REVIEW
**Accepted C4/main baseline:** `d11a8ca3623e0092829c683b7022dc302739b96b`
**Branch:** `stage/pwa-c5-shared-foundation`
**Authority:** [PWA-GOV-007](../11-DECISION-LOG.md#staff-pwa-decisions), [PWA-GOV-008](../11-DECISION-LOG.md#pwa-gov-008); owner architecture decisions
**Next Stage:** PWA-C6 (Scanner) — **STRICTLY NOT AUTHORIZED**

---

## 1. Stage Deliverables Summary

Stage PWA-C5 has completed the shared mobile foundation implementation required by the accepted PWA-C4 UI/UX specification and owner architecture decision PWA-GOV-008:

1. **Owner Architecture Decision PWA-GOV-008 Implementation:**
   - **Option 1 (Consolidated Staff Route Namespace `/staff/`)** implemented using an **alias-first / non-destructive migration strategy**.
   - Canonical Staff PWA scope: `/staff/`.
   - Historical routes (`/staff-portal`, `/driver`, `/utility`, `/scan`) preserved untouched for full backward compatibility.
   - Canonical routes created under `src/app/(dashboard)/staff/` re-exporting existing portal modules non-destructively:
     - `/staff` (Today - Provider / CRM)
     - `/staff/schedule` (Provider)
     - `/staff/progress` (Provider)
     - `/staff/work` (CRM / General Staff Work Queue)
     - `/staff/notices` (CRM / General Staff Notifications)
     - `/staff/more` (Provider / CRM)
     - `/staff/scan` (Unified role-aware Scan entrypoint)
     - `/staff/driver` (Driver Today)
     - `/staff/driver/trips` (Driver Trips)
     - `/staff/driver/map` (Driver Map)
     - `/staff/driver/more` (Driver More)
     - `/staff/utility` (Utility Today)
     - `/staff/utility/work` (Utility Work — selectable, displaying exact read-only unavailable state)
     - `/staff/utility/notices` (Utility Notices)
     - `/staff/utility/more` (Utility More)

2. **Security & Authorization Boundaries:**
   - Updated `src/proxy.ts`: added `"/staff"` and `"/scan"` to `PROTECTED_PREFIXES` so unauthenticated requests fail closed and redirect to `/login`.
   - Updated `src/lib/auth/workspace-access.ts`: extended `canAccessWorkspacePath` to authorize `/staff`, `/staff/driver`, `/staff/utility`, `/staff/scan`, and `/scan` based on verified session profile.
   - Removed silent `"therapist"` fallback in `StaffAppShell` (`src/components/features/staff-pwa/app-shell.tsx`). Unresolved users render `StaffRoleResolutionSplash`.

3. **Web App Manifest & Install Scoping:**
   - Manifest endpoint `src/app/manifest-staff.webmanifest/route.ts` configured to:
     - `id: "/cradlehub-staff"`
     - `name: "CradleHub Staff"`
     - `short_name: "Staff"`
     - `description: "CradleHub Staff — Team Workspace"`
     - `start_url: "/staff/"`
     - `scope: "/staff/"`
     - `display: "standalone"`
     - `theme_color: "#163A2B"`
     - `background_color: "#F7F3EB"`
   - Dedicated launcher icon assets: `public/staff-manifest-icon-192.png` and `public/staff-manifest-icon-512.png` (Deep Forest `#163A2B`, Muted Gold `#C8A96B`, high-contrast "STAFF" badge). Pre-existing icons remain untouched.
   - Preserved `public/sw.js` and `public/cradlehub-push-sw.js` completely untouched.

4. **Shared Staff PWA Component Architecture (`src/components/features/staff-pwa/`):**
   - `AppShell`: Master mobile shell composing header, banner, scroll container with safe clearance, and bottom navigation.
   - `StaffTopBar`: Sticky phone-first header (Today mode with brand wordmark, notifications badge, user avatar, and context ribbon; Inner mode with back control and centered title).
   - `StaffBottomNav`: 5-position dock with minimum 48 px touch targets, safe-area-inset-bottom support, active indicators, and prominent 56 px center Scan action.
   - `StaffConnectivityBanner`: Real-time state indicator (`ONLINE`, `OFFLINE`, `RECONNECTING`, `REQUEST_FAILED`, `NOT_RECORDED`). Zero offline mutation queue; no "Queued" or "Will sync later" false promises.
   - `StaffStatusChip`: Non-color-only status badges with text + icon (confirmed/On Shift, pending, stale, offline, blocked, info).
   - `StaffPrimaryAction`: Standard 48 px touch action button with states: default, pressed, disabled-with-reason, loading.
   - `StaffErrorState`: Semantic error view with retry and unconfirmed outcome distinction.
   - `StaffEmptyState`: Semantic zero-item presentation for legitimate empty results.
   - `StaffLoadingState`: Accessible loading indicator and card skeletons with `aria-busy="true"`.
   - `StaffStaleState`: Read-only cached view indicator with snapshot timestamp age.
   - `StaffConfirmDialog`: Accessible modal dialog with focus trapping and explicit action verbs.
   - `StaffActionSheet`: Accessible mobile bottom sheet for secondary operational actions.
   - `StaffInstallPrompt` & `StaffInstallGuide`: Dedicated "Install CradleHub Staff" banner with native Android prompt support, iPhone Safari manual guidance, standalone mode detection, and dismissal memory.
   - `StaffRoleResolutionSplash`: Neutral role-resolution screen with required primary wording: `CradleHub Staff`, `Team Workspace`, `Opening your workspace…`.

5. **Role-Aware Navigation Foundation (`src/components/features/staff-pwa/role-navigation.ts`):**
   - 4 frozen profiles with canonical `/staff/*` destinations:
     - **Provider** (Therapist, Nail Tech, Aesthetician, Salon Head): `/staff` · `/staff/schedule` · `/staff/scan` · `/staff/progress` · `/staff/more`
     - **CRM / General Staff**: `/staff` · `/staff/work` · `/staff/scan` · `/staff/notices` · `/staff/more`
     - **Utility**: `/staff/utility` · `/staff/utility/work` (selectable, read-only unavailable) · `/staff/scan` · `/staff/utility/notices` · `/staff/utility/more`
     - **Driver**: `/staff/driver` · `/staff/driver/trips` · `/staff/scan` · `/staff/driver/map` · `/staff/driver/more`
   - Fixed CRM vs Utility nav collision: `src/app/(dashboard)/staff-portal/layout.tsx` passes `profile="utility"` to `StaffMobileShell` when the active staff profile is utility.

6. **Unified Scan Entrypoint & Navigation Seam:**
   - Both `/staff/scan` and legacy `/scan` resolve trusted server session profile to derive role context and route cancel/back navigation directly to the user's role-appropriate home (`/staff/driver` for drivers, `/staff/utility` for utility, `/staff` for providers/crm).
   - Shows clear PWA-C5 placeholder explaining that camera QR decoding is scheduled for Stage PWA-C6.

---

## 2. Route-Consumer Inventory

| Canonical Route (`/staff/*`) | Historical Alias / Target | Navigation Profile | Consumer / Purpose |
| :--- | :--- | :--- | :--- |
| `/staff` | `/staff-portal` | Provider, CRM | Today view (re-exports `../staff-portal/page`) |
| `/staff/schedule` | `/staff-portal/schedule` | Provider | Schedule view (re-exports `../../staff-portal/schedule/page`) |
| `/staff/progress` | `/staff-portal/service-progress` | Provider | Service Progress (re-exports `../../staff-portal/service-progress/page`) |
| `/staff/work` | `/staff-portal/work` | CRM / General | Work Queue page |
| `/staff/notices` | `/staff-portal/notifications` | CRM / General | Notifications (re-exports `../../staff-portal/notifications/page`) |
| `/staff/more` | `/staff-portal/more` | Provider, CRM | More options (re-exports `../../staff-portal/more/page`) |
| `/staff/scan` | `/scan` | All Staff | Unified Scan entrypoint (C5 seam; camera in C6) |
| `/staff/driver` | `/driver` | Driver | Driver Today view (re-exports `../../driver/page`) |
| `/staff/driver/trips` | `/driver/dispatch` | Driver | Driver Trips view (re-exports `../../../driver/dispatch/page`) |
| `/staff/driver/map` | `/driver/map` | Driver | Driver Map view (re-exports `../../../driver/map/page`) |
| `/staff/driver/more` | `/staff-portal/more` | Driver | Driver More options (re-exports `../../../staff-portal/more/page`) |
| `/staff/utility` | `/utility` | Utility | Utility Today view (re-exports `../../utility/page`) |
| `/staff/utility/work` | — | Utility | Utility Work — selectable, displays exact read-only unavailable state |
| `/staff/utility/notices`| `/staff-portal/notifications` | Utility | Utility Notices (re-exports `../../../staff-portal/notifications/page`) |
| `/staff/utility/more` | `/staff-portal/more` | Utility | Utility More options (re-exports `../../../staff-portal/more/page`) |

---

## 3. Evidence Ledger

- **VERIFIED REPOSITORY FACT:** No Web App Manifest existed in the repository prior to C5.
- **VERIFIED REPOSITORY FACT:** `public/cradlehub-push-sw.js` is registered at root scope `/` strictly on user action in notification settings; `public/sw.js` is a legacy self-unregistering cleanup worker. Both were preserved completely untouched.
- **VERIFIED REPOSITORY FACT:** Manifest scope is now strictly isolated to `/staff/`, cleanly separated from CRM (`/crm`), Owner (`/owner`), Marketing (`/marketing`), and public routes.
- **LOCAL TEST EVIDENCE:** `tests/lib/pwa/staff-pwa-foundation.test.ts` passes 15/15 tests covering role mapping, navigation structures, center Scan button placement, selectable Utility Work pointing to read-only unavailable state, manifest output (`id: "/cradlehub-staff"`, `scope: "/staff/"`, `start_url: "/staff/"`), dedicated icon paths, role resolution splash wording, service worker preservation, connectivity contracts, proxy protection (`PROTECTED_PREFIXES` including `/staff` and `/scan`), workspace authorization, and fail-closed role resolution.
- **LOCAL TEST EVIDENCE:** `npx vitest run tests/lib/pwa/ tests/lib/marketing/` passes 14/14 test files (165 tests) with zero failures.
- **LOCAL TEST EVIDENCE:** `npm run type-check` passes with zero TypeScript errors.
- **LOCAL TEST EVIDENCE:** `git diff --check` passes with zero whitespace or formatting errors.
- **UNKNOWN / NOT VERIFIED:** Android real-device installation, iPhone Safari home screen bookmarking/standalone launch, home screen icon rendering at OS scale, real-device safe area handling, and Web Push delivery on physical devices remain unverified until real device testing is authorized.

---

## 4. Strict Scope & Boundaries Reaffirmation

- **No C6 Implementation:** Camera QR decoding, zxing/barcode-detector integration, and scanner mutation pipelines were NOT implemented.
- **No C7 Implementation:** Attendance clock-in/out mutations, device activation changes, and time recalculation pipelines were NOT implemented.
- **No C8 Implementation:** Provider appointment status transitions and service timer mutations were NOT implemented.
- **No C9 Implementation:** CRM administrative/customer records or operational task managers were NOT implemented.
- **No C10 Implementation:** Utility task backends or checklists were NOT implemented (Utility Work displays exact read-only unavailable state).
- **No C11+ Implementation:** Driver trip transitions, location capture, map sync, or remote end shift mutations were NOT implemented.
- **No Database/Auth/RLS/Storage Mutations:** Zero database migrations, SQL modifications, or storage changes were performed.
- **No Production Mutation:** Zero production databases or environments were accessed or altered.

---

## 5. Rollback Plan

If rollback is required, reset or revert `stage/pwa-c5-shared-foundation` to the accepted baseline:
`d11a8ca3623e0092829c683b7022dc302739b96b`.
Because no database migrations or schema alterations occurred, rollback is completely non-destructive to persistent data.
