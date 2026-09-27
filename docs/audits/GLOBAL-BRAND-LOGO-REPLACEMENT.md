# Global brand logo replacement

## A. Authorization and baseline

Owner requested branding-only replacement using the attached PNG; follow-up authorized putting the unrelated diagnostic work aside to proceed. Work is isolated at `.claude/worktrees/global-brand-logo` on `fix/global-brand-logo`. Main's modified `package.json` and untracked `scripts/diagnostic/` are preserved. The initial instruction prohibited publication; the subsequent owner instruction, "when don merg and push to main", authorizes commit, merge and push of the completed branding fix. Main is production-connected. Database access and operational changes remain outside scope.

Fetched accepted `origin/main`, main HEAD, and clean worktree starting HEAD: `20964e17ac0e52538fcdab163a5a8d3405ecae11`.

## B. Inventory recorded before implementation

| Asset / identity | Consumers and location | Class | Decision |
| --- | --- | --- | --- |
| `src/assets/brand/cradle-logo-horizontal.svg` | Shared `src/components/shared/brand-logo.tsx`; public header/footer (home and public layout, including booking), marketing brand preview, dashboard sidebar (CRM and other workspaces), account setup, select-workspace, forgot/reset-password | A full | Replace canonical default source; compact navigation uses new emblem to preserve height. |
| `src/assets/brand/cradle-logo-mark.svg` | Shared BrandLogo mark: workspace switching loader; mobile breath reveal; attendance public-scan stage/login/results; marketing brand previews | B compact | Replace canonical default with exact cropped emblem; no attendance behavior edits. |
| `public/images/brand/cradle-logo-mark.png` | Login mobile/desktop tiles, Staff role-resolution splash | B compact | Point consumers to new emblem; retain old asset. |
| `public/images/brand/cradle-logo-gold.png` | `src/components/seo/structured-data.tsx` organization logo | A full | Point to approved full PNG; retain old asset. |
| `public/favicon.ico` | Root metadata fallback; marketing icon defaults/previews | C favicon | Replace bytes with emblem-only icon sizes; preserve published icon-package override behavior. |
| `public/staff-manifest-icon-{192,512}.png` | Staff manifest route, Staff layout Apple icon | C app icon | Replace artwork, preserve sizes, paths, manifest scope and identity. |
| `public/icon.png` | Push delivery, push test, push service worker default icon/badge | C app icon | Replace asset bytes only; no notification code changes. |
| `public/apple-icon.png`, `public/manifest-icon-{192,512}.png` | Static public assets; no direct active source reference found in initial scan | C app icon | Replace packaged icon artwork; preserve paths. |
| Published `header_logo`, `footer_logo`, `brand_mark`, site icon packages | Public header/footer and root metadata; marketing studio live/draft previews | A/B/C configurable | Preserve override and publishing behavior. No database target accessed; deployed overrides require owner verification. |
| `public/images/brand/cradle-logo-horizontal.{png,svg}`, `cradle-logo-mark.svg`; `public/images/images/cradle-logo.png`; `public/favicon-old.ico` | Old public exports/source; `scripts/generate-brand-logo-assets.mjs` traces the old source | E historical/development | Retain; do not run the old tracing generator. |
| `public/images/spa/**`, `public/images/services/**`, avatars, staff onboarding ID/photo images | Public content, booking imagery, OpenGraph/Twitter `cta-banner.jpg`, application content | D decorative/content | Preserve. These are not standalone logo assets. |
| `public/{next,vercel,file,globe,window}.svg` | Framework/development artwork, no Cradle identity | E development | Preserve. |
| Plain CradleHub/workspace names, onboarding title, staff/driver/utility headings | Staff top bar, driver/utility mobile home, onboarding, text-only email/templates | Text/product labeling | Preserve product names and functional labels; no raster logo consumer found. |

Search covered tracked Web source, public assets, scripts, tests, manifests, metadata, CSS image references, logo/brand/Cradle mentions, Image/img consumers, loading, public/auth/CRM/Staff/driver/utility/onboarding and repository-hosted notifications/templates. Historical documents are evidence, not active replacement consumers.

## C. New brand assets and source inspection

