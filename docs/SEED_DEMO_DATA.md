# CradleHub Demo Seed Data (ORG-002)

This project now includes a safe, idempotent demo seed migration for org-structure and booking-workflow testing:

- `supabase/migrations/20260430000002_demo_org_workflow_seed.sql`

## What It Seeds

- 2 active branches (Main + SM)
- Service categories and realistic services
- Branch service availability + custom pricing
- Staff org structure:
  - `system_role` (access)
  - `staff_type` (job function)
  - `is_head` (head/supervisor)
- `staff_services` capability mapping
- Weekly schedules
- Schedule overrides + blocked times
- Demo customers
- Demo bookings (confirmed, completed, cancelled, no_show, in_progress, home_service)

## Safety Notes

- Uses deterministic UUIDs and `ON CONFLICT` upserts
- Safe to run multiple times
- Does **not** wipe whole tables
- Demo marker strategy:
  - booking metadata includes: `"seed": "demo", "source": "cradlehub_seed"`
  - customer emails use `@example.test`
  - customer notes include `Demo seed data`

## Run Seed

Use the existing migration flow:

```bash
pnpm db:push
```

This applies any pending migrations, including the demo seed migration.

## Quick Verification Queries

```sql
-- Branches
SELECT id, name, is_active FROM branches ORDER BY name;

-- Org structure coverage
SELECT branch_id, system_role, staff_type, is_head, COUNT(*) AS count_staff
FROM staff
GROUP BY branch_id, system_role, staff_type, is_head
ORDER BY branch_id, system_role, staff_type, is_head DESC;

-- Capability mapping
SELECT s.full_name, s.staff_type, svc.name AS service_name
FROM staff_services ss
JOIN staff s ON s.id = ss.staff_id
JOIN services svc ON svc.id = ss.service_id
ORDER BY s.full_name, svc.name;

-- Demo bookings by status
SELECT status, COUNT(*)
FROM bookings
WHERE metadata->>'seed' = 'demo'
GROUP BY status
ORDER BY status;
```

## Optional Cleanup (Demo Rows Only)

If you need to clear only demo bookings created by this seed:

```sql
DELETE FROM bookings
WHERE metadata->>'seed' = 'demo'
  AND metadata->>'source' = 'cradlehub_seed';
```

Do not run broad deletes against production tables.
