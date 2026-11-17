# Owner-approved main integration — 2026-11-17

The owner explicitly requested merging everything completed in this chat into local main and then pushing remote. This supersedes the earlier no-merge/no-push boundary for source integration only. It does not certify live Android navigation or authorize SQL execution, feature activation, APK distribution or a new Cron schedule. Main is production-connected; its normal Web deployment may follow the authorized push.

## Source included and review

- Accepted/reconciled main: `51ba200580068691a0358323e00c8c4a7a8de11e` (already includes the separately reviewed Attendance V2 work and one-scan120-minute policy).
- Reviewed Driver code/test head: `9b3f1923e6f1858b93af1310f33adc52a51cb7b4`, branch `stage/driver-native-compose-20261117`.
- Includes prior unified Web/native source `e1bbba4b`, exact approved LOCAL TEST evidence `1e23e92f`, native Compose source `5ae93d7a`, owner phone connection `30218cde`, their handoffs/evidence and this chat's investigation commit `09434ffa`.
- The investigation history/report was merged at `852157ef`, preserving the newer active governance where old investigation-only notes conflicted. It is historical evidence, not a rollback to the old scope.
- Final integration commit is the merge of this reviewed branch into main; resolve exact local/remote heads from Git. The following closeout commit contains review/evidence/authorization only.
- Unrelated branches/worktrees and pre-existing untracked image assets are outside this integration and are preserved.

Pre-merge source review covered inactive feature paths, existing itinerary/Start compatibility, authentication/assignment boundaries, native default/inert configuration, signed-package guards, API-origin/body checks, server-only push credentials, manual SQL location/permissions and absence of an automatic installation path. No new blocker was found for the owner-authorized source integration with those runtime features inactive. This was an implementation review, **not an independent external release verdict**. Existing external/device acceptance gates remain recorded.

## Verification

| Check | Result |
| --- | --- |
| Driver suite | **164/164 pass**,19 test files. The obsolete WebView-host assertion now checks the actual Compose host, persistent SDK fragment, secure transport and GPS contract. [Result](driver-main-integration-2026-11-17/merge-driver-tests-final.log). |
| Full TypeScript | `tsc --noEmit` exit0 on the reconciled candidate. |
| Web production build | Next16.2.4 webpack build passes with synthetic `.invalid` Supabase configuration, fake credentials and new controls false. No live runtime env was copied into the candidate. [Build](driver-main-integration-2026-11-17/merge-web-build.log). |
| Scoped lint |0 errors; one inherited unused helper warning. [Lint](driver-main-integration-2026-11-17/merge-eslint.log). |
| Android |40 JVM tests pass and inert pilot Kotlin/Java source compilation passes without production keys, signing or packaging. [Compile](driver-main-integration-2026-11-17/merge-native-compile.log). Prior seven emulator UI cases and owner phone authenticated reads remain in the native handoff. |
| SQL evidence | All approved contract hashes match the package previously tested in22 disposable LOCAL TEST scenarios. No database was contacted or mutated during this merge verification; no SQL rerun or activation. |
| Secret/scope checks | No matching Google key, Supabase secret-key material or private-key blocks in changed tracked text. `git diff --check` passes. No new files under migrations and no workflow installing this operations SQL. |
| Hosted flags | Read-only Vercel metadata listed29 variables; no `CRADLEHUB_DRIVER_*` activation variables are configured. No env value or secret was printed or changed. |

The generic Staff Scan source-contract test still fails on **accepted main**: its central Scan branch uses Next Link while that old assertion requires a raw anchor. The baseline was reproduced using root-only discovery (one failure/27 skipped). It was not hidden by changing the assertion or unrelated production behavior. [Baseline](driver-main-integration-2026-11-17/accepted-main-scan-baseline.txt). The earlier broader15-failure baseline is in the unified handoff; no claim is made that the entire repository suite is green.

## Deployment and remaining gates

The unified journey SQL remains a manual, inactive candidate under `supabase/operations`, outside automatic migrations. Journey, native GPS and native push flags default false; no scheduled push job was added. The native owner client can use existing booking RLS and native itinerary/Start when the deployed journey API is inactive, without inventing collection state or bypassing denied authority. After Web deployment, new endpoints may exist but return inactive responses until separately approved installation/activation.

Phone Auth/Driver/attendance reads work; full-area Map and PWA icon are installed. Google key authorization remains open while the owner corrects the existing Android key restrictions. Real guidance/GPS/voice/QR/CRM/push, installed Supabase parity and independent external review are not certified by a Git merge. The protected manual pilot packaging path also remains unconfigured for native TEST credentials; no general APK release is authorized.

No production SQL, Auth/RLS change, flag activation, native-key/IAM permission change, live booking/attendance mutation or APK distribution is performed by this integration. Earlier owner-authorized Google service activation and phone access are recorded in the phone handoff. For source rollback, use a reviewed revert of the integration merge after inspecting any intervening commits; never reset/force-push main or delete unrelated assets.
