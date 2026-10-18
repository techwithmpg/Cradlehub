# System Management UI — inspection and Services checkpoint

**Authorization:** Owner brief attached to the 2026-10-18 task, six approved PNGs, Web controlled stabilization. This checkpoint implements Services & Providers first. The other five modules are inspection only.

**Branch:** `stage/system-management-ui-20261018`  
**Accepted main:** `cd108714c9f1da2d493825b9b35a680888a34ef1`  
**Unmerged setup foundation:** `d7915b2c62dde10e07cf929e5e2c04b4293d4d7d`  
**Services implementation commit:** `8be10a6cdb49f8234942c7df0cc17995f1cb92bf`

The implementation branch descends from the setup foundation, whose merge base with accepted `origin/main` is the exact accepted main SHA above. `main` was not changed. Staff UI work on `origin/stage/staff-management-ui-20261017` was inspected but not merged or overwritten.

## Reusable component and contract inventory

| Function | Existing component / contract | Current location | Reuse strategy |
| --- | --- | --- | --- |
| Staff profile editing | `CrmEditStaffProfileModal`, `StaffEditForm` | `src/components/features/crm/staff/`, `src/components/features/staff/` | Reuse in Staff & Access after reconciling the unmerged Staff UI branch. |
| Staff invitations and onboarding review | Owner invitation route, `StaffApprovalWorkspace` | `src/app/(dashboard)/owner/staff/invite/`, `src/components/features/staff/` | Preserve existing role gates and review actions. |
| Staff service capabilities | `StaffServiceEditorSheet`, CRM service row adapter | `src/components/features/staff/`, `src/components/features/crm/staff/` | Reuse the existing editor. |
| Provider assignment | `ProviderAssignmentSheet`, `assignProviderToServiceAction`, `removeProviderFromServiceAction` | `src/components/features/crm/services/`, `src/app/(dashboard)/crm/services/actions.ts` | Reused in the selected service panel. Server action remains authoritative for branch and staff eligibility. |
| Service editing and visibility | `SelectedServiceEditorRail`, `ServiceEditorModal`, existing delivery, Home Service, visibility, and catalog actions | `src/components/features/crm/services/`, `src/components/features/services/` | Reused branch settings and the Owner Add Service modal. |
| Rooms and resources | `CrmSpacesTab`, `CrmSpaceDetailPanel`, `SpacesRulesWorkspace` | `src/components/features/spaces-rules/` | Inspect supported room actions and data before the Rooms pass. |
| Booking rules | `BookingRulesTab`, `updateBranchBookingRulesAction`, `RuleImpactPreview` | `src/components/features/manager-settings/`, `src/app/(dashboard)/owner/branches/actions.ts`, `src/components/features/spaces-rules/` | Reuse the validated form and save contract. |
| System health | `getCrmSetupHealth`, `SetupHealthContent` | `src/lib/queries/crm-setup.ts`, `src/components/features/setup-center/` | Reuse live diagnostics and navigation; mark unverifiable checks accordingly. |
| Closing operations | `DayCloseTab`, `CloseDrawerModal`, `ReconciliationForm`, reconciliation actions | `src/components/features/cash-flow/`, `src/app/(dashboard)/crm/reconciliation/` | Preserve existing cash-session and reconciliation contracts; do not invent a financial finalization action. |

## Services & Providers checkpoint

**Route and purpose:** `/crm/services` is the focused branch service catalog and provider coverage workspace. Legacy `/crm/setup?tab=services` forwards to it. Existing `/crm/services?tab=providers` and readiness links forward to their supporting setup views. The CRM System Management navigation points to the focused route.

**UI changes:** A service table, summary metrics, search and filters, and selected service panel now present provider coverage and branch settings together. The panel reuses `ProviderAssignmentSheet` for assignment and `SelectedServiceEditorRail` for configuration. The table retains its direct Home Service switch. Owner-only Add Service reuses `ServiceEditorModal`; Front Desk sees no unsupported Add control. The service route fetches its own data instead of loading hidden health and room modules.

**Functional preservation:** Existing provider eligibility, branch scoping, assignment actions, delivery and visibility actions, Home Service toggle, and Owner catalog save action were not replaced. The selected panel labels its positive state **Basic setup complete** because schedules, room availability, and booking rules are not included in that service-level calculation. No new backend, policy, migration, or financial action was added.

**Permissions:** `getFrontDeskContext` gates the route with `canManageCrmSetup`; Owner Add Service is rendered for the Owner role and its existing server action remains authoritative. Provider assignment and Home Service actions retain their existing server authorization. No UI control is treated as an authorization boundary.

**Validation:** `pnpm type-check` passed. Targeted ESLint passed. The three service component suites passed (6 tests). `pnpm build` passed after the dedicated route change. A local browser session displaying the Front Desk workspace rendered the service view at desktop (1440×1000) and mobile (390×844); service selection, provider-sheet opening for the selected record, sheet closing, and settings-panel display were observed without submitting a mutation. Screenshots were captured in the task's browser tool output, not exported as repository artifacts. No production behavior is claimed.

**Verification limit:** `.env.local` has a configured non-local Supabase URL, but repository evidence does not classify it as TEST, STAGING, or PRODUCTION. Target classification is **UNKNOWN**. The active repository rules make that a stop condition for mutation verification. Save, failure/retry, and permission-denial behavior remain unverified in an isolated LOCAL/TEST browser session. Owner branch behavior and the final six-module visual comparison remain unverified.

**Review verdict:** **CORRECTION REQUIRED** for final acceptance. Services is code-complete for this checkpoint but not release-verified. Staff & Access, Rooms & Resources, Booking Rules, System Health, and Close Day have not been implemented on this branch. The implementation order requires the Services verification checkpoint before those passes.

**Rollback:** Revert implementation commit `8be10a6cdb49f8234942c7df0cc17995f1cb92bf` on this branch. The unmerged setup foundation remains intact. No merge, push, deployment, or database mutation was performed.

**Next permitted action:** Classify and connect an isolated LOCAL or TEST database target with safe fixtures, complete action and permission checks, perform independent review of this checkpoint, then continue the next module on this branch. No accepted merge or production action is authorized by this report.
