# Stage 07A — Hosted Desktop Attendance Contract Evidence

**Evidence classification:** `REPOSITORY-RECORDED PRODUCTION EVIDENCE`

**Target:** `techwithmpg/Cradlehub`

**Stage:** `07A — Hosted Desktop Attendance Contract`

**Status:** `READY FOR INDEPENDENT REVIEW`

**Branch:** `stage/07a-desktop-attendance-contract`

**BASE_SHA:** `f151dbfc9c87377cc418b6ed5dd5e316f0fa78ae`

**HEAD_SHA:** `d4d6d80ab0cb40b40b9f9f320488ca234cb455bc`

**Desktop accepted baseline:** `a1ddc3d298c8fbd4036fa0bb9cd7957b2161bad7`

## Scope

Stage 07A exposes existing hosted Attendance authority through an authenticated versioned Desktop HTTP contract.

Implemented:

- `GET /api/desktop/v1/attendance`
- `GET /api/desktop/v1/attendance/history`
- `POST /api/desktop/v1/attendance/mutations`

Mutation actions:

- `review_exception`
- `resolve_exception`
- `apply_correction`
- `update_rules`
- `generate_device_recovery`
- `rename_device`
- `revoke_device`
- `revoke_recovery_link`
- `review_device_registration_request`
- `ensure_attendance_qr`
- `ensure_room_qrs`
- `replace_attendance_qr`

Explicitly excluded:

- Desktop Attendance UI
- public scan behavior changes
- scan-engine/enforcement changes
- schema/migrations
- Auth/RLS changes
- dormant modules

## Changed files

- `src/app/(dashboard)/crm/attendance/actions.ts`
- `src/app/api/desktop/v1/attendance/history/route.test.ts`
- `src/app/api/desktop/v1/attendance/history/route.ts`
- `src/app/api/desktop/v1/attendance/mutations/route.test.ts`
- `src/app/api/desktop/v1/attendance/mutations/route.ts`
- `src/app/api/desktop/v1/attendance/route.test.ts`
- `src/app/api/desktop/v1/attendance/route.ts`
- `src/lib/attendance/device-recovery-operation.test.ts`
- `src/lib/attendance/device-recovery-operation.ts`
- `src/lib/attendance/device-registration.ts`

## Exact checks and results

- Focused Stage 07A contract: **PASS — 30/30**
- Previously noisy navigation contract isolated run 1: **PASS — 4/4**
- Previously noisy navigation contract isolated run 2: **PASS — 4/4**
- Previously noisy navigation contract isolated run 3: **PASS — 4/4**
- Full repository regression on the realigned base using `--testTimeout=15000`: **PASS — 224 test files, 1691/1691 tests**
- `pnpm type-check`: **PASS**
- `pnpm lint`: **PASS with 0 errors and 9 unrelated existing Marketing warnings**
- Stage 07A Prettier verification after final formatting: **PASS**
- `git diff --check`: **PASS**
- `pnpm build` after final formatting: **PASS**

The earlier default-timeout full-suite failure was reproduced as resource-contention noise: the same navigation test subsequently passed three isolated normal-timeout runs and passed inside the complete 1691-test regression with a 15-second test timeout.

## Authority and security

- Supabase bearer authentication remains the Desktop identity boundary.
- Actor and branch authority are resolved server-side.
- Renderer-supplied branch authority is not trusted.
- Desktop mutation route does not instantiate `createAdminClient`.
- No service-role credential is exposed to Desktop or renderer code.
- Staff phone recovery remains server-only.
- Existing Staff Profile recovery notification side effect is preserved.
- Device registration review verifies request branch authority.
- Bearer-auth reviewer identity is passed into the registration RPC path.
- Existing hosted Attendance services remain authoritative.

## Runtime evidence actually observed

`REPOSITORY-RECORDED PRODUCTION EVIDENCE`

Observed:

- automated repository tests
- TypeScript compilation
- static lint
- formatting/whitespace validation
- successful Next.js production build

No deployed-production HTTP call or production Attendance mutation was performed.

## Security / data impact

- Production data changed: **No**
- Schema/migrations changed: **No**
- Auth/RLS changed: **No**
- Public scan behavior changed: **No**
- Scan-engine/enforcement changed: **No**
- Secrets exposed: **No**
- Tauri capabilities changed: **No**

## Limitations

This evidence proves repository implementation and local validation only.

It does not prove deployed production behavior or Desktop UI integration.

Stage 07B remains separately gated and unauthorized.

## Rollback

Revert implementation commit:

`d4d6d80ab0cb40b40b9f9f320488ca234cb455bc`

Then revert the documentation-only evidence commit.

No migration rollback is required.

## Gate

`READY FOR INDEPENDENT REVIEW — NOT MERGED — STAGE 07B NOT AUTHORIZED`
