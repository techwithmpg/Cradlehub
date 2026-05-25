# CURRENT TASK: CRM-SERVICES-PHASE4-001

## Status
DONE

## Task ID
CRM-SERVICES-PHASE4-001

## Description
Phase 4 — Improve /crm/services into "Services & Therapist Setup".
Adds Provider Assignments panel showing which staff are assigned to each service.
Read-only for CRM workspace. No booking logic changes. No DB schema changes.

## Changes Completed
- Title: "Services" → "Services & Therapist Setup" with 🧖 icon
- Section 1: Active Services (existing ServicesOfferedTab, unchanged)
- Section 2: Provider Assignments (new CrmServiceTherapistPanel)
  - Per-service: name, category, in-spa/home/visibility badges
  - Assigned provider chips (name + staff_type badge)
  - ⛔ critical for public services with 0 valid providers
  - ⚠️ warning for non-public services with 0 providers
  - "How provider matching works" footnote
- New query: getBranchStaffAndServiceAssignments(branchId, serviceIds)
- Architecture rule enforced (display): only SERVICE_STAFF_TYPES can be providers

## New Files
- src/lib/queries/crm-services.ts
- src/components/features/crm/services/crm-service-therapist-panel.tsx

## Modified Files
- src/app/(dashboard)/crm/services/page.tsx

## Agent
Claude Code (main branch, E:/cradlehub)

## Branch
main

## Build Status
- npx tsc --noEmit: ✅ PASS (0 errors)
