# Remaining CRM Modules Health Report

Generated: 2026-07-11 03:46:12
Project root: E:\cradlehub
Modules: dispatch, today, customers, staff, setup, reconciliation

This is a static heuristic audit. It does not replace authenticated browser QA.

## Executive summary

| Module | Risk | Files | Lines | Client files | Shell | Toolbar | Loading | Empty | Error |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| dispatch | HIGH | 30 | 5047 | 6 | No | No | Yes | Yes | Yes |
| today | HIGH | 62 | 8741 | 42 | No | No | Yes | Yes | Yes |
| customers | MEDIUM | 23 | 2785 | 13 | No | No | Yes | Yes | Yes |
| staff | HIGH | 278 | 46052 | 107 | No | No | Yes | Yes | Yes |
| setup | HIGH | 33 | 4477 | 9 | No | No | Yes | Yes | Yes |
| reconciliation | MEDIUM | 4 | 736 | 1 | Yes | No | Yes | No | Yes |

## dispatch

Risk: **HIGH**

### Shared platform

- Operational shell: No
- ToolbarShell: No
- WorkspaceSection: No
- WorkspaceNotice: No
- ContextChip: No
- Loading state detected: Yes
- Empty state detected: Yes
- Error state detected: Yes

### Static indicators

- Files: 30
- Total lines: 5047
- Client component files: 6
- Hardcoded hex colors: 80
- Inline style objects: 64
- Tailwind arbitrary-value indicators: 465
- ARIA attributes: 8
- Label references: 0
- Buttons: 17
- Inputs/selects: 2
- Dialog references: 0
- Table references: 1
- Realtime references: 0
- useEffect references: 1
- memo/useMemo references: 8
- Dynamic import references: 0

### Large files

- src/components/features/dispatch/home-service-dispatch-modal.tsx - 866 lines
- src/components/features/dispatch/dispatch-live-map-tab.tsx - 620 lines

### Recommended Codex focus

- Evaluate migration to the certified operational shell.
- Audit local search/filter controls against ToolbarShell, ToolbarSearch, and ToolbarSelect.
- Audit repeated card wrappers against WorkspaceSection.
- Review hardcoded colors for theme-token drift.
- Review inline styles for duplicate layout rules.
- Document responsibilities of large files before extraction.
- Manually inspect form fields for labels.

## today

Risk: **HIGH**

### Shared platform

- Operational shell: No
- ToolbarShell: No
- WorkspaceSection: No
- WorkspaceNotice: No
- ContextChip: No
- Loading state detected: Yes
- Empty state detected: Yes
- Error state detected: Yes

### Static indicators

- Files: 62
- Total lines: 8741
- Client component files: 42
- Hardcoded hex colors: 142
- Inline style objects: 535
- Tailwind arbitrary-value indicators: 141
- ARIA attributes: 7
- Label references: 1
- Buttons: 17
- Inputs/selects: 1
- Dialog references: 6
- Table references: 0
- Realtime references: 3
- useEffect references: 4
- memo/useMemo references: 5
- Dynamic import references: 0

### Large files

- src/components/features/crm/today/work-queue-panel.tsx - 641 lines

### Recommended Codex focus

- Evaluate migration to the certified operational shell.
- Audit local search/filter controls against ToolbarShell, ToolbarSearch, and ToolbarSelect.
- Audit repeated card wrappers against WorkspaceSection.
- Review hardcoded colors for theme-token drift.
- Review inline styles for duplicate layout rules.
- Document responsibilities of large files before extraction.

## customers

Risk: **MEDIUM**

### Shared platform

- Operational shell: No
- ToolbarShell: No
- WorkspaceSection: No
- WorkspaceNotice: Yes
- ContextChip: No
- Loading state detected: Yes
- Empty state detected: Yes
- Error state detected: Yes

### Static indicators

- Files: 23
- Total lines: 2785
- Client component files: 13
- Hardcoded hex colors: 10
- Inline style objects: 39
- Tailwind arbitrary-value indicators: 193
- ARIA attributes: 0
- Label references: 6
- Buttons: 15
- Inputs/selects: 18
- Dialog references: 0
- Table references: 4
- Realtime references: 0
- useEffect references: 2
- memo/useMemo references: 0
- Dynamic import references: 0

### Large files

- None detected at 600+ lines.

### Recommended Codex focus

- Evaluate migration to the certified operational shell.
- Audit local search/filter controls against ToolbarShell, ToolbarSearch, and ToolbarSelect.
- Audit repeated card wrappers against WorkspaceSection.
- Review hardcoded colors for theme-token drift.
- Review inline styles for duplicate layout rules.
- Manually inspect icon-only controls for accessible names.

