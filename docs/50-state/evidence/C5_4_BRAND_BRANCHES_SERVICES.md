# C5.4 Brand + Branches + Services Studios Evidence & Independent Review Corrections

## 1. Branch & Baseline Metadata

- **Authorized Stage:** C5 Pass 4 (Brand + Branches + Services Studios)
- **Branch:** `stage/c5-4-brand-branches-services`
- **Accepted Base SHA:** `407d1c1b1af399ef510ddcfaf9c19e4c7778274a`
- **Execution Mode:** OWNER-APPROVED ACCELERATED VERIFICATION & INDEPENDENT REVIEW CORRECTIONS
- **Status:** COMPLETE / ALL CHECKS PASSING / STOPPED UNMERGED FOR INDEPENDENT REVIEW

---

## 2. Independent Review Corrections Implemented

### 2.1 A. Brand — Real Public Consumers & Safe Published Adapter
- **Published Brand Adapter:** Implemented `getPublishedBrandSettingsCached()` in `src/lib/queries/marketing-brand.ts` with Next.js `unstable_cache`, revalidation tag `cacheTags.marketingBrand`, and 3600s cache window.
- **Header & Footer Wiring:** `SiteHeader` and `SiteFooter` receive published brand settings (`logoUrl`, `logoAlt`, `taglineText`) with fallback to static SVG brand marks (`CradleLogoHorizontal` / `CradleLogoMark`).
- **Layout & Home Page Integration:** `src/app/(public)/layout.tsx` and `src/app/page.tsx` pass cached published brand settings to public layout components.
- **Favicon Architecture Boundary:** Next.js static asset `/favicon.ico` serves as the real favicon authority. `site_icon` in Brand Studio is clearly marked with an architecture boundary note explaining that root metadata is controlled by static Next.js favicon assets.

### 2.2 B. Brand Publication — Fail Closed
- **Batch Transaction Safety:** Implemented `updateBrandSettingsBatchOwner()` which performs batch upserts and fails closed on any child error.
- **Server Action Contract:** `updateBrandSettingAction` in `src/app/(dashboard)/marketing/brand-actions.ts` never claims success when any underlying write fails.
- **Automated Regression Tests:** Added `tests/lib/marketing/brand-server-actions.test.ts` verifying fail-closed behavior on database error, unauthorized non-owner access, and successful batch updates.

### 2.3 C. Branch Metadata — Unknown Key Preservation
- **Safe Metadata Merging:** `updateBranchPresentationAction` in `src/app/(dashboard)/marketing/branch-actions.ts` fetches existing `location_metadata` and safely merges `image_url` while preserving all custom, operational, coordinate, and unknown keys.
- **Automated Regression Tests:** Added `tests/lib/marketing/branch-metadata-preservation.test.ts` verifying that existing `operational_key`, `coordinates`, `landmarks`, and other custom keys remain intact after photo updates.

### 2.4 D. Branch Public Consumer Parity
- **Desktop `/branches`:** `src/app/(public)/branches/page.tsx` renders branch cards using `branch.location_metadata.image_url` with static fallback (`SPA_IMAGES`).
- **Mobile `/branches`:** `src/components/public/mobile/public-mobile-branches.tsx` renders branch cards using `branch.location_metadata.image_url` with static fallback (`SPA_IMAGES`).

### 2.5 E. Draft → Review → Owner Publish Routing
- **Domain Publication Routing:** `publishMarketingContentDraft()` in `src/lib/queries/marketing-content.ts` dispatches published content to the correct live store:
  - `content_type === "brand"`: Batch upserts to `marketing_brand_settings` and revalidates cache.
  - `content_type === "service"`: Updates `services` presentation columns via `updateServiceAction`.
  - `content_type === "section"` (`branch_*`): Updates branch presentation and preserves `location_metadata`.
  - `content_type === "section"`: Updates `public_site_sections` via `updatePublicSiteSection`.

### 2.6 F. Submit-for-Review UX
- **Immediate Draft Submission:** In `BrandStudioView`, `BranchesStudioView`, and `ServicesStudioView`, active drafts are derived reactively from server action states and draft listings.
- **No Page Reload Needed:** Saving a new draft immediately exposes the "Submit for Review" button without requiring a full page refresh. Marketers never see direct live update controls.

### 2.7 G. Media Usage Analyzer Type Safety
- **Type Compatibility:** Added `"branch"` to `MediaAssetUsageConsumerType` in `src/lib/marketing/media-usage-analyzer.ts`.
- **Safe Archival:** All 8 media usage consumer types (`section`, `brand`, `service`, `branch`, `seo`, `page`, `component`, `draft`) are analyzed to prevent accidental archival of active assets.

---

## 3. Comprehensive Verification Results

### 3.1 Targeted Marketing Test Suite
```bash
pnpm vitest run tests/lib/marketing/
```
**Result:** 9 test files, 106 tests passing (100% PASS).
- `tests/lib/marketing/brand-server-actions.test.ts` (3 tests) — PASS
- `tests/lib/marketing/branch-metadata-preservation.test.ts` (2 tests) — PASS
- `tests/lib/marketing/brand-branches-services-studios.test.tsx` (12 tests) — PASS
- `tests/lib/marketing/website-studio.test.tsx` (32 tests) — PASS
- `tests/lib/marketing/media-queries.test.ts` (14 tests) — PASS
- `tests/lib/marketing/media-usage.test.ts` (9 tests) — PASS
- `tests/lib/marketing/media-library.test.tsx` (9 tests) — PASS
- `tests/lib/marketing/public-consumer-parity.test.tsx` (21 tests) — PASS
- `tests/lib/marketing/marketing-studio-foundation-migration.test.ts` (4 tests) — PASS

### 3.2 Full Repository Vitest Suite
```bash
pnpm vitest run
```
**Result:** 208 test files, 1,474 tests passing (100% PASS, 0 failures).

### 3.3 TypeScript Type Check
```bash
pnpm type-check
```
**Result:** Exit Code 0 (0 errors).

### 3.4 ESLint Static Analysis
```bash
pnpm lint
```
**Result:** Exit Code 0 (0 errors).

### 3.5 Code Formatting Check
```bash
pnpm format:check
```
**Result:** Exit Code 0 (All files matched Prettier code style).

### 3.6 Next.js Production Build
```bash
pnpm build
```
**Result:** Exit Code 0 (Compiled successfully; 115/115 static & dynamic pages generated).

---

## 4. Production Evidence & Stop Condition

```
REPOSITORY-RECORDED PRODUCTION EVIDENCE:
C5.4 Brand + Branches + Services Studios Independent Review Corrections have been fully implemented, verified, and reconciled on branch stage/c5-4-brand-branches-services based on accepted main 407d1c1b1af399ef510ddcfaf9c19e4c7778274a.

All 1,474 repository tests pass, TypeScript compilation passes with 0 errors, ESLint passes with 0 errors, Prettier format check passes, and Next.js production build succeeds with 115 routes optimized.

In strict compliance with repository agent rules and owner governance:
- Zero schema migrations, RLS changes, Auth, or Storage-policy modifications were introduced.
- Branch stage/c5-4-brand-branches-services is stopped unmerged for independent owner review.
```
