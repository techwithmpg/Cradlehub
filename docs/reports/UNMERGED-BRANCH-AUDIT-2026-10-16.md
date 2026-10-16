# CradleHub Unmerged Branch Audit

## Baseline

origin/main: `f60793d205ef9599c891e763a22a7ecd3008561f`
Audit time (UTC): `2026-10-16T13:10:58.748539+00:00`

Owner authorized fetch, normal non-main pushes and WIP preservation. No merge, rebase, reset, cherry-pick, force push, branch/file/worktree deletion, migration execution, or production operation was performed in this audit.

The owner supplied a later checkpoint brief during this audit. The candidate advanced externally from `2c0e5416da5a2e18dba60f1750afd5a2cf257698` to `e07b98da0b9595ec781b41bac210ad502495f5d0`; final inventory below uses refreshed refs and records both stages. Checkpoint reconciliation is a separate stage.

## Repository State

Initial checkout: `stage/service-duration-extension` at `2c0e5416da5a2e18dba60f1750afd5a2cf257698`; clean. Final observed primary checkout: `fix/home-service-distance-pricing` at `e07b98da0b9595ec781b41bac210ad502495f5d0`; clean before report publication. Local main remains behind origin/main and was not pushed.

| Worktree | Initial branch / HEAD | Initial state | Preservation / disposition |
|---|---|---|---|
| `E:/cradlehub` | `stage/service-duration-extension` / `2c0e5416da5a2e18dba60f1750afd5a2cf257698` | clean; staged changes: none | Preserved in place; no deletion |
| `C:/Users/eleur/.codex/worktrees/booking-step4-viewport/cradlehub` | `fix/public-booking-step4-viewport` / `ace46f6d82dc277363c4efeff992f1f739103547` | clean; staged changes: none | Preserved in place; no deletion |
| `C:/Users/eleur/.codex/worktrees/crm-csr-gremlin-day/cradlehub` | `test/crm-csr-gremlin-day` / `ace46f6d82dc277363c4efeff992f1f739103547` | DIRTY; staged changes: none | `wip/preserve-test-crm-csr-gremlin-day-20261016-162215` at `1cc06281d8b55e140c8601596582ff28488e2594`; now clean |
| `C:/Users/eleur/.codex/worktrees/p1-home-service-location-review/cradlehub` | `fix/p1-home-service-location-review` / `dc3d3b4514cee8043807afabbb5c7a6b7afb1165` | clean; staged changes: none | Preserved in place; no deletion |
| `C:/Users/eleur/.codex/worktrees/service-editor-save/cradlehub` | `fix/service-editor-save` / `9d76b1bb54d0c4a1d39beed5e209b2b8019c8648` | DIRTY; staged changes: none | `wip/preserve-fix-service-editor-save-20261016-162215` at `86ebb87049327cf9f2263e7ad7e3430ba2dc69b1`; now clean |
| `E:/cradlehub/.claude/worktrees/hungry-mestorf-170c68` | `detached` / `d8ba254febab39c126ac7175b561eac65338f778` | clean; staged changes: none | Preserved in place; no deletion |
| `E:/cradlehub-baseline-regression` | `detached` / `8ccf238085e69fb450965d79279aecdb0a809e14` | UNAVAILABLE — directory absent; staged changes: none | Preserved in place; no deletion |
| `E:/cradlehub-booking-simplification` | `fix/p1-financial-safety` / `7f4274bdc3651be5a95d262aee801e82d3df4731` | UNAVAILABLE — directory absent; staged changes: none | Preserved in place; no deletion |
| `E:/cradlehub-home-service` | `fix/home-service-simplification` / `f8977cce5c1286402eed2e6805ba0428c38dc660` | UNAVAILABLE — directory absent; staged changes: none | Preserved in place; no deletion |
| `E:/cradlehub-integration` | `local/integration-testing` / `67b6dc889c3bbe105734f2f096eb92072e0414d8` | clean; staged changes: none | Preserved in place; no deletion |
| `E:/cradlehub-sheet-bridge` | `stage/c5-sheet-assimilation-bridge` / `3a96f113ca9ef82e9a7df329ced9d5b9b9b9b64f` | DIRTY; staged changes: none | `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215` at `0b3d792f2d38d5466fe2261dbbfa5910b8b7d7bc`; now clean |
| `E:/cradlehub-ui` | `stage/staff-pwa-ui-provider` / `09d69fab267ae95422b26639cde43123810d33be` | clean; staged changes: none | Preserved in place; no deletion |

Three dirty worktrees were snapshotted; all existing inspectable worktrees are clean after preservation. Three stale records reference absent directories, so their former uncommitted contents cannot be verified. Their reachable branch commits were preserved normally. Detached registered heads were checked against accepted history.

### Relevant ignored material

Ignored caches/dependencies and generated Next declarations were excluded. Environment files and a local Chrome profile (including cookie/session databases) were not read or published. `.codex-backups/`, ignored service-image artifacts and local deliverables remain on disk. Five ignored source-copy directories under `.claude/worktrees/` have no `.git` metadata: `cool-perlman-aefac4`, `global-brand-logo`, `infallible-shamir-de05fe`, `nice-hugle-0e0571`, `stoic-bartik-c9a102`. These are not registered Git worktrees; their source/base/ownership is UNKNOWN. No claim that these archives are remotely preserved is made. Owner inventory decision is required before any publication of their contents. No ignored file was force-added.

## Remote Preservation

SHA comparison uses live `git ls-remote --heads origin` after normal pushes. The report branch is published separately and its final SHA is reported in the terminal handoff (a report cannot contain its own commit hash).

| Branch | Local SHA | Remote SHA | Match | Status |
|---|---|---|---|---|
| `backup/booking-simplification-pre-consolidation-2026-09-30` | `f678f0f1ff74722f250879a457aa0b5cbb6da13f` | `f678f0f1ff74722f250879a457aa0b5cbb6da13f` | YES | Pushed missing branch |
| `fix/attendance-new-day-provisional-close` | `47641bf19da1afe4db9430d38343ad1c2489ca31` | `47641bf19da1afe4db9430d38343ad1c2489ca31` | YES | Already matched |
| `fix/booking-safety-pass-1` | `da270c88e4b59fe4e74ba63532774c015ab4f367` | `da270c88e4b59fe4e74ba63532774c015ab4f367` | YES | Pushed missing branch |
| `fix/crm-grouped-order-display` | `38a99c1304f8a77203f05d73429dfb1cccee5e7c` | `38a99c1304f8a77203f05d73429dfb1cccee5e7c` | YES | Already matched |
| `fix/crm-therapist-assignment-provenance` | `bc2ade3cbca54eb2cbd6d362d2bc70a70dbb6cac` | `bc2ade3cbca54eb2cbd6d362d2bc70a70dbb6cac` | YES | Already matched |
| `fix/front-desk-booking-source-shift-handover` | `7dc09d26573ddd2674a05bfad2e6cee842d09a69` | `7dc09d26573ddd2674a05bfad2e6cee842d09a69` | YES | Already matched |
| `fix/home-service-distance-pricing` | `e07b98da0b9595ec781b41bac210ad502495f5d0` | `e07b98da0b9595ec781b41bac210ad502495f5d0` | YES | Externally added / verified current remote |
| `fix/home-service-simplification` | `f8977cce5c1286402eed2e6805ba0428c38dc660` | `f8977cce5c1286402eed2e6805ba0428c38dc660` | YES | Pushed missing branch |
| `fix/p0-booking-progress-rpc-access` | `8ddbf975a6e2f6386af37465d6c49531a457591c` | `8ddbf975a6e2f6386af37465d6c49531a457591c` | YES | Pushed missing branch |
| `fix/p0-online-booking-crm-confirmation` | `8f414149bfe31e39a9bcfc050514e334bc5e8d74` | `8f414149bfe31e39a9bcfc050514e334bc5e8d74` | YES | Pushed missing branch |
| `fix/p0-schedule-rpc-security` | `0f157657f78b13f1752ea89f9812c3df9cbd975f` | `0f157657f78b13f1752ea89f9812c3df9cbd975f` | YES | Already matched |
| `fix/p1-booking-confirmation-home-service` | `3fa7bdb825becd24d812c509b5187ef3388fa60f` | `3fa7bdb825becd24d812c509b5187ef3388fa60f` | YES | Already matched |
| `fix/p1-cash-flow-business-date-scope` | `eca8cff0a3c70686cbc63a4994d84491181ce649` | `eca8cff0a3c70686cbc63a4994d84491181ce649` | YES | Already matched |
| `fix/p1-core-crm-readiness-payment-mobile` | `6a310021df66679d71daf753434e6c328e3181b4` | `6a310021df66679d71daf753434e6c328e3181b4` | YES | Pushed missing branch |
| `fix/p1-crm-csr-readiness` | `310dbbeba9954688d2e5034e40212cea60488fd8` | `310dbbeba9954688d2e5034e40212cea60488fd8` | YES | Pushed missing branch |
| `fix/p1-financial-safety` | `7f4274bdc3651be5a95d262aee801e82d3df4731` | `7f4274bdc3651be5a95d262aee801e82d3df4731` | YES | Pushed missing branch |
| `fix/p1-future-booking-visibility` | `6fc354f1954c6cafcceb78b9eb857d85ea2c2ddc` | `6fc354f1954c6cafcceb78b9eb857d85ea2c2ddc` | YES | Already matched |
| `fix/p1-future-bookings-map-master-sheet-integration` | `956d09ac2b514e9349ab8db696673a51eb6fdd63` | `956d09ac2b514e9349ab8db696673a51eb6fdd63` | YES | Already matched |
| `fix/p1-google-sitemap` | `158320b274ccf355097e0a034d798de72dd55d2d` | `158320b274ccf355097e0a034d798de72dd55d2d` | YES | Already matched |
| `fix/p1-home-service-customer-location` | `62886b4f365d496f51fb0a088da590b5f1ac4931` | `62886b4f365d496f51fb0a088da590b5f1ac4931` | YES | Pushed missing branch |
| `fix/p1-home-service-global-map-master-sheet-live` | `3424ce884958d86a8c2de17de73053f059c64960` | `3424ce884958d86a8c2de17de73053f059c64960` | YES | Already matched |
| `fix/p1-home-service-location-review` | `dc3d3b4514cee8043807afabbb5c7a6b7afb1165` | `dc3d3b4514cee8043807afabbb5c7a6b7afb1165` | YES | Already matched |
| `fix/p1-workspace-navigation-retention` | `1b65e7948235ae2573859b48f0f9c7b2419217aa` | `1b65e7948235ae2573859b48f0f9c7b2419217aa` | YES | Pushed fast-forward |
| `fix/p1-workspace-navigation-retention-local-draft` | `0f157657f78b13f1752ea89f9812c3df9cbd975f` | `0f157657f78b13f1752ea89f9812c3df9cbd975f` | YES | Pushed missing branch |
| `fix/p1-workspace-navigation-retention-reconcile` | `17ad86131633671f373ced645944790d893de1f0` | `17ad86131633671f373ced645944790d893de1f0` | YES | Pushed missing branch |
| `fix/p2-staff-pwa-brand-icon-refresh` | `b7337070641a44f47ef715796d94557e2773b8e1` | `b7337070641a44f47ef715796d94557e2773b8e1` | YES | Already matched |
| `fix/public-booking-mobile-step2` | `eb55d5fc380890abbccccb09a0387695877696af` | `eb55d5fc380890abbccccb09a0387695877696af` | YES | Pushed missing branch |
| `fix/public-booking-step4-viewport` | `ace46f6d82dc277363c4efeff992f1f739103547` | `ace46f6d82dc277363c4efeff992f1f739103547` | YES | Pushed missing branch |
| `fix/service-editor-save` | `9d76b1bb54d0c4a1d39beed5e209b2b8019c8648` | `9d76b1bb54d0c4a1d39beed5e209b2b8019c8648` | YES | Pushed missing branch |
| `local/integration-testing` | `67b6dc889c3bbe105734f2f096eb92072e0414d8` | `67b6dc889c3bbe105734f2f096eb92072e0414d8` | YES | Pushed missing branch |
| `main` | `d8afcf52fa66f6e35a0f5226808badc93c6093a4` | `f60793d205ef9599c891e763a22a7ecd3008561f` | NO | main excluded from pushes |
| `stage/12-desktop-authority-endpoints` | `f43d08bb78949ba577019bfe0c5d8ed76d496196` | `f43d08bb78949ba577019bfe0c5d8ed76d496196` | YES | Pushed missing branch |
| `stage/bkg-home-service-simplification` | `92fa6bd1e8fa012c7cc21030760f55c08dca586b` | `92fa6bd1e8fa012c7cc21030760f55c08dca586b` | YES | Pushed missing branch |
| `stage/c1-truth-consolidation` | `bde990de12b8b5b37b3594dfa925c6eef680d196` | `bde990de12b8b5b37b3594dfa925c6eef680d196` | YES | Already matched |
| `stage/c5-cf2-central-ledger` | `0c222a591dc705f935939cd34b59ab615ab92fac` | `0c222a591dc705f935939cd34b59ab615ab92fac` | YES | Already matched |
| `stage/c5-sheet-assimilation-bridge` | `3a96f113ca9ef82e9a7df329ced9d5b9b9b9b64f` | `3a96f113ca9ef82e9a7df329ced9d5b9b9b9b64f` | YES | Already matched |
| `stage/crm-multi-attendee-booking` | `1762d87ff637b77e7001a84beb34d90e0e58e37c` | `1762d87ff637b77e7001a84beb34d90e0e58e37c` | YES | Pushed missing branch |
| `stage/crm-performance-stabilization` | `9e0361acab651e1a6038e5f500c9156a168f43bd` | `9e0361acab651e1a6038e5f500c9156a168f43bd` | YES | Pushed missing branch |
| `stage/master-sheet-readonly-projection` | `b5bc8d19a85c1725c16724caa2606b68b4c4c79b` | `b5bc8d19a85c1725c16724caa2606b68b4c4c79b` | YES | Already matched |
| `stage/owner-reports-rebuild` | `8a13018ddcdd30e1b973249737e521e5df9b344d` | `8a13018ddcdd30e1b973249737e521e5df9b344d` | YES | Already matched |
| `stage/pwa-c2-structured-diagnostics` | `1ea191f3ebedccda6a2249f3ee8f1b53d5e6791a` | `1ea191f3ebedccda6a2249f3ee8f1b53d5e6791a` | YES | Already matched |
| `stage/service-catalog-consolidation` | `0f01999c247dc0037e0716291ca5686eedfe34fd` | `0f01999c247dc0037e0716291ca5686eedfe34fd` | YES | Pushed missing branch |
| `stage/service-duration-extension` | `2c0e5416da5a2e18dba60f1750afd5a2cf257698` | `2c0e5416da5a2e18dba60f1750afd5a2cf257698` | YES | Already matched |
| `stage/staff-pwa-native-foundation-crm` | `8e71d35d2c66ef87dd33bd2f2f54701aad851d2c` | `8e71d35d2c66ef87dd33bd2f2f54701aad851d2c` | YES | Pushed missing branch |
| `stage/staff-pwa-native-foundation-driver` | `2585a18fd048311f35f4236e0c805aff171eb525` | `2585a18fd048311f35f4236e0c805aff171eb525` | YES | Pushed missing branch |
| `stage/staff-pwa-native-foundation-provider` | `2d5efae9ee1b3a8e323a53cd7556c85238a78b60` | `2d5efae9ee1b3a8e323a53cd7556c85238a78b60` | YES | Already matched |
| `stage/staff-pwa-native-foundation-utility` | `a02881def75362ae4ccda5b9b731b075d66887c6` | `a02881def75362ae4ccda5b9b731b075d66887c6` | YES | Already matched |
| `stage/staff-pwa-native-integration` | `db3d48f6d1cad8bca4a418acea5424d4ce839a62` | `db3d48f6d1cad8bca4a418acea5424d4ce839a62` | YES | Already matched |
| `stage/staff-pwa-ui-provider` | `09d69fab267ae95422b26639cde43123810d33be` | `09d69fab267ae95422b26639cde43123810d33be` | YES | Pushed missing branch |
| `stage/web-checkpoint-integration-20261016` | `—` | `e07b98da0b9595ec781b41bac210ad502495f5d0` | REMOTE ONLY | Externally added / verified current remote |
| `stage/web-release-integration` | `130060a0f8b6b877fab79a7945df706aabee3d5c` | `130060a0f8b6b877fab79a7945df706aabee3d5c` | YES | Already matched |
| `test/crm-csr-gremlin-day` | `ace46f6d82dc277363c4efeff992f1f739103547` | `ace46f6d82dc277363c4efeff992f1f739103547` | YES | Pushed missing branch |
| `wip/preserve-fix-service-editor-save-20261016-162215` | `86ebb87049327cf9f2263e7ad7e3430ba2dc69b1` | `86ebb87049327cf9f2263e7ad7e3430ba2dc69b1` | YES | Already matched |
| `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215` | `0b3d792f2d38d5466fe2261dbbfa5910b8b7d7bc` | `0b3d792f2d38d5466fe2261dbbfa5910b8b7d7bc` | YES | Already matched |
| `wip/preserve-test-crm-csr-gremlin-day-20261016-162215` | `1cc06281d8b55e140c8601596582ff28488e2594` | `1cc06281d8b55e140c8601596582ff28488e2594` | YES | Already matched |
| `wip/sm-emergency-snapshot-20261016-122654` | `0f134b8675b08416e0d5b34ab0045d4ef55f8640` | `0f134b8675b08416e0d5b34ab0045d4ef55f8640` | YES | Already matched |