## staff

Risk: **HIGH**

### Shared platform

- Operational shell: No
- ToolbarShell: No
- WorkspaceSection: No
- WorkspaceNotice: No
- ContextChip: No
- Loading state detected: Yes
- Empty state detected: Yes
- Error state detected: Yes

### Static indicators

- Files: 278
- Total lines: 46052
- Client component files: 107
- Hardcoded hex colors: 413
- Inline style objects: 1614
- Tailwind arbitrary-value indicators: 2097
- ARIA attributes: 129
- Label references: 95
- Buttons: 160
- Inputs/selects: 96
- Dialog references: 4
- Table references: 3
- Realtime references: 3
- useEffect references: 13
- memo/useMemo references: 65
- Dynamic import references: 4

### Large files

- src/components/features/staff/staff-approval-workspace.tsx - 1247 lines
- src/app/(dashboard)/staff-portal/actions.ts - 1208 lines
- src/components/features/staff-schedule/manual-schedule-import.tsx - 1106 lines
- src/components/features/staff-schedule/staff-schedule-calendar-modal.tsx - 1036 lines
- src/app/staff-onboarding/onboarding-form.tsx - 940 lines
- src/components/features/staff-schedule/staff-schedule-card.tsx - 904 lines
- src/components/features/staff-portal/mobile/staff-mobile-home.tsx - 822 lines
- src/components/features/staff-portal/my-week-page.module.css - 754 lines
- src/app/(dashboard)/crm/staff-availability/actions.ts - 707 lines
- src/components/features/staff-schedule/individual-schedule-editor.tsx - 664 lines
- src/lib/staff/branch-correction.ts - 663 lines

### Recommended Codex focus

- Evaluate migration to the certified operational shell.
- Audit local search/filter controls against ToolbarShell, ToolbarSearch, and ToolbarSelect.
- Audit repeated card wrappers against WorkspaceSection.
- Review hardcoded colors for theme-token drift.
- Review inline styles for duplicate layout rules.
- Document responsibilities of large files before extraction.

## setup

Risk: **HIGH**

### Shared platform

- Operational shell: No
- ToolbarShell: No
- WorkspaceSection: No
- WorkspaceNotice: No
- ContextChip: No
- Loading state detected: Yes
- Empty state detected: Yes
- Error state detected: Yes

### Static indicators

- Files: 33
- Total lines: 4477
- Client component files: 9
- Hardcoded hex colors: 35
- Inline style objects: 82
- Tailwind arbitrary-value indicators: 215
- ARIA attributes: 7
- Label references: 8
- Buttons: 6
- Inputs/selects: 6
- Dialog references: 0
- Table references: 1
- Realtime references: 0
- useEffect references: 1
- memo/useMemo references: 5
- Dynamic import references: 1

### Large files

- None detected at 600+ lines.

### Recommended Codex focus

- Evaluate migration to the certified operational shell.
- Audit local search/filter controls against ToolbarShell, ToolbarSearch, and ToolbarSelect.
- Audit repeated card wrappers against WorkspaceSection.
- Review hardcoded colors for theme-token drift.
- Review inline styles for duplicate layout rules.

## reconciliation

Risk: **MEDIUM**

### Shared platform

- Operational shell: Yes
- ToolbarShell: No
- WorkspaceSection: No
- WorkspaceNotice: No
- ContextChip: No
- Loading state detected: Yes
- Empty state detected: No
- Error state detected: Yes

### Static indicators

- Files: 4
- Total lines: 736
- Client component files: 1
- Hardcoded hex colors: 11
- Inline style objects: 46
- Tailwind arbitrary-value indicators: 19
- ARIA attributes: 0
- Label references: 2
- Buttons: 2
- Inputs/selects: 2
- Dialog references: 0
- Table references: 0
- Realtime references: 0
- useEffect references: 0
- memo/useMemo references: 0
- Dynamic import references: 0

### Large files

- None detected at 600+ lines.

### Recommended Codex focus

- Audit local search/filter controls against ToolbarShell, ToolbarSearch, and ToolbarSelect.
- Audit repeated card wrappers against WorkspaceSection.
- Confirm every primary list has a meaningful empty state.
- Review hardcoded colors for theme-token drift.
- Review inline styles for duplicate layout rules.
- Manually inspect icon-only controls for accessible names.

## Verification

| Check | Result | Exit code |
|---|---:|---:|
| TypeScript | PASS | 0 |
| Lint | PASS | 0 |
| Tests | PASS | 0 |
| Build | PASS | 0 |
