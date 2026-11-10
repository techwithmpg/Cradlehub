# Android Driver native flow preview — review handoff (2026-11-10)

OWNER REQUEST: Build and inspect the reduced Driver UI flow. Tapping a trip starts the navigation SCREEN without a separate details step; do not alter authoritative staff/booking logic.

- Scope: isolated Android DEBUG-only native UX demo, not Desktop/Web stabilization work.
- Base SHA: 79c76c9591f6678ee606631b5ed95c6bd7ed7746 (staff Android shell branch).
- Branch: stage/driver-native-flow-preview-20261110.
- Files: new debug manifest and native DriverExperiencePreviewActivity / DriverPreviewState, JVM tests, docs. No existing production application sources changed.
- Consumer/ownership: DriverShellActivity, NativeNavigationActivity, Web authenticated booking actions and Supabase RLS unchanged; demo never calls them. Real server remains the sole source of truth.
- Effects: debug APK contains an extra launcher 'Driver Flow Demo'. Sample navigation screen depicts a map without Google SDK/GPS; Arrived and Next trip never mutate or assert real booking state.
- Local persistence: SharedPreferences contains only enum screen, enum filter and 1/2 fixture selection; no PII, session, route destination, authorization state or pending offline mutations.
- Quality gates: Gradle app:testDebugUnitTest + app:assembleDebug, source review, phone tests for tap-through, last-screen restoration, tab changes, Android back, no live writes, alongside existing Staff Portal.
- Limitations: remote authored code has no physical-device or real Google Navigator verification; cannot claim actual network performance, WebView session reliability or background notifications.
- Review verdict: REVIEW ONLY, pending CI + Android device acceptance and owner approval. No production deployment or merge authorized.
- Rollback: do not copy debug-only files to local worktree, or close draft PR. Existing operational app and server unchanged.