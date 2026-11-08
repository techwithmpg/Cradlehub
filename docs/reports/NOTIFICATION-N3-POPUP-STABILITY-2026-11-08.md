# CradleHub Web — N3 notification popup stability (draft review)

## Authority and baseline
- Owner instructed "go on" for N3 on 2026-11-08; isolated correction only.
- WEB target, accepted remote `main` base `5ef2f83bec89a005ae387511e970e0cd941ef2dd` (PR #85 merge). N1 (#81) and N2 (#83) are inherited accepted baseline; Attendance P0 #82, Boutique B1 #76 and other open PRs remain unrelated.
- Branch: `fix/web-p1-notification-n3-popup-stability-20261108`; final head SHA and changed files are available on the resulting PR.
- **No merge, deploy, production mutation, schema, RLS or Auth change authorized or performed here.**

## Source-backed problems
1. Every fresh notification generated a Sonner toast and booking sound, including low-priority and informational updates; this interrupted front-desk cashier/booking work.
2. The live toast "Dismiss" handler called `dismissNotificationAction(id)`, closing the shared database notification for all CSR accounts at the branch even while an actionable business issue remained open.
3. Existing task-related rows could also be dismissed from bell, list, and card views; the server dismiss action lacked a requires-action check.
4. Realtime status updates removed resolved rows from the bell but did not dismiss an already-visible toast.
5. Handled-popup suppression used unscoped session/local storage, allowing one user's handled-ID history to suppress another employee's popup on the same device.
6. Service transitions already have dedicated lifecycle refresh and CRM completion modal; an extra normal-priority notification toast was duplicate noise.

## Scoped change
- Only fresh, unread, **high/critical actionable** notifications may trigger Sonner popups and booking chimes. Informational and read notifications remain in the bell.
- Defer popups during focused form entry, content editing or another open dialog; queued popups are shown when safe, one at a time, and dropped after a server resolution. No automatic business mutation is performed when the popup closes.
- Visible toasts have stable notification IDs and close on resolved/dismissed realtime updates; service-transition realtime refreshes booking state in every authorized tab without its duplicate toast. Updates to rows outside the visible bell snapshot reconcile the unread count.
- Close action only closes the local popup. Hide Dismiss on active actionable rows in bell/list/card, and add a server-enforced `requires_action=false` and active-status filter to the existing dismissal action. Bulk "Mark all read" applies only to informational notifications, not outstanding actions, and the bell reconciles its badge from the server.
- Notification presentation dedupe is scoped to authenticated user and workspace; keep existing inter-tab coordination within a single user's scope and RLS as server authority.
- Add targeted unit/source contract tests.

## Boundaries / gaps / release gates
- N3 does NOT create a new modal, notification page, scheduler, push retry queue, task claim flow or database migration.
- N3 does NOT change service-start or payment-ready providers, their feature flags, cashier workflows, booking lifecycle, notification types, RLS, or server push delivery. Their auto-popup rules still need separate acceptance testing.
- Deferred toasts are in-memory and can disappear on full-page navigation; the authoritative notification and bell remain. Browser OS notifications are separate and outside N3.
- N3 does not guarantee zero event loss under concurrent insert/resolve races, nor delivery acknowledgment. The full server-to-device delivery gate remains N4/N6.
- Automated Vitest, lint, typecheck, build, browser/native/mobile/db, multiuser and production checks **NOT EXECUTED** in this GitHub-only session; no claims of success.
- Required: clean approved worktree with Node 24 and pnpm 10.33.2, `git diff --check`, focused Vitest, all Vitest, typecheck, lint, build.
- Authenticated TEST: CSR A and CSR B on separate browsers and one shared workstation login swap; high/critical vs routine alerts; focused payment fields; active modal; timeouts; realtime resolution; stale IDs; two tabs; read vs resolve; owner noise; therapist/driver; staff PWA compatibility.
- Verify no mutation of shared business action when a toast closes or bell row is read; one CSR completion must resolve others only through the accepted N2 authoritative business path.
- Rollback: revert isolated commit after review, no schema rollback; preserve prior N1/N2 accepted behavior.

**Review decision: CORRECTION REQUIRED until automated and authenticated browser acceptance; do not merge/deploy without external review and explicit Owner approval.**
