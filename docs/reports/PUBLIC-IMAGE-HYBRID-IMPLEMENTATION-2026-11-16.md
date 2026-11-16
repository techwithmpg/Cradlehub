# CradleHub Web — Hybrid Public Image Architecture Implementation Report

**Date:** 2026-11-16  
**Repository:** `techwithmpg/Cradlehub`  
**Implementation Branch:** `stage/web-public-image-hybrid-20261116`  
**Verified Base Commit (`origin/main`):** `a9ff58e9da53bc10a71a714839ce6d77dc895bb0`  
**Worktree Path:** `E:\cradlehub-image-hybrid`  
**Deployment / Mutation Status:** Local implementation & verification complete; **NOT merged to `main`, NOT pushed, NOT deployed, and NO production database or Storage mutated.**

---

## 1. Architecture Assessment & Recommendations

On `origin/main` (`a9ff58e9`), the public website suffered from five structural gaps:
1. **Clean-Checkout Asset Gap (`7cbd768d`):** `.gitignore` excluded `/public/images/services/*.webp`, `/public/images/spa/**`, `/public/images/brand/**`, and `/public/images/services/default-service.webp`. Only 5 files (`/images/boutique/*.webp`) were Git-tracked, leaving **134 of 139 unique code image references missing** on a fresh clone (including 4 orphaned paths absent even locally: `cradle-logo.png`, `cradle-mark.png`, `cradle-main-spa.webp`, `cradle-sm-branch.webp`).
2. **Unoptimized Mobile Rendering:** `7` mobile components rendered `8` raw `<img>` elements directly, bypassing Next.js AVIF/WebP image optimization and triggering ESLint `@next/next/no-img-element` warnings.
3. **Name-Based Service Lookup Coupling:** Service image metadata risked drift/collision if keyed dynamically rather than strictly by canonical `service.id`.
4. **Hardcoded Static Boutique Catalog Images:** `/products` (`BoutiqueClient`), Home (`HomePageSections`), and Mobile (`MobileSignatureRituals`) could not pick up Marketing/Storage image updates from `public_site_sections` / `public_site_assets`.
5. **Uncached Public Loaders & Missing `cacheControl`:** Public routes queried `getPublicBranches()`, `getPublicServiceCatalog()`, and `getPublicSiteSections()` uncached on every request and lacked offline/unconfigured transport resilience; Storage uploads omitted explicit 1-year `cacheControl: "31536000"` headers and some mutations (`marketing/branch-actions.ts`, `public-site.ts`) lacked tag invalidations.

The implemented **3-category Hybrid Architecture** cleanly separates permanent Git-tracked brand/fallback assets (**Category A**), CDN-cached Supabase Storage media (**Category B**), and PostgreSQL metadata/URL references (**Category C**), paired with unified deterministic resolution, tag-driven revalidation, and clean-checkout server fallbacks.

---

## 2. Complete Image Consumer Map

