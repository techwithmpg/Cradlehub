# Master Sheet Stage 1E — implementation handoff

**Evidence label:** REPOSITORY-RECORDED WORKING EVIDENCE
**Target:** CradleHub Web
**Stage:** Master Sheet Stage 1E — Native CRM Projection
**Branch:** `stage/master-sheet-readonly-projection`
**Accepted `origin/main`:** `6a310021df66679d71daf753434e6c328e3181b4`
**Planning SHA:** `058f58fada20a1a4be5ed9f4bdca8ee35fdef103`
**Implementation start SHA:** `058f58fada20a1a4be5ed9f4bdca8ee35fdef103`
**Implementation commit:** `2bd78186fbbe8ee6b1f10a04a09941235bd003ac`

## Scope and architecture

The implementation adds an independently loaded, GET-only native reference resource. A server-only `WorkbookSource` boundary maps the approved CRADLE MAINSHEETS workbook provisionally to the uniquely resolved active Main branch record. The parser remains branch-agnostic; unknown, disabled, duplicate, or inconsistent mappings fail closed.

Bookings receives a distinct `SheetBookingReference` presentation type. It is interleaved by supported time, keeps missing time as `Time unknown`, shows `MASTER SHEET` and `READ ONLY`, and opens only a read-only source detail panel. It cannot enter the canonical booking selection or command path. Canonical filters explicitly exclude Sheet references and say so.

Cash Flow receives a separate `SheetTransactionReference` section after the canonical Ledger. It shows the evidence warning, preserves ambiguous markers, and never enters `CashFlowWorkspaceData`, `LedgerRecordItem[]`, totals, drawer, reconciliation, or payment actions.

Authorization runs before token selection and before any Sheet read. The branch is resolved server-side; client branch inputs are not trusted. The browser DTO omits credentials, raw Sheet rows, and workbook identity.

## Verification

Focused command:

```text
pnpm exec vitest run --exclude '**/.claude/**' tests/lib/integrations/google-sheets tests/components/crm/master-sheet-review.test.tsx tests/components/bookings/bookings-desktop-list.test.tsx tests/components/bookings/sheet-booking-reference-row.test.tsx tests/components/cash-flow/sheet-payment-evidence.test.tsx tests/lib/cash-flow/cash-flow-ui.test.tsx tests/lib/cash-flow/cash-flow-page-tabs.test.tsx tests/lib/cash-flow/cash-flow-mixed-read-model.test.ts tests/lib/auth/front-desk-role-unification.test.ts
```

Result: **21 files passed, 2 skipped; 185 passed, 2 skipped.** The Cash Flow isolation test covers Sheet available, available-empty, and unavailable states and asserts identical canonical Ledger output.

Additional gates:

- `pnpm type-check` — PASS
- targeted ESLint — PASS
- targeted Prettier check — PASS
- `pnpm build` — PASS (`next build`, Next.js 16.2.4)
- `git diff --check` — PASS (line-ending normalization warnings only)

A repository-wide Vitest invocation was not used as a gate because the repository command also collected a separate `.claude/worktrees` checkout and reported unrelated baseline failures. The focused command excludes that checkout.

## Read-only browser QA

The authorized authenticated local browser session was Front Desk and the local app was PRODUCTION-backed according to the existing environment record. No CRM or financial mutation was submitted.

Bookings visibly retained the canonical booking and loaded Master Sheet references in the same workspace. The source presentation showed `MASTER SHEET`, `READ ONLY`, provisional Main Branch wording, search narrowing, source filtering, and a read-only detail panel without a canonical command pane. Canonical-only filtering displayed an explicit Sheet-excluded state.

Cash Flow visibly loaded the canonical Ledger and the separate Master Sheet payment evidence section with the evidence-only warning and read-only badges. Canonical Ledger KPI/output remained unchanged in the browser observation.

Sanitized single-sample local timing observations (development server and browser-tool overhead included): canonical Bookings shell about 2.9 s; Sheet reference readiness about 13.2 s; canonical Cash Flow about 8.4 s with evidence visible in the same observed page. These are not p50/p95 measurements.

Responsive sizes **390×844, 430×932, tablet ~768, and desktop ~1440 are NOT VERIFIED**. The browser viewport capability accepted overrides but the effective page remained 1280×720, so no mobile/tablet visual claim is made. Owner, unauthorized-role, wrong-branch, and browser-simulated Google-unavailable sessions were also not available; authorization and failure isolation are covered by focused tests.

## Mutation and release evidence

No Supabase writes, Google Sheet writes, Google IAM changes, Vercel changes, migrations, merge, or deployment were performed. No canonical database or Sheet data was created or changed.

Rollback is the implementation commit recorded below; it requires no database or Sheet-data reversal. The next permitted action is independent review against `origin/main`, the Stage 1E contract, the diff, tests, browser evidence, authorization boundaries, and financial isolation. Merge, deployment, canonicalization, import, and a later stage remain unauthorized.
