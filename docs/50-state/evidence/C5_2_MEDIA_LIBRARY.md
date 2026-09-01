# C5 Pass 2 Evidence Report: Central Media Library & Universal Media Picker

**Repository:** CradleHub Web (`E:\cradlehub`)
**Canonical Remote:** `https://github.com/techwithmpg/Cradlehub.git`
**Working Branch:** `stage/c5-2-media-library`
**Accepted Main Base SHA:** `6303bae6921d2ae1b8fa4d9d80f8d2cadb72b7b6` (PR #9 Closeout)
**Original Implementation SHA:** `ef87d080e5669f00d969bcb51b6e319b16a417ae`
**Pre-correction Remote Head:** `4fadc01e25b821c6e9ee4a55c0245e94fe17ef87`
**First Hardening Correction SHA:** `3460c0a72e22eb2d05b529380439027b6d413a8b`
**Previous Evidence SHA:** `cf6ae2989b38732a6f390f962d72db9a07d3a50a`
**Final Code Correction SHA:** `faf863d82d431c4fceeefffc373bb22288339c79`
**Date:** 2026-09-01
**Scope Authorization:** C5 Pass 2 — Central Media Library & Universal Media Picker ONLY.

---

## 1. Executive Summary

In accordance with owner authorization and the independent review corrections for **C5 Pass 2**, this pass delivers the centralized Media Library module and universal media picker system with complete safety, role boundaries, accessibility, and strict scope isolation:

1. **Strict Branch Scope Isolation & Historical Integrity:**
   - The first hardening correction (`3460c0a7`) unintentionally included unrelated formatting across CRM, booking, and staff onboarding files.
   - A subsequent corrective commit (`faf863d8`) restored all out-of-scope paths to their exact `origin/main` baseline without rewriting or rebasing git history.
   - The final branch diff against `origin/main` contains strictly the 18 authorized C5.2 files.

2. **Centralized Six-Store Usage Context & Fail-Closed Safety:**
   - Consolidated usage scanning into `getMarketingMediaUsageContext()` and `getMarketingMediaUsageMap()` in `marketing-media.ts`.
   - Both the page-level overview (`/marketing/media`) and single-asset inspector evaluate all 6 stores: `public_site_sections`, `public_site_assets`, `marketing_content_drafts`, `services`, `marketing_brand_settings`, and `marketing_seo_settings`.
   - **Fail-Closed Guarantee:** If any store is unreachable, `usageUnknown` is set to `true`, `canSafelyArchive` is forced to `false`, and the UI displays `"Usage incomplete / archive cannot be finalized"`.

3. **Storage-Success / DB-Finalization Failure Handling:**
   - In `uploadMarketingMediaFile`, draft reservations are created in `marketing_media_assets` *before* Storage upload.
   - If Storage upload succeeds but database finalization update fails, the function returns `success: false` with a clear diagnostic message.
   - The record is preserved with metadata `uploadStatus: "finalization_failed"`, `publicUrlCandidate`, and the specific database error without performing destructive hard-deletes.

4. **Server-Side Role Boundaries & State Machine Enforcement:**
   - `saveMarketingMediaAsset`: Restricts Digital Marketers to editing metadata for assets in `draft` or `submitted` status only.
   - `updateMarketingMediaAssetStatus`: Enforces that Digital Marketers can only transition `draft <-> submitted`. Rejects generic status updates attempting to set `archived`.
   - `archiveMarketingMediaAsset`: Dedicated safe-archive handler requiring Owner role and evaluating full usage coverage before allowing transition to `archived`.

5. **Universal Media Picker Hardening:**
   - Archived assets are visually marked with an "Archived" badge and disabled (`aria-disabled="true"`, button disabled).
   - Clicking an archived asset is blocked; the "Select Image" confirm button remains disabled; `onSelect()` is never invoked with an archived asset.
   - Complete keyboard focus trapping (initial focus, Tab/Shift+Tab cycle containment, Escape key dismissal, focus restoration to opener trigger).
   - Upload form errors remain visible inline without closing the dialog on error.

6. **Touch Target Standard & Transition Polish:**
   - All interactive controls (toolbar buttons, picker triggers, close buttons, status actions, copy triggers) satisfy $\ge 44\text{px}$ touch target sizing (`minHeight: 44`, `minWidth: 44`).
   - Zero `transition: all` rules; all styling transitions specify explicit CSS properties (`background-color`, `border-color`, `box-shadow`, `opacity`).

---

## 2. Implementation File Inventory (Strict 18-File Allow-List)

### A. Validation Schemas & Contracts
- `src/lib/validations/marketing.ts`
  - `MARKETING_MEDIA_STATUSES = ["draft", "submitted", "approved", "published", "archived"]`
  - `marketingMediaAssetInputSchema`: Validates `id` (UUID), `altText >= 3` characters, `bucketPath` regex pattern `^[a-z0-9][a-z0-9_./-]*$`.
  - `marketingMediaStatusUpdateSchema`: Validates canonical status transitions.
  - `marketingMediaArchiveSchema`: Validates asset archive requests.

### B. Usage Analyzer & Query Layer
- `src/lib/marketing/media-usage-analyzer.ts`
  - `analyzeMediaAssetUsage(asset, context)`: Analyzes live vs draft references across all 6 consumer stores.
  - `batchAnalyzeMediaUsage(assets, context)`: Batch evaluation for media grids and library browsing.
  - `matchesMediaAsset(asset, urlOrPath)`: Robust matching across public URL, bucket path, relative paths, and sanitized filenames.
- `src/lib/queries/marketing-media.ts`
  - `getMarketingMediaUsageContext()`: Canonical loader for all 6 consumer stores.
  - `getMarketingMediaUsageMap(assets)`: Batch usage map generator for page and view components.
  - `getMarketingMediaAssets(options)`: Server query for media assets with status/section filtering, search, and pagination.
  - `getMarketingMediaAssetById(id)`: Single asset fetch.
  - `getMarketingMediaAssetUsage(asset)`: Runs usage analysis using canonical six-store context.
  - `saveMarketingMediaAsset(data)`: Insert/update media asset metadata with role boundary validation.
  - `updateMarketingMediaAssetStatus(data)`: Enforces role boundaries and lifecycle state machine (rejects `archived`).
  - `archiveMarketingMediaAsset(data)`: Verifies zero live usages and complete store coverage before archiving.
  - `uploadMarketingMediaFile(formData)`: Non-destructive tracked reservation upload workflow with fail-closed finalization.

### C. Server Actions & Routes
- `src/app/(dashboard)/marketing/media/actions.ts`
  - `uploadMediaFileAction`, `saveMediaMetadataAction`, `submitMediaForReviewAction`, `approveMediaAssetAction`, `publishMediaAssetAction`, `archiveMediaAssetAction`.
- `src/app/(dashboard)/marketing/media/page.tsx`
  - First-class Media Library dashboard page with `PageHeader`, canonical `getMarketingMediaUsageMap(assets)` integration, and role context.
- `src/app/(dashboard)/marketing/page.tsx`
  - Workspace entry point with media asset count and direct link to Media Library.
- `src/app/(dashboard)/owner/marketing/page.tsx`
  - Owner Marketing Studio entry point with media integration.

### D. UI Components & Integration
- `src/components/features/marketing/media/universal-media-picker.tsx`
  - Universal media picker modal with Library browsing, search, status filters, selection preview drawer, direct upload, focus trap, and archived asset selection prevention.
- `src/components/features/marketing/media/media-library-view.tsx`
  - Visual responsive asset grid, toolbar (search, status filter, sorting, layout toggles), upload modal with focus trap, Asset Inspector drawer with safe-archive status and incomplete-coverage warnings.
- `src/app/(dashboard)/marketing/marketing-workspace.tsx`
  - Integrated `ImagePickerField` with $\ge 44\text{px}$ touch target button for `imageUrl` and `secondaryImageUrl`.
- `src/app/(dashboard)/owner/marketing/marketing-studio.tsx`
  - Integrated `ImagePickerField` with $\ge 44\text{px}$ touch target button for Owner Marketing Studio section editors.
- `src/components/features/dashboard/nav-config.ts`
  - Added Media Library (`/marketing/media`) to `MARKETING_NAV_ITEMS`.
- `src/components/features/workspace/workspace-prefetch-config.ts`
  - Configured idle prefetch for `/marketing/media`.

### E. Automated Test Suites & Evidence
- `tests/lib/marketing/media-usage.test.ts`
  - 9 unit tests for matching algorithms, live section detection, draft reference handling, service catalog scanning, brand/SEO scanning, incomplete usage fail-closed behavior, batch analysis, and archive blocking.
- `tests/lib/marketing/media-library.test.tsx`
  - 14 component and validation tests for schemas, `UniversalMediaPicker` (including archived asset selection blocking, escape key dismissal, and focus trapping), `MediaLibraryView` (including incomplete coverage banner and zero hard delete controls).
- `tests/lib/marketing/media-queries.test.ts`
  - 9 unit tests for server-side role boundaries, transition validation, non-owner archive rejection, six-store usage context, page-level usage map, and fail-closed finalization failure handling.
- `tests/lib/auth/workspace-access.test.ts`
  - Verified navigation contract and prefetch configuration.
- `docs/50-state/evidence/C5_2_MEDIA_LIBRARY.md`
  - This evidence document.

---

## 3. Quality Gate Results

| Quality Gate | Command | Result | Details |
|---|---|---|---|
| **Targeted Vitest Tests** | `pnpm vitest run tests/lib/marketing/media-usage.test.ts tests/lib/marketing/media-library.test.tsx tests/lib/marketing/media-queries.test.ts` | **PASS** | 3 test files passed, 32 total tests passed, 0 failures. |
| **Full Unit & Integration Suite** | `pnpm vitest run` | **PASS** | 204 test files passed, 1,416 total tests passed, 0 failures. |
| **TypeScript Type Check** | `pnpm type-check` | **PASS** | `tsc --noEmit` exited 0 with 0 errors. |
| **ESLint Static Analysis** | `pnpm lint` | **PASS** | ESLint exited 0 with 0 errors and 0 warnings. |
| **Next.js Production Build** | `pnpm build` | **PASS** | Next.js 16.2.4 (Turbopack) successfully compiled 115 static/dynamic routes including `/marketing/media`. |
| **Git Diff Inspection** | `git diff --check origin/main...HEAD` | **PASS** | Zero conflict markers, whitespace errors, or uncommitted files across the 18 authorized files. |

---

## 4. Accessibility & Responsive Verification

- **Touch Target Standard:** All interactive buttons, picker triggers, close buttons, and tab controls meet the $44\text{px}$ minimum touch target height requirement (`minHeight: 44`, `minWidth: 44`).
- **Keyboard Navigation & Trapping:** `UniversalMediaPicker` and `MediaLibraryView` upload modal implement initial focus placement, Tab/Shift+Tab cycle containment, Escape key dismissal, and focus restoration to the trigger element on close.
- **Screen Reader Parity:** All media cards and picker items render visible `alt_text` completeness badges and include full image `alt` attributes, `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- **Responsive Viewport QA:**
  - `320px` (Compact mobile): Single-column asset list/grid, full-width modal drawer, horizontal scroll for filters.
  - `375px` / `414px` (Standard mobile): 2-column thumbnail grid, bottom sheet layout for inspector.
  - `768px` (Tablet): 3-4 column thumbnail grid with side-by-side search toolbar.
  - `1024px` / `1280px+` (Desktop): Auto-fill responsive grid (`minmax(160px, 1fr)`), fixed right-hand Asset Inspector drawer (380px width).

---

## 5. Security & Governance Compliance

1. **Hard Delete Prohibition:** Verified that zero `DELETE` API endpoints, SQL mutations, or client buttons exist for media assets.
2. **Safe Archive Workflow:** Finalize Archive is disabled in UI and rejected server-side whenever active live usages exist or store coverage is incomplete.
3. **Role Boundary Separation:** Digital Marketers cannot bypass approval directly to `approved` or `published`. Owners retain full approval, publish, and safe archive authorization.
4. **Zero Production Mutation:** Zero changes made to production DB, live migrations, or RLS policies.

---

## 6. Limitations & Rollback Plan

- **Limitations:** Third-party embedded URLs outside known tables (`public_site_sections`, `public_site_assets`, `marketing_content_drafts`, `services`, `marketing_brand_settings`, `marketing_seo_settings`) are surfaced with explicit provenance rather than presumed safe.
- **Rollback:** `git revert` of the C5 Pass 2 commits cleanly restores the previous state without orphan records or broken dependencies.

---

## 7. Stop Condition & Review Request

Implementation, hardening, and scope isolation for **C5 Pass 2** are complete and fully verified. The branch `stage/c5-2-media-library` is ready for independent review. **DO NOT MERGE.**