| Surface / Route | Server Loaders / API | Client / UI Consumers | Resolution Strategy |
| :--- | :--- | :--- | :--- |
| **Home (`/`)** (`src/app/page.tsx`) | `getPublicBranchesSafeCached()`, `getPublicServiceCatalogCached()`, `getPublicSiteSectionsCached({ includeDisabled: true })`, `getPublicBoutiqueCatalogCached()`, `getPublishedBrandSettingsCached()` | `HomePageSections`, `PublicMobileHome`, `MobileHomeHeroCarousel`, `MobileCalmCategories`, `MobileMostLovedTreatments`, `MobileSignatureRituals`, `MobileBranchesSection`, `MobileFinalCta`, `ServiceImage` | All images use Next.js `<Image>` or `<ServiceImage>`; Boutique cards receive Storage/DB overrides with fallback to `BOUTIQUE_PRODUCTS` |
| **Boutique (`/products`)** (`src/app/(public)/products/page.tsx`) | `getPublicBoutiqueCatalogCached()` | `resolveBoutiqueCatalog()`, `BoutiqueClient` (`<Image>`) | Reads `public_site_sections` (`section_key='boutique'`) and `public_site_assets` (`boutique_product`, `boutique_collection`), falling back to `/images/boutique/*.webp` & `/images/spa/*.jpg` |
| **Services (`/services`)** (`src/app/(public)/services/page.tsx`) | `getPublicServiceCatalogCached()`, `getPublicBranchesSafeCached()`, `getPublicSiteSectionsCached({ includeDisabled: false })` | `ServiceCatalogClient`, `PublicMobileServices`, `ServiceImage` | `branchImageUrl` → `imageUrl` → manifest by `service.id` (verified on server via `publicAssetExistsOnServer`) → `/images/services/default-service.webp` + client `onError` fallback |
| **Branches (`/branches`) & Contact (`/contact`)** | `getPublicBranchesSafeCached()`, `getPublicSiteSectionsCached({ includeDisabled: false })` | `resolvePublicBranchImage()`, `PublicMobileBranches`, `PublicMobileContact` | `branches.image_url` → `location_metadata.image_url` → `siteImages` fallback → `/images/spa/contact.jpg` / `/images/spa/booking.jpg` |
| **About & SEO Landing Pages (`/about`, `/massage-spa-bacolod`, `/home-service-massage-bacolod`)** | `getPublicSiteSectionsCached({ includeDisabled: false })` | `resolvePublicSiteSections()`, `<Image preload>` | `site_images` / managed section URL → Category A `SPA_IMAGES` |
| **Booking Flow (`/book`, `/api/public/booking-context`)** | `getBranchServiceCatalogCached()`, `api/public/booking-context` | `BookingWizard`, `ServiceImage` | Passes `branchImageUrl` override + `imageUrl` + `{ isAvailable: publicAssetExistsOnServer }` to `resolveServiceImage` |
| **Public Shell / Brand (`(public)/layout.tsx`)** | `getPublicBranchesSafeCached()`, `getPublishedBrandSettingsCached()` | `PublicShell`, `SiteHeader`, `SiteFooter`, `BrandLogo` | Published `marketing_brand_settings` logo/mark → `/images/brand/cradle-wellness-living-logo.png` & `cradle-wellness-living-mark.png` |
| **Admin / Marketing Previews** | `getPublicSiteSections()`, `getPublicServiceCatalog()` | `ServiceImageThumbnail` (`<ServiceImage>`), `BranchesStudioView` (`resolvePublicBranchImage`) | Eliminates raw `<img>` tags and dead branch asset paths (`cradle-main-spa.webp` / `cradle-sm-branch.webp`) |

---

## 3. Asset Inventory & Category Assignments

| Category | Directory / Storage Scope | Count | Measured Size | Purpose |
| :--- | :--- | ---: | ---: | :--- |
| **Category A (Git-tracked `public/images/`)** | `public/images/boutique/*.webp` (existing) | 5 files | ~379 KB | Baseline Boutique hero & core products (`boutique-hero`, `ginger-oil`, `borneol-oil`, `linen-spray`, `gift-certificate`) |
| **Category A (Git-tracked `public/images/`)** | `public/images/brand/*` | 4 files | ~359 KB | Official logos & marks (`cradle-wellness-living-logo.png`, `cradle-wellness-living-mark.png`, `cradle-logo-gold.png`, `cradle-logo-mark.svg`) |
| **Category A (Git-tracked `public/images/`)** | `public/images/services/default-service.webp` | 1 file | ~36 KB | Canonical service fallback placeholder |
| **Category A (Git-tracked `public/images/`)** | `public/images/spa/**` | 25 files | ~1.94 MB | Approved permanent hero, ambience, category, home ritual, and branch default photography |
| **Total Category A Checked Into Git** | `public/images/**` | **35 files** | **2,910,390 bytes (~2.78 MB)** | Down from 143 local files / 8,395,409 bytes (~8.01 MB); saves **~5.23 MB** / 100 heavy service WebPs from Git |
| **Category B (Supabase Storage `public-site-media`)** | `service-images/{service-id}/{slug}-{sha256}.{ext}` | 100 files | Migrated via backfill | Service catalog photos (untracked locally; served from CDN) |
| **Category B (Supabase Storage `public-site-media`)** | `boutique/{hero\|products\|collections}/...` | 10 files | Migrated via backfill | Boutique hero (`1`), products (`6`), collections (`3`) overrides |
| **Category C (PostgreSQL)** | `services`, `branch_services`, `branches`, `public_site_sections`, `public_site_assets`, `marketing_brand_settings` | Authoritative refs | — | URL pointers, alt text, metadata, sort order, visibility |

