# Master Sheet Stage 1D-AUTH-IMPL-A — code checkpoint

**Evidence label:** REPOSITORY-RECORDED WORKING EVIDENCE

**Target:** CradleHub Web

**Branch:** `stage/master-sheet-readonly-projection`
**Scope:** code, local unit tests, and build only. No Google IAM, Vercel project configuration, workbook ACL, Supabase, Google Sheet, merge, or production change was made by this checkpoint.

## Provider contract

After the existing per-request CradleHub user and Owner/super-admin authorization, the service selects the guarded local ADC provider only for local `NODE_ENV=development` without Vercel markers. `VERCEL=1`, `VERCEL_ENV=production`, and `NODE_ENV=production` select the new WIF provider. Preview, missing, and contradictory environments return Review unavailable with no credential path. The local provider's production guard remains.

The production provider reads these **server-only, non-secret identifiers** at request time: `CRADLE_SHEET_WIF_PROJECT_NUMBER`, `CRADLE_SHEET_WIF_POOL_ID`, `CRADLE_SHEET_WIF_PROVIDER_ID`, `CRADLE_SHEET_WIF_SERVICE_ACCOUNT_EMAIL`, `CRADLE_SHEET_WIF_VERCEL_TEAM_ID`, `CRADLE_SHEET_WIF_VERCEL_PROJECT_ID`, `CRADLE_SHEET_WIF_VERCEL_ISSUER`, and `CRADLE_SHEET_WIF_VERCEL_SUBJECT`. It also requires the Vercel system variable `VERCEL_PROJECT_ID` to match the configured project, plus `VERCEL=1` and `VERCEL_ENV=production`; system environment variables therefore must be exposed to the production function. These values must be set only for the intended production project in a later, separately authorized infrastructure stage. This checkpoint did not set them.

The provider derives the Google WIF audience from validated identifiers and uses fixed Google STS and IAM Credentials endpoints. It requests a custom-audience OIDC assertion in the authorized request, verifies its signature and exact audience, issuer, team ID, project ID, production environment, and subject, then supplies that assertion to `google-auth-library@11.1.0` for STS exchange and impersonation. The dedicated service-account target comes only from server configuration and rejects the existing local reader identity. The final access-token scope is exactly `https://www.googleapis.com/auth/spreadsheets.readonly`; requested impersonated lifetime is **600 seconds**. The provider constructs a new client per call and does not persist tokens. The existing reader keeps the fixed server-side workbook target and `GET`/`no-store` behavior.

The final Sheets scope is read-only but is not a one-workbook permission. A later infrastructure gate must grant the dedicated account Viewer on CRADLE MAINSHEETS only and no broader Drive or parent-folder access. No live account, pool, provider, permission, or workbook access has been verified here.

## API compatibility and limits

The installed `@vercel/oidc@4.0.0` types expose `getVercelOidcToken({ audience })` and `verifyVercelOidcToken` with issuer, audience, owner ID, project ID, and environment validation. Pinned `google-auth-library@11.1.0` exposes `ExternalAccountClient.fromJSON`, `subject_token_supplier`, explicit `scopes`, and `service_account_impersonation.token_lifetime_seconds`. A local, network-free constructor check created an `IdentityPoolClient`, recovered the configured service-account email, and retained only the Sheets scope. Google IAM Credentials documents the requested `lifetime` field. No live STS, IAM, or Sheets call was made, so Vercel request-context propagation and the live WIF configuration remain unverified.

Official references: [Vercel GCP federation](https://vercel.com/docs/oidc/gcp), [Vercel OIDC reference](https://vercel.com/docs/oidc/reference), [Google access-token API](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken), [Next.js data security](https://nextjs.org/docs/app/guides/data-security).

## Previously authorized payload after access loss

`next.config.ts` sets a global 120-second dynamic client-router stale time, and Next.js 16 states that this does not change browser back/forward behavior. The dashboard logout is a server action. It now calls `revalidatePath("/crm/master-sheet")` after sign-out and before redirect; Next.js 16 documents that revalidation from a server action invalidates the client cache for revisit. This is a narrow sign-out correction. It does not prove how a browser back/forward cache behaves after a session ends or whether an Owner role revoked while the browser stays open can leave an already-rendered or cached Review payload visible. That is an **unresolved browser security verification item**; no browser QA or target-aware live Supabase access was authorized for this checkpoint. Before production enablement, reproduce sign-out, back/forward, and role-revocation cases in an authorized environment. If stale data appears, isolate a Master Sheet Review navigation/cache correction and retest; do not change global router caching to address this one route.

## Rollback

Revert this implementation commit on the stage branch. The pre-existing local ADC production guard then leaves Review unavailable. No database or Sheet data rollback is involved. Infrastructure rollback is outside this code checkpoint because no infrastructure was changed.
