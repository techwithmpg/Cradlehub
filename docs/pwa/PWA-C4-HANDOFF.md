# PWA-C4 UI/UX Specification — Handoff

## Status and authority

- Stage: **PWA-C4 — UI/UX Specification**, owner authorized for design/specification only.
- Review status: **READY FOR EXTERNAL REVIEW — NOT ACCEPTED / NOT MERGED**.
- Accepted C3/main baseline: `3c069f198db8a6341b6bf27758cdbec24d344089`.
- Branch: `stage/pwa-c4-uiux-specification`.
- Review head: the commit containing this handoff at the published review revision; resolve with `git rev-parse HEAD`. The delivery response records the full remote-verified head; publication evidence records the content commit separately without rewriting history.
- [PWA-GOV-006](../11-DECISION-LOG.md#staff-pwa-decisions) records C3 accepted/closed/merged at the exact baseline and C4-only authority. C3 product decisions remain binding; old C3 stage-stop wording remains historical evidence.
- **PWA-C5+ remains NOT AUTHORIZED.** No runtime/UI implementation, routes/actions, dependencies, database/schema/migrations/Auth/RLS/Storage changes, production access/mutation, deployment or merge is authorized.

## Deliverable and design result

The [C4 specification](PWA-C4-UIUX-SPECIFICATION.md) defines 24 sections, 24 screen references, seven role-specific Today variants, four workflow diagrams, two text wireframes, a compact component/token vocabulary, all eleven C3 question dispositions and 23 later acceptance cases.

The design incorporates owner-provided visual references across General/CRM, Utility, Therapist, and Driver modes (header branding/avatar/bell layout, rounded card structure, scanner viewfinder with white corner brackets and green scanline, circular checkmark confirmation badges, and Driver map card anatomy) while strictly reconciling and enforcing C3 boundaries (mockup task checklists and route polyline/ETAs do not override C3 scope or unblock Utility Work).

Provider navigation remains Today / Schedule / Scan / Progress / More; CRM/general and Utility retain Today / Work / Scan / Notices / More; Driver retains Today / Trips / Scan / Map / More under dedicated `/driver` ownership. “Notices” is the compact label for C3 Messages/Notices. Manager/Owner are existing authority/correction contexts only.

The scanner opens directly, extracts a public identifier and relies on server intent/authorization/state confirmation. Permission, rejection, duplicate and uncertain-outcome recovery are specified. Attendance remains separate from service progress, with existing QR/widget/portal/recalculation/device/correction paths explicitly mapped without replacement. The exact provider sequences are unchanged: in-spa `not_started → checked_in → session_started → completed`; home service `not_started → travel_started → arrived → session_started → completed`.

CRM/general remains personal operations, not CRM administration. Utility Work remains BLOCKED: source inspection found planned-module copy, not authoritative Work data. C4 resolves Q009's labels/interactions with an unavailable page and safe return to Utility Today, never a task backend or permission bypass.

Driver design distinguishes trip transitions, external navigation and one-shot location sharing; map/CRM semantics expose timestamped snapshots, unknown/stale/error/offline states without ETA/route fabrication or continuous/background claims. Remote End Shift has separate off-site eligibility, confirmation and result states, including active Driver trip blocking and Q004 timing-policy uncertainty.

Shared connectivity distinguishes OFFLINE, RECONNECTING, REQUEST FAILED, known NOT RECORDED and unconfirmed outcomes; it never queues authoritative mutations. Install guidance covers real Android prompts and iPhone Safari manual installation. Notification setup is separate from delivery assurance. The design targets 48 CSS px controls, specified safe areas and 320–430 px phone widths, text scaling, focus, accessible labels/announcements and reduced motion. Static opaque token contrasts were calculated; rendered accessibility is not certified.

## Open questions and limitations

- Q009: **RESOLVED BY C4 SPECIFICATION** for blocked Work presentation only; capability remains blocked.
- Q001/Q002/Q006/Q011: **CARRIED TO IMPLEMENTATION** for freshness threshold, foreground cadence, worker strategy and Attendance reconciliation.
- Q003/Q007/Q010: **DEVICE TEST GATE** for background reliability, notification delivery and Maps readiness; Q007 also needs security evidence.
- Q005/Q008: **SECURITY GATE** for exact capability mappings and customer/location fields, retention/cache policy.
- Q004: **OWNER DECISION REQUIRED LATER** for exact Remote End Shift timing/policy formula.
- C4-G01: **OWNER DECISION REQUIRED LATER** before conflicting C8 work: the general repository provider helper supports a shortcut and `no_show` beyond C3's frozen sequence. C4 preserves C3; implementation must not silently remove working server behavior or fabricate intermediate history.

No runtime, browser prototype, production, installed-device, camera, Maps, push, background-location, database, deployed RPC/RLS or performance tests were performed. The 23 acceptance cases are future requirements, not passed results. Skills and official public guidance informed the specification; no generic design output, new font/icon dependency or runtime components were persisted. No database target was accessed. Production claims remain **REPOSITORY-RECORDED PRODUCTION EVIDENCE** only.

## Changed files and governance scope

- `docs/pwa/PWA-C4-UIUX-SPECIFICATION.md` — new canonical C4 design contract.
- `docs/pwa/PWA-C4-HANDOFF.md` — this delivery/status record.
- `docs/11-DECISION-LOG.md` — PWA-GOV-006 acceptance and C4 authorization.
- `AI_CONTEXT.md`, `docs/pwa/PROJECT.md`, `docs/08-DEVELOPMENT-STAGES.md`, `docs/13-PROJECT-STATUS.md` — current C4 entry points and C5+ stop gate.

Accepted C3 scope/handoff, C1/C2 evidence, historical recovery branches and unrelated Marketing history remain unchanged. Only documentation/governance files change; no application, dependency, SQL, migration, environment, Auth/RLS/Storage or deployment files change.

## Verification and publication

Starting gate: successful `git fetch origin --prune`; `git branch --show-current` returned the authorized C4 branch; `git status --short --branch` was clean; `git rev-parse HEAD`, `git rev-parse origin/main` and `git merge-base origin/main HEAD` all returned `3c069f198db8a6341b6bf27758cdbec24d344089`.

Documentation validation covers `git diff --check`, exact file scope, local Markdown links/anchors and evidence paths, table structure, screen/question/acceptance IDs, exact provider sequences, frozen C3 preservation and secret/privacy review. The final delivery includes `git status --short --branch`, `git diff --name-status 3c069f198db8a6341b6bf27758cdbec24d344089...HEAD`, `git diff --stat 3c069f198db8a6341b6bf27758cdbec24d344089...HEAD` and remote-ref confirmation after normal push. Commit-specific results are recorded after the content commit.

## Production impact and stop gate

No production access, database connection/mutation, runtime change, deployment, merge or force-push was performed. Local documentation and Git review-branch publication are the entire change. No user-visible production behavior or device readiness is claimed.

Next permitted action after publication: external review of the C4 specification. Acceptance and merge require their own applicable owner gate. **PWA-C5 was not started and remains NOT AUTHORIZED**, as do later stages. Stop after normal documentation push and final review handoff; do not implement, merge or deploy.