---

## 4. Unified Resolution Design

- **`src/lib/public/public-image-resolver.ts` (browser-safe):**
  - Exports `DEFAULT_PUBLIC_IMAGE_CACHE_CONTROL = "31536000"`, `normalizeSafeImageUrl`, and `resolveHybridImage`.
  - Validates URLs: rejects non-HTTP(S) schemes (`javascript:`, `data:`), protocol-relative (`//`), credentials in authority (`user:pass@`), whitespace, and backslashes; includes a safe regex authority validator when global `URL` is replaced by non-constructor test stubs (`{ ...URL, createObjectURL }`).
- **`src/lib/public/server-image-assets.ts` (`import "server-only"`):**
  - Exports `publicAssetExistsOnServer`, checking disk presence under `public/` with in-memory memoization (bypassed under `process.env.VITEST`).
  - Kept strictly isolated from client bundles so client imports of `@/lib/service-images` never pull `node:fs` into Turbopack client chunks.
- **`src/lib/service-images.ts`:**
  - `resolveServiceImage(service, options)` resolves in exact priority: `branchImageUrl` → `imageUrl` → `service-images.json` lookup **strictly by `service.id`** (never by `name`) → `DEFAULT_SERVICE_IMAGE_URL` (`/images/services/default-service.webp`).

---

## 5. Supabase Storage & Database Alignment

- **Zero unapproved DDL / bucket / RLS changes:** Reuses existing bucket `public-site-media`, existing folder-scoped RLS policies (`service-images/*` from `20261029150000_crm_services_catalog_authorization.sql`), and existing tables (`public_site_sections`, `public_site_assets` with allowed `section_key` regex `^[a-z0-9_:-]+$`, `services`, `branch_services`, `branches`, `marketing_brand_settings`).
- **Cache-Control Alignment:** `DEFAULT_PUBLIC_IMAGE_CACHE_CONTROL` (`"31536000"`) added to:
  - `src/lib/queries/marketing-media.ts`
  - `src/lib/marketing/icon-generator.ts`
  - `src/app/(dashboard)/owner/services/actions.ts`
  - `scripts/migrate-public-images-to-supabase-storage.mjs`

---

## 6. Backfill & Migration Strategy

- Implemented **`scripts/migrate-public-images-to-supabase-storage.mjs`**:
  - **Fail-closed target safety:** Requires `--target=LOCAL|TEST|STAGING|PRODUCTION`; defaults to `--dry-run`. Executing against `PRODUCTION` requires both `--execute` and `--confirm-production=CONFIRM_PRODUCTION_IMAGE_BACKFILL`, and validates Supabase URL host consistency.
  - **Idempotent & content-hashed:** Generates 12-char SHA-256 hashes for object paths (`service-images/{id}/{slug}-{hash}.webp` and `boutique/...`), skips objects whose DB `image_url` already points to that content hash in `public-site-media`, preserves existing `services.image_alt` and `public_site_sections` copy, and generates `rollbackSql` statements into optional `--report-file`.
  - **Dry-run verification against `E:\cradlehub\public\images`:** `plannedUploads: 110`, `missingSourceFiles: 0`, `errors: 0`.
- Updated **`scripts/check-service-images.mjs`**:
  - Default hybrid check verifies all 16 core Category A static/fallback files exist and validates all 100 manifest service IDs & filenames (`--strict-local` option preserves full local file enforcement when needed).

---

## 7. Marketing Studio & Admin Compatibility Review

- Updated `src/lib/marketing/website-images-inventory.ts` to replace non-existent `/images/brand/cradle-logo.png` and `/images/brand/cradle-mark.png` with `/images/brand/cradle-wellness-living-logo.png` and `/images/brand/cradle-wellness-living-mark.png`.
- Updated `src/components/features/marketing/branches/branches-studio-view.tsx` to replace non-existent `cradle-main-spa.webp` / `cradle-sm-branch.webp` with `resolvePublicBranchImage`.
- Updated `src/components/features/services/service-image-thumbnail.tsx` to wrap `<ServiceImage>` for consistent `onError` client fallback.
- Unified Next.js cache tag invalidation (`src/lib/cache/cache-tags.ts`):
  - Added `cacheTags.publicSiteSections`, `cacheTags.boutiqueCatalog`, and `invalidatePublicSiteSurfaces()` with Vitest partial-mock safety (`"revalidateTag" in nextCache`).
  - Wired `invalidatePublicSiteSurfaces()` into `src/lib/queries/public-site.ts` and `src/lib/queries/marketing-content.ts`.
  - Added `invalidateTag(cacheTags.publicBranches)` in `src/app/(dashboard)/marketing/branch-actions.ts` and `invalidateTag(cacheTags.serviceCatalog)` in `src/app/(dashboard)/owner/branches/actions.ts`.

