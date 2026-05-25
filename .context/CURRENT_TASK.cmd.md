# CURRENT TASK: CRM-SPACES-PHASE6-001

## Status
COMPLETE

## Task ID
CRM-SPACES-PHASE6-001

## Description
Phase 6 — Improve /crm/spaces-rules into Spaces & Booking Rules Center.
Adds explanation cards, health summary, MVP access notice, and related tools
around the existing SpacesRulesWorkspace.

## Changes Completed
- Extended resources-actions.ts requireOwnerOrManager to include crm/csr_head
  (branch-scoped) — consistent with requireOwnerOrBranchManager pattern
- canManageResources={true} for CRM: add/edit/toggle rooms safely
- canEditRules={false} for CRM: booking rules affect online booking windows —
  kept manager/owner only (documented in HANDOFF)
- Booking Rules tab now visible for CRM (read-only): changed canViewBookingRules
  and showActiveRulesKpi to always true in spaces-rules-workspace.tsx
- SpacesRulesExplainer: 3 cards for In-Spa, In-House/Walk-In, Home-Service
- SpacesRulesHealthSummary: 8 stat cards from fetched resources + rules
- SpacesRulesAccessNotice: MVP access notice with can/cannot two-column list
- SpacesRulesRelatedTools: footer links to 5 related CRM tools
- Page title → "Spaces & Booking Rules Center", description updated

## New Files
- src/components/features/spaces-rules/spaces-rules-explainer.tsx
- src/components/features/spaces-rules/spaces-rules-health-summary.tsx
- src/components/features/spaces-rules/spaces-rules-access-notice.tsx
- src/components/features/spaces-rules/spaces-rules-related-tools.tsx

## Modified Files
- src/app/(dashboard)/crm/spaces-rules/page.tsx
- src/app/(dashboard)/owner/branches/resources-actions.ts
- src/components/features/spaces-rules/spaces-rules-workspace.tsx

## Agent
Claude Code (main branch, E:/cradlehub)

## Branch
main

## Build Status
- npx tsc --noEmit: ✅ PASS (0 errors)
- eslint (changed files): ✅ PASS (0 warnings)
- pnpm build: ✅ PASS (85/85 routes)
- Commit: e160e1f