No local/remote divergence was resolved. No force push was used. All non-main local branch tips in this inventory match their named remote branch. Nine newly outbound blobs were scanned for common credential/private-key patterns before normal branch publication; no matches. This is not a comprehensive historical secret audit.

## Release Candidate Chain

| Branch | HEAD | Parent/base of stage | Commits since preceding stage | Contained in next |
|---|---|---|---|---|
| `stage/crm-performance-stabilization` | `9e0361acab651e1a6038e5f500c9156a168f43bd` | `f60793d205ef9599c891e763a22a7ecd3008561f` | `d2c5d352a9472217418b714bd72241f6f9cc5bdc`, `4010433baed420c94d316159f21e59c1aedc0074`, `e0c199e64fc599efb5a68441dd282b3902e93259`, `38c120a24b024b1c03fa55fb67041ddfebb1ab8e`, `99b9d88cd59464b3bd6a1057a8ed1a78bfde2902`, `b0596036d1e10a0229188084e2f9e20dcd07a043`, `6a90e011b01f05076aa076767c33589e5ff6f24a`, `9e0361acab651e1a6038e5f500c9156a168f43bd` | YES |
| `stage/service-catalog-consolidation` | `0f01999c247dc0037e0716291ca5686eedfe34fd` | `9e0361acab651e1a6038e5f500c9156a168f43bd` | `86598629ead26b219724aefb45ee408c58da5d9c`, `0f01999c247dc0037e0716291ca5686eedfe34fd` | YES |
| `stage/crm-multi-attendee-booking` | `1762d87ff637b77e7001a84beb34d90e0e58e37c` | `0f01999c247dc0037e0716291ca5686eedfe34fd` | `7cdb3a8eb3934ed820468e7cdb8cec2fa2defc39`, `152bfa786fe4f4fae259b46dcc0cab2020b3c50a`, `1762d87ff637b77e7001a84beb34d90e0e58e37c` | YES |
| `fix/crm-grouped-order-display` | `38a99c1304f8a77203f05d73429dfb1cccee5e7c` | `1762d87ff637b77e7001a84beb34d90e0e58e37c` | `38a99c1304f8a77203f05d73429dfb1cccee5e7c` | YES |
| `fix/crm-therapist-assignment-provenance` | `bc2ade3cbca54eb2cbd6d362d2bc70a70dbb6cac` | `38a99c1304f8a77203f05d73429dfb1cccee5e7c` | `bc2ade3cbca54eb2cbd6d362d2bc70a70dbb6cac` | YES |
| `stage/service-duration-extension` | `2c0e5416da5a2e18dba60f1750afd5a2cf257698` | `bc2ade3cbca54eb2cbd6d362d2bc70a70dbb6cac` | `691d43f8bb7b5b6a54a14e64cdca0afa5075b6cd`, `2c0e5416da5a2e18dba60f1750afd5a2cf257698` | YES |
| `fix/home-service-distance-pricing` | `e07b98da0b9595ec781b41bac210ad502495f5d0` | `2c0e5416da5a2e18dba60f1750afd5a2cf257698` | `a2c942b1961f79520729527f15e5a665594585ea`, `2cfcde33aca195b970c85d426b36dfedc0ad62f6`, `35530e3b15504cadc0f46a44c83d83edf10fcebf`, `84d7b3f7ce4e40b9957559581efe085236039a08`, `e07b98da0b9595ec781b41bac210ad502495f5d0` | YES |
| `stage/web-checkpoint-integration-20261016` | `e07b98da0b9595ec781b41bac210ad502495f5d0` | `e07b98da0b9595ec781b41bac210ad502495f5d0` | None; same tip | Latest |

## Current Best Candidate

BRANCH: `stage/web-checkpoint-integration-20261016`
SHA: `e07b98da0b9595ec781b41bac210ad502495f5d0`

Git proves `f60793d205ef9599c891e763a22a7ecd3008561f` is an ancestor. The checkpoint ref and `fix/home-service-distance-pricing` are identical. This establishes cumulative ancestry only, not release approval or functional acceptance.

## Complete Branch Classification

Categories: A release-candidate chain; B earlier ancestor/equivalent contained in candidate; C independent unique fix/feature; D WIP preservation only; E documentation/audit only; F experiment/unknown ownership; G already merged into main. Exactly one category is assigned per branch name. Counts exclude this report branch; local and remote names are deduplicated. Ahead/behind are commit counts versus current origin/main; merged means exact Git ancestry, not patch equivalence. Merge count covers only main..branch.

| Branch | Category | Merge base with main | Ahead | Behind | Merged | Contained in candidate | Merge commits |
|---|---|---|---|---|---|---|---|
| `backup/booking-simplification-pre-consolidation-2026-09-30` | G | `f678f0f1ff74722f250879a457aa0b5cbb6da13f` | 0 | 91 | YES | YES | 0 |
| `fix/attendance-new-day-provisional-close` | C | `20964e17ac0e52538fcdab163a5a8d3405ecae11` | 1 | 145 | NO | NO | 0 |
| `fix/booking-safety-pass-1` | C | `f8977cce5c1286402eed2e6805ba0428c38dc660` | 1 | 144 | NO | NO | 0 |
| `fix/crm-grouped-order-display` | B | `f60793d205ef9599c891e763a22a7ecd3008561f` | 14 | 0 | NO | YES | 0 |
| `fix/crm-therapist-assignment-provenance` | B | `f60793d205ef9599c891e763a22a7ecd3008561f` | 15 | 0 | NO | YES | 0 |
| `fix/front-desk-booking-source-shift-handover` | G | `7dc09d26573ddd2674a05bfad2e6cee842d09a69` | 0 | 36 | YES | YES | 0 |
| `fix/home-service-distance-pricing` | B | `f60793d205ef9599c891e763a22a7ecd3008561f` | 22 | 0 | NO | YES | 0 |
| `fix/home-service-simplification` | G | `f8977cce5c1286402eed2e6805ba0428c38dc660` | 0 | 144 | YES | YES | 0 |
| `fix/p0-booking-progress-rpc-access` | G | `8ddbf975a6e2f6386af37465d6c49531a457591c` | 0 | 25 | YES | YES | 0 |
| `fix/p0-online-booking-crm-confirmation` | G | `8f414149bfe31e39a9bcfc050514e334bc5e8d74` | 0 | 23 | YES | YES | 0 |
| `fix/p0-schedule-rpc-security` | G | `0f157657f78b13f1752ea89f9812c3df9cbd975f` | 0 | 21 | YES | YES | 0 |
| `fix/p1-booking-confirmation-home-service` | G | `3fa7bdb825becd24d812c509b5187ef3388fa60f` | 0 | 55 | YES | YES | 0 |
| `fix/p1-cash-flow-business-date-scope` | C | `4c55519ee5bb16ca000a92f35b04671911743f7a` | 1 | 38 | NO | NO | 0 |
| `fix/p1-core-crm-readiness-payment-mobile` | G | `6a310021df66679d71daf753434e6c328e3181b4` | 0 | 59 | YES | YES | 0 |
| `fix/p1-crm-csr-readiness` | G | `310dbbeba9954688d2e5034e40212cea60488fd8` | 0 | 61 | YES | YES | 0 |
| `fix/p1-financial-safety` | G | `7f4274bdc3651be5a95d262aee801e82d3df4731` | 0 | 72 | YES | YES | 0 |
| `fix/p1-future-booking-visibility` | C | `d8afcf52fa66f6e35a0f5226808badc93c6093a4` | 1 | 7 | NO | NO | 0 |
| `fix/p1-future-bookings-map-master-sheet-integration` | G | `956d09ac2b514e9349ab8db696673a51eb6fdd63` | 0 | 1 | YES | YES | 0 |
| `fix/p1-google-sitemap` | C | `18216622422a760ec015f22515c93cf99102d6a5` | 1 | 329 | NO | NO | 0 |
| `fix/p1-home-service-customer-location` | G | `62886b4f365d496f51fb0a088da590b5f1ac4931` | 0 | 34 | YES | YES | 0 |
| `fix/p1-home-service-global-map-master-sheet-live` | G | `3424ce884958d86a8c2de17de73053f059c64960` | 0 | 5 | YES | YES | 0 |
| `fix/p1-home-service-location-review` | G | `dc3d3b4514cee8043807afabbb5c7a6b7afb1165` | 0 | 34 | YES | YES | 0 |
| `fix/p1-workspace-navigation-retention` | C | `0f157657f78b13f1752ea89f9812c3df9cbd975f` | 35 | 21 | NO | NO | 0 |
| `fix/p1-workspace-navigation-retention-local-draft` | G | `0f157657f78b13f1752ea89f9812c3df9cbd975f` | 0 | 21 | YES | YES | 0 |
| `fix/p1-workspace-navigation-retention-reconcile` | C | `0f157657f78b13f1752ea89f9812c3df9cbd975f` | 34 | 21 | NO | NO | 0 |
| `fix/p2-staff-pwa-brand-icon-refresh` | G | `b7337070641a44f47ef715796d94557e2773b8e1` | 0 | 20 | YES | YES | 0 |
| `fix/public-booking-mobile-step2` | G | `eb55d5fc380890abbccccb09a0387695877696af` | 0 | 70 | YES | YES | 0 |
| `fix/public-booking-step4-viewport` | G | `ace46f6d82dc277363c4efeff992f1f739103547` | 0 | 66 | YES | YES | 0 |
| `fix/service-editor-save` | C | `03242a0bfbcfe6c4b1b03ba624510004cae7cc6a` | 1 | 130 | NO | NO | 0 |
| `local/integration-testing` | F | `66320d82b657507fc12f7a2090c1e202160c4e14` | 1 | 58 | NO | NO | 1 |
| `main` | G | `d8afcf52fa66f6e35a0f5226808badc93c6093a4` | 0 | 7 | YES | YES | 0 |
| `stage/12-desktop-authority-endpoints` | G | `f43d08bb78949ba577019bfe0c5d8ed76d496196` | 0 | 181 | YES | YES | 0 |
| `stage/bkg-home-service-simplification` | G | `92fa6bd1e8fa012c7cc21030760f55c08dca586b` | 0 | 142 | YES | YES | 0 |
| `stage/c1-truth-consolidation` | E | `4f9291c7d457ec49b071e766df4c23ca1e4f1558` | 1 | 330 | NO | NO | 0 |
| `stage/c5-cf2-central-ledger` | C | `f8977cce5c1286402eed2e6805ba0428c38dc660` | 3 | 144 | NO | NO | 0 |
| `stage/c5-sheet-assimilation-bridge` | C | `f8977cce5c1286402eed2e6805ba0428c38dc660` | 6 | 144 | NO | NO | 0 |
| `stage/crm-multi-attendee-booking` | B | `f60793d205ef9599c891e763a22a7ecd3008561f` | 13 | 0 | NO | YES | 0 |
| `stage/crm-performance-stabilization` | B | `f60793d205ef9599c891e763a22a7ecd3008561f` | 8 | 0 | NO | YES | 0 |
| `stage/master-sheet-readonly-projection` | G | `b5bc8d19a85c1725c16724caa2606b68b4c4c79b` | 0 | 47 | YES | YES | 0 |
| `stage/owner-reports-rebuild` | G | `8a13018ddcdd30e1b973249737e521e5df9b344d` | 0 | 45 | YES | YES | 0 |
| `stage/pwa-c2-structured-diagnostics` | E | `2b927303d2d6bc10b09a15f2542fdcfa6c066194` | 5 | 185 | NO | NO | 0 |
| `stage/service-catalog-consolidation` | B | `f60793d205ef9599c891e763a22a7ecd3008561f` | 10 | 0 | NO | YES | 0 |
| `stage/service-duration-extension` | B | `f60793d205ef9599c891e763a22a7ecd3008561f` | 17 | 0 | NO | YES | 0 |
| `stage/staff-pwa-native-foundation-crm` | G | `8e71d35d2c66ef87dd33bd2f2f54701aad851d2c` | 0 | 11 | YES | YES | 0 |
| `stage/staff-pwa-native-foundation-driver` | G | `2585a18fd048311f35f4236e0c805aff171eb525` | 0 | 13 | YES | YES | 0 |
| `stage/staff-pwa-native-foundation-provider` | G | `2d5efae9ee1b3a8e323a53cd7556c85238a78b60` | 0 | 17 | YES | YES | 0 |
| `stage/staff-pwa-native-foundation-utility` | G | `a02881def75362ae4ccda5b9b731b075d66887c6` | 0 | 15 | YES | YES | 0 |
| `stage/staff-pwa-native-integration` | G | `db3d48f6d1cad8bca4a418acea5424d4ce839a62` | 0 | 8 | YES | YES | 0 |
| `stage/staff-pwa-ui-provider` | G | `09d69fab267ae95422b26639cde43123810d33be` | 0 | 164 | YES | YES | 0 |
| `stage/web-checkpoint-integration-20261016` | A | `f60793d205ef9599c891e763a22a7ecd3008561f` | 22 | 0 | NO | YES | 0 |
| `stage/web-release-integration` | G | `130060a0f8b6b877fab79a7945df706aabee3d5c` | 0 | 27 | YES | YES | 0 |
| `test/crm-csr-gremlin-day` | G | `ace46f6d82dc277363c4efeff992f1f739103547` | 0 | 66 | YES | YES | 0 |
| `wip/preserve-fix-service-editor-save-20261016-162215` | D | `03242a0bfbcfe6c4b1b03ba624510004cae7cc6a` | 2 | 130 | NO | NO | 0 |
| `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215` | D | `f8977cce5c1286402eed2e6805ba0428c38dc660` | 7 | 144 | NO | NO | 0 |
| `wip/preserve-test-crm-csr-gremlin-day-20261016-162215` | D | `ace46f6d82dc277363c4efeff992f1f739103547` | 1 | 66 | NO | NO | 0 |
| `wip/sm-emergency-snapshot-20261016-122654` | D | `f60793d205ef9599c891e763a22a7ecd3008561f` | 17 | 0 | NO | NO | 0 |

