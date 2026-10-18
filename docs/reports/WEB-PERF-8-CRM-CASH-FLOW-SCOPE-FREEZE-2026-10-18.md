# CradleHub Web — PERF-8 CRM Cash Flow Scope Freeze

**Date:** 2026-10-18  
**Target:** CradleHub Web — CRM Cash Flow only  
**Program:** Web CONTROLLED STABILIZATION  
**Accepted Base / main:** `0c8455dfee87441970284175c0dd7b4c19fbb327`  
**Planning Branch:** `stage/web-perf-8-cash-flow-scope-freeze`  
**Status:** INSPECTION COMPLETE — SCOPE FROZEN — IMPLEMENTATION NOT AUTHORIZED

---

## A. Why PERF-8 is CRM Cash Flow only

The accepted performance roadmap places Cash Flow after CRM Staff.

PERF-8 targets only:

`/crm/cash-flow`

Owner Cash Flow reuses the same shared `CashFlowWorkspace`, but Owner retention remains a separate later program because Owner operational branch scope and destructive branch/date remount behavior have different safety requirements.

PERF-8 therefore does **not** activate or redesign Owner Cash Flow.

---

## B. Current-system truth

### Current retention state

`/crm/cash-flow` is not registered in `workspace-retention-policy.ts`.

Every normal navigation away from CRM Cash Flow unmounts the workspace and a return performs a cold server read.

### Current client refresh behavior

`CashFlowWorkspace` currently uses `router.refresh()` for:

1. manual Refresh;
2. successful open-cash-drawer;
3. successful handover when not redirecting to Today;
4. successful cash-session close;
5. successful financial-entry recording.

This re-runs the entire Server Component Cash Flow read rather than reconciling a retained module.

### Current tab behavior

The following tabs already switch locally inside the mounted workspace:

- Today
- Ledger
- Day Close
- History

These tab switches do not require separate server navigation during an already-mounted workspace.

Ledger search/filter/page state is client-local.

This working behavior must be preserved.

---

## C. Canonical Cash Flow read model

The current Cash Flow route resolves server branch/date context and then loads one aggregate `CashFlowWorkspaceData` snapshot through:

`getCashFlowData(branchId, branchName, businessDate, filters)`

The aggregate contains data used by all four tabs and financial-entry dialogs.

### Canonical financial sources currently consumed

The loader reads combinations of:

- `financial_accounts`
- `financial_expense_categories`
- branch `staff`
- `financial_transactions`
- `financial_account_movements`
- `cash_sessions`
- `bookings`
- `booking_orders`
- `order_payable_items`
- `v_booking_order_financial_summaries`
- `daily_cash_reconciliations`

It also derives:

- Today KPIs;
- payment mix;
- receipt/inflow/outflow totals;
- operational expense totals;
- drawer expected cash;
- outstanding booking/order balances;
- payable order options;
- ledger rows;
- day-close/reconciliation summary;
- history/audit presentation data.

### Required-data fail-closed behavior

If required financial tables/views are unavailable, `CashFlowRequiredDataError` causes the page to render an explicit unavailable state instead of a plausible zero-activity financial screen.

This fail-closed behavior is mandatory and must remain unchanged.

---

## D. Financial mutation ownership

PERF-8 must preserve server authority for all financial writes.

Current mutation paths include:

- `recordOrderPaymentAction`
- `recordLegacyBookingPaymentAction`
- `recordExpenseAction`
- `recordTipAction`
- `recordOtherEntryAction`
- `openCashSessionAction`
- `closeCashSessionAction`
- `handoverCashSessionAction`

### Atomic / idempotent boundaries

Current actions use server-side checks and atomic database/RPC contracts including combinations of:

- authenticated Supabase server session;
- authoritative booking/order status checks;
- order payment writer;
- idempotency keys;
- `post_expense_atomic`;
- `post_tip_atomic`;
- `post_misc_income_atomic`;
- `post_cash_adjustment_atomic`;
- `post_transfer_atomic`;
- `open_cash_session_atomic`;
- `close_cash_session_atomic`;
- `handover_cash_session_atomic`.

Cash-session close/handover database contracts include locking, expected-cash calculation, variance, custody, and replay behavior.

PERF-8 must not move, duplicate, approximate, or bypass these server-authoritative operations.

---

