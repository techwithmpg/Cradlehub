# Master Sheet Stage 1D access correction

- **Evidence label:** REPOSITORY-RECORDED WORKING EVIDENCE
- **Target:** CradleHub Web
- **Branch:** `stage/master-sheet-readonly-projection`
- **Base SHA:** `ec9d03547f8bfd90d82e2f3285ad9c92505cf22e`
- **Authorization:** Owner instruction for Owner, management, and Front Desk read-only Master Sheet review access. No merge, deployment, Supabase mutation, Google Sheet mutation, Google IAM change, or Vercel change is authorized.

## Correction

The previous guard accepted only active Owners and resolved super-admins. The CRM navigation entry used a separate Owner-only flag. Both now use the existing CRM workspace role contract: active Owner, management (`manager`, `assistant_manager`, `store_manager`), Front Desk (`crm` and canonicalized legacy `csr` aliases), or resolved super-admin. Unauthenticated users, inactive staff, failed staff lookups, and other roles remain denied. The server service completes authorization before selecting a Sheet token provider or reading the workbook.

The review route still returns not found for denied access. The change grants view access only. Sheet projection retains `MASTER_SHEET`, `readOnly: true`, `BRANCH_UNKNOWN`, and `UNLINKED`. Every rendered record card retains Master Sheet and Read only badges plus Branch: Unknown; visit financial values remain labeled Sheet evidence only, not recorded CradleHub payments. No mutation action was added.

## Evidence and limits

- Focused Google Sheets, Master Sheet component, navigation, and logout-cache tests: 100 passed, 2 skipped (15 files). Tests cover allowed and denied roles, no provider selection or Sheet read on denial, source labels, filters, and noncanonical projection.
- `pnpm type-check`: passed.
- Targeted ESLint and Prettier: passed.
- `pnpm build`: passed; `/crm/master-sheet` built as a dynamic route.
- `git diff --check`: passed.
- Fetched `origin/main` at `6a310021df66679d71daf753434e6c328e3181b4`; it is the merge base and has no commits absent from this stage branch.
- Browser QA: **Front Desk PASS, with limits.** `.env.local` points to Supabase project `lsrbwqhvzjfpiabeolkv`, recorded as PRODUCTION in the repository. The Owner explicitly authorized read-only production browser QA in this task. The existing authenticated Front Desk session showed the Master Sheet Review navigation entry and loaded `/crm/master-sheet` with an available Google Sheet read. Current week displayed 128 visits, 15 staff duties, and 221 Needs Review entries; previous week displayed 400, 39, and 486. Visit, duty, and review filters displayed their respective record types. Search plus date and review-reason filters returned only matching visits. Every inspected rendered card had Master Sheet, Read only, and Branch: Unknown labels, with zero card buttons, links, or forms. Financial amounts appeared only under the "Sheet evidence only — not a recorded CradleHub payment" label. No mutation control was used.
- Browser limits: no separate authenticated Owner or unauthorized-role browser session was available; those roles were verified by tests. A browser-back navigation briefly restored the record-type select to "Review entries" while visit cards still rendered; changing the filter realigned the cards. This is a separate client navigation state issue for later review. Today's Money totals were visible before Sheet Review, but a post-review comparison was not obtained, so financial isolation is supported by the unchanged projection/route code and UI labels, not a before/after production ledger check. The local code has not been deployed to production.
- Local ADC and Google Sheet metadata GET passed in the prior diagnostic. This correction did not repeat a live Sheet read.

**Production impact:** none before an authorized merge/deployment; this was read-only local-browser verification against the PRODUCTION Supabase target. **Rollback:** revert the access-correction commit on the stage branch. **Next permitted action:** commit and push this stage branch as the Owner authorized, then review the browser-back filter state issue and obtain Owner/unauthorized browser QA when safe sessions exist. **Not authorized:** Stage 1E, merge, deploy, data migration, import/sync, or any Supabase/Google mutation.
