# Master Sheet Stage 1D — Owner read-only review handoff

**Evidence label:** REPOSITORY-RECORDED WORKING EVIDENCE

**Target:** CradleHub Web

**Branch:** `stage/master-sheet-readonly-projection`

**Accepted main:** `6a310021df66679d71daf753434e6c328e3181b4`

**Starting stage HEAD:** `d23135968aeb80e196cecc264d26a2f087410a12`

## Authorization and implementation

The owner authorized Stage 1D as an independent, detailed Master Sheet Review for authenticated Owners and super-admins. The new `/crm/master-sheet` page checks that authority on the server before any Google Sheet read. Its CRM navigation entry is visible only to that audience. The page loads the current and previous week separately from normal CRM pages and displays Sheet visits, staff duties, and needs-review references as external, read-only, unlinked records. Every reference has `BRANCH_UNKNOWN`; no Main or SM mapping is inferred. The view shows compact tab/row/time provenance, local text filters, and Sheet payment evidence labeled as noncanonical. No Sheet or Supabase writes, import/sync action, persistence, cache, migration, or canonical CRM projection was added.

Google/API/parse failure becomes a sanitized **unavailable** state, distinct from **available but empty** and **available with needs review**. Reader and service code record sanitized authorization, token, metadata, tab read, parse, adapter, and total timings through the existing logger. No live latency measurements were taken in this stage.

## Verification

- `pnpm exec vitest run tests/lib/integrations/google-sheets tests/components/crm/master-sheet-review.test.tsx tests/components/dashboard/nav-config.contract.test.ts`: **68 passed, 2 skipped** across 12 files. Existing Sheet parser tests passed.
- `pnpm type-check`: **pass**.
- Targeted `pnpm exec eslint` on the 14 changed executable/test files: **pass**.
- Targeted `pnpm exec prettier --check` on the same files: **pass**.
- `pnpm build`: **pass**; Next.js emits `/crm/master-sheet` as a dynamic route.
- `git diff --check`: **pass**.

**Browser QA:** NOT VERIFIED. No authenticated Owner or ordinary-user browser session was run at 390×844, 430×932, tablet, or desktop. The configured Supabase target is UNKNOWN, so this stage did not query it for runtime QA. Component tests are not a substitute for real browser verification.

## Limits and next gate

The existing `createLocalAdcSheetTokenProvider()` rejects `NODE_ENV=production`; production Review will return the sanitized unavailable state until a separate credential policy is authorized and implemented. This stage has no production verification or measured live performance. A later, separately authorized stage should establish a named LOCAL/TEST target and suitable read-only credentials, then complete Owner/super-admin and ordinary-user browser QA across the specified viewports. Stage 1E, operational projection, import/sync, merge, and deployment are not authorized by this handoff.

Rollback is a normal revert of the Stage 1D commit on this stage branch. There is no data, migration, or production rollback step.
