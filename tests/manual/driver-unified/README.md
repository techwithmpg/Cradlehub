# Disconnected Driver component preview

Run `node tests/manual/driver-unified/server.mjs` under the repository's Node 24 environment with the frozen dependencies installed. Open `http://127.0.0.1:4323/staff/driver`.

This harness imports the real candidate UI. Staff, assignments and navigation hooks use synthetic fixtures. All application fetches return a rejected LOCAL TEST result. No Supabase environment, authentication credential, booking mutation, push or Google route request is used. The scanner may request browser camera permission; automated evidence only covers the unavailable/recovery screen. It does not demonstrate a phone camera or successful QR decode.

Scenarios: `?scenario=collection`, `?scenario=board`, `?scenario=empty`, `?scenario=error`. Secondary pages: `/staff/driver/more`, `/staff/scan`, `/staff/driver/map`. The map page explicitly shows that native guidance is unavailable in this browser preview. It is not an Android or Google Navigation SDK simulation.

Visual checks: 320/390/768 CSS pixel widths, four equal navigation items, pickup and collection kept separate, no horizontal overflow, failed boarding leaves the stage unchanged. Captures are under `docs/reports/assets/driver-unified-android-20261117/` and carry a LOCAL TEST watermark. Physical navigation, voice, lifecycle, camera and FCM delivery acceptance remains required on an approved device/backend target.
