# 🏆 CRADLEHUB — IN PROGRESS

## Recent Work
- ORG-001: Real spa org structure integrated (staff_type, is_head, staff_services)
- ORG-002: Demo seed data created for testing
- Sprint 9: Warm spa design system overhaul complete
- SCHED-001: Daily staff schedule grid (column-based) built
- SCHED-002: Row-based resource timeline board + CRM booking error improvements
- SCHED-003: Compact staff schedule list with detail panel for scalable team management
- UI-001: Premium service card grid with image thumbnails, active toggle, and edit flow
- UI-002: Premium new service builder with live card preview
- CSR-001: CSR Head and CSR Staff roles added with centralized RBAC and CRM operational pages
- DEV-001: Dev auth bypass fixed — centralized helper works across middleware, layout, pages, and actions

## Design System
- `--cs-*` tokens: warm-white (#F9F6F0), sand (#A67B5B), clay (#C7A27C), sage (#8A9A8B), charcoal sidebar (#2C2A29)
- CSR Head accent: `--cs-csr-head-accent: #7A6A4A` (darker gold)
- CSR Staff accent: `--cs-csr-staff-accent: #9A8A6A` (lighter sand)
- Fonts: Playfair Display (headings/brand), DM Sans (body)
- Cards: floating shadows, no harsh borders

## Dev Auth Bypass
- **Helper:** `src/lib/dev-bypass.ts` with `isDevAuthBypassEnabled()`
- **Env vars:** `DEV_AUTH_BYPASS=true` (canonical) or `DEV_ALLOW_ALL_MODULES=true` (legacy)
- **Requirement:** `NODE_ENV !== "production"` — production is NEVER bypassed
- **Usage:** Set in `.env.local` for local development
- **Behavior:** When active, authenticated users without staff records can access all dashboard pages using mock profiles

## Navigation Structure

### CSR Staff Sidebar
- Today → `/crm/today`
- Bookings → `/crm/bookings`
- Customers → `/crm/customers`
- Schedule → `/crm/schedule`

### CSR Head Sidebar
- Same as CSR Staff + Reports Lite → `/crm/repeats`

## Next Steps
1. Apply pending Supabase migrations in production (`20260501000002_csr_roles.sql`)
2. Test CSR pages visually at `/crm/today`, `/crm/bookings`, `/crm/customers`, `/crm/schedule`
3. Test staff portal with dev bypass: set `DEV_AUTH_BYPASS=true` in `.env.local`
4. Test all role workspaces in dev mode without staff records
5. Continue with feature sprints as needed

## Go-Live Checklist
- Owner account setup
- Branch/service configuration
- Staff invites with new job functions (CSR Head, CSR Staff)
- Online booking flow test
- CSR front-desk workflow test
- Apply DB migration for expanded system_role CHECK constraint
