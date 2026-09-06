# CradleHub Password Account Recovery Completion Evidence

Date: 2026-09-06 (Asia/Singapore)

## Target and result

- Target: CradleHub Web email/password self-service recovery
- Owner-specified starting SHA: `cddd96e63ac37a1a720ccb94f037f4820833f150`
- Reconciled base SHA: `653f4d0ba04f1af76a7006209a74e40022d7de84`
- Branch: `fix/auth-password-recovery-completion`
- Head SHA: the commit containing this report; its self-referential SHA is recorded in the owner handoff after commit
- Canonical origin: `https://www.cradlewellnessliving.com`
- Result: **PASS — CODE COMPLETE, MANUAL SUPABASE CONFIGURATION REQUIRED**
- Production: not merged or deployed
- Google authentication: out of scope and unchanged

The remote baseline advanced during verification. The specified SHA is an
ancestor of the new accepted `origin/main`; the intervening Desktop API work did
not change any recovery file. This branch was fast-forwarded before commit.

## Architecture preserved

```text
CradleHub forgot-password UI
  -> Supabase resetPasswordForEmail()
  -> Supabase recovery proof
  -> CradleHub server callback
  -> exchangeCodeForSession() or verifyOtp(type: recovery)
  -> Supabase-authenticated recovery session
  -> short-lived CradleHub recovery marker
  -> reset-password UI
  -> auth.getUser()
  -> auth.updateUser({ password })
  -> audit -> sign out -> expire marker -> normal sign-in
```

No password table, recovery-token table, service-role password mutation, role
change, or alternate identity authority was added.

## Diagnosis

- **Code/redirect:** reset requests targeted `/reset-password`, creating an
  avoidable reset-page/callback bounce. Recovery used the non-`www` origin while
  repository configuration and live redirects establish the `www` origin.
- **Cookie/session:** a callback could mint the marker from
  `next=/reset-password` without explicit recovery intent. Marker deletion did
  not reproduce the cookie's scoped `/reset-password` path.
- **UX:** malformed, provider, and verification failures returned to login with
  no recovery explanation.
- **Enumeration:** a Supabase request error returned a distinguishable public
  error instead of the generic success response.
- **Configuration/template/delivery:** the hosted CradleHub Supabase project is
  unavailable to the authenticated local CLI and connector. Hosted Auth URL
  settings, the Reset Password template, SMTP, and delivered links are unknown.
- **Password update:** the existing dual requirement—custom marker plus verified
  Supabase user before `updateUser`—was correct and remains intact.

## Correction

- Reset requests now target the direct server callback with `type=recovery`.
- `NEXT_PUBLIC_APP_URL` is restricted to an origin and production requires
  non-local HTTPS.
- Only explicit, successfully verified recovery callbacks can set the marker;
  ordinary auth callbacks clear it and cannot route to the reset form.
- Both PKCE code and token-hash paths require Supabase acceptance; recovery also
  requires `auth.getUser()` before the marker is set.
- Marker settings remain HttpOnly, SameSite=Lax, Secure in production,
  path `/reset-password`, max age 600 seconds. Removal uses the same path.
- Recovery failures route to the branded
  `/reset-password?error=invalid_or_expired` state without raw errors/tokens.
- Provider request errors are logged/audited while returning the same generic
  response to prevent account enumeration.
- Legacy reset-page query forwarding remains, with PKCE codes explicitly typed
  as recovery.

## Changed files

- `src/app/(auth)/forgot-password/actions.ts`
- `src/app/(auth)/reset-password/actions.ts`
- `src/app/(auth)/reset-password/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/lib/auth/auth-redirects.ts`
- `tests/app/auth/callback-route.test.ts`
- `tests/app/auth/forgot-password-actions.test.ts`
- `tests/app/auth/reset-password-actions.test.ts`
- `tests/lib/auth/auth-redirects.test.ts`
- `docs/audits/AUTH_PASSWORD_RECOVERY_COMPLETION_20260906.md`

`src/app/(auth)/login/google-personalized-sign-in.tsx` and all Google provider,
client-ID, linking, and Identity Services configuration are unchanged.

## Supabase configuration

Repository evidence identifies project ref `lsrbwqhvzjfpiabeolkv` as the
**PRODUCTION** CradleHub project. The local CLI account does not expose it.
`supabase/config.toml` contains local defaults only and no active SMTP block.
The hosted dashboard was **not** inspected.

### Manual Supabase configuration required

An authorized owner must verify or set:

1. Authentication > URL Configuration > Site URL:
   `https://www.cradlewellnessliving.com`
