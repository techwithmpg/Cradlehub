# 🏗️ DECISIONS — Architecture Decision Records

> **Every non-trivial choice gets documented here.**
> **Future agents: READ these before suggesting changes. There was a reason.**

---

## Format

```
### DEC-[NUMBER]: [Title]

**Date:** [DATE]
**Agent:** [Who made this decision]
**Status:** ACCEPTED / SUPERSEDED / DEPRECATED

**Context:** Why did this decision come up?
**Decision:** What was decided?
**Rationale:** Why this option over alternatives?
**Alternatives Considered:**
1. [Option A] — rejected because...
2. [Option B] — rejected because...

**Consequences:**
- Positive: ...
- Negative: ...
- Trade-offs: ...

---
```

## Decisions

### DEC-001: pnpm as Package Manager

**Date:** Project inception
**Agent:** Human (Malcom)
**Status:** ACCEPTED

**Context:** Need a fast, disk-efficient package manager for the project.
**Decision:** Use pnpm over npm or yarn.
**Rationale:** pnpm is faster, uses less disk space via symlinks, and enforces strict dependency resolution preventing phantom dependencies.
**Alternatives Considered:**
1. npm — slower, larger node_modules, allows phantom deps
2. yarn — acceptable but pnpm has better monorepo support and stricter resolution

**Consequences:**
- Positive: Faster installs, smaller disk footprint, stricter deps
- Negative: Some CI environments need extra pnpm setup
- Trade-offs: Minor — pnpm is well-supported everywhere now

---

### DEC-002: Next.js App Router (Not Pages Router)

**Date:** Project inception
**Agent:** Human (Malcom)
**Status:** ACCEPTED

**Context:** Next.js 15 supports both App Router and Pages Router.
**Decision:** Use App Router exclusively. No pages/ directory.
**Rationale:** App Router is the future of Next.js. Server Components reduce client bundle. Layouts, loading states, and error boundaries are first-class. Server Actions simplify data mutations.
**Alternatives Considered:**
1. Pages Router — more tutorials available but being deprecated in favor of App Router

**Consequences:**
- Positive: Better performance, cleaner data flow, built-in streaming
- Negative: Some third-party libraries haven't fully adapted yet
- Trade-offs: Acceptable — the ecosystem is mature enough

---

### DEC-003: Supabase Over Custom Backend

**Date:** Project inception
**Agent:** Human (Malcom)
**Status:** ACCEPTED

**Context:** Need a backend with auth, database, storage, and realtime.
**Decision:** Use Supabase as the full backend layer.
**Rationale:** Supabase provides PostgreSQL, Auth, Storage, Edge Functions, and Realtime out of the box. It eliminates the need to build and maintain a custom API server, letting us focus on frontend and business logic.
**Alternatives Considered:**
1. Custom Express/Fastify API — too much boilerplate for initial phase
2. Firebase — NoSQL doesn't fit relational data needs
3. Prisma + PostgreSQL — good but requires hosting the API separately

**Consequences:**
- Positive: Rapid development, built-in RLS, typed client generation
- Negative: Vendor lock-in, RLS can be complex for multi-tenant
- Trade-offs: The speed advantage outweighs the lock-in risk

---

### DEC-004: .context/ Directory as AI Agent Memory

**Date:** Project inception
**Agent:** Human (Malcom)
**Status:** ACCEPTED

**Context:** Multiple AI agents (Claude Code, Codex, future agents) will work on this project across separate sessions with no shared memory.
**Decision:** Use `.context/*.cmd.md` files as a persistent, file-based memory system that all agents must read before working and update after working.
**Rationale:** AI agents lose context between sessions. By enforcing read-before-work and write-after-work protocols on markdown files, we create a durable shared memory that any agent can understand. The `.cmd.md` extension signals these are "command" files — operational, not documentation.
**Alternatives Considered:**
1. Relying on git history alone — too slow to parse, not structured for agents
2. Database-backed memory — overengineered for this purpose
3. Single CONTEXT.md file — too large, harder to scan for specific info