---

## 8. Performance & Clean-Checkout Verification

- **Next.js Image Optimizer (`next.config.ts`):** Added `minimumCacheTTL: 14400` (preserving `formats: ["image/avif", "image/webp"]` and `qualities: [75, 85]`).
- **Mobile `<Image>` Optimization:** Replaced all **8 raw `<img>` elements** across all **7 mobile components** (`mobile-home-hero-carousel.tsx`, `mobile-calm-categories.tsx`, `mobile-most-loved-treatments.tsx`, `mobile-signature-rituals.tsx`, `mobile-branches-section.tsx`, `mobile-final-cta.tsx`, `public-mobile-services.tsx`), fixed unused prop warning in `mobile-experience-grid.tsx`, and replaced deprecated Next 16 `priority` prop with `preload` on desktop hero `<Image>` instances (`hero-section.tsx`, `home-service-massage-bacolod/page.tsx`, `massage-spa-bacolod/page.tsx`).
- **Server Caching (`src/lib/public/public-site-cached.ts` & `src/lib/public/boutique-data.ts`):**
  - Switched `/`, `(public)/layout.tsx`, `/products`, `/services`, `/branches`, `/contact`, `/about`, `/home-service-massage-bacolod`, and `/massage-spa-bacolod` to `React.cache` + `unstable_cache` loaders with `isPublicReadTransportFailure` fallback.
- **Measured Local Production Build (`next build` + `next start` against isolated `127.0.0.1:55399` mock Supabase):**
  - `next build`: Compiled in `48s`, TypeScript finished in `103s`, generated `155/155` static pages in `13.0s`, exit `0`.
  - Note: Running `next build` completely unconfigured without `NEXT_PUBLIC_SUPABASE_URL` fails on pre-existing dashboard page `/owner/marketing` (`Error: supabaseUrl is required`), whereas all public routes build cleanly.
  - `next start` SSR route timings (warm / `200 OK`, `0` REST hits): `/` `52ms` (`226,325 B`), `/products` `35ms` (`143,693 B`), `/services` `28ms` (`122,059 B`), `/branches` `37ms` (`145,215 B`), `/about` `28ms` (`124,865 B`), `/contact` `19ms` (`117,006 B`).
- **Headless Chromium Verification (`measure_images.mjs`, desktop `1440x900` & mobile `390x844` across `/`, `/products`, `/services`, `/branches`, `/about`, `/contact` in both `local_mock_supabase` and `unconfigured_clean_checkout`):**
  - **24 / 24** route+viewport checks returned HTTP `200`, `hasNextError: false`, `brokenVisible: []` (`0`), `brokenAny: []` (`0`), `unoptimizedRaster: []` (`0`), `failedImgRequests: []` (`0`), and served `image/avif` via `/_next/image`.

---

## 9. Security & Reliability Controls

- Strict `normalizeSafeImageUrl()` validation across all resolvers and `<ServiceImage>`.
- `server-only` isolation for `server-image-assets.ts`, `boutique-data.ts`, and `public-site-cached.ts`.
- Explicit `--target` & `--confirm-production` gates in `scripts/migrate-public-images-to-supabase-storage.mjs`; zero hardcoded secrets or credentials anywhere in code or docs.
- Graceful degradation (`[]` / `resolveBoutiqueCatalog({ verifyAssets: true })` / `DEFAULT_SERVICE_IMAGE_URL`) on transport failures or missing Supabase env vars on public routes.

---

## 10. Automated Tests & Verification Summary (Post-Final-Edit)