2. Exact production Redirect URL (no production wildcard):
   `https://www.cradlewellnessliving.com/auth/callback?next=%2Freset-password&type=recovery`
3. Optional local Redirect URL:
   `http://localhost:3000/auth/callback?next=%2Freset-password&type=recovery`
4. Authentication > Email Templates > Reset Password must resolve to:

```text
https://www.cradlewellnessliving.com/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
```

HTML-safe template anchor:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/reset-password">
  Reset password
</a>
```

After saving, use one owner-approved TEST account and inspect the received link
before changing its password.

## Email delivery and SMTP

- `resetPasswordForEmail()` acceptance is not delivery proof.
- No accessible evidence proves custom SMTP is configured.
- Supabase documents its default SMTP as restricted and unsuitable for
  production delivery; hosted SMTP must be checked manually.
- No email provider or SMTP configuration was changed.
- Inbox receipt, sender authentication, spam placement, and the actual hosted
  template remain unverified.

## Verification

Environment: Node 24.14.0, pnpm 10.33.2, Next.js 16.2.4, Vitest 4.1.5.

```text
git diff --check
PASS

pnpm type-check
PASS after next typegen refreshed stale generated route types

pnpm lint
PASS — 0 errors; 9 pre-existing marketing warnings

focused auth tests
PASS — 4 files, 31 tests

pnpm test -- --run
PASS on the reconciled baseline — 218 files, 1,603 tests

pnpm build
PASS on the reconciled baseline — 116 pages generated

focused Prettier check over changed source/test files
PASS

pnpm format:check
BASELINE FAILURE — 78 unrelated incremental files fail formatting; no changed
recovery source/test file is in that list
```

Coverage includes normalization, malformed email, canonical redirects, missing
URL safety, cooldown, generic provider errors, anti-enumeration, PKCE and token
hash verification, type enforcement, malformed/provider/verification failure,
external redirect rejection, marker set/clear, invalid sessions, weak and
mismatched passwords, exactly one update, audit outcomes, update failure,
successful sign-out, and sign-out failure after successful password mutation.

## Local browser evidence

At `http://localhost:3000`:

- `/forgot-password` loaded and hard-refreshed with HTTP 200.
- A reserved address (`recovery-browser-check@example.invalid`) displayed the
  generic non-enumerating success message.
- `/reset-password` loaded and hard-refreshed with HTTP 200 and showed the
  branded invalid-link state and recovery actions.
- Bare `/auth/callback` returned HTTP 307 to `/login`.
- A recovery provider-error callback returned HTTP 307 to the branded
  invalid/expired page without exposing the provider error.
- No real token appeared in browser evidence.

Browser checks ran on the owner-specified baseline before `origin/main`
advanced. The intervening diff did not touch recovery files, and the identical
recovery patch passed all automated gates after reconciliation.

The synthetic submission reached the local app configured against the
**PRODUCTION** Supabase project. It attempted one recovery request for the
reserved `.invalid` address and the existing audit path. No insert error was
logged, so one error-outcome audit row may have been written. No real account,
password, role, or recipient was targeted. No further production-connected
functional mutation was performed.

## Preview evidence

Preview runtime verification was unavailable before branch publication: the
checkout has no `.vercel/project.json`, no installed/authenticated Vercel CLI,
and invalid GitHub CLI credentials. A Git-integrated Preview triggered by the
branch push must not be treated as verified without an accessible URL and
runtime checks. No production deployment was performed.

## Database and authorization impact

- Schema, migrations, RLS, grants, staff roles, and workspace access: unchanged.
- Password authority remains Supabase Auth.
- Existing service-role use remains audit-only; no service-role password update
  was introduced.
- The possible synthetic audit row above is the only production-connected
  write. It was not deleted because production audit cleanup requires separate
  authorization.

## Limitations

Without a TEST account/inbox and hosted Supabase/Vercel access, these remain:

1. email receipt and actual link destination;
2. hosted verification and recovery cookies;
3. TEST-user password update, sign-out, and marker removal;
4. new-password success and old-password rejection;
5. one-time link reuse rejection;
6. Preview route and refresh verification.

Supabase warns that security scanners can prefetch one-time links. The direct
token-hash design is susceptible. If observed, add a user-confirmation landing
step or OTP flow in a separately authorized task.

## Rollback

Revert the recovery completion commit. No schema, password-data, role, or Google
rollback is needed. Leave the possible synthetic audit row immutable unless the
owner separately authorizes production audit-data cleanup.
