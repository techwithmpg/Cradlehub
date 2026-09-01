# C5.4 Brand + Branches + Services Studios Evidence & Independent Review Corrections

## 1. Branch & Baseline Metadata

- **Authorized Stage:** C5 Pass 4 (Brand + Branches + Services Studios + UX Unification + Media Contracts + Dynamic Site Icon Generator + Security & Metadata Priority Corrections)
- **Branch:** `stage/c5-4-brand-branches-services`
- **Accepted Base SHA:** `407d1c1b1af399ef510ddcfaf9c19e4c7778274a`
- **Execution Mode:** OWNER-AUTHORIZED C5.4 DYNAMIC ICON + MEDIA SECURITY FINAL CORRECTION
- **Status:** COMPLETE / ALL CHECKS PASSING / STOPPED UNMERGED FOR INDEPENDENT REVIEW

---

## 2. Implemented Capabilities & Security Invariants

### 2.1 Unified Marketing Studio Visual System

- **Standardized Surface Architecture:** All 5 studios (Website, Brand, Branches, Services, and Media Library) use the canonical CradleHub warm cream / light surface design system via modular shared primitives:
  - `MarketingStudioPanel`: Standardized light panel card container with consistent border and header tokens.
  - `MarketingFieldGroup`: Grouped section container for form fields and settings.
  - `MarketingMediaField`: Dedicated media selector integrating real-time contract badges and picker modal.
  - `MarketingActionBar`: Unified role-aware action bar for Draft → Submit → Review → Publish workflows.
- **Dedicated Card Previews:** Public-facing previews (Brand Live Preview, Branch public card, and Service catalog card) retain their rich dark-green spa aesthetic (`#0D2B20`, `#10261D`, gold accents `#C8A96B`/`#D4B57A`).
- **Horizontal Studio Navigation Rail:** Persistent horizontal navigation rail at the top with mobile touch scrolling and responsive layouts.

### 2.2 Strict Media Field Contracts & Sharp Server Validation

- **8 Media Intent Contracts:**
  1. `HEADER_LOGO`: Wide horizontal header logo (SVG, PNG, WebP · Min 400×80px · Max 2MB · 4.0 aspect ratio).
  2. `FOOTER_LOGO`: Secondary footer brand emblem (SVG, PNG, WebP · Min 300×80px · Max 2MB · 3.5 aspect ratio).
  3. `BRAND_MARK`: Square brand icon / mark (SVG, PNG, WebP · Min 512×512px · Max 2MB · 1.0 square).
  4. `SITE_ICON_MASTER`: High-res master icon source (SVG, PNG, WebP · Min 512×512px · Max 4MB · 1.0 square).
  5. `BRANCH_PHOTO`: Public branch exterior / interior photo (WebP, JPG, PNG · Min 800×450px · Max 4MB · 16:9 landscape).
  6. `SERVICE_PHOTO`: Treatment / service photography (WebP, JPG, PNG · Min 600×400px · Max 4MB · 3:2 landscape).
  7. `HERO_BACKGROUND`: Full-bleed cinematic hero background (WebP, JPG · Min 1920×1080px · Max 6MB · 16:9 widescreen).
  8. `FEATURE_PORTRAIT`: Therapist & treatment portrait photography (WebP, JPG, PNG · Min 600×800px · Max 4MB · 3:4 portrait).
- **Upload Pipeline Enforcement:** `uploadMarketingMediaFile` validates `mediaIntent`, reads buffer, and runs `validateMediaBuffer(buffer, file.type, contract)` *before* creating draft rows or uploading to Supabase Storage.
- **SVG Security Validation:** `sanitizeSvgCheck` validates XML structure and rejects dangerous tags (`<script`, `javascript:`, `onload=`, `onerror=`, `<foreignObject`, `<iframe`, `<embed`, `<object`). Sharp parses XML/viewBox and inspects dimensions.

### 2.3 Dynamic Favicon & Site Icon Package Generator (Security & Authority Corrections)

