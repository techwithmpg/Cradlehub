# CradleHub Hybrid Public Image Architecture

**Branch:** `stage/web-public-image-hybrid-20261116`  
**Base Commit (`origin/main`):** `a9ff58e9da53bc10a71a714839ce6d77dc895bb0`  
**Status:** Implemented & verified locally (not merged, pushed, deployed, or applied to production)

---

## 1. Three-Category Ownership Model

| Category | Storage Location | Asset Types Owned | Replacement Workflow |
| :--- | :--- | :--- | :--- |
| **Category A** | Git-tracked `public/images/` | Permanent brand marks (`cradle-wellness-living-logo.png`, `cradle-wellness-living-mark.png`, `cradle-logo-gold.png`, `cradle-logo-mark.svg`), standard service fallback (`/images/services/default-service.webp`), Boutique baseline defaults (`/images/boutique/*.webp`), permanent spa photography defaults (`/images/spa/**`) | Reviewed Git commit + redeploy (changing static files does not hot-swap an already deployed build) |
| **Category B** | Supabase Object Storage (`public-site-media`, public CDN) | Service catalog photos (`service-images/{service-id}/{slug}-{sha256}.{ext}`), Boutique hero/product/collection overrides (`boutique/...`), Marketing Studio sections/galleries/site-images/icons, and Branch photos | Immediate via Marketing Workspace or Services Admin UI, or backfill script using immutable content-hashed keys + `cacheControl: "31536000"` |
| **Category C** | PostgreSQL image references & metadata | `services.image_url` / `services.image_alt`, `branch_services.custom_image_url`, `branches.image_url`, `public_site_sections`, `public_site_assets`, `marketing_brand_settings`, `marketing_media_assets` | Updated atomically by CRM/Marketing Server Actions or backfill script; revalidated via Next.js cache tags and paths |

### Clean-Checkout & Repository Footprint Rule
- The `100` Category B service catalog images (`/images/services/001-*.webp` .. `100-*.webp`) remain **untracked** in `.gitignore` and live in Supabase Storage `public-site-media`.
- Only `35` compact Category A files (`5` existing `/images/boutique/*.webp` + `30` brand/spa/fallback files added in this stage: `4` brand assets, `1` `/images/services/default-service.webp`, and `25` `/images/spa/**` images) are committed under `public/images/`.

---

## 2. Canonical Image Consumer Map

| Surface / Route | Data Loader | Resolver / Component | Fallback Chain |
| :--- | :--- | :--- | :--- |
| **Home (`/`)** | `getPublicBranchesSafeCached()`, `getPublicServiceCatalogCached()`, `getPublicSiteSectionsCached({ includeDisabled: true })`, `getPublicBoutiqueCatalogCached()`, `getPublishedBrandSettingsCached()` | `HomePageSections`, `PublicMobileHome`, `MobileHomeHeroCarousel`, `MobileCalmCategories`, `MobileMostLovedTreatments`, `MobileSignatureRituals`, `MobileBranchesSection`, `MobileFinalCta`, `ServiceImage` | Branch/DB override → Storage/manifest ID → `/images/services/default-service.webp` / `SPA_IMAGES` / `BOUTIQUE_*` |
| **Boutique (`/products`)** | `getPublicBoutiqueCatalogCached()` | `resolveBoutiqueCatalog()`, `BoutiqueClient` (`<Image>`) | `public_site_sections` (`section_key='boutique'`) & `public_site_assets` (`section_key IN ('boutique_product','boutique_collection')`) → `BOUTIQUE_HERO_IMAGE` / `BOUTIQUE_PRODUCTS` / `BOUTIQUE_COLLECTIONS` |
| **Services (`/services`)** | `getPublicServiceCatalogCached()`, `getPublicBranchesSafeCached()`, `getPublicSiteSectionsCached({ includeDisabled: false })` | `ServiceCatalogClient`, `PublicMobileServices`, `ServiceImage` (`onError` client fallback + server existence check) | `branch_services.custom_image_url` → `services.image_url` → manifest by `service.id` → `/images/services/default-service.webp` |
| **Branches (`/branches`)** | `getPublicBranchesSafeCached()`, `getPublicSiteSectionsCached({ includeDisabled: false })` | `resolvePublicBranchImage()`, `PublicMobileBranches` (`<Image>`) | `branches.image_url` → `siteImages.branches_fallback_ambient` / `branch_card_*` → `/images/spa/contact.jpg` |
| **Contact (`/contact`)** | `getPublicBranchesSafeCached()` | `PublicMobileContact`, desktop contact view | Same branch chain via cached branches loader |
| **About & SEO Landing Pages (`/about`, `/massage-spa-bacolod`, `/home-service-massage-bacolod`)** | `getPublicSiteSectionsCached({ includeDisabled: false })` | `resolvePublicSiteSections()`, `<Image preload>` | `site_images` / managed section URL → `SPA_IMAGES` |
| **Booking Flow (`/book`, `/api/public/booking-context`)** | `getBranchServiceCatalogCached()`, `getPublicBranchesSafeCached()`, `api/public/booking-context` | `resolveServiceImage({ branchImageUrl, imageUrl }, { isAvailable: publicAssetExistsOnServer })` | `branch_services.custom_image_url` → `services.image_url` → manifest by `service.id` → `/images/services/default-service.webp` |
| **Header / Footer / Layout (`(public)/layout.tsx`)** | `getPublishedBrandSettingsCached()`, `getPublicBranchesSafeCached()` | `BrandLogo`, `SiteHeader`, `SiteFooter` | Published `marketing_brand_settings` → `/images/brand/cradle-wellness-living-logo.png` & `/images/brand/cradle-wellness-living-mark.png` |
| **Admin / Marketing Previews** | `getPublicSiteSections()`, `getPublicServiceCatalog()` | `ServiceImageThumbnail` (uses `<ServiceImage>`), `BranchesStudioView` (`resolvePublicBranchImage`) | Same safe normalizer & visual fallbacks without touching broken local assets |

