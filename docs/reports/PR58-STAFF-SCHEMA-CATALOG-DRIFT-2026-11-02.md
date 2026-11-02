# PR #58 `public.staff` catalog recovery — source drift stop

**Scoped verdict: CORRECTION REQUIRED.** The owner approved seven prepared catalog SELECTs against classified PRODUCTION project `lsrbwqhvzjfpiabeolkv`, with an explicit stop on source conflict. After project identity verification, only the first two approved SELECTs were executed. The second revealed historical migration-versus-live schema drift; the remaining five were **not** submitted. No operational rows, public application functions, DML, DDL, migrations, configuration changes, credentials, or secrets were accessed.

## Target verification and exact executed queries

The Supabase `get_project` call on the connected Primary account returned ref `lsrbwqhvzjfpiabeolkv`, name `Creadlehub`, organization `vjjgnftdpdpqbwilmqzm`, region `ap-northeast-1`, status `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.111`. This is the previously classified **PRODUCTION** project. The connector used `postgres` with `transaction_read_only=off`, so safety relied on submitting only these two metadata SELECT statements from [the approved query set](PR58-STAFF-SCHEMA-CATALOG-APPROVAL-2026-11-02.md):

```sql
select current_database() as database_name, current_user as inspector_role,
       current_setting('transaction_read_only') as transaction_read_only,
       c.oid::regclass::text as relation, c.relkind,
       pg_catalog.pg_get_userbyid(c.relowner) as owner,
       c.relrowsecurity, c.relforcerowsecurity, c.relacl::text as table_acl,
       n.nspacl::text as schema_acl
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='staff';
```

```sql
select a.attnum, a.attname,
       pg_catalog.format_type(a.atttypid,a.atttypmod) as data_type,
       a.attnotnull as not_null,
       pg_catalog.pg_get_expr(d.adbin,d.adrelid) as default_expression,
       a.attidentity, a.attgenerated, a.attacl::text as column_acl
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid=a.attrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where n.nspname='public' and c.relname='staff'
  and a.attnum>0 and not a.attisdropped
order by a.attnum;
```

The table is an ordinary relation owned by `postgres`, with RLS enabled and not forced. Its explicit table ACL lists `postgres`, `anon`, `authenticated`, and `service_role` with `arwdDxtm`; this **does not establish effective row access**, because policies were not inspected. Several columns have an additional `authenticated=w` column ACL. No column is generated or identity-backed.

## Column evidence and discrepancy

The catalog returned 24 columns: `id`, `branch_id`, `auth_user_id`, `full_name`, `phone`, `tier`, `system_role`, `is_active`, `created_at`, `updated_at`, `staff_type`, `is_head`, `metadata`, `avatar_url`, `avatar_path`, `workspace_access`, `temporary_access_expires_at`, `access_notes`, `nickname`, `merged_into_staff_id`, `archived_at`, `archive_reason`, `identity_verified_at`, `is_cross_branch`.

The seven fields absent from repository migration DDL but present in current generated types and catalog are:

| Column | Catalog type | Null? | Default |
|---|---|---|---|
| `workspace_access` | `text[]` | no | `'{}'::text[]` |
| `temporary_access_expires_at` | `timestamp with time zone` | yes | none |
| `access_notes` | `text` | yes | none |
| `merged_into_staff_id` | `uuid` | yes | none |
| `archived_at` | `timestamp with time zone` | yes | none |
| `archive_reason` | `text` | yes | none |
| `identity_verified_at` | `timestamp with time zone` | yes | none |

This resolves only their **column-level** type/default/nullability evidence. It does not establish constraints, FK actions, indexes, policy expressions, triggers, or full privileges.

The unexpected discrepancy is the reverse: accepted `supabase/migrations/20260429000009_staff_expansion.sql:25-40` adds nullable `staff.department_id` (`uuid` FK to `departments`, `ON DELETE SET NULL`) and `staff.job_title` (`text`), with an index on `department_id`; neither column appears in the production catalog response. A repository migration search found no later `DROP COLUMN` for either. `supabase/migrations/20260513000002_real_staff_rbac_seed.sql:12-16` already notes that the then-live schema lacked `job_title` and other expansion fields; current `src/types/supabase.ts:4229-4330` also omits both. Thus this is **historical migration-versus-live schema drift**, not proof of a new current attendance failure. The owner-directed source-conflict stop condition was applied immediately after the column response.

## Consequences and remaining decision

- The remaining approved catalog statements for staff constraints/FK actions, indexes, policies, triggers, and direct dependencies were **not** executed. The complete authoritative `public.staff` contract remains unestablished.
- No LOCAL correction SQL was created or tested in this turn. The existing recovered duty-assignment SQL and reviewed schedule syntax overlay remain unchanged; no full baseline was regenerated. Authenticated Supabase TEST and physical-device acceptance remain NOT VERIFIED; production release remains NOT APPROVED.
- Before further catalog inspection or LOCAL reconstruction, the owner must decide whether the historical expansion's `department_id`/`job_title` objects are excluded from the accepted attendance TEST baseline despite their migration, or supply another authoritative current schema decision. If further catalog inspection is desired, explicitly reauthorize the **remaining five** prepared SELECTs under that decision. No production schema repair is proposed here.

Independent read-only review confirmed the drift and the stop boundary. **Reviewer verdict: CORRECTION REQUIRED for complete staff contract.** It specifically cautioned that the first two queries do not prove effective anon access or production attendance behavior. No production rollback is needed; no production change was made.
