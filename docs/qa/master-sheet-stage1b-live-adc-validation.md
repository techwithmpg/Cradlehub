# Master Sheet Stage 1B — Live ADC validation handoff

| Handoff field      | Value                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Evidence label     | REPOSITORY-RECORDED WORKING EVIDENCE                                                          |
| Target             | CradleHub Web                                                                                 |
| Branch             | `stage/master-sheet-readonly-projection`                                                      |
| Accepted main base | `6a310021df66679d71daf753434e6c328e3181b4`                                                    |
| Starting head      | `e81c1fe55df9902cf7f3eb6247d131231332cff3`                                                    |
| Correction head    | The stage commit containing this handoff; exact SHA is recorded in the final evidence report. |
| Status             | Date-boundary correction validated against both live tabs; required local gates passed.       |

## Authorization and scope

The owner authorized local, read-only access to `CRADLE MAINSHEETS` through ADC impersonation of the Viewer service account. The adapter requests only `https://www.googleapis.com/auth/spreadsheets.readonly`, verifies the impersonation target before minting a token, and is disabled in production. No Sheet or Supabase writes, API route, CRM UI, migration, deployment, or production operation was performed.

Changed files are limited to the direct `google-auth-library` dependency and lockfile, the server-only ADC adapter, Sheet parser and diagnostic files, focused tests, and this handoff. The official auth library is necessary because the repository had no installed Google auth dependency able to load impersonated ADC.

## Initial live read evidence, before correction

On 2026-10-04, the opt-in local test invoked the existing Stage 1B diagnostic path with business date `2026-10-04` (Asia/Manila). The reader successfully retrieved spreadsheet metadata and the values of both selected tabs. Its three Sheets API calls are GET requests. The adapter used the expected impersonated identity; it does not print or persist the token or ADC file.

| Aggregate                          | OCT.2-8, 2026 | SEPT 25-OCT 1, 2026 |
| ---------------------------------- | ------------: | ------------------: |
| Source rows read                   |           911 |                 978 |
| HEADER                             |             7 |                   7 |
| SUMMARY                            |            33 |                  32 |
| STAFF_DUTY                         |            13 |                  39 |
| SERVICE                            |           120 |                 427 |
| FINANCIAL_NOTE                     |            32 |                 110 |
| INFORMATIONAL                      |             0 |                   0 |
| UNKNOWN_NEEDS_REVIEW               |           109 |                  96 |
| Grouped SheetVisit records         |           108 |                 400 |
| SheetDuty records                  |            13 |                  39 |
| Grouped continuation service lines |            12 |                  27 |
| Visits with multiple services      |             8 |                  25 |
| Needs Review entries               |           262 |                 645 |
| Visits missing business date       |           108 |                 400 |

Blank rows are included in source row counts but omitted from classification counts. Continuation counts are additional service lines grouped into visits; they do not prove that every uncertain boundary was grouped correctly.

| Needs Review reason       | Current | Previous |
| ------------------------- | ------: | -------: |
| UNKNOWN_ROW               |     109 |       96 |
| MISSING_BUSINESS_DATE     |     121 |      439 |
| AMBIGUOUS_PAYMENT_MARKER  |      28 |      141 |
| MISSING_ATTENDANT         |      43 |      212 |
| AMBIGUOUS_SERVICE_VALUE   |       5 |       17 |
| UNASSIGNED_FINANCIAL_NOTE |      32 |      110 |
| MISSING_STAFF             |       1 |        0 |
| MISSING_TIME              |       0 |       11 |
| MISSING_CUSTOMER          |       0 |        3 |

Reason counts overlap because one review entry can have several reasons.

## Initial parser conflict

The parser recognized **zero operational date rows** across both tabs. Consequently every grouped visit lacks a business date. This materially conflicts with the Stage 1A model and prevents validation of visit dating and grouping confidence. The parser classified 33 and 32 rows as summaries and did not create visits directly from those rows, but the stale-summary-date invariant cannot be fully established while operational dates are unrecognized. Payment and financial note rows remain read-only informational evidence; no financial posting occurred. No parser rule was changed after this finding.

The owner then authorized structural inspection and a narrow correction. No broader Google scope, Editor access, or permanent key was needed.

## Date-boundary structure discovered

Both tabs repeat an operational header before each daily section. The header has **TIME in B, ATTENDANT in C, CLIENT in D, and SERVICE in F**. The unheaded **A column** carries a weekday label, followed on the next row by the actual date. Day/date rows may also contain staff-duty cells in C and F, so counting nonempty cells is not a safe date test. Actual service rows follow the duty block; blank rows and service continuation rows stay inside the day section. The date rows were returned as formatted strings for the existing reader and as numeric Sheets date serials under `UNFORMATTED_VALUE`. No A/B formula supplied these observed dates.

Sanitized examples from the live read:

