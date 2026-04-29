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