## Branches Fully Contained in Current Candidate

| Branch | SHA | Relationship |
|---|---|---|
| `backup/booking-simplification-pre-consolidation-2026-09-30` | `f678f0f1ff74722f250879a457aa0b5cbb6da13f` | Already in accepted main |
| `fix/crm-grouped-order-display` | `38a99c1304f8a77203f05d73429dfb1cccee5e7c` | Exact ancestor/equal; no merge needed |
| `fix/crm-therapist-assignment-provenance` | `bc2ade3cbca54eb2cbd6d362d2bc70a70dbb6cac` | Exact ancestor/equal; no merge needed |
| `fix/front-desk-booking-source-shift-handover` | `7dc09d26573ddd2674a05bfad2e6cee842d09a69` | Already in accepted main |
| `fix/home-service-distance-pricing` | `e07b98da0b9595ec781b41bac210ad502495f5d0` | Exact ancestor/equal; no merge needed |
| `fix/home-service-simplification` | `f8977cce5c1286402eed2e6805ba0428c38dc660` | Already in accepted main |
| `fix/p0-booking-progress-rpc-access` | `8ddbf975a6e2f6386af37465d6c49531a457591c` | Already in accepted main |
| `fix/p0-online-booking-crm-confirmation` | `8f414149bfe31e39a9bcfc050514e334bc5e8d74` | Already in accepted main |
| `fix/p0-schedule-rpc-security` | `0f157657f78b13f1752ea89f9812c3df9cbd975f` | Already in accepted main |
| `fix/p1-booking-confirmation-home-service` | `3fa7bdb825becd24d812c509b5187ef3388fa60f` | Already in accepted main |
| `fix/p1-core-crm-readiness-payment-mobile` | `6a310021df66679d71daf753434e6c328e3181b4` | Already in accepted main |
| `fix/p1-crm-csr-readiness` | `310dbbeba9954688d2e5034e40212cea60488fd8` | Already in accepted main |
| `fix/p1-financial-safety` | `7f4274bdc3651be5a95d262aee801e82d3df4731` | Already in accepted main |
| `fix/p1-future-bookings-map-master-sheet-integration` | `956d09ac2b514e9349ab8db696673a51eb6fdd63` | Already in accepted main |
| `fix/p1-home-service-customer-location` | `62886b4f365d496f51fb0a088da590b5f1ac4931` | Already in accepted main |
| `fix/p1-home-service-global-map-master-sheet-live` | `3424ce884958d86a8c2de17de73053f059c64960` | Already in accepted main |
| `fix/p1-home-service-location-review` | `dc3d3b4514cee8043807afabbb5c7a6b7afb1165` | Already in accepted main |
| `fix/p1-workspace-navigation-retention-local-draft` | `0f157657f78b13f1752ea89f9812c3df9cbd975f` | Already in accepted main |
| `fix/p2-staff-pwa-brand-icon-refresh` | `b7337070641a44f47ef715796d94557e2773b8e1` | Already in accepted main |
| `fix/public-booking-mobile-step2` | `eb55d5fc380890abbccccb09a0387695877696af` | Already in accepted main |
| `fix/public-booking-step4-viewport` | `ace46f6d82dc277363c4efeff992f1f739103547` | Already in accepted main |
| `stage/12-desktop-authority-endpoints` | `f43d08bb78949ba577019bfe0c5d8ed76d496196` | Already in accepted main |
| `stage/bkg-home-service-simplification` | `92fa6bd1e8fa012c7cc21030760f55c08dca586b` | Already in accepted main |
| `stage/crm-multi-attendee-booking` | `1762d87ff637b77e7001a84beb34d90e0e58e37c` | Exact ancestor/equal; no merge needed |
| `stage/crm-performance-stabilization` | `9e0361acab651e1a6038e5f500c9156a168f43bd` | Exact ancestor/equal; no merge needed |
| `stage/master-sheet-readonly-projection` | `b5bc8d19a85c1725c16724caa2606b68b4c4c79b` | Already in accepted main |
| `stage/owner-reports-rebuild` | `8a13018ddcdd30e1b973249737e521e5df9b344d` | Already in accepted main |
| `stage/service-catalog-consolidation` | `0f01999c247dc0037e0716291ca5686eedfe34fd` | Exact ancestor/equal; no merge needed |
| `stage/service-duration-extension` | `2c0e5416da5a2e18dba60f1750afd5a2cf257698` | Exact ancestor/equal; no merge needed |
| `stage/staff-pwa-native-foundation-crm` | `8e71d35d2c66ef87dd33bd2f2f54701aad851d2c` | Already in accepted main |
| `stage/staff-pwa-native-foundation-driver` | `2585a18fd048311f35f4236e0c805aff171eb525` | Already in accepted main |
| `stage/staff-pwa-native-foundation-provider` | `2d5efae9ee1b3a8e323a53cd7556c85238a78b60` | Already in accepted main |
| `stage/staff-pwa-native-foundation-utility` | `a02881def75362ae4ccda5b9b731b075d66887c6` | Already in accepted main |
| `stage/staff-pwa-native-integration` | `db3d48f6d1cad8bca4a418acea5424d4ce839a62` | Already in accepted main |
| `stage/staff-pwa-ui-provider` | `09d69fab267ae95422b26639cde43123810d33be` | Already in accepted main |
| `stage/web-release-integration` | `130060a0f8b6b877fab79a7945df706aabee3d5c` | Already in accepted main |
| `test/crm-csr-gremlin-day` | `ace46f6d82dc277363c4efeff992f1f739103547` | Already in accepted main |

No branch deletion is recommended.

## Independent Unique Work

Unique means reachable from branch but neither current candidate nor main. The same commit may be shared by multiple independent branches. Every unique commit is detailed in the appendix with changed paths and diff-derived scope.

### fix/attendance-new-day-provisional-close
- HEAD: `47641bf19da1afe4db9430d38343ad1c2489ca31`; merge base: `20964e17ac0e52538fcdab163a5a8d3405ecae11`; category: **C**.
- Unique commits (1): `47641bf19da1afe4db9430d38343ad1c2489ca31`
- Purpose / review finding: Scan-engine delta allows a current-day shift to be evaluated after one prior-day provisional close; multiple prior-day candidates remain reviewable/ambiguous. Attendance mutation and day-boundary behavior require independent review.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
M	src/lib/attendance/scan-engine.ts
A	tests/lib/attendance/a01-new-business-day-provisional-close.test.ts
M	tests/lib/attendance/crm-closing-policy-migration.test.ts
```

### fix/booking-safety-pass-1
- HEAD: `da270c88e4b59fe4e74ba63532774c015ab4f367`; merge base: `f8977cce5c1286402eed2e6805ba0428c38dc660`; category: **C**.
- Unique commits (1): `da270c88e4b59fe4e74ba63532774c015ab4f367`
- Purpose / review finding: Payment confirmation reads a frozen payable amount and checks cumulative payment; reconciliation and dispatch reads fail closed. Inspect against later atomic financial and booking authority before reuse.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
M	src/app/(dashboard)/crm/bookings/actions.ts
M	src/app/(dashboard)/crm/reconciliation/actions.ts
M	src/lib/bookings/dispatch-conflict.ts
M	src/lib/bookings/payment-gate.ts
A	tests/app/crm/confirm-payment-action.test.ts
A	tests/app/crm/reconciliation-actions.test.ts
A	tests/lib/bookings/dispatch-conflict.test.ts
M	tests/lib/bookings/payment-gate.test.ts
```

