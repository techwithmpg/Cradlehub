# Service Image System

This folder contains the generated handoff for 100 service images from `services_rows (2).sql`.

## Output Location

Final images belong in `public/images/services/` and should be referenced with URLs like `/images/services/001-service-name.webp`.

Preferred image spec:

- WebP
- 1200x800
- 3:2 aspect ratio
- Premium spa/wellness photography
- No text, logos, watermarks, nudity, sexualized imagery, or medical gore

## Files

- `src/data/service-images.json` is the app-side service-id manifest.
- `docs/service-images/batches/` contains 10 batch prompt files, 10 services per batch except the last.
- `supabase/migrations/20260527000001_add_service_image_fields.sql` adds `image_url` and `image_alt`.
- `supabase/service-images-update.sql` backfills every service image URL and alt text.
- `public/images/services/default-service.webp` is the runtime fallback image.
- `scripts/import-generated-service-images.py` imports generated PNGs for a manifest batch, resizes them to 1200x800, saves WebP files, and writes a contact sheet.
- `scripts/check-service-images.mjs` verifies that all manifest image files exist.

## Workflow

1. Generate images batch by batch from `docs/service-images/batches/batch-XX.md`.
2. Import the generated PNGs for a batch:

   ```bash
   python scripts/import-generated-service-images.py --source-dir /path/to/generated/pngs --batch 1
   ```

3. Review the contact sheet in `docs/service-images/artifacts/`.
4. Run the migration, then run `supabase/service-images-update.sql` against the linked database.
5. Run `node scripts/check-service-images.mjs` to confirm every manifest file exists.
6. Rebuild the app and spot-check `/services` plus `/book`.

The app resolves images in this order: database `image_url`, branch `custom_image_url` where available, generated service-id manifest, then the fallback spa image.

All 10 service image batches have been generated and imported into `public/images/services/`.

Generated source PNGs are staged under `docs/service-images/generated-batches/batch-XX/`, and review contact sheets are in `docs/service-images/artifacts/`.
