# Service editing and Marketing publish sync — 2026-09-30

## Authorization and baseline

Owner authorized a narrow correction in `E:\cradlehub-booking-simplification`: Marketing may edit canonical service price through owner publication; Owner Services may edit service image and alt text through the existing media picker; published service information must reach public services and booking. No deployment, production database mutation, merge, or historical migration edit was authorized.

Branch: `stage/cf-financial-foundation-main-reconcile`. HEAD before and after this uncommitted correction: `6b1a80273c29f72ff3efb64d6de3bdf83c253843`. Fetched `origin/main`: `03242a0bfbcfe6c4b1b03ba624510004cae7cc6a`, also the merge base. Existing Cradle Flow and booking diagnostic changes were present before this correction and were not edited.

## Findings and decisions

- **Save Draft is private by design.** It writes `marketing_content_drafts`; Submit and Approve change draft state; only owner Publish writes the canonical `services` row. The Services Studio now explains this explicitly.
- The Services Studio sent its presentation metadata as `metadata`, while the draft action reads `metadataJson`. As a result, short description, badges, and inclusions were lost from the draft. The field name is corrected.
- The old Marketing publication invalidated public paths and `service-catalog` but omitted per-branch `branch-services` caches used by public booking. Owner Services already invalidated those caches. Both update surfaces now call one canonical service writer and one shared invalidation routine.
- Published price updates remove an existing `metadata.price_label` override, so the public catalog formats the new canonical `services.price`. Branch-specific `custom_price` overrides remain authoritative for their branches.
- Existing owner-only publication authorization remains. Marketing still cannot change service duration, operational visibility, branch eligibility, active state, booking rules, buffers, availability, or service creation/deletion through this correction.

## Changed scope

`src/app/(dashboard)/marketing/{actions.ts,service-actions.ts}`, `src/app/(dashboard)/owner/services/{actions.ts,[serviceId]/page.tsx}`, `src/components/features/marketing/services/services-studio-view.tsx`, `src/components/features/owner/service-image-fields.tsx`, `src/lib/queries/marketing-content.ts`, `src/lib/services/service-mutation.ts`, and `src/lib/validations/service.ts`. Focused tests cover draft metadata, owner publication, the shared writer and cache tags, and the owner image field.

## Verification and limits

Local mocked tests passed (27 tests across four targeted files), TypeScript checking passed, and `git diff --check` passed. Source inspection confirms `/` and `/services` use the canonical public catalog; `/api/public/booking-context` reads branch service rows and falls back to canonical `services.price` where no branch custom price exists. The public booking route itself uses an uncached branch query; the shared invalidation also expires separately cached branch catalogs. No live production service row was changed, so user-visible production behavior remains unverified until an authorized release and test.

Next permitted action: review this isolated diff with the other uncommitted work clearly separated, then follow the owner's release gate. Deployment, merge, and production mutation remain outside this correction authorization.
