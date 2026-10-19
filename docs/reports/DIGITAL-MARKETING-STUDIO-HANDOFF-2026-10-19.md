# Digital Marketing Studio review handoff — 2026-10-19

## Authorization and baseline

The owner requested hosted Marketing Studio implementation and a branch push, then explicitly authorized `stage/digital-marketing-studio` and removed the new rights verification/publishing workflow from scope. Work started from freshly fetched `origin/main` `dc15c5349751b2c5f852b81d9ade57a52bc75d09`; a final fetch before commit showed the same accepted main. Implementation head: `226505f7e5a5e0121b22fa50f8f1e7496dbfd9dd`. No merge or deployment was authorized.

## Delivered for review

- Added the source-only 145-image inventory CSV and reproducible generator. It records SHA-256, dimensions, EXIF presence, direct code references, and unknown rights status. Twenty committed images contain EXIF.
- Hardened new Media Library uploads: raster content must decode and match the declared type; 10 MB source and pixel/dimension limits apply; a bounded WebP derivative is stored with source EXIF removed. New SVG/GIF uploads are rejected. Per-intent dimensions/aspect rules still run before re-encoding. Unique random object names replace timestamp names.
- Prevented metadata saves from creating new catalog entries for arbitrary client supplied paths/URLs.
- Added mobile hero image and separate desktop/mobile focal position and description controls to the existing draft/preview flow. The public hero renderers consume the published metadata.
- Aligned Next Server Action body size with the upload limit. No booking logic, CRM workspace, Desktop code, SQL migration, or RLS/Storage policy was changed.

## Verification actually performed

- `node scripts/marketing-media-inventory.mjs`: 145 repository images inventoried.
- `pnpm exec vitest run tests/lib/marketing`: **15 files, 158 tests passed**.
- `pnpm exec vitest run tests/lib/bookings/release-readiness-public-contract.test.ts tests/lib/bookings/booking-wizard-confirm.test.ts tests/components/booking/public-service-step.test.tsx tests/components/booking/public-details-step.test.tsx`: **4 files, 27 tests passed**.
- `pnpm exec tsc --noEmit`: **passed**.
- ESLint on all changed TypeScript/TSX/JS files: **0 errors, 7 warnings** in the existing Brand Studio view.
- `pnpm build`: **passed** using Next.js 16.2.4; `/marketing`, `/marketing/media`, public pages, and booking routes were compiled.
- `git diff --cached --check`: **passed** before implementation commit.

No authenticated browser journey or database/Storage/RLS test ran. The available Supabase target was not classified as LOCAL, TEST, STAGING, or PRODUCTION, and the owner indicated no target was available. No production runtime behavior is claimed.

## Open blockers and data impact

The original final acceptance standard remains unmet. No replacement assets or file-specific rights, logo authorization, or subject/property releases were supplied, so **zero images were replaced, retained as verified, or newly cleared**. The source inventory cannot enumerate live database supplied URLs. Existing public draft storage, direct Owner live edits, non-atomic publish/rollback, and absence of a rights workflow remain as described in the inspection report; the owner explicitly removed rights workflow implementation from this task. New derivative uploads still enter the existing public bucket before approval because Storage/RLS changes were not authorized or tested.

The code changes affect future uploads and the homepage hero presentation. Existing stored objects and rows are untouched. New uploads preserve original filename/type/byte count as catalog metadata; original bytes are not retained in private storage. No private customer photos were accessed.

## Rollback and next gate

Before merge, revert implementation commit `226505f7` and this handoff commit on the review branch. After any later merge, use a reviewed revert and coordinated cache invalidation; newly uploaded WebP objects would remain tracked and should be handled through the existing safe archive path after usage checks. No database rollback is needed for this branch.

Next permitted action: independent source/security review of this branch, plus owner provision of approved assets and a classified LOCAL/TEST environment if complete image replacement or runtime storage verification is desired. No merge to `main`, deployment, production database/storage change, or claim of complete rights-safe publication is authorized by this handoff.
