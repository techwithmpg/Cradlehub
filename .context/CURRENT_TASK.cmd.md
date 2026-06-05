Task ID: PUBLIC-MOBILE-HOME-REVEAL-FIX-001
Description: Refine public mobile homepage loading bridge, reveal timing, first hero preload, and hero overlay balance
Agent: Codex
Status: COMPLETE

Summary:
- Replaced the root generic gray skeleton `src/app/loading.tsx` with a branded Cradle deep-green loading bridge.
- Updated `CradleBreathReveal` to avoid repeat-session reveal flashes by rendering nothing during client-side storage/media checking.
- Switched the mobile hero first image from deprecated `priority` to Next 16 `preload` on only `hero-mobile.jpg`.
- Replaced the heavy full-screen green overlay with targeted top, text-area, bottom, and subtle warm-glow gradients.
- Left public homepage sections below the hero unchanged.
- Did not touch booking, Supabase, database, server actions, CRM/admin/staff/driver, or route behavior.

Verification:
- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- Headless Chrome mobile screenshots captured against the already running `http://localhost:3000` dev server:
  - `.tmp/home-mobile-reveal-after-fix.png`
  - `.tmp/home-mobile-after-fix.png`
- Rendered stream includes the new branded root fallback instead of the old skeleton blocks.