- **Authorization Gate:** `generateSiteIconAction` enforces `getMarketingAccessContext()` (`digital_marketer` or `owner` only). Unauthorized callers fail closed before file processing or storage access.
- **Elimination of Arbitrary Remote Fetches:** Removed `fetch(sourceUrl)`. For media library selection, accepts `sourceAssetId`, fetches row, validates active status, and downloads directly from `public-site-media` bucket via Supabase storage client.
- **Fail-Closed Storage Execution:** Every required variant undergoes Sharp resize + upload + public URL resolution; any failure aborts generation and returns `success: false` without fabricating partial URLs.
- **7 Standard PNG Variants:** Generates `icon16`, `icon32`, `icon48`, `apple180`, `icon192`, `icon512`, `maskable512`. Fake ICO generation is eliminated; legacy browsers fallback to static `/favicon.ico`.
- **Next.js Metadata Authority:** Removed `src/app/favicon.ico` and `src/app/favicon-old.ico` to prevent App Router file-based metadata from overriding dynamic `generateMetadata()` in `src/app/layout.tsx`. Preserved static icons in `public/favicon.ico` and `public/favicon-old.ico`.
- **Canonical Brand Draft Publication:** `publishMarketingContentDraft` validates full shape and `generationStatus === "ready"` of `siteIconPackage` before persisting to `marketing_brand_settings.site_icon`.

### 2.4 Preservation of All Prior Governance Invariants

- **Branch Isolation:** `BranchesStudioView` strictly isolates `content_type === "section"` AND `content_key === branch_<selected branch id>` with zero contact draft contamination.
- **Draft Hydration:** Selected branches and services hydrate from active drafts (`draft`, `submitted`, `changes_requested`, `approved`).
- **Branch Name & Address Publishing:** `publishMarketingContentDraft` updates both `name`, `address`, and `location_metadata`.
- **Owner-Only Direct & Canonical Publishing:** Enforced fail-closed in server actions and UI controls.
- **Presentation-Only Service Publishing:** Public presentation updates do not mutate core catalog operational fields (price, duration, active status).

---

## 3. Comprehensive Verification Results

### 3.1 Targeted Marketing Test Suite

```bash
pnpm vitest run tests/lib/marketing/
```

**Result:** 12 test files, 132 tests passing (100% PASS, 0 failures, 11.34s duration).

- `tests/lib/marketing/brand-server-actions.test.ts` (8 tests) — PASS
- `tests/lib/marketing/branch-metadata-preservation.test.ts` (3 tests) — PASS
- `tests/lib/marketing/draft-publication-pipelines.test.ts` (7 tests) — PASS
- `tests/lib/marketing/brand-branches-services-studios.test.tsx` (16 tests) — PASS
- `tests/lib/marketing/website-studio.test.tsx` (32 tests) — PASS
- `tests/lib/marketing/media-queries.test.ts` (14 tests) — PASS
- `tests/lib/marketing/media-usage.test.ts` (9 tests) — PASS
- `tests/lib/marketing/media-library.test.tsx` (9 tests) — PASS
- `tests/lib/marketing/public-consumer-parity.test.tsx` (21 tests) — PASS
- `tests/lib/marketing/marketing-studio-foundation-migration.test.ts` (4 tests) — PASS
- `tests/lib/marketing/media-contracts.test.ts` (6 tests) — PASS
- `tests/lib/marketing/icon-generator.test.ts` (3 tests) — PASS

### 3.2 Full Repository Vitest Suite

```bash
pnpm vitest run
```

**Result:** 211 test files, 1,500 tests passing (100% PASS, 0 failures, 33.91s duration).

### 3.3 TypeScript Type Check

```bash
pnpm type-check
```

**Result:** Clean `tsc --noEmit` exit with code 0 (0 errors).

### 3.4 ESLint Validation

```bash
pnpm lint
```

**Result:** Clean `eslint` exit with code 0 (0 errors, 9 non-blocking warnings).

### 3.5 Production Build Validation

```bash
pnpm build
```

**Result:** Clean Next.js 16.2.4 (Turbopack) production build across all 114 routes (0 build errors).

### 3.6 Git Diff & Whitespace Audit

```bash
git diff --check 407d1c1b1af399ef510ddcfaf9c19e4c7778274a...HEAD
```

**Result:** 0 whitespace errors, 0 merge conflicts.

---

## 4. Final Review Stop

Work on C5.4 Final Corrections is complete. In compliance with repository rules:
- No merge to `main` has occurred.
- All changes are on `stage/c5-4-brand-branches-services`.
- Codebase is clean, tested, built, and halted for owner inspection.
