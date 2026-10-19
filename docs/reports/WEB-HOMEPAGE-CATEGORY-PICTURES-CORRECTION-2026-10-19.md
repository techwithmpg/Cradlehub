# Hosted website category picture management — 2026-10-19

## Authorization / branch
- User-reported defect: homepage category-card pictures are not editable in Marketing Studio; an old image must be replaced promptly.
- Hosted repository: techwithmpg/Cradlehub
- Branch: `fix/marketing-home-category-images-20261019`
- BASE_SHA: `dc15c5349751b2c5f852b81d9ade57a52bc75d09`
- Scope: homepage **category-card photos only**, not individual service imagery or product/business rules.
- Status: implementation candidate; not locally tested, manually inspected or deployed.

## Root cause
- `src/components/public/home-page-sections.tsx` and `src/components/public/mobile/mobile-calm-categories.tsx` consumed hardcoded category cover mappings.
- `src/lib/public/normalized-sections.ts` exposed signature-services copy and visibility but no category image mapping.
- `src/components/features/marketing/website/section-editor.tsx` only exposed signature-services display gates, without category photo pickers.

## Bounded correction
- Shared existing default category covers and added optional published `signature_services.metadata.categoryImages` keyed by canonical category name.
- Normalized category overrides with key and URL protocol validation. Existing covers remain the fallback until an authorized image is published.
- Desktop and mobile category-card renderers use published overrides.
- Marketing Website Studio Signature Services now exposes five category picture previews and reuses the existing Universal Media Picker.
- Draft, owner approval, publish, rollback-to-live and media-use metadata follow existing server-side workflows. No new public write endpoint, RBAC, DB migration, RPC, or image-storage system.
- Includes focused regression tests for defaults, one-card replacement, and untrusted metadata.

## Verification gate before merge/deploy
- Run `pnpm type-check`, `pnpm lint`, focused marketing/public parity tests and `pnpm build`.
- Test Marketing Studio as digital marketer (save/submit) and owner (approve/publish) against an authorized test environment.
- Inspect draft/live previews at desktop, tablet and mobile widths and verify only the chosen card changes.
- Verify media upload/select, fallback reset, correct public category card source, rejected/unsafe URLs, cached public-page refresh, and media usage/archival protection.
- Owner must inspect public preview and confirm exact replacement image before deploying.
- No production database writes, no deployment, and no operational simulation carried out in this change.
