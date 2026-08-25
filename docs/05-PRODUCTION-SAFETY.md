# Production Safety Contract

`main` is production-connected. Treat an accepted merge or push as a potential production release event.

## Target identification

Every mutation must identify its target as **LOCAL**, **TEST**, **STAGING**, or **PRODUCTION**. An unknown target is a stop condition.

## Production prohibitions without explicit authorization

- reset, truncate, reseed, destructive testing, or broad migration replay;
- `--include-all` migration operations;
- casual RLS changes, RLS disablement, or Auth configuration changes;
- Storage deletion;
- secret exposure or service-role use in browser code; and
- real customer/staff data in public fixtures, screenshots, or documentation.

## Production schema or data changes

Require all of the following before execution:

1. verified target and explicit authorization;
2. impact review and migration-based change where appropriate;
3. recovery/rollback consideration and backup confidence proportionate to risk;
4. controlled implementation; and
5. post-change verification.

Repository-recorded production evidence is not equivalent to live verification performed in the current task.
