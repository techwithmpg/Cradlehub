# C2 Structured Diagnostics Report: Digital Marketing Workspace & Public-Site Consumers

**Program:** Controlled Stabilization
**Stage:** C2 — Structured Diagnostics (READ-ONLY)
**Target:** CradleHub Web — Digital Marketing Workspace (`/marketing`, `/owner/marketing`) & Public-Site Consumers
**Base SHA:** `3f402e033e1d1ca05b8cc8a4f2764823f7aaa622` (Accepted C1 truth consolidation merge on `main`)
**Branch:** `stage/c2-marketing-diagnostics`
**Original C2 Diagnostic Delivery SHA:** `88a0136b246bbfbcf780a7cd4a30ec7c651fa2df`
**First Correction Commit SHA:** `65c153edd7128f15237b65c69323819734177ec8`
**Current Correction Commit SHA:** (Recorded in git log upon commit; reported in handoff)
**Date:** 2026-09-01
**Status:** REPORT CORRECTED / AWAITING INDEPENDENT REVIEW (Zero Implementation / Zero Production Mutation)

---

## A. Executive Summary & Authorization Scope

1. **C1 Acceptance & Merge Closeout:** C1 Truth Consolidation was formally accepted by the owner and successfully merged into production-connected `main` at commit SHA `3f402e033e1d1ca05b8cc8a4f2764823f7aaa622` via Pull Request #1.
2. **C2 Authorization:** Conditioned on the accepted C1 merge, C2 Structured Diagnostics was authorized exclusively for the **Digital Marketing Workspace** (`/marketing`, `/owner/marketing`) and its shared public-site consumers.
3. **Guardrails Strictly Observed:**
   - C2 is **READ-ONLY DIAGNOSTICS**.
   - Zero product implementation, zero schema mutation, zero migration application, zero RLS/Storage changes, zero production deployment.
   - Production evidence is classified as **REPOSITORY-RECORDED PRODUCTION EVIDENCE**.

---

## B. Inspected Repository Files

### 1. Marketing Workspace & Server Actions
- `src/app/(dashboard)/marketing/page.tsx`
- `src/app/(dashboard)/marketing/actions.ts`
- `src/app/(dashboard)/marketing/marketing-workspace.tsx`
- `src/app/(dashboard)/owner/marketing/page.tsx`
- `src/app/(dashboard)/owner/marketing/actions.ts`
- `src/app/(dashboard)/owner/marketing/marketing-studio.tsx`

### 2. Data Queries, Mutations & Helpers
- `src/lib/queries/marketing-content.ts` (drafts, revisions, approvals, scheduling, publishing)
- `src/lib/queries/public-site.ts` (live section and asset queries/updates)
- `src/lib/queries/branches.ts` (branch queries and caching)
- `src/lib/queries/services.ts` (public catalog resolution)
- `src/lib/services/service-catalog.ts` (master and branch service catalog engine)
- `src/lib/services/service-eligibility.ts` (visibility and delivery mode normalization)

### 3. Schemas, Defaults & Validation
- `src/lib/marketing/public-section-defaults.ts` (fallback copy and section metadata)
- `src/lib/public/public-site-data.ts` (static proof points, journey steps, setting cards)
- `src/lib/public/service-catalog-config.ts` (category definitions and fallback images)
- `src/lib/validations/marketing.ts` (draft validation schemas)
- `src/lib/validations/public-site.ts` (live section/asset schemas)
- `supabase/migrations/20260803042453_marketing_studio_foundation.sql` (Marketing Studio DB schema)
- `src/types/supabase.ts` (TypeScript database type definitions)

### 4. Public Pages & Presentational Components
- `src/app/page.tsx` (Homepage root)
- `src/app/(public)/layout.tsx` (Public shell layout)
- `src/app/(public)/about/page.tsx` (About page)
- `src/app/(public)/services/page.tsx` (Services catalog page)
- `src/app/(public)/branches/page.tsx` (Branches directory page)
- `src/app/(public)/contact/page.tsx` (Contact page)
- `src/components/public/home-page-sections.tsx` (Desktop homepage sections)
- `src/components/public/mobile/public-mobile-home.tsx` (Mobile homepage orchestrator)
- `src/components/public/mobile/mobile-home-hero-carousel.tsx` (Mobile hero carousel)
- `src/components/shared/brand-logo.tsx` (Brand logo component)

