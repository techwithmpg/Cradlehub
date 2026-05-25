# CURRENT TASK: CRM-SAFE-TWEAKS-001

## Status
DONE

## Task ID
CRM-SAFE-TWEAKS-001

## Description
CRM Safe Usability Tweaks — Phase 1 of CRM improvement.
Small, safe, regression-resistant changes to make CRM workspace easier to use
without touching the booking architecture or public booking logic.

## Changes Completed
1. /crm → redirect to /crm/today (was /crm/control)
2. /crm/availability — clarified that online booking remains schedule-based
3. today-quick-actions — 5 new CRM-focused action buttons
4. /crm/bookings/new?type= — wizard seeded with correct visit type
5. Staff Readiness Full View — fixed link to /crm/availability
6. nav-config — renamed Ops Setup → Rules & Setup, Spaces → Spaces & Rules

## Agent
Claude Code (main branch, E:/cradlehub)

## Branch
main

## Build Status
- pnpm type-check: ✅ PASS
- pnpm lint: ✅ PASS
- pnpm build: ✅ PASS (85 routes)
