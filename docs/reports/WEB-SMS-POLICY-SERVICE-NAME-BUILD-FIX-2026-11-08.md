# CradleHub Web — SMS service-name null-safety build correction (2026-11-08)

## Target and authorization
- Target: CradleHub Web repository, not Desktop.
- Owner supplied Vercel screenshot of failed production build at `src/lib/sms/policy.ts:119` and continued the build-fix workflow.
- Existing production-connected `main` base verified as `5ef2f83bec89a005ae387511e970e0cd941ef2dd`.
- Isolated correction branch: `fix/web-sms-policy-service-name-20261108`.
- No merge, production deploy, database access, SMS sending, schedule activation or live Twilio change.

## Defect
Next.js production compilation reaches TypeScript, which rejects `compact(visit.serviceNames[0], 36)` under `strict` / `noUncheckedIndexedAccess`. Checking `serviceNames.length === 1` does not narrow array index access to a non-optional string.

## Scope
- `src/lib/sms/policy.ts`: replace element access with `visit.serviceNames[0] ?? "service"` before formatting.
- `src/lib/sms/policy.test.ts`: regression coverage for absent and malformed service details.
- This handoff report.
- Existing customer messaging eligibility, consent, booking state, service selection and Twilio integration unchanged.

## Verification
- GitHub connector: resolved current accepted `main`, inspected exact failing expression at line 119, committed the isolated correction and verified updated file bytes in branch.
- Focused installed TypeScript `tsc` reproduction using strict + noUncheckedIndexedAccess + noImplicitReturns + noFallthroughCasesInSwitch: **PASS (exit 0)**.
- **NOT RUN:** full repo `pnpm run build`, `pnpm type-check`, Vitest, format/lint; repository workspace/dependencies not mounted in the execution container.
- **NOT VERIFIED:** Vercel successful preview build, production deployment, actual customer SMS, browser, database, native or runtime behavior.

## Review and rollback
- Review status: **CORRECTION REQUIRED / INDEPENDENT REVIEW PENDING**, not merge-ready from a focused TypeScript reproduction alone.
- Reviewer must run the complete repository quality gates and check Vercel build status of this exact head; subsequent TypeScript errors may appear once this blocker is fixed.
- Do not merge to production-connected main without independent review and owner authorization.
- Rollback: standard reviewed revert of one-line fallback and test; no SQL, migration or deployment rollback needed.
