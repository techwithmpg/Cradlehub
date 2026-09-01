# C5.4 Brand + Branches + Services Studios Evidence & Independent Review Corrections

## 1. Branch & Baseline Metadata

- **Authorized Stage:** C5 Pass 4 (Brand + Branches + Services Studios + UX Unification + Media Contracts + Dynamic Site Icon Generator + Trust-Origin & Storage Presence Validation)
- **Branch:** `stage/c5-4-brand-branches-services`
- **Accepted Base SHA:** `407d1c1b1af399ef510ddcfaf9c19e4c7778274a`
- **Prior Reviewed Head SHA:** `4d31033af624abad97f13f784b97b8d49b566feb`
- **Execution Mode:** OWNER-AUTHORIZED C5.4 FINAL TRUST-ORIGIN + BROWSER EVIDENCE CORRECTION
- **Status:** COMPLETE / ALL 7 GATES PASSING / STOPPED UNMERGED FOR INDEPENDENT REVIEW

---

## 2. Implemented Capabilities & Security Invariants

### 2.1 Server-Derived Project Origin Authority (`validateTrustedSiteIconPackage`)

- **Elimination of Generic Domain Checking:** Replaced broad `.supabase.co` string matching with authoritative derivation from the active server Supabase client:
  1. Computes expected storage subpath: `brand/site-icon/${version}/${filename}`
  2. Calls `supabase.storage.from("public-site-media").getPublicUrl(expectedSubpath)`
  3. Enforces that package URLs strictly equal `expectedPublicUrl` (or relative `/brand/site-icon/${version}/${filename}` in local dev).
- **Foreign Project Rejection:** Payloads pointing to attacker-controlled Supabase instances (`https://attacker-project.supabase.co/...`) are strictly rejected even if bucket names and subpaths match.
- **Regression Test:** Added regression coverage verifying foreign Supabase projects fail validation.

### 2.2 Authoritative Fail-Closed Storage Presence Verification

- **Fail-Closed Storage Verification:** Before accepting any dynamic site icon package:
  1. Queries `supabase.storage.from("public-site-media").list("brand/site-icon/" + version)`.
  2. If `listError` occurs: fails closed and returns `isValid: false`.
  3. If storage directory is empty: fails closed and returns `isValid: false`.
  4. If any of the 7 expected variant filenames (`icon-16.png`, `icon-32.png`, `icon-48.png`, `apple-touch-icon-180.png`, `icon-192.png`, `icon-512.png`, `maskable-512.png`) is missing: fails closed and returns `isValid: false`.
  5. Only packages with all 7 physical objects verified in Storage receive `isValid: true`.

### 2.3 Persist Only Validated Normalized Package

- **Canonical Brand Publication:** `publishMarketingContentDraft` in `src/lib/queries/marketing-content.ts` passes `siteIconPackage` through `validateTrustedSiteIconPackage` and persists the validated output.
- **Direct Owner Publication:** `updateBrandSettingsBatchOwner` in `src/lib/queries/marketing-brand.ts` validates `siteIconPackage` and writes only the validator-produced normalized `validatedPackage`, stripping any extraneous raw JSON or arbitrary properties submitted in form payloads.

### 2.4 Partial Generation Cleanup & Safe Rollback

- If variant uploads fail midway during package generation in `generateSiteIconPackageFromBuffer` (`src/lib/marketing/icon-generator.ts`), newly generated partial objects for the uncompleted version (`brand/site-icon/${version}/...`) are removed from `public-site-media` storage. Existing or published packages are never modified or removed.

### 2.5 Next.js Upload Size Limit & Server Contracts

- `experimental.serverActions.bodySizeLimit: "8mb"` in `next.config.ts` allows receiving media payloads with multipart overhead for the largest authorized marketing contract (`HERO_BACKGROUND`: 6MB).
- Authoritative server-side `validateMediaBuffer` in `src/lib/marketing/media-contracts-server.ts` enforces exact intent `maxBytes` (2MB to 6MB) before storage or database insertion.

---

## 3. Verification Gate Results (Executed in Frozen Order)

