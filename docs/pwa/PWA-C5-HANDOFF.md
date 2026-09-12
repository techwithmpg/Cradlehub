# CradleHub Staff PWA — PWA-C5 Handoff and Status

**Stage:** PWA-C5 — Shared Foundation (Runtime-Scope Correction Pass)  
**Status:** PASS — READY FOR EXTERNAL RE-REVIEW  
**Accepted C4/main baseline:** `d11a8ca3623e0092829c683b7022dc302739b96b`  
**Starting C5 head for this review:** `8c02db5650c9fb126b56f4c61b635e86c098dab0`  
**Branch:** `stage/pwa-c5-shared-foundation`  
**Authority:** [PWA-GOV-007](../11-DECISION-LOG.md#staff-pwa-decisions), [PWA-GOV-008](../11-DECISION-LOG.md#pwa-gov-008); owner architecture decisions  
**Next Stage:** PWA-C6 (Scanner) — **STRICTLY NOT AUTHORIZED**  

---

## 1. Executive Summary & Deliverables

Stage PWA-C5 has completed the shared mobile foundation implementation and successfully resolved all canonical `/staff/*` runtime scope escapes identified during external review:

1. **Scope-Escape Resolution & Route Containment:**
   - **Driver Bottom Navigation:** `DriverMobileBottomNav` is now namespace-aware via `mode` prop or automatic `pathname.startsWith("/staff")` detection. Canonical dock outputs `/staff/driver`, `/staff/driver/trips`, `/staff/scan`, `/staff/driver/map`, and `/staff/driver/more`. Historical `/driver` and `/staff-portal` links are preserved for legacy consumers.
   - **Driver Home & Actions:** Bell notification links to `/staff/notices`, Trips link to `/staff/driver/trips`, Map links to `/staff/driver/map`, and Profile links to `/staff/driver/more` when running under canonical `/staff/`.
   - **Therapist Header, Cards & Schedule:** `TherapistHeader`, `TherapistNextServiceCard`, `TherapistQuickActions`, and `TherapistScheduleList` pagination links remain within `/staff/` (`/staff/progress`, `/staff/schedule`, `/staff/notices`, `/staff/more`) without throwing users into historical `/staff-portal/*`.
   - **Basic Staff Header, Cards & Schedule:** `BasicStaffHeader`, `BasicStaffAssignmentCard`, `BasicStaffQuickActions`, and `BasicStaffMobileSchedule` pagination links route to canonical `/staff/work`, `/staff/notices`, and `/staff/profile` when canonical.
   - **More Menus:** `DriverMoreMenu`, `TherapistMoreMenu`, and `BasicStaffMoreMenu` accept `isCanonical?: boolean`. When true, destinations strictly emit canonical `/staff/...` URLs (`/staff/profile`, `/staff/notices`, `/staff/attendance`, `/staff/driver/trips`, `/staff/driver/map`) or honest disabled states, completely eliminating `/staff-portal/*` leakage.

2. **Canonical Utility Today Correction & Legacy Loop Prevention:**
   - Replaced historical `/utility` re-export with a dedicated, truthful `CanonicalUtilityPage` (`src/app/(dashboard)/staff/utility/page.tsx`).
   - Removed all speculative task promises: no "Room Preparation Checklist", no "Cleaning Schedule", no "Supply Restock Reminders", no "Maintenance Tasks", and no "Coming Soon" teasers.
   - Removed the legacy loop redirecting to `/staff-portal`. Denial routes safely back to `/staff`.
   - Provides safe foundation destinations only: Today (`/staff/utility`), Work (`/staff/utility/work` — preserved read-only unavailable state), Scan (`/staff/scan`), Notices (`/staff/utility/notices`), and More (`/staff/utility/more`).

3. **Server & UI Role Resolver Alignment:**
   - Unified `resolveStaffOperationalRole` in `src/components/features/staff-pwa/role-navigation.ts` with server-side `resolveStaffPwaOperationalGroup` in `src/lib/auth/workspace-access.ts`.
   - `service_head` and `service_staff` are consistently treated as Provider (`salon_head` / `therapist`).
   - Managerial roles (`owner`, `manager`, `assistant_manager`, `store_manager`, `digital_marketer`, `managerial`) resolve strictly to `null`, ensuring server authorization and UI navigation profiles agree 1:1.
   - Added cross-contract test proving strict agreement across all 22 role/type combinations.

4. **Shared Runtime Shell Integration:**
   - Root canonical layout `src/app/(dashboard)/staff/layout.tsx` decorates all `/staff/*` pages with `StaffConnectivityBanner` and `StaffInstallPrompt`.
   - Passes `mode="canonical"` to `DriverMobileShell`.
   - `src/app/(dashboard)/staff/scan/page.tsx` passes `hideNav={true}` to inner `StaffAppShell` to prevent duplicate navigation docks.

5. **Manifest, Icons, and Service Worker Preservation:**
   - Preserved `id: "/cradlehub-staff"`, `start_url: "/staff/"`, `scope: "/staff/"`, `name: "CradleHub Staff"`, and `short_name: "Staff"`.
   - Dedicated Staff icons (`public/staff-manifest-icon-192.png`, `public/staff-manifest-icon-512.png`) preserved.
   - `public/sw.js` and `public/cradlehub-push-sw.js` preserved completely untouched.

---

## 2. Canonical Route Inventory

| Canonical Route (`/staff/*`) | Primary Role / Profile | Scope Escape Resolved | Purpose / Behavior |
| :--- | :--- | :--- | :--- |
| `/staff` | Provider, CRM | Yes | Today view; routes driver to `/staff/driver` and utility to `/staff/utility` |
| `/staff/schedule` | Provider | Yes | Weekly schedule view; week pagination stays on `/staff/schedule` |
| `/staff/progress` | Provider | Yes | Service progress view; card links route to `/staff/progress` |
| `/staff/work` | CRM / General | Yes | Work queue view; assignment card & pagination stay on `/staff/work` |
| `/staff/notices` | CRM / General | Yes | Notification center |
| `/staff/more` | Provider, CRM | Yes | More menu; all links route to `/staff/...` or safe disabled states |
| `/staff/profile` | All Staff | Yes | Minimal alias to server profile; stays inside `/staff/` scope |
| `/staff/attendance` | All Staff | Yes | Minimal alias to attendance readiness & history; stays inside `/staff/` scope |
| `/staff/scan` | All Staff | Yes | Unified Scan entrypoint (C5 seam; camera in C6) |
| `/staff/driver` | Driver | Yes | Driver Today; dock and cards route to `/staff/driver/...` and `/staff/scan` |
| `/staff/driver/trips` | Driver | Yes | Driver Trips; week pagination and details stay on `/staff/driver/trips` |
| `/staff/driver/map` | Driver | Yes | Driver Route Map; back/trips/profile links route to `/staff/driver/...` |
| `/staff/driver/more` | Driver | Yes | Driver More menu; links to `/staff/driver/...` and `/staff/notices` |
| `/staff/driver/profile` | Driver | Yes | Minimal alias to driver profile within `/staff/driver/` scope |
| `/staff/utility` | Utility | Yes | Truthful Utility Today; no speculative checklists; no `/staff-portal` loop |
| `/staff/utility/work` | Utility | Yes | Selectable Utility Work displaying exact read-only unavailable state |
| `/staff/utility/notices` | Utility | Yes | Minimal alias to notices within Utility workspace |
| `/staff/utility/more` | Utility | Yes | Minimal alias to More menu within Utility workspace |

---

## 3. Evidence Ledger

- **LOCAL TEST EVIDENCE — FOUNDATION SUITE:**
  `npx vitest run tests/lib/pwa/staff-pwa-foundation.test.ts` passes **22/22 tests**:
  - Role resolution across all 7 staff roles
  - Navigation profile mapping (Provider, CRM, Utility, Driver)
  - 5-item dock constraint with center Scan action
  - Selectable Utility Work pointing to read-only unavailable state
  - Web App Manifest (`id: "/cradlehub-staff"`, `scope: "/staff/"`, `start_url: "/staff/"`)
  - Primary wording in role-resolution splash
  - Service workers preserved untouched
  - Design tokens and touch target sizing
  - Connectivity state contracts (no false offline promises)
  - Proxy route protection (`PROTECTED_PREFIXES` includes `/staff` and `/scan`)
  - Workspace access enforcement and rejection of Owner/Manager/Marketer
  - Strict 1:1 server-UI operational group alignment cross-contract test
  - Driver canonical bottom nav emits strictly `/staff/...` (never `/driver`, `/staff-portal`, `/scan`)
  - Driver More emits strictly canonical destinations
  - Provider More emits strictly canonical destinations
  - CRM More emits strictly canonical destinations
  - Utility Today contains zero speculative checklists and zero `/staff-portal` links
- **LOCAL TEST EVIDENCE — AUTH SUITE:**
  `npx vitest run tests/lib/auth/` passes **6/6 test files (50 tests)**.
- **LOCAL TEST EVIDENCE — REGRESSION SUITE:**
  `npx vitest run tests/lib/pwa/ tests/lib/marketing/` passes **14/14 test files (172 tests)**.
- **LOCAL TEST EVIDENCE — TYPESCRIPT:**
  `npm run type-check` passes with 0 errors (`tsc --noEmit`).
- **LOCAL TEST EVIDENCE — FORMATTING:**
  `git diff --check` passes with zero formatting or whitespace errors.
- **LOCAL BROWSER RUNTIME:**
  **NOT VERIFIED** (Playwright automation driver failed to download binary `1.57.0` from upstream CDN due to 404). Dev server build and run was verified (`next dev` compiled with Ready in 4.8s).
- **PHYSICAL-DEVICE EVIDENCE:**
  **UNKNOWN / NOT VERIFIED** (No physical device testing is authorized or claimed).
- **PRODUCTION OUTCOME:**
  **NO PRODUCTION IMPACT** (Zero migrations, zero DB changes, zero deployment, zero production mutations).

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
- **No Deployment:** Deployment is NOT authorized and was not performed.

---

## 5. Rollback Plan

If rollback is required, revert the commit on `stage/pwa-c5-shared-foundation` or reset to accepted baseline `d11a8ca3623e0092829c683b7022dc302739b96b`.
Because no database migrations or schema alterations occurred, rollback is completely non-destructive to persistent data.