---

## C. Existing Architecture & System Topology

```mermaid
flowchart TD
    subgraph Roles["Actor Roles"]
        DM["Digital Marketer (digital_marketer)"]
        OWN["Owner (owner)"]
        PUB["Public Guest (anon)"]
    end

    subgraph Workspaces["Workspace Layer"]
        MKT_UI["/marketing (Marketer Workspace)"]
        OWN_MKT["/owner/marketing (Owner Studio)"]
    end

    subgraph DataTables["Database Tables"]
        MCD["marketing_content_drafts"]
        MCR["marketing_content_revisions"]
        MMA["marketing_media_assets"]
        MBS["marketing_brand_settings"]
        MSS["marketing_seo_settings"]
        PSS["public_site_sections (LIVE)"]
        PSA["public_site_assets (LIVE)"]
        BR["branches (LIVE)"]
        SRV["services & branch_services (LIVE)"]
    end

    subgraph Storage["Supabase Storage"]
        BUCKET["Bucket: public-site-media"]
    end

    subgraph Consumers["Public Site Consumers"]
        DESK_HOME["Desktop Home (HomePageSections)"]
        MOB_HOME["Mobile Home (PublicMobileHome)"]
        SVC_PAGE["/services"]
        BR_PAGE["/branches"]
        ABT_PAGE["/about"]
    end

    DM -->|Save / Submit Drafts| MKT_UI
    MKT_UI -->|Writes draft & revision| MCD
    MKT_UI -->|Writes audit log| MCR
    MKT_UI -->|Uploads image asset| BUCKET
    MKT_UI -->|Registers media metadata| MMA

    OWN -->|Approve / Schedule / Publish| OWN_MKT
    OWN_MKT -->|Publishes draft to live| PSS
    OWN_MKT -->|Direct update fallback| PSA
    OWN_MKT -->|Status update & revision| MCD

    PSS -->|Reads live sections| DESK_HOME
    PSA -->|Reads gallery assets| DESK_HOME
    BR -->|Reads branch details| BR_PAGE
    BR -->|Reads branch contact/phone| DESK_HOME
    BR -->|Reads branch contact/phone| MOB_HOME
    SRV -->|Reads service catalog| SVC_PAGE
    SRV -->|Reads featured services| DESK_HOME
    SRV -->|Reads featured services| MOB_HOME

    BUCKET -->|Serves public images| PUB
```

---

## D. Consumer & Source of Truth Map