### fix/p1-cash-flow-business-date-scope
- HEAD: `eca8cff0a3c70686cbc63a4994d84491181ce649`; merge base: `4c55519ee5bb16ca000a92f35b04671911743f7a`; category: **C**.
- Unique commits (1): `eca8cff0a3c70686cbc63a4994d84491181ce649`
- Purpose / review finding: Ledger/activity use selected business-date rows while session cash calculation retains historical session transactions. Query delta is independently reviewable; do not merge stale branch wholesale.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
M	src/lib/cash-flow/cash-flow-queries.ts
M	tests/lib/cash-flow/cash-flow-mixed-read-model.test.ts
M	tests/lib/cash-flow/payment-reconciliation-ui.test.tsx
```

### fix/p1-future-booking-visibility
- HEAD: `6fc354f1954c6cafcceb78b9eb857d85ea2c2ddc`; merge base: `d8afcf52fa66f6e35a0f5226808badc93c6093a4`; category: **C**.
- Unique commits (1): `6fc354f1954c6cafcceb78b9eb857d85ea2c2ddc`
- Purpose / review finding: Adds future booking reads, 14-day filtering, confirmation result routing and upcoming UI. Its SHA is not an ancestor; later main integration contains overlapping behavior. Unique history does not prove missing functionality.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
M	src/app/(dashboard)/crm/bookings/actions.ts
M	src/app/(dashboard)/crm/bookings/page.tsx
M	src/app/(dashboard)/crm/dispatch/page.tsx
M	src/app/(dashboard)/crm/today/actions.ts
M	src/app/(dashboard)/crm/today/page.tsx
M	src/app/api/crm/bookings/route.ts
M	src/components/features/bookings/booking-followup-modal.tsx
M	src/components/features/bookings/booking-list-row.tsx
M	src/components/features/bookings/bookings-desktop-list.tsx
M	src/components/features/bookings/bookings-desktop-workspace.tsx
M	src/components/features/bookings/bookings-list-toolbar.tsx
M	src/components/features/bookings/bookings-quick-filters.tsx
M	src/components/features/bookings/bookings-table.tsx
M	src/components/features/bookings/bookings-workspace.tsx
M	src/components/features/bookings/crm-bookings-view.tsx
M	src/components/features/bookings/selected-booking-primary-action.tsx
M	src/components/features/crm/today/cradle-flow-booking-dialog.tsx
M	src/components/features/crm/today/cradle-flow-dashboard.tsx
M	src/components/features/crm/today/cradle-flow-display.ts
M	src/components/features/crm/today/cradle-flow-ticket.tsx
M	src/components/features/crm/today/cradle-flow-workflow.tsx
M	src/components/features/dispatch/dispatch-flow-tab.tsx
M	src/components/features/dispatch/dispatch-workspace.tsx
M	src/lib/actions/dispatch-data-actions.ts
M	src/lib/bookings/bookings-workspace-filters.ts
M	src/lib/bookings/crm-booking-operations.ts
A	src/lib/bookings/upcoming-bookings.ts
M	src/lib/crm/cradle-flow.ts
M	src/lib/queries/bookings.ts
M	src/lib/queries/dispatch-queries.ts
M	tests/lib/bookings/bookings-workspace-filters.test.ts
A	tests/lib/bookings/crm-bookings-page.test.tsx
A	tests/lib/bookings/crm-dispatch-deep-link.test.ts
A	tests/lib/bookings/upcoming-bookings.test.ts
A	tests/lib/bookings/upcoming-dispatch.test.ts
M	tests/lib/crm/cradle-flow-display.test.ts
```

### fix/p1-google-sitemap
- HEAD: `158320b274ccf355097e0a034d798de72dd55d2d`; merge base: `18216622422a760ec015f22515c93cf99102d6a5`; category: **C**.
- Unique commits (1): `158320b274ccf355097e0a034d798de72dd55d2d`
- Purpose / review finding: Replaces individual metadata-bearing sitemap entries with PUBLIC_PAGES mapping. Public SEO delta; intended ownership/acceptance UNKNOWN.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
M	src/app/sitemap.ts
```

### fix/p1-workspace-navigation-retention
- HEAD: `1b65e7948235ae2573859b48f0f9c7b2419217aa`; merge base: `0f157657f78b13f1752ea89f9812c3df9cbd975f`; category: **C**.
- Unique commits (35): `98a17d3f3fd311c0e6eb2179e73def1826a3d9b5`, `55c70ff3cabd5975e1ae4aa05741b8ba5483e8ad`, `7d63143182caed49c6ac25adc310e38f131282c6`, `67f8138f2f669cc4c22506ae02a34884a574f71e`, `e4d86bc8c2062d177aeab818a466715a47d65df9`, `0369336f16d2c1115c7d97938f23ea5d3fabe253`, `471a1c3179c69f7abeb99e6a63de90e687cca5b7`, `be75f37ee0c4055304ceddacc5726862a38dcaba`, `8322d87a32c82b53d39e0bafba42a0902e6b99e8`, `ee4afebb6c4607d5de4384810edc0ec4bcda39e6`, `d9cf17bf6e48ed3022d99f1d54a9e99b7ac55fe0`, `021f0855a0095cacb63d3b9105129ae29f305597`, `0bdda0b065e4482ff6acfbfa3bb40dc9eb332216`, `0a21f4518a3f58dd719f9e171a39b42de4f32e0a`, `be29b731f80a52abc793b4f115f270b12676fafa`, `610ec1d4e8e40c7be8dff2e2f8a2b148ab793ead`, `729f8e7c85cfe8623570c9057829537aed0fe343`, `6485bda01327b7f7a93c184c4300529857ee2aa8`, `df5987e5cf4f12b0a30622d572c9b5d5b6cc7ead`, `147ab146f4473a4ec3b2eeedcac3e0bf61db252f`, `e2ab34ffd1735de7dee0a4f39b15183a258e694a`, `d5af2af221125520b615f61e9cd3f533562f1268`, `da0b8abc644c7c1de6646bed2568a4b95d3c90a3`, `91112ba835bfac2d0d3fbb16f53e514171352b0a`, `aadf7ff7ff80e71d68befc078e8e22adc1454938`, `e5e9e24d837b3a7159d2b432c6e3ffaf8c204dd1`, `a663ae164c8269e50d8150085645622c96e43e49`, `f571073b41d86afaa9e9e3bae428d6b30651fb31`, `e31b7a19516c3d22ceb7cdc4e5440ab3b8f3d615`, `7cc61ac1317f47c74d06fc7e287793f935ae0950`, `991834979fc69bb030315e530a793f5d9d9a7211`, `88c3aaef92754a9eb0339d45d19c69d9b19ba0f5`, `5fb564d7e5866785a84050b66f227866f7663a6b`, `17ad86131633671f373ced645944790d893de1f0`, `1b65e7948235ae2573859b48f0f9c7b2419217aa`
- Purpose / review finding: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
A	docs/performance/P1-WORKSPACE-NAVIGATION-RECOVERY-2026-10-12.md
M	src/app/(dashboard)/crm/cash-flow/page.tsx
M	src/app/(dashboard)/crm/customers/page.tsx
M	src/app/(dashboard)/crm/dispatch/page.tsx
M	src/app/(dashboard)/crm/layout.tsx
M	src/app/(dashboard)/layout.tsx
M	src/app/(dashboard)/owner/attendance/page.tsx
M	src/app/(dashboard)/owner/bookings/page.tsx
M	src/app/(dashboard)/owner/cash-flow/page.tsx
M	src/app/(dashboard)/owner/dispatch/page.tsx
M	src/app/(dashboard)/owner/layout.tsx
M	src/app/(dashboard)/owner/schedule/page.tsx
M	src/components/features/dashboard/retained-workspace-provider.tsx
M	src/components/features/dashboard/sidebar.tsx
M	src/components/features/dashboard/workspace-retention-policy.ts
M	src/lib/config/mvp-flags.test.ts
M	src/lib/config/mvp-flags.ts
M	tests/components/dashboard/retained-workspace-provider.test.tsx
M	tests/lib/cash-flow/cash-flow-page-tabs.test.tsx
M	tests/lib/cash-flow/owner-cash-flow-page.test.tsx
M	tests/lib/navigation/workspace-module-registry.test.ts
A	tests/lib/navigation/workspace-retention-coverage.test.ts
```

### fix/p1-workspace-navigation-retention-reconcile
- HEAD: `17ad86131633671f373ced645944790d893de1f0`; merge base: `0f157657f78b13f1752ea89f9812c3df9cbd975f`; category: **C**.
- Unique commits (34): `98a17d3f3fd311c0e6eb2179e73def1826a3d9b5`, `55c70ff3cabd5975e1ae4aa05741b8ba5483e8ad`, `7d63143182caed49c6ac25adc310e38f131282c6`, `67f8138f2f669cc4c22506ae02a34884a574f71e`, `e4d86bc8c2062d177aeab818a466715a47d65df9`, `0369336f16d2c1115c7d97938f23ea5d3fabe253`, `471a1c3179c69f7abeb99e6a63de90e687cca5b7`, `be75f37ee0c4055304ceddacc5726862a38dcaba`, `8322d87a32c82b53d39e0bafba42a0902e6b99e8`, `ee4afebb6c4607d5de4384810edc0ec4bcda39e6`, `d9cf17bf6e48ed3022d99f1d54a9e99b7ac55fe0`, `021f0855a0095cacb63d3b9105129ae29f305597`, `0bdda0b065e4482ff6acfbfa3bb40dc9eb332216`, `0a21f4518a3f58dd719f9e171a39b42de4f32e0a`, `be29b731f80a52abc793b4f115f270b12676fafa`, `610ec1d4e8e40c7be8dff2e2f8a2b148ab793ead`, `729f8e7c85cfe8623570c9057829537aed0fe343`, `6485bda01327b7f7a93c184c4300529857ee2aa8`, `df5987e5cf4f12b0a30622d572c9b5d5b6cc7ead`, `147ab146f4473a4ec3b2eeedcac3e0bf61db252f`, `e2ab34ffd1735de7dee0a4f39b15183a258e694a`, `d5af2af221125520b615f61e9cd3f533562f1268`, `da0b8abc644c7c1de6646bed2568a4b95d3c90a3`, `91112ba835bfac2d0d3fbb16f53e514171352b0a`, `aadf7ff7ff80e71d68befc078e8e22adc1454938`, `e5e9e24d837b3a7159d2b432c6e3ffaf8c204dd1`, `a663ae164c8269e50d8150085645622c96e43e49`, `f571073b41d86afaa9e9e3bae428d6b30651fb31`, `e31b7a19516c3d22ceb7cdc4e5440ab3b8f3d615`, `7cc61ac1317f47c74d06fc7e287793f935ae0950`, `991834979fc69bb030315e530a793f5d9d9a7211`, `88c3aaef92754a9eb0339d45d19c69d9b19ba0f5`, `5fb564d7e5866785a84050b66f227866f7663a6b`, `17ad86131633671f373ced645944790d893de1f0`
- Purpose / review finding: Earlier tip of the navigation-retention branch. Fully included in that later independent branch, but not in the current Web candidate.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
A	docs/performance/P1-WORKSPACE-NAVIGATION-RECOVERY-2026-10-12.md
M	src/app/(dashboard)/crm/cash-flow/page.tsx
M	src/app/(dashboard)/crm/customers/page.tsx
M	src/app/(dashboard)/crm/dispatch/page.tsx
M	src/app/(dashboard)/crm/layout.tsx
M	src/app/(dashboard)/layout.tsx
M	src/app/(dashboard)/owner/attendance/page.tsx
M	src/app/(dashboard)/owner/bookings/page.tsx
M	src/app/(dashboard)/owner/cash-flow/page.tsx
M	src/app/(dashboard)/owner/dispatch/page.tsx
M	src/app/(dashboard)/owner/layout.tsx
M	src/app/(dashboard)/owner/schedule/page.tsx
M	src/components/features/dashboard/retained-workspace-provider.tsx
M	src/components/features/dashboard/sidebar.tsx
M	src/components/features/dashboard/workspace-retention-policy.ts
M	src/lib/config/mvp-flags.test.ts
M	src/lib/config/mvp-flags.ts
M	tests/components/dashboard/retained-workspace-provider.test.tsx
M	tests/lib/cash-flow/owner-cash-flow-page.test.tsx
M	tests/lib/navigation/workspace-module-registry.test.ts
A	tests/lib/navigation/workspace-retention-coverage.test.ts
```

### fix/service-editor-save
- HEAD: `9d76b1bb54d0c4a1d39beed5e209b2b8019c8648`; merge base: `03242a0bfbcfe6c4b1b03ba624510004cae7cc6a`; category: **C**.
- Unique commits (1): `9d76b1bb54d0c4a1d39beed5e209b2b8019c8648`
- Purpose / review finding: Unifies Owner/Marketing service mutations, media and cache invalidation, fixes metadataJson submission, and retains failed form edits. Newer catalog architecture overlaps; no functional supersession assertion made here.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
M	src/app/(dashboard)/marketing/actions.ts
M	src/app/(dashboard)/marketing/service-actions.ts
M	src/app/(dashboard)/owner/marketing/actions.ts
A	src/app/(dashboard)/owner/services/[serviceId]/owner-service-form.tsx
M	src/app/(dashboard)/owner/services/[serviceId]/page.tsx
M	src/app/(dashboard)/owner/services/actions.ts
M	src/components/features/marketing/services/services-studio-view.tsx
A	src/lib/services/service-mutation.ts
M	src/lib/validations/service.ts
M	tests/lib/marketing/brand-branches-services-studios.test.tsx
M	tests/lib/marketing/draft-publication-pipelines.test.ts
A	tests/lib/services/owner-service-form.test.tsx
A	tests/lib/services/service-editor-actions.test.ts
A	tests/lib/services/service-mutation.test.ts
```

### local/integration-testing
- HEAD: `67b6dc889c3bbe105734f2f096eb92072e0414d8`; merge base: `66320d82b657507fc12f7a2090c1e202160c4e14`; category: **F**.
- Unique commits (1): `67b6dc889c3bbe105734f2f096eb92072e0414d8`
- Purpose / review finding: Unique merge commit has no merge-base tree diff against main. Both parents are accepted ancestors; first-parent changes import Sheet parser/reader history already represented in main. UNKNOWN ownership; integration artifact, not unique release behavior.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
```

### stage/c1-truth-consolidation
- HEAD: `bde990de12b8b5b37b3594dfa925c6eef680d196`; merge base: `4f9291c7d457ec49b071e766df4c23ca1e4f1558`; category: **E**.
- Unique commits (1): `bde990de12b8b5b37b3594dfa925c6eef680d196`
- Purpose / review finding: Historical truth/governance documentation delta. Preserve without overwriting newer active decisions; unique SHA does not imply current guidance.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
M	AI_CONTEXT.md
M	docs/02-CURRENT-SYSTEM-MAP.md
A	docs/03-CURRENT-SYSTEM-TRUTH.md
M	docs/11-DECISION-LOG.md
M	docs/12-KNOWN-ISSUES-REGISTER.md
M	docs/13-PROJECT-STATUS.md
```

