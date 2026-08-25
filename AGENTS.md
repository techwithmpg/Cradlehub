# CradleHub Agent Rules

Read [AI_CONTEXT.md](AI_CONTEXT.md) before substantial work. It identifies the accepted baseline, current authorization, and the active governance manifest.

## Authority and stage control

1. The latest explicit owner instruction prevails.
2. Follow active decisions in `docs/11-DECISION-LOG.md`, then the remaining active governance documents listed in `AI_CONTEXT.md`.
3. Work only within the authorized stage and file scope. Completion of one stage never authorizes the next.
4. Treat `.context/`, old `*.cmd.md` status files, and historical reports as evidence, not active instructions, unless an owner explicitly reactivates them.

## Production and branch safety

- `main` is production-connected. A merge or push may deploy to production.
- Do not routinely implement directly on `main`. Use an explicitly authorized `stage/*` or `fix/*` branch.
- Before final review, reconcile the working branch with accepted `origin/main`; do not force-push `main`.
- Never claim a production outcome, test result, migration state, or user-visible behavior without evidence appropriate to the target environment.
- Identify every database target as LOCAL, TEST, STAGING, or PRODUCTION. An unknown target is a stop condition.

## Stabilization discipline

- Preserve working behavior. Do not add speculative features, opportunistic cleanup, or visual novelty during stabilization.
- Keep production changes deliberate: authorize, inspect impact, implement, test, review, then merge.
- Do not expose secrets, service-role credentials, cookies, or private customer/staff data.
- Record substantial work using the active handoff/status protocol; do not revive historical mirrors.
- Require review and the applicable owner gate before an accepted merge.

## Next.js version rule

This repository uses a version of Next.js whose APIs and conventions may differ from older guidance. Before writing or changing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices. If the local dependency tree is unavailable, report that constraint rather than guessing.
