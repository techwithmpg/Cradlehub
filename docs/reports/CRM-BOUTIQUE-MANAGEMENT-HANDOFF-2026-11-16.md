# CradleHub Web — CRM Boutique Management Implementation Handoff

**Date:** 2026-11-16  
**Stage Branch:** `stage/crm-boutique-management-20261116`  
**Worktree:** `E:\cradlehub-boutique-crm`  
**Base Commit (`main`):** `a9ff58e9da53bc10a71a714839ce6d77dc895bb0`  
**Route Implemented:** `/crm/boutique` (`src/app/(dashboard)/crm/boutique/page.tsx`)  
**Status:** **LOCAL VERIFICATION COMPLETE — PENDING OWNER ACCEPTANCE (DO NOT MERGE / PUSH / DEPLOY)**

---

## 1. Gate 1 Preservation Status (Emerald Glass Public Preview)

Before starting CRM Boutique implementation, Gate 1 verification for `stage/public-emerald-glass-preview-20261116` (`E:\cradlehub-emerald-preview`, `:3100`) was completed and recorded in `EMERALD_GLASS_PREVIEW_REVIEW_STATUS.md`:

- All **50** uncommitted/untracked entries in `E:\cradlehub-emerald-preview` (`git status --short` = `50` lines) remain completely preserved without commit, merge, overwrite, or deployment.
- Live `:3100` preview server (`task-3904`) remains running untouched.

---

## 2. Architecture & Non-Duplication Guarantees

- **Single Canonical Product Source:** `src/lib/boutique/crm-boutique-model.ts` imports `BOUTIQUE_PRODUCTS`, `BOUTIQUE_CATEGORIES`, `BOUTIQUE_GIFT_CARD_OPTIONS`, `BOUTIQUE_COLLECTIONS`, `BOUTIQUE_HERO_IMAGE`, and `formatPhp` directly from `src/lib/public/boutique-catalog.ts` with zero duplicated SKU arrays or pricing literals.
- **Read-Only Server Loader:** `src/lib/boutique/crm-boutique-data.ts` loads active branches via `getAllBranches()`, public site section summary via `getPublicSiteSections({ includeDisabled: true })`, and published brand settings summary via `getMarketingBrandSettings()`, with graceful read fallbacks and zero database writes.
- **No Unapproved Mutations Enabled:** All financial/operational switches in `BOUTIQUE_OPERATIONAL_CAPABILITIES` (`paymentsEnabled`, `stockMutationsEnabled`, `orderProcessingEnabled`, `giftIssuanceEnabled`) are hardcoded `false`. Zero new database tables, migrations, RPCs, or RLS edits are included.

---

## 3. Delivered Screens (`/crm/boutique`) & Functional Boundary

| Screen / Tab (`?tab=`) | Capabilities Live Now (Functional) | Capabilities Disabled Pending Operational Authorization |
| --- | --- | --- |
| **Products** (`products`) | Canonical 6-SKU catalog table synced with `/products`, search by SKU/name/badge/description, category filter, price/name sorting, and full Product Detail Inspector dialog linking to `/products?category=...` | `Add Product SKU`, `Edit Price / Details`, SKU archiving |
| **Categories** (`categories`) | Storefront category cards (`All Products`, `Oils`, `Sprays`, `Gift Cards`, `Wellness Kits`) with live SKU counts and price spreads, `Featured Wellness Collections`, working `Filter Products` drill-down into Products tab, and storefront deep links | `Manage Categories`, `Edit Collections` |
| **Gift Certificates** (`gift-cards`) | Inspect parent Gift Certificate SKU and all 4 approved denominations (`₱500`–`₱2,500`, virtual E-Card & physical envelope formats) | `Issue Voucher`, `Redeem Code`, serialized code ledger |
| **Orders** (`orders`) | Honest empty state (`0 persisted boutique orders in database`), guest `localStorage` (`cradle_boutique_cart_v1`) concierge protocol explanation, Bookings link (`/crm/bookings`), active pickup branch list, 3-step reception pickup workflow | `Create Boutique Order`, `Capture Boutique Payment`, automated checkout/payment capture |
| **Stock** (`stock`) | SKU search, SKU type filter (`retail`, `kit`, `voucher`), multi-branch readiness matrix explicitly stating `Not Tracked (Manual Shelf Check)` or `Voucher SKU (No Physical Stock)` (zero fabricated counts) | `Adjust Stock`, `Transfer Stock`, inventory ledger mutations |
| **Branch Assignment** (`branches`) | Live active Bacolod sanctuaries from `branches` directory highlighting `Current Branch Scope` vs `Active Sanctuary` and pickup concierge readiness | `Assign Branch SKUs`, `Override Branch Price` |
| **Settings** (`settings`) | Full capability audit (`Functional` vs `Marketing Managed` vs `Pending Operational Authorization`), source-of-truth parity metrics, session RBAC audit, and owner-only `/owner/marketing` link | Operational cutover / payment & ledger activation toggles |

---

## 4. Permission & Navigation Checks

Implemented in `src/lib/auth/crm-permissions.ts`, `src/lib/permissions.ts`, `src/lib/queries/crm-context.ts`, `src/components/features/dashboard/nav-config.ts`, `src/components/features/dashboard/sidebar.tsx`, `src/components/features/workspace/workspace-prefetch-config.ts`, and `src/components/features/dashboard/workspace-retention-policy.ts`:

