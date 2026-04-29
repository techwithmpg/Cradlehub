# CradleHub Architecture

> See CLAUDE.md in the project root for the full architecture overview.
> This file will be expanded as the system is built.

## Layers
1. **Public layer** — `/book`, `/services`, `/branches`, `/about`, `/contact`
2. **Scheduling engine** — `get_available_slots` Supabase RPC
3. **Admin workspaces** — `/owner`, `/manager`, `/crm`, `/staff-portal`

## Key Files
- `src/lib/supabase/client.ts` — browser Supabase client
- `src/lib/supabase/server.ts` — server Supabase client
- `src/lib/supabase/admin.ts` — service-role client (RLS bypass, server only)
- `src/middleware.ts` — auth guard + role-based workspace routing
- `supabase/migrations/` — database schema history