**Consequences:**
- Positive: Any agent can onboard in seconds, no repeated work, decisions are preserved
- Negative: Requires discipline to maintain (enforced via AGENT_RULES.md)
- Trade-offs: Small overhead per session, massive time savings overall

---

### DEC-CRM-STABILIZATION-001: Latest CRM visible navigation direction supersedes older Front Desk labels

**Date:** 2026-06-30
**Agent:** Codex
**Status:** ACCEPTED

**Context:** The active CRM refactor handoff still contains older visible labels such as `Front Desk`, `Dispatch`, and `Admin & Setup`. The latest user-provided CRM prompts now target a production-stabilization pass with daily navigation named `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`, plus a collapsed `System Management` area.

**Decision:** Reconcile visible CRM navigation toward the latest Work Queue/Home Service/System Management direction while preserving existing `/crm/*` routes, server actions, database identifiers, and helper names until a safe incremental migration is complete.

**Rationale:** Production usability and workflow reliability matter more than a sweeping rename. Internal helpers such as `getFrontDeskContext()` may remain during stabilization even if user-facing labels change.

**Alternatives Considered:**
1. Global internal rename from CRM/Front Desk to Work Queue/System Management — too risky during stabilization.
2. Keep older Front Desk labels indefinitely — conflicts with latest product direction.

**Consequences:**
- Future agents should update labels, nav grouping, redirects, and deep links deliberately.
- Do not delete old routes until linked notifications, actions, and bookmarks are migrated.
- Do not claim completion until CRM actions are verified through server auth, Supabase/RLS, database constraints, and UI refresh behavior.

---

### DEC-ATTENDANCE-REFIT-001: Attendance tabs are local client state and actions return typed results

**Date:** 2026-07-02
**Agent:** Codex
**Status:** ACCEPTED

**Context:** The Attendance workspace needs seven operational tabs, persistent QR/list/filter state, and in-place QR/device/exception/session actions. URL-driven tab switches and redirect/status-query Server Action flows made the UI feel slow and could surface `NEXT_REDIRECT`.

**Decision:** Keep `/crm/attendance` as one route with one mounted client workspace. Mirror the selected tab into the URL using `window.history.replaceState()` through shared helpers. Return typed `AttendanceActionResult` payloads for routine Attendance actions instead of redirecting.

**Rationale:** Front-desk staff need instant tab switching and preserved state. Server Action redirects are control-flow exceptions, which are the wrong primitive for normal CRM feedback. Typed results let the client show toasts/notices and synchronize local state around server-confirmed outcomes.

**Alternatives Considered:**
1. Route-driven tabs with router navigation — preserves deep links but causes unnecessary route work and state loss.
2. Server Action redirects to status query params — simple, but exposes redirect control flow and makes in-place workflows brittle.

**Consequences:**
- Future Attendance tabs should use the existing local tab helper pattern.
- Reserve `redirect()` for true navigation boundaries.
- Keep database/scan/RLS behavior authoritative; local client updates should reflect server-returned results, not replace backend validation.

---

### DEC-ATTENDANCE-VERIFY-002: Do not fabricate authenticated QR visual QA without a real CRM session

**Date:** 2026-07-02
**Agent:** Codex
**Status:** ACCEPTED

**Context:** Final QR verification requires protected `/crm/attendance?tab=qr` visual inspection, real export interactions, phone scans, and identity preservation checks. The available local browser has no authenticated Supabase CRM/front-desk session.

**Decision:** Report pnpm automation as passing, but keep authenticated QR visual/export/scan QA open until a real CRM/front-desk browser session or explicit test credentials are available. Do not add temporary protected-route bypass code or claim QR layout approval from the login redirect.

**Rationale:** `src/proxy.ts` requires a real Supabase user before dev bypass skips staff-record checks. Process-local `DEV_AUTH_BYPASS=true` was not enough to open the protected route.

**Consequences:**
- The blocker can be documented with screenshots and console evidence.
- Future QA must rerun every requested viewport and interaction in an authenticated session.
- Avoid verification-only auth bypass edits to protected application routes.