---

## 3. Unified Resolution Precedence & Safety Boundaries

1. **Deterministic Service Order (`src/lib/service-images.ts` + `src/lib/public/public-image-resolver.ts`):**
   1. `branchImageUrl` (`branch_services.custom_image_url`) — tier `"override"`
   2. `imageUrl` (`services.image_url`) — tier `"database"`
   3. `service-images.json` entry matched **strictly by canonical `service.id`** (never by mutable service `name`) — tier `"manifest_fallback"`
   4. Category A `/images/services/default-service.webp` — tier `"default_fallback"`
2. **Client vs. Server Separation:**
   - Pure URL validation (`normalizeSafeImageUrl`, `resolveHybridImage`) lives in `src/lib/public/public-image-resolver.ts` (safe for Client & Server Components).
   - Filesystem verification (`publicAssetExistsOnServer`) lives strictly in `import "server-only"` `src/lib/public/server-image-assets.ts` and is injected via `options.isAvailable` from server loaders so Turbopack client bundles never import `node:fs`.
3. **Security Controls:**
   - Rejects non-HTTP(S) schemes (`javascript:`, `data:`, etc.), protocol-relative URLs (`//...`), embedded URL credentials, whitespace, and backslashes before reaching `<Image>` or `<ServiceImage>`.
   - Preserves existing RLS policies in Supabase Storage (`public-site-media` prefix `service-images/*` for service admins; full management for owners/digital marketers).

---

## 4. Caching, Cache Control, and Revalidation Matrix

- **Next.js Image Optimizer (`next.config.ts`):**
  - `formats: ["image/avif", "image/webp"]`
  - `qualities: [75, 85]`
  - `minimumCacheTTL: 14400` (4 hours)
- **Supabase Storage Upload Cache Headers:**
  - `DEFAULT_PUBLIC_IMAGE_CACHE_CONTROL = "31536000"` applied across `marketing-media.ts`, `icon-generator.ts`, `owner/services/actions.ts`, and `migrate-public-images-to-supabase-storage.mjs`.
  - Replacing an image writes a new content-hashed or UUID object path (`upsert: false` for catalog/marketing media) so long TTL caches never serve stale bytes after an edit.
- **Server Query Caching (`src/lib/public/public-site-cached.ts` & `src/lib/public/boutique-data.ts`):**
  - `getPublicSiteSectionsCached` (`tags: [cacheTags.publicSiteSections]`, `revalidate: 300`)
  - `getPublicSiteAssetsCached` (`tags: [cacheTags.publicSiteSections, cacheTags.boutiqueCatalog]`, `revalidate: 300`)
  - `getPublicBoutiqueCatalogCached` (`tags: [cacheTags.boutiqueCatalog, cacheTags.publicSiteSections]`, `revalidate: 300`)
  - `getPublicServiceCatalogCached` (`tags: [cacheTags.serviceCatalog]`, `revalidate: 300`)
  - `getPublicBranchesSafeCached` (`tags: [cacheTags.publicBranches]`, `revalidate: 3600`)
- **Mutation Invalidation (`src/lib/cache/cache-tags.ts`):**
  - `invalidatePublicSiteSurfaces()` invalidates `publicSiteSections`, `boutiqueCatalog`, and all public/marketing routes (`public-site.ts`, `marketing-content.ts`).
  - `marketing/branch-actions.ts` invalidates `cacheTags.publicBranches` alongside branch routes.
  - `owner/branches/actions.ts` (`revalidateBranchServiceSurfaces`) and `service-mutation.ts` (`invalidateServiceSurfaces`) invalidate `cacheTags.serviceCatalog`.

---

## 5. Backfill & Rollback Runbook

### Dry-Run Planning (Default — Zero Mutations)
```bash
node scripts/migrate-public-images-to-supabase-storage.mjs --target=LOCAL --source-dir=/path/to/images
```

### Execute Backfill Against Non-Production Target
```bash
node scripts/migrate-public-images-to-supabase-storage.mjs --target=STAGING --execute --verify-urls --report-file=backfill-staging-report.json
```

### Execute Backfill Against Production (Requires Explicit Authorization)
```bash
node scripts/migrate-public-images-to-supabase-storage.mjs --target=PRODUCTION --execute --confirm-production=CONFIRM_PRODUCTION_IMAGE_BACKFILL --verify-urls --report-file=backfill-prod-report.json
```

### Rollback
- Each executed update appends an exact `UPDATE public.services SET image_url = ... WHERE id = '...';` statement into the `--report-file` JSON (`rollbackSql`) while content-addressed objects in `public-site-media` remain immutable and non-destructive.
- Because `public/images/services/default-service.webp`, `/images/boutique/*.webp`, and `/images/spa/**` remain in Git, resetting `services.image_url` (or `public_site_assets`) immediately reverts cleanly without broken images.

### Hybrid Asset Integrity Verification
- Clean-checkout / CI check (verifies Category A static files + manifest ID integrity):
  ```bash
  node scripts/check-service-images.mjs
  ```
- Strict pre-migration check (requires all 100 local files present under `public/images/services/`):
  ```bash
  node scripts/check-service-images.mjs --strict-local
  ```
