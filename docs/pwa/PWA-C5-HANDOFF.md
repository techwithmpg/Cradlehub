# CradleHub Staff PWA — PWA-C5 Handoff and Status

**Stage:** PWA-C5 — Shared Foundation  
**Status:** READY FOR EXTERNAL REVIEW — NOT ACCEPTED / NOT MERGED  
**Accepted C4/main baseline:** `d11a8ca3623e0092829c683b7022dc302739b96b`  
**Branch:** `stage/pwa-c5-shared-foundation`  
**Authority:** [PWA-GOV-007](../11-DECISION-LOG.md#staff-pwa-decisions); latest explicit owner instruction  
**Next Stage:** PWA-C6 (Scanner) — **STRICTLY NOT AUTHORIZED**

---

## 1. Stage Deliverables Summary

Stage PWA-C5 has completed the shared mobile foundation implementation required by the accepted PWA-C4 UI/UX specification:

1. **Shared Staff PWA Component Architecture (`src/components/features/staff-pwa/`):**
   - `AppShell`: Master mobile shell composing header, banner, main scroll region with safe bottom clearance, and bottom navigation.
   - `StaffTopBar`: Sticky phone-first header (Today mode with brand wordmark, notifications badge, user avatar, and context ribbon; Inner mode with back control and centered title).
   - `StaffBottomNav`: 5-position dock with minimum 48 px touch targets, safe-area-inset-bottom support, accessible semantic markup, active indicator, and prominent 56 px center Scan action.
   - `StaffConnectivityBanner`: Real-time and explicit state indicator (`ONLINE`, `OFFLINE`, `RECONNECTING`, `REQUEST_FAILED`, `NOT_RECORDED`). Zero offline mutation queue; no "Queued" or "Will sync later" false promises.
   - `StaffStatusChip`: Non-color-only status badges with text + icon (confirmed/On Shift, pending, stale, offline, blocked, info).
   - `StaffPrimaryAction`: Standard 48 px touch action button with default, pressed, disabled-with-reason, and loading states.
   - `StaffErrorState`: Semantic error view with retry and unconfirmed outcome distinction.
   - `StaffEmptyState`: Semantic zero-item presentation for legitimate empty results.
   - `StaffLoadingState`: Accessible loading indicator and card skeletons with `aria-busy="true"`.
   - `StaffStaleState`: Read-only cached view indicator with snapshot timestamp age.
   - `StaffConfirmDialog`: Accessible modal dialog with focus trapping and explicit action verbs.
   - `StaffActionSheet`: Accessible mobile bottom sheet for secondary operational actions.
   - `StaffInstallPrompt` & `StaffInstallGuide`: Dedicated "Install CradleHub Staff" banner with native Android prompt support, iPhone Safari manual guidance, standalone mode detection, and dismissal memory.

2. **Web App Manifest & Install Separation:**
   - Pre-inspection proved no pre-existing manifest existed for CRM or Staff.
   - Dedicated Staff PWA manifest endpoint: `src/app/manifest-staff.webmanifest/route.ts` (`id: "cradlehub-staff"`, `name: "CradleHub Staff"`, `short_name: "Staff"`, `description: "CradleHub Staff — Team Workspace"`, `start_url: "/staff-portal"`, `scope: "/"`).
   - Dedicated launcher icon assets: generated `public/staff-manifest-icon-192.png` and `public/staff-manifest-icon-512.png` featuring Deep Forest (`#163A2B`) background, Muted Gold (`#C8A96B`) monogram, and high-contrast "STAFF" team badge treatment. Pre-existing `public/manifest-icon-192.png` and `public/manifest-icon-512.png` remain completely untouched.
   - Preserved `public/sw.js` and `public/cradlehub-push-sw.js` completely untouched.
   - Staff surfaces promote `"Install CradleHub Staff"`; CRM surfaces do not advertise Staff PWA.
   - Linked manifest metadata in `src/app/(dashboard)/staff-portal/layout.tsx`, `src/app/(dashboard)/driver/layout.tsx`, and `src/app/scan/page.tsx`.

3. **Staff Launch & Role-Resolution Splash Screen:**
   - Implemented `StaffRoleResolutionSplash` (`src/components/features/staff-pwa/role-resolution-splash.tsx`) with required primary wording:
     - `CradleHub Staff`
     - `Team Workspace`
     - `Opening your workspace…`
   - Covers secure session validation and operational role resolution.
   - Fail-closed: does not guess, expose private operational data, or silently default unresolved users to any role.
   - Integrated into `src/app/(dashboard)/staff-portal/loading.tsx` for mobile viewports.

4. **iPhone Safari Install Guidance & Launch Boundaries:**
   - Enhanced `StaffInstallPrompt` and `StaffInstallGuide` to clearly distinguish:
     - Android / Chromium native install prompt (`beforeinstallprompt`)
     - iPhone Safari manual Add to Home Screen guidance with step-by-step instructions
     - Standalone / already installed mode detection (prompt suppressed)
     - Security boundary: clearly states installation does not grant permissions
     - Launch boundary: explains that opening while logged out routes to secure authentication before resolving workspace.

5. **Role-Aware Navigation Foundation (`src/components/features/staff-pwa/role-navigation.ts`):**
   - 4 frozen profiles covering all 7 operational roles:
     - Provider (Therapist, Nail Tech, Aesthetician, Salon Head): `Today` · `Schedule` · `Scan` · `Progress` · `More`
     - CRM / General Staff: `Today` · `Work` · `Scan` · `Notices` · `More`
     - Utility: `Today` · `Work` (blocked/read-only) · `Scan` · `Notices` · `More`
     - Driver: `Today` · `Trips` · `Scan` · `Map` · `More`

6. **Navigation Seams:**
   - Created `/scan` seam (`src/app/scan/page.tsx`) rendering the Staff PWA shell and displaying a clear placeholder explaining that camera QR scanning and decoding are scheduled for Stage PWA-C6.
   - Updated `therapist-mobile-bottom-nav.tsx`, `staff-mobile-bottom-nav.tsx`, and `driver-mobile-bottom-nav.tsx` to adopt the canonical 5-position `StaffBottomNav`.

---

## 2. Evidence Ledger

- **VERIFIED REPOSITORY FACT:** No Web App Manifest existed in the repository prior to C5.
- **VERIFIED REPOSITORY FACT:** `public/cradlehub-push-sw.js` is registered at root scope `/` strictly on user action in notification settings; `public/sw.js` is a legacy self-unregistering cleanup worker. Both were preserved untouched.
- **VERIFIED REPOSITORY FACT:** CRM and Staff routes currently share the top-level route namespace (`/crm`, `/owner`, `/marketing` vs `/staff-portal`, `/driver`, `/utility`, `/scan`).
- **LOCAL TEST EVIDENCE:** `tests/lib/pwa/staff-pwa-foundation.test.ts` passes 12/12 tests covering role mapping, navigation structures, center Scan button placement, Utility Work blocking, manifest output, dedicated icon paths, role resolution splash wording, service worker preservation, and connectivity contracts.
- **LOCAL TEST EVIDENCE:** `npm run type-check` passes with zero TypeScript errors.
- **LOCAL TEST EVIDENCE:** `git diff --check` passes with zero whitespace or formatting errors.
- **UNKNOWN / NOT VERIFIED:** Android real-device installation, iPhone Safari home screen bookmarking/standalone launch, home screen icon rendering at OS scale, real-device safe area handling, and Web Push delivery on physical devices remain unverified until real device testing is authorized.

---

## 3. Strict Scope & Boundaries Reaffirmation

- **No C6 Implementation:** Camera QR decoding, zxing/barcode-detector integration, and scanner mutation pipelines were NOT implemented.
- **No C7 Implementation:** Attendance clock-in/out mutations, device activation changes, and time recalculation pipelines were NOT implemented.
- **No C8 Implementation:** Provider appointment status transitions and service timer mutations were NOT implemented.
- **No C9 Implementation:** CRM administrative/customer records or operational task managers were NOT implemented.
- **No C10 Implementation:** Utility task backends or checklists were NOT implemented (Utility Work remains strictly BLOCKED).
- **No C11+ Implementation:** Driver trip transitions, location capture, map sync, or remote end shift mutations were NOT implemented.
- **No Database/Auth/RLS/Storage Mutations:** Zero database migrations, SQL modifications, or storage changes were performed.
- **No Production Mutation:** Zero production databases or environments were accessed or altered.

---

## 4. Rollback Plan

If rollback is required, reset or revert `stage/pwa-c5-shared-foundation` to the accepted baseline:
`d11a8ca3623e0092829c683b7022dc302739b96b`.
Because no database migrations or schema alterations occurred, rollback is completely non-destructive to persistent data.
