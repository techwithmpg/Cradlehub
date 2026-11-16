# ChatGPT Live Context

> 2026-11-16 follow-up: The owner authorizes merging reviewed Attendance V2 into local `main` only. No remote push, production execution, activation or deployment. One-scan 120-minute policy and remaining release acceptance gates are preserved. See ATT-V2-004 and the current handoff.

> 2026-11-16: Attendance V2 is an isolated inactive Web review candidate on `stage/web-attendance-v2-automation-20261116`, based on fetched main `a9ff58e9da53bc10a71a714839ce6d77dc895bb0`. Latest owner policy is one scan up to 120 minutes early, preserving arrival and crediting from shift start; no second scan. Read [the handoff](reports/ATTENDANCE-V2-HANDOFF-2026-11-16.md) and [contract](reports/ATTENDANCE-V2-AUDIT-AND-CONTRACT-2026-11-16.md). Production execution, Cron activation, RLS/Auth changes, push, merge and deployment are not authorized. Local corrections and independent review pass (671 tests, 39 LOCAL database scenarios). Target parity and authenticated real-device/push/payroll acceptance remain open; see the linked handoff and independent review report.


> 2026-11-08: Owner-authorized isolated Web Customer SMS foundation branch stage/customer-sms-foundation-20261108 from verified main c263ebf835339948d0e4d47f368eb527e1d51313. Boutique B1 review is preserved/parked, not merged; new code is unverified for release and disabled. Read reports/CUSTOMER-SMS-FOUNDATION-HANDOFF-2026-11-08.md before SMS release work. No SQL, Twilio, Cron or production action was authorized by this implementation pass.

For substantial future decisions or reviews, ChatGPT must:

1. identify the canonical CradleHub repository;
2. resolve the current accepted `main` SHA;
3. read `AI_CONTEXT.md` at that exact SHA;
4. read the active governance manifest from that same SHA;
5. inspect the relevant implementation;
6. inspect an unmerged stage/fix branch directly when reviewing its work;
7. treat completion reports as evidence, not proof; and
8. distinguish repository-recorded production evidence from independently live-verified production state.

After an accepted stage change, update `AI_CONTEXT.md`, the active status, decision log, known-issues register, and any affected governance document in the same reviewed change. Do not use pasted historical context or `.context/` mirrors as a substitute for live repository reads.