### stage/c5-cf2-central-ledger
- HEAD: `0c222a591dc705f935939cd34b59ab615ab92fac`; merge base: `f8977cce5c1286402eed2e6805ba0428c38dc660`; category: **C**.
- Unique commits (3): `c3f8b10ab00275c14788565e14a6f6fc0be58192`, `d9ddfcf89b93e6dd9e38ffec53517465d952f3c7`, `0c222a591dc705f935939cd34b59ab615ab92fac`
- Purpose / review finding: Three commits build/reshape Cash Flow reading, reconciliation summaries, transaction/correction/entry UI and CRM Today panels. Large historical financial/UI checkpoint; acceptance of this exact delta UNKNOWN.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
A	docs/audits/C5-CF1-CASH-FLOW-FOUNDATION.md
A	src/app/(dashboard)/crm/cash-flow/actions.ts
A	src/app/(dashboard)/crm/cash-flow/error.tsx
A	src/app/(dashboard)/crm/cash-flow/page.tsx
M	src/app/(dashboard)/crm/reconciliation/reconciliation-form.tsx
A	src/components/features/cash-flow/cash-flow-correction-form.tsx
A	src/components/features/cash-flow/cash-flow-correction-preview.tsx
A	src/components/features/cash-flow/cash-flow-create-entry-form.tsx
A	src/components/features/cash-flow/cash-flow-day-close.tsx
A	src/components/features/cash-flow/cash-flow-entry-dialog.tsx
A	src/components/features/cash-flow/cash-flow-entry-type-selector.tsx
A	src/components/features/cash-flow/cash-flow-history.tsx
A	src/components/features/cash-flow/cash-flow-ledger.tsx
A	src/components/features/cash-flow/cash-flow-today.tsx
A	src/components/features/cash-flow/cash-flow-transaction-detail.tsx
A	src/components/features/cash-flow/cash-flow-transaction-summary.tsx
A	src/components/features/cash-flow/cash-flow-ui.tsx
A	src/components/features/cash-flow/cash-flow-workspace.tsx
M	src/components/features/crm/operational/crm-operational-page-shell.tsx
M	src/components/features/crm/today/cradle-flow-actions.tsx
M	src/components/features/crm/today/cradle-flow-dashboard.tsx
M	src/components/features/crm/today/cradle-flow-header.tsx
M	src/components/features/crm/today/cradle-flow-lower-panels.tsx
M	src/components/features/crm/today/cradle-flow-side-rail.tsx
M	src/components/features/crm/today/cradle-flow-ticket.tsx
M	src/components/features/crm/today/cradle-flow-workflow.tsx
A	src/components/features/crm/today/today-recent-activity.tsx
M	src/components/features/dashboard/nav-config.ts
M	src/components/features/workspace/workspace-prefetch-config.ts
A	src/lib/bookings/payment-summary.ts
A	src/lib/cash-flow/read-model.ts
M	src/lib/queries/bookings.ts
A	src/lib/queries/cash-flow.ts
A	tests/components/cash-flow/entry-dialog.test.tsx
A	tests/components/cash-flow/history.test.tsx
A	tests/components/cash-flow/workspace.test.tsx
A	tests/components/crm/today-dashboard.test.tsx
A	tests/lib/cash-flow/fixtures.ts
A	tests/lib/cash-flow/query.test.ts
A	tests/lib/cash-flow/read-model.test.ts
```

### stage/c5-sheet-assimilation-bridge
- HEAD: `3a96f113ca9ef82e9a7df329ced9d5b9b9b9b64f`; merge base: `f8977cce5c1286402eed2e6805ba0428c38dc660`; category: **C**.
- Unique commits (6): `50afe9dd99842745430b1bbbb2da2ddfa1498103`, `58268859e14d239a40a4fd7e5b2ca8362b18f1c9`, `deb9484e14a98bbd94761066073a0f01e62250b8`, `96f5fef040c3f49a608090ca2573d6d174f6f672`, `2d4b0f9ab62c51b8e7eb953b9352f14d070a0e4d`, `3a96f113ca9ef82e9a7df329ced9d5b9b9b9b64f`
- Purpose / review finding: Six commits add Sheet readers, parsing, merge restoration, row accounting, resolution and smart ingestion dry-run plans plus a cash-flow page. Experimental/unfinished status must be decided independently; source identity and financial authority are sensitive.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
M	.env.example
A	docs/audits/C5-SMART-SHEET-DRY-RUN-EVIDENCE.json
A	docs/audits/C5-SMART-SHEET-DRY-RUN.md
M	package.json
M	pnpm-lock.yaml
M	src/app/(dashboard)/crm/bookings/page.tsx
A	src/app/(dashboard)/crm/bookings/sheet/page.tsx
A	src/app/(dashboard)/crm/bookings/sheet/smart/page.tsx
A	src/app/(dashboard)/crm/cash-flow/page.tsx
M	src/components/features/dashboard/nav-config.ts
M	src/components/features/workspace/workspace-prefetch-config.ts
A	src/lib/integrations/google-sheets/config.ts
A	src/lib/integrations/google-sheets/sheet-accounting.ts
A	src/lib/integrations/google-sheets/sheet-attention.ts
A	src/lib/integrations/google-sheets/sheet-context.ts
A	src/lib/integrations/google-sheets/sheet-dry-run.ts
A	src/lib/integrations/google-sheets/sheet-ingestion-types.ts
A	src/lib/integrations/google-sheets/sheet-live-dry-run.ts
A	src/lib/integrations/google-sheets/sheet-merge-normalizer.ts
A	src/lib/integrations/google-sheets/sheet-parser.ts
A	src/lib/integrations/google-sheets/sheet-preflight.ts
A	src/lib/integrations/google-sheets/sheet-projection-planner.ts
A	src/lib/integrations/google-sheets/sheet-projection.ts
A	src/lib/integrations/google-sheets/sheet-reader.ts
A	src/lib/integrations/google-sheets/sheet-resolution-context.ts
A	src/lib/integrations/google-sheets/sheet-resolvers.ts
A	src/lib/integrations/google-sheets/sheet-source-identity.ts
A	src/lib/integrations/google-sheets/sheet-validation.ts
A	src/lib/queries/cash-flow.ts
A	tests/lib/cash-flow/cash-flow-module.test.ts
A	tests/lib/integrations/google-sheets/sheet-accounting.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-accounting.test.ts
A	tests/lib/integrations/google-sheets/sheet-merge-diagnostics.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-merge-normalizer.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-merge-normalizer.test.ts
A	tests/lib/integrations/google-sheets/sheet-parser-summary.test.ts
A	tests/lib/integrations/google-sheets/sheet-parser.test.ts
A	tests/lib/integrations/google-sheets/sheet-projection.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-projection.test.ts
A	tests/lib/integrations/google-sheets/sheet-reader.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-review-diagnostics.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart-context.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart-dry-run.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart-preflight.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart-reader.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart-resolution.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart.live.test.ts
A	tests/lib/integrations/google-sheets/smart-sheet-fixtures.ts
```

### stage/pwa-c2-structured-diagnostics
- HEAD: `1ea191f3ebedccda6a2249f3ee8f1b53d5e6791a`; merge base: `2b927303d2d6bc10b09a15f2542fdcfa6c066194`; category: **E**.
- Unique commits (5): `5598fc93caf781a5d0ebd777a564c100f5425b57`, `c2052943b3e488f2b3f270f01f65ba63417d5271`, `9357cde7281b6450811d6d1570120a580adc77d2`, `e84a0745bc834ebf3b74b001fd837a5a2b81cd66`, `1ea191f3ebedccda6a2249f3ee8f1b53d5e6791a`
- Purpose / review finding: Five diagnostic/handoff/recovery documentation commits. Historical governance recovery must not overwrite accepted later decisions.
- Candidate relationship: divergent unique history; no integration performed.
- Changed files versus main merge-base:
```text
M	docs/12-KNOWN-ISSUES-REGISTER.md
M	docs/pwa/PWA-C2-HANDOFF.md
M	docs/pwa/PWA-C2-STRUCTURED-DIAGNOSTICS.md
```

## WIP Preservation Branches

**NOT MERGE CANDIDATES.** Snapshot publication does not approve the contents.

### wip/preserve-test-crm-csr-gremlin-day-20261016-162215
Source: `test/crm-csr-gremlin-day` at `ace46f6d82dc277363c4efeff992f1f739103547`. Snapshot: `1cc06281d8b55e140c8601596582ff28488e2594`.
```text
A	docs/audits/CRM_CSR_GREMLIN_DAY_2026-10-02.md
```

### wip/preserve-fix-service-editor-save-20261016-162215
Source: `fix/service-editor-save` at `9d76b1bb54d0c4a1d39beed5e209b2b8019c8648`. Snapshot: `86ebb87049327cf9f2263e7ad7e3430ba2dc69b1`.
```text
A	CradleHub_Service_Editor_P1_Hotfix_Report.md
```

### wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215
Source: `stage/c5-sheet-assimilation-bridge` at `3a96f113ca9ef82e9a7df329ced9d5b9b9b9b64f`. Snapshot: `0b3d792f2d38d5466fe2261dbbfa5910b8b7d7bc`.
```text
A	.tsconfig.sheet-dry-run.tmp.json
M	src/app/(dashboard)/crm/bookings/sheet/smart/page.tsx
A	src/lib/integrations/google-sheets/sheet-contact-context.ts
M	src/lib/integrations/google-sheets/sheet-dry-run.ts
M	src/lib/integrations/google-sheets/sheet-live-dry-run.ts
A	tests/lib/integrations/google-sheets/sheet-contact-context.test.ts
```

Top commit deletes 12 Figma CRM documentation/placeholder files (907 removed lines). Preservation only. Deletions are not authorized for integration.

## Unknown / Uncertain Branches

Ownership/acceptance is not inferred from titles. `local/integration-testing` is an empty main-relative integration artifact; old Cash Flow and Sheet checkpoints require owner scope decisions. Sitemap intent is unproven. WIP snapshots and ignored orphan source copies have no release acceptance. Missing worktree directories cannot be certified clean.

## Migration Inventory

These filenames are absent from accepted main and present on unmerged work. No database connection or migration command was run in the preservation audit. The later owner brief reports production equivalents for the first four and unapplied status for the last two; these are OWNER-REPORTED / REPOSITORY-RECORDED PRODUCTION EVIDENCE only until the separate checkpoint verifies the target read-only. Actual production state in this audit: **UNKNOWN**.

| Migration | Introducing commit | Branches | In newest candidate | Purpose / risk | Production state |
|---|---|---|---|---|
| `supabase/migrations/20261015004617_service_catalog_policy_visibility.sql` | `86598629ead26b219724aefb45ee408c58da5d9c` | `fix/crm-grouped-order-display`<br>`fix/crm-therapist-assignment-provenance`<br>`fix/home-service-distance-pricing`<br>`stage/crm-multi-attendee-booking`<br>`stage/service-catalog-consolidation`<br>`stage/service-duration-extension`<br>`stage/web-checkpoint-integration-20261016`<br>`wip/sm-emergency-snapshot-20261016-122654` | YES | Adds global service visibility/duration columns, constraint and Owner catalog RPC | UNKNOWN in this audit |
| `supabase/migrations/20261015105000_crm_mb1_attendee_line_resources.sql` | `7cdb3a8eb3934ed820468e7cdb8cec2fa2defc39` | `fix/crm-grouped-order-display`<br>`fix/crm-therapist-assignment-provenance`<br>`fix/home-service-distance-pricing`<br>`stage/crm-multi-attendee-booking`<br>`stage/service-duration-extension`<br>`stage/web-checkpoint-integration-20261016`<br>`wip/sm-emergency-snapshot-20261016-122654` | YES | Replaces in-house atomic booking RPC for attendee-specific line resources and payment | UNKNOWN in this audit |
| `supabase/migrations/20261016001208_therapist_assignment_provenance.sql` | `bc2ade3cbca54eb2cbd6d362d2bc70a70dbb6cac` | `fix/crm-therapist-assignment-provenance`<br>`fix/home-service-distance-pricing`<br>`stage/service-duration-extension`<br>`stage/web-checkpoint-integration-20261016`<br>`wip/sm-emergency-snapshot-20261016-122654` | YES | Adds requested therapist/source fields and provenance trigger | UNKNOWN in this audit |
| `supabase/migrations/20261016021627_purchased_service_duration_snapshot.sql` | `691d43f8bb7b5b6a54a14e64cdca0afa5075b6cd` | `fix/home-service-distance-pricing`<br>`stage/service-duration-extension`<br>`stage/web-checkpoint-integration-20261016`<br>`wip/sm-emergency-snapshot-20261016-122654` | YES | Initializes and protects purchased duration commercial snapshot via trigger | UNKNOWN in this audit |
| `supabase/migrations/20261016165500_home_service_transportation_pricing.sql` | `a2c942b1961f79520729527f15e5a665594585ea` | `fix/home-service-distance-pricing`<br>`stage/web-checkpoint-integration-20261016` | YES | Adds transportation policy column/defaults/constraints; UNCONDITIONAL UPDATE of all existing branch rules to 100/1/40 | UNKNOWN in this audit |
| `supabase/migrations/20261016193500_tighten_service_duration_extension_price_constraint.sql` | `84d7b3f7ce4e40b9957559581efe085236039a08` | `fix/home-service-distance-pricing`<br>`stage/web-checkpoint-integration-20261016` | YES | Replaces duration constraint; requires positive extension price; existing-row validation risk | UNKNOWN in this audit |

## Sensitive Changes

Risk flags indicate review surfaces, not findings of exploitability or release approval. The commit appendix identifies exact files.

