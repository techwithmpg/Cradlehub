# C5.4 Brand + Branches + Services Studios Evidence

## 1. Branch & Baseline Metadata

- **Authorized Stage:** C5 Pass 4 (Brand + Branches + Services Studios)
- **Branch:** `stage/c5-4-brand-branches-services`
- **Accepted Base SHA:** `407d1c1b1af399ef510ddcfaf9c19e4c7778274a`
- **Execution Mode:** OWNER-APPROVED ACCELERATED VERIFICATION
- **Target Verification Status:** 100/100 marketing unit & regression tests passing; 0 TypeScript errors.

---

## 2. Core Implemented Studios & Subsystems

### 2.1 Brand Studio
- **Database / Store Target:** `marketing_brand_settings`
- **Managed Settings Keys:**
  - `header_logo`: Header logo URL, alt text, variant (dark/light).
  - `footer_logo`: Footer logo URL, alt text, variant.
  - `brand_mark`: Primary icon/mark for avatars, watermarks, mobile headers.
  - `site_icon`: Browser tab favicon & PWA icon metadata.
  - `brand_tagline`: Main tagline (`"A sanctuary of calm in Bacolod."`) and subtext.
- **Favicon Boundary:** Root Next.js static asset `/favicon.ico` architecture preserved; dynamic/PWA metadata managed via `marketing_brand_settings`.
- **Workflows Supported:**
  - **Digital Marketer:** Save Draft / Submit for Review (saves draft payload in `marketing_content_drafts` under `content_type = "brand"`).
  - **Owner:** Direct live setting update / publish to `marketing_brand_settings`, review queue approval/rejection.
- **Preview Surface:** Tabbed real-time previews for Header, Footer, Brand Mark, and Browser Tab (Favicon).

### 2.2 Branches Studio
- **Database / Store Target:** `branches` table (`location_metadata` for photo, columns for phone, secondary phone, email, fb_page, messenger_link, opening_hours, maps_embed_url).
- **Branch Differentiation:** Clean switching between **Cradle Main Spa (Lacson)** (Flagship) and **Cradle SM City Bacolod** (Mall branch).
- **Workflows Supported:**
  - **Digital Marketer:** Save Draft / Submit for Review (`content_type = "branch"`).
  - **Owner:** Direct live branch update (`updateBranchPresentationAction`).
- **Preview Surface:** Real-time responsive branch card matching the `/branches` presentation layer.

### 2.3 Services Studio
- **Database / Store Target:** `services` table (`image_url`, `description`, `short_description`, `badges`, `inclusions`, `alt_text` in metadata).
- **Public Invariant Preserved:** Mobile home display rule `isPublicBookable && !isCsrOnly && !isVip` strictly enforced and visually flagged with an eligibility indicator pill.
- **Workflows Supported:**
  - **Digital Marketer:** Save Draft / Submit for Review (`content_type = "service"`).
  - **Owner:** Direct live service presentation update (`updateServicePresentationAction`).
- **Editor Features:** Universal Media Picker integration for service photography, category filter tabs, search filter, promotional badge manager, and inclusion item manager.
- **Preview Surface:** Desktop card and Mobile card live preview reflecting in-memory edits.

### 2.4 Central Media Library & Usage Analyzer Integration
- Extended `MediaUsageContextData` and `analyzeMediaAssetUsage` to inspect:
  - `marketing_brand_settings`
  - `branches.location_metadata`
  - `services.image_url`
  - `marketing_content_drafts`
  - `public_site_sections`
  - `public_site_assets`
  - `marketing_seo_settings`
- Safe archive invariant preserved: Live consumers strictly block asset archival with clear, actionable blocking reasons.

### 2.5 Unified Marketing Workspace Shell
- 5 Top-level tabs with role-aware access:
  1. `Website Studio`
  2. `Brand Studio`
  3. `Branches Studio`
  4. `Services Studio`
  5. `Media Library`
- Integrated into both Marketer (`/marketing`) and Owner (`/owner/marketing`) entry routes.

---

## 3. Automated Verification Results

### 3.1 TypeScript Type Check
```bash
pnpm type-check
```
**Result:** Exit Code 0 (0 errors).

### 3.2 Targeted Marketing Test Suites
```bash
pnpm vitest run tests/lib/marketing/
```
**Result:** 7 test files, 100/100 tests passing.
- `tests/lib/marketing/brand-branches-services-studios.test.tsx` (12 tests) — PASS
- `tests/lib/marketing/website-studio.test.tsx` (32 tests) — PASS
- `tests/lib/marketing/media-queries.test.ts` (14 tests) — PASS
- `tests/lib/marketing/media-analyzer-regression.test.ts` (13 tests) — PASS
- `tests/lib/marketing/universal-media-picker.test.tsx` (12 tests) — PASS
- `tests/lib/marketing/media-library.test.tsx` (9 tests) — PASS
- `tests/lib/marketing/draft-crud.test.ts` (8 tests) — PASS

---

## 4. Production Evidence & Stop Condition

```
REPOSITORY-RECORDED PRODUCTION EVIDENCE:
C5.4 Brand + Branches + Services Studios implementation is complete on authorized branch stage/c5-4-brand-branches-services based on accepted main 407d1c1b1af399ef510ddcfaf9c19e4c7778274a. All 100 marketing tests pass with 0 TypeScript compilation errors. All database, auth, and role boundaries have been strictly preserved with zero schema changes. Branch is pushed and stopped unmerged for independent owner review.
```
