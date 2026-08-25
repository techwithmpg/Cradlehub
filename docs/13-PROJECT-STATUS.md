# Project Status

## Current program

- **Program:** Controlled Stabilization
- **Current stage:** C0B — Governance & Live Context
- **C0B status:** Implementation complete / awaiting external review
- **Next stage:** C1 — NOT AUTHORIZED
- **Accepted baseline:** `main` at `4bff290923f2046e7097c08d9c15e48c27e49c25`
- **C0B branch:** `stage/c0b-governance`

## Current safety state

- `main` is production-connected.
- No production mutation is part of C0B.
- Historical migration reconciliation is constrained: 84 local-only versions remain intentionally unmarked.
- Attendance operational enforcement remains not training-ready until its repository-recorded gates pass.

## Verified repository summary

CradleHub is a Next.js 16.2.4 / React 19.2.4 web application using Supabase PostgreSQL, Auth, RLS, RPCs, Realtime, and Storage where applicable. It has no separate Tauri/Rust/SQLite desktop application in this repository.

## Major blockers carried forward

- local `.env.example` discrepancy;
- broken local dependency junctions/reproducibility;
- historical migration-history limitation;
- Attendance operational gates; and
- external confirmation of the new governance model.

No C1 work may begin until the owner approves it after external review of C0B.