- Current candidate: customer lookup/prefill authorization; global identity with branch-private history; booking creation and confirmation; grouped financial totals; staff/resource assignment; authoritative duration and transportation quotes; privileged RPCs and trigger protections.
- Independent payment safety and Cash Flow branches: payment confirmation, reconciliation failure paths, dispatch-conflict reads, selected business date versus active-session transaction history, and financial UI.
- Attendance correction: prior provisional close/current-day scan behavior.
- Navigation retention: cached authorization and retained branch-scoped operational data; cross-branch leakage and stale/memory behavior require regression review.
- Sheet bridge and its WIP: external identity/contact resolution, financial projections, ingestion plans and environment configuration placeholders; no authority to write production is inferred.
- Owner service editor: authorization delegated to callers, canonical service metadata/image mutation and cache invalidation.
- WIP Figma deletion: 12 paths / 907 removed lines; preserve only.
- Large historical refactors: CF2 checkpoint (26 files; about +7002/-1169 lines), Sheet checkpoint (33 files; about +5299/-10), navigation branch (22 net files; about +1059/-457), future-booking commit (36 files; about +1574/-608).
- No new branch history rewrite was performed or proven by this audit. This does not certify pre-audit history. No migration-file deletion/rename or whole test-file deletion was found in the unique unmerged commit file lists. Historical paths absent merely because a branch predates main are not branch deletions.

## Unrelated Changes

Figma documentation deletions are isolated to the WIP snapshot. The Desktop authority-endpoint branch is already in main and therefore inherited by the candidate; this audit adds no Desktop work. Historical PWA diagnostics remain documentation-only. No `chatgpt/*` or `codex/*` branch refs were found; agent-created detached/orphan directories are documented above.

## Recommended Review Order

1. Needs independent review: cumulative Web candidate and its six migration effects; payment/dispatch safety, Cash Flow date scope, attendance, navigation retention and service-editor unique behavior. Compare overlapping future-booking behavior with main before porting anything.
2. Already represented in candidate: exact ancestors in the containment table; no merge needed.
3. Preserve only: all four WIP branches and old integration merge artifact.
4. Unknown — owner decision required: historical CF2/Sheet scope, sitemap intent, ignored source archives, and unavailable worktree contents. No wholesale merge is recommended.

## Appendix: Unique Commits Outside Current Candidate

For each commit, listed scope tags are positive matches from changed paths and diff contents; unlisted requested scope areas were not observed. These are inventory findings, not exhaustive security review.

### 021f0855a0095cacb63d3b9105129ae29f305597
fix(web): retain core CRM and Owner modules longer

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Owner workspace

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/components/features/dashboard/workspace-retention-policy.ts
```

### 0369336f16d2c1115c7d97938f23ea5d3fabe253
fix(web): retain Owner attendance by branch

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: attendance, Owner workspace, Staff portal / PWA, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/owner/attendance/page.tsx
```

### 0a21f4518a3f58dd719f9e171a39b42de4f32e0a
test(web): align retained LRU coverage with expanded hot set

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Home Service, payment, attendance, Staff portal / PWA, tests, customer identity

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	tests/components/dashboard/retained-workspace-provider.test.tsx
```

### 0b3d792f2d38d5466fe2261dbbfa5910b8b7d7bc
wip: preserve local work before unmerged branch audit

Branches: `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215`

Scope: booking, Home Service, payment, tests, infrastructure, synchronization, customer identity

Approximate purpose: Preserves the source worktree files without release acceptance.

Changed files:
```text
A	.tsconfig.sheet-dry-run.tmp.json
M	src/app/(dashboard)/crm/bookings/sheet/smart/page.tsx
A	src/lib/integrations/google-sheets/sheet-contact-context.ts
M	src/lib/integrations/google-sheets/sheet-dry-run.ts
M	src/lib/integrations/google-sheets/sheet-live-dry-run.ts
A	tests/lib/integrations/google-sheets/sheet-contact-context.test.ts
```

### 0bdda0b065e4482ff6acfbfa3bb40dc9eb332216
fix(web): keep retained workspace memory bounds measured-first

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Owner workspace

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/components/features/dashboard/workspace-retention-policy.ts
```

### 0c222a591dc705f935939cd34b59ab615ab92fac
chore(stabilization): checkpoint CF2 and CRM working state

Branches: `stage/c5-cf2-central-ledger`

Scope: booking, Home Service, payment, attendance, authorization, Staff portal / PWA, tests, infrastructure, synchronization, customer identity, staff assignment

Approximate purpose: Three commits build/reshape Cash Flow reading, reconciliation summaries, transaction/correction/entry UI and CRM Today panels. Large historical financial/UI checkpoint; acceptance of this exact delta UNKNOWN.

Changed files:
```text
A	src/components/features/cash-flow/cash-flow-correction-form.tsx
A	src/components/features/cash-flow/cash-flow-correction-preview.tsx
A	src/components/features/cash-flow/cash-flow-create-entry-form.tsx
M	src/components/features/cash-flow/cash-flow-day-close.tsx
A	src/components/features/cash-flow/cash-flow-entry-dialog.tsx
A	src/components/features/cash-flow/cash-flow-entry-type-selector.tsx
M	src/components/features/cash-flow/cash-flow-history.tsx
M	src/components/features/cash-flow/cash-flow-ledger.tsx
M	src/components/features/cash-flow/cash-flow-today.tsx
M	src/components/features/cash-flow/cash-flow-transaction-detail.tsx
A	src/components/features/cash-flow/cash-flow-transaction-summary.tsx
M	src/components/features/cash-flow/cash-flow-ui.tsx
M	src/components/features/cash-flow/cash-flow-workspace.tsx
M	src/components/features/crm/operational/crm-operational-page-shell.tsx
M	src/components/features/crm/today/cradle-flow-actions.tsx
M	src/components/features/crm/today/cradle-flow-dashboard.tsx
M	src/components/features/crm/today/cradle-flow-header.tsx
M	src/components/features/crm/today/cradle-flow-lower-panels.tsx
M	src/components/features/crm/today/cradle-flow-side-rail.tsx
M	src/components/features/crm/today/cradle-flow-ticket.tsx
M	src/components/features/crm/today/cradle-flow-workflow.tsx
A	src/components/features/crm/today/today-recent-activity.tsx
A	tests/components/cash-flow/entry-dialog.test.tsx
A	tests/components/cash-flow/history.test.tsx
M	tests/components/cash-flow/workspace.test.tsx
A	tests/components/crm/today-dashboard.test.tsx
```

### 0f134b8675b08416e0d5b34ab0045d4ef55f8640
wip: preserve complete local state before SM emergency stabilization

Branches: `wip/sm-emergency-snapshot-20261016-122654`

Scope: booking, Home Service, payment, authorization, Owner workspace, Staff portal / PWA, docs, infrastructure, synchronization, customer identity, staff assignment

Approximate purpose: Top commit deletes 12 Figma CRM documentation/placeholder files (907 removed lines). Preservation only. Deletions are not authorized for integration.

Changed files:
```text
D	docs/figma-crm-redesign/01-crm-page-map.md
D	docs/figma-crm-redesign/02-crm-ui-style-guide.md
D	docs/figma-crm-redesign/03-ui-redesign-rules.md
D	docs/figma-crm-redesign/04-existing-workflows-and-functions.md
D	docs/figma-crm-redesign/05-component-design-system-brief.md
D	docs/figma-crm-redesign/06-figma-ai-master-prompt.md
D	docs/figma-crm-redesign/07-page-by-page-figma-prompts.md
D	docs/figma-crm-redesign/README.md
D	docs/figma-crm-redesign/screenshots/README.md
D	docs/figma-crm-redesign/screenshots/approved-direction/.gitkeep
D	docs/figma-crm-redesign/screenshots/current/.gitkeep
D	docs/figma-crm-redesign/screenshots/redesigned/.gitkeep
```

### 147ab146f4473a4ec3b2eeedcac3e0bf61db252f
perf(web): reuse authoritative Front Desk context in CRM layout

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: booking, Staff portal / PWA, infrastructure, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/crm/layout.tsx
```

### 158320b274ccf355097e0a034d798de72dd55d2d
chore: add Google sitemap

Branches: `fix/p1-google-sitemap`

Scope: Home Service, infrastructure, customer identity

Approximate purpose: Replaces individual metadata-bearing sitemap entries with PUBLIC_PAGES mapping. Public SEO delta; intended ownership/acceptance UNKNOWN.

Changed files:
```text
M	src/app/sitemap.ts
```

### 17ad86131633671f373ced645944790d893de1f0
docs(web): record P1 navigation recovery and review limits

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: booking, Home Service, payment, attendance, authorization, Owner workspace, Staff portal / PWA, docs, tests, infrastructure, customer identity

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
A	docs/performance/P1-WORKSPACE-NAVIGATION-RECOVERY-2026-10-12.md
```

### 1b65e7948235ae2573859b48f0f9c7b2419217aa
test(web): unwrap retained module in crm cash flow tab tests

Branches: `fix/p1-workspace-navigation-retention`

Scope: payment, tests, synchronization, customer identity

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	tests/lib/cash-flow/cash-flow-page-tabs.test.tsx
```

### 1cc06281d8b55e140c8601596582ff28488e2594
wip: preserve local work before unmerged branch audit

Branches: `wip/preserve-test-crm-csr-gremlin-day-20261016-162215`

Scope: booking, Home Service, payment, attendance, authorization, Owner workspace, Staff portal / PWA, docs, customer identity, staff assignment

Approximate purpose: Preserves the source worktree files without release acceptance.

Changed files:
```text
A	docs/audits/CRM_CSR_GREMLIN_DAY_2026-10-02.md
```

### 1ea191f3ebedccda6a2249f3ee8f1b53d5e6791a
docs(pwa): remove stale C2 evidence placeholders

Branches: `stage/pwa-c2-structured-diagnostics`

Scope: authorization, Owner workspace, Staff portal / PWA, docs

Approximate purpose: Five diagnostic/handoff/recovery documentation commits. Historical governance recovery must not overwrite accepted later decisions.

Changed files:
```text
M	docs/pwa/PWA-C2-HANDOFF.md
```

### 2d4b0f9ab62c51b8e7eb953b9352f14d070a0e4d
feat(sheet-sync): normalize merge-backed continuations

Branches: `stage/c5-sheet-assimilation-bridge`, `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215`

Scope: payment, authorization, Owner workspace, tests, infrastructure, synchronization

Approximate purpose: Six commits add Sheet readers, parsing, merge restoration, row accounting, resolution and smart ingestion dry-run plans plus a cash-flow page. Experimental/unfinished status must be decided independently; source identity and financial authority are sensitive.

Changed files:
```text
A	src/lib/integrations/google-sheets/sheet-merge-normalizer.ts
M	src/lib/integrations/google-sheets/sheet-reader.ts
A	tests/lib/integrations/google-sheets/sheet-merge-normalizer.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-merge-normalizer.test.ts
```

### 3a96f113ca9ef82e9a7df329ced9d5b9b9b9b64f
checkpoint(c5): smart sheet dry-run and cash flow working state

Branches: `stage/c5-sheet-assimilation-bridge`, `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215`

Scope: booking, Home Service, payment, attendance, authorization, service catalog, Owner workspace, Staff portal / PWA, docs, tests, infrastructure, synchronization, customer identity, staff assignment

Approximate purpose: Six commits add Sheet readers, parsing, merge restoration, row accounting, resolution and smart ingestion dry-run plans plus a cash-flow page. Experimental/unfinished status must be decided independently; source identity and financial authority are sensitive.

Changed files:
```text
M	.env.example
A	docs/audits/C5-SMART-SHEET-DRY-RUN-EVIDENCE.json
A	docs/audits/C5-SMART-SHEET-DRY-RUN.md
M	src/app/(dashboard)/crm/bookings/page.tsx
A	src/app/(dashboard)/crm/bookings/sheet/page.tsx
A	src/app/(dashboard)/crm/bookings/sheet/smart/page.tsx
A	src/app/(dashboard)/crm/cash-flow/page.tsx
M	src/components/features/dashboard/nav-config.ts
M	src/components/features/workspace/workspace-prefetch-config.ts
A	src/lib/integrations/google-sheets/sheet-attention.ts
A	src/lib/integrations/google-sheets/sheet-context.ts
A	src/lib/integrations/google-sheets/sheet-dry-run.ts
A	src/lib/integrations/google-sheets/sheet-ingestion-types.ts
A	src/lib/integrations/google-sheets/sheet-live-dry-run.ts
A	src/lib/integrations/google-sheets/sheet-preflight.ts
A	src/lib/integrations/google-sheets/sheet-projection-planner.ts
A	src/lib/integrations/google-sheets/sheet-projection.ts
A	src/lib/integrations/google-sheets/sheet-resolution-context.ts
A	src/lib/integrations/google-sheets/sheet-resolvers.ts
A	src/lib/integrations/google-sheets/sheet-source-identity.ts
A	src/lib/integrations/google-sheets/sheet-validation.ts
A	src/lib/queries/cash-flow.ts
A	tests/lib/cash-flow/cash-flow-module.test.ts
M	tests/lib/integrations/google-sheets/sheet-merge-normalizer.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-projection.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-projection.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart-context.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart-dry-run.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart-preflight.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart-reader.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart-resolution.test.ts
A	tests/lib/integrations/google-sheets/sheet-smart.live.test.ts
A	tests/lib/integrations/google-sheets/smart-sheet-fixtures.ts
```

### 471a1c3179c69f7abeb99e6a63de90e687cca5b7
fix(web): retain Owner cash flow by branch

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: payment, Owner workspace, Staff portal / PWA, infrastructure, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/owner/cash-flow/page.tsx
```

