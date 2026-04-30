# 🚨 ERRORS

_No errors logged yet._

## 2026-04-30 — ORG-002 seed verification environment blocker

- `pnpm db:push` failed because `supabase` binary is not installed globally in this shell.
- `npx -y supabase@latest db push --linked` reached the CLI but failed DNS/IPv6 resolution for the remote Supabase host in this environment.
- Result: migration/seed SQL is authored and ready, but remote apply must be run from a network-enabled environment.

## CradleHub-Specific Gotchas

| Gotcha | Solution |
|--------|----------|
| `supabase db push` re-applies old migrations | Run `supabase migration repair --status applied <version>` for each |
| `supabase.ts` shows empty Database type | Run `pnpm db:types` to pull types from live schema |
| Middleware sends all users to /login | Check staff.auth_user_id matches the Supabase Auth UUID |
| `get_available_slots` returns empty array | Verify: branch is_active=true, service is_active=true, staff has schedule for that day_of_week |
| Build error on sonner import | Ensure `@/components/ui/sonner` was added via `pnpm dlx shadcn@latest add sonner` |
