# Data and Sync Architecture

## Current repository architecture

Supabase PostgreSQL is the backend source used by this web application. The application uses typed Supabase clients, Server Actions, Next route handlers, PostgREST, RPCs, Auth, RLS, Realtime, and Storage where the relevant feature requires them.

```text
Next.js UI
  -> Server Actions / Next API routes / Supabase clients
  -> Supabase Auth / RLS / RPC / Realtime
  -> PostgreSQL
```

Realtime is implemented for selected operational experiences. Browser offline handling is not a durable local synchronization system: this repository has no SQLite database, durable offline outbox, or separate Tauri/Rust desktop architecture.

## Mutation and migration safety

Every database mutation requires an identified environment and explicit authorization. Schema truth and migration-history truth are related but not identical; neither may be inferred solely from local filenames.

The repository records 84 older local-only migration versions that are intentionally unmarked. They must not be bulk replayed, marked applied, or pushed merely to make history look clean. C1/C2 must establish evidence-backed schema and migration context before any authorized reconciliation work.