| Editable Concept | Canonical Source | Query Location | Mutation Action | Owning Workspace | Public Consumers | Cache / Revalidation Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Homepage Hero** | `public_site_sections` (`section_key = 'hero'`) | `getPublicSiteSections()` | `updatePublicSiteSection()` / `publishMarketingContentDraft()` | `/owner/marketing` (Drafted in `/marketing`) | `src/components/public/home-page-sections.tsx` (Desktop only) | `revalidatePath('/')` + `revalidatePath('/owner/marketing')` |
| **Homepage About** | `public_site_sections` (`section_key = 'about'`) | `getPublicSiteSections()` | `updatePublicSiteSection()` / `publishMarketingContentDraft()` | `/owner/marketing` (Drafted in `/marketing`) | `src/components/public/home-page-sections.tsx` (Desktop only) | `revalidatePath('/')` + `revalidatePath('/owner/marketing')` |
| **Homepage Promotion / Quote Banner** | `public_site_sections` (`section_key = 'quote_banner'`) | `getPublicSiteSections()` | `updatePublicSiteSection()` / `publishMarketingContentDraft()` | `/owner/marketing` (Drafted in `/marketing`) | `src/components/public/home-page-sections.tsx` (Desktop only) | `revalidatePath('/')` + `revalidatePath('/owner/marketing')` |
| **Before You Book** | `public_site_sections` (`section_key = 'before_you_book'`) | `getPublicSiteSections()` | `updatePublicSiteSection()` / `publishMarketingContentDraft()` | `/owner/marketing` (Drafted in `/marketing`) | `src/components/public/home-page-sections.tsx` (Desktop only) | `revalidatePath('/')` + `revalidatePath('/owner/marketing')` |
| **Gallery Images** | `public_site_assets` (`section_key = 'gallery'`) | `getPublicSiteAssets('gallery')` | `createPublicSiteAsset()` / `updatePublicSiteAsset()` / `disablePublicSiteAsset()` | `/owner/marketing` | `src/lib/public/public-site-data.ts` (Static fallback) / `public_site_assets` | `revalidatePath('/')` + `revalidatePath('/owner/marketing')` |
| **Marketing Drafts** | `marketing_content_drafts` | `getMarketingContentDrafts()` | `saveMarketingContentDraft()`, `submitMarketingContentDraft()` | `/marketing` | None (Internal workspace only) | `revalidatePath('/marketing')`, `revalidatePath('/owner/marketing')` |
| **Revision History** | `marketing_content_revisions` | `getMarketingContentRevisions()` | `insertMarketingRevision()` (Internal trigger) | `/marketing` & `/owner/marketing` | None (Internal workspace only) | Revalidated with workspace |
| **Media Assets** | `marketing_media_assets` | DB table (Foundation ready) | Storage upload + metadata record | `/marketing` (Future Media Library) | `public-site-media` bucket consumers | Storage cache headers |
| **Brand Settings** | `marketing_brand_settings` | DB table (Foundation ready) | Migration ready; UI currently uses static SVGs | `/owner/marketing` (Future Brand Studio) | `BrandLogo` across public, auth, and dashboard | Static SVG bundling |
| **SEO Settings** | `marketing_seo_settings` | DB table (Foundation ready) | Migration ready; UI currently uses static `buildMetadata()` | `/owner/marketing` (Future SEO Studio) | Next.js `metadata` in `app/**/page.tsx` | Route-level ISR/SSR |
| **Public Branch Fields** | `branches` (public columns) | `getPublicBranches()` / `getPublicBranchesCached()` | `updateBranch()` (Owner Branch Management) | `/owner/branches` | `/branches`, `/`, Header phone, Footer | `revalidateTag(cacheTags.publicBranches)` |
| **Public Service Fields** | `services` & `branch_services` | `getPublicServiceCatalog()` | `saveServiceAction()` (Owner Service Management) | `/owner/services` | `/services`, `/`, `/book` | `revalidatePath('/services')`, `revalidatePath('/book')` |

---

## E. Strict Authorization Boundaries

### 1. Digital Marketer (`digital_marketer`) Authority
- **Permitted Operations:**
  - Create, view, edit, and save drafts in `marketing_content_drafts` with statuses `draft`, `submitted`, `changes_requested`.
  - Submit drafts for owner review (`draft` → `submitted`).
  - View audit revision history in `marketing_content_revisions`.
  - Upload media files into `public-site-media` bucket (allowed via Storage RLS).
  - Create and edit draft metadata in `marketing_media_assets`.
- **Strictly Prohibited Operations (Enforced at RLS & Server Action Layers):**
  - **NO direct write access** to live `public_site_sections` or `public_site_assets`.
  - **NO draft approval, scheduling, publishing, or archiving** (must be performed by `owner`).
  - **NO authority over service operational prices, custom prices, duration, buffer times, or category rules.**
  - **NO authority over therapist eligibility, staff records, schedules, or onboarding.**
  - **NO authority over booking dispatch, attendance, customer records, payments, or payroll.**
  - **NO authority over branch operational activation, slot interval, or travel fee parameters.**
  - **NO RBAC, auth, or database security configuration rights.**

### 2. Owner (`owner`) Authority
- Full write access to both draft workflow (`marketing_content_drafts`) and live public tables (`public_site_sections`, `public_site_assets`).
- Exclusive authority to approve, request changes, schedule, publish, or archive marketing drafts.
- Exclusive authority to reconfigure operational parameters across all workspaces.

---

## F. Public-Site Dependency & Mobile Discrepancy Map

A major finding of C2 diagnostics is the **divergence between desktop and mobile public presentation**:

1. **Desktop Homepage (`src/components/public/home-page-sections.tsx`):**
   - Fully dynamic. Queries `public_site_sections` and falls back gracefully to `PUBLIC_SITE_SECTION_DEFAULTS`.
   - Any draft published via Marketing Studio updates the live desktop hero headline, subtitle, CTAs, background images, and about copy immediately upon page revalidation.
