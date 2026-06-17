# Current Task - AUTH-RESET-SUPABASE-CONNECTION-001

Status: COMPLETE
Started: 2026-06-17
Completed: 2026-06-17

## Description

Connect the CradleHub local and production password-recovery flow to the configured Supabase Auth reset URLs.

## Trace Checklist

- Read repository context, Supabase Auth guidance, and installed Next.js App Router docs before implementation.
- Audit existing login, forgot-password, reset-password, auth callback, Supabase client, proxy, and role-routing behavior.
- Reuse the existing Supabase clients and auth callback; do not create duplicate recovery routes.
- Add or reuse a trusted public app URL helper backed by `NEXT_PUBLIC_APP_URL`.
- Ensure reset requests call Supabase Auth with a `/reset-password` redirect built from the trusted app URL.
- Ensure recovery sessions are established before password update and never route into a workspace before update.
- Preserve Owner, CRM, Staff, Driver, Utility, workspace switching, proxy protection, booking, scheduling, and dispatch behavior.
- Add focused tests for URL construction, reset request behavior, login messaging, callback routing, password validation/update, and password visibility where practical.
- Run type-check, lint, tests, build, and requested unsafe scans.
- Update context documentation after implementation.

## Status Notes

- Pre-flight context and project docs read; root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `ARCHITECTURE.md` are absent, so `docs/` equivalents were used.
- Supabase and Next.js task guidance loaded; official Supabase changelog/docs fetch required escalated network access after sandbox refusal.
- Implemented trusted `NEXT_PUBLIC_APP_URL` password-reset redirect construction with development localhost fallback and production localhost rejection.
- Self-service and Owner-triggered recovery now send users to `/reset-password`; `/reset-password` redirects PKCE/token-hash recovery params through `/auth/callback` to establish the Supabase session and recovery marker before rendering the update form.
- Login now shows the reset affordance as `Forgot password?` beside the Password label and shows a password-updated confirmation after successful reset.
- Password update now requires the recovery marker plus a current Supabase user, applies shared password policy validation, calls `auth.updateUser({ password })` once, signs out, and returns to `/login?passwordUpdated=true`.
- Supabase dashboard/env follow-up: production `NEXT_PUBLIC_APP_URL` must be the deployed CradleHub origin, and Supabase Auth URL configuration should include Site URL `https://cradlewellnessliving.com` plus redirect URLs `http://localhost:3000/reset-password` and `https://cradlewellnessliving.com/reset-password`; replace any placeholder Vercel URL with the real deployment URL if a Vercel preview/production domain is used.
- Verification passed: `pnpm type-check`, `pnpm lint` (0 errors, 4 existing warnings), `pnpm test` (49 files / 513 tests), `pnpm build` (100 routes), and requested unsafe scans.
- Unsafe scan note: only `src/lib/supabase/admin.ts` references `SUPABASE_SERVICE_ROLE_KEY`, and it is the existing server-only admin client. No localhost reset URL, placeholder Vercel reset URL, password console logging, or password storage matches were found in `src`.
