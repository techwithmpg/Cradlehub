# Digital Marketing Studio inspection — 2026-10-19

## Baseline and scope

- Hosted repository: `https://github.com/techwithmpg/Cradlehub.git`; fetched `origin/main` at `dc15c5349751b2c5f852b81d9ade57a52bc75d09` before branch creation.
- Authorized branch: `stage/digital-marketing-studio`, created from that exact commit. This report is source and Git evidence. No production browser, Supabase, or storage state was inspected.
- The owner subsequently removed the new rights verification and publishing workflow from this task. No rights status below is an approval to use an image.

## Dependencies mapped before application changes

| Area | Current source or contract | Impact |
| --- | --- | --- |
| Public pages | `src/app/page.tsx`, `src/app/(public)/*`, `src/components/public/*` | Home, About, services, branches, SEO landing pages, and booking pages contain both hardcoded and database supplied images. |
| Studio routes | `src/app/(dashboard)/marketing/*`, `src/app/(dashboard)/owner/marketing/*` | `/marketing` exists. Marketers prepare drafts; Owner actions publish and directly edit live site sections. |
| Route authorization | `src/proxy.ts`, `src/lib/auth/workspace-access.ts`, dashboard layout | `owner` and `digital_marketer` receive the Marketing workspace; Owner routes are separate. |
| Role data | `supabase/migrations/20260803042453_marketing_studio_foundation.sql`, `src/lib/queries/marketing-media.ts`, `src/lib/queries/marketing-content.ts` | Server queries check active staff role. Existing RLS lets the marketer mutate draft/submitted rows and Owner mutate all rows. |
| Media catalog | `marketing_media_assets`, `src/lib/queries/marketing-media.ts`, `src/components/features/marketing/media/*` | Media rows store immutable path and public URL, generic metadata, status, and upload/review actors. Six-store usage checks guard archiving. |
| Storage | `public-site-media` bucket in foundation migration | Bucket is public. Marketer/Owner can insert, update, and delete objects under existing policies. Draft uploads are publicly fetchable after storage insertion. |
| Content workflow | `marketing_content_drafts`, `marketing_content_revisions`, `src/lib/queries/marketing-content.ts` | Draft, submit, approve, schedule, publish exist. Publishing writes live consumers before locking the draft; no transaction or reliable rollback across those writes. |
| Live content | `public_site_sections`, `public_site_assets`, `services.image_url`, branch `location_metadata.image_url`, brand settings, SEO settings | URLs can be outside the managed Media Library, so a catalog-only inventory cannot prove every live image. |
| Static assets | `src/constants/spa-images.ts`, `src/constants/service-showcase.ts`, `src/lib/public/service-catalog-config.ts`, `src/data/service-images.json`, `public/images` | Some public pages and mobile components bypass Studio-managed URLs. Service image map has 100 numbered entries plus two fallbacks in `public/images/services`. |
| Brand | `src/components/shared/brand-logo.tsx`, `public/images/brand` | Static logo files remain in use; official trademark status must be verified before replacement. |
| Framework | Local `node_modules/next/dist/docs/01-app` image and revalidation guides were read | Existing `next/image` use is mixed with raw `<img>` for remote dynamic URLs. |

## Material blockers and observed risks

1. **No replacement or license evidence supplied.** The accompanying CSV lists 145 repository images, their hashes, dimensions, direct URL references, and whether EXIF is embedded. Git commits establish when files entered the repository, not commercial rights or model/property releases. A June commit describes some files as real Cradle photos, but no file-specific authorization record was found.
2. **Live inventory is incomplete without a classified database target.** Published section, service, branch, gallery, brand, and SEO URLs may be supplied by Supabase. The connected target is unclassified here; no query or mutation was made. This prevents a claim that all displayed imagery is inventoried or replaced.
3. **Draft media is public.** The current `public-site-media` bucket is public and upload creates an object before review. The Media Library status does not control URL access. A private staging/evidence design would need reviewed Storage/RLS changes and a classified LOCAL/TEST target.
4. **Generic uploads trust declared MIME and allow SVG/GIF without decoding.** The intent-specific validator decodes images, but generic uploads only check MIME and size. SVG checks in the intent validator use a pattern denylist; they are not a complete sanitizer.
5. **Publication is not atomic.** `publishMarketingContentDraft` can update a live consumer and then fail to mark the draft published or insert a revision. Owner direct edits through `owner/marketing/actions.ts` also bypass draft revision history. Rollback and concurrent-edit safety are not proven.
6. **Role contract is narrow but not sufficient by itself.** Existing server checks and RLS separate marketers from Owner publication, but the current schema has no rights/evidence, expiry, or approval fields and public content destinations accept image URLs independent of catalog status.

## Image inventory interpretation

`DIGITAL-MARKETING-REPOSITORY-IMAGE-INVENTORY-2026-10-19.csv` covers committed files under `public/images` only. It includes 35 spa photos, 102 service images, seven brand files, and one additional logo path. Twenty files have embedded EXIF metadata. The `direct_source_references` column is a literal source-code match; assets referenced through `SPA_IMAGES`, a runtime database row, or another lookup may not appear as direct matches. All non-brand images remain pending clearance or approved replacements. Brand files are reserved pending official identity and rights confirmation. No image was replaced or cleared by this inspection.

## Review-branch implementation

- Generic and intent-specific uploads now validate actual raster content, enforce input limits, and store a bounded WebP derivative without source EXIF. SVG/GIF input is rejected for new Media Library uploads; existing committed brand assets were not changed.
- Catalog metadata edits can update tracked assets but cannot register arbitrary new public paths or URLs.
- Homepage hero drafts now support a mobile image, separate desktop/mobile focal positions, and image descriptions through existing section metadata. The desktop and mobile public renderers use those values. No booking rule or API was changed.
- Server Action body limit is aligned with the 10 MB source upload cap, with per-intent size limits still enforced before storage.

These improvements do **not** resolve the public draft bucket, rights evidence, atomic publication, or complete live image inventory blockers above.

## Runtime and release boundary

No production image, customer record, booking, schema, Storage policy, or deployment was changed. Do not apply historical migration files in bulk. Any later schema/Storage change requires an identified migration, a classified test target, independent review, and a separate production gate. This branch may be pushed for review only; it must not be merged or deployed without owner authorization.
