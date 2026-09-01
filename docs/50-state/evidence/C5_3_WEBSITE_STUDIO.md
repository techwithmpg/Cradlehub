# C5 Pass 3 Evidence — Website Studio & High-Fidelity Preview

## 1. Executive Summary & Governance Coordinates

- **Pass:** C5 Pass 3 (Website Studio & High-Fidelity Preview)
- **Status:** IMPLEMENTED / AWAITING INDEPENDENT REVIEW
- **Date:** 2026-09-01
- **Branch:** `stage/c5-3-website-studio`
- **Accepted Starting Base SHA:** `f71f0b0c9d0de60a11386814cd23c200ca99496b`
- **Scope-Isolation Correction SHA:** `facfa4dd49a007b1e8c57f96d448c56954b0c27f`
- **Previous Reviewed Candidate SHA:** `216fac56bb5fa1606b4e94a6f786f3ba8121e340`
- **Targeted Implementation Correction SHA:** `9af281d98396ebae8e191329b8a401df6b09d311`
- **Review Candidate Head:** Resolve from `origin/stage/c5-3-website-studio` at independent review time.
- **Active Governance Decision:** `GOV-025` recorded in `docs/11-DECISION-LOG.md`
- **Scope Compliance:** Website Studio & High-Fidelity Preview ONLY. Real public presentation grounding extracted from existing public components without altering consumer behavior. Preserved existing Owner review queue and C5.2 Media Library. No migrations, no database schema mutations, no Auth/RLS/Storage policy modifications, no production-data mutations. C5 Pass 4 and Pass 5 remain strictly NOT AUTHORIZED.

---

## 2. Scope Incident & Isolation Record

A repository-wide formatting command (`pnpm format`) introduced unrelated formatting changes across CRM, booking, staff onboarding, manager operations, and public APIs in commit `3fb22d2458a8810ab54230a5d77e01b6b3b7ca34`. Those paths were restored exactly to `origin/main` in a non-rewriting cleanup commit (`facfa4dd49a007b1e8c57f96d448c56954b0c27f`).

In the targeted corrections, `HomePageSectionsRenderer` and `PublicMobileHomeRenderer` were extracted from existing public home components to provide true component grounding for the studio preview without duplicating presentation code, responsive hiding was removed from the pure renderer and kept on the public wrapper, and all modals were upgraded to repository `Dialog` primitives.

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
   - **Public Parity:** Pure `PublicMobileHomeRenderer` contains no `md:hidden`, allowing responsive preview within the desktop studio rail; public `PublicMobileHome` retains `md:hidden` for mobile-only public rendering. Both share identical `isPublicSafeService` filtering (`isPublicBookable && !isCsrOnly && !isVip`).

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

5. **Isolated Viewport Context (`IsolatedViewportFrame`) & CSS Media-Query Isolation:**
   - Previews in Desktop (1280px), Tablet (768px), and Mobile (375px) modes are encapsulated in an isolated `iframe` via React portal (`IsolatedViewportFrame`).
   - Host stylesheets and inline styles are dynamically synchronized into the iframe's `<head>`, allowing Tailwind CSS media queries (`@media (min-width: 768px)`, `md:`, `lg:`, `xl:`) and CSS viewport units to evaluate genuinely against the preview container's exact pixel width rather than the author's browser window.
   - Renders the REAL `HomePageSectionsRenderer` (Desktop/Tablet) and `PublicMobileHomeRenderer` (Mobile) without mock JSX.

6. **Service Parity Between Mobile and Desktop/Tablet:**
   - **Mobile Viewport:** Enforces `isPublicSafeService` filtering (`isPublicBookable && !isCsrOnly && !isVip`), matching public mobile consumer rules and excluding CSR-only, VIP, and non-bookable offerings.
   - **Desktop & Tablet Viewports:** Receive the complete public catalog dataset matching the real `HomePageSections` public consumer on `/`.

7. **Unsaved Changes Guard, Save-Dirty State & Revert to Live:**
   - Unsaved dirty state tracked against baseline loaded values.
   - Immediate dirty-state clearance and submittable draft registration upon successful Save Draft.
   - Section switching intercepted with accessible confirmation dialog (`Dialog` primitive with Tab focus trap, Escape dismissal, ARIA attributes).
   - "Revert to Live" safely resets in-memory editor to published live values with zero database mutations.

8. **Preserved Owner Review Queue & Publication Boundary:**
   - Preserved `DraftReviewQueue` below the studio with full owner action handlers (`approveMarketingDraftAction`, `requestMarketingDraftChangesAction`, `scheduleMarketingDraftAction`, `publishMarketingDraftAction`, `archiveMarketingDraftAction`).
   - **Digital Marketer (`role="digital_marketer"`):**
     - Allowed: Save Draft, Submit for Review, Revert to Live.
     - Prominent review note alert displayed when draft status is `changes_requested`.
     - Prohibited: No Approve, Schedule, Publish, or Archive controls.
   - **Owner (`role="owner"`):**
     - Full governance controls: Save Draft, Request Changes (with accessible `Dialog` review note modal), Approve, Schedule (with accessible `Dialog` date/time modal), Publish to Live, Archive Draft, and Revert to Live.

---

## 4. Verification & Quality Gates (Accelerated Verification Mode)

### 1. Targeted Website Studio & Viewport Isolation Suite

```bash
pnpm vitest run tests/lib/marketing/website-studio.test.tsx
```

- **Result:** 1 test file, 30 tests PASSED (0 failed):
  - Viewport isolation mechanism (1280px Desktop, 768px Tablet, 375px Mobile)
  - Mobile service filtering (`isPublicSafeService` rule verification)
  - Desktop service dataset parity (`HomePageSectionsRenderer` public dataset match)
  - Realtime in-memory reactivity and Draft/Live/Compare modes
  - Dialog accessibility (`Dialog` primitives for Mobile Preview, Request Changes, Schedule, Unsaved Changes, Revert to Live)
  - Save-dirty state clearance and immediate submit action availability

### 2. TypeScript Type-Check

```bash
pnpm type-check
```

- **Result:** 0 errors (`tsc --noEmit`).

### 3. Prettier Code Formatting

```bash
npx prettier --check <TOUCHED_FILES>
```

- **Result:** All modified files strictly conform to Prettier code style (0 errors).

### 4. Git Diff Cleanliness

```bash
git diff --check origin/main...HEAD
```

- **Result:** 0 whitespace or conflict errors across exact 16-file scope.

---

## 5. Production & Rollback Declarations

### Production Verification Limitations:

No production-data mutation was reported or intentionally performed during the recorded C5.3 workflow. Production database, Storage, deployment, and runtime state were not independently verified.

### REPOSITORY-RECORDED PRODUCTION EVIDENCE:

The final isolated C5.3 branch introduces no SQL migrations, schema changes, Auth changes, RLS changes, or Storage-policy changes.

### Rollback Protocol:

Code rollback is available through git revert of the C5.3 commits. Any runtime drafts or content mutations created through later use of the feature would require state-aware reconciliation. No production runtime state was independently verified during this implementation review.
