# Known Issues Register

| ID | Severity | Status | Area | Evidence | Impact | Next authorized stage | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C0B-001 | P2 | OPEN | Local environment | C0A found tracked `.env.example` deleted locally while it remains on accepted `main`. | Local configuration contract is incomplete. | C1 | Do not stage, restore, or rewrite it during C0B. |
| C0B-002 | P1 | OPEN | Dependency reproducibility | Local `node_modules` junctions point to absent `F:\cradlehub` paths; lint/format/test cannot start. | Current checkout cannot provide runtime verification. | C1 | Do not repair dependencies during C0B. |
| C0B-003 | P1 | OPEN | Schema/migration history | Repository records 84 intentionally unmarked historical local-only migration versions. | Broad reconciliation could misrepresent or alter production history. | C1/C2 | No bulk replay, marking applied, or `--include-all`. |
| C0B-004 | P1 | OPEN | Attendance operations | Accepted repository context records scanning as pilot-capable but operational enforcement as OFF/NO-GO pending documented operational gates. | Training/production enforcement cannot be claimed ready. | C1/C2 | This is repository-recorded production evidence, not a C0B live verification. |
| C0B-005 | P2 | OPEN | Delivery governance | No GitHub Actions workflow was found in C0A. | No repository-native automated CI gate is currently evidenced. | C1 | Do not infer external CI is absent; verify any external deployment controls separately. |
| C0B-006 | P1 | RESOLVED / ACCEPTED | Governance | External review accepted the active governance model at merge SHA `03dbd57ed4be6f9b1f0bd30c7fd22a225e68ec2a`. | The accepted source-of-truth hierarchy now governs; stale mirrors no longer have active authority. | None | The active manifest is accepted; `.context/` and older mirrors remain historical evidence. |
| C0B-007 | P1 | ONGOING | Release safety | `main` is production-connected. | An accepted main push/merge may deploy. | Every stage | Controlled by branch and review policy. |

This register contains current, repository-backed governance risks only. Historical issue reports require C1/C2 evidence before being promoted as current defects.
