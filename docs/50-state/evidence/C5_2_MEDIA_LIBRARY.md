# C5 Pass 2 Evidence Report: Central Media Library & Universal Media Picker

**Repository:** CradleHub Web (`E:\cradlehub`)
**Canonical Remote:** `https://github.com/techwithmpg/Cradlehub.git`
**Working Branch:** `stage/c5-2-media-library`
**Accepted Main Base SHA:** `6303bae6921d2ae1b8fa4d9d80f8d2cadb72b7b6` (PR #9 Closeout)
**Original Implementation SHA:** `ef87d080e5669f00d969bcb51b6e319b16a417ae`
**Pre-correction Remote Head:** `4fadc01e25b821c6e9ee4a55c0245e94fe17ef87`
**Hardening Correction SHA:** `3460c0a72e22eb2d05b529380439027b6d413a8b`
**Scope Isolation SHA:** `faf863d82d431c4fceeefffc373bb22288339c79`
**Previous Reviewed Head:** `bda8cea7a51dcb2b7e4666ee869deca8cb371c3e`
**Final Safety Correction SHA:** `df7deb97e20cf35450410ffdf4f0e74f8cf1c15f`
**Date:** 2026-09-01
**Scope Authorization:** C5 Pass 2 — Central Media Library & Universal Media Picker ONLY.

---

## 1. Executive Summary

In accordance with owner authorization and the final independent safety review for **C5 Pass 2**, this pass delivers the centralized Media Library module and universal media picker system with complete safety, role boundaries, immutable storage identity, fail-closed authorization lookups, missing-store archive safety, and strict 18-file scope isolation:

1. **Fail-Closed Existing-Asset State Lookup (`saveMarketingMediaAsset`):**
   - When modifying an existing asset by `id`, `saveMarketingMediaAsset` unconditionally queries `marketing_media_assets` for current state (`status`, `bucket_path`, `public_url`, `metadata`).
   - If the lookup query returns an error, the operation halts immediately with `{ success: false, error: "Could not verify the current media asset state." }` without executing updates.
   - If no record is found for the given `id`, the operation halts immediately with `{ success: false, error: "Media asset not found." }`.
   - Role boundaries (e.g. Digital Marketer restricted to `draft` or `submitted`) and archived lockouts run only after a verified successful lookup.

2. **Immutable Media Storage Identity & Protected Metadata:**
   - For existing assets, client-provided `bucketPath` and `publicUrl` are ignored during metadata edits; the database record's stored `bucket_path` and `public_url` remain immutable and authoritative.
   - Protected system metadata fields (`uploadStatus`, `uploadError`, `publicUrlCandidate`, `mimeType`, `sizeBytes`, `originalFileName`, `uploadedAt`) are preserved from the existing database record and cannot be forged or overwritten by client-supplied metadata.
   - Editable metadata is restricted to user presentation fields (`title`, `alt_text`, `section_key`, `content_key`, and custom non-system metadata tags).

3. **Fail-Closed Missing-Store Usage Resolution (`getMarketingMediaUsageContext`):**
   - If `marketing_brand_settings` or `marketing_seo_settings` cannot be queried (missing table, schema cache error, or read error), the store is marked as `unresolvedStores` rather than assumed empty.
   - The media usage analyzer sets `usageUnknown = true` and `canSafelyArchive = false`, displaying `"Usage incomplete / archive cannot be finalized"`.
   - Safe archive is permitted only when all 6 stores resolve successfully and `totalLiveUsages === 0`.

4. **Storage-Success / DB-Finalization Failure Handling:**
   - In `uploadMarketingMediaFile`, draft reservations are created in `marketing_media_assets` *before* Storage upload.
   - If Storage upload succeeds but database finalization update fails, the function returns `success: false` with a clear diagnostic message.
   - The record is preserved with metadata `uploadStatus: "finalization_failed"`, `publicUrlCandidate`, and the specific database error without performing destructive hard-deletes.

5. **Server-Side Role Boundaries & State Machine Enforcement:**
   - `saveMarketingMediaAsset`: Restricts Digital Marketers to editing metadata for assets in `draft` or `submitted` status only.
   - `updateMarketingMediaAssetStatus`: Enforces that Digital Marketers can only transition `draft <-> submitted`. Rejects generic status updates attempting to set `archived`.
   - `archiveMarketingMediaAsset`: Dedicated safe-archive handler requiring Owner role and evaluating full usage coverage before allowing transition to `archived`.

6. **Universal Media Picker Hardening:**
   - Archived assets are visually marked with an "Archived" badge and disabled (`aria-disabled="true"`, button disabled).
   - Clicking an archived asset is blocked; the "Select Image" confirm button remains disabled; `onSelect()` is never invoked with an archived asset.
   - Complete keyboard focus trapping (initial focus, Tab/Shift+Tab cycle containment, Escape key dismissal, focus restoration to opener trigger).
   - Upload form errors remain visible inline without closing the dialog on error.

7. **Touch Target Standard & Transition Polish:**
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
  - `getMarketingMediaUsageContext()`: Canonical loader for all 6 consumer stores with fail-closed missing store detection.
  - `getMarketingMediaUsageMap(assets)`: Batch usage map generator for page and view components.
  - `getMarketingMediaAssets(options)`: Server query for media assets with status/section filtering, search, and pagination.
  - `getMarketingMediaAssetById(id)`: Single asset fetch.
  - `getMarketingMediaAssetUsage(asset)`: Runs usage analysis using canonical six-store context.
  - `saveMarketingMediaAsset(data)`: Fail-closed state lookup, immutable storage identity, and protected metadata preservation.
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
  - 16 unit tests covering fail-closed asset lookup on DB error or missing row, immutable storage identity, protected metadata preservation, role boundary enforcement, missing-store fail-closed behavior, zero-usage safe archive permission, and upload finalization failure handling.
- `tests/lib/auth/workspace-access.test.ts`
  - Verified navigation contract and prefetch configuration.
- `docs/50-state/evidence/C5_2_MEDIA_LIBRARY.md`
  - This evidence document.

---

## 3. Quality Gate Results

| Quality Gate | Command | Result | Details |
|---|---|---|---|
| **Targeted Vitest Tests** | `pnpm vitest run tests/lib/marketing/media-usage.test.ts tests/lib/marketing/media-library.test.tsx tests/lib/marketing/media-queries.test.ts` | **PASS** | 3 test files passed, 39 total tests passed, 0 failures. |
| **Full Unit & Integration Suite** | `pnpm vitest run` | **PASS** | 204 test files passed, 1,423 total tests passed, 0 failures. |
| **TypeScript Type Check** | `pnpm type-check` | **PASS** | `tsc --noEmit` exited 0 with 0 errors. |
| **ESLint Static Analysis** | `pnpm lint` | **PASS** | ESLint exited 0 with 0 errors and 0 warnings. |
| **Code Style Formatting** | `pnpm format:check` | **PASS** | Read-only format verification passed across all incremental files. |
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
2. **Fail-Closed State Verification:** Asset state is verified before any mutation; errors or missing rows immediately halt execution.
3. **Storage Identity Immutability:** `bucket_path` and `public_url` cannot be altered through client-side metadata actions.
4. **Safe Archive Workflow:** Finalize Archive is disabled in UI and rejected server-side whenever active live usages exist or store coverage is incomplete.
5. **Role Boundary Separation:** Digital Marketers cannot bypass approval directly to `approved` or `published`. Owners retain full approval, publish, and safe archive authorization.
6. **Zero Production Mutation:** Zero changes made to production DB, live migrations, or RLS policies.

---

## 6. Limitations & Rollback Plan

- **Limitations:** Third-party embedded URLs outside known tables (`public_site_sections`, `public_site_assets`, `marketing_content_drafts`, `services`, `marketing_brand_settings`, `marketing_seo_settings`) are surfaced with explicit provenance rather than presumed safe.
- **Rollback:** `git revert` of the C5 Pass 2 commits cleanly restores the previous state without orphan records or broken dependencies.

---

## 7. Stop Condition & Review Request

Implementation, hardening, safety verification, and scope isolation for **C5 Pass 2** are complete and fully verified. The branch `stage/c5-2-media-library` is ready for independent review. **DO NOT MERGE.**
