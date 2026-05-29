## 2026-05-28 - CRM-MODAL-002 scroll bug diagnosis

- **Symptom:** Edit Service Capabilities modal footer visible, but services continued below viewport with no usable scroll. Expanded category content was cut off behind footer.
- **Root causes identified:**
  1. `AdminDialog` used `top-1/2 left-1/2 translate-x/y-1/2` centering. For tall content, the centered fixed element could push against viewport edges, making the inner scrollbar clipped or unreachable.
  2. Stacked accordion layout rendered all categories into one scroll column. When a category with 50+ services expanded, the single `overflow-y-auto` body had to contain all of it. The flex parent (`DialogPrimitive.Popup`) had `max-h` but the flex algorithm didn't reliably establish a definite height for the `flex-1` body in all browsers.
  3. `pb-24` padding-bottom hack on the body was an attempt to clear the footer, but padding-bottom in `overflow-y-auto` containers is inconsistently respected by browsers during overflow.
  4. Inline styles throughout the component made layout debugging fragile.
- **Resolution:**
  - Changed `AdminDialog` to `top-6` top-anchored positioning with explicit `h-auto max-h-[calc(100dvh-3rem)]`.
  - Rewrote `staff-service-editor-sheet.tsx` with split-pane layout: category rail + independently scrollable service list panel.
  - `AdminOverlayBody` uses `overflow-hidden p-0 flex flex-col`; inner wrapper is `flex flex-1 min-h-0 flex-col sm:grid sm:grid-cols-[220px_1fr]`.
  - Only active category services render in the right panel.
  - Removed all inline styles; everything uses Tailwind utilities.
  - Replaced `baselineRef` (read in `useMemo`) with `baselineIds` state to avoid React ref-in-render errors.