## E. Authorization boundaries that must remain unchanged

1. Authentication stays server-side for every financial write.
2. Cash payment eligibility remains server-authoritative.
3. Closed/cancelled/expired/no-show booking protection remains unchanged.
4. Legacy booking and booking-order payment sources remain distinct.
5. Physical cash operations must still require an open drawer/session where required.
6. Expense receipt storage path remains server-generated.
7. Expense branch/account validation remains server-authoritative.
8. Cash-session close/handover authority remains inside the existing atomic RPC/security contract.
9. Client-supplied totals, balances, expected cash, variance, or reconciliation status must never become authoritative.
10. Service-role credentials remain server-only.
11. No RLS relaxation is authorized.
12. Desktop/local cache is not financial authority.

---

## F. Current mutation side effects

Successful financial actions currently revalidate one or more downstream surfaces.

Examples include:

- `/crm/cash-flow`
- operational booking surfaces
- `/crm/reconciliation`
- `/owner/cash-flow`

These side effects exist because financial state is consumed outside the CRM Cash Flow page.

PERF-8 may only remove the direct CRM Cash Flow self-refresh path if retained-generation reconciliation becomes the proven replacement.

Do **not** remove:

- booking surface revalidation;
- reconciliation revalidation;
- Owner Cash Flow revalidation;
- other proven cross-module financial side effects.

No broad revalidation cleanup is authorized.

---

## G. Owner Cash Flow relationship

Owner Cash Flow:

- resolves an authorized operational branch;
- resolves a selected business date;
- calls the same `getCashFlowData`;
- renders the shared `CashFlowWorkspace`;
- currently forces a remount with:
  `key={`${branch.id}:${selectedDate}`}`.

PERF-8 does not change this Owner behavior.

Owner Cash Flow conversion remains part of the later Owner operational performance program.

Any shared component change made by PERF-8 must preserve current Owner behavior unless a separately authorized Owner change is explicitly required.

---

## H. PERF-8 frozen implementation scope

PERF-8 is limited to **CRM Cash Flow retained read lifecycle and authoritative reconciliation**.

Authorized implementation goals after owner approval:

1. Register a retained CRM module:
   - module ID: `crm-cash-flow`
   - route: `/crm/cash-flow`
   - branch-scoped by the existing retained CRM provider
   - cost: high
   - conservative stale classification documented

2. Wrap CRM Cash Flow in the accepted retained workspace lifecycle.

3. Preserve the existing aggregate `CashFlowWorkspaceData` contract.

4. Create one shared authoritative server loader used by:
   - initial Server Component render;
   - retained client reconciliation.

5. Add a CRM Cash Flow refresh server action that derives:
   - authenticated user;
   - active Front Desk branch;
   - branch name;
   - business date / permitted date selection;
   server-side.

6. Use the accepted generation-aware SWR adapter:
   `useGenerationAwareWorkspaceSWR("crm-cash-flow", ...)`

7. Initial SSR fallback must produce zero duplicate immediate canonical fetch.

8. Hidden Cash Flow behavior:
   - invalidation marks dirty;
   - zero canonical reads while hidden;
   - focus/reconnect while hidden performs zero Cash Flow reads;
   - retained content reveals immediately on return;
   - reconciliation occurs only while active.

9. Stale response rejection must preserve newer authoritative generations.

10. Manual Refresh must become canonical module reconciliation rather than broad `router.refresh()`.

11. Successful financial mutations may:
   - close/update their existing modal UI;
   - invalidate `crm-cash-flow` exactly once after confirmed server success;
   - reconcile the authoritative Cash Flow snapshot in the background.

12. Failed mutations must:
   - keep existing error feedback;
   - perform zero Cash Flow invalidation;
   - perform zero optimistic financial-total changes.

13. Once retained invalidation is proven, remove only the redundant direct self-route:
   `revalidatePath("/crm/cash-flow")`
   from mutation paths where it duplicates the retained CRM Cash Flow reconciliation.

14. Preserve all proven downstream financial side effects, including booking, reconciliation, and Owner Cash Flow revalidation.

15. Preserve existing client-local interaction state where safe:
   - active Cash Flow tab;
   - Ledger search/filter/page state;
   - open dialog state where mutation is not in flight;
   - selected target order;
   - financial entry mode.

