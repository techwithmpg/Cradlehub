# 🤝 HANDOFF — CRM Modal System + Scroll Fix

## What Was Done

### Central Overlay Components (in `src/components/shared/overlays/`)

| Component | Purpose |
|-----------|---------|
| `AdminDialog` | Wraps base-ui `DialogPrimitive` with size variants (`sm` through `full`). Now top-anchored (`top-6`) with explicit `h-auto max-h-[calc(100dvh-3rem)]` and `flex flex-col overflow-hidden`. |
| `AdminDrawer` | Wraps base-ui `SheetPrimitive` with size variants. Right-side drawer with `h-[100dvh] flex flex-col overflow-hidden`. |
| `AdminOverlayHeader` | Fixed header slot: `shrink-0 border-b px-5 py-4`. |
| `AdminOverlayToolbar` | Optional toolbar slot: `shrink-0 border-b px-5 py-3`. |
| `AdminOverlayBody` | Scrollable body slot: `min-h-0 flex-1 overflow-y-auto` by default. Can be overridden to `overflow-hidden` for split-pane layouts. |
| `AdminOverlayFooter` | Fixed footer slot: `shrink-0 border-t px-5 py-4`. |
| `ConfirmUnsavedChangesDialog` | Reusable AlertDialog for discard confirmation. |

### Refactored CRM Popups

1. **Edit Service Capabilities** (`staff-service-editor-sheet.tsx`)
   - Uses `AdminDialog size="wide"` (1080px)
   - Split-pane layout: category rail (220px) + scrollable service list
   - Only selected category renders in the right panel
   - Search mode shows all matches grouped by category
   - Selected mode shows only selected services grouped by category
   - Footer has Cancel + Save buttons
   - Zero inline styles; all Tailwind via `cn()`

2. **Provider Assignment** (`provider-assignment-sheet.tsx`)
   - Uses `AdminDialog size="lg"`
   - Uses standard overlay anatomy (header/body/footer)

3. **Edit Staff Profile** (`crm-staff-management-tab.tsx`)
   - Uses `AdminDrawer size="md"`
   - Uses standard overlay anatomy (header/body/footer)
   - Unsaved changes guarded by `ConfirmUnsavedChangesDialog`

## Build Status
pnpm type-check ✅ · pnpm lint ✅ (0 errors, 2 pre-existing script warnings) · pnpm build ✅ (89/89 routes)

## Recommended Next Steps
1. **Browser verification** — `/crm/staff?tab=management` → open Edit Staff Profile → click Edit Service Capabilities
   - Confirm category rail is visible on the left
   - Click a large category (e.g., Salon Services)
   - Scroll the right panel to the bottom and confirm the last service is reachable
   - Confirm the Save footer stays visible
   - Search for a service near the bottom and confirm results scroll
   - Switch to Selected tab and confirm selected services scroll
   - Close with unsaved changes and confirm discard dialog appears
2. **Resize test** — shrink browser height and verify modal still fits viewport
3. **Provider modal** — `/crm/services?tab=providers` → click Manage Providers, confirm lg modal scrolls properly
