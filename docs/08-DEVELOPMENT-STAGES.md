# Development Stages

## Staff PWA sub-roadmap

- Program: **OWNER APPROVED**. Current stage: **PWA-C6 — Scanner correction / external re-review**, on `stage/pwa-c6-scanner`.
- Accepted C5/main baseline: `a97e43eec9ce0c99ad5037212e75cd5226fe38fc`; reviewed C6 head: `bc20ee15cd987364b7acdeea0886d7c649ee1a5e`. C6 remains current until accepted/merged; correction work is a new commit, with no history rewrite.
- Latest owner instruction authorizes only the four C6 scanner corrections, focused verification, governance updates, and normal branch commit/push. No deployment, merge, schema/migration/Auth/RLS/Storage changes, or production access/mutation is authorized. Configured remote Supabase target: **UNKNOWN**; no authenticated/mutating runtime verification against it.
- **PWA-GOV-010 — OWNER APPROVED ROADMAP COMPRESSION** prospectively supersedes original remaining C7–C19 after C6 acceptance: C7X Staff Operations Core → C8X Driver & Off-Site Operations → C9X Stabilization & Release Hardening → C10X Training & Release Candidate → separate FINAL Release Certification. Historical stage records remain evidence.
- **PWA-C7X — NOT YET AUTHORIZED FOR IMPLEMENTATION.** Roadmap approval and completion of C6 do not authorize later implementation or deployment.

See the [ordered macro-stage slices and blocking gates](pwa/PROJECT.md#prospective-compressed-roadmap--pwa-gov-010). C7X, C8X and C9X each use one branch/review cycle with internal gates preserved. C8X-D cannot begin until C8X-C proves required reliability and the server-side eligibility contract. Security remains an explicit blocking gate inside C9X. C10X completion does not authorize deployment; FINAL requires separate explicit owner approval. The Web/Marketing sequence below remains separate historical evidence.

## Web stabilization stages

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
