# 🤝 HANDOFF — Sprint 2

| Field | Value |
|-------|-------|
| Agent | Kimi/Codex (Sprint 2) |
| Build | ✅ Passing |
| Mood  | Shell is up. Every workspace has a route. |

## What I Did
- Auth: login page + server action + role-based redirect
- Dashboard: sidebar + header + layout — all workspaces use this shell
- 16 placeholder pages across owner/manager/crm/staff-portal
- Design tokens established in globals.css — use var(--ch-*) throughout

## What Is Next — Sprint 3: Owner Workspace
1. /owner/page.tsx — real overview with stats cards + revenue chart
2. /owner/branches/page.tsx — branch list + create/edit forms
3. /owner/staff/page.tsx — staff list + invite form
4. /owner/services/page.tsx — service + category management
5. /owner/bookings/page.tsx — cross-branch booking list with filters

## Critical Notes
- Dashboard layout reads system_role from staff table on EVERY request
- Header logout is a Server Action (form POST) — no client JS needed
- Sidebar is 'use client' for mobile collapse — desktop renders server-side within it
- All design tokens are CSS variables (var(--ch-*)) — use these in Sprint 3+ pages
- PageHeader component is the standard page title — use it on every dashboard page
- DM Sans loaded via next/font — variable is --font-dm-sans
