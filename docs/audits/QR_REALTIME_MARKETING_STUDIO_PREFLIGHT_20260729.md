# QR, Realtime, and Marketing Studio preflight — 2026-07-29

Task: `QR-REALTIME-MARKETING-20260729`

This document freezes the observed production-source baseline and planned
change surface before functional implementation. It is not evidence that a
database migration, deployment, phone scan, or browser flow has completed.

## Repository and runtime baseline

- Working tree was clean on `main` at
  `915908eaa1d3324823ee6f9f782ff62c561b7647` before creating
  `codex/qr-realtime-marketing-studio`.
- Pinned workspace runtime: Node 24.14.0, pnpm 10.33.2, Next 16.2.4, React
  19.2.4.
- This application does not enable Next.js Cache Components. Current installed
  Next.js 16 guidance was read for Server/Client Components, authentication,
  data security, route handlers, caching/revalidation, metadata, and proxy.
- The linked Supabase migration history is already documented as 92 local-only
  and 5 remote-only. No blind `db push`, history repair, reset, or production
  application is safe from this baseline.

## Phase 1 — observed QR print behavior

- QR payload generation is already canonical in the Attendance data layer.
  The print/export code receives the generated QR SVG and must never recreate
  or modify its encoded scan URL.
- `buildQrPrintSvg` currently draws an entire sign as one SVG. It approximates
  the cream/forest/gold reference and supports A4, A5, door, sticker, and sheet
  dimensions, but the screen component only injects that SVG and does not
  expose reusable semantic print primitives.
- Chromium print markup currently uses `100vh`, pixel padding, and generic page
  breaks. It has no `@page` size/margin contract and can clip or add a blank
  page depending on print settings.
- Selected batch printing includes any selected QR point. It has no explicit
  active-room-only batch command.
- `branch_resources.capacity` exists and is enforced by booking availability,
  but Attendance QR queries only select resource name. Capacity is therefore
  unavailable to room posters.
- The QR encoder currently renders dark modules in navy. The required poster
  contract is pure `#000000` modules on `#FFFFFF`, while keeping the data bytes,
  error-correction setting, and quiet zone invariant.

### Supplied visual authority and token inventory

- Canvas: A4 portrait, 210 × 297 mm.
- Background: warm cream (`#FCF7EC` family); inner hairline border: translucent
  gold (`#D8B866` family); footer: deep forest (`#0B5634` family).
- Primary display text: forest (`#0F4D2F` family), high-contrast serif;
  supporting wordmark: tracked gold serif plus compact tracked sans-serif.
- Accent: warm gold (`#C79A3F` / `#E6BE60` family), used sparingly for rules,
  ornament, QR frame, and footer wordmark.
- QR: pure black on white, centered, generous quiet zone, no decorative overlay.
- Composition: centered wordmark and title, thin split rule with leaf ornament,
  framed QR, two-line action instruction, large calm negative space, and fixed
  forest footer. Room variants substitute verified room/resource content while
  retaining the same hierarchy.

### Planned Phase 1 change surface

- `src/lib/attendance/types.ts`
- `src/lib/attendance/queries.ts`
- `src/lib/attendance/qr-code.ts`
- `src/lib/attendance/qr-print-layout.ts`
- `src/components/features/attendance/qr-codes/qr-print-template.tsx`
- `src/components/features/attendance/qr-codes/qr-export-client.ts`
- `src/components/features/attendance/qr-codes/qr-codes-tab.tsx`
- `src/components/features/attendance/qr-codes/qr-toolbar.tsx`
- Focused Attendance QR print/export/selection tests and Phase 1 context records.

## Phase 2 — observed Attendance and notification behavior

- `useAttendanceScanRealtime` subscribes to Attendance event tables, but every
  relevant payload schedules a full SWR feed request. It also runs a permanent
  interval: approximately every 15 seconds while subscribed and every 8
  seconds while degraded.
- `useAttendanceScanFeed` enables focus/reconnect revalidation and its endpoint
  rebuilds the whole recent feed plus hourly count. There is no delta cursor.
- The canonical scan grouping already understands root operation IDs and can be
  reused for deterministic event merging. Scan rows expose stable timestamp and
  UUID identifiers suitable for a `(created_at, id)` cursor.
- The notification bell is mounted once in the shared dashboard header, but its
  initial load invokes separate item and unread-count server actions. Its hook
  also retains a five-minute interval even while healthy.

### Planned Phase 2 change surface

- Attendance Realtime/feed hooks, recent-scan API/query/mapping/group helpers,
  affected Attendance workspace counters/rows, and their focused tests.
- Notification bell snapshot action/query, the single shared bell component,
  notification Realtime reconciliation hook, and focused request-count tests.
- Phase 2 request evidence and context records.

## Phase 3 — observed Marketing Studio behavior

- `/owner/marketing` is an owner-only direct-publish editor for five homepage
  section keys and URL-based gallery assets.
- Existing `public_site_sections` and `public_site_assets` tables store enabled
  public content and owner-managed rows. There is no draft workspace, revision
  history, schedule, rollback, dedicated role, upload bucket, brand settings,
  SEO model, or structured service-marketing model.
- Public queries use an admin client for published reads and tolerate missing
  legacy content tables. Editing paths use authenticated clients and revalidate
  `/` plus `/owner/marketing`.
- `digital_marketer` does not exist in the TypeScript role catalog, database
  role constraint, navigation/workspace routing, or RLS policies.

### Planned Phase 3 change surface

- Additive Supabase migrations for role compatibility, explicit table/bucket
  grants, least-privilege RLS, marketing drafts/revisions/schedules/media/brand/
  SEO/service content, indexes, timestamps, and safe publish/rollback RPCs.
- Generated `src/types/supabase.ts` only from a verified linked schema after the
  migration path is safe; otherwise keep the application/type-generation step
  explicitly blocked rather than fabricating production state.
- Role constants, authorization/workspace routing, `/marketing` layout/page,
  server actions/queries/validation, upload controls, preview route, and public
  plus mobile content consumers.
- Focused unit, RLS/migration, integration, accessibility, responsive, and
  authenticated browser coverage with Phase 3 context records.

## Verification gates

Each phase requires focused tests, TypeScript, lint, formatting, production
build, browser evidence, final diff review, a context update, and an atomic
commit. Phase 1 additionally requires a real-phone scan result supplied or
performed by a person; browser decoding is useful evidence but is not a false
substitute for that physical-device gate.