Approved source: `ChatGPT Image Sep 14, 2026, 06_09_45 AM.png`; PNG RGBA, 1536 × 1024, aspect ratio 3:2. Alpha is present and usable: 1,169,545 pixels fully transparent. Browser compositing confirms a clean white logo on existing forest green; the bright glow in the raw RGB preview is not the rendered opaque artwork. White artwork has inadequate contrast on the existing cream background.

Compact extraction is limited to a rectangle around the hands and leaves, above the lettering. No tracing, redrawing, recoloring, generated replacement, or lettering changes. Full source is retained byte-for-byte. A solid existing forest-green brand surface supports white artwork where required; no new shadows, borders, gradients, or black boxes.

| New/replaced asset | Format and dimensions | Transparency |
| --- | --- | --- |
| `public/images/brand/cradle-wellness-living-logo.png` | PNG, 1536 × 1024 | Original alpha preserved byte-for-byte |
| `public/images/brand/cradle-wellness-living-mark.png` | PNG, 860 × 736 | Exact source pixels and alpha; crop x=340, y=20, width=860, height=736 |
| `public/favicon.ico` | ICO with 16, 32, 48 px PNG entries | Emblem on existing forest green |
| `public/apple-icon.png` | PNG, 180 × 180 | Emblem on forest green |
| `public/icon.png` | PNG, 512 × 512 | Emblem on forest green |
| `public/manifest-icon-192.png`, `public/staff-manifest-icon-192.png` | PNG, 192 × 192 | Emblem on forest green, 15% inset |
| `public/manifest-icon-512.png`, `public/staff-manifest-icon-512.png` | PNG, 512 × 512 | Emblem on forest green, 15% inset |

Full source SHA-256: `988178330de156d8af085a445e6e11c03dae10e0ad9566f4a5ad4ac020066c32`. `scripts/derive-approved-brand-assets.mjs` provides repeatable crop/resize and ICO packaging. It does not alter the source PNG.

## D. Changed consumers

- Shared BrandLogo defaults now use the approved PNGs, correct intrinsic dimensions, `object-contain`, bounded responsive image requests, and eager loading. Compact sizes no longer inherit horizontal wordmark widths. Existing custom-logo behavior remains intact.
- Public desktop/mobile header and mobile menu use the emblem at 56 × 48 / 48 × 40 CSS boxes. Public footer shows the full artwork at 240–256 px width. These shared consumers cover home and public booking/layout routes.
- Dashboard sidebar uses the compact emblem on its existing dark surface. This covers its CRM/owner/manager/marketing/utility/driver consumers where that shared sidebar is mounted.
- Marketing brand preview defaults mirror compact navigation and full footer artwork; no publishing logic changed.
- Login mobile/desktop tiles and Staff role-resolution splash point to the new emblem. Their adjacent text provides branding, so images use empty alt text to avoid repeated screen-reader labels.
- Organization structured metadata points to the new full PNG.
- Browser, Apple, generic and Staff app icon files were replaced in place; notification logic, manifest routes, scope, start URL and identity are unchanged.
- Account setup, workspace selection, password recovery, workspace switching loader, mobile reveal and attendance branding inherit the shared component change without edits to their workflow files.

## E. Preserved assets

Retained `src/assets/brand/cradle-logo-{horizontal,mark}.svg`, every pre-existing `public/images/brand/cradle-logo-*` PNG/SVG, `public/images/images/cradle-logo.png`, `public/favicon-old.ico`, and the old tracing script. No literal old `cradle-logo` reference remains in active `src/` after replacement. Historical generator/export references remain. No deletion was necessary, and external/published URL usage was not audited, so deletion is not certified safe. Previous versions of overwritten icon files remain available in Git history. Decorative spa/service photos, OpenGraph/Twitter imagery and framework assets are unchanged.

## F. Exact changed files

All paths below are relative to the isolated worktree; 19 files total (15 modified, 4 new).

```text
docs/audits/GLOBAL-BRAND-LOGO-REPLACEMENT.md
public/apple-icon.png
public/favicon.ico
public/icon.png
public/images/brand/cradle-wellness-living-logo.png
public/images/brand/cradle-wellness-living-mark.png
public/manifest-icon-192.png
public/manifest-icon-512.png
public/staff-manifest-icon-192.png
public/staff-manifest-icon-512.png
scripts/derive-approved-brand-assets.mjs
src/app/(auth)/login/login-form.tsx
src/components/features/dashboard/sidebar.tsx
src/components/features/marketing/brand/brand-studio-view.tsx
src/components/features/staff-pwa/role-resolution-splash.tsx
src/components/public/site-footer.tsx
src/components/public/site-header.tsx
src/components/seo/structured-data.tsx
src/components/shared/brand-logo.tsx
```

