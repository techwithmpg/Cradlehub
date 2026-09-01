# C5 Pass 3 Evidence — Website Studio & High-Fidelity Preview

## 1. Executive Summary & Governance Coordinates

- **Pass:** C5 Pass 3 (Website Studio & High-Fidelity Preview)
- **Status:** IMPLEMENTED / AWAITING INDEPENDENT REVIEW
- **Date:** 2026-09-01
- **Branch:** `stage/c5-3-website-studio`
- **Accepted Starting Base SHA:** `f71f0b0c9d0de60a11386814cd23c200ca99496b`
- **Original Contaminated Implementation Head SHA:** `3fb22d2458a8810ab54230a5d77e01b6b3b7ca34`
- **Scope-Isolation Correction SHA:** `facfa4dd49a007b1e8c57f96d448c56954b0c27f`
- **Previous Candidate Head SHA:** `216fac56bb5fa1606b4e94a6f786f3ba8121e340`
- **Active Governance Decision:** `GOV-025` recorded in `docs/11-DECISION-LOG.md`
- **Scope Compliance:** Website Studio & High-Fidelity Preview ONLY. Real public presentation grounding extracted from existing public components without altering consumer behavior. Preserved existing Owner review queue and C5.2 Media Library. No migrations, no database schema mutations, no Auth/RLS/Storage policy modifications, no production-data mutations. C5 Pass 4 and Pass 5 remain strictly NOT AUTHORIZED.

---

## 2. Scope Incident & Isolation Record

A repository-wide formatting command (`pnpm format`) introduced unrelated formatting changes across CRM, booking, staff onboarding, manager operations, and public APIs in commit `3fb22d2458a8810ab54230a5d77e01b6b3b7ca34`. Those paths were restored exactly to `origin/main` in a non-rewriting cleanup commit (`facfa4dd49a007b1e8c57f96d448c56954b0c27f`).

In the final targeted correction, `HomePageSectionsRenderer` and `PublicMobileHomeRenderer` were extracted from existing public home components to provide true component grounding for the studio preview without duplicating presentation code.

### Exact 16-File Scope Inventory:

1. `AI_CONTEXT.md`
2. `docs/11-DECISION-LOG.md`
3. `docs/13-PROJECT-STATUS.md`
4. `docs/50-state/evidence/C5_3_WEBSITE_STUDIO.md`
5. `src/app/(dashboard)/marketing/marketing-workspace.tsx`
6. `src/app/(dashboard)/marketing/page.tsx`
7. `src/app/(dashboard)/owner/marketing/marketing-studio.tsx`
8. `src/app/(dashboard)/owner/marketing/page.tsx`
9. `src/components/features/marketing/website/high-fidelity-preview.tsx`
10. `src/components/features/marketing/website/link-picker.tsx`
11. `src/components/features/marketing/website/section-editor.tsx`
12. `src/components/features/marketing/website/unsaved-changes-dialog.tsx`
13. `src/components/features/marketing/website/website-studio-view.tsx`
14. `src/components/public/home-page-sections.tsx`
15. `src/components/public/mobile/public-mobile-home.tsx`
16. `tests/lib/marketing/website-studio.test.tsx`

---

## 3. Core Deliverables & Mental Model

### Target Mental Model:

`SEE IT → CHANGE IT → PREVIEW IT → SAVE DRAFT → SUBMIT → OWNER REVIEWS → PUBLISH SAFELY`

1. **3-Pane Information Architecture:**
   - **Left Rail (Section Navigation):** Groups homepage components into Managed Sections, Display Gates, and Static Context.
   - **Center Rail (Structured Section Editor):** Friendly form controls with copy fields, checklist item managers, Universal Media Picker integration, and safe LinkPicker destination selector. Zero raw JSON editor or Supabase jargon exposed to users.
   - **Right Rail (High-Fidelity Preview):** Grounded directly in `HomePageSectionsRenderer` and `PublicMobileHomeRenderer` with live in-memory reactivity, Draft/Live/Compare modes, and Desktop (1280px), Tablet (768px), and Mobile (375px) viewports.

2. **Homepage Section Classification & Governance:**
   - **Category A (Managed Contracts):**
     - `hero`: Title, subtitle, primary CTA label & href, secondary CTA label & href, hero image, portrait atmosphere image.
     - `about`: Story title, subtitle eyebrow, multi-paragraph body, primary image, secondary detail image.
     - `quote_banner`: Promotional title, subtitle eyebrow, body copy, CTA button, background image.
     - `before_you_book`: Title, subtitle eyebrow, intro body copy, guidance checklist items.
   - **Category B (Display Gates):**
     - `signature_services`: Homepage service catalog visibility gate & banner copy.
     - `gallery`: Homepage photo gallery showcase visibility gate.
   - **Category C (Static Context - Read-Only):**
     - `experience`, `choose_setting`, `trust_points`, `team`, `reasons`, `contact_presentation`.
     - Prominently labeled with `STATIC / NOT MANAGED HERE` badge and explanation. No invented database rows or fake input fields.

