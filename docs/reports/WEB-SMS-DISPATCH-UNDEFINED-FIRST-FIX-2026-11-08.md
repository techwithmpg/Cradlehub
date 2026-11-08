# Web SMS dispatcher null-safety build fix — 2026-11-08

- **Target:** CradleHub Web only.
- **Severity:** P1 build-blocking type error. The observed Vercel build stopped at `src/lib/sms/dispatch.ts:178`. This is build-log evidence supplied by the owner, **not production runtime verification**.
- **Branch:** `fix/web-sms-dispatch-undefined-first-20261108`.
- **Verified base main SHA:** `0ea56211f4c4f7a1fa84e4ee1681865bfd6d9bec`.
- **Initial fix head SHA:** `c2073a1aa81946e34f2f966f19ef48bf469f9e5b`.
- **Finding:** With `noUncheckedIndexedAccess: true`, a preceding `group.length === 0` check cannot prove that `[...group].sort(...)[0]` exists. The next line dereferenced `first.booking_date`, producing TS18048.
- **Code change:** Added `if (!first) continue;` immediately after the sort/index expression. Maintains the existing fail-closed skip behavior for empty/malformed groups, and changes no booking state, recipient eligibility, SMS message, authorization or database schema.
- **Changed file:** `src/lib/sms/dispatch.ts`; this review note is additional evidence.
- **Focused verification:** Using available container global `tsc` with `--strict --noUncheckedIndexedAccess --noImplicitReturns --noFallthroughCasesInSwitch --noEmit` on an isolated reproduction of the exact affected typed group/indexing code: **PASS**. This is a focused TypeScript reproduction, **not** the full repository type-check.
- **Not run / unverified:** `pnpm run build`, repository `pnpm type-check`, `lint`, `format:check`, full Vitest, Vercel preview deployment, native/browser/database tests and production runtime. Full repository was unavailable in the container because the GitHub host could not be resolved; connected GitHub was used for source reads/writes.
- **Production impact:** Unknown. PR #84 was independently verified as merged into `main` at `2026-11-08T12:23:34Z` (20:23:34 Asia/Manila), before the owner-provided failure, but do not interpret this as evidence of live successful deployment.
- **Risk:** Additional compile failures may appear after this first blocker is removed. CI/deployment must be verified before acceptance.
- **Rollback:** Revert the isolated guard change through standard reviewed workflow if needed. No production SQL, Twilio, schedule, or deployment changes authorized.
- **Review status:** Pending external review and owner approval; no merge/deploy authorized by this fix.