## G. Tests and repository checks

Commands ran from the main checkout using `pnpm --dir E:/cradlehub/.claude/worktrees/global-brand-logo exec ...` to select the isolated worktree. Existing dependencies were reused via an ignored `node_modules` junction; no package or lockfile changes.

```powershell
pnpm --dir E:/cradlehub/.claude/worktrees/global-brand-logo exec tsc --noEmit --incremental false

pnpm --dir E:/cradlehub/.claude/worktrees/global-brand-logo exec eslint src/components/shared/brand-logo.tsx src/components/public/site-header.tsx src/components/public/site-footer.tsx src/components/features/dashboard/sidebar.tsx 'src/app/(auth)/login/login-form.tsx' src/components/features/staff-pwa/role-resolution-splash.tsx src/components/seo/structured-data.tsx src/components/features/marketing/brand/brand-studio-view.tsx scripts/derive-approved-brand-assets.mjs

pnpm --dir E:/cradlehub/.claude/worktrees/global-brand-logo exec vitest run tests/lib/marketing/public-consumer-parity.test.tsx tests/lib/marketing/brand-branches-services-studios.test.tsx tests/app/auth/login-form.test.tsx tests/lib/navigation/crm-owner-navigation-contract.test.ts tests/lib/pwa/staff-pwa-foundation.test.ts tests/lib/pwa/staff-standalone-install.test.ts tests/components/attendance/public-scan-result.test.tsx tests/components/attendance/public-scan-processor.test.tsx

node E:/cradlehub/.claude/worktrees/global-brand-logo/scripts/derive-approved-brand-assets.mjs
git -C E:/cradlehub/.claude/worktrees/global-brand-logo diff --check
git -C E:/cradlehub/.claude/worktrees/global-brand-logo diff --stat
git -C E:/cradlehub/.claude/worktrees/global-brand-logo diff -- src
git -C E:/cradlehub/.claude/worktrees/global-brand-logo status --short
git status --short
git fetch origin --prune
```

- TypeScript: passed. Targeted suite: 8 files, 81 tests passed. Final compact-sizing change rechecked.
- ESLint: four existing `react-hooks/rules-of-hooks` errors in sidebar lines 640, 642–644, reproduced with `pnpm exec eslint src/components/features/dashboard/sidebar.tsx` against unchanged main. Seven warnings in unchanged marketing-studio code (unused variables and an existing img element). Other changed sources and generator have no lint findings. Final shared-component-only lint passed. No unrelated hook fix was attempted.
- Asset generation passed. Independent Node/assert/sharp checks passed: source buffers identical; decoded mark pixels equal the exact source crop; all six PNG icon sizes correct; ICO header and all three embedded PNG sizes valid.
- `git diff --check` passed. Git emits existing Windows LF/CRLF conversion notices, not whitespace errors. Source diff reviewed; no unrelated changes in the worktree.
- Final successful fetch: HEAD, `origin/main`, and merge-base remain `20964e17ac0e52538fcdab163a5a8d3405ecae11`.
- Initial tsc/vitest launches could not find commands before the dependency junction existed; subsequent runs passed. The first dev-server launch hit sandbox `spawn EPERM`; the authorized localhost-only retry succeeded. No tests, migrations, or production commands were run against a real database.

## H. Visual verification

Browser skill/plugin unavailable; used available Playwright MCP browser tools. Application URL: `http://127.0.0.1:4319`. Actual Next.js 16.2.4 development rendering used dummy environment values and a **TEST localhost-only HTTP fixture** returning empty reads and refusing writes. No real backend credentials, database, or customer/staff data were used. This is not deployed-data verification.