3. **Safe Link Destination Selector (`LinkPicker`):**
   - Verified public route & anchor dropdown (`/`, `/book`, `/services`, `/branches`, `/about`, `/contact`, `/products`, `/home-service-massage-bacolod`, `/massage-spa-bacolod`, `#plan-your-visit`, `#philosophy`, `#experience`).
   - Custom external URL validation ensuring `http://` or `https://` schemes only, strictly rejecting unsafe schemes (`javascript:`, `data:`).

4. **Universal Media Picker Integration:**
   - Fully integrated for primary and secondary image slots across all managed sections.
   - Selecting media updates in-memory form values without losing other unsaved field edits.

5. **Unsaved Changes Guard, Save-Dirty State & Revert to Live:**
   - Unsaved dirty state tracked against baseline loaded values.
   - Immediate dirty-state clearance and submittable draft registration upon successful Save Draft.
   - Section switching intercepted with accessible confirmation dialog (Tab focus trap, Escape dismissal, ARIA attributes).
   - "Revert to Live" safely resets in-memory editor to published live values with zero database mutations.

6. **Preserved Owner Review Queue & Publication Boundary:**
   - Preserved `DraftReviewQueue` below the studio with full owner action handlers (`approveMarketingDraftAction`, `requestMarketingDraftChangesAction`, `scheduleMarketingDraftAction`, `publishMarketingDraftAction`, `archiveMarketingDraftAction`).
   - **Digital Marketer (`role="digital_marketer"`):**
     - Allowed: Save Draft, Submit for Review, Revert to Live.
     - Prominent review note alert displayed when draft status is `changes_requested`.
     - Prohibited: No Approve, Schedule, Publish, or Archive controls.
   - **Owner (`role="owner"`):**
     - Full governance controls: Save Draft, Request Changes (with review note modal), Approve, Schedule (with date/time modal), Publish to Live, Archive Draft, and Revert to Live.

---

## 4. Verification & Quality Gates

### 1. Automated Test Suite

```bash
pnpm vitest run --pool=threads
```

- **Result:** 205 test files, 1,443 tests PASSED (0 failed).

### 2. Marketing & Website Studio Dedicated Suite

```bash
pnpm vitest run tests/lib/marketing/
```

- **Result:** 6 test files, 75 tests PASSED:
  - `tests/lib/marketing/website-studio.test.tsx` (19 tests passed)
  - `tests/lib/marketing/media-library.test.tsx` (14 tests passed)
  - `tests/lib/marketing/public-consumer-parity.test.tsx` (12 tests passed)
  - `tests/lib/marketing/media-queries.test.ts` (17 tests passed)
  - `tests/lib/marketing/media-usage.test.ts` (9 tests passed)
  - `tests/lib/marketing/marketing-studio-foundation-migration.test.ts` (4 tests passed)

### 3. TypeScript Type-Check

```bash
pnpm type-check
```

- **Result:** 0 errors (`tsc --noEmit`).

### 4. ESLint Check

```bash
pnpm lint
```

- **Result:** 0 errors.

### 5. Prettier Code Formatting

```bash
pnpm format:check
```

- **Result:** All matched files use Prettier code style (0 errors).

### 6. Next.js Production Build

```bash
pnpm build
```

- **Result:** Compiled successfully; 115/115 static pages generated.

### 7. Git Diff Cleanliness

```bash
git diff --check origin/main...HEAD
```

- **Result:** 0 whitespace or conflict errors across exact 14-file scope.

---

## 5. Production & Rollback Declarations

### Production Verification Limitations:

No production-data mutation was reported or intentionally performed during the recorded C5.3 workflow. Production database, Storage, deployment, and runtime state were not independently verified.

### REPOSITORY-RECORDED PRODUCTION EVIDENCE:

The final isolated C5.3 branch introduces no SQL migrations, schema changes, Auth changes, RLS changes, or Storage-policy changes.

### Rollback Protocol:

Code rollback is available through git revert of the C5.3 commits. Any runtime drafts or content mutations created through later use of the feature would require state-aware reconciliation. No production runtime state was independently verified during this implementation review.