### 47641bf19da1afe4db9430d38343ad1c2489ca31
fix: allow new-day attendance after prior provisional close

Branches: `fix/attendance-new-day-provisional-close`

Scope: attendance, tests, synchronization, staff assignment

Approximate purpose: Scan-engine delta allows a current-day shift to be evaluated after one prior-day provisional close; multiple prior-day candidates remain reviewable/ambiguous. Attendance mutation and day-boundary behavior require independent review.

Changed files:
```text
M	src/lib/attendance/scan-engine.ts
A	tests/lib/attendance/a01-new-business-day-provisional-close.test.ts
M	tests/lib/attendance/crm-closing-policy-migration.test.ts
```

### 50afe9dd99842745430b1bbbb2da2ddfa1498103
feat(sheet-sync): add read-only sheet bridge foundation

Branches: `stage/c5-sheet-assimilation-bridge`, `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215`

Scope: payment, authorization, tests, infrastructure, synchronization

Approximate purpose: Six commits add Sheet readers, parsing, merge restoration, row accounting, resolution and smart ingestion dry-run plans plus a cash-flow page. Experimental/unfinished status must be decided independently; source identity and financial authority are sensitive.

Changed files:
```text
M	.env.example
M	package.json
M	pnpm-lock.yaml
A	src/lib/integrations/google-sheets/config.ts
A	src/lib/integrations/google-sheets/sheet-parser.ts
A	src/lib/integrations/google-sheets/sheet-reader.ts
A	tests/lib/integrations/google-sheets/sheet-parser.test.ts
```

### 5598fc93caf781a5d0ebd777a564c100f5425b57
docs(pwa): reconcile C2 severity and evidence truth

Branches: `stage/pwa-c2-structured-diagnostics`

Scope: booking, attendance, authorization, Owner workspace, Staff portal / PWA, docs, tests, synchronization, customer identity, staff assignment

Approximate purpose: Five diagnostic/handoff/recovery documentation commits. Historical governance recovery must not overwrite accepted later decisions.

Changed files:
```text
M	docs/12-KNOWN-ISSUES-REGISTER.md
M	docs/pwa/PWA-C2-HANDOFF.md
M	docs/pwa/PWA-C2-STRUCTURED-DIAGNOSTICS.md
```

### 55c70ff3cabd5975e1ae4aa05741b8ba5483e8ad
fix(web): make retained loading and refresh feedback non-blocking

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Staff portal / PWA

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/components/features/dashboard/retained-workspace-provider.tsx
```

### 58268859e14d239a40a4fd7e5b2ca8362b18f1c9
feat(sheet-sync): use keyless reader and classify summaries

Branches: `stage/c5-sheet-assimilation-bridge`, `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215`

Scope: payment, authorization, tests, infrastructure, synchronization

Approximate purpose: Six commits add Sheet readers, parsing, merge restoration, row accounting, resolution and smart ingestion dry-run plans plus a cash-flow page. Experimental/unfinished status must be decided independently; source identity and financial authority are sensitive.

Changed files:
```text
M	.env.example
M	src/lib/integrations/google-sheets/config.ts
M	src/lib/integrations/google-sheets/sheet-parser.ts
M	src/lib/integrations/google-sheets/sheet-reader.ts
A	tests/lib/integrations/google-sheets/sheet-parser-summary.test.ts
A	tests/lib/integrations/google-sheets/sheet-reader.live.test.ts
```

### 5fb564d7e5866785a84050b66f227866f7663a6b
test(web): complete retained navigation coverage and scoped gates

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: booking, Home Service, payment, attendance, authorization, Owner workspace, Staff portal / PWA, tests, infrastructure, synchronization, customer identity

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/crm/customers/page.tsx
M	src/app/(dashboard)/crm/layout.tsx
M	src/app/(dashboard)/owner/bookings/page.tsx
M	src/app/(dashboard)/owner/cash-flow/page.tsx
M	src/app/(dashboard)/owner/layout.tsx
M	src/app/(dashboard)/owner/schedule/page.tsx
M	src/components/features/dashboard/retained-workspace-provider.tsx
M	src/components/features/dashboard/sidebar.tsx
M	src/components/features/dashboard/workspace-retention-policy.ts
M	src/lib/config/mvp-flags.test.ts
M	tests/components/dashboard/retained-workspace-provider.test.tsx
M	tests/lib/cash-flow/owner-cash-flow-page.test.tsx
M	tests/lib/navigation/workspace-module-registry.test.ts
A	tests/lib/navigation/workspace-retention-coverage.test.ts
```

### 610ec1d4e8e40c7be8dff2e2f8a2b148ab793ead
perf(web): overlap CRM layout context resolution

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: authorization, infrastructure, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/crm/layout.tsx
```

### 6485bda01327b7f7a93c184c4300529857ee2aa8
perf(web): reuse cached Owner authorization in bookings

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: booking, authorization, Owner workspace, Staff portal / PWA, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/owner/bookings/page.tsx
```

### 67b6dc889c3bbe105734f2f096eb92072e0414d8
Merge commit '66320d82b657507fc12f7a2090c1e202160c4e14' into local/integration-testing

Branches: `local/integration-testing`

Scope: integration history only

Approximate purpose: Unique merge commit has no merge-base tree diff against main. Both parents are accepted ancestors; first-parent changes import Sheet parser/reader history already represented in main. UNKNOWN ownership; integration artifact, not unique release behavior.

Changed files:
```text
No combined tree delta; merge history artifact.
```

### 67f8138f2f669cc4c22506ae02a34884a574f71e
fix(web): retain CRM home service workspace

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: booking, Home Service, Staff portal / PWA, synchronization, customer identity, staff assignment

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/crm/dispatch/page.tsx
```

### 6fc354f1954c6cafcceb78b9eb857d85ea2c2ddc
Fix future booking visibility across CRM workflows

Branches: `fix/p1-future-booking-visibility`

Scope: booking, Home Service, payment, attendance, authorization, Owner workspace, Staff portal / PWA, tests, synchronization, customer identity, staff assignment

Approximate purpose: Adds future booking reads, 14-day filtering, confirmation result routing and upcoming UI. Its SHA is not an ancestor; later main integration contains overlapping behavior. Unique history does not prove missing functionality.

Changed files:
```text
M	src/app/(dashboard)/crm/bookings/actions.ts
M	src/app/(dashboard)/crm/bookings/page.tsx
M	src/app/(dashboard)/crm/dispatch/page.tsx
M	src/app/(dashboard)/crm/today/actions.ts
M	src/app/(dashboard)/crm/today/page.tsx
M	src/app/api/crm/bookings/route.ts
M	src/components/features/bookings/booking-followup-modal.tsx
M	src/components/features/bookings/booking-list-row.tsx
M	src/components/features/bookings/bookings-desktop-list.tsx
M	src/components/features/bookings/bookings-desktop-workspace.tsx
M	src/components/features/bookings/bookings-list-toolbar.tsx
M	src/components/features/bookings/bookings-quick-filters.tsx
M	src/components/features/bookings/bookings-table.tsx
M	src/components/features/bookings/bookings-workspace.tsx
M	src/components/features/bookings/crm-bookings-view.tsx
M	src/components/features/bookings/selected-booking-primary-action.tsx
M	src/components/features/crm/today/cradle-flow-booking-dialog.tsx
M	src/components/features/crm/today/cradle-flow-dashboard.tsx
M	src/components/features/crm/today/cradle-flow-display.ts
M	src/components/features/crm/today/cradle-flow-ticket.tsx
M	src/components/features/crm/today/cradle-flow-workflow.tsx
M	src/components/features/dispatch/dispatch-flow-tab.tsx
M	src/components/features/dispatch/dispatch-workspace.tsx
M	src/lib/actions/dispatch-data-actions.ts
M	src/lib/bookings/bookings-workspace-filters.ts
M	src/lib/bookings/crm-booking-operations.ts
A	src/lib/bookings/upcoming-bookings.ts
M	src/lib/crm/cradle-flow.ts
M	src/lib/queries/bookings.ts
M	src/lib/queries/dispatch-queries.ts
M	tests/lib/bookings/bookings-workspace-filters.test.ts
A	tests/lib/bookings/crm-bookings-page.test.tsx
A	tests/lib/bookings/crm-dispatch-deep-link.test.ts
A	tests/lib/bookings/upcoming-bookings.test.ts
A	tests/lib/bookings/upcoming-dispatch.test.ts
M	tests/lib/crm/cradle-flow-display.test.ts
```

### 729f8e7c85cfe8623570c9057829537aed0fe343
perf(web): overlap Owner layout authorization context

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: authorization, Owner workspace, Staff portal / PWA, infrastructure, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/owner/layout.tsx
```

### 7cc61ac1317f47c74d06fc7e287793f935ae0950
fix(web): prefer most recently mounted Owner module scope

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Staff portal / PWA

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/components/features/dashboard/retained-workspace-provider.tsx
```

### 7d63143182caed49c6ac25adc310e38f131282c6
fix(web): retain CRM cash flow workspace

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: payment, Staff portal / PWA, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/crm/cash-flow/page.tsx
```

### 8322d87a32c82b53d39e0bafba42a0902e6b99e8
test(web): cover branch-safe expanded retention

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Home Service, payment, attendance, Owner workspace, tests

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	tests/lib/navigation/workspace-module-registry.test.ts
```

### 86ebb87049327cf9f2263e7ad7e3430ba2dc69b1
wip: preserve local work before unmerged branch audit

Branches: `wip/preserve-fix-service-editor-save-20261016-162215`

Scope: booking, payment, authorization, service catalog, Owner workspace, Staff portal / PWA, docs, tests, infrastructure

Approximate purpose: Preserves the source worktree files without release acceptance.

Changed files:
```text
A	CradleHub_Service_Editor_P1_Hotfix_Report.md
```

### 88c3aaef92754a9eb0339d45d19c69d9b19ba0f5
test(web): cover full retained workspace default

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: attendance, Owner workspace, tests, infrastructure

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/lib/config/mvp-flags.test.ts
```

### 91112ba835bfac2d0d3fbb16f53e514171352b0a
test(web): account for retained Owner cash flow wrapper

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: payment, Owner workspace, tests, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	tests/lib/cash-flow/owner-cash-flow-page.test.tsx
```

### 9357cde7281b6450811d6d1570120a580adc77d2
docs(pwa): finalize C2 external review handoff

Branches: `stage/pwa-c2-structured-diagnostics`

Scope: attendance, authorization, Owner workspace, Staff portal / PWA, docs, synchronization

Approximate purpose: Five diagnostic/handoff/recovery documentation commits. Historical governance recovery must not overwrite accepted later decisions.

Changed files:
```text
M	docs/pwa/PWA-C2-HANDOFF.md
```

### 96f5fef040c3f49a608090ca2573d6d174f6f672
test(sheet-sync): capture review and merge diagnostics

Branches: `stage/c5-sheet-assimilation-bridge`, `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215`

Scope: payment, authorization, Owner workspace, tests, infrastructure, synchronization

Approximate purpose: Six commits add Sheet readers, parsing, merge restoration, row accounting, resolution and smart ingestion dry-run plans plus a cash-flow page. Experimental/unfinished status must be decided independently; source identity and financial authority are sensitive.

Changed files:
```text
A	tests/lib/integrations/google-sheets/sheet-merge-diagnostics.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-review-diagnostics.live.test.ts
```

### 98a17d3f3fd311c0e6eb2179e73def1826a3d9b5
fix(web): expand branch-safe workspace retention policy

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: booking, Home Service, payment, attendance, authorization, Owner workspace, customer identity

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/components/features/dashboard/workspace-retention-policy.ts
```

### 991834979fc69bb030315e530a793f5d9d9a7211
fix(web): enable retained CRM and Owner workspaces by default

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: attendance, authorization, Owner workspace, infrastructure

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/lib/config/mvp-flags.ts
```

### 9d76b1bb54d0c4a1d39beed5e209b2b8019c8648
fix(services): unify service editor save and media updates

Branches: `fix/service-editor-save`, `wip/preserve-fix-service-editor-save-20261016-162215`

Scope: authorization, service catalog, Owner workspace, tests, synchronization, staff assignment

Approximate purpose: Unifies Owner/Marketing service mutations, media and cache invalidation, fixes metadataJson submission, and retains failed form edits. Newer catalog architecture overlaps; no functional supersession assertion made here.

Changed files:
```text
M	src/app/(dashboard)/marketing/actions.ts
M	src/app/(dashboard)/marketing/service-actions.ts
M	src/app/(dashboard)/owner/marketing/actions.ts
A	src/app/(dashboard)/owner/services/[serviceId]/owner-service-form.tsx
M	src/app/(dashboard)/owner/services/[serviceId]/page.tsx
M	src/app/(dashboard)/owner/services/actions.ts
M	src/components/features/marketing/services/services-studio-view.tsx
A	src/lib/services/service-mutation.ts
M	src/lib/validations/service.ts
M	tests/lib/marketing/brand-branches-services-studios.test.tsx
M	tests/lib/marketing/draft-publication-pipelines.test.ts
A	tests/lib/services/owner-service-form.test.tsx
A	tests/lib/services/service-editor-actions.test.ts
A	tests/lib/services/service-mutation.test.ts
```

### a663ae164c8269e50d8150085645622c96e43e49
fix(web): retain Owner home service workspace

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: booking, Home Service, payment, attendance, Owner workspace

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/components/features/dashboard/workspace-retention-policy.ts
```

