# Driver Connected TEST — README

Use **Driver Connected TEST** from the Android debug build to try the same driver-first native screens with actual server-authorized TEST data. This is a separately gated integration; the `Driver Flow Demo` with fixture trips and the operational `CradleHub Staff` launcher are still present.

Only for a TEST deployment: set `NATIVE_DRIVER_CONNECTED_ENABLED=true` on the server, with a TEST database and TEST driver account. It is intentionally disabled by default and must never be enabled on live production merely to test the app.

Native screens call `/api/staff/driver/native-workspace` (GET) and `/api/staff/driver/native-travel` (POST). Both require the existing WebView staff session and check server-side driver/branch assignment. Native app caches only presentation preferences. No offline booking mutations.

One tap on an active assigned trip requests authorized Start Travel, then the existing native Navigation SDK uses the already-authorized `/api/staff/driver/native-itinerary`. After the SDK reports final arrival, staff must tap Confirm arrival to ask the existing server progress action. The SDK event alone does NOT update the database.

On your local Windows PC keep your `.staffpreview` application ID suffix and previously copied Gradle wrapper. Fetch the review branch, copy only the newly modified Java/manifest files and the new Android connected files; do not reset local Gradle or overwrite the existing Driver APK. Build using Android Studio's JBR and an authorized TEST origin configured by `CRADLE_STAFF_ORIGIN` and Google Android-restricted API key.

No standalone login is added: open the existing Staff Portal within the same app to sign in. Sessions belong to existing Supabase-backed WebView cookies; backend authorization and token rotation remain server-side. The Android app does not save a token or role.

Detailed acceptance and rollback are in `docs/reports/DRIVER-NATIVE-CONNECTED-TEST-20261110.md`. REVIEW ONLY; not deployed or tested on a device.