2. **Mobile Homepage (`src/components/public/mobile/public-mobile-home.tsx` & `mobile-home-hero-carousel.tsx`):**
   - **Static & Hardcoded.** The mobile hero carousel reads from hardcoded `HERO_SLIDES` (in `src/components/public/mobile/mobile-home-hero-carousel.tsx`) and hardcoded copy (`"Where calm meets care."`).
   - It does **NOT** read from `public_site_sections`!
   - Consequently, when an owner publishes marketing changes from `/owner/marketing` or `/marketing`, the changes **only appear on desktop screens**, leaving mobile users on the old hardcoded copy.
3. **Public Secondary Pages (`/about`, `/services`, `/branches`, `/contact`):**
   - `/about`: Uses static copy and constants (`SPA_IMAGES.about`).
   - `/branches`: Fully dynamic. Reads active branches from `branches` table via `getPublicBranches()`.
   - `/services`: Fully dynamic. Reads active services from `services` and `branch_services` via `getPublicServiceCatalog()`.

---

## G. Media & Storage Architecture

1. **Storage Bucket (`public-site-media`):**
   - **Verified Repository Fact:** The repository migration `supabase/migrations/20260803042453_marketing_studio_foundation.sql` defines `public-site-media` as a public bucket (`public = true`) and defines RLS policies:
     - `SELECT`: Allowed for `anon` and `authenticated`.
     - `INSERT`, `UPDATE`, `DELETE`: Restricted to `authenticated` users with `public.get_auth_role() in ('owner', 'digital_marketer')`.
   - **Live State Unknown:** LIVE APPLICATION OF THIS MIGRATION / STORAGE POLICY STATE WAS NOT VERIFIED IN C2.
2. **Media Assets Table (`marketing_media_assets`):**
   - **Verified Repository Fact:** Fields defined in repository schema: `id`, `bucket_path`, `public_url`, `title`, `alt_text` (min 3 chars required), `section_key`, `content_key`, `status` (`draft`, `submitted`, `approved`, `published`, `archived`), `metadata`, `created_by`, `updated_by`, `reviewed_by`.
3. **Orphan & Replacement Risks:**
   - Current codebase lacks an automated usage-reference tracking mechanism. If an image is deleted from Storage or replaced in `marketing_media_assets`, live `public_site_sections.image_url` or `marketing_content_drafts.image_url` may point to broken URLs if not validated.
   - Safe refactor path: Media picker must store both `bucket_path` and `public_url`, with soft-archiving instead of hard deletion.

---

## H. Brand & Logo Architecture

1. **Current Component Implementation (`src/components/shared/brand-logo.tsx`):**
   - Directly imports static SVG files: `cradle-logo-horizontal.svg` and `cradle-logo-mark.svg`.
   - Supports modes: `horizontal` and `mark`.
   - Supports variants: `light` (natural colors) and `dark` (`brightness-0 invert opacity-90`).
   - Consumed across 12+ critical UI areas (Public header/footer, mobile breath reveal, dashboard sidebar, workspace switcher, attendance scanner, auth pages).
2. **Database Table (`marketing_brand_settings`):**
   - Schema is prepared (`setting_key`, `label`, `value` JSONB, `status`).
   - Intended keys: `logo_primary`, `logo_dark`, `logo_mark`, `favicon`, `social_image`.
3. **Safe Transition Path:**
   - Keep static SVGs as robust fallback defaults.
   - Enhance `BrandLogo` to optionally resolve from brand settings when available, preserving exact CSS dimensions and responsive classes (`w-28`, `w-40`, `w-52`).

---

## I. Branch & Service Boundaries

### 1. Branch Entity Boundary
- **Shared Canonical Branch Identity / Location Data (Operational & Public Consumer Value):**
  - `name`, `address`, `city`, `barangay`, `latitude`, `longitude`, `place_id`, `location_metadata`.
  - *Governance & Ownership Rule:* These fields appear on public pages, but they are canonical shared branch records with critical operational consumers (booking dispatch, travel fee calculation, mapping, branch identification) and are maintained through the operational branch management path. Digital Marketer role is NOT granted ownership merely because a field is visible publicly.
- **Operational Configuration (Strictly Ops / Owner Domain):**
  - `is_active` (Operational branch activation).
  - `slot_interval_minutes` (Booking grid calculation).
  - `home_service_free_km` & `home_service_extra_km_fee` (Pricing and travel fee calculation).
  - Branch resources (`branch_resources`) & staff assignments (`staff`).