### Gate 1: Targeted Marketing Test Suite

```bash
pnpm vitest run tests/lib/marketing/
```

**Result:** **13 test files, 148 tests passing** (100% PASS, 0 failures, 12.28s duration).

- `tests/lib/marketing/icon-package-validator.test.ts` (15 tests) — PASS
- `tests/lib/marketing/icon-generator.test.ts` (4 tests) — PASS
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

### Gate 2: Full Repository Vitest Suite

```bash
pnpm vitest run
```

**Result:** **212 test files, 1,516 tests passing** (100% PASS, 0 failures, 42.10s duration).

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
npx prettier --check [authorized touched files]
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

## 4. Local Browser & Manual Runtime QA Observations

### 4.1 Public Route Inspections

- **Root (`/`):** Returns HTTP 200. Document `<head>` contains `<link rel="icon" href="/favicon.ico"/>` static fallback icon link.
- **Branches (`/branches`):** Returns HTTP 200. Renders dark spa cards with gold accents, header navigation icons, and static fallback favicon link.
- **Services (`/services`):** Returns HTTP 200. Renders categorized services, duration/pricing metadata, and static fallback favicon link.
- **Contact (`/contact`):** Returns HTTP 200. Renders branch contact cards and static fallback favicon link.

### 4.2 Studio Viewport & Layout Observations

- **Viewport Range Tested:** 320px, 375px, 414px, 768px, 1024px, 1280px+.
- **Horizontal Studio Navigation Rail:** Persistent horizontal navigation rail at the top with touch scrolling across mobile viewports (320px, 375px, 414px) and flex-wrapped desktop viewports (768px, 1024px, 1280px+). Zero page-level horizontal overflow observed.
- **Brand Studio Separation:** Light cream editor panel (`#FCFAF5` / `#F5F0E6`) strictly separated from rich dark live/draft preview cards (`#10261D` / `#0D2B20`). Shows "7 Variants Ready" badge and contract constraints.
- **Branches Studio:** Branch selector isolates `content_key === branch_<id>` without contact draft cross-contamination.
- **Services Studio:** Service selector provides presentation-only editing without mutating core catalog operational fields.
- **Media Library:** Displays 8 intent contracts and active asset grids.
- **Role Enforcement & Security:** Unauthenticated requests to `/marketing` and `/owner/marketing` return HTTP 307 redirecting to `/login`. Marketer accounts have Save Draft → Submit workflow; direct publishing is strictly Owner-only.

### 4.3 Favicon & Dynamic Package Verification Scope

- **Static Fallback in Document `<head>`:** VERIFIED (`<link rel="icon" href="/favicon.ico"/>` emitted correctly).
- **Dynamic Package Rendered in Live Browser `<head>`:** NOT VERIFIED in live runtime without active local database dynamic package state (fully covered and verified via unit and mock tests).

---

## 5. REPOSITORY-RECORDED PRODUCTION EVIDENCE

- **Production-Connected Baseline:** `main` is production-connected. No changes have been pushed or merged to `main`.
- **Target Environment Status:** All tests, builds, and verifications in this report were performed in the local development/test environment on `stage/c5-4-brand-branches-services`.
- **GitHub CI Status:** No GitHub CI run was executed on the final head SHA.
- **Explicit Production Limitation:** Production runtime behavior, live production database state, live Supabase Storage bucket contents, and live production browser behavior were **NOT** independently verified in a live production deployment, as no production deployment has occurred from this stage branch.

---

## 6. Rollback & Review Stop

- **Branch:** `stage/c5-4-brand-branches-services`
- **Base SHA:** `407d1c1b1af399ef510ddcfaf9c19e4c7778274a`
- **Rollback Strategy:**
  - **Unmerged Stage Branch:** No production rollback required. The branch remains isolated from `main`. To reset working branch, restore pointer to `407d1c1b1af399ef510ddcfaf9c19e4c7778274a`.
  - **After Any Future Merge:** Use normal git revert / forward-fix workflow; never reset or force-rewrite accepted `main`.
- **Review Gate:** Work is complete and stopped unmerged for owner review. C5.5 remains unauthorized.
