# C5.4 Brand + Branches + Services Studios Evidence & Independent Review Corrections

## 1. Branch & Baseline Metadata

- **Authorized Stage:** C5 Pass 4 (Brand + Branches + Services Studios + UX Unification + Media Contracts + Dynamic Site Icon Generator + Security & Trust Validation Micro-Pass)
- **Branch:** `stage/c5-4-brand-branches-services`
- **Accepted Base SHA:** `407d1c1b1af399ef510ddcfaf9c19e4c7778274a`
- **Prior Reviewed Head SHA:** `69788b73320c714ab27fa044fdde72d4ecddb557`
- **Execution Mode:** OWNER-AUTHORIZED C5.4 FINAL TRUST + VERIFICATION MICRO-PASS
- **Status:** COMPLETE / ALL 7 GATES PASSING / STOPPED UNMERGED FOR INDEPENDENT REVIEW

---

## 2. Implemented Capabilities & Trust Invariants

### 2.1 Server-Side Trusted Site Icon Package Validation

- **Shared Authoritative Validator (`validateTrustedSiteIconPackage`):** Located in `src/lib/marketing/icon-package-validator.ts` (`server-only`).
- **Enforced Invariants:**
  1. **Shape & Status:** Requires non-null object, `generationStatus === "ready"`, valid `version` matching `/^v[a-zA-Z0-9_-]{3,64}$/`, non-empty `sourceAssetId`, and valid ISO `generatedAt`.
  2. **Database Master Asset Verification:** Queries `marketing_media_assets` for `id === sourceAssetId`. Rejects missing assets and archived assets (`status === "archived"`).
  3. **7 Required PNG Variants:** Verifies all 7 variant keys exist (`icon16`, `icon32`, `icon48`, `apple180`, `icon192`, `icon512`, `maskable512`).
  4. **Strict URL Origin & Path Verification:** Every variant URL is verified to point to the authorized `public-site-media` bucket path matching `brand/site-icon/<package.version>/<variant-filename>`. Arbitrary external domains (e.g., `https://attacker.com/icon.png`) and mismatched paths are strictly rejected.
  5. **Storage Presence Verification:** Checks storage objects in `brand/site-icon/<package.version>/` where storage client is available.
- **Unified Pipeline Enforcement:** Enforced identically across:
  - Canonical Brand Draft Publication (`publishMarketingContentDraft` in `src/lib/queries/marketing-content.ts`).
  - Direct Owner Batch Publication (`updateBrandSettingsBatchOwner` in `src/lib/queries/marketing-brand.ts`).
  - If validation fails, live settings remain unchanged and the operation fails closed.

### 2.2 Canonical Review Path & Role Boundaries

- **Marketer Workflow:** Marketer generates site-icon package → saves Brand draft with `siteIconPackage` in metadata → submits draft for review. Marketers have zero direct-live publishing permissions.
- **Owner Review & Publication:** Owner inspects draft and publishes live. Canonical draft publication executes `validateTrustedSiteIconPackage` before persisting to `marketing_brand_settings.site_icon`.
- **Direct Owner Updates:** Retains direct brand editing capabilities for Owners, but any dynamic site-icon package payload must pass `validateTrustedSiteIconPackage` before database insertion.

### 2.3 Next.js Server Action File-Upload Size Architecture Decision

- **Architecture Decision:** Configured `experimental.serverActions.bodySizeLimit: "8mb"` in `next.config.ts`.
- **Rationale & Security Considerations:**
  - Largest authorized marketing media contract is `HERO_BACKGROUND` at 6MB (`6 * 1024 * 1024` bytes).
  - Setting `bodySizeLimit` to `8mb` accommodates base64/multipart form boundary and header overhead without opening an unnecessarily large threshold (e.g., 50MB).
  - **Authoritative Server Validation:** Server-side `validateMediaBuffer` in `src/lib/marketing/media-contracts-server.ts` enforces exact per-intent `maxBytes` thresholds (2MB for logos/emblems, 4MB for photos/portraits/icons, 6MB for hero background) *before* storage or database insertion.

### 2.4 Partial Generation Object Handling & Cleanup

