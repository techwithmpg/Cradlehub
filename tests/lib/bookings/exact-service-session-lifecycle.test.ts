import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeServiceTimerState } from "@/lib/bookings/service-session";

describe("exact service-session lifecycle", () => {
  it("uses session_due_at exactly and enters overtime without completing", () => {
    const state = computeServiceTimerState(
      {
        status: "in_progress",
        progressStatus: "session_started",
        sessionStartedAt: "2026-07-16T15:27:18+08:00",
        sessionDueAt: "2026-07-16T16:27:18+08:00",
        durationMinutes: 60,
      },
      new Date("2026-07-16T16:35:18+08:00").getTime(),
      new Date("2026-07-16T15:27:18+08:00").getTime()
    );

    expect(state?.phase).toBe("overtime");
    expect(state?.displaySecs).toBe(8 * 60);
    expect(state?.isDue).toBe(true);
  });

  it("installs row-locked lifecycle RPCs and disables per-minute completion", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260716110000_exact_service_session_lifecycle.sql"
      ),
      "utf8"
    );

    expect(migration).toContain("start_booking_service_session");
    expect(migration).toContain("complete_booking_service_session");
    expect(migration).toContain("extend_booking_service_session");
    expect(migration).toContain("for update");
    expect(migration).toContain("cron.unschedule");
    expect(migration).toContain("A due session is overtime, not completed");
  });
});
