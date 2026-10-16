# Web service catalog consolidation — review handoff (2026-10-15)

## Status and authority

**CORRECTION REQUIRED before acceptance.** The authorized implementation is complete in source, but the new migration has not been run against a classified LOCAL/TEST database, authenticated Owner/Public/CRM browser flows have not been verified, and the main-checkout suite retains three unrelated booking-action assertion failures. Independent review is the next gate. This is repository evidence, not production verification.

- Repository: `E:\cradlehub`, `techwithmpg/Cradlehub`.
- Source branch: `stage/crm-performance-stabilization` at `9e0361acab651e1a6038e5f500c9156a168f43bd`.
- Accepted baseline: fetched `origin/main` at `f60793d205ef9599c891e763a22a7ecd3008561f`; verified ancestor of the source head.
- Implementation branch: `stage/service-catalog-consolidation`. Final HEAD and commits: recorded in the final task response after the handoff commit.
- Push: not performed. Merge: not performed. Deployment: not performed. Production verification: **NOT PERFORMED**.
- Authorization: Owner's Web controlled-stabilization service-catalog brief and supplied approved Owner Services screenshots. It permits isolated implementation and migration creation, with LOCAL/TEST application only when classified and available. It does not permit production or unknown-target database work, main merge, deployment, Desktop, or the full booking rewrite.

**Changed files (full list):**

```text
AI_CONTEXT.md
docs/11-DECISION-LOG.md
docs/reports/SERVICE-CATALOG-CONSOLIDATION-HANDOFF-2026-10-15.md
src/app/(dashboard)/owner/services/actions.ts
src/app/(dashboard)/owner/services/page.tsx
src/components/features/services/owner-service-types.ts
src/components/features/services/service-card.tsx
src/components/features/services/service-category-section.tsx
src/components/features/services/service-editor-modal.test.tsx
src/components/features/services/service-editor-modal.tsx
src/components/features/services/service-image-thumbnail.tsx
src/components/features/services/services-page-client.tsx
src/components/features/services/services-toolbar.tsx
src/lib/queries/services.ts
src/lib/services/owner-service-workspace.test.ts
src/lib/services/owner-service-workspace.ts
src/lib/services/service-catalog.ts
src/lib/services/service-eligibility.ts
src/lib/services/service-mutation.ts
src/lib/validations/service.ts
src/types/supabase.ts
supabase/migrations/20261015004617_service_catalog_policy_visibility.sql
tests/lib/services/service-eligibility.test.ts
tests/lib/services/service-mutation.test.ts
```

## Current architecture and change map

| Boundary | Current source and result |
| --- | --- |
| Canonical identity | `public.services.id` remains the single service ID. `public.branch_services` maps offerings to active branches and already supports deliberate custom price, duration, image, visibility, and delivery overrides. No duplicate service records were introduced. |
| Owner read/write | `src/app/(dashboard)/owner/services/page.tsx` reads the master catalog, active categories/branches, and offered branch IDs. `actions.ts` validates the Owner, form, active category and active branches, then calls one database RPC for service and offering writes. Legacy create/edit routes remain for compatibility; normal workspace management uses the modal. |
| Public read | `src/lib/queries/services.ts` reads the canonical service and branch offerings for Services and home presentation. `src/lib/services/service-catalog.ts` serves branch-specific public booking data. Public queries now honor the separate global customer-visible flag; booking eligibility also checks the active branch offering and existing visibility/delivery rules. Owner and legacy writers clear stale public `price_label`/`duration_text` metadata when the canonical price/duration changes; package-specific duration presentation metadata remains. |
| CRM read | `src/lib/queries/quick-booking-options.ts` consumes the branch catalog, with server booking eligibility enforcing branch and service activity. Existing custom branch price/duration remain effective. This slice does not add a selectable extended duration to CRM booking. |
| Media | `services.image_url` and `image_alt` are authoritative, with `resolveServiceImage` fallback. The deliberate `branch_services.custom_image_url` override remains for branch-specific booking presentation; Marketing promotional metadata/overrides remain where already supported. The service photo upload uses `public-site-media` and its existing Owner storage policy. |
| Cache | Save invalidates the service catalog, relevant branch service/assignable/CRM/Manager tags, and Owner/Public/booking paths. The Owner workspace calls `router.refresh()` after server confirmation. No realtime propagation claim is made. |

**Image mismatch root cause:** the Owner service thumbnail selected hard-coded `SPA_IMAGES` by service name before the canonical image, while Public used `services.image_url` and then its ID-based fallback. The Owner thumbnail now calls the same canonical `resolveServiceImage` resolver. New images are written to the canonical service row, so normal Owner and Public reads resolve the same image unless an existing explicit branch image override applies.

## Workspace and form

- Preserved the existing header, grouped cards, search, category/status/sort controls, Owner navigation, and design tokens. Added a branch filter sourced from active branch records. Cards show offered branches, fixed/extendable policy, operational status, and customer visibility without replacing the card structure.
- Add and Edit share one centered modal. It keeps search, filters, grouping, and scroll in the mounted Services workspace. Save closes only after the server action succeeds; a failed save leaves values and the selected file available for retry. Duplicate submissions are blocked. Cancel/X closes without writing.
- The image area directly invokes the native file picker. The selected file has a local object-URL preview; choosing another file replaces the preview. Client and server use the existing SERVICE_PHOTO contract: JPG/PNG/WebP, 5 MB, server image validation including dimensions/aspect. The file uploads only on Save. A failed database RPC removes the newly uploaded object; a cleanup failure is logged and surfaced to the Owner. A successful replacement removes only superseded `service-images/` objects, leaving legacy/shared Marketing assets intact.
- Fixed is the default for existing rows and hides extension controls. Extendable stores an explicit increment, increment price, and aligned maximum duration. The live price table uses the explicit increment price; Zod and the database CHECK validate the configuration. This is catalog configuration, not a booking extension selector.
- Branch radio options apply to active branches only. The RPC writes one service plus its offerings in a single transaction, preserving existing branch override columns. Existing service IDs, bookings, prices, and package semantics are retained. The old insert trigger may create all active rows, then the RPC disables non-selected rows in the same transaction.
- Hard deletion is withheld: booking and financial history can reference a service ID. The old route/action remains callable for compatibility but rejects deletion; Owner can deactivate instead.