- **Partial Cleanup Behavior:** If generation fails after some variants have already uploaded, `generateSiteIconPackageFromBuffer` in `src/lib/marketing/icon-generator.ts` identifies newly uploaded variant paths for the current uncompleted version (`brand/site-icon/<version>/...`) and removes them via `supabase.storage.from("public-site-media").remove(...)`.
- **Safety Invariant:** Old and currently published site icon packages are never touched or removed.
- **Fail-Closed Guarantee:** Partial packages never receive `generationStatus: "ready"` and are never published to live settings.

### 2.5 UI Cleanliness & 7 Variant System

- Updated Brand Studio header badge and description from "8 variants" to "7 Variants Ready" / "7 required web/device PNG icons".
- Static `/favicon.ico` serves as the genuine static fallback in `public/favicon.ico`, not an eighth generated variant.

---

## 3. Verification Gate Results (Executed in Frozen Exact Order)

### Gate 1: Targeted Marketing Test Suite

```bash
pnpm vitest run tests/lib/marketing/
```

**Result:** 13 test files, 142 tests passing (100% PASS, 0 failures, 8.26s duration).

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
- `tests/lib/marketing/icon-generator.test.ts` (4 tests) — PASS
- `tests/lib/marketing/icon-package-validator.test.ts` (9 tests) — PASS

### Gate 2: Full Repository Vitest Suite

```bash
pnpm vitest run
```

**Result:** 212 test files, 1,510 tests passing (100% PASS, 0 failures, 28.77s duration).

### Gate 3: TypeScript Type Check

```bash
pnpm type-check
```

**Result:** Clean `tsc --noEmit` exit with code 0 (0 errors).

### Gate 4: ESLint Validation

```bash
pnpm lint
```

**Result:** Clean `eslint` exit with code 0 (0 errors, 9 non-blocking warnings).

### Gate 5: Formatting Validation

```bash
pnpm format:check / npx prettier --check [authorized touched files]
```

**Result:** All authorized touched files use standard Prettier code style (0 formatting issues).

### Gate 6: Production Build Validation

```bash
pnpm build
```

**Result:** Clean Next.js 16.2.4 (Turbopack) production build across all 114 routes (0 build errors).

### Gate 7: Git Diff & Whitespace Audit

```bash
git diff --check 407d1c1b1af399ef510ddcfaf9c19e4c7778274a...HEAD
```

**Result:** 0 whitespace errors, 0 merge conflicts.

---

## 4. Real Browser & Runtime Observations

- **Head Document Structure:** Inspected rendered HTML `<head>` on running server at `http://localhost:3000/`.
- **Dynamic Icon & Fallback Behavior:**
  - Fallback: `<link rel="icon" href="/favicon.ico"/>` renders cleanly from static fallback asset when dynamic package is not active.
  - Active Package: Emits all 7 versioned variant links (`icon-16.png`, `icon-32.png`, `icon-48.png`, `apple-touch-icon-180.png`, `icon-192.png`, `icon-512.png`, `maskable-512.png`).
  - No conflict with Next.js `src/app/favicon.ico` convention because static fallbacks reside strictly in `public/`.
- **Public Routes:** Verified `/`, `/branches`, `/services`, `/contact` render HTTP 200 with complete rich dark spa aesthetics and header icon references.
- **Studio Responsiveness:** Verified horizontal studio navigation rail across mobile and desktop viewports (320px, 375px, 414px, 768px, 1024px, 1280px+) with smooth horizontal scrolling and zero page-level horizontal overflow.

---

## 5. REPOSITORY-RECORDED PRODUCTION EVIDENCE

- **Production-Connected Baseline:** `main` is production-connected. No changes have been pushed or merged to `main`.
- **Target Environment Status:** All tests, builds, and verifications in this report were performed in the local development/test environment on `stage/c5-4-brand-branches-services`.
- **Explicit Production Limitation:** Production runtime behavior, live production database state, live Supabase Storage bucket contents, and live production browser behavior were **NOT** independently verified in a live production deployment, as no production deployment has occurred from this stage branch.

---

## 6. Rollback & Review Stop

- **Branch:** `stage/c5-4-brand-branches-services`
- **Base SHA:** `407d1c1b1af399ef510ddcfaf9c19e4c7778274a`
- **Rollback Strategy:** To revert all C5.4 changes, restore branch pointer to `407d1c1b1af399ef510ddcfaf9c19e4c7778274a`.
- **Review Gate:** Work is complete and stopped unmerged for owner review. C5.5 remains unauthorized.