- **Public Copy & Marketing Candidates (Field-by-Field Decision in Future C3 Scope Freeze):**
  - Safe marketer-editable candidates: `phone`, `secondary_phone`, `email`, `fb_page`, `messenger_link`, `opening_hours`, `maps_embed_url`, public photos/content.
  - Even shared address/location changes must preserve operational consumers and should remain read-only or owner-reviewed until C3 explicitly freezes the authority boundary. Under no circumstances should a duplicate branch table be created.

### 2. Service Entity Boundary
- **Public Marketing Fields (Marketing Domain):**
  - `public_title`, `public_description`, `custom_image_url`, `image_alt`, `is_featured`, `sort_order`, category badges.
- **Operational Configuration (Strictly Owner/Ops Domain):**
  - Base `price` and `custom_price` in PHP.
  - Base `duration_minutes` and `custom_duration_minutes`.
  - Buffer times (`buffer_before`, `buffer_after`).
  - Delivery modes (`available_in_spa`, `available_home_service`).
  - Booking visibility (`visibility`, `booking_visibility`, `customer_tier_required`).
  - Therapist qualification rules (`requires_senior_staff`, `requires_special_setup`).

---

## J. Draft Preview & Publishing Workflow

### 1. Current Publishing Workflow State Machine
```mermaid
stateDiagram-v2
    [*] --> draft: Created by Marketer / Owner
    draft --> submitted: Marketer submits
    submitted --> changes_requested: Owner requests changes
    changes_requested --> submitted: Marketer updates & resubmits
    submitted --> approved: Owner approves
    approved --> scheduled: Owner sets schedule
    approved --> published: Owner publishes
    scheduled --> published: Scheduled time reached / Owner publishes
    published --> archived: Owner archives
```

### 2. Presentational Component Reuse Strategy
- Current draft preview inside `/marketing` uses a basic text-summary card.
- **Target C3/C4 Architecture:** Shared presentational section components (`HeroSection`, `AboutSection`, `QuoteBannerSection`, `BeforeYouBookSection`) that accept a `data` prop.
  - Live page passes data from `public_site_sections`.
  - Preview studio passes live draft data merged with fallback defaults.
  - Device toggle (Desktop / Tablet / Mobile) renders the preview in responsive containers without duplicating layout markup.

---

## K. UX & Accessibility Audit Findings

Audit performed against repository design standards and modern UI/UX guidelines:

1. **Visual Language & Colors:**
   - The workspace correctly follows the CradleHub `--cs-*` token hierarchy from `src/app/globals.css` and `src/components/features/dashboard/sidebar.tsx`:
     - Background: Warm cream (`--cs-bg: #F5F2EE`, surface: `--cs-surface: #FFFFFF`, warm surface: `--cs-surface-warm: #FAF8F5`).
     - Sidebar: Dark warm brown/slate (`--cs-sidebar: #1E1916`, hover: `--cs-sidebar-hover: #2A2420`, active: `--cs-sidebar-active: #332C28`).
     - Workspace Accent: Muted purple (`--cs-owner-accent: #7A5A8A`, `accentBg: rgba(122, 90, 138, 0.15)`) designating Marketing workspace identity and selection.
     - Action Family: Cradle Sand action family (`--cs-sand: #A67B5B`, `--cs-sand-dark: #8A6347`, `--cs-sand-light: #C4966E`) for primary and important actions.
     - Semantic status colors remain semantic (success/warning/error/info tokens).
     - No independent green concept theme or heavy purple tinting across the entire UI.
