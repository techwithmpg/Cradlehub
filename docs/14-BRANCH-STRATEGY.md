# Branch Strategy

| Branch pattern | Purpose |
| --- | --- |
| `main` | Accepted, production-connected baseline |
| `stage/<stage>-<name>` | Authorized stage implementation, for example `stage/c0b-governance` |
| `fix/p0-<name>` / `fix/p1-<name>` | Narrow authorized stabilization corrections after issue approval |

Rules:

- no routine direct implementation on `main`;
- no force-push to `main`;
- tests passing alone never authorize a merge;
- an unmerged branch is working evidence, not accepted state;
- reconcile a review branch with accepted `main` before final review;
- require external review and the owner gate applicable to the stage before merge; and
- treat an accepted merge/push to `main` as a potential production release event.

Use the smallest practical branch structure; do not create process-only branches without an authorized purpose.