16. Preserve handover deep-link behavior:
   - valid incoming Staff review flow;
   - successful review handover redirect to Today where currently required.

17. Add focused tests for:
   - zero duplicate initial fetch;
   - hidden zero-read behavior;
   - dirty/stale active reconciliation;
   - stale response rejection;
   - manual refresh canonical revalidation;
   - confirmed financial mutation = exactly one `crm-cash-flow` invalidation;
   - failed financial mutation = zero invalidation;
   - no optimistic money/balance patch;
   - direct CRM Cash Flow self-route revalidation removed only where generation reconciliation replaces it;
   - downstream revalidations preserved;
   - branch/date/server authority;
   - required-data fail-closed behavior;
   - Owner Cash Flow shared-component compatibility.

---

## I. Financial UI rule for PERF-8

**No optimistic financial truth.**

The client must not fabricate or estimate post-mutation values for:

- cash balance;
- expected drawer cash;
- counted cash;
- variance;
- total inflow;
- total outflow;
- net flow;
- payment state;
- amount paid;
- remaining balance;
- reconciliation status;
- day-close status;
- ledger records.

After a successful write:

1. acknowledge success;
2. preserve safe local dialog/interaction feedback;
3. mark `crm-cash-flow` dirty;
4. fetch canonical server truth;
5. replace displayed financial state only from that authoritative response.

This rule is stricter than ordinary Staff UI patching.

---

## J. Explicitly NOT authorized in PERF-8

- database schema changes;
- migrations;
- migration replay/repair;
- RLS changes;
- financial RPC rewrites;
- payment writer redesign;
- cash-session contract redesign;
- reconciliation business-rule redesign;
- new financial calculation logic;
- new accounting features;
- changing payment eligibility rules;
- changing cash-drawer requirements;
- optimistic financial totals;
- local/offline financial authority;
- Owner retention activation;
- Owner Cash Flow branch/date redesign;
- per-tab financial query decomposition;
- new global financial event architecture;
- Cash Flow UI redesign;
- Setup optimization;
- Owner operational conversions;
- loading/dialog prewarming;
- PERF-9+.

---

## K. Existing test families that form part of the safety baseline

PERF-8 verification must retain coverage from existing Cash Flow suites including:

- payment safety / closed-booking protection;
- mixed read model;
- Cash Flow page/tab behavior;
- Cash Flow UI;
- cash-payment session guards;
- cash-session close/handover;
- cash-session contracts;
- expense receipt correction;
- database reconciliation contracts;
- cash-operation integrity;
- financial foundation contracts;
- payment writer contracts;
- order payment eligibility;
- reconciliation actions/status;
- owner Cash Flow page compatibility.

Tests alone do not authorize merge.

---

## L. Performance evidence classification

### VERIFIED REPOSITORY FACT

- CRM Cash Flow is currently unretained.
- The workspace uses broad `router.refresh()` for manual and successful financial-operation refreshes.
- All four Cash Flow tabs are already client-local inside the mounted workspace.
- Ledger filtering/pagination is client-local.
- Cash Flow reads are aggregated through `getCashFlowData`.
- Financial writes are server-authoritative and include atomic/idempotent contracts.
- Cash Flow data is shared with Owner Cash Flow.
- Owner Cash Flow has separate branch/date/remount behavior.

### RECOMMENDATION

Convert CRM Cash Flow to retained/generation-aware aggregate reconciliation first.

Do not split financial reads or introduce optimistic financial calculations in this checkpoint.

### PROJECT DECISION — PENDING OWNER APPROVAL

Implement the frozen PERF-8 scope above from accepted main.

No executable implementation is authorized by this document.

---

## M. Rollback / safety

This planning branch is documentation-only.

No executable code, migration, database, RLS, financial record, cash session, payment, receipt, reconciliation, or production state is changed.

Future PERF-8 implementation should remain Web-code-only.

If implementation reveals a requirement to change:

- financial schema;
- financial RPCs;
- payment writer contracts;
- cash-session semantics;
- reconciliation formulas;
- RLS;
- authorization;

**STOP — NEW AUTHORIZATION REQUIRED.**

---

## N. Gate

**SCOPE FROZEN — STOP FOR OWNER IMPLEMENTATION AUTHORIZATION**

Do not begin Owner operational conversion.

Do not begin loading/dialog prewarming.

Do not begin PERF-9.