2. **Accessibility Observations (Static Repository Inspection Only — Not Browser Test Failures):**
   - **Label Associations:** Repository inspection verifies that `InputField` and `TextAreaField` wrap inputs inside `<label>`, which provides valid accessible label association.
   - **Action State Feedback:** Repository inspection verifies that `ActionNotice` in both `/marketing` and `/owner/marketing` already includes `role="status"` and `aria-live="polite"`.
   - **Verified Focus & Outline Issues:** Custom editor `fieldStyle` sets `outline: "none"` without attaching focus ring styling; inputs/textareas do not receive the standard `--cs-focus-ring` treatment (`0 0 0 3px rgba(166,123,91,0.2)`).
   - **Global Focus Selector Scope:** Global `focus-visible` handling in `src/app/globals.css` currently targets `button:focus-visible`, `a:focus-visible`, and `[role="button"]:focus-visible`, leaving custom editor text inputs and textareas without visible focus indicator.
   - **Missing Label on Review Note:** The Owner `reviewNote` textarea in `src/app/(dashboard)/owner/marketing/marketing-studio.tsx` is placeholder-only (`placeholder="Owner note"`) and lacks an explicit `<label>` or `aria-label`.
   - **Touch Targets on Compact Viewports:** Secondary navigation tabs and icon action buttons in desktop view are styled with 32px visual height; they require a minimum 44x44px clickable touch target on responsive/touch viewports.
   - **Recommendation:** Reuse the existing `--cs-focus-ring` token (`var(--cs-focus-ring)`) on input focus rather than introducing hardcoded new colors.

---

## L. Performance & Query Diagnostics

1. **Initial Page Load:**
   - `/marketing` and `/owner/marketing` execute 4 parallel queries via `Promise.all()`:
     - `getPublicSiteSections({ includeDisabled: true })`
     - `getPublicSiteAssets('gallery', { includeDisabled: true })`
     - `getMarketingContentDrafts()`
     - `getMarketingContentRevisions(12)`
   - C2 confirmed the four initial queries are initiated in parallel via `Promise.all()`. C2 did not preserve a controlled timing measurement sufficient to claim a latency figure. Performance must be measured before any caching/query optimization decision (Measure First policy).
2. **Revalidation Efficiency:**
   - Publishing mutates `public_site_sections` and invokes `revalidatePath('/')` and `revalidateMarketingWorkspace()`.
   - Tag-based caching (`cacheTags.publicBranches`) cleanly isolates branch changes from marketing section changes.
3. **Media Loading:**
   - Public hero images utilize Next.js `<Image priority sizes="..." />` with WebP optimization.
   - Mobile carousel preloads first slide only (`preload={index === 0}`).

---

## M. Ranked Risk Register (P0 - P3)

| Priority | Risk ID | Component | Description | Impact | Stabilization Mitigation |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **P1** | MKT-001 | Public Mobile Home | Mobile homepage (`public-mobile-home.tsx` / `mobile-home-hero-carousel.tsx`) uses hardcoded copy and ignores `public_site_sections`. | Marketing copy updates published by owner only update desktop views, causing mobile/desktop content desynchronization. | Refactor `PublicMobileHome` to consume `public_site_sections` with mobile-optimized defaults in authorized implementation stage. |
| **P1** | MKT-002 | Owner Direct Mutation | `/owner/marketing` allows direct mutation of `public_site_sections` bypassing draft history. | Creates unversioned live changes with no revision record in `marketing_content_revisions`. | Unify owner studio to always create/record an audit revision on direct edit. |
| **P1** | MKT-003 | Brand Logo Decoupling | `BrandLogo` component is statically bundled to SVG files; `marketing_brand_settings` is unconsumed. | Brand settings UI cannot dynamically update logo/favicon without code changes. | Build structured brand loader with fallback to static SVGs in future authorized stage. |
| **P2** | MKT-004 | Media Orphan Lifecycle | Deleting or replacing images has no cascade check against active drafts or live sections. | Potential broken image links if files in `public-site-media` are deleted prematurely. | Implement soft-archive flag on `marketing_media_assets` and prohibit hard storage deletion if in use. |
| **P2** | MKT-005 | Focus Ring & Touch Sizing (Repo Inspection) | Editor inputs use `outline: none` without `--cs-focus-ring`; owner `reviewNote` is placeholder-only; touch targets < 44px on compact viewports. | Potential focus visibility deficit and sub-44px touch targets on mobile/touch viewports. | Attach `var(--cs-focus-ring)` on focus, add explicit `<label>` to `reviewNote`, and enforce 44px min touch target on mobile viewports. |
| **P3** | MKT-006 | Unstructured JSON Metadata | Section metadata (`metadata` JSONB) is edited as raw JSON string or unvalidated object. | Syntax errors in JSON textarea can reject draft saves. | Replace raw JSON textareas with structured form fields per section type. |

---

## N. Non-Negotiable Preserved Functionality