| Surface/check | Actual evidence and result |
| --- | --- |
| Approved PNG | Browser compositing on forest/cream confirmed usable alpha and the need for a dark brand surface. |
| Login desktop/mobile | Viewed at 1440 × 1000 and 390 × 844. Correct unclipped emblem in existing tiles; no overflow; no initial console warnings/errors. Password toggle changed input type to text. |
| Home desktop/mobile/tablet | Viewed at 1440 × 1000, 390 × 844, 768 × 1024. Emblem contained, no stretching. Tablet review found inherited horizontal width; corrected and re-viewed at 56 × 48. All visible nav links then stayed within the header. Final mobile/desktop header heights approximately 56 / 88 px. |
| Mobile navigation | Open/close buttons exercised; `aria-expanded` became true, then menu closed. |
| Footer | Full logo viewed at 390 px viewport on its existing dark background; image box 240 × 160, correct 3:2 ratio, lettering intact; no horizontal overflow. |
| Public booking | Actual `/book` desktop empty-branch state viewed with shared emblem header. No booking submission attempted. |
| Password recovery | Actual `/forgot-password` mobile page viewed; full artwork on the small solid forest brand surface. No email sent. |
| Icon assets | Viewed compact crop and 16/32/48 px favicon, 192 px Staff and 180 px Apple icons. No lettering in the emblem. Very fine detail naturally reduces at 16 px; no artwork was thickened/redrawn. |
| Metadata | Rendered organization logo URL points to new full PNG; favicon link remains `/favicon.ico`. Staff manifest retains `/cradlehub-staff`, `/staff/` scope/start URL, and both icon sizes with `any maskable`. |
| CRM / Staff authenticated shells | NOT VERIFIED. Attempted `/crm` and `/staff/`; both redirected to login without a real session. Tests and source review do not substitute for authenticated browser/device review. |
| Other inherited surfaces | Account setup, workspace selection, Staff splash, attendance and marketing preview not individually browser-viewed. Shared-component/source checks only. No physical-device/PWA installation review. |

Console limitations: public booking retained an LCP warning for unchanged `booking.jpg`; tablet home retained a sizes warning for unchanged `hero.jpg`. A logo LCP warning was resolved with eager loading. Later login/recovery screenshots captured hydration attribute warnings showing injected `caret-color: transparent` on focused inputs; this suggests screenshot/browser instrumentation rather than logo markup, but no broader auth fix is claimed. Existing responsive login preloads may warn for the hidden logo at the other breakpoint. Initial home rendering without a fixture service key failed; the subsequent read-only fixture run rendered successfully. No numerical CLS measurement was taken.

Screenshots captured under the tool's `.playwright-mcp` output root include `page-2026-09-13T22-28-30-220Z.png` (mobile footer), `page-2026-09-13T22-28-35-887Z.png` (desktop home), `page-2026-09-13T22-29-06-911Z.png` (booking), `page-2026-09-13T22-30-15-933Z.png` (icons), and `page-2026-09-13T22-33-49-728Z.png` (corrected tablet header). Login screenshots are saved outside the repo in this task's visualization directory. These are local evidence, not committed assets.

## I. Production verification

**NOT VERIFIED — PRODUCTION VERIFICATION REQUIRED**.

Published custom-logo URLs and icon packages are intentionally preserved. They can still override repository defaults and may reference old artwork; their deployed values were not accessed. Global production replacement cannot be certified until those settings and authenticated/installed surfaces are reviewed by the owner.

## J. Functional impact

Branding only. No booking/payment/attendance/QR/dispatch/schedule/authentication/authorization/database/RLS/migration/API/service lifecycle/routing/SEO-route or workspace workflow logic changed. Auth-page edits are limited to logo source/alt. At the initial handoff nothing had been committed, pushed, merged or deployed. Main's diagnostic work is untouched and can be resumed separately.

## K. Final result

Initial handoff: **CORRECTION REQUIRED** — implementation was ready for owner review, with existing sidebar lint errors, authenticated/device visual checks, and published override verification disclosed. The owner subsequently instructed merge and push to main after reviewing that handoff. This publication authorization does not claim that existing lint defects were fixed or that authenticated/device verification occurred.

## Owner-authorized publication follow-up

On 2026-09-14, the owner authorized merge and push to main. A fresh fetch still matched the accepted baseline above; GitHub reported no open pull request or branch protection on main. Public production HTML inspection before publication confirmed the existing `/favicon.ico` fallback. This follow-up authorizes only the reviewed branding file set; it does not include the diagnostic changes on main. The prior test/visual limitations remain recorded rather than being represented as resolved. Git publication results and resulting commit IDs are reported in the task handoff.
