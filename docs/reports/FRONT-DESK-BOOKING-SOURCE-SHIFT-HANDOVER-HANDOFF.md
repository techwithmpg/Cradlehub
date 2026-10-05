# Front Desk booking source and handover refinement handoff

**Result: PASS — REPOSITORY-RECORDED WORKING EVIDENCE**

## Authorization and baseline

- Target: CradleHub Web, controlled stabilization refinement authorized by the owner on 2026-10-06.
- Source branch: `stage/web-release-integration` at `4c55519ee5bb16ca000a92f35b04671911743f7a`.
- Implementation branch: `fix/front-desk-booking-source-shift-handover`.
- Start SHA: `4c55519ee5bb16ca000a92f35b04671911743f7a`.
- Implementation commit: `0be3863ebffa7075f959e852b01c39c5af0923e7`.
- Accepted `origin/main` when fetched: `6a310021df66679d71daf753434e6c328e3181b4`; it is an ancestor of the frozen candidate. The separate Cash Flow correction `eca8cff0a3c70686cbc63a4994d84491181ce649` was inspected for ancestry and left out of this branch.

## Scope and decisions

- CRM Bookings defaults to **CradleHub**. A compact source switch selects either canonical bookings or external Master Sheet references. Canonical workflow counts and actions remain in CradleHub mode; Sheet mode preserves the existing read-only detail and badges, with canonical action filters hidden. The switch preserves date, search, and branch while clearing operational filters.
- Both sources use presentation-only descending service time ordering. Canonical ties use creation time then booking ID; Sheet ties use normalized `sortMinute` then source key. No Google Sheet write or booking mutation was added.
- Front Desk duty context resolves the authenticated CRM staff member, same-branch staff record, and resolved schedule window at branch-local time. An unknown duty stays neutral. Owner branch viewers receive no operator prompt.
- A reminder requires a same-branch open cash session under another custodian and an active resolved CRM duty window. **Later** dismisses only the local notice. **Review Handover** opens the existing Cash Flow review and modal; the existing `handoverCashSessionAction` and RPC remain the sole transfer path. A return success notice requires an open session under the authenticated staff member and the matching latest recorded handover ID.
- No attendance, session, cash-accounting, payment, booking, Master Sheet, migration, IAM, or deployment mutation was added by this refinement. The standalone Cash Flow correction remains separate.

## Files changed

- CRM Bookings source and presentation: `src/components/features/bookings/{booking-source-switch,bookings-desktop-list,bookings-desktop-workspace,bookings-list-toolbar,bookings-workspace,crm-bookings-view}.tsx`, `src/lib/bookings/{booking-recency,booking-source}.ts`.
- Duty and handover presentation: `src/app/(dashboard)/crm/{today,cash-flow}/page.tsx`, `src/components/features/crm/today/{cradle-flow-dashboard,crm-today-shell,front-desk-duty-banner}.tsx`, `src/components/features/cash-flow/{cash-flow-workspace,handover-drawer-modal}.tsx`, `src/lib/queries/{front-desk-duty,front-desk-duty-contract}.ts`.
- Focused tests: `src/lib/bookings/{booking-recency,booking-source}.test.ts`, `src/lib/queries/front-desk-duty-contract.test.ts`, `tests/components/bookings/{booking-source-switch,sheet-booking-reference-row}.test.tsx`, `tests/components/crm/front-desk-duty-banner.test.tsx`.

## Verification

- Combined targeted regression: **27 files, 213 tests passed**. This covers booking presentation, Sheet projection/read-only behavior, schedule resolution, attendance greetings, cash session and handover contracts, and Owner branch context.
- `pnpm type-check`: pass.
- Targeted ESLint: pass.
- Targeted Prettier: pass.
- `pnpm build`: pass, including Next.js TypeScript and static-page generation.
- `git diff --check`: pass.
- Browser/runtime against a positively classified nonproduction environment: **NOT VERIFIED**. The available local app configuration points to **PRODUCTION**; this task performed no production runtime QA or data mutation. Production behavior: **NOT VERIFIED**.
- Local Node version was 25.2.0 while `package.json` declares Node 24; all listed repository gates passed in this environment.

## Handoff

Independent review of this branch is the next permitted action. Merging into the release candidate or `main`, deploying, and changing production data are not authorized by this task. The final branch and remote SHA are reported in the owner-facing completion message after push.
