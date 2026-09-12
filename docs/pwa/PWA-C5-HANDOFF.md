# CradleHub Staff PWA — PWA-C5 Handoff and Status

**Stage:** PWA-C5 — Shared Foundation (Role/Authority Consistency Correction Pass)
**Status:** PASS — READY FOR EXTERNAL RE-REVIEW
**Accepted C4/main baseline:** `d11a8ca3623e0092829c683b7022dc302739b96b`
**Starting C5 head for this review:** `6d3c6e088b232316df77c5a58b6136be4dfa7924`
**Branch:** `stage/pwa-c5-shared-foundation`
**Authority:** [PWA-GOV-007](../11-DECISION-LOG.md#staff-pwa-decisions), [PWA-GOV-008](../11-DECISION-LOG.md#pwa-gov-008); owner architecture decisions  
**Next Stage:** PWA-C6 (Scanner) — **STRICTLY NOT AUTHORIZED**  

---

## 1. Executive Summary & Deliverables

Stage PWA-C5 has completed the shared mobile foundation implementation and successfully resolved the final role/authority consistency items identified during external review:

1. **Canonical Utility Authorization Correction:**
   - Corrected `requireCanonicalUtilityAccess` in `src/app/(dashboard)/staff/utility/page.tsx` to query both `system_role` and `staff_type`.
   - Replaced the ad-hoc authorization check with `canAccessCanonicalUtility`, delegating directly to trusted server-side `resolveStaffPwaOperationalGroup(role, staffType) === "utility"`.
   - Strictly denies Owner, Manager, CRM, and Provider roles from independently accessing the canonical Utility workspace. Unauthenticated requests redirect to `/login`; authenticated non-utility users redirect safely to `/staff`.

2. **Elimination of the Runtime Role-Resolution Split:**
   - Aligned `getStaffPortalMode()` in `src/lib/staff/get-staff-portal-mode.ts` with the canonical `resolveStaffOperationalRole()` and `resolveNavigationProfile()` contracts.
   - `service_head` and `service_staff` system roles (and `facialist` staff type) now resolve consistently to `"therapist"` (Provider mode), eliminating the split where the server authorized Provider but legacy UI components rendered Basic Staff.
   - Updated `src/app/(dashboard)/staff/more/page.tsx` to explicitly resolve operational role and navigation profile, rendering `<TherapistMoreMenu isCanonical />` for Provider identities.
   - Canonical Today (`/staff`), Schedule (`/staff/schedule`), and More (`/staff/more`) now render 100% consistent Provider interfaces for `service_head` and `service_staff`.

3. **Scope-Escape Resolution & Route Containment (Preserved from Previous Passes):**
   - Driver bottom dock and More menu strictly output canonical `/staff/driver/...` destinations.
   - Therapist headers, service cards, and schedule links strictly navigate within `/staff/...`.
   - Basic Staff headers, assignment cards, and schedule links strictly navigate within `/staff/...`.
   - Utility Today contains zero speculative checklists and zero `/staff-portal` redirects. Work route (`/staff/utility/work`) displays the exact read-only unavailable state.

4. **Manifest, Icons, and Service Worker Preservation:**
   - Manifest ID: `/cradlehub-staff`
   - Start URL: `/staff/`
   - Scope: `/staff/`
   - Display: `standalone`
   - Application Name: `CradleHub Staff`
   - Workspace Identity: `Team Workspace`
   - Dedicated launcher icons (`/staff-manifest-icon-192.png`, `/staff-manifest-icon-512.png`) preserved.
   - Service workers (`public/sw.js` and `public/cradlehub-push-sw.js`) preserved completely untouched.

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
  `npx vitest run tests/lib/pwa/staff-pwa-foundation.test.ts` passes **26/26 tests**:
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
  - Canonical Utility authorization contract (`canAccessCanonicalUtility` allows utility/staff+utility, denies owner/manager/crm/provider/driver)
  - Runtime role-resolution split prevention (`getStaffPortalMode` aligns with operational resolver for `service_head`, `service_staff`, `facialist`)
  - Canonical Today, Schedule, and More choose Provider profile for `service_head` and `service_staff`
  - Complete exclusion of Manager, Owner, and Marketer roles from Staff PWA operational roles
- **LOCAL TEST EVIDENCE — AUTH SUITE:**
  `npx vitest run tests/lib/auth/` passes **6/6 test files (50 tests)**.
- **LOCAL TEST EVIDENCE — REGRESSION SUITE:**
  `npx vitest run tests/lib/pwa/ tests/lib/marketing/` passes **14/14 test files (176 tests)**.
- **LOCAL TEST EVIDENCE — TYPESCRIPT:**
  `npm run type-check` passes with 0 errors (`tsc --noEmit`).
- **LOCAL TEST EVIDENCE — FORMATTING:**
  `git diff --check` passes with zero formatting or whitespace errors.
- **LOCAL BROWSER RUNTIME:**
  **LOCAL BROWSER RUNTIME — NOT VERIFIED** (Playwright automation driver failed to download binary `1.57.0` from upstream CDN due to 404). Dev server build and compilation verified (`next dev` compiled with Ready in 4.8s).
- **PHYSICAL-DEVICE EVIDENCE:**
  **UNKNOWN / NOT VERIFIED** (No physical device testing is authorized or claimed).
- **PRODUCTION OUTCOME:**
  NO PRODUCTION DEPLOYMENT / ACCESS / MUTATION PERFORMED.
  PRODUCTION BEHAVIOR AND IMPACT: UNKNOWN / NOT VERIFIED.
  *(Any historical production references in repository records constitute REPOSITORY-RECORDED PRODUCTION EVIDENCE).*

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

If rollback or revision is required:
- Preserve current working evidence.
- If unmerged, retain and revise the working stage branch (`stage/pwa-c5-shared-foundation`).
- If later merged and rollback is required, use a targeted, reviewed revert against the then-current accepted state on `main`.
- No database rollback is required because C5 contains no database or schema migrations.