- `pnpm exec tsc --noEmit`: **Passed** (`FINAL_TSC_EXIT=0`).
- `pnpm exec eslint ...` (all touched/new files): **Passed** (`FINAL_ESLINT_EXIT=0`, `0` errors, `0` `@next/next/no-img-element` warnings, `1` pre-existing `_revisions` unused-var warning in `branches-studio-view.tsx`).
- `node scripts/check-service-images.mjs`: **Passed** (`FINAL_CHECK_EXIT=0`, 16 Category A files present; 100 service manifest IDs verified).
- `node scripts/migrate-public-images-to-supabase-storage.mjs --dry-run --target=LOCAL --source-dir=E:/cradlehub/public/images`: **Passed** (`FINAL_DRYRUN_EXIT=0`, `plannedUploads: 110`, `missingSourceFiles: 0`, `errors: 0`).
- `pnpm exec vitest run tests/lib/public tests/lib/marketing tests/app/owner tests/lib/services src/lib/services src/components/features/services`: **36 / 36 test files passed, 347 / 347 tests passed** (`FINAL_VITEST_EXIT=0`), including new `tests/lib/public/hybrid-image-architecture.test.tsx` (`9` tests).

---

## 11. Changed Files & Branch Reconciliation Note

- **Branch Provenance:** `stage/web-public-image-hybrid-20261116` is branched cleanly from verified `origin/main` (`a9ff58e9da53bc10a71a714839ce6d77dc895bb0`). Local repo `E:\cradlehub` sits on `main` (`bb580daa`) containing unpushed Emerald Glass & Boutique CRM integration work; both were preserved untouched. Before merging both tracks later, reconcile Marketing CMS & Boutique Catalog changes between `bb580daa` and `stage/web-public-image-hybrid-20261116` cleanly.
- **New Source, Test, Script, Asset & Doc Files:**
  - `src/lib/public/public-image-resolver.ts`, `src/lib/public/server-image-assets.ts`, `src/lib/public/boutique-data.ts`, `src/lib/public/public-site-cached.ts`
  - `scripts/migrate-public-images-to-supabase-storage.mjs`
  - `tests/lib/public/hybrid-image-architecture.test.tsx`
  - `public/images/brand/*` (4 files), `public/images/services/default-service.webp`, `public/images/spa/**` (25 files)
  - `docs/architecture/PUBLIC-IMAGE-ARCHITECTURE.md`, `docs/reports/PUBLIC-IMAGE-HYBRID-IMPLEMENTATION-2026-11-16.md`
- **Modified Code Files:**
  - `next.config.ts`, `scripts/check-service-images.mjs`
  - `src/lib/cache/cache-tags.ts`, `src/lib/service-images.ts`, `src/lib/public/public-site-data.ts`
  - `src/lib/queries/{public-site,services,marketing-content,marketing-media}.ts`
  - `src/lib/marketing/{icon-generator,website-images-inventory}.ts`
  - `src/app/page.tsx`, `src/app/api/public/booking-context/route.ts`
  - `src/app/(public)/{layout,products/page,services/page,branches/page,contact/page,about/page,home-service-massage-bacolod/page,massage-spa-bacolod/page}.tsx`
  - `src/app/(dashboard)/{owner/services/actions.ts,owner/branches/actions.ts,marketing/branch-actions.ts}`
  - `src/components/public/{hero-section,service-image,boutique-client,home-page-sections}.tsx`
  - `src/components/public/mobile/{public-mobile-home,mobile-home-hero-carousel,mobile-calm-categories,mobile-most-loved-treatments,mobile-signature-rituals,mobile-branches-section,mobile-final-cta,mobile-experience-grid,public-mobile-services}.tsx`
  - `src/components/features/services/service-image-thumbnail.tsx`, `src/components/features/marketing/branches/branches-studio-view.tsx`

---

## 12. Next Required Authorization Gates Before Deployment

1. **Code Review & Merge Approval:** Review `stage/web-public-image-hybrid-20261116` against `origin/main` (`a9ff58e9`) and authorize merge/reconciliation alongside any pending Emerald Glass / Boutique CRM stages.
2. **Staging Backfill Verification:** Authorize running `scripts/migrate-public-images-to-supabase-storage.mjs --target=STAGING --execute --verify-urls --report-file=backfill-staging.json` with source files (`100` service + `10` Boutique assets) against Staging Supabase.
3. **Production Backfill & Deploy Authorization:** Separate explicit owner approval required to run `--target=PRODUCTION --execute --confirm-production=CONFIRM_PRODUCTION_IMAGE_BACKFILL` and deploy `main` to production.
