# C5.1 Public Consumer Parity & Component Grounding Evidence Report

- **Date:** 2026-09-01
- **Program:** Controlled Stabilization
- **Stage:** C5 — Implementation (Digital Marketing Workspace)
- **Pass:** Pass 1 — Public Consumer Parity & Component Grounding
- **Accepted Base SHA:** `d7958594e9d7369791acd29277c92a8eabf6bac3`
- **Initial C5.1 Implementation SHA:** `3d9d6f851b8194af300b68293a29020310233168`
- **Corrected C5.1 Head SHA:** `7ce538558bc9c80bb05e63992e0bc866c3741ebf`
- **Reviewed Evidence Head SHA:** `f8b1a73ef580979e00ca47df1eb92f77e22a20d7`
- **Governance Head SHA:** `d1317ed1ba4ac245b51faeac22c170426d6a1374`
- **Accepted Main Merge SHA:** `1f5d71ce3472684c9a94ad83d6c2e36a9d1b1971`
- **PR Number:** 8
- **Branch:** `stage/c5-1-public-consumer-parity`
- **Governance Ref:** `docs/11-DECISION-LOG.md` (`GOV-021`, `GOV-022`)
- **Status:** CLOSED / ACCEPTED INTO MAIN (PR #8)

---

## 1. Executive Summary & Objective

C5 Pass 1 establishes single-source canonical presentation parity between desktop and mobile public homepages, resolves the core public consumer divergence diagnosed in C2 (`MKT-001`), and prepares components for future in-memory Marketing Studio preview without modifying database schemas or applying migrations.

Following independent review feedback, this corrected pass:
1. Restores strict public-service safety filtering (`isPublicBookable && !isCsrOnly && !isVip`) in `PublicMobileHome` across both prop-supplied and fallback paths.
2. Restores exact pre-C5 desktop Quote Banner fallback semantics (default `ctaLabel = ""` so no CTA is invented when unconfigured).
3. Aligns `MobileFinalCta` to strictly honor canonical normalized `quoteBanner` props without inventing text through `||` fallbacks.
4. Removes speculative `.catch(() => [])` root query error swallowing in `src/app/page.tsx`.
5. Accurately documents structural query consolidation without claiming unmeasured performance improvements.

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

## 3. Architecture & Corrections Applied

### 3.1 Normalized Presentation Adapter (`src/lib/public/normalized-sections.ts`)
- **Hero:** Resolves `title`, `subtitle`, `ctaLabel`, `ctaHref`, `imageUrl`, `secondaryImageUrl`, `secondaryCtaLabel`, `secondaryCtaHref`, `brandEyebrow`, and `isEnabled`.
- **About:** Resolves `title`, `subtitle`, `body`, `paragraphs`, `imageUrl`, `secondaryImageUrl`, and `isEnabled`.
- **Quote Banner:** Resolves `title`, `subtitle`, `body` (default `""`), `ctaLabel` (default `""`), `ctaHref` (`"/book"`), `imageUrl`, and `isEnabled`. Absence of configured CTA or body produces empty strings and does not invent text.
- **Before You Book:** Resolves `title`, `subtitle`, `body`, `items`, and `isEnabled`.
- **Signature Services & Gallery:** Resolves visibility flags `isVisible`.

### 3.2 Public Service Filtering Safety (`src/components/public/mobile/public-mobile-home.tsx`)
- Defines `isPublicSafeService = (s) => Boolean(s.isPublicBookable && !s.isCsrOnly && !s.isVip)`.
- Filters services regardless of whether they are supplied via props from `HomePage` or fetched through the compatibility fallback.
- Guarantees CSR-only, VIP/hidden, and non-public-bookable services are never forwarded to `MobileCalmCategories`, `MobileMostLovedTreatments`, or `MobileSignatureRituals`.

### 3.3 Mobile Final CTA Parity (`src/components/public/mobile/mobile-final-cta.tsx`)
- When `quoteBanner` prop is supplied:
  - `isEnabled === false` returns `null`.
  - Renders `quoteBanner.title`, `quoteBanner.subtitle`, `quoteBanner.imageUrl`.
  - `quoteBanner.body` is rendered only if non-empty (`body ? <p>{body}</p> : null`).
  - `quoteBanner.ctaLabel` is rendered only if non-empty (`ctaLabel ? <Link>{ctaLabel}</Link> : null`).
  - Does NOT convert empty strings into fallback text.
- Standalone fallback copy is used only when the entire `quoteBanner` prop is omitted.

### 3.4 Query Error Semantics Preservation (`src/app/page.tsx`)
- Removed `.catch(() => [])` wrappers from `getPublicServiceCatalog()` and `getPublicSiteSections({ includeDisabled: true })`.
- Standard Next.js server component query semantics preserved.

### 3.5 Component Grounding & Query Consolidation Clarification
- The root homepage supplies normalized data so the normal homepage render does not require duplicate component-level queries.
- Compatibility fallback querying remains inside standalone components if props are omitted.
- Query consolidation alters structural component data flow; no measured latency or throughput claims are made as no live benchmark was executed.

---

## 4. Verification & Quality Gates

### 4.1 Automated Test Suite
- **Command:** `pnpm vitest run`
- **Result:** 201 test files passed, 1384 tests passed, 0 failures.
- **Unit & Contract Coverage:** `tests/lib/marketing/public-consumer-parity.test.tsx` (12 tests covering canonical resolution, quote banner empty/custom CTA semantics, hero grounding and ambient slides, visibility gating, and mixed-catalog service filtering).

### 4.2 TypeScript Type-Check
- **Command:** `pnpm type-check` (`tsc --noEmit`)
- **Result:** 0 errors (Exit code 0).

### 4.3 ESLint
- **Command:** `pnpm lint` (`eslint`)
- **Result:** 0 errors, 0 warnings (Exit code 0).

### 4.4 Code Formatting
- **Command:** `npx prettier --check` on authorized files
- **Result:** 100% compliant with Prettier.

### 4.5 Production Build
- **Command:** `pnpm build` (`next build`)
- **Result:** 114 static and dynamic routes compiled and generated successfully with zero errors.

### 4.6 Diff Check
- **Command:** `git diff --check`
- **Result:** Clean (no whitespace, CRLF, or merge conflict issues).

---

## 5. Responsive & Interaction QA Summary (Local Environment)

- **Target:** `http://localhost:3000/`
- **Environment:** LOCAL DEVELOPMENT SERVER
- **Method:** Local interactive browser QA and server-rendered DOM inspection.
- **Evaluated Viewports & Observations:**
  - `320px`: Mobile hero title wraps cleanly without horizontal overflow; CTAs stack cleanly; Hero CTA touch targets are 44px high (`h-11`) and meet the accepted $44 \times 44\text{px}$ minimum.
  - `375px`: Hero carousel displays canonical managed hero title & copy on Slide 1; ambient three-slide background sequence remained functional; service categories and Final CTA render with no clipping or horizontal scroll.
  - `414px`: Fluid padding and typography layout adapt cleanly across expanded mobile widths.
  - `768px`: Tablet breakpoint transitions smoothly from mobile layout to desktop view.
  - `1280px`: Desktop homepage displays full hero typography, philosophy section, service category cards, Quote Banner without invented CTA, Why Guests Choose Cradle grid, and FAQ accordion.
- **Artifact Retention Note:** No screenshot artifact retained; observations are local interactive QA.
- **Console & SSR Health:** Zero runtime exceptions or unhandled promise rejections on root render.

---

## 6. Limitations

- **Local verification only:** Testing was conducted against the local development server; no production browser QA is claimed.
- **Zero live database mutation:** No live database rows were mutated during C5.1.
- **Zero production data mutation:** Production databases and services were untouched.
- **No schema / RLS / Auth / Storage verification:** C5.1 strictly excluded data-layer and infrastructure modifications.
- **Marketing Studio UI unchanged:** Marketing Studio UI/UX is not implemented in Pass 1.
- **Public consumer grounding only:** Scope is strictly limited to public desktop and mobile presentation consumers.
- **Later passes unauthorized:** Media Library, Website Studio, Brand Studio, Branches Studio, and Services Studio remain unauthorized future passes.
- **No performance improvement claimed:** While query structure was consolidated, no latency or throughput improvement is claimed as no formal benchmark was conducted.

---

## 7. Rollback Considerations

- **Current State:** The branch `stage/c5-1-public-consumer-parity` is currently unmerged.
- **Pre-Merge Rollback:** Discard or close the working branch with zero impact on `origin/main`.
- **Post-Merge Rollback:** If a regression is discovered after merge, revert the C5.1 merge commit via the standard reviewed pull request workflow.
- **Database Safety:** No database or migration rollback steps are required because C5.1 contains zero schema, DDL, or data modifications.

---

## 8. File Inventory

| File | Type | Purpose |
|---|---|---|
| `src/lib/public/normalized-sections.ts` | NEW | Typed presentation models & deterministic section normalizer |
| `src/components/public/mobile/mobile-home-hero-carousel.tsx` | MODIFIED | Grounded mobile hero to consume canonical Hero data |
| `src/components/public/mobile/mobile-final-cta.tsx` | MODIFIED | Grounded mobile final CTA to exact quoteBanner semantics |
| `src/components/public/mobile/mobile-scroll-effects.tsx` | MODIFIED | Defensive checks for window.matchMedia & IntersectionObserver |
| `src/components/public/mobile/public-mobile-home.tsx` | MODIFIED | Restored public-safe service filtering & prop acceptance |
| `src/components/public/home-page-sections.tsx` | MODIFIED | Standardized desktop sections to use normalized adapter |
| `src/app/page.tsx` | MODIFIED | Single-source root queries without broad error swallowing |
| `tests/lib/marketing/public-consumer-parity.test.tsx` | NEW | Unit & contract tests for parity, fallback, and service safety |
| `docs/50-state/evidence/C5_1_PUBLIC_CONSUMER_PARITY.md` | NEW | C5.1 implementation and verification evidence report |

---

## 9. Status & Next Gate

- **C5 Pass 1 Status:** CLOSED / ACCEPTED INTO MAIN (PR #8, Merge SHA `1f5d71ce3472684c9a94ad83d6c2e36a9d1b1971`)
- **C5 Pass 2 Status:** ACTIVE (Central Media Library & Universal Media Picker)
- **C5 Pass 3+ Status:** STRICTLY NOT AUTHORIZED (Withheld pending owner review and stage gate authorization)
- **Branch Action:** Merged into `main` via PR #8.
