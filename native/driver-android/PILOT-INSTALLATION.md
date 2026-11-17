# CradleHub Driver — controlled TEST pilot gates

**NOT READY TO DISTRIBUTE.** The 2026-11-17 owner brief supersedes the earlier WebView companion with the native Kotlin/Compose candidate. See [README](README.md) and [current handoff](../../docs/reports/DRIVER-NATIVE-COMPOSE-HANDOFF-2026-11-17.md).

The local emulator APK has synthetic UI fixtures, an invalid Navigation key and no connected authority. It is not a driver installation artifact. The Chrome PWA remains unchanged; native UI updates require a new reviewed APK.

Before any connected pilot:

1. Identify an existing approved isolated TEST API deployment and matching Supabase TEST project. Verify the existing journey/device contracts are installed under separate target-aware approval. Do not activate SQL or use live staff/bookings as a substitute.
2. Configure native TEST origin, Supabase URL and a public publishable/anon key, as documented in README. Verify auth/RLS, server actor/assignment checks, SSR cookie compatibility, refresh/logout and revocation end to end.
3. Approve package identity, permanent TEST signing key, phone model/version and a Google Navigation key restricted by API, package and signer fingerprint. Preserve Google's terms, attribution and safety UI.
4. Supply matching TEST Firebase configuration only if push acceptance is authorized. Confirm token ownership, opt-out, logout and reassignment; do not send production notifications.
5. Complete the native physical-device and CRM test matrix in the handoff, then independent external review and owner acceptance.
6. Separately authorize any main merge, signed build, staff distribution or deployment.

The existing `.pilot` package/signing guards remain. Its packaging task now also requires native TEST configuration matching `CRADLE_PILOT_WEB_ORIGIN`; that legacy property is only a consistency gate, not a browser destination. The old GitHub signed-artifact workflow has not been updated to supply native configuration and is intentionally not an authorized distribution path for this candidate. Do not weaken its guards to get an APK.

A later approved pipeline must inject native TEST configuration and Android-restricted credentials via protected owner-managed settings, verify the signature and SHA-256, use private short-lived artifact access, and retain human release gates. Keep keystore passwords and private signing material out of source/logs/chat.

First approved TEST phone acceptance: native email/password sign-in → Today/Trips → trip tap opens Map immediately → one Start → guidance → pickup arrival → explicit boarding → customer delivery → therapist service → leave and return for collection → explicit collection → branch return → explicit drop-off. End route stops guidance without completing transport or attendance. Also test Scan, More destinations, background/tab continuity, lost network, cancellation/reassignment, denied/revoked permissions and notification opt-out.

If acceptance fails, retain the PWA and previously accepted Android package, park this candidate and record evidence. No production change or distributed APK exists to roll back in this task.
