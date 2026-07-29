# QR Print Phase 1 Verification — 2026-07-29

Status: SOURCE/PRINT QA COMPLETE; PHYSICAL PHONE SCANS USER-WAIVED AND UNVERIFIED

## Delivered source behavior

- The production CRM route
  `/crm/attendance?view=setup&section=qr` now renders the branded Attendance A4
  preview directly, exposes `Print active rooms`, and shows a selectable branded
  room A4 preview. The existing QR settings, replacement confirmation,
  copy/download actions, and registered-device rule remain available.
- Attendance and room posters share typed React primitives for the Cradle
  header, divider, QR frame, content, and footer.
- Print output uses an exact A4 page box, cream/gold/forest brand treatment,
  pure-black QR modules on white, a fixed quiet zone, hidden controls, and one
  poster per page without a trailing blank page.
- Attendance copy is fixed to `Scan when arriving` and
  `Scan again when leaving`.
- Room posters use the selected room name and branch, show capacity when
  configured, and keep an inactive status visible for explicit single-poster
  output.
- `Print Active Rooms` includes only active QR points backed by an active room
  resource. Archived, inactive, non-room, and equipment points are excluded.
- SVG, PNG, single-poster print, and batch print all reuse the same source QR
  SVG. No QR public code, scan route, URL, payload, or device rule was changed.

## Automated verification

Run under Node 24.14.0 and pnpm 10.33.2:

- Focused Vitest: 5 files, 16 tests passed.
- `pnpm type-check`: passed.
- `pnpm lint`: passed with zero warnings.
- `pnpm format:check`: passed.
- `pnpm build`: passed on Next.js 16.2.4; 113 pages generated.
- Payload-invariance tests assert that the existing URL is passed unchanged to
  the QR encoder and that poster export embeds the provided QR SVG unchanged.
- Component tests cover exact copy, branch/room/capacity rendering, poster
  distinction, A4 print rules, active-room filtering, and batch poster count.

## Browser and print evidence

- Authenticated localhost inspection reached the real Main Spa Attendance QR
  workspace and its configured room QR points. The console error/warning log was
  empty. No live scan URL was opened and no attendance mutation was attempted.
- A follow-up check of the exact production CRM Setup route verified the branded
  Attendance preview, active-room batch control, room capacities, and selected
  room preview. Selecting CALMANTE 2 updated both the pressed room control and
  the poster heading/capacity with no console warning or error.
- Chrome and Edge each produced a two-poster batch as exactly two A4 pages
  (`594.96 × 841.92 pt`) with no trailing page.
- Chrome and Edge page 2 were rendered and visually checked after tightening
  the sibling-page break rule; the header, QR, instructions, and footer were no
  longer clipped.
- Retained evidence:
  - `C:/Users/eleur/.codex/visualizations/2026/07/29/019fabe4-bc06-7991-a87a-1f3eb2192435/cradlehub-attendance-a4-print-preview.png`
  - `C:/Users/eleur/.codex/visualizations/2026/07/29/019fabe4-bc06-7991-a87a-1f3eb2192435/cradlehub-room-a4-print-preview.png`
  - `C:/Users/eleur/.codex/visualizations/2026/07/29/019fabe4-bc06-7991-a87a-1f3eb2192435/cradlehub-live-qr-setup-fixed.jpg`
  - `C:/Users/eleur/.codex/visualizations/2026/07/29/019fabe4-bc06-7991-a87a-1f3eb2192435/cradlehub-live-room-preview-fixed.jpg`

## User-waived physical verification

On 2026-07-29 the user explicitly instructed Codex to proceed without physical
scan verification. The following checks were therefore not performed and must
not be represented as passed:

1. Main Spa Attendance poster scans successfully and reaches the expected
   registered-device attendance flow.
2. SM Attendance poster scans successfully and reaches the expected branch flow.
3. At least one active room poster scans successfully and preserves its room
   identity/behavior.

The authenticated browser session had Main Spa Front Desk access only, so SM
preview and the physical scans remain unverified. Phase 2 may proceed under the
user's explicit waiver; this audit preserves the limitation for later follow-up.

## Non-source QA notes

- A chained 180-DPI Poppler render exceeded the bounded command timeout after
  the first page was written. The already-complete 120-DPI renders were used for
  visual inspection; both PDFs had already been independently verified as valid
  two-page A4 files. No renderer process remained and no source change was
  required.
- Temporary Chromium profiles, PDFs, and intermediate raster output were
  removed from `E:/cradlehub/tmp`. The retained evidence files above are outside
  the repository.
