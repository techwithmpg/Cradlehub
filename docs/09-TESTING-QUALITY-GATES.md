# Testing and Quality Gates

Quality gates are change-type-sensitive. A configured command is not proof that it ran or passed.

| Change type | Minimum evidence |
| --- | --- |
| Docs / governance | Scope audit, links/paths resolve, `git diff --check`, secret/privacy review, and no unauthorized runtime changes |
| Application logic | Focused tests plus appropriate type-check, lint, and affected-flow evidence |
| UI | Logic gate plus responsive/interaction evidence appropriate to the affected roles and devices |
| Database / migration | Identified target, authorization, migration/impact review, rollback consideration, and post-change verification |
| Auth / security | Threat/permission impact review, focused tests, environment confirmation, and no credential exposure |
| Performance | Measured baseline, defined workload, result comparison, and regression evidence |
| Production release | All scoped gates, production-safety review, explicit owner release approval, and operational evidence |

## C0B governance gate

- `git diff --check` passes;
- governance links and manifest paths resolve;
- no secrets or private data were introduced;
- changed paths are limited to authorized governance/documentation files;
- `src/**`, `tests/**`, `supabase/migrations/**`, `package.json`, `pnpm-lock.yaml`, environment files, and production configuration are unchanged; and
- no production mutation occurred.

## Current project commands

The repository defines `pnpm dev`, `build`, `start`, `lint`, `type-check`, `format`, `format:check`, `test`, and database wrappers `db:doctor`, `db:status`, `db:verify`, `db:verify-live`, `db:link`, `db:push`, `db:types`, `db:migration`, and `db:list`.

`format` writes files. Database wrappers require target classification and authorization. This repository does not define `db:migrate`, `db:reset`, or `db:seed` package scripts.
