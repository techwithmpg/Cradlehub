# CradleHub

CradleHub is a production-connected operations platform for public booking and internal CRM, owner, manager, staff, driver, attendance, scheduling, dispatch, payroll, notification, and marketing workflows.

`main` is production-connected. Do not treat routine local work as safe to merge or deploy.

## Start here

- [AI context and current authorization](AI_CONTEXT.md)
- [Agent rules](AGENTS.md)
- [Active governance manifest](docs/20-CHATGPT-LIVE-CONTEXT.md)
- [Current human-readable status](docs/13-PROJECT-STATUS.md)

## Local development

The repository uses pnpm. The declared runtime is Node `>=24 <25`; `.node-version` records the intended local version.

```bash
pnpm dev
pnpm type-check
pnpm lint
pnpm format:check
pnpm test -- --run
pnpm build
```

Database wrapper commands are listed in `package.json`. They must be used only after identifying the target environment and obtaining the required authorization.