1. **Live Website Integrity:** The public site (`/`, `/about`, `/services`, `/branches`, `/book`, `/contact`) must remain fully functional with zero breaking changes or runtime errors.
2. **Strict Role Separation:** Under no circumstances may `digital_marketer` gain write access to prices, durations, staff, schedules, dispatch, attendance, payroll, or database RLS.
3. **Design Language & Theming:** The existing internal `--cs-*` theme tokens (warm cream background, dark sidebar, purple marketing badge, sand/gold CTAs) must be preserved.
4. **Draft-First Security Model:** Non-owner marketers cannot publish directly to the live site.

---

## O. Recommendations for C3 Scope Freeze (Planning Context Only — Implementation Not Authorized)

Based on the verified diagnostic findings, the recommended C3 Scope Freeze for the Digital Marketing Studio comprises five independent user-facing modules, secondary navigation, contextual SEO, and universal subsystems:

### Five Core User-Facing Modules
1. **Website Studio:**
   - Dedicated management for public-site pages/sections (Hero, About, Promotion/Quote Banner, Before You Book).
   - Harmonize Desktop (`home-page-sections.tsx`) and Mobile (`public-mobile-home.tsx` / `mobile-home-hero-carousel.tsx`) public consumers so mobile consumes published sections seamlessly.
2. **Brand Studio:**
   - Dedicated management for brand identity assets (Primary Logo, Dark/Light variants, Logo Mark, Favicon, Social Image).
   - Preserves static SVG fallback while allowing dynamic resolution from `marketing_brand_settings`.
3. **Branches Studio:**
   - Dedicated management for public-facing branch presentation fields (`name`, `address`, `phone`, `email`, `opening_hours`, `maps_embed_url`, `messenger_link`, `sort_order`).
   - Strictly isolates public presentation from operational branch controls (`is_active`, `slot_interval_minutes`, travel fee parameters, staff assignments).
4. **Services Studio:**
   - Dedicated management for public marketing presentation (`public_title`, `public_description`, `custom_image_url`, `image_alt`, `is_featured`, `sort_order`).
   - Strictly isolates marketing fields from operational catalog properties (base/custom `price`, `duration_minutes`, `buffer_before`/`buffer_after`, `available_in_spa`/`available_home_service`, therapist qualifications).
5. **Media Library:**
   - Dedicated universal media browser for `public-site-media` bucket and `marketing_media_assets`.
   - Asset replacement safety, usage tracking, and soft-archiving without broken links.

### Secondary Navigation
- **Drafts:** Dedicated overview of in-progress drafts, pending reviews, scheduled items, and revision history.
- **Settings:** Workspace-level preferences and defaults.

### Contextual SEO Architecture
- SEO is embedded contextually within each edited entity (e.g., Website Page: Content \| Images \| Search & Social; Service: Content \| Images \| Search & Social) rather than isolated into an artificial separate module.
- No separate standalone Analytics or Campaigns modules (out of scope for immediate stabilization).

### Universal Subsystems
- **Universal Media Picker:** Reusable asset selection across all studio modules.
- **High-Fidelity Draft Preview:** Reuses the exact same presentational components as live public pages.
- **Responsive Viewport Toggle:** Desktop, Tablet, and Mobile preview frames.
- **Live vs Draft Comparison:** Visual diff view before submission/approval.
- **Unsaved Changes Guard:** Protection against accidental navigation or loss of in-progress edits.
- **Draft / Review / Publish Workflow:** Draft → Submitted → Changes Requested / Approved → Scheduled / Published → Archived.

---

## P. Production Evidence Classification & Evidence Tiers

- **Three Evidence Tiers Applied in C2 Diagnostics:**
  1. **VERIFIED REPOSITORY FACT:** Application source code, Server Actions (`actions.ts`), TypeScript schemas, presentational components, CSS design tokens, and UI logic inspected directly in the repository.
  2. **REPOSITORY-RECORDED PRODUCTION EVIDENCE:** Repository migration files (`20260803042453_marketing_studio_foundation.sql`), decision log entries, and audit records.
  3. **INDEPENDENTLY VERIFIED LIVE FACT:** Independently proven runtime observations (e.g., HTTP 200 checks on the public site).