## Authorization, database, and rollback

- Server action requires an active Owner staff identity. The RPC is `SECURITY INVOKER`, verifies `auth.uid()` and Owner role, uses existing RLS, and grants execute to authenticated only. Server checks active branch/category records; the browser branch filter never authorizes a write. Existing Storage RLS controls the media upload and removal.
- New migration: `supabase/migrations/20261015004617_service_catalog_policy_visibility.sql`. It adds `services.is_public_visible`, `duration_policy`, extension increment/price/max columns, a validity CHECK, and the transactional `save_owner_service_catalog` RPC. Defaults preserve legacy customer visibility and fixed commercial behavior. Existing branch mapping and override schema are reused. Generated TypeScript database types were updated locally.
- LOCAL application: **NOT PERFORMED**; `pnpm exec supabase status` could not reach Docker Desktop's Linux engine. TEST/STAGING target: **UNKNOWN**, so no remote migration was attempted. PRODUCTION application: **NOT PERFORMED**. No historical migration was replayed or marked applied.
- Safe code rollback before deployment: revert this branch's commits. After a future reviewed deployment, first stop service writes and revert UI/reader changes; preserve columns/data while any service may reference them. A separate reviewed data migration would be needed to drop the RPC/columns after inspecting any extendable configurations and public visibility changes. Deleting the Storage bucket or historical media is not part of rollback.

## Performance and evidence

The Owner page still loads catalog, categories, and branches concurrently, then one offering query for visible catalog IDs. The modal is mounted for the workspace and uses an object URL for previews; card images use constrained `next/image` sizing/lazy behavior. Search/filter/sort are in-memory on the already-loaded list. No network timing, render count, request count, or authenticated performance measurement was collected.

Verification actually run:

- `pnpm exec vitest run src/lib/services/owner-service-workspace.test.ts src/components/features/services/service-editor-modal.test.tsx tests/lib/services/service-eligibility.test.ts` — PASS, 4 files/19 tests.
- `pnpm exec vitest run tests/lib/services tests/components/owner/service-image-fields.test.tsx tests/components/booking/public-service-step.test.tsx tests/components/crm/quick-booking-deferred-options.test.tsx tests/lib/crm/quick-booking-customer-prefill-scope.test.ts tests/lib/crm/customer-search-branch-filter.test.ts tests/lib/cash-flow/payment-writer-contract.test.ts` — PASS, 11 files/60 tests.
- `pnpm type-check` — PASS before production build generated fresh `.next/types`; the final rerun then FAILED on the unchanged Staff Utility route export described below. Targeted `pnpm exec eslint` on changed service source/tests — PASS. `git diff --check` — PASS (Git emitted only CRLF conversion notices).
- `pnpm exec vitest run --exclude '**/.claude/**'` — 339 files/2,622 tests passed, 3 tests failed, 2 skipped. The three failing assertions are in untouched `tests/app/crm/booking-actions.test.ts`: they expect exactly `{ success: true }` although the accepted action also returns booking ID/date/delivery data. The plain command also discovered an unrelated nested `.claude/worktrees/global-brand-logo` checkout; the scoped command isolates this checkout.
- `pnpm build` previously passed Next.js 16.2.4 during implementation. Final rerun failed in unchanged `src/app/layout.tsx` Google font resolution under Turbopack (`@vercel/turbopack-next/internal/font/google/font`). `pnpm exec next build --webpack` compiled successfully, then failed Next's generated route type check on unchanged `src/app/(dashboard)/staff/utility/page.ts` exporting `canAccessCanonicalUtility`. The final `pnpm type-check` reproduces that generated type error. The final production build gate is **FAIL** in unrelated code/environment; this is not evidence of a production failure.
- No classified database, authenticated browser, public deployment, or production test was performed.

## Remaining issues and gate

- **P0:** None identified in the implemented source. Unknown database target remains a stop condition for applying the migration.
- **P1:** Apply and verify the migration on a classified LOCAL/TEST target, then exercise Owner Add/Edit image replace/failure cleanup, branch offerings, Public Services/booking, and CRM booking options in a real authenticated browser before acceptance. Resolve the final build gate's unrelated font/Staff Utility issues before acceptance.
- **P2:** Existing main-checkout booking-action test expectation debt; review the untouched assertions and action contract separately. Browser performance and image/cache propagation remain unmeasured. Independent code/database review is pending.
- **P3:** Legacy full-page routes and hardcoded fallback manifest remain until their consumers are proven removable. Branch-specific image and marketing promotional overrides are documented exceptions to canonical presentation.

**Next permitted action:** fresh independent review and classified LOCAL/TEST migration and flow verification. **Next recommended stage after acceptance:** service-line and extendable-duration booking integration. No merge, production deployment/database mutation, full booking rewrite, or Desktop work is authorized by this handoff.
