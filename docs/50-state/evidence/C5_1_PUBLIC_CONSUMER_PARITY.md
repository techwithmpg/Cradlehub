# C5.1 Public Consumer Parity & Component Grounding Evidence Report

- **Date:** 2026-09-01
- **Program:** Controlled Stabilization
- **Stage:** C5 — Implementation (Digital Marketing Workspace)
- **Pass:** Pass 1 — Public Consumer Parity & Component Grounding
- **Accepted Base SHA:** `d7958594e9d7369791acd29277c92a8eabf6bac3`
- **Branch:** `stage/c5-1-public-consumer-parity`
- **Governance Ref:** `docs/11-DECISION-LOG.md` (`GOV-020`)
- **Status:** IMPLEMENTED / QUALITY GATES PASSED / READY FOR INDEPENDENT REVIEW

---

## 1. Executive Summary

C5 Pass 1 resolves the core public consumer divergence diagnosed in C2 (`MKT-001`) and planned in C4. Prior to C5.1, desktop public rendering consumed managed section data (`public_site_sections`) via `HomePageSections`, while mobile public rendering (`PublicMobileHome` and `MobileHomeHeroCarousel`) rendered hardcoded, static text.

C5 Pass 1 establishes single-source canonical parity across desktop and mobile, extracts typed presentational adapters, and isolates presentation components from direct database access so that future Marketing Studio preview rails can render real components in-memory with draft data.

---

## 2. Scope & Guardrail Compliance

| Guardrail | Required State | Actual State | Compliance |
|---|---|---|---|
| Database Schema / DDL | ZERO changes | ZERO SQL / DDL files touched | PASS |
| Migrations | ZERO new migrations | ZERO migrations added or executed | PASS |
| Auth & RLS Policies | ZERO modifications | ZERO Auth / RLS policies altered | PASS |
| Storage Policies | ZERO modifications | ZERO Storage buckets / rules altered | PASS |
| Production Data | ZERO mutation | ZERO mutations executed | PASS |
| C5 Pass Scope | Pass 1 ONLY | Pass 1 public presentation grounding ONLY | PASS |
| Subsequent Passes | NOT AUTHORIZED | Passes 2–5 strictly withheld pending owner gate | PASS |

---

## 3. Architecture & Implementation Summary

### 3.1 Normalized Presentation Adapter (`src/lib/public/normalized-sections.ts`)
Creates typed presentation interfaces:
- `NormalizedHeroSection`: title, subtitle, ctaLabel, ctaHref, imageUrl, secondaryImageUrl, secondaryCtaLabel, secondaryCtaHref, brandEyebrow, isEnabled.
- `NormalizedAboutSection`: title, subtitle, body, paragraphs, imageUrl, secondaryImageUrl, isEnabled.
- `NormalizedQuoteBannerSection`: title, subtitle, body, ctaLabel, ctaHref, imageUrl, isEnabled.
- `NormalizedBeforeYouBookSection`: title, subtitle, body, items, isEnabled.
- `NormalizedSignatureServicesSection`: title, subtitle, body, isVisible.
- `NormalizedGallerySection`: isVisible.
- `resolvePublicSiteSections(sections)`: Pure deterministic resolver that applies canonical defaults for any omitted or empty fields and respects `is_enabled: false` visibility flags.

### 3.2 Mobile Public Grounding (`src/components/public/mobile/`)
- **`MobileHomeHeroCarousel` (`mobile-home-hero-carousel.tsx`):**
  - Consumes `NormalizedHeroSection` directly.
  - Dynamically renders canonical title, subtitle, primary CTA label & href, secondary CTA label & href, and brand eyebrow.
  - Uses managed `hero.imageUrl` for Slide 1 with fallback to `SPA_IMAGES.heroMobile`.
  - Preserves ambient multi-slide carousel background visuals (Slide 2 `SPA_IMAGES.heroWide`, Slide 3 `SPA_IMAGES.heroAmbience`).
  - Returns `null` when `hero.isEnabled === false`, matching desktop visibility gating.
- **`MobileFinalCta` (`mobile-final-cta.tsx`):**
  - Consumes `NormalizedQuoteBannerSection`.
  - Dynamically renders quote banner title, body, and CTA label & href with fallback to calm defaults.
  - Returns `null` when `quoteBanner.isEnabled === false`.