| Tab      | Structural sample                                                             | Service section                                                                   |
| -------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Current  | Row 26 operational header; A27 `FRIDAY`; A28 `October 2, 2026` (serial 46297) | First visit at row 36; all 47 visits before the next day heading dated 2026-10-02 |
| Current  | Row 158 header; A159 `SATURDAY`; A160 `October 3, 2026` (serial 46298)        | First visit at row 168; all 61 visits dated 2026-10-03                            |
| Current  | A810 `THURSDAY`; A811 `September 3, 2026` (serial 46268)                      | Date is outside the tab week; zero visits in this unfinished section              |
| Previous | Row 26 header; A27 `FRIDAY`; A28 `September 25` (serial 46290)                | First visit at row 37; all 55 visits dated 2026-09-25                             |
| Previous | Row 304 header; A305 `SUNDAY`; A306 `September 27, 2026` (serial 46292)       | First visit at row 312; all 88 visits dated 2026-09-27                            |
| Previous | Row 845 header; A846 `THURSDAY`; A847 `October 1 ,2026` (serial 46296)        | First visit at row 855; all 58 visits dated 2026-10-01                            |

The stale summary block at rows 13–19 in both tabs has dates from August 28–September 3, 2026, with each date anchored in A and merged across A:B. It sits **before** the operational header and contains other summary values. Operational day/date cells are **not merged**. The parser now requires an adjacent weekday/date pair after an operational header, a weekday match, and membership in the tab's week. It rejects unpaired, malformed, and out-of-week candidates without supplying visit context. A yearless formatted value receives a year only when exactly one year within the tab week matches. The Asia/Manila business timezone remains authoritative for tab selection.

## Corrected live diagnostic snapshot

| Aggregate                          | OCT.2-8, 2026 | SEPT 25-OCT 1, 2026 |
| ---------------------------------- | ------------: | ------------------: |
| Source rows                        |           911 |                 978 |
| HEADER                             |             7 |                   7 |
| SUMMARY                            |            40 |                  39 |
| STAFF_DUTY                         |            15 |                  39 |
| SERVICE                            |           120 |                 427 |
| FINANCIAL_NOTE                     |            36 |                 110 |
| INFORMATIONAL                      |             1 |                   0 |
| UNKNOWN_NEEDS_REVIEW               |           103 |                  89 |
| SheetVisit                         |           108 |                 400 |
| SheetDuty                          |            15 |                  39 |
| Grouped continuation service lines |            12 |                  27 |
| Multi-service visits               |             8 |                  25 |
| Visits with business date          |           108 |                 400 |
| Visits missing business date       |             0 |                   0 |
| Visits crossing day boundary       |             0 |                   0 |
| Needs Review entries               |           205 |                 486 |
| OUT_OF_WEEK_DATE                   |             1 |                   0 |
| STALE_SUMMARY_DATE_REJECTED        |             8 |                   7 |
| DATE_BOUNDARY_AMBIGUOUS            |             3 |                   0 |

| Needs Review reason       | Current | Previous |
| ------------------------- | ------: | -------: |
| UNKNOWN_ROW               |     101 |       89 |
| AMBIGUOUS_PAYMENT_MARKER  |      28 |      141 |
| MISSING_ATTENDANT         |      43 |      212 |
| AMBIGUOUS_SERVICE_VALUE   |       5 |       17 |
| UNASSIGNED_FINANCIAL_NOTE |      36 |      110 |
| DATE_BOUNDARY_AMBIGUOUS   |       3 |        0 |
| MISSING_BUSINESS_DATE     |       1 |        0 |
| MISSING_STAFF             |       1 |        0 |
| OUT_OF_WEEK_DATE          |       1 |        0 |
| MISSING_TIME              |       0 |       11 |
| MISSING_CUSTOMER          |       0 |        3 |

The single current-week `MISSING_BUSINESS_DATE` reason belongs to a duty, not a visit. Three unfinished day headings remain ambiguous; they have no visits. The stale Thursday date is rejected as out of week. No visit crosses a day heading. Grouped continuation counts remain 12 and 27, with unresolved row and payment ambiguity still in Needs Review. The live workbook changed during inspection: the current Sunday date cell was initially blank, then showed October 4, 2026 on a later read; that section had no service visits at the final snapshot.

## Verification and rollback

- Live opt-in diagnostic and sanitized structural inspection: passed on both tabs with GET-only Sheets reads.
- Targeted Sheet tests: 50 passed; two opt-in live tests skipped in the normal run. The live diagnostic and structural inspection were run separately and passed.
- TypeScript, targeted ESLint, targeted Prettier formatting, `pnpm build`, and `git diff --check`: passed after the correction.
- Scope: no Sheet write method, Supabase mutation, API route, migration, credential, token, ADC JSON, CRM UI, production configuration, or unrelated subsystem change.
- Rollback after a stage commit: revert that commit on the stage branch. No external data or production state needs rollback.