- Sidebar links **Boutique Management** (`/crm/boutique`, icon `ShoppingBag`) under CRM Workspace Navigation for authorized roles only.
- **Authorized Roles (`canManageBoutique === true`, `canViewNav(role, "boutique") === true`):** `owner`, `manager`, `assistant_manager`, `store_manager`, `crm`, `csr`, `csr_head`, `csr_staff`.
- **Denied Roles (`false`):** `digital_marketer`, `staff`, `service_head`, `service_staff`, `driver`, `utility`, and unmapped roles (enforced at sidebar visibility, `canAccessWorkspacePath`, `getFrontDeskContext().capabilities.canManageBoutique`, and server redirect on `/crm/boutique`).
- **Owner-Only Approval (`canApproveBoutiqueCatalogChanges === true`):** restricted strictly to `owner` (controlling the `/owner/marketing` governance action in Settings).

---

## 5. Verification Gates Executed (Post-Final Code Edit)

| Gate | Command / Scope | Observed Result |
| --- | --- | --- |
| TypeScript | `pnpm exec tsc --noEmit` | **PASS** (`TSC_EXIT=0`) |
| ESLint | Targeted ESLint across all created/edited Boutique CRM files, nav/RBAC files, and 3 new tests | **PASS** (`ESLINT_EXIT=0`, `0` errors; `1` pre-existing unused-var warning on `useLinkStatus` in `sidebar.tsx`) |
| Vitest Target Suite | `tests/lib/boutique/crm-boutique-model.test.ts`, `tests/lib/auth/crm-boutique-permissions.test.ts`, `tests/components/crm/crm-boutique-workspace.test.tsx`, `tests/components/dashboard/nav-config.contract.test.ts`, `tests/lib/auth/workspace-access.test.ts`, `tests/lib/auth/front-desk-role-unification.test.ts`, `tests/lib/public/boutique-and-services-ui.test.tsx`, `tests/lib/crm/crm-staff-workspace.test.ts` | **PASS** (`8/8` test files, `48/48` tests passed) |
| Production Build | `pnpm build` (Next.js 16.2.4 Turbopack, read-only env loaded in memory for static page collection) | **PASS** (`BUILD_EXIT=0`, `155` static pages + dynamic route `/crm/boutique` compiled) |
| Live Auth & Storefront HTTP Probe | `next start -p 3200` (`GET /crm/boutique` unauthenticated; `GET /products`) | `/crm/boutique` -> HTTP `307` -> `/login` (auth gate active); `/products` -> HTTP `200` |
| Navigation Contract Reference Run | `pnpm exec vitest run tests/lib/navigation` | `5/9` files passed; `4` files had `5` pre-existing `main` assertion mismatches (`mobile-idle-prefetch`, `booking-session-workspace` `router.refresh`, and `staleTimeMs: 60000` vs legacy `10000`/`12000` expectations on Dispatch & Cash Flow — unrelated to Boutique changes). |

### Visual Verification Scope

Because Chrome DevTools remote debugging (`DevToolsActivePort`) was unavailable on the host browser and no non-production authenticated session exists to bypass `src/proxy.ts` login protection cleanly, visual rendering of all 7 screens, the Product Detail modal, the CRM Sidebar (`Boutique Management` active item), and `390x844` mobile layout was captured using headless Chromium via Vite harness rendering the actual production React components against the compiled Next.js `.next/static/chunks/*.css` stylesheets and canonical `BOUTIQUE_PRODUCTS` + sample Bacolod branch fixtures (`0` broken images, zero horizontal overflow).

---

## 6. Files Created & Modified

### Created
- `src/app/(dashboard)/crm/boutique/page.tsx`
- `src/lib/boutique/crm-boutique-model.ts`
- `src/lib/boutique/crm-boutique-data.ts`
- `src/components/features/crm/boutique/pending-authorization-control.tsx`
- `src/components/features/crm/boutique/boutique-products-tab.tsx`
- `src/components/features/crm/boutique/boutique-categories-collections-tab.tsx`
- `src/components/features/crm/boutique/boutique-gift-cards-tab.tsx`
- `src/components/features/crm/boutique/boutique-orders-tab.tsx`
- `src/components/features/crm/boutique/boutique-stock-tab.tsx`
- `src/components/features/crm/boutique/boutique-branch-assignment-tab.tsx`
- `src/components/features/crm/boutique/boutique-settings-tab.tsx`
- `src/components/features/crm/boutique/crm-boutique-workspace.tsx`
- `tests/lib/boutique/crm-boutique-model.test.ts`
- `tests/lib/auth/crm-boutique-permissions.test.ts`
- `tests/components/crm/crm-boutique-workspace.test.tsx`

### Modified
- `src/lib/auth/crm-permissions.ts`
- `src/lib/permissions.ts`
- `src/lib/queries/crm-context.ts`
- `src/components/features/dashboard/nav-config.ts`
- `src/components/features/dashboard/sidebar.tsx`
- `src/components/features/workspace/workspace-prefetch-config.ts`
- `src/components/features/dashboard/workspace-retention-policy.ts`
