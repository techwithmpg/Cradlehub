import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const realtime = readFileSync(
  "src/components/features/attendance/use-attendance-scan-realtime.ts",
  "utf8"
);
const card = readFileSync(
  "src/components/features/attendance/attendance-scan-feed-card.tsx",
  "utf8"
);
const dashboard = readFileSync(
  "src/components/features/crm/today/cradle-flow-dashboard.tsx",
  "utf8"
);

describe("Attendance realtime resilience contract", () => {
  it("tracks actual channel status and reconciles degraded connections", () => {
    expect(realtime).toContain('nextStatus === "SUBSCRIBED"');
    expect(realtime).toContain('nextStatus === "CHANNEL_ERROR"');
    expect(realtime).toContain('nextStatus === "TIMED_OUT"');
    expect(realtime).toContain('window.addEventListener("online"');
    expect(realtime).toContain('document.addEventListener("visibilitychange"');
    expect(realtime).toContain("DEGRADED_RECONCILE_INTERVAL_MS");
  });

  it("does not hard-code a Live badge", () => {
    expect(card).toContain('label: "Live"');
    expect(card).toContain('label: "Delayed"');
    expect(card).toContain('label: "Offline"');
    expect(card).toContain("realtimeStatus");
  });

  it("uses one live feed for the side rail and recent activity", () => {
    expect(dashboard).toContain("const attendanceState = useAttendanceScanFeed");
    expect(dashboard).toContain("attendanceFeed={attendanceState.feed}");
    expect(dashboard).toContain("attendance={attendanceState.feed}");
  });
});
