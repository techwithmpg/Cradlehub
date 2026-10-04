# Master Sheet Stage 1C-B — branch-evidence inspection gate

**Evidence label:** REPOSITORY-RECORDED WORKING EVIDENCE. **Target:** CradleHub Web. **Stage:** read-only inspection and decision evidence. **Branch:** `stage/master-sheet-readonly-projection`. **Accepted main:** `6a310021df66679d71daf753434e6c328e3181b4`. **Starting local/remote HEAD:** `9a624773739fde81bfbab6a76b4846406d13df59`. **Inspection date:** 2026-10-04, Asia/Singapore. This report is the sole deliverable; its commit SHA is in the final handoff.

## 1. Scope

**VERIFIED FACT:** The existing local, keyless ADC impersonation path made Google Sheets GET requests with the `spreadsheets.readonly` scope against `CRADLE MAINSHEETS`, limited to the `OCT.2-8, 2026` and `SEPT 25-OCT 1, 2026` values tabs plus workbook metadata for their title/merge structure. The opt-in live diagnostic passed; a temporary structural diagnostic was run and removed before commit. Neither diagnostic printed raw customer, staff, address, payment, or note values. No Sheet or Supabase write was made ([ADC provider](../../src/lib/integrations/google-sheets/sheet-adc-token-provider.ts), [reader](../../src/lib/integrations/google-sheets/sheet-reader.ts), [existing diagnostic](../../tests/lib/integrations/google-sheets/sheet-live-adc.test.ts)).

**VERIFIED FACT:** Stage 1C's [read-only projection contract](master-sheet-stage1c-projection-contract.md) remains the governing source-of-truth boundary: Sheet rows are external evidence, never canonical bookings, schedules, customers, dispatches, or financial records. This inspection did not implement a mapper or UI.

## 2. Repository branch model inspected

