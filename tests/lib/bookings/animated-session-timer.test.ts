import { describe, it, expect } from "vitest";
import { formatSessionCountdown, getSessionTimerDisplay } from "@/lib/bookings/animated-session-timer";
const start = Date.parse("2026-11-02T15:30:00Z");
const session = {
  status: "in_progress",
  booking_progress_status: "session_started",
  session_started_at: new Date(start).toISOString(),
  session_due_at: new Date(start + 60 * 60_000).toISOString(),
  durationMinutes: 60,
};
describe("persisted session timer", () => {
  it("does not count scheduled time as actual service", () => {
    expect(
      getSessionTimerDisplay(
        {
          ...session,
          status: "confirmed",
          booking_progress_status: "checked_in",
          session_started_at: null,
        },
        start + 30 * 60_000
      )
    ).toMatchObject({ active: false, phase: "scheduled", minutes: 60, progress: 0 });
  });
  it("uses actual persisted timestamps after refresh and across midnight", () => {
    expect(getSessionTimerDisplay(session, start + 30 * 60_000)).toMatchObject({
      active: true,
      phase: "running",
      minutes: 30,
      displayTime: "00:30:00",
      progress: 50,
    });
  });
  it("updates visible seconds from persisted due time", () => {
    expect(getSessionTimerDisplay(session, start + 59_000).displayTime).toBe("00:59:01");
    expect(getSessionTimerDisplay(session, start + 60_000).displayTime).toBe("00:59:00");
    expect(formatSessionCountdown(45 * 60, false)).toBe("45:00");
  });
  it("shows the two-minute automatic-completion grace only when enabled", () => {
    const enabled = { ...session, autoCompletionEnabled: true };
    expect(getSessionTimerDisplay(enabled, start + 60 * 60_000)).toMatchObject({
      phase: "grace", displayTime: "02:00", graceSeconds: 120,
    });
    expect(getSessionTimerDisplay(enabled, start + 61 * 60_000)).toMatchObject({
      phase: "grace", displayTime: "01:00", graceSeconds: 60,
    });
    expect(getSessionTimerDisplay(enabled, start + 62 * 60_000)).toMatchObject({
      phase: "overtime", displayTime: "+00:02:00",
    });
  });
  it("enters the five-minute urgency window", () =>
    expect(getSessionTimerDisplay(session, start + 55 * 60_000)).toMatchObject({
      phase: "ending",
      minutes: 5,
    }));
  it("shows read-only overtime", () =>
    expect(getSessionTimerDisplay(session, start + 65 * 60_000)).toMatchObject({
      phase: "overtime",
      minutes: 5,
      progress: 100,
    }));
  it("stops completed and closed sessions despite old start timestamps", () => {
    expect(
      getSessionTimerDisplay({ ...session, status: "completed" }, start + 99 * 60_000)
    ).toMatchObject({ active: false, phase: "completed" });
    expect(
      getSessionTimerDisplay({ ...session, status: "no_show" }, start + 99 * 60_000)
    ).toMatchObject({ active: false, phase: "closed" });
  });
  it("retargets a committed extension while preserving actual start", () => {
    expect(
      getSessionTimerDisplay(
        { ...session, session_due_at: new Date(start + 90 * 60_000).toISOString() },
        start + 60 * 60_000
      )
    ).toMatchObject({ phase: "running", minutes: 30 });
    expect(session.session_started_at).toBe(new Date(start).toISOString());
  });
  it("fails neutral for malformed persisted plans", () =>
    expect(getSessionTimerDisplay({ ...session, session_due_at: "bad" }, start)).toMatchObject({
      active: false,
      phase: "scheduled",
    }));
});