- **Explicit Classification Statements:**
  - Server Action authorization boundaries (`actions.ts`) = **VERIFIED REPOSITORY FACT**.
  - Migration-defined RLS & Storage policies = **VERIFIED REPOSITORY FACT / Intended database policy recorded in repository**.
  - Live Supabase database, live RLS enforcement, and live Storage bucket state = **UNKNOWN / NOT INDEPENDENTLY VERIFIED IN C2**.
  - Production database truth is NOT inferred from migration filenames or local migration count.

---

## Q. Required Later Implementation / QA Evidence

The following test and quality evidence must be collected in future authorized implementation/QA stages:

1. **Digital Marketer Role Browser QA:** Authenticated browser test verifying marketer draft creation, editing, media selection, and draft submission.
2. **Owner Role Browser QA:** Authenticated browser test verifying owner review, change request, approval, scheduling, publishing, and archiving.
3. **Marketer Publish Gate Confirmation:** Proof that non-owner marketers cannot publish directly to live tables.
4. **Marketer Catalog Boundary Confirmation:** Proof that marketers cannot alter service prices, durations, buffers, categories, or eligibility.
5. **Marketer Branch Boundary Confirmation:** Proof that marketers cannot alter operational branch activation, slot intervals, travel fees, or staff.
6. **Desktop Public-Page Rendering QA:** Verification of published content across all desktop public routes (`/`, `/about`, `/services`, `/branches`, `/contact`).
7. **Mobile Public-Page Rendering QA:** Verification of published content across mobile public routes.
8. **Desktop / Mobile Content Parity:** Verification that publishing a draft synchronizes both desktop and mobile consumers without divergence.
9. **High-Fidelity Draft vs Live Preview Parity:** Visual and structural parity check between draft preview and live published page.
10. **Media Upload / Select / Replace / Archive QA:** Verification of media upload, alt-text requirement, safe replacement, and soft-archiving.
11. **Asset Usage-Impact QA:** Verification that replacing or archiving media does not break live section references.
12. **Keyboard Navigation & Visible Focus QA:** Verification of visible focus rings (`--cs-focus-ring`) and keyboard usability across all inputs and interactive elements.
13. **Responsive Viewport QA:** Layout verification across 320px, 375px, 414px, 768px, 1024px, and desktop viewports.
14. **Measured Performance Baseline:** Controlled latency measurement of marketing queries before and after any caching or query optimization decisions.
15. **Revalidation Behavior QA:** Verification that `revalidatePath` and tag revalidation invalidate cached views immediately upon publishing.
16. **Failure & Error-State Tests:** Verification of validation error handling, unauthorized mutation rejection, and network failure states.
17. **Rollback & Recovery Verification:** Verification of fallback recovery paths if published data is malformed.

---

## R. Unknowns & Limitations

1. **Live Supabase Schema Unverified:** Live Supabase database tables and column types were not independently queried in C2.
2. **Live RLS Enforcement Unverified:** Live Postgres RLS policy execution was not tested against a live database instance in C2.
3. **Live Storage Policy / Bucket State Unverified:** Live Supabase Storage bucket configuration and permissions were not verified in C2.
4. **No Controlled Latency Benchmark:** No controlled empirical timing benchmark was captured during C2 read-only diagnostics.
5. **No Authenticated Browser QA:** End-to-end browser interaction testing was not performed in C2 read-only diagnostics.
6. **No Production Deployment Verification:** The proposed future system has not been deployed or verified on production infrastructure.

---

## S. Rollback Considerations for Later Implementation

1. **Preserve Static BrandLogo SVG Fallback:** Static SVGs (`cradle-logo-horizontal.svg`, `cradle-logo-mark.svg`) must remain bundled as fallback defaults if dynamic brand queries fail.
2. **Preserve Public Section Defaults:** `PUBLIC_SITE_SECTION_DEFAULTS` constants must remain intact to ensure seamless rendering when database records are absent or loading.
3. **Preserve Existing Live Paths:** Do not decommission or remove existing live query/mutation paths until new consumers and preview paths are fully verified.
4. **Soft-Archive Rather Than Destructive Delete:** Media assets must use soft-archiving (`status = 'archived'`) to prevent broken links in active or past sections.
5. **Retain Draft & Revision History:** Preserve full audit trails in `marketing_content_revisions` for recovery and rollback of published changes.
6. **No Unrelated Schema Cleanup:** Avoid bulk migration reconciliation or unrelated schema cleanup during marketing implementation.
