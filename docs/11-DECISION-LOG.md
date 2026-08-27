# Decision Log

| ID | Date | Status | Decision | Rationale and impact | Supersedes |
| --- | --- | --- | --- | --- | --- |
| GOV-001 | 2026-08-26 | ACTIVE | Use the approved source-of-truth hierarchy. | Owner instruction, active decisions, AI context, frozen scope/status/governance, accepted code, then independently proven live state establish authority. | Fragmented historical instruction order |
| GOV-002 | 2026-08-26 | ACTIVE | Active governance lives in `docs/`; root `AI_CONTEXT.md` and `AGENTS.md` are entry points. | Gives agents one durable manifest and avoids a project diary becoming authority. | Informal documentation layouts |
| GOV-003 | 2026-08-26 | ACTIVE | Treat `.context/` as historical evidence. | Preserves audit history without maintaining a conflicting mirror. | Historical mirrored control files |
| GOV-004 | 2026-08-26 | ACTIVE | Use the C0B, C1, C2, C3, C4, C5+, FINAL stage model. | Work must be authorized and gated one stage at a time. | Earlier roadmap phase models |
| GOV-005 | 2026-08-26 | ACTIVE | `main` is production-connected; routine implementation requires an authorized branch. | An accepted main merge/push can deploy, so branch review is a safety control. | Direct-main routine implementation |
| GOV-006 | 2026-08-26 | ACTIVE | Preserve working functionality and prohibit speculative stabilization work. | Reduces regression and scope risk. | Opportunistic/greenfield task assumptions |
| GOV-007 | 2026-08-26 | ACTIVE | Do not bulk reconcile the 84 historical local-only migration versions. | Filename/history normalization cannot establish historical data effects. | Broad replay or `--include-all` reconciliation |
| GOV-008 | 2026-08-26 | ACTIVE | Treat Attendance scanning and operational enforcement as separate controls. | Operational enforcement remains blocked until its recorded gates have passed. | Readiness claims based on source changes alone |
| GOV-009 | 2026-08-26 | ACTIVE | Close and accept C0B governance at merge SHA `03dbd57ed4be6f9b1f0bd30c7fd22a225e68ec2a`. | External review, merge verification, and production deployment verification passed. C0B completion does not authorize C1; C1 requires separate explicit owner authorization. | C0B pending-review status |
| GOV-010 | 2026-08-27 | ACTIVE | Authorize C1 current-system truth consolidation from accepted `main` SHA `4f9291c7d457ec49b071e766df4c23ca1e4f1558`. | C1 establishes the repository, runtime, reproducibility, system-inventory, migration-history, and delivery baseline. It does not authorize product fixes, production mutation, C2, or any later stage; C0B remains closed and accepted. | C1-not-authorized status only; GOV-009 C0B acceptance remains active |

New decisions must include an ID, date, status (`ACTIVE`, `SUPERSEDED`, or `RETIRED`), decision, rationale, impact, and supersession relationship where relevant.