**VERIFIED FACT:** CRM context resolves a concrete `branchId` and `branchName` from authenticated staff or an owner-selected active branch; ordinary CRM staff rely on their assigned `staff.branch_id` ([CRM context](../../src/lib/queries/crm-context.ts#L134), [owner branch selector](../../src/lib/queries/front-desk-branch.ts#L10)). Branches are keyed by UUID `branches.id`; the active-branch query selects `id, name` ([branch query](../../src/lib/queries/front-desk-branch.ts#L8), [branch schema](../../supabase/migrations/20260429000001_core_tables.sql#L31)). CRM roles include owner, management, and front desk, with branch-scoped operation checks ([permissions](../../src/lib/auth/crm-permissions.ts#L60)). The currently selected owner CRM branch is a viewing context, not evidence of a Sheet row's origin.

**VERIFIED FACT — REPOSITORY EVIDENCE ONLY:** Historical seed SQL names `c1000000-0000-0000-0000-000000000001` as Main and `c1000000-0000-0000-0000-000000000002` as SM in a demo organization seed; an earlier seed calls the second ID “Branch 2” ([demo seed](../../supabase/migrations/20260430000002_demo_org_workflow_seed.sql#L34), [earlier seed](../../supabase/migrations/20260429000007_seed_data.sql#L77)). This supports the repository's intended Main/SM model but **does not verify current database names, IDs, active status, or production state**. No database was queried: the configured database target is UNKNOWN, which is a stop condition under repository rules. No existing Sheet-to-branch alias/mapping system was found in the inspected Sheet parser/types or CRM context ([Sheet types](../../src/lib/integrations/google-sheets/sheet-types.ts#L11), [parser header map](../../src/lib/integrations/google-sheets/sheet-parser.ts#L31)).

## 3. Workbook structures inspected

**VERIFIED FACT — LIVE SHEET EVIDENCE:** Both weekly tabs contain seven repeated operational headers and seven day sections. The first header is row 26 in each tab; the operational columns include B `TIME`, C `ATTENDANT`, D `CLIENT`, and F `SERVICE`. Column A is unheaded on the first header and carries weekday/date section boundaries plus nonempty values on many service rows. The current final read returned 913 rows, 111 grouped visits, and 15 duties; the previous read returned 978 rows, 400 visits, and 39 duties. The metadata read returned merge definitions (1,441 current; 1,623 previous), but no explicit branch-labeled merged heading was found. Header/section structures match the prior [Stage 1B date-boundary inspection](master-sheet-stage1b-live-adc-validation.md); the current workbook is mutable.

**VERIFIED FACT:** The parser recognizes a `LOCATION` or `ADDRESS` header if present, but neither tab's inspected operational headers supplied one. Therefore all 111/400 parsed visits in the final snapshot had empty `locationRawValue`, even though unheaded A contains place-like values on some service rows ([header aliases](../../src/lib/integrations/google-sheets/sheet-parser.ts#L31), [visit construction](../../src/lib/integrations/google-sheets/sheet-parser.ts#L360)). This is a read-model coverage limit relevant to a future Home Service reference; it is not a branch rule and no parser change was made.

## 4. Candidate branch signals

**VERIFIED FACT — LIVE SHEET EVIDENCE:** A sanitized scan of all formatted A:AZ cells in the two authorized tabs found **zero** explicit `MAIN SPA`, `MAIN BRANCH`, `SM SPA`, `SM BRANCH`, standalone `MAIN`/`SM`, `BRANCH`, `BRANCH NAME`, `BRANCH ID`, `OUTLET`, or `STORE` candidates, including embedded Main/SM branch phrases. No branch column, branch section heading, or row-level branch code was identified. The tabs are weekly date ranges, not branch-named tabs. Source row/section position and merge boundaries alone do not establish branch meaning.

**RECOMMENDATION:** Do not create a branch mapper from weekly tab, row range, selected CRM branch, service, therapist, payment, customer, or place name. An explicit, validated row/section marker or separately approved controlled mapping would be needed first.

## 5. Location versus branch analysis

**VERIFIED FACT — LIVE SHEET EVIDENCE:** Several place-name examples supplied for this gate appeared repeatedly in **column A of SERVICE rows** in both tabs; four additional matches occurred in previous-tab D cells. These observations indicate position and repeated use, not a verified meaning. Across _all_ SERVICE rows, A was nonempty on 66 of 124 current service lines (35 distinct case-folded values) and 184 of 427 previous service lines (65 distinct values). No A value matched an explicit Main/SM branch label. The D occurrences show that a place-like string can also be part of a client-field value, so text matching alone is unsafe.

**RECOMMENDATION:** Treat A and similar text as `LOCATION_UNRESOLVED` evidence unless an explicit workbook convention is documented and validated. Never convert a destination, subdivision, street, or customer-location string into a canonical branch ID.

## 6. Home Service evidence

**VERIFIED FACT — LIVE SHEET EVIDENCE:** The same place-like values recur in service-line context, which is consistent with a possible service destination but does not prove Home Service or branch identity. A scan found no explicit `HOME SERVICE`, `HOME VISIT`, or standalone `HS` marker in the inspected A:AZ formatted values. The existing parser's `locationRawValue` is empty for every visit in this snapshot, because A has no recognized location header.

**RECOMMENDATION:** Keep `HOME_SERVICE_EVIDENCE` separate from `BRANCH_EVIDENCE`. For these two tabs, classify the observed place-like text as `LOCATION_UNRESOLVED`; do not assign Home Service delivery type, dispatch, route, fuel, driver, tracking, or branch from it. If future work interprets A, first establish its semantics and handling of values embedded in D; that work is not authorized here.

## 7. Sanitized structural examples

**VERIFIED FACT — LIVE SHEET EVIDENCE:** The following are structural examples only; no cell contents beyond operational headers are reproduced.

| Tab      | Structure                                                                                                                     | What it demonstrates                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Current  | Row 26: operational header B `TIME`, C `ATTENDANT`, D `CLIENT`, F `SERVICE`; A is blank. Row 27 starts a day section.         | No first-header branch column or branch section label.                |
| Current  | Row 42: A `LOCATION_LIKE_REDACTED`; row classified `SERVICE`; inside a grouped visit.                                         | A place-like value is row-level service context, not proof of branch. |
| Current  | Day sections beginning rows 27, 159, 312, 486, 624, 741, 812: branch-candidate rows **none**.                                 | The repeated section boundary does not supply a branch label.         |
| Previous | Row 26: same operational column structure; first day section begins row 27.                                                   | Same weekly rather than branch-named pattern.                         |
| Previous | Row 62: A `LOCATION_LIKE_REDACTED`, row classified `SERVICE`; row 202 has a place-like match in D, also classified `SERVICE`. | Place-like tokens occur in more than one structural role.             |
| Previous | Day sections beginning rows 27, 156, 305, 487, 597, 716, 846: branch-candidate rows **none**.                                 | No observed section-level Main/SM authority.                          |

## 8. Contradiction testing

**VERIFIED FACT:** No positive branch rule was found to validate. Negative controls reject likely false rules: (1) A service-row place values occur in multiple day sections in both weekly tabs, while no explicit branch marker governs them; (2) some place-like values occur in D, the client column; (3) both tabs repeat the same operational structure and are titled by week; (4) the current tab grew from 912 rows/110 visits during this gate to 913 rows/111 visits at the final structural read; (5) owner branch selection and historical staff branch assignments are independent of workbook row provenance. These observations defeat “A means branch,” “tab means branch,” “current CRM branch means row branch,” and “staff home branch means visit branch.”

**VERIFIED FACT:** No explicit contradictory Main-versus-SM marker was observed, because no explicit branch marker was observed at all. `BRANCH_CONFLICT = 0` therefore means _no detected conflicting branch assertions_, not proof that the workbook contains only one branch or no mixed-branch visits.

## 9. Current-week visit classification

**VERIFIED FACT — LIVE SHEET SNAPSHOT:** `OCT.2-8, 2026`, final structural read: **111** SheetVisit records; `PROVEN_MAIN = 0`, `PROVEN_SM = 0`, `BRANCH_UNKNOWN = 111`, `BRANCH_CONFLICT = 0`. This is a diagnostic classification in memory, not a persisted field or proposed mapper. Earlier reads in this gate observed 110 visits and the Stage 1B report recorded 108; the workbook changed while being inspected.

## 10. Previous-week visit classification

**VERIFIED FACT — LIVE SHEET SNAPSHOT:** `SEPT 25-OCT 1, 2026`: **400** SheetVisit records; `PROVEN_MAIN = 0`, `PROVEN_SM = 0`, `BRANCH_UNKNOWN = 400`, `BRANCH_CONFLICT = 0`. These counts use the same strict evidence test as the current tab.

## 11. SheetDuty classification

**VERIFIED FACT — LIVE SHEET SNAPSHOT:** Current tab: **15** duties, all `BRANCH_UNKNOWN`, zero proven Main/SM and zero detected conflicts. Previous tab: **39** duties, all `BRANCH_UNKNOWN`, zero proven Main/SM and zero detected conflicts. Duty staff names and row proximity to service visits are not branch authority. The parser's `SheetDuty` contains no branch ID ([Sheet types](../../src/lib/integrations/google-sheets/sheet-types.ts#L58)).

## 12. Unknown and conflict cases

**VERIFIED FACT:** Every parsed visit and duty is unknown because neither a row nor its enclosing operational section has an explicit branch assertion. There are no detected `BRANCH_CONFLICT` cases, but the evidence is insufficient to rule out actual cross-branch activity. Source identity and content fingerprints identify Sheet position/content, not branch ([source identity](../../src/lib/integrations/google-sheets/sheet-source-identity.ts#L10)).

**RECOMMENDATION:** Preserve `BRANCH_UNKNOWN` as the only diagnostic branch result for these two snapshots. Future conflicting explicit assertions should become `BRANCH_CONFLICT`, never silently choose Main, SM, a staff home branch, or the active CRM branch.

## 13. Unknown-branch privacy and roles

**VERIFIED FACT:** Existing CRM roles can reach branch-scoped operational surfaces after authentication; owner branch selection chooses an active CRM context rather than proving the Sheet's branch ([CRM context](../../src/lib/queries/crm-context.ts#L134), [permissions](../../src/lib/auth/crm-permissions.ts#L60)). There is no current Sheet Review permission or authorized browser endpoint.

**RECOMMENDATION:** A future unknown-branch Review surface should be limited to verified owner/super-admin authority with an explicit server-side permission check. Ordinary branch front desk, manager, and branch operational users should receive neither row details nor an inference that all unknown records belong to their branch. Do not rely on a client-side hidden panel. Whether even aggregate counts are visible outside owner review needs an explicit privacy decision.

## 14. Performance observations

**VERIFIED FACT — LOCAL DIAGNOSTIC ONLY:** The final sequential structural inspection measured approximately 5.3 s for ADC/token acquisition, 2.0 s for workbook metadata GET, 0.7 s for current-tab values GET, 1.0 s for previous-tab values GET, 14 ms and 20 ms for local parsing, and 9.1 s end-to-end. The independent opt-in aggregate diagnostic passed on both tabs in about 7.5 s of test execution. These are single local observations affected by network/auth state and a changing workbook, not p50/p95, production latency, or a caching justification. No optimization or cache was added.

## 15. Primary conclusion

**VERIFIED FACT — `NO RELIABLE BRANCH EVIDENCE`:** In the two authorized live weekly tabs, no explicit branch column, row marker, section heading, tab name, or documented branch code safely maps a SheetVisit or SheetDuty to a canonical CradleHub branch. Place-like values and staff identity do not satisfy the evidence standard. The repository shows an intended Main/SM branch model, but live canonical database identities were not verified. Therefore no deterministic or partial branch assignment is supported for the observed visits/duties.

## 16. Proposed Stage 1D consequence

**RECOMMENDATION:** Begin any separately authorized Stage 1D as **Master Sheet Review only** for verified owner/super-admin visibility, with all records labeled branch unknown, external, and read-only. Today, Bookings, Schedule, Home Service, Customers, and Cash Flow operational projection remains blocked. Keep Sheet financial evidence outside canonical totals and every Sheet action denied under Stage 1C. A future branch rule requires new explicit workbook evidence or a controlled, owner-approved mapping mechanism with validation; this gate does not create one.

**PROJECT DECISION REQUIRED:** Owner must decide whether to authorize a Review-only Stage 1D, who may see unknown-branch row details/aggregates, what branch evidence or controlled mapping would later unblock operational panels, and whether the unheaded A location semantics merit a separate narrow read-model inspection. None of those decisions is made by this report.

## 17. Limitations

**VERIFIED FACT:** This inspection covers only two named weekly tabs and formatted A:AZ values plus workbook metadata relevant to those tabs. It scanned named Main/SM branch terms, branch-column labels, Home Service markers, section boundaries, merge metadata, and place-like structural positions; it did not infer meaning from colors, formulas, undocumented conventions, private notes, or other tabs. Absence of a detected marker is limited to the observed snapshots. The workbook changed during inspection, and current counts may change again. The database target is UNKNOWN, so canonical branch names/IDs are repository seed evidence only. No runtime CRM authorization test or production behavior claim was made.

## 18. Rollback and safety

**VERIFIED FACT:** Only this documentation report is intended for commit. The temporary diagnostic was removed. No application code, CRM UI, API route, canonical query, permission, parser, cache, migration, Supabase record, or Google Sheet was changed. No merge, deployment, or production operation occurred. Rollback is a normal revert of this report's stage-branch commit; no external data rollback is required.