### aadf7ff7ff80e71d68befc078e8e22adc1454938
fix(web): restore most recent Owner module scope from bare links

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Staff portal / PWA

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/components/features/dashboard/retained-workspace-provider.tsx
```

### bde990de12b8b5b37b3594dfa925c6eef680d196
docs(c1): consolidate current system truth

Branches: `stage/c1-truth-consolidation`

Scope: booking, Home Service, payment, attendance, authorization, service catalog, Owner workspace, Staff portal / PWA, docs, infrastructure, synchronization, customer identity, staff assignment

Approximate purpose: Historical truth/governance documentation delta. Preserve without overwriting newer active decisions; unique SHA does not imply current guidance.

Changed files:
```text
M	AI_CONTEXT.md
M	docs/02-CURRENT-SYSTEM-MAP.md
A	docs/03-CURRENT-SYSTEM-TRUTH.md
M	docs/11-DECISION-LOG.md
M	docs/12-KNOWN-ISSUES-REGISTER.md
M	docs/13-PROJECT-STATUS.md
```

### be29b731f80a52abc793b4f115f270b12676fafa
perf(web): overlap dashboard access and readiness queries

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: infrastructure, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/layout.tsx
```

### be75f37ee0c4055304ceddacc5726862a38dcaba
perf(web): overlap customer stats with segment query

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: synchronization, customer identity

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/crm/customers/page.tsx
```

### c2052943b3e488f2b3f270f01f65ba63417d5271
docs(pwa): finalize C2 evidence accuracy

Branches: `stage/pwa-c2-structured-diagnostics`

Scope: attendance, authorization, Owner workspace, Staff portal / PWA, docs, infrastructure

Approximate purpose: Five diagnostic/handoff/recovery documentation commits. Historical governance recovery must not overwrite accepted later decisions.

Changed files:
```text
M	docs/pwa/PWA-C2-HANDOFF.md
M	docs/pwa/PWA-C2-STRUCTURED-DIAGNOSTICS.md
```

### c3f8b10ab00275c14788565e14a6f6fc0be58192
feat(cash-flow): establish CF1 financial workspace

Branches: `stage/c5-cf2-central-ledger`

Scope: booking, Home Service, payment, attendance, authorization, Owner workspace, Staff portal / PWA, docs, tests, infrastructure, synchronization, customer identity

Approximate purpose: Three commits build/reshape Cash Flow reading, reconciliation summaries, transaction/correction/entry UI and CRM Today panels. Large historical financial/UI checkpoint; acceptance of this exact delta UNKNOWN.

Changed files:
```text
A	docs/audits/C5-CF1-CASH-FLOW-FOUNDATION.md
A	src/app/(dashboard)/crm/cash-flow/actions.ts
A	src/app/(dashboard)/crm/cash-flow/error.tsx
A	src/app/(dashboard)/crm/cash-flow/page.tsx
M	src/app/(dashboard)/crm/reconciliation/reconciliation-form.tsx
A	src/components/features/cash-flow/cash-flow-day-close.tsx
A	src/components/features/cash-flow/cash-flow-history.tsx
A	src/components/features/cash-flow/cash-flow-ledger.tsx
A	src/components/features/cash-flow/cash-flow-today.tsx
A	src/components/features/cash-flow/cash-flow-transaction-detail.tsx
A	src/components/features/cash-flow/cash-flow-ui.tsx
A	src/components/features/cash-flow/cash-flow-workspace.tsx
M	src/components/features/dashboard/nav-config.ts
M	src/components/features/workspace/workspace-prefetch-config.ts
A	src/lib/bookings/payment-summary.ts
A	src/lib/cash-flow/read-model.ts
M	src/lib/queries/bookings.ts
A	src/lib/queries/cash-flow.ts
A	tests/components/cash-flow/workspace.test.tsx
A	tests/lib/cash-flow/fixtures.ts
A	tests/lib/cash-flow/query.test.ts
A	tests/lib/cash-flow/read-model.test.ts
```

### d5af2af221125520b615f61e9cd3f533562f1268
test(web): keep CRM retention coverage within measured memory bound

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Staff portal / PWA, tests

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	tests/components/dashboard/retained-workspace-provider.test.tsx
```

### d9cf17bf6e48ed3022d99f1d54a9e99b7ac55fe0
fix(web): restore last retained branch query on workspace return

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Staff portal / PWA

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/components/features/dashboard/retained-workspace-provider.tsx
```

### d9ddfcf89b93e6dd9e38ffec53517465d952f3c7
chore(cash-flow): checkpoint CF1R working state

Branches: `stage/c5-cf2-central-ledger`

Scope: booking, Home Service, payment, attendance, authorization, tests, synchronization, customer identity

Approximate purpose: Three commits build/reshape Cash Flow reading, reconciliation summaries, transaction/correction/entry UI and CRM Today panels. Large historical financial/UI checkpoint; acceptance of this exact delta UNKNOWN.

Changed files:
```text
M	src/components/features/cash-flow/cash-flow-day-close.tsx
M	src/components/features/cash-flow/cash-flow-history.tsx
M	src/components/features/cash-flow/cash-flow-ledger.tsx
M	src/components/features/cash-flow/cash-flow-today.tsx
M	src/components/features/cash-flow/cash-flow-ui.tsx
M	src/components/features/cash-flow/cash-flow-workspace.tsx
M	src/lib/queries/bookings.ts
M	tests/components/cash-flow/workspace.test.tsx
M	tests/lib/cash-flow/query.test.ts
```

### da0b8abc644c7c1de6646bed2568a4b95d3c90a3
fix(web): suppress flashing sidebar navigation feedback

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: integration history only

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/components/features/dashboard/sidebar.tsx
```

### da270c88e4b59fe4e74ba63532774c015ab4f367
fix(safety): apply application-level P1 safety corrections pass 1

Branches: `fix/booking-safety-pass-1`

Scope: booking, Home Service, payment, authorization, Owner workspace, Staff portal / PWA, tests, synchronization, customer identity, staff assignment

Approximate purpose: Payment confirmation reads a frozen payable amount and checks cumulative payment; reconciliation and dispatch reads fail closed. Inspect against later atomic financial and booking authority before reuse.

Changed files:
```text
M	src/app/(dashboard)/crm/bookings/actions.ts
M	src/app/(dashboard)/crm/reconciliation/actions.ts
M	src/lib/bookings/dispatch-conflict.ts
M	src/lib/bookings/payment-gate.ts
A	tests/app/crm/confirm-payment-action.test.ts
A	tests/app/crm/reconciliation-actions.test.ts
A	tests/lib/bookings/dispatch-conflict.test.ts
M	tests/lib/bookings/payment-gate.test.ts
```

### deb9484e14a98bbd94761066073a0f01e62250b8
feat(sheet-sync): add zero-silent-drop accounting

Branches: `stage/c5-sheet-assimilation-bridge`, `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215`

Scope: payment, tests, infrastructure, synchronization

Approximate purpose: Six commits add Sheet readers, parsing, merge restoration, row accounting, resolution and smart ingestion dry-run plans plus a cash-flow page. Experimental/unfinished status must be decided independently; source identity and financial authority are sensitive.

Changed files:
```text
A	src/lib/integrations/google-sheets/sheet-accounting.ts
A	tests/lib/integrations/google-sheets/sheet-accounting.live.test.ts
A	tests/lib/integrations/google-sheets/sheet-accounting.test.ts
```

### df5987e5cf4f12b0a30622d572c9b5d5b6cc7ead
perf(web): reuse cached Owner authorization in schedule

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: booking, payment, authorization, Owner workspace, Staff portal / PWA, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/owner/schedule/page.tsx
```

### e2ab34ffd1735de7dee0a4f39b15183a258e694a
fix(web): remove duplicate CRM layout staff lookup

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: authorization, infrastructure, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/crm/layout.tsx
```

### e31b7a19516c3d22ceb7cdc4e5440ab3b8f3d615
test(web): cover Owner dispatch retention

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Home Service, payment, attendance, Owner workspace, tests

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	tests/lib/navigation/workspace-module-registry.test.ts
```

### e4d86bc8c2062d177aeab818a466715a47d65df9
fix(web): retain Owner schedule by branch

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: booking, payment, Owner workspace, Staff portal / PWA, infrastructure, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/owner/schedule/page.tsx
```

### e5e9e24d837b3a7159d2b432c6e3ffaf8c204dd1
test(web): preserve most recent Owner branch on retained return

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: booking, authorization, Owner workspace, Staff portal / PWA, tests, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	tests/components/dashboard/retained-workspace-provider.test.tsx
```

### e84a0745bc834ebf3b74b001fd837a5a2b81cd66
docs(pwa): record C2 governance recovery

Branches: `stage/pwa-c2-structured-diagnostics`

Scope: attendance, authorization, Owner workspace, Staff portal / PWA, docs, infrastructure

Approximate purpose: Five diagnostic/handoff/recovery documentation commits. Historical governance recovery must not overwrite accepted later decisions.

Changed files:
```text
M	docs/pwa/PWA-C2-HANDOFF.md
```

### eca8cff0a3c70686cbc63a4994d84491181ce649
fix(cash-flow): scope ledger activity to business date

Branches: `fix/p1-cash-flow-business-date-scope`

Scope: booking, payment, tests, synchronization, customer identity

Approximate purpose: Ledger/activity use selected business-date rows while session cash calculation retains historical session transactions. Query delta is independently reviewable; do not merge stale branch wholesale.

Changed files:
```text
M	src/lib/cash-flow/cash-flow-queries.ts
M	tests/lib/cash-flow/cash-flow-mixed-read-model.test.ts
M	tests/lib/cash-flow/payment-reconciliation-ui.test.tsx
```

### ee4afebb6c4607d5de4384810edc0ec4bcda39e6
test(web): assert retained return skips bootstrap skeleton

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Staff portal / PWA, tests

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	tests/components/dashboard/retained-workspace-provider.test.tsx
```

### f571073b41d86afaa9e9e3bae428d6b30651fb31
perf(web): retain and dedupe Owner dispatch context

Branches: `fix/p1-workspace-navigation-retention`, `fix/p1-workspace-navigation-retention-reconcile`

Scope: Home Service, authorization, Owner workspace, Staff portal / PWA, synchronization

Approximate purpose: Retains CRM/Owner module trees by role/branch, restores last branch context, changes memory/TTL policy, defaults retention on, and overlaps/caches authorization reads. Needs isolated authorization/cache/memory regression review.

Changed files:
```text
M	src/app/(dashboard)/owner/dispatch/page.tsx
```

## Appendix: Candidate Branch Relationships

Exact ancestor pairs among unmerged branches; equal tips are identified. This proves containment without relying on branch names.

- `fix/crm-grouped-order-display` → `fix/crm-therapist-assignment-provenance`, `fix/home-service-distance-pricing`, `stage/service-duration-extension`, `stage/web-checkpoint-integration-20261016`, `wip/sm-emergency-snapshot-20261016-122654`
- `fix/crm-therapist-assignment-provenance` → `fix/home-service-distance-pricing`, `stage/service-duration-extension`, `stage/web-checkpoint-integration-20261016`, `wip/sm-emergency-snapshot-20261016-122654`
- `fix/home-service-distance-pricing` → `stage/web-checkpoint-integration-20261016 (same SHA)`
- `fix/p1-workspace-navigation-retention-reconcile` → `fix/p1-workspace-navigation-retention`
- `fix/service-editor-save` → `wip/preserve-fix-service-editor-save-20261016-162215`
- `stage/c5-sheet-assimilation-bridge` → `wip/preserve-stage-c5-sheet-assimilation-bridge-20261016-162215`
- `stage/crm-multi-attendee-booking` → `fix/crm-grouped-order-display`, `fix/crm-therapist-assignment-provenance`, `fix/home-service-distance-pricing`, `stage/service-duration-extension`, `stage/web-checkpoint-integration-20261016`, `wip/sm-emergency-snapshot-20261016-122654`
- `stage/crm-performance-stabilization` → `fix/crm-grouped-order-display`, `fix/crm-therapist-assignment-provenance`, `fix/home-service-distance-pricing`, `stage/crm-multi-attendee-booking`, `stage/service-catalog-consolidation`, `stage/service-duration-extension`, `stage/web-checkpoint-integration-20261016`, `wip/sm-emergency-snapshot-20261016-122654`
- `stage/service-catalog-consolidation` → `fix/crm-grouped-order-display`, `fix/crm-therapist-assignment-provenance`, `fix/home-service-distance-pricing`, `stage/crm-multi-attendee-booking`, `stage/service-duration-extension`, `stage/web-checkpoint-integration-20261016`, `wip/sm-emergency-snapshot-20261016-122654`
- `stage/service-duration-extension` → `fix/home-service-distance-pricing`, `stage/web-checkpoint-integration-20261016`
- `stage/web-checkpoint-integration-20261016` → `fix/home-service-distance-pricing (same SHA)`

## Audit Gate and Limits

**CORRECTION REQUIRED for complete archival coverage:** all safely identified tracked/untracked work in registered existing worktrees and all non-main local branch tips are remotely preserved. Unknown ignored source archives and absent worktree directories prevent an unconditional claim that every historical local artifact is remotely preserved. No feature safety or migration readiness is certified.

Counts at evidence capture (audit branch local, before its own remote publication): `{"local": 56, "remote": 56, "unmerged": 25, "contained": 7, "independent": 10, "wip": 4, "migrations": 6, "divergences": 0}`. Final terminal handoff includes report publication.

Next authorized action: owner-requested separate final checkpoint on the verified integration branch. No merge/deployment/database mutation is authorized by this audit.
