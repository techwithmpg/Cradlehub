# Attendance Device Registry Audit

Task: `ATTENDANCE-DEVICE-REGISTRY-005`
Date: 2026-07-03

## Existing Tables Reused

- `public.staff_devices`
- `public.device_activation_tokens`
- `public.qr_scan_events`
- `public.staff_shift_checkins`
- `public.qr_points`

The prompt's legacy names `attendance_events`, `attendance_sessions`, and `attendance_qr_points` are not present in the live schema. The current Attendance implementation uses `qr_scan_events`, `staff_shift_checkins`, and `qr_points`.

## Current Device Model

`staff_devices` already stores staff, branch, hashed device credential, label, active/revoked status, trusted timestamp, last seen timestamp, revocation timestamp, revoking staff, metadata, and created/updated timestamps.

Gaps found:
- No first-class browser/platform fields.
- No registration source field.
- No separate last attendance scan and last service scan timestamps.
- No revocation reason field.
- No label length constraint.

`status` is already the active/revoked state, so no duplicate `is_active` column should be added.

## Current Token Model

`device_activation_tokens` already stores staff, branch, hashed token, expiry, used timestamp, used device, requester, metadata, and created timestamp.

Gaps found:
- No purpose field to separate first-scan activation from device recovery.
- No recovery reason field.
- No revocation timestamp/staff fields for pending links.
- No selected previous-device field.
- No updated timestamp.

Existing `used_at` is the consumed timestamp, so no duplicate `consumed_at` column should be added. Existing `requested_by` is the creator, so no duplicate `created_by` column should be added.

## Current Token And Cookie Behavior

- Existing first-scan activation tokens are generated with `createActivationToken()` and stored as `hashSecret(token)`.
- Recovery tokens will use the prompt-required SHA-256 hash of the raw recovery token without storing the raw token.
- Existing device credentials are generated with `createDeviceCredential()` and stored as `hashSecret(rawDeviceCredential)`.
- Existing cookie name is `cradle_device` with path `/scan`.
- New recovery and activation responses should set `cradle_attendance_device` with path `/`, while server reads should continue accepting the legacy cookie to avoid breaking existing registered phones.

## Current Route And Actions

- Existing activation route: `/scan/activate/[token]`.
- Existing activation action consumes tokens immediately through `activateDeviceAction`.
- The recovery screen must inspect without consuming on page load and consume only after explicit confirmation.
- Existing CRM action creates temporary activation links and revokes devices, but does not support recovery purposes, rename, pending-link revocation, or atomic recovery consumption.

## Current RLS And Grants

- `staff_devices` is selectable by Owner, same-branch operational roles, and the staff member's own account.
- `device_activation_tokens` has RLS enabled and no authenticated select grant/policy, so it is service-role only.
- `qr_scan_events` is selectable by Owner, same-branch operational roles, and the staff member's own account.
- Staff and branches have no organization id in this schema. Owner scope is the existing Owner-wide workspace scope; CRM scope is branch-bound through `branch_id`.

## Live DB Status

- `pnpm db:doctor` and `pnpm db:status` still cannot read migration history because the Supabase CLI attempts a timed-out port `5432` path.
- Read-only linked `db query` works outside the sandbox through the Supabase Management API.
- Live `staff_devices` currently has no rows.
- Live `device_activation_tokens` has old unconsumed activation rows that are expired as of 2026-07-03.

## Post-Migration Verification

- Applied migration: `20260703151111_attendance_device_registry_recovery.sql`.
- Live migration-history row: `ok`.
- Earlier local migration versions `20260703130922`, `20260703144603`, and `20260703145113` are present in remote migration history.
- New `staff_devices` columns: `registration_source`, `browser_name`, `browser_version`, `platform_name`, `last_attendance_scan_at`, `last_service_scan_at`, `revocation_reason`.
- New `device_activation_tokens` columns: `purpose`, `reason`, `revoked_at`, `revoked_by`, `revoke_previous_device_id`, `updated_at`.
- Live RPC: `public.consume_attendance_device_recovery(text,text,text,text,text,text,text,integer)`.
- Live RPC grant: `service_role` execute grant verified.
- Normal `pnpm db:status` / `pnpm db:push` still time out on port `5432`; linked SQL verification was used for the live database proof.
