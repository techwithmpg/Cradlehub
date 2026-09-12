# PWA-C6 — Universal Scanner Handoff

Repository: E:\cradlehub
Branch: stage/pwa-c6-scanner
Base (merged C5): a97e43eec9ce0c99ad5037212e75cd5226fe38fc
Governance: PWA-GOV-009

---

## 1. Status

**IMPLEMENTATION COMPLETE — AWAITING EXTERNAL REVIEW**

---

## 2. What Was Built

### 2.1 Server-Owned Scan Routing Seam

**File:** `src/lib/scanner/resolve-scan-target.ts`

Pure TypeScript function `resolveStaffScanTarget(raw: string): ScanTargetResult`.

- No mutation, no DB lookup, no authorization grant.
- Classifies untrusted decoded QR payload into exactly one of:
  - `public_scan` → delegates to `/scan/{publicCode}` subsystem
  - `activation` → delegates to `/scan/activate/{token}` subsystem
  - `invalid` → caller presents error state
- Security guards:
  - Blocks `javascript:`, `data:`, `file:`, `vbscript:` URI schemes.
  - Rejects foreign origins on full-URL QR codes.
  - Rejects `?redirect=` / `?next=` injection parameters.
  - Accepts only known public-code prefixes (`att_`, `room_`, `res_`).
  - Accepts only `act_` prefixed raw activation tokens.
  - Does NOT accept opaque 32-byte hex recovery tokens raw — only via full URL.

### 2.2 Camera Scanner Hook

**File:** `src/components/features/scanner/use-staff-scanner.ts`

`useStaffScanner(options)` hook managing the full camera lifecycle:

- **Permission request:** calls `getUserMedia` with `{ facingMode: { ideal: "environment" } }` + fallback to `{ video: true }`.
- **Decoder:** feature-detects `BarcodeDetector` (Chromium Android hardware path); falls back to `jsqr` (pure-JS, covers iPhone Safari PWA + all browsers).
- **Decode lock:** exactly one submission per scan attempt (`lockedRef`).
- **Track teardown:** fires on decode-lock, `stopScan()`, component unmount (`mountedRef`), and document visibility hide.
- **"Scan Again":** calls `stopScan()` then `startScan()` to fully reacquire camera tracks.
- States: `permission_request | permission_denied | camera_unavailable | scanning | code_detected | processing | confirmed | rejected | invalid | duplicate | network_unknown`.

### 2.3 Scanner UI Component

**File:** `src/components/features/scanner/staff-qr-scanner.tsx`

`StaffQrScanner({ returnHref })` — full-page camera QR scanner.

- Uses `setStateRef` pattern to avoid circular `setState` closure dependency with the hook.
- All visual states rendered: idle, scanning (with animated scan line), processing spinner overlay, confirmed (green), invalid/rejected (red), permission-denied help text, camera-unavailable help text.
- Corner-marker viewfinder, `aria-label` on the viewfinder container.
- On valid decode: sets state to `confirmed` then navigates via `router.push` to the adapter route.
- On invalid decode: sets state to `invalid`.

### 2.4 Updated Staff Scan Page

**File:** `src/app/(dashboard)/staff/scan/page.tsx`

- Replaced C5 stage-boundary placeholder with `<StaffQrScanner returnHref={returnHref} />`.
- Retains server-side profile/role resolution for `StaffAppShell` context.

### 2.5 Staff-Scoped Adapter Routes (PWA-GOV-009 seam)

**Files:**
- `src/app/(dashboard)/staff/scan/process/[publicCode]/page.tsx`
- `src/app/(dashboard)/staff/scan/activate/[token]/page.tsx`

Pure redirect seams — no mutation, no auth, no logic duplication.

- `process/[publicCode]`: validates known prefix then redirects to `/scan/{publicCode}`.
- `activate/[token]`: validates non-empty then redirects to `/scan/activate/{token}`.

Both delegate to existing subsystem handlers (`PublicScanProcessor`, `DeviceRecoveryScreen`) which own all mutation and authorization logic.

---

## 3. Files Created

| File | Purpose |
|------|---------|
| `src/lib/scanner/resolve-scan-target.ts` | Server-owned routing seam (pure, no mutation) |
| `src/lib/scanner/__tests__/resolve-scan-target.test.ts` | 24-test Vitest suite |
| `src/components/features/scanner/use-staff-scanner.ts` | Camera lifecycle hook |
| `src/components/features/scanner/staff-qr-scanner.tsx` | Scanner UI component |
| `src/app/(dashboard)/staff/scan/process/[publicCode]/page.tsx` | Staff adapter: public scan |
| `src/app/(dashboard)/staff/scan/activate/[token]/page.tsx` | Staff adapter: activation |

## Files Modified

| File | Change |
|------|--------|
| `src/app/(dashboard)/staff/scan/page.tsx` | Replaced C5 placeholder with StaffQrScanner |

---

## 4. Test Evidence

```
✓ src/lib/scanner/__tests__/resolve-scan-target.test.ts (24 tests) 8ms

Test Files  1 passed (1)
Tests  24 passed (24)
```

Test coverage:
- Empty/null payload rejection
- Blocked URI schemes (javascript:, data:, file:, vbscript:)
- Raw public-code prefixes: att_, room_, res_
- Whitespace trimming
- act_ activation tokens
- Opaque hex token rejection
- Full URL: same-origin public_scan
- Full URL: same-origin activation
- Full URL: URL-encoded publicCode decode
- Full URL: unknown prefix rejection
- Full URL: unknown path rejection
- Full URL: redirect param injection rejection
- Full URL: next param injection rejection
- Full URL: foreign origin rejection
- Full URL: malformed URL rejection
- Localhost accepted in non-production

---

## 5. TypeScript Status

`pnpm tsc --noEmit` → exit 0, no errors.

---

## 6. git diff --check

Exit 0. No whitespace errors.

---

## 7. Preserved Boundaries

- ✅ No mutation performed in scanner component or adapter routes.
- ✅ No universal intent picker created.
- ✅ No `/api/attendance/public-scan` called from client.
- ✅ No raw opaque recovery tokens accepted without prefix.
- ✅ No activation/recovery tokens logged.
- ✅ No database/schema/migration changes.
- ✅ No service worker changes.
- ✅ No RLS/Storage changes.
- ✅ `processQrScan` not called directly from client.
- ✅ Staff manifest/scope/icon unchanged.
- ✅ C7+ not started.
- ✅ Production not mutated.

---

## 8. Architecture Compliance (PWA-GOV-009)

The scanner delegates via:
```
Camera → jsQR / BarcodeDetector → resolveStaffScanTarget() → ScanTargetResult
  → public_scan → /staff/scan/process/{publicCode} → /scan/{publicCode} (existing)
  → activation  → /staff/scan/activate/{token}    → /scan/activate/{token} (existing)
  → invalid     → Scanner UI shows error state
```

No new mutation facades. Existing subsystem handlers (`PublicScanProcessor`, `DeviceRecoveryScreen`) unchanged and undisturbed.

---

## 9. Next Stage

PWA-C7 (Attendance) is NOT authorized. Owner authorization required before any next stage.
