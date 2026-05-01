# Current Task

## 2026-05-02 — BRAND-003: Convert Cradle Logo PNG to Real SVG System

### Objective
Convert the approved Cradle logo PNG into real vector SVG assets and implement a reusable SVG-based logo system across website and portal UI.

### Source Asset
- `E:\cradlehub\public\images\images\cradle-logo.png`

### Target Assets
- `src/assets/brand/cradle-logo-horizontal.svg`
- `src/assets/brand/cradle-logo-mark.svg`
- `public/images/brand/cradle-logo-horizontal.svg`
- `public/images/brand/cradle-logo-mark.svg`
- fallback PNGs in `public/images/brand/` (horizontal + mark)

### Scope
- Configure Next.js 16 Turbopack SVG loader support with `@svgr/webpack`.
- Update `src/components/shared/brand-logo.tsx` to SVG-driven `mode` + `size` API.
- Replace old logo usage in header/footer/auth/sidebar with SVG-based component usage.
- Keep fallback PNG assets and add a repeatable asset generation script.

### Validation
- `pnpm type-check` ✅
- `pnpm lint` ✅
- `pnpm build` ✅
- `pnpm test` ✅

### Status
Completed.