- **`PublicMobileHome` (`public-mobile-home.tsx`):**
  - Accepts `branches`, `services`, and `sections: NormalizedPublicSiteSections` props.
  - Passes canonical `hero` and `quoteBanner` data to presentational subcomponents without performing internal database queries.
- **`MobileScrollEffects` (`mobile-scroll-effects.tsx`):**
  - Added defensive browser checks for `window.matchMedia` and `IntersectionObserver`.

### 3.3 Desktop Public Grounding (`src/components/public/home-page-sections.tsx`)
- Standardized `HomePageSections` to accept `sections?: NormalizedPublicSiteSections` and `services?: PublicCatalogService[]`.
- Eliminated redundant inline section parsers and replaced them with `resolvePublicSiteSections`.
- Preserved 100% desktop visual hierarchy, layout, styling, and typography.

### 3.4 Root Public Page Integration (`src/app/page.tsx`)
- Concurrently fetches `getPublicBranches()`, `getPublicServiceCatalog()`, and `getPublicSiteSections({ includeDisabled: true })`.
- Resolves `normalizedSections = resolvePublicSiteSections(managedSections)`.
- Passes the same resolved data to both `<PublicMobileHome />` and `<HomePageSections />`, guaranteeing single-source consumer parity.

---

## 4. Verification & Quality Gates

### 4.1 Automated Test Suite
- **Command:** `pnpm vitest run`
- **Result:** 201 test files passed, 1380 tests passed, 0 failures.
- **New Test Suite:** `tests/lib/marketing/public-consumer-parity.test.tsx` (8 unit & component tests covering canonical resolution, custom field mapping, visibility gating, and component prop grounding).

### 4.2 TypeScript Type-Check
- **Command:** `pnpm type-check` (`tsc --noEmit`)
- **Result:** 0 errors (Exit code 0).

### 4.3 ESLint
- **Command:** `pnpm lint` (`eslint`)
- **Result:** 0 errors, 0 warnings (Exit code 0).

### 4.4 Code Formatting
- **Command:** `pnpm format:check`
- **Result:** All incremental files compliant with Prettier.

### 4.5 Production Build
- **Command:** `pnpm build` (`next build`)
- **Result:** 114 static and dynamic routes compiled and generated successfully with zero errors.

### 4.6 Diff Check
- **Command:** `git diff --check`
- **Result:** Clean (no whitespace or conflict markers).

---

## 5. File Inventory

| File | Type | Purpose |
|---|---|---|
| `src/lib/public/normalized-sections.ts` | NEW | Typed presentation models & deterministic section normalizer |
| `src/components/public/mobile/mobile-home-hero-carousel.tsx` | MODIFIED | Grounded mobile hero to consume canonical Hero data |
| `src/components/public/mobile/mobile-final-cta.tsx` | MODIFIED | Grounded mobile final CTA to consume quote banner data |
| `src/components/public/mobile/mobile-scroll-effects.tsx` | MODIFIED | Defensive checks for window.matchMedia & IntersectionObserver |
| `src/components/public/mobile/public-mobile-home.tsx` | MODIFIED | Prop acceptance for canonical sections & services |
| `src/components/public/home-page-sections.tsx` | MODIFIED | Standardized desktop sections to use normalized adapter |
| `src/app/page.tsx` | MODIFIED | Root public page single-source fetching & prop dispatch |
| `tests/lib/marketing/public-consumer-parity.test.tsx` | NEW | Unit & component tests for consumer parity |
| `docs/50-state/evidence/C5_1_PUBLIC_CONSUMER_PARITY.md` | NEW | C5.1 implementation and verification evidence report |

---

## 6. Stop Condition & Next Gate

C5 Pass 1 implementation is complete, verified, and pushed to `stage/c5-1-public-consumer-parity`.
In accordance with governance rules:
- **DO NOT MERGE C5.1.**
- **STOP AND AWAIT INDEPENDENT REVIEW & OWNER GATE.**
- Later C5 passes (Passes 2–5) remain strictly NOT AUTHORIZED.
