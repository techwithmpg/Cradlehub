# Development Stages

| Stage | Objective | Allowed work | Forbidden work | Evidence and gate |
| --- | --- | --- | --- | --- |
| C0B — Governance & Live Context | Establish durable authority, safety, and context | Authorized governance documentation | Product, database, dependency, UI, and runtime changes | Documentation scope audit and external review |
| C1 — Current-system truth consolidation | Resolve repository/runtime/source-of-truth baseline | Owner-approved baseline and reproducibility work | Broad cleanup or product changes | Reproducible environment and validated system inventory |
| C2 — Structured diagnostics | Produce evidence-based functional, UI, performance, data/sync, and security findings | Authorized read-only diagnostics | Unapproved fixes | Reviewed diagnostic evidence |
| C3 — Stabilization scope freeze | Select the bounded correction program | Prioritize proven issues | Speculative expansion | Owner-approved frozen scope |
| C4 — UI/UX contract and workflow refactor plan | Freeze interaction rules and safe implementation plan | Workflow/UI planning and contract approval | Unapproved redesign implementation | Approved UI/UX contract and refactor plan |
| C5+ — Gated correction passes | Correct approved P0/P1/P2 issues | Narrow authorized fixes and verification | Out-of-scope changes | Per-fix evidence, review, and merge gate |
| FINAL — Training/release candidate certification | Decide training/release readiness | Certification evidence and approved release work | Unsupported readiness claims | Owner release gate |

Every stage requires owner approval before work begins and a review gate before it advances. **Completing C0B does not authorize C1.**
