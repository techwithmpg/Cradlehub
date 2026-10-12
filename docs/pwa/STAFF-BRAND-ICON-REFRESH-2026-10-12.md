# Staff PWA brand icon refresh — 2026-10-12

## Scope and baseline

- Baseline: accepted `origin/main` at `0f157657f78b13f1752ea89f9812c3df9cbd975f`.
- Working branch: `fix/p2-staff-pwa-brand-icon-refresh`.
- Scope: Staff PWA brand assets, its manifest icon mapping and launch colors, Staff-only metadata icons, and the existing role-resolution splash image. No Member Portal was created or modified.
- Data target for the local build and server: **LOCAL**, using loopback Supabase placeholders. The local endpoint refused connections; no external database target or mutation was used.

## Authoritative consumers before the change

| Consumer                                                                                                        | Accepted-main behavior                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/manifest-staff.webmanifest/route.ts`                                                                   | Sole Staff manifest, ID `/cradlehub-staff`, `start_url` and scope `/staff/`, standalone portrait. It referenced white-line `staff-manifest-icon-192.png` and `staff-manifest-icon-512.png`, each incorrectly labeled `any maskable`. Launch background was cream; theme was forest. |
| `src/app/(dashboard)/staff/layout.tsx`                                                                          | Canonical Staff layout linked the Staff manifest and used the 192 px Staff bitmap for Apple touch metadata.                                                                                                                                                                         |
| `src/app/(dashboard)/staff-portal/layout.tsx`, `src/app/(dashboard)/driver/layout.tsx`, `src/app/scan/page.tsx` | Compatibility surfaces also linked the Staff manifest. Their routing and metadata remain unchanged.                                                                                                                                                                                 |
| `src/components/features/staff-pwa/role-resolution-splash.tsx`                                                  | Existing Staff loading view used the low-quality `cradle-wellness-living-mark.png` bitmap. The view structure and wording remain unchanged.                                                                                                                                         |
| `src/components/features/staff-pwa/staff-service-worker-registration.tsx` and `public/staff-sw.js`              | `/staff/` registration uses `updateViaCache: "none"`; worker has no fetch handler, precache, or Cache Storage. Both remain unchanged.                                                                                                                                               |
| Shared site and push branding                                                                                   | Root favicon/public site metadata and `/icon.png` push icon are separate consumers and remain unchanged. The unreferenced `manifest-icon-192.png` and `manifest-icon-512.png` remain unchanged.                                                                                     |

## Asset mapping after the change

| Purpose                                 | Files                                                                                                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff manifest `any`                    | `public/staff-pwa-icon-192-gold.png` (192²), `public/staff-pwa-icon-512-gold.png` (512²)                                                                                                                 |
| Staff manifest `maskable`               | `public/staff-pwa-icon-maskable-192-gold.png` (192²), `public/staff-pwa-icon-maskable-512-gold.png` (512²)                                                                                               |
| Staff browser and Apple metadata        | `public/staff-pwa-icon-48-gold.png` (48²), `public/staff-pwa-apple-touch-icon-180-gold.png` (180²)                                                                                                       |
| Existing Staff loading splash           | `public/staff-pwa-gold-emblem.png` (512² transparent)                                                                                                                                                    |
| Cached old Staff manifest compatibility | Existing `public/staff-manifest-icon-192.png` and `public/staff-manifest-icon-512.png` replaced with the matching mask-safe forest/gold PNGs because the old manifest labeled these URLs `any maskable`. |

The source reconstruction is `scripts/assets/staff-pwa/forest-gold-source.png`. `scripts/generate-staff-pwa-brand-assets.mjs` extracts the gold mark and produces the exact-size assets. The generated images have a solid `#163A2B` square background. Maskable versions use a smaller emblem within the central one-third-radius safe circle and have no baked rounded corners. The normal and maskable files are distinct. The [contact sheet](evidence/staff-brand-icons/contact-sheet.png) is review evidence only, not an app asset.

Imagegen built-in mode created the master from the attached approved artwork with this final prompt: “Reconstruct the same recognizable motif: two symmetrical open hands cupping two botanical leaves, with the central leaf overlapping the right leaf. Make the emblem crisp, clean, restrained warm gold with simplified durable contours readable at small app-icon size. Center the full hands-and-leaves emblem, about 70% of square width and height. Put it on a full-bleed deep forest-green `#163A2B` square canvas, with no rounded corners, white outside area, border, launcher mask, text, circle, halo, gradient, vignette, glow, shadow, or mockup.” The deterministic generator replaces the generated background with uniform forest and renders normal and maskable variants.

## Launch and cache behavior

- Manifest identity, name, short name, `start_url`, scope, display, display override, and orientation are preserved. Only icon entries and `background_color` (cream to forest) changed; `theme_color` was already forest.
- No route, auth, role, scanner, install-prompt, or worker logic changed. The role-resolution splash only switches its image source to the new transparent Staff emblem.
- Versioned icon filenames give a revised manifest new URLs. The old Staff icon URLs now serve the new pixels for previously cached manifests. `public/` assets respond with `Cache-Control: public, max-age=0`; the manifest retains its 24-hour cache policy. Operating systems may cache installed launcher icons beyond browser cache control, so reinstall may still be needed.

## Verification

- `pnpm exec vitest run tests/lib/pwa/staff-brand-icons.test.ts tests/lib/pwa/staff-pwa-foundation.test.ts tests/lib/pwa/staff-standalone-install.test.ts tests/lib/notifications/cradlehub-push-service-worker.test.ts tests/lib/pwa/staff-scanner-shell.test.tsx --exclude '**/.claude/**'`: 55 passed in five files after using a workspace-local temporary directory.
- `pnpm type-check`: passed.
- Scoped ESLint and Prettier checks on changed source, test, and generator files: passed.
- `node node_modules/next/dist/bin/next build`: passed with LOCAL placeholder Supabase values. The default sandbox blocked Windows path canonicalization, so the build ran with filesystem escalation.
- Localhost production server: Staff manifest, all new icons, emblem, and `staff-sw.js` returned HTTP 200. `/staff/` redirected an unauthenticated browser to `/login`. The manifest returned ID `/cradlehub-staff`, `start_url` and scope `/staff/`, four distinct purpose mappings, and forest background/theme colors.
- Browser viewport: 390 × 844. [Direct icon screenshot](evidence/staff-brand-icons/mobile-browser-icon-390.png) shows the 512 px PNG in the browser image viewer. It is not an installed-launcher screenshot.
- Image tests validate PNG format, exact dimensions, opaque forest canvas, file size, and maskable gold inside the central safe circle. Visual review of the contact sheet covers 48, 72, 192, and 512 px.
- Physical-device install, existing-install update, launcher mask rendering, and standalone launch: **NOT VERIFIED**. Authentication and a physical device are required for those checks. No production outcome is claimed.

## Review and rollback

This branch is for review only. No merge or production deployment was performed. To roll back after an eventual merge, revert this change commit; that restores the prior manifest, metadata, splash reference, and old Staff bitmaps while removing the new Staff-only files.
